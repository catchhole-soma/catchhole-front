import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const episodeId = '44444444-4444-4444-8444-444444444444';

test('공통 Query 재시도 정책은 최종 401을 다시 요청하지 않는다', async ({ page }) => {
  await page.goto('/landing');

  const decisions = await page.evaluate(async () => {
    const { ApiError } = await import('/src/app/lib/api-errors.ts');
    const { queryClient } = await import('/src/app/lib/query-client.ts');
    const retry = queryClient.getDefaultOptions().queries?.retry;
    if (typeof retry !== 'function') throw new Error('Query retry 함수가 설정되지 않았습니다.');

    return {
      unauthorized: retry(0, new ApiError('인증 실패', 'AUTH_FAILED', 401)),
      firstServerFailure: retry(0, new ApiError('서버 오류', 'SERVER_ERROR', 500)),
      exhaustedServerFailure: retry(1, new ApiError('서버 오류', 'SERVER_ERROR', 500)),
    };
  });

  expect(decisions).toEqual({
    unauthorized: false,
    firstServerFailure: true,
    exhaustedServerFailure: false,
  });
});

test('구버전 데모 캐릭터 저장값의 설정명 편집 메타데이터를 보정한다', async ({ page }) => {
  await page.goto('/landing');

  const metadata = await page.evaluate(async () => {
    localStorage.setItem('catchhole_demo_character_state', JSON.stringify({
      detective: {
        characters: [{
          id: 'legacy-character',
          name: '구버전 캐릭터',
          profile: [{
            key: 'profile.manual_legacy',
            displayName: '수동 프로필',
            value: '값',
            valueType: 'STRING',
            properties: [{ key: 'name', displayName: '이름', value: '수동 프로필', valueType: 'STRING' }],
          }, {
            key: 'profile.gender',
            displayName: '성별',
            value: '여성',
            valueType: 'STRING',
            properties: [],
          }],
          stats: [],
          skills: [{
            key: 'skill.legacy_skill',
            displayName: '구버전 스킬',
            value: 'Lv.1',
            valueType: 'JSON',
            properties: [{ key: 'name', displayName: '이름', value: '구버전 스킬', valueType: 'STRING' }],
          }],
          items: [],
          statuses: [],
        }],
        archivedCharacters: [{
          id: 'legacy-archived-character',
          name: '보관 캐릭터',
          profile: [],
          stats: [],
          skills: [],
          items: [{
            key: 'item.legacy_item',
            displayName: '구버전 아이템',
            value: '1개',
            valueType: 'JSON',
            properties: [{ key: 'name', displayName: '이름', value: '구버전 아이템', valueType: 'STRING' }],
          }],
          statuses: [],
        }],
      },
    }));
    const { loadDemoCharacterState } = await import(
      '/src/app/components/catchhole/character/demoCharacters.ts'
    );
    const state = loadDemoCharacterState('detective');
    return {
      manualProfile: state.characters[0]?.profile?.[0],
      fixedProfile: state.characters[0]?.profile?.[1],
      dynamicSkill: state.characters[0]?.skills?.[0],
      archivedItem: state.archivedCharacters[0]?.items?.[0],
    };
  });

  expect(metadata.manualProfile).toEqual(expect.objectContaining({
    attributeNameEditable: false,
    attributeNamePrefix: null,
    displayNameEditable: true,
  }));
  expect(metadata.fixedProfile).toEqual(expect.objectContaining({
    attributeNameEditable: false,
    attributeNamePrefix: null,
    displayNameEditable: false,
  }));
  expect(metadata.dynamicSkill).toEqual(expect.objectContaining({
    attributeNameEditable: true,
    attributeNamePrefix: 'skill.',
    displayNameEditable: true,
  }));
  expect(metadata.archivedItem).toEqual(expect.objectContaining({
    attributeNameEditable: true,
    attributeNamePrefix: 'item.',
    displayNameEditable: true,
  }));
});

const member = {
  id: 1,
  email: 'review-fixes@example.com',
  displayName: '리뷰 수정 테스트',
  phoneNumber: '01012345678',
  phoneVerified: false,
  role: 'AUTHOR',
  status: 'ACTIVE',
};

function fulfill(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data, error: null }),
  });
}

async function authenticate(page: Page, token: string) {
  await page.goto('/login');
  await page.evaluate(value => localStorage.setItem('accessToken', value), token);
}

test('삭제된 회차의 저장된 분석 URL은 사용할 수 없는 종료 상태를 표시한다', async ({ page }) => {
  const analysisJobId = '33333333-3333-4333-8333-333333333333';

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/${workId}/analysis-jobs/${analysisJobId}`)
        ? {
            id: analysisJobId,
            workId,
            workTitle: '현재 작품',
            batchId,
            jobType: 'EPISODE_VALIDATION',
            status: 'SUCCEEDED',
            episodes: [{
              id: episodeId,
              episodeNo: 20,
              title: '삭제된 회차',
              status: 'ARCHIVED',
            }],
          }
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '현재 작품', genre: '판타지' }
          : pathname.endsWith('/works')
            ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 0 }]
            : [];

    return fulfill(route, data);
  });

  await authenticate(page, 'archived-analysis-token');
  await page.goto(
    `/episode-upload?workId=${workId}&batchId=${batchId}`
    + `&analysisJobIds=${analysisJobId}&currentAnalysisJobIds=${analysisJobId}`
    + '&jobType=EPISODE_VALIDATION',
  );

  await expect(page.getByText('삭제되어 사용할 수 없는 회차가 있습니다')).toBeVisible();
  await expect(page.getByText('사용할 수 없음', { exact: true })).toBeVisible();
  await expect(page.getByText('이 회차는 삭제되어 더 이상 분석 대상에 포함되지 않습니다.')).toBeVisible();
  await expect(page.getByText('분석을 준비하고 있습니다')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '분석 결과를 열 수 없습니다' })).toBeDisabled();
});

test('분석 실패 화면은 내부 오류 원문 대신 사용자용 안내를 표시한다', async ({ page }) => {
  const analysisJobId = '33333333-3333-4333-8333-333333333333';
  const internalError = 'LLM extraction failed after 3 attempts: source_chunk_id Input should be a valid UUID';

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/${workId}/analysis-jobs/${analysisJobId}`)
        ? {
            id: analysisJobId,
            workId,
            workTitle: '현재 작품',
            batchId,
            jobType: 'EPISODE_VALIDATION',
            status: 'FAILED',
            errorMessage: internalError,
            episodes: [{
              id: episodeId,
              episodeNo: 20,
              title: '실패한 회차',
              status: 'FAILED',
            }],
          }
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '현재 작품', genre: '판타지' }
          : [];

    return fulfill(route, data);
  });

  await authenticate(page, 'failed-analysis-token');
  await page.goto(
    `/episode-upload?workId=${workId}&batchId=${batchId}`
    + `&analysisJobIds=${analysisJobId}&currentAnalysisJobIds=${analysisJobId}`
    + '&jobType=EPISODE_VALIDATION',
  );

  await expect(page.getByText(
    '분석 중 문제가 발생했습니다. 실패한 회차를 다시 시도해주세요.',
    { exact: true },
  )).toBeVisible();
  await expect(page.getByText('회차 분석에 실패했습니다', { exact: true })).toBeVisible();
  await expect(page.getByText(internalError, { exact: true })).toHaveCount(0);
  await expect(page.getByText(/마지막 실패 사유/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '실패 회차 다시 시도' })).toBeVisible();
});

test('삭제 회차와 실패 회차가 섞여도 살아 있는 실패 회차만 재시도한다', async ({ page }) => {
  const archivedAnalysisJobId = '33333333-3333-4333-8333-333333333333';
  const failedAnalysisJobId = '55555555-5555-4555-8555-555555555555';
  const retryAnalysisJobId = '66666666-6666-4666-8666-666666666666';
  const failedEpisodeId = '77777777-7777-4777-8777-777777777777';
  const retriedAnalysisJobIds: string[] = [];

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const retryMatch = request.method() === 'POST'
      ? pathname.match(/\/analysis-jobs\/([^/]+)\/retry$/)
      : null;
    if (retryMatch) {
      retriedAnalysisJobIds.push(retryMatch[1]);
      return fulfill(route, [{ id: retryAnalysisJobId, jobType: 'EPISODE_VALIDATION' }]);
    }

    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/${workId}/analysis-jobs/${archivedAnalysisJobId}`)
        ? {
            id: archivedAnalysisJobId,
            workId,
            workTitle: '현재 작품',
            batchId,
            jobType: 'EPISODE_VALIDATION',
            status: 'FAILED',
            episodes: [{
              id: episodeId,
              episodeNo: 20,
              title: '삭제된 실패 회차',
              status: 'ARCHIVED',
            }],
          }
        : pathname.endsWith(`/${workId}/analysis-jobs/${failedAnalysisJobId}`)
          ? {
              id: failedAnalysisJobId,
              workId,
              workTitle: '현재 작품',
              batchId,
              jobType: 'EPISODE_VALIDATION',
              status: 'FAILED',
              episodes: [{
                id: failedEpisodeId,
                episodeNo: 21,
                title: '재시도할 회차',
                status: 'FAILED',
              }],
            }
          : pathname.endsWith(`/${workId}/analysis-jobs/${retryAnalysisJobId}`)
            ? {
                id: retryAnalysisJobId,
                workId,
                workTitle: '현재 작품',
                batchId,
                jobType: 'EPISODE_VALIDATION',
                status: 'PENDING',
                episodes: [{
                  id: failedEpisodeId,
                  episodeNo: 21,
                  title: '재시도할 회차',
                  status: 'FAILED',
                }],
              }
            : pathname.endsWith(`/works/${workId}`)
              ? { id: workId, title: '현재 작품', genre: '판타지' }
              : [];

    return fulfill(route, data);
  });

  await authenticate(page, 'mixed-archived-analysis-token');
  await page.goto(
    `/episode-upload?workId=${workId}&batchId=${batchId}`
    + `&analysisJobIds=${archivedAnalysisJobId},${failedAnalysisJobId}`
    + `&currentAnalysisJobIds=${archivedAnalysisJobId},${failedAnalysisJobId}`
    + '&jobType=EPISODE_VALIDATION',
  );

  await expect(page.getByText('일부 회차 분석에 실패했습니다')).toBeVisible();
  await expect(page.getByText(
    '삭제된 회차는 분석 결과를 열거나 다시 시도할 수 없습니다. 원고 목록에서 현재 회차를 확인해주세요.',
    { exact: true },
  )).toBeVisible();
  await page.getByRole('button', { name: '실패 회차 다시 시도' }).click();

  await expect.poll(() => retriedAnalysisJobIds).toEqual([failedAnalysisJobId]);
  await expect.poll(() => {
    const params = new URL(page.url()).searchParams;
    return [
      params.get('analysisJobIds'),
      params.get('currentAnalysisJobIds'),
    ];
  }).toEqual([
    `${archivedAnalysisJobId},${failedAnalysisJobId},${retryAnalysisJobId}`,
    `${archivedAnalysisJobId},${retryAnalysisJobId}`,
  ]);
});

test('여러 실패 회차 재시도 중 일부만 성공해도 새 작업 ID를 추적한다', async ({ page }) => {
  const firstFailedJobId = '33333333-3333-4333-8333-333333333333';
  const secondFailedJobId = '55555555-5555-4555-8555-555555555555';
  const retriedJobId = '66666666-6666-4666-8666-666666666666';
  let releaseFirstRetry: () => void = () => undefined;
  let secondRetrySettled = false;
  const firstRetryGate = new Promise<void>(resolve => {
    releaseFirstRetry = resolve;
  });

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (
      request.method() === 'POST'
      && pathname.endsWith(`/${workId}/analysis-jobs/${firstFailedJobId}/retry`)
    ) {
      await firstRetryGate;
      return fulfill(route, [{ id: retriedJobId, jobType: 'EPISODE_VALIDATION' }]);
    }
    if (
      request.method() === 'POST'
      && pathname.endsWith(`/${workId}/analysis-jobs/${secondFailedJobId}/retry`)
    ) {
      secondRetrySettled = true;
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: '재시도 요청 실패',
          data: null,
          error: { code: 'INTERNAL_SERVER_ERROR', status: 500, details: [] },
        }),
      });
    }

    const jobId = pathname.split('/').at(-1);
    const data = pathname.endsWith('/auth/me')
      ? member
      : jobId === firstFailedJobId || jobId === secondFailedJobId
        ? {
            id: jobId,
            workId,
            workTitle: '현재 작품',
            batchId,
            jobType: 'EPISODE_VALIDATION',
            status: 'FAILED',
            episodes: [{
              id: episodeId,
              episodeNo: jobId === firstFailedJobId ? 20 : 21,
              title: '재시도 대상 회차',
              status: 'FAILED',
            }],
          }
        : jobId === retriedJobId
          ? {
              id: retriedJobId,
              workId,
              workTitle: '현재 작품',
              batchId,
              jobType: 'EPISODE_VALIDATION',
              status: 'PENDING',
              episodes: [{
                id: episodeId,
                episodeNo: 20,
                title: '재시도 성공 회차',
                status: 'FAILED',
              }],
            }
          : pathname.endsWith(`/works/${workId}`)
            ? { id: workId, title: '현재 작품', genre: '판타지' }
            : [];
    return fulfill(route, data);
  });

  await authenticate(page, 'partial-retry-token');
  await page.goto(
    `/episode-upload?workId=${workId}&batchId=${batchId}`
    + `&analysisJobIds=${firstFailedJobId},${secondFailedJobId}`
    + `&currentAnalysisJobIds=${firstFailedJobId},${secondFailedJobId}`
    + '&jobType=EPISODE_VALIDATION',
  );

  const retryButton = page.getByRole('button', { name: '실패 회차 다시 시도' });
  await retryButton.click();
  await expect.poll(() => secondRetrySettled).toBe(true);
  await expect(page.getByRole('button', { name: '재시도 요청 중...' })).toBeDisabled();
  releaseFirstRetry();

  await expect.poll(() => {
    const params = new URL(page.url()).searchParams;
    return [
      params.get('analysisJobIds'),
      params.get('currentAnalysisJobIds'),
    ];
  }).toEqual([
    `${firstFailedJobId},${secondFailedJobId},${retriedJobId}`,
    `${secondFailedJobId},${retriedJobId}`,
  ]);
  await expect(page.getByText('재시도 요청 실패', { exact: true })).toBeVisible();
});

test('재시도 응답의 jobType이 실패 작업과 다르면 새 ID를 채택하지 않는다', async ({ page }) => {
  const failedAnalysisJobId = '33333333-3333-4333-8333-333333333333';
  const mismatchedAnalysisJobId = '55555555-5555-4555-8555-555555555555';

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (
      request.method() === 'POST'
      && pathname.endsWith(`/${workId}/analysis-jobs/${failedAnalysisJobId}/retry`)
    ) {
      return fulfill(route, [{
        id: mismatchedAnalysisJobId,
        jobType: 'SETTING_EXTRACTION',
      }]);
    }

    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/${workId}/analysis-jobs/${failedAnalysisJobId}`)
        ? {
            id: failedAnalysisJobId,
            workId,
            workTitle: '현재 작품',
            batchId,
            jobType: 'EPISODE_VALIDATION',
            status: 'FAILED',
            episodes: [{
              id: episodeId,
              episodeNo: 20,
              title: '재시도 대상 회차',
              status: 'FAILED',
            }],
          }
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '현재 작품', genre: '판타지' }
          : [];
    return fulfill(route, data);
  });

  await authenticate(page, 'retry-job-type-token');
  await page.goto(
    `/episode-upload?workId=${workId}&batchId=${batchId}`
    + `&analysisJobIds=${failedAnalysisJobId}&currentAnalysisJobIds=${failedAnalysisJobId}`
    + '&jobType=EPISODE_VALIDATION',
  );

  await page.getByRole('button', { name: '실패 회차 다시 시도' }).click();

  await expect(page.getByText(
    '재시도 응답의 분석 유형이 기존 실패 작업과 일치하지 않습니다.',
    { exact: true },
  )).toBeVisible();
  await expect.poll(() => {
    const params = new URL(page.url()).searchParams;
    return [
      params.get('analysisJobIds'),
      params.get('currentAnalysisJobIds'),
    ];
  }).toEqual([failedAnalysisJobId, failedAnalysisJobId]);
});

test('현재 Job이 완료되면 원문 상태가 바뀌어도 완료와 변경 경고를 표시한다', async ({ page }) => {
  const historicalAnalysisJobId = '33333333-3333-4333-8333-333333333333';
  const currentAnalysisJobId = '55555555-5555-4555-8555-555555555555';
  const currentEpisodeId = '77777777-7777-4777-8777-777777777777';

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/${workId}/analysis-jobs/${historicalAnalysisJobId}`)
        ? {
            id: historicalAnalysisJobId,
            workId,
            workTitle: '현재 작품',
            batchId,
            jobType: 'EPISODE_VALIDATION',
            status: 'FAILED',
            episodes: [{
              id: episodeId,
              episodeNo: 19,
              title: '과거 삭제 회차',
              status: 'ARCHIVED',
            }],
          }
        : pathname.endsWith(`/${workId}/analysis-jobs/${currentAnalysisJobId}`)
          ? {
              id: currentAnalysisJobId,
              workId,
              workTitle: '현재 작품',
              batchId,
              jobType: 'EPISODE_VALIDATION',
              status: 'SUCCEEDED',
              episodes: [{
                id: currentEpisodeId,
                episodeNo: 20,
                title: '완료 후 원문 변경 회차',
                status: 'UPLOADED',
              }],
            }
          : pathname.endsWith(`/works/${workId}`)
            ? { id: workId, title: '현재 작품', genre: '판타지' }
            : [];
    return fulfill(route, data);
  });

  await authenticate(page, 'completed-stale-source-token');
  await page.goto(
    `/episode-upload?workId=${workId}&batchId=${batchId}`
    + `&analysisJobIds=${historicalAnalysisJobId},${currentAnalysisJobId}`
    + `&currentAnalysisJobIds=${currentAnalysisJobId}`
    + '&jobType=EPISODE_VALIDATION',
  );

  await expect(page.getByText('분석이 완료되었습니다', { exact: true })).toBeVisible();
  await expect(page.getByText(
    '분석 작업은 완료되었지만 현재 회차 상태가 분석 당시와 다릅니다. 원고 변경 여부를 확인하고 필요하면 다시 분석해주세요.',
    { exact: true },
  )).toBeVisible();
  await expect(page.getByText(/완료 후 원문 변경 회차/)).toBeVisible();
  await expect(page.getByText('과거 삭제 회차', { exact: true })).toHaveCount(0);
  await expect(page.getByText(
    '삭제된 회차는 분석 결과를 열거나 다시 시도할 수 없습니다. 원고 목록에서 현재 회차를 확인해주세요.',
    { exact: true },
  )).toHaveCount(0);
  await expect(page.getByRole('button', { name: '설정 후보 검토' })).toBeEnabled();
});

test('동반 설정집의 중복 파일명은 회차와 설정집 저장 전에 차단한다', async ({ page }) => {
  const duplicateSettingBookName = '기존설정.txt';
  let episodeUploadRequestCount = 0;
  let settingBookUploadRequestCount = 0;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (request.method() === 'POST' && pathname.endsWith('/episodes/detect')) {
      return fulfill(route, {
        uploadType: 'SINGLE_EPISODE',
        episodeCount: 1,
        totalCharCount: 8,
        detectedEpisodes: [{
          detectionOrder: 0,
          sourceFileIndex: 0,
          episodeNo: 21,
          title: '새 회차',
          sourceHeading: null,
          charCount: 8,
          content: '새 회차 본문입니다.',
        }],
      });
    }
    if (request.method() === 'POST' && pathname.endsWith(`/${workId}/episodes`)) {
      episodeUploadRequestCount += 1;
      return fulfill(route, {});
    }
    if (request.method() === 'POST' && pathname.endsWith(`/${workId}/setting-books`)) {
      settingBookUploadRequestCount += 1;
      return fulfill(route, {});
    }

    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/${workId}/setting-books`)
        ? [{
            id: '88888888-8888-4888-8888-888888888888',
            originalFilename: duplicateSettingBookName,
            fileSize: 1200,
            uploadedAt: '2026-07-28T12:00:00',
          }]
        : pathname.endsWith(`/${workId}/episodes`)
          ? []
          : pathname.endsWith(`/works/${workId}`)
            ? { id: workId, title: '현재 작품', genre: '판타지' }
            : [];

    return fulfill(route, data);
  });

  await authenticate(page, 'duplicate-setting-book-token');
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByText('단일 회차 업로드', { exact: true }).click();

  await page.locator('input[type="file"]').first().setInputFiles({
    name: '21화.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('제 21화 새 회차\n새 회차 본문입니다.'),
  });
  await expect(page.locator('input[type="number"]')).toHaveValue('21');

  await page.getByRole('checkbox').check();
  await page.locator('input[type="file"]').nth(1).setInputFiles({
    name: duplicateSettingBookName,
    mimeType: 'text/plain',
    buffer: Buffer.from('기존 설정집과 같은 이름입니다.'),
  });

  await expect(page.getByText(
    '같은 이름의 설정집이 이미 업로드되어 있습니다.',
    { exact: true },
  )).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 — 분석 시작' })).toBeDisabled();
  expect(episodeUploadRequestCount).toBe(0);
  expect(settingBookUploadRequestCount).toBe(0);
});

test('분석 목록의 실패 확인은 새 Job을 현재 polling 대상으로 다시 연다', async ({ page }) => {
  const failedAnalysisJobId = '33333333-3333-4333-8333-333333333333';
  const retryAnalysisJobId = '55555555-5555-4555-8555-555555555555';
  let retryRequestCount = 0;
  let createRequestCount = 0;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (
      request.method() === 'POST'
      && pathname.endsWith(`/${workId}/analysis-jobs/${failedAnalysisJobId}/retry`)
    ) {
      retryRequestCount += 1;
      return fulfill(route, [{ id: retryAnalysisJobId }]);
    }
    if (request.method() === 'POST' && pathname.endsWith(`/${workId}/analysis-jobs`)) {
      createRequestCount += 1;
      return fulfill(route, []);
    }

    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/${workId}/analysis-jobs/batches`)
        ? {
            content: [{
              batchId,
              status: 'FAILED',
              episodeStartNo: 20,
              episodeEndNo: 20,
              episodeCount: 1,
              totalCandidateCount: 0,
              reviewedCandidateCount: 0,
              pendingCandidateCount: 0,
              jobGroups: [{
                jobType: 'EPISODE_VALIDATION',
                status: 'FAILED',
                totalJobCount: 1,
                pendingJobCount: 0,
                runningJobCount: 0,
                succeededJobCount: 0,
                failedJobCount: 1,
                currentAnalysisJobIds: [failedAnalysisJobId],
              }],
              lastActivityAt: '2026-07-28T12:00:00',
            }],
            page: 0,
            size: 10,
            totalElements: 1,
            totalPages: 1,
            hasNext: false,
          }
      : pathname.endsWith(`/${workId}/episodes`)
        ? [{
            id: episodeId,
            batchId,
            episodeNo: 20,
            title: '재시도 대상 회차',
            originalFilename: 'episode-20.txt',
            contentUpdatedAt: '2026-07-28T12:00:00',
            charCount: 1200,
            analysisStatus: 'FAILED',
            latestAnalysisJobId: failedAnalysisJobId,
            unresolvedFindingCount: null,
          }]
        : pathname.endsWith(`/${workId}/analysis-jobs/${failedAnalysisJobId}`)
          ? {
              id: failedAnalysisJobId,
              workId,
              workTitle: '현재 작품',
              batchId,
              jobType: 'EPISODE_VALIDATION',
              status: 'FAILED',
              episodes: [{ id: episodeId, episodeNo: 20, title: '재시도 대상 회차', status: 'FAILED' }],
            }
          : pathname.endsWith(`/${workId}/analysis-jobs/${retryAnalysisJobId}`)
            ? {
                id: retryAnalysisJobId,
                workId,
                workTitle: '현재 작품',
                batchId,
                jobType: 'EPISODE_VALIDATION',
                status: 'PENDING',
                episodes: [{ id: episodeId, episodeNo: 20, title: '재시도 대상 회차', status: 'FAILED' }],
              }
            : pathname.endsWith(`/works/${workId}`)
              ? { id: workId, title: '현재 작품', genre: '판타지' }
              : pathname.endsWith('/works')
                ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 1 }]
                : [];

    return fulfill(route, data);
  });

  await authenticate(page, 'dashboard-retry-token');
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);

  await page.getByRole('button', { name: '실패 확인', exact: true }).click();
  await page.getByRole('button', { name: '실패 회차 다시 시도', exact: true }).click();

  await expect.poll(() => retryRequestCount).toBe(1);
  expect(createRequestCount).toBe(0);
  await expect.poll(() => {
    const params = new URL(page.url()).searchParams;
    return [
      params.get('analysisJobIds'),
      params.get('currentAnalysisJobIds'),
    ];
  }).toEqual([
    `${failedAnalysisJobId},${retryAnalysisJobId}`,
    retryAnalysisJobId,
  ]);
  await expect.poll(() => page.evaluate(() => (
    window.history.state?.usr?.returnToAnalysisList
  ))).toBe(`/dashboard?workId=${workId}&nav=analyses`);
});

test('설정집 삭제는 대상을 표시하고 실패한 모달에서 다시 시도한다', async ({ page }) => {
  const settingBookId = '66666666-6666-4666-8666-666666666666';
  let settingBooks = [{
    id: settingBookId,
    originalFilename: '세계관_최종본.txt',
    mimeType: 'text/plain; charset=UTF-8',
    fileSize: 1200,
    uploadedAt: '2026-07-28T12:00:00',
  }];
  let deleteRequestCount = 0;
  let nativeDialogCount = 0;

  page.on('dialog', async dialog => {
    nativeDialogCount += 1;
    await dialog.dismiss();
  });

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (
      request.method() === 'DELETE'
      && pathname.endsWith(`/${workId}/setting-books/${settingBookId}`)
    ) {
      deleteRequestCount += 1;
      if (deleteRequestCount === 1) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            data: null,
            error: {
              code: 'SETTING_BOOK_DELETE_FAILED',
              message: '설정집 원본을 삭제하지 못했습니다.',
              details: [],
            },
          }),
        });
      }
      settingBooks = [];
      return fulfill(route, null);
    }

    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/${workId}/setting-books/${settingBookId}`)
        ? {
            ...settingBooks[0],
            workId,
            content: '세계관 설정집 전체 원문',
          }
      : pathname.endsWith(`/${workId}/setting-books`)
        ? settingBooks
        : pathname.endsWith(`/${workId}/episodes`)
          ? []
          : pathname.endsWith(`/works/${workId}`)
            ? { id: workId, title: '현재 작품', genre: '판타지' }
            : pathname.endsWith('/works')
              ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 0 }]
              : [];

    return fulfill(route, data);
  });

  await authenticate(page, 'setting-book-delete-token');
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=worldrules`);

  await page.getByTestId(`setting-book-row-${settingBookId}`).click();
  await page.getByRole('button', { name: '삭제', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '이 설정집을 삭제할까요?' });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('세계관_최종본.txt')).toBeVisible();
  expect(nativeDialogCount).toBe(0);

  await modal.getByRole('button', { name: '삭제', exact: true }).click();
  await expect.poll(() => deleteRequestCount).toBe(1);
  await expect(modal.getByRole('alert')).toHaveText(
    '삭제에 실패했습니다. 설정집은 목록에 그대로 유지됩니다.',
  );
  await expect(page.getByTestId(`setting-book-row-${settingBookId}`)).toBeVisible();

  await modal.getByRole('button', { name: '다시 시도' }).click();
  await expect.poll(() => deleteRequestCount).toBe(2);
  await expect(modal).not.toBeVisible();
  await expect(page.getByTestId(`setting-book-row-${settingBookId}`)).not.toBeVisible();
});

test('직접 연 원문 화면의 원고 목록 버튼은 이전 페이지가 아닌 현재 작품 목록으로 간다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/episodes/${episodeId}`)
        ? {
            id: episodeId,
            episodeNo: 20,
            title: '직접 연 원문',
            content: '원문입니다.',
            originalFilename: 'episode-20.txt',
            contentUpdatedAt: '2026-07-28T12:00:00',
            charCount: 6,
          }
        : pathname.endsWith(`/works/${workId}`)
          ? { id: workId, title: '현재 작품', genre: '판타지' }
          : pathname.endsWith('/works')
            ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 1 }]
            : [];

    return fulfill(route, data);
  });

  await authenticate(page, 'direct-reader-token');
  await page.goto('/works');
  await page.goto(`/editor?workId=${workId}&episodeId=${episodeId}`);

  await page.getByRole('button', { name: '원고 목록', exact: true }).click();

  await expect(page).toHaveURL(
    new RegExp(`/dashboard\\?workId=${workId}&nav=manuscripts$`),
  );
});

test('설정집 업로드 요청 중에는 선택 파일과 드롭 영역을 변경할 수 없다', async ({ page }) => {
  let releaseUploadRequest!: () => void;
  const uploadResponseGate = new Promise<void>(resolve => {
    releaseUploadRequest = resolve;
  });
  let uploadRequestCount = 0;
  let uploadBody = '';

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (
      request.method() === 'POST'
      && pathname.endsWith(`/${workId}/setting-books`)
    ) {
      uploadRequestCount += 1;
      uploadBody = request.postData() ?? '';
      await uploadResponseGate;
      return fulfill(route, {
        id: '77777777-7777-4777-8777-777777777777',
        originalFilename: 'setting-a.txt',
      });
    }

    const data = pathname.endsWith('/auth/me')
      ? member
      : pathname.endsWith(`/${workId}/setting-books`)
        ? []
        : pathname.endsWith(`/${workId}/episodes`)
          ? []
          : pathname.endsWith(`/works/${workId}`)
            ? { id: workId, title: '현재 작품', genre: '판타지' }
            : pathname.endsWith('/works')
              ? [{ id: workId, title: '현재 작품', genre: '판타지', episodeCount: 0 }]
              : [];

    return fulfill(route, data);
  });

  await authenticate(page, 'pending-file-token');
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=worldrules`);
  await page.getByRole('button', { name: '설정집 업로드', exact: true }).click();

  const uploadDialog = page.getByRole('dialog', { name: '설정집 업로드' });
  const fileInput = page.getByTestId('setting-book-file-input');
  const dropArea = uploadDialog.getByRole('button', {
    name: /파일을 드래그하거나 클릭하여 선택/,
  });
  await fileInput.setInputFiles({
    name: 'setting-a.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('첫 번째 설정집'),
  });
  await uploadDialog.getByRole('button', { name: '설정집 업로드', exact: true }).click();

  await expect.poll(() => uploadRequestCount).toBe(1);
  await expect(fileInput).toBeDisabled();
  await expect(dropArea).toHaveAttribute('aria-disabled', 'true');

  const replacementTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['두 번째 설정집'], 'setting-b.txt', { type: 'text/plain' }));
    return transfer;
  });
  await dropArea.dispatchEvent('drop', { dataTransfer: replacementTransfer });

  await expect(page.getByText(/setting-a\.txt/)).toBeVisible();
  await expect(page.getByText(/setting-b\.txt/)).toHaveCount(0);
  expect(uploadBody).toContain('setting-a.txt');
  expect(uploadBody).not.toContain('setting-b.txt');

  releaseUploadRequest();
  await expect(uploadDialog).toHaveCount(0);
});
