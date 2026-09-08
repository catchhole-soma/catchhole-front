import { expect, test, type Page, type Route } from '@playwright/test';

const success = (data: unknown) => ({ success: true, data, error: null });
const respond = (route: Route, data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
const reject = (route: Route, code: string, status = 400) => respond(route, { success: false, data: null, error: { code, status, details: [] } }, status);
const issued = (verificationId = 'email-flow', expiresInSeconds = 300, resendAfterSeconds = 60) => success({ verificationId, expiresInSeconds, resendAfterSeconds });
const confirmed = (expiresInSeconds = 600) => success({ emailVerificationToken: 'email-memory-only-token', expiresInSeconds });

async function setup(page: Page) {
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/signup-policy') return respond(route, success({ verificationMethod: 'EMAIL' }));
    if (path === '/api/v1/legal-documents/current') return respond(route, success({
      termsOfService: { id: 31, documentVersion: '2026-08-24' },
      privacyPolicy: { id: 32, documentVersion: '2026-08-24' },
    }));
    if (path === '/api/v1/auth/email-verifications') return respond(route, issued());
    if (path.endsWith('/email-flow/confirm')) return respond(route, confirmed());
    if (path === '/api/v1/auth/me') return respond(route, success({ id: 1, email: 'Verified@example.com', displayName: '작가', phoneNumber: null, phoneVerified: false, emailVerified: true, role: 'AUTHOR', status: 'ACTIVE' }));
    return respond(route, success([]));
  });
}

async function open(page: Page) {
  await page.goto('/signup');
  await expect(page.getByRole('button', { name: '인증번호 받기', exact: true })).toBeVisible();
  return page.getByRole('dialog', { name: '회원가입' });
}

async function send(page: Page, email = 'Verified@example.com') {
  await page.getByPlaceholder('이메일', { exact: true }).fill(email);
  await page.getByRole('button', { name: '인증번호 받기', exact: true }).click();
  await expect(page.getByPlaceholder('인증번호 6자리')).toBeVisible();
}

async function verify(page: Page) {
  await page.getByPlaceholder('인증번호 6자리').fill('123456');
  await page.getByRole('button', { name: '인증', exact: true }).click();
  await expect(page.getByText('이메일 인증이 완료되었습니다.', { exact: true })).toBeVisible();
}

async function completeForm(page: Page) {
  await page.getByPlaceholder('이름 (필명)').fill('작가');
  await page.getByPlaceholder('비밀번호', { exact: true }).fill('Password1234');
  await page.getByPlaceholder('비밀번호 확인').fill('Password1234');
  await page.getByRole('button', { name: '이용약관 동의 및 개인정보 처리방침 확인' }).click();
  await page.getByRole('button', { name: '만 14세 이상 확인' }).click();
}

test.beforeEach(async ({ page }) => { await setup(page); });

test('이메일 발송·오입력·확인·약관 확인 후 번호 없이 가입하고 자동 로그인한다', async ({ page }) => {
  let sentEmail: unknown;
  let signupBody: Record<string, unknown> | undefined;
  await page.route('**/api/v1/auth/email-verifications', route => {
    sentEmail = route.request().postDataJSON().email;
    return respond(route, issued());
  });
  await page.route('**/api/v1/auth/email-verifications/*/confirm', route => route.request().postDataJSON().code === '000000'
    ? reject(route, 'AUTH_EMAIL_VERIFICATION_CODE_INVALID') : respond(route, confirmed()));
  await page.route('**/api/v1/auth/signup', route => {
    signupBody = route.request().postDataJSON();
    return respond(route, success({ accessToken: 'email-signup-access-token' }));
  });
  const dialog = await open(page);
  await expect(page.getByPlaceholder('휴대폰 번호 (예: 01012345678)')).toHaveCount(0);
  await send(page, ' Verified@example.com ');
  expect(sentEmail).toBe('Verified@example.com');
  await expect(dialog.getByRole('button', { name: /초 후 재전송/ })).toBeDisabled();
  const persisted = await page.evaluate(() => JSON.parse(sessionStorage.getItem('catchhole_email_verification') ?? '{}'));
  expect(Object.keys(persisted).sort()).toEqual(['email', 'expiresAt', 'resendAt', 'verificationId']);
  await page.getByPlaceholder('인증번호 6자리').fill('000000');
  await page.getByRole('button', { name: '인증', exact: true }).click();
  await expect(page.getByText('인증번호가 올바르지 않습니다.', { exact: true })).toBeVisible();
  await verify(page);
  await expect(page.getByRole('button', { name: '회원가입', exact: true })).toBeDisabled();
  await completeForm(page);
  expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }))).not.toContain('email-memory-only-token');
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(page).toHaveURL(/\/works$/);
  expect(signupBody).toEqual({ email: 'Verified@example.com', password: 'Password1234', displayName: '작가', termsAccepted: true, privacyPolicyAcknowledged: true, age14OrOlderConfirmed: true, termsDocumentId: 31, privacyPolicyDocumentId: 32, emailVerificationToken: 'email-memory-only-token' });
  expect(await page.evaluate(() => localStorage.getItem('accessToken'))).toBe('email-signup-access-token');
  expect(await page.evaluate(() => sessionStorage.getItem('catchhole_email_verification'))).toBeNull();
});

test('메일 주소 변경 후 늦게 도착한 이전 발송 응답은 최신 흐름을 덮어쓰지 않는다', async ({ page }) => {
  const requests = new Map<string, Route>();
  await page.route('**/api/v1/auth/email-verifications', route => { requests.set(route.request().postDataJSON().email, route); });
  await open(page);
  await page.getByPlaceholder('이메일', { exact: true }).fill('first@example.com');
  await page.getByRole('button', { name: '인증번호 받기', exact: true }).click();
  await expect.poll(() => requests.has('first@example.com')).toBe(true);
  await page.getByPlaceholder('이메일', { exact: true }).fill('second@example.com');
  await page.getByRole('button', { name: '인증번호 받기', exact: true }).click();
  await expect.poll(() => requests.has('second@example.com')).toBe(true);
  await respond(requests.get('second@example.com')!, issued('second-flow'));
  await expect(page.getByPlaceholder('인증번호 6자리')).toBeVisible();
  await respond(requests.get('first@example.com')!, issued('stale-first-flow'));
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('catchhole_email_verification') ?? '{}').verificationId)).toBe('second-flow');
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('catchhole_email_verification') ?? '{}').email)).toBe('second@example.com');
});

test('확인 요청 중 주소를 변경하면 늦은 인증 토큰을 폐기하고 대소문자 변경도 재인증한다', async ({ page }) => {
  let confirmRoute: Route | undefined;
  await page.route('**/api/v1/auth/email-verifications/*/confirm', route => { confirmRoute = route; });
  await open(page);
  await send(page);
  await page.getByPlaceholder('인증번호 6자리').fill('123456');
  await page.getByRole('button', { name: '인증', exact: true }).click();
  await expect.poll(() => Boolean(confirmRoute)).toBe(true);
  await page.getByPlaceholder('이메일', { exact: true }).fill('verified@example.com');
  await respond(confirmRoute!, confirmed());
  await expect(page.getByText('가입 전 이메일 인증이 필요합니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '이메일 인증 후 회원가입' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '인증번호 받기', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => sessionStorage.getItem('catchhole_email_verification'))).toBeNull();
});

test('서버가 제공한 유효시간과 재전송 간격을 사용하고 가입 토큰 만료 후 재인증한다', async ({ page }) => {
  await page.clock.install();
  let sends = 0;
  await page.route('**/api/v1/auth/email-verifications', route => { sends += 1; return respond(route, issued('email-flow', 2, 1)); });
  await page.route('**/api/v1/auth/email-verifications/*/confirm', route => respond(route, confirmed(2)));
  await open(page);
  await send(page);
  await page.clock.fastForward(3_000);
  await expect(page.getByText('인증번호가 만료되었습니다. 새 인증번호를 받아주세요.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '인증번호 재전송' }).click();
  await expect.poll(() => sends).toBe(2);
  await verify(page);
  await page.clock.fastForward(3_000);
  await expect(page.getByText('이메일 인증이 만료되었습니다. 다시 인증해주세요.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '이메일 인증 후 회원가입' })).toBeDisabled();
});

test('오입력 한도 이후 새로고침해도 재전송 대기는 유지하고 가입 토큰은 복원하지 않는다', async ({ page }) => {
  await page.route('**/api/v1/auth/email-verifications/*/confirm', route => reject(route, 'AUTH_EMAIL_VERIFICATION_ATTEMPTS_EXCEEDED', 429));
  await open(page);
  await send(page);
  await page.getByPlaceholder('인증번호 6자리').fill('000000');
  await page.getByRole('button', { name: '인증', exact: true }).click();
  await expect(page.getByText('인증번호 입력 횟수를 초과했습니다. 새 인증번호를 받아주세요.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByPlaceholder('이메일', { exact: true })).toHaveValue('Verified@example.com');
  await expect(page.getByPlaceholder('인증번호 6자리')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /초 후 재전송/ })).toBeDisabled();
});

test('정책 로드 오류는 가입을 막고 재시도 후 서버가 지정한 이메일 인증을 표시한다', async ({ page }) => {
  let fail = true;
  await page.route('**/api/v1/auth/signup-policy', route => fail ? reject(route, 'SERVICE_UNAVAILABLE', 503) : respond(route, success({ verificationMethod: 'EMAIL' })));
  await page.goto('/signup');
  await expect(page.getByText('가입 인증 방식을 불러오지 못했습니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '인증 방식 확인 후 회원가입' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '인증번호 받기', exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: '인증 방식 다시 불러오기' }).click();
  await expect(page.getByText('가입 전 이메일 인증이 필요합니다.', { exact: true })).toBeVisible();
});

test('같은 정책을 다시 조회하는 동안 가입을 막고 완료 토큰은 응답 뒤 유지한다', async ({ page }) => {
  await open(page);
  await send(page);
  await verify(page);
  await completeForm(page);
  let policyRoute: Route | undefined;
  await page.route('**/api/v1/auth/signup-policy', route => { policyRoute = route; });
  await page.evaluate(async () => {
    const { queryClient } = await import('/src/app/lib/query-client.ts');
    void queryClient.invalidateQueries({ predicate: query => JSON.stringify(query.queryKey).includes('getSignupPolicy') });
  });
  await expect.poll(() => Boolean(policyRoute)).toBe(true);
  await expect(page.getByRole('button', { name: '인증 방식 확인 후 회원가입' })).toBeDisabled();
  await respond(policyRoute!, success({ verificationMethod: 'EMAIL' }));
  await expect(page.getByText('이메일 인증이 완료되었습니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '회원가입', exact: true })).toBeEnabled();
});

test('최초 정책 로딩 중에는 주소 편집을 막아 저장된 주소가 새 입력을 덮어쓰지 않는다', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('catchhole_email_verification', JSON.stringify({
    verificationId: 'restored-flow', email: 'restored@example.com',
    expiresAt: Date.now() + 300_000, resendAt: Date.now() + 60_000,
  })));
  let policyRoute: Route | undefined;
  await page.route('**/api/v1/auth/signup-policy', route => { policyRoute = route; });
  await page.goto('/signup');
  await expect.poll(() => Boolean(policyRoute)).toBe(true);
  await expect(page.getByPlaceholder('이메일', { exact: true })).toBeDisabled();
  await respond(policyRoute!, success({ verificationMethod: 'EMAIL' }));
  await expect(page.getByPlaceholder('이메일', { exact: true })).toHaveValue('restored@example.com');
  await page.getByPlaceholder('이메일', { exact: true }).fill('new@example.com');
  await expect(page.getByPlaceholder('인증번호 6자리')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('catchhole_email_verification'))).toBeNull();
});

test('이메일 중복·발송 한도·서비스 장애를 구분하여 표시한다', async ({ page }) => {
  const cases = [
    ['AUTH_EMAIL_DUPLICATED', 409, '이미 가입된 이메일입니다.'],
    ['AUTH_EMAIL_VERIFICATION_RATE_LIMITED', 429, '인증번호 발송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'],
    ['AUTH_EMAIL_VERIFICATION_UNAVAILABLE', 503, '현재 이메일 인증을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.'],
  ] as const;
  let index = 0;
  await page.route('**/api/v1/auth/email-verifications', route => reject(route, cases[index][0], cases[index][1]));
  await open(page);
  await page.getByPlaceholder('이메일', { exact: true }).fill('error@example.com');
  for (index = 0; index < cases.length; index += 1) {
    await page.getByRole('button', { name: '인증번호 받기', exact: true }).click();
    await expect(page.getByText(cases[index][2], { exact: true })).toBeVisible();
  }
});

test('서버 정책이 전화번호로 변경되면 이전 이메일 인증을 폐기하고 새 정책을 표시한다', async ({ page }) => {
  let method = 'EMAIL';
  await page.route('**/api/v1/auth/signup-policy', route => respond(route, success({ verificationMethod: method })));
  await page.route('**/api/v1/auth/signup', route => { method = 'PHONE'; return reject(route, 'AUTH_PHONE_VERIFICATION_TOKEN_REQUIRED'); });
  await open(page);
  await send(page);
  await verify(page);
  await completeForm(page);
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(page.getByPlaceholder('휴대폰 번호 (예: 01012345678)')).toBeVisible();
  await expect(page.getByRole('button', { name: '휴대폰 인증 후 회원가입' })).toBeDisabled();
  await expect(page.getByText('가입 인증 방식이 변경되었습니다. 다시 인증해주세요.', { exact: true })).toBeVisible();
});

test('이메일 인증과 정책 401은 저장된 토큰이 있어도 refresh를 요청하지 않는다', async ({ page }) => {
  await open(page);
  let refreshes = 0;
  await page.route('**/api/v1/auth/refresh', route => { refreshes += 1; return reject(route, 'AUTH_UNAUTHORIZED', 401); });
  await page.route('**/api/v1/auth/email-verifications**', route => reject(route, 'AUTH_UNAUTHORIZED', 401));
  await page.route('**/api/v1/auth/signup-policy', route => reject(route, 'AUTH_UNAUTHORIZED', 401));
  const statuses = await page.evaluate(async () => {
    const { fetchWithAuth } = await import('/src/app/lib/auth-fetch.ts');
    localStorage.setItem('accessToken', 'existing-test-session');
    const paths = ['/api/v1/auth/signup-policy', '/api/v1/auth/email-verifications', '/api/v1/auth/email-verifications/flow/confirm'];
    return Promise.all(paths.map(async path => (await fetchWithAuth(new URL(path, location.origin))).status));
  });
  expect(statuses).toEqual([401, 401, 401]);
  expect(refreshes).toBe(0);
});

test('320px에서도 입력과 인증 동작이 가로로 넘치지 않고 안내 글자 명암비를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page);
  await send(page, 'long-but-valid-address@example.com');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const contrast = await page.locator('.auth-verification-status').evaluate(element => {
    const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const luminance = (value: string) => rgb(value).reduce((sum, channel, i) => {
      const n = channel / 255;
      return sum + (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i];
    }, 0);
    const color = luminance(getComputedStyle(element).color);
    const background = luminance(getComputedStyle(element.closest('.auth-modal-form')!).backgroundColor);
    return (Math.max(color, background) + 0.05) / (Math.min(color, background) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});
