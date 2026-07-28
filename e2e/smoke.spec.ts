import { test, expect } from '@playwright/test';

const TEST_WORK_ID = '00000000-0000-4000-8000-000000000001';

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
  await expect(page.getByRole('heading', { name: '캐릭터 DB', exact: true })).toBeVisible();
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

test('데모 모드는 access token 없이 열리고 이름만 수정해도 설정 근거를 유지한다', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('catchhole_demo_mode', 'true'));

  await page.goto('/dashboard?workId=detective&nav=settingDB&tab=characters');

  await expect(page.getByText('설정 대시보드', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '캐릭터 DB', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /수아/ }).click();
  await expect(page.getByRole('button', { name: '직업 원문 근거 보기' })).toBeVisible();

  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByLabel('이름', { exact: true }).fill('수아 이름 수정');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const confirm = page.getByText('수정 내용을 저장하시겠습니까?', { exact: true }).locator('..');
  await confirm.getByRole('button', { name: '저장', exact: true }).click();

  await expect(page.getByText('캐릭터 설정을 저장했습니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '직업 원문 근거 보기' })).toBeVisible();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '관계도', exact: true }).click();
  await page.getByRole('button', { name: '캐릭터 DB', exact: true }).click();
  await expect(page.getByRole('button', { name: /수아 이름 수정/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '편집', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: /수아 이름 수정/ }).click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  const deleteConfirm = page.getByText('캐릭터를 삭제하시겠습니까?', { exact: true }).locator('..');
  await deleteConfirm.getByRole('button', { name: '삭제', exact: true }).click();
  await page.getByRole('button', { name: '보관된 캐릭터', exact: true }).click();
  const archiveDialog = page.getByRole('dialog', { name: '보관된 캐릭터' });
  await expect(archiveDialog.getByText('수아 이름 수정', { exact: true })).toBeVisible();
  await archiveDialog.getByRole('button', { name: '복구', exact: true }).click();
  await archiveDialog.getByRole('button', { name: '보관함 닫기' }).click();
  await expect(page.getByRole('button', { name: /수아 이름 수정/ })).toBeVisible();
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
              jobType: 'EPISODE_VALIDATION',
              status: 'PENDING',
            },
            {
              id: secondAnalysisJobId,
              episodeId: '55555555-5555-4555-8555-555555555555',
              jobType: 'EPISODE_VALIDATION',
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
            jobType: 'EPISODE_VALIDATION',
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
  expect(uploadMultipartBody).not.toContain('"episodes"');
  await expect.poll(() => new URL(page.url()).searchParams.get('analysisJobIds'))
    .toBe(`${analysisJobId},${secondAnalysisJobId}`);
  await expect.poll(() => new URL(page.url()).searchParams.get('currentAnalysisJobIds'))
    .toBe(`${analysisJobId},${secondAnalysisJobId}`);
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

test('분석 중에는 기존 작업 진행 화면만 다시 열고 파일 변경·삭제·중복 요청을 막는다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const episodeId = '44444444-4444-4444-8444-444444444444';
  const batchId = '22222222-2222-4222-8222-222222222222';
  const analysisJobId = '33333333-3333-4333-8333-333333333333';
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
      : pathname.endsWith(`/${workId}/episodes`)
        ? [{
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
  const progressButton = page.getByRole('button', { name: '진행 보기' });
  await expect(titleButton).toBeEnabled();
  await expect(progressButton).toBeEnabled();
  await expect(page.getByRole('button', { name: '파일 변경' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '삭제' })).toBeDisabled();

  await titleButton.click();
  await expect(page.getByRole('textbox')).toHaveValue('분석 중 회차');
  await page.keyboard.press('Escape');

  await progressButton.click();

  await expect(page).toHaveURL(new RegExp(`/episode-upload\\?workId=${workId}`));
  await expect(page).toHaveURL(new RegExp(`batchId=${batchId}`));
  await expect(page).toHaveURL(new RegExp(`analysisJobIds=${analysisJobId}`));
  await expect(page.getByText('회차를 분석하고 있습니다')).toBeVisible();
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
  await expect(modal.getByText('20화 · 파일 교체 후 제목')).toBeVisible();
  await expect(modal.getByText('20화_파일_교체_후.docx')).toBeVisible();
  await expect(modal.getByText('현재 서비스에서는 직접 복구할 수 없습니다.')).toBeVisible();
  expect(nativeDialogCount).toBe(0);

  await modal.getByRole('button', { name: '취소' }).click();
  await expect(modal).not.toBeVisible();
  expect(deleteRequestCount).toBe(0);

  await page.getByRole('button', { name: '삭제', exact: true }).click();
  modal = page.getByRole('dialog', { name: '20화를 삭제할까요?' });
  await modal.getByRole('button', { name: '삭제', exact: true }).click();

  await expect.poll(() => deleteRequestCount).toBe(1);
  await expect(modal.getByRole('alert')).toHaveText(
    '삭제에 실패했습니다. 회차는 목록에 그대로 유지됩니다.',
  );
  await expect(page.getByRole('button', { name: '파일 교체 후 제목' })).toBeVisible();

  await modal.getByRole('button', { name: '다시 시도' }).click();

  await expect.poll(() => deleteRequestCount).toBe(2);
  await expect(modal).not.toBeVisible();
  await expect(page.getByRole('button', { name: '파일 교체 후 제목' })).not.toBeVisible();
});

test('재분석 요청 중에는 분석 버튼을 비활성화한다', async ({ page }) => {
  const workId = '11111111-1111-4111-8111-111111111111';
  const episodeId = '44444444-4444-4444-8444-444444444444';
  const batchId = '22222222-2222-4222-8222-222222222222';
  const analysisJobId = '33333333-3333-4333-8333-333333333333';
  let analysisRequestCount = 0;
  let releaseAnalysisRequest!: () => void;
  const analysisResponseGate = new Promise<void>(resolve => {
    releaseAnalysisRequest = resolve;
  });

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === 'POST' && pathname.endsWith(`/${workId}/analysis-jobs`)) {
      analysisRequestCount += 1;
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

  await expect.poll(() => analysisRequestCount).toBe(1);
  await expect(reanalysisButton).toBeDisabled();
  await reanalysisButton.click({ force: true });

  releaseAnalysisRequest();
  await expect(page).toHaveURL(new RegExp(`/episode-upload\\?workId=${workId}`));
  expect(analysisRequestCount).toBe(1);
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

  await page.goto(`/dashboard?workId=${TEST_WORK_ID}`);

  await expect(page.getByText('백엔드 서버에 연결할 수 없습니다', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toBe('mock');

  await page.getByRole('button', { name: '데모 버전으로 전환' }).click();

  await expect(page.getByText('설정 대시보드', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '캐릭터 DB', exact: true })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: '캐릭터 DB', exact: true })).toBeVisible();
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
  let releaseUpdate!: () => void;
  const updateGate = new Promise<void>(resolve => {
    releaseUpdate = resolve;
  });
  const characterAuthorizationHeaders: string[] = [];
  const characterRequestPaths: string[] = [];

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
      characterFactId: 'fact-profile-1',
      key: 'profile.occupation',
      displayName: '직업',
      value: '검사 지망생',
      valueType: 'STRING',
      properties: [],
      hasEvidence: true,
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
      },
      {
        characterFactId: 'fact-status-2',
        key: 'status.회복_중',
        displayName: '회복 중',
        value: '활성',
        valueType: 'JSON',
        properties: [
          { key: 'severity', displayName: '심각도', value: '보통', valueType: 'STRING' },
        ],
        hasEvidence: false,
      },
      {
        characterFactId: 'fact-status-3',
        key: 'status.잠복',
        displayName: '잠복',
        value: '관찰 중',
        valueType: 'JSON',
        properties: [],
        hasEvidence: false,
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
  await characterCard.click();
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
  await expect(statusPanel).toHaveCSS('border-color', 'rgb(42, 42, 54)');
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
  expect(Math.abs((statusBox?.y ?? 0) - (recoveringStatusBox?.y ?? 0))).toBeLessThan(2);
  expect(recoveringStatusBox?.x ?? 0).toBeGreaterThan(statusBox?.x ?? 0);
  expect(dormantStatusBox?.y ?? 0).toBeGreaterThan(statusBox?.y ?? 0);
  expect(Math.abs((statusBox?.x ?? 0) - (dormantStatusBox?.x ?? 0))).toBeLessThan(2);
  await expect(statusRow).toHaveCSS('border-bottom-width', '1px');
  await expect(recoveringStatusRow).toHaveCSS('border-bottom-width', '1px');
  await expect(dormantStatusRow).toHaveCSS('border-bottom-width', '0px');

  await page.getByRole('button', { name: '현재 나이 원문 근거 보기' }).click();
  await expect(page.getByText('원문 근거 패널은 후속 character-fact API 작업에서 연결됩니다.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '안내 닫기' }).click();
  await page.getByRole('button', { name: '현재 레벨 원문 근거 보기' }).click();
  await expect(page.getByText('원문 근거 패널은 후속 character-fact API 작업에서 연결됩니다.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '안내 닫기' }).click();

  await page.getByRole('button', { name: '수정', exact: true }).click();
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
  await page.getByLabel('이름', { exact: true }).fill('수아 이름만 수정');
  const detailRequestsBeforeRefetch = detailRequestCount;
  await page.evaluate(async () => {
    const { queryClient } = await import('/src/app/lib/query-client.ts');
    await queryClient.invalidateQueries();
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

  await page.getByRole('button', { name: '저장', exact: true }).click();
  const retryConfirm = page.getByText('수정 내용을 저장하시겠습니까?', { exact: true }).locator('..');
  await retryConfirm.getByRole('button', { name: '저장', exact: true }).click();

  let saveFeedback = page.getByText('캐릭터 설정을 저장했습니다.', { exact: true });
  await expect(saveFeedback).toBeVisible();
  await expect(saveFeedback.locator('..')).toHaveCSS('position', 'fixed');
  await expect(page.getByText('수아 이름만 수정', { exact: true }).first()).toBeVisible();
  expect(updateBody).toMatchObject({
    name: '수아 이름만 수정',
    roleLabel: '주인공',
    statuses: expect.arrayContaining([
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
  await page.getByLabel('상태 이름', { exact: true }).nth(1).fill('안정');
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
        value: '끝까지 포기하지 않는다',
        valueType: 'STRING',
        properties: [{ key: 'name', value: '좌우명', valueType: 'STRING' }],
      }),
    ]),
    stats: expect.arrayContaining([
      { key: 'stats.strength', value: '42', valueType: 'NUMBER', properties: [] },
      { key: 'stats.agility', value: '58', valueType: 'NUMBER', properties: [] },
      expect.objectContaining({
        value: '7',
        valueType: 'NUMBER',
        properties: [{ key: 'name', value: '행운', valueType: 'STRING' }],
      }),
    ]),
    skills: [
      {
        key: 'skill.생존_감각',
        value: 'Lv.6',
        valueType: 'JSON',
        properties: [
          { key: 'name', value: '생존 감각', valueType: 'STRING' },
          { key: 'level', value: '6', valueType: 'NUMBER' },
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
        key: 'status.회복_중',
        value: '활성',
        valueType: 'JSON',
        properties: [
          { key: 'severity', value: '보통', valueType: 'STRING' },
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
