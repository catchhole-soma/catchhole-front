// Opt-in: isolated Spring/PostgreSQL fixture; no response mocks or production requests.
import assert from 'node:assert/strict';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';

const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(checkout, 'test-results/relationship-selection-live');
const origin = 'http://127.0.0.1:18417';
const check = expect.configure({ timeout: 15000 });
let server, browser;
let stage = 'validate private synthetic fixture';
try {
  const input = process.argv[2];
  assert(input);
  assert.equal((await stat(input)).mode & 0o077, 0);
  const fixture = JSON.parse(await readFile(input, 'utf8'));
  assert.equal(fixture.testOnly, true);
  const api = new URL(fixture.apiBaseUrl);
  assert.equal(api.protocol, 'http:');
  assert(['localhost', '127.0.0.1'].includes(api.hostname));
  assert(api.port && !api.username && !api.password && api.pathname === '/' && !api.search && !api.hash);
  assert.match(fixture.workId, /^[0-9a-f-]{36}$/i);
  assert.equal(typeof fixture.accessToken, 'string');
  stage = 'start local proxy and browser';
  process.env.VERCEL_ENV = 'development';
  server = await createServer({ root: checkout, configFile: resolve(checkout, 'vite.config.ts'), logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('') },
    server: { host: '127.0.0.1', port: 18417, strictPort: true,
      proxy: { '/api/v1': { target: api.origin, changeOrigin: true } } } });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
  await context.addInitScript(token => {
    localStorage.setItem('accessToken', token);
    localStorage.removeItem('catchhole_demo_mode');
  }, fixture.accessToken);
  let writes = 0, graphReads = 0;
  await context.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/v1/') && !['GET', 'OPTIONS'].includes(request.method())) {
      writes++; return route.abort();
    }
    if (url.pathname.endsWith('/explore/selection')) graphReads++;
    return route.continue();
  });
  const page = await context.newPage();
  stage = 'all people and server pagination';
  await page.goto(`${origin}/dashboard?workId=${fixture.workId}&nav=graph`);
  const directory = page.getByLabel('관계도 인물 선택', { exact: true });
  await check(directory).toContainText('전체 인물 231명');
  await check(directory.getByRole('button', { name: /중심으로 보기/ })).toHaveCount(24);
  await check(directory.getByRole('button', { name: /중심으로 보기/ }).first()).toContainText('관계 230개');
  await page.getByRole('button', { name: '다음 인물', exact: true }).click();
  await check(page).toHaveURL(/relationListPage=1/);
  await page.getByRole('button', { name: '이전 인물', exact: true }).click();
  await check(directory.getByRole('button', { name: /중심으로 보기/ }).first()).toContainText('관계 230개');
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: resolve(output, 'directory-desktop.png'), fullPage: true });
  await directory.getByRole('button', { name: /중심으로 보기/ }).first().click();
  stage = 'draft selection without graph reads';
  const chooser = page.getByLabel('연결 상대 선택', { exact: true });
  await check(chooser.getByRole('checkbox')).toHaveCount(24);
  const before = graphReads;
  await chooser.getByRole('checkbox').nth(0).check();
  await chooser.getByRole('checkbox').nth(1).check();
  await check(page.getByText('선택한 인물 2명 · 관계 2개')).toBeVisible();
  assert.equal(graphReads, before);
  await page.setViewportSize({ width: 320, height: 850 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: resolve(output, 'counterparts-mobile.png'), fullPage: false });
  stage = 'real repeated UUID query and focused graph';
  const applied = page.waitForResponse(response => response.url().includes('/explore/selection') && response.url().includes('counterpartNodeIds'));
  await page.getByRole('button', { name: '관계 보기', exact: true }).click();
  const response = await applied;
  assert.equal(response.status(), 200);
  const data = (await response.json()).data;
  assert.equal(data.selectedPeople.length, 2);
  assert.equal(data.graph.edges.length, 2);
  assert.equal(data.graph.nodes.length, 3);
  await check(page.locator('.episode-person')).toHaveCount(3);
  await page.reload();
  await check(page.locator('.episode-person')).toHaveCount(3);
  await page.getByRole('button', { name: '상대 선택 변경', exact: true }).click();
  await check(page.getByText('선택한 인물 2명 · 관계 2개')).toBeVisible();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await check(page.locator('.episode-person')).toHaveCount(3);
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.screenshot({ path: resolve(output, 'selected-desktop.png'), fullPage: true });
  assert.equal(writes, 0);
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ passed: true, directoryPeople: 231,
    directoryPageSize: 24, selectedPeople: 2, renderedEdges: 2, renderedNodes: 3, writes, graphReads,
    apiResponsesMocked: false, productionAccess: false }, null, 2));
  console.log('GH416 real browser / Spring / PostgreSQL integration passed.');
} catch (error) {
  console.error(`GH416 browser check failed at: ${stage}`);
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server?.close();
}
