import { expect, test } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';

function batch(index: number) {
  const suffix = String(index).padStart(12, '0');
  return {
    batchId: `22222222-2222-4222-8222-${suffix}`,
    status: 'COMPLETED',
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
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '다음 페이지' }).click();

  await expect.poll(() => new URL(page.url()).searchParams.get('analysisPage')).toBe('2');
  const eleventhEpisodeCard = page.getByRole('article').filter({
    hasText: /^11화\s*1개 회차/,
  });
  await expect(eleventhEpisodeCard).toHaveCount(1);
  await expect(eleventhEpisodeCard.getByRole('button', { name: '결과 보기' })).toBeVisible();
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible();
  expect(requestedPages).toContain('0:10');
  expect(requestedPages).toContain('1:10');
});
