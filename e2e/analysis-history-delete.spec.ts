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

/** 신규 회차 검수 묶음. Job 없는 검수는 회차 범위가 없어 카드·확인창 제목은 report의 회차 번호를 쓴다. */
const reportBatchId = '66666666-6666-4666-8666-666666666666';
const pendingReportBatchId = '77777777-7777-4777-8777-777777777777';
const releaseJobId = '88888888-8888-4888-8888-888888888888';
const validationBatch = (ids: { batchId: string; reportId: string }, episodeNo: number, reviewStage: string,
  historyDeletable: boolean, extra: Record<string, unknown> = {}) => ({
  batchId: ids.batchId, uploadType: 'SINGLE_EPISODE', status: 'ERROR_REVIEW_PENDING', episodeStatus: 'ERROR_REVIEW_PENDING',
  episodeStartNo: null, episodeEndNo: null, episodeCount: 0, jobGroups: [], episodeJobGroups: [], settingBooks: [],
  validationReports: [{
    reportId: ids.reportId, sourceEpisodeNo: episodeNo, status: 'WAITING_FOR_ERROR_REVIEW', baselineStatus: 'READY', reviewStage,
  }],
  historyDeletable, lastActivityAt: '2026-11-05T08:32:00', ...extra,
});
const releaseGroup = {
  jobType: 'SETTING_EXTRACTION', status: 'COMPLETED', totalJobCount: 1, succeededJobCount: 1, runningJobCount: 0,
  pendingJobCount: 0, failedJobCount: 0, canceledJobCount: 0, currentAnalysisJobIds: [releaseJobId],
};
/** 15화 검수는 확정까지 끝나 서버가 기록을 지울 수 있다고 알려 준다. 같은 묶음의 설정 추출 카드가 분석 목록에도 있다. */
const appliedReportBatch = validationBatch({ batchId: reportBatchId, reportId: '99999999-9999-4999-8999-999999999991' },
  15, 'APPLIED', true, { episodeStartNo: 15, episodeEndNo: 15, episodeCount: 1, jobGroups: [releaseGroup], episodeJobGroups: [releaseGroup] });
/** 16화 검수는 아직 작가 검토가 남아 지울 수 없다. */
const pendingReportBatch = validationBatch({ batchId: pendingReportBatchId, reportId: '99999999-9999-4999-8999-999999999992' },
  16, 'AWAITING_REVIEW', false);
/** 15화를 고친 뒤 재검수가 필요한 검수. 원고 목록 위 안내에 나오고 서버가 지울 수 있다고 알려 준다. */
const invalidatedReportBatch = validationBatch({ batchId: reportBatchId, reportId: '99999999-9999-4999-8999-999999999993' },
  15, 'INVALIDATED', true, { status: 'ERROR_REVIEW_INVALIDATED', episodeStatus: 'ERROR_REVIEW_INVALIDATED' });

type ListKind = 'ALL' | 'ANALYSIS' | 'VALIDATION';
const defaultLists = () => [failedBatch, runningBatch];

/** 서버처럼 kind별로 다른 묶음을 주고, 지운 묶음은 모든 kind에서 뺀다(서버는 업로드 묶음 단위로 숨긴다). */
async function setup(page: Page, deleteResponse: { status: number; body: unknown } = { status: 200, body: null },
  lists: (kind: ListKind) => Array<{ batchId: string }> = defaultLists, batchKinds: ListKind[] = []) {
  const deletes: string[] = [];
  const deletedBatchIds = new Set<string>();
  await page.addInitScript(() => localStorage.setItem('accessToken', 'synthetic-history-delete-test'));
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'DELETE' && path.includes('/analysis-jobs/batches/')) {
      deletes.push(path);
      if (deleteResponse.status === 200) deletedBatchIds.add(path.split('/').pop() ?? '');
      return route.fulfill({
        status: deleteResponse.status,
        contentType: 'application/json',
        body: JSON.stringify(deleteResponse.status === 200
          ? { success: true, message: '분석 기록이 삭제되었습니다.', data: null, error: null }
          : { success: false, message: (deleteResponse.body as { message: string }).message, data: null, error: deleteResponse.body }),
      });
    }
    const kind = (url.searchParams.get('kind') ?? 'ALL') as ListKind;
    if (path.endsWith('/analysis-jobs/batches')) batchKinds.push(kind);
    const content = lists(kind).filter(batch => !deletedBatchIds.has(batch.batchId));
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


/** 글자색과 배경색의 WCAG 명암비. 밝은 확인창 안의 버튼 글자가 4.5:1 이상인지 본다. */
async function contrastOf(locator: import('@playwright/test').Locator) {
  return locator.evaluate(element => {
    const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const luminance = ([r, g, b]: number[]) => {
      const [R, G, B] = [r, g, b].map(channel => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    };
    const style = getComputedStyle(element);
    const [fg, bg] = [luminance(parse(style.color)), luminance(parse(style.backgroundColor))];
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  });
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
    const cancel = dialog.getByRole('button', { name: '취소', exact: true });
    const confirm = dialog.getByRole('button', { name: '삭제하기', exact: true });
    await expect(cancel).toBeFocused();
    expect(await contrastOf(cancel)).toBeGreaterThanOrEqual(4.5);
    expect(await contrastOf(confirm)).toBeGreaterThanOrEqual(4.5);
    // 초점은 확인창 안에서만 돈다. 배경의 카드 버튼으로 빠지지 않는다.
    await page.keyboard.press('Shift+Tab');
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
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
  const trigger = page.getByRole('article').filter({ hasText: /^101화/ }).getByRole('button', { name: '기록 삭제', exact: true });
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
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

/** 서버 kind 계약: 오류 리포트 목록은 검수 묶음, 분석 목록은 분석 Job이 있는 묶음(검토를 마친 검수의 설정 추출 포함)이다. */
const reportLists = (kind: ListKind) => (kind === 'VALIDATION' ? [appliedReportBatch, pendingReportBatch]
  : kind === 'ANALYSIS' ? [appliedReportBatch, failedBatch] : [appliedReportBatch, pendingReportBatch, failedBatch]);

for (const width of [320, 1280]) {
  test(`오류 리포트 목록도 지울 수 있는 검수 기록만 지우고 같은 묶음을 분석 목록에서도 뺀다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const batchKinds: ListKind[] = [];
    const deletes = await setup(page, undefined, reportLists, batchKinds);
    await page.goto(`/dashboard?workId=${workId}&nav=reports`);
    await expect(page.getByRole('heading', { name: '오류 리포트' })).toBeVisible();
    const applied = page.getByRole('article').filter({ hasText: /^15화/ });
    const pending = page.getByRole('article').filter({ hasText: /^16화/ });
    await expect(applied.getByRole('button', { name: '오류 리포트 보기', exact: true })).toBeVisible();
    await expect(pending.getByRole('button', { name: '오류 리포트 보기', exact: true })).toBeVisible();
    // 검토가 남은 검수는 서버가 historyDeletable=false로 주므로 버튼이 없다.
    await expect(pending.getByRole('button', { name: '기록 삭제', exact: true })).toHaveCount(0);
    expect(batchKinds).toContain('VALIDATION');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await applied.getByRole('button', { name: '기록 삭제', exact: true }).click();
    const dialog = page.getByRole('alertdialog', { name: '15화 오류 리포트 기록을 삭제할까요?' });
    await expect(dialog).toContainText('같은 업로드의 분석 목록 카드와 원고 목록 위 안내도 함께 사라집니다.');
    await expect(dialog).toContainText('오류 검사 결과와 확정한 설정은 그대로 남습니다.');
    await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeFocused();
    expect(await contrastOf(dialog.getByRole('button', { name: '삭제하기', exact: true }))).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: testInfo.outputPath(`validation-history-delete-${width}.png`), animations: 'disabled' });
    await dialog.getByRole('button', { name: '삭제하기', exact: true }).click();

    await expect(dialog).toHaveCount(0);
    await expect(applied).toHaveCount(0);
    await expect(pending).toBeVisible();
    expect(deletes).toEqual([`/api/v1/works/${workId}/analysis-jobs/batches/${reportBatchId}`]);

    // 서버는 업로드 묶음 단위로 숨기므로 같은 묶음의 설정 추출 카드도 분석 목록에서 빠진다.
    await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
    await expect(page.getByRole('article').filter({ hasText: /^101화/ })).toBeVisible();
    await expect(page.getByTestId('validation-extraction-card')).toHaveCount(0);
  });
}

test('오류 리포트 목록에서도 서버가 거절하면 이유를 보이고 검수 카드를 남긴다', async ({ page }) => {
  const message = '진행 중이거나 검토·재개가 남은 분석 기록은 삭제할 수 없습니다. 분석을 마치거나 남은 검토를 끝낸 뒤 다시 시도해 주세요.';
  await setup(page, { status: 409, body: { code: 'ANALYSIS_HISTORY_DELETE_NOT_ALLOWED', status: 409, message, details: [] } }, reportLists);
  await page.goto(`/dashboard?workId=${workId}&nav=reports`);
  const applied = page.getByRole('article').filter({ hasText: /^15화/ });
  await applied.getByRole('button', { name: '기록 삭제', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: '삭제하기', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(message);
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(applied).toBeVisible();
});

test('오류 리포트 기록을 지우면 원고 목록 위 검수 안내도 사라진다', async ({ page }) => {
  const batchKinds: ListKind[] = [];
  await setup(page, undefined, kind => (kind === 'ANALYSIS' ? [runningBatch] : [invalidatedReportBatch, runningBatch]), batchKinds);
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);
  const notice = page.getByTestId('latest-validation-notice');
  await expect(notice).toContainText('15화 신규 회차 검수 · 재검수 필요');
  await page.getByRole('button', { name: '오류 리포트', exact: true }).click();
  await page.getByRole('article').filter({ hasText: /^15화/ }).getByRole('button', { name: '기록 삭제', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '삭제하기', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('button', { name: '원고 목록', exact: true }).click();
  await expect(page.getByText('진행 중인 분석이 있습니다.')).toBeVisible();
  await expect(notice).toHaveCount(0);
  expect(batchKinds.filter(kind => kind === 'ALL').length).toBeGreaterThanOrEqual(2);
});
