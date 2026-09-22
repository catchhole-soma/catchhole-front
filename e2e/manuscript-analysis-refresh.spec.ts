import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const episodeId = '33333333-3333-4333-8333-333333333333';

function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data, error: null }) });
}

function episode(analysisStatus: string) {
  return { id: episodeId, batchId, episodeNo: 29, title: '처음 분석하는 회차',
    originalFilename: '29.txt', charCount: 100, analysisStatus };
}

function overview(status: string) {
  return { content: [{ batchId, status, episodeStartNo: 29, episodeEndNo: 32, episodeCount: 4 }],
    page: 0, size: 10, totalElements: 1, totalPages: 1, hasNext: false };
}

async function mockDashboard(page: Page, handlers: {
  episodes: (route: Route) => Promise<void>;
  overview: (route: Route) => Promise<void>;
}) {
  await page.route('**/api/v1/**', route => {
    expect(route.request().method()).toBe('GET');
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return success(route, {
      id: 1, email: 'manuscript-refresh@example.com', displayName: '목록 갱신', role: 'AUTHOR', status: 'ACTIVE',
    });
    if (path.endsWith(`/${workId}/episodes`)) return handlers.episodes(route);
    if (path.endsWith(`/${workId}/analysis-jobs/batches`)) return handlers.overview(route);
    const work = { id: workId, title: '목록 갱신 작품', genre: '판타지', episodeCount: 32 };
    if (path.endsWith(`/works/${workId}`)) return success(route, work);
    if (path.endsWith('/works')) return success(route, [work]);
    return success(route, []);
  });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'isolated-manuscript-refresh-test'));
}

test('진행 배너가 다른 화면의 분석 시작을 알면 오래된 원고 목록을 즉시 갱신한다', async ({ page }) => {
  let episodeRequests = 0;
  let releaseOverview!: () => void;
  const overviewReady = new Promise<void>(resolve => { releaseOverview = resolve; });
  await mockDashboard(page, {
    episodes: route => {
      episodeRequests += 1;
      return success(route, [episode(episodeRequests === 1 ? 'REANALYSIS_REQUIRED' : 'IN_PROGRESS')]);
    },
    overview: async route => {
      await overviewReady;
      await success(route, overview('IN_PROGRESS'));
    },
  });
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);
  const row = page.locator('.manuscript-row');
  await expect(row.getByRole('button', { name: '재분석', exact: true })).toBeEnabled();
  await expect(row.locator('.manuscript-status')).toHaveText('재분석 필요');
  releaseOverview();
  await expect(page.getByText('진행 중인 분석이 있습니다.', { exact: true })).toBeVisible();
  await expect(row.locator('.manuscript-status')).toHaveText('분석 중');
  await expect(row.getByRole('button', { name: '재분석', exact: true })).toHaveCount(0);
  await expect(row.getByRole('button', { name: '파일 변경', exact: true })).toBeDisabled();
  await expect(row.getByRole('button', { name: '삭제', exact: true })).toBeDisabled();
  expect(episodeRequests).toBeGreaterThanOrEqual(2);
});

test('회차 행이 진행 중이 아니어도 배치 분석을 따라 갱신하고 종료 때 마지막 조회 후 멈춘다', async ({ page }) => {
  let episodeRequests = 0;
  let overviewRequests = 0;
  let releaseCompletion!: () => void;
  const completionReady = new Promise<void>(resolve => { releaseCompletion = resolve; });
  await mockDashboard(page, {
    episodes: route => {
      episodeRequests += 1;
      return success(route, [episode('COMPLETED')]);
    },
    overview: async route => {
      overviewRequests += 1;
      if (overviewRequests === 1) await success(route, overview('IN_PROGRESS'));
      else {
        await completionReady;
        await success(route, overview('COMPLETED'));
      }
    },
  });
  await page.clock.install();
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);
  await expect(page.locator('.manuscript-status')).toHaveText('분석 완료');
  await expect(page.getByText('진행 중인 분석이 있습니다.', { exact: true })).toBeVisible();
  await expect.poll(() => episodeRequests).toBeGreaterThanOrEqual(2);
  const beforePolling = episodeRequests;
  await page.clock.fastForward(10_000);
  await expect.poll(() => overviewRequests).toBe(2);
  await expect.poll(() => episodeRequests).toBe(beforePolling + 1);
  const beforeCompletion = episodeRequests;
  releaseCompletion();
  await expect(page.getByText('진행 중인 분석이 있습니다.', { exact: true })).toHaveCount(0);
  await expect.poll(() => episodeRequests).toBe(beforeCompletion + 1);
  const finalEpisodeRequests = episodeRequests;
  const finalOverviewRequests = overviewRequests;
  await page.clock.fastForward(30_000);
  expect(episodeRequests).toBe(finalEpisodeRequests);
  expect(overviewRequests).toBe(finalOverviewRequests);
});

test('원고 교체는 완료된 뒤 회차를 유지하고 사용자가 시작한 해당 회차만 직접 검토로 재분석한다', async ({ page }) => {
  let replaced = false;
  let replacementRequests = 0;
  const analysisRequests: unknown[] = [];
  const laterEpisodeId = '44444444-4444-4444-8444-444444444444';
  const jobId = '55555555-5555-4555-8555-555555555555';
  const work = { id: workId, title: '원고 교체 확인', genre: '판타지', episodeCount: 30 };
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith(`/${episodeId}/file`) && request.method() === 'PUT') {
      replacementRequests += 1;
      replaced = true;
      return success(route, { ...episode('REANALYSIS_REQUIRED'), originalFilename: '29-revised.txt' });
    }
    if (path.endsWith(`/${workId}/analysis-jobs`) && request.method() === 'POST') {
      analysisRequests.push(request.postDataJSON());
      return success(route, [{ id: jobId, episodeId, status: 'PENDING', analysisMode: 'CONFIRMED_ONLY', reviewMode: 'MANUAL' }]);
    }
    expect(request.method()).toBe('GET');
    if (path.endsWith('/auth/me')) return success(route, {
      id: 1, email: 'replacement@example.com', displayName: '원고 교체', role: 'AUTHOR', status: 'ACTIVE',
    });
    if (path.endsWith(`/${workId}/episodes`)) return success(route, [
      { ...episode(replaced ? 'REANALYSIS_REQUIRED' : 'COMPLETED'), title: '교체 대상 29화',
        originalFilename: replaced ? '29-revised.txt' : '29.txt' },
      { ...episode('COMPLETED'), id: laterEpisodeId, episodeNo: 30, title: '완료 결과 보존 30화', originalFilename: '30.txt' },
    ]);
    if (path.endsWith(`/${workId}/analysis-jobs/batches`)) return success(route, overview('COMPLETED'));
    if (path.endsWith(`/analysis-jobs/${jobId}`)) return success(route, {
      id: jobId, episodeId, batchId, status: 'PENDING', analysisMode: 'CONFIRMED_ONLY', reviewMode: 'MANUAL',
    });
    if (path.endsWith(`/works/${workId}`)) return success(route, work);
    if (path.endsWith('/works')) return success(route, [work]);
    return success(route, []);
  });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'isolated-replacement-test'));
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);
  const replacedRow = page.locator('.manuscript-row').filter({ hasText: '교체 대상 29화' });
  const laterRow = page.locator('.manuscript-row').filter({ hasText: '완료 결과 보존 30화' });
  await replacedRow.getByRole('button', { name: '파일 변경', exact: true }).click();
  const replaceDialog = page.getByRole('dialog', { name: '회차 파일 변경', exact: true });
  await expect(replaceDialog.getByText(/확정 설정과 이미 완료된 뒤 회차의 분석 결과는 유지됩니다/)).toBeVisible();
  await replaceDialog.locator('input[type=file]').setInputFiles({
    name: '29-revised.txt', mimeType: 'text/plain', buffer: Buffer.from('29화의 수정한 원고입니다.'),
  });
  await replaceDialog.getByRole('button', { name: '파일 변경', exact: true }).click();
  await expect(replaceDialog).toHaveCount(0);
  expect(replacementRequests).toBe(1);
  await expect(replacedRow.locator('.manuscript-status')).toHaveText('재분석 필요');
  await expect(laterRow.locator('.manuscript-status')).toHaveText('분석 완료');
  await expect(laterRow.getByRole('button', { name: '재분석', exact: true })).toHaveCount(0);
  expect(analysisRequests).toHaveLength(0);

  await replacedRow.getByRole('button', { name: '재분석', exact: true }).click();
  const reanalysisDialog = page.getByRole('dialog', { name: '이 회차를 다시 분석할까요?' });
  await expect(reanalysisDialog.getByText(/29화만 다시 분석합니다/)).toBeVisible();
  await expect(reanalysisDialog.getByText(/현재 설정을 유지하고 이력에 저장합니다/)).toBeVisible();
  await expect(reanalysisDialog.getByText(/현재 설정에도 반영할 수 있습니다/)).toBeVisible();
  await expect(reanalysisDialog.getByText(/후속 회차가/)).toContainText('1개');
  expect(analysisRequests).toHaveLength(0);

  await page.setViewportSize({ width: 320, height: 568 });
  const confirm = reanalysisDialog.getByRole('button', { name: '재분석 시작', exact: true });
  await expect(confirm).toBeInViewport();
  await expect(reanalysisDialog.getByRole('button', { name: '취소', exact: true })).toBeInViewport();
  const modalBox = await reanalysisDialog.boundingBox();
  expect(modalBox!.y).toBeGreaterThanOrEqual(0);
  expect(modalBox!.y + modalBox!.height).toBeLessThanOrEqual(568);
  await confirm.click();
  await expect.poll(() => analysisRequests).toEqual([{ jobType: 'SETTING_EXTRACTION', batchId, episodeId, reviewMode: 'MANUAL' }]);
  await expect(page).toHaveURL(new RegExp(`currentAnalysisJobIds=${jobId}`));
});
