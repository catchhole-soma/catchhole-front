import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// This fixture is issued by the backend's isolated PostgreSQL integration setup.
// Never point this mutable check at an existing user work or a deployed API.
type Fixture = { apiBaseUrl: string; accessToken: string; workId: string; correctEdgeId: string; deleteEdgeId: string };
const fixturePath = process.env.CATCHHOLE_RELATIONSHIP_LIVE_FIXTURE;
const fixture: Fixture | null = fixturePath ? JSON.parse(readFileSync(fixturePath, 'utf8')) : null;
test.skip(!fixture, '격리 PostgreSQL/Spring 합성 fixture가 있을 때만 실제 API를 검증합니다.');

test('isolated live graph preserves episode cutoff and persists optional correction and deletion', async ({ context, page, request }, testInfo) => {
  if (!fixture) return;
  expect(['localhost', '127.0.0.1']).toContain(new URL(fixture.apiBaseUrl).hostname);
  await page.setViewportSize({ width: 1366, height: 1100 });
  const prefix = `${fixture.apiBaseUrl}/api/v1/works/${fixture.workId}/relationship-graph`;
  const headers = { Authorization: `Bearer ${fixture.accessToken}` };
  const original = await request.get(prefix, { headers });
  expect(original.ok()).toBe(true);
  const initial = (await original.json()).data;
  expect(initial.edges).toHaveLength(3);
  await context.addInitScript(token => { localStorage.setItem('accessToken', token); localStorage.removeItem('catchhole_demo_mode'); }, fixture.accessToken);
  let authorizedGraphRequest = false;
  page.on('request', outgoing => { if (outgoing.url().startsWith(prefix)) authorizedGraphRequest ||= outgoing.headers().authorization === headers.Authorization; });
  await page.goto(`/dashboard?workId=${fixture.workId}&nav=graph&relationMode=people`);
  await expect(page.getByText('2화까지 확인된 관계')).toBeVisible();
  await expect(page.getByRole('list', { name: '이 회차의 관계 목록' }).getByRole('button')).toHaveCount(3);
  await expect(page.getByRole('list', { name: '이 회차의 관계 목록' })).toContainText('종료된 관계');
  await page.getByLabel('관계도 회차').selectOption('1');
  await expect(page.getByRole('list', { name: '이 회차의 관계 목록' }).getByRole('button')).toHaveCount(1);
  await expect(page.getByText('세린', { exact: true })).toHaveCount(0);
  await expect(page.getByText('종료된 관계', { exact: false })).toHaveCount(0);
  await page.getByRole('list', { name: '이 회차의 관계 목록' }).getByRole('button').click();
  await expect(page.getByRole('article', { name: '선택한 인물 관계' }).locator('blockquote')).toHaveCount(1);
  await expect(page.getByRole('article', { name: '선택한 인물 관계' })).toContainText('같이 여행하는 사이');
  await page.screenshot({ path: testInfo.outputPath('episode-relationships-live-episode-1.png'), fullPage: true });
  await page.getByLabel('관계도 회차').selectOption('2');
  await page.getByRole('list', { name: '이 회차의 관계 목록' }).getByRole('button').filter({ hasText: '경계' }).click();
  await page.getByRole('button', { name: '설명 수정' }).click();
  const corrected = '아라는 보라의 안내를 경계한다. (사용자 정정)';
  await page.getByLabel('관계 설명').fill(corrected);
  const save = page.waitForResponse(response => response.url().includes(fixture.correctEdgeId) && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: '변경사항 저장' }).click();
  expect((await save).status()).toBe(200);
  await expect(page.getByLabel('관계 설명')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('article', { name: '선택한 인물 관계' })).toContainText(corrected);
  const saved = await request.get(`${prefix}/edges/${fixture.correctEdgeId}?episodeNo=2`, { headers });
  expect((await saved.json()).data.edge.summary).toBe(corrected);
  await page.getByRole('article', { name: '선택한 인물 관계' }).screenshot({ path: testInfo.outputPath('episode-relationships-live-correction.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('list', { name: '이 회차의 관계 목록' }).getByRole('button').filter({ hasText: '친구' }).click();
  await page.getByRole('button', { name: '이 연결 삭제' }).click();
  const remove = page.waitForResponse(response => response.url().includes(fixture.deleteEdgeId) && response.request().method() === 'DELETE');
  await page.getByRole('button', { name: '삭제하기', exact: true }).click();
  expect((await remove).status()).toBe(200);
  await page.reload();
  await expect(page.getByRole('list', { name: '이 회차의 관계 목록' }).getByRole('button')).toHaveCount(2);
  const after = await request.get(`${prefix}?episodeNo=2`, { headers });
  const remaining = (await after.json()).data.edges;
  expect(remaining.map((edge: { id: string }) => edge.id)).not.toContain(fixture.deleteEdgeId);
  expect(remaining.find((edge: { id: string }) => edge.id === fixture.correctEdgeId).summary).toBe(corrected);
  expect(authorizedGraphRequest).toBe(true);
  expect(await page.evaluate(() => Boolean(localStorage.getItem('accessToken')))).toBe(true);
  // Token injection intentionally does not exercise login/refresh-cookie issuance.
  expect((await context.cookies()).filter(cookie => /refresh/i.test(cookie.name))).toHaveLength(0);
});
