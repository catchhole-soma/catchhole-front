import { routeProgressApi } from './analysis-progress-routes';
import { clearAnalysisStartCheck } from './analysis-start-check';
import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const jobId = '33333333-3333-4333-8333-333333333333';
const episodeId = '44444444-4444-4444-8444-444444444444';
const defaultPolicy = {
  pendingCharacterCandidateCount: 0, pendingWorldSettingCandidateCount: 0, maxUploadCharacters: 250000,
};
function success(route: Route, data: unknown) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
}
async function setup(page: Page, policy: Record<string, unknown> = defaultPolicy) {
  const analysisBodies: Record<string, unknown>[] = [];
  const uploads: string[] = [];
  const settingBookRequests: string[] = [];
  await routeProgressApi(page, route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/analysis-start-checks')) return success(route, clearAnalysisStartCheck);
    if (path.includes('/setting-books')) settingBookRequests.push(route.request().method());
    if (path.endsWith('/analysis-jobs') && route.request().method() === 'POST') {
      analysisBodies.push(route.request().postDataJSON());
      return success(route, [{ id: jobId, workId, batchId, episodeId, jobType: 'SETTING_EXTRACTION', status: 'PENDING', episodes: [] }]);
    }
    if (path.endsWith('/episodes') && route.request().method() === 'POST') {
      uploads.push(route.request().postData() ?? '');
      return success(route, { batchId, createdEpisodes: [{ id: episodeId, episodeNo: 11, status: 'UPLOADED' }] });
    }
    return success(route, path.endsWith('/auth/me')
      ? { id: 1, email: 'policy@example.com', displayName: '업로드 테스트', role: 'AUTHOR', status: 'ACTIVE' }
      : path.endsWith(`/works/${workId}`) ? { id: workId, title: '정책 테스트 작품', lifecycleStatus: 'ACTIVE' }
        : path.endsWith('/episodes/upload-policy') ? policy
          : path.endsWith(`/analysis-jobs/${jobId}`) ? { id: jobId, workId, batchId, status: 'PENDING', episodes: [] }
            : path.endsWith('/world-setting-candidates') ? { pendingCandidateCount: 0, tokenInterruptedComparisonCount: 0, activeComparisonJobCount: 0 }
              : []);
  });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'upload-policy-fixture'));
  return { analysisBodies, uploads, settingBookRequests };
}
async function detected(page: Page, uploadType: string, totalUploadCharacters = 20) {
  const count = uploadType === 'SINGLE_EPISODE' ? 1 : 2;
  await page.route('**/episodes/detect', route => success(route, {
    uploadType, totalUploadCharacters,
    // The older count excludes whitespace and must never be used for the upload limit.
    totalCharCount: 10,
    detectedEpisodes: Array.from({ length: count }, (_, index) => ({
      detectionOrder: index, sourceFileIndex: uploadType === 'MULTI_EPISODE_MULTI_FILE' ? index : 0,
      episodeNo: 11 + index, title: `새 원고 ${index + 11}`, sourceHeading: null, content: '원고 본문', charCount: 5,
    })),
  }));
}
async function chooseFile(page: Page, multiple = false) {
  await page.locator('input[type=file]').first().setInputFiles(Array.from({ length: multiple ? 2 : 1 }, (_, index) => ({
    name: `${11 + index}화.txt`, mimeType: 'text/plain', buffer: Buffer.from('원고 본문'),
  })));
}

for (const uploadType of ['SINGLE_EPISODE', 'MULTI_EPISODE_SINGLE_FILE', 'MULTI_EPISODE_MULTI_FILE']) {
  test(`${uploadType} 회차 업로드는 설정집 동시 업로드 없이 원고만 저장한다`, async ({ page }) => {
    const requests = await setup(page);
    await detected(page, uploadType);
    await page.goto(`/episode-upload?workId=${workId}`);
    const name = uploadType === 'SINGLE_EPISODE' ? /단일 회차 업로드/
      : uploadType.endsWith('MULTI_FILE') ? /다회차 - 여러 파일/ : /다회차 - 단일 파일/;
    await page.getByRole('button', { name }).click();
    await expect(page.getByText(/설정집도 함께 업로드/)).toHaveCount(0);
    await expect(page.locator('.episode-settings-file')).toHaveCount(0);
    await chooseFile(page, uploadType.endsWith('MULTI_FILE'));
    if (uploadType.endsWith('SINGLE_FILE')) {
      await page.getByRole('button', { name: '다음 — 회차 분리 확인' }).click();
      await page.getByRole('button', { name: /회차 분리 확정/ }).click();
    } else await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
    await expect.poll(() => requests.uploads.length).toBe(1);
    await expect.poll(() => requests.analysisBodies.length).toBe(1);
    expect(requests.uploads[0]).not.toContain('name="settingBook"');
    expect(requests.settingBookRequests).toEqual([]);
  });
}

for (const count of [0, 9]) {
  test(`단일 분석 완료 ${count}개여도 다회차 업로드에 선행 조건을 적용하지 않는다`, async ({ page }) => {
    await setup(page, { ...defaultPolicy, completedSingleEpisodeCount: count,
      requiredSingleEpisodeCount: 10, multiEpisodeUploadEnabled: false });
    await page.goto(`/episode-upload?workId=${workId}`);
    await expect(page.getByRole('button', { name: /단일 회차 업로드/ })).toBeEnabled();
    for (const name of ['다회차 - 단일 파일', '다회차 - 여러 파일']) {
      await expect(page.getByRole('button', { name: new RegExp(name) })).toBeEnabled();
    }
    await expect(page.getByText(/다회차 업로드 조건|개 회차의 분석을 완료하면|[0-9]+\/10개 완료/)).toHaveCount(0);
    if (count === 0) {
      await expect(page.locator('.app-route-layer')).toHaveCSS('opacity', '1');
      await page.screenshot({ path: 'docs/screens/gh180-upload-policy-desktop.png', fullPage: true, animations: 'disabled' });
    }
  });
}

test('미확정 정보 조회 실패여도 모든 업로드 방식을 허용하고 경고 정보만 재조회한다', async ({ page }) => {
  await setup(page);
  let failed = true;
  await page.route('**/episodes/upload-policy', route => failed
    ? route.fulfill({ status: 503, body: JSON.stringify({ message: '일시 오류' }) })
    : success(route, { ...defaultPolicy, pendingCharacterCandidateCount: 2 }));
  await page.goto(`/episode-upload?workId=${workId}`);
  await expect(page.getByRole('button', { name: /단일 회차 업로드/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /다회차 - 여러 파일/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /다회차 - 단일 파일/ })).toBeEnabled();
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await expect(page.getByRole('radio', { name: /모든 설정 직접 검토/ })).toBeEnabled();
  await expect(page.getByRole('radio', { name: /AI 판단으로 설정 자동 반영/ })).toBeChecked();
  await expect(page.getByText('미확정 설정 정보를 불러오지 못했습니다. 업로드는 계속할 수 있습니다.')).toBeVisible();
  failed = false;
  await page.getByRole('button', { name: '미확정 설정 다시 확인' }).click();
  await expect(page.getByText('캐릭터 2개 · 세계관 0개')).toBeVisible();
  await expect(page.getByRole('radio', { name: /AI 판단으로 설정 자동 반영/ })).toBeChecked();
});

for (const automatic of [false, true]) {
  test(`미확정 후보 경고가 있어도 단일 ${automatic ? '기본 자동 반영' : '직접 검토 선택'} 업로드를 허용한다`, async ({ page }) => {
    const requests = await setup(page, { ...defaultPolicy, pendingCharacterCandidateCount: 7, pendingWorldSettingCandidateCount: 3 });
    await detected(page, 'SINGLE_EPISODE');
    await page.goto(`/episode-upload?workId=${workId}`);
    await expect(page.getByText('캐릭터 7개 · 세계관 3개')).toBeVisible();
    await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
    await expect(page.getByRole('radio', { name: /AI 판단으로 설정 자동 반영/ })).toBeChecked();
    if (!automatic) await page.getByRole('radio', { name: /모든 설정 직접 검토/ }).check();
    await chooseFile(page);
    await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
    await expect.poll(() => requests.analysisBodies).toEqual([{ jobType: 'SETTING_EXTRACTION', batchId,
      reviewMode: automatic ? 'AUTOMATIC' : 'MANUAL', ...(automatic ? { analysisMode: 'ORDERED_PROVISIONAL' } : {}) }]);
    expect(requests.uploads).toHaveLength(1);
  });
}

for (const uploadType of ['MULTI_EPISODE_SINGLE_FILE', 'MULTI_EPISODE_MULTI_FILE']) {
  test(`${uploadType}은 선택지 없이 순차 분석과 자동 반영을 요청한다`, async ({ page }) => {
    const requests = await setup(page);
    await detected(page, uploadType);
    await page.goto(`/episode-upload?workId=${workId}`);
    await page.getByRole('button', { name: uploadType.endsWith('MULTI_FILE') ? /다회차 - 여러 파일/ : /다회차 - 단일 파일/ }).click();
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expect(page.getByText('회차 순서대로 분석하고 설정을 자동 반영합니다')).toBeVisible();
    await chooseFile(page, uploadType.endsWith('MULTI_FILE'));
    if (uploadType.endsWith('SINGLE_FILE')) {
      await page.getByRole('button', { name: '다음 — 회차 분리 확인' }).click();
      await page.getByRole('button', { name: /회차 분리 확정/ }).click();
    } else await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
    await expect.poll(() => requests.analysisBodies).toEqual([{ jobType: 'SETTING_EXTRACTION', batchId,
      reviewMode: 'AUTOMATIC', analysisMode: 'ORDERED_PROVISIONAL' }]);
  });
}

for (const uploadType of ['SINGLE_EPISODE', 'MULTI_EPISODE_SINGLE_FILE', 'MULTI_EPISODE_MULTI_FILE']) {
  for (const total of [250000, 250001]) {
    test(`${uploadType} 원문 전체 ${total}자 경계를 공백 제외 집계와 구분한다`, async ({ page }) => {
      const requests = await setup(page);
      await detected(page, uploadType, total);
      await page.goto(`/episode-upload?workId=${workId}`);
      const name = uploadType === 'SINGLE_EPISODE' ? /단일 회차 업로드/
        : uploadType.endsWith('MULTI_FILE') ? /다회차 - 여러 파일/ : /다회차 - 단일 파일/;
      await page.getByRole('button', { name }).click();
      await chooseFile(page, uploadType.endsWith('MULTI_FILE'));
      const next = page.getByRole('button', { name: uploadType === 'MULTI_EPISODE_SINGLE_FILE' ? '다음 — 회차 분리 확인' : '다음 — 분석 시작' });
      if (total === 250000) await expect(next).toBeEnabled();
      else {
        await expect(page.getByRole('alert')).toContainText('현재 250,001자');
        await expect(next).toBeDisabled();
      }
      expect(requests.uploads).toHaveLength(0);
      expect(requests.analysisBodies).toHaveLength(0);
    });
  }
}

test('서버가 감지 단계에서 분량 초과를 거부하면 단일 회차 번호를 입력해도 저장할 수 없다', async ({ page }) => {
  const requests = await setup(page);
  await page.route('**/episodes/detect', route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ success: false, message: '전체 원고는 250,000자 이하여야 합니다.', error: { code: 'UPLOAD_CHARACTER_LIMIT_EXCEEDED', status: 400 } }) }));
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await page.locator('input[type=number]').fill('11');
  await chooseFile(page);
  await expect(page.getByRole('alert')).toContainText('250,000자');
  await expect(page.getByRole('button', { name: '다음 — 분석 시작' })).toBeDisabled();
  expect(requests.uploads).toHaveLength(0);
});

test('320px에서 경고·자동 반영 설명을 읽고 키보드로 단일 자동 기본값에 돌아올 수 있다', async ({ page }) => {
  await setup(page, { ...defaultPolicy, pendingCharacterCandidateCount: 3 });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(`/episode-upload?workId=${workId}`);
  const single = page.getByRole('button', { name: /단일 회차 업로드/ });
  await single.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('radio', { name: /AI 판단으로 설정 자동 반영/ })).toBeChecked();
  await page.getByRole('radio', { name: /모든 설정 직접 검토/ }).check();
  await page.getByRole('button', { name: /다회차 - 여러 파일/ }).click();
  await expect(page.getByRole('radio')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await single.click();
  await expect(page.getByRole('radio', { name: /AI 판단으로 설정 자동 반영/ })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('group', { name: '설정 반영 방식' }).scrollIntoViewIfNeeded();
  await expect(page.locator('.app-route-layer')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'docs/screens/gh180-upload-policy-320.png', animations: 'disabled' });
});

test('자동 반영 완료 후 캐릭터·세계관 결과는 미확정 후보만 기본 조회한다', async ({ page }) => {
  await setup(page);
  const reviewQueries: Array<{ type: string; status: string | null }> = [];
  await page.route('**/analysis-jobs/progress?**', route => success(route, [{
    id: jobId, workId, batchId, episodeId, jobType: 'SETTING_EXTRACTION', status: 'SUCCEEDED', reviewMode: 'AUTOMATIC', automaticAppliedAt: '2026-09-13T01:00:00',
    episodes: [{ id: episodeId, episodeNo: 11, title: '자동 반영 원고', status: 'ANALYZED' }],
    analysisRun: { mode: 'ORDERED_PROVISIONAL', runId: '55555555-5555-4555-8555-555555555555', generation: 1, sequence: 0, journalStatus: 'SEALED' },
  }]));
  for (const type of ['setting-candidates', 'world-setting-candidates']) {
    await page.route(`**/${type}?**`, route => {
      const url = new URL(route.request().url());
      reviewQueries.push({ type, status: url.searchParams.get('reviewStatus') });
      return success(route, { batchId, totalCandidateCount: 8, reviewedCandidateCount: 8, pendingCandidateCount: 0,
        matchRequiredCandidateCount: 0, pendingComparisonCount: 0, processingComparisonCount: 0,
        failedComparisonCount: 0, recomparisonRequiredCount: 0, tokenInterruptedComparisonCount: 0,
        candidates: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false },
        groups: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false },
      });
    });
  }
  await page.goto(`/episode-upload?workId=${workId}&batchId=${batchId}&analysisJobIds=${jobId}`);
  await expect(page.getByText(/회차 분석과 설정 자동 반영이 끝났습니다/)).toBeVisible();
  await page.getByRole('button', { name: '확인이 필요한 설정 검토' }).click();
  await expect.poll(() => reviewQueries.some(query => query.type === 'setting-candidates' && query.status === 'PENDING_REVIEW')).toBe(true);
  await page.getByRole('button', { name: /세계관 후보/ }).click();
  await expect.poll(() => reviewQueries.some(query => query.type === 'world-setting-candidates' && query.status === 'PENDING_REVIEW')).toBe(true);
  expect(new URL(page.url()).searchParams.get('reviewStatus')).toBeNull();
});

test('추출을 마쳤어도 자동 저장이 끝나기 전에는 완료나 검토 진입을 열지 않는다', async ({ page }) => {
  await setup(page);
  let saved = false;
  await page.route('**/analysis-jobs/progress?**', route => success(route, [{
    id: jobId, workId, batchId, episodeId, jobType: 'SETTING_EXTRACTION', status: saved ? 'SUCCEEDED' : 'RUNNING', reviewMode: 'AUTOMATIC', automaticAppliedAt: saved ? '2026-09-13T01:00:00' : null,
    episodes: [{ id: episodeId, episodeNo: 11, title: '저장 대기 원고', status: 'ANALYZED' }],
    analysisRun: { mode: 'ORDERED_PROVISIONAL', runId: '55555555-5555-4555-8555-555555555555', generation: 1, sequence: 0, journalStatus: saved ? 'SEALED' : 'PENDING' },
  }]));
  await page.goto(`/episode-upload?workId=${workId}&batchId=${batchId}&analysisJobIds=${jobId}`);
  await expect(page.getByText('설정 비교·반영 중', { exact: true })).toBeVisible();
  await expect(page.getByText('분석이 완료되었습니다', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '확인이 필요한 설정 검토' })).toHaveCount(0);
  saved = true;
  await expect(page.getByText('설정 자동 반영 완료', { exact: true })).toBeVisible({ timeout: 6000 });
  await expect(page.getByRole('button', { name: '확인이 필요한 설정 검토' })).toBeEnabled();
});


test('미확정 정보 확인 중에도 단일 기본 자동 업로드와 다회차 선택을 허용한다', async ({ page }) => {
  const requests = await setup(page);
  await detected(page, 'SINGLE_EPISODE');
  let releasePolicy!: () => void;
  const pendingPolicy = new Promise<void>(resolve => { releasePolicy = resolve; });
  await page.route('**/episodes/upload-policy', async route => {
    await pendingPolicy;
    return success(route, defaultPolicy);
  });
  try {
    await page.goto(`/episode-upload?workId=${workId}`);
    await expect(page.getByRole('button', { name: /다회차 - 단일 파일/ })).toBeEnabled();
    await expect(page.getByRole('button', { name: /다회차 - 여러 파일/ })).toBeEnabled();
    await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
    await expect(page.getByRole('radio', { name: /AI 판단으로 설정 자동 반영/ })).toBeChecked();
    await chooseFile(page);
    await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
    await expect.poll(() => requests.analysisBodies).toEqual([{ jobType: 'SETTING_EXTRACTION', batchId,
      reviewMode: 'AUTOMATIC', analysisMode: 'ORDERED_PROVISIONAL' }]);
  } finally {
    releasePolicy();
  }
});

for (const uploadType of ['SINGLE_EPISODE', 'MULTI_EPISODE_MULTI_FILE']) {
  test(`${uploadType} 과거 회차 저장 후 자동 분석이 거절되면 재업로드 없이 기존 직접 검토 경로를 안내한다`, async ({ page }) => {
    const requests = await setup(page);
    await detected(page, uploadType);
    let saved = false;
    let attempts = 0;
    const createdEpisodes = Array.from({ length: uploadType === 'SINGLE_EPISODE' ? 1 : 2 }, (_, index) => ({
      id: index ? episodeId.replace(/^44444444/, '55555555') : episodeId,
      batchId, episodeNo: 11 + index, title: `과거 원고 ${11 + index}`, status: 'UPLOADED', analysisStatus: 'REANALYSIS_REQUIRED',
    }));
    await page.route(`**/works/${workId}/episodes`, route => {
      if (route.request().method() === 'POST') {
        requests.uploads.push(route.request().postData() ?? '');
        saved = true;
        return success(route, { batchId, createdEpisodes });
      }
      return success(route, [{ id: 'later-episode', episodeNo: 80, status: 'ANALYZED' }, ...(saved ? createdEpisodes : [])]);
    });
    await page.route(`**/works/${workId}/analysis-jobs`, route => {
      attempts++;
      expect(route.request().postDataJSON()).toEqual({ jobType: 'SETTING_EXTRACTION', batchId,
        analysisMode: 'ORDERED_PROVISIONAL', reviewMode: 'AUTOMATIC' });
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ success: false,
        message: '뒤 회차의 확정 이력이 있습니다.', error: { code: 'ANALYSIS_FUTURE_HISTORY_CONFLICT', status: 400 } }) });
    });
    await page.goto(`/episode-upload?workId=${workId}`);
    await page.getByRole('button', { name: uploadType === 'SINGLE_EPISODE' ? /단일 회차 업로드/ : /다회차 - 여러 파일/ }).click();
    await chooseFile(page, uploadType !== 'SINGLE_EPISODE');
    if (uploadType === 'SINGLE_EPISODE') await page.getByRole('spinbutton').fill('11');
    await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
    await expect(page.getByText('원고는 저장했지만 분석을 시작하지 못했습니다', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('다시 업로드하지 말고 원고 목록');
    await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '원고 목록에서 확인', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`workId=${workId}&nav=manuscripts`));
    await expect(page.getByRole('button', { name: '재분석', exact: true })).toHaveCount(createdEpisodes.length);
    expect(attempts).toBe(1);
    expect(requests.uploads).toHaveLength(1);
  });
}

test('원고 저장 뒤 기존 재개 가능한 분석이 확인되면 새 생성 대신 기존 분석 목록으로 안내한다', async ({ page }) => {
  const requests = await setup(page);
  await detected(page, 'SINGLE_EPISODE');
  let attempts = 0;
  await page.route(`**/works/${workId}/analysis-jobs`, route => {
    attempts++;
    return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false,
      message: '기존 분석을 재개해 주세요.', error: { code: 'ANALYSIS_ORDERED_JOB_RETRY_REQUIRED', status: 409 } }) });
  });
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await chooseFile(page);
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  await expect(page.getByRole('alert')).toContainText('원고와 기존 분석 기록이 저장되어 있습니다');
  await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '기존 분석 목록에서 확인', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`workId=${workId}&nav=analyses`));
  expect(attempts).toBe(1);
  expect(requests.uploads).toHaveLength(1);
});

for (const mode of ['단일 회차 업로드', '다회차 - 단일 파일', '다회차 - 여러 파일']) {
  test(`${mode}에 별도 동의 없이 학습 미사용을 안내한다`, async ({ page }) => {
    await setup(page);
    await page.goto(`/episode-upload?workId=${workId}`);
    await page.getByRole('button', { name: new RegExp(mode) }).click();
    await expect(page.getByText('원고와 분석 결과는 AI 학습에 사용하지 않습니다.', { exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /학습|동의/ })).toHaveCount(0);
  });
}

test('다회차 여러 파일은 숫자로 정렬하고 번호 수정·재정렬 뒤에도 원본 연결을 보존한다', async ({ page }) => {
  const requests = await setup(page);
  const episodes = [2, 10, 3];
  await page.route('**/episodes/detect', route => success(route, { uploadType: 'MULTI_EPISODE_MULTI_FILE', totalUploadCharacters: 30,
    detectedEpisodes: episodes.map((episodeNo, index) => ({ detectionOrder: index, sourceFileIndex: index, episodeNo,
      title: `제목 ${episodeNo}`, content: `본문 ${episodeNo}`, sourceHeading: null, charCount: 10 })) }));
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: /다회차 - 여러 파일/ }).click();
  await page.locator('input[type=file]').first().setInputFiles(episodes.map(number => ({ name: `${number}화.txt`, mimeType: 'text/plain', buffer: Buffer.from(`본문 ${number}`) })));
  const rows = page.locator('.episode-confirmation-row');
  await expect(rows).toHaveCount(3);
  await expect.poll(() => rows.locator('input[type=number]').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).toEqual(['2', '3', '10']);
  await expect(rows.locator('.episode-confirmation-source')).toHaveText(['2화.txt', '3화.txt', '10화.txt']);
  await rows.first().locator('input[type=number]').fill('11');
  await expect(page.getByText('분석 순서: 3화 → 10화 → 11화', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '회차 번호순 정렬' }).click();
  await expect.poll(() => rows.locator('input[type=number]').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).toEqual(['3', '10', '11']);
  await expect(rows.locator('.episode-confirmation-source')).toHaveText(['3화.txt', '10화.txt', '2화.txt']);
  await expect(page.locator('.episode-upload-order-preview')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/catchhole-gh219-upload.png', fullPage: true });
  await expect.poll(() => rows.locator('input:not([type=number])').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).toEqual(['제목 3', '제목 10', '제목 2']);
  await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
  await expect.poll(() => requests.uploads.length).toBe(1);
  const payload = requests.uploads[0];
  const metadata = JSON.parse(payload.match(/\r\n\r\n(\{[^\r\n]+\})\r\n/)![1]);
  expect(metadata.episodeConfirmations).toEqual([
    { detectionOrder: 2, episodeNo: 3, title: '제목 3' }, { detectionOrder: 1, episodeNo: 10, title: '제목 10' }, { detectionOrder: 0, episodeNo: 11, title: '제목 2' },
  ]);
  expect(payload.indexOf('filename="2화.txt"')).toBeLessThan(payload.indexOf('filename="10화.txt"'));
  expect(payload.indexOf('filename="10화.txt"')).toBeLessThan(payload.indexOf('filename="3화.txt"'));
});

for (const mode of ['SINGLE_EPISODE', 'MULTI_EPISODE_MULTI_FILE', 'MULTI_EPISODE_SINGLE_FILE']) {
  test(`한글 원고 ${mode}의 파일 선택·최종 전송을 지원하며 설정집 동시 업로드를 제공하지 않는다`, async ({ page }) => {
    const requests = await setup(page);
    const { readFileSync } = await import('node:fs');
    await detected(page, mode);
    await page.goto(`/episode-upload?workId=${workId}`);
    await page.getByRole('button', { name: mode === 'SINGLE_EPISODE' ? /단일 회차 업로드/
      : mode === 'MULTI_EPISODE_MULTI_FILE' ? /다회차 - 여러 파일/ : /다회차 - 단일 파일/ }).click();
    const input = page.locator('input[type=file]').first();
    await expect(input).toHaveAttribute('accept', '.txt,.docx,.hwp,.hwpx');
    const files = mode === 'MULTI_EPISODE_MULTI_FILE' ? ['episode-2.hwpx', 'episode-1.hwp']
      : mode === 'SINGLE_EPISODE' ? ['episode-1.hwp'] : ['two-episodes.hwpx'];
    await input.setInputFiles(files.map(file => ({
      name: file, mimeType: 'application/octet-stream', buffer: readFileSync(`e2e/fixtures/hangul/${file}`),
    })));
    await expect(page.getByRole('checkbox', { name: /설정집도 함께 업로드/ })).toHaveCount(0);
    await expect(page.locator('input[type=file]')).toHaveCount(1);
    if (mode === 'MULTI_EPISODE_SINGLE_FILE') {
      await page.getByRole('button', { name: '다음 — 회차 분리 확인' }).click();
      await page.getByRole('button', { name: /회차 분리 확정/ }).click();
    } else {
      await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
    }
    await expect.poll(() => requests.uploads.length).toBe(1);
    for (const file of files) expect(requests.uploads[0]).toContain(`filename="${file}"`);
    expect(requests.settingBookRequests).toEqual([]);
    expect(requests.uploads[0]).not.toContain('name="settingBook"');
    await expect.poll(() => requests.analysisBodies.length).toBe(1);
  });
}

const multiMode = /다회차 - 여러 파일/;
const nextButton = '다음 — 분석 시작';
const missingRowGuidance = '회차 번호를 찾지 못했습니다. 직접 입력해주세요.';
const conflictRowGuidance = '파일명과 본문의 회차 번호가 다릅니다. 직접 입력해주세요.';
const missingSingleGuidance = '회차 번호를 찾지 못했습니다. 회차 번호를 직접 입력해주세요.';
const conflictSingleGuidance = '파일명과 본문의 회차 번호가 다릅니다. 회차 번호를 직접 입력해주세요.';

type DetectedRow = { episodeNo: number | null; status?: 'DETECTED' | 'REQUIRES_INPUT' | 'NUMBER_CONFLICT'; title?: string };

function detectionBody(rows: DetectedRow[]) {
  return {
    uploadType: 'MULTI_EPISODE_MULTI_FILE', totalUploadCharacters: 30,
    detectedEpisodes: rows.map((row, index) => ({
      detectionOrder: index, sourceFileIndex: index, episodeNo: row.episodeNo,
      numberDetectionStatus: row.status ?? (row.episodeNo === null ? 'REQUIRES_INPUT' : 'DETECTED'),
      title: row.title ?? null, sourceHeading: null, content: `본문 ${index}`, charCount: 5,
    })),
  };
}
function chooseFiles(page: Page, names: string[]) {
  return page.locator('input[type=file]').first().setInputFiles(names.map((name, index) => ({
    name, mimeType: 'text/plain', buffer: Buffer.from(`본문 ${index}`),
  })));
}
function detectFailure(route: Route, code: string, status = 400, message = '요청을 처리하지 못했습니다.', context: Record<string, unknown> = {}) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false, message, error: { code, status, message, context } }) });
}
function numberValues(page: Page) {
  return page.locator('.episode-confirmation-row input[type=number]').evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));
}
function uploadedMetadata(payload: string) {
  return JSON.parse(payload.match(/\r\n\r\n(\{[^\r\n]+\})\r\n/)![1]);
}
async function openMultiWithRows(page: Page, rows: DetectedRow[], names: string[]) {
  const requests = await setup(page);
  const detectBodies: string[] = [];
  await page.route('**/episodes/detect', route => {
    detectBodies.push(route.request().postData() ?? '');
    return success(route, detectionBody(rows));
  });
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: multiMode }).click();
  await chooseFiles(page, names);
  await expect(page.locator('.episode-confirmation-row')).toHaveCount(rows.length);
  return { requests, detectBodies };
}
async function openSingleWithDetectFailure(page: Page, code: string, status = 400, existingEpisodes: unknown[] = []) {
  const requests = await setup(page);
  await page.route(url => url.pathname.endsWith(`/works/${workId}/episodes`), route => route.request().method() === 'GET'
    ? success(route, existingEpisodes) : route.fallback());
  await page.route('**/episodes/detect', route => detectFailure(route, code, status));
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await chooseFile(page);
  return requests;
}

test('여러 파일에서 번호를 못 찾은 파일도 목록에 남기고 입력해야 저장할 수 있다', async ({ page }) => {
  const { requests, detectBodies } = await openMultiWithRows(page, [{ episodeNo: 1 }, { episodeNo: null }, { episodeNo: 3 }], ['1화.txt', '원고.txt', '3화.txt']);
  expect(uploadedMetadata(detectBodies[0]).allowManualEpisodeNumber).toBe(true);
  const rows = page.locator('.episode-confirmation-row');
  await expect(rows.locator('.episode-confirmation-source')).toHaveText(['1화.txt', '3화.txt', '원고.txt']);
  await expect.poll(() => numberValues(page)).toEqual(['1', '3', '']);
  await expect(rows.nth(2)).toContainText(missingRowGuidance);
  await expect(page.getByText(missingRowGuidance)).toHaveCount(1);
  await expect(page.getByRole('button', { name: nextButton })).toBeDisabled();

  await rows.nth(2).locator('input[type=number]').fill('2');
  await expect(page.getByText(missingRowGuidance)).toHaveCount(0);
  await expect.poll(() => numberValues(page)).toEqual(['1', '3', '2']);
  await rows.nth(2).locator('input[type=number]').fill('');
  await expect(rows.nth(2)).toContainText(missingRowGuidance);
  await rows.nth(2).locator('input[type=number]').fill('2');

  await page.getByRole('button', { name: nextButton }).click();
  await expect.poll(() => requests.uploads.length).toBe(1);
  expect(uploadedMetadata(requests.uploads[0]).episodeConfirmations).toEqual([
    { detectionOrder: 0, episodeNo: 1, title: null }, { detectionOrder: 2, episodeNo: 3, title: null }, { detectionOrder: 1, episodeNo: 2, title: null },
  ]);
});

test('여러 파일의 번호가 모두 비어도 수정할 수 있고 잘못된 입력은 막는다', async ({ page }) => {
  await openMultiWithRows(page, [{ episodeNo: null }, { episodeNo: null }], ['원고A.txt', '원고B.txt']);
  const inputs = page.locator('.episode-confirmation-row input[type=number]');
  await expect(page.getByText(missingRowGuidance)).toHaveCount(2);
  const next = page.getByRole('button', { name: nextButton });
  await expect(next).toBeDisabled();
  await inputs.nth(0).fill('4');
  for (const invalid of ['0', '-1', '1.5', '2147483648']) {
    await inputs.nth(1).fill(invalid);
    await expect(page.getByRole('alert').filter({ hasText: '1 이상 2,147,483,647 이하의 정수' }).first()).toBeVisible();
    await expect(next).toBeDisabled();
  }
  await inputs.nth(1).fill('4');
  await expect(page.getByRole('alert').filter({ hasText: '회차 번호가 중복됩니다' }).first()).toBeVisible();
  await expect(next).toBeDisabled();
  await inputs.nth(1).fill('2147483647');
  await expect(next).toBeEnabled();
});

test('파일명과 본문의 번호가 다른 파일은 비워 두고 제목을 채워 직접 입력받는다', async ({ page }) => {
  await openMultiWithRows(page, [{ episodeNo: null, status: 'NUMBER_CONFLICT', title: '갈림길' }, { episodeNo: 6 }], ['3화.txt', '6화.txt']);
  const rows = page.locator('.episode-confirmation-row');
  await expect.poll(() => numberValues(page)).toEqual(['6', '']);
  await expect(rows.nth(1)).toContainText(conflictRowGuidance);
  await expect(rows.nth(1).locator('input:not([type=number])')).toHaveValue('갈림길');
  await expect(page.getByRole('button', { name: nextButton })).toBeDisabled();
  await rows.nth(1).locator('input[type=number]').fill('3');
  await expect(page.getByRole('button', { name: nextButton })).toBeEnabled();
});

test('같은 이름의 파일과 번호순 정렬에서도 입력한 번호가 원래 파일에 연결된다', async ({ page }) => {
  const { requests } = await openMultiWithRows(page, [{ episodeNo: null }, { episodeNo: 2 }, { episodeNo: null }], ['원고.txt', '2화.txt', '원고.txt']);
  const inputs = page.locator('.episode-confirmation-row input[type=number]');
  await expect.poll(() => numberValues(page)).toEqual(['2', '', '']);
  await inputs.nth(1).fill('9');
  await page.getByRole('button', { name: '회차 번호순 정렬' }).click();
  await expect.poll(() => numberValues(page)).toEqual(['2', '9', '']);
  await inputs.nth(2).fill('1');
  await expect.poll(() => numberValues(page)).toEqual(['2', '9', '1']);
  await page.getByRole('button', { name: nextButton }).click();
  await expect.poll(() => requests.uploads.length).toBe(1);
  expect(uploadedMetadata(requests.uploads[0]).episodeConfirmations).toEqual([
    { detectionOrder: 1, episodeNo: 2, title: null }, { detectionOrder: 0, episodeNo: 9, title: null }, { detectionOrder: 2, episodeNo: 1, title: null },
  ]);
});

test('파일을 다시 고르면 이전 입력이 사라지고 늦은 감지 응답이 현재 선택을 덮지 못한다', async ({ page }) => {
  await setup(page);
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route('**/episodes/detect', async route => {
    calls += 1;
    if (calls === 1) {
      await held;
      return success(route, detectionBody([{ episodeNo: 1 }, { episodeNo: 2 }]));
    }
    return success(route, detectionBody([{ episodeNo: null }, { episodeNo: 8 }, { episodeNo: 9 }]));
  });
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: multiMode }).click();
  await chooseFiles(page, ['옛1화.txt', '옛2화.txt']);
  await expect.poll(() => calls).toBe(1);
  await chooseFiles(page, ['새원고.txt', '8화.txt', '9화.txt']);
  await expect.poll(() => numberValues(page)).toEqual(['8', '9', '']);
  release();
  await page.waitForTimeout(150);
  await expect.poll(() => numberValues(page)).toEqual(['8', '9', '']);
  await expect(page.locator('.episode-confirmation-source')).toHaveText(['8화.txt', '9화.txt', '새원고.txt']);
});

test('감지 중 파일을 하나로 줄이면 늦은 감지 응답이 목록을 다시 채우지 못한다', async ({ page }) => {
  await setup(page);
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route('**/episodes/detect', async route => {
    calls += 1;
    await held;
    return success(route, detectionBody([{ episodeNo: 1 }, { episodeNo: 2 }]));
  });
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: multiMode }).click();
  await chooseFiles(page, ['1화.txt', '2화.txt']);
  await expect.poll(() => calls).toBe(1);
  await chooseFiles(page, ['1화.txt']);
  await expect(page.getByText('두 개 이상의 회차 파일을 선택해주세요.')).toBeVisible();
  release();
  await page.waitForTimeout(150);
  await expect(page.locator('.episode-confirmation-row')).toHaveCount(0);
});

test('단일 회차에서 번호를 못 찾으면 입력 안내를 보이고 유효한 번호로 해소한다', async ({ page }) => {
  const requests = await openSingleWithDetectFailure(page, 'UPLOAD_EPISODE_NO_DETECTION_FAILED');
  await expect(page.getByText(missingSingleGuidance)).toBeVisible();
  await expect(page.getByText('파일의 회차 표기를 확인해주세요.')).toHaveCount(0);
  const number = page.locator('input[type=number]');
  const next = page.getByRole('button', { name: nextButton });
  await expect(next).toBeDisabled();
  await number.fill('11');
  await expect(page.getByText(missingSingleGuidance)).toHaveCount(0);
  await expect(next).toBeEnabled();
  await number.fill('');
  await expect(page.getByText(missingSingleGuidance)).toBeVisible();
  await expect(next).toBeDisabled();
  await number.fill('11');
  await next.click();
  await expect.poll(() => requests.uploads.length).toBe(1);
  const metadata = uploadedMetadata(requests.uploads[0]);
  expect(metadata.singleEpisodeNo).toBe(11);
  expect(metadata).not.toHaveProperty('episodeConfirmations');
});

test('단일 회차에서 파일명과 본문의 번호가 다르면 입력 안내를 보이고 번호로 해소한다', async ({ page }) => {
  await openSingleWithDetectFailure(page, 'UPLOAD_EPISODE_NO_CONFLICT');
  await expect(page.getByText(conflictSingleGuidance)).toBeVisible();
  await page.locator('input[type=number]').fill('5');
  await expect(page.getByText(conflictSingleGuidance)).toHaveCount(0);
  await expect(page.getByRole('button', { name: nextButton })).toBeEnabled();
});

test('단일 회차의 잘못된 번호와 이미 있는 번호는 각각의 안내로 막는다', async ({ page }) => {
  await openSingleWithDetectFailure(page, 'UPLOAD_EPISODE_NO_DETECTION_FAILED', 400, [{ id: episodeId, episodeNo: 5, status: 'UPLOADED' }]);
  const number = page.locator('input[type=number]');
  const next = page.getByRole('button', { name: nextButton });
  for (const invalid of ['0', '-1', '1.5', '3000000000']) {
    await number.fill(invalid);
    await expect(page.getByText('회차 번호는 1 이상 2,147,483,647 이하의 정수여야 합니다.')).toBeVisible();
    await expect(page.getByText(missingSingleGuidance)).toHaveCount(0);
    await expect(next).toBeDisabled();
  }
  await number.fill('5');
  await expect(page.getByText('이미 등록된 회차 번호입니다.')).toBeVisible();
  await expect(next).toBeDisabled();
});

for (const [code, status] of [['UPLOAD_DOCUMENT_INVALID', 400], ['UPLOAD_CHARACTER_LIMIT_EXCEEDED', 400], ['AUTH_FORBIDDEN', 403]] as const) {
  test(`단일 회차의 ${code} 오류는 번호를 입력해도 사라지지 않는다`, async ({ page }) => {
    await openSingleWithDetectFailure(page, code, status);
    await expect(page.getByRole('alert').first()).toContainText('요청을 처리하지 못했습니다.');
    await expect(page.getByText(missingSingleGuidance)).toHaveCount(0);
    await page.locator('input[type=number]').fill('11');
    await expect(page.getByRole('alert').first()).toContainText('요청을 처리하지 못했습니다.');
  });
}

test('단일 회차의 통신 오류는 번호를 입력해도 번호 안내로 바뀌지 않는다', async ({ page }) => {
  await setup(page);
  await page.route('**/episodes/detect', route => route.abort());
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await chooseFile(page);
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.getByText(missingSingleGuidance)).toHaveCount(0);
  const before = await page.getByRole('alert').first().textContent();
  await page.locator('input[type=number]').fill('11');
  await expect(page.getByRole('alert').first()).toHaveText(before ?? '');
});

test('번호 입력 안내는 파일을 바꾸거나 다른 방식으로 옮기면 남지 않는다', async ({ page }) => {
  await setup(page);
  let calls = 0;
  await page.route('**/episodes/detect', route => {
    calls += 1;
    return calls === 1 ? detectFailure(route, 'UPLOAD_EPISODE_NO_DETECTION_FAILED') : success(route, {
      uploadType: 'SINGLE_EPISODE', totalUploadCharacters: 10,
      detectedEpisodes: [{ detectionOrder: 0, sourceFileIndex: 0, episodeNo: 7, numberDetectionStatus: 'DETECTED', title: '일곱', sourceHeading: null, content: '본문', charCount: 2 }],
    });
  });
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await chooseFile(page);
  await expect(page.getByText(missingSingleGuidance)).toBeVisible();
  await page.getByRole('button', { name: multiMode }).click();
  await expect(page.getByText(missingSingleGuidance)).toHaveCount(0);
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await chooseFile(page);
  await expect.poll(() => calls).toBe(2);
  await expect(page.getByText(missingSingleGuidance)).toHaveCount(0);
  await expect(page.locator('input[type=number]')).toHaveValue('7');
});

test('다회차 단일 파일의 번호 감지 실패는 표기 예시를 보여 주고 직접 입력을 안내하지 않는다', async ({ page }) => {
  await setup(page);
  await page.route('**/episodes/detect', route => detectFailure(route, 'UPLOAD_EPISODE_NO_DETECTION_FAILED'));
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: /다회차 - 단일 파일/ }).click();
  await chooseFile(page);
  const message = page.locator('.episode-upload-error, [role=alert]').filter({ hasText: '회차' }).first();
  await expect(message).toContainText('제1화');
  await expect(message).not.toContainText('직접 입력');
});

for (const [code, failedIndex, expected] of [
  ['UPLOAD_MULTI_FILE_EPISODE_COUNT_INVALID', 1, '두회차.txt에 회차가 둘 이상 있습니다. 파일마다 한 회차만 넣어주세요.'],
  ['UPLOAD_EPISODE_NO_INVALID', 0, '1화.txt의 회차 번호를 사용할 수 없습니다. 파일명이나 제목의 회차 번호를 1 이상으로 고쳐주세요.'],
  ['UPLOAD_DOCUMENT_INVALID', 1, '두회차.txt: 서버 안내입니다.'],
] as const) {
  test(`여러 파일 감지가 ${code}로 실패하면 파일 칸 아래에 파일명을 알려 준다`, async ({ page }) => {
    await setup(page);
    await page.route('**/episodes/detect', route => detectFailure(route, code, 400, '서버 안내입니다.', { sourceFileIndex: failedIndex }));
    await page.goto(`/episode-upload?workId=${workId}`);
    await page.getByRole('button', { name: multiMode }).click();
    await chooseFiles(page, ['1화.txt', '두회차.txt']);
    const area = page.locator('.episode-multi-file');
    await expect(area).toContainText(expected);
    await expect(area).toHaveClass(/has-error/);
    await expect(area).not.toHaveClass(/has-file/);
    await expect(page.getByRole('alert')).toHaveCount(1);
    await expect(page.locator('.episode-confirmation-row')).toHaveCount(0);
    await expect(page.getByRole('button', { name: nextButton })).toBeDisabled();
  });
}

test('여러 파일 감지 실패에 파일 정보가 없으면 서버 안내를 파일 칸 아래에 보여 주고 다시 고르면 지운다', async ({ page }) => {
  await setup(page);
  let calls = 0;
  await page.route('**/episodes/detect', route => {
    calls += 1;
    return calls === 1 ? detectFailure(route, 'AUTH_FORBIDDEN', 403) : success(route, detectionBody([{ episodeNo: 1 }, { episodeNo: 2 }]));
  });
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: multiMode }).click();
  await chooseFiles(page, ['1화.txt', '2화.txt']);
  const area = page.locator('.episode-multi-file');
  await expect(area).toContainText('요청을 처리하지 못했습니다.');
  await chooseFiles(page, ['1화.txt', '2화.txt']);
  await expect(page.locator('.episode-confirmation-row')).toHaveCount(2);
  await expect(area).not.toContainText('요청을 처리하지 못했습니다.');
  await expect(area).toHaveClass(/has-file/);
});

async function pickWithChooser(page: Page, target: string, names: string[]) {
  const chooser = page.waitForEvent('filechooser');
  await page.locator(target).click();
  const picker = await chooser;
  // A browser only reports a re-selection of the same file when the input was emptied before the dialog opened.
  expect(await picker.element().evaluate(input => (input as HTMLInputElement).value)).toBe('');
  await picker.setFiles(names.map((name, index) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(`본문 ${index}`) })));
}

test('번호를 넣고 고른 파일을 다시 고르면 번호를 비우고 다시 감지해 충돌 안내를 보여 준다', async ({ page }) => {
  await setup(page);
  const bodies: string[] = [];
  await page.route('**/episodes/detect', route => {
    bodies.push(route.request().postData() ?? '');
    return bodies.length === 1 ? success(route, {
      uploadType: 'SINGLE_EPISODE', totalUploadCharacters: 10,
      detectedEpisodes: [{ detectionOrder: 0, sourceFileIndex: 0, episodeNo: 9, numberDetectionStatus: 'DETECTED', title: '갈림길', sourceHeading: null, content: '본문', charCount: 2 }],
    }) : detectFailure(route, 'UPLOAD_EPISODE_NO_CONFLICT');
  });
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: /단일 회차 업로드/ }).click();
  await page.locator('input[type=number]').fill('9');
  await pickWithChooser(page, '.file-drop-area__target', ['7화.txt']);
  await expect(page.locator('input[type=number]')).toHaveValue('9');
  await pickWithChooser(page, '.file-drop-area__target', ['7화.txt']);
  await expect(page.getByText(conflictSingleGuidance)).toBeVisible();
  await expect(page.locator('input[type=number]')).toHaveValue('');
  expect(uploadedMetadata(bodies[1]).singleEpisodeNo).toBeNull();
});

test('여러 파일에서 실패한 뒤 고친 같은 파일을 다시 고르면 다시 감지한다', async ({ page }) => {
  await setup(page);
  let calls = 0;
  await page.route('**/episodes/detect', route => {
    calls += 1;
    return calls === 1
      ? detectFailure(route, 'UPLOAD_MULTI_FILE_EPISODE_COUNT_INVALID', 400, '서버 안내입니다.', { sourceFileIndex: 1 })
      : success(route, detectionBody([{ episodeNo: 1 }, { episodeNo: 2 }]));
  });
  await page.goto(`/episode-upload?workId=${workId}`);
  await page.getByRole('button', { name: multiMode }).click();
  await pickWithChooser(page, '.episode-multi-file__target', ['1화.txt', '두회차.txt']);
  await expect(page.locator('.episode-multi-file')).toContainText('두회차.txt에 회차가 둘 이상');
  await pickWithChooser(page, '.episode-multi-file__target', ['1화.txt', '두회차.txt']);
  await expect(page.locator('.episode-confirmation-row')).toHaveCount(2);
  expect(calls).toBe(2);
});
