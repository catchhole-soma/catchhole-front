import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const bookId = '22222222-2222-4222-8222-222222222222';
const otherBookId = '66666666-6666-4666-8666-666666666666';
const detailPath = `/api/v1/works/${workId}/setting-books/${bookId}`;
const workspace = `/dashboard?workId=${workId}&nav=settingDB&tab=worldrules&settingBookFileId=${bookId}`;
const original = '이름: 아린\n필기도구: 청동 펜';
const localDraft = '이름: 아린\n필기도구: 흑연필';
const otherOriginal = '이름: 가온\n필기도구: 먹붓';
const conflictMessage = '다른 창에서 설정집이 변경되었습니다.';

function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data, error: null }) });
}

function failure(route: Route, status: number, message: string) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({
    success: false, data: null, message,
    error: { code: status === 409 ? 'UPLOAD_SETTING_BOOK_REVISION_CONFLICT' : 'COMMON_ERROR', status, details: [] },
  }) });
}

async function setup(context: BrowserContext, initialRevision: number | null = 1) {
  let revisionNo = initialRevision;
  let content = original;
  let referenceTimeKind = 'UNSPECIFIED';
  let referenceEpisodeNo: number | null = null;
  let failuresLeft = 0;
  let readFailuresLeft = 0;
  let saveGate: Promise<void> | null = null;
  let secondBookVisible = false;
  let readGate: { promise: Promise<void>; started: () => void; finished: () => void; fail: boolean } | null = null;
  const calls = { patches: [] as Array<Record<string, unknown>>, reads: 0, analyses: 0 };
  const book = () => ({
    id: bookId, workId, batchId: '33333333-3333-4333-8333-333333333333',
    originalFilename: '원문 편집 설정집.txt', mimeType: 'text/plain',
    fileSize: Buffer.byteLength(content), uploadedAt: '2026-10-07T11:00:00', content,
    revisionNo, revisionId: revisionNo == null ? null : `55555555-5555-4555-8555-${String(revisionNo).padStart(12, '0')}`,
    contentHash: 'a'.repeat(64), charCount: [...content].length,
    referenceTimeKind, referenceEpisodeNo, latestAnalysisJob: null,
    analysisStatus: null, contentChangedSinceAnalysis: false,
  });
  const otherBook = () => ({ ...book(), id: otherBookId, originalFilename: '다른 인물 설정집.txt',
    content: otherOriginal, fileSize: Buffer.byteLength(otherOriginal), charCount: [...otherOriginal].length,
    revisionId: '77777777-7777-4777-8777-777777777777', revisionNo: 7,
    referenceTimeKind: 'WORK_START', referenceEpisodeNo: null });
  await context.addInitScript(() => {
    localStorage.setItem('accessToken', 'synthetic-source-editor-token');
    localStorage.removeItem('catchhole_demo_mode');
  });
  await context.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'editor@example.test', displayName: '원문 편집', role: 'AUTHOR', status: 'ACTIVE' });
    if (path === '/api/v1/works') return success(route, [{ id: workId, title: '원문 편집 작품', genre: '판타지', episodeCount: 0 }]);
    if (path === `/api/v1/works/${workId}`) return success(route, { id: workId, title: '원문 편집 작품', lifecycleStatus: 'ACTIVE' });
    if (path === `/api/v1/works/${workId}/setting-books`) return success(route, secondBookVisible ? [book(), otherBook()] : [book()]);
    if (path === `${detailPath}/analysis-jobs`) {
      calls.analyses += 1;
      return failure(route, 500, '이 검증은 분석을 실행하지 않습니다.');
    }
    if ((path === detailPath || path === `/api/v1/works/${workId}/setting-books/${otherBookId}`) && request.method() === 'GET') {
      calls.reads += 1;
      const current = path === detailPath ? book() : otherBook();
      const pending = readGate; readGate = null;
      if (pending) {
        pending.started();
        try {
          await pending.promise;
          if (pending.fail) return await failure(route, 503, '이전 선택의 최신 조회가 실패했습니다.');
          return await success(route, current);
        } finally {
          pending.finished();
        }
      }
      if (readFailuresLeft > 0) { readFailuresLeft -= 1; return failure(route, 503, '최신 원문을 불러오지 못했습니다.'); }
      return success(route, current);
    }
    if (path === detailPath && request.method() === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      calls.patches.push(body);
      if (failuresLeft > 0) { failuresLeft -= 1; return failure(route, 500, '저장하지 못했습니다. 다시 시도해 주세요.'); }
      if (!Number.isInteger(body.expectedRevisionNo) || (body.expectedRevisionNo as number) < 0) {
        return failure(route, 400, '편집을 시작한 원문 버전이 필요합니다.');
      }
      if (body.expectedRevisionNo !== (revisionNo ?? 0)) return failure(route, 409, conflictMessage);
      const nextKind = body.referenceTimeKind as string;
      const nextEpisodeNo = nextKind === 'EPISODE' ? body.referenceEpisodeNo as number : null;
      if (body.content !== content || nextKind !== referenceTimeKind || nextEpisodeNo !== referenceEpisodeNo) {
        revisionNo = (revisionNo ?? 0) + 1;
      }
      content = body.content as string; referenceTimeKind = nextKind; referenceEpisodeNo = nextEpisodeNo;
      const updated = book();
      const pending = saveGate; saveGate = null;
      if (pending) await pending;
      return success(route, updated);
    }
    return success(route, []);
  });
  return {
    calls, current: book,
    changeReference(kind: string, episodeNo: number | null, nextContent = content) {
      revisionNo = (revisionNo ?? 0) + 1;
      referenceTimeKind = kind; referenceEpisodeNo = episodeNo; content = nextContent;
    },
    failNextSave() { failuresLeft = 1; },
    failNextRead() { readFailuresLeft = 1; },
    showSecondBook() { secondBookVisible = true; },
    deferNextRead(fail = false) {
      let release!: () => void;
      let started = false;
      let finished = false;
      const promise = new Promise<void>(resolve => { release = resolve; });
      readGate = { promise, started: () => { started = true; }, finished: () => { finished = true; }, fail };
      return { release, started: () => started, finished: () => finished };
    },
    deferNextSave() {
      let release!: () => void;
      saveGate = new Promise<void>(resolve => { release = resolve; });
      return release;
    },
  };
}

async function startEditing(page: Page) {
  await page.goto(workspace);
  await expect(page.getByTestId('setting-book-source')).toContainText(original);
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await expect(page.getByTestId('setting-book-editor')).toHaveValue(original);
  await page.locator('details.setting-book-reference > summary').click();
}

test('두 탭: 다른 창의 기준 시점 저장 후 뒤처진 본문·시점 초안을 보존하고 저장을 막는다', async ({ page, context }) => {
  const fixture = await setup(context);
  await page.clock.install();
  await startEditing(page);
  await page.getByTestId('setting-book-editor').fill(localDraft);
  await page.getByLabel('어느 시점의 설정인가요?').selectOption('WORK_START');
  const other = await context.newPage();
  await startEditing(other);
  await other.getByLabel('어느 시점의 설정인가요?').selectOption('EPISODE');
  await other.getByLabel('기준 회차').fill('3');
  await other.getByTestId('setting-book-save').click();
  await expect(other.getByText('3화 종료 시점 기준', { exact: true })).toBeVisible();
  expect(fixture.calls.patches).toEqual([{ content: original, referenceTimeKind: 'EPISODE', referenceEpisodeNo: 3, expectedRevisionNo: 1 }]);
  const reads = fixture.calls.reads;
  await page.clock.runFor(3500);
  await expect.poll(() => fixture.calls.reads).toBeGreaterThan(reads);
  await expect(page.getByTestId('setting-book-save')).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('최신 원문과 기준 시점');
  await expect(page.getByTestId('setting-book-editor')).toHaveValue(localDraft);
  await expect(page.getByLabel('어느 시점의 설정인가요?')).toHaveValue('WORK_START');
  await expect(page.getByTestId('setting-book-analyze')).toBeDisabled();
  expect(fixture.current()).toMatchObject({ content: original, referenceTimeKind: 'EPISODE', referenceEpisodeNo: 3, revisionNo: 2 });
  expect(fixture.calls.analyses).toBe(0);
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByTestId('setting-book-source')).toContainText(original);
  await expect(page.getByText('3화 종료 시점 기준', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByTestId('setting-book-editor').fill(localDraft);
  await page.getByTestId('setting-book-save').click();
  await expect(page.getByTestId('setting-book-source')).toContainText(localDraft);
  expect(fixture.calls.patches[1]).toEqual({ content: localDraft, referenceTimeKind: 'EPISODE', referenceEpisodeNo: 3, expectedRevisionNo: 2 });
});

test('편집 중 원문은 같고 기준 시점만 새 리비전이 되어도 저장을 잠근다', async ({ page, context }) => {
  const fixture = await setup(context);
  await page.clock.install();
  await startEditing(page);
  await page.getByLabel('어느 시점의 설정인가요?').selectOption('EPISODE');
  await page.getByLabel('기준 회차').fill('25');
  fixture.changeReference('WORK_START', null);
  const reads = fixture.calls.reads;
  await page.clock.runFor(3500);
  await expect.poll(() => fixture.calls.reads).toBeGreaterThan(reads);
  await expect(page.getByTestId('setting-book-save')).toBeDisabled();
  await expect(page.getByTestId('setting-book-editor')).toHaveValue(original);
  await expect(page.getByLabel('기준 회차')).toHaveValue('25');
  await expect(page.getByTestId('setting-book-analyze')).toBeDisabled();
  expect(fixture.calls.patches).toEqual([]);
});

test('새 원문 조회 직후 서버가 바뀐 race는 고정 버전으로 409를 받고 모든 입력을 보존한다', async ({ page, context }) => {
  const fixture = await setup(context, 6);
  await page.clock.install();
  await startEditing(page);
  await page.getByTestId('setting-book-editor').fill(localDraft);
  await page.getByLabel('어느 시점의 설정인가요?').selectOption('EPISODE');
  await page.getByLabel('기준 회차').fill('25');
  // No polling time passes between the independent write and this save.
  fixture.changeReference('WORK_START', null, '다른 창이 저장한 최신 원문');
  await page.getByTestId('setting-book-save').click();
  await expect(page.getByRole('alert')).toContainText('최신 원문과 기준 시점');
  await expect(page.getByTestId('setting-book-save')).toBeDisabled();
  await expect(page.getByTestId('setting-book-editor')).toHaveValue(localDraft);
  await expect(page.getByLabel('기준 회차')).toHaveValue('25');
  await expect(page.getByTestId('setting-book-analyze')).toBeDisabled();
  expect(fixture.calls.patches).toEqual([{ content: localDraft, referenceTimeKind: 'EPISODE', referenceEpisodeNo: 25, expectedRevisionNo: 6 }]);
  expect(fixture.current()).toMatchObject({ content: '다른 창이 저장한 최신 원문', referenceTimeKind: 'WORK_START', revisionNo: 7 });
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByTestId('setting-book-source')).toContainText('다른 창이 저장한 최신 원문');
  await expect(page.getByText('작품 시작 시점 기준', { exact: true })).toBeVisible();
  expect(fixture.calls.analyses).toBe(0);
});

test('레거시 null 리비전은 편집 시작 버전 0으로 저장하고 분석을 예약하지 않는다', async ({ page, context }) => {
  const fixture = await setup(context, null);
  await startEditing(page);
  await page.getByTestId('setting-book-editor').fill(localDraft);
  await page.getByTestId('setting-book-save').click();
  await expect(page.getByTestId('setting-book-source')).toContainText(localDraft);
  expect(fixture.calls.patches).toEqual([{ content: localDraft, referenceTimeKind: 'UNSPECIFIED', expectedRevisionNo: 0 }]);
  expect(fixture.current().revisionNo).toBe(1);
  expect(fixture.calls.analyses).toBe(0);
});

test('현재 리비전의 변경 없는 저장도 그 버전을 보내며 새 리비전이나 분석을 만들지 않는다', async ({ page, context }) => {
  const fixture = await setup(context, 4);
  await startEditing(page);
  await page.getByTestId('setting-book-save').click();
  await expect(page.getByTestId('setting-book-editor')).toHaveCount(0);
  expect(fixture.calls.patches).toEqual([{ content: original, referenceTimeKind: 'UNSPECIFIED', expectedRevisionNo: 4 }]);
  expect(fixture.current().revisionNo).toBe(4);
  expect(fixture.calls.analyses).toBe(0);
});

test('자기 저장의 새 리비전을 응답 전에 조회해도 성공 후 충돌 안내나 분석 잠금이 남지 않는다', async ({ page, context }) => {
  const fixture = await setup(context);
  await page.clock.install();
  await startEditing(page);
  await page.getByLabel('어느 시점의 설정인가요?').selectOption('EPISODE');
  await page.getByLabel('기준 회차').fill('3');
  const release = fixture.deferNextSave();
  try {
    await page.getByTestId('setting-book-save').click();
    await expect.poll(() => fixture.current().revisionNo).toBe(2);
    const reads = fixture.calls.reads;
    await page.clock.runFor(3500);
    await expect.poll(() => fixture.calls.reads).toBeGreaterThan(reads);
  } finally {
    release();
  }
  await expect(page.getByTestId('setting-book-source')).toContainText(original);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('원문과 기준 시점을 저장한 뒤 분석해 주세요.', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('setting-book-analyze')).toBeEnabled();
  await page.clock.runFor(3500);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await expect(page.getByTestId('setting-book-save')).toBeEnabled();
  await expect(page.getByLabel('기준 회차')).toHaveValue('3');
  await page.locator('details.setting-book-reference > summary').click();
  await page.getByLabel('어느 시점의 설정인가요?').selectOption('WORK_START');
  await page.getByTestId('setting-book-save').click();
  await expect(page.getByText('작품 시작 시점 기준', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(fixture.calls.patches).toEqual([
    { content: original, referenceTimeKind: 'EPISODE', referenceEpisodeNo: 3, expectedRevisionNo: 1 },
    { content: original, referenceTimeKind: 'WORK_START', expectedRevisionNo: 2 },
  ]);
  expect(fixture.calls.analyses).toBe(0);
});

test('일반 저장 실패와 같은 리비전 polling 후 재시도도 처음 확인한 버전과 초안을 유지한다', async ({ page, context }) => {
  const fixture = await setup(context, 3);
  await page.clock.install();
  await startEditing(page);
  await page.getByTestId('setting-book-editor').fill(localDraft);
  await page.getByLabel('어느 시점의 설정인가요?').selectOption('WORK_START');
  fixture.failNextSave();
  await page.getByTestId('setting-book-save').click();
  await expect(page.getByRole('alert')).toContainText('다시 시도');
  await page.clock.runFor(3500);
  await expect(page.getByTestId('setting-book-save')).toBeEnabled();
  await expect(page.getByTestId('setting-book-editor')).toHaveValue(localDraft);
  await expect(page.getByLabel('어느 시점의 설정인가요?')).toHaveValue('WORK_START');
  await page.getByTestId('setting-book-save').click();
  await expect(page.getByTestId('setting-book-source')).toContainText(localDraft);
  expect(fixture.calls.patches).toEqual([
    { content: localDraft, referenceTimeKind: 'WORK_START', expectedRevisionNo: 3 },
    { content: localDraft, referenceTimeKind: 'WORK_START', expectedRevisionNo: 3 },
  ]);
  expect(fixture.calls.analyses).toBe(0);
});

test('기준 시점만 연속 저장할 때는 새 편집 시작마다 최신 리비전을 캡처한다', async ({ page, context }) => {
  const fixture = await setup(context);
  await startEditing(page);
  await page.getByLabel('어느 시점의 설정인가요?').selectOption('WORK_START');
  await page.getByTestId('setting-book-save').click();
  await expect(page.getByText('작품 시작 시점 기준', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.locator('details.setting-book-reference > summary').click();
  await page.getByLabel('어느 시점의 설정인가요?').selectOption('EPISODE');
  await page.getByLabel('기준 회차').fill('3');
  await page.getByTestId('setting-book-save').click();
  await expect(page.getByText('3화 종료 시점 기준', { exact: true })).toBeVisible();
  expect(fixture.calls.patches).toEqual([
    { content: original, referenceTimeKind: 'WORK_START', expectedRevisionNo: 1 },
    { content: original, referenceTimeKind: 'EPISODE', referenceEpisodeNo: 3, expectedRevisionNo: 2 },
  ]);
  expect(fixture.calls.analyses).toBe(0);
});

test('충돌 후 취소의 최신 조회가 실패하면 열린 입력과 저장 잠금을 보존한다', async ({ page, context }) => {
  const fixture = await setup(context);
  await page.clock.install();
  await startEditing(page);
  await page.getByTestId('setting-book-editor').fill(localDraft);
  fixture.changeReference('WORK_START', null);
  await page.getByTestId('setting-book-save').click();
  await expect(page.getByTestId('setting-book-save')).toBeDisabled();
  fixture.failNextRead();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByTestId('setting-book-editor')).toHaveValue(localDraft);
  await expect(page.getByTestId('setting-book-save')).toBeDisabled();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByTestId('setting-book-source')).toContainText(original);
  await expect(page.getByText('작품 시작 시점 기준', { exact: true })).toBeVisible();
});

for (const variant of ['다른 책', '다른 책을 거쳐 같은 책', '이전 조회 실패'] as const) {
  test(`지연된 취소 응답은 ${variant}의 새 편집 세션을 덮거나 닫지 않는다`, async ({ page, context }) => {
    const fixture = await setup(context);
    fixture.showSecondBook();
    await page.clock.install();
    await startEditing(page);
    await page.getByTestId('setting-book-editor').fill(localDraft);
    const pending = fixture.deferNextRead(variant === '이전 조회 실패');
    try {
      await page.getByRole('button', { name: '취소', exact: true }).click();
      await expect.poll(pending.started).toBe(true);
      await page.getByTestId(`setting-book-row-${otherBookId}`).click();
      await expect(page.getByTestId('setting-book-source')).toContainText(otherOriginal);
      if (variant === '다른 책을 거쳐 같은 책') {
        await page.getByTestId(`setting-book-row-${bookId}`).click();
        await expect(page.getByTestId('setting-book-source')).toContainText(original);
      }
      await page.getByRole('button', { name: '수정', exact: true }).click();
      await page.locator('details.setting-book-reference > summary').click();
      await page.getByTestId('setting-book-editor').fill('새 편집 세션에서 작성한 원문');
      await page.getByLabel('어느 시점의 설정인가요?').selectOption('EPISODE');
      await page.getByLabel('기준 회차').fill('25');
      pending.release();
      await expect.poll(pending.finished).toBe(true);
      await page.clock.runFor(100);
      await expect(page.getByTestId('setting-book-editor')).toHaveValue('새 편집 세션에서 작성한 원문');
      await expect(page.getByLabel('기준 회차')).toHaveValue('25');
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(page.getByTestId('setting-book-save')).toBeEnabled();
      await expect(page.getByTestId('setting-book-analyze')).toBeDisabled();
      expect(fixture.calls.patches).toEqual([]);
      expect(fixture.calls.analyses).toBe(0);
    } finally {
      pending.release();
    }
  });
}

test('이전 선택의 취소 응답은 새 선택에서 진행 중인 취소의 대기 잠금을 해제하지 않는다', async ({ page, context }) => {
  const fixture = await setup(context);
  fixture.showSecondBook();
  await page.clock.install();
  await startEditing(page);
  const oldRead = fixture.deferNextRead();
  let latestRead: ReturnType<typeof fixture.deferNextRead> | null = null;
  try {
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await expect.poll(oldRead.started).toBe(true);
    await page.getByTestId(`setting-book-row-${otherBookId}`).click();
    await expect(page.getByTestId('setting-book-source')).toContainText(otherOriginal);
    await page.getByRole('button', { name: '수정', exact: true }).click();
    await page.getByTestId('setting-book-editor').fill('새 선택에서 취소를 기다리는 초안');
    latestRead = fixture.deferNextRead();
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await expect.poll(latestRead.started).toBe(true);
    oldRead.release();
    await expect.poll(oldRead.finished).toBe(true);
    await page.clock.runFor(100);
    await expect(page.getByTestId('setting-book-editor')).toHaveValue('새 선택에서 취소를 기다리는 초안');
    await expect(page.getByTestId('setting-book-save')).toBeDisabled();
    await expect(page.getByRole('button', { name: '취소', exact: true })).toBeDisabled();
    latestRead.release();
    await expect(page.getByTestId('setting-book-editor')).toHaveCount(0);
    await expect(page.getByTestId('setting-book-source')).toContainText(otherOriginal);
    await expect(page.getByText('작품 시작 시점 기준', { exact: true })).toBeVisible();
    expect(fixture.calls.patches).toEqual([]);
  } finally {
    oldRead.release();
    latestRead?.release();
  }
});
