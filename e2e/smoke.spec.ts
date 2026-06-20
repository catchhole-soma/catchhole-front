import { test, expect } from '@playwright/test';

// 실제 로그인/작품선택(백엔드 연동)은 검증하지 않음 — accessToken을 직접 주입해
// "이미 인증된 상태"만 흉내 내고, 그 상태에서 /dashboard 렌더링이 깨지지 않는지만 확인한다.
test('백엔드 없이 /dashboard 렌더링이 깨지지 않는다', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'mock'));

  await page.goto('/dashboard');

  const backendPrompt = page.getByText('닫기', { exact: true });
  if (await backendPrompt.count()) {
    await backendPrompt.click();
  }

  await expect(page.getByText('설정 대시보드', { exact: true })).toBeVisible();
  await expect(page.getByText('캐릭터 DB', { exact: true })).toBeVisible();
});
