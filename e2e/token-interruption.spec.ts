import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const analysisJobId = '33333333-3333-4333-8333-333333333333';
const episodeId = '44444444-4444-4444-8444-444444444444';
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

function worldCandidate(comparisonStatus: 'FAILED' | 'PROCESSING') {
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

function worldCandidateList(comparisonStatus: 'FAILED' | 'PROCESSING', count: number) {
  const interrupted = comparisonStatus === 'FAILED';
  const candidate = worldCandidate(comparisonStatus);
  return {
    batchId,
    episodeStartNo: 12,
    episodeEndNo: 12,
    episodeCount: 1,
    totalCandidateCount: count,
    reviewedCandidateCount: 0,
    pendingCandidateCount: count,
    pendingComparisonCount: 0,
    processingComparisonCount: interrupted ? 0 : count,
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
        status: interrupted ? 'FAILED' : 'PROCESSING',
        candidates: [candidate],
      }],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
    },
  };
}

test('비동기 토큰 중단은 전체 실패와 구분하고 보존된 후보 검토로 연결한다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
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
      return success(route, worldCandidateList('FAILED', 51));
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

test('1차 추출 전 비동기 토큰 부족은 회차 전체 실패 안내와 재시도를 제공한다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
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
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(
    `/episode-upload?workId=${workId}&batchId=${batchId}`
    + `&analysisJobIds=${analysisJobId}&currentAnalysisJobIds=${analysisJobId}`
    + '&jobType=SETTING_EXTRACTION',
  );

  const quotaDialog = page.getByRole('dialog', { name: '회차 분석이 중단되었습니다' });
  await expect(quotaDialog).toBeVisible();
  await expect(quotaDialog).toContainText('1개 회차 분석이 사용량 부족으로 중단됐습니다.');
  await expect(quotaDialog).not.toContainText('세계관 설정 비교');
  await quotaDialog.getByRole('button', { name: '확인' }).click();

  await expect(page.getByText('회차 분석에 실패했습니다', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '실패 회차 다시 시도' })).toBeVisible();
});

test('남은 세계관 비교 재개는 배치 API를 한 번 호출하고 진행 상태를 갱신한다', async ({ page }) => {
  let comparisonStatus: 'FAILED' | 'PROCESSING' = 'FAILED';
  let resumeRequestCount = 0;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, aiUsage());
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates`
      && request.method() === 'GET') {
      return success(route, worldCandidateList(comparisonStatus, 1));
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
      comparisonStatus = 'PROCESSING';
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
  await quotaDialog.getByRole('button', { name: '확인' }).click();
  await expect(page.getByText('1개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 비교' })).toHaveCount(0);

  await page.getByRole('button', { name: '남은 비교 재개' }).click();

  await expect.poll(() => resumeRequestCount).toBe(1);
  await expect(page.getByText('1개 남은 비교를 진행하고 있습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '남은 비교 재개' })).toHaveCount(0);
});
