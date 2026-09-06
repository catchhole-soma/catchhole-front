import { expect, test } from '@playwright/test';

type MetaPixelCall = {
  args: unknown[];
  pathname: string;
  search: string;
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const calls: MetaPixelCall[] = [];
    const browserWindow = window as Window & {
      __metaPixelCalls?: MetaPixelCall[];
      __startMetaPixel?: () => void;
      fbq?: (...args: unknown[]) => void;
    };
    browserWindow.__metaPixelCalls = calls;
    const fbq = (...args: unknown[]) => {
      fbq.callMethod?.(...args);
    };
    const recordCall = (...args: unknown[]) => {
      calls.push({ args, pathname: window.location.pathname, search: window.location.search });
    };
    if (!new URLSearchParams(window.location.search).has('deferMetaPixel')) {
      fbq.callMethod = recordCall;
    }
    browserWindow.fbq = fbq;
    browserWindow.__startMetaPixel = () => {
      fbq.callMethod = recordCall;
      window.dispatchEvent(new Event('meta-pixel-ready'));
    };
  });
});

test('초기 진입과 SPA 경로 변경에서 PageView를 한 번씩 전송한다', async ({ page }) => {
  await page.route('**/api/v1/legal-documents/current*', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, data: null, error: null }),
  }));

  await page.goto('/landing?q=%EC%9B%90%EA%B3%A0%EB%82%B4%EC%9A%A9&utm_source=instagram');
  await expect.poll(() => page.evaluate(() => (
    (window as Window & { __metaPixelCalls?: MetaPixelCall[] }).__metaPixelCalls ?? []
  ))).toEqual([
    { args: ['track', 'PageView'], pathname: '/landing', search: '?utm_source=instagram' },
  ]);
  await expect(page).toHaveURL(/q=%EC%9B%90%EA%B3%A0%EB%82%B4%EC%9A%A9&utm_source=instagram$/);

  await page.getByRole('banner').getByRole('button', { name: '무료로 시작하기', exact: true }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect.poll(() => page.evaluate(() => (
    (window as Window & { __metaPixelCalls?: MetaPixelCall[] }).__metaPixelCalls ?? []
  ))).toEqual([
    { args: ['track', 'PageView'], pathname: '/landing', search: '?utm_source=instagram' },
    { args: ['track', 'PageView'], pathname: '/signup', search: '' },
  ]);
});

test('리다이렉트 전용 경로는 목적지 PageView만 전송한다', async ({ page }) => {
  await page.goto('/works');
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => page.evaluate(() => (
    (window as Window & { __metaPixelCalls?: MetaPixelCall[] }).__metaPixelCalls ?? []
  ))).toEqual([
    { args: ['track', 'PageView'], pathname: '/login', search: '' },
  ]);
});

test('SDK 로딩 전에 이동해도 각 PageView의 원래 경로를 보존한다', async ({ page }) => {
  await page.goto('/landing?deferMetaPixel=1');
  await page.getByRole('banner').getByRole('button', { name: '무료로 시작하기', exact: true }).click();
  await expect(page).toHaveURL(/\/signup$/);

  await page.evaluate(() => {
    (window as Window & { __startMetaPixel?: () => void }).__startMetaPixel?.();
  });
  await expect.poll(() => page.evaluate(() => (
    (window as Window & { __metaPixelCalls?: MetaPixelCall[] }).__metaPixelCalls ?? []
  ))).toEqual([
    { args: ['track', 'PageView'], pathname: '/landing', search: '' },
    { args: ['track', 'PageView'], pathname: '/signup', search: '' },
  ]);
});
