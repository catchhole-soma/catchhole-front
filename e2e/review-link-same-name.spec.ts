import { expect, test, type Page } from '@playwright/test';
import { routeWorldReview, worldCandidate, worldReviewUrl, type MockWorldTarget } from './fixtures/review-group-mock';

// 새 대상 이름의 동명 검사는 검색 첫 페이지만 보지 않는다(`q`는 대상명·설정명·값의 부분 일치). 합성 대상만 쓴다.
const fillers = (count: number): MockWorldTarget[] => Array.from({ length: count }, (_, index) => ({
  id: `86${String(index).padStart(6, '0')}-0000-4000-8000-000000000000`, category: 'LOCATION', subjectName: `은빛 항구 별관 ${index}`, properties: [],
}));

async function openNewTarget(page: Page) {
  await page.goto(worldReviewUrl('LOCATION|항구'));
  await page.getByRole('checkbox', { name: /모두 선택/ }).check();
  await page.getByRole('region', { name: '선택한 설정' }).getByRole('button', { name: '선택 항목 대상 연결', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '선택 항목 대상 연결' });
  await dialog.getByRole('radio', { name: /^새 대상으로 등록/ }).click();
  await dialog.getByLabel('새 대상 이름').fill('은빛 항구');
  return dialog;
}

test('같은 이름의 기존 대상이 검색 첫 페이지 밖에 있어도 찾아 새로 등록하지 않게 한다', async ({ page }) => {
  const exact: MockWorldTarget = { id: '87777777-7777-4777-8777-777777777777', category: 'LOCATION', subjectName: '은빛 항구',
    properties: [{ scopeName: null, settingName: '기후', value: '온화하다' }] };
  await routeWorldReview(page, [worldCandidate('a-1', '항구', '기후')], { targets: [...fillers(120), exact] });
  const dialog = await openNewTarget(page);
  const warning = dialog.getByRole('alert').filter({ hasText: '같은 이름의 대상 ‘은빛 항구’이 이미 있어요' });
  await expect(warning).toBeVisible();
  await expect(dialog.getByRole('button', { name: '고른 대상에 연결', exact: true })).toBeDisabled();
});

test('끝까지 확인하지 못하면 새 대상 등록을 열지 않고 기존 대상 검색이나 이름 변경을 안내한다', async ({ page }) => {
  await routeWorldReview(page, [worldCandidate('a-1', '항구', '기후')], { targets: fillers(520) });
  const dialog = await openNewTarget(page);
  await expect(dialog.getByRole('alert').filter({ hasText: '같은 이름의 기존 대상이 있는지 확인하지 못했어요 — 기존 대상을 검색해 고르거나 이름을 바꿔 주세요.' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '고른 대상에 연결', exact: true })).toBeDisabled();
  // 다른 이름(부분 일치가 적은 이름)은 새로 등록할 수 있다.
  await dialog.getByLabel('새 대상 이름').fill('잿빛 요새');
  await expect(dialog.getByRole('button', { name: '고른 대상에 연결', exact: true })).toBeEnabled();
});
