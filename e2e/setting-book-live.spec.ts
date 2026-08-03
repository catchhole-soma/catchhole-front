import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiBaseUrl = process.env.CATCHHOLE_E2E_API_BASE_URL;
const e2eEmail = process.env.CATCHHOLE_E2E_EMAIL;
const e2ePassword = process.env.CATCHHOLE_E2E_PASSWORD;

interface Envelope<T> {
  success: boolean;
  data: T;
}

interface AuthToken {
  accessToken: string;
}

interface Work {
  id: string;
}

async function createAuthenticatedWork(request: APIRequestContext) {
  if (!apiBaseUrl || !e2eEmail || !e2ePassword) {
    throw new Error('Live E2E API 주소와 사전 인증 계정 정보가 필요합니다.');
  }
  const unique = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const loginResponse = await request.post(`${apiBaseUrl}/api/v1/auth/login`, {
    data: {
      email: e2eEmail,
      password: e2ePassword,
    },
  });
  if (!loginResponse.ok()) {
    throw new Error(`사전 인증 E2E 계정 로그인 실패: ${await loginResponse.text()}`);
  }
  const login = await loginResponse.json() as Envelope<AuthToken>;
  expect(login.data.accessToken).toBeTruthy();

  const authorization = `Bearer ${login.data.accessToken}`;
  const workResponse = await request.post(`${apiBaseUrl}/api/v1/works`, {
    headers: { Authorization: authorization },
    data: {
      title: `설정집 연동 검증 ${unique}`,
      genre: '판타지',
      description: '설정집 실제 Backend·DB·파일 저장소 E2E 작품',
    },
  });
  if (!workResponse.ok()) {
    throw new Error(`작품 생성 준비 실패: ${await workResponse.text()}`);
  }
  const work = await workResponse.json() as Envelope<Work>;
  return {
    token: login.data.accessToken,
    authorization,
    workId: work.data.id,
  };
}

async function authenticateBrowser(page: Page, token: string) {
  await page.goto('/login');
  await page.evaluate(accessToken => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.removeItem('catchhole_demo_mode');
  }, token);
}

test.describe('설정집 실제 연동', () => {
  test.skip(
    !apiBaseUrl || !e2eEmail || !e2ePassword,
    'Live Backend 주소와 사전 휴대폰 인증된 E2E 계정 정보를 지정해야 실행됩니다.',
  );

  test('동일명 누적, 원문 조회·수정·재조회, soft delete를 실제 저장소에서 검증한다', async ({
    page,
    request,
  }) => {
    const session = await createAuthenticatedWork(request);
    const originalFilename = '세계관 설정집.txt';
    const firstContent = '첫 번째 설정집 원문\n왕국은 북쪽 대륙에 있다.';
    const secondContent = '두 번째 설정집 원문\n같은 파일명도 새 항목으로 누적된다.';
    const editedContent = '수정된 설정집 원문\n마력은 보름마다 회복된다.\n업로드 원본 객체는 보존된다.';
    const latestEditedContent = '두 번째 수정 원문\n동일한 편집용 객체 key의 현재 내용만 교체된다.';

    try {
      await authenticateBrowser(page, session.token);
      await page.goto(
        `/dashboard?workId=${encodeURIComponent(session.workId)}`
        + '&nav=settingDB&tab=worldrules',
      );

      await expect(page.getByTestId('setting-book-workspace')).toBeVisible();
      await expect(page.getByText('설정집', { exact: true })).toBeVisible();
      await expect(page.locator('[data-testid^="setting-book-row-"]')).toHaveCount(0);
      await expect(page.getByText('업로드된 설정집이 없습니다', { exact: true })).toBeVisible();
      await expect(page.getByText(
        '설정집을 업로드하면 이곳에서 원문을 확인할 수 있습니다.',
        { exact: true },
      )).toBeVisible();
      await expect(page.getByTestId('open-empty-setting-book-upload'))
        .toHaveText('설정집 업로드하기');

      for (const [index, content] of [firstContent, secondContent].entries()) {
        await page.getByTestId(
          index === 0 ? 'open-empty-setting-book-upload' : 'open-setting-book-upload',
        ).click();
        await expect(page).toHaveURL(/modal=setting-book-upload/);
        await page.getByTestId('setting-book-file-input').setInputFiles({
          name: originalFilename,
          mimeType: 'text/plain',
          buffer: Buffer.from(content, 'utf8'),
        });
        await expect(
          page.getByRole('dialog', { name: '설정집 업로드' })
            .getByText(originalFilename, { exact: true }),
        ).toBeVisible();
        await page.getByTestId('setting-book-upload-submit').click();
        await expect(page.getByRole('dialog', { name: '설정집 업로드' })).toHaveCount(0);
      }

      const rows = page.locator('[data-testid^="setting-book-row-"]');
      await expect(rows).toHaveCount(2);
      await expect(rows.filter({ hasText: originalFilename })).toHaveCount(2);

      await rows.first().click();
      await expect(page).toHaveURL(/settingBookFileId=[0-9a-f-]+/);
      await expect(page.getByTestId('setting-book-source')).toContainText(secondContent);

      await page.getByRole('button', { name: '수정', exact: true }).click();
      const editor = page.getByTestId('setting-book-editor');
      await expect(editor).toHaveValue(secondContent);
      await editor.fill(editedContent);
      await page.getByTestId('setting-book-save').click();
      await expect(page.getByTestId('setting-book-source')).toContainText(editedContent);

      await page.getByRole('button', { name: '수정', exact: true }).click();
      await editor.fill(latestEditedContent);
      await page.getByTestId('setting-book-save').click();
      await expect(page.getByTestId('setting-book-source')).toContainText(latestEditedContent);

      await page.reload();
      await expect(page.getByTestId('setting-book-source')).toContainText(latestEditedContent);
      await expect(page.locator('[data-testid^="setting-book-row-"]')).toHaveCount(2);

      await page.getByRole('button', { name: '삭제', exact: true }).click();
      const deleteDialog = page.getByRole('dialog', { name: '이 설정집을 삭제할까요?' });
      await expect(deleteDialog).toBeVisible();
      await deleteDialog.getByRole('button', { name: '삭제', exact: true }).click();

      await expect(page).not.toHaveURL(/settingBookFileId=/);
      await expect(page.locator('[data-testid^="setting-book-row-"]')).toHaveCount(1);
      await expect(page.getByText(originalFilename, { exact: true })).toHaveCount(1);
    } finally {
      try {
        const remainingResponse = await request.get(
          `${apiBaseUrl}/api/v1/works/${session.workId}/setting-books`,
          { headers: { Authorization: session.authorization } },
        );
        if (remainingResponse.ok()) {
          const remaining = await remainingResponse.json() as Envelope<Array<{ id?: string }>>;
          await Promise.all((remaining.data ?? []).map(settingBook => {
            if (!settingBook.id) return Promise.resolve();
            return request.delete(
              `${apiBaseUrl}/api/v1/works/${session.workId}/setting-books/${settingBook.id}`,
              { headers: { Authorization: session.authorization } },
            );
          }));
        }
      } finally {
        const deleteWorkResponse = await request.delete(
          `${apiBaseUrl}/api/v1/works/${session.workId}`,
          { headers: { Authorization: session.authorization } },
        );
        expect(
          deleteWorkResponse.ok(),
          `E2E 작품 정리 실패: ${deleteWorkResponse.status()} ${await deleteWorkResponse.text()}`,
        ).toBeTruthy();
      }
    }
  });
});
