import { expect, test } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const characterId = '22222222-2222-4222-8222-222222222222';
for (const width of [1440, 1280, 1024, 390, 320]) {
  test(`${width}px 캐릭터 편집의 상태·소지품·능력 삭제 버튼이 잘리지 않고 동작한다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const setting = (prefix: string, name: string) => ({ key: `${prefix}.${name}`, displayName: name, value: '설정 내용',
      valueType: 'STRING', attributeNameEditable: true, attributeNamePrefix: `${prefix}.`, displayNameEditable: true,
      properties: [], sourceFacts: [{ characterFactId: 'fact', hasEvidence: true, episodeNo: 1 }], hasEvidence: true });
    const detail = { id: characterId, name: '검증 인물', profile: [setting('profile', '가족')], stats: [setting('stats', '지식')],
      skills: [setting('skill', '검술')], items: [setting('item', '칼')], statuses: [setting('status', '부상'), setting('status', '사망')] };
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname;
      const data = path.endsWith('/auth/me') ? { id: 1, email: 'layout@example.invalid', displayName: '검증', role: 'AUTHOR', status: 'ACTIVE' }
        : path.endsWith(`/characters/${characterId}`) ? detail
        : path.endsWith('/characters') ? { content: [detail], page: 0, totalPages: 1, totalElements: 1, size: 20 }
        : path.endsWith(`/works/${workId}`) ? { id: workId, title: '검증 작품', genre: '판타지' }
        : path.endsWith('/works') ? [{ id: workId, title: '검증 작품', genre: '판타지' }] : [];
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    });
    await page.addInitScript(() => localStorage.setItem('accessToken', 'layout-fixture'));
    await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=characters&modal=char-detail&charId=${characterId}&mode=edit`);
    for (const name of ['부상', '사망', '칼', '검술', '지식', '가족']) {
      const button = page.getByRole('button', { name: `${name} 제거`, exact: true });
      await button.scrollIntoViewIfNeeded();
      const row = button.locator('xpath=ancestor::*[contains(@class,"character-edit-setting-row")]');
      const rowBox = (await row.boundingBox())!;
      const box = (await button.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1);
      expect(box.width).toBeGreaterThanOrEqual(44);
      if (name === '부상') await page.screenshot({ path: `/tmp/catchhole-gh219-edit-${width}.png` });
      await button.click();
      await expect(button).toHaveCount(0);
    }
  });
}
