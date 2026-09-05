import { expect, test, type Page } from '@playwright/test';

const logoPath = '/brand/catchhole-glossy-v1.png';
const sharePath = '/brand/catchhole-share-v1.png';
const faviconPath = '/brand/catchhole-favicon-v1.png';
const touchIconPath = '/brand/catchhole-apple-touch-v1.png';
const workId = '00000000-0000-4000-8000-000000000001';

async function expectLogos(page: Page) {
  const logos = page.locator('.brand-logo:visible');
  await expect(logos.first()).toBeVisible();
  for (const logo of await logos.all()) {
    const image = logo.locator('.brand-logo__symbol');
    await expect(image).toHaveAttribute('src', logoPath);
    await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const box = await logo.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(24);
    const wordmark = logo.locator('.brand-logo__wordmark');
    await expect(wordmark).toBeVisible();
    await expect(wordmark.locator('img')).toHaveAttribute('src', '/brand/catchhole-wordmark.png');
    await expect.poll(() => wordmark.locator('img').evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const symbolBox = (await image.boundingBox())!;
    const wordmarkBox = (await wordmark.boundingBox())!;
    expect(wordmarkBox.x).toBeGreaterThanOrEqual(symbolBox.x + symbolBox.width);
    expect(wordmarkBox.x + wordmarkBox.width).toBeLessThanOrEqual(box!.x + box!.width + 1);
    expect(box!.width).toBeGreaterThan(box!.height);
    await expect(image).toHaveCSS('object-fit', 'contain');
  }
  await expect(page.locator('img[src*="catchhole-symbol"]')).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/auth/me')
      ? { id: 1, email: 'brand@example.com', displayName: '브랜드 검증', role: 'AUTHOR', status: 'ACTIVE' }
      : [];
    return route.fulfill({ json: { success: true, data, error: null } });
  });
});

for (const width of [1280, 390]) {
  test(`공개 화면은 승인 로고를 표시한다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/landing', '/login', '/signup', '/demo', '/terms', '/privacy']) {
      await page.goto(path);
      await expectLogos(page);
    }
  });

  test(`워크스페이스 로고와 작품 선택 이동을 유지한다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem('accessToken', 'brand-test-token'));
    await page.goto('/works');
    await expectLogos(page);
    await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);
    await expectLogos(page);
    await page.getByRole('button', { name: '작품 선택으로 이동', exact: true }).click();
    await expect(page).toHaveURL(/\/works$/);
  });
}

test('공유 크롤러는 JavaScript 없이 소개와 절대 이미지 URL을 읽는다', async ({ request }) => {
  const response = await request.get('/landing');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain('property="og:title" content="캐치홀 CatchHole | 웹소설 설정 관리"');
  expect(html).toContain('property="og:description" content="웹소설 원고에서 캐릭터와 세계관 설정을 정리하고, 원문 근거와 함께 확인하세요."');
  expect(html).toContain('property="og:image" content="https://www.catchhole.com' + sharePath + '"');
  expect(html).toContain('name="twitter:card" content="summary"');
  expect(html).toContain('rel="icon"');
  expect(html).toContain('sizes="32x32" href="' + faviconPath + '"');
  expect(html).toContain('sizes="180x180" href="' + touchIconPath + '"');
  for (const path of [logoPath, sharePath, faviconPath, touchIconPath]) {
    const image = await request.get(path);
    expect(image.ok()).toBeTruthy();
    expect(image.headers()['content-type']).toContain('image/png');
    expect((await image.body()).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  }
});

test('웹용 로고는 실제 투명 배경과 충분한 심볼 크기를 유지한다', async ({ page }) => {
  await page.goto('/landing');
  await expectLogos(page);
  const pixels = await page.locator('.brand-logo__symbol').first().evaluate(node => {
    const image = node as HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let opaque = 0;
    let minX = canvas.width;
    let maxX = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 128) {
        opaque += 1;
        const x = ((i - 3) / 4) % canvas.width;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    return {
      width: canvas.width,
      height: canvas.height,
      cornerAlpha: data[3],
      opaqueRatio: opaque / (canvas.width * canvas.height),
      markWidth: maxX - minX + 1,
    };
  });
  expect(pixels.width).toBe(512);
  expect(pixels.height).toBe(512);
  expect(pixels.cornerAlpha).toBe(0);
  expect(pixels.opaqueRatio).toBeGreaterThan(0.3);
  expect(pixels.opaqueRatio).toBeLessThan(0.8);
  expect(pixels.markWidth).toBeGreaterThan(440);
  expect(pixels.markWidth).toBeLessThan(475);
});
