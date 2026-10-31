import { expect, test, type Page } from '@playwright/test';
import {
  characterCandidate, characterGroupKey, characterListPath, characterReviewUrl, routeCharacterReview,
  routeWorldReview, worldCandidate, worldListPath, worldReviewUrl,
} from './fixtures/review-group-mock';

// #211 후속 3차: `확정하고 다음`은 기존 그룹 확정 요청 그대로이고, 성공 뒤 직전 목록 순서의 다음 묶음으로 간다.
const bar = (page: Page) => page.getByRole('region', { name: '묶음 확정', exact: true });
const primary = (page: Page) => bar(page).locator('[data-review-primary-action]');
const main = (page: Page) => page.locator('.setting-review-main');
const groupParam = (page: Page) => new URL(page.url()).searchParams.get('group');

test('캐릭터: 확정하고 다음은 그 묶음의 대기 후보 전원을 한 번 확정하고 다음 묶음 제목에서 다시 읽게 한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  const { writes } = await routeCharacterReview(page, [
    characterCandidate('a-1', 0, '직업'),
    ...Array.from({ length: 4 }, (_, index) => characterCandidate(`b-${index}`, 1, `상태 ${index}`)),
    characterCandidate('c-1', 2, '거처'),
  ], { worldPending: 2 });
  await page.goto(characterReviewUrl(characterGroupKey(1)));
  await expect(page.getByRole('heading', { name: '도윤4개 설정' })).toBeVisible();
  await main(page).evaluate(element => { element.scrollTop = 300; });
  await expect(primary(page)).toHaveText('확정하고 다음');
  await primary(page).click();

  await expect.poll(() => groupParam(page)).toBe(characterGroupKey(2));
  await expect(page.getByRole('heading', { name: '세라1개 설정' })).toBeFocused();
  await expect.poll(() => main(page).evaluate(element => element.scrollTop)).toBe(0);
  const confirms = writes.filter(write => write.path === `${characterListPath}/group-confirm`);
  expect(confirms).toHaveLength(1);
  expect((confirms[0].body!.candidates as Array<{ candidateId: string }>).map(item => item.candidateId)).toEqual(['b-0', 'b-1', 'b-2', 'b-3']);

  // 앞쪽 묶음(아린)이 남아 있으므로 마지막 줄의 묶음도 `확정하고 다음`이며 남은 묶음으로 돌아간다.
  await expect(primary(page)).toHaveText('확정하고 다음');
  await primary(page).click();
  await expect.poll(() => groupParam(page)).toBe(characterGroupKey(0));
  await expect(page.getByRole('heading', { name: '아린1개 설정' })).toBeFocused();

  // 탭의 마지막 묶음은 `모두 확정`이고, 확정 뒤 다른 탭으로 자동 전환하지 않고 완료 상태와 이동 버튼을 보여 준다.
  await expect(primary(page)).toHaveText('모두 확정');
  await primary(page).click();
  await expect(page.getByText('캐릭터 검토를 마쳤어요', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/세계관 후보 2개가 남았어요/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '세계관 후보 검토로', exact: true }).first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get('candidateType')).toBeNull();
  expect(writes.filter(write => write.path === `${characterListPath}/group-confirm`)).toHaveLength(3);
});

test('캐릭터: 확정 요청 중에는 주 버튼을 잠그고 확정 중으로 표시한다', async ({ page }) => {
  await routeCharacterReview(page, [characterCandidate('a-1', 0, '직업'), characterCandidate('b-1', 1, '직업')]);
  let release: () => void = () => undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**${characterListPath}/group-confirm`, async route => {
    await held;
    await route.fallback();
  });
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await primary(page).click();
  await expect(primary(page)).toHaveText('확정 중…');
  await expect(primary(page)).toBeDisabled();
  release();
  await expect.poll(() => groupParam(page)).toBe(characterGroupKey(1));
  await expect(primary(page)).toHaveText('모두 확정');
});

test('세계관: 확정하고 다음으로 다음 대상을 열고, 마지막 대상 뒤에는 완료 상태와 캐릭터 이동 버튼을 보여 준다', async ({ page }) => {
  const { writes } = await routeWorldReview(page, [
    worldCandidate('harbor-1', '은빛 항구', '기후'),
    worldCandidate('harbor-2', '은빛 항구', '인구'),
    worldCandidate('fort-1', '잿빛 요새', '규모'),
  ], { characterPending: 3 });
  await page.goto(worldReviewUrl('LOCATION|은빛 항구'));
  await expect(primary(page)).toHaveText('확정하고 다음');
  await primary(page).click();
  await expect.poll(() => groupParam(page)).toBe('LOCATION|잿빛 요새');
  await expect(page.locator('[data-review-group-title]')).toBeFocused();
  const confirms = writes.filter(write => write.path === `${worldListPath}/group-confirm`);
  expect(confirms).toHaveLength(1);
  expect((confirms[0].body!.candidates as Array<{ candidateId: string }>).map(item => item.candidateId)).toEqual(['harbor-1', 'harbor-2']);

  await expect(primary(page)).toHaveText('모두 확정');
  await primary(page).click();
  await expect(page.getByText('세계관 검토를 마쳤어요', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/캐릭터 후보 3개가 남았어요/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '캐릭터 후보 검토로', exact: true }).first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get('candidateType')).toBe('world');
});
