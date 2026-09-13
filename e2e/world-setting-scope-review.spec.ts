import { expect, test, type Route } from '@playwright/test';
import { computedContrastRatio } from './contrast';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const candidateId = '33333333-3333-4333-8333-333333333333';
const savedId = '44444444-4444-4444-8444-444444444444';
const failedId = '55555555-5555-4555-8555-555555555555';
const groupKey = 'LOCATION|미궁';

function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data, error: null }) });
}

function pageOf(content: unknown[]) {
  return { content, page: 0, size: 20, totalElements: content.length,
    totalPages: content.length ? 1 : 0, hasNext: false };
}

for (const width of [1280, 320]) {
  test(`다른 범위의 비교 보류와 직접 확인 안내를 밝게 표시하고 저장 전 확정을 막는다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    let candidate: Record<string, unknown> = {
      id: candidateId, workId, sourceEpisodeNo: 10, category: 'LOCATION', subjectName: '미궁',
      targetSubjectName: '미궁', scopeName: '외곽 지역', settingName: '조명 환경',
      extractedValue: '수정들이 적어지며 어둠이 드리운다.',
      matchedScopeName: '1층', matchedPropertyName: '광원', beforeValue: '벽의 수정들이 주변을 밝힌다.',
      // 표시와 편집의 원문 경로는 AI의 제안 경로로 바꾸지 않는다.
      proposedScopeName: '1층', proposedSettingName: '광원', proposedValue: 'AI가 합친 비교값',
      suggestedOperation: 'REVIEW_REQUIRED', comparisonReviewReason: 'SCOPE_MISMATCH',
      comparisonReason: '외곽 지역과 1층이 같은 장소인지 확실하지 않아 적용 범위를 확인해야 합니다.',
      comparisonStatus: 'COMPLETED', reviewStatus: 'PENDING_REVIEW', userModified: false,
      manualReviewAvailable: true, consolidationStatus: 'SINGLE', analysisMode: 'ORDERED_PROVISIONAL',
      evidenceSpans: [{ quote: '외곽으로 나아갈수록 수정이 적어지며 어둠이 드리웠다.' }],
    };
    const savedCandidate = {
      ...candidate, id: savedId, sourceEpisodeNo: 6, settingName: '통행 상태', scopeName: '입구',
      comparisonStatus: 'FAILED', comparisonReviewReason: null, suggestedOperation: null,
      comparisonReason: null, extractedValue: '통로를 지나갈 수 있다.', proposedValue: null,
      userModified: true, finalOperation: 'ADD', finalCategory: 'LOCATION', finalSubjectName: '미궁',
      finalScopeName: '입구', finalSettingName: '통행 상태', finalValue: '통로를 지나갈 수 있다.',
    };
    let failedCandidate: Record<string, unknown> = { ...savedCandidate, id: failedId, scopeName: '북쪽 통로', settingName: '통행 상태',
      userModified: false, finalOperation: null, finalScopeName: null, finalSettingName: null, finalValue: null };
    let savedBody: Record<string, unknown> | undefined;
    let confirmRequests = 0;
    let recompareRequests = 0;
    const path = `/api/v1/works/${workId}/world-setting-candidates`;
    await page.route('**/api/v1/**', route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith('/auth/me')) return success(route, {
        id: 1, email: 'scope-review@example.com', displayName: '검토 테스트', role: 'AUTHOR', status: 'ACTIVE',
      });
      if (pathname.endsWith('/recompare')) recompareRequests += 1;
      if (pathname.endsWith('/group-confirm')) confirmRequests += 1;
      if (pathname === `${path}/decisions` && request.method() === 'PATCH') {
        savedBody = request.postDataJSON();
        const decision = (savedBody!.candidates as Record<string, unknown>[])[0];
        const edited = { userModified: true, finalOperation: decision.operation,
          finalCategory: decision.category, finalSubjectName: decision.subjectName,
          finalScopeName: decision.scopeName, finalSettingName: decision.settingName, finalValue: decision.value };
        if (decision.candidateId === failedId) failedCandidate = { ...failedCandidate, ...edited };
        else candidate = { ...candidate, ...edited };
        return success(route, { groupKey, candidates: [candidate, savedCandidate, failedCandidate] });
      }
      if (pathname === path) return success(route, { batchId, episodeStartNo: 6, episodeEndNo: 10, episodeCount: 5,
        totalCandidateCount: 3, pendingCandidateCount: 3, reviewedCandidateCount: 0,
        failedComparisonCount: 2, pendingComparisonCount: 0, processingComparisonCount: 0,
        recomparisonRequiredCount: 0, activeComparisonJobCount: 0,
        groups: pageOf([{ groupKey, category: 'LOCATION', subjectName: '미궁', changeCount: 3,
          status: 'FAILED', candidates: [candidate, savedCandidate, failedCandidate], evidenceEpisodeNos: [6, 10] }]) });
      if (pathname.endsWith('/setting-candidates')) return success(route, { batchId, totalCandidateCount: 0,
        pendingCandidateCount: 0, reviewedCandidateCount: 0, matchRequiredCandidateCount: 0, groups: pageOf([]) });
      return success(route, []);
    });
    await page.goto('/login');
    await page.evaluate(() => localStorage.setItem('accessToken', 'isolated-scope-review-test'));
    await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world&group=${encodeURIComponent(groupKey)}`);
    const row = page.locator('.world-setting-diff-row').first();
    const scopeNotice = row.locator('.world-setting-scope-review');
    await expect(scopeNotice).toContainText('범위 비교 필요');
    await expect(row.locator('.world-setting-diff-row__header > strong')).toHaveText('외곽 지역 › 조명 환경');
    const compared = row.locator('.world-setting-key-diff-values > div').first();
    const source = row.locator('.world-setting-key-diff-values > div').last();
    await expect(compared).toContainText('비교한 기존 설정');
    await expect(compared).toContainText('1층 › 광원');
    await expect(source).toContainText('원문에서 추출한 설정');
    await expect(source).toContainText('외곽 지역 › 조명 환경');
    await expect(source).toContainText('수정들이 적어지며 어둠이 드리운다.');
    await expect(source).not.toContainText('AI가 합친 비교값');
    await expect(row.locator('.world-setting-comparison-reason')).toContainText('같은 장소인지 확실하지 않아');
    const confirm = page.getByRole('button', { name: '모두 확정', exact: true });
    await expect(confirm).toBeDisabled();
    for (const state of ['is-review', 'is-saved']) {
      const notice = page.locator(`.world-setting-manual-notice.${state}`).first();
      await expect(notice).toBeVisible();
      expect(await computedContrastRatio(notice.locator('strong'), notice)).toBeGreaterThanOrEqual(4.5);
      expect(await computedContrastRatio(notice.locator('p'), notice)).toBeGreaterThanOrEqual(4.5);
      const background = await notice.evaluate(element => getComputedStyle(element).backgroundColor);
      expect(background).not.toBe('rgb(15, 15, 19)');
    }
    expect(await computedContrastRatio(scopeNotice.locator('strong'), scopeNotice)).toBeGreaterThanOrEqual(4.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await row.scrollIntoViewIfNeeded();
    if (process.env.GH180_REVIEW_SCREENSHOTS === '1') {
      await page.screenshot({ path: `docs/screens/gh180-world-scope-review-${width}.png` });
      await page.locator('.world-setting-manual-notice.is-saved').screenshot({
        path: `docs/screens/gh180-world-saved-notice-${width}.png`,
      });
      await page.locator('.world-setting-manual-notice.is-review').screenshot({
        path: `docs/screens/gh180-world-review-notice-${width}.png`,
      });
    }
    await row.getByRole('button', { name: '직접 확인해서 반영' }).click();
    const modal = page.locator('.review-modal');
    await expect(modal).toContainText('외곽 지역 › 조명 환경');
    await expect(modal).toContainText('1층 › 광원');
    await expect(modal.getByLabel('범위 (선택)')).toHaveValue('외곽 지역');
    await expect(modal.getByLabel('설정명', { exact: true })).toHaveValue('조명 환경');
    await modal.getByLabel('반영 방식').selectOption('UPDATE');
    await modal.getByLabel('범위 (선택)').fill('1층');
    await modal.getByLabel('설정명', { exact: true }).fill('광원');
    await modal.getByRole('button', { name: '수정안 적용', exact: true }).click();
    await expect.poll(() => savedBody).toEqual({ batchId, candidates: [{ candidateId, category: 'LOCATION',
      subjectName: '미궁', scopeName: '1층', settingName: '광원', value: '수정들이 적어지며 어둠이 드리운다.', operation: 'UPDATE' }] });
    await expect(scopeNotice).toBeHidden();
    // 다른 실패 후보가 아직 직접 확인되지 않았으므로 그룹 전체는 계속 잠긴다.
    await expect(confirm).toBeDisabled();
    await expect(row.locator('.world-setting-manual-notice.is-saved')).toBeVisible();
    await page.locator('.world-setting-diff-row').last().getByRole('button', { name: '직접 확인해서 반영' }).click();
    await modal.getByLabel('범위 (선택)').fill('북쪽 통로');
    await modal.getByLabel('설정명', { exact: true }).fill('통행 상태');
    await modal.getByRole('button', { name: '수정안 적용', exact: true }).click();
    await expect(confirm).toBeEnabled();
    expect(confirmRequests).toBe(0);
    expect(recompareRequests).toBe(0);
  });
}
