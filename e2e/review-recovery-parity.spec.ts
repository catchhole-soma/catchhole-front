import { expect, test, type Page } from '@playwright/test';
import {
  characterCandidate, characterGroupKey, characterListPath, characterReviewUrl, routeCharacterReview,
  routeWorldReview, worldCandidate, worldListPath, worldReviewUrl,
} from './fixtures/review-group-mock';

// #211 Codex 4차 검토: 응답을 잃은 쓰기를 재조회로 성공 확인한 뒤에도 정상 응답 성공과 같은 후속 처리
// (이동할 묶음·페이지, 필터, 다음 묶음 이동, 안내, 함께 덮인 요청 재확인)를 한다. 목 API와 합성 데이터만 쓴다.
const param = (page: Page, key: string) => new URL(page.url()).searchParams.get(key);
const card = (page: Page, id: string) => page.locator(`[data-candidate-id="${id}"]`);
const primary = (page: Page) => page.getByRole('region', { name: '묶음 확정', exact: true }).locator('[data-review-primary-action]');
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

test('세계관: 전체 상태 필터에서 응답을 잃은 그룹 확정을 재조회로 확인하면 정상 확정처럼 다음 미처리 묶음을 열고 안내한다', async ({ page }) => {
  const candidates = [worldCandidate('a-1', '은빛 항구', '기후'), worldCandidate('b-1', '잿빛 요새', '규모')];
  await routeWorldReview(page, candidates);
  let confirms = 0;
  await page.route(`**${worldListPath}/group-confirm`, async route => {
    confirms += 1;
    const ids = (route.request().postDataJSON() as { candidates: Array<{ candidateId: string }> }).candidates.map(item => item.candidateId);
    candidates.filter(item => ids.includes(item.id)).forEach(item => Object.assign(item, { reviewStatus: 'CONFIRMED', finalOperation: 'ADD' }));
    await route.abort('connectionreset');
  });
  await page.goto(worldReviewUrl('LOCATION|은빛 항구', { reviewStatus: 'ALL' }));
  await primary(page).click();
  // 확정한 묶음은 `전체` 목록에 남지만 다음 미처리 묶음으로 간다.
  await expect.poll(() => param(page, 'group'), { timeout: 10_000 }).toBe('LOCATION|잿빛 요새');
  await expect(page.getByRole('status').filter({ hasText: '은빛 항구 설정 1개를 세계관 설정에 저장했습니다.' })).toBeVisible();
  await expect(page.getByText('저장 결과를 아직 확인하지 못했어요', { exact: false })).toHaveCount(0);
  expect(confirms).toBe(1);
});

test('세계관: 응답을 잃은 다시 비교는 정상 응답처럼 목록을 다시 읽어 시작된 비교를 보여 준다', async ({ page }) => {
  const candidates = [worldCandidate('a-1', '은빛 항구', '기후', { comparisonStatus: 'FAILED', comparisonFailureCode: 'COMPARISON_VALIDATION_FAILED' })];
  await routeWorldReview(page, candidates);
  let retries = 0;
  await page.route(`**${worldListPath}/a-1/recompare*`, async route => {
    retries += 1;
    candidates[0].comparisonStatus = 'PROCESSING';
    await route.abort('connectionreset');
  });
  await page.goto(worldReviewUrl('LOCATION|은빛 항구'));
  const retry = page.getByRole('button', { name: '다시 비교' });
  await retry.click();
  await expect(retry).toHaveCount(0);
  expect(retries).toBe(1);
});

test('캐릭터: 확인하지 못한 연결 요청에 덮인 후보의 저장이 응답을 잃어도 재조회로 확인되면 그 요청을 다시 읽어 정리한다', async ({ page }) => {
  test.setTimeout(60_000);
  const candidates = [characterCandidate('a-1', 0, '직업', { reviewedApplicationMode: null }), characterCandidate('a-2', 0, '소속'),
    characterCandidate('b-1', 1, '직업')];
  await routeCharacterReview(page, candidates);
  const control = { readsFail: true };
  // 선택 연결은 반영되지 않은 채 응답을 잃고, 그 확인 읽기도 실패해 결과 미확인으로 남는다.
  await page.route(`**${characterListPath}/selected-character-match*`, route => route.abort('connectionreset'));
  await page.route(`**${characterListPath}/a-1*`, async route => {
    if (control.readsFail && route.request().method() === 'GET') {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, data: null, message: '일시적인 오류' }) });
    }
    if (route.request().method() === 'PATCH') {
      // 반영 방식 저장은 서버에 반영됐지만 응답을 잃는다.
      const body = route.request().postDataJSON() as { reviewedApplicationMode?: string };
      Object.assign(candidates[0], { reviewedApplicationMode: body.reviewedApplicationMode, updatedAt: '2026-10-31T02:00:00Z' });
      return route.abort('connectionreset');
    }
    return route.fallback();
  });
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await page.getByRole('checkbox', { name: '선택: 직업' }).check();
  await page.getByRole('region', { name: '선택한 설정' }).getByRole('button', { name: '선택 항목 연결', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '선택 항목 연결' });
  await dialog.getByRole('button', { name: /^세라/ }).click();
  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }).click();
  await expect(dialog).toContainText('저장 결과를 확인하지 못했어요');
  await page.keyboard.press('Escape');
  const linkRequest = page.getByRole('region', { name: '묶음 확정', exact: true })
    .getByRole('status').filter({ hasText: '확인하지 못한 연결 요청(설정 1개)' });
  await expect(linkRequest.getByRole('button', { name: '최신 상태 확인', exact: true })).toBeVisible({ timeout: 30_000 });
  control.readsFail = false;
  await card(page, 'a-1').getByRole('radio', { name: /이력에만 저장/ }).click();
  // 단건 저장이 재조회로 확인되면 정상 응답과 같이 덮던 연결 요청을 다시 읽어 "연결되지 않음"으로 정리한다.
  await expect(linkRequest).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole('region', { name: '묶음 확정', exact: true })
    .getByText('요청한 대로 연결되지 않았어요', { exact: false })).toBeVisible();
});
