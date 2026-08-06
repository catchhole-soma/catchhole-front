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

interface WorldSettingListItem {
  id: string;
  category: string;
  subjectName: string;
  propertyCount: number;
}

interface WorldSettingListResponse {
  totalWorldSettingCount: number;
  worldSettings: {
    content: WorldSettingListItem[];
  };
}

interface WorldSettingDetail {
  id: string;
  category: string;
  subjectName: string;
  properties: Record<string, string>;
  version: number;
}

async function createAuthenticatedWork(request: APIRequestContext) {
  if (!apiBaseUrl || !e2eEmail || !e2ePassword) {
    throw new Error('Live E2E API 주소와 사전 인증 계정 정보가 필요합니다.');
  }
  const unique = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const loginResponse = await request.post(`${apiBaseUrl}/api/v1/auth/login`, {
    data: { email: e2eEmail, password: e2ePassword },
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
      title: `세계관 DB 연동 검증 ${unique}`,
      genre: '판타지',
      description: '세계관 직접 입력 Front·Backend·PostgreSQL live E2E 작품',
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

test.describe('세계관 DB 실제 연동', () => {
  test.skip(
    !apiBaseUrl || !e2eEmail || !e2ePassword,
    'Live Backend 주소와 사전 인증된 E2E 계정 정보를 지정해야 실행됩니다.',
  );

  test('직접 추가·수정 결과를 실제 Backend와 PostgreSQL에서 재조회한다', async ({
    page,
    request,
  }) => {
    const session = await createAuthenticatedWork(request);

    try {
      await authenticateBrowser(page, session.token);
      await page.goto(
        `/dashboard?workId=${encodeURIComponent(session.workId)}`
        + '&nav=settingDB&tab=worldsettings',
      );

      await expect(page.getByText('등록된 세계관 설정이 없습니다.')).toBeVisible();
      await page.getByRole('button', { name: '새 대상 추가', exact: true }).last().click();
      await page.getByLabel('대상명').fill('북부 설원');
      await page.getByLabel('설정명').fill('사회 구조');
      await page.getByLabel('설정값').fill('부족 단위로 생활');
      await page.getByRole('button', { name: '대상 추가', exact: true }).click();

      await expect(page.getByText('새 세계관 대상 추가', { exact: true })).toHaveCount(0);
      await expect(page.getByText('북부 설원', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('부족 단위로 생활', { exact: true })).toBeVisible();

      const detailPanel = page.locator('.world-setting-db-detail');
      await detailPanel.getByRole('button', { name: '설정 추가', exact: true }).click();
      await detailPanel.getByLabel('설정명').fill('서식지');
      await detailPanel.getByLabel('설정값').fill('혹한 지역');
      await detailPanel.getByRole('button', { name: '추가', exact: true }).click();
      await expect(page.getByText('혹한 지역', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: '사회 구조 설정 수정' }).click();
      await detailPanel.getByLabel('설정값').fill('여러 부족이 연맹으로 생활');
      await detailPanel.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page.getByText('여러 부족이 연맹으로 생활', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: '대상 정보 수정', exact: true }).click();
      await page.getByLabel('대상명').fill('북부 설원 부족');
      await page.getByRole('button', { name: '변경 저장', exact: true }).click();
      await expect(page.getByText('북부 설원 부족', { exact: true }).first()).toBeVisible();

      const listResponse = await request.get(
        `${apiBaseUrl}/api/v1/works/${session.workId}/world-settings?q=${encodeURIComponent('북부 설원 부족')}`,
        { headers: { Authorization: session.authorization } },
      );
      expect(listResponse.ok(), await listResponse.text()).toBeTruthy();
      const list = await listResponse.json() as Envelope<WorldSettingListResponse>;
      expect(list.data.totalWorldSettingCount).toBe(1);
      expect(list.data.worldSettings.content).toHaveLength(1);
      expect(list.data.worldSettings.content[0]).toMatchObject({
        category: 'RACE',
        subjectName: '북부 설원 부족',
        propertyCount: 2,
      });

      const detailResponse = await request.get(
        `${apiBaseUrl}/api/v1/works/${session.workId}/world-settings/${list.data.worldSettings.content[0].id}`,
        { headers: { Authorization: session.authorization } },
      );
      expect(detailResponse.ok(), await detailResponse.text()).toBeTruthy();
      const detail = await detailResponse.json() as Envelope<WorldSettingDetail>;
      expect(detail.data).toMatchObject({
        category: 'RACE',
        subjectName: '북부 설원 부족',
        properties: {
          '사회 구조': '여러 부족이 연맹으로 생활',
          서식지: '혹한 지역',
        },
        version: 3,
      });

      await page.reload();
      await expect(page.getByText('북부 설원 부족', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('여러 부족이 연맹으로 생활', { exact: true })).toBeVisible();
      await expect(page.getByText('혹한 지역', { exact: true })).toBeVisible();
    } finally {
      const deleteWorkResponse = await request.delete(
        `${apiBaseUrl}/api/v1/works/${session.workId}`,
        { headers: { Authorization: session.authorization } },
      );
      expect.soft(
        deleteWorkResponse.ok(),
        `E2E 작품 정리 실패: ${deleteWorkResponse.status()} ${await deleteWorkResponse.text()}`,
      ).toBeTruthy();
    }
  });
});
