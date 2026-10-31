import type { Page, Route } from '@playwright/test';
import type { FlowMeter } from './meter';

/*
 * #211 검토 흐름 조작 수 측정용 합성 사례와 상태를 가진 목 API.
 * 인물명·설정값·원문은 모두 가짜이며, 정답(어느 후보가 어느 대상에 속하는지)을 미리 알고 있다.
 * 목은 연결·결정 저장·확정을 메모리에 반영해 기준선(main)과 개선 화면이 같은 사례로 끝까지 진행되게 한다.
 * 개선 화면의 새 API(`selected-character-match`, 캐릭터 목록 `query`)도 받아 두지만 기준선 화면은 호출하지 않는다.
 */

export type ScenarioId = 'A' | 'B' | 'C';

export interface FlowContext {
  page: Page;
  meter: FlowMeter;
  server: ReviewFlowServer;
}

export interface FlowAdapter {
  name: 'baseline' | 'improved';
  /** 어댑터 파일 경로(결과 JSON에 남긴다) */
  file: string;
  /** 이 화면 버전에서 실행할 수 없으면 이유를 둔다(spec이 skip한다). */
  skipReason?: string;
  scenarios: Record<ScenarioId, (context: FlowContext) => Promise<void>>;
}

const uuid = (kind: number, n: number) => `21100000-0000-4000-8000-${kind.toString(16).padStart(4, '0')}${n.toString(16).padStart(8, '0')}`;

const WORK_ID = uuid(0, 1);
const BATCH_ID = uuid(0, 2);
const ANALYSIS_JOB_ID = uuid(0, 3);

export const ENTRY_URLS: Record<ScenarioId, string> = {
  A: `/setting-review?workId=${WORK_ID}&batchId=${BATCH_ID}`,
  B: `/setting-review?workId=${WORK_ID}&batchId=${BATCH_ID}&candidateType=world`,
  C: `/setting-review?workId=${WORK_ID}&batchId=${BATCH_ID}`,
};

// 기존 캐릭터 9명. 목록 API 기본 정렬은 이름순이 아니라 최근 수정순이므로
// 인물H를 가장 오래 수정되지 않은 인물로 두어 8명 단위 목록의 2페이지에 오게 한다.
const CHARACTER_LIST_ORDER = ['인물A', '인물B', '인물C', '인물D', '인물E', '인물F', '인물G', '인물I', '인물H'];
const CHARACTERS = Object.fromEntries(['인물A', '인물B', '인물C', '인물D', '인물E', '인물F', '인물G', '인물H', '인물I']
  .map((name, index) => [name, { id: uuid(0xc, index + 1), name }])) as Record<string, { id: string; name: string }>;
export const UNKNOWN_GROUP_KEY = '미상';

/** 시나리오 A·C: 미상 묶음 후보 4건과 정답 */
export const CHARACTER_CASES = [
  { id: uuid(0xa, 1), episodeNo: 1, attributeName: 'profile.occupation', label: '직업', value: '야간 경비원', valueType: 'STRING', mention: '그 사내', answer: '인물H', createNew: false },
  { id: uuid(0xa, 2), episodeNo: 2, attributeName: 'profile.affiliation', label: '소속', value: '은빛 상단', valueType: 'STRING', mention: '그녀', answer: '인물B', createNew: false },
  { id: uuid(0xa, 3), episodeNo: 2, attributeName: 'statuses.condition', label: '상태', value: '왼팔 부상', valueType: 'STRING', mention: '그녀', answer: '인물B', createNew: false },
  { id: uuid(0xa, 4), episodeNo: 3, attributeName: 'age', label: '나이', value: '17', valueType: 'NUMBER', mention: '소년', answer: '인물J', createNew: true },
] as const;
/** 다음 그룹이 존재하도록 둔 인물A 묶음(반영 방식 저장 완료 1건) */
const SAVED_CASE = { id: uuid(0xa, 0x101), episodeNo: 1, attributeName: 'profile.eye_color', label: '눈 색깔', value: '회색' };
const NEW_CHARACTER_ID = uuid(0xc, 0x10);

/**
 * 시나리오 B: 대상 장소X(기존 속성 2개, 후보 경로와 겹치지 않음).
 * 같은 분류의 다른 장소 7개를 함께 두어 대상 목록(6개 단위) 첫 페이지에 장소X가 보이지 않게 한다.
 * 실제 작품처럼 대상을 찾으려면 검색이나 페이지 이동이 필요한 상황을 만든다.
 */
export const WORLD_TARGET = {
  id: uuid(0xd, 1), name: '장소X', category: 'LOCATION' as const,
  properties: [
    { scopeName: null, settingName: '기후', value: '일 년 내내 옅은 안개가 낀다.' },
    { scopeName: null, settingName: '주요 시설', value: '불 꺼진 등대' },
  ],
};
const WORLD_DECOYS = ['장소A', '장소B', '장소C', '장소D', '장소E', '장소F', '장소G'].map((name, index) => ({
  id: uuid(0xd, index + 2), name, category: 'LOCATION' as const,
  properties: [{ scopeName: null, settingName: '분위기', value: `${name}의 합성 설명` }],
}));
export const WORLD_CASES = [
  { id: uuid(0xb, 1), episodeNo: 1, settingName: '위치', value: '북쪽 절벽 아래 만에 있다.' },
  { id: uuid(0xb, 2), episodeNo: 1, settingName: '출입 조건', value: '썰물 때만 걸어서 들어갈 수 있다.' },
  { id: uuid(0xb, 3), episodeNo: 2, settingName: '관리자', value: '은퇴한 항해사가 혼자 지킨다.' },
  { id: uuid(0xb, 4), episodeNo: 2, settingName: '소문', value: '밤마다 종소리가 들린다고 한다.' },
  { id: uuid(0xb, 5), episodeNo: 3, settingName: '특산물', value: '소금에 절인 푸른 해초' },
] as const;

type Json = Record<string, unknown>;
type CharacterRow = { id: string; name: string; firstAppearanceEpisodeNo: number; roleLabel: string | null };
type WorldSettingRow = { id: string; name: string; category: string; version: number; properties: Array<{ scopeName: string | null; settingName: string; value: string }> };
type Candidate = Json & { id: string; reviewStatus: string; episodeNo: number; entityName: string; matchedCharacterId: string | null };
type WorldCandidate = Json & { id: string; reviewStatus: string; sourceEpisodeNo: number; category: string; subjectName: string };

export interface ReviewFlowServer {
  characterCandidate(id: string): Candidate;
  worldCandidate(id: string): WorldCandidate;
  characterIdByName(name: string): string | undefined;
  /** 목이 처리하지 않은 API 요청(spec이 비어 있는지 확인한다) */
  unhandled: string[];
}

const normalizeName = (value?: string | null) => (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');
const pageOf = <T,>(items: T[], page: number, size: number) => {
  const totalPages = Math.ceil(items.length / size);
  return { content: items.slice(page * size, page * size + size), page, size, totalElements: items.length, totalPages, hasNext: page + 1 < totalPages };
};

export async function installReviewFlowMock(page: Page, options: { abortFirstApplicationModePatch?: boolean } = {}): Promise<ReviewFlowServer> {
  let tick = 0;
  const timestamp = () => new Date(Date.UTC(2026, 9, 30, 1, 0, 0) + (tick++) * 1000).toISOString().slice(0, 19);
  const characters: CharacterRow[] = CHARACTER_LIST_ORDER.map(name => ({ ...CHARACTERS[name], firstAppearanceEpisodeNo: 1, roleLabel: null }));
  const worldSettings: WorldSettingRow[] = [WORLD_TARGET, ...WORLD_DECOYS].map(target => ({
    id: target.id, name: target.name, category: target.category, version: 1, properties: target.properties.map(property => ({ ...property })),
  }));
  const characterBase = {
    workId: WORK_ID, analysisJobId: ANALYSIS_JOB_ID, candidateKind: 'SETTING', entityType: 'CHARACTER', attributeNameEditable: false,
    valueValidation: { status: 'VALID', repairable: false }, reviewStatus: 'PENDING_REVIEW', analysisMode: 'ORDERED_PROVISIONAL',
    automaticApplicationPending: false, manualReviewAvailable: true, userModified: false, confidence: 0.82, snapshotChanges: [],
    comparisonRevision: null,
  };
  const candidates: Candidate[] = [
    ...CHARACTER_CASES.map(item => ({
      ...characterBase, id: item.id, episodeNo: item.episodeNo, entityName: '미상', rawEntityMention: item.mention,
      matchedCharacterId: null, matchStatus: 'UNRESOLVED', attributeName: item.attributeName, attributeDisplayName: item.label,
      attributeValue: item.value, valueType: item.valueType, comparisonStatus: 'WAITING_FOR_CHARACTER_MATCH', suggestedOperation: null,
      reviewedApplicationMode: null, evidenceSpans: [{ quote: `${item.mention}의 ${item.label}은(는) ${item.value}(이)다.` }], updatedAt: timestamp(),
    })),
    {
      ...characterBase, id: SAVED_CASE.id, episodeNo: SAVED_CASE.episodeNo, entityName: '인물A', rawEntityMention: '인물A',
      matchedCharacterId: CHARACTERS['인물A'].id, matchStatus: 'MATCHED', attributeName: SAVED_CASE.attributeName,
      attributeDisplayName: SAVED_CASE.label, attributeValue: SAVED_CASE.value, valueType: 'STRING', comparisonStatus: 'COMPLETED',
      suggestedOperation: 'ADD', temporalScope: 'PRESENT', proposedFactValue: SAVED_CASE.value, reviewedApplicationMode: 'APPLY_PROPOSAL',
      userModified: true, evidenceSpans: [{ quote: `인물A의 눈은 ${SAVED_CASE.value}이었다.` }], updatedAt: timestamp(),
    },
  ];
  const worldCandidates: WorldCandidate[] = WORLD_CASES.map(item => ({
    id: item.id, workId: WORK_ID, sourceEpisodeNo: item.episodeNo, category: WORLD_TARGET.category, subjectName: WORLD_TARGET.name,
    targetSubjectName: null, targetWorldSettingId: null, scopeName: null, settingName: item.settingName, extractedValue: item.value,
    proposedValue: item.value, beforeValue: null, matchedScopeName: null, matchedPropertyName: null, comparisonStatus: 'COMPLETED',
    suggestedOperation: 'REVIEW_REQUIRED', comparisonReviewReason: 'SUBJECT_UNRESOLVED', consolidationStatus: 'SINGLE',
    reviewStatus: 'PENDING_REVIEW', manualReviewAvailable: false, userModified: false, analysisMode: 'CONFIRMED_ONLY',
    evidenceSpans: [{ quote: `그곳은 ${item.value}` }], updatedAt: timestamp(),
  }));
  const unhandled: string[] = [];
  let applicationModeAbortPending = Boolean(options.abortFirstApplicationModePatch);

  const characterGroupKey = (candidate: Candidate) => candidate.matchedCharacterId ? `existing:${candidate.matchedCharacterId}` : normalizeName(candidate.entityName);
  const characterGroups = (rows: Candidate[]) => {
    const grouped = new Map<string, Candidate[]>();
    rows.forEach(row => grouped.set(characterGroupKey(row), [...(grouped.get(characterGroupKey(row)) ?? []), row]));
    return [...grouped.entries()].map(([groupKey, groupRows]) => ({
      groupKey, entityName: groupRows[0].entityName, candidateCount: groupRows.length,
      evidenceEpisodeNos: [...new Set(groupRows.map(row => row.episodeNo))].sort((a, b) => a - b),
      candidates: [...groupRows].sort((a, b) => a.episodeNo - b.episodeNo),
    })).sort((left, right) => Number(left.groupKey === UNKNOWN_GROUP_KEY) - Number(right.groupKey === UNKNOWN_GROUP_KEY)
      || left.evidenceEpisodeNos[0] - right.evidenceEpisodeNos[0] || left.entityName.localeCompare(right.entityName, 'ko'));
  };
  const characterCounts = () => {
    const pending = candidates.filter(row => row.reviewStatus === 'PENDING_REVIEW');
    return {
      batchId: BATCH_ID, episodeStartNo: 1, episodeEndNo: 3, episodeCount: 3, totalCandidateCount: candidates.length,
      reviewedCandidateCount: candidates.length - pending.length, pendingCandidateCount: pending.length,
      matchRequiredCandidateCount: pending.filter(row => !row.matchedCharacterId).length, attentionRequiredCandidateCount: 0,
      confirmedCandidateCount: candidates.filter(row => row.reviewStatus === 'CONFIRMED').length, dismissedCandidateCount: 0,
      directReviewCandidateCount: pending.length, processingCandidateCount: 0,
    };
  };
  const worldGroupKey = (row: WorldCandidate) => `${row.finalCategory ?? row.category}|${normalizeName((row.finalSubjectName ?? row.targetSubjectName ?? row.subjectName) as string)}`;
  const worldCounts = () => {
    const pending = worldCandidates.filter(row => row.reviewStatus === 'PENDING_REVIEW');
    return {
      batchId: BATCH_ID, episodeStartNo: 1, episodeEndNo: 3, episodeCount: 3, totalCandidateCount: worldCandidates.length,
      reviewedCandidateCount: worldCandidates.length - pending.length, pendingCandidateCount: pending.length,
      pendingComparisonCount: 0, processingComparisonCount: 0, activeComparisonJobCount: 0, failedComparisonCount: 0,
      tokenInterruptedComparisonCount: 0, canResumeTokenInterruptedComparisons: false, recomparisonRequiredCount: 0, conflictCandidateCount: 0,
      confirmedCandidateCount: worldCandidates.length - pending.length, dismissedCandidateCount: 0,
      directReviewCandidateCount: pending.length, processingCandidateCount: 0,
    };
  };
  const characterSummary = (row: CharacterRow) => ({
    id: row.id, name: row.name, currentAge: null, representativeAttributeLabel: null, representativeAttributeValue: null,
    firstAppearanceEpisodeNo: row.firstAppearanceEpisodeNo, roleLabel: row.roleLabel,
  });
  const applyCharacterMatch = (rows: Candidate[], body: Json) => {
    const target = body.resolutionType === 'MATCH_EXISTING' ? characters.find(row => row.id === body.matchedCharacterId) : undefined;
    if (body.resolutionType === 'MATCH_EXISTING' && !target) return false;
    const newName = typeof body.entityName === 'string' ? body.entityName.trim() : '';
    if (body.resolutionType === 'CREATE_NEW' && !newName) return false;
    rows.forEach(row => Object.assign(row, {
      matchedCharacterId: target?.id ?? null, entityName: target?.name ?? newName, matchStatus: target ? 'MATCHED' : 'UNRESOLVED',
      // 합성 사례 규칙: 연결 직후 비교가 끝나 현재 반영/이력 선택이 가능한 상태로 응답한다.
      comparisonStatus: 'COMPLETED', suggestedOperation: 'ADD', temporalScope: 'PRESENT', proposedFactValue: row.attributeValue,
      reviewedApplicationMode: null, userModified: true, updatedAt: timestamp(),
    }));
    return true;
  };

  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body: Json = method === 'GET' || !request.postData() ? {} : request.postDataJSON();
    const ok = (data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    const fail = (status: number, code: string, message: string) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify({ success: false, message, error: { status, code, message, context: {} } }),
    });
    const workPath = `/api/v1/works/${WORK_ID}`;

    if (path.endsWith('/auth/me')) return ok({ id: 211, email: 'review-flow@example.test', displayName: '측정 작가', role: 'AUTHOR', status: 'ACTIVE' });
    if (path === workPath && method === 'GET') return ok({ id: WORK_ID, title: '측정용 합성 작품', genre: '판타지', lifecycleStatus: 'ACTIVE' });
    if (path === `${workPath}/world-image-theme` && method === 'GET') return ok({ theme: 'fantasy', defaults: {}, overview: {} });

    // 캐릭터 목록·상세
    if (path === `${workPath}/characters` && method === 'GET') {
      const query = normalizeName(url.searchParams.get('query'));
      const rows = query
        ? characters.filter(row => normalizeName(row.name).includes(query)).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        : characters;
      return ok(pageOf(rows.map(characterSummary), Number(url.searchParams.get('page') ?? 0), Number(url.searchParams.get('size') ?? 20)));
    }
    const characterDetail = path.match(new RegExp(`^${workPath}/characters/([^/]+)$`));
    if (characterDetail && method === 'GET') {
      const row = characters.find(item => item.id === characterDetail[1]);
      return row ? ok({ ...characterSummary(row), profile: [], stats: [], skills: [], items: [], statuses: [] }) : fail(404, 'CHARACTER_NOT_FOUND', '캐릭터를 찾을 수 없습니다.');
    }

    // 캐릭터 설정 후보
    const candidatesPath = `${workPath}/setting-candidates`;
    if (path === candidatesPath && method === 'GET') {
      const reviewStatus = url.searchParams.get('reviewStatus');
      const rows = candidates.filter(row => !reviewStatus || row.reviewStatus === reviewStatus);
      return ok({ ...characterCounts(), groups: pageOf(characterGroups(rows), Number(url.searchParams.get('page') ?? 0), Number(url.searchParams.get('size') ?? 20)) });
    }
    if ((path === `${candidatesPath}/group-character-match` || path === `${candidatesPath}/selected-character-match`) && method === 'PATCH') {
      const ids = Array.isArray(body.candidateIds) ? body.candidateIds as string[] : [];
      const rows = ids.map(id => candidates.find(row => row.id === id));
      if (!ids.length || rows.some(row => !row || row.reviewStatus !== 'PENDING_REVIEW')) return fail(409, 'SETTING_CANDIDATE_REVIEW_STATUS_CONFLICT', '검토 대기 후보만 연결할 수 있습니다.');
      if (!applyCharacterMatch(rows as Candidate[], body)) return fail(400, 'INVALID_INPUT', '연결 대상을 확인해 주세요.');
      const first = rows[0] as Candidate;
      return ok({ groupKey: characterGroupKey(first), entityName: first.entityName, candidates: rows });
    }
    if (path === `${candidatesPath}/group-confirm` && method === 'POST') {
      const decisions = Array.isArray(body.candidates) ? body.candidates as Json[] : [];
      const rows = decisions.map(decision => candidates.find(row => row.id === decision.candidateId));
      if (!decisions.length || rows.some(row => !row || row.reviewStatus !== 'PENDING_REVIEW')) return fail(409, 'SETTING_CANDIDATE_REVIEW_STATUS_CONFLICT', '이미 처리된 후보가 있습니다.');
      decisions.forEach((decision, index) => {
        const row = rows[index] as Candidate;
        if (!row.matchedCharacterId) {
          // 같은 이름의 신규 캐릭터 등록 예정 후보는 확정 때 캐릭터를 만든다.
          let created = characters.find(item => normalizeName(item.name) === normalizeName(row.entityName));
          if (!created) {
            created = { id: characters.some(item => item.id === NEW_CHARACTER_ID) ? uuid(0xc, 0x10 + characters.length) : NEW_CHARACTER_ID, name: row.entityName, firstAppearanceEpisodeNo: row.episodeNo, roleLabel: null };
            characters.unshift(created);
          }
          Object.assign(row, { matchedCharacterId: created.id, matchStatus: 'AUTO_MATCHED_BY_NAME' });
        }
        Object.assign(row, { reviewStatus: 'CONFIRMED', historyOnly: decision.applicationMode === 'HISTORY_ONLY', updatedAt: timestamp() });
      });
      const first = rows[0] as Candidate;
      return ok({ groupKey: characterGroupKey(first), entityName: first.entityName, candidates: rows });
    }
    const candidateMatch = path.match(new RegExp(`^${candidatesPath}/([^/]+)/character-match$`));
    if (candidateMatch && method === 'PATCH') {
      const row = candidates.find(item => item.id === candidateMatch[1]);
      if (!row || row.reviewStatus !== 'PENDING_REVIEW') return fail(409, 'SETTING_CANDIDATE_REVIEW_STATUS_CONFLICT', '검토 대기 후보만 연결할 수 있습니다.');
      if (!applyCharacterMatch([row], body)) return fail(400, 'INVALID_INPUT', '연결 대상을 확인해 주세요.');
      return ok(row);
    }
    const candidateDetail = path.match(new RegExp(`^${candidatesPath}/([^/]+)$`));
    if (candidateDetail) {
      const row = candidates.find(item => item.id === candidateDetail[1]);
      if (!row) return fail(404, 'SETTING_CANDIDATE_NOT_FOUND', '설정 후보를 찾을 수 없습니다.');
      if (method === 'GET') return ok(row);
      if (method === 'PATCH') {
        if (row.reviewStatus !== 'PENDING_REVIEW') return fail(409, 'SETTING_CANDIDATE_REVIEW_STATUS_CONFLICT', '이미 처리된 후보입니다.');
        // 순차 분석의 수동 검토 후보는 같은 선택을 다시 보내도 같은 결과다(완료된 단일 회차 검토만 updatedAt을 대조한다).
        Object.assign(row, {
          attributeValue: body.attributeValue ?? row.attributeValue, userModified: true, updatedAt: timestamp(),
          ...(body.reviewedApplicationMode ? { reviewedApplicationMode: body.reviewedApplicationMode } : {}),
        });
        if (body.reviewedApplicationMode && applicationModeAbortPending) {
          // 시나리오 C: 서버에는 저장됐지만 응답이 유실된다.
          applicationModeAbortPending = false;
          return route.abort('failed');
        }
        return ok(row);
      }
    }

    // 세계관 후보
    const worldCandidatesPath = `${workPath}/world-setting-candidates`;
    if ((path === worldCandidatesPath || path === `${worldCandidatesPath}/summary`) && method === 'GET') {
      if (path.endsWith('/summary')) return ok(worldCounts());
      const reviewStatus = url.searchParams.get('reviewStatus');
      const category = url.searchParams.get('category');
      const rows = worldCandidates.filter(row => (!reviewStatus || row.reviewStatus === reviewStatus) && (!category || row.category === category));
      const grouped = new Map<string, WorldCandidate[]>();
      rows.forEach(row => grouped.set(worldGroupKey(row), [...(grouped.get(worldGroupKey(row)) ?? []), row]));
      const groups = [...grouped.entries()].map(([groupKey, groupRows]) => ({
        groupKey, category: groupRows[0].finalCategory ?? groupRows[0].category,
        subjectName: groupRows[0].finalSubjectName ?? groupRows[0].targetSubjectName ?? groupRows[0].subjectName,
        changeCount: groupRows.length, decisionCount: groupRows.length, sourceCandidateCount: groupRows.length,
        addCount: 0, updateCount: 0, mergeCount: 0, excludeCount: 0,
        reviewRequiredCount: groupRows.filter(row => row.suggestedOperation === 'REVIEW_REQUIRED' && !row.finalOperation).length,
        evidenceEpisodeNos: [...new Set(groupRows.map(row => row.sourceEpisodeNo))].sort((a, b) => a - b), status: 'READY', candidates: groupRows,
      }));
      return ok({ ...worldCounts(), groups: pageOf(groups, Number(url.searchParams.get('page') ?? 0), Number(url.searchParams.get('size') ?? 20)) });
    }
    if (path === `${worldCandidatesPath}/decisions` && method === 'PATCH') {
      const drafts = Array.isArray(body.candidates) ? body.candidates as Json[] : [];
      const rows = drafts.map(draft => worldCandidates.find(row => row.id === draft.candidateId));
      if (!drafts.length || rows.some(row => !row || row.reviewStatus !== 'PENDING_REVIEW')) return fail(409, 'WORLD_SETTING_CANDIDATE_REVIEW_STATUS_CONFLICT', '검토 대기 후보만 저장할 수 있습니다.');
      drafts.forEach((draft, index) => Object.assign(rows[index] as WorldCandidate, {
        finalOperation: draft.operation, finalCategory: draft.category, finalSubjectName: draft.subjectName, finalScopeName: draft.scopeName ?? null,
        finalSettingName: draft.settingName, finalValue: draft.value, userModified: true, updatedAt: timestamp(),
      }));
      return ok({ groupKey: worldGroupKey(rows[0] as WorldCandidate), candidates: rows });
    }
    if (path === `${worldCandidatesPath}/group-confirm` && method === 'POST') {
      const decisions = Array.isArray(body.candidates) ? body.candidates as Json[] : [];
      const rows = decisions.map(decision => worldCandidates.find(row => row.id === decision.candidateId));
      if (!decisions.length || rows.some(row => !row || row.reviewStatus !== 'PENDING_REVIEW')) return fail(409, 'WORLD_SETTING_CANDIDATE_REVIEW_STATUS_CONFLICT', '이미 처리된 후보가 있습니다.');
      let applied: WorldSettingRow | undefined;
      decisions.forEach((decision, index) => {
        const row = rows[index] as WorldCandidate;
        applied = worldSettings.find(item => item.category === decision.category && normalizeName(item.name) === normalizeName(decision.subjectName as string));
        if (!applied) {
          applied = { id: uuid(0xd, 0x100 + worldSettings.length), name: decision.subjectName as string, category: decision.category as string, version: 0, properties: [] };
          worldSettings.push(applied);
        }
        applied.properties.push({ scopeName: (decision.scopeName as string | null) ?? null, settingName: decision.settingName as string, value: decision.value as string });
        Object.assign(row, {
          reviewStatus: 'CONFIRMED', finalOperation: decision.operation, finalCategory: decision.category, finalSubjectName: decision.subjectName,
          finalScopeName: decision.scopeName ?? null, finalSettingName: decision.settingName, finalValue: decision.value, updatedAt: timestamp(),
        });
      });
      if (applied) applied.version += 1;
      return ok({ groupKey: worldGroupKey(rows[0] as WorldCandidate), worldSettingId: applied?.id ?? null, appliedWorldSettingVersion: applied?.version ?? null, candidates: rows });
    }
    const worldCandidateDetail = path.match(new RegExp(`^${worldCandidatesPath}/([^/]+)$`));
    if (worldCandidateDetail && method === 'GET') {
      const row = worldCandidates.find(item => item.id === worldCandidateDetail[1]);
      return row ? ok(row) : fail(404, 'WORLD_SETTING_CANDIDATE_NOT_FOUND', '세계관 후보를 찾을 수 없습니다.');
    }

    // 세계관 대상 목록·상세
    if (path === `${workPath}/world-settings` && method === 'GET') {
      const category = url.searchParams.get('category');
      const q = normalizeName(url.searchParams.get('q'));
      const rows = worldSettings
        .filter(row => (!category || row.category === category) && (!q || normalizeName(row.name).includes(q)))
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'ko'))
        .map(row => ({ id: row.id, workId: WORK_ID, category: row.category, subjectName: row.name, propertyCount: row.properties.length }));
      return ok({ totalWorldSettingCount: worldSettings.length, worldSettings: pageOf(rows, Number(url.searchParams.get('page') ?? 0), Number(url.searchParams.get('size') ?? 20)) });
    }
    const worldSettingDetail = path.match(new RegExp(`^${workPath}/world-settings/([^/]+)$`));
    if (worldSettingDetail && method === 'GET') {
      const row = worldSettings.find(item => item.id === worldSettingDetail[1]);
      return row ? ok({ id: row.id, workId: WORK_ID, category: row.category, subjectName: row.name, properties: row.properties,
        propertyCount: row.properties.length, version: row.version }) : fail(404, 'WORLD_SETTING_NOT_FOUND', '세계관 설정을 찾을 수 없습니다.');
    }

    unhandled.push(`${method} ${path}`);
    return method === 'GET' ? ok({}) : fail(404, 'NOT_MOCKED', `목 API에 없는 요청입니다: ${method} ${path}`);
  });

  return {
    characterCandidate: id => candidates.find(row => row.id === id)!,
    worldCandidate: id => worldCandidates.find(row => row.id === id)!,
    characterIdByName: name => characters.find(row => row.name === name)?.id,
    unhandled,
  };
}

/** 측정 전에 인증 토큰만 준비한다(측정에 포함하지 않는다). */
export async function signIn(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem('accessToken', 'review-flow-metrics');
    localStorage.removeItem('catchhole_demo_mode');
  });
}

/** 결과 JSON·추적 로그에서 그룹 키를 사람이 읽을 이름으로 바꾼다. */
export function describeGroupKey(groupKey: string): string {
  if (groupKey.startsWith('existing:')) {
    const id = groupKey.slice('existing:'.length);
    return Object.values(CHARACTERS).find(character => character.id === id)?.name ?? (id === NEW_CHARACTER_ID ? '인물J' : groupKey);
  }
  const created = CHARACTER_CASES.find(item => item.createNew && normalizeName(item.answer) === groupKey);
  return created ? `${created.answer}(새 인물 등록 예정)` : groupKey;
}
