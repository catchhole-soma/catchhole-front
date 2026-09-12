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
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
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
  return { analysisBodies, uploads };
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

for (const count of [0, 9]) {
  test(`단일 분석 완료 ${count}개여도 다회차 업로드에 선행 조건을 적용하지 않는다`, async ({ page }) => {
    await setup(page, { ...defaultPolicy, completedSingleEpisodeCount: count,
      requiredSingleEpisodeCount: 10, multiEpisodeUploadEnabled: false });
    await page.goto(`/episode-upload?workId=${workId}`);
    await expect(page.getByRole('button', { name: /추천 단일 회차 업로드/ })).toBeEnabled();
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
  await expect(page.getByRole('button', { name: /추천 단일 회차 업로드/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /다회차 - 여러 파일/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /다회차 - 단일 파일/ })).toBeEnabled();
  await page.getByRole('button', { name: /추천 단일 회차 업로드/ }).click();
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
    await page.getByRole('button', { name: /추천 단일 회차 업로드/ }).click();
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
      const name = uploadType === 'SINGLE_EPISODE' ? /추천 단일 회차 업로드/
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
  await page.getByRole('button', { name: /추천 단일 회차 업로드/ }).click();
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
  const single = page.getByRole('button', { name: /추천 단일 회차 업로드/ });
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
  await page.route(`**/analysis-jobs/${jobId}`, route => success(route, {
    id: jobId, workId, batchId, episodeId, jobType: 'SETTING_EXTRACTION', status: 'SUCCEEDED', reviewMode: 'AUTOMATIC',
    episodes: [{ id: episodeId, episodeNo: 11, title: '자동 반영 원고', status: 'ANALYZED' }],
    analysisRun: { mode: 'ORDERED_PROVISIONAL', runId: '55555555-5555-4555-8555-555555555555', generation: 1, sequence: 0, journalStatus: 'SEALED' },
  }));
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
  await expect(page.getByText(/판단이 명확한 설정은 작품에 자동 반영했습니다/)).toBeVisible();
  await page.getByRole('button', { name: '확인이 필요한 설정 검토' }).click();
  await expect.poll(() => reviewQueries.some(query => query.type === 'setting-candidates' && query.status === 'PENDING_REVIEW')).toBe(true);
  await page.getByRole('button', { name: /세계관 후보/ }).click();
  await expect.poll(() => reviewQueries.some(query => query.type === 'world-setting-candidates' && query.status === 'PENDING_REVIEW')).toBe(true);
  expect(new URL(page.url()).searchParams.get('reviewStatus')).toBeNull();
});

test('추출을 마쳤어도 자동 저장이 끝나기 전에는 완료나 검토 진입을 열지 않는다', async ({ page }) => {
  await setup(page);
  let saved = false;
  await page.route(`**/analysis-jobs/${jobId}`, route => success(route, {
    id: jobId, workId, batchId, episodeId, jobType: 'SETTING_EXTRACTION', status: saved ? 'SUCCEEDED' : 'RUNNING', reviewMode: 'AUTOMATIC',
    episodes: [{ id: episodeId, episodeNo: 11, title: '저장 대기 원고', status: 'ANALYZED' }],
    analysisRun: { mode: 'ORDERED_PROVISIONAL', runId: '55555555-5555-4555-8555-555555555555', generation: 1, sequence: 0, journalStatus: saved ? 'SEALED' : 'PENDING' },
  }));
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
    await page.getByRole('button', { name: /추천 단일 회차 업로드/ }).click();
    await expect(page.getByRole('radio', { name: /AI 판단으로 설정 자동 반영/ })).toBeChecked();
    await chooseFile(page);
    await page.getByRole('button', { name: '다음 — 분석 시작' }).click();
    await expect.poll(() => requests.analysisBodies).toEqual([{ jobType: 'SETTING_EXTRACTION', batchId,
      reviewMode: 'AUTOMATIC', analysisMode: 'ORDERED_PROVISIONAL' }]);
  } finally {
    releasePolicy();
  }
});
