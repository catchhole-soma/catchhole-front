import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const candidateId = '33333333-3333-4333-8333-333333333333';
const characterId = '44444444-4444-4444-8444-444444444444';
const character2Id = '55555555-5555-4555-8555-555555555555';
const listPath = `/api/v1/works/${workId}/setting-candidates`;
const url = `/setting-review?workId=${workId}&batchId=${batchId}&group=루안`;

const pageOf = (content: unknown[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0, hasNext: false });
const success = (route: Route, data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
const initialCandidate = {
  id: candidateId, workId, episodeNo: 3, entityName: '루안', rawEntityMention: '루안',
  candidateKind: 'SETTING', entityType: 'CHARACTER', matchedCharacterId: characterId, matchStatus: 'MATCHED',
  attributeName: 'profile.affiliation', attributeNameEditable: false, attributeNamePrefix: null,
  attributeValue: '왕실 기사단', valueType: 'STRING', valueValidation: { status: 'VALID', repairable: false },
  evidenceSpans: [{ quote: '그날 루안은 왕실 기사단에 들어갔다.' }, { quote: '그의 제복에는 왕실의 문장이 달려 있었다.' }],
  confidence: 0.95, reviewStatus: 'PENDING_REVIEW', comparisonStatus: 'COMPLETED',
  suggestedOperation: 'ADD', comparisonRevision: 'revision-1', proposedFactValue: '왕실 기사단',
  analysisMode: 'CONFIRMED_ONLY', automaticApplicationPending: false, manualReviewAvailable: false,
  reviewedApplicationMode: null as string | null, userModified: false, updatedAt: '2026-10-02T01:00:00Z',
  snapshotChanges: [] as unknown[],
};

async function fixture(page: Page, overrides: Record<string, unknown> = {}) {
  let candidate = { ...initialCandidate, ...overrides };
  const requests: { method: string; path: string; body: Record<string, unknown> }[] = [];
  let rejectReview = false;
  let matchResponse: Record<string, unknown> = {};
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') requests.push({ method: request.method(), path, body: request.postDataJSON() ?? {} });
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'review-clear-blue@example.com', displayName: '검토 테스트', role: 'AUTHOR', status: 'ACTIVE', phoneVerified: false });
    if (path.endsWith('/characters')) return success(route, pageOf([
      { id: characterId, name: '루안 베른', firstAppearanceEpisodeNo: 1, representativeAttributeLabel: '직업', representativeAttributeValue: '기사' },
      { id: character2Id, name: '루안 게르', firstAppearanceEpisodeNo: 3, representativeAttributeLabel: '직업', representativeAttributeValue: '상인' },
    ]));
    if (path.includes('/characters/')) return success(route, { id: characterId, name: '루안', profile: [], stats: [], skills: [], items: [], statuses: [] });
    if (path === `${listPath}/${candidateId}` && request.method() === 'PATCH') {
      if (rejectReview) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, message: '다른 화면에서 후보가 바뀌었습니다. 최신 내용을 확인해 주세요.', error: { code: 'SETTING_CANDIDATE_REVIEW_STALE', status: 409 } }) });
      candidate = { ...candidate, ...request.postDataJSON(), userModified: true, updatedAt: '2026-10-02T01:01:00Z', valueValidation: { status: 'VALID', repairable: true } };
      return success(route, candidate);
    }
    if (path.endsWith('/character-match')) {
      candidate = { ...candidate, matchedCharacterId: request.postDataJSON().matchedCharacterId,
        matchStatus: 'MATCHED', userModified: true, reviewedApplicationMode: null, updatedAt: '2026-10-02T01:01:00Z', ...matchResponse };
      return success(route, candidate);
    }
    if (path.endsWith('/group-confirm')) {
      candidate = { ...candidate, reviewStatus: candidate.suggestedOperation === 'EXCLUDE' ? 'DISMISSED' : 'CONFIRMED' };
      return success(route, { candidates: [candidate] });
    }
    if (path.endsWith('/recompare')) return success(route, candidate);
    if (path === listPath) {
      const pending = candidate.reviewStatus === 'PENDING_REVIEW';
      return success(route, { batchId, totalCandidateCount: 1, pendingCandidateCount: pending ? 1 : 0,
        confirmedCandidateCount: pending ? 0 : 1, dismissedCandidateCount: 0,
        directReviewCandidateCount: pending ? 1 : 0, processingCandidateCount: 0,
        groups: pageOf(pending || new URL(request.url()).searchParams.get('reviewStatus') !== 'PENDING_REVIEW'
          ? [{ groupKey: '루안', entityName: '루안', candidateCount: 1, pendingCandidateCount: pending ? 1 : 0, evidenceEpisodeNos: [3], candidates: [candidate] }] : []) });
    }
    if (path.endsWith('/world-setting-candidates')) return success(route, { batchId, totalCandidateCount: 0, confirmedCandidateCount: 0,
      dismissedCandidateCount: 0, directReviewCandidateCount: 0, processingCandidateCount: 0, groups: pageOf([]) });
    return success(route, []);
  });
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'clear-blue-character-test'));
  await page.goto(url);
  return { requests, rejectReview: (value: boolean) => { rejectReview = value; },
    setMatchResponse: (values: Record<string, unknown>) => { matchResponse = values; },
    setCandidate: (values: Record<string, unknown>) => { candidate = { ...candidate, ...values }; } };
}

const card = (page: Page) => page.getByRole('region', { name: '소속 설정 후보', exact: true });
const confirm = (page: Page) => page.getByRole('button', { name: /1개 설정 모두 확정/ });

test('연결 변경은 수정 왼쪽에 있고 새 인물 등록은 연결 모달에서 선택한다', async ({ page }) => {
  const { requests } = await fixture(page);
  const headingActions = card(page).locator('.review-cb-heading__actions');
  await expect(headingActions.getByRole('button')).toHaveText(['캐릭터 연결 변경', '수정', '제외']);
  await expect(card(page).locator('.setting-candidate-match-actions')).toHaveCount(0);
  await expect(card(page).locator('.review-cb-choice__effect')).toHaveCount(0);
  await expect(card(page).getByRole('button', { name: '새 캐릭터로 등록', exact: true })).toHaveCount(0);

  await headingActions.getByRole('button', { name: '캐릭터 연결 변경' }).click();
  const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
  await expect(dialog.getByRole('button', { name: /루안 베른/ })).toBeVisible();
  await dialog.getByRole('button', { name: '새 캐릭터로 등록', exact: true }).first().click();
  await dialog.getByLabel('새 캐릭터 이름').fill('새로운 루안');
  await dialog.getByRole('button', { name: '새 캐릭터로 등록', exact: true }).last().click();
  await expect(dialog).toHaveCount(0);
  expect(requests.find(request => request.path.endsWith('/character-match'))?.body)
    .toMatchObject({ resolutionType: 'CREATE_NEW', entityName: '새로운 루안' });
  expect(requests.some(request => request.path.endsWith('/group-confirm'))).toBe(false);
});

test('320px에서도 연결·수정·제외를 누를 수 있고 이력 선택을 확정 전에 바꿀 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const { requests } = await fixture(page);
  const openDetail = page.getByRole('button', { name: /루안.*1개 설정/ });
  if (await openDetail.isVisible()) await openDetail.click();
  const actions = card(page).locator('.review-cb-heading__actions');
  await expect(actions.getByRole('button', { name: '캐릭터 연결 변경' })).toBeVisible();
  await card(page).getByRole('button', { name: /이력에만 저장/ }).click();
  await expect(card(page).getByRole('button', { name: /이력에만 저장/ })).toHaveAttribute('aria-pressed', 'true');
  await card(page).getByRole('button', { name: /현재 설정에 반영/ }).click();
  await expect(card(page).getByRole('button', { name: /현재 설정에 반영/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page).locator('.review-cb-choice__effect')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(requests).toHaveLength(0);
});

test('새 설정은 빈 기존값 칸 없이 사진·추가 내용·전체 근거를 보여 주고 묶음만 확정한다', async ({ page }) => {
  const { requests } = await fixture(page);
  await expect(card(page).locator('.review-cb-heading__image img')).toBeVisible();
  await expect(card(page).getByText('추가할 설정', { exact: true })).toBeVisible();
  await expect(card(page).locator('.review-cb-comparison')).toHaveCount(0);
  await card(page).locator('.review-cb-evidence summary').click();
  await expect(card(page).getByText('그날 루안은 왕실 기사단에 들어갔다.', { exact: true })).toBeVisible();
  await expect(card(page).getByText('그의 제복에는 왕실의 문장이 달려 있었다.', { exact: true })).toBeVisible();
  await confirm(page).click();
  await expect.poll(() => requests.some(request => request.path.endsWith('/group-confirm'))).toBe(true);
  expect(requests.filter(request => request.path.endsWith('/group-confirm'))[0].body).toMatchObject({ candidates: [{ candidateId, applicationMode: 'APPLY_PROPOSAL' }] });
  expect(requests.some(request => /\/confirm$/.test(request.path))).toBe(false);
});

test('변경 diff는 최종 제안 문장을 표시하며 이력 선택은 삭제처럼 표시하지 않는다', async ({ page }) => {
  const { requests } = await fixture(page, { suggestedOperation: 'MERGE', attributeValue: '왕실 기사단의 정찰 임무도 맡는다.',
    proposedFactValue: '왕실 기사단 소속이며 정찰 임무도 맡는다.', snapshotChanges: [{ action: 'UPSERT', factKey: 'profile.affiliation', beforeFactValue: '왕실 기사단 소속이다.', proposedFactValue: '왕실 기사단 소속이며 정찰 임무도 맡는다.' }] });
  await expect(card(page).locator('.review-cb-comparison.is-change')).toBeVisible();
  await expect(card(page).locator('.review-cb-comparison__column.is-after')).toContainText('왕실 기사단 소속이며 정찰 임무도 맡는다.');
  await card(page).getByRole('button', { name: /이력에만 저장/ }).click();
  await expect(card(page).locator('.review-cb-comparison.is-neutral')).toBeVisible();
  await confirm(page).click();
  await expect.poll(() => requests.some(request => request.path.endsWith('/group-confirm'))).toBe(true);
  expect(requests.find(request => request.path.endsWith('/group-confirm'))?.body).toMatchObject({ candidates: [{ applicationMode: 'HISTORY_ONLY' }] });
});

test('이력으로 저장하거나 확정한 종료 후보는 실제로 적용하지 않는 부수 삭제를 표시하지 않는다', async ({ page }) => {
  const { setCandidate } = await fixture(page, { suggestedOperation: 'REMOVE', attributeValue: '지난해 왕실 기사단에서 물러났다.',
    snapshotChanges: [
      { action: 'REMOVE', factKey: 'profile.affiliation', beforeFactValue: '왕실 기사단 소속이다.' },
      { action: 'REMOVE', factKey: 'profile.rank', beforeFactValue: '왕실 기사단장' },
    ] });
  await expect(card(page).getByText('함께 바뀌는 설정 1개')).toBeVisible();
  await card(page).getByRole('button', { name: /이력에만 저장/ }).click();
  await expect(card(page).locator('.review-additional-changes')).toHaveCount(0);
  await expect(card(page).locator('.review-cb-comparison.is-neutral')).toBeVisible();
  await expect(card(page).locator('.review-cb-comparison__column.is-after')).toContainText('지난해 왕실 기사단에서 물러났다.');
  setCandidate({ reviewStatus: 'CONFIRMED', historyOnly: true });
  await page.goto(`${url}&reviewStatus=ALL`);
  await expect(card(page).getByText('현재 설정은 유지하고, 이 회차의 이력에 저장했습니다.')).toBeVisible();
  await expect(card(page).locator('.review-additional-changes')).toHaveCount(0);
  await expect(card(page).locator('.review-cb-comparison.is-change')).toHaveCount(0);
  await expect(card(page).locator('.review-cb-comparison__column.is-after')).toContainText('지난해 왕실 기사단에서 물러났다.');
  await expect(card(page).getByText('현재 설정에서 종료', { exact: true })).toHaveCount(0);
});

test('미상 인물을 카드로 연결해도 내용 판단 보류는 자동 해소하지 않는다', async ({ page }) => {
  const { requests } = await fixture(page, { matchStatus: 'AMBIGUOUS', matchedCharacterId: null, rawEntityMention: '그',
    suggestedOperation: 'REVIEW_REQUIRED', manualReviewAvailable: true, analysisMode: 'ORDERED_PROVISIONAL' });
  await card(page).getByRole('button', { name: /루안 베른/ }).click();
  await expect.poll(() => requests.filter(request => request.path.endsWith('/character-match')).length).toBe(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(confirm(page)).toBeDisabled();
  await expect(card(page).getByRole('button', { name: /현재 설정에 반영/ })).toBeVisible();
  expect(requests.some(request => request.path.endsWith('/group-confirm'))).toBe(false);
});

test('서버가 인물 연결만 남았다고 확인한 후보는 추가 확인 클릭 없이 준비된다', async ({ page }) => {
  const { requests, setMatchResponse } = await fixture(page, { matchStatus: 'AMBIGUOUS', matchedCharacterId: null,
    suggestedOperation: 'ADD', manualReviewAvailable: true, analysisMode: 'ORDERED_PROVISIONAL' });
  setMatchResponse({ reviewedApplicationMode: 'APPLY_PROPOSAL' });
  await card(page).getByRole('button', { name: /루안 베른/ }).click();
  await expect(confirm(page)).toBeEnabled();
  expect(requests.filter(request => request.method === 'PATCH' && !request.path.endsWith('/character-match'))).toHaveLength(0);
  await confirm(page).click();
  await expect.poll(() => requests.some(request => request.path.endsWith('/group-confirm'))).toBe(true);
  expect(requests.find(request => request.path.endsWith('/group-confirm'))?.body).toMatchObject({ candidates: [{
    applicationMode: 'APPLY_PROPOSAL', applyEditedValue: true, expectedUpdatedAt: '2026-10-02T01:01:00Z',
  }] });
});

test('명시한 현재·이력 선택은 서버 초안으로 저장되고 새로고침 후에도 유지된다', async ({ page }) => {
  const { requests } = await fixture(page, { suggestedOperation: 'REVIEW_REQUIRED', manualReviewAvailable: true, analysisMode: 'ORDERED_PROVISIONAL' });
  await expect(confirm(page)).toBeDisabled();
  await card(page).getByRole('button', { name: /이력에만 저장/ }).click();
  await expect.poll(() => requests.some(request => request.method === 'PATCH')).toBe(true);
  expect(requests.find(request => request.method === 'PATCH')?.body).toMatchObject({ attributeName: 'profile.affiliation', attributeValue: '왕실 기사단', reviewedApplicationMode: 'HISTORY_ONLY', expectedUpdatedAt: '2026-10-02T01:00:00Z' });
  await expect(confirm(page)).toBeEnabled();
  await page.reload();
  await expect(card(page).getByRole('button', { name: /이력에만 저장/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(confirm(page)).toBeEnabled();
  await confirm(page).click();
  await expect.poll(() => requests.some(request => request.path.endsWith('/group-confirm'))).toBe(true);
  expect(requests.find(request => request.path.endsWith('/group-confirm'))?.body).toMatchObject({ candidates: [{ applicationMode: 'HISTORY_ONLY', applyEditedValue: true, expectedUpdatedAt: '2026-10-02T01:01:00Z' }] });
});

test('저장된 직접 검토는 AI 비교가 더 필요 없는 상태에서도 재비교 없이 확정한다', async ({ page }) => {
  const { requests } = await fixture(page, { comparisonStatus: 'NOT_REQUIRED', suggestedOperation: null,
    manualReviewAvailable: true, analysisMode: 'ORDERED_PROVISIONAL', userModified: true, reviewedApplicationMode: 'APPLY_PROPOSAL' });
  await expect(card(page).getByRole('button', { name: /현재 설정에 반영/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page).getByText('반영할 최종 내용', { exact: true })).toBeVisible();
  await expect(card(page).getByText('설정을 비교하고 있어요', { exact: true })).toHaveCount(0);
  await expect(confirm(page)).toBeEnabled();
  await confirm(page).click();
  await expect.poll(() => requests.some(request => request.path.endsWith('/group-confirm'))).toBe(true);
  expect(requests.some(request => request.path.endsWith('/recompare'))).toBe(false);
  expect(requests.find(request => request.path.endsWith('/group-confirm'))?.body).toMatchObject({ candidates: [{ applicationMode: 'APPLY_PROPOSAL', applyEditedValue: true, expectedUpdatedAt: '2026-10-02T01:00:00Z' }] });
});

test('저장한 선택이 있어도 서버가 원문 기준을 무효화하면 준비 완료로 우회하지 않는다', async ({ page }) => {
  const { requests } = await fixture(page, { comparisonStatus: 'RECOMPARISON_REQUIRED', suggestedOperation: null,
    manualReviewAvailable: false, analysisMode: 'ORDERED_PROVISIONAL', userModified: true, reviewedApplicationMode: 'APPLY_PROPOSAL' });
  await expect(confirm(page)).toBeDisabled();
  await expect(page.getByText('이 후보의 기준 상태가 바뀌었습니다. 최신 검토 상태를 확인해 주세요.', { exact: true })).toBeVisible();
  await expect(card(page).getByRole('button', { name: /현재 설정에 반영/ })).toHaveCount(0);
  expect(requests).toHaveLength(0);
});

test('초안 저장 충돌은 선택 완료로 간주하지 않고 재요청할 수 있다', async ({ page }) => {
  const { requests, rejectReview } = await fixture(page, { suggestedOperation: 'REVIEW_REQUIRED', manualReviewAvailable: true, analysisMode: 'ORDERED_PROVISIONAL' });
  rejectReview(true);
  await card(page).getByRole('button', { name: /현재 설정에 반영/ }).click();
  await expect(card(page).getByRole('alert')).toContainText('최신 내용을 확인');
  await expect(confirm(page)).toBeDisabled();
  rejectReview(false);
  await card(page).getByRole('button', { name: /현재 설정에 반영/ }).click();
  await expect(confirm(page)).toBeEnabled();
  expect(requests.filter(request => request.method === 'PATCH')).toHaveLength(2);
});

test('숫자 형식은 인라인에서 검증하고 잘못된 값은 저장하지 않는다', async ({ page }) => {
  const { requests } = await fixture(page, { attributeName: 'age', attributeValue: '스무 살', valueType: 'NUMBER',
    valueValidation: { status: 'INVALID', repairable: true, message: '숫자를 입력해 주세요.' } });
  const region = page.getByRole('region', { name: '나이 설정 후보' });
  const value = region.getByLabel('올바른 설정값');
  await expect(value).toHaveValue('스무 살');
  await expect(region.getByRole('button', { name: '수정한 값 저장' })).toBeDisabled();
  await value.fill('20');
  await region.getByRole('button', { name: '수정한 값 저장' }).click();
  await expect.poll(() => requests.some(request => request.method === 'PATCH')).toBe(true);
  expect(requests.find(request => request.method === 'PATCH')?.body).toEqual({ attributeName: 'age', attributeValue: '20', expectedUpdatedAt: initialCandidate.updatedAt });
});

for (const width of [1280, 320]) {
  test(`인물 선택과 긴 비교 문장은 ${width}px에서 잘리지 않는다`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 2400 });
    const { setCandidate } = await fixture(page, { matchStatus: 'AMBIGUOUS', matchedCharacterId: null,
      suggestedOperation: 'REVIEW_REQUIRED', manualReviewAvailable: true, analysisMode: 'ORDERED_PROVISIONAL',
      attributeValue: '왕실 기사단에 소속되어 있지만 북부 원정대의 정찰 임무도 함께 수행한다.' });
    await expect(card(page).getByRole('button', { name: /루안 베른/ })).toBeVisible();
    await expect(card(page).getByRole('button', { name: /새로운 인물/ })).toBeVisible();
    await expect(card(page).getByText('이번 원고에서', { exact: true })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await card(page).screenshot({ path: testInfo.outputPath(`character-targets-${width}.png`) });
    setCandidate({ matchStatus: 'MATCHED', matchedCharacterId: characterId, suggestedOperation: 'MERGE', manualReviewAvailable: false,
      analysisMode: 'CONFIRMED_ONLY', proposedFactValue: '왕실 기사단에 소속되어 있으며 북부 원정대의 정찰 임무도 함께 수행한다.',
      snapshotChanges: [{ action: 'UPSERT', factKey: 'profile.affiliation', beforeFactValue: '왕실 기사단에 소속되어 있다.', proposedFactValue: '왕실 기사단에 소속되어 있으며 북부 원정대의 정찰 임무도 함께 수행한다.' }] });
    await page.reload();
    await expect(card(page).locator('.review-cb-comparison.is-change')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await card(page).screenshot({ path: `docs/screens/gh215/character-diff-${width}.png` });
  });

  test(`자동 반영 대기 ${width}px는 간단한 잠금과 원문만 제공한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await fixture(page, { automaticApplicationPending: true, analysisMode: 'ORDERED_PROVISIONAL', manualReviewAvailable: true });
    await expect(card(page).getByText('분석이 진행 중이에요', { exact: true })).toBeVisible();
    await expect(card(page).getByRole('button', { name: '수정', exact: true })).toBeDisabled();
    await expect(card(page).getByRole('button', { name: '제외', exact: true })).toBeDisabled();
    await expect(confirm(page)).toBeDisabled();
    await expect(card(page).getByRole('button', { name: /현재 설정에 반영/ })).toHaveCount(0);
    await card(page).locator('.review-cb-evidence summary').click();
    await expect(card(page).getByText('그날 루안은 왕실 기사단에 들어갔다.', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}


test('기존 인물에 연결된 등장 후보는 신규 등록으로 안내하지 않고 비교 없이 확정할 수 있다', async ({ page }) => {
  const { requests } = await fixture(page, { candidateKind: 'CHARACTER_DISCOVERY',
    attributeName: null, attributeValue: null, comparisonStatus: 'NOT_REQUIRED', suggestedOperation: null,
    proposedFactValue: null, comparisonRevision: null, matchedCharacterId: characterId, matchStatus: 'MATCHED' });
  const region = page.getByRole('region', { name: '인물 연결 설정 후보', exact: true });
  await expect(region.getByText('인물 연결', { exact: true })).toBeVisible();
  await expect(region.getByText('연결된 인물', { exact: true })).toBeVisible();
  await expect(region.getByText('새로 등록할 인물', { exact: true })).toHaveCount(0);
  await expect(region.getByText('새로운 인물', { exact: true })).toHaveCount(0);
  await expect(region.locator('.review-cb-inline-value').getByText('루안', { exact: true })).toBeVisible();
  await expect(confirm(page)).toBeEnabled();
  await confirm(page).click();
  await expect.poll(() => requests.some(request => request.path.endsWith('/group-confirm'))).toBe(true);
  expect(requests.find(request => request.path.endsWith('/group-confirm'))?.body).toMatchObject({ candidates: [{ candidateId, applicationMode: 'APPLY_PROPOSAL' }] });
  expect(requests.some(request => request.path.endsWith('/recompare'))).toBe(false);
});

test('연결되지 않은 새 인물 등장 후보에는 신규 등록 안내를 유지한다', async ({ page }) => {
  await fixture(page, { candidateKind: 'CHARACTER_DISCOVERY', attributeName: null, attributeValue: null,
    comparisonStatus: 'NOT_REQUIRED', suggestedOperation: null, proposedFactValue: null,
    comparisonRevision: null, matchedCharacterId: null, matchStatus: 'UNRESOLVED' });
  const region = page.getByRole('region', { name: '새로운 인물 설정 후보', exact: true });
  await expect(region.getByText('새로 등록할 인물', { exact: true })).toBeVisible();
  await expect(region.locator('.review-cb-inline-value').getByText('루안', { exact: true })).toBeVisible();
  await expect(confirm(page)).toBeEnabled();
});

test('완료된 제외 제안은 묶음 확정에 포함하고 현재값이나 이력 저장으로 안내하지 않는다', async ({ page }) => {
  const { requests } = await fixture(page, { suggestedOperation: 'EXCLUDE', proposedFactValue: null,
    snapshotChanges: [{ action: 'NONE', factKey: 'profile.affiliation', beforeFactValue: '왕실 기사단' }] });
  await expect(card(page).getByText('제외 제안', { exact: true })).toBeVisible();
  await expect(card(page).getByText('모두 확정하면 이 후보는 제외돼요', { exact: true })).toBeVisible();
  await expect(card(page).getByText(/이 내용은 현재 설정이나 이력에 추가하지 않고/)).toBeVisible();
  await expect(page.getByText('반영 0개 · 제외 1개', { exact: true })).toBeVisible();
  await expect(page.getByText('모든 설정의 현재값 비교가 끝난 뒤 함께 확정할 수 있습니다.', { exact: true })).toHaveCount(0);
  await expect(confirm(page)).toBeEnabled();
  await expect(card(page).getByRole('button', { name: '제외', exact: true })).toBeEnabled();
  await expect(card(page).getByRole('button', { name: '수정', exact: true })).toBeEnabled();
  expect(requests).toHaveLength(0);
  await confirm(page).click();
  await expect.poll(() => requests.some(request => request.path.endsWith('/group-confirm'))).toBe(true);
  expect(requests.find(request => request.path.endsWith('/group-confirm'))?.body).toMatchObject({ candidates: [{ candidateId, applicationMode: 'APPLY_PROPOSAL' }] });
  expect(requests.some(request => request.path.endsWith('/dismiss') || request.path.endsWith('/recompare'))).toBe(false);
});

test('등장·반영·제외가 섞인 인물 묶음은 한 요청으로 확정하고 개별 제외나 재비교를 요청하지 않는다', async ({ page }) => {
  const exclusionId = '66666666-6666-4666-8666-666666666666';
  const discoveryId = '77777777-7777-4777-8777-777777777777';
  const items = [initialCandidate,
    { ...initialCandidate, id: exclusionId, attributeName: 'profile.family', attributeValue: '동생이 있다.', suggestedOperation: 'EXCLUDE', proposedFactValue: null },
    { ...initialCandidate, id: discoveryId, candidateKind: 'CHARACTER_DISCOVERY', attributeName: null,
      attributeValue: null, comparisonStatus: 'NOT_REQUIRED', suggestedOperation: null, comparisonRevision: null, proposedFactValue: null },
  ];
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  let done = false;
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') writes.push({ path, body: request.postDataJSON() ?? {} });
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'mixed-review@example.com', displayName: '검토 테스트', role: 'AUTHOR', status: 'ACTIVE' });
    if (path === `${listPath}/group-confirm`) {
      done = true;
      return success(route, { candidates: items.map(item => ({ ...item, reviewStatus: item.suggestedOperation === 'EXCLUDE' ? 'DISMISSED' : 'CONFIRMED' })) });
    }
    if (path === listPath) return success(route, {
      batchId, totalCandidateCount: 3, pendingCandidateCount: done ? 0 : 3, confirmedCandidateCount: done ? 2 : 0,
      dismissedCandidateCount: done ? 1 : 0, directReviewCandidateCount: done ? 0 : 3, processingCandidateCount: 0,
      groups: pageOf(done ? [] : [{ groupKey: '루안', entityName: '루안', candidateCount: 3, pendingCandidateCount: 3, candidates: items }]),
    });
    if (path.endsWith('/world-setting-candidates')) return success(route, { batchId, totalCandidateCount: 0,
      confirmedCandidateCount: 0, dismissedCandidateCount: 0, pendingCandidateCount: 0, directReviewCandidateCount: 0, processingCandidateCount: 0, groups: pageOf([]) });
    return success(route, []);
  });
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'mixed-exclusion-test'));
  await page.goto(url);
  await expect(page.getByText('반영 2개 · 제외 1개', { exact: true })).toBeVisible();
  const groupConfirm = page.getByRole('button', { name: '3개 설정 모두 확정', exact: true });
  await expect(groupConfirm).toBeEnabled();
  await groupConfirm.click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ path: `${listPath}/group-confirm`, body: {
    batchId, comparisonRevision: 'revision-1', candidates: [
      { candidateId, applicationMode: 'APPLY_PROPOSAL' },
      { candidateId: exclusionId, applicationMode: 'APPLY_PROPOSAL' },
      { candidateId: discoveryId, applicationMode: 'APPLY_PROPOSAL' },
    ],
  } });
  await expect(page.getByRole('button', { name: '원고 목록으로', exact: true })).toBeEnabled();
  expect(writes).toHaveLength(1);
});

for (const [name, override] of [
  ['비교 처리 중', { comparisonStatus: 'PROCESSING' }],
  ['공유 비교 버전 없음', { comparisonRevision: null }],
  ['자동 반영 진행 중', { automaticApplicationPending: true }],
  ['인물 미확인', { matchStatus: 'AMBIGUOUS', matchedCharacterId: null }],
  ['설정값 형식 오류', { valueValidation: { status: 'INVALID', repairable: true } }],
  ['직접 검토 결정 미저장', { analysisMode: 'ORDERED_PROVISIONAL', manualReviewAvailable: true, userModified: true, reviewedApplicationMode: null }],
] as const) {
  test(`제외 제안도 ${name}일 때는 묶음 확정 안전장치를 우회하지 않는다`, async ({ page }) => {
    const { requests } = await fixture(page, { suggestedOperation: 'EXCLUDE', proposedFactValue: null, ...override });
    await expect(confirm(page)).toBeDisabled();
    expect(requests).toHaveLength(0);
  });
}


test('일반 검토의 이력 선택은 세계관 탭 왕복 후에도 실제 그룹 확정 요청에 유지된다', async ({ page }) => {
  const { requests } = await fixture(page, { suggestedOperation: 'UPDATE',
    snapshotChanges: [{ action: 'UPSERT', factKey: 'profile.affiliation', beforeFactValue: '북부 원정대', proposedFactValue: '왕실 기사단' }] });
  const historyChoice = () => card(page).getByRole('button', { name: /이력에만 저장/ });
  await historyChoice().click();
  await expect(historyChoice()).toHaveAttribute('aria-pressed', 'true');
  const tabs = page.getByRole('navigation', { name: '설정 후보 종류' });
  await tabs.getByRole('button', { name: /세계관 후보/ }).click();
  await expect(tabs.getByRole('button', { name: /세계관 후보/ })).toHaveAttribute('aria-current', 'page');
  await tabs.getByRole('button', { name: /캐릭터 후보/ }).click();
  await expect(historyChoice()).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page).locator('.review-cb-comparison.is-neutral')).toBeVisible();
  expect(requests).toHaveLength(0);
  await confirm(page).click();
  await expect.poll(() => requests.some(request => request.path.endsWith('/group-confirm'))).toBe(true);
  expect(requests.find(request => request.path.endsWith('/group-confirm'))?.body).toMatchObject({ candidates: [{ candidateId, applicationMode: 'HISTORY_ONLY' }] });
});

test('일반 검토 선택은 업로드 묶음이 바뀌면 초기화되고 돌아와도 이전 선택을 적용하지 않는다', async ({ page }) => {
  await fixture(page, { suggestedOperation: 'UPDATE' });
  const historyChoice = () => card(page).getByRole('button', { name: /이력에만 저장/ });
  await historyChoice().click();
  await expect(historyChoice()).toHaveAttribute('aria-pressed', 'true');
  for (const nextBatchId of ['88888888-8888-4888-8888-888888888888', batchId]) {
    await page.evaluate(id => {
      const next = new URL(location.href);
      next.searchParams.set('batchId', id);
      history.pushState({}, '', next);
      dispatchEvent(new PopStateEvent('popstate'));
    }, nextBatchId);
    await expect(historyChoice()).toHaveAttribute('aria-pressed', 'false');
    await expect(card(page).getByRole('button', { name: /현재 설정에 반영/ })).toHaveAttribute('aria-pressed', 'true');
  }
});

test('일반 검토 선택은 작품이 바뀌면 초기화된다', async ({ page }) => {
  await fixture(page, { suggestedOperation: 'UPDATE' });
  const otherWork = '99999999-9999-4999-8999-999999999999';
  await page.route(`**/api/v1/works/${otherWork}/**`, route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/setting-candidates')) return success(route, {
      batchId, totalCandidateCount: 1, pendingCandidateCount: 1, directReviewCandidateCount: 1, processingCandidateCount: 0,
      groups: pageOf([{ groupKey: '루안', entityName: '루안', candidateCount: 1, pendingCandidateCount: 1,
        candidates: [{ ...initialCandidate, workId: otherWork, suggestedOperation: 'UPDATE' }] }]),
    });
    if (path.endsWith('/world-setting-candidates')) return success(route, {
      batchId, totalCandidateCount: 0, pendingCandidateCount: 0, directReviewCandidateCount: 0, processingCandidateCount: 0, groups: pageOf([]),
    });
    return success(route, []);
  });
  await card(page).getByRole('button', { name: /이력에만 저장/ }).click();
  await expect(card(page).getByRole('button', { name: /이력에만 저장/ })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(id => {
    const next = new URL(location.href);
    next.searchParams.set('workId', id);
    history.pushState({}, '', next);
    dispatchEvent(new PopStateEvent('popstate'));
  }, otherWork);
  await expect(card(page).getByRole('button', { name: /이력에만 저장/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(card(page).getByRole('button', { name: /현재 설정에 반영/ })).toHaveAttribute('aria-pressed', 'true');
});

for (const state of ['CONFIRMED', 'DISMISSED'] as const) {
  test(`검토 완료 ${state}는 재비교 안내나 현재값을 과거값으로 오인한 diff를 표시하지 않는다`, async ({ page }) => {
    await fixture(page, { reviewStatus: state, comparisonStatus: state === 'DISMISSED' ? 'NOT_REQUIRED' : 'COMPLETED',
      snapshotChanges: [{ action: 'UPSERT', factKey: 'profile.affiliation', beforeFactValue: '왕실 기사단', proposedFactValue: '왕실 기사단' }] });
    await page.getByRole('group', { name: '검토 상태', exact: true }).getByRole('button', { name: '전체', exact: true }).click();
    await expect(card(page)).toBeVisible();
    await expect(card(page).getByText('현재 설정과 비교가 필요해요', { exact: true })).toHaveCount(0);
    await expect(card(page).getByRole('button', { name: /현재 설정 비교 시작|다시 비교/ })).toHaveCount(0);
    if (state === 'CONFIRMED') {
      await expect(card(page).getByText('반영된 설정', { exact: true })).toBeVisible();
      await expect(card(page).getByRole('region', { name: '기존 설정과 반영된 설정 비교' })).toHaveCount(0);
    }
  });
}
