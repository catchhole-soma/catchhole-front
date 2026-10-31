import { expect, test, type Page } from '@playwright/test';
import { routeWorldReview, worldCandidate, worldListPath, worldReviewUrl } from './fixtures/review-group-mock';

// #211 Codex 4차 검토: 응답을 잃은 쓰기를 재조회로 성공 확인한 뒤에도 정상 응답 성공과 같은 후속 처리
// (이동할 묶음·페이지, 필터, 다음 묶음 이동, 안내, 함께 덮인 요청 재확인)를 한다. 목 API와 합성 데이터만 쓴다.
const param = (page: Page, key: string) => new URL(page.url()).searchParams.get(key);
const card = (page: Page, id: string) => page.locator(`[data-candidate-id="${id}"]`);
type Candidate = Record<string, unknown> & { id: string };

/** 결정 저장 요청을 서버에 반영한 뒤 응답만 잃게(lose) 하거나 정상 응답을 돌려준다. */
async function routeDecisionSave(page: Page, candidates: Candidate[], mode: 'lose' | 'respond') {
  const state = { patches: 0 };
  if (mode === 'respond') return state;
  await page.route(`**${worldListPath}/decisions`, async route => {
    state.patches += 1;
    const drafts = (route.request().postDataJSON() as { candidates: Array<Record<string, unknown>> }).candidates;
    drafts.forEach(draft => Object.assign(candidates.find(item => item.id === draft.candidateId)!, {
      finalOperation: draft.operation, finalCategory: draft.category, finalSubjectName: draft.subjectName,
      finalScopeName: draft.scopeName ?? null, finalSettingName: draft.settingName, finalValue: draft.value, userModified: true }));
    await route.abort('connectionreset');
  });
  return state;
}

async function editRow(page: Page, id: string, draft: { subjectName?: string; category?: string; operation?: string }) {
  await card(page, id).getByRole('button', { name: '수정', exact: true }).click();
  const editor = page.locator('.review-modal');
  await expect(editor).toBeVisible();
  if (draft.category) await editor.getByRole('combobox', { name: '분류', exact: true }).selectOption(draft.category);
  if (draft.operation) await editor.getByRole('combobox', { name: '반영 방식', exact: true }).selectOption(draft.operation);
  if (draft.subjectName) await editor.getByRole('textbox', { name: '대상', exact: true }).fill(draft.subjectName);
  await editor.getByRole('button', { name: '수정안 적용', exact: true }).click();
  await expect(editor).toHaveCount(0);
}

/** 한 페이지에 묶음 하나(size=1). 은빛 항구(a-2·a-1) → 푸른 숲 → 붉은 성채 순서다. */
const pagedCandidates = (): Candidate[] => [
  worldCandidate('a-2', '은빛 항구', '기후'), worldCandidate('c-1', '푸른 숲', '인구'),
  worldCandidate('a-1', '은빛 항구', '규모'), worldCandidate('d-1', '붉은 성채', '높이'),
];

for (const mode of ['lose', 'respond'] as const) {
  test(`세계관: 대상을 바꾼 결정 저장은 ${mode === 'lose' ? '응답을 잃어 재조회로 확인해도' : '정상 응답이면'} 저장한 행의 묶음이 있는 페이지로 간다`, async ({ page }) => {
    const candidates = pagedCandidates();
    await routeWorldReview(page, candidates);
    const state = await routeDecisionSave(page, candidates, mode);
    await page.goto(worldReviewUrl('LOCATION|은빛 항구', { size: '1' }));
    await expect(card(page, 'a-1')).toBeVisible();
    await editRow(page, 'a-1', { subjectName: '붉은 성채' });
    // 저장한 행은 3쪽의 `붉은 성채` 묶음으로 옮겨 갔다. 첫 페이지의 첫 묶음으로 떨어지지 않는다.
    await expect.poll(() => param(page, 'group')).toBe('LOCATION|붉은 성채');
    await expect.poll(() => param(page, 'page')).toBe('3');
    await expect(card(page, 'a-1')).toBeVisible();
    await expect(card(page, 'd-1')).toBeVisible();
    await expect(page.getByText('저장 결과를 아직 확인하지 못했어요', { exact: false })).toHaveCount(0);
    if (mode === 'lose') expect(state.patches).toBe(1);
  });
}

test('세계관: 분류 필터에서 분류를 바꾼 결정 저장은 응답을 잃어도 정상 저장처럼 필터를 바꿔 새 묶음을 연다', async ({ page }) => {
  const candidates = [worldCandidate('a-1', '은빛 항구', '규모'), worldCandidate('b-1', '잿빛 요새', '높이')];
  await routeWorldReview(page, candidates);
  await routeDecisionSave(page, candidates, 'lose');
  await page.goto(worldReviewUrl('LOCATION|은빛 항구', { worldCategory: 'LOCATION' }));
  await editRow(page, 'a-1', { category: 'FACTION' });
  await expect.poll(() => param(page, 'worldCategory')).toBe('FACTION');
  await expect.poll(() => param(page, 'group')).toBe('FACTION|은빛 항구');
  await expect(card(page, 'a-1')).toBeVisible();
});

test('세계관: 반영 방식 필터에서 반영 방식을 바꾼 결정 저장은 응답을 잃어도 정상 저장처럼 필터를 바꾸고 같은 묶음에 남는다', async ({ page }) => {
  const candidates = [worldCandidate('a-1', '은빛 항구', '규모'), worldCandidate('b-1', '잿빛 요새', '높이')];
  await routeWorldReview(page, candidates);
  await routeDecisionSave(page, candidates, 'lose');
  await page.goto(worldReviewUrl('LOCATION|은빛 항구', { operation: 'ADD' }));
  await editRow(page, 'a-1', { operation: 'EXCLUDE' });
  await expect.poll(() => param(page, 'operation')).toBe('EXCLUDE');
  await expect.poll(() => param(page, 'group')).toBe('LOCATION|은빛 항구');
  await expect(card(page, 'a-1')).toBeVisible();
  await expect(page.getByText('저장 결과를 아직 확인하지 못했어요', { exact: false })).toHaveCount(0);
});
