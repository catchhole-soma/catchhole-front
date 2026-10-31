import { expect, test } from '@playwright/test';
import {
  characterCandidate, characterGroupKey, characterReviewUrl, routeCharacterReview, routeWorldReview, worldCandidate, worldReviewUrl,
} from './fixtures/review-group-mock';

// 선택 연결 요청은 한 번에 100건까지다(캐릭터 selected-character-match·세계관 PATCH /decisions). 합성 데이터만 쓴다.
const limitText = '한 번에 100개까지 연결할 수 있어요. 선택을 줄여 주세요.';

test('캐릭터: 101개를 선택하면 선택 항목 연결을 잠그고 100개로 줄이면 연결할 수 있다', async ({ page }) => {
  const { writes } = await routeCharacterReview(page, Array.from({ length: 101 }, (_, index) => characterCandidate(`c-${index}`, 0, `상태 ${index}`)));
  await page.goto(characterReviewUrl(characterGroupKey(0)));
  await page.getByRole('checkbox', { name: '모두 선택(101)' }).check();
  const bar = page.getByRole('region', { name: '선택한 설정' });
  await expect(bar).toContainText('101개 선택');
  await expect(bar.getByRole('alert')).toHaveText(limitText);
  const link = bar.getByRole('button', { name: '선택 항목 연결', exact: true });
  await expect(link).toBeDisabled();
  await page.getByRole('checkbox', { name: '선택: 상태 0', exact: true }).uncheck();
  await expect(bar).toContainText('100개 선택');
  await expect(bar.getByRole('alert')).toHaveCount(0);
  await expect(link).toBeEnabled();
  await link.click();
  await expect(page.getByRole('dialog', { name: '선택 항목 연결' })).toBeVisible();
  expect(writes).toEqual([]);
});

test('세계관: 101개 원문을 선택하면 선택 항목 대상 연결을 잠그고 100개로 줄이면 연결할 수 있다', async ({ page }) => {
  await routeWorldReview(page, Array.from({ length: 101 }, (_, index) => worldCandidate(`w-${index}`, '은빛 항구', `설정 ${index}`)));
  await page.goto(worldReviewUrl('LOCATION|은빛 항구'));
  await page.getByRole('checkbox', { name: '모두 선택(101)' }).check();
  const bar = page.getByRole('region', { name: '선택한 설정' });
  await expect(bar).toContainText('101개 선택');
  await expect(bar.getByRole('alert')).toHaveText(limitText);
  const link = bar.getByRole('button', { name: '선택 항목 대상 연결', exact: true });
  await expect(link).toBeDisabled();
  await page.getByRole('checkbox', { name: '선택: 설정 0', exact: true }).uncheck();
  await expect(bar).toContainText('100개 선택');
  await expect(bar.getByRole('alert')).toHaveCount(0);
  await expect(link).toBeEnabled();
  await link.click();
  await expect(page.getByRole('dialog', { name: '선택 항목 대상 연결' })).toBeVisible();
});
