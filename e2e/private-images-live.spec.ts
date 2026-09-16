import { expect, test } from '@playwright/test';
import { purgeWorkAndWait } from './live-work-purge';

const api = process.env.CATCHHOLE_E2E_API_BASE_URL;
// Dedicated disposable account: this test creates a vault and never uses an author's recovery key.
const email = process.env.CATCHHOLE_PRIVATE_E2E_EMAIL;
const password = process.env.CATCHHOLE_PRIVATE_E2E_PASSWORD;
test('개인 이미지 생성·업로드·선택·잠금·복구·삭제를 실제 서버에 연결한다', async ({ page, request }) => {
  test.skip(!api || !email || !password, '보관함이 없는 일회용 로컬 테스트 계정이 필요합니다.');
  test.setTimeout(90_000);
  const login = await request.post(`${api}/api/v1/auth/login`, { data: { email, password } });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).data.accessToken;
  const authorization = `Bearer ${token}`;
  const headers = { Authorization: authorization };
  const existing = await request.get(`${api}/api/v1/private-image-vault`, { headers });
  expect((await existing.json()).data).toBeNull();
  const created = await request.post(`${api}/api/v1/works`, { headers, data: { title: '암호화 이미지 검증', genre: '판타지', description: '일회용 테스트' } });
  expect(created.ok()).toBeTruthy();
  const workId = (await created.json()).data.id;
  try {
    const setting = await request.post(`${api}/api/v1/works/${workId}/world-settings`, { headers,
      data: { category: 'RACE', subjectName: '비밀 고블린', settingName: '성격', settingValue: '호기심이 많다.' } });
    expect(setting.ok()).toBeTruthy();
    const settingId = (await setting.json()).data.id;
    const detailUrl = `${api}/api/v1/works/${workId}/world-settings/${settingId}`;
    await page.goto('/login');
    await page.evaluate(value => localStorage.setItem('accessToken', value), token);
    await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=worldsettings&category=RACE`);
    await page.getByRole('button', { name: '비밀 고블린 세계관 대상 보기' }).click();
    await page.getByRole('button', { name: '이미지 변경', exact: true }).click();
    const picker = page.getByRole('dialog', { name: '대표 이미지 선택', exact: true });
    await picker.getByRole('button', { name: '내 이미지', exact: true }).click();
    await picker.getByRole('button', { name: '내 이미지 시작하기', exact: true }).waitFor();
    await page.screenshot({ path: 'docs/screens/gh194/private-image-welcome-desktop.png' });
    await page.setViewportSize({ width: 320, height: 740 });
    await page.screenshot({ path: 'docs/screens/gh194/private-image-welcome-mobile.png' });
    await page.setViewportSize({ width: 1280, height: 720 });
    await picker.getByRole('button', { name: '내 이미지 시작하기', exact: true }).click();
    const recoveryKey = await picker.getByLabel('내 보관용 코드', { exact: true }).inputValue();
    await expect(picker.getByRole('button', { name: '보관함 사용하기' })).toBeDisabled();
    await picker.getByRole('checkbox').check();
    await picker.getByRole('button', { name: '보관함 사용하기' }).click();
    const imageBytes = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#127d52'; ctx.fillRect(0, 0, 120, 80);
      ctx.fillStyle = '#bbff88'; ctx.fillRect(20, 15, 80, 50);
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!)));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    await page.evaluate(key => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const request = input instanceof Request ? input.clone() : new Request(input, init);
        if (request.method === 'POST' && request.url.endsWith('/private-world-images')) {
          const body = new TextDecoder().decode(await request.clone().arrayBuffer());
          (window as unknown as { privateUploadSafe: boolean }).privateUploadSafe = !body.includes(key) && !body.includes('작가만-보는-원본.png') && body.includes('CHI1');
        }
        return originalFetch(input, init);
      };
    }, recoveryKey);
    const uploadResponse = page.waitForResponse(response => response.url().endsWith(`/works/${workId}/private-world-images`) && response.request().method() === 'POST');
    await picker.getByLabel('내 이미지 파일 선택').setInputFiles({ name: '작가만-보는-원본.png', mimeType: 'image/png', buffer: Buffer.from(imageBytes) });
    const uploaded = await uploadResponse;
    expect(uploaded.status()).toBe(200);
    const uploadedJson = await uploaded.json();
    expect(JSON.stringify(uploadedJson)).not.toContain('작가만');
    const imageId = uploadedJson.data.id;
    const option = picker.getByRole('button', { name: '작가만-보는-원본.png 이미지 선택', exact: true });
    await expect(option.locator('img')).toHaveJSProperty('naturalWidth', 120);
    await expect(option).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: 'docs/screens/gh194/private-image-picker-desktop.png' });
    expect(await page.evaluate(() => (window as unknown as { privateUploadSafe: boolean }).privateUploadSafe)).toBe(true);
    const cipherUrl = `${api}/api/v1/works/${workId}/private-world-images/${imageId}/image`;
    const ciphertext = await request.get(cipherUrl, { headers });
    expect(ciphertext.headers()['cache-control']).toContain('no-store');
    expect((await ciphertext.body()).subarray(0, 4).toString()).toBe('CHI1');
    expect(await ciphertext.body()).not.toEqual(Buffer.from(imageBytes));
    expect((await request.get(cipherUrl)).status()).toBe(401);
    await picker.getByRole('button', { name: '이미지 저장', exact: true }).click();
    await expect(picker).toHaveCount(0);
    const saved = (await (await request.get(detailUrl, { headers })).json()).data;
    expect(saved.image).toMatchObject({ source: 'PRIVATE', privateImageId: imageId, version: 1 });
    expect(saved.version).toBe(0);
    await expect(page.locator('.world-setting-detail-image img')).toHaveJSProperty('naturalWidth', 120);
    await page.reload();
    await expect(page.locator('.world-setting-detail-image')).toContainText('잠긴 내 이미지');
    await page.getByRole('button', { name: '이미지 변경', exact: true }).click();
    await picker.getByLabel('보관용 코드', { exact: true }).fill('CHI1-' + 'A'.repeat(43));
    await picker.getByRole('button', { name: '잠금 풀기', exact: true }).click();
    await expect(picker.getByRole('alert')).toContainText('이 보관함의 코드가 아니에요');
    await picker.getByLabel('보관용 코드', { exact: true }).fill(recoveryKey);
    await picker.getByRole('button', { name: '잠금 풀기', exact: true }).click();
    await expect(option.locator('img')).toHaveJSProperty('naturalWidth', 120);
    await picker.getByRole('button', { name: '삭제', exact: true }).click();
    await picker.getByRole('button', { name: '삭제하기', exact: true }).click();
    await expect(picker.getByRole('alert')).toContainText('사용 중');
    await page.setViewportSize({ width: 320, height: 740 });
    await page.screenshot({ path: 'docs/screens/gh194/private-image-picker-mobile.png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await picker.getByRole('button', { name: '보관함 잠그기' }).click();
    await expect(picker.getByLabel('보관용 코드', { exact: true })).toBeVisible();
    await expect(page.locator('img[src^="blob:"]')).toHaveCount(0);
    await picker.getByRole('button', { name: '공용 도감', exact: true }).click();
    await picker.getByRole('button', { name: /분류 기본 이미지/ }).click();
    await picker.getByRole('button', { name: '이미지 저장', exact: true }).click();
    await expect(picker).toHaveCount(0);
    const deleted = await request.delete(`${api}/api/v1/works/${workId}/private-world-images/${imageId}`, { headers });
    expect(deleted.status()).toBe(200);
    expect((await request.get(cipherUrl, { headers })).status()).toBe(404);
  } finally { await purgeWorkAndWait(request, api!, authorization, workId); }
});
