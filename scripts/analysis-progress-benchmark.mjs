import { chromium, request } from '@playwright/test';
import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';

const options = Object.fromEntries(process.argv.slice(2).reduce((rows, value, index, all) => value.startsWith('--') ? [...rows, [value.slice(2), all[index + 1]]] : rows, []));
const credentials = JSON.parse(await readFile(options.credentials, 'utf8'));
for (const key of ['api', 'frontend']) if (!['127.0.0.1', 'localhost'].includes(new URL(credentials[key]).hostname)) throw Error('Dedicated localhost runtime required');
if (credentials.api !== 'http://127.0.0.1:28480' || credentials.frontend !== 'http://127.0.0.1:3340') throw Error('Unexpected progress benchmark ports');
const output = options.output;
const smoke = options.smoke === 'true';
const phase = options.phase ?? 'before';
await mkdir(output, { recursive: true });
const protocol = { warmups: smoke ? 0 : 3, pages: smoke ? 1 : 10, apiSamples: smoke ? 1 : 30, pollingWindows: smoke ? 0 : 3, pollingWindowMs: 65_000, viewport: { width: 1280, height: 800 }, timeoutMs: 60_000, firstLoadObservationMs: 2000 };
const auth = await request.newContext();
const login = await auth.post(credentials.api + '/api/v1/auth/login', { data: { email: credentials.email, password: credentials.password } });
if (!login.ok()) throw Error('Dedicated login failed: ' + login.status());
const token = (await login.json()).data.accessToken;
const storageState = await auth.storageState();
await auth.dispose();
const browser = await chromium.launch({ headless: true });
const pages = [], apis = [];
const write = (name, value) => appendFile(`${output}/${name}.jsonl`, JSON.stringify(value) + '\n');
const route = `/episode-upload?workId=${credentials.workId}&batchId=${credentials.batchId}&analysisJobIds=${credentials.jobIds.join(',')}&currentAnalysisJobIds=${credentials.jobIds.join(',')}&jobType=SETTING_EXTRACTION`;

function installReadiness() {
  window.__progressReady = null;
  function check() {
    const cards = [...document.querySelectorAll('.episode-processing-card')];
    const labels = cards.map(card => card.querySelector('.episode-processing-card__status')?.textContent?.trim());
    const heading = document.querySelector('.episode-processing__title')?.textContent;
    const retry = [...document.querySelectorAll('.episode-processing__actions button')].find(button => button.textContent?.includes('재개'));
    return cards.length === 30 && labels.filter(label => label === '설정 자동 반영 완료').length === 22
      && labels.filter(label => label === '비교 미완료').length === 1
      && labels.filter(label => label === '앞 회차 재개 대기').length === 7
      && heading === '순차 분석이 중단되었습니다' && retry && !retry.disabled;
  }
  let armed = false;
  function tick() {
    if (window.__progressReady) return;
    if (check() && !armed) {
      armed = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (check()) window.__progressReady = { pageReadyMs: performance.now(), timeOriginEpochMs: performance.timeOrigin, assertedRows: 30, successRows: 22, incompleteRows: 1, blockedRows: 7 };
        else armed = false;
      }));
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function pageSample(kind, index, observationMs = 0) {
  const context = await browser.newContext({ storageState, viewport: protocol.viewport, serviceWorkers: 'block' });
  await context.addInitScript(({ token }) => localStorage.setItem('accessToken', token), { token });
  await context.addInitScript(installReadiness);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const events = new Map(), pending = new Set(), errors = [], preflights = [], preflightById = new Map();
  cdp.on('Network.requestWillBeSent', event => {
    if (event.request.method !== 'OPTIONS') return;
    const row = { url: event.request.url, startEpochMs: event.wallTime * 1000, startSeconds: event.timestamp };
    preflightById.set(event.requestId, row); preflights.push(row);
  });
  cdp.on('Network.responseReceived', event => { const row = preflightById.get(event.requestId); if (row) row.status = event.response.status; });
  cdp.on('Network.loadingFinished', event => { const row = preflightById.get(event.requestId); if (row) Object.assign(row, { endEpochMs: row.startEpochMs + (event.timestamp - row.startSeconds) * 1000, encodedDataLength: event.encodedDataLength }); });
  context.on('request', req => events.set(req, { url: req.url(), method: req.method(), resourceType: req.resourceType(), finished: false, timing: req.timing() }));
  context.on('requestfinished', req => {
    const collecting = (async () => {
      const row = events.get(req); if (!row) return;
      const response = await req.response(); await response?.finished();
      Object.assign(row, { finished: true, status: response?.status(), timing: req.timing(), sizes: await req.sizes() });
    })().catch(error => errors.push(String(error)));
    pending.add(collecting); collecting.finally(() => pending.delete(collecting));
  });
  context.on('requestfailed', req => { const row = events.get(req); if (row) Object.assign(row, { finished: true, failed: true, failure: req.failure()?.errorText, timing: req.timing() }); });
  page.on('pageerror', error => errors.push(String(error)));
  const row = { kind, index, success: false, startedEpochMs: Date.now() };
  const started = performance.now();
  try {
    await page.goto(credentials.frontend + route, { waitUntil: 'commit', timeout: protocol.timeoutMs });
    await page.waitForFunction(() => window.__progressReady, { timeout: protocol.timeoutMs, polling: 20 });
    Object.assign(row, await page.evaluate(() => window.__progressReady));
    await page.waitForFunction(() => performance.getEntriesByType('navigation')[0]?.loadEventEnd > 0, { timeout: protocol.timeoutMs });
    row.loadEventEndMs = await page.evaluate(() => performance.getEntriesByType('navigation')[0].loadEventEnd);
    row.observationStartMs = Math.max(row.pageReadyMs, row.loadEventEndMs);
    row.observationCutoffMs = row.observationStartMs + (observationMs || protocol.firstLoadObservationMs);
    await page.waitForFunction(cutoff => performance.now() >= cutoff, row.observationCutoffMs, { timeout: observationMs + protocol.timeoutMs });
    const drainStarted = performance.now();
    while (performance.now() - drainStarted < protocol.timeoutMs) {
      const observed = [...events.values()].filter(req => req.timing.startTime - row.timeOriginEpochMs <= row.observationCutoffMs);
      if (observed.every(req => req.finished) && pending.size === 0) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    row.success = true;
  } catch (error) {
    row.error = String(error).split('\n')[0];
    Object.assign(row, await page.evaluate(() => ({ timeOriginEpochMs: performance.timeOrigin, location: location.pathname })).catch(() => ({})));
  }
  await Promise.allSettled([...pending]);
  row.elapsedMs = performance.now() - started;
  row.finishedEpochMs = Date.now();
  row.requests = [...events.values()].map(req => ({ ...req, startMs: req.timing.startTime - row.timeOriginEpochMs, endMs: req.timing.responseEnd >= 0 ? req.timing.startTime - row.timeOriginEpochMs + req.timing.responseEnd : null, censored: !req.finished }));
  row.preflights = preflights;
  row.collectorErrors = errors;
  const observed = row.requests.filter(req => row.observationCutoffMs === undefined || req.startMs <= row.observationCutoffMs);
  row.success = row.success && !errors.length && !observed.some(req => req.failed || req.censored || req.status >= 400);
  if (kind === 'smoke' || kind === 'navigation' && index === 0) {
    await page.screenshot({ path: `${output}/${kind}-${index}.png`, fullPage: true });
    await writeFile(`${output}/${kind}-${index}-visible-text.txt`, await page.locator('body').innerText());
  }
  await write('pages', row); pages.push(row); await context.close();
}

function jobRoutes() {
  const root = `${credentials.api}/api/v1/works/${credentials.workId}/analysis-jobs`;
  return phase === 'before' ? credentials.jobIds.map(id => `${root}/${id}`) : [`${root}/progress?analysisJobIds=${credentials.jobIds.join(',')}`];
}
const worldRoute = `${credentials.api}/api/v1/works/${credentials.workId}/world-setting-candidates${phase === 'before' ? `?batchId=${credentials.batchId}&page=0&size=1` : `/progress?batchId=${credentials.batchId}`}`;
async function apiSample(kind, index, label, routes) {
  const started = performance.now();
  const responses = await Promise.all(routes.map(async url => {
    const begin = performance.now();
    try {
      const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(protocol.timeoutMs) });
      const body = Buffer.from(await response.arrayBuffer());
      return { url, status: response.status, latencyMs: performance.now() - begin, decodedResponseBytes: body.length, success: response.ok };
    } catch (error) { return { url, latencyMs: performance.now() - begin, error: String(error), success: false }; }
  }));
  const row = { kind, index, label, latencyMs: performance.now() - started, responses, success: responses.every(response => response.success), decodedResponseBytes: responses.reduce((sum, response) => sum + (response.decodedResponseBytes ?? 0), 0) };
  await write('api', row); apis.push(row);
}
await apiSample('initial-cold-jvm-request', 0, 'job-round', jobRoutes());
await apiSample('initial-cold-jvm-request', 0, 'comparison', [worldRoute]);
for (let index = 0; index < protocol.warmups; index++) await pageSample('warmup', index);
for (let index = 0; index < protocol.pages; index++) await pageSample(smoke ? 'smoke' : 'navigation', index);
for (let index = 0; index < protocol.pollingWindows; index++) await pageSample('polling', index, protocol.pollingWindowMs);
for (let index = 0; index < protocol.warmups; index++) for (const [label, routes] of [['job-round', jobRoutes()], ['comparison', [worldRoute]]]) await apiSample('warmup', index, label, routes);
for (let index = 0; index < protocol.apiSamples; index++) for (const [label, routes] of [['job-round', jobRoutes()], ['comparison', [worldRoute]]]) await apiSample('measured', index, label, routes);
function stats(values) { const sorted = values.filter(Number.isFinite).sort((a, b) => a - b); return { n: sorted.length, median: sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2 : null, p95: sorted[Math.ceil(sorted.length * .95) - 1] ?? null, max: sorted.at(-1) ?? null }; }
const measuredPages = pages.filter(row => row.kind === 'navigation' || row.kind === 'smoke');
const summary = { phase, protocol, browserVersion: browser.version(), runnerSha256: createHash('sha256').update(await readFile(import.meta.filename)).digest('hex'), measuredNavigation: { total: measuredPages.length, failures: measuredPages.filter(row => !row.success).length, pageReadyMs: stats(measuredPages.filter(row => row.success).map(row => row.pageReadyMs)), loadEventEndMs: stats(measuredPages.filter(row => row.success).map(row => row.loadEventEndMs)) }, polling: pages.filter(row => row.kind === 'polling').map(row => ({ index: row.index, success: row.success, observationStartMs: row.observationStartMs, observationCutoffMs: row.observationCutoffMs, requests: row.requests.filter(req => req.url.startsWith(credentials.api + '/api/')).map(req => ({ url: req.url, startMs: req.startMs, status: req.status, bytes: req.sizes?.responseBodySize, censored: req.censored })) })), api: Object.fromEntries(['job-round', 'comparison'].map(label => { const selected = apis.filter(row => row.kind === 'measured' && row.label === label); return [label, { samples: selected.length, failures: selected.filter(row => !row.success).length, latencyMs: stats(selected.filter(row => row.success).map(row => row.latencyMs)), decodedResponseBytes: stats(selected.filter(row => row.success).map(row => row.decodedResponseBytes)) }]; })) };
await writeFile(`${output}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
await browser.close();
console.log(JSON.stringify({ output, failures: measuredPages.filter(row => !row.success).length, pollingWindows: summary.polling.length, api: summary.api }));
