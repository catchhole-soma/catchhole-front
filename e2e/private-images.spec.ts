import { expect, test } from '@playwright/test';

test('브라우저에서 암호화한 원본·썸네일·파일명은 올바른 키와 대상에서만 열린다', async ({ page }) => {
  await page.goto('/login');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/app/lib/private-image-crypto.ts';
    const crypto = await import(/* @vite-ignore */ modulePath);
    const vault = await crypto.createPrivateImageVault();
    const otherVault = await crypto.createPrivateImageVault();
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60;
    canvas.getContext('2d')!.fillRect(0, 0, 80, 60);
    const png = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
    const file = new File([png], '비공개-고블린.png', { type: 'image/png' });
    const encrypted = await crypto.encryptPrivateImage(file, vault.id, vault.key);
    const second = await crypto.encryptPrivateImage(file, vault.id, vault.key);
    const openedKey = await crypto.openPrivateImageVault(vault.id, vault.keyCheck, vault.recoveryKey);
    const original = await crypto.decryptPrivateImage(openedKey, vault.id, encrypted.id, 'image', await encrypted.image.arrayBuffer());
    const thumbnail = await crypto.decryptPrivateImage(openedKey, vault.id, encrypted.id, 'thumbnail', await encrypted.thumbnail.arrayBuffer());
    const metadata = await crypto.decryptPrivateImageMetadata(openedKey, vault.id, encrypted.id, encrypted.encryptedMetadata);
    async function rejected(promise: Promise<unknown>) { try { await promise; return false; } catch { return true; } }
    const tampered = new Uint8Array(await encrypted.image.arrayBuffer()); tampered[tampered.length - 1] ^= 1;
    const source = new Uint8Array(await file.arrayBuffer());
    return {
      roundtrip: original.size === file.size && new Uint8Array(await original.arrayBuffer()).every((v, i) => v === source[i]),
      thumbnailType: thumbnail.type, name: metadata.name, nonextractable: !openedKey.extractable,
      header: new TextDecoder().decode((await encrypted.image.arrayBuffer()).slice(0, 4)),
      metadataHidden: !atob(encrypted.encryptedMetadata).includes('png'),
      distinct: await encrypted.image.text() !== await second.image.text(),
      wrongKey: await rejected(crypto.openPrivateImageVault(vault.id, vault.keyCheck, otherVault.recoveryKey)),
      tamper: await rejected(crypto.decryptPrivateImage(openedKey, vault.id, encrypted.id, 'image', tampered.buffer)),
      wrongObject: await rejected(crypto.decryptPrivateImage(openedKey, vault.id, second.id, 'image', await encrypted.image.arrayBuffer())),
      wrongPart: await rejected(crypto.decryptPrivateImage(openedKey, vault.id, encrypted.id, 'thumbnail', await encrypted.image.arrayBuffer())),
    };
  });
  expect(result).toMatchObject({ roundtrip: true, thumbnailType: 'image/webp', name: '비공개-고블린.png', nonextractable: true,
    header: 'CHI1', metadataHidden: true, distinct: true, wrongKey: true, tamper: true, wrongObject: true, wrongPart: true });
});

test('세션 종료나 다른 탭의 계정 변경은 메모리 키를 지우고 늦은 잠금 해제를 거절한다', async ({ page }) => {
  await page.goto('/login');
  const result = await page.evaluate(async () => {
    const keysPath = '/src/app/lib/private-image-keys.ts';
    const keys = await import(/* @vite-ignore */ keysPath);
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const epoch = keys.privateImageSessionEpoch();
    keys.unlockPrivateImageKey('fixture', key, epoch);
    const opened = keys.privateImageKeySnapshot().size;
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', newValue: 'another-session' }));
    let lateRejected = false;
    try { keys.unlockPrivateImageKey('fixture', key, epoch); } catch { lateRejected = true; }
    return { opened, remaining: keys.privateImageKeySnapshot().size, lateRejected };
  });
  expect(result).toEqual({ opened: 1, remaining: 0, lateRejected: true });
});

test('다른 탭에서 계정을 바꾸면 준비한 보관용 코드와 생성 초안도 폐기한다', async ({ page }) => {
  const creations: string[] = [];
  await page.route('**/api/v1/private-image-vaults', async route => {
    if (route.request().method() === 'POST') creations.push(route.request().postDataJSON().id);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) });
  });
  await page.goto('/login');
  await page.evaluate(async () => {
    const path = '/e2e/fixtures/private-image-vault.tsx';
    (await import(/* @vite-ignore */ path)).mountVaultGate();
  });
  await page.getByRole('button', { name: '내 이미지 시작하기', exact: true }).click();
  const originalCode = await page.getByLabel('내 보관용 코드', { exact: true }).inputValue();
  await page.getByRole('checkbox', { name: '코드를 안전한 곳에 저장했어요.' }).check();
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken', newValue: 'changed-account' })));
  await expect(page.getByLabel('내 보관용 코드', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '보관함 사용하기', exact: true })).toHaveCount(0);
  expect(creations).toHaveLength(0);
  await page.getByRole('button', { name: '내 이미지 시작하기', exact: true }).click();
  await expect(page.getByLabel('내 보관용 코드', { exact: true })).not.toHaveValue(originalCode);
  await expect(page.getByRole('button', { name: '보관함 사용하기', exact: true })).toBeDisabled();
});
