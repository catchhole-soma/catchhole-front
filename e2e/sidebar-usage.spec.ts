import { expect, test, type Page, type Route } from '@playwright/test';

const WORK_ID = '11111111-1111-4111-8111-111111111111';
const success = (route: Route, data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
const usage = (remainingPercent: number, reservedTokens = 0) => ({ grantedTokens: 5_000_000, usedTokens: 1_000_000, reservedTokens, remainingTokens: 4_000_000, remainingPercent, exhausted: remainingPercent === 0, contactEmail: 'team@example.com' });

async function openDashboard(page: Page, respond: (route: Route) => unknown) {
  await page.route('**/api/v1/**', route => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/ai-token-usages/me')) return respond(route);
    if (pathname.endsWith('/auth/me')) return success(route, { id: 1, email: 'usage@example.com', displayName: '사용량 작가', role: 'AUTHOR', status: 'ACTIVE' });
    if (pathname.endsWith(`/works/${WORK_ID}`)) return success(route, { id: WORK_ID, title: '사용량 작품', genre: '판타지', lifecycleStatus: 'ACTIVE' });
    return success(route, []);
  });
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'usage-token'));
  await page.goto(`/dashboard?workId=${WORK_ID}`);
}
const usageBlock = (page: Page) => page.locator('.workspace-sidebar__usage').first();

test('사이드바에 남은 사용량 막대와 퍼센트를 보여 주고 토큰 수는 숨긴다', async ({ page }) => {
  await openDashboard(page, route => success(route, usage(80.95)));
  const block = usageBlock(page);
  await expect(block).toContainText('남은 사용량');
  await expect(block).toContainText('81.0%');
  await expect(block).not.toContainText('4,000,000');
  await expect(block.getByRole('progressbar', { name: '남은 사용량' })).toHaveAttribute('aria-valuenow', '81');
  await expect(block.locator('.workspace-sidebar__usage-fill')).not.toHaveClass(/is-warning|is-danger/);
});

for (const [percent, name] of [[30, 'is-warning'], [10, 'is-danger']] as const) {
  test(`${percent}% 이하는 ${name} 색으로 구분한다`, async ({ page }) => {
    await openDashboard(page, route => success(route, usage(percent)));
    const fill = usageBlock(page).locator('.workspace-sidebar__usage-fill');
    await expect(fill).toHaveClass(new RegExp(name));
    const primary = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ch-primary').trim());
    const color = await fill.evaluate(element => getComputedStyle(element).backgroundColor);
    const expected = await page.evaluate(value => { const probe = document.createElement('i'); probe.style.color = value; document.body.append(probe); const resolved = getComputedStyle(probe).color; probe.remove(); return resolved; }, primary);
    expect(color).not.toBe(expected);
  });
}

test('조회에 실패하면 안내와 다시 시도를 제공한다', async ({ page }) => {
  let calls = 0;
  await openDashboard(page, route => {
    calls += 1;
    return calls === 1
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: '오류', data: null, error: { code: 'COMMON_INTERNAL_SERVER_ERROR', status: 500, details: [] } }) })
      : success(route, usage(64));
  });
  const block = usageBlock(page);
  await expect(block).toContainText('사용량을 불러오지 못했습니다.');
  await block.getByRole('button', { name: '남은 사용량 다시 불러오기' }).click();
  await expect(block).toContainText('64.0%');
});

test('분석 중에도 30초 간격으로만 다시 확인한다', async ({ page }) => {
  await page.clock.install();
  let calls = 0;
  await openDashboard(page, route => { calls += 1; return success(route, usage(50, 1_000)); });
  await expect(usageBlock(page)).toContainText('50.0%');
  const initial = calls;
  await page.clock.runFor(10_000);
  expect(calls).toBe(initial);
  await page.clock.runFor(21_000);
  await expect.poll(() => calls).toBe(initial + 1);
});

test('320px 메뉴에서도 남은 사용량을 읽을 수 있다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openDashboard(page, route => success(route, usage(42)));
  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
  const block = page.locator('.workspace-sidebar__usage').last();
  await expect(block).toBeVisible();
  await expect(block).toContainText('42.0%');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
