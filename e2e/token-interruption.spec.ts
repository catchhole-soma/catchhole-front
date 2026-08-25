import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const otherBatchId = '22222222-2222-4222-8222-222222222223';
const analysisJobId = '33333333-3333-4333-8333-333333333333';
const secondAnalysisJobId = '33333333-3333-4333-8333-333333333334';
const episodeId = '44444444-4444-4444-8444-444444444444';
const secondEpisodeId = '44444444-4444-4444-8444-444444444445';
const candidateId = '55555555-5555-4555-8555-555555555555';
const secondCandidateId = '55555555-5555-4555-8555-555555555556';

const member = {
  id: 1,
  email: 'token-interruption@example.com',
  displayName: '토큰 중단 테스트',
  phoneNumber: '01012345678',
  phoneVerified: false,
  role: 'AUTHOR',
  status: 'ACTIVE',
};

function success(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data, error: null }),
  });
}

async function authenticate(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'token-interruption-token'));
}

async function computedContrastRatio(
  locator: Locator,
  backgroundLocator: Locator = locator,
  backdropLocator?: Locator,
) {
  const [foregroundValue, backgroundValue, backdropValue] = await Promise.all([
    locator.evaluate(element => getComputedStyle(element).color),
    backgroundLocator.evaluate(element => getComputedStyle(element).backgroundColor),
    backdropLocator
      ? backdropLocator.evaluate(element => getComputedStyle(element).backgroundColor)
      : Promise.resolve('rgb(255, 255, 255)'),
  ]);
  type Rgba = [number, number, number, number];
  const parseRgba = (value: string): Rgba => {
    const channels = value.match(/\d+(?:\.\d+)?/g)?.map(Number);
    if (!channels || channels.length < 3) throw new Error(`RGB 색상을 해석할 수 없습니다: ${value}`);
    return [channels[0], channels[1], channels[2], channels[3] ?? 1];
  };
  const composite = (foreground: Rgba, background: Rgba): Rgba => {
    const alpha = foreground[3] + background[3] * (1 - foreground[3]);
    if (alpha === 0) return [0, 0, 0, 0];
    return [
      (foreground[0] * foreground[3]
        + background[0] * background[3] * (1 - foreground[3])) / alpha,
      (foreground[1] * foreground[3]
        + background[1] * background[3] * (1 - foreground[3])) / alpha,
      (foreground[2] * foreground[3]
        + background[2] * background[3] * (1 - foreground[3])) / alpha,
      alpha,
    ];
  };
  const luminance = (color: Rgba) => {
    const channels = color.slice(0, 3).map(channel => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const background = composite(parseRgba(backgroundValue), parseRgba(backdropValue));
  const foreground = composite(parseRgba(foregroundValue), background);
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function aiUsage() {
  return {
    grantedTokens: 2000000,
    usedTokens: 2000000,
    reservedTokens: 0,
    remainingTokens: 0,
    remainingPercent: 0,
    exhausted: true,
    contactEmail: 'feedback@catchhole.com',
  };
}

function noPendingExtensionRequest(route: Route) {
  return success(route, { pending: false, request: null });
}

type ComparisonStatus = 'FAILED' | 'PENDING' | 'PROCESSING' | 'COMPLETED';
type ComparisonFailureCode = 'AI_TOKEN_QUOTA_EXHAUSTED' | 'LLM_NETWORK_ERROR';

function worldCandidate(
  comparisonStatus: ComparisonStatus,
  comparisonFailureCode: ComparisonFailureCode = 'AI_TOKEN_QUOTA_EXHAUSTED',
) {
  return {
    id: candidateId,
    workId,
    sourceEpisodeId: episodeId,
    sourceEpisodeNo: 12,
    analysisJobId,
    category: 'LOCATION',
    subjectName: '북부 설원',
    settingName: '기후',
    extractedValue: '일 년 내내 눈보라가 분다.',
    evidenceSpans: [{ quote: '북부 설원에는 일 년 내내 눈보라가 몰아쳤다.' }],
    extractionConfidence: 0.96,
    comparisonStatus,
    comparisonErrorMessage: comparisonStatus === 'FAILED'
      ? comparisonFailureCode === 'AI_TOKEN_QUOTA_EXHAUSTED'
        ? 'AI 사용량이 부족해 세계관 설정 비교를 완료하지 못했습니다.'
        : '세계관 설정 비교 중 네트워크 오류가 발생했습니다.'
      : null,
    comparisonFailureCode: comparisonStatus === 'FAILED'
      ? comparisonFailureCode
      : null,
    reviewStatus: 'PENDING_REVIEW',
    userModified: false,
  };
}

function worldCandidateList(
  comparisonStatus: ComparisonStatus,
  count: number,
  overrides: Partial<{
    totalCandidateCount: number;
    pendingCandidateCount: number;
    pendingComparisonCount: number;
    processingComparisonCount: number;
    activeComparisonJobCount: number;
    failedComparisonCount: number;
    tokenInterruptedComparisonCount: number;
    canResumeTokenInterruptedComparisons: boolean;
  }> = {},
  comparisonFailureCode: ComparisonFailureCode = 'AI_TOKEN_QUOTA_EXHAUSTED',
) {
  const failed = comparisonStatus === 'FAILED';
  const interrupted = failed && comparisonFailureCode === 'AI_TOKEN_QUOTA_EXHAUSTED';
  const pending = comparisonStatus === 'PENDING';
  const candidate = worldCandidate(comparisonStatus, comparisonFailureCode);
  const groupStatus = comparisonStatus === 'COMPLETED' ? 'READY' : comparisonStatus;
  return {
    batchId,
    episodeStartNo: 12,
    episodeEndNo: 12,
    episodeCount: 1,
    totalCandidateCount: count,
    reviewedCandidateCount: 0,
    pendingCandidateCount: count,
    pendingComparisonCount: pending ? count : 0,
    processingComparisonCount: comparisonStatus === 'PROCESSING' ? count : 0,
    activeComparisonJobCount: 0,
    failedComparisonCount: failed ? count : 0,
    tokenInterruptedComparisonCount: interrupted ? count : 0,
    canResumeTokenInterruptedComparisons: interrupted,
    recomparisonRequiredCount: 0,
    conflictCandidateCount: 0,
    groups: {
      content: [{
        groupKey: 'LOCATION|북부 설원',
        category: 'LOCATION',
        subjectName: '북부 설원',
        changeCount: 1,
        addCount: 0,
        updateCount: 0,
        mergeCount: 0,
        excludeCount: 0,
        evidenceEpisodeNos: [12],
        status: groupStatus,
        candidates: [candidate],
      }],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
    },
    ...overrides,
  };
}

test('비동기 토큰 중단은 전체 실패와 구분하고 보존된 후보 검토로 연결한다', async ({ page }) => {
  let summaryRequestCount = 0;
  let markInitialSummaryLoaded!: () => void;
  const initialSummaryLoaded = new Promise<void>(resolve => {
    markInitialSummaryLoaded = resolve;
  });

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
    if (pathname.endsWith('/ai-token-usages/extension-requests/me/pending')) {
      return noPendingExtensionRequest(route);
    }
    if (pathname === `/api/v1/works/${workId}`) {
      return success(route, { id: workId, title: '설원 연대기', genre: '판타지', latestEpisodeNo: 12 });
    }
    if (pathname === `/api/v1/works/${workId}/episodes`) return success(route, []);
    if (pathname === `/api/v1/works/${workId}/analysis-jobs/${analysisJobId}`) {
      await initialSummaryLoaded;
      return success(route, {
        id: analysisJobId,
        workId,
        workTitle: '설원 연대기',
        batchId,
        episodeId,
        episodes: [{
          id: episodeId,
          episodeNo: 12,
          title: '끝없는 눈보라',
          status: 'ANALYZED',
          updatedAt: '2026-08-16T10:00:00',
        }],
        jobType: 'SETTING_EXTRACTION',
        status: 'FAILED',
        currentStep: 'WORLD_SETTING_COMPARISON',
        errorMessage: 'AI 사용량이 부족해 세계관 설정 비교를 완료하지 못했습니다.',
        failureCode: 'AI_TOKEN_QUOTA_EXHAUSTED',
        tokenInterruptedAfterExtraction: true,
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates`) {
      summaryRequestCount += 1;
      const response = success(
        route,
        worldCandidateList('FAILED', summaryRequestCount === 1 ? 0 : 51),
      );
      if (summaryRequestCount === 1) {
        await response;
        markInitialSummaryLoaded();
        return;
      }
      return response;
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/episode-upload?workId=${workId}&batchId=${batchId}`
    + `&analysisJobIds=${analysisJobId}&currentAnalysisJobIds=${analysisJobId}`
    + '&jobType=SETTING_EXTRACTION',
  );

  const quotaDialog = page.getByRole('dialog', { name: '설정 비교가 일부 중단되었습니다' });
  await expect(quotaDialog).toBeVisible();
  await expect.poll(() => summaryRequestCount).toBeGreaterThanOrEqual(2);
  await expect(quotaDialog).toContainText('51개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.');
  await expect(quotaDialog).not.toContainText('http');
  await quotaDialog.getByRole('button', { name: '취소' }).click();

  await expect(page.getByText('설정 추출 후 일부 비교가 중단되었습니다', { exact: true })).toBeVisible();
  const interruptionAlert = page.locator('.episode-upload-alert--warning');
  const interruptionText = interruptionAlert.locator('span');
  await expect(interruptionText).toContainText('51개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.');
  await expect(interruptionText).toHaveCSS('color', 'rgb(138, 75, 0)');
  expect(await computedContrastRatio(
    interruptionText,
    interruptionAlert,
    page.locator('.episode-upload-page'),
  )).toBeGreaterThanOrEqual(4.5);
  await expect(page.getByRole('button', { name: '실패 회차 다시 시도' })).toHaveCount(0);

  await page.getByRole('button', { name: '남은 비교 확인' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/setting-review');
  await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBe('world');
  await expect(page.locator('.setting-review-screen')).toBeVisible();
  await expect(page.getByText(
    '51개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.',
    { exact: true },
  )).toBeVisible();
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(quotaDialog).toHaveCount(0);
});

test('사용량 문의 조회 실패 액션은 밝은 모달 배경에서도 읽을 수 있다', async ({ page }) => {
  await page.route('**/api/v1/ai-token-usages/me', route => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, data: null, error: { code: 'SERVER_ERROR' } }),
  }));
  await page.route('**/api/v1/ai-token-usages/extension-requests/me/pending', route => success(route, {
    pending: false,
    request: null,
  }));
  await page.goto('/landing');
  await page.evaluate(async () => {
    const { notifyAiTokenQuotaExhausted } = await import('/src/app/lib/ai-token-quota.ts');
    notifyAiTokenQuotaExhausted();
  });

  const quotaDialog = page.getByRole('dialog', { name: '기본 사용량을 모두 소진했습니다' });
  const retryAction = quotaDialog.getByRole('button', {
    name: '문의 정보를 불러오지 못했습니다. 다시 시도',
  });
  await expect(retryAction).toBeVisible();
  await expect(retryAction).toHaveCSS('color', 'rgb(138, 75, 0)');
  expect(await computedContrastRatio(
    retryAction,
    retryAction.locator('xpath=..'),
    quotaDialog,
  )).toBeGreaterThanOrEqual(4.5);
});

test('추가 사용량 요청 폼은 현재 미처리 요청 조회가 성공한 뒤에만 표시한다', async ({ page }) => {
  let pendingLookupCount = 0;
  let releaseReopenLookup!: () => void;
  const reopenLookupGate = new Promise<void>(resolve => {
    releaseReopenLookup = resolve;
  });

  await page.route('**/api/v1/ai-token-usages/me', route => success(route, aiUsage()));
  await page.route('**/api/v1/ai-token-usages/extension-requests/me/pending', async route => {
    pendingLookupCount += 1;
    if (pendingLookupCount === 1) {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, data: null, error: { code: 'SERVER_ERROR' } }),
      });
    }
    if (pendingLookupCount === 2) {
      return success(route, { pending: false, request: null });
    }

    await reopenLookupGate;
    return success(route, {
      pending: true,
      request: {
        id: '88888888-8888-4888-8888-888888888888',
        feedback: '다른 화면에서 먼저 제출해 현재 검토 중인 추가 사용량 요청입니다.',
        context: 'REQUEST_BLOCKED',
        status: 'PENDING',
        createdAt: '2026-08-25T20:00:00',
      },
    });
  });

  await page.goto('/landing');
  await page.evaluate(async () => {
    const { notifyAiTokenQuotaExhausted } = await import('/src/app/lib/ai-token-quota.ts');
    notifyAiTokenQuotaExhausted();
  });

  const quotaDialog = page.getByRole('dialog', { name: '기본 사용량을 모두 소진했습니다' });
  const feedbackInput = quotaDialog.getByRole('textbox', { name: '피드백과 사용 계획' });
  await expect(quotaDialog.getByText('이전 요청을 확인하지 못했어요', { exact: true })).toBeVisible();
  await expect(feedbackInput).toHaveCount(0);

  await quotaDialog.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(feedbackInput).toBeVisible();

  await quotaDialog.getByRole('button', { name: '사용량 안내 닫기' }).click();
  await expect(quotaDialog).toHaveCount(0);
  await page.evaluate(async () => {
    const { notifyAiTokenQuotaExhausted } = await import('/src/app/lib/ai-token-quota.ts');
    notifyAiTokenQuotaExhausted();
  });

  await expect.poll(() => pendingLookupCount).toBeGreaterThanOrEqual(3);
  await expect(quotaDialog.getByText('이전 요청을 확인하고 있어요', { exact: true })).toBeVisible();
  await expect(feedbackInput).toHaveCount(0);

  releaseReopenLookup();
  await expect(quotaDialog.getByText('추가 사용량 요청을 확인하고 있어요', { exact: true })).toBeVisible();
  await expect(feedbackInput).toHaveCount(0);
});

test('보관된 회차의 추출 후 토큰 중단은 보존 결과 검토로 진입시키지 않는다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
    if (pathname.endsWith('/ai-token-usages/extension-requests/me/pending')) {
      return noPendingExtensionRequest(route);
    }
    if (pathname === `/api/v1/works/${workId}`) {
      return success(route, { id: workId, title: '설원 연대기', genre: '판타지', latestEpisodeNo: 12 });
    }
    if (pathname === `/api/v1/works/${workId}/episodes`) return success(route, []);
    if (pathname === `/api/v1/works/${workId}/analysis-jobs/${analysisJobId}`) {
      return success(route, {
        id: analysisJobId,
        workId,
        workTitle: '설원 연대기',
        batchId,
        episodeId,
        episodes: [{
          id: episodeId,
          episodeNo: 12,
          title: '보관된 눈보라',
          status: 'ARCHIVED',
          updatedAt: '2026-08-16T10:00:00',
        }],
        jobType: 'SETTING_EXTRACTION',
        status: 'FAILED',
        currentStep: 'WORLD_SETTING_COMPARISON',
        failureCode: 'AI_TOKEN_QUOTA_EXHAUSTED',
        tokenInterruptedAfterExtraction: true,
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates`) {
      return success(route, worldCandidateList('FAILED', 1));
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/episode-upload?workId=${workId}&batchId=${batchId}`
    + `&analysisJobIds=${analysisJobId}&currentAnalysisJobIds=${analysisJobId}`
    + '&jobType=SETTING_EXTRACTION',
  );

  const quotaDialog = page.getByRole('dialog', { name: '설정 비교가 일부 중단되었습니다' });
  await expect(quotaDialog).toBeVisible();
  await quotaDialog.getByRole('button', { name: '취소' }).click();

  await expect(page.getByText('삭제되어 사용할 수 없는 회차가 있습니다', { exact: true })).toBeVisible();
  await expect(page.getByText('설정 추출 후 일부 비교가 중단되었습니다', { exact: true })).toHaveCount(0);
  await expect(page.locator('.episode-upload-alert--warning')).toHaveCount(0);
  await expect(page.getByText('사용할 수 없음', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '남은 비교 확인' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '분석 결과를 열 수 없습니다' })).toBeDisabled();
});

test('다중 회차 토큰 실패 알림은 모든 작업이 종료된 뒤 일부 실패로 집계한다', async ({ page }) => {
  let secondJobSettled = false;
  let secondJobRequestCount = 0;

  await page.route('**/api/v1/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
    if (pathname.endsWith('/ai-token-usages/extension-requests/me/pending')) {
      return noPendingExtensionRequest(route);
    }
    if (pathname === `/api/v1/works/${workId}`) {
      return success(route, { id: workId, title: '설원 연대기', genre: '판타지', latestEpisodeNo: 12 });
    }
    if (pathname === `/api/v1/works/${workId}/episodes`) return success(route, []);
    if (pathname === `/api/v1/works/${workId}/analysis-jobs/${analysisJobId}`) {
      return success(route, {
        id: analysisJobId,
        workId,
        workTitle: '설원 연대기',
        batchId,
        episodeId,
        episodes: [{
          id: episodeId,
          episodeNo: 12,
          title: '끝없는 눈보라',
          status: 'FAILED',
          updatedAt: '2026-08-16T10:00:00',
        }],
        jobType: 'SETTING_EXTRACTION',
        status: 'FAILED',
        currentStep: 'SETTING_EXTRACTION',
        errorMessage: 'AI 사용량이 부족해 분석이 중단되었습니다.',
        failureCode: 'AI_TOKEN_QUOTA_EXHAUSTED',
        tokenInterruptedAfterExtraction: false,
      });
    }
    if (pathname === `/api/v1/works/${workId}/analysis-jobs/${secondAnalysisJobId}`) {
      secondJobRequestCount += 1;
      return success(route, {
        id: secondAnalysisJobId,
        workId,
        workTitle: '설원 연대기',
        batchId,
        episodeId: secondEpisodeId,
        episodes: [{
          id: secondEpisodeId,
          episodeNo: 13,
          title: '해돋이 오는 자리',
          status: secondJobSettled ? 'ANALYZED' : 'ANALYZING',
          updatedAt: '2026-08-16T10:00:00',
        }],
        jobType: 'SETTING_EXTRACTION',
        status: secondJobSettled ? 'SUCCEEDED' : 'RUNNING',
        currentStep: secondJobSettled ? 'COMPLETED' : 'SETTING_EXTRACTION',
      });
    }
    return success(route, []);
  });

  await page.clock.install();
  await authenticate(page);
  await page.goto(
    `/episode-upload?workId=${workId}&batchId=${batchId}`
    + `&analysisJobIds=${analysisJobId},${secondAnalysisJobId}`
    + `&currentAnalysisJobIds=${analysisJobId},${secondAnalysisJobId}`
    + '&jobType=SETTING_EXTRACTION',
  );

  await expect.poll(() => secondJobRequestCount).toBe(1);
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(page.getByRole('dialog')).toHaveCount(0);

  secondJobSettled = true;
  await page.clock.fastForward(3_000);
  await expect.poll(() => secondJobRequestCount).toBeGreaterThanOrEqual(2);
  const quotaDialog = page.getByRole('dialog', { name: '일부 회차 분석이 중단되었습니다' });
  await expect(quotaDialog).toBeVisible();
  await expect(quotaDialog).toContainText('1개 회차 분석이 사용량 부족으로 중단됐습니다.');
  await expect(quotaDialog).not.toContainText('세계관 설정 비교');
  await quotaDialog.getByRole('button', { name: '취소' }).click();

  await expect(page.getByText('일부 회차 분석에 실패했습니다', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '실패 회차 다시 시도' })).toBeVisible();
});

test('분석 목록은 여러 종료 배치의 중단 수를 합치고 혼합 실패 복구를 우선한다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
    if (pathname.endsWith('/ai-token-usages/extension-requests/me/pending')) {
      return noPendingExtensionRequest(route);
    }
    if (pathname === '/api/v1/works') {
      return success(route, [{ id: workId, title: '설원 연대기', genre: '판타지', episodeCount: 14 }]);
    }
    if (pathname === `/api/v1/works/${workId}`) {
      return success(route, { id: workId, title: '설원 연대기', genre: '판타지', latestEpisodeNo: 14 });
    }
    if (pathname === `/api/v1/works/${workId}/episodes`) return success(route, []);
    if (pathname === `/api/v1/works/${workId}/analysis-jobs/batches`) {
      return success(route, {
        content: [{
          batchId,
          status: 'PARTIALLY_FAILED',
          episodeStartNo: 12,
          episodeEndNo: 13,
          episodeCount: 2,
          worldSettingTokenInterruptedCandidateCount: 1,
          jobGroups: [{
            jobType: 'SETTING_EXTRACTION',
            status: 'PARTIALLY_FAILED',
            totalJobCount: 2,
            pendingJobCount: 0,
            runningJobCount: 0,
            succeededJobCount: 0,
            failedJobCount: 2,
            currentAnalysisJobIds: [analysisJobId, secondAnalysisJobId],
          }],
          lastActivityAt: '2026-08-16T10:00:00',
        }, {
          batchId: otherBatchId,
          status: 'PARTIALLY_FAILED',
          episodeStartNo: 14,
          episodeEndNo: 14,
          episodeCount: 1,
          worldSettingTokenInterruptedCandidateCount: 2,
          jobGroups: [{
            jobType: 'SETTING_EXTRACTION',
            status: 'COMPLETED',
            totalJobCount: 1,
            pendingJobCount: 0,
            runningJobCount: 0,
            succeededJobCount: 0,
            failedJobCount: 1,
            currentAnalysisJobIds: ['33333333-3333-4333-8333-333333333335'],
          }],
          lastActivityAt: '2026-08-16T10:01:00',
        }],
        page: 0,
        size: 10,
        totalElements: 2,
        totalPages: 1,
        hasNext: false,
      });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);

  const quotaDialog = page.getByRole('dialog', { name: '설정 비교가 일부 중단되었습니다' });
  await expect(quotaDialog).toBeVisible();
  await expect(quotaDialog).toContainText('3개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.');
  await quotaDialog.getByRole('button', { name: '취소' }).click();

  const interruptedOnlyCard = page.getByRole('article').filter({ hasText: '14화' });
  const interruptedStatus = interruptedOnlyCard.getByText('세계관 비교 일부 중단', { exact: true });
  await expect(interruptedStatus).toHaveCSS('color', 'rgb(138, 75, 0)');
  expect(await computedContrastRatio(
    interruptedStatus,
    interruptedStatus,
    interruptedOnlyCard,
  )).toBeGreaterThanOrEqual(4.5);
  await expect(interruptedOnlyCard.locator('.analysis-batch-card__icon.analysis-tone--warning'))
    .toHaveCSS('color', 'rgb(217, 131, 36)');

  const mixedFailureCard = page.getByRole('article').filter({ hasText: '12~13화' });
  await expect(mixedFailureCard.getByText('일부 실패', { exact: true })).toBeVisible();
  await expect(mixedFailureCard.getByRole('button', { name: '실패 확인' })).toBeVisible();
  await expect(mixedFailureCard.getByRole('button', { name: '남은 비교 확인' })).toHaveCount(0);
  await mixedFailureCard.getByRole('button', { name: '실패 확인' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/episode-upload');
  await expect.poll(() => new URL(page.url()).searchParams.get('currentAnalysisJobIds'))
    .toBe(`${analysisJobId},${secondAnalysisJobId}`);
});

test('추출 전 회차 실패와 추출 후 비교 중단을 한 알림에 함께 안내한다', async ({ page }) => {
  let summaryRequestCount = 0;
  let markInitialSummaryLoaded!: () => void;
  const initialSummaryLoaded = new Promise<void>(resolve => {
    markInitialSummaryLoaded = resolve;
  });

  await page.route('**/api/v1/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
    if (pathname.endsWith('/ai-token-usages/extension-requests/me/pending')) {
      return noPendingExtensionRequest(route);
    }
    if (pathname === `/api/v1/works/${workId}`) {
      return success(route, { id: workId, title: '설원 연대기', genre: '판타지', latestEpisodeNo: 13 });
    }
    if (pathname === `/api/v1/works/${workId}/episodes`) return success(route, []);
    if (pathname === `/api/v1/works/${workId}/analysis-jobs/${analysisJobId}`) {
      await initialSummaryLoaded;
      return success(route, {
        id: analysisJobId,
        workId,
        workTitle: '설원 연대기',
        batchId,
        episodeId,
        episodes: [{
          id: episodeId,
          episodeNo: 12,
          title: '끝없는 눈보라',
          status: 'FAILED',
          updatedAt: '2026-08-16T10:00:00',
        }],
        jobType: 'SETTING_EXTRACTION',
        status: 'FAILED',
        currentStep: 'SETTING_EXTRACTION',
        failureCode: 'AI_TOKEN_QUOTA_EXHAUSTED',
        tokenInterruptedAfterExtraction: false,
      });
    }
    if (pathname === `/api/v1/works/${workId}/analysis-jobs/${secondAnalysisJobId}`) {
      await initialSummaryLoaded;
      return success(route, {
        id: secondAnalysisJobId,
        workId,
        workTitle: '설원 연대기',
        batchId,
        episodeId: secondEpisodeId,
        episodes: [{
          id: secondEpisodeId,
          episodeNo: 13,
          title: '해돋이 오는 자리',
          status: 'ANALYZED',
          updatedAt: '2026-08-16T10:00:00',
        }],
        jobType: 'SETTING_EXTRACTION',
        status: 'FAILED',
        currentStep: 'WORLD_SETTING_COMPARISON',
        failureCode: 'AI_TOKEN_QUOTA_EXHAUSTED',
        tokenInterruptedAfterExtraction: true,
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates`) {
      summaryRequestCount += 1;
      const response = success(
        route,
        worldCandidateList('FAILED', summaryRequestCount === 1 ? 0 : 7),
      );
      if (summaryRequestCount === 1) {
        await response;
        markInitialSummaryLoaded();
        return;
      }
      return response;
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/episode-upload?workId=${workId}&batchId=${batchId}`
    + `&analysisJobIds=${analysisJobId},${secondAnalysisJobId}`
    + `&currentAnalysisJobIds=${analysisJobId},${secondAnalysisJobId}`
    + '&jobType=SETTING_EXTRACTION',
  );

  const quotaDialog = page.getByRole('dialog', {
    name: '회차 분석과 설정 비교가 중단되었습니다',
  });
  await expect(quotaDialog).toBeVisible();
  await expect.poll(() => summaryRequestCount).toBeGreaterThanOrEqual(2);
  await expect(quotaDialog).toContainText('1개 회차 분석이 사용량 부족으로 중단됐습니다.');
  await expect(quotaDialog).toContainText('7개 세계관 설정 비교도 중단됐지만');
  await expect(quotaDialog).toContainText('검토 화면에서 남은 비교만 재개할 수 있습니다.');
});

test('배치 재개로 PENDING이 된 후보는 재진입해도 단건 재시도하지 않는다', async ({ page }) => {
  let phase: 'INTERRUPTED' | 'ACTIVE_WITH_REMAINDER' | 'REMAINDER_ONLY' = 'INTERRUPTED';
  let resumeRequestCount = 0;
  let singleRetryRequestCount = 0;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
    if (pathname.endsWith('/ai-token-usages/extension-requests/me/pending')) {
      return noPendingExtensionRequest(route);
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates`
      && request.method() === 'GET') {
      if (phase === 'INTERRUPTED') return success(route, worldCandidateList('FAILED', 1));
      if (phase === 'ACTIVE_WITH_REMAINDER') {
        return success(route, worldCandidateList('PENDING', 2, {
          pendingComparisonCount: 1,
          activeComparisonJobCount: 1,
          failedComparisonCount: 1,
          tokenInterruptedComparisonCount: 1,
          canResumeTokenInterruptedComparisons: true,
        }));
      }
      return success(route, worldCandidateList('FAILED', 1));
    }
    if (pathname === `/api/v1/works/${workId}/setting-candidates`) {
      return success(route, {
        batchId,
        totalCandidateCount: 0,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 0,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [], page: 0, size: 1, totalElements: 0, totalPages: 0, hasNext: false,
        },
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates/batches/${batchId}/resume-token-interrupted`
      && request.method() === 'POST') {
      resumeRequestCount += 1;
      phase = 'ACTIVE_WITH_REMAINDER';
      return success(route, {
        batchId,
        resumedCandidateCount: 1,
        activeCandidateCount: 1,
        remainingInterruptedCandidateCount: 1,
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates/${candidateId}/recompare`
      && request.method() === 'POST') {
      singleRetryRequestCount += 1;
      return success(route, worldCandidate('PENDING'));
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  const quotaDialog = page.getByRole('dialog', { name: '설정 비교가 일부 중단되었습니다' });
  await expect(quotaDialog).toBeVisible();
  await quotaDialog.getByRole('button', { name: '취소' }).click();
  await expect(page.getByText('1개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 비교' })).toHaveCount(0);

  const resumeBanner = page.locator('.world-token-resume-banner--warning');
  const resumeHeading = resumeBanner.locator('strong');
  await expect(resumeHeading).toHaveCSS('color', 'rgb(138, 75, 0)');
  expect(await computedContrastRatio(
    resumeHeading,
    resumeBanner,
    page.locator('.setting-review-screen'),
  )).toBeGreaterThanOrEqual(4.5);

  const groupQuotaBadge = page.locator('.world-candidate-group-card .review-badge')
    .filter({ hasText: '사용량 부족으로 중단' });
  const rowQuotaBadge = page.locator('.world-setting-diff-row .review-badge')
    .filter({ hasText: '사용량 부족으로 중단' });
  const quotaDetailNotice = page.locator('.world-candidate-detail-card').getByRole('status');
  for (const label of [groupQuotaBadge, rowQuotaBadge, quotaDetailNotice]) {
    await expect(label).toHaveCSS('color', 'rgb(138, 75, 0)');
  }
  expect(await computedContrastRatio(
    groupQuotaBadge,
    groupQuotaBadge,
    page.locator('.world-candidate-group-card.is-selected'),
  )).toBeGreaterThanOrEqual(4.5);
  expect(await computedContrastRatio(
    rowQuotaBadge,
    rowQuotaBadge,
    page.locator('.world-setting-diff-row'),
  )).toBeGreaterThanOrEqual(4.5);
  expect(await computedContrastRatio(
    quotaDetailNotice,
    quotaDetailNotice,
    page.locator('.world-candidate-detail-card'),
  )).toBeGreaterThanOrEqual(4.5);

  const initialResumeButton = page.getByRole('button', { name: '남은 비교 재개' });
  await expect(initialResumeButton).toHaveCSS('color', 'rgb(138, 75, 0)');
  expect(await computedContrastRatio(initialResumeButton)).toBeGreaterThanOrEqual(4.5);
  await initialResumeButton.click();

  await expect.poll(() => resumeRequestCount).toBe(1);
  const resumeButton = page.getByRole('button', { name: '남은 비교 재개' });
  await expect(page.getByText('비교 대기', { exact: true }).first()).toBeVisible();
  await expect(resumeButton).toBeDisabled();
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  expect(singleRetryRequestCount).toBe(0);

  await page.reload();
  await expect(quotaDialog).toHaveCount(0);
  await expect(page.getByText('비교 대기', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '남은 비교 재개' })).toBeDisabled();
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  expect(singleRetryRequestCount).toBe(0);

  phase = 'REMAINDER_ONLY';
  await expect(resumeButton).toBeEnabled({ timeout: 5_000 });
  expect(phase).toBe('REMAINDER_ONLY');
  expect(resumeRequestCount).toBe(1);
  expect(singleRetryRequestCount).toBe(0);
});

test('진행 중인 배치 재개 요청은 탭 재마운트 뒤에도 중복 실행하지 않는다', async ({ page }) => {
  let phase: 'INTERRUPTED' | 'ACTIVE_WITH_REMAINDER' = 'INTERRUPTED';
  let resumeRequestCount = 0;
  let completeResumeRequest!: () => void;
  const resumeRequestCompleted = new Promise<void>(resolve => {
    completeResumeRequest = resolve;
  });

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
    if (pathname.endsWith('/ai-token-usages/extension-requests/me/pending')) {
      return noPendingExtensionRequest(route);
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates`
      && request.method() === 'GET') {
      return success(route, phase === 'INTERRUPTED'
        ? worldCandidateList('FAILED', 1)
        : worldCandidateList('PENDING', 2, {
          pendingComparisonCount: 1,
          activeComparisonJobCount: 1,
          failedComparisonCount: 1,
          tokenInterruptedComparisonCount: 1,
          canResumeTokenInterruptedComparisons: true,
        }));
    }
    if (pathname === `/api/v1/works/${workId}/setting-candidates`) {
      return success(route, {
        batchId,
        totalCandidateCount: 0,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 0,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [], page: 0, size: 1, totalElements: 0, totalPages: 0, hasNext: false,
        },
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates/batches/${batchId}/resume-token-interrupted`
      && request.method() === 'POST') {
      resumeRequestCount += 1;
      await resumeRequestCompleted;
      phase = 'ACTIVE_WITH_REMAINDER';
      return success(route, {
        batchId,
        resumedCandidateCount: 1,
        activeCandidateCount: 1,
        remainingInterruptedCandidateCount: 1,
      });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  const quotaDialog = page.getByRole('dialog', { name: '설정 비교가 일부 중단되었습니다' });
  await expect(quotaDialog).toBeVisible();
  await quotaDialog.getByRole('button', { name: '취소' }).click();

  await page.getByRole('button', { name: /캐릭터 후보/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBeNull();
  await page.getByRole('button', { name: /세계관 후보/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBe('world');
  await expect(page.getByText(
    '1개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.',
    { exact: true },
  )).toBeVisible();
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(quotaDialog).toHaveCount(0);

  await page.getByRole('button', { name: '남은 비교 재개' }).click();
  await expect.poll(() => resumeRequestCount).toBe(1);

  await page.getByRole('button', { name: /캐릭터 후보/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBeNull();
  await page.getByRole('button', { name: /세계관 후보/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBe('world');
  await expect(page.getByText(
    '1개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.',
    { exact: true },
  )).toBeVisible();
  await expect(quotaDialog).toHaveCount(0);

  const remountedResumeButton = page.locator('.world-token-resume-banner--warning .review-action');
  try {
    await expect(remountedResumeButton).toBeDisabled();
    await expect(remountedResumeButton).toContainText('재개 요청 중');
  } finally {
    completeResumeRequest();
  }

  await expect(remountedResumeButton).toBeDisabled();
  await expect(remountedResumeButton).toContainText('남은 비교 재개');
  await expect(quotaDialog).toHaveCount(0);
  expect(resumeRequestCount).toBe(1);
});

test('재개 상태 배너 제목은 밝은 배경에서도 읽을 수 있다', async ({ page }) => {
  let phase: 'INTERRUPTED' | 'PROCESSING' | 'COMPLETED' = 'INTERRUPTED';
  let resumeRequestCount = 0;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
    if (pathname.endsWith('/ai-token-usages/extension-requests/me/pending')) {
      return noPendingExtensionRequest(route);
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates`
      && request.method() === 'GET') {
      if (phase === 'PROCESSING') {
        return success(route, worldCandidateList('PROCESSING', 1, { activeComparisonJobCount: 1 }));
      }
      return success(route, phase === 'COMPLETED'
        ? worldCandidateList('COMPLETED', 1)
        : worldCandidateList('FAILED', 1));
    }
    if (pathname === `/api/v1/works/${workId}/setting-candidates`) {
      return success(route, {
        batchId,
        totalCandidateCount: 0,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 0,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [], page: 0, size: 1, totalElements: 0, totalPages: 0, hasNext: false,
        },
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates/batches/${batchId}/resume-token-interrupted`
      && request.method() === 'POST') {
      resumeRequestCount += 1;
      if (resumeRequestCount > 1) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            data: null,
            error: { code: 'SERVER_ERROR', message: '남은 비교 재개 요청을 처리하지 못했습니다.' },
          }),
        });
      }
      phase = 'PROCESSING';
      return success(route, {
        batchId,
        resumedCandidateCount: 1,
        activeCandidateCount: 1,
        remainingInterruptedCandidateCount: 0,
      });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  const quotaDialog = page.getByRole('dialog', { name: '설정 비교가 일부 중단되었습니다' });
  await expect(quotaDialog).toBeVisible();
  await quotaDialog.getByRole('button', { name: '취소' }).click();
  await page.getByRole('button', { name: '남은 비교 재개' }).click();

  const progressBanner = page.locator('.world-token-resume-banner--progress');
  const progressHeading = progressBanner.locator('strong');
  await expect(progressHeading).toHaveCSS('color', 'rgb(0, 90, 175)');
  expect(await computedContrastRatio(
    progressHeading,
    progressBanner,
    page.locator('.setting-review-screen'),
  )).toBeGreaterThanOrEqual(4.5);

  phase = 'COMPLETED';
  const successBanner = page.locator('.world-token-resume-banner--success');
  const successHeading = successBanner.locator('strong');
  await expect(successHeading).toHaveCSS('color', 'rgb(6, 105, 71)', { timeout: 5_000 });
  expect(await computedContrastRatio(
    successHeading,
    successBanner,
    page.locator('.setting-review-screen'),
  )).toBeGreaterThanOrEqual(4.5);

  phase = 'INTERRUPTED';
  await page.reload();
  await expect(quotaDialog).toBeVisible();
  await quotaDialog.getByRole('button', { name: '취소' }).click();
  await page.getByRole('button', { name: '남은 비교 재개' }).click();

  const dangerBanner = page.locator('.world-token-resume-banner--danger');
  const dangerHeading = dangerBanner.locator('strong');
  await expect(dangerHeading).toHaveCSS('color', 'rgb(161, 38, 58)');
  expect(await computedContrastRatio(
    dangerHeading,
    dangerBanner,
    page.locator('.setting-review-screen'),
  )).toBeGreaterThanOrEqual(4.5);
});

test('토큰 중단과 일반 실패가 같은 그룹에 있으면 두 복구 경로를 함께 안내한다', async ({ page }) => {
  const mixedFailureList = worldCandidateList('FAILED', 2, {
    failedComparisonCount: 2,
    tokenInterruptedComparisonCount: 1,
    canResumeTokenInterruptedComparisons: true,
  });
  mixedFailureList.groups.content[0].changeCount = 2;
  mixedFailureList.groups.content[0].candidates = [
    worldCandidate('FAILED'),
    {
      ...worldCandidate('FAILED', 'LLM_NETWORK_ERROR'),
      id: secondCandidateId,
      settingName: '통행 규칙',
      extractedValue: '겨울에는 북문을 폐쇄한다.',
      evidenceSpans: [{ quote: '겨울이 오자 북문은 굳게 닫혔다.' }],
    },
  ];

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
    if (pathname.endsWith('/ai-token-usages/extension-requests/me/pending')) {
      return noPendingExtensionRequest(route);
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates`) {
      return success(route, mixedFailureList);
    }
    if (pathname === `/api/v1/works/${workId}/setting-candidates`) {
      return success(route, {
        batchId,
        totalCandidateCount: 0,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 0,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [], page: 0, size: 1, totalElements: 0, totalPages: 0, hasNext: false,
        },
      });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  const quotaDialog = page.getByRole('dialog', { name: '설정 비교가 일부 중단되었습니다' });
  await expect(quotaDialog).toBeVisible();
  await quotaDialog.getByRole('button', { name: '취소' }).click();

  const mixedFailureNotice = page.getByRole('status').filter({ hasText: '비교 중단·실패 혼합' });
  const mixedFailureBadge = page.locator('.world-candidate-group-card .review-badge')
    .filter({ hasText: '비교 중단·실패 혼합' });
  await expect(mixedFailureNotice).toBeVisible();
  await expect(mixedFailureNotice).toContainText(
    '사용량 부족으로 중단된 항목은 상단에서 재개하고, 그 외 실패 항목은 하단의 다시 비교로 처리해 주세요.',
  );
  for (const label of [mixedFailureBadge, mixedFailureNotice]) {
    await expect(label).toHaveCSS('color', 'rgb(161, 38, 58)');
  }
  expect(await computedContrastRatio(
    mixedFailureBadge,
    mixedFailureBadge,
    page.locator('.world-candidate-group-card.is-selected'),
  )).toBeGreaterThanOrEqual(4.5);
  expect(await computedContrastRatio(
    mixedFailureNotice,
    mixedFailureNotice,
    page.locator('.world-candidate-detail-card'),
  )).toBeGreaterThanOrEqual(4.5);
  await expect(page.getByRole('button', { name: '남은 비교 재개' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '다시 비교' })).toBeEnabled();
});

test('부분 재개는 새 토큰 중단만 최종 건수로 다시 알린다', async ({ page }) => {
  let phase: 'INTERRUPTED' | 'ACTIVE_WITH_REMAINDER' | 'REINTERRUPTED' | 'SETTLED_REMAINDER'
    = 'INTERRUPTED';
  let resumeRequestCount = 0;
  let worldCandidateRequestCount = 0;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
    if (pathname.endsWith('/ai-token-usages/extension-requests/me/pending')) {
      return noPendingExtensionRequest(route);
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates`
      && request.method() === 'GET') {
      worldCandidateRequestCount += 1;
      if (phase === 'ACTIVE_WITH_REMAINDER') {
        return success(route, worldCandidateList('PENDING', 2, {
          pendingComparisonCount: 1,
          activeComparisonJobCount: 1,
          failedComparisonCount: 1,
          tokenInterruptedComparisonCount: 1,
          canResumeTokenInterruptedComparisons: true,
        }));
      }
      return success(route, worldCandidateList(
        'FAILED',
        phase === 'SETTLED_REMAINDER' ? 1 : 2,
      ));
    }
    if (pathname === `/api/v1/works/${workId}/setting-candidates`) {
      return success(route, {
        batchId,
        totalCandidateCount: 0,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 0,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [], page: 0, size: 1, totalElements: 0, totalPages: 0, hasNext: false,
        },
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates/batches/${batchId}/resume-token-interrupted`
      && request.method() === 'POST') {
      resumeRequestCount += 1;
      phase = 'ACTIVE_WITH_REMAINDER';
      return success(route, {
        batchId,
        resumedCandidateCount: 1,
        activeCandidateCount: 1,
        remainingInterruptedCandidateCount: 1,
      });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  const quotaDialog = page.getByRole('dialog', { name: '설정 비교가 일부 중단되었습니다' });
  await expect(quotaDialog).toBeVisible();
  await expect(quotaDialog).toContainText('2개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.');
  await quotaDialog.getByRole('button', { name: '취소' }).click();

  await page.getByRole('button', { name: '남은 비교 재개' }).click();
  await expect.poll(() => resumeRequestCount).toBe(1);
  await expect(page.getByText(
    '1개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.',
    { exact: true },
  )).toBeVisible();
  await expect(quotaDialog).toHaveCount(0);

  const requestsBeforeReinterruption = worldCandidateRequestCount;
  phase = 'REINTERRUPTED';
  await expect.poll(() => worldCandidateRequestCount).toBeGreaterThan(requestsBeforeReinterruption);
  await expect(quotaDialog).toBeVisible({ timeout: 5_000 });
  await expect(quotaDialog).toContainText('2개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.');
  await quotaDialog.getByRole('button', { name: '취소' }).click();

  await page.getByRole('button', { name: '남은 비교 재개' }).click();
  await expect.poll(() => resumeRequestCount).toBe(2);
  await expect(quotaDialog).toHaveCount(0);

  const requestsBeforeSuccessfulSettlement = worldCandidateRequestCount;
  phase = 'SETTLED_REMAINDER';
  await expect.poll(() => worldCandidateRequestCount).toBeGreaterThan(requestsBeforeSuccessfulSettlement);
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(quotaDialog).toHaveCount(0);
});

test('재개한 비교에 일반 실패가 남으면 완료 대신 확인 필요를 표시한다', async ({ page }) => {
  let phase: 'INTERRUPTED' | 'FAILED' = 'INTERRUPTED';

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
    if (pathname.endsWith('/ai-token-usages/extension-requests/me/pending')) {
      return noPendingExtensionRequest(route);
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates`
      && request.method() === 'GET') {
      return success(
        route,
        phase === 'INTERRUPTED'
          ? worldCandidateList('FAILED', 1)
          : worldCandidateList('FAILED', 1, {}, 'LLM_NETWORK_ERROR'),
      );
    }
    if (pathname === `/api/v1/works/${workId}/setting-candidates`) {
      return success(route, {
        batchId,
        totalCandidateCount: 0,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 0,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [], page: 0, size: 1, totalElements: 0, totalPages: 0, hasNext: false,
        },
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates/batches/${batchId}/resume-token-interrupted`
      && request.method() === 'POST') {
      phase = 'FAILED';
      return success(route, {
        batchId,
        resumedCandidateCount: 1,
        activeCandidateCount: 0,
        remainingInterruptedCandidateCount: 0,
      });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  const quotaDialog = page.getByRole('dialog', { name: '설정 비교가 일부 중단되었습니다' });
  await expect(quotaDialog).toBeVisible();
  await quotaDialog.getByRole('button', { name: '취소' }).click();
  await page.getByRole('button', { name: '남은 비교 재개' }).click();

  await expect(page.getByText('1개 비교 결과를 추가로 확인해 주세요.')).toBeVisible();
  await expect(page.getByText('실패하거나 재비교가 필요한 후보에서 다시 비교해 주세요.')).toBeVisible();
  await expect(page.getByText('1개 남은 비교를 모두 처리했습니다.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다시 비교' })).toBeVisible();
});

test('분석 목록은 진행 중 중단 알림을 미루고 최종 건수로 재개한다', async ({ page }) => {
  let phase: 'RUNNING' | 'INTERRUPTED' | 'ACTIVE' | 'REINTERRUPTING' | 'REINTERRUPTED' = 'RUNNING';
  let resumeRequestCount = 0;
  let singleRetryRequestCount = 0;
  let analysisBatchRequestCount = 0;
  let latestAnalysisBatchInterruptedCount = -1;
  let worldCandidateRequestCount = 0;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
    if (pathname.endsWith('/ai-token-usages/extension-requests/me/pending')) {
      return noPendingExtensionRequest(route);
    }
    if (pathname === '/api/v1/works') {
      return success(route, [{ id: workId, title: '설원 연대기', genre: '판타지', episodeCount: 12 }]);
    }
    if (pathname === `/api/v1/works/${workId}`) {
      return success(route, { id: workId, title: '설원 연대기', genre: '판타지', latestEpisodeNo: 12 });
    }
    if (pathname === `/api/v1/works/${workId}/episodes`) return success(route, []);
    if (pathname === `/api/v1/works/${workId}/analysis-jobs/batches`
      && request.method() === 'GET') {
      analysisBatchRequestCount += 1;
      latestAnalysisBatchInterruptedCount = phase === 'RUNNING'
        ? 1
        : phase === 'INTERRUPTED'
          ? 2
          : phase === 'ACTIVE'
            ? 0
            : phase === 'REINTERRUPTING'
              ? 1
              : 2;
      return success(route, {
        content: [{
          batchId,
          status: phase === 'RUNNING' || phase === 'ACTIVE'
            ? 'IN_PROGRESS'
            : 'PARTIALLY_FAILED',
          episodeStartNo: 12,
          episodeEndNo: 12,
          episodeCount: 1,
          totalCandidateCount: 0,
          reviewedCandidateCount: 0,
          pendingCandidateCount: 0,
          worldSettingTotalCandidateCount: 1,
          worldSettingReviewedCandidateCount: 0,
          worldSettingPendingCandidateCount: 1,
          worldSettingTokenInterruptedCandidateCount: latestAnalysisBatchInterruptedCount,
          jobGroups: [{
            jobType: 'SETTING_EXTRACTION',
            status: 'REVIEW_REQUIRED',
            totalJobCount: 1,
            pendingJobCount: 0,
            runningJobCount: 0,
            succeededJobCount: 1,
            failedJobCount: 0,
            currentAnalysisJobIds: [analysisJobId],
          }],
          lastActivityAt: '2026-08-16T10:00:00',
        }],
        page: 0,
        size: 10,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates`
      && request.method() === 'GET') {
      worldCandidateRequestCount += 1;
      return success(
        route,
        phase === 'ACTIVE'
          ? worldCandidateList('PENDING', 2, {
              activeComparisonJobCount: 2,
              tokenInterruptedComparisonCount: 0,
              canResumeTokenInterruptedComparisons: false,
            })
          : phase === 'REINTERRUPTING'
            ? worldCandidateList('PENDING', 2, {
                pendingComparisonCount: 1,
                activeComparisonJobCount: 1,
                failedComparisonCount: 1,
                tokenInterruptedComparisonCount: 1,
                canResumeTokenInterruptedComparisons: true,
              })
            : worldCandidateList('FAILED', phase === 'INTERRUPTED' || phase === 'REINTERRUPTED' ? 2 : 1),
      );
    }
    if (pathname === `/api/v1/works/${workId}/setting-candidates`) {
      return success(route, {
        batchId,
        totalCandidateCount: 0,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 0,
        matchRequiredCandidateCount: 0,
        groups: {
          content: [], page: 0, size: 1, totalElements: 0, totalPages: 0, hasNext: false,
        },
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates/batches/${batchId}/resume-token-interrupted`
      && request.method() === 'POST') {
      resumeRequestCount += 1;
      phase = 'ACTIVE';
      return success(route, {
        batchId,
        resumedCandidateCount: 2,
        activeCandidateCount: 2,
        remainingInterruptedCandidateCount: 0,
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates/${candidateId}/recompare`
      && request.method() === 'POST') {
      singleRetryRequestCount += 1;
      return success(route, worldCandidate('PENDING'));
    }
    return success(route, []);
  });

  await page.clock.install();
  await authenticate(page);
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);

  const listQuotaDialog = page.getByRole('dialog', { name: '설정 비교가 일부 중단되었습니다' });
  await expect(listQuotaDialog).toHaveCount(0);
  await expect(page.getByText('분석 중', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '진행 보기' })).toBeVisible();

  phase = 'INTERRUPTED';
  await page.clock.fastForward(10_000);
  await expect.poll(() => latestAnalysisBatchInterruptedCount).toBe(2);
  await expect(listQuotaDialog).toBeVisible();
  await expect(listQuotaDialog).toContainText('2개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.');
  await listQuotaDialog.getByRole('button', { name: '취소' }).click();
  await page.clock.resume();

  await page.getByRole('button', { name: '남은 비교 확인' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/setting-review');

  const reviewQuotaDialog = page.getByRole('dialog', { name: '설정 비교가 일부 중단되었습니다' });
  await expect(page.getByText(
    '2개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.',
    { exact: true },
  )).toBeVisible();
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(reviewQuotaDialog).toHaveCount(0);
  const analysisBatchRequestsBeforeResume = analysisBatchRequestCount;
  await page.getByRole('button', { name: '남은 비교 재개' }).click();

  await expect.poll(() => resumeRequestCount).toBe(1);
  await expect(page.getByText('2개 남은 비교를 진행하고 있습니다.')).toBeVisible();
  await expect.poll(() => analysisBatchRequestCount).toBeGreaterThan(analysisBatchRequestsBeforeResume);
  expect(latestAnalysisBatchInterruptedCount).toBe(0);
  expect(singleRetryRequestCount).toBe(0);

  const requestsBeforePartialInterruption = worldCandidateRequestCount;
  phase = 'REINTERRUPTING';
  await expect.poll(() => worldCandidateRequestCount).toBeGreaterThan(requestsBeforePartialInterruption);
  await expect(page.getByText('1개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.')).toBeVisible();
  await expect(reviewQuotaDialog).toHaveCount(0);

  phase = 'REINTERRUPTED';
  await expect(reviewQuotaDialog).toBeVisible({ timeout: 5_000 });
  await expect(reviewQuotaDialog).toContainText('2개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.');
  expect(singleRetryRequestCount).toBe(0);
});
