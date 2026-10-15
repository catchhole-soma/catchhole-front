import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const bookId = '33333333-3333-4333-8333-333333333333';
const revisionId = '44444444-4444-4444-8444-444444444444';
const jobId = '55555555-5555-4555-8555-555555555555';
const nextJobId = '66666666-6666-4666-8666-666666666666';
const characterId = '77777777-7777-4777-8777-777777777777';
const candidateId = '88888888-8888-4888-8888-888888888888';
const worldId = '99999999-9999-4999-8999-999999999999';
const bookSource = { sourceKind: 'SETTING_BOOK', episodeId: null, episodeNo: null,
  settingBookId: bookId, settingBookName: '북부 인물 설정.txt', revisionId, revisionNo: 1, contentHash: 'a'.repeat(64),
  referenceTimeKind: 'WORK_START', referenceEpisodeNo: null };
const frozenContent = '😀 수아의 눈은 갈색이다.\n북부는 춥다.\n';
const reviewUrl = (type = 'character', origin = jobId) => `/setting-review?workId=${workId}&batchId=${batchId}&sourceAnalysisJobId=${origin}&settingBookId=${bookId}&candidateType=${type}`;
const envelope = (route: Route, data: unknown) => route.fulfill({ status: 200,
  contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
const pageData = (content: unknown[]) => ({ content, page: 0, size: 20, totalPages: content.length ? 1 : 0, totalElements: content.length, hasNext: false });

async function setup(page: Page, { historical = false, archived = false, legacyEpisode = false, mixed = false, mixedActive = false, missingBookId = false, missingRevisionId = false } = {}) {
  const calls: Array<{ path: string; method: string; scope: string | null }> = [];
  let dismissedCharacter = false;
  let dismissedWorld = false;
  let latestJobId = historical ? nextJobId : jobId;
  let latestRevisionId = historical ? nextJobId : revisionId;
  const candidateSource = { ...bookSource, settingBookId: missingBookId ? null : bookId, revisionId: missingRevisionId ? null : revisionId };
  const job = (id = jobId) => ({ id, workId, batchId, episodeId: null, episodes: [], source: bookSource,
    jobType: 'SETTING_EXTRACTION', status: 'SUCCEEDED', reviewMode: 'AUTOMATIC', automaticAppliedAt: '2026-10-06T12:00:00',
    analysisRun: { mode: 'ORDERED_PROVISIONAL', runId: id, generation: 1, sequence: 0, journalStatus: 'SEALED' } });
  const jobs = () => mixed ? [job(), { ...job(nextJobId), status: mixedActive ? 'RUNNING' : 'SUCCEEDED',
    source: { sourceKind: 'EPISODE', episodeNo: 3 } }] : [job()];
  const character = (origin: string | null) => ({ id: candidateId, workId, episodeId: null, episodeNo: legacyEpisode ? 3 : null,
    source: legacyEpisode ? undefined : origin ? candidateSource : { sourceKind: 'EPISODE', episodeNo: 3 }, analysisJobId: origin,
    entityType: 'CHARACTER', entityName: origin === nextJobId ? '다른 분석 인물' : origin ? '수아' : '회차 전용 인물',
    rawEntityMention: '수아', matchedCharacterId: characterId, matchStatus: 'MATCHED', candidateKind: 'SETTING',
    attributeName: 'profile.eye_color', attributeValue: '갈색', valueType: 'STRING', attributeNameEditable: false,
    confidence: 0.92, evidenceSpans: [{ quote: '수아의 눈은 갈색이다.', startOffset: 2, endOffset: 14 }],
    analysisMode: 'ORDERED_PROVISIONAL', reviewMode: 'AUTOMATIC', comparisonStatus: 'COMPLETED',
    sourceAnalysisJobStatus: 'SUCCEEDED', sourceAnalysisJournalStatus: 'SEALED',
    suggestedOperation: 'ADD', comparisonRevision: 'synthetic-comparison-1',
    reviewStatus: dismissedCharacter ? 'DISMISSED' : 'PENDING_REVIEW' });
  const world = (origin: string | null) => ({ id: worldId, workId, sourceEpisodeId: null, sourceEpisodeNo: legacyEpisode ? 3 : null,
    source: legacyEpisode ? undefined : origin ? candidateSource : { sourceKind: 'EPISODE', episodeNo: 3 }, analysisJobId: origin,
    category: 'LOCATION', subjectName: origin === nextJobId ? '다른 분석 장소' : origin ? '북부' : '회차 전용 장소',
    settingName: '기후', extractedValue: '춥다', proposedValue: '춥다', proposedSettingName: '기후',
    evidenceSpans: [{ quote: '북부는 춥다.', startOffset: 15, endOffset: 22 }], extractionConfidence: 0.9,
    consolidationStatus: 'SINGLE', suggestedOperation: 'ADD', comparisonStatus: 'COMPLETED',
    analysisMode: 'ORDERED_PROVISIONAL', reviewMode: 'AUTOMATIC',
    sourceAnalysisJobStatus: 'SUCCEEDED', sourceAnalysisJournalStatus: 'SEALED', userModified: false,
    reviewStatus: dismissedWorld ? 'DISMISSED' : 'PENDING_REVIEW' });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'synthetic-book-source-token'));
  await page.route('**/api/v1/**', route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    const origin = url.searchParams.get('sourceAnalysisJobId');
    calls.push({ path, method: request.method(), scope: origin });
    if (path.endsWith('/auth/me')) return envelope(route, { id: 1, email: 'source@example.test', displayName: '출처 검증', role: 'AUTHOR', status: 'ACTIVE' });
    if (path === '/api/v1/works') return envelope(route, [{ id: workId, title: '출처 작품', episodeCount: 0 }]);
    if (path === `/api/v1/works/${workId}`) return envelope(route, { id: workId, title: '출처 작품', lifecycleStatus: 'ACTIVE' });
    if (path.endsWith('/analysis-jobs/batches')) return envelope(route, pageData([{ batchId, uploadType: mixed ? 'SINGLE_EPISODE' : 'SETTING_BOOK', status: mixedActive ? 'IN_PROGRESS' : 'REVIEW_REQUIRED',
      episodeStartNo: mixed ? 3 : null, episodeEndNo: mixed ? 3 : null, episodeCount: mixed ? 1 : 0, pendingCandidateCount: 1,
      jobGroups: [{ jobType: 'SETTING_EXTRACTION', status: mixedActive ? 'IN_PROGRESS' : 'REVIEW_REQUIRED', currentAnalysisJobIds: mixed ? [jobId, nextJobId] : [jobId], totalJobCount: mixed ? 2 : 1, succeededJobCount: mixed ? 2 : 1 }] }]));
    if (path.endsWith('/analysis-jobs')) return envelope(route, jobs());
    if (path.includes('/analysis-jobs/')) return envelope(route, job(path.split('/').at(-1)));
    if (path === `/api/v1/works/${workId}/setting-books/${bookId}/revisions/${revisionId}`) {
      return envelope(route, { settingBookId: bookId, originalFilename: bookSource.settingBookName, revisionId,
        revisionNo: 1, contentHash: bookSource.contentHash, charCount: 20, content: frozenContent, source: bookSource,
        referenceTimeKind: bookSource.referenceTimeKind, referenceEpisodeNo: bookSource.referenceEpisodeNo });
    }
    if (path === `/api/v1/works/${workId}/setting-books/${bookId}`) {
      if (archived) return route.fulfill({ status: 404, contentType: 'application/json',
        body: JSON.stringify({ success: false, data: null, error: { code: 'SETTING_BOOK_NOT_FOUND', status: 404 }, message: '보관된 설정집입니다.' }) });
      return envelope(route, { id: bookId, workId, batchId, originalFilename: bookSource.settingBookName,
        revisionId: latestRevisionId, revisionNo: latestRevisionId === revisionId ? 1 : 2, content: '최신 수정 원문',
        latestAnalysisJob: job(latestJobId), contentChangedSinceAnalysis: latestRevisionId !== revisionId,
        referenceTimeKind: historical ? 'EPISODE' : 'WORK_START', referenceEpisodeNo: historical ? 25 : null });
    }
    if (path.endsWith('/setting-candidates') || path.endsWith('/world-setting-candidates')) {
      const isWorld = path.endsWith('/world-setting-candidates');
      const item = isWorld ? world(origin) : character(origin);
      const dismissed = isWorld ? dismissedWorld : dismissedCharacter;
      const group = isWorld ? { groupKey: `LOCATION|${item.subjectName}`, category: 'LOCATION', subjectName: item.subjectName,
        changeCount: 1, addCount: 1, status: 'READY', evidenceEpisodeNos: legacyEpisode ? [3] : [], candidates: [item] }
        : { groupKey: item.entityName, entityName: item.entityName, candidateCount: 1, evidenceEpisodeNos: legacyEpisode ? [3] : [], candidates: [item] };
      return envelope(route, { batchId, source: origin ? bookSource : { sourceKind: 'EPISODE', episodeNo: 3 },
        totalCandidateCount: 1, confirmedCandidateCount: 0, dismissedCandidateCount: dismissed ? 1 : 0,
        pendingCandidateCount: dismissed ? 0 : 1, directReviewCandidateCount: dismissed ? 0 : 1, processingCandidateCount: 0,
        pendingComparisonCount: 0, processingComparisonCount: 0, failedComparisonCount: 0,
        recomparisonRequiredCount: 0, groups: pageData([group]) });
    }
    if (path.includes('/setting-candidates/') && request.method() === 'POST') {
      dismissedCharacter = true; return envelope(route, character(origin));
    }
    if (path.endsWith('/world-setting-candidates/dismiss-group')) {
      dismissedWorld = true; return envelope(route, { candidates: [world(origin)] });
    }
    if (path.endsWith('/episodes')) return envelope(route, []);
    if (path.endsWith('/world-settings')) return envelope(route, { content: [{ id: worldId, category: 'LOCATION', subjectName: '북부',
      propertyCount: 1, version: 1 }], page: 0, size: 12, totalPages: 1, totalElements: 1, categories: [] });
    if (path.endsWith(`/world-settings/${worldId}`)) return envelope(route, { id: worldId, workId, category: 'LOCATION',
      subjectName: '북부', version: 1, properties: [{ settingName: '기후', value: '춥다' }],
      propertyEvidence: [{ settingName: '기후', latestEvidence: { candidateId: worldId, source: bookSource, operation: 'ADD',
        value: '춥다', evidenceSpans: [{ quote: '북부는 춥다.' }] }, history: [] }] });
    if (path.endsWith('/characters')) return envelope(route, pageData([{ id: characterId, name: '수아', currentAge: 24 }]));
    if (path.endsWith('/character-facts/search')) return envelope(route, pageData([{ characterFactId: candidateId, characterId,
      characterName: '수아', factType: 'SKILL', factTypeLabel: '스킬', displayName: '검술', factValue: '숙련',
      sourceEpisodeId: null, sourceEpisodeNo: null, source: bookSource, contributesToCurrentSnapshot: true }]));
    if (path.endsWith(`/character-facts/${candidateId}`)) return envelope(route, { characterFactId: candidateId, characterId,
      characterName: '수아', factType: 'SKILL', factTypeLabel: '스킬', displayName: '검술', factValue: '숙련',
      sourceEpisodeNo: null, source: bookSource, evidenceQuotes: ['수아의 눈은 갈색이다.'] });
    if (path.endsWith('/timeline/summary')) return envelope(route, { characterId, characterName: '수아', totalFactCount: 1,
      filteredFactCount: 1, totalEpisodeCount: 0, manualFactCount: 0, episodes: [], factTypes: [{ factType: 'PROFILE', factCount: 1 }] });
    if (path.endsWith('/timeline')) return envelope(route, { content: [{ characterFactId: candidateId, factType: 'PROFILE',
      displayName: '눈 색', factValue: '갈색', sourceType: 'EPISODE', sourceEpisodeNo: null, source: bookSource, hasEvidence: true }], hasNext: false });
    if (path.endsWith('/evidence')) return envelope(route, { characterFactId: candidateId, source: bookSource,
      episode: null, content: frozenContent, evidenceSpans: [{ quote: '수아의 눈은 갈색이다.', startOffset: 2, endOffset: 14 }] });
    if (path.endsWith(`/characters/${characterId}`)) return envelope(route, { id: characterId, name: '수아', currentAge: 24, currentLevel: null,
      currentAgeSourceFacts: [{ characterFactId: candidateId, source: bookSource, sourceEpisodeNo: null, hasEvidence: true }],
      profile: [], stats: [], skills: [], items: [], statuses: [] });
    return envelope(route, []);
  });
  return { calls, jobs, supersede: (sameRevision = false) => { latestJobId = nextJobId; if (!sameRevision) latestRevisionId = nextJobId; } };
}

test('설정집 인물·세계관 조회와 제외는 같은 배치의 회차·다른 분석을 포함하지 않는다', async ({ page }) => {
  const fixture = await setup(page);
  await page.goto(reviewUrl());
  await expect(page.getByRole('region', { name: '설정 후보 검토 요약' })).toContainText('북부 인물 설정.txt');
  await expect(page.getByText('회차 전용 인물')).toHaveCount(0);
  await page.getByRole('button', { name: '제외', exact: true }).click();
  await expect.poll(() => fixture.calls.filter(call => call.method === 'POST').length).toBe(1);
  await page.getByRole('button', { name: /세계관 후보/ }).click();
  await expect(page.getByText('회차 전용 장소')).toHaveCount(0);
  await page.getByRole('button', { name: '기후 제외' }).click();
  await expect.poll(() => fixture.calls.filter(call => call.method === 'POST').length).toBe(2);
  const candidateCalls = fixture.calls.filter(call => call.path.includes('setting-candidates'));
  expect(candidateCalls.length).toBeGreaterThanOrEqual(5);
  expect(candidateCalls.every(call => call.scope === jobId)).toBe(true);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${jobId}`));
});

for (const type of ['character', 'world']) test(`이전 설정집 원문 ${type} 검토는 읽기 전용으로 조회한다`, async ({ page }) => {
  await setup(page, { historical: true });
  await page.goto(reviewUrl(type));
  await expect(page.getByTestId('book-review-source-state')).toContainText('이전 분석 기록');
  const exclude = type === 'character' ? page.getByRole('button', { name: '제외', exact: true }) : page.getByRole('button', { name: '기후 제외' });
  await expect(exclude).toBeDisabled();
  await expect(page.getByRole('region', { name: '설정 후보 검토 요약' })).toContainText('1차 원문');
  await expect(page.getByRole('region', { name: '설정 후보 검토 요약' })).toContainText('작품 시작 시점 기준');
});

for (const source of [undefined, { sourceKind: 'UNSUPPORTED' }]) for (const type of ['character', 'world']) test(`출처가 ${source ? '유효하지 않은' : '없는'} origin ${type} 검토는 변경을 막는다`, async ({ page }) => {
  const fixture = await setup(page);
  await page.route(`**/api/v1/works/${workId}/analysis-jobs/${jobId}`, route => envelope(route, {
    id: jobId, workId, batchId, jobType: 'SETTING_EXTRACTION', status: 'SUCCEEDED', source,
  }));
  await page.goto(reviewUrl(type));
  await expect(page.getByTestId('book-review-source-state')).toContainText('읽기 전용');
  const exclude = type === 'character' ? page.getByRole('button', { name: '제외', exact: true }) : page.getByRole('button', { name: '기후 제외' });
  await expect(exclude).toBeDisabled();
  expect(fixture.calls.filter(call => call.method !== 'GET')).toHaveLength(0);
});

test('변경·보관된 설정집의 원문 링크도 분석 당시 버전만 읽는다', async ({ page }) => {
  const fixture = await setup(page, { historical: true, archived: true });
  await page.goto(`/editor?workId=${workId}&settingBookId=${bookId}&revisionId=${revisionId}`);
  await expect(page.getByText('분석 당시 설정집 원문 · 읽기 전용')).toBeVisible();
  await expect(page.locator('.original-lines')).toContainText('수아의 눈은 갈색이다.');
  await expect(page.locator('.original-lines')).not.toContainText('최신 수정 원문');
  await expect(page.locator('.original-reader-article__meta')).toContainText('작품 시작 시점 기준');
  await expect(page.locator('.original-reader-article__meta')).not.toContainText('25화');
  expect(fixture.calls.some(call => call.path === `/api/v1/works/${workId}/setting-books/${bookId}`)).toBe(false);
  await page.reload();
  await expect(page.locator('.original-lines')).toContainText('수아의 눈은 갈색이다.');
  await page.getByRole('button', { name: '설정집으로', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`tab=worldrules.*settingBookFileId=${bookId}`));
});

for (const type of ['character', 'world']) test(`이전 ${type} 검토 행의 근거 링크는 분석 당시 설정집 원문으로 연결한다`, async ({ page }) => {
  const fixture = await setup(page, { historical: true });
  await page.goto(reviewUrl(type));
  const evidence = page.locator('.review-cb-evidence');
  await evidence.locator('summary').click();
  const link = evidence.getByRole('link', { name: '분석 당시 원문 보기', exact: true });
  await expect(link).toHaveAttribute('href', `/editor?workId=${workId}&settingBookId=${bookId}&revisionId=${revisionId}`);
  await link.click();
  await expect(page.getByText('분석 당시 설정집 원문 · 읽기 전용')).toBeVisible();
  await expect(page.locator('.original-lines')).toContainText('수아의 눈은 갈색이다.');
  await expect(page.locator('.original-lines')).toContainText('북부는 춥다.');
  await expect(page.locator('.original-lines')).not.toContainText('최신 수정 원문');
  expect(fixture.calls.some(call => call.path.endsWith(`/revisions/${revisionId}`))).toBe(true);
});

for (const type of ['character', 'world']) for (const missing of ['book', 'revision']) test(`${type} 근거의 ${missing} ID가 없으면 원문 링크를 추측하지 않는다`, async ({ page }) => {
  await setup(page, { missingBookId: missing === 'book', missingRevisionId: missing === 'revision' });
  await page.goto(reviewUrl(type));
  const evidence = page.locator('.review-cb-evidence');
  await evidence.locator('summary').click();
  await expect(evidence.getByRole('link', { name: '분석 당시 원문 보기', exact: true })).toHaveCount(0);
  await expect(evidence.locator('blockquote')).toBeVisible();
});

test('검색과 설정 이력의 책 근거는 수동 입력·없는 회차로 표시하지 않는다', async ({ page }) => {
  await setup(page);
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=search&q=검술`);
  await expect(page.getByText(/수아 · 설정집 · 북부 인물 설정.txt/)).toBeVisible();
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=characters&modal=character-timeline&charId=${characterId}&timelineView=all`);
  await expect(page.locator('.character-timeline-group header')).toContainText('설정집 · 북부 인물 설정.txt');
  await page.getByRole('button', { name: /설정집 · 북부 인물 설정.txt.*원문 근거 보기/ }).click();
  await expect(page.locator('.character-evidence-panel')).toContainText('설정집 · 북부 인물 설정.txt');
  await expect(page.getByTestId('character-evidence-highlight')).toContainText('수아의 눈은 갈색이다.');
  await expect(page.locator('.character-evidence-panel')).not.toContainText('출처 회차 없음');
});

test('분석 목록의 설정집은 회차 수 없이 해당 원문 검토로 연결한다', async ({ page }) => {
  await setup(page);
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  await expect(page.locator('.analysis-batch-card')).toContainText('북부 인물 설정.txt');
  await expect(page.locator('.analysis-batch-card')).not.toContainText('0개 회차');
  await page.getByTestId('setting-book-review').click();
  await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${jobId}`));
});

test('세계관 현재값과 이력의 책 근거는 불변 원문 버전으로 이동한다', async ({ page }) => {
  await setup(page);
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=worldsettings&category=LOCATION&settingId=${worldId}`);
  await page.getByRole('button', { name: '기후 원문 근거 보기' }).click();
  await expect(page.locator('.world-setting-evidence-row')).toContainText('북부 인물 설정.txt');
  await page.getByRole('link', { name: '분석 당시 원문 보기' }).click();
  await expect(page).toHaveURL(new RegExp(`settingBookId=${bookId}&revisionId=${revisionId}`));
  await expect(page.locator('.original-lines')).toContainText('북부는 춥다.');
});

test('교체된 회차의 세계관 근거는 저장된 인용과 현재 원문 링크를 구분한다', async ({ page }) => {
  await setup(page);
  const episodeId = nextJobId;
  await page.route(`**/api/v1/works/${workId}/world-settings/${worldId}`, route => envelope(route, {
    id: worldId, workId, category: 'LOCATION', subjectName: '북부', version: 1,
    properties: [{ settingName: '기후', value: '춥다' }],
    propertyEvidence: [{ settingName: '기후', latestEvidence: { candidateId: worldId,
      sourceEpisodeId: episodeId, sourceEpisodeNo: 3,
      source: { sourceKind: 'EPISODE', episodeId, episodeNo: 3 }, operation: 'ADD',
      value: '춥다', evidenceSpans: [{ quote: '교체 전 북부는 춥다.' }] }, history: [] }],
  }));
  await page.route(`**/api/v1/works/${workId}/episodes/${episodeId}`, route => envelope(route, {
    id: episodeId, workId, episodeNo: 3, title: '교체된 회차', content: '현재 원문에서는 북부가 따뜻하다.',
  }));
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=worldsettings&category=LOCATION&settingId=${worldId}`);
  await page.getByRole('button', { name: '기후 원문 근거 보기' }).click();
  await expect(page.locator('.world-setting-evidence-row')).toContainText('교체 전 북부는 춥다.');
  await expect(page.getByRole('link', { name: '분석 당시 원문 보기' })).toHaveCount(0);
  await page.getByRole('link', { name: '현재 회차 원문 보기' }).click();
  await expect(page).toHaveURL(new RegExp(`episodeId=${episodeId}`));
  await expect(page.locator('.original-lines')).toContainText('현재 원문에서는 북부가 따뜻하다.');
});

for (const type of ['character', 'world']) test(`출처 객체가 없는 기존 ${type} 응답도 실제 회차 근거를 표시한다`, async ({ page }) => {
  await setup(page, { legacyEpisode: true });
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=${type}`);
  const card = page.locator(type === 'character' ? '.candidate-group-card' : '.world-candidate-group-card');
  await expect(card).toContainText('3화');
  await expect(card).not.toContainText('출처 정보 없음');
});

test('혼합 배치의 분석 목록은 책과 회차의 진행·검토 링크를 구분한다', async ({ page }) => {
  await setup(page, { mixed: true });
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  await expect(page.getByTestId('book-analysis-card')).toContainText('북부 인물 설정.txt');
  await expect(page.locator('.analysis-batch-card:not([data-testid="book-analysis-card"])')).toContainText('1개 회차');
  await page.getByTestId('setting-book-review').click();
  await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${jobId}`));
});

test('같은 원문의 새 분석은 기존 기록을 잠그고 열린 수정 초안을 유지한다', async ({ page }) => {
  const fixture = await setup(page);
  await page.goto(reviewUrl());
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByLabel('설정값', { exact: true }).fill('초안의 눈 색');
  fixture.supersede(true);
  await expect(page.getByTestId('book-review-source-state')).toContainText('이전 분석 기록', { timeout: 7000 });
  await expect(page.getByLabel('설정값', { exact: true })).toHaveValue('초안의 눈 색');
  await expect(page.locator('.review-modal').getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await page.locator('.review-modal form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(fixture.calls.filter(call => call.method !== 'GET')).toHaveLength(0);
  await expect(page.getByLabel('설정값', { exact: true })).toHaveValue('초안의 눈 색');
});

test('느린 이전 분석 응답은 같은 배치의 새 출처 화면을 덮지 않는다', async ({ page }) => {
  const fixture = await setup(page);
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/setting-candidates/*/dismiss?**', async route => {
    await blocked;
    await envelope(route, {}).catch(() => {});
  });
  await page.goto(reviewUrl());
  await page.getByRole('button', { name: '제외', exact: true }).click();
  fixture.supersede(true);
  await page.evaluate(url => {
    window.history.pushState(window.history.state, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, reviewUrl('character', nextJobId));
  await expect(page.locator('.candidate-group-card')).toContainText('다른 분석 인물');
  release();
  await expect(page).toHaveURL(new RegExp(`sourceAnalysisJobId=${nextJobId}`));
  await expect(page.locator('.candidate-group-card')).toContainText('다른 분석 인물');
});

for (const failure of [false, true]) test(`혼합 배치의 진행은 출처 조회 ${failure ? '실패 복구' : '완료'} 뒤 명시적 회차 작업만 연다`, async ({ page }) => {
  const fixture = await setup(page, { mixed: true, mixedActive: true });
  let release!: () => void;
  let fail = failure;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/v1/works/${workId}/analysis-jobs`, async route => {
    if (!failure) await waiting;
    if (fail) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false,
      data: null, message: '출처 조회 실패', error: { code: 'COMMON_INTERNAL_SERVER_ERROR', status: 500 } }) });
    return envelope(route, fixture.jobs());
  });
  await page.goto(`/dashboard?workId=${workId}&nav=analyses`);
  const episodeCard = page.locator('.analysis-batch-card:not([data-testid="book-analysis-card"])');
  await expect(episodeCard.locator('.analysis-card-footer button')).toBeDisabled();
  if (failure) {
    await expect(episodeCard.getByRole('alert')).toContainText('출처를 확인하지 못해');
    fail = false;
    await episodeCard.getByRole('button', { name: '출처 다시 확인' }).click();
  } else release();
  await expect(episodeCard.locator('.analysis-card-footer button')).toBeEnabled();
  await episodeCard.locator('.analysis-card-footer button').click();
  const url = new URL(page.url());
  expect(url.searchParams.get('analysisJobIds')).toBe(nextJobId);
  expect(url.searchParams.get('currentAnalysisJobIds')).toBe(nextJobId);
  expect(url.searchParams.get('analysisJobIds')).not.toContain(jobId);
});
