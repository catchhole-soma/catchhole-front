import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const candidateId = '33333333-3333-4333-8333-333333333333';
const endpoint = `/api/v1/works/${workId}/world-setting-candidates`;
const stoppedMessage = '분석 목록에서 중단된 회차의 재개 여부를 확인해 주세요.';

function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data, error: null }) });
}

async function openReview(page: Page, candidateOverrides: Record<string, unknown>,
  listOverrides: Record<string, unknown> = {}) {
  const candidate = { id: candidateId, workId, sourceEpisodeNo: 11, category: 'RACE', subjectName: '설인',
    settingName: '서식지', extractedValue: '북부 설원', evidenceSpans: [], reviewStatus: 'PENDING_REVIEW',
    comparisonStatus: 'PENDING', suggestedOperation: null, analysisMode: 'ORDERED_PROVISIONAL',
    manualReviewAvailable: false, consolidationStatus: 'SINGLE', ...candidateOverrides };
  let retryCalls = 0;
  let resumeCalls = 0;
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, { id: 1, email: 'recovery@example.com',
      displayName: '복구 검증', role: 'AUTHOR', status: 'ACTIVE' });
    if (pathname.endsWith('/ai-token-usages/extension-requests/me/pending')) return success(route, { pending: false, request: null });
    if (pathname.endsWith('/ai-token-usages/me')) return success(route, { exhausted: true, remainingTokens: 0, contactEmail: 'feedback@catchhole.com' });
    if (pathname.endsWith('/recompare')) retryCalls++;
    if (pathname.endsWith('/resume-token-interrupted')) resumeCalls++;
    if (pathname === endpoint) return success(route, { batchId, totalCandidateCount: 1,
      pendingCandidateCount: 1, directReviewCandidateCount: 1, processingCandidateCount: 0,
      failedComparisonCount: candidate.comparisonStatus === 'FAILED' ? 1 : 0,
      pendingComparisonCount: candidate.comparisonStatus === 'PENDING' ? 1 : 0,
      processingComparisonCount: 0, activeComparisonJobCount: 0,
      tokenInterruptedComparisonCount: 0, canResumeTokenInterruptedComparisons: false,
      ...listOverrides, groups: { page: 0, size: 20, totalElements: 1, totalPages: 1, hasNext: false,
        content: [{ groupKey: 'RACE|설인', category: 'RACE', subjectName: '설인', changeCount: 1,
          status: candidate.comparisonStatus, evidenceEpisodeNos: [11], candidates: [candidate] }] } });
    if (pathname.endsWith('/setting-candidates')) return success(route, { batchId,
      totalCandidateCount: 0, pendingCandidateCount: 0, directReviewCandidateCount: 0, processingCandidateCount: 0,
      groups: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false } });
    return success(route, []);
  });
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'isolated-ordered-recovery-test'));
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world&group=RACE%7C%EC%84%A4%EC%9D%B8`);
  await expect(page.locator('.world-setting-diff-row')).toBeVisible();
  return { retryCalls: () => retryCalls, resumeCalls: () => resumeCalls };
}

for (const status of ['PENDING', 'RUNNING']) {
  test(`수동 순차 분석의 후보 비교 대기는 원본 ${status} 작업을 중단으로 안내하지 않는다`, async ({ page }) => {
    const state = await openReview(page, { sourceAnalysisJobStatus: status, sourceAnalysisJournalStatus: 'PENDING' });
    await expect(page.locator('.world-candidate-detail-card')).toContainText('이 회차의 분석을 진행하고 있습니다.');
    await expect(page.locator('.world-candidate-detail-card')).not.toContainText(stoppedMessage);
    await expect(page.getByRole('button', { name: '다시 비교', exact: true })).toHaveCount(0);
    expect(state.retryCalls()).toBe(0);
  });
}

for (const source of [
  { sourceAnalysisJobStatus: 'FAILED', sourceAnalysisJournalStatus: 'PENDING' },
  { sourceAnalysisJobStatus: 'SUCCEEDED', sourceAnalysisJournalStatus: 'INCOMPLETE' },
]) {
  for (const activeComparisonJobCount of [0, 1]) {
    test(`실패·미완료 원본 회차의 재개 안내는 다른 비교 작업보다 우선한다: ${source.sourceAnalysisJobStatus}, 비교 ${activeComparisonJobCount}개`, async ({ page }) => {
      const state = await openReview(page, { ...source, comparisonStatus: 'FAILED' }, { activeComparisonJobCount });
      await expect(page.locator('.world-setting-comparison-reason__text')).toContainText(stoppedMessage);
      await expect(page.locator('.world-candidate-detail-card')).not.toContainText('다시 비교하거나 설정을 수정');
      await expect(page.locator('.world-candidate-detail-card')).not.toContainText('설정 비교가 진행 중입니다.');
      await expect(page.getByRole('button', { name: '다시 비교', exact: true })).toHaveCount(0);
      expect(state.retryCalls()).toBe(0);
    });
  }
}

for (const sourceAnalysisJobStatus of ['FAILED', 'RUNNING']) {
  test(`무효화된 원본 분석은 다른 비교가 진행 중이어도 상태 확인을 안내한다: ${sourceAnalysisJobStatus}`, async ({ page }) => {
    await openReview(page, { comparisonStatus: 'FAILED', sourceAnalysisJobStatus,
      sourceAnalysisJournalStatus: 'INVALIDATED' }, { activeComparisonJobCount: 1 });
    await expect(page.locator('.world-setting-comparison-reason__text')).toContainText('기존 분석을 이어서 처리할 수 없습니다.');
    await expect(page.locator('.world-candidate-detail-card')).not.toContainText(stoppedMessage);
    await expect(page.locator('.world-candidate-detail-card')).not.toContainText('진행 중입니다.');
  });
}

test('원본 상태가 없는 후보에만 별도 비교 작업의 진행 상태를 참고한다', async ({ page }) => {
  await openReview(page, { comparisonStatus: 'FAILED' }, { activeComparisonJobCount: 1 });
  await expect(page.locator('.world-setting-comparison-reason__text')).toHaveText('설정 비교가 진행 중입니다. 완료된 뒤 회차별 상태를 확인해 주세요.');
  await expect(page.locator('.world-candidate-detail-card')).not.toContainText(stoppedMessage);
});

test('종료된 원본 분석이 있으면 다른 비교 작업을 해당 회차의 진행으로 안내하지 않는다', async ({ page }) => {
  await openReview(page, { comparisonStatus: 'FAILED', sourceAnalysisJobStatus: 'CANCELED' }, { activeComparisonJobCount: 1 });
  await expect(page.locator('.world-setting-comparison-reason__text')).toContainText('분석 목록에서 회차별 진행 상태를 확인해 주세요.');
  await expect(page.locator('.world-candidate-detail-card')).not.toContainText('설정 비교가 진행 중입니다.');
});

test('원본 상태가 없는 옛 순차 후보는 진행 상태 확인으로 안내한다', async ({ page }) => {
  await openReview(page, { comparisonStatus: 'FAILED' });
  await expect(page.locator('.world-setting-comparison-reason__text')).toContainText('분석 목록에서 회차별 진행 상태를 확인해 주세요.');
  await expect(page.locator('.world-candidate-detail-card')).not.toContainText(stoppedMessage);
});

test('자동 반영 대기와 직접 검토 허용은 원본 실패 상태보다 우선한다', async ({ page }) => {
  await openReview(page, { comparisonStatus: 'FAILED', sourceAnalysisJobStatus: 'FAILED', automaticApplicationPending: true });
  await expect(page.locator('.world-candidate-detail-card')).not.toContainText(stoppedMessage);
  await expect(page.locator('.world-candidate-detail-card')).toContainText('자동으로 반영하고 있습니다.');
  await openReview(page, { comparisonStatus: 'FAILED', sourceAnalysisJobStatus: 'SUCCEEDED',
    sourceAnalysisJournalStatus: 'SEALED', manualReviewAvailable: true });
  await expect(page.locator('.world-setting-comparison-reason__text')).toHaveText('자동 비교를 마치지 못해 대상과 내용을 확인해 주세요.');
  await expect(page.getByRole('button', { name: '직접 확인해서 반영', exact: true })).toBeEnabled();
});

for (const scenario of [
  { name: '일반 분석', mode: 'CONFIRMED_ONLY', canResume: true },
  { name: '순차 분석', mode: 'ORDERED_PROVISIONAL', canResume: false },
  // 현재 필터에 일반 분석만 보이더라도 다른 페이지의 순차/자동 반영 대기로 배치 재개가 제한될 수 있다.
  { name: '필터에 일반 후보만 보이는 혼합 배치', mode: 'CONFIRMED_ONLY', canResume: false },
]) {
  test(`사용량 중단의 실제 복구 경로를 일관되게 안내한다: ${scenario.name}`, async ({ page }) => {
    if (scenario.mode === 'ORDERED_PROVISIONAL') await page.setViewportSize({ width: 320, height: 900 });
    const state = await openReview(page, { analysisMode: scenario.mode, comparisonStatus: 'FAILED',
      comparisonFailureCode: 'AI_TOKEN_QUOTA_EXHAUSTED', sourceAnalysisJobStatus: 'FAILED' },
    { totalCandidateCount: 2, pendingCandidateCount: 2, tokenInterruptedComparisonCount: 2,
      canResumeTokenInterruptedComparisons: scenario.canResume });
    const quotaDialog = page.getByRole('dialog', { name: '설정 비교가 일부 중단되었습니다' });
    await expect(quotaDialog).toBeVisible();
    await expect(quotaDialog).not.toContainText('검토 화면에서 남은 비교만 재개');
    await quotaDialog.getByRole('button', { name: '취소', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    const banner = page.locator('.world-token-resume-banner--warning');
    const card = page.locator('.world-candidate-detail-card');
    if (scenario.canResume) {
      await expect(banner.getByRole('button', { name: '남은 비교 재개', exact: true })).toBeEnabled();
      await expect(card).toContainText('남은 비교 재개로');
      await page.getByRole('button', { name: '남은 비교 재개', exact: true }).click();
      await expect.poll(state.resumeCalls).toBe(1);
    } else {
      await expect(page.getByRole('button', { name: '남은 비교 재개', exact: true })).toHaveCount(0);
      await expect(card).not.toContainText('상단에서 재개');
      await expect(card).not.toContainText('남은 비교 재개');
      await expect(banner).toContainText('분석 목록에서 회차별 상태와 재개 방법');
      await banner.getByRole('button', { name: '분석 목록으로', exact: true }).click();
      await expect(page).toHaveURL(new RegExp('nav=analyses'));
      expect(state.resumeCalls()).toBe(0);
    }
    expect(state.retryCalls()).toBe(0);
  });
}
