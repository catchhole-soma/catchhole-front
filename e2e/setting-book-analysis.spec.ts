import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const bookId = '22222222-2222-4222-8222-222222222222';
const batchId = '33333333-3333-4333-8333-333333333333';
const jobId = '44444444-4444-4444-8444-444444444444';
const revisionId = '55555555-5555-4555-8555-555555555555';
const nextRevisionId = '66666666-6666-4666-8666-666666666666';
const nextJobId = '77777777-7777-4777-8777-777777777777';
const workspace = `/dashboard?workId=${workId}&nav=settingDB&tab=worldrules&settingBookFileId=${bookId}`;

function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
}

async function setupBook(page: Page, { legacy = false, uploaded = false, bookName = '인물과 세계.txt', remainingReview = 0, candidateReadFailure = false, savedReferenceKind = 'UNSPECIFIED', savedReferenceEpisodeNo = null as number | null } = {}) {
  let content = '아린은 기사다.\n세계의 낮은 길다.\n';
  let currentRevision = revisionId;
  let hasJob = !legacy;
  let status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' = 'PENDING';
  let sealed = false;
  let journalStatus: 'PENDING' | 'INCOMPLETE' | 'SEALED' | 'INVALIDATED' = 'PENDING';
  let failureCode: string | null = null;
  let currentJobId = jobId;
  let frozenRevision = revisionId;
  let changed = false;
  let present = !uploaded;
  let referenceTimeKind = savedReferenceKind;
  let referenceEpisodeNo: number | null = savedReferenceEpisodeNo;
  let frozenReferenceTimeKind = savedReferenceKind;
  let frozenReferenceEpisodeNo: number | null = savedReferenceEpisodeNo;
  const calls = { analyze: 0, upload: 0, save: 0, episode: 0, jobReads: 0, bookReads: 0, references: [] as Array<{ kind: string | null; episodeNo: string | null }>, saveBodies: [] as Array<Record<string, unknown>>, scopes: [] as Array<string | null> };
  const source = () => ({ sourceKind: 'SETTING_BOOK', episodeId: null, episodeNo: null,
    settingBookId: bookId, settingBookName: bookName, revisionId: frozenRevision,
    revisionNo: 1, contentHash: 'a'.repeat(64), referenceTimeKind: frozenReferenceTimeKind, referenceEpisodeNo: frozenReferenceEpisodeNo });
  const job = () => ({ id: currentJobId, workId, batchId, episodeId: null, episodes: [], source: source(),
    jobType: 'SETTING_EXTRACTION', status, reviewMode: 'AUTOMATIC', currentStep: 'SETTING_EXTRACTION',
    failureCode, automaticAppliedAt: sealed ? '2026-10-06T12:00:00' : null,
    analysisRun: { mode: 'ORDERED_PROVISIONAL', runId: currentJobId, generation: 1, sequence: 0, journalStatus } });
  const book = () => ({ id: bookId, workId, batchId, originalFilename: bookName,
    mimeType: 'text/plain', fileSize: Buffer.byteLength(content), uploadedAt: '2026-10-06T11:00:00',
    content, revisionId: currentRevision, revisionNo: currentRevision === revisionId ? 1 : 2,
    contentHash: 'a'.repeat(64), charCount: 20, latestAnalysisJob: hasJob ? job() : null,
    analysisStatus: hasJob ? status : null, contentChangedSinceAnalysis: changed, referenceTimeKind, referenceEpisodeNo });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'synthetic-book-analysis-token'));
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'book@example.test', displayName: '책 분석', role: 'AUTHOR', status: 'ACTIVE' });
    if (path === `/api/v1/works/${workId}`) return success(route, { id: workId, title: '설정집 작품', lifecycleStatus: 'ACTIVE' });
    if (path === '/api/v1/works') return success(route, [{ id: workId, title: '설정집 작품', genre: '판타지', episodeCount: 0 }]);
    if (path.endsWith('/episodes')) { calls.episode += 1; return success(route, []); }
    if (path === `/api/v1/works/${workId}/setting-books` && request.method() === 'POST') {
      calls.upload += 1; present = true; hasJob = true;
      calls.references.push({ kind: url.searchParams.get('referenceTimeKind'), episodeNo: url.searchParams.get('referenceEpisodeNo') });
      referenceTimeKind = url.searchParams.get('referenceTimeKind') ?? 'UNSPECIFIED';
      referenceEpisodeNo = referenceTimeKind === 'EPISODE' ? Number(url.searchParams.get('referenceEpisodeNo')) : null;
      frozenReferenceTimeKind = referenceTimeKind; frozenReferenceEpisodeNo = referenceEpisodeNo;
      return success(route, book());
    }
    if (path === `/api/v1/works/${workId}/setting-books`) return success(route, present ? [book()] : []);
    if (path === `/api/v1/works/${workId}/setting-books/${bookId}/analysis-jobs`) {
      if (changed || sealed || journalStatus === 'INVALIDATED') currentJobId = nextJobId;
      calls.analyze += 1; hasJob = true; status = 'PENDING'; sealed = false; changed = false;
      journalStatus = 'PENDING'; failureCode = null; frozenRevision = currentRevision;
      frozenReferenceTimeKind = referenceTimeKind; frozenReferenceEpisodeNo = referenceEpisodeNo;
      expect(request.postData()).toBeNull();
      return success(route, job());
    }
    if (path === `/api/v1/works/${workId}/setting-books/${bookId}`) {
      calls.bookReads += 1;
      if (request.method() === 'PATCH') {
        calls.save += 1;
        const body = request.postDataJSON(); calls.saveBodies.push(body);
        const next = body.content as string;
        const nextKind = body.referenceTimeKind ?? referenceTimeKind;
        const nextEpisodeNo = nextKind === 'EPISODE' ? body.referenceEpisodeNo : null;
        if (next !== content || nextKind !== referenceTimeKind || nextEpisodeNo !== referenceEpisodeNo) { currentRevision = nextRevisionId; changed = hasJob; }
        content = next; referenceTimeKind = nextKind; referenceEpisodeNo = nextEpisodeNo;
      }
      return success(route, book());
    }
    if (path === `/api/v1/works/${workId}/analysis-jobs/${currentJobId}`) { calls.jobReads += 1; return success(route, job()); }
    if (path.endsWith('/analysis-jobs')) return success(route, hasJob ? [job()] : []);
    if (path.endsWith('/analysis-jobs/batches')) {
      if (candidateReadFailure) return route.fulfill({ status: 503, contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: 'UNEXPECTED_ERROR', message: '분석 목록을 확인하지 못했습니다.' } }) });
      const bookStatus = journalStatus === 'INVALIDATED' ? 'INVALIDATED' : sealed ? 'COMPLETED'
        : journalStatus === 'INCOMPLETE' || status === 'FAILED' ? 'INTERRUPTED' : status === 'PENDING' ? 'PENDING' : 'IN_PROGRESS';
      const counts = (remaining: number) => ({ totalCandidateCount: remaining, reviewedCandidateCount: 0,
        pendingCandidateCount: remaining, directReviewCandidateCount: remaining, processingCandidateCount: 0 });
      return success(route, { content: [{ batchId, uploadType: 'SETTING_BOOK',
        status: sealed ? remainingReview > 0 ? 'REVIEW_REQUIRED' : 'COMPLETED' : 'IN_PROGRESS',
        episodeStatus: null, episodeJobGroups: [], settingBooks: [{ settingBookId: bookId, sourceAnalysisJobId: currentJobId,
          batchId, revisionId: frozenRevision, settingBookName: bookName, status: bookStatus, failureCode,
          currentStep: 'SETTING_EXTRACTION', contentChangedSinceAnalysis: changed, historical: currentRevision !== frozenRevision,
          lastActivityAt: '2026-10-06T12:00:00', characterCandidates: counts(remainingReview), worldCandidates: counts(0) }],
        jobGroups: [{ jobType: 'SETTING_EXTRACTION', status: sealed ? 'COMPLETED' : 'IN_PROGRESS', currentAnalysisJobIds: [currentJobId] }] }],
        page: 0, size: 10, totalPages: 1, totalElements: 1 });
    }
    if (path.endsWith('/setting-candidates') || path.endsWith('/world-setting-candidates')) {
      if (candidateReadFailure) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'UNEXPECTED_ERROR', message: '검토 상태를 확인하지 못했습니다.' } }) });
      const remaining = path.endsWith('/world-setting-candidates') ? 0 : remainingReview;
      calls.scopes.push(url.searchParams.get('sourceAnalysisJobId'));
      return success(route, { batchId, totalCandidateCount: remaining, reviewedCandidateCount: 0, pendingCandidateCount: remaining,
        confirmedCandidateCount: 0, dismissedCandidateCount: 0, directReviewCandidateCount: remaining,
        processingCandidateCount: 0, groups: { content: [], page: 0, totalPages: 0, totalElements: 0 } });
    }
    return success(route, []);
  });
  return { calls, finish: () => { status = 'SUCCEEDED'; sealed = true; journalStatus = 'SEALED'; },
    run: () => { status = 'RUNNING'; },
    interrupt: ({ quota = false, invalidated = false, sourceChanged = false, failed = false } = {}) => {
      status = failed ? 'FAILED' : 'SUCCEEDED';
      journalStatus = invalidated ? 'INVALIDATED' : 'INCOMPLETE';
      failureCode = quota ? 'AI_TOKEN_QUOTA_EXHAUSTED' : failed ? 'LLM_NETWORK_ERROR' : null;
      if (sourceChanged) { changed = true; currentRevision = nextRevisionId; }
    },
    awaitApply: () => { status = 'SUCCEEDED'; journalStatus = 'SEALED'; sealed = false; } };
}

test('설정집 업로드가 분석을 예약하고 새로고침 후 저장 완료와 출처별 검토를 복원한다', async ({ page }) => {
  const fixture = await setupBook(page, { uploaded: true, remainingReview: 1 });
  await page.goto(workspace.split('&settingBookFileId')[0]);
  await page.getByTestId('open-setting-book-upload').click();
  await page.getByTestId('setting-book-file-input').setInputFiles({ name: '인물과 세계.txt', mimeType: 'text/plain', buffer: Buffer.from('설정집') });
  await page.getByTestId('setting-book-upload-submit').click();
  await expect(page).toHaveURL(new RegExp(`settingBookFileId=${bookId}`));
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석 대기');
  expect(fixture.calls.analyze).toBe(0);
  await page.reload();
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석 대기');
  fixture.run();
  await page.reload();
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석 중');
  await expect(page.getByTestId('setting-book-review')).toHaveCount(0);
  fixture.finish();
  await page.reload();
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석·자동 반영 완료');
  await page.getByTestId('setting-book-review').click();
  await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${jobId}`));
  await expect.poll(() => fixture.calls.scopes.length).toBeGreaterThanOrEqual(2);
  expect(fixture.calls.scopes.every(scope => scope === jobId)).toBe(true);
});

test('미분석 설정집은 명시적으로 분석하고 저장 전 초안은 분석을 막는다', async ({ page }) => {
  const fixture = await setupBook(page, { legacy: true });
  await page.goto(workspace);
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('아직 분석하지 않은 설정집');
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByTestId('setting-book-editor').fill('수정한 원문');
  await expect(page.getByTestId('setting-book-analyze')).toBeDisabled();
  await expect(page.getByText('원문과 기준 시점을 저장한 뒤 분석해 주세요.', { exact: true })).toBeVisible();
  await page.getByTestId('setting-book-save').click();
  await expect.poll(() => fixture.calls.save).toBe(1);
  expect(fixture.calls.analyze).toBe(0);
  await page.getByTestId('setting-book-analyze').click();
  await expect.poll(() => fixture.calls.analyze).toBe(1);
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석 대기');
});

test('설정집 진행 URL은 회차가 없는 실제 책 작업을 복원하고 설정집으로 돌아간다', async ({ page }) => {
  const fixture = await setupBook(page);
  await page.goto(`/episode-upload?workId=${workId}&sourceAnalysisJobId=${jobId}`);
  await expect(page.getByRole('heading', { name: '설정집 분석', exact: true })).toBeVisible();
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('인물과 세계.txt');
  await expect(page.getByText(/회차 업로드 방식을 선택/)).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석 대기');
  expect(fixture.calls.episode).toBe(0);
  await page.getByRole('button', { name: '설정집으로 돌아가기' }).click();
  await expect(page).toHaveURL(new RegExp(`tab=worldrules.*settingBookFileId=${bookId}`));
});

for (const route of ['workspace', 'progress'] as const) {
  test(`완료되지 않은 설정집 분석은 ${route}에서 기존 원문과 작업으로 재개한다`, async ({ page }) => {
    const fixture = await setupBook(page);
    fixture.interrupt();
    await page.goto(route === 'workspace' ? workspace : `/episode-upload?workId=${workId}&sourceAnalysisJobId=${jobId}`);
    await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석 중단');
    await expect(page.getByTestId('setting-book-analyze')).toHaveText('분석 재개');
    await expect(page.getByTestId('setting-book-analyze')).toBeEnabled();
    const settledReads = fixture.calls.jobReads;
    await page.waitForTimeout(3300);
    expect(fixture.calls.jobReads).toBe(settledReads);
    await page.getByTestId('setting-book-analyze').click();
    await expect.poll(() => fixture.calls.analyze).toBe(1);
    await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석 대기');
    expect(fixture.calls.save).toBe(0);
    if (route === 'progress') {
      await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${jobId}`));
      expect(fixture.calls.episode).toBe(0);
    }
  });
}

test('설정집 진행의 원문 조회 실패를 다시 확인하면 기존 중단 작업만 명시적으로 재개한다', async ({ page }) => {
  const fixture = await setupBook(page);
  fixture.interrupt();
  let failing = true;
  let bookRequests = 0;
  await page.route(`**/api/v1/works/${workId}/setting-books/${bookId}`, route => {
    bookRequests += 1;
    if (failing) return route.fulfill({ status: 503, contentType: 'application/json',
      body: JSON.stringify({ success: false, error: { code: 'UNEXPECTED_ERROR', message: '원문 조회 일시 실패' } }) });
    return route.fallback();
  });
  await page.goto(`/episode-upload?workId=${workId}&sourceAnalysisJobId=${jobId}`);
  const status = page.getByTestId('setting-book-analysis-status');
  await expect(status.getByRole('button', { name: '상태 다시 확인', exact: true })).toBeVisible();
  await expect(page.getByTestId('setting-book-analyze')).toBeDisabled();
  expect(fixture.calls.analyze).toBe(0);
  const failedBookReads = bookRequests;
  const successfulJobReads = fixture.calls.jobReads;
  failing = false;
  await status.getByRole('button', { name: '상태 다시 확인', exact: true }).click();
  await expect.poll(() => bookRequests).toBeGreaterThan(failedBookReads);
  await expect.poll(() => fixture.calls.jobReads).toBeGreaterThan(successfulJobReads);
  await expect(page.getByTestId('setting-book-analyze')).toHaveText('분석 재개');
  await expect(page.getByTestId('setting-book-analyze')).toBeEnabled();
  expect(fixture.calls.analyze).toBe(0);
  await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${jobId}`));
  await page.getByTestId('setting-book-analyze').click();
  await expect.poll(() => fixture.calls.analyze).toBe(1);
  await expect(status).toContainText('분석 대기');
  await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${jobId}`));
  expect(fixture.calls.save).toBe(0);
  expect(fixture.calls.episode).toBe(0);
});

test('사용량으로 중단된 불완전 설정집 분석은 회차 안내 없이 재개한다', async ({ page }) => {
  const fixture = await setupBook(page);
  fixture.interrupt({ quota: true });
  await page.goto(workspace);
  await expect(page.getByRole('dialog')).toContainText('설정집 분석이 중단되었습니다');
  await expect(page.getByRole('dialog')).not.toContainText('회차');
  await page.getByRole('button', { name: '사용량 안내 닫기' }).click();
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('사용량 부족');
  await page.getByTestId('setting-book-analyze').click();
  await expect.poll(() => fixture.calls.analyze).toBe(1);
});

test('일반 실패한 설정집 분석도 초안과 기존 완료 단계를 유지하며 재개한다', async ({ page }) => {
  const fixture = await setupBook(page);
  fixture.interrupt({ failed: true });
  await page.goto(workspace);
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석 중단');
  await page.getByRole('button', { name: '사유 확인', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${jobId}`));
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석 서비스와 연결하지 못해 중단됐습니다.');
  await page.getByRole('button', { name: '설정집으로 돌아가기', exact: true }).click();
  await expect(page.getByTestId('setting-book-analyze')).toHaveText('분석 재개');
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByTestId('setting-book-editor').fill('실패 뒤에도 유지할 초안');
  await expect(page.getByTestId('setting-book-analyze')).toBeDisabled();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByTestId('setting-book-analyze').click();
  await expect.poll(() => fixture.calls.analyze).toBe(1);
  expect(fixture.calls.save).toBe(0);
  await page.getByRole('button', { name: '분석 진행 보기' }).click();
  await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${jobId}`));
});

test('반영을 기다리는 성공 작업은 완료나 재분석으로 표시하지 않는다', async ({ page }) => {
  const fixture = await setupBook(page);
  fixture.awaitApply();
  await page.goto(workspace);
  await expect(page.getByTestId('setting-book-analyze')).toBeDisabled();
  await expect(page.getByTestId('setting-book-review')).toHaveCount(0);
  await expect(page.getByTestId('setting-book-analysis-status')).not.toContainText('분석·자동 반영 완료');
});

test('변경된 원문으로 무효화된 분석은 이전 작업 재개와 구별한다', async ({ page }) => {
  const fixture = await setupBook(page);
  fixture.interrupt({ invalidated: true, sourceChanged: true });
  await page.goto(workspace);
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('원문 변경으로 중단된 분석');
  await expect(page.getByTestId('setting-book-analyze')).toHaveText('다시 분석');
  await page.getByTestId('setting-book-analyze').click();
  await expect.poll(() => fixture.calls.analyze).toBe(1);
  await page.getByRole('button', { name: '분석 진행 보기' }).click();
  await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${nextJobId}`));
});

test('상태 폴링은 편집 중 초안을 유지하고 같은 원문의 새 분석 작업을 따른다', async ({ page }) => {
  const fixture = await setupBook(page);
  await page.goto(workspace);
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석 대기');
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByTestId('setting-book-editor').fill('저장하지 않은 초안');
  const reads = fixture.calls.bookReads;
  fixture.finish();
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석·자동 반영 완료', { timeout: 7000 });
  await expect(page.getByTestId('setting-book-editor')).toHaveValue('저장하지 않은 초안');
  await expect.poll(() => fixture.calls.bookReads).toBeGreaterThan(reads);
  await expect(page.getByTestId('setting-book-analyze')).toBeDisabled();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.getByTestId('setting-book-analyze').click();
  await expect.poll(() => fixture.calls.analyze).toBe(1);
  expect(fixture.calls.save).toBe(0);
  await page.getByRole('button', { name: '분석 진행 보기' }).click();
  await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${nextJobId}`));
});

for (const { width, zoom } of [{ width: 320, zoom: 1 }, { width: 390, zoom: 1 },
  { width: 1280, zoom: 1 }, { width: 1280, zoom: 2 }]) {
  test(`설정집 상태와 분석 액션은 ${width}px ${zoom * 100}%에서 가로로 넘치지 않는다`, async ({ page }) => {
    // Native 200% zoom halves CSS layout space and changes responsive breakpoints.
    // A CSS zoom property alone would magnify desktop columns without that reflow.
    const layoutWidth = Math.round(width / zoom);
    await page.setViewportSize({ width: layoutWidth, height: 900 });
    await setupBook(page, { legacy: true });
    await page.goto(workspace);
    await expect(page.getByTestId('setting-book-analyze')).toBeEnabled();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    const statusBounds = (await page.getByTestId('setting-book-analysis-status').boundingBox())!;
    expect(statusBounds.x).toBeGreaterThanOrEqual(0);
    expect(statusBounds.x + statusBounds.width).toBeLessThanOrEqual(layoutWidth + 1);
    if (width <= 390) expect((await page.getByTestId('setting-book-analyze').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `docs/screens/gh221/book-analysis-${width}-${zoom * 100}.png`, animations: 'disabled' });
    await page.getByTestId('setting-book-analyze').click();
    await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석 대기');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  });
}

test('설정집은 등록하지 않은 회차를 기준 시점으로 업로드하며 원고 회차를 만들지 않는다', async ({ page }) => {
  const fixture = await setupBook(page, { uploaded: true });
  await page.goto(workspace.split('&settingBookFileId')[0]);
  await page.getByTestId('open-setting-book-upload').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.file-drop-area')).toBeVisible();
  await expect(dialog.locator('.episode-upload-stepper')).toBeVisible();
  const reference = dialog.locator('details.setting-book-reference');
  await expect(reference).not.toHaveAttribute('open');
  await expect(dialog.getByLabel('어느 시점의 설정인가요?')).toBeHidden();
  await reference.locator('summary').focus();
  await reference.locator('summary').press('Enter');
  await expect(dialog.getByLabel('어느 시점의 설정인가요?')).toHaveValue('UNSPECIFIED');
  await page.getByTestId('setting-book-file-input').setInputFiles({ name: '25화 기준 설정집.txt', mimeType: 'text/plain', buffer: Buffer.from('아린은 기사다.') });
  await expect(page.getByTestId('setting-book-upload-submit')).toBeEnabled();
  await dialog.getByLabel('어느 시점의 설정인가요?').selectOption('EPISODE');
  await expect(page.getByTestId('setting-book-upload-submit')).toBeDisabled();
  for (const invalid of ['0', '1.5', '2147483648']) {
    await dialog.getByLabel('기준 회차').fill(invalid);
    await expect(page.getByTestId('setting-book-upload-submit')).toBeDisabled();
  }
  await dialog.getByLabel('기준 회차').fill('25');
  await reference.locator('summary').click();
  await expect(dialog.getByLabel('기준 회차')).toBeHidden();
  await expect(page.getByTestId('setting-book-upload-submit')).toBeEnabled();
  await page.getByTestId('setting-book-upload-submit').click();
  await expect(page).toHaveURL(new RegExp(`settingBookFileId=${bookId}`));
  expect(fixture.calls.references).toEqual([{ kind: 'EPISODE', episodeNo: '25' }]);
  expect(fixture.calls.analyze).toBe(0);
  await expect(page.getByText('25화 종료 시점 기준', { exact: true })).toBeVisible();
});

test('원문을 그대로 두고 기준 시점만 변경해도 저장 전 분석을 잠그고 저장 후 명시적으로 분석한다', async ({ page }) => {
  const fixture = await setupBook(page);
  fixture.finish();
  await page.goto(workspace);
  await page.getByRole('button', { name: '수정', exact: true }).click();
  const originalContent = await page.getByTestId('setting-book-editor').inputValue();
  await page.locator('details.setting-book-reference > summary').click();
  await page.getByLabel('어느 시점의 설정인가요?').selectOption('EPISODE');
  await expect(page.getByTestId('setting-book-analyze')).toBeDisabled();
  await expect(page.getByTestId('setting-book-save')).toBeDisabled();
  await page.getByLabel('기준 회차').fill('25');
  await expect(page.getByTestId('setting-book-analyze')).toBeDisabled();
  await page.getByTestId('setting-book-save').click();
  await expect.poll(() => fixture.calls.saveBodies).toEqual([{ content: originalContent, referenceTimeKind: 'EPISODE', referenceEpisodeNo: 25, expectedRevisionNo: 1 }]);
  expect(fixture.calls.analyze).toBe(0);
  await expect(page.getByText('25화 종료 시점 기준', { exact: true })).toBeVisible();
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('기준 시점이 변경');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('원문과 기준 시점을 저장한 뒤 분석해 주세요.', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('setting-book-analyze')).toBeEnabled();
  await page.getByTestId('setting-book-analyze').click();
  await expect.poll(() => fixture.calls.analyze).toBe(1);
  await expect(page.getByTestId('setting-book-analysis-status')).toContainText('분석 대기');
});

test('기준 시점을 열지 않은 업로드는 미지정을 보내고 회차 번호를 생략한다', async ({ page }) => {
  const fixture = await setupBook(page, { uploaded: true });
  await page.goto(workspace.split('&settingBookFileId')[0]);
  await page.getByTestId('open-setting-book-upload').click();
  const reference = page.getByRole('dialog').locator('details.setting-book-reference');
  await expect(reference).not.toHaveAttribute('open');
  await page.getByTestId('setting-book-file-input').setInputFiles({ name: '시점 미지정.txt', mimeType: 'text/plain', buffer: Buffer.from('설정집') });
  await page.getByTestId('setting-book-upload-submit').click();
  await expect.poll(() => fixture.calls.upload).toBe(1);
  expect(fixture.calls.references).toEqual([{ kind: 'UNSPECIFIED', episodeNo: null }]);
});

for (const savedReferenceKind of ['UNSPECIFIED', 'EPISODE']) test(`접힌 기준 시점 ${savedReferenceKind} 저장값을 편집·저장·재열기에서 보존한다`, async ({ page }) => {
  const fixture = await setupBook(page, { savedReferenceKind, savedReferenceEpisodeNo: savedReferenceKind === 'EPISODE' ? 25 : null });
  await page.goto(workspace);
  await page.getByRole('button', { name: '수정', exact: true }).click();
  const reference = page.locator('details.setting-book-reference');
  await expect(reference).not.toHaveAttribute('open');
  await page.getByTestId('setting-book-editor').fill('본문만 수정');
  await page.getByTestId('setting-book-save').click();
  await expect.poll(() => fixture.calls.save).toBe(1);
  expect(fixture.calls.saveBodies[0]).toEqual({ content: '본문만 수정', referenceTimeKind: savedReferenceKind,
    ...(savedReferenceKind === 'EPISODE' ? { referenceEpisodeNo: 25 } : {}), expectedRevisionNo: 1 });
  await page.reload();
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await expect(reference).not.toHaveAttribute('open');
  await reference.locator('summary').click();
  await expect(page.getByLabel('어느 시점의 설정인가요?')).toHaveValue(savedReferenceKind);
  if (savedReferenceKind === 'EPISODE') await expect(page.getByLabel('기준 회차')).toHaveValue('25');
  else await expect(page.getByLabel('기준 회차')).toHaveCount(0);
});

test('설정집 분석 카드는 회차 프레임과 후보 집계를 사용하고 처리 이력은 두 탭 모두 전체 필터를 복원한다', async ({ page }) => {
  const fixture = await setupBook(page, { remainingReview: 1 });
  fixture.finish();
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  const card = page.getByTestId('book-analysis-card');
  await expect(card.locator('.analysis-batch-card__icon')).toBeVisible();
  await expect(card.locator('.analysis-batch-card__title-row')).toContainText('설정집');
  await expect(card.locator('.analysis-batch-card__groups')).toContainText('인물·세계관');
  await expect(card.locator('.analysis-review-count')).toContainText('캐릭터 설정 후보 0/1개 검토 완료');
  await expect(card.getByRole('button', { name: '확인이 필요한 1개 검토', exact: true })).toBeEnabled();
  await expect(card.locator('.analysis-card-footer')).toContainText('최근 활동');
  await card.getByRole('button', { name: '반영·제외 이력', exact: true }).click();
  await expect(page).toHaveURL(/reviewStatus=ALL/);
  await page.getByRole('button', { name: /세계관 후보/ }).click();
  await expect(page).toHaveURL(/candidateType=world/);
  await expect(page).toHaveURL(/reviewStatus=ALL/);
  await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${jobId}`));
});

test('검토가 모두 끝난 설정집 카드는 작품 설정을 연다', async ({ page }) => {
  const fixture = await setupBook(page);
  fixture.finish();
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  await page.getByTestId('book-analysis-card').getByRole('button', { name: '작품 설정 보기', exact: true }).click();
  await expect(page).toHaveURL(/nav=settingDB&tab=characters/);
});

test('설정집 요약 조회 실패에서는 목록 재시도를 제공한다', async ({ page }) => {
  const fixture = await setupBook(page, { candidateReadFailure: true });
  fixture.finish();
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  await expect(page.getByText('분석 목록을 불러오지 못했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 불러오기', exact: true })).toBeEnabled();
  await expect(page.getByTestId('book-analysis-card')).toHaveCount(0);
  expect(fixture.calls.scopes).toEqual([]);
});

for (const remaining of [0, 1]) {
  test(`설정집 완료 polling은 같은 요약의 후보 수로 ${remaining ? '검토' : '작품 설정'}를 연다`, async ({ page }) => {
    await page.clock.install();
    const fixture = await setupBook(page, { remainingReview: remaining });
    fixture.run();
    await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
    const card = page.getByTestId('book-analysis-card');
    await expect(card.getByRole('button', { name: '진행 보기', exact: true })).toBeEnabled();
    fixture.finish();
    await page.clock.fastForward(10_050);
    const action = card.getByRole('button', { name: remaining ? '확인이 필요한 1개 검토' : '작품 설정 보기', exact: true });
    await expect(action).toBeEnabled();
    expect(fixture.calls.scopes).toEqual([]);
    expect(fixture.calls.jobReads).toBe(0);
    expect(fixture.calls.bookReads).toBe(0);
    await action.click();
    await expect(page).toHaveURL(remaining ? new RegExp(`sourceAnalysisJobId=${jobId}`) : /nav=settingDB&tab=characters/);
  });
}
