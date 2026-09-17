import { expect, test } from '@playwright/test';
import { purgeWorkAndWait } from './live-work-purge';

const api = process.env.CATCHHOLE_E2E_API_BASE_URL;
const email = process.env.CATCHHOLE_GUIDE_E2E_EMAIL;
const password = process.env.CATCHHOLE_GUIDE_E2E_PASSWORD;

test('첫 분석 안내는 실제 계정에 한 번 기록하고 예시 확정은 실제 작품에 저장하지 않는다', async ({ page, request }) => {
  test.skip(!api || !email || !password, '분석 이력 없는 격리 계정과 로컬 서버가 필요합니다.');
  const login = await request.post(`${api}/api/v1/auth/login`, { data: { email, password } });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const guideUrl = `${api}/api/v1/analysis-mode-guide`;
  expect((await (await request.get(guideUrl, { headers })).json()).data.shouldShow).toBe(true);
  const work = await request.post(`${api}/api/v1/works`, { headers, data: { title: '안내 체험 검증', genre: '판타지' } });
  expect(work.ok()).toBeTruthy();
  const workId = (await work.json()).data.id;
  try {
    await page.goto('/login');
    await page.evaluate(value => localStorage.setItem('accessToken', value), token);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/episode-upload?workId=${workId}`);
    await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
    const dialog = page.getByRole('dialog', { name: '설정은 언제 작품에 저장될까요?' });
    await expect(dialog).toBeVisible();
    expect((await (await request.get(guideUrl, { headers })).json()).data.shouldShow).toBe(false);
    expect((await (await request.post(`${guideUrl}/claim`, { headers })).json()).data.shouldShow).toBe(false);
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('heading', { name: '저장되는 시점이 달라요' })).toBeVisible();
    await page.screenshot({ path: 'docs/screens/gh194/analysis-guide-desktop.png', animations: 'disabled' });
    await page.keyboard.press('ArrowRight');
    for (const mode of ['자동 반영 예시', '직접 검토 예시']) {
      const panel = dialog.getByRole('region', { name: mode });
      await panel.getByLabel('치유 능력의 대상').selectOption('레온');
      await panel.getByRole('button', { name: /확정해 보기/ }).click();
      await expect(panel.getByRole('status')).toContainText('모두 확정');
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await dialog.getByRole('button', { name: '이전', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: '저장되는 시점이 달라요' })).toBeVisible();
    await page.screenshot({ path: 'docs/screens/gh194/analysis-guide-mobile.png', animations: 'disabled' });
    expect(await dialog.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await expect(dialog.getByRole('button', { name: '다음', exact: true })).toBeInViewport();
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
    await expect(page.getByRole('button', { name: '두 방식의 차이 체험하기' })).toBeVisible();
    await expect(dialog).toHaveCount(0);
    const world = await request.get(`${api}/api/v1/works/${workId}/world-settings`, { headers });
    const characters = await request.get(`${api}/api/v1/works/${workId}/characters`, { headers });
    expect(world.ok()).toBeTruthy();
    expect(characters.ok()).toBeTruthy();
    expect((await world.json()).data.worldSettings.totalElements).toBe(0);
    expect((await characters.json()).data.totalElements).toBe(0);
    expect((await (await request.get(`${api}/api/v1/works/${workId}/analysis-jobs`, { headers })).json()).data).toHaveLength(0);
  } finally {
    await purgeWorkAndWait(request, api!, headers.Authorization, workId);
  }
});
