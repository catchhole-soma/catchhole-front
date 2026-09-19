import { expect, test } from '@playwright/test';

test('새 이미지 준비는 코드 없이 PNG와 썸네일을 만들고 잘못된 파일을 거절한다', async ({ page }) => {
  await page.goto('/login');
  const result = await page.evaluate(async () => {
    const path = '/src/app/lib/private-image-upload.ts';
    const { preparePrivateImage } = await import(/* @vite-ignore */ path);
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 600;
    canvas.getContext('2d')!.fillRect(0, 0, 800, 600);
    const jpeg = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/jpeg'));
    const prepared = await preparePrivateImage(new File([jpeg], '고블린.jpg', { type: 'image/jpeg' }));
    const thumbnail = await createImageBitmap(prepared.thumbnail);
    async function rejected(file: File) { try { await preparePrivateImage(file); return false; } catch { return true; } }
    const result = { name: prepared.name, type: prepared.image.type, width: thumbnail.width, height: thumbnail.height,
      signature: Array.from(new Uint8Array(await prepared.image.arrayBuffer()).slice(0, 8)),
      noKey: !('vaultId' in prepared) && !('encryptedMetadata' in prepared),
      svg: await rejected(new File(['<svg/>'], 'image.png', { type: 'image/png' })),
      empty: await rejected(new File([], 'empty.png')), oversized: await rejected(new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'large.png')) };
    thumbnail.close(); return result;
  });
  expect(result).toEqual({ name: '고블린.jpg', type: 'image/png', width: 480, height: 360,
    signature: [137, 80, 78, 71, 13, 10, 26, 10], noKey: true, svg: true, empty: true, oversized: true });
});

test('계정 변경은 이전 세션의 이미지와 목록을 숨기고 기존 암호화 이미지는 교체를 안내한다', async ({ page }) => {
  await page.route('**/api/v1/works/fixture/private-world-images*', route => route.fulfill({ contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { content: [{ id: 'legacy', vaultId: 'old-vault' }], totalPages: 1 } }) }));
  await page.goto('/login');
  await page.evaluate(async () => {
    const path = '/e2e/fixtures/private-image-picker.tsx';
    (await import(/* @vite-ignore */ path)).mountPrivatePicker();
  });
  await expect(page.getByText('이미지를 다시 올려 주세요', { exact: true })).toBeVisible();
  await expect(page.getByLabel('내 이미지 파일 선택')).toBeAttached();
  await expect(page.getByLabel('보관용 코드', { exact: true })).toHaveCount(0);
  await page.route('**/api/v1/works/fixture/private-world-images*', route => route.fulfill({ status: 404,
    contentType: 'application/json', body: JSON.stringify({ success: false, message: '작품을 찾을 수 없어요.' }) }));
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', newValue: 'changed-account' })));
  await expect(page.getByText('이미지를 다시 올려 주세요', { exact: true })).toHaveCount(0);
});
