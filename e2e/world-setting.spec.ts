import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const worldCandidateId = '33333333-3333-4333-8333-333333333333';
const secondWorldCandidateId = '44444444-4444-4444-8444-444444444444';
const characterCandidateId = '55555555-5555-4555-8555-555555555555';
const worldSettingId = '66666666-6666-4666-8666-666666666666';
const createdWorldSettingId = '77777777-7777-4777-8777-777777777777';

const member = {
  id: 1,
  email: 'world-setting@example.com',
  displayName: '세계관 테스트',
  phoneNumber: '01012345678',
  phoneVerified: false,
  role: 'AUTHOR',
  status: 'ACTIVE',
};

function success(route: Route, data: unknown, message = '성공') {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message, data, error: null }),
  });
}

function failure(route: Route, status: number, message: string, code: string) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      success: false,
      message,
      data: null,
      error: { code, status, details: [] },
    }),
  });
}

async function authenticate(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem('accessToken', 'world-setting-token');
    localStorage.removeItem('catchhole_demo_mode');
  });
}

function pageResponse<T>(content: T[]) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    hasNext: false,
  };
}

const characterCandidate = {
  id: characterCandidateId,
  workId,
  episodeNo: 3,
  entityType: 'CHARACTER',
  entityName: '수아',
  rawEntityMention: '수아',
  matchedCharacterId: '88888888-8888-4888-8888-888888888888',
  matchStatus: 'MATCHED',
  attributeName: 'profile.affiliation',
  attributeNameEditable: false,
  attributeNamePrefix: null,
  attributeValue: '북부 연합',
  valueType: 'STRING',
  evidenceSpans: [{ quote: '수아는 북부 연합의 전령이었다.' }],
  confidence: 0.92,
  reviewStatus: 'PENDING_REVIEW',
};

function worldCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: worldCandidateId,
    workId,
    sourceEpisodeId: '99999999-9999-4999-8999-999999999999',
    sourceEpisodeNo: 3,
    analysisJobId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    category: 'RACE',
    subjectName: '북부 바바리안',
    settingName: '서식지',
    extractedValue: '북부 설원',
    evidenceSpans: [{
      quote: '바바리안 부족은 북부 설원의 혹한 속에서 살아왔다.',
      startOffset: 120,
      endOffset: 148,
    }],
    extractionConfidence: 0.91,
    targetWorldSettingId: worldSettingId,
    suggestedOperation: 'MERGE',
    proposedSettingName: '서식지',
    beforeValue: '혹한 지역',
    proposedValue: '혹한 지역의 북부 설원',
    comparisonReason: '두 값이 모순되지 않아 구체적인 장소를 합칩니다.',
    baseWorldSettingVersion: 3,
    comparedAt: '2026-08-06T09:00:00',
    comparisonStatus: 'COMPLETED',
    comparisonErrorMessage: null,
    reviewStatus: 'PENDING_REVIEW',
    userModified: false,
    createdAt: '2026-08-06T08:59:00',
    updatedAt: '2026-08-06T09:00:00',
    ...overrides,
  };
}

test('세계관 후보 탭은 합산 진행률·필터·딥링크를 유지하고 최종 반영값을 확정한다', async ({ page }) => {
  let firstCandidate = worldCandidate();
  const secondCandidate = worldCandidate({
    id: secondWorldCandidateId,
    sourceEpisodeNo: 4,
    category: 'IMPORTANT_ITEM',
    subjectName: '화염검',
    settingName: '제작 재료',
    extractedValue: '용의 심장',
    suggestedOperation: 'ADD',
    proposedSettingName: '제작 재료',
    beforeValue: null,
    proposedValue: '용의 심장',
  });
  let confirmedBody: Record<string, unknown> | null = null;
  const requestedCategories: Array<string | null> = [];

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const worldListPath = `/api/v1/works/${workId}/world-setting-candidates`;
    const characterListPath = `/api/v1/works/${workId}/setting-candidates`;

    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname === worldListPath && request.method() === 'GET') {
      requestedCategories.push(url.searchParams.get('category'));
      const reviewStatus = url.searchParams.get('reviewStatus');
      const category = url.searchParams.get('category');
      const operation = url.searchParams.get('operation');
      const all = [firstCandidate, secondCandidate];
      const content = all.filter(candidate => (
        (!reviewStatus || candidate.reviewStatus === reviewStatus)
        && (!category || candidate.category === category)
        && (!operation || candidate.suggestedOperation === operation)
      ));
      return success(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 5,
        episodeCount: 5,
        totalCandidateCount: 2,
        reviewedCandidateCount: firstCandidate.reviewStatus === 'CONFIRMED' ? 1 : 0,
        pendingCandidateCount: firstCandidate.reviewStatus === 'CONFIRMED' ? 1 : 2,
        pendingComparisonCount: 0,
        processingComparisonCount: 0,
        failedComparisonCount: 0,
        recomparisonRequiredCount: 0,
        candidates: pageResponse(content),
      });
    }
    if (pathname === `${worldListPath}/${worldCandidateId}` && request.method() === 'GET') {
      return success(route, firstCandidate);
    }
    if (pathname === `${worldListPath}/${secondWorldCandidateId}` && request.method() === 'GET') {
      return success(route, secondCandidate);
    }
    if (pathname === `${worldListPath}/${worldCandidateId}/confirm` && request.method() === 'POST') {
      confirmedBody = request.postDataJSON() as Record<string, unknown>;
      firstCandidate = {
        ...firstCandidate,
        reviewStatus: 'CONFIRMED',
        finalOperation: confirmedBody.operation,
        finalCategory: confirmedBody.category,
        finalSubjectName: confirmedBody.subjectName,
        finalSettingName: confirmedBody.settingName,
        finalValue: confirmedBody.value,
        reviewedByDisplayName: member.displayName,
        reviewedAt: '2026-08-06T10:00:00',
      };
      return success(route, firstCandidate);
    }
    if (pathname === characterListPath && request.method() === 'GET') {
      return success(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 5,
        episodeCount: 5,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        candidates: pageResponse([characterCandidate]),
      });
    }
    if (pathname === `${characterListPath}/${characterCandidateId}`) {
      return success(route, characterCandidate);
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  const summary = page.getByRole('region', { name: '설정 후보 검토 요약' });
  await expect(summary).toContainText('전체 후보');
  await expect(summary).toContainText('3개');
  await expect(page.getByText('바바리안 부족은 북부 설원의 혹한 속에서 살아왔다.')).toBeVisible();

  await page.getByLabel('세계관 분류').selectOption('RACE');
  await page.getByLabel('제안된 반영 방식').selectOption('MERGE');
  await expect.poll(() => new URL(page.url()).searchParams.get('worldCategory')).toBe('RACE');
  await expect.poll(() => new URL(page.url()).searchParams.get('operation')).toBe('MERGE');
  await expect.poll(() => requestedCategories.at(-1)).toBe('RACE');

  await page.getByRole('button', { name: /캐릭터 후보/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBeNull();
  await expect(page.getByText('수아', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: /세계관 후보/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBe('world');
  await expect.poll(() => new URL(page.url()).searchParams.get('worldCategory')).toBe('RACE');
  await expect.poll(() => new URL(page.url()).searchParams.get('candidate')).toBe(worldCandidateId);

  await page.getByRole('button', { name: '병합 확정', exact: true }).click();
  await expect.poll(() => confirmedBody).toEqual({
    operation: 'MERGE',
    category: 'RACE',
    subjectName: '북부 바바리안',
    settingName: '서식지',
    value: '혹한 지역의 북부 설원',
  });
  await expect.poll(() => new URL(page.url()).searchParams.get('candidate')).toBeNull();
  await page.getByRole('button', { name: '세계관 DB에서 보기' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');
  await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe('worldsettings');
  await expect.poll(() => new URL(page.url()).searchParams.get('settingId')).toBe(worldSettingId);
});

test('세계관 후보 조회가 실패해도 캐릭터 후보 탭으로 이동할 수 있다', async ({ page }) => {
  const worldListPath = `/api/v1/works/${workId}/world-setting-candidates`;
  const characterListPath = `/api/v1/works/${workId}/setting-candidates`;

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname === worldListPath) {
      return failure(route, 500, '세계관 후보를 불러오지 못했습니다.', 'COMMON_INTERNAL_SERVER_ERROR');
    }
    if (pathname === characterListPath) {
      return success(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 5,
        episodeCount: 5,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        matchRequiredCandidateCount: 0,
        candidates: pageResponse([characterCandidate]),
      });
    }
    if (pathname === `${characterListPath}/${characterCandidateId}`) {
      return success(route, characterCandidate);
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);
  await expect(page.getByRole('strong').filter({ hasText: '세계관 후보를 불러오지 못했습니다.' })).toBeVisible();

  await page.getByRole('button', { name: /캐릭터 후보/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBeNull();
  await expect(page.getByText('수아', { exact: true }).first()).toBeVisible();
});

test('확정본 충돌은 비교 회복을 polling하고 같은 후보의 다음 충돌도 자동 재비교한다', async ({ page }) => {
  let candidate = worldCandidate();
  let confirmAttempts = 0;
  let retryAttempts = 0;
  let pendingDetailReads = 0;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const worldListPath = `/api/v1/works/${workId}/world-setting-candidates`;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname === `/api/v1/works/${workId}/setting-candidates`) {
      return success(route, {
        batchId,
        totalCandidateCount: 0,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 0,
        matchRequiredCandidateCount: 0,
        candidates: pageResponse([]),
      });
    }
    if (pathname === worldListPath && request.method() === 'GET') {
      return success(route, {
        batchId,
        episodeStartNo: 3,
        episodeEndNo: 3,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        pendingComparisonCount: candidate.comparisonStatus === 'PENDING' ? 1 : 0,
        processingComparisonCount: 0,
        failedComparisonCount: 0,
        recomparisonRequiredCount: candidate.comparisonStatus === 'RECOMPARISON_REQUIRED' ? 1 : 0,
        candidates: pageResponse([candidate]),
      });
    }
    if (pathname === `${worldListPath}/${worldCandidateId}` && request.method() === 'GET') {
      if (candidate.comparisonStatus === 'PENDING') {
        pendingDetailReads += 1;
        if (pendingDetailReads >= 2) candidate = worldCandidate();
      }
      return success(route, candidate);
    }
    if (pathname === `${worldListPath}/${worldCandidateId}/confirm`) {
      confirmAttempts += 1;
      candidate = { ...candidate, comparisonStatus: 'RECOMPARISON_REQUIRED' };
      return failure(route, 409, '확정본이 바뀌어 다시 비교해야 합니다.', 'WORLD_SETTING_CANDIDATE_RECOMPARISON_REQUIRED');
    }
    if (pathname === `${worldListPath}/${worldCandidateId}/recompare`) {
      retryAttempts += 1;
      pendingDetailReads = 0;
      candidate = {
        ...candidate,
        comparisonStatus: 'PENDING',
        suggestedOperation: undefined,
        proposedSettingName: null,
        proposedValue: null,
      };
      return success(route, candidate);
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world&candidate=${worldCandidateId}`);
  await page.getByRole('button', { name: '병합 확정', exact: true }).click();

  await expect.poll(() => confirmAttempts).toBe(1);
  await expect.poll(() => retryAttempts).toBe(1);
  await expect(page.getByRole('article').getByText('비교 대기', { exact: true })).toBeVisible();
  await page.waitForTimeout(250);
  expect(retryAttempts).toBe(1);

  const confirmButton = page.getByRole('button', { name: '병합 확정', exact: true });
  await expect(confirmButton).toBeEnabled({ timeout: 7_000 });
  await confirmButton.click();
  await expect.poll(() => confirmAttempts).toBe(2);
  await expect.poll(() => retryAttempts).toBe(2);
});

test('세계관 DB와 설정 검색은 q·page를 탭별로 저장하고 복원한다', async ({ page }) => {
  const worldListQueries: Array<{ q: string | null; page: string | null }> = [];
  const factSearchQueries: Array<{ q: string | null; page: string | null }> = [];
  const settingRow = {
    id: worldSettingId,
    category: 'RACE',
    subjectName: '바바리안',
    propertyCount: 1,
    version: 1,
    updatedAt: '2026-08-06T09:00:00',
  };
  const settingDetail = {
    ...settingRow,
    properties: { 서식지: '북부 설원' },
    propertyEvidences: {},
  };
  const factResult = {
    characterFactId: '88888888-8888-4888-8888-888888888888',
    factType: 'SKILL',
    factTypeLabel: '스킬',
    displayName: '월광 검술',
    factValue: 'Lv.3',
    isCurrent: true,
    characterId: '99999999-9999-4999-8999-999999999999',
    characterName: '아르켄',
    sourceEpisodeNo: 12,
  };

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const worldListPath = `/api/v1/works/${workId}/world-settings`;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname === '/api/v1/works') {
      return success(route, [{ id: workId, title: '탭 상태 작품', genre: '판타지', episodeCount: 12 }]);
    }
    if (pathname === `/api/v1/works/${workId}`) {
      return success(route, { id: workId, title: '탭 상태 작품', genre: '판타지', latestEpisodeNo: 12 });
    }
    if (pathname === `/api/v1/works/${workId}/episodes`) return success(route, []);
    if (pathname === worldListPath && request.method() === 'GET') {
      worldListQueries.push({ q: url.searchParams.get('q'), page: url.searchParams.get('page') });
      const apiPage = Number(url.searchParams.get('page') ?? 0);
      return success(route, {
        totalWorldSettingCount: 1,
        worldSettings: {
          content: [settingRow],
          page: apiPage,
          size: 20,
          totalElements: 40,
          totalPages: 2,
          hasNext: apiPage < 1,
        },
      });
    }
    if (pathname === `${worldListPath}/${worldSettingId}`) return success(route, settingDetail);
    if (pathname === `/api/v1/works/${workId}/character-facts/search`) {
      factSearchQueries.push({ q: url.searchParams.get('q'), page: url.searchParams.get('page') });
      const apiPage = Number(url.searchParams.get('page') ?? 0);
      return success(route, {
        content: [factResult],
        page: apiPage,
        size: 20,
        totalElements: 40,
        totalPages: 2,
        hasNext: apiPage < 1,
      });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=worldsettings&q=세계&page=2`);
  await expect.poll(() => worldListQueries.some(query => query.q === '세계' && query.page === '1')).toBe(true);

  await page.getByRole('button', { name: '설정 검색', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('');
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('1');
  await expect.poll(() => factSearchQueries.some(query => query.q === '' && query.page === '0')).toBe(true);

  await page.getByRole('textbox', { name: '설정 검색' }).fill('검술');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('검술');
  await page.getByRole('button', { name: '다음 페이지' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');

  await page.getByRole('button', { name: '세계관 DB', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('세계');
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
  await expect.poll(() => worldListQueries.filter(query => query.q === '세계' && query.page === '1').length).toBeGreaterThan(1);

  await page.getByRole('button', { name: '설정 검색', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('검술');
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
});

test('모바일 세계관 DB는 사용자가 대상을 고를 때까지 목록을 유지한다', async ({ page }) => {
  const settingRow = {
    id: worldSettingId,
    category: 'RACE',
    subjectName: '바바리안',
    propertyCount: 1,
    version: 1,
    updatedAt: '2026-08-06T09:00:00',
  };

  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const worldListPath = `/api/v1/works/${workId}/world-settings`;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname === '/api/v1/works') {
      return success(route, [{ id: workId, title: '모바일 세계관 작품', genre: '판타지', episodeCount: 12 }]);
    }
    if (pathname === `/api/v1/works/${workId}`) {
      return success(route, { id: workId, title: '모바일 세계관 작품', genre: '판타지', latestEpisodeNo: 12 });
    }
    if (pathname === `/api/v1/works/${workId}/episodes`) return success(route, []);
    if (pathname === worldListPath && request.method() === 'GET') {
      return success(route, { totalWorldSettingCount: 1, worldSettings: pageResponse([settingRow]) });
    }
    if (pathname === `${worldListPath}/${worldSettingId}`) {
      return success(route, { ...settingRow, properties: { 서식지: '북부 설원' }, propertyEvidences: {} });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=worldsettings`);

  const filters = page.locator('.world-setting-db-filters');
  const filterMetrics = await filters.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  const filterTops = await filters.locator(':scope > *').evaluateAll(elements => (
    elements.map(element => Math.round(element.getBoundingClientRect().top))
  ));
  expect(filterMetrics.scrollWidth).toBeLessThanOrEqual(filterMetrics.clientWidth);
  expect(new Set(filterTops).size).toBe(3);

  const list = page.locator('.world-setting-db-list');
  await expect(list).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('settingId')).toBeNull();
  await list.getByText('바바리안', { exact: true }).click();
  await expect(page.getByRole('button', { name: '대상 목록으로' })).toBeVisible();

  await page.getByRole('button', { name: '대상 목록으로' }).click();
  await expect(list).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('settingId')).toBeNull();
  await page.waitForTimeout(250);
  expect(new URL(page.url()).searchParams.get('settingId')).toBeNull();
});

test('세계관 DB는 URL 검색과 직접 생성 중복 오류, 설정 버전 충돌 뒤 입력 보존을 처리한다', async ({ page }) => {
  let createAttempts = 0;
  let propertyAttempts = 0;
  let identityAttempts = 0;
  let latestListQuery: URL | null = null;
  let propertyRequestBody: Record<string, unknown> | null = null;
  let detailVersion = 3;
  let settingValue = '혹한 지역';
  let subjectName = '바바리안';
  let rows = [{
    id: worldSettingId,
    category: 'RACE',
    subjectName,
    propertyCount: 2,
    version: detailVersion,
    updatedAt: '2026-08-06T09:00:00',
    matchedSettingName: null,
    matchedSettingValue: null,
  }];

  const detailFor = (id: string) => ({
    id,
    workId,
    category: 'RACE',
    subjectName: id === createdWorldSettingId ? subjectName : '바바리안',
    properties: id === createdWorldSettingId
      ? { 서식지: settingValue }
      : { 서식지: '혹한 지역', 특징: '전투에 특화된 종족' },
    propertyCount: id === createdWorldSettingId ? 1 : 2,
    version: detailVersion,
    propertyEvidence: id === createdWorldSettingId ? [] : [{
      settingName: '서식지',
      latestEvidence: {
        candidateId: worldCandidateId,
        operation: 'ADD',
        value: '혹한 지역',
        sourceEpisodeNo: 3,
        evidenceSpans: [{ quote: '바바리안은 혹한 지역에서 살아간다.' }],
        reviewedAt: '2026-08-06T09:00:00',
      },
      history: [{
        candidateId: worldCandidateId,
        operation: 'ADD',
        value: '혹한 지역',
        sourceEpisodeNo: 3,
        evidenceSpans: [{ quote: '바바리안은 혹한 지역에서 살아간다.' }],
        reviewedAt: '2026-08-06T09:00:00',
      }, {
        candidateId: secondWorldCandidateId,
        operation: 'ADD',
        value: '설원 지대',
        sourceEpisodeNo: 2,
        evidenceSpans: [{ quote: '그들은 오래전부터 설원 지대에 정착했다.' }],
        reviewedAt: '2026-08-05T09:00:00',
      }],
    }],
    createdAt: '2026-08-06T08:00:00',
    updatedAt: '2026-08-06T09:00:00',
  });

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const listPath = `/api/v1/works/${workId}/world-settings`;

    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname === '/api/v1/works' && request.method() === 'GET') {
      return success(route, [{ id: workId, title: '세계관 테스트 작품', genre: '판타지', episodeCount: 5 }]);
    }
    if (pathname === `/api/v1/works/${workId}`) {
      return success(route, { id: workId, title: '세계관 테스트 작품', genre: '판타지', latestEpisodeNo: 5 });
    }
    if (pathname === `/api/v1/works/${workId}/episodes`) return success(route, []);
    if (pathname === listPath && request.method() === 'GET') {
      latestListQuery = url;
      const query = url.searchParams.get('q');
      const category = url.searchParams.get('category');
      const content = rows.filter(row => (
        (!query || row.subjectName.includes(query) || query === '사회 구조')
        && (!category || row.category === category)
      ));
      return success(route, {
        totalWorldSettingCount: rows.length,
        worldSettings: pageResponse(content),
      });
    }
    if (pathname === listPath && request.method() === 'POST') {
      createAttempts += 1;
      if (createAttempts === 1) {
        return failure(route, 409, '같은 분류와 대상명이 이미 존재합니다.', 'WORLD_SETTING_DUPLICATE');
      }
      const body = request.postDataJSON() as Record<string, string>;
      subjectName = body.subjectName;
      settingValue = body.settingValue;
      detailVersion = 1;
      rows = [{
        id: createdWorldSettingId,
        category: body.category,
        subjectName,
        propertyCount: 1,
        version: detailVersion,
        updatedAt: '2026-08-06T10:00:00',
        matchedSettingName: null,
        matchedSettingValue: null,
      }, ...rows];
      return success(route, detailFor(createdWorldSettingId));
    }

    const detailMatch = pathname.match(new RegExp(`^${listPath}/([^/]+)$`));
    if (detailMatch && request.method() === 'GET') return success(route, detailFor(detailMatch[1]));
    if (pathname === `${listPath}/${createdWorldSettingId}/properties` && request.method() === 'PATCH') {
      propertyAttempts += 1;
      propertyRequestBody = request.postDataJSON() as Record<string, unknown>;
      if (propertyRequestBody.settingName === '중복 설정') {
        return failure(route, 409, '같은 대상에 동일한 설정명이 이미 존재합니다.', 'WORLD_SETTING_DUPLICATE');
      }
      if (propertyAttempts === 1) {
        detailVersion = 2;
        return failure(route, 409, '다른 변경이 먼저 반영되었습니다.', 'WORLD_SETTING_VERSION_CONFLICT');
      }
      settingValue = String(propertyRequestBody.settingValue);
      detailVersion += 1;
      return success(route, detailFor(createdWorldSettingId));
    }
    if (pathname === `${listPath}/${createdWorldSettingId}/identity` && request.method() === 'PATCH') {
      identityAttempts += 1;
      const body = request.postDataJSON() as Record<string, unknown>;
      subjectName = String(body.subjectName);
      detailVersion += 1;
      rows = rows.map(row => row.id === createdWorldSettingId ? { ...row, subjectName, version: detailVersion } : row);
      return success(route, detailFor(createdWorldSettingId));
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=worldsettings`);
  await expect(page.getByText('바바리안', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('바바리안은 혹한 지역에서 살아간다.')).toHaveCount(0);
  await page.getByText('3화', { exact: true }).click();
  await expect(page.getByText('바바리안은 혹한 지역에서 살아간다.')).toHaveCount(1);
  await expect(page.getByText('그들은 오래전부터 설원 지대에 정착했다.')).toBeVisible();

  await page.getByPlaceholder('대상 · 설정명 · 설정값 검색').fill('사회 구조');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('사회 구조');
  await expect.poll(() => latestListQuery?.searchParams.get('q') ?? null).toBe('사회 구조');

  await page.getByRole('button', { name: '새 대상 추가', exact: true }).click();
  const createForm = page.getByText('새 세계관 대상 추가', { exact: true }).locator('..').locator('..').locator('..');
  await page.getByLabel('대상명').fill('북부 설원 부족');
  await page.getByLabel('설정명').fill('서식지');
  await page.getByLabel('설정값').fill('북부 설원');
  await page.goBack();
  await expect(page.getByText('새 세계관 대상 추가', { exact: true })).toHaveCount(0);
  await page.goForward();
  await expect(page.getByLabel('대상명')).toHaveValue('북부 설원 부족');
  await expect(page.getByLabel('설정명')).toHaveValue('서식지');
  await expect(page.getByLabel('설정값')).toHaveValue('북부 설원');
  await page.getByRole('button', { name: '대상 추가', exact: true }).click();
  await expect(page.getByText('같은 분류와 대상명이 이미 존재합니다.')).toBeVisible();
  await expect(page.getByLabel('대상명')).toHaveValue('북부 설원 부족');
  await expect(page.getByLabel('설정명')).toHaveValue('서식지');
  await expect(createForm).toBeVisible();
  await page.getByRole('button', { name: '대상 추가', exact: true }).click();

  await expect(page.getByText('새 세계관 대상 추가', { exact: true })).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.get('settingId')).toBe(createdWorldSettingId);
  await expect(page.getByText('북부 설원 부족', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: '서식지 설정 수정' }).click();
  const detailPanel = page.locator('.world-setting-db-detail');
  await detailPanel.getByLabel('설정값').fill('북부 설원의 혹한 지역');
  await detailPanel.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('다른 변경이 먼저 반영되었습니다.')).toBeVisible();
  await expect(detailPanel.getByLabel('설정값')).toHaveValue('북부 설원의 혹한 지역');
  await page.getByRole('button', { name: '최신값 다시 불러오기' }).click();
  await expect(detailPanel.getByLabel('설정값')).toHaveValue('북부 설원의 혹한 지역');
  await detailPanel.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(() => propertyAttempts).toBe(2);
  expect(propertyRequestBody).toMatchObject({
    currentSettingName: '서식지',
    settingName: '서식지',
    settingValue: '북부 설원의 혹한 지역',
    version: 2,
  });
  await expect(page.getByText('북부 설원의 혹한 지역', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '서식지 설정 수정' }).click();
  await detailPanel.getByLabel('설정명').fill('중복 설정');
  await detailPanel.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('같은 대상에 동일한 설정명이 이미 존재합니다.')).toBeVisible();
  await expect(detailPanel.getByRole('button', { name: '최신값 다시 불러오기' })).toHaveCount(0);
  await expect(detailPanel.getByLabel('설정명')).toHaveValue('중복 설정');
  page.once('dialog', dialog => dialog.accept());
  await detailPanel.getByRole('button', { name: '취소', exact: true }).click();

  await page.getByRole('button', { name: '대상 정보 수정' }).click();
  await page.getByLabel('대상명').fill('북부 바바리안');
  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get('modal')).toBeNull();
  await expect(page.getByRole('button', { name: '변경 저장' })).toHaveCount(0);
  await page.goForward();
  await expect.poll(() => new URL(page.url()).searchParams.get('modal')).toBe('world-setting-edit');
  await expect(page.getByLabel('대상명')).toHaveValue('북부 바바리안');
  await page.getByRole('button', { name: '변경 저장' }).click();
  await expect.poll(() => identityAttempts).toBe(1);
  await expect(page.getByText('북부 바바리안', { exact: true }).first()).toBeVisible();
});

test('세계관 DB 목록 오류를 재시도하면 빈 상태와 직접 추가 동선을 표시한다', async ({ page }) => {
  let listAttempts = 0;
  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname === '/api/v1/works') {
      return success(route, [{ id: workId, title: '빈 세계관 작품', genre: '판타지', episodeCount: 0 }]);
    }
    if (pathname === `/api/v1/works/${workId}`) {
      return success(route, { id: workId, title: '빈 세계관 작품', genre: '판타지', latestEpisodeNo: 0 });
    }
    if (pathname === `/api/v1/works/${workId}/episodes`) return success(route, []);
    if (pathname === `/api/v1/works/${workId}/world-settings` && request.method() === 'GET') {
      listAttempts += 1;
      if (listAttempts <= 2) {
        return failure(route, 500, '세계관 목록을 불러오지 못했습니다.', 'COMMON_INTERNAL_SERVER_ERROR');
      }
      return success(route, { totalWorldSettingCount: 0, worldSettings: pageResponse([]) });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/dashboard?workId=${workId}&nav=settingDB&tab=worldsettings`);
  await expect(page.getByText('세계관 목록을 불러오지 못했습니다.')).toBeVisible();
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByText('등록된 세계관 설정이 없습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '회차 분석하기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '새 대상 추가', exact: true }).last()).toBeVisible();
});
