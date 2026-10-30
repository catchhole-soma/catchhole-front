import { expect, test, type Page, type Route } from '@playwright/test';
import review from './fixtures/validation/validation-review-v1.json' with { type: 'json' };
import stagingFixture from './fixtures/validation/validation-staging-v1.json' with { type: 'json' };
import { authenticate, BATCH_ID, EPISODE_ID, mockValidationReport, REPORT_ID, WORK_ID } from './fixtures/validation/report-mock';

/**
 * GH314 F2 업로드: 작품 단위 다음 회차 차단, 신규 회차 검수 접수와 응답 유실 복구, 거절 사유, 기존 설정 구축 유지.
 * 응답 모양은 Backend 계약 예시(validation-review-v1.json)와 접수 응답(ValidationStagingResponse) fixture를 쓴다.
 */
const PREVIOUS_EPISODE_ID = '00000000-0000-4000-8000-000000000003';
const JOB_ID = '00000000-0000-4000-8000-000000000051';
const ALLOWED = { ...review.responses.eligibilityWorkOnlyBlocked, nextEpisodeAdmission: { ...review.responses.eligibilityEligible.nextEpisodeAdmission } };
const BLOCKED = review.responses.eligibilityWorkOnlyBlocked;

type Reply = { status?: number; body?: unknown; abort?: boolean; wait?: Promise<void>; onFulfilled?: () => void };
type Options = {
  eligibility?: (call: number) => Reply;
  upload?: (call: number) => Reply;
  start?: (call: number) => Reply;
  current?: (call: number) => Reply;
  episodeEligibility?: Record<string, unknown>;
};

const ok = (data: unknown): Reply => ({ body: { success: true, message: '성공', data, error: null } });
const fail = (status: number, code: string, message: string, context: Record<string, unknown> = {}): Reply => ({
  status, body: { success: false, message, data: null, error: { code, status, details: [], context } },
});
async function reply(route: Route, value: Reply) {
  if (value.wait) await value.wait;
  if (value.abort) await route.abort('failed');
  else await route.fulfill({ status: value.status ?? 200, contentType: 'application/json', body: JSON.stringify(value.body) });
  value.onFulfilled?.();
}

/** 응답을 테스트가 풀어 줄 때까지 붙잡아 둔다. */
function gate() {
  let open!: () => void;
  const wait = new Promise<void>(resolve => { open = resolve; });
  return { wait, open };
}

async function setup(page: Page, options: Options = {}) {
  await mockValidationReport(page);
  const calls = { eligibility: 0, uploads: [] as string[], starts: [] as Array<Record<string, unknown>>, current: 0, analysisJobs: [] as Array<Record<string, unknown>> };
  let uploaded = false;
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const base = `/api/v1/works/${WORK_ID}`;
    if (path === `${base}/episodes/upload-policy`) return reply(route, ok({ pendingCharacterCandidateCount: 0, pendingWorldSettingCandidateCount: 0, maxUploadCharacters: 250000 }));
    if (path === `${base}/episodes/detect`) {
      const uploadType = /"uploadType":"([A-Z_]+)"/.exec(request.postData() ?? '')?.[1] ?? 'SINGLE_EPISODE';
      const count = uploadType === 'SINGLE_EPISODE' ? 1 : 2;
      return reply(route, ok({ uploadType, totalUploadCharacters: 40, totalCharCount: 20, detectedEpisodes: Array.from({ length: count }, (_, index) => ({
        detectionOrder: index, sourceFileIndex: uploadType === 'MULTI_EPISODE_MULTI_FILE' ? index : 0,
        episodeNo: 101 + index, title: index === 0 ? '성문 앞에서' : '다음 날', sourceHeading: null, content: '원고 본문', charCount: 5,
      })) }));
    }
    if (path === `${base}/episodes` && method === 'GET' && !uploaded) {
      return reply(route, ok([{ id: PREVIOUS_EPISODE_ID, episodeNo: 100, title: '이전 회차', status: 'ANALYZED', analysisStatus: 'COMPLETED' }]));
    }
    if (path === `${base}/episodes` && method === 'POST') {
      calls.uploads.push(request.postData() ?? '');
      const value = options.upload?.(calls.uploads.length) ?? ok({ batchId: BATCH_ID, createdEpisodes: [{ id: EPISODE_ID, episodeNo: 101, status: 'UPLOADED' }] });
      if (!value.status || value.status < 400) uploaded = true;
      return reply(route, value);
    }
    if (path === `${base}/episode-validations/eligibility`) {
      if (url.searchParams.get('episodeId')) return reply(route, ok({ ...review.responses.eligibilityEligible, episodeId: EPISODE_ID, ...options.episodeEligibility }));
      calls.eligibility += 1;
      return reply(route, options.eligibility?.(calls.eligibility) ?? ok(ALLOWED));
    }
    if (path === `${base}/episode-validations` && method === 'POST') {
      calls.starts.push(request.postDataJSON());
      return reply(route, options.start?.(calls.starts.length) ?? ok({ ...stagingFixture.awaitingReview, reviewStage: 'VALIDATING', executionStatus: 'QUEUED' }));
    }
    if (path === `${base}/episode-validations/current` && options.current) {
      calls.current += 1;
      return reply(route, options.current(calls.current));
    }
    if (path === `${base}/analysis-jobs` && method === 'POST') {
      calls.analysisJobs.push(request.postDataJSON());
      return reply(route, ok([{ id: JOB_ID, workId: WORK_ID, batchId: BATCH_ID, episodeId: EPISODE_ID, jobType: 'SETTING_EXTRACTION', status: 'PENDING', episodes: [] }]));
    }
    if (path === `${base}/analysis-jobs/progress`) {
      return reply(route, ok([{ id: JOB_ID, workId: WORK_ID, batchId: BATCH_ID, episodeId: EPISODE_ID, jobType: 'SETTING_EXTRACTION', status: 'PENDING', episodes: [] }]));
    }
    if (path.includes('/world-setting-candidates')) return reply(route, ok({ pendingComparisonCount: 0, processingComparisonCount: 0, tokenInterruptedComparisonCount: 0 }));
    return route.fallback();
  });
  await authenticate(page);
  return calls;
}

const modeButton = (page: Page, uploadType: string) => page.getByRole('button', {
  name: uploadType === 'SINGLE_EPISODE' ? /단일 회차 업로드/ : uploadType === 'MULTI_EPISODE_MULTI_FILE' ? /다회차 - 여러 파일/ : /다회차 - 단일 파일/,
});
const validationPurpose = (page: Page) => page.getByRole('button', { name: /^신규 회차 검수/ });
const blockedNotice = (page: Page) => page.getByTestId('next-episode-blocked');

async function chooseFiles(page: Page, count = 1) {
  await page.locator('input[type=file]').first().setInputFiles(Array.from({ length: count }, (_, index) => ({
    name: `${101 + index}화.txt`, mimeType: 'text/plain', buffer: Buffer.from('원고 본문'),
  })));
}

async function prepareSingleValidation(page: Page) {
  await page.goto(`/episode-upload?workId=${WORK_ID}`);
  await modeButton(page, 'SINGLE_EPISODE').click();
  await chooseFiles(page);
  await expect(page.getByPlaceholder('비우면 파일에서 감지')).toHaveValue('101');
  await validationPurpose(page).click();
  await expect(validationPurpose(page)).toHaveAttribute('aria-pressed', 'true');
}

test('미완료 검수가 있으면 모든 업로드 방식에서 안내와 리포트 이동을 보여 주고 저장을 잠근다', async ({ page }) => {
  const calls = await setup(page, { eligibility: () => ok(BLOCKED) });
  await page.goto(`/episode-upload?workId=${WORK_ID}`);
  await expect(blockedNotice(page)).toContainText('이 회차의 검토와 설정 저장을 마친 뒤 다음 회차를 등록할 수 있어요.');
  await expect(blockedNotice(page)).toContainText('검토 중인 회차: 101화 · 확정 보류');
  const link = blockedNotice(page).getByRole('link', { name: '현재 리포트로 이동' });
  await expect(link).toHaveAttribute('href', `/episode-validation-report?workId=${WORK_ID}&reportId=${BLOCKED.nextEpisodeAdmission.blockingReportId}`);
  for (const uploadType of ['SINGLE_EPISODE', 'MULTI_EPISODE_SINGLE_FILE', 'MULTI_EPISODE_MULTI_FILE']) {
    await modeButton(page, uploadType).click();
    await chooseFiles(page, uploadType === 'MULTI_EPISODE_MULTI_FILE' ? 2 : 1);
    const next = page.getByRole('button', { name: uploadType === 'MULTI_EPISODE_SINGLE_FILE' ? '다음 — 회차 분리 확인' : '다음 — 분석 시작' });
    await expect(next).toBeDisabled();
  }
  expect(calls.uploads).toEqual([]);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/episode-validation-report\\?workId=${WORK_ID}&reportId=${REPORT_ID}`));
  await expect(page.locator('#validation-report-title')).toBeVisible();
});

test('자격 조회가 실패해도 업로드를 잠그지 않고 기존 설정 구축은 그대로 설정 추출 Job을 만든다', async ({ page }) => {
  const calls = await setup(page, { eligibility: () => ({ status: 503, body: { message: '일시 오류' } }) });
  await page.goto(`/episode-upload?workId=${WORK_ID}`);
  await modeButton(page, 'SINGLE_EPISODE').click();
  await chooseFiles(page);
  await expect(page.getByRole('button', { name: /^기존 설정 구축/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(blockedNotice(page)).toHaveCount(0);
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  await expect.poll(() => calls.analysisJobs).toEqual([{ jobType: 'SETTING_EXTRACTION', batchId: BATCH_ID, reviewMode: 'AUTOMATIC', analysisMode: 'ORDERED_PROVISIONAL' }]);
  expect(calls.uploads).toHaveLength(1);
  expect(calls.starts).toEqual([]);
  // 업로드 직전에도 자격을 다시 확인한다.
  expect(calls.eligibility).toBeGreaterThanOrEqual(2);
});

test('업로드 409 VALIDATION_NEXT_EPISODE_BLOCKED는 같은 안내와 리포트 이동을 보여 주고 입력을 유지한다', async ({ page }) => {
  const context = review.errors.nextEpisodeBlocked.error.context;
  const calls = await setup(page, {
    // 화면 진입·전송 직전에는 허용이었다가 그 사이 다른 창에서 검수가 접수된 경합.
    eligibility: call => call <= 2 ? ok(ALLOWED) : ok(BLOCKED),
    upload: () => fail(409, 'VALIDATION_NEXT_EPISODE_BLOCKED', review.errors.nextEpisodeBlocked.message, context),
  });
  await page.goto(`/episode-upload?workId=${WORK_ID}`);
  await modeButton(page, 'SINGLE_EPISODE').click();
  await chooseFiles(page);
  await page.getByPlaceholder('비우면 원문 제목 행에서 감지').fill('직접 고친 제목');
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  await expect(blockedNotice(page)).toContainText('이 회차의 검토와 설정 저장을 마친 뒤 다음 회차를 등록할 수 있어요.');
  await expect(blockedNotice(page)).toContainText(`검토 중인 회차: ${context.episodeNo}화`);
  await expect(blockedNotice(page).getByRole('link', { name: '현재 리포트로 이동' }))
    .toHaveAttribute('href', `/episode-validation-report?workId=${WORK_ID}&reportId=${context.reportId}`);
  await expect(page.getByPlaceholder('비우면 파일에서 감지')).toHaveValue('101');
  await expect(page.getByPlaceholder('비우면 원문 제목 행에서 감지')).toHaveValue('직접 고친 제목');
  await expect(page.getByText('101화.txt')).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 — 분석 시작' })).toBeDisabled();
  expect(calls.uploads).toHaveLength(1);
  expect(calls.analysisJobs).toEqual([]);
  expect(calls.starts).toEqual([]);
});

test('단일 신규 회차 검수는 설정 추출 Job 없이 현재 원고 버전으로 한 번 접수하고 리포트로 이동한다', async ({ page }) => {
  const calls = await setup(page);
  await prepareSingleValidation(page);
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('note').filter({ hasText: '오류 검사와 작가 검토를 마친 뒤 이번 회차의 설정을 추출해요.' })).toContainText('(101화)');
  await page.getByRole('button', { name: '다음 — 검수 시작' }).click();
  await expect(page).toHaveURL(new RegExp(`/episode-validation-report\\?workId=${WORK_ID}&reportId=${REPORT_ID}(&|$)`));
  await expect(page.locator('#validation-report-title')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('validationEpisodeId')).toBeNull();
  expect(calls.analysisJobs).toEqual([]);
  expect(calls.starts).toHaveLength(1);
  expect(calls.starts[0]).toEqual({
    idempotencyKey: expect.stringMatching(/^validation-start-/),
    batchId: BATCH_ID,
    episodeId: EPISODE_ID,
    expectedContentHash: '03'.repeat(32),
    expectedContentS3Key: `works/${WORK_ID}/episodes/101-r3.txt`,
    expectedContentS3Version: 'synthetic-v3',
  });
  // 리포트로 replace 이동하므로 뒤로가기로 접수 중 화면을 다시 열지 않는다.
  await page.goBack();
  await expect(page).not.toHaveURL(/validationEpisodeId=/);
});

test('전송 직전 자격 확인 중에는 입력을 잠그고 확인 뒤 화면에 보이던 값으로 저장한다', async ({ page }) => {
  const held = gate();
  const calls = await setup(page, { eligibility: call => call === 1 ? ok(ALLOWED) : { ...ok(ALLOWED), wait: held.wait } });
  await prepareSingleValidation(page);
  await page.getByPlaceholder('비우면 원문 제목 행에서 감지').fill('보이는 제목');
  await page.getByRole('button', { name: '다음 — 검수 시작' }).click();
  await expect.poll(() => calls.eligibility).toBe(2);
  // 확인을 기다리는 동안 파일·번호·제목·목적·업로드 방식과 제출을 바꿀 수 없다.
  await expect(page.locator('input[type=file]').first()).toBeDisabled();
  await expect(page.getByPlaceholder('비우면 파일에서 감지')).toBeDisabled();
  await expect(page.getByPlaceholder('비우면 원문 제목 행에서 감지')).toBeDisabled();
  await expect(validationPurpose(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: /^기존 설정 구축/ })).toBeDisabled();
  await expect(modeButton(page, 'MULTI_EPISODE_MULTI_FILE')).toBeDisabled();
  await expect(page.getByRole('button', { name: '저장 중...' })).toBeDisabled();
  expect(calls.uploads).toEqual([]);
  held.open();
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
  expect(calls.uploads).toHaveLength(1);
  expect(calls.uploads[0]).toContain('"singleEpisodeNo":101');
  expect(calls.uploads[0]).toContain('"singleEpisodeTitle":"보이는 제목"');
  expect(calls.starts).toHaveLength(1);
});

test('접수 응답이 유실되면 현재 검수로 복구하고 두 번째 접수를 보내지 않는다', async ({ page }) => {
  const calls = await setup(page, { start: () => ({ abort: true }) });
  await prepareSingleValidation(page);
  await page.getByRole('button', { name: '다음 — 검수 시작' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
  expect(calls.starts).toHaveLength(1);
  expect(calls.analysisJobs).toEqual([]);
});

test('접수 중 새로고침하면 현재 검수만 확인하고 없을 때만 같은 원고 접수를 다시 제안한다', async ({ page }) => {
  const calls = await setup(page, {
    start: call => call === 1 ? { abort: true } : ok({ ...stagingFixture.awaitingReview, reviewStage: 'VALIDATING' }),
    current: () => fail(404, 'VALIDATION_NOT_FOUND', '검수 요청을 찾을 수 없습니다.'),
  });
  await prepareSingleValidation(page);
  await page.getByRole('button', { name: '다음 — 검수 시작' }).click();
  const intake = page.getByTestId('validation-intake');
  await expect(intake).toContainText('원고는 저장했지만 검수를 아직 접수하지 못했어요');
  await expect(page).toHaveURL(new RegExp(`validationEpisodeId=${EPISODE_ID}`));

  await page.reload();
  await expect(intake).toContainText('원고는 저장했지만 검수를 아직 접수하지 못했어요');
  // 새로고침은 현재 검수만 읽고 접수를 다시 보내지 않는다.
  expect(calls.starts).toHaveLength(1);
  expect(calls.current).toBeGreaterThanOrEqual(2);

  await intake.getByRole('button', { name: '검수 접수 다시 시도' }).click();
  await expect(page).toHaveURL(new RegExp(`reportId=${REPORT_ID}`));
  expect(calls.starts).toHaveLength(2);
  expect(calls.starts[1]).toMatchObject({ batchId: BATCH_ID, episodeId: EPISODE_ID });
});

test('접수 응답 전에 화면을 떠나면 늦은 응답이 떠난 화면을 리포트로 바꾸지 않는다', async ({ page }) => {
  const held = gate();
  let answered = false;
  const calls = await setup(page, {
    start: () => ({ ...ok({ ...stagingFixture.awaitingReview, reviewStage: 'VALIDATING' }), wait: held.wait, onFulfilled: () => { answered = true; } }),
  });
  await prepareSingleValidation(page);
  await page.getByRole('button', { name: '다음 — 검수 시작' }).click();
  await expect(page.getByTestId('validation-intake')).toContainText('검수를 접수하고 있어요');
  await expect.poll(() => calls.starts.length).toBe(1);
  await page.getByRole('button', { name: '분석 목록으로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard\\?workId=${WORK_ID}&nav=analyses`));
  held.open();
  await expect.poll(() => answered).toBe(true);
  // 늦은 응답 처리 뒤에도 사용자가 고른 화면을 유지한다. 서버 접수 요청은 취소하지 않는다.
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(new RegExp(`/dashboard\\?workId=${WORK_ID}&nav=analyses`));
  await expect(page).not.toHaveURL(/episode-validation-report/);
  expect(calls.starts).toHaveLength(1);
});

test('응답 유실 뒤 현재 검수 확인 중에 화면을 떠나도 늦은 확인 결과로 리포트로 이동하지 않는다', async ({ page }) => {
  const held = gate();
  let answered = false;
  const calls = await setup(page, {
    start: () => ({ abort: true }),
    current: () => ({ ...ok(stagingFixture.awaitingReview), wait: held.wait, onFulfilled: () => { answered = true; } }),
  });
  await prepareSingleValidation(page);
  await page.getByRole('button', { name: '다음 — 검수 시작' }).click();
  await expect(page.getByTestId('validation-intake')).toContainText('검수 접수 결과를 확인하고 있어요');
  await page.getByRole('button', { name: '분석 목록으로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard\\?workId=${WORK_ID}&nav=analyses`));
  held.open();
  await expect.poll(() => answered).toBe(true);
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(new RegExp(`/dashboard\\?workId=${WORK_ID}&nav=analyses`));
  expect(calls.starts).toHaveLength(1);
});

test('비교 자료가 없으면 서버 안내와 기존 설정 구축을 제안하고 고른 경우에만 설정 추출을 시작한다', async ({ page }) => {
  const calls = await setup(page, {
    start: () => fail(400, 'VALIDATION_COMPARISON_MATERIAL_REQUIRED', '첫 회차 검수에는 설정집이나 직접 입력한 설정 등 비교 자료가 필요합니다.'),
  });
  await prepareSingleValidation(page);
  await page.getByRole('button', { name: '다음 — 검수 시작' }).click();
  const intake = page.getByTestId('validation-intake');
  await expect(intake).toContainText('원고는 저장했지만 이 회차는 검수를 시작할 수 없어요');
  await expect(intake).toContainText('첫 회차 검수에는 설정집이나 직접 입력한 설정 등 비교할 자료가 필요해요.');
  await expect(intake).toContainText('이 회차를 기존 설정 구축으로 분석해 설정을 만들어 주세요.');
  expect(calls.analysisJobs).toEqual([]);
  await intake.getByRole('button', { name: '기존 설정 구축으로 분석 시작' }).click();
  await expect.poll(() => calls.analysisJobs).toEqual([{ jobType: 'SETTING_EXTRACTION', batchId: BATCH_ID, reviewMode: 'AUTOMATIC', analysisMode: 'ORDERED_PROVISIONAL' }]);
  await expect(page).toHaveURL(new RegExp(`currentAnalysisJobIds=${JOB_ID}`));
  expect(new URL(page.url()).searchParams.get('validationEpisodeId')).toBeNull();
  expect(calls.starts).toHaveLength(1);
});

test('접수 대상이 아니면 자격 조회의 사유 문구로 안내한다', async ({ page }) => {
  await setup(page, {
    start: () => fail(400, 'VALIDATION_TARGET_INVALID', '마지막 회차 뒤에 단일 업로드한 새 원고만 검수를 시작할 수 있습니다.'),
    episodeEligibility: { eligible: false, reasonCode: 'NOT_SINGLE_APPEND_UPLOAD', message: '마지막 회차 뒤에 단일 업로드한 새 원고만 검수를 시작할 수 있습니다.' },
  });
  await prepareSingleValidation(page);
  await page.getByRole('button', { name: '다음 — 검수 시작' }).click();
  await expect(page.getByTestId('validation-intake')).toContainText('마지막 회차 바로 뒤에 단일 회차로 올린 새 원고만 검수할 수 있어요.');
});

test('다회차 업로드는 신규 회차 검수를 고를 수 없고 이유를 함께 보여 준다', async ({ page }) => {
  await setup(page);
  await page.goto(`/episode-upload?workId=${WORK_ID}`);
  for (const uploadType of ['MULTI_EPISODE_SINGLE_FILE', 'MULTI_EPISODE_MULTI_FILE']) {
    await modeButton(page, uploadType).click();
    await expect(validationPurpose(page)).toBeDisabled();
    await expect(validationPurpose(page)).toHaveAttribute('aria-describedby', /.+/);
    await expect(page.getByText('신규 회차 검수는 마지막 회차 뒤에 새로 추가하는 단일 회차만 지원해요.')).toBeVisible();
    await expect(page.getByRole('button', { name: /^기존 설정 구축/ })).toHaveAttribute('aria-pressed', 'true');
  }
  // 단일에서 검수를 고른 뒤 다회차로 바꾸면 기존 설정 구축으로 돌아간다.
  await modeButton(page, 'SINGLE_EPISODE').click();
  await validationPurpose(page).click();
  await modeButton(page, 'MULTI_EPISODE_MULTI_FILE').click();
  await expect(page.getByRole('button', { name: /^기존 설정 구축/ })).toHaveAttribute('aria-pressed', 'true');
  await modeButton(page, 'SINGLE_EPISODE').click();
  await expect(page.getByRole('button', { name: /^기존 설정 구축/ })).toHaveAttribute('aria-pressed', 'true');
});
