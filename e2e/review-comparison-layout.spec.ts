import { expect, test, type Page } from '@playwright/test';

const before = '최대 두 개의 정수를 흡수할 수 있다.';
const after = '최대 세 개의 정수를 흡수할 수 있다.\n흡수한 정수는 같은 효과가 겹치지 않는다.';
const longMeta = '범위: 2레벨 · 최대 흡수 가능 개수 · 과거 원정에서 확인한 상세 조건과 예외를 모두 포함한 설정';
async function mount(page: Page, props: { beforeLabel?: string; afterLabel?: string; beforeMeta?: string; afterMeta?: string } = {}) {
  await page.goto('/demo');
  await page.evaluate(async props => {
    const path = '/e2e/fixtures/review-comparison.tsx';
    (await import(/* @vite-ignore */ path)).mountReviewComparison(props);
  }, { before, after, ...props });
  await expect(page.locator('.review-cb-comparison')).toBeVisible();
}
async function valuePositions(page: Page) {
  return page.locator('.review-cb-comparison__column').evaluateAll(columns => columns.map(column => {
    const label = column.querySelector('.review-cb-comparison__label')!.getBoundingClientRect();
    const value = column.querySelector('.review-cb-comparison__value')!.getBoundingClientRect();
    const meta = column.querySelector('.review-cb-comparison__meta')?.getBoundingClientRect();
    return { labelTop: label.top, labelBottom: label.bottom, top: value.top, bottom: value.bottom, left: value.left, width: value.width, metaHeight: meta?.height ?? 0 };
  }));
}

test('왼쪽에만 긴 범위 정보가 있어도 두 설정 본문이 같은 높이에서 시작한다', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await mount(page, { beforeMeta: longMeta });
  const [left, right] = await valuePositions(page);
  expect(Math.abs(left.top - right.top)).toBeLessThan(1);
  expect(Math.abs(left.bottom - right.bottom)).toBeLessThan(1);
  expect(left.metaHeight).toBeGreaterThan(35);
  expect(Math.abs(left.metaHeight - right.metaHeight)).toBeLessThan(1);
  await expect(page.locator('.is-after .review-cb-comparison__meta')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.is-before .review-cb-comparison__value p')).toHaveText(before);
  await expect(page.locator('.is-after .review-cb-comparison__value p')).toHaveText(after);
  await page.screenshot({ path: '/tmp/gh215-diff-alignment-desktop.png' });
});

test('제목과 반대쪽 범위 설명의 길이가 달라도 제목·메타·본문 행을 공유한다', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 1000 });
  await mount(page, { beforeLabel: '기존에 저장되어 있는 설정과 해당 시점에 이미 확인을 마친 내용을 비교할 때 사용하는 아주 긴 제목', beforeMeta: '범위: 2레벨', afterMeta: longMeta.repeat(3) });
  const [left, right] = await valuePositions(page);
  expect(Math.abs(left.labelBottom - right.labelBottom)).toBeLessThan(1);
  expect(Math.abs(left.metaHeight - right.metaHeight)).toBeLessThan(1);
  expect(Math.abs(left.top - right.top)).toBeLessThan(1);
  expect(Math.abs(left.width - right.width)).toBeLessThan(2);
});

test('한 줄씩 보기는 빈 정렬용 메타 행 없이 각각 제목 다음에 내용을 표시한다', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 1100 });
  await mount(page, { beforeMeta: longMeta });
  await page.getByRole('button', { name: '한 줄씩', exact: true }).click();
  const [left, right] = await valuePositions(page);
  expect(right.labelTop).toBeGreaterThanOrEqual(left.bottom);
  expect(Math.abs(right.top - right.labelBottom)).toBeLessThan(1);
  await expect(page.locator('.is-after .review-cb-comparison__meta')).toBeHidden();
  await expect(page.getByText(longMeta, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '나란히', exact: true }).click();
  const restored = await valuePositions(page);
  expect(Math.abs(restored[0].top - restored[1].top)).toBeLessThan(1);
});

test('320px에서는 기존·새 값 순서와 메타 내용을 보존하고 가로 넘침과 빈 메타 공백이 없다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1200 });
  await mount(page, { beforeMeta: longMeta });
  const [left, right] = await valuePositions(page);
  expect(right.labelTop).toBeGreaterThanOrEqual(left.bottom);
  expect(Math.abs(right.top - right.labelBottom)).toBeLessThan(1);
  await expect(page.locator('.is-after .review-cb-comparison__meta')).toBeHidden();
  await expect(page.getByText(longMeta, { exact: true })).toBeVisible();
  expect(await page.locator('.review-cb-comparison').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/gh215-diff-alignment-mobile.png' });
});

test('범위 정보가 없는 캐릭터 비교에는 빈 메타 행이 생기지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await mount(page);
  await expect(page.locator('.review-cb-comparison__meta')).toHaveCount(0);
  const [left, right] = await valuePositions(page);
  expect(Math.abs(left.top - left.labelBottom)).toBeLessThan(1);
  expect(Math.abs(right.top - right.labelBottom)).toBeLessThan(1);
  expect(Math.abs(left.top - right.top)).toBeLessThan(1);
});
