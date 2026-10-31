import { expect, test, type Page, type Route } from '@playwright/test';
import {
  characterCandidate, characterGroupKey, characterListPath, characterReviewUrl, routeCharacterReview,
  routeWorldReview, worldCandidate, worldListPath, worldReviewUrl,
} from './fixtures/review-group-mock';

// #211 PR 전 검토: 저장·확정 응답이 늦거나 사라진 동안 작가가 다른 묶음·페이지로 옮겨도 늦은 후속 처리가
// 그 위치·체크·안내를 되돌리지 않는다. 목 API와 합성 데이터만 쓴다.
const groupParam = (page: Page) => new URL(page.url()).searchParams.get('group');
const card = (page: Page, id: string) => page.locator(`[data-candidate-id="${id}"]`);
const primary = (page: Page) => page.getByRole('region', { name: '묶음 확정', exact: true }).locator('[data-review-primary-action]');

/** 요청을 붙잡아 두었다가 `release`로 이어 보낸다. */
function hold() {
  let release: () => void = () => undefined;
  const released = new Promise<void>(resolve => { release = resolve; });
  return { released, release: () => release() };
}

test('세계관: 결정 저장 응답을 기다리는 동안 다른 묶음으로 옮기면 저장 뒤에도 그 묶음에 남는다', async ({ page }) => {
  await routeWorldReview(page, [
    worldCandidate('a-1', '은빛 항구', '인구', { suggestedOperation: 'REVIEW_REQUIRED', manualReviewAvailable: true }),
    worldCandidate('b-1', '잿빛 요새', '규모'),
  ]);
  const save = hold();
  let saved = false;
  await page.route(`**${worldListPath}/decisions`, async route => {
    await save.released;
    saved = true;
    await route.fallback();
  });
  const listReads: number[] = [];
  page.on('request', request => {
    if (saved && new URL(request.url()).pathname === worldListPath) listReads.push(Date.now());
  });
  await page.goto(worldReviewUrl('LOCATION|은빛 항구', { worldCategory: 'ALL' }));
  await card(page, 'a-1').getByRole('radio', { name: /이 내용 그대로 추가/ }).click();
  await page.locator('.world-candidate-group-card', { hasText: '잿빛 요새' }).click();
  await expect.poll(() => groupParam(page)).toBe('LOCATION|잿빛 요새');
  save.release();
  // 저장 응답 뒤 결과 확인 조회가 끝날 때까지 기다린다.
  await expect.poll(() => listReads.length).toBeGreaterThan(0);
  await expect(page.getByText('저장 결과를 아직 확인하지 못했어요', { exact: false })).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(groupParam(page)).toBe('LOCATION|잿빛 요새');
  await expect(card(page, 'b-1')).toBeVisible();
});

test('캐릭터: 확정 뒤 목록 재조회가 실패하기 전에 다른 묶음을 고르면 그 묶음을 지우지 않는다', async ({ page }) => {
  await routeCharacterReview(page, [characterCandidate('a-1', 0, '직업'), characterCandidate('b-1', 1, '직업')]);
  const refetch = hold();
  let confirmed = false;
  await page.route(`**${characterListPath}?*`, async (route: Route) => {
    if (!confirmed || route.request().method() !== 'GET') return route.fallback();
    await refetch.released;
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, data: null, message: '일시적인 오류' }) });
  });
  page.on('requestfinished', request => { if (request.url().endsWith('/group-confirm')) confirmed = true; });
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await primary(page).click();
  await expect.poll(() => confirmed).toBe(true);
  await page.locator('.candidate-group-card', { hasText: '도윤' }).click();
  await expect.poll(() => groupParam(page)).toBe(characterGroupKey(1));
  refetch.release();
  await expect(page.getByText('최신 후보를 불러오지 못해 마지막으로 확인한 목록을 표시합니다.')).toBeVisible({ timeout: 15_000 });
  expect(groupParam(page)).toBe(characterGroupKey(1));
});

test('캐릭터: 응답을 잃은 확정은 다른 페이지로 옮겨 묶음이 목록에 없어도 후보를 다시 읽어 판단한다', async ({ page }) => {
  await routeCharacterReview(page, [characterCandidate('a-1', 0, '직업'), characterCandidate('b-1', 1, '직업')], { groupPageSize: 1 });
  const confirm = hold();
  await page.route(`**${characterListPath}/group-confirm`, async route => {
    await confirm.released;
    await route.abort('connectionreset');
  });
  const detailReads: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path === `${characterListPath}/a-1`) detailReads.push(path);
  });
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await primary(page).click();
  await page.getByRole('button', { name: '다음 페이지' }).first().click();
  await expect.poll(() => groupParam(page)).toBe(characterGroupKey(1));
  confirm.release();
  // 지금 페이지에 없는 묶음은 확정됐다고 단정하지 않고 확정한 후보를 하나씩 다시 읽는다.
  await expect.poll(() => detailReads.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: '이전 페이지' }).first().click();
  await expect.poll(() => groupParam(page)).toBe(characterGroupKey(0));
  await expect(page.getByRole('region', { name: '묶음 확정', exact: true })).toContainText('저장 결과를 확인하지 못했어요');
});

test('세계관: 응답을 잃은 확정도 다른 페이지로 옮기면 확정한 후보를 하나씩 다시 읽어 판단한다', async ({ page }) => {
  await routeWorldReview(page, [worldCandidate('a-1', '은빛 항구', '기후'), worldCandidate('b-1', '잿빛 요새', '규모')]);
  const confirm = hold();
  await page.route(`**${worldListPath}/group-confirm`, async route => {
    await confirm.released;
    await route.abort('connectionreset');
  });
  const detailReads: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === `${worldListPath}/a-1`) detailReads.push(request.url());
  });
  await page.goto(worldReviewUrl('LOCATION|은빛 항구', { size: '1' }));
  await primary(page).click();
  await page.getByRole('button', { name: '다음 페이지' }).first().click();
  await expect.poll(() => groupParam(page)).toBe('LOCATION|잿빛 요새');
  confirm.release();
  await expect.poll(() => detailReads.length).toBeGreaterThan(0);
  // 확정되지 않았으므로 원래 묶음은 그대로 남아 있다.
  await page.getByRole('button', { name: '이전 페이지' }).first().click();
  await expect(card(page, 'a-1')).toBeVisible();
});

test('캐릭터: 응답을 잃은 선택 연결의 확인이 늦게 끝나도 다른 묶음에서 새로 한 체크를 지우지 않는다', async ({ page }) => {
  const candidates = [
    characterCandidate('a-1', 0, '직업', { reviewedApplicationMode: null }), characterCandidate('a-2', 0, '소속'),
    characterCandidate('b-1', 1, '직업', { reviewedApplicationMode: null }), characterCandidate('b-2', 1, '소속'),
  ];
  await routeCharacterReview(page, candidates);
  const check = hold();
  let linked = false;
  await page.route(`**${characterListPath}/selected-character-match*`, async route => {
    const body = route.request().postDataJSON() as { candidateIds: string[]; matchedCharacterId: string };
    // 서버는 처리했지만 응답이 사라진 경우다.
    candidates.filter(item => body.candidateIds.includes(item.id)).forEach(item => Object.assign(item, {
      matchedCharacterId: body.matchedCharacterId, entityName: '세라', matchStatus: 'MATCHED' }));
    linked = true;
    await route.abort('connectionreset');
  });
  await page.route(`**${characterListPath}/a-1*`, async route => {
    if (linked) await check.released;
    await route.fallback();
  });
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await page.getByRole('checkbox', { name: '선택: 직업' }).check();
  await page.getByRole('region', { name: '선택한 설정' }).getByRole('button', { name: '선택 항목 연결', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '선택 항목 연결' });
  await dialog.getByRole('button', { name: /^세라/ }).click();
  await dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }).click();
  await expect(dialog).toContainText('저장 결과를 확인하지 못했어요');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.locator('.candidate-group-card', { hasText: '도윤' }).click();
  await expect.poll(() => groupParam(page)).toBe(characterGroupKey(1));
  await page.getByRole('checkbox', { name: '선택: 직업' }).check();
  await expect(page.getByRole('region', { name: '선택한 설정' })).toContainText('1개 선택');
  check.release();
  // 늦게 끝난 확인이 연결을 확인하고 후속 처리를 마칠 때까지 기다린다.
  await expect.poll(() => candidates[0].matchedCharacterId).toBe('83333333-cccc-4ccc-8ccc-cccccccccccc');
  await page.waitForTimeout(500);
  await expect(page.getByRole('checkbox', { name: '선택: 직업' })).toBeChecked();
  await expect(page.getByRole('region', { name: '선택한 설정' })).toContainText('1개 선택');
  expect(groupParam(page)).toBe(characterGroupKey(1));
});

test('세계관: 응답을 잃은 선택 대상 연결을 다른 묶음에서 확인하면 그 묶음 머리에 연결 안내를 띄우지 않는다', async ({ page }) => {
  test.setTimeout(60_000);
  const candidates = [
    worldCandidate('a-1', '항구', '기후'), worldCandidate('a-2', '항구', '인구'),
    worldCandidate('b-1', '잿빛 요새', '규모'),
  ];
  await routeWorldReview(page, candidates, { targets: [{ id: '84444444-4444-4444-8444-444444444444', category: 'LOCATION', subjectName: '은빛 항구', properties: [] }] });
  let failingReads = false;
  await page.route(`**${worldListPath}/decisions`, async route => {
    // 서버는 저장했지만 응답이 사라진 경우: 목 API와 같은 방식으로 초안을 저장한 뒤 연결을 끊는다.
    const body = route.request().postDataJSON() as { candidates: Array<Record<string, unknown>> };
    body.candidates.forEach(draft => Object.assign(candidates.find(item => item.id === draft.candidateId)!, {
      finalOperation: draft.operation, finalCategory: draft.category, finalSubjectName: draft.subjectName,
      finalScopeName: draft.scopeName ?? null, finalSettingName: draft.settingName, finalValue: draft.value, userModified: true }));
    failingReads = true;
    await route.abort('connectionreset');
  });
  await page.route(`**${worldListPath}?*`, async route => {
    if (failingReads && route.request().method() === 'GET') {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, data: null, message: '일시적인 오류' }) });
    }
    return route.fallback();
  });
  await page.goto(worldReviewUrl('LOCATION|항구'));
  await page.getByRole('checkbox', { name: /모두 선택/ }).check();
  await page.getByRole('region', { name: '선택한 설정' }).getByRole('button', { name: '선택 항목 대상 연결', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '선택 항목 대상 연결' });
  await dialog.getByRole('radio', { name: /^은빛 항구/ }).click();
  await dialog.getByRole('button', { name: '고른 대상에 연결', exact: true }).click();
  await expect.poll(() => failingReads).toBe(true);
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.locator('.world-candidate-group-card', { hasText: '잿빛 요새' }).click();
  await expect.poll(() => groupParam(page)).toBe('LOCATION|잿빛 요새');

  failingReads = false;
  // 다음 자동 확인(또는 수동 확인)이 저장을 확인하면 결과 확인 안내가 사라진다.
  const manual = page.getByRole('button', { name: '최신 상태 다시 확인', exact: true });
  await expect(async () => {
    if (await manual.isEnabled().catch(() => false)) await manual.click().catch(() => undefined);
    await expect(page.getByText('저장 결과를 아직 확인하지 못했어요', { exact: false })).toHaveCount(0, { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  expect(groupParam(page)).toBe('LOCATION|잿빛 요새');
  await expect(page.locator('.world-candidate-detail-card')).not.toContainText('개 저장(추가)');
  await expect(card(page, 'b-1')).toBeVisible();
});

test('세계관: 묶음에서 고른 대상의 상세를 행이 잠긴 동안 받아 버렸으면 잠금이 풀린 뒤 다시 불러온다', async ({ page }) => {
  const target = { id: '85555555-5555-4555-8555-555555555555', category: 'LOCATION', subjectName: '은빛 항구',
    properties: [{ scopeName: null, settingName: '기후', value: '온화한 바닷바람' }] };
  await routeWorldReview(page, [
    worldCandidate('a-1', '항구', '기후'), worldCandidate('a-2', '항구', '인구'), worldCandidate('a-3', '항구', '특산물'),
  ], { targets: [target] });
  const detail = hold();
  let linkApplied = false;
  let heldOnce = false;
  await page.route(`**/world-settings/${target.id}`, async route => {
    if (linkApplied && !heldOnce) {
      heldOnce = true;
      await detail.released;
    }
    await route.fallback();
  });
  await page.goto(worldReviewUrl('LOCATION|항구'));
  await page.getByRole('checkbox', { name: '선택: 기후' }).check();
  await page.getByRole('checkbox', { name: '선택: 인구' }).check();
  await page.getByRole('region', { name: '선택한 설정' }).getByRole('button', { name: '선택 항목 대상 연결', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '선택 항목 대상 연결' });
  await dialog.getByRole('radio', { name: /^은빛 항구/ }).click();
  await expect(dialog).toContainText('기존값 있음 → 병합/교체 결정 필요');
  linkApplied = true;
  await dialog.getByRole('button', { name: '고른 대상에 연결', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  // 결정으로 남긴 행(기후)이 대상의 현재 설정을 읽는 동안 다른 행의 수정 창을 열어 행을 잠근다.
  await expect.poll(() => heldOnce).toBe(true);
  await card(page, 'a-3').getByRole('button', { name: '수정', exact: true }).click();
  const editor = page.getByRole('dialog', { name: /반영 내용 수정/ });
  await expect(editor).toBeVisible();
  detail.release();
  await page.waitForTimeout(300);
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(card(page, 'a-1').getByRole('radiogroup', { name: '이 대상에 같은 설정이 있어요. 어떻게 반영할까요?' })).toBeVisible();
});

/** 결정 저장 응답을 잃게 하고, 목록 조회 `applyAfterReads`번째 뒤에야 서버에 저장된 것처럼 바꾼다(null이면 끝까지 저장 안 됨). */
async function loseDecisionResponse(page: Page, candidates: Array<Record<string, unknown> & { id: string }>, applyAfterReads: number | null) {
  const state = { patches: 0, readsAfterLoss: 0 };
  let pending: Array<Record<string, unknown>> | null = null;
  await page.route(`**${worldListPath}/decisions`, async route => {
    state.patches += 1;
    pending = (route.request().postDataJSON() as { candidates: Array<Record<string, unknown>> }).candidates;
    await route.abort('connectionreset');
  });
  await page.route(`**${worldListPath}?*`, async route => {
    if (pending && route.request().method() === 'GET') {
      state.readsAfterLoss += 1;
      if (applyAfterReads != null && state.readsAfterLoss > applyAfterReads) {
        pending.forEach(draft => Object.assign(candidates.find(item => item.id === draft.candidateId)!, {
          finalOperation: draft.operation, finalCategory: draft.category, finalSubjectName: draft.subjectName,
          finalScopeName: draft.scopeName ?? null, finalSettingName: draft.settingName, finalValue: draft.value, userModified: true }));
      }
    }
    return route.fallback();
  });
  return state;
}

test('세계관: 응답을 잃은 결정 저장은 첫 확인이 이전 값이어도 잠금을 유지하고 다시 확인해 늦게 반영된 저장을 받아들인다', async ({ page }) => {
  const candidates = [worldCandidate('a-1', '은빛 항구', '인구', { suggestedOperation: 'REVIEW_REQUIRED', manualReviewAvailable: true })];
  await routeWorldReview(page, candidates);
  const state = await loseDecisionResponse(page, candidates, 1);
  await page.goto(worldReviewUrl('LOCATION|은빛 항구'));
  await card(page, 'a-1').getByRole('radio', { name: /이 내용 그대로 추가/ }).click();
  // 첫 확인은 이전 값이다: 잠금과 결과 확인 안내를 유지한 채 자동으로 다시 확인한다.
  await expect.poll(() => state.readsAfterLoss).toBeGreaterThanOrEqual(1);
  await expect(page.getByText(/잠시 후 자동으로 다시 확인해요|최신 상태를 확인하는 중이에요/).first()).toBeVisible();
  await expect(card(page, 'a-1').getByRole('radio', { name: /이 내용 그대로 추가/ })).toBeDisabled();
  // 다음 확인에서 서버 값이 저장과 같아지면 저장 완료로 접는다. 같은 결정을 다시 보내지 않는다.
  await expect(card(page, 'a-1').getByText('선택한 내용이 준비됐어요', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('저장 결과를 아직 확인하지 못했어요', { exact: false })).toHaveCount(0);
  expect(state.patches).toBe(1);
});

test('세계관: 응답을 잃은 결정 저장이 1·3·8초 확인 뒤에도 서버에 없으면 저장되지 않음으로 알리고 잠금을 푼다', async ({ page }) => {
  test.setTimeout(45_000);
  const candidates = [worldCandidate('a-1', '은빛 항구', '인구', { suggestedOperation: 'REVIEW_REQUIRED', manualReviewAvailable: true })];
  await routeWorldReview(page, candidates);
  const state = await loseDecisionResponse(page, candidates, null);
  await page.goto(worldReviewUrl('LOCATION|은빛 항구'));
  await card(page, 'a-1').getByRole('radio', { name: /이 내용 그대로 추가/ }).click();
  await expect(page.getByText('저장되지 않았어요. 입력한 내용은 그대로예요. 다시 저장해 주세요.')).toBeVisible({ timeout: 20_000 });
  expect(state.readsAfterLoss).toBe(4);
  expect(state.patches).toBe(1);
  await expect(card(page, 'a-1').getByRole('radio', { name: /이 내용 그대로 추가/ })).toBeEnabled();
});
