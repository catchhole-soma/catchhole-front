import { expect, test, type Page, type Route } from '@playwright/test';
import { computedContrastRatio } from './contrast';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const candidateId = '33333333-3333-4333-8333-333333333333';
const groupKey = 'POWER_SYSTEM|정령술';
const endpoint = `/api/v1/works/${workId}/world-setting-candidates`;

function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data, error: null }) });
}

async function mockReview(page: Page, overrides: Record<string, unknown>) {
  let candidate: Record<string, unknown> = {
    id: candidateId, workId, sourceEpisodeNo: 11, category: 'POWER_SYSTEM',
    subjectName: '정령술', targetSubjectName: '정령술', scopeName: null,
    settingName: '소환 지속 시간', extractedValue: '정령은 30분 동안 머문다.',
    proposedValue: null, proposedScopeName: null, proposedSettingName: null,
    beforeValue: null, targetWorldSettingId: null,
    suggestedOperation: 'REVIEW_REQUIRED', comparisonStatus: 'COMPLETED',
    reviewStatus: 'PENDING_REVIEW', manualReviewAvailable: true, userModified: false,
    analysisMode: 'ORDERED_PROVISIONAL', consolidationStatus: 'SINGLE',
    evidenceSpans: [{ quote: '불의 정령이 머무는 시간은 30분이었다.' }],
    ...overrides,
  };
  let savedBody: Record<string, unknown> | null = null;
  let unintendedRequests = 0;
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, {
      id: 1, email: 'review-reasons@example.com', displayName: '검토 테스트', role: 'AUTHOR', status: 'ACTIVE',
    });
    if (pathname.endsWith('/recompare') || pathname.endsWith('/group-confirm')) unintendedRequests += 1;
    if (pathname === `${endpoint}/decisions` && request.method() === 'PATCH') {
      savedBody = request.postDataJSON();
      const decision = (savedBody!.candidates as Record<string, unknown>[])[0];
      candidate = { ...candidate, userModified: true, finalOperation: decision.operation,
        finalCategory: decision.category, finalSubjectName: decision.subjectName,
        finalScopeName: decision.scopeName, finalSettingName: decision.settingName, finalValue: decision.value };
      return success(route, { groupKey, candidates: [candidate] });
    }
    if (pathname === endpoint) return success(route, { batchId, episodeStartNo: 11, episodeEndNo: 11,
      episodeCount: 1, totalCandidateCount: 1, pendingCandidateCount: 1, reviewedCandidateCount: 0,
      confirmedCandidateCount: 0, dismissedCandidateCount: 0, directReviewCandidateCount: 1, processingCandidateCount: 0,
      pendingComparisonCount: 0, processingComparisonCount: 0,
      failedComparisonCount: candidate.comparisonStatus === 'FAILED' ? 1 : 0, activeComparisonJobCount: 0,
      recomparisonRequiredCount: 0, groups: { page: 0, size: 20, totalElements: 1, totalPages: 1, hasNext: false,
        content: [{ groupKey, category: 'POWER_SYSTEM', subjectName: '정령술', changeCount: 1,
          status: candidate.comparisonStatus,
          reviewRequiredCount: candidate.suggestedOperation === 'REVIEW_REQUIRED' ? 1 : 0, candidates: [candidate], evidenceEpisodeNos: [11] }] } });
    if (pathname.endsWith('/setting-candidates')) return success(route, { batchId, totalCandidateCount: 0,
      pendingCandidateCount: 0, reviewedCandidateCount: 0, matchRequiredCandidateCount: 0,
      confirmedCandidateCount: 0, dismissedCandidateCount: 0, directReviewCandidateCount: 0, processingCandidateCount: 0,
      groups: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false } });
    return success(route, []);
  });
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'isolated-review-reasons-test'));
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world&group=${encodeURIComponent(groupKey)}`);
  return { savedBody: () => savedBody, unintendedRequests: () => unintendedRequests, candidate: () => candidate };
}

for (const width of [1280, 320]) {
  for (const scenario of [
    { reason: 'SUBJECT_UNRESOLVED', label: '대상 연결 확인 필요', detail: '어느 세계관 대상에 속하는지 연결하지 못했습니다.' },
    { reason: 'BATCH_LIMIT_EXCEEDED', label: '비교 분량 확인 필요', detail: '한 번에 비교할 수 있는 분량을 넘어' },
    { reason: 'GENERAL_UNCERTAINTY', label: '대상·내용 확인 필요', detail: '같은 정령의 소환 시간인지 확인이 필요합니다.' },
    { reason: null, label: '검토 필요', detail: '자동으로 반영할 내용을 정하지 못해' },
  ]) {
    test(`검토 사유를 구분하고 서버 안내를 AI 판단으로 표시하지 않는다: ${scenario.reason ?? '일반'} (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1100 });
      const state = await mockReview(page, { comparisonReviewReason: scenario.reason,
        // 서버 사유에는 예전의 공통 문구 대신 사유별 안내를 사용한다.
        comparisonReason: scenario.reason === 'GENERAL_UNCERTAINTY' ? scenario.detail
          : scenario.reason ? '대상을 명확히 연결할 수 없어 사용자 검토가 필요합니다.' : null });
      const row = page.locator('.world-setting-diff-row');
      await expect(row.locator('.world-setting-diff-row__header')).toContainText(scenario.label);
      await expect(row.locator('.world-setting-diff-row__header')).not.toContainText('범위 확인 필요');
      await expect(row.locator('.world-setting-comparison-reason__title')).toHaveText('검토 안내');
      await expect(row.locator('.world-setting-comparison-reason__text')).toContainText(scenario.detail);
      await expect(row.getByText('AI 비교 판단', { exact: true })).toHaveCount(0);
      await expect(row).not.toContainText('비교 실패');
      expect(state.candidate().comparisonStatus).toBe('COMPLETED');
      expect(state.candidate().suggestedOperation).toBe('REVIEW_REQUIRED');
      if (scenario.reason === 'SUBJECT_UNRESOLVED') {
        await expect(row.locator('.world-setting-key-diff-values > div').first()).toContainText('비교 대상 미정');
        await expect(row.getByText('없음', { exact: true })).toHaveCount(0);
      }
      const comparisonBox = row.locator('.world-setting-key-diff-values > div').first();
      expect(await computedContrastRatio(comparisonBox.locator('div').first(), comparisonBox)).toBeGreaterThanOrEqual(4.5);
      await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      if (process.env.GH180_REVIEW_SCREENSHOTS === '1' && scenario.reason === 'SUBJECT_UNRESOLVED') {
        await row.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `docs/screens/gh180-world-subject-review-${width}.png` });
      }
      expect(state.unintendedRequests()).toBe(0);
    });
  }

  test(`범위가 없고 설정명이 다른 후보는 양쪽 경로를 보존하고 직접 저장한 뒤 확정한다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    const state = await mockReview(page, { comparisonReviewReason: 'SCOPE_UNRESOLVED',
      matchedScopeName: '불의 정령', matchedPropertyName: '소환 유지 시간', beforeValue: '20분',
      proposedScopeName: '불의 정령', proposedSettingName: '소환 유지 시간', proposedValue: 'AI가 합친 값',
      comparisonReason: '후보의 범위가 없어 기존 정령의 설정과 같은 내용인지 확인이 필요합니다.' });
    const row = page.locator('.world-setting-diff-row');
    const source = row.locator('.world-setting-key-diff-values > div').last();
    const compared = row.locator('.world-setting-key-diff-values > div').first();
    await expect(row.locator('.world-setting-diff-row__header > strong')).toHaveText('소환 지속 시간');
    await expect(source).toContainText('범위 미정 › 소환 지속 시간');
    await expect(source).toContainText('정령은 30분 동안 머문다.');
    await expect(source).not.toContainText('AI가 합친 값');
    await expect(compared).toContainText('불의 정령 › 소환 유지 시간');
    await expect(row.locator('.world-setting-comparison-reason__title')).toHaveText('검토 안내');
    const confirm = page.getByRole('button', { name: '모두 확정', exact: true });
    await expect(confirm).toBeDisabled();
    if (process.env.GH180_REVIEW_SCREENSHOTS === '1') {
      await row.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `docs/screens/gh180-world-unresolved-scope-${width}.png` });
    }
    await row.getByRole('button', { name: '직접 확인해서 반영', exact: true }).click();
    const modal = page.locator('.review-modal');
    await expect(modal).toContainText('범위 미정 › 소환 지속 시간');
    await expect(modal).toContainText('불의 정령 › 소환 유지 시간');
    await expect(modal.getByLabel('범위 (선택)')).toHaveValue('');
    await expect(modal.getByLabel('설정명', { exact: true })).toHaveValue('소환 지속 시간');
    await expect(confirm).toBeDisabled();
    await modal.getByLabel('범위 (선택)').fill('불의 정령');
    await modal.getByLabel('설정명', { exact: true }).fill('소환 유지 시간');
    await modal.getByLabel('반영 방식').selectOption('UPDATE');
    await modal.getByRole('button', { name: '수정안 적용', exact: true }).click();
    await expect.poll(state.savedBody).toEqual({ batchId, candidates: [{ candidateId,
      category: 'POWER_SYSTEM', subjectName: '정령술', scopeName: '불의 정령', settingName: '소환 유지 시간',
      value: '정령은 30분 동안 머문다.', operation: 'UPDATE' }] });
    await expect(confirm).toBeEnabled();
    await expect(page.getByRole('region', { name: '설정 후보 검토 요약' }).locator('.is-direct strong')).toHaveText('1개');
    await expect(page.getByRole('button', { name: '직접 확인 1개', exact: true })).toBeDisabled();
    expect(state.unintendedRequests()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  });

  test(`직접 해결 가능한 비교 실패는 검토 필요로 안내하고 실패 상태와 마지막 선택 경로를 보존한다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    const state = await mockReview(page, { comparisonStatus: 'FAILED', comparisonReviewReason: null,
      suggestedOperation: null, comparisonReason: '오래된 AI 성공 사유', comparisonErrorMessage: 'PRIVATE_VALIDATION_ERROR T1 c-private',
      comparisonDiagnostics: [
        { attempt: 1, rule: 'INTERNAL_RULE_OLD', candidateRefs: ['c-old'],
          selectedProperties: [{ propertyName: '이전 시도 설정', provisionalSubjectKey: 'internal-old' }] },
        { attempt: 2, rule: 'INTERNAL_RULE_FINAL', candidateRefs: ['c-private'],
          selectedProperties: [{ targetWorldSettingId: 'private-world-id', scopeName: '불의 정령', propertyName: '소환 유지 시간' }] },
      ] });
    const row = page.locator('.world-setting-diff-row');
    await expect(row.locator('.world-setting-comparison-reason__title')).toHaveText('검토 안내');
    await expect(row.locator('.world-setting-diff-row__header')).toContainText('검토 필요');
    await expect(row).not.toContainText('비교 실패');
    const card = page.locator('.world-candidate-group-card');
    if (width !== 320) {
      await expect(card).toContainText('검토 필요 1');
      await expect(card).not.toContainText('변경 방식 확인 중');
    }
    await expect(row.locator('.world-setting-comparison-reason__text')).toHaveText('자동 비교를 마치지 못해 대상과 내용을 확인해 주세요.');
    await expect(row).not.toContainText('오래된 AI 성공 사유');
    await expect(row).not.toContainText('PRIVATE_VALIDATION_ERROR');
    const selection = row.locator('.world-setting-comparison-selection');
    await expect(selection).toContainText('불의 정령 › 소환 유지 시간');
    await expect(selection).toContainText('확정된 것은 아닙니다.');
    await expect(selection).not.toContainText('이전 시도 설정');
    await expect(row).not.toContainText('INTERNAL_RULE');
    await expect(row).not.toContainText('c-private');
    await expect(row).not.toContainText('private-world-id');
    expect(await computedContrastRatio(selection.locator('strong'), selection)).toBeGreaterThanOrEqual(4.5);
    await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '다시 비교', exact: true })).toHaveCount(0);
    expect(state.candidate().comparisonStatus).toBe('FAILED');
    expect(state.unintendedRequests()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  });
}

test('직접 해결할 수 없는 비교 실패는 재시도 안내를 유지한다', async ({ page }) => {
  const state = await mockReview(page, { comparisonStatus: 'FAILED', comparisonReviewReason: null,
    suggestedOperation: null, manualReviewAvailable: false });
  const row = page.locator('.world-setting-diff-row');
  await expect(row.locator('.world-setting-diff-row__header')).toContainText('비교 실패');
  await expect(row.locator('.world-setting-comparison-reason__title')).toHaveText('비교 실패 안내');
  await expect(page.getByRole('button', { name: '다시 비교', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
  expect(state.unintendedRequests()).toBe(0);
});

test('반영 방식 필터의 AI 판단 보류는 정상 검토 요청을 뜻하고 전체 미처리 검토와 구분한다', async ({ page }) => {
  await mockReview(page, { comparisonStatus: 'FAILED', suggestedOperation: null });
  const filter = page.getByRole('group', { name: '제안된 반영 방식' });
  await expect(filter.getByRole('button', { name: '검토 필요', exact: true })).toHaveCount(0);
  await filter.getByRole('button', { name: 'AI 판단 보류', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('operation')).toBe('REVIEW_REQUIRED');
  await filter.getByRole('button', { name: '전체 반영 방식', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('operation')).toBeNull();
  await expect(page.locator('.world-setting-diff-row__header')).toContainText('검토 필요');
});

test('사용량 부족 후보는 수동 확인 가능 표시가 함께 있어도 중단 사유를 유지한다', async ({ page }) => {
  await mockReview(page, { comparisonStatus: 'FAILED', comparisonReviewReason: null,
    suggestedOperation: null, comparisonFailureCode: 'AI_TOKEN_QUOTA_EXHAUSTED', manualReviewAvailable: true });
  const row = page.locator('.world-setting-diff-row');
  await expect(row.locator('.world-setting-diff-row__header')).toContainText('사용량 부족으로 중단');
  await expect(row.locator('.world-setting-comparison-reason__text')).toContainText('사용량이 부족해');
  await expect(page.locator('.world-candidate-group-card')).toContainText('사용량 부족으로 중단');
  await expect(row.locator('.world-setting-diff-row__header')).not.toContainText('검토 필요');
});

test('실패 후보에 검토 제안이 남아 있어도 그룹 검토 수를 중복으로 더하지 않는다', async ({ page }) => {
  await mockReview(page, { comparisonStatus: 'FAILED', comparisonReviewReason: null,
    suggestedOperation: 'REVIEW_REQUIRED' });
  await expect(page.locator('.world-candidate-group-card')).toContainText('검토 필요 1');
  await expect(page.locator('.world-candidate-group-card')).not.toContainText('검토 필요 2');
});


test('공개 판단 근거와 원문에 들어 있는 고유 이름·설정값을 화면에서 치환하지 않는다', async ({ page }) => {
  const reason = '‘root’의 사용법은 T1 길드에서 전해졌으므로 기존 설명을 유지합니다.';
  const quote = 'T1 길드는 유물 root를 UPDATE라고 불렀다.';
  await mockReview(page, { suggestedOperation: 'UPDATE', comparisonReviewReason: null, manualReviewAvailable: false,
    category: 'IMPORTANT_ITEM', subjectName: 'root', targetSubjectName: 'root', scopeName: 'T1 길드',
    settingName: 'UPDATE', extractedValue: 'root의 사용법', proposedValue: 'root의 사용법',
    comparisonReason: reason, evidenceSpans: [{ quote }] });
  const row = page.locator('.world-setting-diff-row');
  await expect(row.locator('.world-setting-comparison-reason__text')).toHaveText(reason);
  await expect(row.locator('.theme-evidence__quote')).toHaveText(`“${quote}”`);
  await expect(row.locator('.world-setting-diff-row__header > strong')).toHaveText('T1 길드 › UPDATE');
  await row.getByRole('button', { name: '수정', exact: true }).click();
  await expect(page.locator('.review-modal')).toContainText('이 항목을 어디에 어떤 내용으로 반영할지 정해 주세요.');
  await expect(page.locator('.review-modal').getByLabel('대상', { exact: true })).toHaveValue('root');
});

for (const [reason, label] of [
  ['SUBJECT_CONFIRMATION_REQUIRED', '같은 대상인지 확인'],
  ['DEPENDENCY_CONFIRMATION_REQUIRED', '관련 설정 확인'],
  ['CURRENT_SETTING_CHANGED', '현재 설정 다시 확인'],
  ['SETTING_VALUE_CONFIRMATION_REQUIRED', '설정값 확인'],
  ['SETTING_LOCATION_CONFLICT', '반영할 항목 확인'],
  ['REVIEW_REQUIRED', '직접 확인 필요'],
]) {
  test(`자동 반영 보류 사유를 내부 이름 대신 안내한다: ${reason}`, async ({ page }) => {
    await mockReview(page, { automaticReviewHoldReason: reason, suggestedOperation: 'ADD', comparisonReviewReason: null });
    const row = page.locator('.world-setting-diff-row');
    await expect(row.locator('.world-setting-diff-row__header')).toContainText(label);
    await expect(row).not.toContainText(reason);
    await expect(page.getByRole('region', { name: '설정 후보 검토 요약' }).locator('.is-direct strong')).toHaveText('1개');
  });
}
