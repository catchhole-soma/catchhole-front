import { expect, test, type Locator } from '@playwright/test';

// Explicit asset refresh only: current production components with public /demo fixtures.
// Never capture authenticated user manuscripts or change the product UI for the shot.
test('현재 제품 컴포넌트에서 랜딩 미리보기 이미지를 갱신한다', async ({ page }) => {
  test.skip(process.env.CATCHHOLE_CAPTURE_LANDING !== '1', '명시적인 랜딩 에셋 갱신에서만 실행');
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/demo');
  const capture = async (target: Locator, name: string) => {
    await expect(target).toBeVisible();
    await target.screenshot({
      path: `src/assets/landing/product-${name}-20261012.png`,
      animations: 'disabled',
      style: '.interactive-demo-header, .interactive-demo-coachmark, .interactive-demo-guide-focus-layer { visibility: hidden !important; } .interactive-demo-guided-target { outline: none !important; box-shadow: none !important; }',
    });
  };
  await capture(page.locator('.interactive-demo-manuscript__paper'), 'manuscript');
  await page.getByRole('button', { name: 'AI 분석 시작', exact: true }).click();
  await page.getByRole('button', { name: '설정 후보 검토', exact: true }).click();
  const review = page.getByRole('region', { name: '직업 설정 후보', exact: true });
  await review.locator('summary').click();
  await capture(review, 'review');
  await page.setViewportSize({ width: 390, height: 1400 });
  await capture(review, 'review-mobile');
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.getByRole('button', { name: '1개 설정 모두 확정', exact: true }).click();
  await page.getByRole('button', { name: '수정', exact: true }).click();
  await page.getByRole('textbox', { name: '최종 내용' }).fill('수호자의 이름이 지워지면 모든 귀환문이 즉시 닫힌다.');
  await page.getByRole('button', { name: '이 내용으로 검토 완료' }).click();
  await page.getByRole('button', { name: '모두 확정', exact: true }).click();
  await page.getByRole('button', { name: '제외', exact: true }).click();
  await page.getByRole('button', { name: '에단 렌 캐릭터 상세 보기' }).click();
  const character = page.getByRole('dialog', { name: '에단 렌 캐릭터 상세', exact: true });
  await capture(character, 'character');
  await character.getByRole('button', { name: '변화 이력 보기' }).click();
  await character.getByRole('button', { name: '직업 변화 이력 추가' }).click();
  const timeline = page.getByRole('dialog', { name: '캐릭터 설정 이력', exact: true });
  await expect(timeline.getByText('짐꾼', { exact: true })).toBeVisible();
  await expect(timeline.getByText('재액 운반자', { exact: true })).toBeVisible();
  await capture(timeline, 'timeline');
  await character.getByRole('button', { name: '이력 닫기' }).click();
  await character.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('tab', { name: '세계관 설정', exact: true }).click();
  await page.getByRole('button', { name: '거꾸로숲 세계관 대상 보기' }).click();
  await capture(page.locator('.world-setting-detail-card'), 'world');
});
