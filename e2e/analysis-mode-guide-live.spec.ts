import { expect } from '@playwright/test';
import { test } from './local-live-fixture';
import { purgeWorkAndWait } from './live-work-purge';


test('첫 분석 안내는 실제 계정에 한 번 기록하고 예시 화면 탐색은 실제 작품에 저장하지 않는다', async ({ page, request, liveAccount }) => {
  const { api, email, password } = liveAccount;
  const login = await request.post(`${api}/api/v1/auth/login`, { data: { email, password } });
  expect(login.ok()).toBeTruthy();
  const token = (await login.json()).data.accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const guideUrl = `${api}/api/v1/analysis-mode-guide`;
  expect((await (await request.get(guideUrl, { headers })).json()).data.shouldShow).toBe(true);
  const work = await request.post(`${api}/api/v1/works`, { headers, data: { title: '안내 화면 검증', genre: '판타지' } });
  expect(work.ok()).toBeTruthy();
  const workId = (await work.json()).data.id;
  try {
    await page.goto('/login');
    await page.evaluate(value => localStorage.setItem('accessToken', value), token);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/episode-upload?workId=${workId}`);
    await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
    const dialog = page.getByRole('dialog', { name: '설정이 반영되는 과정을 살펴보세요' });
    await expect(dialog).toBeVisible();
    expect((await (await request.get(guideUrl, { headers })).json()).data.shouldShow).toBe(false);
    expect((await (await request.post(`${guideUrl}/claim`, { headers })).json()).data.shouldShow).toBe(false);
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('heading', { name: '모든 설정을 직접 보고 확정해요' })).toBeVisible();
    await expect(dialog.locator('.setting-candidate-detail')).toHaveCount(3);
    await expect(dialog.locator('[inert]')).toHaveCount(1);
    await expect(dialog.locator('img, picture')).toHaveCount(0);
    await page.screenshot({ path: 'docs/screens/gh194/analysis-guide-manual-desktop.png', animations: 'disabled' });
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('.character-simple-settings')).toContainText('엘프');
    await page.screenshot({ path: 'docs/screens/gh194/analysis-guide-desktop.png', animations: 'disabled' });
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('.setting-candidate-detail')).toHaveCount(1);
    await page.screenshot({ path: 'docs/screens/gh194/analysis-guide-exception-desktop.png', animations: 'disabled' });
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('.setting-review-page')).toContainText('모든 설정 후보 검토를 완료했습니다.');
    await expect(dialog.locator('.setting-review-summary__item.is-direct strong')).toHaveText('0개');
    await page.setViewportSize({ width: 320, height: 568 });
    await dialog.getByRole('button', { name: '이전', exact: true }).click();
    await dialog.getByRole('button', { name: '이전', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: '명확한 설정은 AI가 바로 반영해요' })).toBeVisible();
    await page.screenshot({ path: 'docs/screens/gh194/analysis-guide-mobile.png', animations: 'disabled' });
    expect(await dialog.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await expect(dialog.getByRole('button', { name: '다음', exact: true })).toBeInViewport();
    await page.keyboard.press('Escape');
    await page.reload();
    await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
    await expect(page.getByRole('button', { name: '두 방식의 차이 보기' })).toBeVisible();
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
