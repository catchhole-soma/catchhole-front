import { expect, test, type Page } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const episodeJobId = '33333333-3333-4333-8333-333333333333';
const bookId = '44444444-4444-4444-8444-444444444444';
const originId = '55555555-5555-4555-8555-555555555555';
const revisionId = '66666666-6666-4666-8666-666666666666';
const originBatchId = '77777777-7777-4777-8777-777777777777';
const counts = { totalCandidateCount: 4, reviewedCandidateCount: 1, pendingCandidateCount: 3,
  directReviewCandidateCount: 1, processingCandidateCount: 2 };
const group = { jobType: 'SETTING_EXTRACTION', status: 'IN_PROGRESS', totalJobCount: 1,
  succeededJobCount: 0, runningJobCount: 1, pendingJobCount: 0, failedJobCount: 0,
  canceledJobCount: 0, currentAnalysisJobIds: [episodeJobId] };
const book = { settingBookId: bookId, sourceAnalysisJobId: originId, batchId: originBatchId,
  revisionId, settingBookName: '북부 인물 설정.txt', status: 'COMPLETED', failureCode: null,
  currentStep: null, contentChangedSinceAnalysis: true, historical: false,
  lastActivityAt: '2026-10-24T10:00:00', characterCandidates: { ...counts, directReviewCandidateCount: 0, processingCandidateCount: 0 },
  worldCandidates: counts };
const mixed = { batchId, uploadType: 'SINGLE_EPISODE', status: 'IN_PROGRESS', episodeStatus: 'IN_PROGRESS',
  episodeStartNo: 3, episodeEndNo: 3, episodeCount: 1, jobGroups: [{ ...group, currentAnalysisJobIds: [episodeJobId, originId] }],
  episodeJobGroups: [group], settingBooks: [book] };

async function setup(page: Page, getContent: () => unknown[] = () => [mixed], totalPages = 1) {
  const calls: string[] = [];
  await page.addInitScript(() => localStorage.setItem('accessToken', 'synthetic-summary-test'));
  await page.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    calls.push(path);
    const data = path.endsWith('/auth/me')
      ? { id: 1, email: 'summary@example.test', displayName: '요약', role: 'AUTHOR', status: 'ACTIVE' }
      : path.endsWith('/analysis-jobs/batches')
        ? { content: getContent(), page: Number(url.searchParams.get('page') ?? '0'), size: 10, totalPages, totalElements: totalPages === 1 ? 1 : 11 }
        : path === `/api/v1/works/${workId}` ? { id: workId, title: '요약 작품', lifecycleStatus: 'ACTIVE' }
          : path === '/api/v1/works' ? [{ id: workId, title: '요약 작품', episodeCount: 1 }]
            : path.endsWith('/episodes') ? [{ id: episodeJobId, episodeNo: 3, title: '세 번째', status: 'ANALYZED', analysisStatus: 'IN_PROGRESS' }]
              : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
  });
  return calls;
}

async function seedAppliedCaches(page: Page) {
  await page.evaluate(async workId => {
    const { queryClient } = await import('/src/app/lib/query-client.ts');
    const { getCharactersQueryKey, getSettingBooksQueryKey, getAnalysisBatchesQueryKey } = await import('/src/app/api/generated/@tanstack/react-query.gen.ts');
    queryClient.setQueryData(getCharactersQueryKey({ path: { workId } }), { success: true, data: { characters: [] } });
    queryClient.setQueryData(getSettingBooksQueryKey({ path: { workId } }), { success: true, data: [] });
    queryClient.setQueryData(getAnalysisBatchesQueryKey({ path: { workId }, query: { page: 1, size: 10 } }),
      { success: true, data: { content: [], page: 1, size: 10, totalPages: 2, totalElements: 11 } });
  }, workId);
}

async function appliedCacheInvalidations(page: Page) {
  return page.evaluate(async workId => {
    const { queryClient } = await import('/src/app/lib/query-client.ts');
    const { getCharactersQueryKey, getSettingBooksQueryKey, getAnalysisBatchesQueryKey } = await import('/src/app/api/generated/@tanstack/react-query.gen.ts');
    return {
      characters: queryClient.getQueryState(getCharactersQueryKey({ path: { workId } }))?.isInvalidated,
      books: queryClient.getQueryState(getSettingBooksQueryKey({ path: { workId } }))?.isInvalidated,
      otherPage: queryClient.getQueryState(getAnalysisBatchesQueryKey({ path: { workId }, query: { page: 1, size: 10 } }))?.isInvalidated,
      currentPage: queryClient.getQueryState(getAnalysisBatchesQueryKey({ path: { workId }, query: { page: 0, size: 10 } }))?.isInvalidated,
    };
  }, workId);
}

const forbidden = (calls: string[]) => calls.filter(path => /\/(episodes|setting-books|setting-candidates|world-setting-candidates)(\/|$)/.test(path)
  || /\/analysis-jobs(?:$|\/(?!batches$))/.test(path));

for (const width of [320, 1280]) {
  test(`mixed 요약만으로 출처별 카드와 10초 polling을 표시한다 (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    const calls = await setup(page);
    await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
    const episode = page.getByRole('article').filter({ hasText: /^3화/ });
    const card = page.getByTestId('book-analysis-card');
    await expect(episode.getByRole('button', { name: '진행 보기', exact: true })).toBeEnabled();
    await expect(card).toContainText('북부 인물 설정.txt');
    await expect(card).toContainText('분석 완료 · 3개 확인 가능');
    await expect(card).toContainText('분석 후 원문이나 기준 시점이 변경되었습니다');
    await expect(card.getByRole('button', { name: '확인이 필요한 3개 검토', exact: true })).toBeEnabled();
    expect(forbidden(calls)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.clock.runFor(600);
    await page.screenshot({ path: testInfo.outputPath(`analysis-summary-${width}.png`), fullPage: true, animations: 'disabled' });
    if (width === 320) {
      await card.getByRole('button', { name: '확인이 필요한 3개 검토', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('analysis-summary-320-actions.png'), animations: 'disabled' });
    }
    await expect.poll(() => calls.filter(path => path.endsWith('/batches')).length).toBe(1);
    const before = calls.filter(path => path.endsWith('/batches')).length;
    await page.clock.fastForward(10_050);
    await expect.poll(() => calls.filter(path => path.endsWith('/batches')).length).toBe(before + 1);
    expect(forbidden(calls)).toEqual([]);
    await episode.getByRole('button', { name: '진행 보기', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`currentAnalysisJobIds=${episodeJobId}`));
    expect(new URL(page.url()).searchParams.get('analysisJobIds')).toBe(episodeJobId);
  });
}

test('설정집 최신 origin의 실제 batch와 세계관 검토를 열고 목록 URL로 복귀한다', async ({ page }) => {
  await setup(page, () => [mixed], 2);
  await page.goto(`/dashboard?workId=${workId}&nav=analyses&analysisPage=2`);
  await page.getByTestId('book-analysis-card').getByRole('button', { name: '확인이 필요한 3개 검토', exact: true }).click();
  await expect(page).toHaveURL(/\/setting-review\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get('batchId')).toBe(originBatchId);
  expect(url.searchParams.get('sourceAnalysisJobId')).toBe(originId);
  expect(url.searchParams.get('candidateType')).toBe('world');
  expect(url.searchParams.get('settingBookId')).toBe(bookId);
  expect(await page.evaluate(() => window.history.state?.usr?.returnToAnalysisList)).toBe(`/dashboard?workId=${workId}&nav=analyses&analysisPage=2`);
});

test('설정집 원문과 이력은 요약의 frozen revision과 origin을 사용한다', async ({ page }) => {
  await setup(page);
  const list = `/dashboard?workId=${workId}&nav=analyses`;
  await page.goto(list);
  await page.getByTestId('book-analysis-card').getByRole('button', { name: '분석 당시 원문', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`settingBookId=${bookId}&revisionId=${revisionId}`));
  await page.goto(list);
  await page.getByTestId('book-analysis-card').getByRole('button', { name: '반영·제외 이력', exact: true }).click();
  const url = new URL(page.url());
  expect(url.searchParams.get('batchId')).toBe(originBatchId);
  expect(url.searchParams.get('sourceAnalysisJobId')).toBe(originId);
  for (const name of ['reviewStatus', 'characterReviewStatus', 'worldReviewStatus']) expect(url.searchParams.get(name)).toBe('ALL');
});

test('원고에서 분석 목록으로 옮기면 회차 polling을 멈추고 원고로 돌아오면 재개한다', async ({ page }) => {
  await page.clock.install();
  const calls = await setup(page);
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);
  await expect.poll(() => calls.filter(path => path.endsWith('/episodes')).length).toBeGreaterThan(0);
  await page.getByRole('button', { name: '분석 목록으로', exact: true }).click();
  await expect(page.getByTestId('book-analysis-card')).toBeVisible();
  const episodeReads = calls.filter(path => path.endsWith('/episodes')).length;
  await page.clock.fastForward(10_050);
  await expect.poll(() => calls.filter(path => path.endsWith('/batches')).length).toBeGreaterThan(1);
  expect(calls.filter(path => path.endsWith('/episodes')).length).toBe(episodeReads);
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);
  await expect.poll(() => calls.filter(path => path.endsWith('/episodes')).length).toBeGreaterThan(episodeReads);
});

test('처음 만난 완료 설정집은 다른 캐시를 무효화하고 현재 목록은 한 번만 조회한다', async ({ page }) => {
  await page.clock.install();
  const calls = await setup(page, () => [{ ...mixed, status: 'COMPLETED', episodeStatus: 'COMPLETED',
    episodeJobGroups: [{ ...group, status: 'COMPLETED', runningJobCount: 0, succeededJobCount: 1 }] }]);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/analysis-jobs/batches?**', async route => { await gate; return route.fallback(); });
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  await seedAppliedCaches(page);
  release();
  await expect(page.getByTestId('book-analysis-card')).toContainText('분석 완료');
  await expect.poll(() => appliedCacheInvalidations(page)).toEqual({ characters: true, books: true, otherPage: true, currentPage: false });
  await page.clock.fastForward(30_050);
  expect(calls.filter(path => path.endsWith('/batches')).length).toBe(1);
  expect(forbidden(calls)).toEqual([]);
  await page.getByRole('button', { name: '작품 설정', exact: true }).click();
  await expect.poll(() => calls.filter(path => path.endsWith('/characters')).length).toBeGreaterThan(0);
});

test('설정집 진행 완료는 다른 페이지와 설정 캐시를 갱신하고 현재 polling 응답은 재조회하지 않는다', async ({ page }) => {
  await page.clock.install();
  let complete = false;
  const calls = await setup(page, () => [{ ...mixed, status: complete ? 'COMPLETED' : 'IN_PROGRESS', episodeStatus: null,
    episodeJobGroups: [], settingBooks: [{ ...book, status: complete ? 'COMPLETED' : 'IN_PROGRESS' }] }]);
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  await expect(page.getByTestId('book-analysis-card').getByRole('button', { name: '진행 보기', exact: true })).toBeEnabled();
  await seedAppliedCaches(page);
  complete = true;
  await page.clock.fastForward(10_050);
  await expect(page.getByTestId('book-analysis-card')).toContainText('분석 완료');
  await expect.poll(() => appliedCacheInvalidations(page)).toEqual({ characters: true, books: true, otherPage: true, currentPage: false });
  await page.clock.fastForward(30_050);
  expect(calls.filter(path => path.endsWith('/batches')).length).toBe(2);
  expect(forbidden(calls)).toEqual([]);
});

for (const scenario of [
  { status: 'PENDING', label: '분석 대기', action: '진행 보기', active: true },
  { status: 'IN_PROGRESS', label: '분석 중', action: '진행 보기', active: true },
  { status: 'INTERRUPTED', label: '분석 중단', action: '사유 확인' },
  { status: 'FAILED', label: '분석 중단', action: '사유 확인' },
  { status: 'INVALIDATED', label: '원문 변경으로 중단된 분석', action: '사유 확인' },
  { status: 'CANCELED', label: '분석 취소', action: '사유 확인' },
  { status: 'COMPLETED', label: '분석 완료', action: '이전 분석 기록 보기', historical: true },
]) {
  test(`설정집 전용 ${scenario.status} 요약은 회차 카드 없이 기존 상태와 행동을 보존한다`, async ({ page }) => {
    await page.clock.install();
    const calls = await setup(page, () => [{ ...mixed, status: 'COMPLETED', episodeStatus: null, episodeJobGroups: [],
      settingBooks: [{ ...book, status: scenario.status, historical: scenario.historical ?? false }] }]);
    await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
    const card = page.getByTestId('book-analysis-card');
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(card.locator('.analysis-status')).toContainText(scenario.label);
    const action = card.getByRole('button', { name: scenario.action, exact: true });
    await expect(action).toBeEnabled();
    const initialReads = 1;
    await expect.poll(() => calls.filter(path => path.endsWith('/batches')).length).toBe(initialReads);
    await page.clock.fastForward(10_050);
    await expect.poll(() => calls.filter(path => path.endsWith('/batches')).length).toBe(initialReads + (scenario.active ? 1 : 0));
    expect(forbidden(calls)).toEqual([]);
    await action.click();
    await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${originId}`));
    if (scenario.historical) expect(new URL(page.url()).searchParams.get('reviewStatus')).toBe('ALL');
  });
}

test('설정집 요약의 사용량 중단은 설정집 문맥으로 한 번 알린다', async ({ page }) => {
  await setup(page, () => [{ ...mixed, status: 'FAILED', episodeStatus: null, episodeJobGroups: [],
    settingBooks: [{ ...book, status: 'INTERRUPTED', failureCode: 'AI_TOKEN_QUOTA_EXHAUSTED' }] }]);
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  await expect(page.getByRole('dialog')).toContainText('설정집 분석이 중단되었습니다');
  await expect(page.getByRole('dialog')).not.toContainText('회차');
  await page.getByRole('button', { name: '사용량 안내 닫기' }).click();
  await expect(page.getByTestId('book-analysis-card')).toContainText('사용량 부족');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('분석 요약 오류를 재시도하면 출처 추가 조회 없이 행동을 복구한다', async ({ page }) => {
  const calls = await setup(page);
  let fail = true;
  await page.route('**/analysis-jobs/batches?**', async route => {
    if (fail) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'UNEXPECTED_ERROR' } }) });
    return route.fallback();
  });
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  await expect(page.getByText('분석 목록을 불러오지 못했습니다.')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(page.getByTestId('book-analysis-card').getByRole('button', { name: '확인이 필요한 3개 검토', exact: true })).toBeEnabled();
  expect(forbidden(calls)).toEqual([]);
});
