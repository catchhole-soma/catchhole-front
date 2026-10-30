import { expect, test, type Page, type Route } from '@playwright/test';

// 세계관 대상·설정은 모두 합성 데이터다. 체크한 행을 한 대상에 연결하는 요청과 화면만 확인한다.
const workId = '71111111-1111-4111-8111-111111111111';
const batchId = '72222222-2222-4222-8222-222222222222';
const workPath = `/api/v1/works/${workId}`;
const decisionsPath = `${workPath}/world-setting-candidates/decisions`;
const harbor = { id: '73333333-3333-4333-8333-333333333333', subjectName: '은빛 항구', category: 'LOCATION',
  properties: [{ scopeName: null, settingName: '기후', value: '온화한 바닷바람' }, { scopeName: '부두', settingName: '규모', value: '배 열 척' }] };
const fortress = { id: '74444444-4444-4444-8444-444444444444', subjectName: '잿빛 요새', category: 'LOCATION', properties: [] };

type Row = Record<string, unknown> & { id: string; reviewStatus: string; category: string; subjectName: string };
const normalize = (value?: unknown) => String(value ?? '').trim().normalize('NFC').toLocaleLowerCase('ko-KR');
const groupKeyOf = (row: Row) => `${row.finalCategory ?? row.category}|${normalize(row.finalSubjectName ?? row.targetSubjectName ?? row.subjectName)}`;

function worldRow(id: string, settingName: string, value: string, episode: number, extra: Record<string, unknown> = {}): Row {
  return {
    id, workId, sourceEpisodeNo: episode, category: 'LOCATION', subjectName: '항구', targetSubjectName: null, targetWorldSettingId: null,
    scopeName: null, settingName, extractedValue: value, proposedValue: value, beforeValue: null, matchedScopeName: null,
    matchedPropertyName: null, comparisonStatus: 'COMPLETED', suggestedOperation: 'REVIEW_REQUIRED', comparisonReviewReason: 'SUBJECT_UNRESOLVED',
    consolidationStatus: 'SINGLE', reviewStatus: 'PENDING_REVIEW', manualReviewAvailable: false, userModified: false,
    analysisMode: 'CONFIRMED_ONLY', evidenceSpans: [{ quote: `합성 원문: ${value}` }], updatedAt: '2026-10-30T01:00:00',
    ...extra,
  };
}

function rows(): Row[] {
  const shared = { comparisonDecisionId: 'decision-route', consolidationStatus: 'MERGED', proposedValue: '북쪽 항로\n동쪽 항로' };
  return [
    worldRow('w1', '기후', '안개가 잦다', 1),
    worldRow('w2', '인구', '약 3천 명', 1),
    worldRow('w3', '특산물', '은빛 생선', 2),
    worldRow('w4', '항로', '북쪽 항로', 2, shared),
    worldRow('w5', '항로', '동쪽 항로', 3, shared),
  ];
}

async function routeWorldMock(page: Page) {
  const candidates = rows();
  const state = { writes: [] as Array<{ path: string; body: Record<string, unknown> }>, searches: [] as URL[] };
  const ok = (route: Route, data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  const counts = () => {
    const pending = candidates.filter(row => row.reviewStatus === 'PENDING_REVIEW').length;
    return { batchId, episodeStartNo: 1, episodeEndNo: 3, episodeCount: 3, totalCandidateCount: candidates.length, pendingCandidateCount: pending,
      pendingComparisonCount: 0, processingComparisonCount: 0, activeComparisonJobCount: 0, failedComparisonCount: 0,
      tokenInterruptedComparisonCount: 0, canResumeTokenInterruptedComparisons: false, recomparisonRequiredCount: 0,
      confirmedCandidateCount: candidates.length - pending, dismissedCandidateCount: 0, directReviewCandidateCount: pending, processingCandidateCount: 0 };
  };
  const pageOf = (content: unknown[], page = 0, size = 20) => ({ content: content.slice(page * size, page * size + size), page, size,
    totalElements: content.length, totalPages: Math.max(1, Math.ceil(content.length / size)), hasNext: (page + 1) * size < content.length });
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (path.endsWith('/auth/me')) return ok(route, { id: 1, email: 'world-link@example.invalid', displayName: '테스트', role: 'AUTHOR', status: 'ACTIVE' });
    if (path === `${workPath}/world-setting-candidates/summary`) return ok(route, counts());
    if (path === `${workPath}/world-setting-candidates` && method === 'GET') {
      const operation = url.searchParams.get('operation');
      const visible = candidates.filter(row => row.reviewStatus === 'PENDING_REVIEW' && (!operation || row.suggestedOperation === operation));
      const grouped = new Map<string, Row[]>();
      visible.forEach(row => grouped.set(groupKeyOf(row), [...(grouped.get(groupKeyOf(row)) ?? []), row]));
      const groups = [...grouped.entries()].map(([groupKey, groupRows]) => ({
        groupKey, category: groupRows[0].finalCategory ?? groupRows[0].category,
        subjectName: groupRows[0].finalSubjectName ?? groupRows[0].subjectName, changeCount: groupRows.length, decisionCount: groupRows.length,
        sourceCandidateCount: groupRows.length, addCount: 0, updateCount: 0, mergeCount: 0, excludeCount: 0,
        reviewRequiredCount: groupRows.filter(row => !row.finalOperation).length, evidenceEpisodeNos: [1, 2, 3], status: 'READY', candidates: groupRows,
      }));
      return ok(route, { ...counts(), groups: pageOf(groups, Number(url.searchParams.get('page') ?? 0), Number(url.searchParams.get('size') ?? 20)) });
    }
    if (path === decisionsPath && method === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.writes.push({ path, body });
      const drafts = body.candidates as Array<Record<string, unknown>>;
      const saved = drafts.map(draft => {
        const row = candidates.find(item => item.id === draft.candidateId)!;
        Object.assign(row, { finalOperation: draft.operation, finalCategory: draft.category, finalSubjectName: draft.subjectName,
          finalScopeName: draft.scopeName ?? null, finalSettingName: draft.settingName, finalValue: draft.value, userModified: true });
        return row;
      });
      return ok(route, { groupKey: groupKeyOf(saved[0]), candidates: saved });
    }
    const candidateDetail = path.match(new RegExp(`^${workPath}/world-setting-candidates/([^/]+)$`));
    if (candidateDetail && method === 'GET') return ok(route, candidates.find(row => row.id === candidateDetail[1]));
    if (path === `${workPath}/world-settings` && method === 'GET') {
      state.searches.push(url);
      const q = normalize(url.searchParams.get('q'));
      const category = url.searchParams.get('category');
      const list = [harbor, fortress].filter(item => (!category || item.category === category) && (!q || normalize(item.subjectName).includes(q)))
        .map(item => ({ id: item.id, workId, category: item.category, subjectName: item.subjectName, propertyCount: item.properties.length }));
      return ok(route, { totalWorldSettingCount: 2, worldSettings: pageOf(list, Number(url.searchParams.get('page') ?? 0), Number(url.searchParams.get('size') ?? 6)) });
    }
    const settingDetail = path.match(new RegExp(`^${workPath}/world-settings/([^/]+)$`));
    if (settingDetail && method === 'GET') {
      const item = [harbor, fortress].find(target => target.id === settingDetail[1])!;
      return ok(route, { ...item, workId, propertyCount: item.properties.length, version: 1 });
    }
    if (path === `${workPath}/setting-candidates`) return ok(route, { batchId, totalCandidateCount: 0, pendingCandidateCount: 0,
      directReviewCandidateCount: 0, confirmedCandidateCount: 0, dismissedCandidateCount: 0, processingCandidateCount: 0, groups: pageOf([]) });
    return ok(route, {});
  });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'world-selection-target-test'));
  return { candidates, state };
}

const groupUrl = (params: Record<string, string> = {}) => `/setting-review?${new URLSearchParams({
  workId, batchId, candidateType: 'world', group: 'LOCATION|항구', ...params })}`;

async function openTargetLink(page: Page) {
  await page.getByRole('region', { name: '선택한 설정' }).getByRole('button', { name: '선택 항목 대상 연결', exact: true }).click();
  return page.getByRole('dialog', { name: '선택 항목 대상 연결' });
}

test('체크한 행 중 대상에 같은 경로가 없는 행만 추가로 저장하고 같은 경로가 있는 행은 결정으로 남긴다', async ({ page }) => {
  const { state } = await routeWorldMock(page);
  await page.goto(groupUrl());
  await page.getByRole('checkbox', { name: '선택: 기후' }).check();
  await page.getByRole('checkbox', { name: '선택: 인구' }).check();
  await page.getByRole('checkbox', { name: '선택: 특산물' }).check();
  await expect(page.getByRole('region', { name: '선택한 설정' })).toContainText('3개 선택');
  const dialog = await openTargetLink(page);
  await dialog.getByLabel('연결할 세계관 대상 검색').fill('은빛');
  await expect.poll(() => state.searches.some(url => url.searchParams.get('q') === '은빛')).toBe(true);
  await dialog.getByRole('button', { name: /^은빛 항구/ }).click();
  const outcome = dialog.getByRole('region', { name: '체크한 설정의 저장 방법' });
  await expect(outcome).toContainText('기후기존값 있음 → 병합/교체 결정 필요');
  await expect(outcome).toContainText('인구기존값 없음 → 추가로 저장');
  await expect(outcome).toContainText('특산물기존값 없음 → 추가로 저장');
  await expect(dialog.getByRole('region', { name: '대상에 저장된 현재 설정' })).toContainText('부두 › 규모배 열 척');
  await dialog.getByRole('button', { name: '고른 대상에 연결', exact: true }).click();

  await expect(dialog).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toEqual({ batchId, candidates: [
    { candidateId: 'w2', operation: 'ADD', category: 'LOCATION', subjectName: '은빛 항구', scopeName: null, settingName: '인구', value: '약 3천 명' },
    { candidateId: 'w3', operation: 'ADD', category: 'LOCATION', subjectName: '은빛 항구', scopeName: null, settingName: '특산물', value: '은빛 생선' },
  ] });
  const notice = page.getByRole('status').filter({ hasText: '2개 저장(추가) · 1개는 내용 결정이 남았어요' });
  await expect(notice).toBeVisible();
  // 선택 연결은 읽던 묶음을 유지한다.
  expect(new URL(page.url()).searchParams.get('group')).toBe('LOCATION|항구');
  const climate = page.locator('[data-candidate-id="w1"]');
  await expect(climate).toContainText('대상은 골랐어요. 기존값과 어떻게 합칠지 정해 주세요.');
  await expect(climate.getByRole('group', { name: '이 대상에 같은 설정이 있어요. 어떻게 반영할까요?' })).toBeVisible();
  await expect(page.locator('[data-candidate-id="w2"]')).toHaveCount(0);
  await notice.getByRole('button', { name: '첫 항목으로', exact: true }).click();
  await expect(climate).toBeFocused();
  // 같은 경로가 있는 행은 작가가 고르고 검토 완료를 누른 뒤에만 저장한다.
  await climate.getByRole('button', { name: /이번 내용으로 바꾸기/ }).click();
  expect(state.writes).toHaveLength(1);
  await climate.getByRole('button', { name: '이 내용으로 검토 완료', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect((state.writes[1].body.candidates as unknown[])).toEqual([
    { candidateId: 'w1', operation: 'UPDATE', category: 'LOCATION', subjectName: '은빛 항구', scopeName: null, settingName: '기후', value: '안개가 잦다' },
  ]);
});

test('공유 결정의 원문은 함께 체크되고 새 대상 이름으로 모두 추가 저장한다', async ({ page }) => {
  const { state } = await routeWorldMock(page);
  await page.goto(groupUrl());
  const routes = page.getByRole('checkbox', { name: '선택: 항로' });
  await expect(routes).toHaveCount(2);
  await routes.first().check();
  await expect(routes.nth(1)).toBeChecked();
  await page.getByRole('checkbox', { name: '선택: 인구' }).check();
  await expect(page.getByRole('region', { name: '선택한 설정' })).toContainText('3개 선택');
  const dialog = await openTargetLink(page);
  await dialog.getByRole('button', { name: /^새 대상으로 등록/ }).click();
  await dialog.getByLabel('새 대상 이름').fill('안개 항구');
  await expect(dialog.getByRole('region', { name: '체크한 설정의 저장 방법' })).toContainText('항로새 대상 → 추가로 저장');
  await dialog.getByRole('button', { name: '고른 대상에 연결', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const drafts = state.writes[0].body.candidates as Array<Record<string, unknown>>;
  expect(drafts.map(draft => draft.candidateId)).toEqual(['w2', 'w4', 'w5']);
  expect(drafts.every(draft => draft.operation === 'ADD' && draft.category === 'LOCATION' && draft.subjectName === '안개 항구')).toBe(true);
  expect(drafts.find(draft => draft.candidateId === 'w5')?.value).toBe('북쪽 항로\n동쪽 항로');
  await expect(page.getByRole('status').filter({ hasText: '3개 저장(추가)' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('group')).toBe('LOCATION|항구');
});

test('필터로 같은 결정의 원문이 숨을 수 있으면 공유 결정 행은 체크할 수 없다', async ({ page }) => {
  await routeWorldMock(page);
  await page.goto(groupUrl({ operation: 'REVIEW_REQUIRED' }));
  const route = page.getByRole('checkbox', { name: '선택: 항로' }).first();
  await expect(route).toBeDisabled();
  await expect(page.getByTitle('같은 결정의 다른 원문이 필터로 숨어 있어요.')).toHaveCount(2);
  await page.getByRole('checkbox', { name: '선택: 인구' }).check();
  await expect(page.getByRole('region', { name: '선택한 설정' })).toContainText('필터로 숨은 설정은 포함되지 않아요.');
});

test('결정이 없는 설정이 있으면 분류·대상 일괄 수정 대신 선택 연결을 안내한다', async ({ page }) => {
  await routeWorldMock(page);
  await page.goto(groupUrl());
  const identity = page.getByRole('button', { name: /분류·대상 일괄 수정/ });
  await expect(identity).toBeDisabled();
  await expect(page.getByText('결정이 없는 설정이 있어요 — 설정을 체크한 뒤 ‘선택 항목 대상 연결’을 사용하세요.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '모두 선택(5)' })).toBeVisible();
});
