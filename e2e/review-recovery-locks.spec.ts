import { expect, test, type Page } from '@playwright/test';
import {
  characterCandidate, characterGroupKey, characterListPath, characterReviewUrl, routeCharacterReview,
  routeWorldReview, worldCandidate, worldListPath, worldReviewUrl,
} from './fixtures/review-group-mock';

// #211 Codex 3차 검토: 결과를 확인하지 못한 쓰기의 자동 확인 동안 그 쓰기에 제출한 후보의 다른 쓰기를 잠그고,
// 복구 판정은 요청한 결과(확정·연결)인지 확인하며, 응답 본문을 읽다 끊긴 오류는 결과 미확인으로 다시 확인한다.
// 목 API와 합성 데이터만 쓴다.
const groupParam = (page: Page) => new URL(page.url()).searchParams.get('group');
const card = (page: Page, id: string) => page.locator(`[data-candidate-id="${id}"]`);
const confirmRegion = (page: Page) => page.getByRole('region', { name: '묶음 확정', exact: true });
const primary = (page: Page) => confirmRegion(page).locator('[data-review-primary-action]');
/** 요약으로 접히지 않고 확정할 수 있는 캐릭터 후보(수정·제외·연결 버튼이 보인다). */
const openCandidate = (id: string, owner: number, setting: string) => characterCandidate(id, owner, setting, {
  suggestedOperation: 'ADD', manualReviewAvailable: false, reviewedApplicationMode: null,
});
const VERIFYING = '저장 결과를 확인하는 설정이 있어요';

test('캐릭터: 응답을 잃은 그룹 확정을 자동 확인하는 동안 제출한 후보의 수정·제외·연결과 체크를 잠근다', async ({ page }) => {
  test.setTimeout(45_000);
  const candidates = [openCandidate('a-1', 0, '직업'), openCandidate('a-2', 0, '소속'), openCandidate('b-1', 1, '직업')];
  await routeCharacterReview(page, candidates);
  let confirms = 0;
  await page.route(`**${characterListPath}/group-confirm`, async route => {
    confirms += 1;
    await route.abort('connectionreset');
  });
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await primary(page).click();
  await expect(confirmRegion(page)).toContainText('최신 상태를 확인하는 중이에요');
  // 확정 요청은 끝났지만(결과 미확인) 자동 확인 동안 제출한 후보는 다른 쓰기로 바꿀 수 없다.
  for (const id of ['a-1', 'a-2']) {
    await expect(card(page, id).getByRole('button', { name: '제외', exact: true })).toBeDisabled();
    await expect(card(page, id).getByRole('button', { name: '수정', exact: true })).toBeDisabled();
    await expect(card(page, id).getByRole('button', { name: '캐릭터 연결 변경', exact: true })).toBeDisabled();
    await expect(card(page, id).getByRole('checkbox')).toBeDisabled();
  }
  await expect(page.getByRole('button', { name: '캐릭터 일괄 연결', exact: true })).toBeDisabled();
  // 자동 확인을 마치면 확인·다시 시도를 열고 후보 쓰기도 다시 연다(확정 요청은 한 번만 보냈다).
  await expect(confirmRegion(page).getByRole('button', { name: '최신 상태 확인', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(card(page, 'a-1').getByRole('button', { name: '제외', exact: true })).toBeEnabled();
  expect(confirms).toBe(1);
});

test('캐릭터: 응답을 잃은 그룹 확정은 제출한 후보가 다른 곳에서 제외됐으면 확정 성공으로 보지 않는다', async ({ page }) => {
  test.setTimeout(45_000);
  const candidates = [openCandidate('a-1', 0, '직업'), openCandidate('a-2', 0, '소속'), openCandidate('b-1', 1, '직업')];
  await routeCharacterReview(page, candidates);
  await page.route(`**${characterListPath}/group-confirm`, async route => {
    // 확정은 반영되지 않았고, 그 사이 다른 곳에서 두 후보를 제외했으며 같은 인물의 새 후보가 들어왔다.
    candidates.filter(item => item.id === 'a-1' || item.id === 'a-2').forEach(item => { item.reviewStatus = 'DISMISSED'; });
    candidates.push(openCandidate('a-3', 0, '나이'));
    await route.abort('connectionreset');
  });
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await primary(page).click();
  // "대기가 아님"만으로 확정됐다고 보지 않는다: 끝까지 결과를 확인하지 못한 것으로 남기고 묶음을 옮기지 않는다.
  await expect(confirmRegion(page).getByRole('button', { name: '최신 상태 확인', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(confirmRegion(page)).toContainText('저장 결과를 확인하지 못했어요');
  expect(groupParam(page)).toBe(characterGroupKey(0));
});

test('캐릭터: 한 설정의 저장 결과를 확인하는 동안 묶음 전체 연결과 그 설정을 포함한 선택 연결을 잠근다', async ({ page }) => {
  test.setTimeout(45_000);
  const candidates = [characterCandidate('a-1', 0, '직업', { reviewedApplicationMode: null }), openCandidate('a-2', 0, '소속'),
    openCandidate('b-1', 1, '직업')];
  await routeCharacterReview(page, candidates);
  await page.route(`**${characterListPath}/a-1`, route => route.request().method() === 'PATCH'
    ? route.abort('connectionreset') : route.fallback());
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await card(page, 'a-1').getByRole('checkbox').check();
  await card(page, 'a-1').getByRole('radio', { name: /이력에만 저장/ }).click();
  await expect(card(page, 'a-1')).toContainText('최신 상태를 확인하는 중이에요');
  const groupLink = page.getByRole('button', { name: '캐릭터 일괄 연결', exact: true });
  await expect(groupLink).toBeDisabled();
  await expect(groupLink).toHaveAttribute('title', new RegExp(VERIFYING));
  const selectionLink = page.getByRole('region', { name: '선택한 설정' }).getByRole('button', { name: '선택 항목 연결', exact: true });
  await expect(selectionLink).toBeDisabled();
  await expect(selectionLink).toHaveAttribute('title', new RegExp(VERIFYING));
  // 자동 확인을 마치면(결과 미확인) 다시 연다.
  await expect(card(page, 'a-1').getByRole('button', { name: '최신 상태 확인', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(groupLink).toBeEnabled();
  await expect(selectionLink).toBeEnabled();
});

test('캐릭터: 저장 응답 본문이 깨져 읽지 못하면 실패로 단정하지 않고 다시 읽어 저장을 확인한다', async ({ page }) => {
  const candidates = [characterCandidate('a-1', 0, '직업', { reviewedApplicationMode: null }), openCandidate('b-1', 1, '직업')];
  await routeCharacterReview(page, candidates);
  let patches = 0;
  await page.route(`**${characterListPath}/a-1`, async route => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    patches += 1;
    // 서버는 저장했지만 응답 본문이 중간에 끊겨 JSON으로 읽지 못한다.
    const body = route.request().postDataJSON() as { reviewedApplicationMode?: string };
    Object.assign(candidates[0], { reviewedApplicationMode: body.reviewedApplicationMode, updatedAt: '2026-10-31T02:00:00Z' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":{"id":"a-1"' });
  });
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await card(page, 'a-1').getByRole('radio', { name: /이력에만 저장/ }).click();
  await expect(card(page, 'a-1').getByText('저장했어요', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('설정값을 저장하지 못했습니다', { exact: false })).toHaveCount(0);
  await expect(page.getByText(/JSON/)).toHaveCount(0);
  expect(patches).toBe(1);
});

test('세계관: 그룹 확정 응답 본문이 깨져 읽지 못하면 실패로 단정하지 않고 다시 읽어 확정을 확인한다', async ({ page }) => {
  const candidates = [worldCandidate('a-1', '은빛 항구', '기후'), worldCandidate('b-1', '잿빛 요새', '규모')];
  await routeWorldReview(page, candidates);
  let confirms = 0;
  await page.route(`**${worldListPath}/group-confirm`, async route => {
    confirms += 1;
    const ids = (route.request().postDataJSON() as { candidates: Array<{ candidateId: string }> }).candidates.map(item => item.candidateId);
    candidates.filter(item => ids.includes(item.id)).forEach(item => Object.assign(item, { reviewStatus: 'CONFIRMED', finalOperation: 'ADD' }));
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":{"groupKey":' });
  });
  await page.goto(worldReviewUrl('LOCATION|은빛 항구'));
  await primary(page).click();
  // 확정이 서버에 보이면 성공과 같이 다음 묶음으로 간다. 오류로 보여 주지 않고 다시 보내지도 않는다.
  await expect.poll(() => groupParam(page), { timeout: 10_000 }).toBe('LOCATION|잿빛 요새');
  await expect(page.getByText(/JSON/)).toHaveCount(0);
  expect(confirms).toBe(1);
});

test('세계관: 응답을 잃은 그룹 확정은 제출한 후보가 다른 곳에서 제외됐으면 확정 성공으로 보지 않는다', async ({ page }) => {
  test.setTimeout(45_000);
  const candidates = [worldCandidate('a-1', '은빛 항구', '기후'), worldCandidate('b-1', '잿빛 요새', '규모')];
  await routeWorldReview(page, candidates);
  await page.route(`**${worldListPath}/group-confirm`, async route => {
    candidates[0].reviewStatus = 'DISMISSED';
    candidates.push(worldCandidate('a-3', '은빛 항구', '인구'));
    await route.abort('connectionreset');
  });
  await page.goto(worldReviewUrl('LOCATION|은빛 항구'));
  await primary(page).click();
  await expect(page.getByText('확정되지 않았어요. 내용을 확인한 뒤 다시 확정해 주세요.')).toBeVisible({ timeout: 20_000 });
  expect(groupParam(page)).toBe('LOCATION|은빛 항구');
});

test('세계관: 결정 저장 결과를 확인하는 동안 분류·대상 일괄 수정과 행 제외를 잠근다', async ({ page }) => {
  const candidates = [worldCandidate('a-1', '은빛 항구', '인구'), worldCandidate('a-2', '은빛 항구', '기후')];
  await routeWorldReview(page, candidates);
  await page.route(`**${worldListPath}/decisions`, route => route.abort('connectionreset'));
  await page.goto(worldReviewUrl('LOCATION|은빛 항구'));
  const identity = page.getByRole('button', { name: '분류·대상 일괄 수정', exact: true });
  await identity.click();
  await page.getByRole('textbox', { name: '대상', exact: true }).fill('은빛 항구 도시');
  await page.getByRole('button', { name: '일괄 수정 적용', exact: true }).click();
  await expect(page.getByText(/잠시 후 자동으로 다시 확인해요|최신 상태를 확인하는 중이에요/).first()).toBeVisible();
  const dialog = page.getByRole('dialog', { name: '분류·대상 일괄 수정' });
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  // 저장 요청은 끝났지만(결과 미확인) 결과를 확인하는 동안 다시 일괄 수정하거나 행을 제외할 수 없다.
  await expect(identity).toBeDisabled();
  await expect(card(page, 'a-2').getByRole('button', { name: '기후 제외', exact: true })).toBeDisabled();
});
