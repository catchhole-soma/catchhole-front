import { expect, test, type Page } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const failedBatchId = '22222222-2222-4222-8222-222222222222';
const runningBatchId = '33333333-3333-4333-8333-333333333333';
const failedJobId = '44444444-4444-4444-8444-444444444444';
const runningJobId = '55555555-5555-4555-8555-555555555555';

const group = (status: string, jobId: string, failed: number) => ({
  jobType: 'SETTING_EXTRACTION', status, totalJobCount: 1, succeededJobCount: 0,
  runningJobCount: status === 'IN_PROGRESS' ? 1 : 0, pendingJobCount: 0, failedJobCount: failed,
  canceledJobCount: 0, currentAnalysisJobIds: [jobId],
});
/** 101화를 지운 뒤 남은 실패 묶음. 서버가 기록을 지울 수 있다고 알려 준다. */
const failedBatch = {
  batchId: failedBatchId, uploadType: 'SINGLE_EPISODE', status: 'FAILED', episodeStatus: 'FAILED',
  episodeStartNo: 101, episodeEndNo: 101, episodeCount: 1, jobGroups: [group('FAILED', failedJobId, 1)],
  episodeJobGroups: [group('FAILED', failedJobId, 1)], settingBooks: [], historyDeletable: true,
  lastActivityAt: '2026-11-04T08:32:00',
};
const runningBatch = {
  batchId: runningBatchId, uploadType: 'MULTI_EPISODE_MULTI_FILE', status: 'IN_PROGRESS', episodeStatus: 'IN_PROGRESS',
  episodeStartNo: 96, episodeEndNo: 100, episodeCount: 5, jobGroups: [group('IN_PROGRESS', runningJobId, 0)],
  episodeJobGroups: [group('IN_PROGRESS', runningJobId, 0)], settingBooks: [], historyDeletable: false,
  lastActivityAt: '2026-11-03T08:32:00',
};

async function setup(page: Page, deleteResponse: { status: number; body: unknown } = { status: 200, body: null }) {
  const deletes: string[] = [];
  let deleted = false;
  await page.addInitScript(() => localStorage.setItem('accessToken', 'synthetic-history-delete-test'));
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'DELETE' && path.includes('/analysis-jobs/batches/')) {
      deletes.push(path);
      if (deleteResponse.status === 200) deleted = true;
      return route.fulfill({
        status: deleteResponse.status,
        contentType: 'application/json',
        body: JSON.stringify(deleteResponse.status === 200
          ? { success: true, message: '분석 기록이 삭제되었습니다.', data: null, error: null }
          : { success: false, message: (deleteResponse.body as { message: string }).message, data: null, error: deleteResponse.body }),
      });
    }
    const content = deleted ? [runningBatch] : [failedBatch, runningBatch];
    const data = path.endsWith('/auth/me')
      ? { id: 1, email: 'history@example.test', displayName: '기록', role: 'AUTHOR', status: 'ACTIVE' }
      : path.endsWith('/analysis-jobs/batches')
        ? { content, page: 0, size: 10, totalPages: 1, totalElements: content.length }
        : path === `/api/v1/works/${workId}` ? { id: workId, title: '기록 작품', lifecycleStatus: 'ACTIVE' }
          : path === '/api/v1/works' ? [{ id: workId, title: '기록 작품', episodeCount: 1 }]
            : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
  });
  return deletes;
}

for (const width of [320, 1280]) {
  test(`삭제할 수 있는 기록만 지우고 목록에서 뺀다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const deletes = await setup(page);
    await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
    const failed = page.getByRole('article').filter({ hasText: /^101화/ });
    const running = page.getByRole('article').filter({ hasText: /^96~100화/ });
    await expect(failed.getByRole('button', { name: '실패 확인', exact: true })).toBeVisible();
    await expect(running.getByRole('button', { name: '기록 삭제', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await failed.getByRole('button', { name: '기록 삭제', exact: true }).click();
    const dialog = page.getByRole('alertdialog', { name: '101화 분석 기록을 삭제할까요?' });
    await expect(dialog).toContainText('분석 결과와 확정한 설정은 그대로 남습니다.');
    await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`analysis-history-delete-${width}.png`), animations: 'disabled' });
    await dialog.getByRole('button', { name: '삭제하기', exact: true }).click();

    await expect(dialog).toHaveCount(0);
    await expect(failed).toHaveCount(0);
    await expect(running).toBeVisible();
    expect(deletes).toEqual([`/api/v1/works/${workId}/analysis-jobs/batches/${failedBatchId}`]);
  });
}

test('취소하면 요청을 보내지 않는다', async ({ page }) => {
  const deletes = await setup(page);
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  await page.getByRole('article').filter({ hasText: /^101화/ }).getByRole('button', { name: '기록 삭제', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  expect(deletes).toEqual([]);
});

test('서버가 거절하면 이유를 보이고 카드를 남긴다', async ({ page }) => {
  const message = '진행 중이거나 검토·재개가 남은 분석 기록은 삭제할 수 없습니다. 분석을 마치거나 남은 검토를 끝낸 뒤 다시 시도해 주세요.';
  await setup(page, { status: 409, body: { code: 'ANALYSIS_HISTORY_DELETE_NOT_ALLOWED', status: 409, message, details: [] } });
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  const failed = page.getByRole('article').filter({ hasText: /^101화/ });
  await failed.getByRole('button', { name: '기록 삭제', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: '삭제하기', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(message);
  await expect(dialog.getByRole('button', { name: '다시 시도', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(failed).toBeVisible();
});

test('원고 목록의 실패 알림이 삭제 뒤 사라진다', async ({ page }) => {
  await setup(page);
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);
  await expect(page.getByText('일부 분석에 실패했습니다.')).toBeVisible();
  await page.getByRole('button', { name: '분석 목록으로', exact: true }).click();
  await page.getByRole('article').filter({ hasText: /^101화/ }).getByRole('button', { name: '기록 삭제', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제하기', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);
  await expect(page.getByText('진행 중인 분석이 있습니다.')).toBeVisible();
  await expect(page.getByText('일부 분석에 실패했습니다.')).toHaveCount(0);
});
