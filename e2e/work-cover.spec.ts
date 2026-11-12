import { expect, test } from '@playwright/test';

test('표지 삭제 초안을 취소하고 실패·충돌 후 최신 버전으로 다시 저장한다', async ({ page }) => {
  let work = { id: 'cover-work', title: '표지 작품', genre: '판타지', description: '소개',
    latestEpisodeNo: 0, lifecycleStatus: 'ACTIVE', coverImageId: 'cover-one' as string | null, coverVersion: 1 };
  let attempt = 0;
  const versions: number[] = [];
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPj8AAAAASUVORK5CYII=', 'base64');
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { success: true,
    data: { id: 1, email: 'cover@example.invalid', displayName: '표지 작가', role: 'AUTHOR', status: 'ACTIVE' } } }));
  await page.route('**/api/v1/works', route => route.fulfill({ json: { success: true, data: [work] } }));
  await page.route('**/api/v1/works/cover-work/cover/*', route => {
    expect(route.request().headers().authorization).toBe('Bearer cover-token');
    return route.fulfill({ contentType: 'image/png', body: png });
  });
  await page.route('**/api/v1/works/cover-work/cover', async route => {
    const body = route.request().postData()!;
    expect(route.request().headers()['content-type']).toContain('multipart/form-data; boundary=');
    expect(body).toContain('Content-Type: application/json');
    const metadata = JSON.parse(body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1));
    expect(metadata.action).toBe('REMOVE');
    versions.push(metadata.expectedCoverVersion);
    attempt += 1;
    if (attempt === 1) return route.fulfill({ status: 500, json: { success: false,
      error: { code: 'COMMON_INTERNAL_SERVER_ERROR', status: 500, details: [] } } });
    if (attempt === 2) {
      work = { ...work, coverImageId: 'cover-two', coverVersion: 2 };
      return route.fulfill({ status: 409, json: { success: false,
        error: { code: 'WORK_COVER_CONFLICT', status: 409, details: [] } } });
    }
    work = { ...work, coverImageId: null, coverVersion: 3 };
    return route.fulfill({ json: { success: true, data: work } });
  });
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'cover-token'));
  await page.goto('/works');
  const dialog = page.getByRole('dialog', { name: '작품 정보 수정' });
  const open = async () => {
    await page.getByRole('button', { name: '표지 작품 작품 선택' }).hover();
    await page.getByRole('button', { name: '표지 작품 수정', exact: true }).click();
    await expect(dialog.getByAltText('작품 표지 미리보기')).toHaveJSProperty('naturalWidth', 1);
  };
  await open();
  await dialog.getByRole('button', { name: '표지 삭제', exact: true }).click();
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  expect(attempt).toBe(0);
  await expect(page.getByAltText('표지 작품 표지')).toBeVisible();
  await open();
  await dialog.getByRole('button', { name: '표지 삭제', exact: true }).click();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('수정하지 못했습니다');
  await expect(dialog.getByText('저장하면 기본 표지로 변경됩니다.')).toBeVisible();
  await expect(page.getByAltText('표지 작품 표지')).toBeVisible();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('다른 곳에서 표지가 변경');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  await open();
  await dialog.getByRole('button', { name: '표지 삭제', exact: true }).click();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(versions).toEqual([1, 1, 2]);
  await expect(page.locator('.work-card__cover svg')).toBeVisible();
});
