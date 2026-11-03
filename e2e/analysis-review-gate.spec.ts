import { expect, test, type Page, type Route } from '@playwright/test';
import { routeProgressApi } from './analysis-progress-routes';
import { clearAnalysisStartCheck } from './analysis-start-check';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const jobId = '33333333-3333-4333-8333-333333333333';
const episodeId = '44444444-4444-4444-8444-444444444444';
const ambiguous = { ...clearAnalysisStartCheck, ambiguousCharacterCount: 2, ambiguousWorldCount: 1, ambiguousRelationshipCount: 3, revision: 'review-A' };
function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
}
function conflict(route: Route, code: string) {
  return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false,
    message: '이전 회차의 검토 상태가 바뀌었습니다.', error: { code, status: 409 } }) });
}

async function setup(page: Page, gate = ambiguous) {
  const state = { gate, checks: [] as number[][], uploads: 0, creates: [] as Record<string, unknown>[],
    conflictOnce: false, failureCode: '', checkFails: false };
  await page.addInitScript(() => localStorage.setItem('accessToken', 'review-gate-test'));
  await routeProgressApi(page, route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path.endsWith('/analysis-start-checks')) {
      state.checks.push(request.postDataJSON().episodeNumbers);
      return state.checkFails ? route.fulfill({ status: 503 }) : success(route, state.gate);
    }
    if (path.endsWith('/episodes/detect')) {
      const multiple = (request.postData() ?? '').includes('MULTI_EPISODE_MULTI_FILE');
      return success(route, { uploadType: multiple ? 'MULTI_EPISODE_MULTI_FILE' : 'SINGLE_EPISODE', totalUploadCharacters: 20,
        totalCharCount: 10, detectedEpisodes: Array.from({ length: multiple ? 2 : 1 }, (_, index) => ({
          detectionOrder: index, sourceFileIndex: index, episodeNo: 11 + index, title: '테스트 원고', sourceHeading: null, content: '본문', charCount: 2,
        })) });
    }
    if (path.endsWith('/episodes') && request.method() === 'POST') {
      state.uploads++;
      return success(route, { batchId, createdEpisodes: [{ id: episodeId, episodeNo: 11, status: 'UPLOADED' }] });
    }
    if (path.endsWith('/analysis-jobs') && request.method() === 'POST') {
      state.creates.push(request.postDataJSON());
      if (state.conflictOnce) {
        state.conflictOnce = false;
        state.gate = { ...state.gate, ambiguousWorldCount: 4, revision: 'review-B' };
        return conflict(route, 'ANALYSIS_REVIEW_GATE_CHANGED');
      }
      if (state.failureCode) return conflict(route, state.failureCode);
      return success(route, [{ id: jobId, episodeId, batchId, jobType: 'SETTING_EXTRACTION', status: 'PENDING' }]);
    }
    if (path.endsWith(`/analysis-jobs/${jobId}`)) return success(route, { id: jobId, episodeId, batchId, jobType: 'SETTING_EXTRACTION', status: 'PENDING', episodes: [] });
    if (path.endsWith('/episodes')) return success(route, state.uploads ? [{ id: episodeId, batchId, episodeNo: 11, status: 'UPLOADED' }] : []);
    if (path.endsWith('/episodes/upload-policy')) return success(route, { pendingCharacterCandidateCount: 2, pendingWorldSettingCandidateCount: 1, maxUploadCharacters: 250000 });
    return success(route, path.endsWith('/auth/me')
      ? { id: 1, email: 'gate@local.invalid', displayName: '검토 확인', role: 'AUTHOR', status: 'ACTIVE' }
      : path.endsWith(`/works/${workId}`) ? { id: workId, title: '검토 정책 작품', lifecycleStatus: 'ACTIVE' } : []);
  });
  return state;
}

async function prepare(page: Page, multiple = false) {
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: multiple ? /다회차 - 여러 파일/ : /단일 회차 업로드/ }).click();
  await page.locator('input[type=file]').first().setInputFiles(Array.from({ length: multiple ? 2 : 1 }, (_, index) => ({
    name: `${11 + index}화.txt`, mimeType: 'text/plain', buffer: Buffer.from('원고 본문'),
  })));
  await expect(page.getByRole('button', { name: '다음 — 분석 시작' })).toBeEnabled();
}

test('직접 검토 후보는 다음 회차 저장·분석 전에 막고 종료 선택을 제공하지 않는다', async ({ page }) => {
  const state = await setup(page, { ...ambiguous, manualReviewCount: 7 });
  await prepare(page);
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  const dialog = page.getByRole('dialog', { name: '이전 회차의 직접 검토를 마쳐 주세요' });
  await expect(dialog).toContainText('7개 후보');
  await expect(dialog).toContainText('반영하거나 제외');
  await expect(dialog.getByRole('button', { name: '애매한 후보 종료 후 계속 분석' })).toHaveCount(0);
  expect(state.checks).toEqual([[11]]); expect(state.uploads).toBe(0); expect(state.creates).toHaveLength(0);
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  expect(await page.locator('input[type=file]').first().evaluate((input: HTMLInputElement) => input.files?.length)).toBe(1);
});

test('앞 회차가 진행 중이면 아직 후보가 없어도 다음 회차를 시작하지 않는다', async ({ page }) => {
  const state = await setup(page, { ...clearAnalysisStartCheck, activeEarlierAnalysisCount: 1 });
  await prepare(page);
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  const dialog = page.getByRole('dialog', { name: '이전 회차 분석이 진행 중입니다' });
  await expect(dialog).toContainText('완료 후 설정 검토를 마치고');
  await expect(dialog.getByRole('button', { name: '애매한 후보 종료 후 계속 분석' })).toHaveCount(0);
  expect(state.uploads).toBe(0); expect(state.creates).toHaveLength(0);
});

test('애매 후보 취소는 변경하지 않고 명시적인 계속에만 확인한 revision을 전송한다', async ({ page }) => {
  const state = await setup(page);
  await prepare(page);
  const start = page.getByRole('button', { name: '다음 — 분석 시작' });
  await start.click();
  const dialog = page.getByRole('dialog', { name: '미확정 후보를 남기지 않고 계속할까요?' });
  await expect(dialog).toContainText('정확도가 낮아질 수 있습니다');
  await expect(dialog).toContainText('캐릭터 2개 · 세계관 1개 · 관계 3개');
  await dialog.getByRole('button', { name: '취소', exact: true }).click();
  expect(state.uploads).toBe(0); expect(state.creates).toHaveLength(0);
  await start.click();
  await dialog.getByRole('button', { name: '애매한 후보 종료 후 계속 분석' }).click();
  await expect.poll(() => state.creates.length).toBe(1);
  expect(state.uploads).toBe(1);
  expect(state.creates[0]).toMatchObject({ closeAmbiguousCandidates: true, reviewGateRevision: 'review-A', reviewMode: 'AUTOMATIC' });
});

test('저장 후 후보가 바뀌면 새 경고를 확인하고 같은 batch만 다시 요청한다', async ({ page }) => {
  const state = await setup(page); state.conflictOnce = true;
  await prepare(page);
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  const continueButton = page.getByRole('button', { name: '애매한 후보 종료 후 계속 분석' });
  await continueButton.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('현재 내용을 다시 확인');
  await expect(dialog).toContainText('세계관 4개');
  expect(state.uploads).toBe(1); expect(state.creates).toHaveLength(1);
  await continueButton.click();
  await expect.poll(() => state.creates.length).toBe(2);
  expect(state.creates.map(body => body.batchId)).toEqual([batchId, batchId]);
  expect(state.creates.map(body => body.reviewGateRevision)).toEqual(['review-A', 'review-B']);
  expect(state.uploads).toBe(1);
});

test('저장 뒤 재동의를 취소하고 새로고침해도 원고를 다시 올리지 않는다', async ({ page }) => {
  const state = await setup(page); state.conflictOnce = true;
  await prepare(page);
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  await page.getByRole('button', { name: '애매한 후보 종료 후 계속 분석' }).click();
  await expect(page.getByRole('dialog')).toContainText('현재 내용을 다시 확인');
  await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
  await page.reload();
  await expect(page.getByText('다시 업로드할 필요는 없습니다.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await page.getByRole('button', { name: '애매한 후보 종료 후 계속 분석' }).click();
  await expect.poll(() => state.creates.length).toBe(2);
  expect(state.uploads).toBe(1);
});

test('저장된 묶음 재진입 직후 시작하면 회차 목록을 기다린 뒤 정확한 범위를 확인한다', async ({ page }) => {
  const state = await setup(page); state.uploads = 1;
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let listRequested = false;
  await page.route(`**/works/${workId}/episodes`, async route => {
    listRequested = true;
    await waiting;
    await success(route, [{ id: episodeId, batchId, episodeNo: 11, status: 'UPLOADED' }]);
  });
  await page.goto(`/episode-upload?workId=${workId}&batchId=${batchId}&reviewMode=AUTOMATIC`);
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect.poll(() => listRequested).toBe(true);
  expect(state.checks).toHaveLength(0); expect(state.creates).toHaveLength(0);
  release();
  await expect(page.getByRole('dialog', { name: '미확정 후보를 남기지 않고 계속할까요?' })).toBeVisible();
  expect(state.checks).toEqual([[11]]);
  expect(state.uploads).toBe(1);
});

test('다회차 요청은 범위를 한 번 확인하고 동의도 한 번만 받는다', async ({ page }) => {
  const state = await setup(page);
  await prepare(page, true);
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  await page.getByRole('button', { name: '애매한 후보 종료 후 계속 분석' }).click();
  await expect.poll(() => state.creates.length).toBe(1);
  expect(state.checks).toEqual([[11, 12]]);
  expect(state.creates[0]).toMatchObject({ analysisMode: 'ORDERED_PROVISIONAL', reviewMode: 'AUTOMATIC' });
});

test('확인할 후보가 없으면 종료 동의 필드를 만들지 않는다', async ({ page }) => {
  const state = await setup(page, clearAnalysisStartCheck);
  await prepare(page);
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  await expect.poll(() => state.creates.length).toBe(1);
  expect(state.creates[0]).not.toHaveProperty('closeAmbiguousCandidates');
  expect(state.creates[0]).not.toHaveProperty('reviewGateRevision');
});

test('사전 확인 실패는 업로드와 분석을 보내지 않고 입력을 유지한다', async ({ page }) => {
  const state = await setup(page); state.checkFails = true;
  await prepare(page);
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(state.uploads).toBe(0); expect(state.creates).toHaveLength(0);
  expect(await page.locator('input[type=file]').first().evaluate((input: HTMLInputElement) => input.files?.length)).toBe(1);
});

test('기술 오류를 미확정 후보 종료로 자동 재시도하지 않는다', async ({ page }) => {
  const state = await setup(page, clearAnalysisStartCheck); state.failureCode = 'ANALYSIS_ORDERED_JOB_RETRY_REQUIRED';
  await prepare(page);
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  await expect(page.getByText('원고와 기존 분석 기록이 저장되어 있습니다.', { exact: false })).toBeVisible();
  expect(state.checks).toHaveLength(1); expect(state.creates).toHaveLength(1);
  await expect(page.getByRole('button', { name: '애매한 후보 종료 후 계속 분석' })).toHaveCount(0);
});

test('새 회차 직접 검토 선택과 이전 회차 후보의 분류를 혼동하지 않는다', async ({ page }) => {
  const state = await setup(page);
  await prepare(page);
  await page.getByRole('radio', { name: /모든 설정 직접 검토/ }).check();
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  await page.getByRole('button', { name: '애매한 후보 종료 후 계속 분석' }).click();
  await expect.poll(() => state.creates.length).toBe(1);
  expect(state.creates[0]).toMatchObject({ reviewMode: 'MANUAL', closeAmbiguousCandidates: true, reviewGateRevision: 'review-A' });
  expect(state.creates[0]).not.toHaveProperty('analysisMode');
});

test('이전 결과 확인으로 이동하면 동의나 분석 요청을 남기지 않는다', async ({ page }) => {
  const state = await setup(page);
  await prepare(page);
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  await page.getByRole('button', { name: '이전 분석 결과 확인', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/dashboard\\?.*nav=analyses'));
  expect(state.uploads).toBe(0); expect(state.creates).toHaveLength(0);
});

for (const scenario of [
  { name: '직접 검토 차단', gate: { ...clearAnalysisStartCheck, manualReviewCount: 2 }, title: '이전 회차의 직접 검토를 마쳐 주세요' },
  { name: '애매 후보 경고', gate: ambiguous, title: '미확정 후보를 남기지 않고 계속할까요?' },
]) {
  test(`원고 목록 재분석의 ${scenario.name}에서 결과를 확인하면 이전 확인창을 닫는다`, async ({ page }) => {
    const state = await setup(page, scenario.gate);
    await page.route(`**/works/${workId}/episodes`, route => success(route, [{
      id: episodeId, batchId, episodeNo: 11, title: '재분석 원고', status: 'UPLOADED',
      originalFilename: '11화.txt', charCount: 120, analysisStatus: 'REANALYSIS_REQUIRED',
    }]));
    await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);
    await page.getByRole('button', { name: '재분석', exact: true }).click();
    const reanalysisDialog = page.getByRole('dialog', { name: '이 회차를 다시 분석할까요?' });
    await reanalysisDialog.getByRole('button', { name: '재분석 시작' }).click();
    const gateDialog = page.getByRole('dialog', { name: scenario.title });
    await expect(gateDialog).toBeVisible();
    await expect(reanalysisDialog).toHaveCount(0);
    await gateDialog.getByRole('button', { name: '이전 분석 결과 확인', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/dashboard\\?.*nav=analyses'));
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(state.checks).toEqual([[11]]);
    expect(state.creates).toHaveLength(0);
    expect(state.uploads).toBe(0);
  });
}

test('사전 조회 중 화면을 떠나면 늦은 허용 응답으로 업로드하지 않는다', async ({ page }) => {
  const state = await setup(page, clearAnalysisStartCheck);
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  let returned = false;
  await page.route('**/analysis-start-checks', async route => {
    requested = true;
    await waiting;
    await success(route, clearAnalysisStartCheck);
    returned = true;
  });
  await prepare(page);
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  await expect.poll(() => requested).toBe(true);
  await page.goto(`/dashboard?workId=${workId}&nav=manuscripts`);
  release();
  await expect.poll(() => returned).toBe(true);
  expect(state.uploads).toBe(0); expect(state.creates).toHaveLength(0);
});
