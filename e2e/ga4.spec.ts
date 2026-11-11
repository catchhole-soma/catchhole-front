import { expect, test } from '@playwright/test';

type GtagCall = unknown[];

const readGtagCalls = (page: import('@playwright/test').Page) => page.evaluate(() => (
  (window as Window & { __gtagCalls?: GtagCall[] }).__gtagCalls ?? []
));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const calls: GtagCall[] = [];
    const browserWindow = window as Window & {
      __gtagCalls?: GtagCall[];
      gtag?: (...args: unknown[]) => void;
    };
    browserWindow.__gtagCalls = calls;
    browserWindow.gtag = (...args: unknown[]) => {
      calls.push(args);
    };
  });
});

test('초기 진입과 SPA 경로 변경에서 page_view를 한 번씩 전송하고 UTM 외 query는 보내지 않는다', async ({ page }) => {
  await page.route('**/api/v1/legal-documents/current*', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, data: null, error: null }),
  }));

  await page.goto('/landing?q=%EC%9B%90%EA%B3%A0%EB%82%B4%EC%9A%A9&utm_source=instagram');
  const origin = new URL(page.url()).origin;
  await expect.poll(() => readGtagCalls(page)).toEqual([
    ['event', 'page_view', { page_location: `${origin}/landing?utm_source=instagram` }],
  ]);
  // 전송용 정제가 실제 주소창을 바꾸면 안 된다.
  await expect(page).toHaveURL(/q=%EC%9B%90%EA%B3%A0%EB%82%B4%EC%9A%A9&utm_source=instagram$/);

  await page.getByRole('banner').getByRole('button', { name: '무료로 시작하기', exact: true }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect.poll(() => readGtagCalls(page)).toEqual([
    ['event', 'page_view', { page_location: `${origin}/landing?utm_source=instagram` }],
    ['event', 'page_view', { page_location: `${origin}/signup` }],
  ]);
});

test('리다이렉트 전용 경로는 목적지 page_view만 전송한다', async ({ page }) => {
  await page.goto('/works');
  await expect(page).toHaveURL(/\/login$/);
  const origin = new URL(page.url()).origin;
  await expect.poll(() => readGtagCalls(page)).toEqual([
    ['event', 'page_view', { page_location: `${origin}/login` }],
  ]);
});
