import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const pageData = {
  storeId: 'store-authorized', channelKey: 'channel-key-authorized', ready: true,
  purchaseConditions: readFileSync('docs/legal/paid-usage-conditions.draft.ko.md', 'utf8'),
  terms: readFileSync('docs/legal/terms-of-service.paid.draft.ko.md', 'utf8'),
  privacy: readFileSync('docs/legal/privacy-policy.paid.draft.ko.md', 'utf8'),
};
const member = { id: 441, email: 'review@example.com', displayName: '심사 회원', role: 'AUTHOR', status: 'ACTIVE' };
const success = (data: unknown) => ({ success: true, data, error: null });
const forbidden = { success: false, data: null, error: { code: 'AUTH_FORBIDDEN', status: 403 } };

async function setup(page: Page, mode: 'allowed' | 'denied' | 'failure' | 'missing' | 'conflicting' = 'allowed') {
  await page.addInitScript(() => localStorage.setItem('accessToken', 'review-token'));
  await page.route('https://cdn.portone.io/**', route => route.abort());
  await page.route('https://*.portone.io/**', route => route.abort());
  await page.route('https://*.inicis.com/**', route => route.abort());
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ json: success(member) });
    if (path.endsWith('/payment-reviews/access')) {
      if (mode === 'failure') return route.abort();
      if (mode === 'conflicting') return route.fulfill({ json: { success: false, data: { allowed: true } } });
      return route.fulfill({ json: success(mode === 'missing' ? {} : { allowed: mode === 'allowed' }) });
    }
    if (path.endsWith('/payment-reviews/page')) return route.fulfill({ json: success(pageData) });
    return route.fulfill({ json: success([]) });
  });
}

async function fillBuyer(page: Page) {
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('심사 회원');
  await page.getByRole('textbox', { name: '이메일', exact: true }).fill('review@example.com');
  await page.getByRole('textbox', { name: '연락처', exact: true }).fill('010-0000-1234');
  await page.getByRole('checkbox').check();
}

async function switchAccount(page: Page) {
  await page.evaluate(() => {
    const oldValue = localStorage.getItem('accessToken');
    localStorage.setItem('accessToken', 'regular-token');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', oldValue, newValue: 'regular-token' }));
  });
}

for (const mode of ['denied', 'failure', 'missing', 'conflicting'] as const) {
  test(`${mode}: 일반 회원·조회 실패·불완전 응답은 메뉴와 직접 주소 모두 닫는다`, async ({ page }) => {
    await setup(page, mode);
    let pageRequests = 0;
    page.on('request', request => { if (request.url().endsWith('/payment-reviews/page')) pageRequests++; });
    await page.goto('/works');
    await page.getByRole('button', { name: '사용자 메뉴 열기' }).click();
    await expect(page.getByRole('menuitem', { name: '로그아웃' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: '사용량 충전' })).toHaveCount(0);
    for (const path of ['/billing', '/billing/terms', '/billing/privacy']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/works$/);
      await expect(page.getByRole('heading', { name: '충전권 선택' })).toHaveCount(0);
    }
    expect(pageRequests).toBe(0);
  });
}

test('허용 회원은 메뉴로 진입해 서버의 구매조건과 두 약관을 확인한다', async ({ page }) => {
  await setup(page);
  await page.goto('/works');
  await page.getByRole('button', { name: '사용자 메뉴 열기' }).click();
  await page.getByRole('menuitem', { name: '사용량 충전' }).click();
  await expect(page).toHaveURL(/\/billing$/);
  await expect(page.getByRole('heading', { name: '충전권 선택' })).toBeVisible();
  await expect(page.getByRole('link', { name: '이용약관 ↗' })).toHaveAttribute('href', '/billing/terms');
  await expect(page.getByRole('link', { name: '개인정보처리방침 ↗' })).toHaveAttribute('href', '/billing/privacy');
  await page.goto('/billing/terms');
  await expect(page.getByRole('heading', { name: '제7조의2(청약철회와 환불)' })).toBeAttached();
  await page.goto('/billing/privacy');
  await expect(page.getByRole('row', { name: /^유료 구매·결제·사용량·환불/ })).toBeAttached();
  await expect(page.locator('[aria-label="법률 문서 게시 정보"]')).toHaveCount(0);
});

test('메뉴 권한이 있어도 보호된 자료 API가 403이면 화면을 노출하지 않는다', async ({ page }) => {
  await setup(page);
  await page.route('**/payment-reviews/page', route => route.fulfill({ status: 403, json: forbidden }));
  await page.goto('/billing');
  await expect(page).toHaveURL(/\/works$/);
  await expect(page.getByRole('heading', { name: '충전권 선택' })).toHaveCount(0);
});

test('결제창 직전 권한이 취소되면 SDK를 호출하지 않는다', async ({ page }) => {
  await setup(page);
  let sdkCalls = 0;
  await page.exposeFunction('recordCheckout', () => sdkCalls++);
  await page.addInitScript(() => {
    Object.assign(window, { PortOne: { requestPayment: () => (window as unknown as { recordCheckout: () => void }).recordCheckout() } });
  });
  await page.goto('/billing');
  await fillBuyer(page);
  await page.route('**/payment-reviews/page', route => route.fulfill({ status: 403, json: forbidden }));
  await page.getByRole('button', { name: '결제창 열기' }).click();
  await expect(page.getByRole('status')).toContainText('결제창을 열지 못했어요');
  expect(sdkCalls).toBe(0);
});

test('계정을 바꾸면 기존 허용 상태·약관 캐시를 다른 회원에게 재사용하지 않는다', async ({ page }) => {
  await setup(page);
  await page.goto('/billing/terms');
  await expect(page.getByRole('heading', { name: '제7조의2(청약철회와 환불)' })).toBeAttached();
  await page.route('**/payment-reviews/access', route => route.fulfill({ json: success({ allowed: false }) }));
  await switchAccount(page);
  await expect(page).toHaveURL(/\/works$/);
  await expect(page.getByRole('heading', { name: '제7조의2(청약철회와 환불)' })).toHaveCount(0);
  await page.getByRole('button', { name: '사용자 메뉴 열기' }).click();
  await expect(page.getByRole('menuitem', { name: '사용량 충전' })).toHaveCount(0);
});

test('이전 계정의 늦은 허용 응답이 와도 새 계정의 접근을 열지 않는다', async ({ page }) => {
  await setup(page);
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/payment-reviews/access', async route => {
    if (route.request().headers().authorization === 'Bearer review-token') {
      await pending;
      await route.fulfill({ json: success({ allowed: true }) }).catch(() => {});
    } else await route.fulfill({ json: success({ allowed: false }) });
  });
  await page.goto('/billing');
  await expect(page.getByRole('status')).toContainText('페이지를 확인하고 있어요');
  await switchAccount(page);
  release();
  await expect(page).toHaveURL(/\/works$/);
  await expect(page.getByRole('heading', { name: '충전권 선택' })).toHaveCount(0);
});

test('회원 결제창은 새로 조회한 서버 채널과 상품 금액만 사용한다', async ({ page }) => {
  await setup(page);
  const requests: Record<string, unknown>[] = [];
  await page.exposeFunction('recordCheckout', (request: Record<string, unknown>) => requests.push(request));
  await page.addInitScript(() => {
    Object.assign(window, { PortOne: { requestPayment: (request: unknown) => {
      (window as unknown as { recordCheckout: (value: unknown) => void }).recordCheckout(request);
      return Promise.resolve({ code: 'FAILURE_TYPE_CANCEL' });
    } } });
  });
  await page.goto('/billing?product=double');
  await fillBuyer(page);
  await page.getByRole('button', { name: '결제창 열기' }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({ storeId: 'store-authorized', channelKey: 'channel-key-authorized', totalAmount: 4900 });
  await expect(page.getByRole('status')).toContainText('결제창을 닫았어요');
});


test('결제창 재조회가 실패 envelope면 남은 data가 있어도 SDK를 호출하지 않는다', async ({ page }) => {
  await setup(page);
  let sdkCalls = 0;
  await page.exposeFunction('recordCheckout', () => sdkCalls++);
  await page.addInitScript(() => {
    Object.assign(window, { PortOne: { requestPayment: () => (window as unknown as { recordCheckout: () => void }).recordCheckout() } });
  });
  await page.goto('/billing');
  await fillBuyer(page);
  await page.route('**/payment-reviews/page', route => route.fulfill({ json: { success: false, data: pageData } }));
  await page.getByRole('button', { name: '결제창 열기' }).click();
  await expect(page.getByRole('status')).toContainText('결제창을 열지 못했어요');
  expect(sdkCalls).toBe(0);
});

test('결제창 권한을 다시 확인하는 동안 화면을 떠나면 요청을 취소한다', async ({ page }) => {
  await setup(page);
  await page.goto('/billing');
  await fillBuyer(page);
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/payment-reviews/page', async route => {
    await pending;
    await route.fulfill({ json: success(pageData) }).catch(() => {});
  });
  const requestStarted = page.waitForRequest('**/payment-reviews/page');
  await page.getByRole('button', { name: '결제창 열기' }).click();
  await requestStarted;
  const cancelled = page.waitForEvent('requestfailed', request => request.url().endsWith('/payment-reviews/page'));
  await page.getByRole('link', { name: '내 작품으로' }).click();
  await cancelled;
  release();
  await expect(page).toHaveURL(/\/works$/);
});
