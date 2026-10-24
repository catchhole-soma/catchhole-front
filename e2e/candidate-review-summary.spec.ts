import { expect, test, type Page } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const nextWorkId = '11111111-1111-4111-8111-111111111112';
const batchId = '22222222-2222-4222-8222-222222222222';
const sourceA = '33333333-3333-4333-8333-333333333333';
const sourceB = '44444444-4444-4444-8444-444444444444';
const candidateId = '55555555-5555-4555-8555-555555555555';
const pageOf = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0, hasNext: false });
const counts = (total = 2, processing = 0, dismissed = 0, confirmed = 0) => ({ batchId, episodeStartNo: 5, episodeEndNo: 5, episodeCount: 1,
  totalCandidateCount: total, reviewedCandidateCount: dismissed + confirmed, pendingCandidateCount: total - dismissed - confirmed,
  pendingComparisonCount: 0, processingComparisonCount: 0, activeComparisonJobCount: 0,
  failedComparisonCount: 0, tokenInterruptedComparisonCount: 0, canResumeTokenInterruptedComparisons: false,
  recomparisonRequiredCount: 0, conflictCandidateCount: 0, confirmedCandidateCount: confirmed,
  dismissedCandidateCount: dismissed, directReviewCandidateCount: total - dismissed - confirmed - processing, processingCandidateCount: processing });
const reviewUrl = (source?: string, work = workId) => `/setting-review?workId=${work}&batchId=${batchId}${source ? `&sourceAnalysisJobId=${source}` : ''}`;
const summary = (page: Page) => page.getByRole('region', { name: '설정 후보 검토 요약' });

async function fixture(page: Page, delaySummary = false) {
  let releaseSummary!: () => void;
  const summaryGate = new Promise<void>(resolve => { releaseSummary = resolve; });
  if (!delaySummary) releaseSummary();
  const requests: Array<{ path: string; query: Record<string, string> }> = [];
  const state = { processing: 0, dismissed: false, confirmed: false, fallback: false, summaryFailure: false };
  await page.addInitScript(() => localStorage.setItem('accessToken', 'isolated-candidate-summary-fixture'));
  await page.route('**/api/v1/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    requests.push({ path, query: Object.fromEntries(url.searchParams) });
    let data: unknown = {};
    if (path.endsWith('/auth/me')) data = { id: 1, email: 'summary@example.test', displayName: '요약 검증', role: 'AUTHOR', status: 'ACTIVE' };
    else if (path.includes('/analysis-jobs/')) data = { id: path.split('/').at(-1), workId: path.split('/')[4], batchId,
      jobType: 'SETTING_EXTRACTION', status: 'SUCCEEDED', reviewMode: 'MANUAL', source: { sourceKind: 'EPISODE', episodeNo: 5 } };
    else if (path.endsWith('/setting-candidates')) data = { ...counts(0), groups: pageOf([]) };
    else if (path.endsWith('/world-setting-candidates/summary')) {
      await summaryGate;
      if (state.summaryFailure) return route.fulfill({ status: 404, contentType: 'application/json',
        body: JSON.stringify({ success: false, message: '요약을 불러오지 못했습니다.', error: { status: 404, code: 'CANDIDATE_NOT_FOUND' } }) });
      const total = url.searchParams.get('sourceAnalysisJobId') === sourceB ? 4 : path.includes(nextWorkId) ? 6 : 2;
      data = { ...counts(total, state.processing, state.dismissed ? 1 : 0, state.confirmed ? 1 : 0),
        ...(state.fallback ? { processingCandidateCount: undefined, pendingComparisonCount: state.processing } : {}) };
    } else if (path.endsWith('/world-setting-candidates')) {
      const item = { id: candidateId, workId, category: 'LOCATION', subjectName: '북부', settingName: '기후',
        extractedValue: '춥다', proposedValue: '춥다', proposedSettingName: '기후', suggestedOperation: 'ADD',
        comparisonStatus: 'COMPLETED', consolidationStatus: 'SINGLE', reviewStatus: 'PENDING_REVIEW',
        userModified: false, extractionConfidence: 0.9, evidenceSpans: [], source: { sourceKind: 'EPISODE', episodeNo: 5 } };
      data = { ...counts(2, 0, state.dismissed ? 1 : 0, state.confirmed ? 1 : 0), groups: pageOf(state.dismissed || state.confirmed ? [] : [{
        groupKey: 'LOCATION|북부', category: 'LOCATION', subjectName: '북부', changeCount: 1, addCount: 1,
        status: 'READY', candidates: [item], evidenceEpisodeNos: [5],
      }]) };
    } else if (path.endsWith('/world-setting-candidates/group-dismiss')) {
      state.dismissed = true; data = { candidates: [] };
    } else if (path.endsWith('/world-setting-candidates/group-confirm')) {
      state.confirmed = true; data = { candidates: [] };
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
  });
  return { requests, state, releaseSummary };
}

// Replacing the summary with the old size=1 list, or dropping its source, must fail this boundary contract.
for (const source of [undefined, sourceA]) {
  test(`캐릭터 탭은 세계관 상세 목록 없이 출처 범위 요약을 조회한다 (${source ? '출처 지정' : '회차 전체'})`, async ({ page }) => {
    const { requests } = await fixture(page);
    await page.goto(reviewUrl(source));
    await expect(summary(page)).toContainText('전체 2개 설정');
    expect(requests.filter(request => request.path.endsWith('/world-setting-candidates'))).toEqual([]);
    expect(requests.filter(request => request.path.endsWith('/world-setting-candidates/summary'))).toEqual([{
      path: `/api/v1/works/${workId}/world-setting-candidates/summary`,
      query: { batchId, ...(source ? { sourceAnalysisJobId: source } : {}) },
    }]);
    expect(requests.find(request => request.path.endsWith('/setting-candidates'))?.query).toEqual({
      batchId, ...(source ? { sourceAnalysisJobId: source } : {}), reviewStatus: 'PENDING_REVIEW', page: '0', size: '20', includeLegacyCandidates: 'false',
    });
  });
}

for (const fallback of [false, true]) {
  test(`현재 그룹 밖의 세계관 처리 수가 있으면 기존 주기로 갱신하고 완료 후 멈춘다 (${fallback ? '구응답 비교 수' : '처리 수'})`, async ({ page }) => {
    await page.clock.install();
    const { requests, state } = await fixture(page);
    state.processing = 2; state.fallback = fallback;
    const reads = () => requests.filter(request => request.path.endsWith('/world-setting-candidates/summary')).length;
    await page.goto(reviewUrl());
    await expect.poll(reads).toBe(1);
    await page.clock.runFor(3_100);
    await expect.poll(reads).toBe(2);
    state.processing = 0;
    await page.clock.runFor(3_100);
    await expect.poll(reads).toBe(3);
    await page.clock.runFor(9_100);
    expect(reads()).toBe(3);
    expect(requests.filter(request => request.path.endsWith('/world-setting-candidates'))).toEqual([]);
  });
}

for (const action of ['dismiss', 'confirm']) {
test(`세계관 ${action} 뒤 캐릭터 탭의 아직 신선한 요약 캐시도 갱신한다`, async ({ page }) => {
  const { requests } = await fixture(page);
  await page.goto('/demo');
  await page.evaluate(async next => {
    const { queryClient } = await import('/src/app/lib/query-client.ts');
    queryClient.setQueryDefaults([{ _id: 'getWorldSettingCandidateSummary' }], { staleTime: Infinity });
    window.history.pushState({}, '', next); window.dispatchEvent(new PopStateEvent('popstate'));
  }, reviewUrl());
  await expect(summary(page).locator('.is-direct strong')).toHaveText('2개');
  await page.getByRole('button', { name: /세계관 후보/ }).click();
  await page.getByRole('button', { name: action === 'dismiss' ? '기후 제외' : '모두 확정' }).click();
  await expect(summary(page).locator(action === 'dismiss' ? '.is-dismissed strong' : '.is-confirmed strong')).toHaveText('1개');
  await page.getByRole('button', { name: /캐릭터 후보/ }).click();
  await expect(summary(page).locator('.is-direct strong')).toHaveText('1개');
  await expect(summary(page).locator(action === 'dismiss' ? '.is-dismissed strong' : '.is-confirmed strong')).toHaveText('1개');
  await expect.poll(() => requests.filter(request => request.path.endsWith('/world-setting-candidates/summary')).length).toBe(2);
});
}

test('출처와 작품 이동은 이전 요약 수를 재사용하지 않는다', async ({ page }) => {
  const { requests } = await fixture(page);
  await page.goto(reviewUrl(sourceA));
  await expect(summary(page)).toContainText('전체 2개 설정');
  for (const [url, total] of [[reviewUrl(sourceB), 4], [reviewUrl(undefined, nextWorkId), 6]] as const) {
    await page.evaluate(next => { window.history.pushState({}, '', next); window.dispatchEvent(new PopStateEvent('popstate')); }, url);
    await expect(summary(page)).toContainText(`전체 ${total}개 설정`);
  }
  expect(requests.filter(request => request.path.endsWith('/world-setting-candidates/summary')).map(request => [request.path, request.query])).toEqual([
    [`/api/v1/works/${workId}/world-setting-candidates/summary`, { batchId, sourceAnalysisJobId: sourceA }],
    [`/api/v1/works/${workId}/world-setting-candidates/summary`, { batchId, sourceAnalysisJobId: sourceB }],
    [`/api/v1/works/${nextWorkId}/world-setting-candidates/summary`, { batchId }],
  ]);
});

test('자동 반영 무효화는 같은 작품의 요약만 갱신하고 제외한 현재 조회를 유지한다', async ({ page }) => {
  await page.goto('/demo');
  const invalidated = await page.evaluate(async ({ workId, nextWorkId, batchId, sourceA, sourceB }) => {
    const { queryClient } = await import('/src/app/lib/query-client.ts');
    const { invalidateAppliedSettings } = await import('/src/app/lib/analysis-source.ts');
    const keys = [
      [{ _id: 'getWorldSettingCandidateSummary', path: { workId }, query: { batchId, sourceAnalysisJobId: sourceA } }],
      [{ _id: 'getWorldSettingCandidateSummary', path: { workId }, query: { batchId, sourceAnalysisJobId: sourceB } }],
      [{ _id: 'getWorldSettingCandidateSummary', path: { workId: nextWorkId }, query: { batchId } }],
    ];
    for (const key of keys) queryClient.setQueryData(key, { data: { totalCandidateCount: 2 } });
    await invalidateAppliedSettings(queryClient, workId, { excludeQueryKey: keys[0] });
    return keys.map(key => queryClient.getQueryState(key)?.isInvalidated);
  }, { workId, nextWorkId, batchId, sourceA, sourceB });
  expect(invalidated).toEqual([false, true, false]);
});


test('세계관 요약 대기와 실패는 0건 완료나 상세 목록 fallback으로 바뀌지 않는다', async ({ page }) => {
  const { requests, state, releaseSummary } = await fixture(page, true);
  await page.goto(reviewUrl());
  await expect(summary(page)).toContainText('설정 개수 확인 중');
  await expect(summary(page)).not.toContainText('전체 0개');
  await expect(page.getByRole('button', { name: '남은 설정을 확인해 주세요', exact: true })).toBeDisabled();
  state.summaryFailure = true; releaseSummary();
  await expect(summary(page)).toContainText('설정 개수 확인 불가');
  await expect(page.getByRole('button', { name: '남은 설정을 확인해 주세요', exact: true })).toBeDisabled();
  expect(requests.filter(request => request.path.endsWith('/world-setting-candidates'))).toEqual([]);
});
