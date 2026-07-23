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

  await page.getByRole('button', { name: '원고 목록으로', exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/dashboard\\?workId=${workId}&nav=manuscripts$`),
  );
});

test('설정 구축 완료 후 현재 작품의 설정 DB로 이동한다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const batchId = '22222222-2222-4222-8222-222222222222';
  const analysisJobId = '33333333-3333-4333-8333-333333333333';

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'setting-complete@example.com',
          displayName: '설정 구축 테스트',
          phoneNumber: '01012345678',
          phoneVerified: false,
          role: 'AUTHOR',
          status: 'ACTIVE',
        }
      : pathname.endsWith(`/analysis-jobs/${analysisJobId}`)
        ? {
            id: analysisJobId,
            workId,
            workTitle: '현재 작품',
            batchId,
            jobType: 'SETTING_EXTRACTION',
            status: 'SUCCEEDED',
            episodes: [{
              id: '44444444-4444-4444-8444-444444444444',
              episodeNo: 1,
              title: '첫 회차',
              status: 'ANALYZED',
            }],
          }
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '현재 작품', genre: '판타지' }
          : pathname.endsWith('/works')
            ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 1 }]
            : [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'setting-complete-token'));
  await page.goto(
    `/episode-upload?workId=${workId}&batchId=${batchId}`
    + `&analysisJobIds=${analysisJobId}&currentAnalysisJobIds=${analysisJobId}`
    + '&jobType=SETTING_EXTRACTION',
  );

  await page.getByRole('button', { name: '설정 DB 보기' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/dashboard\\?workId=${workId}&nav=settingDB$`),
  );
  await expect(page.getByText('현재 작품', { exact: true }).first()).toBeVisible();
});

test('분석 중에는 제목 수정만 허용하고 파일 변경과 삭제를 막는다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const episodeId = '44444444-4444-4444-8444-444444444444';

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'episode-active@example.com',
          displayName: '분석 중 테스트',
          phoneNumber: '01012345678',
          phoneVerified: false,
          role: 'AUTHOR',
          status: 'ACTIVE',
        }
      : pathname.endsWith(`/${workId}/episodes`)
        ? [{
            id: episodeId,
            episodeNo: 1,
            title: '분석 중 회차',
            originalFilename: 'episode-1.txt',
            contentUpdatedAt: '2026-07-23T12:00:00',
            charCount: 100,
            analysisStatus: 'IN_PROGRESS',
            unresolvedFindingCount: null,
          }]
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '현재 작품', genre: '판타지' }
          : pathname.endsWith('/works')
            ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 1 }]
            : [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'episode-active-token'));
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);

  const titleButton = page.getByRole('button', { name: '분석 중 회차' });
  await expect(titleButton).toBeEnabled();
  await expect(page.getByRole('button', { name: '파일 변경' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '삭제' })).toBeDisabled();

  await titleButton.click();
  await expect(page.getByRole('textbox')).toHaveValue('분석 중 회차');
});

test('회차 검사 결과에서 현재 작품 원고 목록으로 돌아간다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const episodeId = '44444444-4444-4444-8444-444444444444';

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'episode-report@example.com',
          displayName: '회차 결과 테스트',
          phoneNumber: '01012345678',
          phoneVerified: false,
          role: 'AUTHOR',
          status: 'ACTIVE',
        }
      : pathname.endsWith(`/${workId}/episodes`)
        ? [{
            id: episodeId,
            episodeNo: 1,
            title: '분석 완료 회차',
            originalFilename: 'episode-1.txt',
            contentUpdatedAt: '2026-07-23T12:00:00',
            charCount: 100,
            analysisStatus: 'COMPLETED',
            unresolvedFindingCount: 0,
          }]
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '현재 작품', genre: '판타지' }
          : pathname.endsWith('/works')
            ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 1 }]
            : [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'episode-report-token'));
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);

  await page.getByRole('button', { name: '결과 보기' }).click();
  await expect(page).toHaveURL(
    new RegExp(`/episode-validation-report\\?workId=${workId}$`),
  );
  await page.reload();

  await page.getByRole('button', { name: '← 이전' }).click();
  await expect(page).toHaveURL(
    new RegExp(`/dashboard\\?workId=${workId}&nav=manuscripts$`),
  );
  await expect(page.getByText('현재 작품', { exact: true }).first()).toBeVisible();
});

test('회차 원문은 일반 수정일이 아닌 원문 변경일을 표시한다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const episodeId = '44444444-4444-4444-8444-444444444444';

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'episode-content-date@example.com',
          displayName: '원문 날짜 테스트',
          phoneNumber: '01012345678',
          phoneVerified: false,
          role: 'AUTHOR',
          status: 'ACTIVE',
        }
      : pathname.endsWith(`/episodes/${episodeId}`)
        ? {
            id: episodeId,
            episodeNo: 1,
            title: '원문 날짜 회차',
            content: '원문입니다.',
            originalFilename: 'episode-1.txt',
            contentUpdatedAt: '2026-07-20T12:34:00+09:00',
            createdAt: '2026-07-19T09:00:00+09:00',
            updatedAt: '2026-07-23T23:59:00+09:00',
            charCount: 6,
          }
        : [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'episode-content-date-token'));
  await page.goto(`/editor?workId=${workId}&episodeId=${episodeId}`);

  const article = page.getByRole('article');
  await expect(article).toContainText('2026. 7. 20.');
  await expect(article).not.toContainText('2026. 7. 23.');
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

test('작품 목록은 최신 회차 유무를 표시하고 선택한 workId를 URL에 유지한다', async ({ page }) => {
  const newWorkId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const existingWorkId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await page.route('**/api/v1/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        id: 1,
        email: 'works@example.com',
        displayName: '작품 테스트',
        phoneNumber: '01012345678',
        phoneVerified: false,
        role: 'AUTHOR',
        status: 'ACTIVE',
      },
      error: null,
    }),
  }));
  await page.route('**/api/v1/works', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: [
        {
          id: newWorkId,
          title: '새 작품',
          description: '처음 시작하는 판타지',
          genre: '판타지',
          latestEpisodeNo: 0,
        },
        {
          id: existingWorkId,
          title: '연재 작품',
          description: null,
          genre: '로맨스',
          latestEpisodeNo: 12,
        },
      ],
      error: null,
    }),
  }));
  await page.route(`**/api/v1/works/${newWorkId}/**`, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [], error: null }),
  }));
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'works-token'));

  await page.goto('/works');

  await expect(page.getByText('등록된 회차 없음', { exact: true })).toBeVisible();
  await expect(page.getByText('마지막 회차 12화', { exact: true })).toBeVisible();
  await expect(page.getByText('처음 시작하는 판타지', { exact: true })).toBeVisible();
  await expect(page.getByText('작품 소개가 없습니다.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '새 작품 작품 선택' }).click();

  await expect(page).toHaveURL(
    new RegExp(`/dashboard\\?workId=${newWorkId}&nav=manuscripts$`),
  );
  await expect(page.getByText('새 작품', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('아직 업로드된 원고가 없습니다.', { exact: true })).toBeVisible();
});

test('데모 작품 수정 후 세션을 초기화하면 기본 작품 정보가 복원된다', async ({ page }) => {
  await page.goto('/login');

  const resetWork = await page.evaluate(async () => {
    localStorage.clear();
    const {
      getDemoWorks,
      setDemoMode,
      updateDemoWork,
    } = await import('/src/app/lib/worksApi.ts');

    setDemoMode(true);
    await updateDemoWork('detective', {
      title: '변경된 데모 작품',
      genre: '추리',
      description: '변경된 설명',
    });
    setDemoMode(false);
    setDemoMode(true);

    const works = await getDemoWorks();
    return works.find(work => work.id === 'detective');
  });

  expect(resetWork).toMatchObject({
    id: 'detective',
    title: '탐정 사무소의 비밀',
    genre: '추리',
    description: null,
    episodeCount: 12,
  });
});

test('작품 등록은 입력 오류를 표시하고 실패한 값을 유지한 뒤 재시도한다', async ({ page }) => {
  let createAttempts = 0;
  let created = false;
  let createPayload: Record<string, unknown> | null = null;
  await page.route('**/api/v1/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        id: 1,
        email: 'create@example.com',
        displayName: '등록 테스트',
        phoneNumber: '01012345678',
        phoneVerified: false,
        role: 'AUTHOR',
        status: 'ACTIVE',
      },
      error: null,
    }),
  }));
  await page.route('**/api/v1/works', route => {
    if (route.request().method() === 'POST') {
      createAttempts += 1;
      createPayload = route.request().postDataJSON() as Record<string, unknown>;
      if (createAttempts === 1) {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: '요청값이 올바르지 않습니다.',
            data: null,
            error: {
              code: 'REQUEST_VALIDATION_FAILED',
              status: 400,
              details: [{ field: 'title', message: '작품 제목을 다시 확인해 주세요.' }],
            },
          }),
        });
      }
      created = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'created-work',
            title: '검은 달의 기사',
            description: '달빛 아래 시작된 모험',
            genre: '판타지',
            latestEpisodeNo: 0,
          },
          error: null,
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: created
          ? [{
              id: 'created-work',
              title: '검은 달의 기사',
              description: '달빛 아래 시작된 모험',
              genre: '판타지',
              latestEpisodeNo: 0,
            }]
          : [],
        error: null,
      }),
    });
  });
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'create-token'));
  await page.goto('/works');

  const emptyCreateButton = page.getByRole('button', { name: '새 작품 등록' });
  await expect(emptyCreateButton).toHaveCSS('width', '184px');
  await expect(emptyCreateButton).toHaveCSS('height', '184px');
  await emptyCreateButton.click();
  await expect(page).toHaveURL(/\/works\?modal=work-create$/);
  const dialog = page.getByRole('dialog', { name: '새 작품 등록' });
  const genreOptimizationNotice = '* 현재 서비스는 판타지 장르에 최적화되어 있으며, 다른 장르도 순차적으로 최적화할 예정입니다.';
  await expect(dialog.getByText(genreOptimizationNotice, { exact: true })).toBeVisible();
  for (const genre of ['판타지', '로맨스', '추리', '코미디', 'SF', '스포츠', '호러', '무협', '일상', '기타']) {
    await expect(dialog.getByRole('radio', { name: genre })).toBeVisible();
  }
  await dialog.getByRole('button', { name: '작품 만들기' }).click();
  await expect(dialog.getByText('작품 제목을 입력해 주세요.', { exact: true })).toBeVisible();
  await expect(dialog.getByText('작품 장르를 선택해 주세요.', { exact: true })).toBeVisible();

  await dialog.getByLabel('작품 제목 *').fill('검은 달의 기사');
  const descriptionInput = dialog.getByLabel('작품 설명 (선택)');
  await descriptionInput.fill('가'.repeat(51));
  const fantasyGenre = dialog.getByRole('radio', { name: '판타지' });
  const romanceGenre = dialog.getByRole('radio', { name: '로맨스' });
  await fantasyGenre.click();
  await dialog.getByRole('button', { name: '작품 만들기' }).click();
  await expect(dialog.getByText('작품 설명은 50자 이하로 입력해 주세요.', { exact: true })).toBeVisible();
  expect(createAttempts).toBe(0);
  await descriptionInput.fill('달빛 아래 시작된 모험');
  await expect(fantasyGenre).toHaveAttribute('aria-checked', 'true');
  await romanceGenre.click();
  await expect(fantasyGenre).toHaveAttribute('aria-checked', 'false');
  await expect(romanceGenre).toHaveAttribute('aria-checked', 'true');
  await fantasyGenre.click();
  await dialog.getByRole('button', { name: '작품 만들기' }).click();

  await expect(dialog.getByText('작품 제목을 다시 확인해 주세요.', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('작품 제목 *')).toHaveValue('검은 달의 기사');
  await expect(descriptionInput).toHaveValue('달빛 아래 시작된 모험');
  await expect(fantasyGenre).toHaveAttribute('aria-checked', 'true');

  await dialog.getByRole('button', { name: '작품 만들기' }).click();
  await expect(page).toHaveURL(/\/dashboard\?workId=created-work&nav=manuscripts$/);
  expect(createAttempts).toBe(2);
  expect(createPayload).toMatchObject({
    title: '검은 달의 기사',
    description: '달빛 아래 시작된 모험',
    genre: '판타지',
  });

  await page.goBack();
  await expect(page).toHaveURL(/\/works$/);
  await expect(page.getByRole('dialog', { name: '새 작품 등록' })).not.toBeVisible();
});

test('작품 카드는 hover 액션으로 정보를 수정하고 확인 후 영구 삭제한다', async ({ page }) => {
  let works = [{
    id: 'managed-work',
    title: '변경 전 작품',
    genre: '판타지',
    description: '기존 작품 설명',
    latestEpisodeNo: 4,
  }];
  let updatePayload: Record<string, unknown> | null = null;

  await page.route('**/api/v1/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        id: 1,
        email: 'manage@example.com',
        displayName: '작품 관리 테스트',
        phoneNumber: '01012345678',
        phoneVerified: false,
        role: 'AUTHOR',
        status: 'ACTIVE',
      },
      error: null,
    }),
  }));
  await page.route('**/api/v1/works/managed-work', async route => {
    if (route.request().method() === 'PATCH') {
      updatePayload = route.request().postDataJSON() as Record<string, unknown>;
      works = [{
        ...works[0],
        title: String(updatePayload.title),
        description: String(updatePayload.description),
        genre: String(updatePayload.genre),
      }];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: works[0], error: null }),
      });
    }
    if (route.request().method() === 'DELETE') {
      works = [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: null, error: null }),
      });
    }
    return route.fallback();
  });
  await page.route('**/api/v1/works', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: works, error: null }),
  }));

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'manage-token'));
  await page.goto('/works');

  const originalCard = page.getByRole('button', { name: '변경 전 작품 작품 선택' });
  await originalCard.hover();
  await expect(page.getByRole('button', { name: '변경 전 작품 수정' })).toBeVisible();
  await expect(page.getByRole('button', { name: '변경 전 작품 삭제' })).toBeVisible();
  await page.getByRole('button', { name: '변경 전 작품 수정' }).click();

  await expect(page).toHaveURL(/\/works\?modal=work-edit&targetWorkId=managed-work$/);
  const editDialog = page.getByRole('dialog', { name: '작품 정보 수정' });
  await expect(editDialog.getByText(
    '* 현재 서비스는 판타지 장르에 최적화되어 있으며, 다른 장르도 순차적으로 최적화할 예정입니다.',
    { exact: true },
  )).toHaveCount(0);
  await editDialog.getByLabel('작품 제목 *').fill('변경된 작품');
  await expect(editDialog.getByLabel('작품 설명 (선택)')).toHaveValue('기존 작품 설명');
  await editDialog.getByLabel('작품 설명 (선택)').fill('변경된 한 줄 소개');
  await editDialog.getByRole('radio', { name: '로맨스' }).click();
  await editDialog.getByRole('button', { name: '저장', exact: true }).click();

  await expect(page).toHaveURL(/\/works$/);
  await expect(page.getByRole('button', { name: '변경된 작품 작품 선택' })).toBeVisible();
  await expect(page.getByText('변경된 한 줄 소개', { exact: true })).toBeVisible();
  expect(updatePayload).toMatchObject({
    title: '변경된 작품',
    genre: '로맨스',
    description: '변경된 한 줄 소개',
  });

  const updatedCard = page.getByRole('button', { name: '변경된 작품 작품 선택' });
  await updatedCard.hover();
  await page.getByRole('button', { name: '변경된 작품 삭제' }).click();

  const firstDeleteDialog = page.getByRole('dialog', { name: '작품을 삭제하시겠습니까?' });
  await expect(firstDeleteDialog.getByText('변경된 작품', { exact: true })).toBeVisible();
  await expect(firstDeleteDialog.getByText(/보관이 아닌 영구 삭제/)).toBeVisible();
  await firstDeleteDialog.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('button', { name: '변경된 작품 작품 선택' })).toBeVisible();

  await updatedCard.hover();
  await page.getByRole('button', { name: '변경된 작품 삭제' }).click();
  await page.getByRole('dialog', { name: '작품을 삭제하시겠습니까?' })
    .getByRole('button', { name: '영구 삭제' })
    .click();

  await expect(page).toHaveURL(/\/works$/);
  await expect(page.getByText('등록된 작품이 없습니다', { exact: true })).toBeVisible();
});

test('작품 목록 조회 오류는 화면 안에서 재시도해 복구한다', async ({ page }) => {
  let listAttempts = 0;
  await page.route('**/api/v1/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        id: 1,
        email: 'retry-works@example.com',
        displayName: '목록 재시도',
        phoneNumber: '01012345678',
        phoneVerified: false,
        role: 'AUTHOR',
        status: 'ACTIVE',
      },
      error: null,
    }),
  }));
  await page.route('**/api/v1/works', route => {
    listAttempts += 1;
    if (listAttempts <= 2) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: '일시적인 오류입니다.',
          data: null,
          error: { code: 'SERVICE_UNAVAILABLE', status: 503, details: [] },
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{ id: 'recovered-work', title: '복구된 작품', genre: '무협', latestEpisodeNo: 3 }],
        error: null,
      }),
    });
  });
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'retry-works-token'));
  await page.goto('/works');

  await expect(page.getByText('작품 목록을 불러오지 못했습니다.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '다시 시도' }).click();

  await expect(page.getByText('복구된 작품', { exact: true })).toBeVisible();
});
