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
          id: 'work-new',
          title: '새 작품',
          description: '처음 시작하는 판타지',
          genre: '판타지',
          latestEpisodeNo: 0,
        },
        {
          id: 'work-old',
          title: '연재 작품',
          description: null,
          genre: '로맨스',
          latestEpisodeNo: 12,
        },
      ],
      error: null,
    }),
  }));
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'works-token'));

  await page.goto('/works');

  await expect(page.getByText('등록된 회차 없음', { exact: true })).toBeVisible();
  await expect(page.getByText('마지막 회차 12화', { exact: true })).toBeVisible();
  await expect(page.getByText('처음 시작하는 판타지', { exact: true })).toBeVisible();
  await expect(page.getByText('작품 소개가 없습니다.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '새 작품 작품 선택' }).click();

  await expect(page).toHaveURL(/\/dashboard\?workId=work-new&nav=manuscripts$/);
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
