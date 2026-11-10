import fs from 'node:fs';
import { expect, test } from '@playwright/test';

const fixturePath = process.env.GH416_FIXTURE_INPUT;
test.skip(!fixturePath, 'Spring MVC + PostgreSQL 합성 응답이 제공될 때 실행');

test('real Spring/PostgreSQL response contracts support the directory and multiple selection', async ({ context, page }) => {
  const fixture = JSON.parse(fs.readFileSync(fixturePath!, 'utf8'));
  const prefix = `/api/v1/works/${fixture.workId}`;
  await context.addInitScript(() => localStorage.setItem('accessToken', 'synthetic-explorer-contract'));
  const responses: string[] = [];
  await context.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let response: unknown;
    if (path.endsWith('/auth/me')) response = { id: 1, displayName: '합성 계약 검증', role: 'AUTHOR', status: 'ACTIVE' };
    else if (path === '/api/v1/works') response = [{ id: fixture.workId, title: '합성 관계 검증', genre: '판타지', episodeCount: 1 }];
    else if (path === prefix) response = { id: fixture.workId, title: '합성 관계 검증', genre: '판타지', lifecycleStatus: 'ACTIVE' };
    else if (path === `${prefix}/relationship-graph/explore/selection`) {
      const key = url.searchParams.has('counterpartNodeIds') ? 'selected' : url.searchParams.has('focusNodeId') ? 'focus' : 'overview';
      if (key === 'selected') expect(url.searchParams.getAll('counterpartNodeIds')).toHaveLength(2);
      responses.push(key); return route.fulfill({ json: fixture[key] });
    } else if (path === `${prefix}/relationship-graph/people`) {
      const key = url.searchParams.has('focusNodeId') ? 'counterparts' : 'directory';
      responses.push(key); return route.fulfill({ json: fixture[key] });
    } else response = [];
    return route.fulfill({ json: { success: true, data: response, error: null } });
  });
  await page.goto(`/dashboard?workId=${fixture.workId}&nav=graph`);
  const directory = page.getByLabel('관계도 인물 선택', { exact: true });
  await expect(directory).toContainText('전체 인물 231명');
  await directory.getByRole('button', { name: /중심으로 보기/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`relationFocus=${fixture.center}`));
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('checkbox').nth(1).check();
  await page.getByRole('button', { name: '관계 보기', exact: true }).click();
  await expect(page.locator('.episode-person')).toHaveCount(3);
  await expect(page.getByRole('list', { name: '이 회차의 관계 목록' }).locator('li')).toHaveCount(2);
  expect(responses).toEqual(expect.arrayContaining(['overview', 'directory', 'focus', 'counterparts', 'selected']));
});
