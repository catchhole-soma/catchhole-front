import { expect, test } from '@playwright/test';

for (const veto of [false, true]) test(veto
  ? '첫 포커스의 자식 입력이 취소한 Escape는 수정안을 보존한다'
  : '첫 포커스의 일반 Escape는 닫기 콜백을 정확히 한 번 호출한다', async ({ page }) => {
  await page.addInitScript(veto => {
    const firstFocus = (event: FocusEvent) => {
      const heading = event.target;
      if (!(heading instanceof HTMLElement) || heading.tagName !== 'H2'
        || heading.textContent !== '첫 포커스 키보드 계약') return;
      document.removeEventListener('focusin', firstFocus, true);
      const target = veto ? heading.closest('[role=dialog]')?.querySelector('textarea') : heading;
      if (!(target instanceof HTMLElement)) throw new Error('첫 포커스 입력을 찾지 못했습니다.');
      if (veto) target.focus();
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      sessionStorage.setItem('dialog-first-focus-sent', 'true');
    };
    document.addEventListener('focusin', firstFocus, true);
  }, veto);
  await page.goto('/demo');
  await page.evaluate(async veto => {
    const path = '/e2e/fixtures/dialog-escape.tsx';
    (await import(/* @vite-ignore */ path)).mountDialogEscape(veto);
  }, veto);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('dialog-first-focus-sent'))).toBe('true');
  const dialog = page.getByRole('dialog', { name: '첫 포커스 키보드 계약' });
  if (veto) {
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('보존할 수정안')).toHaveValue('보존할 수정안');
    await expect(page.getByTestId('dialog-close-count')).toHaveText('0');
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  }
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId('dialog-close-count')).toHaveText('1');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('dialog-close-count')).toHaveText('1');
});
