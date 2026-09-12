import { expect, test, type Page, type Route } from '@playwright/test';
import type { AnalysisJobResponse } from '../src/app/api/generated/types.gen';
import { canResumeOrderedAnalysis, isBlockedOrderedAnalysis, isCompletedOrderedAnalysis } from '../src/app/lib/ordered-analysis';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const jobIds = ['33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333334'];
const episodeIds = ['44444444-4444-4444-8444-444444444444', '44444444-4444-4444-8444-444444444445'];
const runId = '55555555-5555-4555-8555-555555555555';

function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
}

function job(index: number, status: AnalysisJobResponse['status'], journalStatus: NonNullable<AnalysisJobResponse['analysisRun']>['journalStatus']): AnalysisJobResponse {
  return {
    id: jobIds[index], workId, batchId, episodeId: episodeIds[index], workTitle: '순차 분석 작품',
    jobType: 'SETTING_EXTRACTION', status,
    episodes: [{ id: episodeIds[index], episodeNo: index + 2, title: `원고 ${index + 2}`,
      status: status === 'SUCCEEDED' ? 'ANALYZED' : status === 'FAILED' ? 'FAILED' : 'UPLOADED' }],
    analysisRun: { mode: 'ORDERED_PROVISIONAL', runId, generation: 1, sequence: index,
      predecessorJobId: index ? jobIds[0] : null, journalStatus },
  };
}

async function installBaseRoutes(page: Page) {
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    return success(route, path.endsWith('/auth/me')
      ? { id: 1, email: 'ordered@example.com', displayName: '순차 테스트', role: 'AUTHOR', status: 'ACTIVE' }
      : path.endsWith(`/works/${workId}`)
        ? { id: workId, title: '순차 분석 작품', genre: '판타지', lifecycleStatus: 'ACTIVE' }
        : path.endsWith('/episodes/upload-policy')
          ? { completedSingleEpisodeCount: 10, requiredSingleEpisodeCount: 10, multiEpisodeUploadEnabled: true, pendingCharacterCandidateCount: 0, pendingWorldSettingCandidateCount: 0, maxUploadCharacters: 250000 }
          : path.endsWith('/world-setting-candidates')
          ? { pendingCandidateCount: 0, tokenInterruptedComparisonCount: 0, activeComparisonJobCount: 0 }
          : []);
  });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'ordered-test-token'));
}

function progressUrl() {
  return `/episode-upload?workId=${workId}&batchId=${batchId}&analysisJobIds=${jobIds.join(',')}&currentAnalysisJobIds=${jobIds.join(',')}`;
}

test('자동 분석은 저장 완료까지 확인해야 다음 회차를 완료 처리한다', () => {
  const first = { ...job(0, 'SUCCEEDED', 'SEALED'), reviewMode: 'AUTOMATIC' as const };
  const second = job(1, 'PENDING', 'PENDING');
  expect(isCompletedOrderedAnalysis(first)).toBe(false);
  expect(isBlockedOrderedAnalysis(second, [first, second])).toBe(true);
  const stored = { ...first, automaticAppliedAt: '2026-09-11T20:00:00' };
  expect(isCompletedOrderedAnalysis(stored)).toBe(true);
  expect(isBlockedOrderedAnalysis(second, [stored, second])).toBe(false);
});

test('저장 완료가 확인되지 않은 분석은 완료나 계속 진행 중으로 표시하지 않는다', async ({ page }) => {
  await installBaseRoutes(page);
  await page.route('**/analysis-jobs/**', route => {
    const index = new URL(route.request().url()).pathname.endsWith(jobIds[1]) ? 1 : 0;
    return success(route, { ...job(index, index ? 'PENDING' : 'SUCCEEDED', index ? 'PENDING' : 'SEALED'),
      reviewMode: 'AUTOMATIC' });
  });
  await page.goto(progressUrl());
  await expect(page.getByText('순차 분석이 중단되었습니다', { exact: true })).toBeVisible();
  await expect(page.getByText('앞 회차 재개 대기', { exact: true })).toBeVisible();
  await expect(page.getByText('분석 결과의 저장 완료를 확인하지 못했습니다.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '설정 후보 검토', exact: true })).toHaveCount(0);
});

for (const initialStatus of ['FAILED', 'SUCCEEDED'] as const) {
  test(`앞 회차 ${initialStatus}+비교 미완료와 뒤 회차 대기에서 같은 Job을 재개하고 갱신한다`, async ({ page }) => {
    await installBaseRoutes(page);
    let resumed = false;
    let retryCalls = 0;
    await page.route('**/analysis-jobs/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith(`/${jobIds[0]}/retry`)) {
        retryCalls += 1;
        resumed = true;
        return success(route, [job(0, 'PENDING', 'PENDING')]);
      }
      const index = path.endsWith(jobIds[1]) ? 1 : 0;
      return success(route, resumed ? job(index, 'SUCCEEDED', 'SEALED')
        : job(index, index ? 'PENDING' : initialStatus, index ? 'PENDING' : 'INCOMPLETE'));
    });
    await page.goto(progressUrl());
    await expect(page.getByText('순차 분석이 중단되었습니다', { exact: true })).toBeVisible();
    await expect(page.getByText('앞 회차 재개 대기', { exact: true })).toBeVisible();
    await expect(page.getByText('검토 필요', { exact: true })).toHaveCount(0);
    await expect(page.getByText('자동 비교를 마치지 못해 대상과 내용을 확인해 주세요.', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '설정 후보 검토', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '중단된 회차부터 재개', exact: true }).click();
    await expect(page.getByText('분석이 완료되었습니다', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '설정 후보 검토', exact: true })).toBeEnabled();
    expect(retryCalls).toBe(1);
    expect(new URL(page.url()).searchParams.get('currentAnalysisJobIds')?.split(',')).toEqual(jobIds);
  });
}

test('완료된 분석도 무효화되면 새 분석 안내를 표시하고 재개와 후보 검토를 막는다', async ({ page }) => {
  await installBaseRoutes(page);
  let mutations = 0;
  await page.route('**/analysis-jobs/**', route => {
    if (route.request().method() !== 'GET') mutations += 1;
    const index = new URL(route.request().url()).pathname.endsWith(jobIds[1]) ? 1 : 0;
    const invalid = job(index, 'SUCCEEDED', 'INVALIDATED');
    invalid.analysisRun!.invalidationReason = 'private-internal-reason';
    return success(route, invalid);
  });
  await page.goto(progressUrl());
  await expect(page.getByText('변경된 내용으로 새 분석이 필요합니다', { exact: true })).toBeVisible();
  await expect(page.getByText('private-internal-reason')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '설정 후보 검토', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '중단된 회차부터 재개', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '원고 목록에서 확인', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard\\?workId=${workId}&nav=manuscripts`));
  expect(mutations).toBe(0);
});

test('다른 실행의 실패나 일반 회차에는 순차 분석 대기 판정을 적용하지 않는다', () => {
  const failed = job(0, 'FAILED', 'INCOMPLETE');
  const next = job(1, 'PENDING', 'PENDING');
  expect(isBlockedOrderedAnalysis(next, [failed, next])).toBe(true);
  expect(canResumeOrderedAnalysis(failed, [failed, next])).toBe(true);
  next.analysisRun!.runId = '66666666-6666-4666-8666-666666666666';
  expect(isBlockedOrderedAnalysis(next, [failed, next])).toBe(false);
  delete next.analysisRun;
  expect(isBlockedOrderedAnalysis(next, [failed, next])).toBe(false);
  expect(canResumeOrderedAnalysis(next, [failed, next])).toBe(false);
});

test('완료 뒤 무효화된 분석은 업로드 없이 범위 확인 후 새 순차 실행을 명시적으로 요청한다', async ({ page }) => {
  await installBaseRoutes(page);
  const newIds = jobIds.map(id => id.replace(/^33333333/, '77777777'));
  const createdBodies: unknown[] = [];
  await page.route(`**/works/${workId}/episodes`, route => success(route, [
    ...episodeIds.map((id, index) => ({ id, batchId, episodeNo: index + 2, title: `원고 ${index + 2}`, status: 'ANALYZED' })),
    { id: 'archived', batchId, episodeNo: 4, status: 'ARCHIVED' },
    { id: 'another-batch', batchId: 'another', episodeNo: 5, status: 'ANALYZED' },
  ]));
  await page.route('**/analysis-jobs/**', route => {
    const path = new URL(route.request().url()).pathname;
    const index = path.endsWith(jobIds[1]) || path.endsWith(newIds[1]) ? 1 : 0;
    return success(route, path.includes('77777777')
      ? { ...job(index, 'PENDING', 'PENDING'), id: newIds[index], analysisRun: { ...job(index, 'PENDING', 'PENDING').analysisRun, runId: 'new-run' } }
      : job(index, 'SUCCEEDED', 'INVALIDATED'));
  });
  await page.route(`**/works/${workId}/analysis-jobs`, route => {
    createdBodies.push(route.request().postDataJSON());
    return success(route, newIds.map((id, index) => ({ ...job(index, 'PENDING', 'PENDING'), id,
      analysisRun: { ...job(index, 'PENDING', 'PENDING').analysisRun, runId: 'new-run' } })));
  });
  await page.goto(progressUrl());
  expect(createdBodies).toEqual([]);
  await page.getByRole('button', { name: '새 순차 분석', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '이 업로드 묶음을 새로 분석할까요?' });
  await expect(dialog.getByText('대상 2개 회차:')).toBeVisible();
  await expect(dialog).toContainText('2화, 3화');
  await expect(dialog).toContainText('AI 사용량이 다시 차감됩니다');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  expect(createdBodies).toEqual([]);
  await page.getByRole('button', { name: '새 순차 분석', exact: true }).click();
  await dialog.getByRole('button', { name: '새 순차 분석 시작', exact: true }).click();
  await expect.poll(() => createdBodies).toEqual([{ jobType: 'SETTING_EXTRACTION', batchId, analysisMode: 'ORDERED_PROVISIONAL', reviewMode: 'AUTOMATIC' }]);
  await expect.poll(() => new URL(page.url()).searchParams.get('currentAnalysisJobIds')?.split(',')).toEqual(newIds);
  expect(new URL(page.url()).searchParams.get('analysisJobIds')?.split(',')).toEqual([...jobIds, ...newIds]);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('회차를 분석하고 있습니다', { exact: true })).toBeVisible();
});

for (const failure of [
  { status: 400, code: 'ANALYSIS_RUN_MODE_INVALID', message: '시작 회차 이후의 확정 이력이 있어 현재 설정으로 과거 분석을 시작할 수 없습니다.' },
  { status: 409, code: 'ANALYSIS_JOB_ALREADY_IN_PROGRESS', message: '이미 진행 중인 분석 작업이 있습니다.' },
]) {
  test(`새 순차 분석이 ${failure.code}로 거절되면 서버 안내를 유지하고 기본 분석으로 전환하지 않는다`, async ({ page }) => {
    await installBaseRoutes(page);
    let calls = 0;
    await page.route(`**/works/${workId}/episodes`, route => success(route,
      episodeIds.map((id, index) => ({ id, batchId, episodeNo: index + 2, status: 'ANALYZED' }))));
    await page.route('**/analysis-jobs/**', route => success(route,
      job(new URL(route.request().url()).pathname.endsWith(jobIds[1]) ? 1 : 0, 'SUCCEEDED', 'INVALIDATED')));
    await page.route(`**/works/${workId}/analysis-jobs`, route => {
      calls += 1;
      expect(route.request().postDataJSON().analysisMode).toBe('ORDERED_PROVISIONAL');
      return route.fulfill({ status: failure.status, contentType: 'application/json', body: JSON.stringify({
        success: false, message: failure.message, error: { code: failure.code, status: failure.status, details: [] },
      }) });
    });
    await page.goto(progressUrl());
    await page.getByRole('button', { name: '새 순차 분석', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: '새 순차 분석 시작', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText(failure.message);
    await expect(dialog.getByRole('button', { name: '새 순차 분석 시작', exact: true })).toBeEnabled();
    expect(calls).toBe(1);
    expect(new URL(page.url()).searchParams.get('currentAnalysisJobIds')?.split(',')).toEqual(jobIds);
  });
}

test('무효화되었어도 아직 실행 중인 Job이 있으면 새 분석 버튼을 잠근다', async ({ page }) => {
  await installBaseRoutes(page);
  await page.route('**/analysis-jobs/**', route => success(route,
    job(new URL(route.request().url()).pathname.endsWith(jobIds[1]) ? 1 : 0, 'RUNNING', 'INVALIDATED')));
  await page.goto(progressUrl());
  await expect(page.getByRole('button', { name: '새 순차 분석', exact: true })).toBeDisabled();
});
