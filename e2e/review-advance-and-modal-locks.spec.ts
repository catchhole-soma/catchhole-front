import { expect, test, type Page } from '@playwright/test';
import {
  characterCandidate, characterGroupKey, characterListPath, characterReviewUrl, routeCharacterReview,
  routeWorldReview, worldCandidate, worldListPath, worldReviewUrl,
} from './fixtures/review-group-mock';

// #211 Codex 5차 검토: `전체` 상태 필터의 `확정하고 다음`이 다른 페이지의 미처리 묶음으로 이어지고(없으면 탭 완료),
// 응답을 잃은 저장의 결과를 확인하는 동안에는 열린 모달의 입력·저장을 잠근다. 목 API와 합성 데이터만 쓴다.
const param = (page: Page, key: string) => new URL(page.url()).searchParams.get(key);
const card = (page: Page, id: string) => page.locator(`[data-candidate-id="${id}"]`);
const confirmRegion = (page: Page) => page.getByRole('region', { name: '묶음 확정', exact: true });
const primary = (page: Page) => confirmRegion(page).locator('[data-review-primary-action]');
/** 요약으로 접히지 않고 확정할 수 있는 캐릭터 후보. */
const openCandidate = (id: string, owner: number, setting: string, overrides: Record<string, unknown> = {}) => characterCandidate(id, owner, setting, {
  suggestedOperation: 'ADD', manualReviewAvailable: false, reviewedApplicationMode: null, ...overrides,
});
const CHECKING = '최신 상태를 확인하는 중이에요';

test.describe('전체 상태 필터의 확정하고 다음', () => {
  test('캐릭터: 지금 페이지에 미처리 묶음이 없으면 다른 페이지의 첫 미처리 묶음으로 간다', async ({ page }) => {
    // 한 페이지에 묶음 하나: 아린(미처리) → 도윤(이미 확정) → 세라(미처리)
    const candidates = [openCandidate('a-1', 0, '직업'), openCandidate('b-1', 1, '직업', { reviewStatus: 'CONFIRMED' }),
      openCandidate('c-1', 2, '직업')];
    await routeCharacterReview(page, candidates, { groupPageSize: 1 });
    await page.goto(characterReviewUrl(characterGroupKey(0), { reviewStatus: 'ALL' }));
    await expect(primary(page)).toHaveText(/확정하고 다음/);
    await primary(page).click();
    await expect.poll(() => param(page, 'group')).toBe(characterGroupKey(2));
    await expect.poll(() => param(page, 'page')).toBe('3');
    await expect(card(page, 'c-1')).toBeVisible();
  });

  test('캐릭터: 남은 미처리 묶음이 없으면 `모두 확정`이고 확정한 묶음에 머물러 탭 완료를 보여 준다', async ({ page }) => {
    const candidates = [openCandidate('a-1', 0, '직업'), openCandidate('b-1', 1, '직업', { reviewStatus: 'CONFIRMED' })];
    await routeCharacterReview(page, candidates, { groupPageSize: 1, worldPending: 2 });
    await page.goto(characterReviewUrl(characterGroupKey(0), { reviewStatus: 'ALL' }));
    await expect(primary(page)).toHaveText(/모두 확정/);
    await primary(page).click();
    await expect(page.getByText('캐릭터 검토를 마쳤어요').first()).toBeVisible();
    expect(param(page, 'group')).toBe(characterGroupKey(0));
    expect(param(page, 'candidateType')).not.toBe('world');
  });

  test('세계관: 지금 페이지에 미처리 묶음이 없으면 다른 페이지의 첫 미처리 묶음으로 간다', async ({ page }) => {
    const candidates = [worldCandidate('a-1', '은빛 항구', '기후'), worldCandidate('b-1', '잿빛 요새', '규모', { reviewStatus: 'CONFIRMED' }),
      worldCandidate('c-1', '푸른 숲', '인구')];
    await routeWorldReview(page, candidates);
    await page.goto(worldReviewUrl('LOCATION|은빛 항구', { reviewStatus: 'ALL', size: '1' }));
    await expect(primary(page)).toHaveText(/확정하고 다음/);
    await primary(page).click();
    await expect.poll(() => param(page, 'group')).toBe('LOCATION|푸른 숲');
    await expect.poll(() => param(page, 'page')).toBe('3');
    await expect(card(page, 'c-1')).toBeVisible();
  });

  test('세계관: 남은 미처리 묶음이 없으면 `모두 확정`이고 확정한 묶음에 머물러 탭 완료를 보여 준다', async ({ page }) => {
    const candidates = [worldCandidate('a-1', '은빛 항구', '기후'), worldCandidate('b-1', '잿빛 요새', '규모', { reviewStatus: 'CONFIRMED' })];
    await routeWorldReview(page, candidates, { characterPending: 2 });
    await page.goto(worldReviewUrl('LOCATION|은빛 항구', { reviewStatus: 'ALL', size: '1' }));
    await expect(primary(page)).toHaveText(/모두 확정/);
    await primary(page).click();
    await expect(page.getByText('세계관 검토를 마쳤어요').first()).toBeVisible();
    expect(param(page, 'group')).toBe('LOCATION|은빛 항구');
    expect(param(page, 'candidateType')).toBe('world');
  });
});

test.describe('결과 확인 중 모달 잠금', () => {
  test('캐릭터 수정 창: 응답을 잃은 저장을 확인하는 동안 입력과 저장을 잠그고, 닫기는 열어 둔다', async ({ page }) => {
    const candidates = [openCandidate('a-1', 0, '직업'), openCandidate('b-1', 1, '직업')];
    await routeCharacterReview(page, candidates);
    await page.route(`**${characterListPath}/a-1`, route => route.request().method() === 'PATCH'
      ? route.abort('connectionreset') : route.fallback());
    await page.goto(characterReviewUrl(characterGroupKey(0)));
    await card(page, 'a-1').getByRole('button', { name: '수정', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '설정 후보 수정' });
    await dialog.getByLabel('설정값', { exact: true }).fill('바꾼 값');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog).toContainText(CHECKING);
    await expect(dialog.getByLabel('설정값', { exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '확인 중…', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeEnabled();
  });

  test('캐릭터 연결 창: 응답을 잃은 단건 연결을 확인하는 동안 검색과 연결을 잠근다', async ({ page }) => {
    const candidates = [openCandidate('a-1', 0, '직업'), openCandidate('b-1', 1, '직업')];
    await routeCharacterReview(page, candidates);
    await page.route(`**${characterListPath}/a-1/character-match`, route => route.abort('connectionreset'));
    await page.goto(characterReviewUrl(characterGroupKey(0)));
    await card(page, 'a-1').getByRole('button', { name: '캐릭터 연결 변경', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '캐릭터 연결 확인' });
    await dialog.getByRole('button', { name: /^세라/ }).click();
    await dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }).click();
    await expect(dialog).toContainText(CHECKING);
    await expect(dialog.getByRole('searchbox')).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '확인 중…', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeEnabled();
  });

  test('캐릭터 일괄 연결 창: 응답을 잃은 묶음 연결을 확인하는 동안 연결을 잠근다', async ({ page }) => {
    const candidates = [openCandidate('a-1', 0, '직업'), openCandidate('a-2', 0, '소속'), openCandidate('b-1', 1, '직업')];
    await routeCharacterReview(page, candidates);
    await page.route(`**${characterListPath}/group-character-match*`, route => route.abort('connectionreset'));
    await page.goto(characterReviewUrl(characterGroupKey(0)));
    await page.getByRole('button', { name: '캐릭터 일괄 연결', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '캐릭터 일괄 연결' });
    await dialog.getByRole('button', { name: /^세라/ }).click();
    await dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }).click();
    await expect(dialog).toContainText(CHECKING);
    await expect(dialog.getByRole('button', { name: '확인 중…', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeEnabled();
  });

  test('캐릭터 선택 연결 창: 응답을 잃은 선택 연결을 확인하는 동안 연결을 잠근다', async ({ page }) => {
    const candidates = [openCandidate('a-1', 0, '직업'), openCandidate('a-2', 0, '소속'), openCandidate('b-1', 1, '직업')];
    await routeCharacterReview(page, candidates);
    await page.route(`**${characterListPath}/selected-character-match*`, route => route.abort('connectionreset'));
    await page.goto(characterReviewUrl(characterGroupKey(0)));
    await card(page, 'a-1').getByRole('checkbox').check();
    await page.getByRole('region', { name: '선택한 설정' }).getByRole('button', { name: '선택 항목 연결', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '선택 항목 연결' });
    await dialog.getByRole('button', { name: /^세라/ }).click();
    await dialog.getByRole('button', { name: '선택한 캐릭터에 연결', exact: true }).click();
    await expect(dialog).toContainText(CHECKING);
    await expect(dialog.getByRole('button', { name: '확인 중…', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeEnabled();
  });

  test('세계관 수정 창: 응답을 잃은 결정 저장을 확인하는 동안 입력과 저장을 잠그고, 닫기는 열어 둔다', async ({ page }) => {
    const candidates = [worldCandidate('a-1', '은빛 항구', '인구'), worldCandidate('b-1', '잿빛 요새', '기후')];
    await routeWorldReview(page, candidates);
    await page.route(`**${worldListPath}/decisions`, route => route.abort('connectionreset'));
    await page.goto(worldReviewUrl('LOCATION|은빛 항구'));
    await card(page, 'a-1').getByRole('button', { name: '수정', exact: true }).click();
    const dialog = page.locator('.review-modal');
    await dialog.getByRole('textbox', { name: '대상', exact: true }).fill('푸른 숲');
    await dialog.getByRole('button', { name: '수정안 적용', exact: true }).click();
    await expect(dialog.getByText('저장 결과를 아직 확인하지 못했어요', { exact: false })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: '대상', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('textbox', { name: '최종 설정값', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '수정안 적용', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeEnabled();
  });

  test('세계관 대상 연결 창: 응답을 잃은 대상 연결을 확인하는 동안 대상 선택과 연결을 잠근다', async ({ page }) => {
    const candidates = [worldCandidate('a-1', '항구', '기후'), worldCandidate('a-2', '항구', '인구'), worldCandidate('b-1', '잿빛 요새', '규모')];
    await routeWorldReview(page, candidates, { targets: [{ id: '84444444-4444-4444-8444-444444444444', category: 'LOCATION', subjectName: '은빛 항구', properties: [] }] });
    await page.route(`**${worldListPath}/decisions`, route => route.abort('connectionreset'));
    await page.goto(worldReviewUrl('LOCATION|항구'));
    await page.getByRole('checkbox', { name: /모두 선택/ }).check();
    await page.getByRole('region', { name: '선택한 설정' }).getByRole('button', { name: '선택 항목 대상 연결', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '선택 항목 대상 연결' });
    await dialog.getByRole('radio', { name: /^은빛 항구/ }).click();
    await dialog.getByRole('button', { name: '고른 대상에 연결', exact: true }).click();
    await expect(dialog.getByRole('status').filter({ hasText: '저장 결과를 확인하는 중이에요' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '확인 중…', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('radio', { name: /^은빛 항구/ })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '취소', exact: true })).toBeEnabled();
  });
});
