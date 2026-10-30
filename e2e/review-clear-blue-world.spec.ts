import { expect, test, type Page, type Route } from '@playwright/test';
import type { WorldSettingCandidateResponse } from '../src/app/api/generated/types.gen';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const candidateId = '33333333-3333-4333-8333-333333333333';
const targetId = '44444444-4444-4444-8444-444444444444';
const member = { id: 1, email: 'review@example.com', displayName: '검토 테스트', role: 'AUTHOR', status: 'ACTIVE' };
const pageData = <T,>(content: T[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0, hasNext: false });
const success = (route: Route, data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
const base: WorldSettingCandidateResponse = {
  id: candidateId, workId, sourceEpisodeNo: 3, category: 'LOCATION', subjectName: '별빛 미궁', targetSubjectName: '별빛 미궁',
  targetWorldSettingId: targetId, settingName: '위험 기준', extractedValue: '생명력이 낮으면 돌아온다.',
  comparisonStatus: 'COMPLETED', suggestedOperation: 'REVIEW_REQUIRED', comparisonReviewReason: 'SCOPE_UNRESOLVED',
  matchedScopeName: '탐사 규칙', matchedPropertyName: '귀환 조건', beforeValue: '해가 지면 돌아온다.',
  proposedValue: '생명력이 낮으면 돌아온다.', consolidationStatus: 'SINGLE', reviewStatus: 'PENDING_REVIEW',
  evidenceSpans: [{ quote: '생명력이 낮아진 탐험가는 지상으로 돌아왔다.' }], manualReviewAvailable: true,
};

type DecisionRequest = { batchId: string; candidates: Array<Record<string, unknown>> };
async function setup(page: Page, overrides: Partial<WorldSettingCandidateResponse> = {}, options: { second?: boolean | Partial<WorldSettingCandidateResponse>; failSave?: boolean; searchTargets?: boolean; targetSubjectName?: string; failReadback?: boolean; targetValue?: string; failSaveAfter?: number; targetListState?: 'ready' | 'pending' | 'failed'; paginateTargets?: boolean; pauseReadback?: boolean; userModifiedOnSave?: boolean; differentReadback?: boolean; hideMovedFromOldFilter?: boolean } = {}) {
  let candidates: WorldSettingCandidateResponse[] = [{ ...base, ...overrides }];
  if (options.second) candidates.push({ ...candidates[0], ...(typeof options.second === 'object' ? options.second : {}), id: '55555555-5555-4555-8555-555555555555' });
  let readbackFailure = Boolean(options.failReadback);
  let differentReadback = Boolean(options.differentReadback);
  let readbackPaused = Boolean(options.pauseReadback);
  let resumeReadback: () => void = () => {};
  const readbackReady = new Promise<void>(resolve => { resumeReadback = resolve; });
  let delayNextList = false;
  let delayedListStarted = false;
  let delayedListFinished = false;
  let releaseDelayedList: () => void = () => {};
  const delayedListReady = new Promise<void>(resolve => { releaseDelayedList = resolve; });
  let targetFailure: 'http' | 'incomplete' | null = null;
  let targetListState = options.targetListState ?? 'ready';
  let releaseTargetList: () => void = () => {};
  const targetListReady = new Promise<void>(resolve => { releaseTargetList = resolve; });
  const saved: DecisionRequest[] = [];
  const confirmed: DecisionRequest[] = [];
  const requests: string[] = [];
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    requests.push(`${method} ${path}`);
    if (path.endsWith('/auth/me')) return success(route, member);
    if (path.endsWith('/world-setting-candidates/decisions')) {
      const body = route.request().postDataJSON() as DecisionRequest;
      saved.push(body);
      if (options.failSave || (options.failSaveAfter != null && saved.length > options.failSaveAfter)) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, message: '최신 설정을 확인해 주세요.', error: { status: 409, code: 'CONFLICT' } }) });
      for (const draft of body.candidates) candidates = candidates.map(candidate => candidate.id !== draft.candidateId ? candidate : { ...candidate,
        userModified: options.userModifiedOnSave ?? true, finalOperation: draft.operation, finalCategory: draft.category, finalSubjectName: draft.subjectName,
        finalScopeName: draft.scopeName ?? null, finalSettingName: draft.settingName, finalValue: draft.value, automaticReviewHoldReason: undefined,
      } as WorldSettingCandidateResponse);
      return success(route, { groupKey: `${candidates[0].finalCategory ?? candidates[0].category}|${candidates[0].finalSubjectName ?? candidates[0].targetSubjectName ?? candidates[0].subjectName}` });
    }
    if (path.endsWith('/world-setting-candidates/group-confirm')) {
      confirmed.push(route.request().postDataJSON());
      candidates = candidates.map(candidate => ({ ...candidate, reviewStatus: 'CONFIRMED' }));
      return success(route, { appliedCount: candidates.length, excludedCount: 0, targetCount: 1, subjectName: '별빛 미궁' });
    }
    if (path.includes('/world-setting-candidates/') && method === 'GET') {
      return success(route, candidates.find(candidate => candidate.id === path.split('/').at(-1)));
    }
    if (path.endsWith('/world-setting-candidates')) {
      const delayedSnapshot = delayNextList ? candidates.map(candidate => saved.length && differentReadback
        ? { ...candidate, ...preparedWorldCandidate, finalValue: '다른 요청에서 저장된 내용.' }
        : { ...candidate }) : null;
      if (delayNextList) { delayNextList = false; delayedListStarted = true; await delayedListReady; }
      if (saved.length > 0 && readbackPaused) await readbackReady;
      if (saved.length > 0 && readbackFailure) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: '상태 확인 실패' }) });
      const readback = delayedSnapshot ?? (saved.length && differentReadback ? candidates.map(candidate => ({ ...candidate, ...preparedWorldCandidate, finalValue: '다른 요청에서 저장된 내용.' })) : candidates);
      const pending = readback.filter(candidate => candidate.reviewStatus === 'PENDING_REVIEW');
      const shown = options.hideMovedFromOldFilter && saved.length && url.searchParams.get('operation') === 'REVIEW_REQUIRED' ? [] : url.searchParams.get('reviewStatus') === 'CONFIRMED' ? readback.filter(candidate => candidate.reviewStatus === 'CONFIRMED') : pending;
      await success(route, { batchId, episodeCount: 1, episodeStartNo: 3, episodeEndNo: 3, totalCandidateCount: candidates.length,
        pendingCandidateCount: pending.length, confirmedCandidateCount: candidates.length - pending.length, dismissedCandidateCount: 0,
        directReviewCandidateCount: pending.filter(candidate => !candidate.automaticApplicationPending).length,
        processingCandidateCount: pending.filter(candidate => candidate.automaticApplicationPending || candidate.comparisonStatus === 'PROCESSING').length,
        pendingComparisonCount: 0, processingComparisonCount: 0, failedComparisonCount: 0, recomparisonRequiredCount: 0,
        groups: pageData(shown.length ? [{ groupKey: `${shown[0].finalCategory ?? shown[0].category}|${shown[0].finalSubjectName ?? shown[0].targetSubjectName ?? shown[0].subjectName}`, category: shown[0].finalCategory ?? shown[0].category, subjectName: shown[0].finalSubjectName ?? shown[0].targetSubjectName ?? shown[0].subjectName,
          changeCount: shown.length, status: shown.some(candidate => candidate.comparisonStatus === 'FAILED') ? 'FAILED' : 'READY', candidates: shown,
        }] : []),
      });
      if (delayedSnapshot) delayedListFinished = true;
      return;
    }
    if (path.endsWith('/setting-candidates')) return success(route, { batchId, totalCandidateCount: 0, pendingCandidateCount: 0,
      confirmedCandidateCount: 0, dismissedCandidateCount: 0, directReviewCandidateCount: 0, processingCandidateCount: 0, candidates: pageData([]) });
    if (path.endsWith('/world-settings')) {
      if (targetListState === 'pending') await targetListReady;
      if (targetListState === 'failed') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: '목록 조회 실패' }) });
      const content = options.searchTargets ? [{ id: targetId, category: candidates[0].category, subjectName: options.targetSubjectName ?? '북부 미궁', propertyCount: 1 },
        { id: '66666666-6666-4666-8666-666666666666', category: 'LOCATION', subjectName: '왕도 미궁', propertyCount: 0 }]
        .filter(target => target.subjectName.includes(url.searchParams.get('q') ?? '')) : [];
      const currentPage = Number(url.searchParams.get('page') ?? 0);
      return success(route, { totalWorldSettingCount: options.searchTargets ? 2 : 0,
        worldSettings: options.paginateTargets ? { ...pageData(content.slice(currentPage, currentPage + 1)), page: currentPage,
          totalElements: content.length, totalPages: content.length, hasNext: currentPage + 1 < content.length } : pageData(content) });
    }
    if (path.includes('/world-settings/') && targetFailure === 'http') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ success: false, message: '대상 상세를 읽지 못했습니다.' }) });
    if (path.includes('/world-settings/') && targetFailure === 'incomplete') return success(route, {});
    if (path.includes('/world-settings/')) return success(route, { id: path.split('/').at(-1), workId, category: candidates[0].category, subjectName: path.endsWith(targetId) ? options.targetSubjectName ?? '북부 미궁' : '왕도 미궁', version: 1, properties: options.targetValue ? [{ scopeName: null, settingName: candidates[0].settingName, value: options.targetValue }] : [] });
    return success(route, {});
  });
  await page.goto('/login');
  await page.evaluate(() => { localStorage.setItem('accessToken', 'test-token'); localStorage.removeItem('catchhole_demo_mode'); });
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);
  if ((page.viewportSize()?.width ?? 1280) < 768) await page.locator('.world-candidate-group-card').first().click();
  await expect(page.locator('.world-setting-diff-row').first()).toBeVisible();
  return { saved, confirmed, requests, delayNextList: () => { delayNextList = true; }, delayedListStarted: () => delayedListStarted, delayedListFinished: () => delayedListFinished, releaseDelayedList,
    setTargetFailure: (value: 'http' | 'incomplete' | null) => { targetFailure = value; }, allowReadback: () => { readbackFailure = false; differentReadback = false; readbackPaused = false; resumeReadback(); },
    setTargetListState: (value: typeof targetListState) => { targetListState = value; if (value !== 'pending') releaseTargetList(); } };
}


async function reopenSavedDraft(page: Page) {
  await page.locator('.world-setting-diff-row').first().getByRole('button', { name: '수정', exact: true }).click();
  const editor = page.locator('.review-modal');
  await expect(editor).toBeVisible();
  return editor;
}

async function resaveDraft(page: Page, draft: { operation?: string; subjectName?: string; scopeName?: string; settingName?: string; value?: string }) {
  const editor = await reopenSavedDraft(page);
  if (draft.operation !== undefined) await editor.getByRole('combobox', { name: '반영 방식', exact: true }).selectOption(draft.operation);
  if (draft.subjectName !== undefined) await editor.getByRole('textbox', { name: '대상', exact: true }).fill(draft.subjectName);
  if (draft.scopeName !== undefined) await editor.getByRole('textbox', { name: '범위 (선택)', exact: true }).fill(draft.scopeName);
  if (draft.settingName !== undefined) await editor.getByRole('textbox', { name: '설정명', exact: true }).fill(draft.settingName);
  if (draft.value !== undefined) await editor.getByRole('textbox', { name: '최종 설정값', exact: true }).fill(draft.value);
  await editor.getByRole('button', { name: '수정안 적용', exact: true }).click();
  await expect(editor).toHaveCount(0);
}

for (const operation of ['ADD', 'MERGE', 'UPDATE'] as const) {
  test('대상 연결은 명시 확인 후에만 저장한다: ' + operation, async ({ page }, testInfo) => {
    const incoming = '수로관리청과 별도로 운영되는 기관이다.';
    const before = '중앙 행정의 관리를 받는다.';
    const state = await setup(page, { category: 'FACTION', subjectName: '수로관리청', settingName: '기관 독립성',
      extractedValue: incoming, proposedValue: incoming, comparisonReviewReason: 'SUBJECT_UNRESOLVED', targetWorldSettingId: null,
      targetSubjectName: null, beforeValue: null, matchedScopeName: null, matchedPropertyName: null },
    { searchTargets: true, targetSubjectName: '수로관리청', targetValue: operation === 'ADD' ? undefined : before, pauseReadback: true });
    const row = page.locator('.world-setting-diff-row');
    const target = row.getByRole('button', { name: /수로관리청.*이 대상에 연결/ });
    const confirm = page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ });
    await target.click();
    if (operation !== 'ADD') {
      const choice = row.getByRole('button', { name: operation === 'MERGE' ? /기존 내용과 합치기/ : /이번 내용으로 바꾸기/ });
      await expect(choice).toBeVisible();
      expect(state.saved).toHaveLength(0);
      await choice.click();
      await expect(choice).toHaveAttribute('aria-pressed', 'true');
    }
    const value = operation === 'MERGE' ? before + '\n' + incoming : incoming;
    await expect(row.getByLabel('최종 내용', { exact: true })).toHaveValue(value);
    await expect(target).toHaveAttribute('aria-pressed', 'true');
    await expect(confirm).toBeDisabled();
    expect(state.saved).toHaveLength(0);
    expect(state.confirmed).toHaveLength(0);
    if (operation === 'ADD') {
      const newTarget = row.getByRole('button', { name: /수로관리청.*새로 등록/ });
      await newTarget.click();
      await expect(newTarget).toHaveAttribute('aria-pressed', 'true');
      await expect(target).toHaveAttribute('aria-pressed', 'false');
      await expect(row.getByLabel('최종 내용', { exact: true })).toHaveValue(incoming);
      await expect(confirm).toBeDisabled();
      expect(state.saved).toHaveLength(0);
      await row.getByRole('button', { name: '수정 닫기', exact: true }).click();
      await expect(row.getByLabel('최종 내용', { exact: true })).toHaveCount(0);
      await expect(newTarget).toHaveAttribute('aria-pressed', 'false');
      expect(state.saved).toHaveLength(0);
      await target.click();
      await expect(row.getByLabel('최종 내용', { exact: true })).toHaveValue(incoming);
      for (const width of [1217, 390, 320]) {
        await page.setViewportSize({ width, height: 1100 });
        if (!await row.isVisible()) await page.locator('.world-candidate-group-card').first().click();
        await row.screenshot({ path: testInfo.outputPath('target-explicit-confirm-' + width + '.png') });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
    await row.getByRole('button', { name: '이 내용으로 검토 완료', exact: true }).click();
    await expect.poll(() => state.saved.length).toBe(1);
    expect(state.saved[0].candidates[0]).toMatchObject({ operation, category: 'FACTION', subjectName: '수로관리청',
      scopeName: null, settingName: '기관 독립성', value });
    await expect(row.getByLabel('최종 내용', { exact: true })).toHaveValue(value);
    await expect(row.locator('.review-cb-heading')).not.toContainText('검토 완료');
    state.allowReadback();
    await expect(row.locator('.review-cb-heading')).toContainText('검토 완료');
    await expect(row.locator('.review-cb-decision-panel')).toHaveCount(0);
    expect(state.confirmed).toHaveLength(0);
  });
}

test('대상 연결이 아닌 같은 값 추가 카드는 기존처럼 즉시 저장하고 서버 확인 후 접는다', async ({ page }) => {
  const state = await setup(page, { suggestedOperation: 'ADD', comparisonReviewReason: undefined,
    beforeValue: null, matchedScopeName: null, matchedPropertyName: null }, { pauseReadback: true });
  const row = page.locator('.world-setting-diff-row');
  await row.getByRole('button', { name: /이 내용 그대로 추가/ }).click();
  await expect.poll(() => state.saved.length).toBe(1);
  expect(state.saved[0].candidates[0]).toMatchObject({ operation: 'ADD', value: base.extractedValue });
  await expect(row.getByLabel('최종 내용', { exact: true })).toHaveCount(0);
  await expect(row.locator('.review-cb-heading')).not.toContainText('검토 완료');
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
  state.allowReadback();
  await expect(row.locator('.review-cb-heading')).toContainText('검토 완료');
  await expect(row.locator('.review-cb-decision-panel')).toHaveCount(0);
  expect(state.confirmed).toHaveLength(0);
});

test('범위 미정은 예 한 번으로 기존 내용과 이번 내용을 함께 저장하고 마지막에 그룹 확정한다', async ({ page }) => {
  const { saved, confirmed } = await setup(page);
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
  await page.getByRole('button', { name: /예, 포함된 내용이에요/ }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ operation: 'MERGE', scopeName: '탐사 규칙', settingName: '귀환 조건', value: '해가 지면 돌아온다.\n생명력이 낮으면 돌아온다.' });
  expect(confirmed).toHaveLength(0);
  await expect(page.locator('.review-modal')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeEnabled();
  await expect(page.locator('.world-setting-diff-row')).not.toContainText('범위 확인 필요');
  await page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ }).click();
  await expect.poll(() => confirmed.length).toBe(1);
});

test('별도 설정은 원문 이름과 빈 범위를 유지하고 ADD로 저장한다', async ({ page }) => {
  const { saved } = await setup(page);
  await page.getByRole('button', { name: /아니요, 별도 설정이에요/ }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ operation: 'ADD', scopeName: null, settingName: '위험 기준', value: base.extractedValue });
});

test('같은 비교 결정의 여러 source를 빠른 선택 한 요청에서 저장한다', async ({ page }) => {
  const { saved } = await setup(page, { comparisonDecisionId: 'shared-decision' }, { second: true });
  await page.getByRole('button', { name: /예, 포함된 내용이에요/ }).first().click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates).toHaveLength(2);
  expect(saved[0].candidates.every(candidate => candidate.operation === 'MERGE' && String(candidate.value).includes('해가 지면'))).toBe(true);
});

test('여러 원문을 통합한 설정도 교체는 이번 추출값만 쓰고 합치기는 AI 최종값을 보존한다', async ({ page }) => {
  const extractedValue = '선택 가능한 종족 중 생명력이 가장 높다.\n강력한 육체로 무거운 장비를 착용한다.';
  const beforeValue = '근육질의 우락부락한 체격을 지닌다.';
  const proposedValue = `${beforeValue} 생명력이 가장 높고 강력한 육체로 무거운 장비를 착용한다.`;
  const { saved } = await setup(page, { settingName: '신체 능력', scopeName: '전투 특성',
    comparisonReviewReason: undefined, suggestedOperation: 'MERGE', consolidationStatus: 'MERGED',
    matchedScopeName: '전투 특성', matchedPropertyName: '신체 능력', beforeValue, proposedValue, extractedValue });
  const merge = page.getByRole('button', { name: /기존 내용과 합치기/ });
  const replace = page.getByRole('button', { name: /이번 내용으로 바꾸기/ });
  await expect(merge).toContainText(beforeValue);
  await expect(replace).not.toContainText(beforeValue);
  await expect(replace).toContainText('생명력이 가장 높다.');
  await expect(replace).toContainText('강력한 육체로 무거운 장비를 착용한다.');
  await replace.click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ operation: 'UPDATE', value: extractedValue });
  await page.reload();
  await expect(replace).toHaveCount(0);
  await resaveDraft(page, { operation: 'MERGE', value: proposedValue });
  await expect.poll(() => saved.length).toBe(2);
  expect(saved[1].candidates[0]).toMatchObject({ operation: 'MERGE', value: proposedValue });
  await resaveDraft(page, { operation: 'UPDATE', value: extractedValue });
  await expect.poll(() => saved.length).toBe(3);
  expect(saved[2].candidates[0]).toMatchObject({ operation: 'UPDATE', value: extractedValue });
});

test('공유 통합 결정의 교체는 모든 source 추출값을 함께 보존하고 기존 내용만 제외한다', async ({ page }) => {
  const proposedValue = '해가 지거나 생명력이 낮거나 식량이 부족하면 돌아온다.';
  const { saved } = await setup(page, { comparisonDecisionId: 'shared-consolidation', comparisonReviewReason: undefined,
    consolidationStatus: 'MERGED', suggestedOperation: 'MERGE', proposedValue },
  { second: { extractedValue: '식량이 부족하면 돌아온다.' } });
  const replace = page.getByRole('button', { name: /이번 내용으로 바꾸기/ }).first();
  await expect(replace).toContainText('생명력이 낮으면 돌아온다.');
  await expect(replace).toContainText('식량이 부족하면 돌아온다.');
  await expect(replace).not.toContainText('해가 지');
  await replace.click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates).toHaveLength(2);
  for (const candidate of saved[0].candidates) expect(candidate).toMatchObject({ operation: 'UPDATE', value: '생명력이 낮으면 돌아온다.\n식량이 부족하면 돌아온다.' });
  await page.reload();
  await expect(replace).toHaveCount(0);
  await resaveDraft(page, { operation: 'MERGE', value: proposedValue });
  await expect.poll(() => saved.length).toBe(2);
  for (const candidate of saved[1].candidates) expect(candidate).toMatchObject({ operation: 'MERGE', value: proposedValue });
});

test('명시된 서로 다른 범위는 기존에 합치기와 원문 범위 유지 결과를 제시한다', async ({ page }) => {
  const { saved } = await setup(page, { comparisonReviewReason: 'SCOPE_MISMATCH', scopeName: '응급 조치' });
  await expect(page.getByRole('button', { name: /기존 범위에 합치기/ })).toBeVisible();
  await page.getByRole('button', { name: /이번 범위에 따로 저장/ }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ operation: 'ADD', scopeName: '응급 조치' });
});

test('새 설정은 빈 기존값 비교칸을 만들지 않고 원문 근거를 펼칠 수 있다', async ({ page }) => {
  await setup(page, { suggestedOperation: 'ADD', comparisonReviewReason: undefined, beforeValue: null,
    matchedScopeName: null, matchedPropertyName: null, manualReviewAvailable: false, targetWorldSettingId: null });
  const row = page.locator('.world-setting-diff-row');
  await expect(row).not.toContainText('기존 설정');
  await expect(row).not.toContainText('없음');
  await row.locator('summary').click();
  await expect(row).toContainText('생명력이 낮아진 탐험가는 지상으로 돌아왔다.');
});

test('직접 검토 가능한 비교 실패는 없는 기존값을 단정하지 않고 인라인 초안을 저장한다', async ({ page }) => {
  const { saved, requests } = await setup(page, { comparisonStatus: 'FAILED', comparisonFailureCode: 'LLM_NETWORK_ERROR',
    comparisonReviewReason: undefined, beforeValue: null, matchedScopeName: null, matchedPropertyName: null });
  const row = page.locator('.world-setting-diff-row');
  await expect(row).not.toContainText('기존 설정 없음');
  await expect(row.getByLabel('최종 내용', { exact: true })).toHaveCount(0);
  await row.getByRole('button', { name: /내용·저장 위치 수정/ }).click();
  await row.getByLabel('최종 내용', { exact: true }).fill('안전 기준에 따라 귀환한다.');
  await row.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await expect.poll(() => saved.length).toBe(1);
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeEnabled();
  expect(requests.some(request => request.includes('/retry'))).toBe(false);
});

test('세계관 대상 선택은 실제 저장된 대상을 검색하고 선택한 이름으로만 저장한다', async ({ page }) => {
  const { saved } = await setup(page, { comparisonReviewReason: 'SUBJECT_UNRESOLVED', targetWorldSettingId: null,
    targetSubjectName: null, beforeValue: null, matchedScopeName: null, matchedPropertyName: null }, { searchTargets: true });
  await page.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ }).click();
  await page.getByRole('button', { name: '이 내용으로 검토 완료', exact: true }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ subjectName: '북부 미궁', operation: 'ADD' });
});

test('충돌은 여러 줄 원문 전체를 보존하고 최종 내용을 직접 저장해야 확정할 수 있다', async ({ page }) => {
  const { saved } = await setup(page, { comparisonReviewReason: 'GENERAL_UNCERTAINTY', consolidationStatus: 'CONFLICT',
    beforeValue: null, matchedPropertyName: null, matchedScopeName: null, extractedValue: '매일 열린다.\n한 달에 한 번 열린다.', proposedValue: '매일 열린다.\n한 달에 한 번 열린다.' });
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /추출 내용 [12]/ })).toHaveCount(0);
  await expect(page.getByLabel('최종 내용', { exact: true })).toHaveValue('매일 열린다.\n한 달에 한 번 열린다.');
  await page.getByLabel('최종 내용', { exact: true }).fill('한 달에 한 번 열린다.');
  expect(saved).toHaveLength(0);
  await page.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ value: '한 달에 한 번 열린다.', conflictResolved: true });
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeEnabled();
});

test('저장 충돌 시 인라인 작성값을 보존한다', async ({ page }) => {
  const { saved } = await setup(page, { comparisonReviewReason: 'GENERAL_UNCERTAINTY', beforeValue: null, matchedScopeName: null, matchedPropertyName: null }, { failSave: true });
  await page.getByRole('button', { name: /내용·저장 위치 수정/ }).click();
  await page.getByLabel('최종 내용', { exact: true }).fill('입력을 보존해야 한다.');
  await page.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await expect.poll(() => saved.length).toBe(1);
  await expect(page.getByLabel('최종 내용', { exact: true })).toHaveValue('입력을 보존해야 한다.');
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
});

test('분석 중에는 간단한 안내와 기존 분석 화면 이동만 제공한다', async ({ page }) => {
  const { saved } = await setup(page, { analysisMode: 'ORDERED_PROVISIONAL', automaticApplicationPending: true });
  await expect(page.getByRole('button', { name: '분석 진행 보기' })).toBeVisible();
  await expect(page.getByRole('button', { name: /예, 포함된 내용이에요/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
  await expect(page.locator('.world-setting-diff-row').getByRole('button', { name: /제외/ })).toBeDisabled();
  expect(saved).toHaveLength(0);
});


test('저장 실패 뒤 최신 상태도 확인할 수 없으면 재저장을 잠그고 입력을 보존한다', async ({ page }) => {
  const { saved, allowReadback } = await setup(page, { comparisonReviewReason: 'GENERAL_UNCERTAINTY', beforeValue: null,
    matchedScopeName: null, matchedPropertyName: null }, { failSave: true, failReadback: true });
  await page.getByRole('button', { name: /내용·저장 위치 수정/ }).click();
  await page.getByLabel('최종 내용', { exact: true }).fill('확인 전까지 보존할 내용');
  await page.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await expect(page.getByRole('button', { name: '최신 상태 다시 확인' })).toBeVisible();
  await expect(page.getByRole('button', { name: '이 내용으로 검토 완료' })).toBeDisabled();
  await expect(page.getByLabel('최종 내용', { exact: true })).toHaveValue('확인 전까지 보존할 내용');
  expect(saved).toHaveLength(1);
  allowReadback();
  await page.getByRole('button', { name: '최신 상태 다시 확인' }).click();
  await expect(page.getByRole('button', { name: '이 내용으로 검토 완료' })).toBeEnabled();
  expect(saved).toHaveLength(1);
});

test('세계관 선택 카드와 diff는 320px에서 잘리지 않고 조작할 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await setup(page);
  const yes = page.getByRole('button', { name: /예, 포함된 내용이에요/ });
  await expect(yes).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await yes.click();
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});


test('대상 동일성 보류는 ADD 제안이어도 새 설정으로 단정하거나 바로 확정하지 않는다', async ({ page }) => {
  const { saved } = await setup(page, { suggestedOperation: 'ADD', comparisonReviewReason: undefined,
    automaticReviewHoldReason: 'SUBJECT_CONFIRMATION_REQUIRED', manualReviewAvailable: true,
    beforeValue: null, matchedScopeName: null, matchedPropertyName: null }, { searchTargets: true });
  const row = page.locator('.world-setting-diff-row');
  await expect(row.locator('.review-cb-heading')).toContainText('같은 대상인지 확인');
  await expect(row.locator('.review-cb-heading')).not.toContainText('새 설정');
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
  await page.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ }).click();
  await page.getByRole('button', { name: '이 내용으로 검토 완료', exact: true }).click();
  await expect.poll(() => saved.length).toBe(1);
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeEnabled();
});


test('저장 후에는 완료 요약으로 접고 새로고침 뒤 수정에서 별도 저장과 병합을 다시 정한다', async ({ page }, testInfo) => {
  const { saved, confirmed } = await setup(page);
  await page.getByRole('button', { name: /예, 포함된 내용이에요/ }).click();
  await expect(page.locator('.world-setting-diff-row .review-cb-heading')).toContainText('검토 완료');
  await expect(page.locator('.review-cb-decision-panel')).toHaveCount(0);
  await page.reload();
  const editor = await reopenSavedDraft(page);
  await expect(editor.getByRole('textbox', { name: '최종 설정값', exact: true })).toHaveValue('해가 지면 돌아온다.\n생명력이 낮으면 돌아온다.');
  await editor.getByRole('combobox', { name: '반영 방식', exact: true }).selectOption('ADD');
  await editor.getByRole('textbox', { name: '범위 (선택)', exact: true }).fill('');
  await editor.getByRole('textbox', { name: '설정명', exact: true }).fill('위험 기준');
  await editor.getByRole('textbox', { name: '최종 설정값', exact: true }).fill(base.extractedValue!);
  await editor.getByRole('button', { name: '수정안 적용', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect.poll(() => saved.length).toBe(2);
  expect(saved[1].candidates[0]).toMatchObject({ operation: 'ADD', settingName: '위험 기준', value: base.extractedValue });
  expect(saved[1].candidates[0].scopeName ?? null).toBeNull();
  await resaveDraft(page, { operation: 'MERGE', scopeName: '탐사 규칙', settingName: '귀환 조건', value: '해가 지면 돌아온다.\n생명력이 낮으면 돌아온다.' });
  await expect.poll(() => saved.length).toBe(3);
  expect(saved[2].candidates[0]).toMatchObject({ operation: 'MERGE', scopeName: '탐사 규칙', settingName: '귀환 조건', value: '해가 지면 돌아온다.\n생명력이 낮으면 돌아온다.' });
  expect(confirmed).toHaveLength(0);
  await page.setViewportSize({ width: 1440, height: 1600 });
  await page.locator('.world-setting-diff-row').scrollIntoViewIfNeeded();
  await page.locator('.world-setting-diff-row').screenshot({ path: testInfo.outputPath('world-reselect-before-confirm.png') });
});

test('여러 원문을 함께 저장한 선택을 바꿀 때도 전체 source를 원자적으로 다시 저장한다', async ({ page }) => {
  const { saved } = await setup(page, { comparisonDecisionId: 'shared-decision' }, { second: true });
  await page.getByRole('button', { name: /예, 포함된 내용이에요/ }).first().click();
  await expect(page.locator('.review-cb-decision-panel')).toHaveCount(0);
  await resaveDraft(page, { operation: 'ADD', scopeName: '', settingName: '위험 기준', value: base.extractedValue! });
  await expect.poll(() => saved.length).toBe(2);
  expect(saved[1].candidates).toHaveLength(2);
  expect(saved[1].candidates.every(candidate => candidate.operation === 'ADD' && candidate.value === base.extractedValue)).toBe(true);
});

test('자동 보류 사유가 초안 저장 후 지워져도 다른 실제 대상에 다시 연결할 수 있다', async ({ page }) => {
  const { saved } = await setup(page, { suggestedOperation: 'ADD', comparisonReviewReason: undefined,
    automaticReviewHoldReason: 'SUBJECT_CONFIRMATION_REQUIRED', beforeValue: null, matchedPropertyName: null, matchedScopeName: null }, { searchTargets: true });
  await page.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ }).click();
  await page.getByRole('button', { name: '이 내용으로 검토 완료', exact: true }).click();
  await expect(page.locator('.review-cb-decision-panel')).toHaveCount(0);
  await resaveDraft(page, { subjectName: '왕도 미궁' });
  await expect.poll(() => saved.length).toBe(2);
  expect(saved[1].candidates[0]).toMatchObject({ subjectName: '왕도 미궁', operation: 'ADD', value: base.extractedValue });
  await page.reload();
  const editor = await reopenSavedDraft(page);
  await expect(editor.getByRole('textbox', { name: '대상', exact: true })).toHaveValue('왕도 미궁');
  await editor.getByRole('textbox', { name: '대상', exact: true }).fill('북부 미궁');
  await editor.getByRole('button', { name: '수정안 적용', exact: true }).click();
  await expect.poll(() => saved.length).toBe(3);
  expect(saved[2].candidates[0]).toMatchObject({ subjectName: '북부 미궁' });
});

test('상위종 비교 실패는 수동 확인 선택으로만 초안을 준비하고 원본 실패와 원문을 유지한다', async ({ page }, testInfo) => {
  const { saved, confirmed } = await setup(page, { category: 'MONSTER', subjectName: '상위종', targetSubjectName: '상위종', settingName: '분류 기준',
    comparisonStatus: 'FAILED', comparisonFailureCode: 'COMPARISON_VALIDATION_FAILED', comparisonReviewReason: undefined,
    beforeValue: null, matchedScopeName: null, matchedPropertyName: null, extractedValue: '상위종은 높은 지능을 가진다.', proposedValue: null });
  const row = page.locator('.world-setting-diff-row');
  await expect(row).toContainText('자동 비교를 마치지 못했어요');
  await expect(row.getByLabel('반영할 대상', { exact: true })).toHaveCount(0);
  await expect(row).not.toContainText('기존 설정 없음');
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
  await row.screenshot({ path: testInfo.outputPath('world-comparison-failure-choices.png') });
  await row.getByRole('button', { name: /이 내용 그대로 추가/ }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ operation: 'ADD', subjectName: '상위종', settingName: '분류 기준', value: '상위종은 높은 지능을 가진다.' });
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeEnabled();
  const editor = await reopenSavedDraft(page);
  await expect(editor.getByRole('textbox', { name: '대상', exact: true })).toHaveValue('상위종');
  expect(confirmed).toHaveLength(0);
});


test('연결한 대상의 병합·교체 선택은 저장 뒤에도 실제 대상의 기존값을 유지하고 원래 대상으로 돌아가지 않는다', async ({ page }) => {
  const { saved } = await setup(page, { comparisonReviewReason: 'SUBJECT_UNRESOLVED', targetSubjectName: null,
    beforeValue: '다른 장소의 오래된 내용.', matchedScopeName: null, matchedPropertyName: '위험 기준' }, { searchTargets: true, targetValue: '북부 미궁은 일몰에 문을 닫는다.' });
  const row = page.locator('.world-setting-diff-row');
  await expect(row).not.toContainText('다른 장소의 오래된 내용.');
  await row.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ }).click();
  await row.getByRole('button', { name: /기존 내용과 합치기/ }).click();
  await page.getByRole('button', { name: '이 내용으로 검토 완료', exact: true }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ subjectName: '북부 미궁', operation: 'MERGE', value: '북부 미궁은 일몰에 문을 닫는다.\n생명력이 낮으면 돌아온다.' });
  await expect(row.locator('.review-cb-decision-panel')).toHaveCount(0);
  await resaveDraft(page, { operation: 'UPDATE', value: base.extractedValue! });
  await expect.poll(() => saved.length).toBe(2);
  expect(saved[1].candidates[0]).toMatchObject({ subjectName: '북부 미궁', operation: 'UPDATE', value: base.extractedValue });
  await expect(row.locator('.review-cb-decision-panel')).toHaveCount(0);
  await page.reload();
  const editor = await reopenSavedDraft(page);
  await expect(editor.getByRole('textbox', { name: '대상', exact: true })).toHaveValue('북부 미궁');
  await expect(editor.getByRole('textbox', { name: '최종 설정값', exact: true })).toHaveValue(base.extractedValue!);
  await editor.getByRole('combobox', { name: '반영 방식', exact: true }).selectOption('MERGE');
  await editor.getByRole('textbox', { name: '최종 설정값', exact: true }).fill('북부 미궁은 일몰에 문을 닫는다.\n생명력이 낮으면 돌아온다.');
  await editor.getByRole('button', { name: '수정안 적용', exact: true }).click();
  await expect.poll(() => saved.length).toBe(3);
  expect(saved[2].candidates[0]).toMatchObject({ subjectName: '북부 미궁', operation: 'MERGE', value: '북부 미궁은 일몰에 문을 닫는다.\n생명력이 낮으면 돌아온다.' });
  await expect(row).not.toContainText('다른 장소의 오래된 내용.');
});

test('일반 범위 초안은 원래 범위의 선택만 유지하고 불필요한 대상 연결을 추가하지 않는다', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /예, 포함된 내용이에요/ }).click();
  await expect(page.locator('.review-cb-decision-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다른 대상에 연결', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('기존 세계관 대상 검색', { exact: true })).toHaveCount(0);
  const editor = await reopenSavedDraft(page);
  await expect(editor.getByRole('textbox', { name: '범위 (선택)', exact: true })).toHaveValue('탐사 규칙');
});


test('수동 복구 초안이 준비되면 실패 그룹의 상단과 목록도 확정 대기로 안내한다', async ({ page }) => {
  await setup(page, { comparisonStatus: 'FAILED', comparisonFailureCode: 'LLM_NETWORK_ERROR', comparisonReviewReason: undefined,
    beforeValue: null, matchedScopeName: null, matchedPropertyName: null });
  await page.getByRole('button', { name: /이 내용 그대로 추가/ }).click();
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeEnabled();
  await expect(page.locator('.world-candidate-group-card')).toContainText('확정 준비됨');
  await expect(page.locator('.world-candidate-group-card')).toContainText('확정 대기 1개');
  await expect(page.locator('.world-candidate-detail-card')).toContainText('확정할 내용이 준비됐어요');
  await expect(page.locator('.world-candidate-detail-card')).not.toContainText('직접 반영할 내용을 저장한 뒤');
  await expect(page.locator('.world-candidate-detail-card')).not.toContainText('자동 비교를 마치지 못해 대상과 내용을 확인');
});

test('저장한 초안을 다시 편집하면 모두 확정을 잠그고 취소 또는 재저장 뒤에만 연다', async ({ page }) => {
  const { saved, confirmed } = await setup(page);
  const confirm = page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ });
  await page.getByRole('button', { name: /예, 포함된 내용이에요/ }).click();
  await expect(confirm).toBeEnabled();
  let editor = await reopenSavedDraft(page);
  await editor.getByRole('textbox', { name: '최종 설정값', exact: true }).fill('아직 저장하지 않은 문장');
  await expect(confirm).toBeDisabled();
  await expect(editor).toBeVisible();
  expect(confirmed).toHaveLength(0);
  expect(saved).toHaveLength(1);
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await expect(confirm).toBeEnabled();
  editor = await reopenSavedDraft(page);
  await expect(editor.getByRole('textbox', { name: '최종 설정값', exact: true })).toHaveValue('해가 지면 돌아온다.\n생명력이 낮으면 돌아온다.');
  await editor.getByRole('textbox', { name: '최종 설정값', exact: true }).fill('새롭게 저장할 최종 문장');
  await expect(confirm).toBeDisabled();
  await editor.getByRole('button', { name: '수정안 적용', exact: true }).click();
  await expect.poll(() => saved.length).toBe(2);
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect.poll(() => confirmed.length).toBe(1);
  expect(confirmed[0].candidates[0]).toMatchObject({ value: '새롭게 저장할 최종 문장' });
});

test('기존 저장안이 있어도 재저장 실패 후 미저장 입력을 확정하지 못한다', async ({ page }) => {
  const { saved, confirmed } = await setup(page, {}, { failSaveAfter: 1 });
  const confirm = page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ });
  await page.getByRole('button', { name: /예, 포함된 내용이에요/ }).click();
  await expect(confirm).toBeEnabled();
  const editor = await reopenSavedDraft(page);
  await editor.getByRole('textbox', { name: '최종 설정값', exact: true }).fill('저장에 실패한 수정');
  await editor.getByRole('button', { name: '수정안 적용', exact: true }).click();
  await expect.poll(() => saved.length).toBe(2);
  await expect(editor.getByRole('textbox', { name: '최종 설정값', exact: true })).toHaveValue('저장에 실패한 수정');
  await expect(confirm).toBeDisabled();
  expect(confirmed).toHaveLength(0);
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await expect(confirm).toBeEnabled();
});

for (const failure of ['http', 'incomplete'] as const) {
  test(`대상 상세 ${failure} 실패에도 선택을 보존하고 조회 재시도 후에만 저장한다`, async ({ page }) => {
    const state = await setup(page, { comparisonReviewReason: 'SUBJECT_UNRESOLVED', beforeValue: null }, { searchTargets: true });
    state.setTargetFailure(failure);
    const target = page.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ });
    await target.click();
    const retry = page.getByRole('button', { name: '선택한 대상 다시 불러오기' });
    await expect(retry).toBeVisible();
    await expect(target).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
    expect(state.saved).toHaveLength(0);
    if (failure === 'http') {
      await page.getByLabel('기존 세계관 대상 검색', { exact: true }).fill('왕도');
      await expect(target).toHaveCount(0);
    }
    state.setTargetFailure(null);
    await retry.click();
    await page.getByRole('button', { name: '이 내용으로 검토 완료', exact: true }).click();
    await expect.poll(() => state.saved.length).toBe(1);
    expect(state.saved[0].candidates[0]).toMatchObject({ subjectName: '북부 미궁', operation: 'ADD' });
    await expect(retry).toHaveCount(0);
  });
}

test('저장된 대상을 수정하다 재저장이 실패하면 이전 초안을 잘못 확정하지 않는다', async ({ page }) => {
  const state = await setup(page, unresolvedTarget, { searchTargets: true, failSaveAfter: 1 });
  await page.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ }).click();
  await page.getByRole('button', { name: '이 내용으로 검토 완료', exact: true }).click();
  await expect.poll(() => state.saved.length).toBe(1);
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeEnabled();
  const editor = await reopenSavedDraft(page);
  await expect(editor.getByRole('textbox', { name: '대상', exact: true })).toHaveValue('북부 미궁');
  await editor.getByRole('textbox', { name: '대상', exact: true }).fill('왕도 미궁');
  await editor.getByRole('button', { name: '수정안 적용', exact: true }).click();
  await expect.poll(() => state.saved.length).toBe(2);
  expect(state.saved[1].candidates[0]).toMatchObject({ subjectName: '왕도 미궁', value: base.extractedValue });
  await expect(editor.getByRole('textbox', { name: '대상', exact: true })).toHaveValue('왕도 미궁');
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
  expect(state.confirmed).toHaveLength(0);
});

test('세계관 제외 배지는 밝은 테마 중립색과 읽을 수 있는 대비를 사용한다', async ({ page }) => {
  await setup(page, { suggestedOperation: 'EXCLUDE', comparisonReviewReason: undefined, manualReviewAvailable: false });
  const badge = page.locator('.world-setting-diff-row .review-badge').first();
  await expect(badge).toHaveText('중복·반영 안 함');
  await expect(badge).toHaveCSS('color', 'rgb(51, 58, 70)');
  await expect(badge).toHaveCSS('background-color', 'rgb(245, 247, 251)');
  await expect(badge).toHaveCSS('border-top-color', 'rgb(207, 214, 226)');
  const contrast = await badge.evaluate(node => {
    const style = getComputedStyle(node);
    const luminance = (rgb: string) => rgb.match(/\d+/g)!.slice(0, 3).map(Number).map(n => n / 255)
      .map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
      .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
    return (luminance(style.backgroundColor) + 0.05) / (luminance(style.color) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

const unresolvedTarget = { comparisonReviewReason: 'SUBJECT_UNRESOLVED', targetWorldSettingId: null,
  targetSubjectName: null, beforeValue: null, matchedScopeName: null, matchedPropertyName: null } as const;

for (const { width, zoom } of [{ width: 1217, zoom: 1 }, { width: 390, zoom: 1 }, { width: 320, zoom: 1 }, { width: 640, zoom: 2 }]) {
  test(`대상 연결 화면은 이름·분류를 설명하고 단일 선택도 전체 폭을 쓴다 ${width}px ${zoom}x`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page, { ...unresolvedTarget, category: 'FACTION', subjectName: '등대관리소', settingName: '기관 독립성',
      extractedValue: '중앙 행정과 독립적으로 운영된다.' });
    if (zoom === 2) await page.addStyleTag({ content: 'html { zoom: 2; }' });
    const panel = page.locator('.review-cb-target-search');
    await expect(panel).toBeVisible();
    await panel.screenshot({ path: testInfo.outputPath(`target-link-${width}-${zoom}x.png`) });
    const geometry = await panel.evaluate(node => {
      const bounds = node.getBoundingClientRect();
      const card = node.querySelector('.review-cb-choice')!.getBoundingClientRect();
      const input = node.querySelector('input')!.getBoundingClientRect();
      return { panelWidth: bounds.width, cardWidth: card.width, inputWidth: input.width,
        overflow: node.scrollWidth > node.clientWidth, pageOverflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    await testInfo.attach('target-geometry', { body: JSON.stringify(geometry), contentType: 'application/json' });
    expect(geometry.cardWidth).toBeGreaterThanOrEqual(geometry.panelWidth - 2);
    expect(geometry.inputWidth).toBeGreaterThanOrEqual(geometry.panelWidth - 2);
    expect(geometry.overflow).toBe(false);
    expect(geometry.pageOverflow).toBe(false);
    await expect(panel.getByRole('heading', { name: '‘등대관리소’ — 기존 세력에 연결할까요, 새로 등록할까요?' })).toBeVisible();
    await expect(panel).toContainText('추출된 이름');
    await expect(panel.getByRole('button', { name: /등대관리소.*새로 등록/ })).toBeVisible();
  });
}

test('대상 연결 조회 중·빈 검색·실패를 구분하고 재시도해도 자동 저장하지 않는다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const state = await setup(page, unresolvedTarget, { searchTargets: true, targetListState: 'pending' });
  const panel = page.locator('.review-cb-target-search');
  await expect(panel).toContainText('기존 장소 목록을 불러오고 있어요.');
  await expect(panel).not.toContainText('검색 결과가 없어요.');
  await expect(panel).not.toContainText('등록된 장소 항목이 없어요.');
  state.setTargetListState('ready');
  await expect(panel.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ })).toBeVisible();
  await panel.getByLabel('기존 세계관 대상 검색', { exact: true }).fill('없는 이름');
  await expect(panel).toContainText('‘없는 이름’ 검색 결과가 없어요.');
  state.setTargetListState('failed');
  await panel.getByLabel('기존 세계관 대상 검색', { exact: true }).fill('실패 검색');
  await expect(panel).toContainText('기존 장소 목록을 불러오지 못했어요.');
  await expect(panel).not.toContainText('검색 결과가 없어요.');
  await panel.screenshot({ path: testInfo.outputPath('target-list-failure-320.png') });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  state.setTargetListState('ready');
  await panel.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(panel).toContainText('‘실패 검색’ 검색 결과가 없어요.');
  expect(state.saved).toHaveLength(0);
  expect(state.confirmed).toHaveLength(0);
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
});

test('새 대상 선택은 편집·초안 저장 후에만 별도로 모두 확정한다', async ({ page }) => {
  const { saved, confirmed } = await setup(page, unresolvedTarget);
  const panel = page.locator('.review-cb-target-search');
  await expect(panel.getByRole('heading', { name: '‘별빛 미궁’ — 기존 장소에 연결할까요, 새로 등록할까요?' })).toBeVisible();
  await expect(panel).toContainText('등록된 장소 항목이 없어요.');
  const newTarget = panel.getByRole('button', { name: /별빛 미궁.*새로 등록/ });
  await newTarget.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('반영할 대상', { exact: true })).toHaveValue('별빛 미궁');
  expect(saved).toHaveLength(0);
  await page.getByLabel('반영할 대상', { exact: true }).fill('새 별빛 미궁');
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
  await page.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ operation: 'ADD', subjectName: '새 별빛 미궁', value: base.extractedValue });
  expect(confirmed).toHaveLength(0);
  await page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ }).click();
  await expect.poll(() => confirmed.length).toBe(1);
});

test('대상 연결 목록은 페이지와 검색어를 바꿔도 선택 전에는 저장하지 않는다', async ({ page }) => {
  const { saved } = await setup(page, unresolvedTarget, { searchTargets: true, paginateTargets: true });
  const panel = page.locator('.review-cb-target-search');
  const north = panel.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ });
  const royal = panel.getByRole('button', { name: /왕도 미궁.*이 대상에 연결/ });
  await expect(north).toBeVisible();
  await panel.getByRole('button', { name: '다음 대상', exact: true }).click();
  await expect(royal).toBeVisible();
  await expect(north).toHaveCount(0);
  await panel.getByLabel('기존 세계관 대상 검색', { exact: true }).fill('북부');
  await expect(north).toBeVisible();
  await expect(royal).toHaveCount(0);
  expect(saved).toHaveLength(0);
  await north.click();
  await page.getByRole('button', { name: '이 내용으로 검토 완료', exact: true }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ operation: 'ADD', subjectName: '북부 미궁' });
});

for (const sourceKind of ['EPISODE', 'SETTING_BOOK'] as const) {
  test(`대상 연결 질문은 원고·설정집 공통 경로에서 분류명을 유지한다 ${sourceKind}`, async ({ page }) => {
    await setup(page, { ...unresolvedTarget, category: 'POWER_SYSTEM', subjectName: '별빛 마법',
      source: sourceKind === 'SETTING_BOOK' ? { sourceKind, settingBookName: '마법 설정집', revisionNo: 1 } : { sourceKind, episodeNo: 3 } });
    const panel = page.locator('.review-cb-target-search');
    await expect(panel.getByRole('heading', { name: '‘별빛 마법’ — 기존 마법·능력 체계에 연결할까요, 새로 등록할까요?' })).toBeVisible();
    await expect(panel.locator('label')).toHaveText('기존 마법·능력 체계 검색');
    await expect(panel).not.toContainText('기존 기관');
    await expect(panel.getByRole('button', { name: /별빛 마법.*새로 등록/ })).toHaveAttribute('aria-pressed', 'false');
  });
}

test('초안 저장은 서버 확인 뒤 새로고침 없이 완료 요약으로 접고 수정에서 최종값을 다시 연다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1217, height: 1000 });
  const state = await setup(page, unresolvedTarget, { pauseReadback: true });
  const row = page.locator('.world-setting-diff-row');
  await row.getByRole('button', { name: /별빛 미궁.*새로 등록/ }).click();
  await row.getByLabel('최종 내용', { exact: true }).fill('작가가 확인한 최종 내용.');
  await row.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await expect.poll(() => state.saved.length).toBe(1);
  await expect(row.getByLabel('최종 내용', { exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: '이 내용으로 검토 완료' })).toBeDisabled();
  await expect(row.locator('.review-cb-heading')).not.toContainText('검토 완료');
  state.allowReadback();
  await expect(row.locator('.review-cb-heading')).toContainText('검토 완료');
  for (const width of [1217, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    if (!await row.isVisible()) await page.locator('.world-candidate-group-card').first().click();
    await row.screenshot({ path: testInfo.outputPath(`saved-world-summary-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await expect(row.locator('form.review-cb-inline-editor')).toHaveCount(0);
  await expect(row.locator('.review-cb-decision-panel')).toHaveCount(0);
  await expect(row).toContainText('작가가 확인한 최종 내용.');
  expect(state.confirmed).toHaveLength(0);
  await row.getByRole('button', { name: '수정', exact: true }).click();
  await expect(page.locator('.review-modal').getByRole('textbox', { name: '최종 설정값', exact: true })).toHaveValue('작가가 확인한 최종 내용.');
  await expect(page.locator('.review-modal').getByRole('textbox', { name: '대상', exact: true })).toHaveValue('별빛 미궁');
});

const preparedWorldCandidate: Partial<WorldSettingCandidateResponse> = { ...unresolvedTarget, userModified: true,
  finalOperation: 'ADD', finalCategory: 'LOCATION', finalSubjectName: '별빛 미궁', finalScopeName: null,
  finalSettingName: '위험 기준', finalValue: base.extractedValue };

test('같은 값 재저장도 목록 확인 전에는 편집을 유지하고 확인 후 완료 요약으로 닫는다', async ({ page }) => {
  const state = await setup(page, preparedWorldCandidate, { pauseReadback: true });
  const row = page.locator('.world-setting-diff-row');
  await row.getByRole('button', { name: '수정', exact: true }).click();
  const editor = page.locator('.review-modal');
  await expect(editor.getByRole('textbox', { name: '최종 설정값', exact: true })).toHaveValue(base.extractedValue!);
  await editor.getByRole('button', { name: '수정안 적용', exact: true }).click();
  await expect.poll(() => state.saved.length).toBe(1);
  await expect(editor).toBeVisible();
  state.allowReadback();
  await expect(editor).toHaveCount(0);
  await expect(row.locator('.review-cb-decision-panel')).toHaveCount(0);
  await expect(row.locator('.review-cb-heading')).toContainText('검토 완료');
  expect(state.confirmed).toHaveLength(0);
});

test('저장 응답만 있고 목록 확인이 실패하면 기존 초안 편집을 보존하고 확정을 잠근다', async ({ page }) => {
  const state = await setup(page, preparedWorldCandidate, { failReadback: true });
  const row = page.locator('.world-setting-diff-row');
  await row.getByRole('button', { name: '수정', exact: true }).click();
  const editor = page.locator('.review-modal');
  await editor.getByRole('textbox', { name: '최종 설정값', exact: true }).fill('목록 확인 전에는 보존할 수정.');
  await editor.getByRole('button', { name: '수정안 적용', exact: true }).click();
  await expect.poll(() => state.saved.length).toBe(1);
  await expect(editor.getByRole('textbox', { name: '최종 설정값', exact: true })).toHaveValue('목록 확인 전에는 보존할 수정.');
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
  expect(state.confirmed).toHaveLength(0);
  await expect(editor.getByRole('button', { name: '최신 상태 다시 확인', exact: true })).toBeEnabled();
  state.allowReadback();
  await editor.getByRole('button', { name: '최신 상태 다시 확인', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(row.locator('.review-cb-decision-panel')).toHaveCount(0);
  await expect(row).toContainText('목록 확인 전에는 보존할 수정.');
  expect(state.saved).toHaveLength(1);
});


test('제안과 같은 내용을 수동 저장해 userModified가 false여도 완료로 접고 새로고침 후에도 유지한다', async ({ page }) => {
  const state = await setup(page, { ...unresolvedTarget, suggestedOperation: 'ADD', comparisonReviewReason: undefined,
    automaticReviewHoldReason: 'SUBJECT_CONFIRMATION_REQUIRED' }, { userModifiedOnSave: false });
  const row = page.locator('.world-setting-diff-row');
  await expect(row.locator('.review-cb-heading')).not.toContainText('검토 완료');
  await row.getByRole('button', { name: /별빛 미궁.*새로 등록/ }).click();
  await row.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await expect.poll(() => state.saved.length).toBe(1);
  await expect(row.locator('.review-cb-heading')).toContainText('검토 완료');
  await expect(row.locator('.review-cb-decision-panel')).toHaveCount(0);
  await expect(page.locator('.world-candidate-group-card')).toContainText('확정 준비됨');
  expect(state.confirmed).toHaveLength(0);
  await page.reload();
  // 저장된 결정은 다시 열면 한 줄 요약으로 접히고, 펼치면 검토 완료 상태를 그대로 본다.
  await expect(row).toContainText('저장했어요');
  await expect(row.locator('.review-cb-decision-panel')).toHaveCount(0);
  await row.getByRole('button', { name: '펼치기', exact: true }).click();
  await expect(row.locator('.review-cb-heading')).toContainText('검토 완료');
  await expect(row.locator('.review-cb-decision-panel')).toHaveCount(0);
});


test('저장 뒤 다른 최종값을 조회하면 인라인 입력을 유지하고 일치하는 상태를 확인한 후에만 접는다', async ({ page }) => {
  const state = await setup(page, unresolvedTarget, { differentReadback: true });
  const row = page.locator('.world-setting-diff-row');
  await row.getByRole('button', { name: /별빛 미궁.*새로 등록/ }).click();
  await row.getByLabel('최종 내용', { exact: true }).fill('이번 요청에서 작성한 내용.');
  await row.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await expect.poll(() => state.saved.length).toBe(1);
  await expect(page.getByRole('button', { name: '최신 상태 다시 확인', exact: true })).toBeVisible();
  await expect(row.getByLabel('최종 내용', { exact: true })).toHaveValue('이번 요청에서 작성한 내용.');
  await expect(row.locator('.review-cb-heading')).not.toContainText('검토 완료');
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
  state.allowReadback();
  await page.getByRole('button', { name: '최신 상태 다시 확인', exact: true }).click();
  await expect(row.locator('.review-cb-heading')).toContainText('검토 완료');
  await expect(row.locator('.review-cb-decision-panel')).toHaveCount(0);
  expect(state.confirmed).toHaveLength(0);
});

test('저장 거절 뒤 다른 최종값을 조회해도 입력을 교체하지 않고 저장 재시도를 허용한다', async ({ page }) => {
  const state = await setup(page, unresolvedTarget, { failSave: true, differentReadback: true });
  const row = page.locator('.world-setting-diff-row');
  await row.getByRole('button', { name: /별빛 미궁.*새로 등록/ }).click();
  await row.getByLabel('최종 내용', { exact: true }).fill('실패해도 보존할 내용.');
  await row.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await expect.poll(() => state.saved.length).toBe(1);
  await expect(row.getByLabel('최종 내용', { exact: true })).toHaveValue('실패해도 보존할 내용.');
  await expect(row.getByRole('button', { name: '이 내용으로 검토 완료' })).toBeEnabled();
  await expect(row.locator('.review-cb-heading')).not.toContainText('검토 완료');
  expect(state.confirmed).toHaveLength(0);
});

test('최신 상태 재확인 중에는 중복 조회를 막고 불일치 뒤에도 입력과 재시도를 보존한다', async ({ page }) => {
  const state = await setup(page, unresolvedTarget, { differentReadback: true });
  const row = page.locator('.world-setting-diff-row');
  await row.getByRole('button', { name: /별빛 미궁.*새로 등록/ }).click();
  await row.getByLabel('최종 내용', { exact: true }).fill('재확인 중에도 보존할 내용.');
  await row.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  const recover = page.getByRole('button', { name: '최신 상태 다시 확인', exact: true });
  await expect(recover).toBeEnabled();
  const listRequestCount = () => state.requests.filter(request => request === `GET /api/v1/works/${workId}/world-setting-candidates`).length;
  const beforeRetry = listRequestCount();
  state.delayNextList();
  await recover.click();
  await expect.poll(state.delayedListStarted).toBe(true);
  state.allowReadback();
  await recover.evaluate(button => (button as HTMLButtonElement).click());
  await expect.poll(listRequestCount).toBe(beforeRetry + 1);
  await expect(recover).toBeDisabled();
  state.releaseDelayedList();
  await expect.poll(state.delayedListFinished).toBe(true);
  await expect(recover).toBeEnabled();
  await expect(row.getByLabel('최종 내용', { exact: true })).toHaveValue('재확인 중에도 보존할 내용.');
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeDisabled();
  await recover.click();
  await expect(row.locator('.review-cb-heading')).toContainText('검토 완료');
  await expect(row.locator('.review-cb-decision-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(모두 확정|확정하고 다음)$/ })).toBeEnabled();
  expect(state.saved).toHaveLength(1);
  expect(state.confirmed).toHaveLength(0);
});


test('이전 목록 요청이 늦게 돌아와도 확인한 저장 초안과 완료 요약을 되돌리지 않는다', async ({ page }) => {
  const state = await setup(page, unresolvedTarget, { second: { comparisonStatus: 'PROCESSING', automaticApplicationPending: false, manualReviewAvailable: false } });
  const row = page.locator('.world-setting-diff-row').first();
  await row.getByRole('button', { name: /별빛 미궁.*새로 등록/ }).click();
  await row.getByLabel('최종 내용', { exact: true }).fill('늦은 목록보다 최신인 저장 내용.');
  state.delayNextList();
  await expect.poll(state.delayedListStarted).toBe(true);
  await row.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await expect(row.locator('.review-cb-heading')).toContainText('검토 완료');
  state.releaseDelayedList();
  await expect.poll(state.delayedListFinished).toBe(true);
  await expect(row).toContainText('늦은 목록보다 최신인 저장 내용.');
  await expect(row.locator('.review-cb-decision-panel')).toHaveCount(0);
  const editor = await reopenSavedDraft(page);
  await expect(editor.getByRole('textbox', { name: '최종 설정값', exact: true })).toHaveValue('늦은 목록보다 최신인 저장 내용.');
  expect(state.confirmed).toHaveLength(0);
});

test('저장으로 기존 반영방식 필터에서 빠진 초안도 같은 출처의 단건 조회로 확인한다', async ({ page }) => {
  const state = await setup(page, unresolvedTarget, { hideMovedFromOldFilter: true });
  await page.getByRole('button', { name: 'AI 판단 보류', exact: true }).click();
  const row = page.locator('.world-setting-diff-row');
  await row.getByRole('button', { name: /별빛 미궁.*새로 등록/ }).click();
  await row.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  // 필터가 바뀌어 묶음을 다시 열면 저장된 결정은 요약으로 접힌다.
  await expect(row).toContainText('저장했어요');
  expect(state.requests).toContain(`GET /api/v1/works/${workId}/world-setting-candidates/${candidateId}`);
  await expect.poll(() => new URL(page.url()).searchParams.get('operation')).toBe('ADD');
  await expect(row.locator('.review-cb-decision-panel')).toHaveCount(0);
  expect(state.confirmed).toHaveLength(0);
});
