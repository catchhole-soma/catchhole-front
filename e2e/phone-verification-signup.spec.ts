import { expect, test, type Page, type Route } from '@playwright/test';

const response = (route: Route, data: unknown, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

const success = (data: unknown) => ({
  success: true,
  message: '요청을 처리했습니다.',
  data,
  error: null,
});

const failure = (code: string, status: number) => ({
  success: false,
  message: '요청을 처리할 수 없습니다.',
  data: null,
  error: { code, status, details: [] },
});

async function openSignup(page: Page) {
  await page.goto('/signup');
  return page.getByRole('dialog', { name: '회원가입' });
}

async function fillBaseSignupForm(page: Page) {
  await page.getByPlaceholder('이름 (필명)').fill('인증 테스트');
  await page.getByPlaceholder('이메일').fill('verified@example.com');
  await page.getByPlaceholder('비밀번호', { exact: true }).fill('Password1234');
  await page.getByPlaceholder('비밀번호 확인').fill('Password1234');
}

test('발송·오입력·인증 완료 후 토큰으로 가입하고 민감 토큰은 저장소에 남기지 않는다', async ({ page }) => {
  let signupBody: Record<string, unknown> | null = null;

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === 'POST' && pathname === '/api/v1/auth/phone-verifications') {
      return response(route, success({
        verificationId: 'verification-success',
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
      }));
    }
    if (request.method() === 'POST' && pathname.endsWith('/verification-success/confirm')) {
      const body = request.postDataJSON() as { code: string };
      if (body.code === '000000') {
        return response(route, failure('AUTH_PHONE_VERIFICATION_CODE_INVALID', 400), 400);
      }
      return response(route, success({
        phoneVerificationToken: 'memory-only-signup-token',
        expiresInSeconds: 600,
      }));
    }
    if (request.method() === 'POST' && pathname === '/api/v1/auth/signup') {
      signupBody = request.postDataJSON() as Record<string, unknown>;
      return response(route, success({ accessToken: 'signup-access-token' }));
    }
    if (pathname === '/api/v1/auth/me') {
      return response(route, success({
        id: 1,
        email: 'verified@example.com',
        displayName: '인증 테스트',
        phoneNumber: '01012345678',
        phoneVerified: true,
        role: 'AUTHOR',
        status: 'ACTIVE',
      }));
    }
    return response(route, success([]));
  });

  const dialog = await openSignup(page);
  await fillBaseSignupForm(page);
  await page.getByPlaceholder('휴대폰 번호 (예: 01012345678)').fill('01012345678');
  await dialog.getByRole('button', { name: '인증번호 받기' }).click();

  await expect(page.getByPlaceholder('인증번호 6자리')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '휴대폰 인증 후 회원가입' })).toBeDisabled();
  const persistedAfterRequest = await page.evaluate(() => (
    JSON.parse(sessionStorage.getItem('catchhole_phone_verification') ?? '{}') as Record<string, unknown>
  ));
  expect(Object.keys(persistedAfterRequest).sort()).toEqual([
    'expiresAt', 'phoneNumber', 'resendAt', 'verificationId',
  ]);

  await page.getByPlaceholder('인증번호 6자리').fill('000000');
  await dialog.getByRole('button', { name: '인증', exact: true }).click();
  await expect(page.getByText('인증번호가 올바르지 않습니다.', { exact: true })).toBeVisible();

  await page.getByPlaceholder('인증번호 6자리').fill('123456');
  await dialog.getByRole('button', { name: '인증', exact: true }).click();
  await expect(page.getByText('휴대폰 인증이 완료되었습니다.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '이용약관 동의 및 개인정보 처리방침 확인' }).click();
  await expect(dialog.getByRole('button', { name: '회원가입', exact: true })).toBeEnabled();

  const persistedAfterConfirm = await page.evaluate(() => (
    sessionStorage.getItem('catchhole_phone_verification') ?? ''
  ));
  expect(persistedAfterConfirm).not.toContain('memory-only-signup-token');
  expect(await page.evaluate(() => localStorage.getItem('phoneVerificationToken'))).toBeNull();

  await dialog.getByRole('button', { name: '회원가입', exact: true }).click();
  await expect(page).toHaveURL(/\/works$/);
  expect(signupBody).toEqual({
    email: 'verified@example.com',
    password: 'Password1234',
    displayName: '인증 테스트',
    termsAccepted: true,
    privacyPolicyAcknowledged: true,
    phoneVerificationToken: 'memory-only-signup-token',
  });
  expect(signupBody).not.toHaveProperty('phoneNumber');
  expect(await page.evaluate(() => sessionStorage.getItem('catchhole_phone_verification'))).toBeNull();
});

test('인증된 번호를 변경하면 인증 토큰과 진행 상태를 폐기한다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/v1/auth/phone-verifications') {
      return response(route, success({
        verificationId: 'verification-change',
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
      }));
    }
    if (pathname.endsWith('/verification-change/confirm')) {
      return response(route, success({
        phoneVerificationToken: 'must-be-discarded',
        expiresInSeconds: 600,
      }));
    }
    return response(route, success([]));
  });

  const dialog = await openSignup(page);
  await page.getByPlaceholder('휴대폰 번호 (예: 01012345678)').fill('01012345678');
  await dialog.getByRole('button', { name: '인증번호 받기' }).click();
  await page.getByPlaceholder('인증번호 6자리').fill('123456');
  await dialog.getByRole('button', { name: '인증', exact: true }).click();
  await expect(page.getByText('휴대폰 인증이 완료되었습니다.', { exact: true })).toBeVisible();

  await page.getByPlaceholder('휴대폰 번호 (예: 01012345678)').fill('01087654321');

  await expect(page.getByText('가입 전 휴대폰 번호 인증이 필요합니다.', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '인증번호 받기' })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: '휴대폰 인증 후 회원가입' })).toBeDisabled();
  expect(await page.evaluate(() => sessionStorage.getItem('catchhole_phone_verification'))).toBeNull();
});

test('인증번호 만료 후 새 인증번호를 재전송하고 최신 verificationId만 저장한다', async ({ page }) => {
  let requestCount = 0;
  await page.route('**/api/v1/auth/phone-verifications', route => {
    requestCount += 1;
    return response(route, success({
      verificationId: `verification-${requestCount}`,
      expiresInSeconds: 1,
      resendAfterSeconds: 1,
    }));
  });

  const dialog = await openSignup(page);
  await page.getByPlaceholder('휴대폰 번호 (예: 01012345678)').fill('01012345678');
  await dialog.getByRole('button', { name: '인증번호 받기' }).click();
  await expect(page.getByPlaceholder('인증번호 6자리')).toBeVisible();

  await expect(page.getByText('인증번호가 만료되었습니다. 새 인증번호를 받아주세요.', { exact: true }))
    .toBeVisible({ timeout: 3_000 });
  await expect(dialog.getByRole('button', { name: '인증번호 재전송' })).toBeEnabled();
  await dialog.getByRole('button', { name: '인증번호 재전송' }).click();

  await expect.poll(() => requestCount).toBe(2);
  await expect(page.getByPlaceholder('인증번호 6자리')).toBeVisible();
  const verificationId = await page.evaluate(() => {
    const raw = sessionStorage.getItem('catchhole_phone_verification');
    return raw ? (JSON.parse(raw) as { verificationId: string }).verificationId : null;
  });
  expect(verificationId).toBe('verification-2');
});

test('중복 번호·발송 한도·인증 서비스 장애를 서로 다른 메시지로 안내한다', async ({ page }) => {
  await page.route('**/api/v1/auth/phone-verifications', route => {
    const body = route.request().postDataJSON() as { phoneNumber: string };
    const error = body.phoneNumber === '01000000001'
      ? ['AUTH_PHONE_NUMBER_DUPLICATED', 409] as const
      : body.phoneNumber === '01000000002'
        ? ['AUTH_PHONE_VERIFICATION_RATE_LIMITED', 429] as const
        : ['AUTH_PHONE_VERIFICATION_UNAVAILABLE', 503] as const;
    return response(route, failure(error[0], error[1]), error[1]);
  });

  const dialog = await openSignup(page);
  const phoneInput = page.getByPlaceholder('휴대폰 번호 (예: 01012345678)');
  for (const [phoneNumber, message] of [
    ['01000000001', '이미 가입된 휴대폰 번호입니다.'],
    ['01000000002', '인증번호 발송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'],
    ['01000000003', '현재 휴대폰 인증을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.'],
  ]) {
    await phoneInput.fill(phoneNumber);
    await dialog.getByRole('button', { name: '인증번호 받기' }).click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
  }
});

test('인증번호 입력 횟수를 초과하면 잠긴 흐름을 폐기하고 재전송 대기를 유지한다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/v1/auth/phone-verifications') {
      return response(route, success({
        verificationId: 'verification-attempts',
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
      }));
    }
    return response(route, failure('AUTH_PHONE_VERIFICATION_ATTEMPTS_EXCEEDED', 429), 429);
  });

  const dialog = await openSignup(page);
  await page.getByPlaceholder('휴대폰 번호 (예: 01012345678)').fill('01012345678');
  await dialog.getByRole('button', { name: '인증번호 받기' }).click();
  await page.getByPlaceholder('인증번호 6자리').fill('555555');
  await dialog.getByRole('button', { name: '인증', exact: true }).click();

  await expect(page.getByText(
    '인증번호 입력 횟수를 초과했습니다. 새 인증번호를 받아주세요.',
    { exact: true },
  )).toBeVisible();
  await expect(page.getByPlaceholder('인증번호 6자리')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /\d+초 후 재전송/ })).toBeDisabled();

  const persisted = await page.evaluate(() => (
    JSON.parse(sessionStorage.getItem('catchhole_phone_verification') ?? '{}') as Record<string, unknown>
  ));
  expect(persisted.verificationId).toBeNull();

  await page.reload();
  await expect(page.getByPlaceholder('휴대폰 번호 (예: 01012345678)')).toHaveValue('01012345678');
  await expect(page.getByPlaceholder('인증번호 6자리')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: '회원가입' })
    .getByRole('button', { name: /\d+초 후 재전송/ })).toBeDisabled();
});

test('Backend가 인증 흐름 만료를 반환하면 진행 상태를 폐기하고 새 발송을 안내한다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/v1/auth/phone-verifications') {
      return response(route, success({
        verificationId: 'verification-expired-by-server',
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
      }));
    }
    return response(route, failure('AUTH_PHONE_VERIFICATION_EXPIRED', 410), 410);
  });

  const dialog = await openSignup(page);
  await page.getByPlaceholder('휴대폰 번호 (예: 01012345678)').fill('01012345678');
  await dialog.getByRole('button', { name: '인증번호 받기' }).click();
  await page.getByPlaceholder('인증번호 6자리').fill('123456');
  await dialog.getByRole('button', { name: '인증', exact: true }).click();

  await expect(page.getByText('인증번호가 만료되었습니다. 새 인증번호를 받아주세요.', { exact: true }))
    .toBeVisible();
  await expect(dialog.getByRole('button', { name: '인증번호 받기' })).toBeEnabled();
  expect(await page.evaluate(() => sessionStorage.getItem('catchhole_phone_verification'))).toBeNull();
});

test('회원가입 토큰이 유효하지 않으면 인증 완료 상태를 폐기하고 재인증을 요구한다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/v1/auth/phone-verifications') {
      return response(route, success({
        verificationId: 'verification-token-invalid',
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
      }));
    }
    if (pathname.endsWith('/verification-token-invalid/confirm')) {
      return response(route, success({
        phoneVerificationToken: 'invalid-at-signup',
        expiresInSeconds: 600,
      }));
    }
    if (pathname === '/api/v1/auth/signup') {
      return response(route, failure('AUTH_PHONE_VERIFICATION_TOKEN_INVALID', 400), 400);
    }
    return response(route, success([]));
  });

  const dialog = await openSignup(page);
  await fillBaseSignupForm(page);
  await page.getByPlaceholder('휴대폰 번호 (예: 01012345678)').fill('01012345678');
  await dialog.getByRole('button', { name: '인증번호 받기' }).click();
  await page.getByPlaceholder('인증번호 6자리').fill('123456');
  await dialog.getByRole('button', { name: '인증', exact: true }).click();
  await dialog.getByRole('button', { name: '이용약관 동의 및 개인정보 처리방침 확인' }).click();
  await dialog.getByRole('button', { name: '회원가입', exact: true }).click();

  await expect(page.getByText(
    '휴대폰 인증이 만료되었거나 이미 사용되었습니다. 다시 인증해주세요.',
    { exact: true },
  )).toBeVisible();
  await expect(dialog.getByRole('button', { name: '휴대폰 인증 후 회원가입' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: '인증번호 받기' })).toBeEnabled();
  expect(await page.evaluate(() => sessionStorage.getItem('catchhole_phone_verification'))).toBeNull();
});
