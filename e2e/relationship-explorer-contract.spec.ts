import fs from 'node:fs';
import { expect, test } from '@playwright/test';

const fixturePath = process.env.GH412_FIXTURE_INPUT;
test.skip(!fixturePath, 'Spring MVC + PostgreSQL 합성 응답이 제공될 때 실행');

test('real Spring/PostgreSQL responses support selection, server search, focus and original evidence', async ({ context, page }, testInfo) => {
  const fixture = JSON.parse(fs.readFileSync(fixturePath!, 'utf8'));
  const workId = fixture.workId;
  const prefix = `/api/v1/works/${workId}`;
  await context.addInitScript(() => localStorage.setItem('accessToken', 'synthetic-explorer-contract'));
  const responses: string[] = [];
  await context.route('**/api/v1/**', route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let response: unknown;
    if (path.endsWith('/auth/me')) response = { id: 1, displayName: '합성 계약 검증', role: 'AUTHOR', status: 'ACTIVE' };
    else if (path === '/api/v1/works') response = [{ id: workId, title: '합성 관계 검증', genre: '판타지', episodeCount: 1 }];
    else if (path === prefix) response = { id: workId, title: '합성 관계 검증', genre: '판타지', lifecycleStatus: 'ACTIVE' };
    else if (path === `${prefix}/relationship-graph/explore`) {
      responses.push(url.searchParams.has('focusNodeId') ? 'focus' : 'overview');
      return route.fulfill({ json: url.searchParams.has('focusNodeId') ? fixture.focus : fixture.overview });
    } else if (path === `${prefix}/relationship-graph/people`) {
      expect(url.searchParams.get('query')).toBe('인물299');
      responses.push('search'); return route.fulfill({ json: fixture.search });
    } else if (path.startsWith(`${prefix}/relationship-graph/explore/edges/`)) {
      responses.push('detail'); return route.fulfill({ json: fixture.detail });
    } else response = [];
    return route.fulfill({ json: { success: true, data: response, error: null } });
  });
  await page.goto(`/dashboard?workId=${workId}&nav=graph`);
  await expect(page.getByRole('heading', { name: '어떤 인물의 관계를 살펴볼까요?' })).toBeVisible();
  await page.getByLabel('관계도 인물 검색').fill('인물299');
  await page.getByRole('button', { name: '인물299 중심으로 보기', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`relationFocus=${fixture.person}`));
  await expect(page.locator('.episode-person')).toHaveCount(2);
  await page.getByRole('list', { name: '이 회차의 관계 목록' }).getByRole('button').click();
  await expect(page.getByRole('article', { name: '선택한 인물 관계' })).toContainText('아라와 보라는 함께 길을 떠났다.');
  expect(responses).toEqual(expect.arrayContaining(['overview', 'search', 'focus', 'detail']));
  await page.screenshot({ path: testInfo.outputPath('spring-postgres-explorer.png'), fullPage: true });
});
