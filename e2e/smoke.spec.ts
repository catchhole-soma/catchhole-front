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

test('회차 감지 수정값을 metadata의 episodeConfirmations로 업로드한다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const batchId = '22222222-2222-4222-8222-222222222222';
  const analysisJobId = '33333333-3333-4333-8333-333333333333';
  let detectionMultipartBody = '';
  let uploadMultipartBody = '';

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === 'POST' && pathname.endsWith('/episodes/detect')) {
      detectionMultipartBody = request.postData() ?? '';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            uploadType: 'MULTI_EPISODE_SINGLE_FILE',
            episodeCount: 2,
            totalCharCount: 16,
            detectedEpisodes: [
              {
                detectionOrder: 0,
                sourceFileIndex: 0,
                episodeNo: 1,
                title: '첫 제목',
                charCount: 8,
                content: '첫 번째 본문입니다.',
              },
              {
                detectionOrder: 1,
                sourceFileIndex: 0,
                episodeNo: 2,
                title: '둘째 제목',
                charCount: 8,
                content: '두 번째 본문입니다.',
              },
            ],
          },
          error: null,
        }),
      });
    }

    if (request.method() === 'POST' && pathname.endsWith(`/${workId}/episodes`)) {
      uploadMultipartBody = request.postData() ?? '';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            batchId,
            uploadType: 'MULTI_EPISODE_SINGLE_FILE',
            status: 'COMPLETED',
            episodeCount: 2,
            createdEpisodes: [
              { id: '44444444-4444-4444-8444-444444444444', episodeNo: 10, title: '첫 제목', status: 'UPLOADED' },
              { id: '55555555-5555-4555-8555-555555555555', episodeNo: 11, title: '둘째 제목', status: 'UPLOADED' },
            ],
            files: [],
          },
          error: null,
        }),
      });
    }

    if (request.method() === 'POST' && pathname.endsWith(`/${workId}/analysis-jobs`)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: analysisJobId, jobType: 'EPISODE_VALIDATION', status: 'PENDING' },
          error: null,
        }),
      });
    }

    if (request.method() === 'GET' && pathname.endsWith(`/analysis-jobs/${analysisJobId}`)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: analysisJobId,
            workId,
            workTitle: '테스트 작품',
            jobType: 'EPISODE_VALIDATION',
            status: 'PENDING',
            episodes: [],
          },
          error: null,
        }),
      });
    }

    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'episode@example.com',
          displayName: '회차 테스트',
          phoneNumber: '01012345678',
          phoneVerified: false,
          role: 'AUTHOR',
          status: 'ACTIVE',
        }
      : pathname.endsWith(`/${workId}/episodes`)
        ? []
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '테스트 작품', genre: '판타지' }
          : [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'episode-flow-token'));
  await page.goto(`/episode-upload?workId=${workId}`);

  await page.getByText('다회차 - 단일 파일', { exact: true }).click();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'episodes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('제 1화 첫 제목\n첫 번째 본문입니다.\n제 2화 둘째 제목\n두 번째 본문입니다.'),
  });

  await expect(page.getByText('2개 회차 감지됨', { exact: true })).toBeVisible();
  expect(detectionMultipartBody).toContain('name="metadata"');
  expect(detectionMultipartBody).not.toContain('name="data"');
  expect(detectionMultipartBody).toContain('"uploadType":"MULTI_EPISODE_SINGLE_FILE"');

  await page.getByRole('button', { name: '다음 — 회차 분리 확인' }).click();
  await page.locator('input[type="number"]').fill('10');
  await page.getByRole('button', { name: /2화 둘째 제목/ }).click();
  await page.locator('input[type="number"]').fill('11');
  await page.getByRole('button', { name: /회차 분리 확정 \(2개\)/ }).click();

  await expect.poll(() => uploadMultipartBody).not.toBe('');
  expect(uploadMultipartBody).toContain('name="metadata"');
  expect(uploadMultipartBody).toContain('"episodeConfirmations"');
  expect(uploadMultipartBody).toContain('"detectionOrder":0');
  expect(uploadMultipartBody).toContain('"episodeNo":10');
  expect(uploadMultipartBody).toContain('"detectionOrder":1');
  expect(uploadMultipartBody).toContain('"episodeNo":11');
  expect(uploadMultipartBody).not.toContain('"episodes"');
  await expect(page).toHaveURL(/analysisJobIds=33333333-3333-4333-8333-333333333333/);
  await expect(page).toHaveURL(/currentAnalysisJobIds=33333333-3333-4333-8333-333333333333/);
  await expect(page).toHaveURL(/jobType=EPISODE_VALIDATION/);
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

test('/auth/me 5xx는 토큰을 유지하고 재시도로 복구한다', async ({ page }) => {
  let getMeRequestCount = 0;
  await page.route('**/api/v1/**', route => {
    const isGetMe = new URL(route.request().url()).pathname.endsWith('/auth/me');
    if (isGetMe && getMeRequestCount++ === 0) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: '서버가 일시적으로 요청을 처리할 수 없습니다.',
          data: null,
          error: { code: 'SERVICE_UNAVAILABLE', status: 503, details: [] },
        }),
      });
    }

    const data = isGetMe
      ? {
          id: 1,
          email: 'retry@example.com',
          displayName: '재시도 테스트',
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
  await page.evaluate(() => localStorage.setItem('accessToken', 'valid-token'));

  await page.goto('/dashboard');

  await expect(page.getByText('인증 정보를 확인하지 못했습니다.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toBe('valid-token');

  await page.getByRole('button', { name: '다시 시도', exact: true }).click();

  await expect(page.getByText('설정 대시보드', { exact: true })).toBeVisible();
  await expect(page.getByText('캐릭터 DB', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toBe('valid-token');
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

test('데모 모드에서 실제 로그인하면 데모 상태를 지우고 인증을 확인한다', async ({ page }) => {
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
  await page.evaluate(() => {
    localStorage.setItem('catchhole_demo_mode', 'true');
    localStorage.setItem('catchhole_demo_works', '[]');
  });
  await page.getByPlaceholder('이메일').fill('enter@example.com');
  await page.getByPlaceholder('비밀번호').fill('Password1');

  await Promise.all([
    page.waitForRequest(request =>
      request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/auth/login')),
    page.getByPlaceholder('비밀번호').press('Enter'),
  ]);

  await expect(page).toHaveURL(/\/works$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('catchhole_demo_mode'))).toBeNull();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('catchhole_demo_works'))).toBeNull();
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

test('세션을 지우면 진행 중인 refresh 응답이 access token을 복원하지 않는다', async ({ page }) => {
  let releaseRefresh: (() => void) | undefined;
  const refreshStarted = new Promise<void>(resolve => {
    void page.route('**/api/v1/auth/refresh', async route => {
      resolve();
      await new Promise<void>(release => {
        releaseRefresh = release;
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { accessToken: 'late-refresh-token' },
          error: null,
        }),
      }).catch(() => undefined);
    });
  });
  await page.route('**/api/v1/protected', route => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, data: null, error: { code: 'AUTH_UNAUTHORIZED' } }),
  }));
  await page.goto('/landing');
  await page.evaluate(() => localStorage.setItem('accessToken', 'expired-token'));

  const protectedRequest = page.evaluate(async () => {
    const { fetchWithAuth } = await import('/src/app/lib/auth-fetch.ts');
    const response = await fetchWithAuth('http://localhost:8080/api/v1/protected');
    return response.status;
  });
  await refreshStarted;

  await page.evaluate(async () => {
    const { clearAuthSession } = await import('/src/app/lib/auth.ts');
    clearAuthSession();
  });
  releaseRefresh?.();

  await expect(protectedRequest).resolves.toBe(401);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toBeNull();
});
