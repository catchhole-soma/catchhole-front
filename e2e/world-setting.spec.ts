import { expect, test, type Page, type Route } from '@playwright/test';

const workId = '11111111-1111-4111-8111-111111111111';
const batchId = '22222222-2222-4222-8222-222222222222';
const worldCandidateId = '33333333-3333-4333-8333-333333333333';
const secondWorldCandidateId = '44444444-4444-4444-8444-444444444444';
const thirdWorldCandidateId = '45454545-4545-4454-8454-454545454545';
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

function failure(
  route: Route,
  status: number,
  message: string,
  code: string,
  context: Record<string, unknown> = {},
) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      success: false,
      message,
      data: null,
      error: { code, status, details: [], context },
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
    targetSubjectName: '바바리안',
    consolidationStatus: 'SINGLE',
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

function worldCandidateGroup(candidates: Array<ReturnType<typeof worldCandidate>>) {
  const first = candidates[0];
  const operationCount = (operation: string) => candidates.filter(candidate => candidate.suggestedOperation === operation).length;
  const status = candidates.some(candidate => candidate.comparisonStatus === 'FAILED')
    ? 'FAILED'
    : candidates.some(candidate => candidate.comparisonStatus === 'RECOMPARISON_REQUIRED')
      ? 'RECOMPARISON_REQUIRED'
      : candidates.some(candidate => candidate.comparisonStatus === 'PROCESSING')
        ? 'PROCESSING'
        : candidates.some(candidate => candidate.comparisonStatus === 'PENDING')
          ? 'PENDING'
          : 'READY';
  return {
    groupKey: `${first.category}|${first.targetSubjectName ?? first.subjectName}`,
    category: first.category,
    subjectName: first.targetSubjectName ?? first.subjectName,
    changeCount: candidates.length,
    addCount: operationCount('ADD'),
    updateCount: operationCount('UPDATE'),
    mergeCount: operationCount('MERGE'),
    excludeCount: operationCount('EXCLUDE'),
    evidenceEpisodeNos: [...new Set(candidates.map(candidate => candidate.sourceEpisodeNo))],
    status,
    recomparisonScope: status === 'RECOMPARISON_REQUIRED' ? 'ROW' : null,
    candidates,
  };
}

test('세계관 비교 실패 시 내부 검증 오류를 숨기고 다시 비교 안내만 표시한다', async ({ page }) => {
  const rawError = 'World-setting comparison failed after 3 attempts: A single extracted value must be preserved.';
  const failedCandidate = worldCandidate({
    comparisonStatus: 'FAILED',
    comparisonErrorMessage: rawError,
    suggestedOperation: undefined,
    proposedSettingName: null,
    proposedValue: null,
  });

  await page.route('**/api/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
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
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates`) {
      return success(route, {
        batchId,
        episodeStartNo: 3,
        episodeEndNo: 3,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        pendingComparisonCount: 0,
        processingComparisonCount: 0,
        failedComparisonCount: 1,
        recomparisonRequiredCount: 0,
        groups: pageResponse([worldCandidateGroup([failedCandidate])]),
      });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  await expect(page.getByText(
    '기존 세계관과 비교 결과를 만들지 못했습니다. 다시 비교하거나 설정을 수정해 주세요.',
  )).toBeVisible();
  await expect(page.getByText(rawError)).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다시 비교', exact: true })).toBeVisible();
});

test('세계관 후보 탭은 대상별 설정과 여러 1차 원문을 묶어 한 번에 반영한다', async ({ page }) => {
  let firstCandidate = worldCandidate({
    consolidationStatus: 'MERGED',
    extractedValue: '북부 설원\n혹한의 땅',
    evidenceSpans: [{
      quote: '바바리안 부족은 북부 설원의 혹한 속에서 살아왔다.',
      startOffset: 120,
      endOffset: 148,
    }, {
      quote: '혹한의 땅은 바바리안의 오랜 터전이었다.',
      startOffset: 180,
      endOffset: 204,
    }],
  });
  let secondCandidate = worldCandidate({
    id: secondWorldCandidateId,
    sourceEpisodeNo: 5,
    subjectName: '바바리안',
    settingName: '특징',
    extractedValue: '강인한 신체를 가졌다.',
    evidenceSpans: [{ quote: '그들은 강인한 신체로 혹한과 전투를 버텼다.' }],
    suggestedOperation: 'ADD',
    proposedSettingName: '특징',
    beforeValue: null,
    proposedValue: '강인한 신체를 가진 전투 종족',
  });
  let updatedBody: Record<string, unknown> | null = null;
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
      const groupedContent = content.length
        ? (() => {
          const group = worldCandidateGroup(content);
          return [{
            ...group,
            groupKey: firstCandidate.finalSubjectName ? `RACE|${firstCandidate.finalSubjectName}` : group.groupKey,
            category: firstCandidate.finalCategory ?? group.category,
            subjectName: firstCandidate.finalSubjectName ?? group.subjectName,
          }];
        })()
        : [];
      return success(route, {
        batchId,
        episodeStartNo: 1,
        episodeEndNo: 5,
        episodeCount: 5,
        totalCandidateCount: 2,
        reviewedCandidateCount: all.filter(candidate => candidate.reviewStatus === 'CONFIRMED').length,
        pendingCandidateCount: all.filter(candidate => candidate.reviewStatus === 'PENDING_REVIEW').length,
        pendingComparisonCount: 0,
        processingComparisonCount: 0,
        failedComparisonCount: 0,
        recomparisonRequiredCount: 0,
        groups: pageResponse(groupedContent),
      });
    }
    if (pathname === `${worldListPath}/decisions` && request.method() === 'PATCH') {
      updatedBody = request.postDataJSON() as Record<string, unknown>;
      const decisions = (updatedBody.candidates ?? []) as Array<Record<string, unknown>>;
      const applyDecision = (candidate: ReturnType<typeof worldCandidate>) => {
        const decision = decisions.find(item => item.candidateId === candidate.id)!;
        return {
          ...candidate,
          userModified: true,
          finalOperation: decision.operation,
          finalCategory: decision.category,
          finalSubjectName: decision.subjectName,
          finalScopeName: decision.scopeName ?? null,
          finalSettingName: decision.settingName,
          finalValue: decision.value,
        };
      };
      firstCandidate = applyDecision(firstCandidate);
      secondCandidate = applyDecision(secondCandidate);
      return success(route, {
        groupKey: 'RACE|북부 바바리안',
        candidates: [firstCandidate, secondCandidate],
      });
    }
    if (pathname === `${worldListPath}/group-confirm` && request.method() === 'POST') {
      confirmedBody = request.postDataJSON() as Record<string, unknown>;
      const decisions = (confirmedBody.candidates ?? []) as Array<Record<string, unknown>>;
      const firstDecision = decisions.find(decision => decision.candidateId === worldCandidateId)!;
      const secondDecision = decisions.find(decision => decision.candidateId === secondWorldCandidateId)!;
      firstCandidate = {
        ...firstCandidate,
        reviewStatus: 'CONFIRMED',
        finalOperation: firstDecision.operation,
        finalCategory: firstDecision.category,
        finalSubjectName: firstDecision.subjectName,
        finalSettingName: firstDecision.settingName,
        finalValue: firstDecision.value,
        reviewedByDisplayName: member.displayName,
        reviewedAt: '2026-08-06T10:00:00',
      };
      secondCandidate = {
        ...secondCandidate,
        reviewStatus: 'CONFIRMED',
        finalOperation: secondDecision.operation,
        finalCategory: secondDecision.category,
        finalSubjectName: secondDecision.subjectName,
        finalSettingName: secondDecision.settingName,
        finalValue: secondDecision.value,
      };
      return success(route, {
        groupKey: 'RACE|북부 바바리안',
        worldSettingId,
        appliedWorldSettingVersion: 4,
        candidates: [firstCandidate, secondCandidate],
      });
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
  await expect(page.getByText('종족 · 바바리안')).toBeVisible();
  await expect(
    page.getByRole('button').filter({ hasText: '바바리안' }).getByText('종족', { exact: true }).first(),
  ).toHaveCSS('color', 'rgb(155, 123, 255)');
  await expect(page.getByText('2개 설정').first()).toBeVisible();
  await expect(page.getByText('바바리안 부족은 북부 설원의 혹한 속에서 살아왔다.')).toBeVisible();
  await expect(page.getByText('혹한의 땅은 바바리안의 오랜 터전이었다.')).toBeVisible();
  await expect(page.getByText('근거 1')).toBeVisible();
  await expect(page.getByText('근거 2')).toBeVisible();
  await expect(page.getByText('그들은 강인한 신체로 혹한과 전투를 버텼다.')).toBeVisible();
  await expect(page.getByText('− 기존값').first()).toBeVisible();
  await expect(page.getByText('+ 제안값').first()).toBeVisible();
  await expect(page.getByText('1차 추출 원문').first()).toBeVisible();
  await expect(page.getByText('여러 내용 정리됨')).toBeVisible();
  await expect(page.getByText('여러 원문에서 추출된 내용을 하나의 설정으로 정리했습니다.')).toBeVisible();

  const worldCategoryFilter = page.getByRole('group', { name: '세계관 분류' });
  await expect(worldCategoryFilter.getByRole('button', { name: '전체 분류', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await worldCategoryFilter.getByRole('button', { name: '종족', exact: true }).click();
  await expect(worldCategoryFilter.getByRole('button', { name: '종족', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => new URL(page.url()).searchParams.get('worldCategory')).toBe('RACE');
  await expect.poll(() => requestedCategories.at(-1)).toBe('RACE');

  await page.getByRole('button', { name: /캐릭터 후보/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBeNull();
  await expect.poll(() => new URL(page.url()).searchParams.get('group')).toBeNull();
  await expect.poll(() => new URL(page.url()).searchParams.get('worldCategory')).toBeNull();
  await expect.poll(() => new URL(page.url()).searchParams.get('worldGroup')).toBe('RACE|바바리안');
  await expect.poll(() => new URL(page.url()).searchParams.get('worldCategoryFilter')).toBe('RACE');
  await expect(page.getByText('수아', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: /세계관 후보/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('candidateType')).toBe('world');
  await expect.poll(() => new URL(page.url()).searchParams.get('worldCategory')).toBe('RACE');
  await expect.poll(() => new URL(page.url()).searchParams.get('group')).toBe('RACE|바바리안');

  await page.getByRole('article').getByRole('button', { name: '수정', exact: true }).first().click();
  await expect(page.getByRole('combobox', { name: '분류', exact: true })).toHaveValue('RACE');
  await expect(page.getByRole('textbox', { name: '대상', exact: true })).toHaveValue('바바리안');
  const finalOperationSelect = page.getByRole('combobox', { name: '반영 방식', exact: true });
  await expect(finalOperationSelect).toHaveValue('MERGE');
  await expect(finalOperationSelect.locator('option')).toHaveText([
    '추가',
    '수정',
    '병합',
    '반영하지 않음',
  ]);
  await page.getByRole('button', { name: '취소', exact: true }).click();

  await page.getByRole('button', { name: '분류·대상 일괄 수정', exact: true }).click();
  await expect(page.getByRole('combobox')).toHaveValue('RACE');
  await expect(page.getByLabel('범위 (선택)', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('설정명', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('반영 방식', { exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: '대상', exact: true }).fill('북부 바바리안');
  await page.getByRole('button', { name: '일괄 수정 적용', exact: true }).click();
  await expect.poll(() => updatedBody).toEqual({
    batchId,
    candidates: [
      {
        candidateId: worldCandidateId,
        operation: 'MERGE',
        category: 'RACE',
        subjectName: '북부 바바리안',
        settingName: '서식지',
        value: '혹한 지역의 북부 설원',
      },
      {
        candidateId: secondWorldCandidateId,
        operation: 'ADD',
        category: 'RACE',
        subjectName: '북부 바바리안',
        settingName: '특징',
        value: '강인한 신체를 가진 전투 종족',
      },
    ],
  });
  await expect(page.getByText('종족 · 북부 바바리안', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '모두 확정', exact: true }).click();
  await expect.poll(() => confirmedBody).toEqual({
    batchId,
    candidates: [
      {
        candidateId: worldCandidateId,
        operation: 'MERGE',
        category: 'RACE',
        subjectName: '북부 바바리안',
        settingName: '서식지',
        value: '혹한 지역의 북부 설원',
      },
      {
        candidateId: secondWorldCandidateId,
        operation: 'ADD',
        category: 'RACE',
        subjectName: '북부 바바리안',
        settingName: '특징',
        value: '강인한 신체를 가진 전투 종족',
      },
    ],
  });
  await expect(page.getByText('북부 바바리안 설정 2개를 세계관 DB에 반영했습니다.')).toBeVisible();
  await page.getByRole('button', { name: '세계관 DB에서 보기' }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');
  await expect.poll(() => new URL(page.url()).searchParams.get('tab')).toBe('worldsettings');
  await expect.poll(() => new URL(page.url()).searchParams.get('settingId')).toBe(worldSettingId);
});

test('개별 설정 수정안은 다른 대상 그룹을 다녀와도 해당 row에만 유지된다', async ({ page }) => {
  let updateBody: Record<string, unknown> | null = null;
  let confirmedBody: Record<string, unknown> | null = null;
  let ghoul = worldCandidate({
    category: 'MONSTER',
    subjectName: '구울',
    targetSubjectName: '구울',
    settingName: '식성',
    extractedValue: '생명체의 육체를 먹는다.',
    targetWorldSettingId: null,
    suggestedOperation: 'ADD',
    proposedSettingName: '식성',
    beforeValue: null,
    proposedValue: '생명체의 육체를 먹는다.',
  });
  const ghoulWeakness = worldCandidate({
    id: secondWorldCandidateId,
    category: 'MONSTER',
    subjectName: '구울',
    targetSubjectName: '구울',
    settingName: '약점',
    extractedValue: '햇빛에 약하다.',
    targetWorldSettingId: null,
    suggestedOperation: 'ADD',
    proposedSettingName: '약점',
    beforeValue: null,
    proposedValue: '햇빛에 약하다.',
  });
  const fairy = worldCandidate({
    id: thirdWorldCandidateId,
    category: 'RACE',
    subjectName: '요정',
    targetSubjectName: '요정',
    settingName: '수명',
    extractedValue: '약 300년을 산다.',
    targetWorldSettingId: null,
    suggestedOperation: 'ADD',
    proposedSettingName: '수명',
    beforeValue: null,
    proposedValue: '약 300년을 산다.',
  });
  const worldListPath = `/api/v1/works/${workId}/world-setting-candidates`;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
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
      const groups = ghoul.finalCategory === 'LOCATION'
        ? [
          worldCandidateGroup([ghoulWeakness]),
          {
            ...worldCandidateGroup([ghoul]),
            groupKey: 'LOCATION|2층',
            category: 'LOCATION',
            subjectName: '2층',
          },
          worldCandidateGroup([fairy]),
        ]
        : [worldCandidateGroup([ghoul, ghoulWeakness]), worldCandidateGroup([fairy])];
      return success(route, {
        batchId,
        episodeStartNo: 3,
        episodeEndNo: 3,
        episodeCount: 1,
        totalCandidateCount: 3,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 3,
        pendingComparisonCount: 0,
        processingComparisonCount: 0,
        failedComparisonCount: 0,
        recomparisonRequiredCount: 0,
        groups: pageResponse(groups),
      });
    }
    if (pathname === `${worldListPath}/decisions` && request.method() === 'PATCH') {
      updateBody = request.postDataJSON() as Record<string, unknown>;
      const decision = (updateBody.candidates as Array<Record<string, unknown>>)[0];
      ghoul = {
        ...ghoul,
        userModified: true,
        finalOperation: decision.operation,
        finalCategory: decision.category,
        finalSubjectName: decision.subjectName,
        finalScopeName: decision.scopeName ?? null,
        finalSettingName: decision.settingName,
        finalValue: decision.value,
      };
      return success(route, {
        groupKey: 'LOCATION|2층',
        candidates: [ghoul],
      });
    }
    if (pathname === `${worldListPath}/group-confirm` && request.method() === 'POST') {
      confirmedBody = request.postDataJSON() as Record<string, unknown>;
      const decisions = (confirmedBody.candidates ?? []) as Array<Record<string, unknown>>;
      return success(route, {
        groupKey: 'LOCATION|2층',
        worldSettingId: createdWorldSettingId,
        appliedWorldSettingVersion: 0,
        candidates: decisions.map(decision => {
          return {
            ...ghoul,
            reviewStatus: 'CONFIRMED',
            targetWorldSettingId: createdWorldSettingId,
            finalOperation: decision.operation,
            finalCategory: decision.category,
            finalSubjectName: decision.subjectName,
            finalScopeName: decision.scopeName ?? null,
            finalSettingName: decision.settingName,
            finalValue: decision.value,
          };
        }),
      });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  await expect(page.getByText('몬스터 · 구울', { exact: true })).toBeVisible();
  await page.getByText('식성', { exact: true }).locator('..').getByRole('button', { name: '수정', exact: true }).click();
  await page.getByRole('combobox', { name: '분류', exact: true }).selectOption('LOCATION');
  await page.getByRole('textbox', { name: '대상', exact: true }).fill('2층');
  await page.getByLabel('설정명', { exact: true }).fill('섭식 습관');
  await page.getByRole('button', { name: '수정안 적용', exact: true }).click();
  await expect.poll(() => updateBody).toEqual({
    batchId,
    candidates: [{
      candidateId: worldCandidateId,
      operation: 'ADD',
      category: 'LOCATION',
      subjectName: '2층',
      settingName: '섭식 습관',
      value: '생명체의 육체를 먹는다.',
    }],
  });
  await expect.poll(() => new URL(page.url()).searchParams.get('group')).toBe('LOCATION|2층');
  await expect(page.getByText('장소 · 2층', { exact: true })).toBeVisible();
  await expect(page.getByText('섭식 습관', { exact: true })).toBeVisible();
  await expect(page.getByText('최종 대상 · 장소 · 2층', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button').filter({ hasText: '구울' }).first()).toBeVisible();

  await page.getByRole('button').filter({ hasText: '요정' }).first().click();
  await expect(page.getByText('종족 · 요정', { exact: true })).toBeVisible();
  await page.getByRole('button').filter({ hasText: '2층' }).first().click();
  await expect(page.getByText('장소 · 2층', { exact: true })).toBeVisible();
  await expect(page.getByText('섭식 습관', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '모두 확정', exact: true }).click();
  await expect.poll(() => confirmedBody).toEqual({
    batchId,
    candidates: [{
      candidateId: worldCandidateId,
      operation: 'ADD',
      category: 'LOCATION',
      subjectName: '2층',
      settingName: '섭식 습관',
      value: '생명체의 육체를 먹는다.',
    }],
  });
  await expect(page.getByText('2층 설정 1개를 세계관 DB에 반영했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '세계관 DB에서 보기' })).toBeVisible();
});

test('같은 설정명도 범위가 다르면 함께 모두 확정한다', async ({ page }) => {
  const firstFloor = worldCandidate({
    category: 'LOCATION',
    subjectName: '미궁',
    scopeName: '1층',
    settingName: '출몰 규칙',
    extractedValue: '동쪽에서 고블린이 출몰한다.',
    targetWorldSettingId: null,
    targetSubjectName: null,
    suggestedOperation: 'ADD',
    proposedScopeName: '1층',
    proposedSettingName: '출몰 규칙',
    beforeValue: null,
    proposedValue: '동쪽에서 고블린이 출몰한다.',
  });
  const secondFloor = worldCandidate({
    id: secondWorldCandidateId,
    category: 'LOCATION',
    subjectName: '미궁',
    scopeName: '2층',
    settingName: '출몰 규칙',
    extractedValue: '중앙부에서 언데드가 출몰한다.',
    targetWorldSettingId: null,
    targetSubjectName: null,
    suggestedOperation: 'ADD',
    proposedScopeName: '2층',
    proposedSettingName: '출몰 규칙',
    beforeValue: null,
    proposedValue: '중앙부에서 언데드가 출몰한다.',
  });
  let confirmedBody: Record<string, unknown> | null = null;
  const worldListPath = `/api/v1/works/${workId}/world-setting-candidates`;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
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
        episodeStartNo: 1,
        episodeEndNo: 3,
        episodeCount: 3,
        totalCandidateCount: 2,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 2,
        pendingComparisonCount: 0,
        processingComparisonCount: 0,
        failedComparisonCount: 0,
        recomparisonRequiredCount: 0,
        groups: pageResponse([worldCandidateGroup([firstFloor, secondFloor])]),
      });
    }
    if (pathname === `${worldListPath}/group-confirm` && request.method() === 'POST') {
      confirmedBody = request.postDataJSON() as Record<string, unknown>;
      return success(route, {
        groupKey: 'LOCATION|미궁',
        worldSettingId,
        appliedWorldSettingVersion: 0,
        candidates: [firstFloor, secondFloor],
      });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  await expect(page.getByText('1층 › 출몰 규칙', { exact: true })).toBeVisible();
  await expect(page.getByText('2층 › 출몰 규칙', { exact: true })).toBeVisible();
  await expect(page.getByText(/같은 범위와 설정명/)).toHaveCount(0);
  await page.getByRole('button', { name: '모두 확정', exact: true }).click();
  await expect.poll(() => confirmedBody).toEqual({
    batchId,
    candidates: [
      {
        candidateId: worldCandidateId,
        operation: 'ADD',
        category: 'LOCATION',
        subjectName: '미궁',
        scopeName: '1층',
        settingName: '출몰 규칙',
        value: '동쪽에서 고블린이 출몰한다.',
      },
      {
        candidateId: secondWorldCandidateId,
        operation: 'ADD',
        category: 'LOCATION',
        subjectName: '미궁',
        scopeName: '2층',
        settingName: '출몰 규칙',
        value: '중앙부에서 언데드가 출몰한다.',
      },
    ],
  });
});

test('작가 수정안은 LLM 재비교 없이 유지하고 ADD 경로 중복을 직접 안내한다', async ({ page }) => {
  let candidate = worldCandidate({
    category: 'LOCATION',
    subjectName: '1층',
    targetSubjectName: '1층',
    settingName: '출몰 규칙',
    extractedValue: '동쪽에서 고블린이 출몰한다.',
    suggestedOperation: 'ADD',
    proposedSettingName: '출몰 규칙',
    beforeValue: null,
    proposedValue: '동쪽에서 고블린이 출몰한다.',
  });
  const worldListPath = `/api/v1/works/${workId}/world-setting-candidates`;
  let confirmedBody: Record<string, unknown> | null = null;
  let decisionUpdateCount = 0;
  let candidatePatchCount = 0;
  let recompareCount = 0;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
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
      const group = worldCandidateGroup([candidate]);
      return success(route, {
        batchId,
        episodeStartNo: 3,
        episodeEndNo: 3,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        pendingComparisonCount: 0,
        processingComparisonCount: 0,
        failedComparisonCount: 0,
        recomparisonRequiredCount: 0,
        groups: pageResponse([{
          ...group,
          groupKey: candidate.finalSubjectName ? `LOCATION|${candidate.finalSubjectName}` : group.groupKey,
          category: candidate.finalCategory ?? group.category,
          subjectName: candidate.finalSubjectName ?? group.subjectName,
        }]),
      });
    }
    if (pathname === `${worldListPath}/decisions` && request.method() === 'PATCH') {
      decisionUpdateCount += 1;
      const body = request.postDataJSON() as Record<string, unknown>;
      const decision = (body.candidates as Array<Record<string, unknown>>)[0];
      candidate = {
        ...candidate,
        userModified: true,
        finalOperation: decision.operation,
        finalCategory: decision.category,
        finalSubjectName: decision.subjectName,
        finalScopeName: decision.scopeName ?? null,
        finalSettingName: decision.settingName,
        finalValue: decision.value,
      };
      return success(route, {
        groupKey: `LOCATION|${decision.subjectName}`,
        candidates: [candidate],
      });
    }
    if (pathname === `${worldListPath}/${worldCandidateId}` && request.method() === 'PATCH') {
      candidatePatchCount += 1;
      return success(route, candidate);
    }
    if (pathname === `${worldListPath}/${worldCandidateId}/recompare`) {
      recompareCount += 1;
      return success(route, candidate);
    }
    if (pathname === `${worldListPath}/group-confirm` && request.method() === 'POST') {
      confirmedBody = request.postDataJSON() as Record<string, unknown>;
      return failure(
        route,
        409,
        '추가하려는 범위와 설정명이 이미 존재합니다. 설정명을 바꾸거나 수정·병합 방식을 선택해 주세요.',
        'WORLD_SETTING_CANDIDATE_ADD_PATH_DUPLICATED',
      );
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);
  await page.getByRole('button', { name: '분류·대상 일괄 수정', exact: true }).click();
  await page.getByLabel('대상', { exact: true }).fill('미궁');
  await page.getByRole('button', { name: '일괄 수정 적용', exact: true }).click();
  await page.getByRole('article').getByRole('button', { name: '수정', exact: true }).click();
  await expect(page.getByText(/이 설정 항목 하나의 분류·대상·범위·설정명·반영 방식·최종값을 수정합니다/)).toBeVisible();
  await page.getByLabel('범위 (선택)', { exact: true }).fill('1층');
  await page.getByLabel('설정명', { exact: true }).fill('폐쇄 시점');
  await page.getByRole('button', { name: '수정안 적용', exact: true }).click();

  await expect.poll(() => decisionUpdateCount).toBe(2);
  expect(candidatePatchCount).toBe(0);
  expect(recompareCount).toBe(0);
  await expect(page.getByText('장소 · 미궁', { exact: true })).toBeVisible();
  await expect(page.getByText('1층 › 폐쇄 시점', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '모두 확정', exact: true }).click();
  await expect.poll(() => confirmedBody).toEqual({
    batchId,
    candidates: [{
      candidateId: worldCandidateId,
      operation: 'ADD',
      category: 'LOCATION',
      subjectName: '미궁',
      scopeName: '1층',
      settingName: '폐쇄 시점',
      value: '동쪽에서 고블린이 출몰한다.',
    }],
  });
  await expect(page.getByRole('alert')).toContainText('추가하려는 범위와 설정명이 이미 존재합니다.');
  expect(decisionUpdateCount).toBe(2);
  expect(candidatePatchCount).toBe(0);
  expect(recompareCount).toBe(0);
});

test('서로 다른 원문 값은 사용자가 최종값을 정한 뒤에만 모두 확정한다', async ({ page }) => {
  let conflictCandidate = worldCandidate({
    category: 'IMPORTANT_ITEM',
    subjectName: '메시지 스톤',
    targetWorldSettingId: null,
    targetSubjectName: null,
    settingName: '통신 반경',
    extractedValue: '약 300m\n약 3km',
    evidenceSpans: [
      { quote: '메시지 스톤의 공명은 삼백 미터가 한계였다.', startOffset: 100, endOffset: 125 },
      { quote: '세 리 밖에서도 메시지 스톤의 신호가 닿았다.', startOffset: 300, endOffset: 325 },
    ],
    consolidationStatus: 'CONFLICT',
    suggestedOperation: 'ADD',
    proposedSettingName: '통신 반경',
    beforeValue: null,
    proposedValue: '약 300m\n약 3km',
    comparisonReason: '원문마다 통신 반경이 달라 최종값 확인이 필요합니다.',
  });
  let confirmedBody: Record<string, unknown> | null = null;
  const worldListPath = `/api/v1/works/${workId}/world-setting-candidates`;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
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
        episodeStartNo: 8,
        episodeEndNo: 8,
        episodeCount: 1,
        totalCandidateCount: 1,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 1,
        pendingComparisonCount: 0,
        processingComparisonCount: 0,
        failedComparisonCount: 0,
        recomparisonRequiredCount: 0,
        conflictCandidateCount: 1,
        groups: pageResponse([worldCandidateGroup([conflictCandidate])]),
      });
    }
    if (pathname === `${worldListPath}/decisions` && request.method() === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      const decision = (body.candidates as Array<Record<string, unknown>>)[0];
      conflictCandidate = {
        ...conflictCandidate,
        userModified: true,
        finalOperation: decision.operation,
        finalCategory: decision.category,
        finalSubjectName: decision.subjectName,
        finalScopeName: decision.scopeName ?? null,
        finalSettingName: decision.settingName,
        finalValue: decision.value,
      };
      return success(route, {
        groupKey: 'IMPORTANT_ITEM|메시지 스톤',
        candidates: [conflictCandidate],
      });
    }
    if (pathname === `${worldListPath}/group-confirm` && request.method() === 'POST') {
      confirmedBody = request.postDataJSON() as Record<string, unknown>;
      return success(route, {
        groupKey: 'IMPORTANT_ITEM|메시지 스톤',
        worldSettingId,
        appliedWorldSettingVersion: 1,
        candidates: [{
          ...conflictCandidate,
          reviewStatus: 'CONFIRMED',
          finalOperation: 'ADD',
          finalSubjectName: '메시지 스톤',
          finalSettingName: '통신 반경',
          finalValue: '약 300m',
        }],
      });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  await expect(page.getByText('확인 필요', { exact: true }).first().locator('..')).toContainText('1개');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '통신 반경 제외', exact: true })).toBeVisible();
  await expect(page.getByText('내용 확인 필요')).toBeVisible();
  await expect(page.getByText('원문 내용이 서로 달라 자동으로 하나로 합치지 않았습니다.')).toBeVisible();
  await expect(page.getByText('추출 1').locator('..')).toContainText('약 300m');
  await expect(page.getByText('추출 2').locator('..')).toContainText('약 3km');

  await expect(page.getByRole('button', { name: '모두 확정' })).toBeDisabled();
  await expect(page.getByText('원문마다 내용이 다른 설정입니다.')).toBeVisible();

  await page.getByRole('article').getByRole('button', { name: '수정', exact: true }).click();
  await page.getByLabel('최종 설정값').fill('약 300m');
  await page.getByRole('button', { name: '수정안 적용' }).click();

  await expect(page.getByText('내용 확인 완료')).toBeVisible();
  await expect(page.getByRole('button', { name: '모두 확정' })).toBeEnabled();
  await page.getByRole('button', { name: '모두 확정' }).click();

  await expect.poll(() => confirmedBody).toEqual({
    batchId,
    candidates: [{
      candidateId: worldCandidateId,
      operation: 'ADD',
      category: 'IMPORTANT_ITEM',
      subjectName: '메시지 스톤',
      settingName: '통신 반경',
      value: '약 300m',
      conflictResolved: true,
    }],
  });
});

test('동일 설정명이 남은 기존 배치는 중복 항목을 제외한 뒤 확정한다', async ({ page }) => {
  let first = worldCandidate({
    category: 'IMPORTANT_ITEM',
    subjectName: '메시지 스톤',
    targetWorldSettingId: null,
    targetSubjectName: null,
    settingName: '기능',
    extractedValue: '메시지 스톤끼리 대화할 수 있다.',
    suggestedOperation: 'ADD',
    proposedSettingName: '기능',
    beforeValue: null,
    proposedValue: '메시지 스톤끼리 대화할 수 있다.',
  });
  const second = worldCandidate({
    id: secondWorldCandidateId,
    category: 'IMPORTANT_ITEM',
    subjectName: '메시지 스톤',
    targetWorldSettingId: null,
    targetSubjectName: null,
    settingName: '기능',
    extractedValue: '짧게 읊조려 신호를 보낼 수 있다.',
    suggestedOperation: 'ADD',
    proposedSettingName: '기능',
    beforeValue: null,
    proposedValue: '짧게 읊조려 신호를 보낼 수 있다.',
  });
  let candidates = [first, second];
  let dismissedBody: Record<string, unknown> | null = null;
  let confirmedBody: Record<string, unknown> | null = null;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
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
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates` && request.method() === 'GET') {
      return success(route, {
        batchId,
        episodeStartNo: 3,
        episodeEndNo: 3,
        episodeCount: 1,
        totalCandidateCount: candidates.length,
        reviewedCandidateCount: 2 - candidates.length,
        pendingCandidateCount: candidates.length,
        pendingComparisonCount: 0,
        processingComparisonCount: 0,
        failedComparisonCount: 0,
        recomparisonRequiredCount: 0,
        groups: pageResponse([worldCandidateGroup(candidates)]),
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates/decisions`
        && request.method() === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      const decision = (body.candidates as Array<Record<string, unknown>>)[0];
      first = {
        ...first,
        userModified: true,
        finalOperation: decision.operation,
        finalCategory: decision.category,
        finalSubjectName: decision.subjectName,
        finalScopeName: decision.scopeName ?? null,
        finalSettingName: decision.settingName,
        finalValue: decision.value,
      };
      candidates = candidates.map(candidate => candidate.id === first.id ? first : candidate);
      return success(route, {
        groupKey: 'IMPORTANT_ITEM|메시지 스톤',
        candidates: [first],
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates/group-dismiss` && request.method() === 'POST') {
      dismissedBody = request.postDataJSON() as Record<string, unknown>;
      candidates = candidates.filter(candidate => candidate.id !== secondWorldCandidateId);
      return success(route, {
        groupKey: 'IMPORTANT_ITEM|메시지 스톤',
        worldSettingId: null,
        appliedWorldSettingVersion: null,
        candidates: [{ ...second, reviewStatus: 'DISMISSED', finalOperation: 'EXCLUDE' }],
      });
    }
    if (pathname === `/api/v1/works/${workId}/world-setting-candidates/group-confirm` && request.method() === 'POST') {
      confirmedBody = request.postDataJSON() as Record<string, unknown>;
      return success(route, {
        groupKey: 'IMPORTANT_ITEM|메시지 스톤',
        worldSettingId,
        appliedWorldSettingVersion: 0,
        candidates: [{ ...first, reviewStatus: 'CONFIRMED', finalOperation: 'ADD' }],
      });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  const duplicateAlert = page.getByRole('alert').filter({ hasText: '같은 범위와 설정명 ‘기능’이 여러 번 있습니다.' });
  await expect(duplicateAlert).toContainText('내용을 하나로 합치거나 중복 항목을 제외해 주세요.');
  await expect(page.getByRole('button', { name: '모두 확정' })).toBeDisabled();

  await page.getByRole('article').getByRole('button', { name: '수정', exact: true }).first().click();
  await page.getByLabel('최종 설정값').fill('작가가 정리한 메시지 스톤 기능');
  await page.getByRole('button', { name: '수정안 적용', exact: true }).click();
  await page.getByRole('button', { name: '기능 제외', exact: true }).nth(1).click();
  await expect.poll(() => dismissedBody).toEqual({ batchId, candidateIds: [secondWorldCandidateId] });
  await expect(duplicateAlert).toBeHidden();
  await expect(page.getByRole('button', { name: '모두 확정' })).toBeEnabled();
  await page.getByRole('button', { name: '모두 확정' }).click();
  await expect.poll(() => confirmedBody).toEqual({
    batchId,
    candidates: [{
      candidateId: worldCandidateId,
      operation: 'ADD',
      category: 'IMPORTANT_ITEM',
      subjectName: '메시지 스톤',
      settingName: '기능',
      value: '작가가 정리한 메시지 스톤 기능',
    }],
  });
});

test('AI가 반영하지 않음을 제안한 설정도 원문과 판단 이유를 보고 묶음 확정한다', async ({ page }) => {
  const candidates = [
    worldCandidate({
      category: 'IMPORTANT_ITEM',
      subjectName: '포션',
      targetSubjectName: '포션',
      settingName: '상처 치료 효과',
      extractedValue: '상처 부위에 사용하면 피가 끓으며 빠르게 재생된다.',
      evidenceSpans: [{ quote: '피가 부글부글 끓더니 빠르게 재생된다.', startOffset: 3027, endOffset: 3048 }],
      suggestedOperation: 'EXCLUDE',
      proposedSettingName: '상처 치료 효과',
      beforeValue: '사용하면 신체를 빠르게 재생시킨다.',
      proposedValue: '상처 부위에 사용하면 피가 끓으며 빠르게 재생된다.',
      comparisonReason: 'T1의 기존 회복 효과와 의미가 겹쳐 별도 key로 ADD하지 않는 편이 좋습니다.',
    }),
    worldCandidate({
      id: secondWorldCandidateId,
      category: 'IMPORTANT_ITEM',
      subjectName: '포션',
      targetSubjectName: '포션',
      settingName: '사용 통증',
      extractedValue: '사용 시 찔렸을 때보다 더 아픈 통증을 유발한다.',
      evidenceSpans: [{ quote: '어찌 된 게 찔렸을 때보다 더 아프다.', startOffset: 3086, endOffset: 3107 }],
      suggestedOperation: 'EXCLUDE',
      proposedSettingName: '사용 통증',
      beforeValue: '사용하면 축적된 통증이 한꺼번에 느껴질 정도의 극심한 고통을 동반한다.',
      proposedValue: '사용 시 찔렸을 때보다 더 아픈 통증을 유발한다.',
      comparisonReason: '기존 사용 시 고통과 같은 내용이라 중복 반영하지 않습니다.',
    }),
  ];
  let confirmedBody: Record<string, unknown> | null = null;
  const worldListPath = `/api/v1/works/${workId}/world-setting-candidates`;
  const characterListPath = `/api/v1/works/${workId}/setting-candidates`;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/auth/me')) return success(route, member);
    if (pathname === worldListPath && request.method() === 'GET') {
      return success(route, {
        batchId,
        episodeStartNo: 8,
        episodeEndNo: 8,
        episodeCount: 1,
        totalCandidateCount: 2,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 2,
        pendingComparisonCount: 0,
        processingComparisonCount: 0,
        failedComparisonCount: 0,
        recomparisonRequiredCount: 0,
        groups: pageResponse([worldCandidateGroup(candidates)]),
      });
    }
    if (pathname === `${worldListPath}/group-confirm` && request.method() === 'POST') {
      confirmedBody = request.postDataJSON() as Record<string, unknown>;
      return success(route, {
        groupKey: 'IMPORTANT_ITEM|포션',
        worldSettingId: null,
        appliedWorldSettingVersion: null,
        candidates: candidates.map(candidate => ({
          ...candidate,
          reviewStatus: 'DISMISSED',
          finalOperation: 'EXCLUDE',
        })),
      });
    }
    if (pathname === characterListPath && request.method() === 'GET') {
      return success(route, {
        batchId,
        totalCandidateCount: 0,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 0,
        matchRequiredCandidateCount: 0,
        candidates: pageResponse([]),
      });
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  await expect(page.getByText('중요 아이템 · 포션')).toBeVisible();
  await expect(page.getByText('피가 부글부글 끓더니 빠르게 재생된다.')).toBeVisible();
  await expect(page.getByText('사용하면 신체를 빠르게 재생시킨다.', { exact: true })).toBeVisible();
  await expect(page.getByText('사용하면 축적된 통증이 한꺼번에 느껴질 정도의 극심한 고통을 동반한다.', { exact: true })).toBeVisible();
  await expect(page.getByText('비교한 기존값', { exact: true })).toHaveCount(2);
  await expect(page.getByText('− 기존값', { exact: true })).toHaveCount(0);
  await expect(page.getByText("기존 '포션' 설정의 기존 회복 효과와 의미가 겹쳐 별도 설정 항목으로 추가하지 않는 편이 좋습니다.")).toBeVisible();
  await expect(page.getByText('추출된 값', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('article').getByText('반영하지 않음', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '선택 항목 제외', exact: true })).toHaveCount(0);

  await page.getByRole('article').getByRole('button', { name: '수정', exact: true }).first().click();
  const operationSelect = page.getByRole('combobox', { name: '반영 방식', exact: true });
  await expect(operationSelect).toHaveValue('EXCLUDE');
  await expect(operationSelect.locator('option')).toHaveText([
    '추가',
    '수정',
    '병합',
    '반영하지 않음',
  ]);
  await page.getByRole('button', { name: '취소', exact: true }).click();

  const confirmButton = page.getByRole('button', { name: '모두 확정', exact: true });
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();
  await expect.poll(() => confirmedBody).toEqual({
    batchId,
    candidates: [
      {
        candidateId: worldCandidateId,
        operation: 'EXCLUDE',
        category: 'IMPORTANT_ITEM',
        subjectName: '포션',
        settingName: '상처 치료 효과',
        value: '상처 부위에 사용하면 피가 끓으며 빠르게 재생된다.',
      },
      {
        candidateId: secondWorldCandidateId,
        operation: 'EXCLUDE',
        category: 'IMPORTANT_ITEM',
        subjectName: '포션',
        settingName: '사용 통증',
        value: '사용 시 찔렸을 때보다 더 아픈 통증을 유발한다.',
      },
    ],
  });
  await expect(page.getByText('포션 설정 2개를 검토 결과 제외했습니다.')).toBeVisible();
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
  let pendingListReads = 0;

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
      if (candidate.comparisonStatus === 'PENDING') {
        pendingListReads += 1;
        if (pendingListReads >= 2) candidate = worldCandidate();
      }
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
        groups: pageResponse([worldCandidateGroup([candidate])]),
      });
    }
    if (pathname === `${worldListPath}/group-confirm`) {
      confirmAttempts += 1;
      candidate = {
        ...candidate,
        comparisonStatus: 'RECOMPARISON_REQUIRED',
        comparisonErrorMessage: '서식지의 확정값이 바뀌었습니다.',
      };
      return failure(
        route,
        409,
        '확정본이 바뀌어 다시 비교해야 합니다.',
        'WORLD_SETTING_CANDIDATE_RECOMPARISON_REQUIRED',
        {
          scope: 'ROW',
          reason: 'PROPERTY_CHANGED',
          reasonMessage: '서식지의 확정값이 바뀌었습니다.',
          affectedCandidateIds: [worldCandidateId],
        },
      );
    }
    if (pathname === `${worldListPath}/${worldCandidateId}/recompare`) {
      retryAttempts += 1;
      pendingListReads = 0;
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
  await page.getByRole('button', { name: '모두 확정', exact: true }).click();

  await expect.poll(() => confirmAttempts).toBe(1);
  await expect.poll(() => retryAttempts).toBe(1);
  await expect(page.getByRole('article').getByText(/비교 대기/).first()).toBeVisible();
  await page.waitForTimeout(250);
  expect(retryAttempts).toBe(1);

  const confirmButton = page.getByRole('button', { name: '모두 확정', exact: true });
  await expect(confirmButton).toBeEnabled({ timeout: 7_000 });
  await expect(page.getByText('재비교됨', { exact: true })).toBeVisible();
  await confirmButton.click();
  await expect.poll(() => confirmAttempts).toBe(2);
  await expect.poll(() => retryAttempts).toBe(2);
});

test('Job이 없는 비교 대기 후보를 자동 복구하고 대기 아이콘을 회전시킨다', async ({ page }) => {
  const pendingCandidate = worldCandidate({
    subjectName: '미궁 2층',
    settingName: '출현 몬스터 유형',
    comparisonStatus: 'PENDING',
    suggestedOperation: undefined,
    proposedSettingName: null,
    proposedValue: null,
  });
  let retryAttempts = 0;
  const worldListPath = `/api/v1/works/${workId}/world-setting-candidates`;

  await page.route('**/api/v1/**', route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
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
        pendingComparisonCount: 1,
        processingComparisonCount: 0,
        failedComparisonCount: 0,
        recomparisonRequiredCount: 0,
        groups: pageResponse([worldCandidateGroup([pendingCandidate])]),
      });
    }
    if (pathname === `${worldListPath}/${worldCandidateId}/recompare`) {
      retryAttempts += 1;
      return success(route, pendingCandidate);
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  await expect.poll(() => retryAttempts).toBe(1);
  const spinner = page.getByRole('article').locator('svg.spin');
  await expect(spinner).toBeVisible();
  await expect.poll(() => spinner.evaluate(element => getComputedStyle(element).animationName))
    .toBe('catchhole-spin');
  await page.waitForTimeout(250);
  expect(retryAttempts).toBe(1);
});

test('대상 전체 충돌은 GROUP 재비교 상태로 잠그고 영향 row를 각각 자동 재비교한다', async ({ page }) => {
  let candidates = [
    worldCandidate({
      comparisonStatus: 'RECOMPARISON_REQUIRED',
      comparisonErrorMessage: '동일 대상이 먼저 생성되어 대상 전체를 다시 비교해야 합니다.',
    }),
    worldCandidate({
      id: secondWorldCandidateId,
      sourceEpisodeNo: 5,
      settingName: '특징',
      extractedValue: '강인한 신체를 가졌다.',
      evidenceSpans: [{ quote: '그들은 강인한 신체로 혹한과 전투를 버텼다.' }],
      proposedSettingName: '특징',
      proposedValue: '강인한 신체를 가진 전투 종족',
      comparisonStatus: 'RECOMPARISON_REQUIRED',
      comparisonErrorMessage: '동일 대상이 먼저 생성되어 대상 전체를 다시 비교해야 합니다.',
    }),
  ];
  const retriedCandidateIds: string[] = [];

  await page.route('**/api/v1/**', async route => {
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
      const recomparisonRequiredCount = candidates.filter(candidate => (
        candidate.comparisonStatus === 'RECOMPARISON_REQUIRED'
      )).length;
      return success(route, {
        batchId,
        episodeStartNo: 3,
        episodeEndNo: 5,
        episodeCount: 2,
        totalCandidateCount: 2,
        reviewedCandidateCount: 0,
        pendingCandidateCount: 2,
        pendingComparisonCount: candidates.filter(candidate => candidate.comparisonStatus === 'PENDING').length,
        processingComparisonCount: 0,
        failedComparisonCount: 0,
        recomparisonRequiredCount,
        groups: pageResponse([{
          ...worldCandidateGroup(candidates),
          recomparisonScope: recomparisonRequiredCount ? 'GROUP' : null,
        }]),
      });
    }
    if (pathname.endsWith('/recompare')) {
      const candidateId = pathname.split('/').at(-2)!;
      retriedCandidateIds.push(candidateId);
      await new Promise(resolve => setTimeout(resolve, 200));
      candidates = candidates.map(candidate => candidate.id === candidateId
        ? { ...candidate, comparisonStatus: 'PENDING', comparisonErrorMessage: null }
        : candidate);
      return success(route, candidates.find(candidate => candidate.id === candidateId));
    }
    return success(route, []);
  });

  await authenticate(page);
  await page.goto(`/setting-review?workId=${workId}&batchId=${batchId}&candidateType=world`);

  await expect(page.getByText('그룹 재비교 필요', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '모두 확정', exact: true })).toBeDisabled();
  await expect.poll(() => retriedCandidateIds).toEqual([worldCandidateId, secondWorldCandidateId]);
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
    properties: [{ scopeName: null, settingName: '서식지', value: '북부 설원' }],
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
      return success(route, {
        ...settingRow,
        properties: [{ scopeName: null, settingName: '서식지', value: '북부 설원' }],
        propertyEvidences: {},
      });
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
  let settingScopeName: string | null = null;
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
      ? [{ scopeName: settingScopeName, settingName: '서식지', value: settingValue }]
      : [
          { scopeName: null, settingName: '서식지', value: '혹한 지역' },
          { scopeName: null, settingName: '특징', value: '전투에 특화된 종족' },
        ],
    propertyCount: id === createdWorldSettingId ? 1 : 2,
    version: detailVersion,
    propertyEvidence: id === createdWorldSettingId ? [] : [{
      scopeName: null,
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
      settingScopeName = body.scopeName || null;
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
      settingScopeName = typeof propertyRequestBody.scopeName === 'string'
        ? propertyRequestBody.scopeName
        : null;
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
  await expect(page.getByRole('heading', { name: '공통 설정', exact: true })).toHaveCSS('font-size', '13px');
  await expect(page.getByText('전체 대상', { exact: true })).toBeVisible();
  await expect(page.getByText('바바리안은 혹한 지역에서 살아간다.')).toHaveCount(0);
  await page.getByText('3화', { exact: true }).click();
  await expect(page.getByText('바바리안은 혹한 지역에서 살아간다.')).toHaveCount(1);
  await expect(page.getByText('그들은 오래전부터 설원 지대에 정착했다.')).toBeVisible();

  await page.getByRole('button', { name: '분류: 종족' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('category')).toBe('RACE');
  await expect(page.getByRole('button', { name: '분류: 종족' })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: '분류: 전체' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('category')).toBeNull();

  await page.getByPlaceholder('대상 · 설정명 · 설정값 검색').fill('사회 구조');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('사회 구조');
  await expect.poll(() => latestListQuery?.searchParams.get('q') ?? null).toBe('사회 구조');

  await page.getByRole('button', { name: '새 대상 추가', exact: true }).click();
  const createForm = page.getByText('새 세계관 대상 추가', { exact: true }).locator('..').locator('..').locator('..');
  await page.getByLabel('대상명').fill('북부 설원 부족');
  await page.getByLabel('범위 (선택)').fill('1층');
  await page.getByLabel('설정명').fill('서식지');
  await page.getByLabel('설정값').fill('북부 설원');
  await page.goBack();
  await expect(page.getByText('새 세계관 대상 추가', { exact: true })).toHaveCount(0);
  await page.goForward();
  await expect(page.getByLabel('대상명')).toHaveValue('북부 설원 부족');
  await expect(page.getByLabel('범위 (선택)')).toHaveValue('1층');
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
  await expect(page.getByRole('heading', { name: '1층', exact: true })).toHaveCSS('font-size', '13px');
  await expect(page.getByText('설정 범위', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '1층 서식지 설정 수정' }).click();
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
    currentScopeName: '1층',
    currentSettingName: '서식지',
    scopeName: '1층',
    settingName: '서식지',
    settingValue: '북부 설원의 혹한 지역',
    version: 2,
  });
  await expect(page.getByText('북부 설원의 혹한 지역', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '1층 서식지 설정 수정' }).click();
  await detailPanel.getByLabel('설정명').fill('중복 설정');
  await detailPanel.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('같은 대상에 동일한 설정명이 이미 존재합니다.')).toBeVisible();
  await expect(detailPanel.getByRole('button', { name: '최신값 다시 불러오기' })).toHaveCount(0);
  await expect(detailPanel.getByLabel('설정명')).toHaveValue('중복 설정');
  await detailPanel.getByRole('button', { name: '취소', exact: true }).click();
  const discardDialog = page.getByRole('alertdialog');
  await expect(discardDialog).toBeVisible();
  await discardDialog.getByRole('button', { name: '계속 작성' }).click();
  await expect(detailPanel.getByLabel('설정명')).toHaveValue('중복 설정');
  await detailPanel.getByRole('button', { name: '취소', exact: true }).click();
  await discardDialog.getByRole('button', { name: '작성 취소' }).click();
  await expect(detailPanel.getByLabel('설정명')).toHaveCount(0);

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
