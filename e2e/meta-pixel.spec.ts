import { expect, test } from '@playwright/test';

type MetaPixelCall = {
  args: unknown[];
  pathname: string;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const calls: MetaPixelCall[] = [];
    const browserWindow = window as Window & {
      __metaPixelCalls?: MetaPixelCall[];
      fbq?: (...args: unknown[]) => void;
    };
    browserWindow.__metaPixelCalls = calls;
    browserWindow.fbq = (...args: unknown[]) => {
      calls.push({ args, pathname: window.location.pathname });
    };
  });
});

test('초기 진입과 SPA 경로 변경에서 PageView를 한 번씩 전송한다', async ({ page }) => {
  await page.route('**/api/v1/legal-documents/current*', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, data: null, error: null }),
  }));

  await page.goto('/landing');
  await expect.poll(() => page.evaluate(() => (
    (window as Window & { __metaPixelCalls?: MetaPixelCall[] }).__metaPixelCalls ?? []
  ))).toEqual([
    { args: ['track', 'PageView'], pathname: '/landing' },
  ]);

  await page.getByRole('banner').getByRole('button', { name: '무료로 시작하기', exact: true }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect.poll(() => page.evaluate(() => (
    (window as Window & { __metaPixelCalls?: MetaPixelCall[] }).__metaPixelCalls ?? []
  ))).toEqual([
    { args: ['track', 'PageView'], pathname: '/landing' },
    { args: ['track', 'PageView'], pathname: '/signup' },
  ]);
});
