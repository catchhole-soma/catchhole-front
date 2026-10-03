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
async function setup(page: Page, overrides: Partial<WorldSettingCandidateResponse> = {}, options: { second?: boolean | Partial<WorldSettingCandidateResponse>; failSave?: boolean; searchTargets?: boolean; failReadback?: boolean; targetValue?: string; failSaveAfter?: number } = {}) {
  let candidates: WorldSettingCandidateResponse[] = [{ ...base, ...overrides }];
  if (options.second) candidates.push({ ...candidates[0], ...(typeof options.second === 'object' ? options.second : {}), id: '55555555-5555-4555-8555-555555555555' });
  let readbackFailure = Boolean(options.failReadback);
  let targetFailure: 'http' | 'incomplete' | null = null;
  const saved: DecisionRequest[] = [];
  const confirmed: DecisionRequest[] = [];
  const requests: string[] = [];
  await page.route('**/api/v1/**', route => {
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
        userModified: true, finalOperation: draft.operation, finalCategory: draft.category, finalSubjectName: draft.subjectName,
        finalScopeName: draft.scopeName ?? null, finalSettingName: draft.settingName, finalValue: draft.value, automaticReviewHoldReason: undefined,
      } as WorldSettingCandidateResponse);
      return success(route, { groupKey: `LOCATION|${candidates[0].finalSubjectName ?? candidates[0].targetSubjectName ?? candidates[0].subjectName}` });
    }
    if (path.endsWith('/world-setting-candidates/group-confirm')) {
      confirmed.push(route.request().postDataJSON());
      candidates = candidates.map(candidate => ({ ...candidate, reviewStatus: 'CONFIRMED' }));
      return success(route, { appliedCount: candidates.length, excludedCount: 0, targetCount: 1, subjectName: '별빛 미궁' });
    }
    if (path.endsWith('/world-setting-candidates')) {
      if (saved.length > 0 && readbackFailure) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: '상태 확인 실패' }) });
      const pending = candidates.filter(candidate => candidate.reviewStatus === 'PENDING_REVIEW');
      const shown = url.searchParams.get('reviewStatus') === 'CONFIRMED' ? candidates.filter(candidate => candidate.reviewStatus === 'CONFIRMED') : pending;
      return success(route, { batchId, episodeCount: 1, episodeStartNo: 3, episodeEndNo: 3, totalCandidateCount: candidates.length,
        pendingCandidateCount: pending.length, confirmedCandidateCount: candidates.length - pending.length, dismissedCandidateCount: 0,
        directReviewCandidateCount: pending.filter(candidate => !candidate.automaticApplicationPending).length,
        processingCandidateCount: pending.filter(candidate => candidate.automaticApplicationPending).length,
        pendingComparisonCount: 0, processingComparisonCount: 0, failedComparisonCount: 0, recomparisonRequiredCount: 0,
        groups: pageData(shown.length ? [{ groupKey: `LOCATION|${shown[0].finalSubjectName ?? shown[0].targetSubjectName ?? shown[0].subjectName}`, category: 'LOCATION', subjectName: shown[0].finalSubjectName ?? shown[0].targetSubjectName ?? shown[0].subjectName,
          changeCount: shown.length, status: shown.some(candidate => candidate.comparisonStatus === 'FAILED') ? 'FAILED' : 'READY', candidates: shown,
        }] : []),
      });
    }
    if (path.endsWith('/setting-candidates')) return success(route, { batchId, totalCandidateCount: 0, pendingCandidateCount: 0,
      confirmedCandidateCount: 0, dismissedCandidateCount: 0, directReviewCandidateCount: 0, processingCandidateCount: 0, candidates: pageData([]) });
    if (path.endsWith('/world-settings')) return success(route, { totalWorldSettingCount: options.searchTargets ? 2 : 0,
      worldSettings: pageData(options.searchTargets ? [{ id: targetId, category: 'LOCATION', subjectName: '북부 미궁', propertyCount: 1 },
        { id: '66666666-6666-4666-8666-666666666666', category: 'LOCATION', subjectName: '왕도 미궁', propertyCount: 0 }]
        .filter(target => target.subjectName.includes(url.searchParams.get('q') ?? '')) : []) });
    if (path.includes('/world-settings/') && targetFailure === 'http') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ success: false, message: '대상 상세를 읽지 못했습니다.' }) });
    if (path.includes('/world-settings/') && targetFailure === 'incomplete') return success(route, {});
    if (path.includes('/world-settings/')) return success(route, { id: path.split('/').at(-1), workId, category: 'LOCATION', subjectName: path.endsWith(targetId) ? '북부 미궁' : '왕도 미궁', version: 1, properties: options.targetValue ? [{ scopeName: null, settingName: '위험 기준', value: options.targetValue }] : [] });
    return success(route, {});
  });
  await page.goto('/login');
  await page.evaluate(() => { localStorage.setItem('accessToken', 'test-token'); localStorage.removeItem('catchhole_demo_mode'); });
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);
  if ((page.viewportSize()?.width ?? 1280) < 768) await page.locator('.world-candidate-group-card').first().click();
  await expect(page.locator('.world-setting-diff-row').first()).toBeVisible();
  return { saved, confirmed, requests, setTargetFailure: (value: 'http' | 'incomplete' | null) => { targetFailure = value; }, allowReadback: () => { readbackFailure = false; } };
}

test('범위 미정은 예 한 번으로 기존 내용과 이번 내용을 함께 저장하고 마지막에 그룹 확정한다', async ({ page }) => {
  const { saved, confirmed } = await setup(page);
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /예, 포함된 내용이에요/ }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ operation: 'MERGE', scopeName: '탐사 규칙', settingName: '귀환 조건', value: '해가 지면 돌아온다.\n생명력이 낮으면 돌아온다.' });
  expect(confirmed).toHaveLength(0);
  await expect(page.locator('.review-modal')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeEnabled();
  await expect(page.locator('.world-setting-diff-row')).not.toContainText('범위 확인 필요');
  await page.getByRole('button', { name: '모두 확정', exact: true }).click();
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
  await expect(replace).toHaveAttribute('aria-pressed', 'true');
  await merge.click();
  await expect.poll(() => saved.length).toBe(2);
  expect(saved[1].candidates[0]).toMatchObject({ operation: 'MERGE', value: proposedValue });
  await replace.click();
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
  await expect(replace).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /기존 내용과 합치기/ }).first().click();
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
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeEnabled();
  expect(requests.some(request => request.includes('/retry'))).toBe(false);
});

test('세계관 대상 선택은 실제 저장된 대상을 검색하고 선택한 이름으로만 저장한다', async ({ page }) => {
  const { saved } = await setup(page, { comparisonReviewReason: 'SUBJECT_UNRESOLVED', targetWorldSettingId: null,
    targetSubjectName: null, beforeValue: null, matchedScopeName: null, matchedPropertyName: null }, { searchTargets: true });
  await page.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ subjectName: '북부 미궁', operation: 'ADD' });
});

test('충돌은 여러 줄 원문 전체를 보존하고 최종 내용을 직접 저장해야 확정할 수 있다', async ({ page }) => {
  const { saved } = await setup(page, { comparisonReviewReason: 'GENERAL_UNCERTAINTY', consolidationStatus: 'CONFLICT',
    beforeValue: null, matchedPropertyName: null, matchedScopeName: null, extractedValue: '매일 열린다.\n한 달에 한 번 열린다.', proposedValue: '매일 열린다.\n한 달에 한 번 열린다.' });
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /추출 내용 [12]/ })).toHaveCount(0);
  await expect(page.getByLabel('최종 내용', { exact: true })).toHaveValue('매일 열린다.\n한 달에 한 번 열린다.');
  await page.getByLabel('최종 내용', { exact: true }).fill('한 달에 한 번 열린다.');
  expect(saved).toHaveLength(0);
  await page.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ value: '한 달에 한 번 열린다.', conflictResolved: true });
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeEnabled();
});

test('저장 충돌 시 인라인 작성값을 보존한다', async ({ page }) => {
  const { saved } = await setup(page, { comparisonReviewReason: 'GENERAL_UNCERTAINTY', beforeValue: null, matchedScopeName: null, matchedPropertyName: null }, { failSave: true });
  await page.getByRole('button', { name: /내용·저장 위치 수정/ }).click();
  await page.getByLabel('최종 내용', { exact: true }).fill('입력을 보존해야 한다.');
  await page.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await expect.poll(() => saved.length).toBe(1);
  await expect(page.getByLabel('최종 내용', { exact: true })).toHaveValue('입력을 보존해야 한다.');
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
});

test('분석 중에는 간단한 안내와 기존 분석 화면 이동만 제공한다', async ({ page }) => {
  const { saved } = await setup(page, { analysisMode: 'ORDERED_PROVISIONAL', automaticApplicationPending: true });
  await expect(page.getByRole('button', { name: '분석 진행 보기' })).toBeVisible();
  await expect(page.getByRole('button', { name: /예, 포함된 내용이에요/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
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
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});


test('대상 동일성 보류는 ADD 제안이어도 새 설정으로 단정하거나 바로 확정하지 않는다', async ({ page }) => {
  const { saved } = await setup(page, { suggestedOperation: 'ADD', comparisonReviewReason: undefined,
    automaticReviewHoldReason: 'SUBJECT_CONFIRMATION_REQUIRED', manualReviewAvailable: true,
    beforeValue: null, matchedScopeName: null, matchedPropertyName: null }, { searchTargets: true });
  const row = page.locator('.world-setting-diff-row');
  await expect(row.locator('.review-cb-heading')).toContainText('같은 대상인지 확인');
  await expect(row.locator('.review-cb-heading')).not.toContainText('새 설정');
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ }).click();
  await expect.poll(() => saved.length).toBe(1);
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeEnabled();
});


test('저장 후에도 선택지를 유지하고 새로고침 뒤 별도 저장과 병합을 원문 기준으로 다시 선택한다', async ({ page }, testInfo) => {
  const { saved, confirmed } = await setup(page);
  const yes = page.getByRole('button', { name: /예, 포함된 내용이에요/ });
  const no = page.getByRole('button', { name: /아니요, 별도 설정이에요/ });
  await yes.click();
  await expect(yes).toHaveAttribute('aria-pressed', 'true');
  await expect(no).toBeVisible();
  await page.reload();
  await expect(yes).toHaveAttribute('aria-pressed', 'true');
  await no.click();
  await expect(no).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => saved.length).toBe(2);
  expect(saved[1].candidates[0]).toMatchObject({ operation: 'ADD', scopeName: null, settingName: '위험 기준', value: base.extractedValue });
  await yes.click();
  await expect(yes).toHaveAttribute('aria-pressed', 'true');
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
  await expect(page.getByRole('button', { name: /예, 포함된 내용이에요/ }).first()).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /아니요, 별도 설정이에요/ }).first().click();
  await expect.poll(() => saved.length).toBe(2);
  expect(saved[1].candidates).toHaveLength(2);
  expect(saved[1].candidates.every(candidate => candidate.operation === 'ADD' && candidate.value === base.extractedValue)).toBe(true);
});

test('자동 보류 사유가 초안 저장 후 지워져도 다른 실제 대상에 다시 연결할 수 있다', async ({ page }) => {
  const { saved } = await setup(page, { suggestedOperation: 'ADD', comparisonReviewReason: undefined,
    automaticReviewHoldReason: 'SUBJECT_CONFIRMATION_REQUIRED', beforeValue: null, matchedPropertyName: null, matchedScopeName: null }, { searchTargets: true });
  await page.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ }).click();
  await expect(page.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /왕도 미궁.*이 대상에 연결/ }).click();
  await expect.poll(() => saved.length).toBe(2);
  expect(saved[1].candidates[0]).toMatchObject({ subjectName: '왕도 미궁', operation: 'ADD', value: base.extractedValue });
  await page.reload();
  await expect(page.getByRole('button', { name: /왕도 미궁.*이 대상에 연결/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ }).click();
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
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
  await row.screenshot({ path: testInfo.outputPath('world-comparison-failure-choices.png') });
  await row.getByRole('button', { name: /이 내용 그대로 추가/ }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ operation: 'ADD', subjectName: '상위종', settingName: '분류 기준', value: '상위종은 높은 지능을 가진다.' });
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeEnabled();
  await row.getByRole('button', { name: /내용·저장 위치 수정/ }).click();
  await expect(row.getByLabel('반영할 대상', { exact: true })).toHaveValue('상위종');
  expect(confirmed).toHaveLength(0);
});


test('연결한 대상의 병합·교체 선택은 저장 뒤에도 실제 대상의 기존값을 유지하고 원래 대상으로 돌아가지 않는다', async ({ page }) => {
  const { saved } = await setup(page, { comparisonReviewReason: 'SUBJECT_UNRESOLVED', targetSubjectName: null,
    beforeValue: '다른 장소의 오래된 내용.', matchedScopeName: null, matchedPropertyName: '위험 기준' }, { searchTargets: true, targetValue: '북부 미궁은 일몰에 문을 닫는다.' });
  const row = page.locator('.world-setting-diff-row');
  await expect(row).not.toContainText('다른 장소의 오래된 내용.');
  await row.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ }).click();
  await row.getByRole('button', { name: /기존 내용과 합치기/ }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].candidates[0]).toMatchObject({ subjectName: '북부 미궁', operation: 'MERGE', value: '북부 미궁은 일몰에 문을 닫는다.\n생명력이 낮으면 돌아온다.' });
  await expect(row.getByRole('button', { name: /기존 내용과 합치기/ })).toHaveAttribute('aria-pressed', 'true');
  await row.getByRole('button', { name: /이번 내용으로 바꾸기/ }).click();
  await expect.poll(() => saved.length).toBe(2);
  expect(saved[1].candidates[0]).toMatchObject({ subjectName: '북부 미궁', operation: 'UPDATE', value: base.extractedValue });
  await expect(row.getByRole('button', { name: /이번 내용으로 바꾸기/ })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(row.getByRole('button', { name: /이번 내용으로 바꾸기/ })).toHaveAttribute('aria-pressed', 'true');
  await row.getByRole('button', { name: /기존 내용과 합치기/ }).click();
  await expect.poll(() => saved.length).toBe(3);
  expect(saved[2].candidates[0]).toMatchObject({ subjectName: '북부 미궁', operation: 'MERGE', value: '북부 미궁은 일몰에 문을 닫는다.\n생명력이 낮으면 돌아온다.' });
  await expect(row).not.toContainText('다른 장소의 오래된 내용.');
});

test('일반 범위 초안은 원래 범위의 선택만 유지하고 불필요한 대상 연결을 추가하지 않는다', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /예, 포함된 내용이에요/ }).click();
  await expect(page.getByRole('button', { name: /예, 포함된 내용이에요/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '다른 대상에 연결', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('기존 세계관 대상 검색', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /아니요, 별도 설정이에요/ })).toBeVisible();
});


test('수동 복구 초안이 준비되면 실패 그룹의 상단과 목록도 확정 대기로 안내한다', async ({ page }) => {
  await setup(page, { comparisonStatus: 'FAILED', comparisonFailureCode: 'LLM_NETWORK_ERROR', comparisonReviewReason: undefined,
    beforeValue: null, matchedScopeName: null, matchedPropertyName: null });
  await page.getByRole('button', { name: /이 내용 그대로 추가/ }).click();
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeEnabled();
  await expect(page.locator('.world-candidate-group-card')).toContainText('확정 준비됨');
  await expect(page.locator('.world-candidate-group-card')).toContainText('확정 대기 1개');
  await expect(page.locator('.world-candidate-detail-card')).toContainText('확정할 내용이 준비됐어요');
  await expect(page.locator('.world-candidate-detail-card')).not.toContainText('직접 반영할 내용을 저장한 뒤');
  await expect(page.locator('.world-candidate-detail-card')).not.toContainText('자동 비교를 마치지 못해 대상과 내용을 확인');
});

test('저장한 초안을 다시 편집하면 모두 확정을 잠그고 취소 또는 재저장 뒤에만 연다', async ({ page }) => {
  const { saved, confirmed } = await setup(page);
  const confirm = page.getByRole('button', { name: '모두 확정', exact: true });
  await page.getByRole('button', { name: /예, 포함된 내용이에요/ }).click();
  await expect(confirm).toBeEnabled();
  await page.getByRole('button', { name: '최종 내용 직접 다듬기', exact: true }).click();
  await page.getByLabel('최종 내용', { exact: true }).fill('아직 저장하지 않은 문장');
  await expect(confirm).toBeDisabled();
  await expect(page.locator('.world-setting-diff-row .review-cb-heading')).toContainText('수정 중');
  await expect(page.getByText('저장하지 않은 수정이 있어요', { exact: true })).toBeVisible();
  expect(confirmed).toHaveLength(0);
  expect(saved).toHaveLength(1);
  await page.getByRole('button', { name: '수정 닫기', exact: true }).click();
  await expect(confirm).toBeEnabled();
  await page.getByRole('button', { name: '최종 내용 직접 다듬기', exact: true }).click();
  await expect(page.getByLabel('최종 내용', { exact: true })).toHaveValue('해가 지면 돌아온다.\n생명력이 낮으면 돌아온다.');
  await page.getByLabel('최종 내용', { exact: true }).fill('새롭게 저장할 최종 문장');
  await expect(confirm).toBeDisabled();
  await page.getByRole('button', { name: '이 내용으로 검토 완료', exact: true }).click();
  await expect.poll(() => saved.length).toBe(2);
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect.poll(() => confirmed.length).toBe(1);
  expect(confirmed[0].candidates[0]).toMatchObject({ value: '새롭게 저장할 최종 문장' });
});

test('기존 저장안이 있어도 재저장 실패 후 미저장 입력을 확정하지 못한다', async ({ page }) => {
  const { saved, confirmed } = await setup(page, {}, { failSaveAfter: 1 });
  const confirm = page.getByRole('button', { name: '모두 확정', exact: true });
  await page.getByRole('button', { name: /예, 포함된 내용이에요/ }).click();
  await expect(confirm).toBeEnabled();
  await page.getByRole('button', { name: '최종 내용 직접 다듬기', exact: true }).click();
  await page.getByLabel('최종 내용', { exact: true }).fill('저장에 실패한 수정');
  await page.getByRole('button', { name: '이 내용으로 검토 완료', exact: true }).click();
  await expect.poll(() => saved.length).toBe(2);
  await expect(page.getByLabel('최종 내용', { exact: true })).toHaveValue('저장에 실패한 수정');
  await expect(confirm).toBeDisabled();
  expect(confirmed).toHaveLength(0);
  await page.getByRole('button', { name: '수정 닫기', exact: true }).click();
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
    await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
    expect(state.saved).toHaveLength(0);
    if (failure === 'http') {
      await page.getByLabel('기존 세계관 대상 검색', { exact: true }).fill('왕도');
      await expect(target).toHaveCount(0);
    }
    state.setTargetFailure(null);
    await retry.click();
    await expect.poll(() => state.saved.length).toBe(1);
    expect(state.saved[0].candidates[0]).toMatchObject({ subjectName: '북부 미궁', operation: 'ADD' });
    await expect(retry).toHaveCount(0);
  });
}

test('저장된 대상에서 다른 대상 조회가 실패해도 이전 초안을 잘못 확정하지 않는다', async ({ page }) => {
  const state = await setup(page, { comparisonReviewReason: 'SUBJECT_UNRESOLVED', beforeValue: null }, { searchTargets: true });
  await page.getByRole('button', { name: /북부 미궁.*이 대상에 연결/ }).click();
  await expect.poll(() => state.saved.length).toBe(1);
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeEnabled();
  state.setTargetFailure('http');
  const other = page.getByRole('button', { name: /왕도 미궁.*이 대상에 연결/ });
  await other.click();
  await expect(page.getByRole('button', { name: '선택한 대상 다시 불러오기' })).toBeVisible();
  await expect(other).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
  expect(state.saved).toHaveLength(1);
  state.setTargetFailure(null);
  await page.getByRole('button', { name: '선택한 대상 다시 불러오기' }).click();
  await expect.poll(() => state.saved.length).toBe(2);
  expect(state.saved[1].candidates[0].subjectName).toBe('왕도 미궁');
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
