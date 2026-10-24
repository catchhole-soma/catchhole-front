import { chromium, request } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const options = Object.fromEntries(process.argv.slice(2).reduce((rows, value, index, all) => value.startsWith('--') ? [...rows, [value.slice(2), all[index + 1]]] : rows, []));
const credentials = JSON.parse(await readFile(options.credentials, 'utf8'));
if (credentials.api !== 'http://127.0.0.1:28480' || credentials.frontend !== 'http://127.0.0.1:3340') throw Error('Dedicated progress benchmark only');
await mkdir(options.output, { recursive: true });
const auth = await request.newContext();
const login = await auth.post(credentials.api + '/api/v1/auth/login', { data: { email: credentials.email, password: credentials.password } });
if (!login.ok()) throw Error('Dedicated login failed');
const token = (await login.json()).data.accessToken;
const storageState = await auth.storageState();
await auth.dispose();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState, viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
await context.addInitScript(({ token }) => localStorage.setItem('accessToken', token), { token });
const page = await context.newPage();
const session = await context.newCDPSession(page);
await session.send('Network.enable');
await session.send('Network.setCacheDisabled', { cacheDisabled: true });
const rows = new Map(), pending = new Set(), errors = [];
context.on('request', req => rows.set(req, { url: req.url(), method: req.method(), timing: req.timing(), finished: false }));
context.on('requestfinished', req => {
  const promise = (async () => {
    const row = rows.get(req); if (!row) return;
    const response = await req.response(); await response?.finished();
    Object.assign(row, { status: response?.status(), timing: req.timing(), sizes: await req.sizes(), finished: true });
  })().catch(error => errors.push(String(error)));
  pending.add(promise); promise.finally(() => pending.delete(promise));
});
context.on('requestfailed', req => { const row = rows.get(req); if (row) Object.assign(row, { finished: true, failed: true, failure: req.failure()?.errorText }); });
page.on('pageerror', error => errors.push(String(error)));
await page.goto(`${credentials.frontend}/episode-upload?workId=${credentials.workId}&batchId=${credentials.batchId}&analysisJobIds=${credentials.jobIds.join(',')}&currentAnalysisJobIds=${credentials.jobIds.join(',')}`, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelectorAll('.episode-processing-card').length === 30
  && document.querySelector('.episode-processing__title')?.textContent === '회차를 분석하고 있습니다');
const timing = await page.evaluate(() => ({ timeOriginEpochMs: performance.timeOrigin, observationStartMs: performance.now() }));
const observationCutoffMs = timing.observationStartMs + 15_000;
await page.waitForFunction(cutoff => performance.now() >= cutoff, observationCutoffMs, { timeout: 30_000 });
const drainDeadline = Date.now() + 60_000;
while (Date.now() < drainDeadline && [...rows.values()].some(row => row.timing.startTime - timing.timeOriginEpochMs <= observationCutoffMs && !row.finished)) {
  await new Promise(resolve => setTimeout(resolve, 25));
}
await context.close();
await Promise.allSettled([...pending]);
const requests = [...rows.values()].map(row => ({ ...row, startMs: row.timing.startTime - timing.timeOriginEpochMs, endMs: row.timing.responseEnd >= 0 ? row.timing.startTime - timing.timeOriginEpochMs + row.timing.responseEnd : null, censored: !row.finished }));
const summary = { scenario: '22 completed, 1 RUNNING/INCOMPLETE, 7 blocked pending; 1 PROCESSING world comparison', phase: options.phase, ...timing, observationCutoffMs, viewport: { width: 1280, height: 800 }, browserVersion: browser.version(), runnerSha256: createHash('sha256').update(await readFile(import.meta.filename)).digest('hex'), errors, requests, success: !errors.length && !requests.some(row => row.startMs <= observationCutoffMs && (row.failed || row.censored || row.status >= 400)) };
await writeFile(`${options.output}/active.json`, JSON.stringify(summary, null, 2) + '\n');
await browser.close();
console.log(JSON.stringify({ success: summary.success, observedApiRequests: requests.filter(row => row.url.startsWith(credentials.api + '/api/')).length }));
