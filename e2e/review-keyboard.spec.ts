import { expect, test, type Page } from '@playwright/test';
import {
  characterCandidate, characterGroupKey, characterListPath, characterReviewUrl, routeCharacterReview,
  routeWorldReview, worldCandidate, worldReviewUrl,
} from './fixtures/review-group-mock';

// #211 후속 3차(D7): Alt 조합 단축키와 선택 카드 방향키. 입력 중·한글 조합 중에는 동작하지 않는다.
const card = (page: Page, id: string) => page.locator(`[data-candidate-id="${id}"]`);
const primary = (page: Page) => page.getByRole('region', { name: '묶음 확정', exact: true }).locator('[data-review-primary-action]');
const focusedCardId = (page: Page) => page.evaluate(() => (document.activeElement?.closest('[data-candidate-id]') as HTMLElement | null)?.dataset.candidateId ?? null);
const groupParam = (page: Page) => new URL(page.url()).searchParams.get('group');

function undecided(id: string, owner: number, setting: string) {
  return characterCandidate(id, owner, setting, { reviewedApplicationMode: null });
}

test('Alt+↓/↑로 후보 카드, Alt+Shift+↓/↑로 묶음을 옮기고 Alt+Enter는 확정 버튼에 초점만 둔다', async ({ page }) => {
  const { writes } = await routeCharacterReview(page, [
    undecided('a-1', 0, '직업'), undecided('a-2', 0, '소속'), undecided('a-3', 0, '거처'),
    undecided('b-1', 1, '직업'),
  ]);
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await card(page, 'a-1').focus();
  await page.keyboard.press('Alt+ArrowDown');
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(() => focusedCardId(page)).toBe('a-3');
  await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(() => focusedCardId(page)).toBe('a-2');

  await page.keyboard.press('Alt+Enter');
  await expect(primary(page)).toBeFocused();
  await expect(primary(page)).toBeDisabled();

  await card(page, 'a-1').focus();
  await page.keyboard.press('Alt+Shift+ArrowDown');
  await expect.poll(() => groupParam(page)).toBe(characterGroupKey(1));
  await expect(page.getByRole('heading', { name: '도윤1개 설정' })).toBeFocused();
  await page.keyboard.press('Alt+Shift+ArrowUp');
  await expect.poll(() => groupParam(page)).toBe(characterGroupKey(0));
  await expect(page.getByRole('heading', { name: '아린3개 설정' })).toBeFocused();

  // Alt+.은 다음 미결정 항목과 같다.
  await page.keyboard.press('Alt+Period');
  await expect.poll(() => focusedCardId(page)).toBe('a-1');
  expect(writes.filter(write => write.path.endsWith('/group-confirm'))).toHaveLength(0);
});

test('주 버튼이 열려 있어도 Alt+Enter는 확정 요청을 보내지 않는다', async ({ page }) => {
  const { writes } = await routeCharacterReview(page, [characterCandidate('a-1', 0, '직업'), characterCandidate('b-1', 1, '직업')]);
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await page.getByRole('heading', { name: '아린1개 설정' }).focus();
  await page.keyboard.press('Alt+Enter');
  await expect(primary(page)).toBeFocused();
  await expect(primary(page)).toBeEnabled();
  await page.waitForTimeout(200);
  expect(writes).toEqual([]);
});

test('묶음 경계에서 Alt+Shift+↓는 다음 페이지의 첫 묶음, ↑는 이전 페이지의 마지막 묶음을 연다', async ({ page }) => {
  await routeCharacterReview(page, [
    undecided('a-1', 0, '직업'), undecided('b-1', 1, '직업'), undecided('c-1', 2, '직업'),
  ], { groupPageSize: 2 });
  await page.goto(characterReviewUrl(characterGroupKey(1)));
  await page.getByRole('heading', { name: '도윤1개 설정' }).focus();
  await page.keyboard.press('Alt+Shift+ArrowDown');
  await expect.poll(() => groupParam(page)).toBe(characterGroupKey(2));
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  await expect(page.getByRole('heading', { name: '세라1개 설정' })).toBeFocused();
  await page.keyboard.press('Alt+Shift+ArrowUp');
  await expect.poll(() => groupParam(page)).toBe(characterGroupKey(1));
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('1');
  await expect(page.getByRole('heading', { name: '도윤1개 설정' })).toBeFocused();
});

test('입력창에 초점이 있거나 한글을 조합하는 중에는 Alt+↓를 처리하지 않는다', async ({ page }) => {
  await routeCharacterReview(page, [undecided('a-1', 0, '직업'), undecided('a-2', 0, '소속')]);
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await card(page, 'a-1').getByRole('button', { name: '수정', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const input = dialog.getByRole('textbox').last();
  await input.focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(input).toBeFocused();
  await dialog.getByRole('button', { name: '닫기' }).first().click();

  await card(page, 'a-1').focus();
  // 조합 중 키 입력(keyCode 229)은 단축키로 해석하지 않는다.
  await card(page, 'a-1').evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'ArrowDown', code: 'ArrowDown', altKey: true, isComposing: true, keyCode: 229, bubbles: true, cancelable: true,
  })));
  await expect.poll(() => focusedCardId(page)).toBe('a-1');
});

test('선택 카드는 방향키로 초점만 옮기고 Space로 고르면 한 번 저장한다', async ({ page }) => {
  const { writes } = await routeCharacterReview(page, [characterCandidate('a-1', 0, '직업', { reviewedApplicationMode: null })]);
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  const group = card(page, 'a-1').getByRole('radiogroup');
  const radios = group.getByRole('radio');
  await expect(radios).toHaveCount(2);
  await expect(radios.first()).toHaveAttribute('tabindex', '0');
  await expect(radios.nth(1)).toHaveAttribute('tabindex', '-1');
  await radios.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(radios.nth(1)).toBeFocused();
  await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'false');
  expect(writes).toEqual([]);
  await page.keyboard.press('Space');
  await expect.poll(() => writes.filter(write => write.method === 'PATCH' && write.path === `${characterListPath}/a-1`).length).toBe(1);
  await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(radios.first()).toBeFocused();
});

test('수정 창은 한글 조합 중 Esc로 닫지 않고, 조합이 끝난 Esc로 닫는다', async ({ page }) => {
  await routeCharacterReview(page, [undecided('a-1', 0, '직업')]);
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await card(page, 'a-1').getByRole('button', { name: '수정', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const input = dialog.getByRole('textbox').last();
  await input.focus();
  await input.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', code: 'Escape', isComposing: true, keyCode: 229, bubbles: true, cancelable: true,
  })));
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('세계관 수정 창은 Esc로 닫히고 연 버튼으로 초점이 돌아온다', async ({ page }) => {
  await routeWorldReview(page, [worldCandidate('w-1', '은빛 항구', '기후', { manualReviewAvailable: true })]);
  await page.goto(worldReviewUrl('LOCATION|은빛 항구'));
  const edit = card(page, 'w-1').getByRole('button', { name: '수정', exact: true });
  await edit.click();
  const dialog = page.getByRole('dialog', { name: /반영 내용 수정/ });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(edit).toBeFocused();
});

test('단축키 안내는 버튼으로 열고 Esc로 닫는다', async ({ page }) => {
  await routeCharacterReview(page, [characterCandidate('a-1', 0, '직업')]);
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  const toggle = page.getByRole('button', { name: '단축키', exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const help = page.getByRole('region', { name: '검토 단축키' });
  await expect(help).toContainText('Alt + ↓ / ↑');
  await expect(help).toContainText('Alt + Shift + ↓ / ↑');
  await expect(help).toContainText('Alt + Enter');
  await expect(help).toContainText('Alt + .');
  await page.keyboard.press('Escape');
  await expect(help).toHaveCount(0);
  await expect(toggle).toBeFocused();
});
