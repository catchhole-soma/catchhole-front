import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { purgeWorkAndWait } from './live-work-purge';

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
  properties: Array<{
    scopeName: string | null;
    settingName: string;
    value: string;
  }>;
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
    test.setTimeout(60_000);
    const session = await createAuthenticatedWork(request);

    try {
      await authenticateBrowser(page, session.token);
      await page.goto(
        `/dashboard?workId=${encodeURIComponent(session.workId)}`
        + '&nav=settingDB&tab=worldsettings&category=ALL',
      );

      await expect(page.getByText('등록된 세계관 설정이 없습니다.')).toBeVisible();
      await page.getByRole('button', { name: '새 대상 추가', exact: true }).last().click();
      await page.getByRole('dialog').getByRole('combobox', { name: '분류', exact: true }).selectOption('LOCATION');
      await page.getByLabel('대상명').fill('미궁');
      await page.getByLabel('범위 (선택)').fill('1층');
      await page.getByLabel('설정명').fill('출몰 규칙');
      await page.getByLabel('설정값').fill('동쪽에서 고블린이 출몰한다.');
      await page.getByRole('button', { name: '대상 추가', exact: true }).click();

      await expect(page.getByText('새 세계관 대상 추가', { exact: true })).toHaveCount(0);
      await expect(page.getByText('미궁', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('동쪽에서 고블린이 출몰한다.', { exact: true })).toBeVisible();

      const detailPanel = page.locator('.world-setting-db-detail');
      await detailPanel.getByRole('button', { name: '범위·설정 추가', exact: true }).click();
      await detailPanel.getByLabel('범위 (선택)').fill('2층');
      await detailPanel.getByLabel('설정명').fill('출몰 규칙');
      await detailPanel.getByLabel('설정값').fill('중앙부에서 언데드가 출몰한다.');
      await detailPanel.getByRole('button', { name: '추가', exact: true }).click();
      await expect(page.getByText('중앙부에서 언데드가 출몰한다.', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: '1층 출몰 규칙 설정 수정' }).click();
      await detailPanel.getByLabel('설정값').fill('동쪽과 남쪽에서 고블린이 출몰한다.');
      await detailPanel.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page.getByText('동쪽과 남쪽에서 고블린이 출몰한다.', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: '대상 정보 수정', exact: true }).click();
      await page.getByLabel('대상명').fill('심연 미궁');
      await page.getByRole('button', { name: '변경 저장', exact: true }).click();
      await expect(page.getByText('심연 미궁', { exact: true }).first()).toBeVisible();

      const listResponse = await request.get(
        `${apiBaseUrl}/api/v1/works/${session.workId}/world-settings?q=${encodeURIComponent('심연 미궁')}`,
        { headers: { Authorization: session.authorization } },
      );
      expect(listResponse.ok(), await listResponse.text()).toBeTruthy();
      const list = await listResponse.json() as Envelope<WorldSettingListResponse>;
      expect(list.data.totalWorldSettingCount).toBe(1);
      expect(list.data.worldSettings.content).toHaveLength(1);
      expect(list.data.worldSettings.content[0]).toMatchObject({
        category: 'LOCATION',
        subjectName: '심연 미궁',
        propertyCount: 2,
      });

      const detailResponse = await request.get(
        `${apiBaseUrl}/api/v1/works/${session.workId}/world-settings/${list.data.worldSettings.content[0].id}`,
        { headers: { Authorization: session.authorization } },
      );
      expect(detailResponse.ok(), await detailResponse.text()).toBeTruthy();
      const detail = await detailResponse.json() as Envelope<WorldSettingDetail>;
      expect(detail.data).toMatchObject({
        category: 'LOCATION',
        subjectName: '심연 미궁',
        version: 3,
      });
      expect(detail.data.properties).toEqual(expect.arrayContaining([
        {
          scopeName: '1층',
          settingName: '출몰 규칙',
          value: '동쪽과 남쪽에서 고블린이 출몰한다.',
        },
        {
          scopeName: '2층',
          settingName: '출몰 규칙',
          value: '중앙부에서 언데드가 출몰한다.',
        },
      ]));

      await page.reload();
      await expect(page.getByText('심연 미궁', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('동쪽과 남쪽에서 고블린이 출몰한다.', { exact: true })).toBeVisible();
      await expect(page.getByText('중앙부에서 언데드가 출몰한다.', { exact: true })).toBeVisible();
    } finally {
      await purgeWorkAndWait(request, apiBaseUrl!, session.authorization, session.workId);
    }
  });

  test('공용 도감을 검색하고 선택·충돌·기본 이미지 복귀를 실제 DB에 저장한다', async ({ page, request }) => {
    test.setTimeout(60_000);
    const session = await createAuthenticatedWork(request);
    const headers = { Authorization: session.authorization };
    try {
      const created = await request.post(`${apiBaseUrl}/api/v1/works/${session.workId}/world-settings`, {
        headers, data: { category: 'LOCATION', subjectName: '고블린 숲', settingName: '서식 생물', settingValue: '고블린이 산다.' },
      });
      expect(created.ok()).toBeTruthy();
      const setting = (await created.json()).data;
      for (const [subjectName, catalogId] of [['새벽 동굴', 'location-cave'], ['은빛 도시', 'location-city'], ['잊힌 미궁', 'location-labyrinth']]) {
        const extra = await request.post(`${apiBaseUrl}/api/v1/works/${session.workId}/world-settings`, {
          headers, data: { category: 'LOCATION', subjectName, settingName: '특징', settingValue: '이야기의 배경이 되는 장소다.' },
        });
        expect(extra.ok()).toBeTruthy();
        const extraId = (await extra.json()).data.id;
        const assign = await request.patch(`${apiBaseUrl}/api/v1/works/${session.workId}/world-settings/${extraId}/image`, {
          headers, data: { catalogId, version: 0 },
        });
        expect(assign.ok()).toBeTruthy();
      }
      const detailUrl = `${apiBaseUrl}/api/v1/works/${session.workId}/world-settings/${setting.id}`;
      const before = (await (await request.get(detailUrl, { headers })).json()).data;
      expect(before.image.source).toBe('DEFAULT');
      await authenticateBrowser(page, session.token);
      await page.goto(`/dashboard?workId=${session.workId}&nav=settingDB&tab=worldsettings&category=LOCATION`);
      await page.setViewportSize({ width: 1440, height: 900 });
      const card = page.getByRole('button', { name: '고블린 숲 세계관 대상 보기' });
      await expect(card.locator('img')).toHaveJSProperty('naturalWidth', 480);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.waitForFunction(() => {
        for (let node = document.querySelector('.world-setting-database'); node; node = node.parentElement) {
          if (Number(getComputedStyle(node).opacity) < 1) return false;
        }
        return true;
      });
      await page.screenshot({ path: 'docs/screens/gh194/image-list-desktop.png', animations: 'disabled' });
      await card.click();
      await page.getByRole('button', { name: '이미지 변경', exact: true }).click();
      const picker = page.getByRole('dialog', { name: '대표 이미지 선택', exact: true });
      await expect(picker.getByRole('button', { name: '다음 페이지', exact: true })).toBeEnabled();
      await expect.poll(() => picker.locator('.world-image-picker__option img').evaluateAll(images =>
        images.slice(0, 9).every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth === 480),
      )).toBe(true);
      await page.screenshot({ path: 'docs/screens/gh194/image-catalog-desktop-ready.png' });
      await picker.getByRole('button', { name: '다음 페이지', exact: true }).click();
      await expect(picker.getByText('2 / 2', { exact: true })).toBeVisible();
      await picker.getByLabel('대표 이미지 이름·별칭 검색').fill('숲');
      await picker.getByRole('button', { name: '검색', exact: true }).click();
      const forest = picker.getByRole('button', { name: '숲 이미지 선택', exact: true });
      await expect(forest.locator('img')).toHaveJSProperty('naturalWidth', 480);
      await forest.click();
      await page.screenshot({ path: 'docs/screens/gh194/image-picker-desktop.png' });
      await picker.getByRole('button', { name: '이미지 저장', exact: true }).click();
      await expect(picker).toHaveCount(0);
      await page.reload();
      const saved = (await (await request.get(detailUrl, { headers })).json()).data;
      expect(saved.image).toMatchObject({ catalogId: 'location-forest', source: 'MANUAL', version: 1 });
      expect(saved.properties).toEqual(before.properties);
      expect(saved.version).toBe(before.version);
      expect(saved.updatedAt).toBe(before.updatedAt);
      await expect(page.locator('.world-setting-detail-image img')).toHaveJSProperty('naturalWidth', 960);
      const image = await request.get(`${apiBaseUrl}${saved.image.imageUrl}`);
      expect(image.status()).toBe(200);
      expect(image.headers()['content-type']).toBe('image/webp');
      expect(image.headers()['cache-control']).toContain('immutable');
      await page.screenshot({ path: 'docs/screens/gh194/image-detail-desktop.png' });
      await page.getByRole('button', { name: '이미지 변경', exact: true }).click();
      await picker.getByRole('button', { name: /분류 기본 이미지/ }).click();
      // 다른 화면에서 먼저 변경되면 덮어쓰지 않고 최신 버전을 명시적으로 확인한다.
      const external = await request.patch(`${detailUrl}/image`, { headers, data: { catalogId: 'location-cave', version: 1 } });
      expect(external.ok()).toBeTruthy();
      await picker.getByRole('button', { name: '이미지 저장', exact: true }).click();
      await expect(picker.getByRole('alert')).toContainText('먼저 변경');
      await expect(picker.getByRole('button', { name: /분류 기본 이미지/ })).toHaveAttribute('aria-pressed', 'true');
      await picker.getByRole('button', { name: '최신 이미지 확인', exact: true }).click();
      await expect(picker.getByRole('button', { name: '이미지 저장', exact: true })).toBeEnabled();
      await page.setViewportSize({ width: 320, height: 740 });
      await page.screenshot({ path: 'docs/screens/gh194/image-picker-mobile.png' });
      await picker.getByRole('button', { name: '이미지 저장', exact: true }).click();
      await expect(picker).toHaveCount(0);
      await page.reload();
      const reset = (await (await request.get(detailUrl, { headers })).json()).data;
      expect(reset.image).toMatchObject({ source: 'DEFAULT', catalogId: 'location-default', version: 3 });
      await expect(page.locator('.world-setting-detail-image img')).toHaveJSProperty('naturalWidth', 960);
      await page.screenshot({ path: 'docs/screens/gh194/image-detail-mobile.png' });
      await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
      await expect(card).toBeVisible();
      await expect(card).toBeFocused();
      await expect(page).toHaveURL(/category=LOCATION/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.screenshot({ path: 'docs/screens/gh194/image-list-mobile.png' });
    } finally {
      await purgeWorkAndWait(request, apiBaseUrl!, session.authorization, session.workId);
    }
  });

});
