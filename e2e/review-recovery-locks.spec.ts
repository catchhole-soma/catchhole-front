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
