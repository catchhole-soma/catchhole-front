import { expect, test, type Page } from '@playwright/test';
import { computedContrastRatio } from './contrast';

const preview = '/dev/payment-review';
const consentName = '상품 내용과 사용기간·환불 조건을 확인했어요.';

async function fillBuyer(page: Page) {
  await page.getByRole('textbox', { name: '이름', exact: true }).fill('결제창 테스트');
  await page.getByRole('textbox', { name: '이메일', exact: true }).fill('review@example.com');
  await page.getByRole('textbox', { name: '연락처', exact: true }).fill('010-0000-1234');
  await page.getByRole('checkbox', { name: consentName }).check();
}

test.beforeEach(async ({ page }) => {
  // No automated test may contact a payment provider or submit a real payment.
  await page.route('https://cdn.portone.io/**', route => route.abort());
  await page.route('https://*.portone.io/**', route => route.abort());
  await page.route('https://*.inicis.com/**', route => route.abort());
});

test('상품 변경은 구매 확인을 해제하고 금액과 정책을 일치시킨다', async ({ page }) => {
  await page.goto(preview);
  const open = page.getByRole('button', { name: '결제창 열기' });
  await expect(open).toBeDisabled();
  await expect(page.getByRole('radio', { name: /기본 충전권.*400만 캐치홀 토큰/ })).toBeChecked();
  await fillBuyer(page);
  await page.getByRole('radio', { name: /더블 충전권/ }).click();
  await expect(page.getByRole('radio', { name: /더블 충전권/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: consentName })).not.toBeChecked();
  await expect(open).toBeDisabled();
  await expect(page.getByRole('region', { name: '선택한 충전권' })).toContainText('4,900원');
  await expect(page.getByRole('region', { name: '선택한 충전권' })).toContainText('800만 캐치홀 토큰');
  await expect(page.getByRole('region', { name: '선택한 충전권' })).toContainText('예상 30~60회차');
  await expect(page.getByText('예상 15~30회차 분석', { exact: true })).toBeVisible();
  await expect(page.getByText('회차당 5,000자(공백 포함) 기본 분석 기준의 예상 분량이에요. 원고 길이·쌓인 설정·이용 기능에 따라 실제 분량은 표시 범위보다 적거나 많을 수 있어요.', { exact: true })).toBeVisible();
  await page.getByText('구매조건 전체 보기', { exact: true }).click();
  await expect(page.getByRole('heading', { name: '사용량 충전권 구매조건' })).toBeVisible();
  await expect(page.getByRole('row', { name: '기본 충전권 2,900원 400만 캐치홀 토큰' })).toBeVisible();
  await expect(page.getByRole('row', { name: '더블 충전권 4,900원 800만 캐치홀 토큰' })).toBeVisible();
  await expect(page.getByText(/2,175원/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('radio', { name: /더블 충전권/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: consentName })).not.toBeChecked();
});

test('요청 금액·통화·카드·12개월·동일 출처 복귀와 연속 클릭 방지를 검증한다', async ({ page }) => {
  const requests: Record<string, unknown>[] = [];
  await page.exposeFunction('recordPaymentRequest', (request: Record<string, unknown>) => requests.push(request));
  await page.addInitScript(() => {
    const mockWindow = window as unknown as {
      PortOne: unknown; recordPaymentRequest: (request: unknown) => void;
    };
    mockWindow.PortOne = { requestPayment: (request: unknown) => {
      mockWindow.recordPaymentRequest(request);
      return new Promise(() => {});
    } };
  });
  const backendWrites: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/') && request.method() !== 'GET') backendWrites.push(request.url());
  });
  await page.goto(`${preview}?product=double`);
  await fillBuyer(page);
  await page.getByRole('button', { name: '결제창 열기' }).click();
  await expect(page.getByRole('button', { name: '결제창 여는 중…' })).toBeDisabled();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({
    totalAmount: 4900, currency: 'KRW', payMethod: 'CARD', productType: 'DIGITAL',
    orderName: '캐치홀 더블 충전권 (800만 캐치홀 토큰)', offerPeriod: { interval: '12m' }, forceRedirect: true,
    customer: { fullName: '결제창 테스트', email: 'review@example.com', phoneNumber: '01000001234' },
  });
  expect(requests[0].paymentId).toMatch(/^review-[0-9a-f]{32}$/);
  expect(String(requests[0].paymentId).length).toBeLessThanOrEqual(40);
  expect(requests[0].redirectUrl).toBe(new URL(`${preview}?product=double`, page.url()).href);
  expect(backendWrites).toEqual([]);
});

test('SDK 로드 실패 후 새로고침을 안내하고 구매자 입력을 유지한다', async ({ page }) => {
  await page.goto(preview);
  await fillBuyer(page);
  await page.getByRole('button', { name: '결제창 열기' }).click();
  await expect(page.getByRole('status')).toContainText('결제창을 열지 못했어요');
  await expect(page.getByRole('button', { name: '결제창 열기' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '화면 새로고침' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '이름', exact: true })).toHaveValue('결제창 테스트');
});

test('취소·오류·위조 성공 복귀 모두 사용량 지급이나 성공 처리를 하지 않는다', async ({ page }) => {
  await page.goto(`${preview}?paymentId=forged&code=FAILURE_TYPE_CANCEL`);
  await expect(page.getByRole('status')).toContainText('결제창을 닫았어요');
  await page.goto(`${preview}?paymentId=test&code=FAILURE_TYPE_PG&message=${encodeURIComponent('사용자가 결제를 취소하였습니다')}`);
  await expect(page.getByRole('status')).toContainText('결제창을 닫았어요');
  await page.goto(`${preview}?paymentId=forged&code=UNKNOWN&message=secret-internal-message`);
  await expect(page.getByRole('status')).toContainText('진행하지 못했어요');
  await expect(page.getByText('secret-internal-message')).toHaveCount(0);
  await page.goto(`${preview}?paymentId=forged`);
  await expect(page.getByRole('status')).toContainText('결제 결과를 확인할 수 없어요');
  await expect(page.getByRole('checkbox', { name: consentName })).not.toBeChecked();
});

test('회원용 충전 페이지는 기존 로그인 검증을 유지한다', async ({ page }) => {
  await page.goto('/billing');
  await expect(page).toHaveURL(/\/login$/);
  await page.addInitScript(() => localStorage.setItem('accessToken', 'invalid-local-test-token'));
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 401, json: { success: false, error: { status: 401 } } }));
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({ status: 401, json: { success: false, error: { status: 401 } } }));
  await page.goto('/billing');
  await expect(page).toHaveURL(/\/login$/);
});

test('로컬 구매 화면은 개정 문서를 열고 게시 버전이나 가입 동의를 만들지 않는다', async ({ page }) => {
  const legalRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/legal-documents/')) legalRequests.push(request.url());
  });
  await page.goto(preview);
  await expect(page.getByRole('link', { name: '이용약관 ↗' })).toHaveAttribute('href', `${preview}/terms`);
  await expect(page.getByRole('link', { name: '개인정보처리방침 ↗' })).toHaveAttribute('href', `${preview}/privacy`);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${preview}/terms`);
  await expect(page.getByRole('heading', { name: 'CatchHole 이용약관', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '제7조의2(청약철회와 환불)' })).toBeAttached();
  await expect(page.locator('.legal-document del')).toHaveCount(0);
  await expect(page.getByText(/기본 충전권은 예상 15~30회차, 더블 충전권은 예상 30~60회차/)).toBeVisible();
  await expect(page.locator('[aria-label="법률 문서 게시 정보"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.goto(`${preview}/privacy`);
  await expect(page.getByRole('heading', { name: 'CatchHole 개인정보처리방침', exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: /^유료 구매·결제·사용량·환불/ })).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('link', { name: '사용량 충전으로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`${preview}$`));
  expect(legalRequests).toEqual([]);
});

test('320px에서 정책·입력·구매 버튼이 넘치지 않고 읽을 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(preview);
  await page.getByText('구매조건 전체 보기', { exact: true }).click();
  await expect(page.getByRole('heading', { name: '사용량 충전권 구매조건' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const button = page.getByRole('button', { name: '결제창 열기' });
  await fillBuyer(page);
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  await expect(button).toHaveCSS('background-color', 'rgb(0, 90, 175)');
  await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
  expect(await computedContrastRatio(button)).toBeGreaterThanOrEqual(4.5);
  expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('address').getByRole('link', { name: 'aicatchhole@gmail.com' })).toHaveCSS('color', 'rgb(0, 90, 175)');
  expect(await computedContrastRatio(page.locator('address').getByRole('link', { name: 'aicatchhole@gmail.com' }), page.locator('.payment-review'))).toBeGreaterThanOrEqual(4.5);
});
