import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const settingBookId = '22222222-2222-4222-8222-222222222222';
const uploadedSettingBookId = '33333333-3333-4333-8333-333333333333';

const member = {
  id: 1,
  email: 'setting-book-ui@example.com',
  displayName: '설정집 UI 테스트',
  phoneNumber: '01012345678',
  phoneVerified: false,
  role: 'AUTHOR',
  status: 'ACTIVE',
};

function success(route: Route, data: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data, error: null }),
  });
}

function failure(route: Route, message: string) {
  return route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({
      success: false,
      message,
      data: null,
      error: { code: 'COMMON_INTERNAL_SERVER_ERROR', status: 500, details: [] },
    }),
  });
}

async function authenticate(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem('accessToken', 'setting-book-ui-token');
    localStorage.removeItem('catchhole_demo_mode');
  });
}

test('설정집 목록·원문·수정·삭제·업로드 실패 상태를 보존하고 재시도한다', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  let listAttempts = 0;
  let detailAttempts = 0;
  let updateAttempts = 0;
  let deleteAttempts = 0;
  let uploadAttempts = 0;
  let content = '초기 설정집 원문\n왕국의 수도는 아르덴이다.';
  let rows = [{
    id: settingBookId,
    originalFilename: '세계관 설정집.txt',
    mimeType: 'text/plain; charset=UTF-8',
    fileSize: Buffer.byteLength(content),
    uploadedAt: '2026-07-28T14:30:00',
  }];

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const settingBooksPath = `/api/v1/works/${workId}/setting-books`;
    const detailPath = `${settingBooksPath}/${settingBookId}`;

    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname === '/api/v1/works' && request.method() === 'GET') {
      return success(route, [{
        id: workId,
        title: '설정집 테스트 작품',
        genre: '판타지',
        episodeCount: 0,
      }]);
    }
    if (pathname === `/api/v1/works/${workId}`) {
      return success(route, {
        id: workId,
        title: '설정집 테스트 작품',
        genre: '판타지',
        latestEpisodeNo: 0,
      });
    }
    if (pathname === `/api/v1/works/${workId}/episodes`) return success(route, []);

    if (pathname === settingBooksPath && request.method() === 'GET') {
      listAttempts += 1;
      if (listAttempts === 1) return failure(route, '설정집 목록을 불러오지 못했습니다.');
      return success(route, rows);
    }
    if (pathname === settingBooksPath && request.method() === 'POST') {
      uploadAttempts += 1;
      if (uploadAttempts === 1) return failure(route, '설정집 원본을 업로드하지 못했습니다.');
      const uploaded = {
        id: uploadedSettingBookId,
        originalFilename: '세계관 설정집.txt',
        mimeType: 'text/plain; charset=UTF-8',
        fileSize: 24,
        uploadedAt: '2026-07-28T15:30:00',
      };
      rows = [uploaded, ...rows];
      return success(route, uploaded);
    }
    if (pathname === detailPath && request.method() === 'GET') {
      detailAttempts += 1;
      if (detailAttempts === 1) return failure(route, '전체 원문을 불러오지 못했습니다.');
      return success(route, {
        ...rows.find(item => item.id === settingBookId),
        workId,
        content,
      });
    }
    if (pathname === detailPath && request.method() === 'PATCH') {
      updateAttempts += 1;
      if (updateAttempts === 1) return failure(route, '설정집 원문을 수정하지 못했습니다.');
      content = '실패 후 보존한 수정 원문';
      return success(route, {
        ...rows.find(item => item.id === settingBookId),
        workId,
        fileSize: Buffer.byteLength(content),
        content,
      });
    }
    if (pathname === detailPath && request.method() === 'DELETE') {
      deleteAttempts += 1;
      if (deleteAttempts === 1) return failure(route, '설정집 원본을 삭제하지 못했습니다.');
      rows = rows.filter(item => item.id !== settingBookId);
      return success(route, null);
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=worldrules`);

  await expect(page.getByRole('button', { name: '설정집 목록', exact: true })).toBeVisible();
  await expect(page.getByText('설정집 목록을 불러오지 못했습니다.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();

  const fileList = page.getByLabel('설정집 파일 목록');
  await expect(fileList).toBeVisible();
  await expect(page.getByRole('heading', { name: '설정집', exact: true })).toHaveCSS('color', 'rgb(25, 30, 38)');
  await expect(fileList).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByTestId('setting-book-empty-source')).toBeVisible();
  await expect(page.getByTestId('setting-book-empty-source')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  const [emptySourceBox, emptySourceContentBox] = await Promise.all([
    page.getByTestId('setting-book-empty-source').boundingBox(),
    page.getByTestId('setting-book-empty-source-content').boundingBox(),
  ]);
  expect(emptySourceBox).not.toBeNull();
  expect(emptySourceContentBox).not.toBeNull();
  expect(Math.abs(
    ((emptySourceBox?.y ?? 0) + (emptySourceBox?.height ?? 0) / 2)
      - ((emptySourceContentBox?.y ?? 0) + (emptySourceContentBox?.height ?? 0) / 2),
  )).toBeLessThan(3);
  const initialWidthBox = await fileList.boundingBox();
  expect(initialWidthBox?.width).toBeLessThan(360);

  await page.getByTestId(`setting-book-row-${settingBookId}`).click();
  await expect(page).toHaveURL(new RegExp(`${settingBookId}$`));
  await expect(page.getByLabel('선택한 설정집 전체 원문')).toBeVisible();
  const splitWidthBox = await fileList.boundingBox();
  expect(splitWidthBox?.width).toBeLessThan(360);
  expect(Math.abs((splitWidthBox?.width ?? 0) - (initialWidthBox?.width ?? 0))).toBeLessThan(2);
  await expect(page.getByText('전체 원문을 불러오지 못했습니다.', { exact: true })).toBeVisible();
  await page.getByLabel('선택한 설정집 전체 원문')
    .getByRole('button', { name: '다시 시도', exact: true })
    .click();
  await expect(page.getByTestId('setting-book-source')).toContainText(content);
  await expect(page.getByTestId('setting-book-source')).toHaveCSS('background-color', 'rgb(245, 247, 251)');
  await expect(page.getByTestId('setting-book-source')).toHaveCSS('color', 'rgb(51, 58, 70)');

  await page.getByRole('button', { name: '설정집 원문 닫기', exact: true }).click();
  await expect(page).not.toHaveURL(/settingBookFileId=/);
  await expect(page.getByTestId('setting-book-empty-source')).toBeVisible();
  await expect.poll(async () => (await fileList.boundingBox())?.width ?? 0)
    .toBeLessThan(360);
  await page.getByTestId(`setting-book-row-${settingBookId}`).click();
  await expect(page.getByTestId('setting-book-source')).toContainText(content);

  await page.getByRole('button', { name: '수정', exact: true }).click();
  const editor = page.getByTestId('setting-book-editor');
  await editor.fill('실패 후 보존한 수정 원문');
  await page.getByTestId('setting-book-save').click();
  await expect(editor).toHaveValue('실패 후 보존한 수정 원문');
  await expect(page.getByText('설정집 원문을 수정하지 못했습니다.', { exact: true })).toBeVisible();
  await page.getByTestId('setting-book-save').click();
  await expect(page.getByTestId('setting-book-source')).toContainText('실패 후 보존한 수정 원문');

  await page.getByTestId('open-setting-book-upload').click();
  await expect(page).toHaveURL(/modal=setting-book-upload/);
  await expect(page.getByTestId('setting-book-upload-submit')).toBeDisabled();
  await page.getByTestId('setting-book-file-input').setInputFiles({
    name: '세계관 설정집.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('실패 후에도 선택 파일을 보존한다.'),
  });
  await expect(page.getByRole('dialog', { name: '설정집 업로드' })).toHaveCSS('opacity', '1');
  await page.getByTestId('setting-book-upload-submit').click();
  const uploadDialog = page.getByRole('dialog', { name: '설정집 업로드' });
  await expect(uploadDialog).toBeVisible();
  await expect(uploadDialog).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(uploadDialog).toHaveCSS('border-radius', '20px');
  await expect(uploadDialog.getByText('세계관 설정집.txt', { exact: true })).toBeVisible();
  await expect(uploadDialog.getByText('설정집 원본을 업로드하지 못했습니다.', { exact: true })).toBeVisible();
  await page.getByTestId('setting-book-upload-submit').click();
  await expect(uploadDialog).toHaveCount(0);
  await expect(page.locator('[data-testid^="setting-book-row-"]')).toHaveCount(2);

  await page.getByRole('button', { name: '삭제', exact: true }).click();
  const deleteDialog = page.getByRole('dialog', { name: '이 설정집을 삭제할까요?' });
  await deleteDialog.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(deleteDialog).toBeVisible();
  await expect(deleteDialog.getByText('삭제에 실패했습니다. 설정집은 목록에 그대로 유지됩니다.')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`settingBookFileId=${settingBookId}`));
  await deleteDialog.getByRole('button', { name: '다시 시도', exact: true }).click();

  await expect(deleteDialog).toHaveCount(0);
  await expect(page).not.toHaveURL(/settingBookFileId=/);
  await expect(page.locator('[data-testid^="setting-book-row-"]')).toHaveCount(1);
});
