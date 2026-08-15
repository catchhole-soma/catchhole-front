import { expect, test } from '@playwright/test';

test('랜딩 데모는 전체 설정 관리 흐름을 직접 탐색하고 재생을 제어할 수 있다', async ({ page }) => {
  await page.goto('/landing');

  const demo = page.locator('.landing-demo');
  await expect(demo).toBeVisible();
  const stage = demo.locator('.landing-demo__native-stage');
  await expect(stage.getByText('마나 0의 짐꾼', { exact: true }).first()).toBeVisible();

  const pauseButton = demo.getByRole('button', { name: '자동 재생 일시정지' });
  await pauseButton.click();
  await expect(demo.getByRole('button', { name: '자동 재생 시작' })).toBeVisible();

  await demo.getByRole('tab', { name: '3단계 원고 분석' }).click();
  await expect(stage.locator('.landing-native-processing__spinner')).toBeVisible();

  await demo.getByRole('tab', { name: '4단계 설정 후보 추출' }).click();
  await expect(stage.locator('.landing-native-review-tabs .is-active')).toContainText('세계관 후보');
  await expect(stage.getByText('거꾸로숲', { exact: true }).first()).toBeVisible();

  await demo.getByRole('tab', { name: '5단계 후보 비교와 확정' }).click();
  await expect(stage.locator('.landing-native-review-tabs .is-active')).toContainText('캐릭터 후보');
  await expect(stage.getByText('에단 렌', { exact: true }).first()).toBeVisible();
  await expect(stage.getByText('재액 운반자', { exact: true }).first()).toBeVisible();

  await demo.getByRole('tab', { name: '6단계 작품 설정 전체 목록' }).click();
  await expect(stage.getByText('캐릭터 설정', { exact: true }).first()).toBeVisible();
  await expect(stage.locator('.landing-native-character-modal')).toHaveCount(0);

  await demo.getByRole('tab', { name: '7단계 캐릭터 상세 모달' }).click();
  await expect(stage.locator('.landing-native-character-modal')).toBeVisible();
  await expect(stage.getByText('재액 운반자', { exact: true }).first()).toBeVisible();

  await demo.getByRole('tab', { name: '8단계 변화 이력 전체 보기' }).click();
  await expect(stage.locator('.landing-native-timeline-modal')).toBeVisible();
  await expect(stage.getByText('전체 보기', { exact: true })).toHaveClass(/is-active/);
  await expect(stage.getByText('저주 반전', { exact: true })).toBeVisible();
});

test('랜딩 데모의 모든 장면은 휴대폰에서도 가려지거나 가로로 넘치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/landing');

  const demo = page.locator('.landing-demo');
  await demo.getByRole('button', { name: '자동 재생 일시정지' }).click();

  for (let index = 1; index <= 8; index += 1) {
    await demo.getByRole('tab', { name: new RegExp(`^${index}단계`) }).click();
    await expect.poll(() => demo.locator('.landing-demo__viewport').evaluate(element => ({
      horizontal: element.scrollWidth <= element.clientWidth + 1,
      vertical: element.scrollHeight <= element.clientHeight + 1,
    }))).toEqual({ horizontal: true, vertical: true });
  }

  await expect.poll(() => page.locator('.landing-page').evaluate(element => (
    element.scrollWidth <= element.clientWidth + 1
  ))).toBe(true);
});
