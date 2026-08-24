import { test, expect, type Locator, type Page } from '@playwright/test';

const TEST_WORK_ID = '00000000-0000-4000-8000-000000000001';

async function expectReadableDialogText(locator: Locator, expectedColor: string) {
  await expect(locator).toHaveCSS('color', expectedColor);
  const contrast = await locator.evaluate(element => {
    const channels = (color: string) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const luminance = (color: string) => {
      const rgb = channels(color).map(channel => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    };
    const foreground = luminance(getComputedStyle(element).color);
    const dialog = element.closest('[role="dialog"]');
    if (!dialog) return 0;
    const background = luminance(getComputedStyle(dialog).backgroundColor);
    return (Math.max(foreground, background) + 0.05)
      / (Math.min(foreground, background) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
}

async function mockCurrentLegalDocuments(page: Page) {
  await page.route('**/api/v1/legal-documents/current*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        termsOfService: {
          id: 31,
          documentType: 'TERMS_OF_SERVICE',
          locale: 'ko-KR',
          documentVersion: '2026-08-24',
          title: 'CatchHole 이용약관',
          contentMarkdown: '# CatchHole 이용약관\n\n현재 게시된 이용약관입니다.',
          contentHash: 'a'.repeat(64),
          status: 'PUBLISHED',
          effectiveDate: '2026-08-24',
          publishedAt: '2026-08-24T18:00:00',
        },
        privacyPolicy: {
          id: 32,
          documentType: 'PRIVACY_POLICY',
          locale: 'ko-KR',
          documentVersion: '2026-08-24',
          title: 'CatchHole 개인정보처리방침',
          contentMarkdown: '# CatchHole 개인정보처리방침\n\n현재 게시된 개인정보처리방침입니다.',
          contentHash: 'b'.repeat(64),
          status: 'PUBLISHED',
          effectiveDate: '2026-08-24',
          publishedAt: '2026-08-24T18:00:00',
        },
      },
      error: null,
    }),
  }));
}

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

  await page.goto(`/dashboard?workId=${TEST_WORK_ID}`);

  await expect(page.getByText('설정 대시보드', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^캐릭터 타임라인/ })).toHaveCount(0);

  const sidebarLabels = ['원고 목록', '작품 설정', '분석 목록', '분석 리포트', '그래프 뷰', '챗봇'];
  for (const label of sidebarLabels) {
    await expect(page.getByRole('button', { name: new RegExp(`^${label}`) })).toBeVisible();
  }
  await expect(page.getByText(/이번 달 14\/20회/)).toHaveCount(0);

  await page.getByRole('button', { name: /^캐릭터/ }).click();
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^분석 리포트/ }).click();
  await expect(page.getByText('분석 리포트 기능은 업데이트 예정입니다.', { exact: true })).toBeVisible();
  await expect(page.getByText('설정 대시보드', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^관계도/ }).click();
  await expect(page.getByText('관계도 기능은 업데이트 예정입니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^원고 목록/ }).click();
  await page.getByRole('button', { name: /^작품 설정/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe('characters');
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
});

test('남은 사용량과 한도 소진 안내를 공통 API 오류에서 표시한다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/quota-test')) {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: '기본 AI 토큰을 모두 사용했습니다.',
          error: { code: 'AI_TOKEN_QUOTA_EXHAUSTED', status: 409, details: [] },
        }),
      });
    }

    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'quota@example.com',
          displayName: '한도 테스트',
          phoneNumber: '01012345678',
          phoneVerified: false,
          role: 'AUTHOR',
          status: 'ACTIVE',
        }
      : pathname.endsWith('/ai-token-usages/me')
        ? {
            grantedTokens: 1000,
            usedTokens: 900,
            reservedTokens: 0,
            remainingTokens: 100,
            remainingPercent: 10,
            exhausted: false,
            contactEmail: 'feedback@catchhole.com',
          }
        : [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'quota-token'));
  await page.goto(`/dashboard?workId=${TEST_WORK_ID}`);

  await expect(page.getByText('남은 사용량', { exact: true })).toBeVisible();
  await expect(page.getByText('10.0%', { exact: true })).toBeVisible();

  await page.evaluate(async () => {
    const modulePath = '/src/app/lib/auth-fetch.ts';
    const { fetchWithAuth } = await import(modulePath);
    await fetchWithAuth('/api/v1/quota-test', {
      headers: { Authorization: 'Bearer quota-token' },
    });
  });

  await expect(page.getByRole('dialog', { name: '기본 사용량을 모두 소진했습니다' })).toBeVisible();
  const contactLink = page.getByRole('link', { name: 'feedback@catchhole.com' });
  await expect(contactLink).toBeVisible();
  await expect(contactLink).toHaveCSS('color', 'rgb(0, 98, 196)');
  await expect(contactLink).toHaveCSS('text-decoration-line', 'underline');
});

test('실제 모드에서 작품 ID 없이 직접 진입하면 캐릭터 요청 없이 작품 목록으로 돌아간다', async ({ page }) => {
  let characterRequestCount = 0;
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.includes('/characters')) characterRequestCount += 1;
    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'work-required@example.com',
          displayName: '작품 선택 테스트',
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
  await page.evaluate(() => localStorage.setItem('accessToken', 'work-required-token'));

  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/works$/);
  expect(characterRequestCount).toBe(0);

  await page.goto('/dashboard?workId=detective');

  await expect(page).toHaveURL(/\/works$/);
  expect(characterRequestCount).toBe(0);
});

test('MVP에서 제외한 이전 목 화면 경로는 작품 선택으로 돌아간다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'mvp-routes@example.com',
          displayName: 'MVP 경로 테스트',
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
  await page.evaluate(() => localStorage.setItem('accessToken', 'mvp-routes-token'));

  for (const path of ['/chat', '/loading', '/report', '/episode-validation-report']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/works$/);
  }
});

test('단일 회차는 추천 번호를 입력하지 않고 파일 교체 때 새 감지 결과로 갱신한다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const detectionMultipartBodies: string[] = [];

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === 'POST' && pathname.endsWith('/episodes/detect')) {
      const detectionIndex = detectionMultipartBodies.length;
      detectionMultipartBodies.push(request.postData() ?? '');
      const detectedEpisodeNo = detectionIndex === 0 ? 20 : 21;
      const detectedTitle = detectionIndex === 0 ? '첫 번째 감지 제목' : '교체 파일 감지 제목';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            uploadType: 'SINGLE_EPISODE',
            episodeCount: 1,
            totalCharCount: 12,
            detectedEpisodes: [{
              detectionOrder: 0,
              sourceFileIndex: 0,
              episodeNo: detectedEpisodeNo,
              title: detectedTitle,
              sourceHeading: null,
              charCount: 12,
              content: '자동 감지할 본문입니다.',
            }],
          },
          error: null,
        }),
      });
    }

    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'single-detection@example.com',
          displayName: '단일 감지 테스트',
          phoneNumber: '01012345678',
          phoneVerified: false,
          role: 'AUTHOR',
          status: 'ACTIVE',
        }
      : pathname.endsWith(`/${workId}/episodes`)
        ? [{ id: '44444444-4444-4444-8444-444444444444', episodeNo: 12 }]
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '테스트 작품', genre: '판타지', latestEpisodeNo: 12 }
          : [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'single-detection-token'));
  await page.goto(`/episode-upload?workId=${workId}`);

  await page.getByText('단일 회차 업로드', { exact: true }).click();
  await expect(page.getByRole('button', { name: '신규 회차 검수 업데이트 예정' })).toBeDisabled();
  await expect(page.getByText('기존 설정 구축', { exact: true })).toBeVisible();

  const episodeNoInput = page.getByPlaceholder('비우면 파일에서 감지');
  const episodeTitleInput = page.getByPlaceholder('비우면 원문 제목 행에서 감지');
  await expect(episodeNoInput).toHaveValue('');
  await expect(episodeTitleInput).toHaveValue('');
  await expect(page.getByText('추천 다음 회차: 13화', { exact: true })).toBeVisible();

  await episodeTitleInput.fill('직접 입력한 제목');
  await episodeTitleInput.fill('');
  const episodeFileInput = page.locator('input[type="file"]').first();
  await episodeFileInput.setInputFiles({
    name: '20화.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('제 20화 첫 번째 감지 제목\n자동 감지할 본문입니다.'),
  });

  await expect(episodeNoInput).toHaveValue('20');
  await expect(episodeTitleInput).toHaveValue('첫 번째 감지 제목');
  expect(detectionMultipartBodies[0]).toContain('"singleEpisodeNo":null');
  expect(detectionMultipartBodies[0]).toContain('"singleEpisodeTitle":null');

  await episodeFileInput.setInputFiles({
    name: '21화.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('제 21화 교체 파일 감지 제목\n교체한 파일의 본문입니다.'),
  });

  await expect(episodeNoInput).toHaveValue('21');
  await expect(episodeTitleInput).toHaveValue('교체 파일 감지 제목');
  expect(detectionMultipartBodies[1]).toContain('"singleEpisodeNo":null');
  expect(detectionMultipartBodies[1]).toContain('"singleEpisodeTitle":null');
});

test('다회차 단일 파일에서 한 회차만 감지되면 파일을 제거하고 모드 변경 시 오류를 초기화한다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const detectionErrorMessage = '다회차 업로드에는 정상 감지된 회차가 2개 이상 필요합니다.';

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === 'POST' && pathname.endsWith('/episodes/detect')) {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: '다회차 업로드에는 두 개 이상의 회차가 필요합니다.',
          data: null,
          error: {
            code: 'UPLOAD_EPISODE_COUNT_INVALID',
            status: 400,
            details: [],
          },
        }),
      });
    }

    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'bulk-detection-error@example.com',
          displayName: '다회차 감지 오류 테스트',
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
  await page.evaluate(() => localStorage.setItem('accessToken', 'bulk-detection-error-token'));
  await page.goto(`/episode-upload?workId=${workId}`);

  await page.getByText('다회차 - 단일 파일', { exact: true }).click();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'single-episode.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('제 21화 한 회차뿐인 원고\n본문입니다.'),
  });

  await expect(page.getByText(detectionErrorMessage, { exact: true })).toBeVisible();
  await expect(page.getByText(/single-episode\.txt/)).not.toBeVisible();
  await expect(page.getByRole('button', { name: '다음 — 회차 분리 확인' })).toBeDisabled();

  await page.getByText('다회차 - 여러 파일', { exact: true }).click();
  await expect(page.getByText(detectionErrorMessage, { exact: true })).not.toBeVisible();

  await page.getByText('다회차 - 단일 파일', { exact: true }).click();
  await expect(page.getByText(detectionErrorMessage, { exact: true })).not.toBeVisible();
  await expect(page.getByText(/single-episode\.txt/)).not.toBeVisible();
});

test('업로드 방식을 전환해도 각 방식의 파일과 감지 결과를 함께 보존한다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  let detectionRequestCount = 0;
  const detectionResponses = [
    {
      uploadType: 'SINGLE_EPISODE',
      episodes: [{ episodeNo: 51, title: '단일 제목', sourceFileIndex: 0 }],
    },
    {
      uploadType: 'MULTI_EPISODE_SINGLE_FILE',
      episodes: [
        { episodeNo: 52, title: '합본 첫 제목', sourceFileIndex: 0 },
        { episodeNo: 53, title: '합본 둘째 제목', sourceFileIndex: 0 },
      ],
    },
    {
      uploadType: 'MULTI_EPISODE_MULTI_FILE',
      episodes: [
        { episodeNo: 54, title: '여러 파일 첫 제목', sourceFileIndex: 0 },
        { episodeNo: 55, title: '여러 파일 둘째 제목', sourceFileIndex: 1 },
      ],
    },
  ];

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === 'POST' && pathname.endsWith('/episodes/detect')) {
      const detection = detectionResponses[detectionRequestCount];
      detectionRequestCount += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            uploadType: detection.uploadType,
            episodeCount: detection.episodes.length,
            totalCharCount: detection.episodes.length * 8,
            detectedEpisodes: detection.episodes.map((episode, detectionOrder) => ({
              detectionOrder,
              sourceFileIndex: episode.sourceFileIndex,
              episodeNo: episode.episodeNo,
              title: episode.title,
              sourceHeading: `제 ${episode.episodeNo}화 ${episode.title}`,
              charCount: 8,
              content: `${episode.episodeNo}화 본문입니다.`,
            })),
          },
          error: null,
        }),
      });
    }

    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'mode-state@example.com',
          displayName: '모드 상태 테스트',
          phoneNumber: '01012345678',
          phoneVerified: false,
          role: 'AUTHOR',
          status: 'ACTIVE',
        }
      : pathname.endsWith(`/${workId}/episodes`)
        ? []
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '테스트 작품', genre: '판타지', latestEpisodeNo: 50 }
          : [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'mode-state-token'));
  await page.goto(`/episode-upload?workId=${workId}`);

  await page.getByText('단일 회차 업로드', { exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: '51화.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('제 51화 단일 제목\n본문'),
  });
  await expect(page.getByPlaceholder('비우면 파일에서 감지')).toHaveValue('51');
  await page.getByPlaceholder('비우면 원문 제목 행에서 감지').fill('수정한 단일 제목');

  await page.getByText('다회차 - 단일 파일', { exact: true }).click();
  await page.getByText('단일 회차 업로드', { exact: true }).click();
  await expect(page.getByText(/51화\.txt/)).toBeVisible();
  await expect(page.getByPlaceholder('비우면 파일에서 감지')).toHaveValue('51');
  await expect(page.getByPlaceholder('비우면 원문 제목 행에서 감지')).toHaveValue('수정한 단일 제목');

  await page.getByText('다회차 - 단일 파일', { exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: '52-53화.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('제 52화 합본 첫 제목\n본문\n제 53화 합본 둘째 제목\n본문'),
  });
  await expect(page.getByText('2개 회차 감지됨', { exact: true })).toBeVisible();

  await page.getByText('다회차 - 여러 파일', { exact: true }).click();
  await page.getByText('다회차 - 단일 파일', { exact: true }).click();
  await expect(page.getByText(/52-53화\.txt/)).toBeVisible();
  await expect(page.getByText('2개 회차 감지됨', { exact: true })).toBeVisible();

  await page.getByText('다회차 - 여러 파일', { exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: '54화.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('제 54화 여러 파일 첫 제목\n본문'),
    },
    {
      name: '55화.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('제 55화 여러 파일 둘째 제목\n본문'),
    },
  ]);
  await expect(page.getByText('2개 파일 선택됨', { exact: true })).toBeVisible();
  await page.getByRole('textbox').first().fill('수정한 여러 파일 제목');

  await page.getByText('단일 회차 업로드', { exact: true }).click();
  await page.getByText('다회차 - 여러 파일', { exact: true }).click();
  await expect(page.getByText('2개 파일 선택됨', { exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton').nth(0)).toHaveValue('54');
  await expect(page.getByRole('spinbutton').nth(1)).toHaveValue('55');
  await expect(page.getByRole('textbox').first()).toHaveValue('수정한 여러 파일 제목');
});

test('다회차 업로드에 기존 회차가 포함되면 두 방식 모두 중복 번호를 안내한다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  let detectionRequestCount = 0;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === 'POST' && pathname.endsWith('/episodes/detect')) {
      const multiFileDetection = detectionRequestCount > 0;
      detectionRequestCount += 1;
      const episodeNos = multiFileDetection ? [20, 21] : [19, 20, 21];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            uploadType: multiFileDetection
              ? 'MULTI_EPISODE_MULTI_FILE'
              : 'MULTI_EPISODE_SINGLE_FILE',
            episodeCount: episodeNos.length,
            totalCharCount: episodeNos.length * 8,
            detectedEpisodes: episodeNos.map((episodeNo, detectionOrder) => ({
              detectionOrder,
              sourceFileIndex: multiFileDetection ? detectionOrder : 0,
              episodeNo,
              title: `${episodeNo}화 제목`,
              sourceHeading: `제 ${episodeNo}화 ${episodeNo}화 제목`,
              charCount: 8,
              content: `${episodeNo}화 본문입니다.`,
            })),
          },
          error: null,
        }),
      });
    }

    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'bulk-duplicate@example.com',
          displayName: '다회차 중복 테스트',
          phoneNumber: '01012345678',
          phoneVerified: false,
          role: 'AUTHOR',
          status: 'ACTIVE',
        }
      : pathname.endsWith(`/${workId}/episodes`)
        ? [{ id: '44444444-4444-4444-8444-444444444444', episodeNo: 20 }]
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '테스트 작품', genre: '판타지', latestEpisodeNo: 20 }
          : [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'bulk-duplicate-token'));
  await page.goto(`/episode-upload?workId=${workId}`);

  await page.getByText('다회차 - 단일 파일', { exact: true }).click();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: '19-21화.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('제 19화\n본문\n제 20화\n본문\n제 21화\n본문'),
  });

  await expect(page.getByText('3개 회차 감지됨', { exact: true })).toBeVisible();
  await expect(page.getByText(
    '이미 등록된 회차 번호가 포함되어 있습니다: 20화.',
    { exact: true },
  )).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 — 회차 분리 확인' })).toBeDisabled();

  await page.getByText('다회차 - 여러 파일', { exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: '20화.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('제 20화\n본문'),
    },
    {
      name: '21화.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('제 21화\n본문'),
    },
  ]);

  await expect(page.getByText(
    '이미 등록된 회차 번호가 포함되어 있습니다: 20화.',
    { exact: true },
  )).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 — 분석 시작' })).toBeDisabled();
});

test('회차 감지 수정값을 metadata의 episodeConfirmations로 업로드한다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const batchId = '22222222-2222-4222-8222-222222222222';
  const analysisJobId = '33333333-3333-4333-8333-333333333333';
  const secondAnalysisJobId = '66666666-6666-4666-8666-666666666666';
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
                sourceHeading: '제 1화 첫 제목',
                charCount: 8,
                content: '첫 번째 본문입니다.',
              },
              {
                detectionOrder: 1,
                sourceFileIndex: 0,
                episodeNo: 2,
                title: '둘째 제목',
                sourceHeading: '제 2화 둘째 제목',
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
          data: [
            {
              id: analysisJobId,
              episodeId: '44444444-4444-4444-8444-444444444444',
              jobType: 'SETTING_EXTRACTION',
              status: 'PENDING',
            },
            {
              id: secondAnalysisJobId,
              episodeId: '55555555-5555-4555-8555-555555555555',
              jobType: 'SETTING_EXTRACTION',
              status: 'PENDING',
            },
          ],
          error: null,
        }),
      });
    }

    if (
      request.method() === 'GET'
      && (
        pathname.endsWith(`/analysis-jobs/${analysisJobId}`)
        || pathname.endsWith(`/analysis-jobs/${secondAnalysisJobId}`)
      )
    ) {
      const firstJob = pathname.endsWith(`/analysis-jobs/${analysisJobId}`);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: firstJob ? analysisJobId : secondAnalysisJobId,
            workId,
            workTitle: '테스트 작품',
            jobType: 'SETTING_EXTRACTION',
            status: 'PENDING',
            episodes: [{
              id: firstJob
                ? '44444444-4444-4444-8444-444444444444'
                : '55555555-5555-4555-8555-555555555555',
              episodeNo: firstJob ? 10 : 11,
              title: firstJob ? '첫 제목' : '둘째 제목',
              status: 'UPLOADED',
            }],
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
  await expect(page.getByLabel('AI 원고 처리 안내')).toHaveCount(0);
  expect(detectionMultipartBody).toContain('name="metadata"');
  expect(detectionMultipartBody).not.toContain('name="data"');
  expect(detectionMultipartBody).toContain('"uploadType":"MULTI_EPISODE_SINGLE_FILE"');

  await page.getByRole('button', { name: '다음 — 회차 분리 확인' }).click();
  await expect(page.getByText('제 1화 첫 제목', { exact: true })).toBeVisible();
  await page.locator('input[type="number"]').fill('10');
  await expect(page.getByText('제 1화 첫 제목', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /2화 둘째 제목/ }).click();
  await expect(page.getByText('제 2화 둘째 제목', { exact: true })).toBeVisible();
  await page.locator('input[type="number"]').fill('11');
  await expect(page.getByText('제 2화 둘째 제목', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /회차 분리 확정 \(2개\)/ }).click();

  await expect.poll(() => uploadMultipartBody).not.toBe('');
  expect(uploadMultipartBody).toContain('name="metadata"');
  expect(uploadMultipartBody).toContain('"episodeConfirmations"');
  expect(uploadMultipartBody).toContain('"detectionOrder":0');
  expect(uploadMultipartBody).toContain('"episodeNo":10');
  expect(uploadMultipartBody).toContain('"detectionOrder":1');
  expect(uploadMultipartBody).toContain('"episodeNo":11');
  expect(uploadMultipartBody).not.toContain('policyVersion');
  expect(uploadMultipartBody).not.toContain('requiredProcessingConsent');
  expect(uploadMultipartBody).not.toContain('"episodes"');
  await expect.poll(() => new URL(page.url()).searchParams.get('analysisJobIds'))
    .toBe(`${analysisJobId},${secondAnalysisJobId}`);
  await expect.poll(() => new URL(page.url()).searchParams.get('currentAnalysisJobIds'))
    .toBe(`${analysisJobId},${secondAnalysisJobId}`);
  await expect(page).toHaveURL(/jobType=SETTING_EXTRACTION/);

  await page.getByRole('button', { name: '분석 목록으로', exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/dashboard\\?workId=${workId}&nav=analyses$`),
  );
});

test('신규 회차 검수 완료 후 현재 업로드 묶음의 설정 후보 검토로 이동한다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const batchId = '22222222-2222-4222-8222-222222222222';
  const analysisJobId = '33333333-3333-4333-8333-333333333333';

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'validation-complete@example.com',
          displayName: '신규 회차 검수 테스트',
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
            jobType: 'EPISODE_VALIDATION',
            status: 'SUCCEEDED',
            episodes: [{
              id: '44444444-4444-4444-8444-444444444444',
              episodeNo: 1,
              title: '첫 회차',
              status: 'ANALYZED',
            }],
          }
        : pathname.endsWith(`/works/${workId}/setting-candidates`)
          ? {
              batchId,
              episodeStartNo: 1,
              episodeEndNo: 1,
              episodeCount: 1,
              totalCandidateCount: 0,
              reviewedCandidateCount: 0,
              pendingCandidateCount: 0,
              matchRequiredCandidateCount: 0,
              candidates: {
                content: [],
                page: 0,
                size: 20,
                totalElements: 0,
                totalPages: 0,
                hasNext: false,
              },
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
    + '&jobType=EPISODE_VALIDATION',
  );

  await page.getByRole('button', { name: '설정 후보 검토' }).click();

  await expect(page).toHaveURL(/\/setting-review\?/);
  await expect.poll(() => new URL(page.url()).searchParams.get('workId')).toBe(workId);
  await expect.poll(() => new URL(page.url()).searchParams.get('batchId')).toBe(batchId);
  await expect.poll(() => new URL(page.url()).searchParams.get('jobType')).toBe('EPISODE_VALIDATION');
  await expect(page.getByText('검토할 설정 후보가 없습니다.')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    window.history.state?.usr?.returnToAnalysisList
  ))).toBe(`/dashboard?workId=${workId}&nav=analyses`);

  await page.getByRole('button', { name: '이전 화면' }).click();
  await expect(page).toHaveURL(
    new RegExp(`/dashboard\\?workId=${workId}&nav=analyses$`),
  );
});

test('분석 중에는 기존 작업 진행 화면만 다시 열고 파일 변경·삭제·중복 요청을 막는다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const episodeId = '44444444-4444-4444-8444-444444444444';
  const secondEpisodeId = '55555555-5555-4555-8555-555555555555';
  const batchId = '22222222-2222-4222-8222-222222222222';
  const analysisJobId = '33333333-3333-4333-8333-333333333333';
  const secondAnalysisJobId = '66666666-6666-4666-8666-666666666666';
  let analysisCreateRequestCount = 0;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'POST' && pathname.endsWith(`/${workId}/analysis-jobs`)) {
      analysisCreateRequestCount += 1;
    }
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
      : pathname.endsWith(`/${workId}/analysis-jobs/batches`)
        ? {
            content: [{
              batchId,
              status: 'IN_PROGRESS',
              episodeStartNo: 1,
              episodeEndNo: 2,
              episodeCount: 2,
              totalCandidateCount: 0,
              reviewedCandidateCount: 0,
              pendingCandidateCount: 0,
              jobGroups: [{
                jobType: 'EPISODE_VALIDATION',
                status: 'IN_PROGRESS',
                totalJobCount: 2,
                pendingJobCount: 0,
                runningJobCount: 2,
                succeededJobCount: 0,
                failedJobCount: 0,
                currentAnalysisJobIds: [analysisJobId, secondAnalysisJobId],
              }],
              lastActivityAt: '2026-07-23T12:00:00',
            }],
            page: 0,
            size: 10,
            totalElements: 1,
            totalPages: 1,
            hasNext: false,
          }
      : pathname.endsWith(`/${workId}/analysis-jobs/${analysisJobId}`)
        ? {
            id: analysisJobId,
            workId,
            workTitle: '현재 작품',
            batchId,
            jobType: 'EPISODE_VALIDATION',
            status: 'RUNNING',
            episodes: [{
              id: episodeId,
              episodeNo: 1,
              title: '분석 중 회차',
              status: 'ANALYZING',
            }],
          }
      : pathname.endsWith(`/${workId}/analysis-jobs/${secondAnalysisJobId}`)
        ? {
            id: secondAnalysisJobId,
            workId,
            workTitle: '현재 작품',
            batchId,
            jobType: 'EPISODE_VALIDATION',
            status: 'RUNNING',
            episodes: [{
              id: secondEpisodeId,
              episodeNo: 2,
              title: '함께 분석 중인 회차',
              status: 'ANALYZING',
            }],
          }
      : pathname.endsWith(`/${workId}/episodes`)
        ? [
            {
              id: episodeId,
              batchId,
              episodeNo: 1,
              title: '분석 중 회차',
              originalFilename: 'episode-1.txt',
              contentUpdatedAt: '2026-07-23T12:00:00',
              charCount: 100,
              analysisStatus: 'IN_PROGRESS',
              latestAnalysisJobId: analysisJobId,
              unresolvedFindingCount: null,
            },
            {
              id: secondEpisodeId,
              batchId,
              episodeNo: 2,
              title: '함께 분석 중인 회차',
              originalFilename: 'episode-2.txt',
              contentUpdatedAt: '2026-07-23T12:00:00',
              charCount: 120,
              analysisStatus: 'IN_PROGRESS',
              latestAnalysisJobId: secondAnalysisJobId,
              unresolvedFindingCount: null,
            },
          ]
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '현재 작품', genre: '판타지' }
          : pathname.endsWith('/works')
            ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 2 }]
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
  await expect(page.getByRole('button', { name: '파일 변경' }).first()).toBeDisabled();
  await expect(page.getByRole('button', { name: '삭제' }).first()).toBeDisabled();

  await titleButton.click();
  await expect(page.getByRole('textbox')).toHaveValue('분석 중 회차');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '분석 목록으로', exact: true }).click();
  const progressButton = page.getByRole('button', { name: '진행 보기' }).first();
  await expect(progressButton).toBeEnabled();
  await progressButton.click();

  await expect(page).toHaveURL(new RegExp(`/episode-upload\\?workId=${workId}`));
  await expect(page).toHaveURL(new RegExp(`batchId=${batchId}`));
  await expect.poll(() => new URL(page.url()).searchParams.get('analysisJobIds'))
    .toBe(`${analysisJobId},${secondAnalysisJobId}`);
  await expect(page.getByText('회차를 분석하고 있습니다')).toBeVisible();
  await expect(page.locator('.episode-upload-spinner svg')).toHaveCSS('color', 'rgb(8, 126, 242)');
  expect(analysisCreateRequestCount).toBe(0);
});

test('회차 삭제는 확인 모달에서 취소하고 실패 후 다시 시도할 수 있다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const episodeId = '44444444-4444-4444-8444-444444444444';
  let deleteRequestCount = 0;
  let nativeDialogCount = 0;
  let episodes = [{
    id: episodeId,
    episodeNo: 20,
    title: '파일 교체 후 제목',
    originalFilename: '20화_파일_교체_후.docx',
    contentUpdatedAt: '2026-07-27T12:00:00',
    charCount: 4200,
    analysisStatus: 'REANALYSIS_REQUIRED',
    unresolvedFindingCount: null,
  }];

  page.on('dialog', async dialog => {
    nativeDialogCount += 1;
    await dialog.dismiss();
  });

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === 'DELETE' && pathname.endsWith(`/${workId}/episodes/${episodeId}`)) {
      deleteRequestCount += 1;
      if (deleteRequestCount === 1) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            data: null,
            error: {
              code: 'EPISODE_DELETE_FAILED',
              message: '회차를 삭제하지 못했습니다.',
              details: [],
            },
          }),
        });
      }

      episodes = [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: null, error: null }),
      });
    }

    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'episode-delete@example.com',
          displayName: '회차 삭제 테스트',
          phoneNumber: '01012345678',
          phoneVerified: false,
          role: 'AUTHOR',
          status: 'ACTIVE',
        }
      : pathname.endsWith(`/${workId}/episodes`)
        ? episodes
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '현재 작품', genre: '판타지' }
          : pathname.endsWith('/works')
            ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: episodes.length }]
            : [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'episode-delete-token'));
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);

  await page.getByRole('button', { name: '삭제', exact: true }).click();
  let modal = page.getByRole('dialog', { name: '20화를 삭제할까요?' });
  await expect(modal).toBeVisible();
  await expect(modal).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(modal).toHaveCSS('border-radius', '20px');
  await expect(modal.getByText('20화 · 파일 교체 후 제목')).toBeVisible();
  await expect(modal.getByText('20화_파일_교체_후.docx')).toBeVisible();
  await expect(modal.getByText(/원고 청크와 미확정 분석 후보가 영구 삭제됩니다/)).toBeVisible();
  await expectReadableDialogText(
    modal.locator('.episode-delete-permanent-warning'),
    'rgb(138, 75, 0)',
  );
  await expect(modal.getByText(/원문 근거는 더 이상 볼 수 없습니다/)).toBeVisible();
  const confirmationPhrase = modal.locator('.episode-delete-confirmation-phrase');
  await expectReadableDialogText(confirmationPhrase, 'rgb(25, 30, 38)');
  await expect(modal.getByRole('button', { name: '영구 삭제' })).toBeDisabled();
  expect(nativeDialogCount).toBe(0);

  await modal.getByRole('button', { name: '취소' }).click();
  await expect(modal).not.toBeVisible();
  expect(deleteRequestCount).toBe(0);

  await page.getByRole('button', { name: '삭제', exact: true }).click();
  modal = page.getByRole('dialog', { name: '20화를 삭제할까요?' });
  await modal.getByLabel('회차 영구 삭제 확인 문구').fill('영구 삭제');
  await modal.getByRole('button', { name: '영구 삭제', exact: true }).click();

  await expect.poll(() => deleteRequestCount).toBe(1);
  await expect(modal.getByRole('alert')).toHaveText(
    '영구 삭제를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
  );
  await expect(page.getByRole('button', { name: '파일 교체 후 제목' })).toBeVisible();

  await modal.getByRole('button', { name: '영구 삭제 다시 시도' }).click();

  await expect.poll(() => deleteRequestCount).toBe(2);
  await expect(modal).not.toBeVisible();
  await expect(page.getByRole('button', { name: '파일 교체 후 제목' })).not.toBeVisible();
});

test('재분석 요청 중에는 분석 버튼을 비활성화하고 이탈 후 늦은 응답으로 이동하지 않는다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const episodeId = '44444444-4444-4444-8444-444444444444';
  const batchId = '22222222-2222-4222-8222-222222222222';
  const analysisJobId = '33333333-3333-4333-8333-333333333333';
  let analysisRequestCount = 0;
  let analysisRequestBody: Record<string, unknown> | null = null;
  let releaseAnalysisRequest!: () => void;
  const analysisResponseGate = new Promise<void>(resolve => {
    releaseAnalysisRequest = resolve;
  });

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === 'POST' && pathname.endsWith(`/${workId}/analysis-jobs`)) {
      analysisRequestCount += 1;
      analysisRequestBody = request.postDataJSON() as Record<string, unknown>;
      await analysisResponseGate;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{ id: analysisJobId }],
          error: null,
        }),
      });
    }

    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'episode-reanalysis@example.com',
          displayName: '재분석 중복 테스트',
          phoneNumber: '01012345678',
          phoneVerified: false,
          role: 'AUTHOR',
          status: 'ACTIVE',
        }
      : pathname.endsWith(`/${workId}/episodes`)
        ? [{
            id: episodeId,
            batchId,
            episodeNo: 1,
            title: '재분석 대상 회차',
            originalFilename: 'episode-1.txt',
            contentUpdatedAt: '2026-07-23T12:00:00',
            charCount: 100,
            analysisStatus: 'REANALYSIS_REQUIRED',
            unresolvedFindingCount: null,
          }, {
            id: '55555555-5555-4555-8555-555555555555',
            batchId: '66666666-6666-4666-8666-666666666666',
            episodeNo: 2,
            title: '후속 분석 회차',
            originalFilename: 'episode-2.txt',
            contentUpdatedAt: '2026-07-24T12:00:00',
            charCount: 120,
            analysisStatus: 'COMPLETED',
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
  await page.evaluate(() => localStorage.setItem('accessToken', 'episode-reanalysis-token'));
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);

  const reanalysisButton = page.getByRole('button', { name: '재분석', exact: true });
  await reanalysisButton.click();

  const reanalysisDialog = page.getByRole('dialog', { name: '이 회차를 다시 분석할까요?' });
  await expect(reanalysisDialog).toBeVisible();
  await expect(reanalysisDialog.getByText(/중복되거나 시간 순서가 맞지 않는 후보/)).toBeVisible();
  await expect(reanalysisDialog.locator('.episode-reanalysis-warning')).toHaveCSS('color', 'rgb(138, 75, 0)');
  await expectReadableDialogText(
    reanalysisDialog.getByRole('button', { name: '취소' }),
    'rgb(25, 30, 38)',
  );
  await expect(reanalysisDialog.getByText(/후속 회차가/)).toContainText('1개');
  await expect(reanalysisDialog.getByLabel('AI 원고 처리 안내')).toHaveCount(0);
  const confirmReanalysis = reanalysisDialog.getByRole('button', { name: '재분석 시작' });
  await confirmReanalysis.click();

  await expect.poll(() => analysisRequestCount).toBe(1);
  await expect.poll(() => analysisRequestBody).toEqual({
    jobType: 'SETTING_EXTRACTION',
    batchId,
    episodeId,
  });
  const pendingReanalysis = reanalysisDialog.getByRole('button', { name: '재분석 요청 중...' });
  await expect(pendingReanalysis).toBeDisabled();
  await pendingReanalysis.evaluate(button => (button as HTMLButtonElement).click());

  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('analyses');
  releaseAnalysisRequest();
  await page.waitForTimeout(500);
  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');
  await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('analyses');
  expect(analysisRequestCount).toBe(1);
});

test('기존 설정 구축 결과 보기는 설정 후보 검토로 바로 이동한다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const episodeId = '44444444-4444-4444-8444-444444444444';
  const batchId = '22222222-2222-4222-8222-222222222222';
  const analysisJobId = '33333333-3333-4333-8333-333333333333';

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'setting-result@example.com',
          displayName: '설정 결과 테스트',
          phoneNumber: '01012345678',
          phoneVerified: false,
          role: 'AUTHOR',
          status: 'ACTIVE',
        }
      : pathname.endsWith(`/${workId}/analysis-jobs/batches`)
        ? {
            content: [{
              batchId,
              status: 'REVIEW_REQUIRED',
              episodeStartNo: 3,
              episodeEndNo: 3,
              episodeCount: 1,
              totalCandidateCount: 1,
              reviewedCandidateCount: 0,
              pendingCandidateCount: 1,
              jobGroups: [{
                jobType: 'SETTING_EXTRACTION',
                status: 'COMPLETED',
                totalJobCount: 1,
                pendingJobCount: 0,
                runningJobCount: 0,
                succeededJobCount: 1,
                failedJobCount: 0,
                currentAnalysisJobIds: [analysisJobId],
              }],
              lastActivityAt: '2026-07-29T12:00:00',
            }],
            page: 0,
            size: 10,
            totalElements: 1,
            totalPages: 1,
            hasNext: false,
          }
      : pathname.endsWith(`/${workId}/analysis-jobs/${analysisJobId}`)
        ? {
            id: analysisJobId,
            workId,
            workTitle: '현재 작품',
            batchId,
            jobType: 'SETTING_EXTRACTION',
            status: 'SUCCEEDED',
            episodes: [{
              id: episodeId,
              episodeNo: 3,
              title: '설정 구축 회차',
              status: 'ANALYZED',
            }],
          }
        : pathname.endsWith(`/${workId}/setting-candidates`)
          ? {
              batchId,
              episodeStartNo: 3,
              episodeEndNo: 3,
              episodeCount: 1,
              totalCandidateCount: 0,
              reviewedCandidateCount: 0,
              pendingCandidateCount: 0,
              matchRequiredCandidateCount: 0,
              candidates: {
                content: [],
                page: 0,
                size: 20,
                totalElements: 0,
                totalPages: 0,
                hasNext: false,
              },
            }
          : pathname.endsWith(`/${workId}/episodes`)
            ? [{
                id: episodeId,
                batchId,
                episodeNo: 3,
                title: '설정 구축 회차',
                originalFilename: 'episode-3.txt',
                contentUpdatedAt: '2026-07-29T12:00:00',
                charCount: 100,
                status: 'ANALYZED',
                analysisStatus: 'COMPLETED',
                latestAnalysisJobId: analysisJobId,
                unresolvedFindingCount: 0,
              }]
            : pathname.endsWith(`/works/${workId}`)
              ? { id: workId, title: '현재 작품', genre: '판타지' }
              : pathname.endsWith('/works')
                ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 3 }]
                : [];

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'setting-result-token'));
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);

  await page.getByRole('button', { name: '결과 보기' }).click();
  await expect(page).toHaveURL(/\/setting-review\?/);
  await expect.poll(() => new URL(page.url()).searchParams.get('batchId')).toBe(batchId);
  await expect.poll(() => new URL(page.url()).searchParams.get('jobType')).toBe('SETTING_EXTRACTION');
  await expect(page.getByText('검토할 설정 후보가 없습니다.')).toBeVisible();
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
  await expect(page.locator('.original-reader-page')).toHaveCSS('background-color', 'rgb(245, 247, 251)');
  await expect(article).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(article).toHaveCSS('border-radius', '20px');
  await expect(page.locator('.original-reader-notice')).toHaveCSS('background-color', 'rgb(238, 247, 255)');
  await expect(page.locator('.original-line__body').first()).toHaveCSS('color', 'rgb(51, 58, 70)');
  await expect(article).toContainText('2026. 7. 20.');
  await expect(article).not.toContainText('2026. 7. 23.');
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

  await page.goto(`/dashboard?workId=${TEST_WORK_ID}`);

  await expect(page.getByText('인증 정보를 확인하지 못했습니다.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/dashboard\\?workId=${TEST_WORK_ID}$`));
  await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toBe('valid-token');

  await page.getByRole('button', { name: '다시 시도', exact: true }).click();

  await expect(page.getByText('설정 대시보드', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toBe('valid-token');
});

test('Auth 모달은 닫기·배경·Esc·뒤로가기로 랜딩에 복귀한다', async ({ page }) => {
  await page.goto('/landing');

  await page.getByRole('button', { name: '로그인', exact: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  const themedLoginDialog = page.getByRole('dialog', { name: '로그인' });
  await expect(themedLoginDialog).toBeVisible();
  await expect(themedLoginDialog).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(themedLoginDialog).toHaveCSS('border-radius', '24px');
  await expect(themedLoginDialog.locator('.auth-modal-brand')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
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
  await mockCurrentLegalDocuments(page);
  await page.goto('/landing');
  await page.getByRole('button', { name: '로그인', exact: true }).first().click();

  await page.getByRole('dialog', { name: '로그인' })
    .getByRole('button', { name: '회원가입', exact: true })
    .click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole('dialog', { name: '회원가입' })).toHaveCSS('background-color', 'rgb(255, 255, 255)');

  await page.getByRole('dialog', { name: '회원가입' })
    .getByRole('button', { name: '이용약관', exact: true })
    .click();
  await expect(page).toHaveURL(/\/signup\?terms=terms$/);
  const legalDialog = page.getByRole('dialog', { name: '법적 고지' });
  await expect(legalDialog).toBeVisible();
  await expect(legalDialog.getByText('문서 버전 2026-08-24')).toBeVisible();
  await expect(legalDialog.getByText('2026년 8월 24일 시행')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole('dialog', { name: '회원가입' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/landing$/);
});

test('약관 딥링크를 닫으면 Auth 딥링크를 유지한다', async ({ page }) => {
  await mockCurrentLegalDocuments(page);
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

test('작품 선택 화면에서 로그아웃하면 랜딩으로 이동한다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? {
          id: 1,
          email: 'logout@example.com',
          displayName: '로그아웃 테스트',
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
  await page.evaluate(() => localStorage.setItem('accessToken', 'logout-token'));
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
  await expect.poll(() => page
    .evaluate(() => localStorage.getItem('accessToken'))
    .catch(() => 'navigation-in-progress'))
    .toBeNull();
});

test('캐릭터 현재 설정을 조회·수정하고 삭제한 캐릭터를 보관함에서 복구한다', async ({ page }) => {
  const workId = TEST_WORK_ID;
  let characterName = '수아';
  let roleLabel = '주인공';
  let archived = false;
  let restoreAttempt = 0;
  let updateAttempt = 0;
  let updateBody: Record<string, unknown> | undefined;
  let detailRequestCount = 0;
  const evidenceRequestCounts: Record<string, number> = {};
  let failCharacterListRefetch = false;
  let releaseUpdate!: () => void;
  const updateGate = new Promise<void>(resolve => {
    releaseUpdate = resolve;
  });
  const characterAuthorizationHeaders: string[] = [];
  const characterRequestPaths: string[] = [];
  const evidencePrelude = Array.from(
    { length: 24 },
    (_, index) => `연무장 기록 ${index + 1}번째 줄에는 오래된 훈련 내용이 적혀 있었다.`,
  ).join('\n\n');
  const evidenceEpilogue = Array.from(
    { length: 24 },
    (_, index) => `후속 기록 ${index + 1}번째 줄에는 새로운 훈련 계획이 적혀 있었다.`,
  ).join('\n\n');
  const evidenceSource = `⚔️ 수아는 왕립 검술학교의 연무장에 홀로 남아 있었다.

${evidencePrelude}

스물세 살이 된 수아는 기본 검술을 다시 점검했다.
교관은 수아가 현재 15레벨에 도달했다고 기록했다.

수아는 훈련용 검을 들어 올리고 마력 감지에 집중했다.

${evidenceEpilogue}`;

  const detailResponse = () => ({
    id: 'char-1',
    name: characterName,
    roleLabel,
    currentAge: 23,
    currentAgeFact: {
      characterFactId: 'fact-age-1',
      hasEvidence: true,
    },
    currentLevel: 15,
    currentLevelFact: {
      characterFactId: 'fact-level-1',
      hasEvidence: true,
    },
    firstAppearanceEpisode: null,
    profile: [{
      characterFactId: 'fact-profile-2',
      key: 'profile.occupation',
      displayName: '직업',
      value: '검사 지망생',
      valueType: 'STRING',
      properties: [],
      hasEvidence: true,
      sourceFacts: [
        {
          characterFactId: 'fact-profile-1',
          sourceEpisodeId: 'episode-1',
          sourceEpisodeNo: 1,
          hasEvidence: true,
        },
        {
          characterFactId: 'fact-profile-2',
          sourceEpisodeId: 'episode-2',
          sourceEpisodeNo: 2,
          hasEvidence: true,
        },
        {
          characterFactId: 'fact-profile-3',
          sourceEpisodeId: 'episode-2',
          sourceEpisodeNo: 2,
          hasEvidence: true,
        },
        {
          characterFactId: 'fact-profile-manual',
          sourceEpisodeId: null,
          sourceEpisodeNo: null,
          hasEvidence: false,
        },
        {
          characterFactId: 'fact-profile-manual-2',
          sourceEpisodeId: null,
          sourceEpisodeNo: null,
          hasEvidence: false,
        },
      ],
      attributeNameEditable: false,
      attributeNamePrefix: null,
      displayNameEditable: false,
    }],
    stats: [
      {
        characterFactId: 'fact-stat-2',
        key: 'stats.agility',
        displayName: '민첩',
        value: '58',
        valueType: 'NUMBER',
        properties: [],
        hasEvidence: true,
      },
      {
        characterFactId: 'fact-stat-manual-old',
        key: 'stats.manual_1700000000000_old',
        displayName: '먼저 추가한 스탯',
        value: '11',
        valueType: 'NUMBER',
        properties: [
          { key: 'name', displayName: '이름', value: '먼저 추가한 스탯', valueType: 'STRING' },
        ],
        hasEvidence: false,
        attributeNameEditable: false,
        attributeNamePrefix: null,
        displayNameEditable: true,
      },
      {
        characterFactId: 'fact-stat-manual-new',
        key: 'stats.manual_1800000000000_new',
        displayName: '나중에 추가한 스탯',
        value: '22',
        valueType: 'NUMBER',
        properties: [
          { key: 'name', displayName: '이름', value: '나중에 추가한 스탯', valueType: 'STRING' },
        ],
        hasEvidence: false,
        attributeNameEditable: false,
        attributeNamePrefix: null,
        displayNameEditable: true,
      },
      {
        characterFactId: 'fact-stat-1',
        key: 'stats.strength',
        displayName: '근력',
        value: '42',
        valueType: 'NUMBER',
        properties: [],
        hasEvidence: false,
      },
    ],
    skills: [{
      characterFactId: 'fact-skill-1',
      key: 'skill.생존_감각',
      displayName: '생존 감각',
      value: 'Lv.6',
      valueType: 'JSON',
      properties: [
        { key: 'name', displayName: '이름', value: '생존 감각', valueType: 'STRING' },
        { key: 'level', displayName: '레벨', value: '6', valueType: 'NUMBER' },
      ],
      hasEvidence: false,
      attributeNameEditable: true,
      attributeNamePrefix: 'skill.',
      displayNameEditable: true,
    }],
    items: [{
      characterFactId: 'fact-item-1',
      key: 'item.치유_물약',
      displayName: '치유 물약',
      value: '1개',
      valueType: 'JSON',
      properties: [
        { key: 'name', displayName: '이름', value: '치유 물약', valueType: 'STRING' },
        { key: 'quantity', displayName: '수량', value: '1', valueType: 'NUMBER' },
      ],
      hasEvidence: false,
      attributeNameEditable: true,
      attributeNamePrefix: 'item.',
      displayNameEditable: true,
    }],
    statuses: [
      {
        characterFactId: 'fact-status-1',
        key: 'status.경상',
        displayName: '경상',
        value: '활성',
        valueType: 'JSON',
        properties: [
          { key: 'name', displayName: '이름', value: '경상', valueType: 'STRING' },
          { key: 'severity', displayName: '심각도', value: '낮음', valueType: 'STRING' },
        ],
        hasEvidence: false,
        attributeNameEditable: true,
        attributeNamePrefix: 'status.',
        displayNameEditable: true,
      },
      {
        // 합성된 현재 snapshot은 단일 대표 Fact ID가 없어도 이미 저장된 설정이다.
        key: 'status.recovering',
        displayName: '회복 중',
        value: '활성',
        valueType: 'JSON',
        properties: [
          { key: 'description', displayName: '설명', value: '간헐적 의식 소실', valueType: 'STRING' },
        ],
        hasEvidence: false,
        attributeNameEditable: true,
        attributeNamePrefix: 'status.',
        displayNameEditable: true,
      },
      {
        characterFactId: 'fact-status-3',
        key: 'status.잠복',
        displayName: '잠복',
        value: '관찰 중',
        valueType: 'JSON',
        properties: [],
        hasEvidence: false,
        attributeNameEditable: true,
        attributeNamePrefix: 'status.',
        displayNameEditable: true,
      },
    ],
  });

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();
    if (pathname.includes('/characters')) characterRequestPaths.push(pathname);

    if (pathname.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 1,
            email: 'character@example.com',
            displayName: '캐릭터 테스트',
            phoneNumber: '01012345678',
            phoneVerified: false,
            role: 'AUTHOR',
            status: 'ACTIVE',
          },
          error: null,
        }),
      });
    }

    if (pathname.endsWith(`/works/${workId}/characters`) && method === 'GET') {
      characterAuthorizationHeaders.push(request.headers().authorization ?? '');
      if (failCharacterListRefetch) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: '캐릭터 목록 재조회에 실패했습니다.',
            data: null,
            error: { code: 'INTERNAL_SERVER_ERROR', status: 503, details: [] },
          }),
        });
      }
      const content = archived ? [] : [{
        id: 'char-1',
        name: characterName,
        currentAge: 23,
        representativeAttributeLabel: '레벨',
        representativeAttributeValue: '15',
        firstAppearanceEpisodeNo: null,
      }];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            content,
            page: 0,
            size: 24,
            totalElements: content.length,
            totalPages: content.length === 0 ? 0 : 1,
            hasNext: false,
          },
          error: null,
        }),
      });
    }

    if (pathname.endsWith(`/works/${workId}/characters/archived`) && method === 'GET') {
      const content = archived ? [{
        id: 'char-1',
        name: characterName,
        currentAge: 23,
        representativeAttributeLabel: '레벨',
        representativeAttributeValue: '15',
        firstAppearanceEpisodeNo: null,
      }] : [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            content,
            page: 0,
            size: 9,
            totalElements: content.length,
            totalPages: content.length === 0 ? 0 : 1,
            hasNext: false,
          },
          error: null,
        }),
      });
    }

    if (pathname.endsWith(`/works/${workId}/characters/char-1`) && method === 'GET') {
      characterAuthorizationHeaders.push(request.headers().authorization ?? '');
      detailRequestCount += 1;
      if (archived) {
        return route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: '캐릭터 정보를 찾을 수 없습니다.',
            data: null,
            error: { code: 'CHARACTER_NOT_FOUND', status: 404, details: [] },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: detailResponse(), error: null }),
      });
    }

    const evidenceMatch = pathname.match(new RegExp(
      `/works/${workId}/character-facts/(fact-(?:age|level)-1)/evidence$`,
    ));
    if (evidenceMatch && method === 'GET') {
      const factId = evidenceMatch[1];
      evidenceRequestCounts[factId] = (evidenceRequestCounts[factId] ?? 0) + 1;
      const quote = factId === 'fact-age-1'
        ? '스물세 살이 된 수아는 기본 검술을 다시 점검했다.'
        : '교관은 수아가 현재 15레벨에 도달했다고 기록했다.';
      const quoteCodeUnitOffset = evidenceSource.indexOf(quote);
      const startOffset = Array.from(evidenceSource.slice(0, quoteCodeUnitOffset)).length;
      const endOffset = startOffset + Array.from(quote).length;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            characterFactId: factId,
            sourceCandidateId: `candidate-${factId}`,
            episode: {
              episodeId: 'episode-1',
              episodeNo: 1,
              title: '입학식',
            },
            content: evidenceSource,
            evidenceSpans: [{
              quote,
              startOffset,
              endOffset,
            }],
          },
          error: null,
        }),
      });
    }

    const profileEvidenceMatch = pathname.match(new RegExp(
      `/works/${workId}/character-facts/(fact-profile-[123])/evidence$`,
    ));
    if (profileEvidenceMatch && method === 'GET') {
      const factId = profileEvidenceMatch[1];
      evidenceRequestCounts[factId] = (evidenceRequestCounts[factId] ?? 0) + 1;
      const firstSource = factId === 'fact-profile-1';
      const quote = firstSource
        ? '수아는 왕립 검술학교의 연무장에 홀로 남아 있었다.'
        : '수아는 훈련용 검을 들어 올리고 마력 감지에 집중했다.';
      const quoteCodeUnitOffset = evidenceSource.indexOf(quote);
      const startOffset = Array.from(evidenceSource.slice(0, quoteCodeUnitOffset)).length;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            characterFactId: factId,
            sourceCandidateId: `candidate-${factId}`,
            episode: {
              episodeId: firstSource ? 'episode-1' : 'episode-2',
              episodeNo: firstSource ? 1 : 2,
              title: firstSource ? '입학식' : '연무장 훈련',
            },
            content: evidenceSource,
            evidenceSpans: [{
              quote,
              startOffset,
              endOffset: startOffset + Array.from(quote).length,
            }],
          },
          error: null,
        }),
      });
    }

    if (pathname.endsWith(`/works/${workId}/characters/char-1/restore`) && method === 'PATCH') {
      characterAuthorizationHeaders.push(request.headers().authorization ?? '');
      if (restoreAttempt++ === 0) {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: '같은 이름의 캐릭터가 이미 존재합니다.',
            data: null,
            error: { code: 'CHARACTER_NAME_DUPLICATED', status: 409, details: [] },
          }),
        });
      }
      archived = false;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'char-1', status: 'ACTIVE' },
          error: null,
        }),
      });
    }

    if (pathname.endsWith(`/works/${workId}/characters/char-1`) && method === 'PATCH') {
      characterAuthorizationHeaders.push(request.headers().authorization ?? '');
      updateBody = request.postDataJSON() as Record<string, unknown>;
      if (updateAttempt++ === 0) {
        await updateGate;
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: '캐릭터 설정을 저장하지 못했습니다.',
            data: null,
            error: { code: 'INTERNAL_SERVER_ERROR', status: 500, details: [] },
          }),
        });
      }
      characterName = String(updateBody.name);
      roleLabel = String(updateBody.roleLabel);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: detailResponse(), error: null }),
      });
    }

    if (pathname.endsWith(`/works/${workId}/characters/char-1`) && method === 'DELETE') {
      characterAuthorizationHeaders.push(request.headers().authorization ?? '');
      archived = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'char-1', status: 'ARCHIVED' },
          error: null,
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [], error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'character-token'));
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=characters`);

  const characterCard = page.getByRole('button', { name: /수아/ });
  await expect(characterCard).toContainText('첫 등장');
  await expect(characterCard).toContainText('—');

  failCharacterListRefetch = true;
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
  });
  const listRefetchAlert = page.getByRole('alert').filter({ hasText: '캐릭터 목록 재조회에 실패했습니다.' });
  await expect(listRefetchAlert).toBeVisible();
  await expect(characterCard).toBeVisible();
  failCharacterListRefetch = false;
  await listRefetchAlert.getByRole('button', { name: '다시 시도' }).click();
  await expect(listRefetchAlert).toHaveCount(0);

  await characterCard.click();
  await expect(page.locator('.character-detail-header__name')).toHaveCSS('color', 'rgb(25, 30, 38)');
  await expect(page.locator('.character-detail-header .character-avatar')).toHaveCount(0);
  await expect(page.getByText('기본 정보', { exact: true })).toBeVisible();
  await expect(page.getByText('검사 지망생', { exact: true })).toBeVisible();
  await expect(page.getByText('생존 감각', { exact: true })).toBeVisible();
  await expect(page.getByText('Lv.6', { exact: true })).toBeVisible();
  await expect(page.getByText('치유 물약', { exact: true })).toBeVisible();
  await expect(page.getByText('1개', { exact: true })).toBeVisible();
  await expect(page.getByText('경상', { exact: true })).toBeVisible();
  await expect(page.getByText('회복 중', { exact: true })).toBeVisible();
  await expect(page.getByText('잠복', { exact: true })).toBeVisible();
  await expect(page.getByText('관찰 중', { exact: true })).toBeVisible();
  await expect(page.getByText('활성', { exact: true })).toHaveCount(2);
  await expect(page.getByText('레벨 6', { exact: true })).toHaveCount(0);
  await expect(page.getByText('수량 1', { exact: true })).toHaveCount(0);
  await expect(page.getByText('심각도 낮음', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '현재 나이 원문 근거 보기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '현재 레벨 원문 근거 보기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '직업 원문 근거 보기' })).toBeVisible();

  const strengthRow = page.getByText('근력', { exact: true }).locator('..');
  const agilityRow = page.getByText('민첩', { exact: true }).locator('..');
  const firstManualStatRow = page.getByText('먼저 추가한 스탯', { exact: true }).locator('..');
  const secondManualStatRow = page.getByText('나중에 추가한 스탯', { exact: true }).locator('..');
  const [strengthBox, agilityBox, firstManualStatBox, secondManualStatBox] = await Promise.all([
    strengthRow.boundingBox(),
    agilityRow.boundingBox(),
    firstManualStatRow.boundingBox(),
    secondManualStatRow.boundingBox(),
  ]);
  expect(strengthBox).not.toBeNull();
  expect(agilityBox).not.toBeNull();
  expect(firstManualStatBox).not.toBeNull();
  expect(secondManualStatBox).not.toBeNull();
  expect(Math.abs((strengthBox?.y ?? 0) - (agilityBox?.y ?? 0))).toBeLessThan(2);
  expect(strengthBox?.x ?? 0).toBeGreaterThan(agilityBox?.x ?? 0);
  expect(firstManualStatBox?.y ?? 0).toBeGreaterThan(strengthBox?.y ?? 0);
  expect(Math.abs((firstManualStatBox?.y ?? 0) - (secondManualStatBox?.y ?? 0))).toBeLessThan(2);
  expect(secondManualStatBox?.x ?? 0).toBeGreaterThan(firstManualStatBox?.x ?? 0);

  const statusPanel = page.getByTestId('character-status-settings');
  await expect(statusPanel).toHaveCSS('border-color', 'rgb(225, 229, 236)');
  const statusRow = page.getByText('경상', { exact: true }).locator('..');
  const recoveringStatusRow = page.getByText('회복 중', { exact: true }).locator('..');
  const dormantStatusRow = page.getByText('잠복', { exact: true }).locator('..');
  const [statusBox, recoveringStatusBox, dormantStatusBox] = await Promise.all([
    statusRow.boundingBox(),
    recoveringStatusRow.boundingBox(),
    dormantStatusRow.boundingBox(),
  ]);
  expect(statusBox).not.toBeNull();
  expect(recoveringStatusBox).not.toBeNull();
  expect(dormantStatusBox).not.toBeNull();
  expect(Math.abs((statusBox?.y ?? 0) - (recoveringStatusBox?.y ?? 0))).toBeLessThan(3);
  expect(recoveringStatusBox?.x ?? 0).toBeGreaterThan(statusBox?.x ?? 0);
  expect(dormantStatusBox?.y ?? 0).toBeGreaterThan(statusBox?.y ?? 0);
  expect(Math.abs((statusBox?.x ?? 0) - (dormantStatusBox?.x ?? 0))).toBeLessThan(2);
  await expect(statusRow).toHaveCSS('border-bottom-width', '1px');
  await expect(recoveringStatusRow).toHaveCSS('border-bottom-width', '1px');
  await expect(dormantStatusRow).toHaveCSS('border-bottom-width', '0px');

  expect(evidenceRequestCounts['fact-profile-1'] ?? 0).toBe(0);
  expect(evidenceRequestCounts['fact-profile-2'] ?? 0).toBe(0);
  expect(evidenceRequestCounts['fact-profile-3'] ?? 0).toBe(0);
  await page.getByRole('button', { name: '직업 원문 근거 보기' }).click();
  const synthesizedEvidencePanel = page.getByRole('region', { name: '캐릭터 설정 원문 근거' });
  await expect(synthesizedEvidencePanel.getByText('여러 근거를 종합해 만든 현재값입니다.')).toBeVisible();
  await expect(synthesizedEvidencePanel.getByText('프로필', { exact: true })).toBeVisible();
  await expect(synthesizedEvidencePanel.getByText('직업', { exact: true })).toBeVisible();
  await expect.poll(() => evidenceRequestCounts['fact-profile-1'] ?? 0).toBe(1);
  expect(evidenceRequestCounts['fact-profile-2'] ?? 0).toBe(0);
  await expect(synthesizedEvidencePanel.getByRole('button', { name: '2화 · 근거 1', exact: true })).toBeVisible();
  await expect(synthesizedEvidencePanel.getByRole('button', { name: '2화 · 근거 2', exact: true })).toBeVisible();
  await expect(synthesizedEvidencePanel.getByRole('button', { name: /회차 없는 근거 1/ })).toBeDisabled();
  await expect(synthesizedEvidencePanel.getByRole('button', { name: /회차 없는 근거 2/ })).toBeDisabled();

  const evidenceViewport = page.viewportSize();
  const evidenceModal = page.locator('.character-detail-modal--with-evidence');
  const evidenceColumn = evidenceModal.locator(':scope > .character-evidence-panel');
  const detailColumn = evidenceModal.locator(':scope > div').first();
  await page.setViewportSize({ width: 1041, height: 900 });
  await expect.poll(async () => {
    const [evidenceBox, detailBox] = await Promise.all([
      evidenceColumn.boundingBox(),
      detailColumn.boundingBox(),
    ]);
    return evidenceBox != null
      && detailBox != null
      && detailBox.y >= evidenceBox.y + evidenceBox.height - 1;
  }).toBe(true);
  await expect.poll(() => evidenceModal.evaluate(element => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  await page.setViewportSize({ width: 1042, height: 900 });
  await expect.poll(async () => {
    const [evidenceBox, detailBox] = await Promise.all([
      evidenceColumn.boundingBox(),
      detailColumn.boundingBox(),
    ]);
    return evidenceBox != null
      && detailBox != null
      && Math.abs(detailBox.y - evidenceBox.y) < 2
      && detailBox.x > evidenceBox.x;
  }).toBe(true);
  await expect.poll(() => evidenceModal.evaluate(element => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  if (evidenceViewport) await page.setViewportSize(evidenceViewport);

  await synthesizedEvidencePanel.getByRole('button', { name: '2화 · 근거 1', exact: true }).click();
  await expect.poll(() => evidenceRequestCounts['fact-profile-2'] ?? 0).toBe(1);
  await expect(page).toHaveURL(/factId=fact-profile-2/);
  await expect(page.getByTestId('character-evidence-highlight')).toHaveText(
    '수아는 훈련용 검을 들어 올리고 마력 감지에 집중했다.',
  );
  await synthesizedEvidencePanel.getByRole('button', { name: '2화 · 근거 2', exact: true }).click();
  await expect.poll(() => evidenceRequestCounts['fact-profile-3'] ?? 0).toBe(1);
  await expect(page).toHaveURL(/factId=fact-profile-3/);
  await synthesizedEvidencePanel.getByRole('button', { name: '원문 근거 닫기' }).click();

  await page.getByRole('button', { name: '현재 나이 원문 근거 보기' }).click();
  await expect(page).toHaveURL(/factId=fact-age-1/);
  await expect(page.getByRole('region', { name: '캐릭터 설정 원문 근거' })).toBeVisible();
  await expect(page.getByText('1화 · 입학식', { exact: true })).toBeVisible();
  await expect(page.getByTestId('character-evidence-source')).toContainText(evidenceSource);
  await expect(page.getByTestId('character-evidence-highlight')).toHaveText(
    '스물세 살이 된 수아는 기본 검술을 다시 점검했다.',
  );
  await expect.poll(async () => {
    const [bodyBox, highlightBox] = await Promise.all([
      page.locator('.character-evidence-panel__body').boundingBox(),
      page.getByTestId('character-evidence-highlight').boundingBox(),
    ]);
    if (!bodyBox || !highlightBox) return false;
    const bodyCenter = bodyBox.y + bodyBox.height / 2;
    const highlightCenter = highlightBox.y + highlightBox.height / 2;
    return Math.abs(bodyCenter - highlightCenter) < bodyBox.height / 4;
  }).toBe(true);
  await page.goBack();
  await expect(page.getByRole('region', { name: '캐릭터 설정 원문 근거' })).toHaveCount(0);
  await expect(page.getByText('기본 정보', { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId('character-evidence-highlight')).toHaveText(
    '스물세 살이 된 수아는 기본 검술을 다시 점검했다.',
  );
  await page.getByRole('button', { name: '현재 레벨 원문 근거 보기' }).click();
  await expect(page).toHaveURL(/factId=fact-level-1/);
  await expect(page.getByTestId('character-evidence-highlight')).toHaveText(
    '교관은 수아가 현재 15레벨에 도달했다고 기록했다.',
  );
  await page.getByRole('button', { name: '원문 근거 닫기' }).click();
  await expect(page).not.toHaveURL(/factId=/);
  await expect(page.getByRole('region', { name: '캐릭터 설정 원문 근거' })).toHaveCount(0);

  await page.getByRole('button', { name: '수정', exact: true }).click();
  const desktopViewport = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  const detailSections = page.getByTestId('character-detail-sections');
  await expect.poll(() => detailSections.evaluate(element => (
    element.scrollWidth <= element.clientWidth
  ))).toBe(true);
  const [profileSectionBox, settingSectionsBox, skillSectionBox, itemSectionBox] = await Promise.all([
    page.getByTestId('character-profile-section').boundingBox(),
    page.getByTestId('character-setting-sections').boundingBox(),
    page.getByTestId('character-skill-section').boundingBox(),
    page.getByTestId('character-item-section').boundingBox(),
  ]);
  expect(profileSectionBox).not.toBeNull();
  expect(settingSectionsBox).not.toBeNull();
  expect(skillSectionBox).not.toBeNull();
  expect(itemSectionBox).not.toBeNull();
  expect(settingSectionsBox?.y ?? 0).toBeGreaterThan(profileSectionBox?.y ?? 0);
  expect(itemSectionBox?.y ?? 0).toBeGreaterThan(skillSectionBox?.y ?? 0);
  if (desktopViewport) await page.setViewportSize(desktopViewport);

  const editPrefix = page.locator('.character-edit-setting-prefix').first();
  await expect(editPrefix).toHaveCSS('background-color', 'rgb(238, 247, 255)');
  await expect(editPrefix).toHaveCSS('color', 'rgb(8, 126, 242)');
  await expect(page.locator('.character-edit-setting-name input').first()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByLabel('생존 감각 값', { exact: true })).toHaveCSS('color', 'rgb(25, 30, 38)');

  const [editAgilityBox, editStrengthBox, editFirstManualStatBox, editSecondManualStatBox] = await Promise.all([
    page.getByLabel('민첩 값', { exact: true }).boundingBox(),
    page.getByLabel('근력 값', { exact: true }).boundingBox(),
    page.getByLabel('먼저 추가한 스탯 값', { exact: true }).boundingBox(),
    page.getByLabel('나중에 추가한 스탯 값', { exact: true }).boundingBox(),
  ]);
  expect(editAgilityBox).not.toBeNull();
  expect(editStrengthBox).not.toBeNull();
  expect(editFirstManualStatBox).not.toBeNull();
  expect(editSecondManualStatBox).not.toBeNull();
  expect(Math.abs((editAgilityBox?.y ?? 0) - (editStrengthBox?.y ?? 0))).toBeLessThan(2);
  expect(editStrengthBox?.x ?? 0).toBeGreaterThan(editAgilityBox?.x ?? 0);
  expect(editFirstManualStatBox?.y ?? 0).toBeGreaterThan(editStrengthBox?.y ?? 0);
  expect(Math.abs((editFirstManualStatBox?.y ?? 0) - (editSecondManualStatBox?.y ?? 0))).toBeLessThan(2);
  expect(editSecondManualStatBox?.x ?? 0).toBeGreaterThan(editFirstManualStatBox?.x ?? 0);
  await expect(page.getByLabel('생존 감각 레벨', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('치유 물약 수량', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('경상 심각도', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('프로필 이름', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '현재 나이 원문 근거 보기' }).click();
  await expect(page).toHaveURL(/factId=fact-age-1/);
  await expect(page.getByRole('region', { name: '캐릭터 설정 원문 근거' })).toBeVisible();
  const [evidenceEditSkillBox, evidenceEditItemBox] = await Promise.all([
    page.getByTestId('character-skill-section').boundingBox(),
    page.getByTestId('character-item-section').boundingBox(),
  ]);
  expect(evidenceEditSkillBox).not.toBeNull();
  expect(evidenceEditItemBox).not.toBeNull();
  expect(evidenceEditItemBox?.y ?? 0).toBeGreaterThan(evidenceEditSkillBox?.y ?? 0);
  expect(
    (evidenceEditItemBox?.y ?? 0)
      - ((evidenceEditSkillBox?.y ?? 0) + (evidenceEditSkillBox?.height ?? 0)),
  ).toBeLessThan(20);
  await page.getByLabel('이름', { exact: true }).fill('수아 이름만 수정');
  const detailRequestsBeforeRefetch = detailRequestCount;
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
  });
  await expect.poll(() => detailRequestCount).toBeGreaterThan(detailRequestsBeforeRefetch);
  await expect(page.getByLabel('이름', { exact: true })).toHaveValue('수아 이름만 수정');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const saveConfirm = page.getByText('수정 내용을 저장하시겠습니까?', { exact: true }).locator('..');
  const confirmSaveButton = saveConfirm.getByRole('button', { name: '저장', exact: true });
  await confirmSaveButton.click();
  await expect(confirmSaveButton).toBeDisabled();
  await page.getByTestId('character-modal-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(page.getByText('수정 내용을 저장하시겠습니까?', { exact: true })).toBeVisible();
  releaseUpdate();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('이름', { exact: true })).toHaveValue('수아 이름만 수정');
  await expect(page).toHaveURL(/factId=fact-age-1/);
  await expect(page.getByRole('region', { name: '캐릭터 설정 원문 근거' })).toBeVisible();

  await page.getByRole('button', { name: '저장', exact: true }).click();
  const retryConfirm = page.getByText('수정 내용을 저장하시겠습니까?', { exact: true }).locator('..');
  await retryConfirm.getByRole('button', { name: '저장', exact: true }).click();

  let saveFeedback = page.getByText('캐릭터 설정을 저장했습니다.', { exact: true });
  await expect(saveFeedback).toBeVisible();
  await expect(saveFeedback.locator('..')).toHaveCSS('position', 'fixed');
  await expect(page).not.toHaveURL(/factId=/);
  await expect(page.getByRole('region', { name: '캐릭터 설정 원문 근거' })).toHaveCount(0);
  await expect(page.getByText('수아 이름만 수정', { exact: true }).first()).toBeVisible();
  expect(updateBody).toMatchObject({
    name: '수아 이름만 수정',
    roleLabel: '주인공',
    statuses: expect.arrayContaining([
      {
        key: 'status.recovering',
        value: '활성',
        valueType: 'JSON',
        properties: [
          { key: 'description', value: '간헐적 의식 소실', valueType: 'STRING' },
        ],
      },
      {
        key: 'status.잠복',
        value: '관찰 중',
        valueType: 'JSON',
        properties: [],
      },
    ]),
  });

  await page.getByRole('button', { name: '알림 닫기' }).click();
  await page.getByRole('button', { name: '수정', exact: true }).click();
  let editableStatusName = page.getByLabel('상태 이름', { exact: true }).nth(1);
  await editableStatusName.fill('임시 상태');
  await editableStatusName.fill('회복 중');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const revertedSaveConfirm = page.getByText('수정 내용을 저장하시겠습니까?', { exact: true }).locator('..');
  await revertedSaveConfirm.getByRole('button', { name: '저장', exact: true }).click();
  saveFeedback = page.getByText('캐릭터 설정을 저장했습니다.', { exact: true });
  await expect(saveFeedback).toBeVisible();
  expect(updateBody).toMatchObject({
    statuses: expect.arrayContaining([
      {
        key: 'status.recovering',
        value: '활성',
        valueType: 'JSON',
        properties: [
          { key: 'description', value: '간헐적 의식 소실', valueType: 'STRING' },
        ],
      },
    ]),
  });

  await page.getByRole('button', { name: '알림 닫기' }).click();
  await page.getByRole('button', { name: '수정', exact: true }).click();
  editableStatusName = page.getByLabel('상태 이름', { exact: true }).nth(1);
  await editableStatusName.fill('');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  let invalidSaveConfirm = page.getByText('수정 내용을 저장하시겠습니까?', { exact: true }).locator('..');
  await invalidSaveConfirm.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('상태 설정명 뒷부분을 입력해 주세요.');

  await editableStatusName.fill('경상');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  invalidSaveConfirm = page.getByText('수정 내용을 저장하시겠습니까?', { exact: true }).locator('..');
  await invalidSaveConfirm.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('상태에 같은 설정명이 두 개 있습니다.');

  await editableStatusName.fill('안정');
  await page.getByLabel('생존 감각 값', { exact: true }).fill('Lv.7');
  await page.getByLabel('이름', { exact: true }).fill('수아 수정');
  await page.getByLabel('역할', { exact: true }).fill('핵심 주인공');
  await page.getByRole('button', { name: '프로필 추가', exact: true }).click();
  await page.getByLabel('프로필 이름', { exact: true }).fill('좌우명');
  await page.getByLabel('좌우명 값', { exact: true }).fill('끝까지 포기하지 않는다');
  await page.getByRole('button', { name: '스탯 추가', exact: true }).click();
  await page.getByLabel('스탯 이름', { exact: true }).last().fill('행운');
  await page.getByLabel('행운 값', { exact: true }).fill('7');
  await page.getByRole('button', { name: '상태 추가', exact: true }).click();
  await page.getByLabel('상태 이름', { exact: true }).last().fill('부상');
  await page.getByLabel('부상 값', { exact: true }).fill('경상');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const secondSaveConfirm = page.getByText('수정 내용을 저장하시겠습니까?', { exact: true }).locator('..');
  await secondSaveConfirm.getByRole('button', { name: '저장', exact: true }).click();

  saveFeedback = page.getByText('캐릭터 설정을 저장했습니다.', { exact: true });
  await expect(saveFeedback).toBeVisible();
  await expect(page.getByText('핵심 주인공', { exact: true }).first()).toBeVisible();
  expect(updateBody).toMatchObject({
    name: '수아 수정',
    roleLabel: '핵심 주인공',
    currentAge: 23,
    currentLevel: 15,
    firstAppearanceEpisodeNo: null,
    profile: expect.arrayContaining([
      { key: 'profile.occupation', value: '검사 지망생', valueType: 'STRING', properties: [] },
      expect.objectContaining({
        key: 'profile.좌우명',
        value: '끝까지 포기하지 않는다',
        valueType: 'STRING',
        properties: [{ key: 'name', value: '좌우명', valueType: 'STRING' }],
      }),
    ]),
    stats: expect.arrayContaining([
      { key: 'stats.strength', value: '42', valueType: 'NUMBER', properties: [] },
      { key: 'stats.agility', value: '58', valueType: 'NUMBER', properties: [] },
      expect.objectContaining({
        key: 'stats.행운',
        value: '7',
        valueType: 'NUMBER',
        properties: [{ key: 'name', value: '행운', valueType: 'STRING' }],
      }),
    ]),
    skills: [
      {
        key: 'skill.생존_감각',
        value: 'Lv.7',
        valueType: 'JSON',
        properties: [
          { key: 'name', value: '생존 감각', valueType: 'STRING' },
        ],
      },
    ],
    items: [
      {
        key: 'item.치유_물약',
        value: '1개',
        valueType: 'JSON',
        properties: [
          { key: 'name', value: '치유 물약', valueType: 'STRING' },
          { key: 'quantity', value: '1', valueType: 'NUMBER' },
        ],
      },
    ],
    statuses: expect.arrayContaining([
      {
        key: 'status.경상',
        value: '활성',
        valueType: 'JSON',
        properties: [
          { key: 'name', value: '경상', valueType: 'STRING' },
          { key: 'severity', value: '낮음', valueType: 'STRING' },
        ],
      },
      {
        key: 'status.안정',
        value: '활성',
        valueType: 'JSON',
        properties: [
          { key: 'name', value: '안정', valueType: 'STRING' },
        ],
      },
      {
        key: 'status.잠복',
        value: '관찰 중',
        valueType: 'JSON',
        properties: [],
      },
      expect.objectContaining({
        key: 'status.부상',
        value: '경상',
        valueType: 'JSON',
        properties: [{ key: 'name', value: '부상', valueType: 'STRING' }],
      }),
    ]),
  });

  await page.getByRole('button', { name: '삭제', exact: true }).click();
  const deleteConfirm = page.getByText('캐릭터를 삭제하시겠습니까?', { exact: true }).locator('..');
  await deleteConfirm.getByRole('button', { name: '삭제', exact: true }).click();

  await expect(page.getByText('캐릭터를 삭제했습니다. 보관함에서 복구할 수 있습니다.', { exact: true })).toBeVisible();
  await expect(page.getByText('등록된 캐릭터가 없습니다', { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/charId=char-1/);
  await expect(page.getByText('캐릭터 정보를 찾을 수 없습니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '수정', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '삭제', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '보관된 캐릭터', exact: true }).click();
  await expect(page).toHaveURL(/modal=character-archive/);
  const archiveDialog = page.getByRole('dialog', { name: '보관된 캐릭터' });
  await expect(archiveDialog.getByText('수아 수정', { exact: true })).toBeVisible();
  await expect(archiveDialog.locator('.character-avatar')).toHaveCount(0);
  await expect(archiveDialog.locator('.character-archive-item__name')).toHaveCSS('color', 'rgb(25, 30, 38)');
  await archiveDialog.getByRole('button', { name: '복구', exact: true }).click();
  await expect(archiveDialog.getByRole('alert')).toContainText('같은 이름의 캐릭터가 이미 존재합니다.');
  await expect(archiveDialog.getByText('수아 수정', { exact: true })).toBeVisible();
  await archiveDialog.getByRole('button', { name: '복구', exact: true }).click();
  await expect(page.getByText('캐릭터를 복구했습니다.', { exact: true })).toBeVisible();
  await expect(archiveDialog.getByText('보관된 캐릭터가 없습니다', { exact: true })).toBeVisible();
  await archiveDialog.getByRole('button', { name: '보관함 닫기' }).click();
  await expect(page.getByRole('button', { name: /수아 수정/ })).toBeVisible();
  expect(characterAuthorizationHeaders).not.toHaveLength(0);
  expect(characterAuthorizationHeaders.every(value => value === 'Bearer character-token')).toBe(true);
  expect(characterRequestPaths).not.toHaveLength(0);
  expect(characterRequestPaths.every(path => path.includes(`/works/${workId}/characters`))).toBe(true);

});

test('보관함은 9개씩 조회하고 로딩 중에도 다음 페이지를 유지한다', async ({ page }) => {
  const workId = TEST_WORK_ID;
  const archivedCharacters = Array.from({ length: 10 }, (_, index) => ({
    id: `archived-${index + 1}`,
    name: `보관 캐릭터 ${String(index + 1).padStart(2, '0')}`,
    currentAge: 20 + index,
    representativeAttributeLabel: '레벨',
    representativeAttributeValue: String(index + 1),
    firstAppearanceEpisodeNo: null,
  }));
  const archiveRequests: Array<{ page: number; size: number }> = [];

  await page.route('**/api/v1/**', async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 1,
            email: 'archive-pagination@example.com',
            displayName: '보관함 테스트',
            phoneNumber: '01012345678',
            phoneVerified: false,
            role: 'AUTHOR',
            status: 'ACTIVE',
          },
          error: null,
        }),
      });
    }

    if (requestUrl.pathname.endsWith(`/works/${workId}/characters/archived`)) {
      const requestedPage = Number(requestUrl.searchParams.get('page') ?? 0);
      const requestedSize = Number(requestUrl.searchParams.get('size') ?? 0);
      archiveRequests.push({ page: requestedPage, size: requestedSize });
      if (requestedPage === 1) {
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      const content = archivedCharacters.slice(
        requestedPage * requestedSize,
        (requestedPage + 1) * requestedSize,
      );
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            content,
            page: requestedPage,
            size: requestedSize,
            totalElements: archivedCharacters.length,
            totalPages: Math.ceil(archivedCharacters.length / requestedSize),
            hasNext: requestedPage < 1,
          },
          error: null,
        }),
      });
    }

    if (requestUrl.pathname.endsWith(`/works/${workId}/characters`)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            content: [],
            page: 0,
            size: 24,
            totalElements: 0,
            totalPages: 0,
            hasNext: false,
          },
          error: null,
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [], error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'archive-pagination-token'));
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=characters`);
  await page.getByRole('button', { name: '보관된 캐릭터', exact: true }).click();

  const archiveDialog = page.getByRole('dialog', { name: '보관된 캐릭터' });
  await expect(archiveDialog.getByText('보관 캐릭터 01', { exact: true })).toBeVisible();
  await expect(archiveDialog.getByRole('button', { name: '복구', exact: true })).toHaveCount(9);
  await expect(archiveDialog.getByText('1 / 2', { exact: true })).toBeVisible();
  await archiveDialog.getByRole('button', { name: '다음 페이지' }).click();

  await expect(archiveDialog.getByText('보관 캐릭터 10', { exact: true })).toBeVisible();
  await expect(archiveDialog.getByText('2 / 2', { exact: true })).toBeVisible();
  expect(archiveRequests).toContainEqual({ page: 0, size: 9 });
  expect(archiveRequests).toContainEqual({ page: 1, size: 9 });
});

test('캐릭터 목록은 화면 크기에 맞춰 서버 페이지 크기를 조정한다', async ({ page }) => {
  const workId = TEST_WORK_ID;
  const characters = Array.from({ length: 48 }, (_, index) => ({
    id: `character-${index + 1}`,
    name: `캐릭터 ${String(index + 1).padStart(2, '0')}`,
    currentAge: 20 + index,
    representativeAttributeLabel: '레벨',
    representativeAttributeValue: String(index + 1),
    firstAppearanceEpisodeNo: null,
  }));
  const requests: Array<{ page: number; size: number }> = [];

  await page.setViewportSize({ width: 1280, height: 850 });
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 1,
            email: 'pagination@example.com',
            displayName: '페이지 테스트',
            phoneNumber: '01012345678',
            phoneVerified: false,
            role: 'AUTHOR',
            status: 'ACTIVE',
          },
          error: null,
        }),
      });
    }

    if (url.pathname.endsWith(`/works/${workId}/characters`)) {
      const requestedPage = Number(url.searchParams.get('page') ?? 0);
      const requestedSize = Number(url.searchParams.get('size') ?? 24);
      requests.push({ page: requestedPage, size: requestedSize });
      const start = requestedPage * requestedSize;
      const content = characters.slice(start, start + requestedSize);
      const totalPages = Math.ceil(characters.length / requestedSize);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            content,
            page: requestedPage,
            size: requestedSize,
            totalElements: characters.length,
            totalPages,
            hasNext: requestedPage + 1 < totalPages,
          },
          error: null,
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [], error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'pagination-token'));
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=characters`);

  await expect.poll(() => requests.length).toBeGreaterThan(0);
  const laptopSize = requests.at(-1)?.size ?? 0;
  expect(laptopSize).toBeGreaterThan(0);
  expect(laptopSize).toBeLessThanOrEqual(24);
  await expect(page.getByRole('button', { name: '다음 페이지' })).toBeEnabled();

  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect.poll(() => requests.at(-1)?.page).toBe(1);
  await expect(page.getByRole('button', {
    name: `캐릭터 ${String(laptopSize + 1).padStart(2, '0')}`,
  })).toBeVisible();

  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect.poll(() => requests.at(-1)?.size).toBeGreaterThan(laptopSize);
  expect(requests.at(-1)?.size).toBeLessThanOrEqual(24);
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
  await page.route('**/api/v1/ai-token-usages/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        grantedTokens: 2_000_000,
        usedTokens: 0,
        reservedTokens: 0,
        remainingTokens: 2_000_000,
        remainingPercent: 100,
        exhausted: false,
        contactEmail: 'aicatchhole@gmail.com',
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
  await expect(dialog).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(dialog).toHaveCSS('border-radius', '20px');
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
    lifecycleStatus: 'ACTIVE',
  }];
  let updatePayload: Record<string, unknown> | null = null;
  let deletePayload: Record<string, unknown> | null = null;

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
      deletePayload = route.request().postDataJSON() as Record<string, unknown>;
      works = [{ ...works[0], lifecycleStatus: 'PURGING' }];
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            requestId: 'purge-request-1',
            workId: 'managed-work',
            status: 'REQUESTED',
            requestedAt: '2026-08-22T00:00:00Z',
            retryable: false,
          },
          error: null,
        }),
      });
    }
    return route.fallback();
  });
  await page.route('**/api/v1/works/managed-work/purge-request', route => {
    works = [];
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          requestId: 'purge-request-1',
          workId: 'managed-work',
          status: 'COMPLETED',
          requestedAt: '2026-08-22T00:00:00Z',
          completedAt: '2026-08-22T00:00:01Z',
          retryable: false,
          objectStorage: { targetCount: 3, deletedCount: 3, failedCount: 0 },
          database: { targetCount: 8, deletedCount: 8, failedCount: 0 },
        },
        error: null,
      }),
    });
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
  await expect(editDialog).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(editDialog).toHaveCSS('border-radius', '20px');
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

  const firstDeleteDialog = page.getByRole('dialog', { name: '작품을 영구 삭제할까요?' });
  await expect(firstDeleteDialog).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(firstDeleteDialog).toHaveCSS('border-radius', '20px');
  await expect(firstDeleteDialog.getByText('변경된 작품', { exact: true })).toBeVisible();
  await expect(firstDeleteDialog.getByText(/삭제한 자료는 복구할 수 없습니다/)).toBeVisible();
  await expectReadableDialogText(
    firstDeleteDialog.locator('.work-delete-confirmation-phrase'),
    'rgb(25, 30, 38)',
  );
  await expect(firstDeleteDialog.getByRole('button', { name: '영구 삭제 요청' })).toBeDisabled();
  await firstDeleteDialog.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('button', { name: '변경된 작품 작품 선택' })).toBeVisible();

  await updatedCard.hover();
  await page.getByRole('button', { name: '변경된 작품 삭제' }).click();
  const deleteDialog = page.getByRole('dialog', { name: '작품을 영구 삭제할까요?' });
  await deleteDialog.getByLabel('영구 삭제 확인 문구').fill('영구삭제');
  await expect(deleteDialog.getByRole('button', { name: '영구 삭제 요청' })).toBeDisabled();
  await deleteDialog.getByLabel('영구 삭제 확인 문구').fill('영구 삭제');
  await deleteDialog.getByRole('button', { name: '영구 삭제 요청' }).click();

  await expect(page).toHaveURL(/\/works$/);
  await expect(page.getByText('등록된 작품이 없습니다', { exact: true })).toBeVisible();
  expect(deletePayload).toEqual({ confirmation: '영구 삭제' });
});

test('새로고침한 PURGING 작품은 선택을 막고 재시도 응답을 실패한 이전 캐시보다 우선한다', async ({ page }) => {
  let retryRequested = false;
  let statusRequestsAfterRetry = 0;
  const works = [{
    id: 'purging-work',
    title: '삭제 재시도 작품',
    genre: '판타지',
    description: null,
    latestEpisodeNo: 2,
    lifecycleStatus: 'PURGING',
  }];

  await page.route('**/api/v1/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        id: 1,
        email: 'purge-retry@example.com',
        displayName: '삭제 재시도',
        phoneNumber: '01012345678',
        phoneVerified: false,
        role: 'AUTHOR',
        status: 'ACTIVE',
      },
      error: null,
    }),
  }));
  await page.route('**/api/v1/works/purging-work/purge-request', route => {
    if (retryRequested) {
      statusRequestsAfterRetry += 1;
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
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
        data: {
          requestId: 'purge-failed',
          workId: 'purging-work',
          status: retryRequested ? 'COMPLETED' : 'FAILED',
          requestedAt: '2026-08-22T00:00:00Z',
          completedAt: retryRequested ? '2026-08-22T00:01:00Z' : null,
          attemptCount: retryRequested ? 2 : 1,
          retryable: !retryRequested,
          lastErrorCode: retryRequested ? null : 'OBJECT_STORAGE_PURGE_FAILED',
          slaBreached: true,
          objectStorage: { targetCount: 3, deletedCount: 2, failedCount: 1 },
          database: { targetCount: 0, deletedCount: 0, failedCount: 0 },
        },
        error: null,
      }),
    });
  });
  await page.route('**/api/v1/works/purge-requests/purge-failed/retry', route => {
    retryRequested = true;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          requestId: 'purge-failed',
          workId: 'purging-work',
          status: 'REQUESTED',
          requestedAt: '2026-08-22T00:00:00Z',
          attemptCount: 2,
          retryable: false,
        },
        error: null,
      }),
    });
  });
  await page.route('**/api/v1/works', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: works, error: null }),
  }));

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'purge-retry-token'));
  await page.goto('/works');

  await expect(page.getByRole('button', { name: '삭제 재시도 작품 작품 선택' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '삭제 재시도 작품 수정' })).toBeDisabled();
  await page.locator('.work-card').hover();
  await page.getByRole('button', { name: '삭제 재시도 작품 삭제 상태' }).click();

  const dialog = page.getByRole('dialog', { name: '작품 영구 삭제 상태' });
  await expect(dialog.getByText('영구 삭제를 완료하지 못했습니다.', { exact: true })).toBeVisible();
  await expect(dialog.locator('.work-delete-status')).toHaveCSS('color', 'rgb(51, 58, 70)');
  await expect(dialog.locator('.work-delete-metrics')).toHaveCSS('color', 'rgb(101, 112, 131)');
  await expect(dialog.locator('.work-delete-sla')).toHaveCSS('color', 'rgb(138, 75, 0)');
  await dialog.getByRole('button', { name: '삭제 재시도' }).click();

  await expect.poll(() => statusRequestsAfterRetry).toBeGreaterThan(0);
  await expect(dialog.getByText('영구 삭제 요청을 접수했습니다.', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '삭제 재시도' })).toHaveCount(0);
  expect(retryRequested).toBe(true);
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
