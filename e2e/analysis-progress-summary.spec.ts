import { expect, test, type Page, type Route } from '@playwright/test';
import type { AnalysisJobResponse } from '../src/app/api/generated/types.gen';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const runId = '55555555-5555-4555-8555-555555555555';
const jobId = (index: number) => `33333333-3333-4333-8333-${String(index + 1).padStart(12, '0')}`;
const episodeId = (index: number) => `44444444-4444-4444-8444-${String(index + 1).padStart(12, '0')}`;
function job(index: number, status: AnalysisJobResponse['status'] = 'PENDING', journalStatus = 'PENDING'): AnalysisJobResponse {
  return { id: jobId(index), episodeId: episodeId(index), jobType: 'SETTING_EXTRACTION', status, reviewMode: 'AUTOMATIC',
    automaticAppliedAt: status === 'SUCCEEDED' ? '2026-10-24T12:00:00' : null,
    analysisRun: { mode: 'ORDERED_PROVISIONAL', runId, generation: 1, sequence: index, predecessorJobId: index ? jobId(index - 1) : null,
      journalStatus: journalStatus as NonNullable<AnalysisJobResponse['analysisRun']>['journalStatus'] },
    episodes: [{ id: episodeId(index), episodeNo: index + 1, title: `합성 원고 ${index + 1}`, status: status === 'SUCCEEDED' ? 'ANALYZED' : status === 'FAILED' ? 'FAILED' : 'UPLOADED' }] };
}
function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
}
function failure(route: Route) {
  return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'COMMON_INTERNAL_SERVER_ERROR', status: 500 } }) });
}
function url(tracked: string[], current = tracked, superseded: string[] = []) {
  return `/episode-upload?workId=${workId}&batchId=${batchId}&analysisJobIds=${tracked.join(',')}&currentAnalysisJobIds=${current.join(',')}&supersededJobIds=${superseded.join(',')}`;
}
async function setup(page: Page, getJobs: () => AnalysisJobResponse[]) {
  const state = { bulk: [] as string[][], detail: 0, fullCandidates: 0, comparison: 0, comparisonActive: false,
    failBulk: false, failChunk: -1, retries: 0, onRetry: null as null | (() => AnalysisJobResponse[]) };
  await page.clock.install();
  await page.addInitScript(() => localStorage.setItem('accessToken', 'progress-test-token'));
  await page.route('**/api/v1/**', route => {
    const request = route.request(), parsed = new URL(request.url()), path = parsed.pathname;
    if (path.endsWith('/analysis-jobs/progress')) {
      const ids = parsed.searchParams.getAll('analysisJobIds').flatMap(value => value.split(','));
      state.bulk.push(ids);
      return state.failBulk || state.failChunk >= 0 && state.bulk.length >= state.failChunk ? failure(route)
        : success(route, ids.flatMap(id => getJobs().filter(row => row.id === id)));
    }
    if (path.endsWith('/retry')) { state.retries++; return success(route, state.onRetry?.() ?? []); }
    if (path.includes('/analysis-jobs/')) { state.detail++; return failure(route); }
    if (path.endsWith('/world-setting-candidates/progress')) {
      state.comparison++;
      return success(route, { pendingComparisonCount: 0, processingComparisonCount: state.comparisonActive ? 1 : 0, tokenInterruptedComparisonCount: 0 });
    }
    if (path.endsWith('/world-setting-candidates')) { state.fullCandidates++; return failure(route); }
    return success(route, path.endsWith('/auth/me') ? { id: 1, email: 'progress@local.invalid', displayName: '측정', role: 'AUTHOR', status: 'ACTIVE' }
      : path.endsWith(`/works/${workId}`) ? { id: workId, title: '진행 상태 작품', lifecycleStatus: 'ACTIVE' } : []);
  });
  return state;
}

test('30개 현재 작업은 한 묶음으로 조회하고 활성 상태만 3초 갱신한다', async ({ page }) => {
  const jobs = Array.from({ length: 30 }, (_, index) => job(index, index ? 'PENDING' : 'RUNNING'));
  const state = await setup(page, () => jobs);
  await page.goto(url(jobs.map(row => row.id!)));
  await expect(page.locator('.episode-processing-card')).toHaveCount(30);
  expect(state.bulk).toHaveLength(1); expect(state.bulk[0]).toHaveLength(30);
  expect(state.detail).toBe(0); expect(state.fullCandidates).toBe(0);
  await page.clock.fastForward(2900); expect(state.bulk).toHaveLength(1);
  await page.clock.fastForward(200); await expect.poll(() => state.bulk.length).toBe(2);
});

test('완료·실패·차단 대기는 30초 확인하며 외부 재개와 무효화를 발견한다', async ({ page }) => {
  let jobs = Array.from({ length: 30 }, (_, index) => job(index, index < 22 ? 'SUCCEEDED' : index === 22 ? 'FAILED' : 'PENDING', index < 22 ? 'SEALED' : index === 22 ? 'INCOMPLETE' : 'PENDING'));
  const state = await setup(page, () => jobs);
  await page.goto(url(jobs.map(row => row.id!)));
  await expect(page.getByText('순차 분석이 중단되었습니다', { exact: true })).toBeVisible();
  await expect(page.getByText('앞 회차 재개 대기', { exact: true })).toHaveCount(7);
  await page.clock.fastForward(9000); expect(state.bulk).toHaveLength(1);
  jobs[22] = job(22, 'RUNNING', 'PENDING');
  await page.clock.fastForward(21_100); await expect.poll(() => state.bulk.length).toBe(2);
  await expect(page.getByText('회차를 분석하고 있습니다', { exact: true })).toBeVisible();
  await page.clock.fastForward(3100); await expect.poll(() => state.bulk.length).toBe(3);
  jobs = jobs.map((_, index) => job(index, 'SUCCEEDED', 'INVALIDATED'));
  await page.clock.fastForward(3100); await expect(page.getByText('기존 분석을 이어갈 수 없습니다', { exact: true })).toBeVisible();
  const stopped = state.bulk.length; await page.clock.fastForward(60_000); expect(state.bulk).toHaveLength(stopped);
});

test('SEALED라도 자동 저장 latch가 없으면 완료를 잠그고 3초 확인한다', async ({ page }) => {
  const pendingStore = { ...job(0, 'SUCCEEDED', 'SEALED'), automaticAppliedAt: null };
  const state = await setup(page, () => [pendingStore]);
  await page.goto(url([jobId(0)]));
  await expect(page.getByRole('button', { name: '설정 저장 상태 확인 필요', exact: true })).toBeDisabled();
  await expect(page.getByText('분석이 완료되었습니다', { exact: true })).toHaveCount(0);
  await page.clock.fastForward(3100); await expect.poll(() => state.bulk.length).toBe(2);
});

test('같은 ID 재개 응답은 즉시 묶음 캐시를 바꾸고 빠른 갱신으로 돌아온다', async ({ page }) => {
  let jobs = [job(0, 'FAILED', 'INCOMPLETE'), job(1)];
  const state = await setup(page, () => jobs);
  state.onRetry = () => { jobs = [job(0, 'RUNNING'), job(1)]; return [job(0)]; };
  await page.goto(url(jobs.map(row => row.id!)));
  await page.getByRole('button', { name: '중단된 회차부터 재개', exact: true }).click();
  await expect(page.getByText('회차를 분석하고 있습니다', { exact: true })).toBeVisible();
  expect(state.retries).toBe(1); expect(state.detail).toBe(0);
  const refreshed = state.bulk.length; expect(refreshed).toBeGreaterThan(1);
  await page.clock.fastForward(3100); await expect.poll(() => state.bulk.length).toBeGreaterThan(refreshed);
});

test('재개 전 시작한 늦은 실패 응답은 취소되고 같은 ID의 실행 상태를 덮어쓰지 않는다', async ({ page }) => {
  let jobs = [job(0, 'FAILED', 'INCOMPLETE'), job(1)];
  const state = await setup(page, () => jobs);
  state.onRetry = () => { jobs = [job(0, 'RUNNING'), job(1)]; return [job(0)]; };
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let holdNext = false, pendingRead = false, canceled = false, released = false;
  page.on('requestfailed', request => { if (request.url().includes('/analysis-jobs/progress')) canceled = true; });
  await page.route('**/analysis-jobs/progress**', async route => {
    if (!holdNext) return route.fallback();
    holdNext = false; pendingRead = true;
    const previousJobs = [...jobs];
    await held;
    await success(route, previousJobs).catch(() => {});
    released = true;
  });
  try {
    await page.goto(url([jobId(0), jobId(1)]));
    await expect(page.getByRole('button', { name: '중단된 회차부터 재개', exact: true })).toBeVisible();
    holdNext = true;
    await page.clock.fastForward(30_100);
    await expect.poll(() => pendingRead).toBe(true);
    await page.getByRole('button', { name: '중단된 회차부터 재개', exact: true }).click();
    await expect(page.getByText('회차를 분석하고 있습니다', { exact: true })).toBeVisible();
    await expect.poll(() => canceled).toBe(true);
    release();
    await expect.poll(() => released).toBe(true);
    await expect(page.getByText('회차를 분석하고 있습니다', { exact: true })).toBeVisible();
    await expect(page.getByText('순차 분석이 중단되었습니다', { exact: true })).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get('currentAnalysisJobIds')?.split(',')).toEqual([jobId(0), jobId(1)]);
    expect(state.retries).toBe(1);
  } finally {
    release();
  }
});

test('재개 응답의 새 ID는 후속 상태 조회가 대기 중이어도 보존하고 새로고침으로 복구한다', async ({ page }) => {
  let jobs = [job(0, 'FAILED', 'INCOMPLETE'), job(1, 'SUCCEEDED', 'SEALED')];
  const state = await setup(page, () => jobs);
  const replacementId = '77777777-7777-4777-8777-777777777777';
  const replacement = { ...job(0, 'RUNNING'), id: replacementId };
  state.onRetry = () => { jobs = [...jobs, replacement]; return [replacement]; };
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let holdRefresh = true, pendingRefreshes = 0;
  await page.route('**/analysis-jobs/progress**', async route => {
    const ids = new URL(route.request().url()).searchParams.getAll('analysisJobIds').flatMap(value => value.split(','));
    if (!holdRefresh || !ids.includes(replacementId)) return route.fallback();
    pendingRefreshes++;
    await held;
    await success(route, jobs.filter(row => ids.includes(row.id!))).catch(() => {});
  });
  try {
    await page.goto(url([jobId(0), jobId(1)]));
    await page.getByRole('button', { name: '중단된 회차부터 재개', exact: true }).click();
    await expect.poll(() => pendingRefreshes).toBeGreaterThan(0);
    await expect.poll(() => new URL(page.url()).searchParams.get('currentAnalysisJobIds')?.split(','))
      .toEqual([jobId(1), replacementId]);
    expect(new URL(page.url()).searchParams.get('analysisJobIds')?.split(',')).toEqual([jobId(0), jobId(1), replacementId]);
    holdRefresh = false;
    await page.reload();
    await expect(page.getByText('회차를 분석하고 있습니다', { exact: true })).toBeVisible();
    expect(state.bulk.at(-1)).toContain(replacementId);
    expect(state.retries).toBe(1);
  } finally {
    release();
  }
});

for (const status of ['RUNNING', 'PENDING'] as const) {
  test(`무효화된 ${status} 작업은 종료까지 조회하고 실패한 조회도 수동 재시도로 복구한다`, async ({ page }) => {
    let jobs = [job(0, status, 'INVALIDATED')];
    const state = await setup(page, () => jobs);
    await page.goto(url([jobId(0)]));
    const restart = page.getByRole('button', { name: '새 순차 분석', exact: true });
    await expect(restart).toBeDisabled();
    state.failBulk = true;
    await page.clock.fastForward(status === 'RUNNING' ? 3100 : 30_100);
    await expect(page.getByText('상태를 갱신하지 못했습니다.', { exact: false })).toBeVisible();
    await expect(restart).toBeDisabled();
    jobs = [job(0, 'FAILED', 'INVALIDATED')];
    state.failBulk = false;
    await page.getByRole('button', { name: '다시 시도', exact: true }).click();
    await expect(restart).toBeEnabled();
    expect(state.bulk.at(-1)).toEqual([jobId(0)]);
    const stopped = state.bulk.length;
    await page.clock.fastForward(60_000);
    await page.evaluate(() => { window.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('online')); });
    await page.clock.fastForward(1000);
    expect(state.bulk).toHaveLength(stopped);
  });
}

test('이력은 처음 한 번 읽고 실패한 갱신은 마지막 행과 묶음 재시도를 유지한다', async ({ page }) => {
  const jobs = [job(0, 'SUCCEEDED', 'SEALED'), job(1, 'FAILED', 'INCOMPLETE'), job(2, 'RUNNING')];
  const state = await setup(page, () => jobs);
  await page.goto(url(jobs.map(row => row.id!), [jobId(2)], [jobId(1)]));
  await expect(page.locator('.episode-processing-card')).toHaveCount(1);
  expect(state.bulk[0]).toEqual(jobs.map(row => row.id!));
  state.failBulk = true;
  await page.clock.fastForward(3100);
  await expect(page.getByText('상태를 갱신하지 못했습니다.', { exact: false })).toBeVisible();
  await expect(page.locator('.episode-processing-card')).toHaveCount(1);
  expect(state.bulk.at(-1)).toEqual([jobId(2)]);
  state.failBulk = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('상태를 갱신하지 못했습니다.', { exact: false })).toHaveCount(0);
  expect(state.bulk.at(-1)).toEqual([jobId(2)]); expect(state.detail).toBe(0);
});

test('101개 이력은 100개씩 순서대로 읽고 후속 묶음 실패를 부분 성공으로 표시하지 않는다', async ({ page }) => {
  const jobs = Array.from({ length: 101 }, (_, index) => job(index, 'SUCCEEDED', 'SEALED'));
  const state = await setup(page, () => jobs); state.failChunk = 2;
  await page.goto(url(jobs.map(row => row.id!), [jobId(100)]));
  await expect(page.getByText('상태를 갱신하지 못했습니다.', { exact: false })).toBeVisible();
  expect(state.bulk.slice(0, 2).map(ids => ids.length)).toEqual([100, 1]);
  await expect(page.getByText('분석이 완료되었습니다', { exact: true })).toHaveCount(0);
  state.failChunk = -1;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('분석이 완료되었습니다', { exact: true })).toBeVisible();
  expect(state.bulk.slice(-2).map(ids => ids.length)).toEqual([100, 1]);
});

test('비교 처리는 작업과 독립적으로 가벼운 집계만 3초 갱신한다', async ({ page }) => {
  const jobs = [job(0, 'SUCCEEDED', 'SEALED')];
  const state = await setup(page, () => jobs); state.comparisonActive = true;
  await page.goto(url([jobId(0)]));
  await expect(page.getByText('분석이 완료되었습니다', { exact: true })).toBeVisible();
  const initial = state.comparison;
  await page.clock.fastForward(3100); await expect.poll(() => state.comparison).toBeGreaterThan(initial);
  expect(state.bulk).toHaveLength(1); expect(state.fullCandidates).toBe(0);
  state.comparisonActive = false;
  await page.clock.fastForward(3100); await expect.poll(() => state.comparison).toBe(initial + 2);
  const stopped = state.comparison; await page.clock.fastForward(10_000); expect(state.comparison).toBe(stopped);
});

test('101개 갱신의 뒤 묶음 실패는 앞 묶음의 변경도 캐시에 부분 반영하지 않는다', async ({ page }) => {
  let jobs = Array.from({ length: 101 }, (_, index) => job(index, 'SUCCEEDED', 'SEALED'));
  const state = await setup(page, () => jobs);
  await page.goto(url(jobs.map(row => row.id!)));
  await expect(page.getByText('분석이 완료되었습니다', { exact: true })).toBeVisible();
  state.failChunk = 4;
  jobs = jobs.map((row, index) => job(index, 'RUNNING'));
  await page.clock.fastForward(30_100);
  await expect(page.getByText('상태를 갱신하지 못했습니다.', { exact: false })).toBeVisible();
  await expect(page.getByText('설정 자동 반영 완료', { exact: true })).toHaveCount(101);
  await expect(page.getByText('회차를 분석하고 있습니다', { exact: true })).toHaveCount(0);
  state.failChunk = -1;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('회차를 분석하고 있습니다', { exact: true })).toBeVisible();
});

test('취소된 뒤 묶음은 작품을 바꾼 화면으로 이전 결과를 가져오지 않는다', async ({ page }) => {
  const jobs = Array.from({ length: 101 }, (_, index) => job(index, 'SUCCEEDED', 'SEALED'));
  await setup(page, () => jobs);
  const otherWorkId = '66666666-6666-4666-8666-666666666666';
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let pendingOldChunk = false, canceled = false;
  page.on('requestfailed', request => { if (request.url().includes(`${workId}/analysis-jobs/progress`)) canceled = true; });
  await page.route('**/analysis-jobs/progress**', async route => {
    const parsed = new URL(route.request().url());
    if (parsed.pathname.includes(otherWorkId)) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'ANALYSIS_JOB_NOT_FOUND', status: 404 } }) }); return;
    }
    const ids = parsed.searchParams.getAll('analysisJobIds').flatMap(value => value.split(','));
    if (ids.length === 1) { pendingOldChunk = true; await held; }
    await success(route, jobs.filter(job => ids.includes(job.id!))).catch(() => {});
  });
  await page.goto(url(jobs.map(row => row.id!)));
  await expect.poll(() => pendingOldChunk).toBe(true);
  await expect(page.locator('.episode-processing-card')).toHaveCount(0);
  await page.evaluate(otherWorkId => {
    const next = new URL(location.href); next.searchParams.set('workId', otherWorkId);
    history.pushState(null, '', next); window.dispatchEvent(new PopStateEvent('popstate'));
  }, otherWorkId);
  await expect(page.getByText('상태를 갱신하지 못했습니다.', { exact: false })).toBeVisible();
  await expect.poll(() => canceled).toBe(true);
  release();
  await page.clock.fastForward(1000);
  await expect(page.locator('.episode-processing-card')).toHaveCount(0);
  await expect(page.getByText('분석이 완료되었습니다', { exact: true })).toHaveCount(0);
});

test('이력 ID가 없어도 현재 작업만으로 완료나 새 분석을 열지 않는다', async ({ page }) => {
  const state = await setup(page, () => [job(0, 'SUCCEEDED', 'SEALED')]);
  await page.goto(url([jobId(0), jobId(1)], [jobId(0)], [jobId(1)]));
  await expect(page.getByText('상태를 갱신하지 못했습니다.', { exact: false })).toBeVisible();
  expect(state.bulk[0]).toEqual([jobId(0), jobId(1)]);
  await expect(page.getByText('분석이 완료되었습니다', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '새 순차 분석', exact: true })).toHaveCount(0);
});

test('새 실행 생성 뒤 첫 상태 조회가 실패해도 새 ID를 보존하고 상태 재시도로 복구한다', async ({ page }) => {
  let jobs = [job(0, 'SUCCEEDED', 'INVALIDATED'), job(1, 'SUCCEEDED', 'INVALIDATED')];
  const state = await setup(page, () => jobs);
  let creates = 0;
  const newIds = [jobId(0).replace(/^33333333/, '77777777'), jobId(1).replace(/^33333333/, '77777777')];
  await page.route(`**/works/${workId}/episodes`, route => success(route, jobs.map((row, index) => ({ id: episodeId(index), episodeNo: index + 1, batchId, status: 'ANALYZED' }))));
  await page.route(`**/works/${workId}/analysis-jobs`, route => {
    creates++;
    const created = newIds.map((id, index) => ({ ...job(index), id }));
    jobs = [...jobs, ...created]; state.failBulk = true;
    return success(route, created);
  });
  await page.goto(url([jobId(0), jobId(1)]));
  await page.getByRole('button', { name: '새 순차 분석', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '새 순차 분석 시작', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('currentAnalysisJobIds')?.split(',')).toEqual(newIds);
  expect(new URL(page.url()).searchParams.get('analysisJobIds')?.split(',')).toEqual([jobId(0), jobId(1), ...newIds]);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('상태를 갱신하지 못했습니다.', { exact: false })).toBeVisible();
  expect(creates).toBe(1);
  await page.reload();
  await expect(page.getByText('상태를 갱신하지 못했습니다.', { exact: false })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('currentAnalysisJobIds')?.split(',')).toEqual(newIds);
  state.failBulk = false;
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByText('회차를 분석하고 있습니다', { exact: true })).toBeVisible();
  expect(creates).toBe(1);
});
