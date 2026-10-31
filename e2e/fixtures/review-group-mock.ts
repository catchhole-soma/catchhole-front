import type { Page, Route } from '@playwright/test';

/*
 * #211 후속 3차(확정 영역·확정하고 다음·요약 카드·키보드) e2e용 목 API. 인물·대상·설정값은 모두 합성 데이터다.
 * 캐릭터 후보는 연결된 인물 ID(없으면 정규화한 이름)로, 세계관 후보는 `분류|대상`으로 묶는다.
 */
const workId = '81111111-1111-4111-8111-111111111111';
const batchId = '82222222-2222-4222-8222-222222222222';
const workPath = `/api/v1/works/${workId}`;
export const characterListPath = `${workPath}/setting-candidates`;
export const worldListPath = `${workPath}/world-setting-candidates`;

const characters = [
  { id: '83333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: '아린' },
  { id: '83333333-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: '도윤' },
  { id: '83333333-cccc-4ccc-8ccc-cccccccccccc', name: '세라' },
];
export const characterGroupKey = (index: number) => `existing:${characters[index].id}`;

export type MockCandidate = Record<string, unknown> & { id: string; reviewStatus: string };
type Write = { method: string; path: string; body: Record<string, unknown> | null };

const ok = (route: Route, data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, error: null }) });
const normalize = (value?: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').normalize('NFC').toLocaleLowerCase('ko-KR');
const pageOf = (content: unknown[], page: number, size: number) => ({
  content: content.slice(page * size, page * size + size), page, size, totalElements: content.length,
  totalPages: Math.max(1, Math.ceil(content.length / size)), hasNext: (page + 1) * size < content.length,
});

/** 비교가 끝나 직접 선택을 저장한 캐릭터 후보. `overrides`로 상태를 바꾼다. */
export function characterCandidate(id: string, owner: number | null, setting: string, overrides: Record<string, unknown> = {}): MockCandidate {
  const character = owner == null ? null : characters[owner];
  return {
    id, workId, episodeNo: 7, entityName: character?.name ?? '미상', rawEntityMention: character?.name ?? '그 사람',
    candidateKind: 'SETTING', entityType: 'CHARACTER', matchedCharacterId: character?.id ?? null,
    matchStatus: character ? 'MATCHED' : 'AMBIGUOUS', attributeName: `status.${id}`, attributeDisplayName: setting,
    attributeValue: `${setting}에 관한 합성 설정값입니다.`, valueType: 'STRING', reviewStatus: 'PENDING_REVIEW',
    comparisonStatus: 'COMPLETED', suggestedOperation: 'REVIEW_REQUIRED', manualReviewAvailable: true,
    analysisMode: 'ORDERED_PROVISIONAL', reviewedApplicationMode: 'APPLY_PROPOSAL', updatedAt: '2026-10-31T01:00:00Z',
    evidenceSpans: [{ quote: `합성 원문: ${setting}` }], ...overrides,
  };
}

const characterGroupKeyOf = (candidate: MockCandidate) => candidate.matchedCharacterId
  ? `existing:${candidate.matchedCharacterId}` : normalize(candidate.entityName);

export async function routeCharacterReview(page: Page, candidates: MockCandidate[], options: { worldPending?: number; groupPageSize?: number } = {}) {
  const writes: Write[] = [];
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body = method === 'GET' ? null : request.postDataJSON() as Record<string, unknown> | null;
    if (method !== 'GET') writes.push({ method, path, body });
    if (path.endsWith('/auth/me')) return ok(route, { id: 1, email: 'review-group@example.invalid', displayName: '확정 확인', role: 'AUTHOR', status: 'ACTIVE' });
    if (path === `${workPath}/characters`) {
      const list = characters.map((character, index) => ({ ...character, firstAppearanceEpisodeNo: index + 1 }));
      return ok(route, pageOf(list, Number(url.searchParams.get('page') ?? 0), Number(url.searchParams.get('size') ?? 8)));
    }
    if (method === 'POST' && path === `${characterListPath}/group-confirm`) {
      const ids = new Set((body?.candidates as Array<{ candidateId: string }>).map(item => item.candidateId));
      // 서버처럼 제외 제안(EXCLUDE)은 확정 대신 제외한다.
      candidates.forEach(item => { if (ids.has(item.id)) item.reviewStatus = item.suggestedOperation === 'EXCLUDE' ? 'DISMISSED' : 'CONFIRMED'; });
      return ok(route, { candidates: candidates.filter(item => ids.has(item.id)) });
    }
    const candidateMatch = path.match(new RegExp(`^${characterListPath}/([^/]+)(/character-match|/dismiss)?$`));
    if (candidateMatch) {
      const target = candidates.find(item => item.id === candidateMatch[1]);
      if (!target) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"success":false}' });
      if (candidateMatch[2] === '/character-match') {
        const character = characters.find(item => item.id === body?.matchedCharacterId);
        Object.assign(target, { matchedCharacterId: character?.id ?? null, entityName: character?.name ?? body?.entityName,
          matchStatus: character ? 'MATCHED' : 'UNRESOLVED', comparisonStatus: 'COMPLETED', suggestedOperation: 'ADD', manualReviewAvailable: false });
      } else if (candidateMatch[2] === '/dismiss') {
        target.reviewStatus = 'DISMISSED';
      } else if (method === 'PATCH') {
        Object.assign(target, { attributeValue: body?.attributeValue, reviewedApplicationMode: body?.reviewedApplicationMode ?? target.reviewedApplicationMode,
          updatedAt: '2026-10-31T02:00:00Z' });
      }
      return ok(route, target);
    }
    if (method === 'GET' && path === characterListPath) {
      const reviewStatus = url.searchParams.get('reviewStatus');
      const visible = candidates.filter(item => !reviewStatus || item.reviewStatus === reviewStatus);
      const grouped = new Map<string, MockCandidate[]>();
      visible.forEach(item => grouped.set(characterGroupKeyOf(item), [...(grouped.get(characterGroupKeyOf(item)) ?? []), item]));
      const groups = [...grouped.entries()].map(([groupKey, rows]) => ({ groupKey, entityName: rows[0].entityName,
        candidateCount: rows.length, pendingCandidateCount: rows.filter(item => item.reviewStatus === 'PENDING_REVIEW').length,
        evidenceEpisodeNos: [7], candidates: rows }));
      const pending = candidates.filter(item => item.reviewStatus === 'PENDING_REVIEW').length;
      return ok(route, { batchId, episodeStartNo: 7, episodeEndNo: 7, episodeCount: 1, totalCandidateCount: candidates.length,
        pendingCandidateCount: pending, directReviewCandidateCount: pending, processingCandidateCount: 0,
        confirmedCandidateCount: candidates.filter(item => item.reviewStatus === 'CONFIRMED').length,
        dismissedCandidateCount: candidates.filter(item => item.reviewStatus === 'DISMISSED').length,
        groups: pageOf(groups, Number(url.searchParams.get('page') ?? 0), options.groupPageSize ?? Number(url.searchParams.get('size') ?? 20)) });
    }
    if (/\/world-setting-candidates(?:\/summary)?$/.test(path)) {
      const pending = options.worldPending ?? 0;
      return ok(route, { batchId, totalCandidateCount: pending, pendingCandidateCount: pending, directReviewCandidateCount: pending,
        confirmedCandidateCount: 0, dismissedCandidateCount: 0, processingCandidateCount: 0, groups: pageOf([], 0, 20) });
    }
    if (path === `${workPath}/world-settings`) return ok(route, { worldSettings: pageOf([], 0, 6) });
    return ok(route, {});
  });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'review-group-test'));
  return { writes };
}

export const characterReviewUrl = (group: string, params: Record<string, string> = {}) =>
  `/setting-review?${new URLSearchParams({ workId, batchId, group, ...params })}`;

/** 결정이 저장된 세계관 후보(ADD). `overrides`로 결정 없음·충돌 등을 만든다. */
export function worldCandidate(id: string, subjectName: string, settingName: string, overrides: Record<string, unknown> = {}): MockCandidate {
  const value = `${settingName}에 관한 합성 내용`;
  return {
    id, workId, sourceEpisodeNo: 3, category: 'LOCATION', subjectName, targetSubjectName: subjectName, targetWorldSettingId: null,
    scopeName: null, settingName, extractedValue: value, proposedValue: value, beforeValue: null, matchedScopeName: null,
    matchedPropertyName: null, comparisonStatus: 'COMPLETED', suggestedOperation: 'ADD', consolidationStatus: 'SINGLE',
    reviewStatus: 'PENDING_REVIEW', manualReviewAvailable: false, userModified: false, analysisMode: 'CONFIRMED_ONLY',
    evidenceSpans: [{ quote: `합성 원문: ${value}` }], updatedAt: '2026-10-31T01:00:00Z', ...overrides,
  };
}

const worldGroupKeyOf = (row: MockCandidate) => `${row.finalCategory ?? row.category}|${normalize(row.finalSubjectName ?? row.targetSubjectName ?? row.subjectName)}`;

export interface MockWorldTarget { id: string; category: string; subjectName: string; properties: Array<{ scopeName: string | null; settingName: string; value: string }> }

export async function routeWorldReview(page: Page, candidates: MockCandidate[], options: { characterPending?: number; targets?: MockWorldTarget[] } = {}) {
  const writes: Write[] = [];
  const counts = () => {
    const pending = candidates.filter(row => row.reviewStatus === 'PENDING_REVIEW').length;
    return { batchId, episodeStartNo: 3, episodeEndNo: 3, episodeCount: 1, totalCandidateCount: candidates.length, pendingCandidateCount: pending,
      pendingComparisonCount: 0, processingComparisonCount: 0, activeComparisonJobCount: 0, failedComparisonCount: 0,
      tokenInterruptedComparisonCount: 0, canResumeTokenInterruptedComparisons: false, recomparisonRequiredCount: 0,
      confirmedCandidateCount: candidates.length - pending, dismissedCandidateCount: 0, directReviewCandidateCount: pending, processingCandidateCount: 0 };
  };
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body = method === 'GET' ? null : request.postDataJSON() as Record<string, unknown> | null;
    if (method !== 'GET') writes.push({ method, path, body });
    if (path.endsWith('/auth/me')) return ok(route, { id: 1, email: 'review-group@example.invalid', displayName: '확정 확인', role: 'AUTHOR', status: 'ACTIVE' });
    if (path === `${worldListPath}/summary`) return ok(route, counts());
    if (path === worldListPath && method === 'GET') {
      const reviewStatus = url.searchParams.get('reviewStatus');
      const visible = candidates.filter(row => !reviewStatus || row.reviewStatus === reviewStatus);
      const grouped = new Map<string, MockCandidate[]>();
      visible.forEach(row => grouped.set(worldGroupKeyOf(row), [...(grouped.get(worldGroupKeyOf(row)) ?? []), row]));
      const groups = [...grouped.entries()].map(([groupKey, rows]) => ({ groupKey, category: rows[0].category,
        subjectName: rows[0].targetSubjectName ?? rows[0].subjectName, changeCount: rows.length, decisionCount: rows.length,
        sourceCandidateCount: rows.length, addCount: rows.length, updateCount: 0, mergeCount: 0, excludeCount: 0,
        reviewRequiredCount: 0, evidenceEpisodeNos: [3], status: 'READY', candidates: rows }));
      return ok(route, { ...counts(), groups: pageOf(groups, Number(url.searchParams.get('page') ?? 0), Number(url.searchParams.get('size') ?? 20)) });
    }
    if (path === `${worldListPath}/group-confirm` && method === 'POST') {
      const decisions = new Map((body?.candidates as Array<{ candidateId: string; operation?: string }>).map(item => [item.candidateId, item]));
      const ids = new Set(decisions.keys());
      // 서버처럼 EXCLUDE 결정은 제외(DISMISSED)로, 나머지는 확정으로 바꾼다.
      candidates.forEach(row => { if (ids.has(row.id)) Object.assign(row, decisions.get(row.id)?.operation === 'EXCLUDE'
        ? { reviewStatus: 'DISMISSED' } : { reviewStatus: 'CONFIRMED', finalOperation: 'ADD' }); });
      const confirmed = candidates.filter(row => ids.has(row.id));
      return ok(route, { groupKey: worldGroupKeyOf(confirmed[0]), worldSettingId: null, candidates: confirmed });
    }
    if (path === `${worldListPath}/decisions` && method === 'PATCH') {
      const saved = (body?.candidates as Array<Record<string, unknown>>).map(draft => {
        const row = candidates.find(item => item.id === draft.candidateId)!;
        Object.assign(row, { finalOperation: draft.operation, finalCategory: draft.category, finalSubjectName: draft.subjectName,
          finalScopeName: draft.scopeName ?? null, finalSettingName: draft.settingName, finalValue: draft.value, userModified: true });
        return row;
      });
      return ok(route, { groupKey: worldGroupKeyOf(saved[0]), candidates: saved });
    }
    if (path === `${worldListPath}/dismiss` || path.endsWith('/group-dismiss')) {
      const ids = new Set(body?.candidateIds as string[]);
      candidates.forEach(row => { if (ids.has(row.id)) row.reviewStatus = 'DISMISSED'; });
      return ok(route, { candidates: candidates.filter(row => ids.has(row.id)) });
    }
    const detail = path.match(new RegExp(`^${worldListPath}/([^/]+)$`));
    if (detail && method === 'GET') return ok(route, candidates.find(row => row.id === detail[1]));
    const targets = options.targets ?? [];
    if (path === `${workPath}/world-settings`) {
      const q = normalize(url.searchParams.get('q'));
      const category = url.searchParams.get('category');
      const list = targets.filter(item => (!category || item.category === category) && (!q || normalize(item.subjectName).includes(q)))
        .map(item => ({ id: item.id, workId, category: item.category, subjectName: item.subjectName, propertyCount: item.properties.length }));
      return ok(route, { totalWorldSettingCount: list.length, worldSettings: pageOf(list, Number(url.searchParams.get('page') ?? 0), Number(url.searchParams.get('size') ?? 6)) });
    }
    const target = targets.find(item => path === `${workPath}/world-settings/${item.id}`);
    if (target) return ok(route, { ...target, workId, propertyCount: target.properties.length, version: 1 });
    if (path === characterListPath) {
      const pending = options.characterPending ?? 0;
      return ok(route, { batchId, totalCandidateCount: pending, pendingCandidateCount: pending, directReviewCandidateCount: pending,
        confirmedCandidateCount: 0, dismissedCandidateCount: 0, processingCandidateCount: 0, groups: pageOf([], 0, 1) });
    }
    return ok(route, {});
  });
  await page.addInitScript(() => localStorage.setItem('accessToken', 'review-group-test'));
  return { writes };
}

export const worldReviewUrl = (group: string, params: Record<string, string> = {}) =>
  `/setting-review?${new URLSearchParams({ workId, batchId, candidateType: 'world', group, ...params })}`;
