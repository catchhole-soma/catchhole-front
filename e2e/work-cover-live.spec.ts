import { expect, type Page } from '@playwright/test';
import { chmod, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from './local-live-fixture';

test('작품 표지를 저장·재접속·교체·삭제하고 취소·저장소 장애·타인 접근을 검증한다', async ({ page, browser, request, liveAccount }) => {
  test.setTimeout(150_000);
  const { api, email, password } = liveAccount;
  const login = await request.post(`${api}/api/v1/auth/login`, { data: { email, password } });
  expect(login.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await login.json()).data.accessToken}` };
  const title = '표지 연결 검증';
  const created = await request.post(`${api}/api/v1/works`, { headers, data: { title, genre: '판타지', description: '표지만 바꾸는 작품' } });
  expect(created.ok()).toBeTruthy();
  const workId = (await created.json()).data.id as string;
  const url = `${api}/api/v1/works/${workId}`;
  const getWork = async () => (await (await request.get(url, { headers })).json()).data;
  const analysisRequests: string[] = [];
  page.on('request', value => { if (value.method() === 'POST' && /analysis-jobs|analyze|validation/.test(value.url())) analysisRequests.push(value.url()); });

  async function signIn(target: Page) {
    await target.goto('/login');
    await target.getByPlaceholder('이메일').fill(email);
    await target.getByPlaceholder('비밀번호', { exact: true }).fill(password);
    await target.getByRole('button', { name: '로그인', exact: true }).click();
    await target.waitForURL('**/works');
    expect(await target.evaluate(() => Boolean(localStorage.getItem('accessToken')))).toBe(true);
    expect(await target.evaluate(() => localStorage.getItem('refreshToken'))).toBeNull();
    expect((await target.context().cookies()).some(cookie => cookie.httpOnly)).toBe(true);
  }
  await signIn(page);
  const fixtures = await page.evaluate(async () => {
    const result: { name: string; mimeType: string; bytes: number[] }[] = [];
    for (const [index, mime] of ['image/png', 'image/jpeg', 'image/webp'].entries()) {
      const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 320;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = ['#d5e8f7', '#d4ebd9', '#e7dafa'][index]; ctx.fillRect(0, 0, 240, 320);
      ctx.fillStyle = '#203e68'; ctx.font = 'bold 26px sans-serif'; ctx.fillText(`COVER ${index + 1}`, 38, 110);
      ctx.fillRect(40, 145, 160, 4); ctx.font = '16px sans-serif'; ctx.fillText('CatchHole', 73, 185);
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), mime));
      result.push({ name: `cover.${['png', 'jpg', 'webp'][index]}`, mimeType: mime, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) });
    }
    return result;
  });
  const files = fixtures.map(({ name, mimeType, bytes }) => ({ name, mimeType, buffer: Buffer.from(bytes) }));
  const dialog = page.getByRole('dialog', { name: '작품 정보 수정' });
  const open = async () => {
    await page.getByRole('button', { name: `${title} 작품 선택`, exact: true }).hover();
    await page.getByRole('button', { name: `${title} 수정`, exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS('opacity', '1');
  };
  async function select(index: number) {
    await dialog.getByLabel('표지 이미지 선택', { exact: true }).setInputFiles(files[index]);
    await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
    await expect(dialog.getByAltText('작품 표지 미리보기')).toHaveJSProperty('naturalWidth', 240);
  }
  async function save() {
    const response = page.waitForResponse(value => value.url() === `${url}/cover` && value.request().method() === 'PATCH');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    expect((await response).status()).toBe(200);
    await expect(dialog).toHaveCount(0);
  }
  await open();
  await select(0);
  expect((await getWork()).coverImageId).toBeNull();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  expect((await getWork()).coverImageId).toBeNull();
  await open(); await select(0);
  await page.screenshot({ path: 'docs/screens/gh436/cover-edit-desktop.png' });
  await save();
  const original = await getWork();
  await expect(page.getByAltText(`${title} 표지`)).toHaveJSProperty('naturalWidth', 240);
  await page.reload();
  await expect(page.getByAltText(`${title} 표지`)).toHaveJSProperty('naturalWidth', 240);
  await page.screenshot({ path: 'docs/screens/gh436/cover-list-desktop.png' });
  const otherDevice = await browser.newContext({ baseURL: page.url().split('/works')[0] });
  try {
    const device = await otherDevice.newPage(); await signIn(device);
    await expect(device.getByAltText(`${title} 표지`)).toHaveJSProperty('naturalWidth', 240);
  } finally { await otherDevice.close(); }

  await open(); await select(1);
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  expect((await getWork()).coverImageId).toBe(original.coverImageId);
  await open(); await dialog.getByRole('button', { name: '표지 삭제', exact: true }).click();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  expect((await getWork()).coverImageId).toBe(original.coverImageId);

  await open();
  await dialog.getByLabel('표지 이미지 선택', { exact: true }).setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('<svg/>') });
  await expect(dialog.getByRole('alert')).toContainText('JPG·PNG·WebP');
  await select(1);
  const root = process.env.CATCHHOLE_E2E_STORAGE_ROOT;
  if (root) {
    const directory = join(root, 'works', workId, 'cover-images');
    await chmod(directory, 0o555);
    try {
      const failed = page.waitForResponse(value => value.url() === `${url}/cover` && value.request().method() === 'PATCH');
      await dialog.getByRole('button', { name: '저장', exact: true }).click();
      expect((await failed).status()).toBe(500);
      await expect(dialog.getByRole('alert')).toContainText('수정하지 못했습니다');
      await expect(dialog.getByAltText('작품 표지 미리보기')).toHaveJSProperty('naturalWidth', 240);
      expect((await getWork()).coverImageId).toBe(original.coverImageId);
      expect((await request.get(`${url}/cover/${original.coverImageId}`, { headers })).status()).toBe(200);
    } finally { await chmod(directory, 0o755); }
  } else test.info().annotations.push({ type: 'storage-failure-not-run', description: '로컬 파일 저장소 경로 미설정' });
  await save();
  const replaced = await getWork();
  expect(replaced.coverImageId).not.toBe(original.coverImageId);
  expect((await request.get(`${url}/cover/${original.coverImageId}`, { headers })).status()).toBe(404);
  await open(); await select(2); await save();
  const webp = await getWork();
  expect(webp.coverVersion).toBe(3);
  expect((await request.get(`${url}/cover/${webp.coverImageId}`)).status()).toBe(401);
  const otherLogin = await request.post(`${api}/api/v1/auth/login`, { data: { email: process.env.CATCHHOLE_E2E_SEED_EMAIL, password } });
  expect(otherLogin.ok()).toBeTruthy();
  const otherHeaders = { Authorization: `Bearer ${(await otherLogin.json()).data.accessToken}` };
  expect((await request.get(`${url}/cover/${webp.coverImageId}`, { headers: otherHeaders })).status()).toBe(404);
  for (const action of ['REPLACE', 'REMOVE']) {
    const metadata = { work: { title, genre: '판타지' }, action, expectedCoverVersion: 3 };
    const denied = await request.patch(`${url}/cover`, { headers: otherHeaders, multipart: {
      metadata: { name: 'metadata.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(metadata)) },
      ...(action === 'REPLACE' ? { image: files[0] } : {}),
    } });
    expect(denied.status()).toBe(404);
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await open();
  await expect(dialog.getByAltText('작품 표지 미리보기')).toHaveJSProperty('naturalWidth', 240);
  await page.screenshot({ path: 'docs/screens/gh436/cover-edit-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole('button', { name: '표지 삭제', exact: true }).click(); await save();
  await expect(page.getByAltText(`${title} 표지`)).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.work-card__cover svg')).toBeVisible();
  expect((await getWork()).coverImageId).toBeNull();
  if (root) expect(await readdir(join(root, 'works', workId, 'cover-images'))).toEqual([]);
  expect(analysisRequests).toEqual([]);

  // 현재 표지가 있는 작품의 영구 삭제도 실제 저장소 경로를 정리해야 한다.
  await open(); await select(0); await save();
  const purge = await request.delete(url, { headers, data: { confirmation: '영구 삭제' } });
  expect(purge.status()).toBe(202);
  const purgeId = (await purge.json()).data.requestId;
  await expect.poll(async () => (await (await request.get(`${api}/api/v1/works/purge-requests/${purgeId}`, { headers })).json()).data.status,
    { timeout: 40_000 }).toBe('COMPLETED');
  if (root) expect(await stat(join(root, 'works', workId)).then(() => true, () => false)).toBe(false);
});
