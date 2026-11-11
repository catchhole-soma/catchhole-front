import { expect, test } from '@playwright/test';
import { getGtagCalls, installGtagMock, type GtagCall } from './gtag';

// 자동 이벤트도 정제한 주소를 쓰도록 page_view 직전에 전역 page_location을 지정한다.
const pageView = (pageLocation: string): GtagCall[] => [
  ['set', { page_location: pageLocation }],
  ['event', 'page_view', { page_location: pageLocation }],
];

test.beforeEach(async ({ page }) => {
  await installGtagMock(page);
});

test('초기 진입과 SPA 경로 변경에서 page_view를 한 번씩 전송하고 UTM 외 query는 보내지 않는다', async ({ page }) => {
  await page.route('**/api/v1/legal-documents/current*', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, data: null, error: null }),
  }));

  await page.goto('/landing?q=%EC%9B%90%EA%B3%A0%EB%82%B4%EC%9A%A9&utm_source=instagram');
  const origin = new URL(page.url()).origin;
  await expect.poll(() => getGtagCalls(page)).toEqual([
    ...pageView(`${origin}/landing?utm_source=instagram`),
  ]);
  // 전송용 정제가 실제 주소창을 바꾸면 안 된다.
  await expect(page).toHaveURL(/q=%EC%9B%90%EA%B3%A0%EB%82%B4%EC%9A%A9&utm_source=instagram$/);

  await page.getByRole('banner').getByRole('button', { name: '무료로 시작하기', exact: true }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect.poll(() => getGtagCalls(page)).toEqual([
    ...pageView(`${origin}/landing?utm_source=instagram`),
    ...pageView(`${origin}/signup`),
  ]);
});

test('리다이렉트 전용 경로는 목적지 page_view만 전송한다', async ({ page }) => {
  await page.goto('/works');
  await expect(page).toHaveURL(/\/login$/);
  const origin = new URL(page.url()).origin;
  await expect.poll(() => getGtagCalls(page)).toEqual([
    ...pageView(`${origin}/login`),
  ]);
});
