import { expect, test, type Page, type Route } from '@playwright/test';
import { clearAnalysisStartCheck } from './analysis-start-check';
import { getGtagEvents, installGtagMock } from './gtag';
import type { AnalysisJobResponse } from '../src/app/api/generated/types.gen';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const runId = '55555555-5555-4555-8555-555555555555';
const jobId = '33333333-3333-4333-8333-000000000001';
const episodeId = '44444444-4444-4444-8444-000000000001';
const report = '/api/v1/first-analysis-completion-reports';
const progressUrl = `/episode-upload?workId=${workId}&batchId=${batchId}&analysisJobIds=${jobId}&currentAnalysisJobIds=${jobId}&supersededJobIds=`;

function job(done: boolean): AnalysisJobResponse {
  return { id: jobId, episodeId, jobType: 'SETTING_EXTRACTION', status: done ? 'SUCCEEDED' : 'RUNNING', reviewMode: 'AUTOMATIC',
    automaticAppliedAt: done ? '2026-11-11T12:00:00' : null,
    analysisRun: { mode: 'ORDERED_PROVISIONAL', runId, generation: 1, sequence: 0, predecessorJobId: null,
      journalStatus: done ? 'SEALED' : 'PENDING' },
    episodes: [{ id: episodeId, episodeNo: 1, title: '합성 원고 1', status: done ? 'ANALYZED' : 'UPLOADED' }] };
}

function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
}

// 서버처럼 claim이 한 번 true를 주면 이후 조회·선점은 false가 된다.
async function setup(page: Page, { reportable = true, claimGranted = true } = {}) {
  const state = { reportable, claimGranted, done: false, gets: 0, claims: 0 };
  await page.addInitScript(() => localStorage.setItem('accessToken', 'first-analysis-test-token'));
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === report) { state.gets++; return success(route, { shouldReport: state.reportable }); }
    if (path === `${report}/claim`) {
      state.claims++;
      const granted = state.reportable && state.claimGranted;
      state.reportable = false;
      return success(route, { shouldReport: granted });
    }
    if (path.endsWith('/analysis-start-checks')) return success(route, clearAnalysisStartCheck);
    if (path.endsWith('/analysis-jobs/progress')) return success(route, [job(state.done)]);
    if (path.endsWith('/world-setting-candidates/progress')) {
      return success(route, { pendingComparisonCount: 0, processingComparisonCount: 0, tokenInterruptedComparisonCount: 0 });
    }
    return success(route, path.endsWith('/auth/me') ? { id: 7, email: 'first@local.invalid', displayName: '첫 분석', role: 'AUTHOR', status: 'ACTIVE' }
      : path.endsWith(`/works/${workId}`) ? { id: workId, title: '첫 분석 작품', lifecycleStatus: 'ACTIVE' } : []);
  });
  return state;
}

test('GA4가 있으면 앱 진입 때 한 번 선점하고 첫 분석 완료 이벤트를 한 번 보낸다', async ({ page }) => {
  await installGtagMock(page);
  const state = await setup(page);
  await page.goto(`/episode-upload?workId=${workId}`);
  await expect.poll(() => state.claims).toBe(1);
  await expect.poll(() => getGtagEvents(page, 'first_analysis_complete')).toEqual([['event', 'first_analysis_complete']]);

  // 새로고침해도 서버가 이미 보고했다고 답하므로 다시 선점하거나 보내지 않는다.
  await page.reload();
  await expect.poll(() => state.gets).toBe(2);
  await page.waitForTimeout(300);
  expect(state.claims).toBe(1);
  expect(await getGtagEvents(page, 'first_analysis_complete')).toEqual([]);
});

test('다른 탭이 먼저 선점해 false를 받으면 이벤트를 보내지 않는다', async ({ page }) => {
  await installGtagMock(page);
  const state = await setup(page, { claimGranted: false });
  await page.goto(`/episode-upload?workId=${workId}`);
  await expect.poll(() => state.claims).toBe(1);
  await page.waitForTimeout(300);
  expect(await getGtagEvents(page, 'first_analysis_complete')).toEqual([]);
});

test('GA4가 없는 환경에서는 보고 여부를 조회하거나 선점하지 않는다', async ({ page }) => {
  const state = await setup(page);
  await page.goto(`/episode-upload?workId=${workId}`);
  await expect(page.getByRole('button', { name: /단일 회차 업로드/ })).toBeVisible();
  await page.waitForTimeout(500);
  expect(state.gets).toBe(0);
  expect(state.claims).toBe(0);
});

test('업로드 진행 화면에서 분석 완료를 보면 서버 판정을 다시 확인해 이벤트를 보낸다', async ({ page }) => {
  await page.clock.install();
  await installGtagMock(page);
  const state = await setup(page, { reportable: false });
  await page.goto(progressUrl);
  await expect.poll(() => state.gets).toBe(1);
  expect(state.claims).toBe(0);

  // 서버에서 분석이 끝나 보고 대상이 된 뒤, 진행 화면의 다음 조회가 완료를 본다.
  state.done = true;
  state.reportable = true;
  await page.clock.fastForward(3100);
  await expect(page.getByText('분석이 완료되었습니다', { exact: true })).toBeVisible();
  await expect.poll(() => state.claims).toBe(1);
  await expect.poll(() => getGtagEvents(page, 'first_analysis_complete')).toEqual([['event', 'first_analysis_complete']]);
});
