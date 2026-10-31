import type { Page, Route } from '@playwright/test';

/**
 * #211 후속 2차(작품 전체 인물 검색·연결 미리보기·선택 연결)용 목 API.
 * 인물 이름·설정값은 모두 합성 데이터다. 후보 연결 상태는 메모리에 반영해 재조회 결과로 화면이 바뀌게 한다.
 */
const workId = '51111111-1111-4111-8111-111111111111';
export const batchId = '52222222-2222-4222-8222-222222222222';
export const listPath = `/api/v1/works/${workId}/setting-candidates`;
const charactersPath = `/api/v1/works/${workId}/characters`;

export interface MockCharacter {
  id: string;
  name: string;
  roleLabel?: string | null;
  firstAppearanceEpisodeNo?: number | null;
  representativeAttributeLabel?: string | null;
  representativeAttributeValue?: string | null;
  currentAge?: number | null;
  currentLevel?: number | null;
  profile?: Array<{ key: string; displayName: string; value: string }>;
  stats?: Array<{ key: string; displayName: string; value: string }>;
}

export type MockCandidate = Record<string, unknown> & {
  id: string;
  entityName: string;
  matchedCharacterId: string | null;
  matchStatus: string;
  reviewStatus: string;
};

export function characterId(index: number): string {
  return `6${String(index).padStart(7, '0')}-0000-4000-8000-000000000000`;
}

export function settingCandidate(id: string, overrides: Record<string, unknown> = {}): MockCandidate {
  return {
    id, workId, batchId, entityType: 'CHARACTER', candidateKind: 'SETTING',
    entityName: '미상', rawEntityMention: '그', matchedCharacterId: null, matchStatus: 'UNRESOLVED',
    attributeName: 'profile.occupation', attributeDisplayName: '직업', attributeValue: '견습 기사', valueType: 'STRING',
    episodeNo: 1, comparisonStatus: 'WAITING_FOR_CHARACTER_MATCH', suggestedOperation: 'REVIEW_REQUIRED',
    reviewStatus: 'PENDING_REVIEW', manualReviewAvailable: false, analysisMode: 'CONFIRMED_ONLY',
    updatedAt: '2026-10-30T00:00:00Z', evidenceSpans: [{ quote: '합성 원문 문장' }],
    ...overrides,
  } as MockCandidate;
}

const normalize = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export interface CharacterLinkMockOptions {
  candidates: MockCandidate[];
  characters: MockCharacter[];
  /** true를 돌려주면 인물 검색에 500을 보낸다. */
  failSearch?: (url: URL) => boolean;
  /** true를 돌려주면 인물 상세에 500을 보낸다. */
  failDetail?: (id: string) => boolean;
  /** 선택 연결 요청에 응답 대신 오류를 돌려줄 때 사용한다(한 번 쓰면 사라진다). */
  selectedMatchError?: { status: number; code: string; message: string; candidateIds: string[] } | null;
  /** 선택 연결을 서버에 반영한 뒤 응답만 끊는다(한 번). */
  loseSelectedMatchResponse?: boolean;
  groupPageSize?: number;
}

export async function routeCharacterLinkMock(page: Page, options: CharacterLinkMockOptions) {
  const state = {
    candidates: options.candidates,
    characters: options.characters,
    searchRequests: [] as URL[],
    detailRequests: [] as string[],
    writes: [] as Array<{ path: string; body: Record<string, unknown> }>,
    selectedMatchError: options.selectedMatchError ?? null,
    loseSelectedMatchResponse: options.loseSelectedMatchResponse ?? false,
  };
  const success = (route: Route, data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  const failure = (route: Route, status: number, code: string, message: string, context: Record<string, unknown> = {}) => route.fulfill({
    status, contentType: 'application/json',
    body: JSON.stringify({ success: false, message, data: null, error: { code, status, details: [], context } }),
  });
  const characterName = (id: string | null) => state.characters.find(character => character.id === id)?.name ?? '';
  const groups = () => {
    const grouped = new Map<string, MockCandidate[]>();
    state.candidates.filter(candidate => candidate.reviewStatus === 'PENDING_REVIEW').forEach(candidate => {
      const key = candidate.matchedCharacterId ? `existing:${candidate.matchedCharacterId}` : normalize(candidate.entityName);
      grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
    });
    return [...grouped.entries()]
      .sort(([first], [second]) => Number(['', '미상'].includes(first)) - Number(['', '미상'].includes(second)))
      .map(([groupKey, rows]) => ({
        groupKey, entityName: rows[0].matchedCharacterId ? characterName(rows[0].matchedCharacterId) : rows[0].entityName,
        candidateCount: rows.length, evidenceEpisodeNos: [...new Set(rows.map(row => row.episodeNo as number))], candidates: rows,
      }));
  };
  const link = (candidate: MockCandidate, body: Record<string, unknown>) => {
    if (body.resolutionType === 'MATCH_EXISTING') {
      candidate.matchedCharacterId = String(body.matchedCharacterId);
      candidate.entityName = characterName(candidate.matchedCharacterId);
      candidate.matchStatus = 'MATCHED';
    } else {
      candidate.matchedCharacterId = null;
      candidate.entityName = String(body.entityName);
      candidate.matchStatus = 'UNRESOLVED';
    }
    candidate.comparisonStatus = 'PENDING';
  };

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'link@example.com', displayName: '테스트', role: 'AUTHOR', status: 'ACTIVE' });
    if (path === charactersPath) {
      state.searchRequests.push(url);
      if (options.failSearch?.(url)) return failure(route, 500, 'INTERNAL_SERVER_ERROR', '인물 목록을 잠시 불러올 수 없습니다.');
      const keyword = url.searchParams.get('query')?.trim().toLocaleLowerCase() ?? '';
      const size = Number(url.searchParams.get('size') ?? 8);
      const pageIndex = Number(url.searchParams.get('page') ?? 0);
      const matched = keyword
        ? state.characters.filter(character => character.name.toLocaleLowerCase().includes(keyword))
          .sort((first, second) => first.name.localeCompare(second.name, 'ko'))
        : state.characters;
      const content = matched.slice(pageIndex * size, pageIndex * size + size).map(character => ({
        id: character.id, name: character.name, roleLabel: character.roleLabel ?? null,
        firstAppearanceEpisodeNo: character.firstAppearanceEpisodeNo ?? null,
        representativeAttributeLabel: character.representativeAttributeLabel ?? null,
        representativeAttributeValue: character.representativeAttributeValue ?? null,
      }));
      return success(route, { content, page: pageIndex, size, totalElements: matched.length,
        totalPages: Math.ceil(matched.length / size), hasNext: (pageIndex + 1) * size < matched.length });
    }
    if (path.startsWith(`${charactersPath}/`)) {
      const id = path.slice(charactersPath.length + 1);
      state.detailRequests.push(id);
      if (options.failDetail?.(id)) return failure(route, 500, 'INTERNAL_SERVER_ERROR', '인물 정보를 잠시 불러올 수 없습니다.');
      const character = state.characters.find(item => item.id === id);
      if (!character) return failure(route, 404, 'CHARACTER_NOT_FOUND', '인물을 찾을 수 없습니다.');
      return success(route, {
        id: character.id, name: character.name, roleLabel: character.roleLabel ?? null,
        currentAge: character.currentAge ?? null, currentLevel: character.currentLevel ?? null,
        firstAppearanceEpisode: character.firstAppearanceEpisodeNo == null ? null : { id: `episode-${character.firstAppearanceEpisodeNo}`, episodeNo: character.firstAppearanceEpisodeNo },
        profile: (character.profile ?? []).map(setting => ({ ...setting, valueType: 'STRING', attributeNameEditable: false, displayNameEditable: false, properties: [] })),
        stats: (character.stats ?? []).map(setting => ({ ...setting, valueType: 'STRING', attributeNameEditable: false, displayNameEditable: false, properties: [] })),
        skills: [], items: [], statuses: [],
      });
    }
    if (request.method() !== 'GET') {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.writes.push({ path, body });
      if (path === `${listPath}/selected-character-match`) {
        if (state.selectedMatchError) {
          const error = state.selectedMatchError;
          state.selectedMatchError = null;
          return failure(route, error.status, error.code, error.message, { candidateIds: error.candidateIds });
        }
        const selected = (body.candidateIds as string[]).map(id => state.candidates.find(candidate => candidate.id === id)!);
        selected.forEach(candidate => link(candidate, body));
        if (state.loseSelectedMatchResponse) {
          state.loseSelectedMatchResponse = false;
          return route.abort('failed');
        }
        const first = selected[0];
        return success(route, {
          groupKey: first.matchedCharacterId ? `existing:${first.matchedCharacterId}` : normalize(first.entityName),
          entityName: first.entityName, candidates: selected,
        });
      }
      if (path === `${listPath}/group-character-match`) {
        const selected = (body.candidateIds as string[]).map(id => state.candidates.find(candidate => candidate.id === id)!);
        selected.forEach(candidate => link(candidate, body));
        const first = selected[0];
        return success(route, {
          groupKey: first.matchedCharacterId ? `existing:${first.matchedCharacterId}` : normalize(first.entityName),
          entityName: first.entityName, candidates: selected,
        });
      }
      const dismissed = state.candidates.find(candidate => path === `${listPath}/${candidate.id}/dismiss`);
      if (dismissed) {
        dismissed.reviewStatus = 'DISMISSED';
        return success(route, dismissed);
      }
      const single = state.candidates.find(candidate => path === `${listPath}/${candidate.id}/character-match`);
      if (single) {
        link(single, body);
        return success(route, single);
      }
      return success(route, {});
    }
    if (path === listPath) {
      const all = groups();
      const size = options.groupPageSize ?? 20;
      const index = Number(url.searchParams.get('page') ?? 0);
      const statuses = url.searchParams.getAll('matchStatuses').flatMap(value => value.split(',')).filter(Boolean);
      const visible = statuses.length ? all.map(group => ({ ...group, candidates: group.candidates.filter(candidate => statuses.includes(candidate.matchStatus)) }))
        .filter(group => group.candidates.length).map(group => ({ ...group, candidateCount: group.candidates.length })) : all;
      const pending = state.candidates.filter(candidate => candidate.reviewStatus === 'PENDING_REVIEW').length;
      return success(route, {
        batchId, episodeStartNo: 1, episodeEndNo: 3, episodeCount: 3,
        totalCandidateCount: state.candidates.length, pendingCandidateCount: pending, directReviewCandidateCount: pending,
        confirmedCandidateCount: 0, dismissedCandidateCount: 0, processingCandidateCount: 0,
        groups: { content: visible.slice(index * size, index * size + size), page: index, size,
          totalElements: visible.length, totalPages: Math.max(1, Math.ceil(visible.length / size)), hasNext: (index + 1) * size < visible.length },
      });
    }
    if (path.startsWith(`${listPath}/`)) {
      const candidate = state.candidates.find(item => path === `${listPath}/${item.id}`);
      return candidate ? success(route, candidate) : failure(route, 404, 'NOT_FOUND', '후보를 찾을 수 없습니다.');
    }
    if (/\/world-setting-candidates(?:\/summary)?$/.test(path)) {
      return success(route, { batchId, totalCandidateCount: 0, pendingCandidateCount: 0, directReviewCandidateCount: 0,
        confirmedCandidateCount: 0, dismissedCandidateCount: 0, processingCandidateCount: 0,
        groups: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false } });
    }
    return success(route, {});
  });
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'character-link-test'));
  return state;
}

export function reviewUrl(params: Record<string, string> = {}): string {
  const query = new URLSearchParams({ workId, batchId, ...params });
  return `/setting-review?${query}`;
}
