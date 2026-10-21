import { expect, test, type BrowserContext, type Route } from '@playwright/test';

test.skip(process.env.VITE_RELATIONSHIP_WORKSPACE_ENABLED !== 'false', 'VITE_RELATIONSHIP_WORKSPACE_ENABLED=false인 비공개 빌드만 검증합니다.');

const workId = '11111111-1111-4111-8111-111111111111';
const selectedId = '22222222-2222-4222-8222-222222222222';
const prefix = `/api/v1/works/${workId}`;
const settings = `/dashboard?workId=${workId}&nav=settingDB&tab=characters`;
const relationshipParams = ['relationView', 'relationPage', 'relationshipCandidate', 'relationshipId', 'relationshipFactId', 'familyFocus', 'familyHistory'];

function success(route: Route, data: unknown) {
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
}

async function setup(context: BrowserContext) {
  const relationshipRequests: string[] = [];
  await context.addInitScript(() => {
    localStorage.setItem('accessToken', 'synthetic-relationship-disabled-token');
    localStorage.removeItem('catchhole_demo_mode');
  });
  await context.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (/\/(?:relationship(?:s|-)|family-tree)/.test(path)) {
      relationshipRequests.push(`${route.request().method()} ${path}`);
      return success(route, []);
    }
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'disabled@example.test', role: 'AUTHOR', status: 'ACTIVE', displayName: '기본 화면 검증' });
    if (path === '/api/v1/works') return success(route, [{ id: workId, title: '기본 화면 검증', genre: '판타지', episodeCount: 0 }]);
    if (path === prefix) return success(route, { id: workId, title: '기본 화면 검증', lifecycleStatus: 'ACTIVE' });
    if (path === `${prefix}/characters`) return success(route, { content: [], page: 0, size: 12, totalElements: 0, totalPages: 0, hasNext: false });
    return success(route, []);
  });
  return relationshipRequests;
}

test('명시적 OFF는 기존 그래프 뷰와 관계도 예정 탭만 보이며 클릭해도 관계 API를 호출하지 않는다', async ({ page, context }, testInfo) => {
  const requests = await setup(context);
  await page.clock.install();
  await page.goto(settings);
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
  const graph = page.getByRole('button', { name: /^그래프 뷰/ });
  await expect(graph).toContainText('업데이트 예정');
  await graph.click();
  await expect(page.getByText('그래프 뷰 기능은 업데이트 예정입니다.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
  const tab = page.locator('.dashboard-tabs').getByRole('button', { name: /^관계도/ });
  await expect(tab).toContainText('업데이트 예정');
  await tab.click();
  await expect(page.getByText('관계도 기능은 업데이트 예정입니다.', { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('nav')).toBe('settingDB');
  expect(new URL(page.url()).searchParams.get('tab')).toBe('characters');
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
  await expect(page.locator('.relationship-workspace')).toHaveCount(0);
  await page.clock.runFor(31000);
  expect(requests).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('relationship-feature-off-desktop.png'), fullPage: true });
});

test('명시적 OFF의 320px 설정 선택과 메뉴는 기존 업데이트 예정 안내를 유지한다', async ({ page, context }, testInfo) => {
  const requests = await setup(context);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(settings);
  const tabs = page.getByRole('combobox', { name: '작품 설정', exact: true });
  await expect(tabs.getByRole('option', { name: '관계도 · 업데이트 예정', exact: true })).toHaveCount(1);
  await tabs.selectOption('relations');
  await expect(page.getByText('관계도 기능은 업데이트 예정입니다.', { exact: true })).toBeVisible();
  await expect(tabs).toHaveValue('characters');
  await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '워크스페이스 메뉴' });
  const graph = drawer.getByRole('button', { name: /^그래프 뷰/ });
  await expect(graph).toContainText('업데이트 예정');
  await graph.click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByText('그래프 뷰 기능은 업데이트 예정입니다.', { exact: true })).toBeVisible();
  await expect(page.locator('.relationship-workspace')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('nav')).toBe('settingDB');
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('relationship-feature-off-mobile-320.png'), fullPage: true });
});

for (const destination of ['nav=graph', 'nav=settingDB&tab=relations']) {
  test(`명시적 OFF는 ${destination} 직접 링크를 캐릭터 화면으로 대체하고 관계 선택과 API 요청을 제거한다`, async ({ page, context }) => {
    const requests = await setup(context);
    await page.clock.install();
    await page.goto('/works');
    await expect(page.getByRole('button', { name: '사용자 메뉴 열기' })).toBeVisible();
    await page.goto(`/dashboard?workId=${workId}&${destination}&relationView=review&relationPage=2&relationshipCandidate=${selectedId}&relationshipId=${selectedId}&relationshipFactId=${selectedId}&familyFocus=${selectedId}&familyHistory=true`);
    await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('nav')).toBe('settingDB');
    await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe('characters');
    const params = new URL(page.url()).searchParams;
    expect(params.get('workId')).toBe(workId);
    for (const key of relationshipParams) expect(params.has(key), key).toBeFalsy();
    await expect(page.locator('.relationship-workspace')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: '캐릭터 설정', exact: true })).toBeVisible();
    await page.clock.runFor(31000);
    expect(requests).toEqual([]);
    await page.goBack();
    await expect(page).toHaveURL(/\/works$/);
  });
}
