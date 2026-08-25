import { expect, test, type Page, type Route } from '@playwright/test';

const member = {
  id: 132,
  email: 'member132@example.com',
  displayName: '탈퇴 메뉴 테스트',
  phoneNumber: '01012345678',
  phoneVerified: true,
  profileImageUrl: null,
  role: 'AUTHOR',
  status: 'ACTIVE',
};

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function success(route: Route, data: unknown, status = 200) {
  return json(route, status, { success: true, data, error: null });
}

function accepted(route: Route) {
  return success(route, {
    requestId: '13200000-0000-4000-8000-000000000132',
    status: 'REQUESTED',
  }, 202);
}

function unauthorized(route: Route) {
  return json(route, 401, {
    success: false,
    data: null,
    message: '인증이 필요합니다.',
    error: {
      code: 'UNAUTHORIZED',
      status: 401,
      details: [],
    },
  });
}

type ApiRouteHandlers = {
  authMe?: (route: Route) => Promise<void> | void;
  refresh?: (route: Route) => Promise<void> | void;
  withdrawal?: (route: Route) => Promise<void> | void;
};

async function openAuthenticatedWorks(
  page: Page,
  handlers: ApiRouteHandlers = {},
) {
  const {
    authMe = route => success(route, member),
    refresh,
    withdrawal = route => accepted(route),
  } = handlers;
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return authMe(route);
    if (pathname.endsWith('/auth/refresh') && refresh) return refresh(route);
    if (pathname === '/api/v1/members/me' && request.method() === 'DELETE') {
      return withdrawal(route);
    }
    return success(route, []);
  });
  await page.goto('/landing');
  await page.evaluate(() => localStorage.setItem('accessToken', 'member-withdrawal-token'));
  await page.goto('/works');
  await expect(page.getByText('작품 선택', { exact: true })).toBeVisible();
}

async function openWithdrawalDialog(page: Page) {
  await page.getByRole('button', { name: '사용자 메뉴 열기' }).click();
  await page.getByRole('menuitem', { name: '회원 탈퇴' }).click();
  return page.getByRole('dialog', { name: '회원 탈퇴' });
}

test('사용자 정보와 키보드 메뉴를 제공하고 202 응답 뒤에만 세션을 종료한다', async ({ page }) => {
  let requestBody: Record<string, unknown> | undefined;
  await openAuthenticatedWorks(page, {
    withdrawal: route => {
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      return accepted(route);
    },
  });

  const trigger = page.getByRole('button', { name: '사용자 메뉴 열기' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(member.displayName, { exact: true })).toBeVisible();
  await expect(page.getByText(member.email, { exact: true })).toBeVisible();

  const logoutItem = page.getByRole('menuitem', { name: '로그아웃' });
  const withdrawalItem = page.getByRole('menuitem', { name: '회원 탈퇴' });
  await expect(logoutItem).toBeFocused();
  await page.keyboard.press('End');
  await expect(withdrawalItem).toBeFocused();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: '회원 탈퇴' });
  const password = dialog.getByLabel('현재 비밀번호');
  const confirmation = dialog.getByLabel('확인 문구');
  const confirm = dialog.getByRole('button', { name: '회원 탈퇴', exact: true });
  await expect(password).toBeFocused();
  await expect(confirm).toBeDisabled();
  await password.fill('correct-password');
  await confirmation.fill('회원탈퇴');
  await expect(confirm).toBeDisabled();
  await confirmation.fill('회원 탈퇴');
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page).toHaveURL(/\/landing$/);
  expect(requestBody).toEqual({
    currentPassword: 'correct-password',
    confirmation: '회원 탈퇴',
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
  await expect(page.getByText('회원 탈퇴가 접수되었습니다.', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    window.history.state?.usr?.memberWithdrawalAccepted === true
  ))).toBe(false);

  await page.reload();
  await expect(page.getByText('회원 탈퇴가 접수되었습니다.', { exact: true })).toHaveCount(0);
});

test('비밀번호 불일치 시 입력값과 세션을 유지하고 Escape 뒤 메뉴 버튼으로 복귀한다', async ({ page }) => {
  await openAuthenticatedWorks(page, {
    withdrawal: route => json(route, 400, {
      success: false,
      data: null,
      message: '현재 비밀번호가 일치하지 않습니다.',
      error: {
        code: 'MEMBER_WITHDRAWAL_PASSWORD_MISMATCH',
        status: 400,
        details: [],
      },
    }),
  });
  const dialog = await openWithdrawalDialog(page);
  const password = dialog.getByLabel('현재 비밀번호');
  const confirmation = dialog.getByLabel('확인 문구');
  await password.fill('wrong-password');
  await confirmation.fill('회원 탈퇴');
  await dialog.getByRole('button', { name: '회원 탈퇴', exact: true }).click();

  await expect(dialog.getByText('현재 비밀번호가 일치하지 않습니다.', { exact: true })).toBeVisible();
  await expect(password).toHaveValue('wrong-password');
  await expect(confirmation).toHaveValue('회원 탈퇴');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken')))
    .toBe('member-withdrawal-token');

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: '사용자 메뉴 열기' })).toBeFocused();
});

test('탈퇴 API의 재시도 401만으로 유효한 세션을 제거하지 않는다', async ({ page }) => {
  let authMeAttempts = 0;
  let refreshAttempts = 0;
  let withdrawalAttempts = 0;
  await openAuthenticatedWorks(page, {
    authMe: route => {
      authMeAttempts += 1;
      return success(route, member);
    },
    refresh: route => {
      refreshAttempts += 1;
      return success(route, { accessToken: 'refreshed-member-withdrawal-token' });
    },
    withdrawal: route => {
      withdrawalAttempts += 1;
      return unauthorized(route);
    },
  });
  const authMeAttemptsBeforeWithdrawal = authMeAttempts;
  const dialog = await openWithdrawalDialog(page);
  await dialog.getByLabel('현재 비밀번호').fill('current-password');
  await dialog.getByLabel('확인 문구').fill('회원 탈퇴');
  await dialog.getByRole('button', { name: '회원 탈퇴', exact: true }).click();

  await expect(dialog.getByText('로그인 상태를 확인할 수 없습니다. 다시 로그인한 뒤 시도해 주세요.'))
    .toBeVisible();
  await expect(page).toHaveURL(/\/works$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken')))
    .toBe('refreshed-member-withdrawal-token');
  expect(withdrawalAttempts).toBe(2);
  expect(refreshAttempts).toBe(1);
  expect(authMeAttempts).toBe(authMeAttemptsBeforeWithdrawal + 1);
});

test('탈퇴 재시도 401 뒤 auth/me도 401이면 세션을 제거한다', async ({ page }) => {
  let rejectSession = false;
  await openAuthenticatedWorks(page, {
    authMe: route => rejectSession ? unauthorized(route) : success(route, member),
    refresh: route => success(route, { accessToken: 'expired-member-withdrawal-token' }),
    withdrawal: route => unauthorized(route),
  });
  const dialog = await openWithdrawalDialog(page);
  await dialog.getByLabel('현재 비밀번호').fill('current-password');
  await dialog.getByLabel('확인 문구').fill('회원 탈퇴');
  rejectSession = true;
  await dialog.getByRole('button', { name: '회원 탈퇴', exact: true }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
});

test('처리 중에는 중복 요청과 닫기를 막는다', async ({ page }) => {
  let attempts = 0;
  let releaseRequest: (() => void) | undefined;
  await openAuthenticatedWorks(page, {
    withdrawal: async route => {
      attempts += 1;
      await new Promise<void>(resolve => {
        releaseRequest = resolve;
      });
      await accepted(route);
    },
  });
  const dialog = await openWithdrawalDialog(page);
  await dialog.getByLabel('현재 비밀번호').fill('correct-password');
  await dialog.getByLabel('확인 문구').fill('회원 탈퇴');
  await dialog.getByRole('button', { name: '회원 탈퇴', exact: true }).click();

  await expect.poll(() => attempts).toBe(1);
  const pendingButton = dialog.getByRole('button', { name: '탈퇴 처리 중...' });
  await expect(pendingButton).toBeDisabled();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.mouse.click(2, 2);
  await expect(dialog).toBeVisible();
  expect(attempts).toBe(1);

  releaseRequest?.();
  await expect(page).toHaveURL(/\/landing$/);
  expect(attempts).toBe(1);
});

test('320px 화면에서도 메뉴와 탈퇴 모달이 가로로 넘치지 않고 포커스를 가둔다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openAuthenticatedWorks(page);
  const trigger = page.getByRole('button', { name: '사용자 메뉴 열기' });
  const triggerBox = await trigger.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(triggerBox!.width).toBeGreaterThanOrEqual(44);
  expect(triggerBox!.height).toBeGreaterThanOrEqual(44);
  await trigger.click();
  const menu = page.getByRole('menu', { name: '사용자 메뉴' });
  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(0);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(320);

  await page.getByRole('menuitem', { name: '회원 탈퇴' }).click();
  const dialog = page.getByRole('dialog', { name: '회원 탈퇴' });
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(320);
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(568);
  await expect(dialog.getByLabel('현재 비밀번호')).toBeFocused();

  for (let index = 0; index < 8; index += 1) await page.keyboard.press('Tab');
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
