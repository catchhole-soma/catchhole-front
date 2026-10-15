import type { Page } from '@playwright/test';

/** Explicit episode fixtures for the real source-aware Job-list contract. */
export async function installEpisodeSourceList(page: Page, workId: string,
  jobs: Array<{ id: string; batchId: string; episodeNo: number; episodeId?: string;
    status?: string; jobType?: string }>) {
  await page.route(`**/api/v1/works/${workId}/analysis-jobs`, route => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      success: true, error: null, data: jobs.map(({ episodeNo, ...job }) => ({ ...job, workId,
        jobType: job.jobType ?? 'SETTING_EXTRACTION', status: job.status ?? 'SUCCEEDED',
        source: { sourceKind: 'EPISODE', episodeId: job.episodeId ?? job.id, episodeNo,
          settingBookId: null, settingBookName: null, revisionId: null, revisionNo: null, contentHash: null },
      })),
    }) });
  });
}
