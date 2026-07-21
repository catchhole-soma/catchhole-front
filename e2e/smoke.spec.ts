import { test, expect } from '@playwright/test';

// 실제 로그인/작품선택(백엔드 연동)은 검증하지 않음 — accessToken을 직접 주입해
// "이미 인증된 상태"만 흉내 내고, 그 상태에서 /dashboard 렌더링이 깨지지 않는지만 확인한다.
test('백엔드 없이 /dashboard 렌더링이 깨지지 않는다', async ({ page }) => {
  // Vite의 /src/app/api 모듈은 건드리지 않고 실제 백엔드 API 경로만 모킹한다.
  await page.route('**/api/v1/**', (route) => {
    const isGetMe = new URL(route.request().url()).pathname.endsWith('/auth/me');
    const data = isGetMe
      ? {
          id: 1,
          email: 'smoke@example.com',
          displayName: '스모크 테스트',
          phoneNumber: '01012345678',
          phoneVerified: false,
          role: 'AUTHOR',
          status: 'ACTIVE',
        }
      : [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'mock'));

  await page.goto('/dashboard');

  await expect(page.getByText('설정 대시보드', { exact: true })).toBeVisible();
  await expect(page.getByText('캐릭터 DB', { exact: true })).toBeVisible();
});

test('데모 모드는 access token 없이 /dashboard를 열 수 있다', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('catchhole_demo_mode', 'true'));

  await page.goto('/dashboard');

  await expect(page.getByText('설정 대시보드', { exact: true })).toBeVisible();
  await expect(page.getByText('캐릭터 DB', { exact: true })).toBeVisible();
});

test('인증 서버 단절은 토큰을 지우지 않고 데모 전환을 허용한다', async ({ page }) => {
  await page.route('**/api/v1/auth/me', route => route.abort('connectionfailed'));
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'mock'));

  await page.goto('/dashboard');

  await expect(page.getByText('백엔드 서버에 연결할 수 없습니다', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toBe('mock');

  await page.getByRole('button', { name: '데모 버전으로 전환' }).click();

  await expect(page.getByText('설정 대시보드', { exact: true })).toBeVisible();
  await expect(page.getByText('캐릭터 DB', { exact: true })).toBeVisible();
});

test('Auth 모달은 닫기·배경·Esc·뒤로가기로 랜딩에 복귀한다', async ({ page }) => {
  await page.goto('/landing');

  await page.getByRole('button', { name: '로그인', exact: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('dialog', { name: '로그인' })).toBeVisible();
  await page.getByRole('button', { name: '로그인 닫기' }).click();
  await expect(page).toHaveURL(/\/landing$/);

  await page.getByRole('button', { name: '로그인', exact: true }).first().click();
  await page.locator('.auth-modal-backdrop').click({ position: { x: 4, y: 4 } });
  await expect(page).toHaveURL(/\/landing$/);

  await page.getByRole('button', { name: '로그인', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: '로그인' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/landing$/);

  await page.getByRole('button', { name: '로그인', exact: true }).first().click();
  await page.goBack();
  await expect(page).toHaveURL(/\/landing$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('로그인·회원가입 전환과 약관 오버레이는 히스토리를 일관되게 유지한다', async ({ page }) => {
  await page.goto('/landing');
  await page.getByRole('button', { name: '로그인', exact: true }).first().click();

  await page.getByRole('dialog', { name: '로그인' })
    .getByRole('button', { name: '회원가입', exact: true })
    .click();
  await expect(page).toHaveURL(/\/signup$/);

  await page.getByRole('dialog', { name: '회원가입' })
    .getByRole('button', { name: '이용약관', exact: true })
    .click();
  await expect(page).toHaveURL(/\/signup\?terms=terms$/);
  await expect(page.getByRole('dialog', { name: '법적 고지' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole('dialog', { name: '회원가입' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/landing$/);
});

test('약관 딥링크를 닫으면 Auth 딥링크를 유지한다', async ({ page }) => {
  await page.goto('/signup?terms=privacy');

  await expect(page.getByRole('dialog', { name: '법적 고지' })).toBeVisible();
  await page.getByRole('button', { name: '법적 고지 닫기' }).click();

  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole('dialog', { name: '회원가입' })).toBeVisible();
});

test('모바일 Auth 모달은 뷰포트 전체를 사용한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');

  const loginDialog = page.getByRole('dialog', { name: '로그인' });
  await expect.poll(async () => {
    const box = await loginDialog.boundingBox();
    return box && {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  }).toEqual({ x: 0, y: 0, width: 390, height: 844 });

  await loginDialog
    .getByRole('button', { name: '회원가입', exact: true })
    .click();
  const signupDialog = page.getByRole('dialog', { name: '회원가입' });
  await expect.poll(async () => {
    const box = await signupDialog.boundingBox();
    return box && {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  }).toEqual({ x: 0, y: 0, width: 390, height: 844 });
});

test('비밀번호 입력창에서 Enter를 누르면 로그인을 제출한다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/login')
      ? { accessToken: 'enter-login-token' }
      : pathname.endsWith('/auth/me')
        ? {
            id: 1,
            email: 'enter@example.com',
            displayName: '엔터 테스트',
            phoneNumber: '01012345678',
            phoneVerified: false,
            role: 'AUTHOR',
            status: 'ACTIVE',
          }
        : [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });
  await page.goto('/login');
  await page.getByPlaceholder('이메일').fill('enter@example.com');
  await page.getByPlaceholder('비밀번호').fill('Password1');

  await Promise.all([
    page.waitForRequest(request =>
      request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/auth/login')),
    page.getByPlaceholder('비밀번호').press('Enter'),
  ]);

  await expect(page).toHaveURL(/\/works$/);
});

test('작품 선택 화면에서 로그아웃하면 랜딩으로 이동한다', async ({ page }) => {
  await page.route('**/api/v1/auth/logout', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: null, error: null }),
  }));
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('catchhole_demo_mode', 'true'));
  await page.goto('/works');

  await expect(page.getByText('작품 선택', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '사용자 메뉴 열기' }).click();
  await page.getByRole('button', { name: '로그아웃' }).click();

  await expect(page).toHaveURL(/\/landing$/);
});
