// Opt-in only: the Java PostgreSQL integration test owns this synthetic fixture.
// No API response mocks, trace/HAR recording, or token/body logging.
import assert from 'node:assert/strict';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';

const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(checkout, 'test-results/relationship-partial-live');
const port = 33959;
const browserOrigin = `http://127.0.0.1:${port}`;
const check = expect.configure({ timeout: 15000 });
let server;
let browser;
let stage = 'validate synthetic fixture';

try {
  const fixturePath = process.argv[2];
  assert(fixturePath, 'A private fixture file is required.');
  const fixtureStat = await stat(fixturePath);
  assert.equal(fixtureStat.mode & 0o077, 0, 'The fixture must be private.');
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  assert.equal(fixture.testOnly, true);
  const api = new URL(fixture.apiBaseUrl);
  assert.equal(api.protocol, 'http:');
  assert(['127.0.0.1', 'localhost'].includes(api.hostname));
  assert(api.port && !api.username && !api.password && api.pathname === '/' && !api.search && !api.hash);
  assert.equal(typeof fixture.accessToken, 'string');
  assert(fixture.accessToken.length > 0 && !fixture.accessToken.startsWith('Bearer '));
  assert.match(fixture.workId, /^[0-9a-f-]{36}$/i);
  assert.equal(fixture.selectedEpisodeNo, 3);
  assert.deepEqual(fixture.incompleteEpisodeNos, [2, 3]);
  assert.equal(fixture.lastVerifiedEpisodeNo, 1);
  assert.equal(fixture.earlierEpisodeNo, 1);

  stage = 'start isolated frontend';
  process.env.VERCEL_ENV = 'development';
  server = await createServer({
    root: checkout,
    configFile: resolve(checkout, 'vite.config.ts'),
    logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') },
    server: { host: '127.0.0.1', port, strictPort: true,
      proxy: { '/api/v1': { target: api.origin, changeOrigin: true } } },
  });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
  const graphPath = `/api/v1/works/${fixture.workId}/relationship-graph`;
  const authorization = `Bearer ${fixture.accessToken}`;
  let authorizedGraphRead = false;
  let writeAttempts = 0;
  await context.addInitScript(token => {
    localStorage.setItem('accessToken', token);
    localStorage.removeItem('catchhole_demo_mode');
  }, fixture.accessToken);
  // Only the local frontend may be reached. Its Vite proxy forwards real API
  // requests unchanged to the local Spring server while avoiding CORS fixtures.
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== browserOrigin) return route.abort();
    if (url.pathname.startsWith('/api/v1/') && !['GET', 'OPTIONS'].includes(request.method())) {
      writeAttempts++;
      return route.abort();
    }
    if (url.pathname === graphPath) authorizedGraphRead ||= request.headers().authorization === authorization;
    return route.continue();
  });
  const get = async path => {
    const response = await context.request.get(`${browserOrigin}${path}`, { headers: { Authorization: authorization } });
    assert.equal(response.status(), 200, 'The real API read must succeed.');
    const body = await response.json();
    assert.equal(body.success, true);
    return body.data;
  };

  stage = 'verify real API partial metadata';
  const latest = await get(graphPath);
  assert.equal(latest.selectedEpisode.episodeNo, fixture.selectedEpisodeNo);
  assert.equal(latest.updateIncomplete, true);
  assert.deepEqual(latest.incompleteEpisodeNos, fixture.incompleteEpisodeNos);
  assert.equal(latest.edges.length, 2);
  const incomplete = latest.edges.filter(edge => edge.updateIncomplete);
  const current = latest.edges.filter(edge => !edge.updateIncomplete);
  assert.equal(incomplete.length, 1);
  assert.equal(current.length, 1);
  assert.equal(incomplete[0].lastVerifiedEpisodeNo, fixture.lastVerifiedEpisodeNo);
  assert.equal(current[0].lastVerifiedEpisodeNo, fixture.selectedEpisodeNo);

  stage = 'verify actual browser partial state';
  const page = await context.newPage();
  const dashboard = `${browserOrigin}/dashboard?workId=${fixture.workId}&nav=graph&relationMode=people`;
  await page.goto(`${dashboard}&relationEdge=${incomplete[0].id}`, { waitUntil: 'domcontentloaded' });
  await check(page.getByRole('status').filter({ hasText: '일부 관계 업데이트 미완료' }))
    .toHaveText('일부 관계 업데이트 미완료 · 2화, 3화');
  await check(page.getByText('3화까지의 관계', { exact: true })).toBeVisible();
  await check(page.getByText('3화까지 확인된 관계')).toHaveCount(0);
  await check(page.getByRole('list', { name: '이 회차의 관계 목록' }).getByRole('button')).toHaveCount(2);
  const detail = page.getByRole('article', { name: '선택한 인물 관계' });
  await check(detail).toContainText('마지막 확인: 1화. 이후 관계 업데이트를 마치지 못했어요.');
  await check(page.getByText('확인·연결', { exact: true })).toHaveCount(0);
  await check(page.getByRole('button', { name: '판단 저장', exact: true })).toHaveCount(0);
  await mkdir(output, { recursive: true });
  await detail.screenshot({ path: resolve(output, 'partial-detail-desktop.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 320, height: 850 });
  await check.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await detail.screenshot({ path: resolve(output, 'partial-detail-mobile-320.png'), animations: 'disabled' });

  stage = 'verify historical API and browser cutoff';
  await page.getByLabel('관계도 회차').selectOption(String(fixture.earlierEpisodeNo));
  await check(page.getByText('1화까지 확인된 관계')).toBeVisible();
  await check(page.getByText('일부 관계 업데이트 미완료', { exact: false })).toHaveCount(0);
  const earlier = await get(`${graphPath}?episodeNo=1`);
  assert.equal(earlier.updateIncomplete, false);
  assert.deepEqual(earlier.incompleteEpisodeNos, []);
  assert(earlier.edges.every(edge => edge.lastVerifiedEpisodeNo <= 1 && !edge.updateIncomplete));
  const olderDetail = await get(`${graphPath}/edges/${current[0].id}?episodeNo=1`);
  assert(olderDetail.evidence.length > 0);
  assert(olderDetail.evidence.every(evidence => evidence.episodeNo <= 1));
  await page.goto(`${dashboard}&relationEpisode=1&relationEdge=${current[0].id}`, { waitUntil: 'domcontentloaded' });
  await check(detail.locator('.episode-relationship-evidence')).toHaveCount(olderDetail.evidence.length);
  for (const label of await detail.locator('.episode-relationship-evidence > span').allTextContents()) {
    assert.match(label, /^1화(?:\s|$)/);
  }
  await check(detail.getByText('마지막 확인:', { exact: false })).toHaveCount(0);
  await detail.screenshot({ path: resolve(output, 'historical-detail-mobile-320.png'), animations: 'disabled' });
  assert(authorizedGraphRead, 'The application SDK must send the real bearer authentication.');
  assert.equal(writeAttempts, 0, 'This check only reads the synthetic work.');
  assert.equal((await context.cookies()).filter(cookie => /refresh/i.test(cookie.name)).length, 0);
  console.log('GH359 browser check passed: real API, 2 edges, 2 incomplete episodes, desktop/320px, historical cutoff, no writes.');
} catch {
  // Browser/request errors may include request headers. Never print the cause.
  console.error(`GH359 browser check failed during ${stage}.`);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  await server?.close().catch(() => {});
}
