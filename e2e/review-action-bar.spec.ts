import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  characterCandidate, characterGroupKey, characterReviewUrl, routeCharacterReview, routeWorldReview, worldCandidate, worldReviewUrl,
} from './fixtures/review-group-mock';

// #211 후속 3차: 고정 확정 영역의 수치·막는 항목 이동·고정 여부. 목 API와 합성 데이터만 쓴다.
const bar = (page: Page) => page.getByRole('region', { name: '묶음 확정', exact: true });
const primary = (page: Page) => bar(page).locator('[data-review-primary-action]');
const card = (page: Page, id: string) => page.locator(`[data-candidate-id="${id}"]`);

async function expectFocusedInViewport(page: Page, target: Locator) {
  await expect.poll(() => target.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await expect.poll(() => target.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.top < window.innerHeight;
  })).toBe(true);
}

function mixedGroup() {
  return [
    characterCandidate('saved-1', 0, '직업'),
    characterCandidate('ambiguous', 0, '소속', { matchStatus: 'AMBIGUOUS', comparisonStatus: 'WAITING_FOR_CHARACTER_MATCH',
      suggestedOperation: null, manualReviewAvailable: false, reviewedApplicationMode: null }),
    characterCandidate('saved-2', 0, '거처'),
    characterCandidate('review', 0, '나이', { manualReviewAvailable: false, reviewedApplicationMode: null }),
    characterCandidate('exclude', 0, '별명', { suggestedOperation: 'EXCLUDE', manualReviewAvailable: false, reviewedApplicationMode: null }),
    characterCandidate('other', 1, '직업'),
  ];
}

test('캐릭터: 확정 가능·제외·결정 필요 수를 보여 주고 막는 후보로 차례로 옮겨 간다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { writes } = await routeCharacterReview(page, mixedGroup());
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await expect(bar(page)).toContainText('확정 가능 2 · 제외 1 · 결정 필요 2');
  await expect(primary(page)).toHaveText('확정하고 다음');
  await expect(primary(page)).toBeDisabled();
  await expect(primary(page)).toHaveAttribute('aria-describedby', /.+/);
  const describedBy = await primary(page).getAttribute('aria-describedby');
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveText('캐릭터 연결이 모호한 설정을 먼저 해소해 주세요.');

  const jump = bar(page).getByRole('button', { name: '다음 미결정 항목', exact: true });
  await jump.click();
  await expectFocusedInViewport(page, card(page, 'ambiguous'));
  await jump.click();
  await expectFocusedInViewport(page, card(page, 'review'));
  await jump.click();
  await expectFocusedInViewport(page, card(page, 'ambiguous'));
  expect(writes).toEqual([]);
});

test('캐릭터: 결정을 모두 채우면 주 버튼이 확정하고 다음으로 열린다', async ({ page }) => {
  await routeCharacterReview(page, mixedGroup());
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await card(page, 'ambiguous').getByRole('button', { name: '제외', exact: true }).click();
  await expect(card(page, 'ambiguous')).toHaveCount(0);
  await card(page, 'review').locator('.review-cb-choice', { hasText: '이력에만 저장' }).click();
  await expect(bar(page)).toContainText('확정 가능 2 · 이력 저장 1 · 제외 1');
  await expect(bar(page)).not.toContainText('결정 필요');
  await expect(bar(page).getByRole('button', { name: '다음 미결정 항목' })).toHaveCount(0);
  await expect(primary(page)).toBeEnabled();
  await expect(primary(page)).toHaveText('확정하고 다음');
});

test('캐릭터: 연결 상태 필터가 걸려 있으면 기존 규칙대로 확정을 잠그고 이유를 보여 준다', async ({ page }) => {
  await routeCharacterReview(page, [characterCandidate('a', 0, '직업'), characterCandidate('b', 0, '거처')]);
  await page.goto(characterReviewUrl(characterGroupKey(0), { matchStatus: 'CONNECTED' }));
  await expect(bar(page)).toContainText('확정 가능 2');
  await expect(bar(page)).toContainText('그룹 전체를 안전하게 확정하려면 연결 상태 필터를 전체로 바꿔 주세요.');
  await expect(primary(page)).toBeDisabled();
  await expect(primary(page)).toHaveText('모두 확정');
});

for (const size of [{ width: 1280, height: 800 }, { width: 320, height: 568 }]) {
  test(`캐릭터: 긴 묶음을 내려 읽어도 확정 영역이 화면 아래에 고정된다 (${size.width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize(size);
    await routeCharacterReview(page, Array.from({ length: 12 }, (_, index) => characterCandidate(`long-${index}`, 0, `상태 ${index}`, {
      reviewedApplicationMode: null })));
    await page.goto(characterReviewUrl(characterGroupKey(0)));
    await expect(card(page, 'long-0')).toBeVisible();
    await page.locator('.setting-review-main').evaluate(element => { element.scrollTop = 800; });
    await expect.poll(() => page.locator('.setting-review-main').evaluate(element => element.scrollTop)).toBe(800);
    const box = await bar(page).boundingBox();
    expect(Math.abs(box!.y + box!.height - size.height)).toBeLessThanOrEqual(1);
    await expect(primary(page)).toBeInViewport();
    if (size.width === 320) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect((await primary(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeLessThanOrEqual(size.height * 0.3);
    }
    await bar(page).screenshot({ path: testInfo.outputPath(`action-bar-${size.width}.png`) });
  });
}

test('캐릭터 320px: 선택 바와 확정 영역을 한 영역에 쌓고 화면을 과하게 가리지 않는다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await routeCharacterReview(page, Array.from({ length: 6 }, (_, index) => characterCandidate(`sel-${index}`, 0, `상태 ${index}`, {
    reviewedApplicationMode: null })));
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await page.getByRole('checkbox', { name: '선택: 상태 1' }).check();
  const selection = bar(page).getByRole('region', { name: '선택한 설정' });
  await expect(selection).toContainText('1개 선택');
  await page.locator('.setting-review-main').evaluate(element => { element.scrollTop = 600; });
  const box = await bar(page).boundingBox();
  expect(Math.abs(box!.y + box!.height - 568)).toBeLessThanOrEqual(1);
  expect(box!.height).toBeLessThanOrEqual(568 * 0.45);
  const [link, clear] = [selection.getByRole('button', { name: '선택 항목 연결' }), selection.getByRole('button', { name: '선택 해제' })];
  const [linkBox, clearBox] = [await link.boundingBox(), await clear.boundingBox()];
  expect(Math.abs(linkBox!.y - clearBox!.y)).toBeLessThanOrEqual(1);
  expect(linkBox!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await bar(page).screenshot({ path: testInfo.outputPath('action-bar-selection-320.png') });
});

test('세계관: 결정 없는 행·충돌 행·미저장 행을 결정 필요로 세고 그 행으로 옮겨 간다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { writes } = await routeWorldReview(page, [
    worldCandidate('ready', '은빛 항구', '기후'),
    worldCandidate('undecided', '은빛 항구', '인구', { suggestedOperation: 'REVIEW_REQUIRED', manualReviewAvailable: true }),
    worldCandidate('conflict', '은빛 항구', '항로', { consolidationStatus: 'CONFLICT', manualReviewAvailable: true }),
    worldCandidate('editable', '은빛 항구', '특산물', { manualReviewAvailable: true }),
    worldCandidate('next', '잿빛 요새', '규모'),
  ]);
  await page.goto(worldReviewUrl('LOCATION|은빛 항구'));
  await expect(bar(page)).toContainText('확정 가능 2 · 결정 필요 2');
  await expect(primary(page)).toBeDisabled();
  await expect(primary(page)).toHaveText('확정하고 다음');
  const describedBy = (await primary(page).getAttribute('aria-describedby'))!.split(' ');
  await expect(page.locator(`[id="${describedBy[0]}"]`)).toContainText('반영할 내용을 정하지 않은 설정이 있어요.');

  const jump = bar(page).getByRole('button', { name: '다음 미결정 항목', exact: true });
  await jump.click();
  await expectFocusedInViewport(page, card(page, 'undecided'));
  await jump.click();
  await expectFocusedInViewport(page, card(page, 'conflict'));

  // 수정 화면을 열어 둔 채 저장하지 않으면 그 행도 결정 필요로 센다.
  await card(page, 'editable').locator('.review-cb-choice', { hasText: '내용·저장 위치 수정' }).click();
  await expect(bar(page)).toContainText('결정 필요 3');
  await expect(primary(page)).toHaveAttribute('aria-describedby', /world-block-unsaved/);
  expect(writes).toEqual([]);
});

test('세계관: 긴 묶음에서도 확정 영역이 화면 아래에 고정된다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await routeWorldReview(page, Array.from({ length: 12 }, (_, index) => worldCandidate(`row-${index}`, '은빛 항구', `설정 ${index}`)));
  await page.goto(worldReviewUrl('LOCATION|은빛 항구'));
  await expect(card(page, 'row-0')).toBeVisible();
  await page.locator('.setting-review-main').evaluate(element => { element.scrollTop = 800; });
  await expect.poll(() => page.locator('.setting-review-main').evaluate(element => element.scrollTop)).toBe(800);
  const box = await bar(page).boundingBox();
  expect(Math.abs(box!.y + box!.height - 800)).toBeLessThanOrEqual(1);
  await expect(bar(page)).toContainText('확정 가능 12');
  await expect(primary(page)).toHaveText('모두 확정');
  await expect(primary(page)).toBeEnabled();
});
