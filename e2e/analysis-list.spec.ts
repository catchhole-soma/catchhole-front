import { expect, test } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const reviewBatchId = '22222222-2222-4222-8222-222222222222';
const reviewCandidateId = '33333333-3333-4333-8333-333333333333';

function batch(index: number) {
  const suffix = String(index).padStart(12, '0');
  return {
    batchId: `22222222-2222-4222-8222-${suffix}`,
    status: index === 11 ? 'REVIEW_REQUIRED' : 'COMPLETED',
    episodeStartNo: index,
    episodeEndNo: index,
    episodeCount: 1,
    totalCandidateCount: 2,
    reviewedCandidateCount: 2,
    pendingCandidateCount: 0,
    jobGroups: [{
      jobType: 'EPISODE_VALIDATION',
      status: 'COMPLETED',
      totalJobCount: 1,
      pendingJobCount: 0,
      runningJobCount: 0,
      succeededJobCount: 1,
      failedJobCount: 0,
      currentAnalysisJobIds: [`33333333-3333-4333-8333-${suffix}`],
    }],
    lastActivityAt: '2026-07-30T10:00:00',
  };
}

test('분석 목록은 업로드 배치를 서버에서 10개씩 페이지 이동한다', async ({ page }) => {
  const requestedPages: string[] = [];
  const eleventhBatch = batch(11);

  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    let data: unknown = [];

    if (pathname.endsWith('/auth/me')) {
      data = {
        id: 1,
        email: 'analysis-list@example.com',
        displayName: '분석 목록 테스트',
        phoneNumber: '01012345678',
        phoneVerified: false,
        role: 'AUTHOR',
        status: 'ACTIVE',
      };
    } else if (pathname.endsWith(`/${workId}/analysis-jobs/batches`)) {
      const apiPage = url.searchParams.get('page') ?? '0';
      requestedPages.push(`${apiPage}:${url.searchParams.get('size')}`);
      data = {
        content: apiPage === '1'
          ? [batch(11)]
          : Array.from({ length: 10 }, (_, index) => batch(index + 1)),
        page: Number(apiPage),
        size: 10,
        totalElements: 11,
        totalPages: 2,
        hasNext: apiPage === '0',
      };
    } else if (pathname === `/api/v1/works/${workId}/setting-candidates`) {
      data = {
        batchId: eleventhBatch.batchId,
        episodeStartNo: 11,
        episodeEndNo: 11,
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
      };
    } else if (pathname.endsWith(`/works/${workId}`)) {
      data = { id: workId, title: '페이지 작품', genre: '판타지', latestEpisodeNo: 11 };
    } else if (pathname.endsWith('/works')) {
      data = [{ id: workId, title: '페이지 작품', genre: '판타지', episodeCount: 11 }];
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'analysis-list-token'));
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);

  const firstEpisodeCard = page.getByRole('article').filter({
    hasText: /^1화\s*1개 회차/,
  });
  await expect(firstEpisodeCard).toHaveCount(1);
  await expect(firstEpisodeCard.getByRole('button', { name: '결과 보기' })).toBeVisible();
  await expect(firstEpisodeCard.getByRole('button')).toHaveCount(1);
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible();

  await firstEpisodeCard.getByRole('button', { name: '결과 보기' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/setting-review');
  await expect.poll(() => new URL(page.url()).searchParams.get('reviewStatus')).toBe('ALL');
  await page.getByRole('button', { name: '이전 화면' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');

  await page.getByRole('button', { name: '다음 페이지' }).click();

  await expect.poll(() => new URL(page.url()).searchParams.get('analysisPage')).toBe('2');
  const eleventhEpisodeCard = page.getByRole('article').filter({
    hasText: /^11화\s*1개 회차/,
  });
  await expect(eleventhEpisodeCard).toHaveCount(1);
  await expect(eleventhEpisodeCard.getByRole('button', { name: '결과 보기' })).toBeVisible();
  await expect(eleventhEpisodeCard.getByRole('button')).toHaveCount(1);
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible();
  expect(requestedPages).toContain('0:10');
  expect(requestedPages).toContain('1:10');

  await eleventhEpisodeCard.getByRole('button', { name: '결과 보기' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/setting-review');
  await expect.poll(() => new URL(page.url()).searchParams.get('reviewStatus')).toBeNull();
  await page.getByRole('button', { name: '이전 화면' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');
  await expect.poll(() => new URL(page.url()).searchParams.get('analysisPage')).toBe('2');
});

test('분석 목록의 결과 보기로 설정 후보 검토 화면에 바로 진입한다', async ({ page }) => {
  const requestedReviewContexts: Array<{
    batchId: string | null;
    reviewStatus: string | null;
  }> = [];
  const candidate = {
    id: reviewCandidateId,
    workId,
    episodeNo: 5,
    entityType: 'CHARACTER',
    entityName: '금발',
    rawEntityMention: '금발',
    matchedCharacterId: null,
    matchStatus: 'UNRESOLVED',
    attributeName: 'status.회복중',
    attributeNameEditable: true,
    attributeNamePrefix: 'status.',
    attributeValue: '회복(중) 효과',
    valueType: 'STRING',
    evidenceSpans: [{ quote: '회복 효과로 인해 신체가 빠르게 재생된다.' }],
    confidence: 0.8,
    reviewStatus: 'PENDING_REVIEW',
  };

  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    let data: unknown = [];

    if (pathname.endsWith('/auth/me')) {
      data = {
        id: 1,
        email: 'analysis-review@example.com',
        displayName: '분석 검토 테스트',
        phoneNumber: '01012345678',
        phoneVerified: false,
        role: 'AUTHOR',
        status: 'ACTIVE',
      };
    } else if (pathname.endsWith(`/${workId}/analysis-jobs/batches`)) {
      data = {
        content: [{
          batchId: reviewBatchId,
          status: 'REVIEW_REQUIRED',
          episodeStartNo: 5,
          episodeEndNo: 8,
          episodeCount: 4,
          totalCandidateCount: 1,
          reviewedCandidateCount: 0,
          pendingCandidateCount: 1,
          jobGroups: [{
            jobType: 'SETTING_EXTRACTION',
            status: 'REVIEW_REQUIRED',
            totalJobCount: 4,
            pendingJobCount: 0,
            runningJobCount: 0,
            succeededJobCount: 4,
            failedJobCount: 0,
            currentAnalysisJobIds: ['44444444-4444-4444-8444-444444444444'],
          }],
          lastActivityAt: '2026-07-30T10:26:00',
        }],
        page: 0,
        size: 10,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
      };
    } else if (pathname === `/api/v1/works/${workId}/setting-candidates`) {
      requestedReviewContexts.push({
        batchId: url.searchParams.get('batchId'),
        reviewStatus: url.searchParams.get('reviewStatus'),
      });
      data = {
        batchId: reviewBatchId,
        episodeStartNo: 5,
        episodeEndNo: 8,
        episodeCount: 4,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 1,
        candidates: {
          content: [candidate],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
          hasNext: false,
        },
      };
    } else if (pathname === `/api/v1/works/${workId}/setting-candidates/${reviewCandidateId}`) {
      data = candidate;
    } else if (pathname.endsWith(`/works/${workId}`)) {
      data = { id: workId, title: '검토 작품', genre: '판타지', latestEpisodeNo: 8 };
    } else if (pathname.endsWith('/works')) {
      data = [{ id: workId, title: '검토 작품', genre: '판타지', episodeCount: 8 }];
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'analysis-review-token'));
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  const analysisCard = page.getByRole('article');
  await expect(analysisCard.getByRole('button')).toHaveCount(1);
  await analysisCard.getByRole('button', { name: '결과 보기' }).click();

  await expect.poll(() => new URL(page.url()).pathname).toBe('/setting-review');
  await expect.poll(() => new URL(page.url()).searchParams.get('workId')).toBe(workId);
  await expect.poll(() => new URL(page.url()).searchParams.get('batchId')).toBe(reviewBatchId);
  await expect.poll(() => new URL(page.url()).searchParams.get('jobType')).toBe('SETTING_EXTRACTION');
  await expect(page.getByRole('heading', { name: '금발' })).toBeVisible();
  await expect.poll(() => requestedReviewContexts.at(-1)).toEqual({
    batchId: reviewBatchId,
    reviewStatus: 'PENDING_REVIEW',
  });
  await expect.poll(() => page.evaluate(() => (
    window.history.state?.usr?.returnToAnalysisList
  ))).toBe(`/dashboard?workId=${workId}&nav=analyses`);

  await page.getByRole('button', { name: '이전 화면' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');
  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
});

test('원고 목록 배너는 과거 실패보다 최신 분석 배치 상태를 표시한다', async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    let data: unknown = [];

    if (pathname.endsWith('/auth/me')) {
      data = {
        id: 1,
        email: 'analysis-banner@example.com',
        displayName: '분석 배너 테스트',
        phoneNumber: '01012345678',
        phoneVerified: false,
        role: 'AUTHOR',
        status: 'ACTIVE',
      };
    } else if (pathname.endsWith(`/${workId}/analysis-jobs/batches`)) {
      data = {
        content: [
          {
            ...batch(12),
            status: 'REVIEW_REQUIRED',
            pendingCandidateCount: 1,
            reviewedCandidateCount: 0,
          },
          {
            ...batch(11),
            status: 'FAILED',
            jobGroups: [{
              ...batch(11).jobGroups[0],
              status: 'FAILED',
              succeededJobCount: 0,
              failedJobCount: 1,
            }],
          },
        ],
        page: 0,
        size: 10,
        totalElements: 2,
        totalPages: 1,
        hasNext: false,
      };
    } else if (pathname.endsWith(`/${workId}/episodes`)) {
      data = [];
    } else if (pathname.endsWith(`/works/${workId}`)) {
      data = { id: workId, title: '배너 작품', genre: '판타지', latestEpisodeNo: 12 };
    } else if (pathname.endsWith('/works')) {
      data = [{ id: workId, title: '배너 작품', genre: '판타지', episodeCount: 12 }];
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data, error: null }),
    });
  });

  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'analysis-banner-token'));
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);

  await expect(page.getByText('검토할 설정 후보가 있습니다.')).toBeVisible();
  await expect(page.getByText('일부 분석에 실패했습니다.')).toHaveCount(0);
});
