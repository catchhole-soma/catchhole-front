import { expect, test, type Page } from '@playwright/test';
import review from './fixtures/validation/validation-review-v1.json' with { type: 'json' };
import {
  authenticate,
  EPISODE_ID,
  findingId,
  mockValidationReport,
  RECHECK_REPORT_ID,
  REPORT_ID,
  WORK_ID,
  type ReportScenario,
} from './fixtures/validation/report-mock';

/**
 * GH314 F2 A9 원고 파일 변경 → 리포트 복귀 → A11 재검수, 진단 재검수. A10 설정 정정은 episode-validation-correction.spec.ts.
 * 목 API는 Backend 계약 예시(validation-review-v1.json)와 F1 report fixture를 그대로 사용한다.
 * #314 B2(F3)부터 재검수 버튼은 검토 요약 allowedActions의 RECHECK로만 연다.
 */
async function open(page: Page, scenario: ReportScenario = {}, query = '') {
  const mock = await mockValidationReport(page, scenario);
  await authenticate(page);
  await page.goto(mock.url(query));
  await expect(page.locator('#validation-report-title')).toBeVisible();
  return mock;
}

const recheckButton = (page: Page) => page.getByRole('button', { name: '수정 내용으로 재검수', exact: true });
const replaceDialog = (page: Page) => page.getByRole('dialog', { name: '회차 파일 변경', exact: true });
const returnNotice = (page: Page) => page.getByTestId('validation-report-return');

async function chooseReplacement(page: Page) {
  await replaceDialog(page).locator('input[type=file]').setInputFiles({
    name: '101-revised.txt', mimeType: 'text/plain', buffer: Buffer.from('고친 101화 원고'),
  });
}

test('A9 원고 파일 변경은 같은 회차를 교체하고 리포트로 돌아와 확인 뒤 재검수를 요청한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const mock = await open(page, {}, `&branch=SETTING&findingId=${findingId(0)}`);
  await expect(page.locator('#validation-finding-title')).toHaveText('20화에서 파괴된 검을 101화에서 설명 없이 다시 사용해요.');
  // 서버가 RECHECK를 허용하기 전에는 재검수 버튼을 두지 않는다.
  await expect(recheckButton(page)).toHaveCount(0);

  await page.getByRole('link', { name: '원고 파일 변경', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?/);
  const dashboard = new URL(page.url()).searchParams;
  expect(Object.fromEntries(dashboard)).toMatchObject({
    workId: WORK_ID, nav: 'manuscripts', modal: 'episode-replace', episodeId: EPISODE_ID,
    returnTo: 'validation-report', reportId: REPORT_ID, reportFindingId: findingId(0), reportBranch: 'SETTING',
  });
  // 인용·원문은 복귀 문맥에 넣지 않는다.
  expect(page.url()).not.toContain(encodeURIComponent('부서졌다'));
  await expect(replaceDialog(page)).toContainText('101화 성문 앞에서의 원문 파일을 변경합니다.');
  await expect(replaceDialog(page)).toContainText('파일 변경만으로 검사나 분석을 시작하지 않아요.');
  await expect(returnNotice(page)).toContainText('오류 리포트에서 원고 파일을 바꾸러 왔어요.');

  await chooseReplacement(page);
  await replaceDialog(page).getByRole('button', { name: '파일 변경', exact: true }).click();
  await expect(replaceDialog(page)).toHaveCount(0);
  await expect(returnNotice(page)).toContainText('원고 파일을 바꿨어요.');
  await expect(returnNotice(page)).toContainText('오류 리포트로 돌아가 수정 내용으로 재검수해 주세요.');
  expect(mock.requestsTo(`/episodes/${EPISODE_ID}/file`, 'PUT')).toHaveLength(1);
  // 파일 교체는 검수·분석을 시작하지 않는다.
  expect(mock.state.requests.filter(item => /\/(analysis-jobs|rechecks|retries)$/.test(item.path))).toEqual([]);
  expect(new URL(page.url()).searchParams.get('modal')).toBeNull();
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe('validation-report');
  const row = page.locator('.manuscript-row').filter({ hasText: '101화' });
  await expect(row.locator('.validation-stage-badge')).toHaveText('재검수 필요');

  await returnNotice(page).getByRole('link', { name: '오류 리포트로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`/episode-validation-report\\?workId=${WORK_ID}&reportId=${REPORT_ID}`));
  expect(new URL(page.url()).searchParams.get('findingId')).toBe(findingId(0));
  expect(new URL(page.url()).searchParams.get('branch')).toBe('SETTING');
  await expect(page.getByText('원고 또는 비교한 설정이 바뀌었어요. 수정 내용을 반영해 다시 검수해 주세요.').first()).toBeVisible();
  // 복귀만으로 새 검수를 시작하지 않는다.
  expect(mock.requestsTo('/rechecks')).toHaveLength(0);

  await expect(recheckButton(page)).toBeEnabled();
  await recheckButton(page).click();
  const confirm = page.getByTestId('validation-recheck-confirm');
  await expect(confirm.getByRole('heading', { name: '수정 내용으로 재검수할까요?' })).toBeVisible();
  await expect(confirm).toContainText('101화 성문 앞에서 · 이 회차 한 편만 다시 검사해요.');
  await expect(confirm).toContainText('원고 파일을 바꿨어요');
  await expect(confirm).toContainText('새 결과는 모두 검토 필요로 시작해요.');
  await expect(confirm).toContainText('오류 검토를 마친 뒤 이번 회차의 설정을 추출해요.');
  expect(mock.requestsTo('/rechecks')).toHaveLength(0);
  const episode = mock.episodeDetail();
  const fingerprint = mock.state.staging.baselineFingerprint;
  const version = mock.state.staging.reportVersion;

  await confirm.getByRole('button', { name: '재검수 시작', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${RECHECK_REPORT_ID}`));
  const [request] = mock.requestsTo('/rechecks');
  expect(request.path).toBe(`/api/v1/works/${WORK_ID}/episode-validations/${REPORT_ID}/rechecks`);
  expect(request.body).toEqual({
    idempotencyKey: expect.stringMatching(/^validation-recheck-/),
    expectedReportVersion: version,
    expectedContentHash: episode.contentHash,
    expectedContentS3Key: episode.contentS3Key,
    expectedContentS3Version: episode.contentS3Version,
    expectedContentRevision: episode.contentRevision,
    expectedBaselineHash: fingerprint,
  });
  await expect(page.getByText('설정 충돌을 확인하고 있어요.')).toBeVisible();
  await expect(page.getByText('오류 검토를 마친 뒤 이번 회차의 설정을 추출해요.').first()).toBeVisible();
  expect(mock.requestsTo('/rechecks')).toHaveLength(1);
});

test('교체 실패와 취소는 모달 입력과 리포트 복귀 문맥을 유지하고 분석을 시작하지 않는다', async ({ page }) => {
  const mock = await mockValidationReport(page);
  await authenticate(page);
  mock.failNextReplace({ status: 409, code: 'EPISODE_CONTENT_LOCKED', message: '지금은 원고 파일을 바꿀 수 없습니다. 잠시 후 다시 시도해 주세요.' });
  await page.goto(`/dashboard?workId=${WORK_ID}&nav=manuscripts&modal=episode-replace&episodeId=${EPISODE_ID}&returnTo=validation-report&reportId=${REPORT_ID}&reportFindingId=${findingId(1)}`);
  await expect(replaceDialog(page)).toBeVisible();
  await chooseReplacement(page);
  await replaceDialog(page).getByRole('button', { name: '파일 변경', exact: true }).click();
  await expect(replaceDialog(page)).toContainText('지금은 원고 파일을 바꿀 수 없습니다. 잠시 후 다시 시도해 주세요.');
  await expect(replaceDialog(page)).toContainText('101-revised.txt');
  await expect(returnNotice(page)).toContainText('오류 리포트에서 원고 파일을 바꾸러 왔어요.');

  await replaceDialog(page).getByRole('button', { name: '취소', exact: true }).click();
  await expect(replaceDialog(page)).toHaveCount(0);
  const params = new URL(page.url()).searchParams;
  expect(params.get('modal')).toBeNull();
  expect(params.get('episodeId')).toBeNull();
  expect(params.get('returnTo')).toBe('validation-report');
  await expect(returnNotice(page)).toContainText('오류 리포트에서 원고 파일을 바꾸러 왔어요.');
  expect(mock.requestsTo(`/episodes/${EPISODE_ID}/file`, 'PUT')).toHaveLength(1);
  expect(mock.state.requests.filter(item => /\/(analysis-jobs|rechecks)$/.test(item.path))).toEqual([]);
  await returnNotice(page).getByRole('link', { name: '오류 리포트로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}.*findingId=${findingId(1)}`));
  await expect(page.locator('#validation-finding-title')).toHaveText('왕궁 앞뜰이 마법 금지 구역에 들어가는지 알 수 없어요.');
});

test('같은 입력의 재검수 거절은 같은 입력 안내와 중단된 검사 다시 시도를 제안한다', async ({ page }) => {
  const mock = await open(page, {
    staging: { status: 'INVALIDATED', baselineStatus: 'INVALIDATED', reviewStage: 'INVALIDATED', executionStatus: 'PARTIAL' },
    summary: { reviewStage: 'INVALIDATED', executionStatus: 'PARTIAL', judgmentLocked: true, lockReason: 'REPORT_INVALIDATED', allowedActions: ['RECHECK', 'RETRY'], holdReasons: ['REPORT_INVALIDATED'] },
  });
  mock.failNextRecheck({ status: 409, code: 'VALIDATION_RECHECK_INPUT_UNCHANGED', message: '동일한 입력은 기존 검수의 재시도를 사용해 주세요.' });
  await recheckButton(page).click();
  const confirm = page.getByTestId('validation-recheck-confirm');
  // 원고 revision이 그대로면 원고 교체로 표시하지 않는다.
  await expect(confirm).toContainText('검사에 쓴 설정이 바뀌었어요.');
  await confirm.getByRole('button', { name: '재검수 시작', exact: true }).click();
  await expect(confirm).toContainText('원고와 비교 기준이 이전 검수와 같아요. 새 검수 대신 중단된 검사 다시 시도를 사용해 주세요.');
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
  const first = mock.requestsTo('/rechecks')[0].body as { idempotencyKey: string };
  await confirm.getByRole('button', { name: '중단된 검사 다시 시도', exact: true }).click();
  await expect.poll(() => mock.requestsTo('/retries')).toHaveLength(1);
  expect(mock.requestsTo('/rechecks')).toHaveLength(1);
  expect(first.idempotencyKey).toMatch(/^validation-recheck-/);
});

test('재검수 응답이 유실되면 현재 검수로 새 리포트를 확인하고 요청을 다시 보내지 않는다', async ({ page }) => {
  const mock = await open(page, {
    staging: { status: 'INVALIDATED', baselineStatus: 'INVALIDATED', reviewStage: 'INVALIDATED' },
    summary: { reviewStage: 'INVALIDATED', judgmentLocked: true, lockReason: 'REPORT_INVALIDATED', allowedActions: ['RECHECK'], holdReasons: ['REPORT_INVALIDATED'] },
  });
  mock.loseNextRecheckResponse();
  await recheckButton(page).click();
  await page.getByTestId('validation-recheck-confirm').getByRole('button', { name: '재검수 시작', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${RECHECK_REPORT_ID}`));
  await expect(page.getByText('설정 충돌을 확인하고 있어요.')).toBeVisible();
  expect(mock.requestsTo('/rechecks')).toHaveLength(1);
});

const invalidated: ReportScenario = {
  staging: { status: 'INVALIDATED', baselineStatus: 'INVALIDATED', reviewStage: 'INVALIDATED' },
  summary: { reviewStage: 'INVALIDATED', judgmentLocked: true, lockReason: 'REPORT_INVALIDATED', allowedActions: ['RECHECK'], holdReasons: ['REPORT_INVALIDATED'] },
};
const analysisList = new RegExp(`/dashboard\\?workId=${WORK_ID}&nav=analyses$`);

test('재검수 응답 전에 분석 목록으로 나가면 늦은 응답이 목록을 새 리포트로 바꾸지 않는다', async ({ page }) => {
  const mock = await open(page, invalidated);
  const release = mock.holdNextRecheck();
  await recheckButton(page).click();
  await page.getByTestId('validation-recheck-confirm').getByRole('button', { name: '재검수 시작', exact: true }).click();
  await expect.poll(() => mock.requestsTo('/rechecks').length).toBe(1);
  await page.getByRole('button', { name: '← 분석 목록' }).click();
  await expect(page).toHaveURL(analysisList);
  release();
  // 서버의 재검수는 그대로 처리된다.
  await expect.poll(() => mock.state.staging.reportId).toBe(RECHECK_REPORT_ID);
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(analysisList);
  expect(mock.requestsTo('/rechecks')).toHaveLength(1);
});

test('재검수 응답 유실 뒤 현재 검수 확인 중에 나가도 늦은 확인 결과로 이동하지 않는다', async ({ page }) => {
  const mock = await open(page, invalidated);
  mock.loseNextRecheckResponse();
  const release = mock.holdNextCurrent();
  const currentReads: string[] = [];
  let currentAnswered = false;
  const isCurrent = (url: string) => new URL(url).pathname.endsWith('/episode-validations/current');
  page.on('request', request => { if (isCurrent(request.url())) currentReads.push(request.url()); });
  page.on('requestfinished', request => { if (isCurrent(request.url())) currentAnswered = true; });
  await recheckButton(page).click();
  await page.getByTestId('validation-recheck-confirm').getByRole('button', { name: '재검수 시작', exact: true }).click();
  await expect.poll(() => currentReads.length).toBe(1);
  await page.getByRole('button', { name: '← 분석 목록' }).click();
  await expect(page).toHaveURL(analysisList);
  release();
  await expect.poll(() => currentAnswered).toBe(true);
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(analysisList);
  expect(mock.requestsTo('/rechecks')).toHaveLength(1);
});

test('현재 원고를 확인하는 동안 취소하면 재검수 요청을 보내지 않고 리포트를 그대로 둔다', async ({ page }) => {
  const mock = await open(page, invalidated);
  let detailAnswered = 0;
  page.on('requestfinished', request => { if (new URL(request.url()).pathname.endsWith(`/episodes/${EPISODE_ID}`)) detailAnswered += 1; });
  await recheckButton(page).click();
  const confirm = page.getByTestId('validation-recheck-confirm');
  await expect(confirm).toContainText('검사에 쓴 설정이 바뀌었어요.');
  const answeredBefore = detailAnswered;
  const release = mock.holdNextEpisodeDetail();
  await confirm.getByRole('button', { name: '재검수 시작', exact: true }).click();
  // 요청을 보내기 전(현재 원고 확인 중)에는 다시 누를 수 없고 취소만 할 수 있다.
  await expect(confirm.getByRole('button', { name: '현재 원고를 확인하고 있어요…' })).toBeDisabled();
  await expect(confirm.getByRole('button', { name: '취소', exact: true })).toBeEnabled();
  await confirm.getByRole('button', { name: '취소', exact: true }).click();
  await expect(confirm).toHaveCount(0);
  release();
  await expect.poll(() => detailAnswered).toBeGreaterThan(answeredBefore);
  await page.waitForTimeout(400);
  expect(mock.requestsTo('/rechecks')).toHaveLength(0);
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
  await expect(recheckButton(page)).toBeEnabled();
});

test('재검수 요청을 보낸 뒤에는 응답이 올 때까지 취소와 재시작을 잠근다', async ({ page }) => {
  const mock = await open(page, invalidated);
  const release = mock.holdNextRecheck();
  await recheckButton(page).click();
  const confirm = page.getByTestId('validation-recheck-confirm');
  await confirm.getByRole('button', { name: '재검수 시작', exact: true }).click();
  await expect.poll(() => mock.requestsTo('/rechecks').length).toBe(1);
  await expect(confirm.getByRole('button', { name: '재검수를 요청하고 있어요…' })).toBeDisabled();
  await expect(confirm.getByRole('button', { name: '취소', exact: true })).toBeDisabled();
  release();
  await expect(page).toHaveURL(new RegExp(`reportId=${RECHECK_REPORT_ID}`));
  expect(mock.requestsTo('/rechecks')).toHaveLength(1);
});

const appliedSummary = (allowedActions: string[]) => ({
  allowedActions, canCompleteReview: false, completionMode: 'COMPLETED', judgmentLocked: true, lockReason: 'REVIEW_COMPLETED',
    completion: review.responses.reviewSummary.completion, extractionState: 'SUCCEEDED', reviewStage: 'APPLIED',
    application: { ...review.responses.reviewSummary.application, status: 'APPLIED', holdReasons: [], appliedAt: '2026-10-30T11:07:00' },
});
const appliedStaging = { reviewStage: 'APPLIED', extractionStatus: 'READY', candidateStatus: 'READY' } as const;

test('확정 완료 회차는 서버가 RECHECK를 알려 줄 때만 같은 버튼으로 결과 전용 진단 재검수를 시작한다', async ({ page }) => {
  // 계약 예시 reviewSummaryApplied와 같은 APPLIED + allowedActions=[RECHECK].
  expect(review.responses.reviewSummaryApplied.allowedActions).toEqual(['RECHECK']);
  const mock = await open(page, { staging: appliedStaging, summary: appliedSummary(['RECHECK']) as never }, '&judgment=ALL');
  await expect(page.getByText('이번 회차의 설정을 확정했어요.', { exact: false }).first()).toBeVisible();
  await expect(recheckButton(page)).toBeEnabled();
  await recheckButton(page).click();
  const confirm = page.getByTestId('validation-recheck-confirm');
  await expect(confirm).toContainText('원고는 그대로예요. 확정한 설정을 기준으로 검사 결과만 다시 만들어요.');
  await expect(confirm).toContainText('이전 원고의 설정은 확정했어요. 이번 재검수는 검사 결과만 제공해요.');
  await confirm.getByRole('button', { name: '재검수 시작', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${RECHECK_REPORT_ID}`));
  expect(mock.state.staging.mode).toBe('DIAGNOSTIC_ONLY');
  await expect(page.getByText('이전 원고의 설정은 확정했어요. 이번 재검수는 검사 결과만 제공해요.').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '검토 완료 후 설정 추출' })).toHaveCount(0);
});

test('확정 완료 회차라도 서버가 RECHECK를 알려 주지 않으면 재검수 버튼을 두지 않는다', async ({ page }) => {
  // 다음 회차가 이미 있거나 추출·비교가 진행 중이면 Backend가 RECHECK를 빼고, 화면은 단계로 추측하지 않는다.
  const mock = await open(page, { staging: appliedStaging, summary: appliedSummary([]) as never }, '&judgment=ALL');
  await expect(page.getByText('이번 회차의 설정을 확정했어요.', { exact: false }).first()).toBeVisible();
  await expect(recheckButton(page)).toHaveCount(0);
  await expect(page.getByTestId('validation-recheck-confirm')).toHaveCount(0);
  expect(mock.requestsTo('/rechecks')).toHaveLength(0);
});

for (const reason of ['BASELINE_FINGERPRINT_MISMATCH', 'BASELINE_FINGERPRINT_REQUIRED'] as const) {
  test(`재검수 409 ${reason}은 원고 충돌과 다른 기준 식별값 안내를 보여 주고 report를 다시 읽는다`, async ({ page }) => {
    const mock = await open(page, invalidated);
    const stagingReads: string[] = [];
    page.on('request', request => { if (new URL(request.url()).pathname === `/api/v1/works/${WORK_ID}/episode-validations/${REPORT_ID}`) stagingReads.push(request.url()); });
    // 계약 예시 errors.recheckBaselineFingerprint*의 code·context를 그대로 쓴다.
    const example = reason === 'BASELINE_FINGERPRINT_MISMATCH' ? review.errors.recheckBaselineFingerprintMismatch : review.errors.recheckBaselineFingerprintRequired;
    mock.failNextRecheck({ status: 409, code: example.error.code, message: example.message, context: example.error.context });
    await recheckButton(page).click();
    const confirm = page.getByTestId('validation-recheck-confirm');
    await confirm.getByRole('button', { name: '재검수 시작', exact: true }).click();
    await expect(confirm).toContainText('검사 기준 식별값이 바뀌어 최신 검수 상태를 다시 확인했어요. 확인한 뒤 다시 눌러 주세요.');
    await expect(confirm).not.toContainText('최신 원고를 다시 확인한 뒤 눌러 주세요.');
    await expect.poll(() => stagingReads.length).toBeGreaterThan(0);
    await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
    expect(mock.requestsTo('/rechecks')).toHaveLength(1);
  });
}

test('재검수 409 원고 충돌(context 없음)은 기존 원고 충돌 안내를 유지한다', async ({ page }) => {
  const mock = await open(page, invalidated);
  mock.failNextRecheck({ status: 409, code: 'VALIDATION_SOURCE_VERSION_CONFLICT', message: '원고 버전이 변경되었습니다. 현재 원고를 다시 확인해 주세요.' });
  await recheckButton(page).click();
  const confirm = page.getByTestId('validation-recheck-confirm');
  await confirm.getByRole('button', { name: '재검수 시작', exact: true }).click();
  await expect(confirm).toContainText('원고나 비교 기준이 방금 바뀌었어요. 최신 원고를 다시 확인한 뒤 눌러 주세요.');
  await expect(confirm).not.toContainText('기준 식별값');
});

test('가장 마지막 회차가 아니면 재검수를 잠그고 이유를 보여 준다', async ({ page }) => {
  const mock = await open(page, {
    staging: { status: 'INVALIDATED', baselineStatus: 'INVALIDATED', reviewStage: 'INVALIDATED' },
    summary: { reviewStage: 'INVALIDATED', judgmentLocked: true, lockReason: 'REPORT_INVALIDATED', allowedActions: ['RECHECK'], holdReasons: ['REPORT_INVALIDATED'] },
    eligibility: { latestEpisode: false, reasonCode: 'REPORT_EXISTS' },
  });
  await expect(recheckButton(page)).toBeDisabled();
  await expect(page.getByText('가장 마지막 회차만 재검수할 수 있어요. 이 회차 뒤에 다른 회차가 있어요.')).toBeVisible();
  expect(mock.requestsTo('/rechecks')).toHaveLength(0);
});
