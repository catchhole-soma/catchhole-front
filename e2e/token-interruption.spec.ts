import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const analysisJobId = '33333333-3333-4333-8333-333333333333';
const secondAnalysisJobId = '33333333-3333-4333-8333-333333333334';
const episodeId = '44444444-4444-4444-8444-444444444444';
const secondEpisodeId = '44444444-4444-4444-8444-444444444445';
const candidateId = '55555555-5555-4555-8555-555555555555';

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

type ComparisonStatus = 'FAILED' | 'PENDING' | 'PROCESSING';

function worldCandidate(comparisonStatus: ComparisonStatus) {
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
      ? 'AI 사용량이 부족해 세계관 설정 비교를 완료하지 못했습니다.'
      : null,
    comparisonFailureCode: comparisonStatus === 'FAILED'
      ? 'AI_TOKEN_QUOTA_EXHAUSTED'
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
) {
  const interrupted = comparisonStatus === 'FAILED';
  const pending = comparisonStatus === 'PENDING';
  const candidate = worldCandidate(comparisonStatus);
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
    failedComparisonCount: interrupted ? count : 0,
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
        status: comparisonStatus,
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
  await quotaDialog.getByRole('button', { name: '확인' }).click();

  await expect(page.getByText('설정 추출 후 일부 비교가 중단되었습니다', { exact: true })).toBeVisible();
  await expect(page.getByText(/51개 세계관 설정 비교가 사용량 부족으로 중단됐습니다/)).toBeVisible();
  await expect(page.getByRole('button', { name: '실패 회차 다시 시도' })).toHaveCount(0);

  await page.getByRole('button', { name: '남은 비교 확인' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/setting-review');
  await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBe('world');
});

test('다중 회차 토큰 실패 알림은 모든 작업을 불러온 뒤 일부 실패로 집계한다', async ({ page }) => {
  let markFailedJobLoaded!: () => void;
  const failedJobLoaded = new Promise<void>(resolve => {
    markFailedJobLoaded = resolve;
  });
  let releaseSuccessfulJob!: () => void;
  const successfulJobGate = new Promise<void>(resolve => {
    releaseSuccessfulJob = resolve;
  });

  await page.route('**/api/v1/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
    if (pathname === `/api/v1/works/${workId}`) {
      return success(route, { id: workId, title: '설원 연대기', genre: '판타지', latestEpisodeNo: 12 });
    }
    if (pathname === `/api/v1/works/${workId}/episodes`) return success(route, []);
    if (pathname === `/api/v1/works/${workId}/analysis-jobs/${analysisJobId}`) {
      await success(route, {
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
      markFailedJobLoaded();
      return;
    }
    if (pathname === `/api/v1/works/${workId}/analysis-jobs/${secondAnalysisJobId}`) {
      await successfulJobGate;
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
        status: 'SUCCEEDED',
        currentStep: 'COMPLETED',
      });
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

  await failedJobLoaded;
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await expect(page.getByRole('dialog')).toHaveCount(0);

  releaseSuccessfulJob();
  const quotaDialog = page.getByRole('dialog', { name: '일부 회차 분석이 중단되었습니다' });
  await expect(quotaDialog).toBeVisible();
  await expect(quotaDialog).toContainText('1개 회차 분석이 사용량 부족으로 중단됐습니다.');
  await expect(quotaDialog).not.toContainText('세계관 설정 비교');
  await quotaDialog.getByRole('button', { name: '확인' }).click();

  await expect(page.getByText('일부 회차 분석에 실패했습니다', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '실패 회차 다시 시도' })).toBeVisible();
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
  await quotaDialog.getByRole('button', { name: '확인' }).click();
  await expect(page.getByText('1개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 비교' })).toHaveCount(0);

  await page.getByRole('button', { name: '남은 비교 재개' }).click();

  await expect.poll(() => resumeRequestCount).toBe(1);
  const resumeButton = page.getByRole('button', { name: '남은 비교 재개' });
  await expect(page.getByText('비교 대기', { exact: true }).first()).toBeVisible();
  await expect(resumeButton).toBeDisabled();
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  expect(singleRetryRequestCount).toBe(0);

  await page.reload();
  await expect(quotaDialog).toBeVisible();
  await quotaDialog.getByRole('button', { name: '확인' }).click();
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

test('분석 목록은 진행 중 중단 알림을 미루고 최종 건수로 재개한다', async ({ page }) => {
  let phase: 'RUNNING' | 'INTERRUPTED' | 'ACTIVE' | 'REINTERRUPTED' = 'RUNNING';
  let resumeRequestCount = 0;
  let singleRetryRequestCount = 0;
  let analysisBatchRequestCount = 0;
  let latestAnalysisBatchInterruptedCount = -1;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
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
            : 1;
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
      return success(
        route,
        phase === 'ACTIVE'
          ? worldCandidateList('PENDING', 2, {
              activeComparisonJobCount: 2,
              tokenInterruptedComparisonCount: 0,
              canResumeTokenInterruptedComparisons: false,
            })
          : worldCandidateList('FAILED', phase === 'INTERRUPTED' ? 2 : 1),
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
  await listQuotaDialog.getByRole('button', { name: '확인' }).click();
  await page.clock.resume();

  await page.getByRole('button', { name: '남은 비교 확인' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/setting-review');

  const reviewQuotaDialog = page.getByRole('dialog', { name: '설정 비교가 일부 중단되었습니다' });
  await expect(reviewQuotaDialog).toBeVisible();
  await expect(reviewQuotaDialog).toContainText('2개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.');
  await reviewQuotaDialog.getByRole('button', { name: '확인' }).click();
  const analysisBatchRequestsBeforeResume = analysisBatchRequestCount;
  await page.getByRole('button', { name: '남은 비교 재개' }).click();

  await expect.poll(() => resumeRequestCount).toBe(1);
  await expect(page.getByText('2개 남은 비교를 진행하고 있습니다.')).toBeVisible();
  await expect.poll(() => analysisBatchRequestCount).toBeGreaterThan(analysisBatchRequestsBeforeResume);
  expect(latestAnalysisBatchInterruptedCount).toBe(0);
  expect(singleRetryRequestCount).toBe(0);

  phase = 'REINTERRUPTED';
  await expect(reviewQuotaDialog).toBeVisible({ timeout: 5_000 });
  await expect(reviewQuotaDialog).toContainText('1개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.');
  expect(singleRetryRequestCount).toBe(0);
});
