import type { Page, Route } from '@playwright/test';
import review from './validation-review-v1.json' with { type: 'json' };
import stagingFixture from './validation-staging-v1.json' with { type: 'json' };
import resultsFixture from './validation-results-v1.json' with { type: 'json' };

/**
 * GH314 오류 리포트 목 API. 응답 모양은 Backend 계약 JSON(validation-review-v1.json)·staging/results fixture를
 * 복제하고 값만 바꾼다. 계약에 없는 필드는 만들지 않는다.
 */
export const WORK_ID = '00000000-0000-4000-8000-0000000000a1';
export const REPORT_ID = stagingFixture.awaitingReview.reportId;
export const PAST_REPORT_ID = review.responses.historyPage.content[1].reportId;
export const EPISODE_ID = stagingFixture.awaitingReview.episodeId;
export const BATCH_ID = stagingFixture.awaitingReview.batchId;
/** 재검수가 만드는 새 report. 계약 예시의 UUID 형식만 따른다. */
export const RECHECK_REPORT_ID = '00000000-0000-4000-8000-000000000012';
const REPLACED_BATCH_ID = '00000000-0000-4000-8000-000000000022';
/** #314 B2 대상. 계약 예시(findingSummary·findingSummaryWorld)의 대상 ID 형식을 따른다. */
export const CHARACTER_ID = review.responses.findingSummary.subject.id;
export const WORLD_ID = review.responses.findingSummaryWorld.subject.id;
export const ERWEN_ID = '00000000-0000-4000-8000-000000000603';
export const CORRECTION_RECEIPT_ID = '00000000-0000-4000-8000-000000000701';

type Subject = { type: 'CHARACTER' | 'WORLD_SETTING'; id: string | null; name: string } | null;
type Basis = (typeof review.responses.findingDetail.basis)[number];
type Detail = Omit<typeof review.responses.findingDetail, 'subject' | 'settingName' | 'settingKey' | 'basis'> & {
  subject: Subject; settingName: string | null; settingKey: string | null; basis: Basis[];
};
type Summary = typeof review.responses.reviewSummary;
type Staging = typeof stagingFixture.awaitingReview;
type HistoryRow = (typeof review.responses.historyPage.content)[number];
type Judgment = 'PENDING' | 'NEEDS_FIX' | 'NOT_CONFLICT' | 'KEEP_ORIGINAL';

const clone = <T,>(value: T): T => structuredClone(value);
const findingIds = ['101', '111', '121', '131', '141'].map(suffix => `00000000-0000-4000-8000-000000000${suffix}`);

function completion(reason: string, refs: string[]) {
  return { reason, evidence_refs: refs };
}

/** 계약의 findingDetail을 복제해 값만 바꾼다. payload는 공개 허용 키만 사용한다. */
function settingDetail(index: number, values: {
  outcome: string; basis: string; impact: string; reason: string; impactReason: string; target: Array<[number, number, string]>;
  basisEvidence: Array<[string, number, number, string]>; context: string; exceptions: string; disagreements?: string[]; changed?: boolean;
  subject: Subject; settingName?: string | null; settingKey?: string | null; basisEntries?: Basis[];
}): Detail {
  const detail = clone(review.responses.findingDetail) as unknown as Detail & { payload: Record<string, unknown> };
  // #314 B2: 대상·설정명·정정 기준 항목은 계약 모양을 따르고 값만 장면에 맞게 바꾼다.
  detail.subject = values.subject;
  detail.settingName = values.settingName ?? null;
  detail.settingKey = values.settingKey ?? null;
  detail.basis = values.basisEntries ?? [];
  const targetSpans = values.target.map(([start, end, quote]) => ({ source_ref: 'T1', start, end, quote }));
  detail.findingId = findingIds[index];
  detail.checkId = `00000000-0000-4000-8000-00000000020${index}`;
  detail.unitRef = `Q${index + 1}`;
  detail.checkRevision = 1;
  detail.currentCheckRevision = 1;
  detail.outcome = values.outcome;
  detail.stale = false;
  detail.changed = values.changed ?? false;
  detail.payload = {
    reason: values.reason, basis: values.basis, impact: values.impact, impact_reason: values.impactReason,
    target_spans: targetSpans, evidence_refs: values.basisEvidence.map(([ref]) => ref),
    disagreements: (values.disagreements ?? []).map(reason => ({ fact_ref: 'B1', evidence_ref: 'E1', reason })),
    completion: {
      comparison_context: completion(values.context, ['T1']),
      changes_exceptions: completion(values.exceptions, []),
      no_pending_clues: completion('남은 단서가 없어요.', []),
      required_reads: completion('필요한 원문을 모두 읽었어요.', []),
    },
  };
  detail.evidence = [
    ...values.basisEvidence.map(([sourceRef, start, end, quote]) => ({ sourceRef, start, end, quote })),
    ...targetSpans.slice(0, 1).map(span => ({ sourceRef: 'T1', start: span.start, end: span.end, quote: span.quote })),
  ];
  detail.judgment = { value: 'PENDING', version: 0, decidedAt: null as unknown as string };
  detail.allowedJudgments = ['PENDING', 'NEEDS_FIX', 'NOT_CONFLICT'];
  detail.judgmentHistory = [];
  detail.priorRevisions = [];
  return detail;
}

function typoDetail(index: number, values: { outcome: string; reason: string; start: number; end: number; quote: string; replacement: string }): Detail {
  const detail = clone(review.responses.findingDetail) as unknown as Detail & { payload: Record<string, unknown> };
  // 오탈자는 대상·설정명이 없고 basis는 빈 배열이다(계약 findingSummaryTypo).
  detail.subject = null;
  detail.settingName = null;
  detail.settingKey = null;
  detail.basis = [];
  detail.findingId = findingIds[index];
  detail.branch = 'TYPO';
  detail.unitRef = 'TSEG1';
  detail.checkId = null as unknown as string;
  detail.checkRevision = null as unknown as number;
  detail.currentCheckRevision = null as unknown as number;
  detail.outcome = values.outcome;
  detail.stale = false;
  detail.changed = false;
  detail.payload = {
    reason: values.reason, category: values.outcome, replacement: values.replacement,
    span: { source_ref: 'T1', start: values.start, end: values.end, quote: values.quote },
  };
  detail.evidence = [{ sourceRef: 'T1', start: values.start - 6, end: values.end + 4, quote: `그러면 ${values.quote} 정말` }];
  detail.judgment = { value: 'PENDING', version: 0, decidedAt: null as unknown as string };
  detail.allowedJudgments = ['PENDING', 'NEEDS_FIX', 'KEEP_ORIGINAL'];
  detail.judgmentHistory = [];
  detail.priorRevisions = [];
  return detail;
}

/** 계약 basis 예시를 복제해 값만 바꾼다. */
function basisEntry(values: Partial<Basis> & Pick<Basis, 'entryRef' | 'subjectType' | 'targetId' | 'subjectName'>): Basis {
  return {
    ...clone(review.responses.findingDetail.basis[0]),
    entryHash: values.entryRef === 'B1' ? 'c'.repeat(64) : values.entryRef === 'B2' ? 'd'.repeat(64) : 'e'.repeat(64),
    factType: null as unknown as string, factKey: null as unknown as string, scopeName: null, settingName: null,
    ...values,
  } as Basis;
}

export const BJORN_BASIS = basisEntry({ entryRef: 'B1', subjectType: 'CHARACTER', targetId: CHARACTER_ID, subjectName: '비요른', factType: 'ITEM', factKey: 'item.검', currentVersion: 3 });
export const PALACE_BASIS = basisEntry({ entryRef: 'B2', subjectType: 'WORLD_SETTING', targetId: WORLD_ID, subjectName: '왕궁', scopeName: '마법', settingName: '사용 제한', currentVersion: 4 } as unknown as Partial<Basis> & Pick<Basis, 'entryRef' | 'subjectType' | 'targetId' | 'subjectName'>);
export const ERWEN_BASIS = basisEntry({ entryRef: 'B3', subjectType: 'CHARACTER', targetId: ERWEN_ID, subjectName: '에르웬', currentVersion: 2 });

export function defaultFindings(): Detail[] {
  return [
    settingDetail(0, {
      subject: { type: 'CHARACTER', id: CHARACTER_ID, name: '비요른' }, settingName: '검', settingKey: 'ITEM:item.검', basisEntries: [BJORN_BASIS],
      outcome: 'CONFLICT', basis: 'DIRECT_CONTRADICTION', impact: 'SEVERE',
      reason: '20화에서 파괴된 검을 101화에서 설명 없이 다시 사용해요.',
      impactReason: '부서진 검으로 성문을 여는 장면의 성립 조건이에요.',
      target: [[120, 133, '비요른은 그 검을 뽑았다.'], [410, 431, '부서졌던 검신이 달빛 아래 날카롭게 빛났다.']],
      basisEvidence: [['R1', 88, 112, '그의 검은 손잡이만 남긴 채 산산이 부서졌다.']],
      context: '20화 이후 검을 다시 얻었다는 기록과 비교했어요.',
      exceptions: '수리하거나 새로 얻었다는 설명을 찾지 못했어요.',
    }),
    settingDetail(1, {
      subject: { type: 'WORLD_SETTING', id: WORLD_ID, name: '왕궁' }, settingName: '마법 / 사용 제한', settingKey: '["마법","사용 제한"]',
      basisEntries: [PALACE_BASIS, ERWEN_BASIS],
      outcome: 'NEEDS_CONTEXT', basis: 'AMBIGUOUS_MEANING', impact: 'SEVERE',
      reason: '왕궁 앞뜰이 마법 금지 구역에 들어가는지 알 수 없어요.',
      impactReason: '주문으로 탈출하는 장면의 성립 조건이에요.',
      target: [[612, 640, '왕궁 앞뜰에 발을 디딘 에르웬이 짧은 주문을 읊자, 손끝에서 작은 불꽃이 피어났다.']],
      basisEvidence: [['R2', 30, 56, '왕궁 안에서는 누구도 마법을 사용할 수 없다.']],
      context: '앞뜰이 ‘왕궁 안’에 포함되는지 설정에 적혀 있지 않아요.',
      exceptions: '앞뜰에 대한 예외 규칙을 찾지 못했어요.',
    }),
    settingDetail(2, {
      // 질문 속성이 고정 slot과 정확히 맞지 않아 설정명은 없다(대상만 표시).
      subject: { type: 'CHARACTER', id: ERWEN_ID, name: '에르웬' }, settingName: null, basisEntries: [ERWEN_BASIS],
      outcome: 'SUSPECTED_CONFLICT', basis: 'CHANGE_NOT_FOUND', impact: 'REFERENCE', changed: true,
      reason: '망토의 색이 이전 회차와 달라요.',
      impactReason: '행동이나 사건에 쓰이지 않는 부수적 묘사예요.',
      target: [[900, 912, '에르웬은 붉은 망토를 여몄다.']],
      basisEvidence: [['R1', 40, 52, '에르웬의 푸른 망토가 바람에 날렸다.']],
      context: '같은 망토를 계속 입고 있는 장면과 비교했어요.',
      exceptions: '망토를 바꿨다는 설명을 찾지 못했어요.',
    }),
    typoDetail(3, { outcome: 'SPELLING', reason: '‘되어요’의 준말은 ‘돼요’예요.', start: 52, end: 54, quote: '되요', replacement: '돼요' }),
  ];
}

function summaryOf(detail: Detail) {
  const payload = detail.payload as Record<string, unknown>;
  const spans = detail.branch === 'TYPO' ? [payload.span] : payload.target_spans as unknown[];
  return {
    ...clone(review.responses.findingSummary),
    findingId: detail.findingId, branch: detail.branch, unitRef: detail.unitRef, checkId: detail.checkId,
    checkRevision: detail.checkRevision, outcome: detail.outcome, judgment: detail.judgment, changed: detail.changed,
    subject: detail.subject, settingName: detail.settingName, settingKey: detail.settingKey,
    summary: {
      impact: detail.branch === 'SETTING' ? payload.impact as string : null as unknown as string,
      reason: payload.reason as string,
      replacement: detail.branch === 'TYPO' ? payload.replacement as string : null,
      spans: (spans as Array<Record<string, unknown>>).map(span => ({ sourceRef: span.source_ref, start: span.start, end: span.end, quote: span.quote })),
    },
  };
}

export type ReportScenario = {
  findings?: Detail[];
  staging?: Partial<Staging>;
  summary?: Partial<Summary>;
  results?: Record<string, unknown>;
  history?: HistoryRow[];
  currentReportMissing?: boolean;
  /** 회차 단위 자격 조회(GET /eligibility?episodeId=)의 값. 기본은 현재 report가 있는 최신 회차다. */
  eligibility?: Record<string, unknown>;
  /** 설정 관리 화면의 캐릭터·세계관 상세(A5·A10). 기본은 basis가 가리키는 대상 세 개다. */
  characters?: CharacterDetail[];
  worldSettings?: WorldDetail[];
};

type Failure = { status: number; code: string; message: string; context?: Record<string, unknown> };

const characterSetting = (prefix: string, name: string, value: string) => ({
  key: `${prefix}${name}`, displayName: name, value, valueType: 'STRING', attributeNameEditable: true, attributeNamePrefix: prefix,
  displayNameEditable: true, properties: [] as Array<{ key: string; displayName: string; value: string | null; valueType: string }>, sourceFacts: [], hasEvidence: false,
});
type CharacterDetail = {
  id: string; name: string; roleLabel: string | null; currentAge: number | null; currentLevel: number | null;
  profile: ReturnType<typeof characterSetting>[]; stats: ReturnType<typeof characterSetting>[]; skills: ReturnType<typeof characterSetting>[];
  items: ReturnType<typeof characterSetting>[]; statuses: ReturnType<typeof characterSetting>[];
};
type WorldDetail = {
  id: string; category: string; subjectName: string; version: number;
  properties: Array<{ scopeName: string | null; settingName: string; value: string }>;
};

/** 설정 관리 목 데이터. 정정 대상은 계약 basis의 targetId와 같다. 원문 인용은 넣지 않는다. */
function defaultCharacters(): CharacterDetail[] {
  return [
    { id: CHARACTER_ID, name: '비요른', roleLabel: '주인공', currentAge: 27, currentLevel: null,
      profile: [characterSetting('profile.', '출신', '북부')], stats: [], skills: [], items: [characterSetting('item.', '검', '부서진 검')], statuses: [] },
    { id: ERWEN_ID, name: '에르웬', roleLabel: '마법사', currentAge: 24, currentLevel: null,
      profile: [characterSetting('profile.', '망토', '푸른 망토')], stats: [], skills: [], items: [], statuses: [] },
  ];
}

function defaultWorldSettings(): WorldDetail[] {
  return [{
    id: WORLD_ID, category: 'LOCATION', subjectName: '왕궁', version: 4,
    properties: [
      { scopeName: null, settingName: '위치', value: '수도 중심' },
      { scopeName: '마법', settingName: '사용 제한', value: '왕궁 안에서는 누구도 마법을 사용할 수 없다' },
    ],
  }];
}

/** 회차 상세(GET /episodes/{id}). 원문은 목 응답에 넣지 않는다. */
function episodeDetail(revision: number) {
  const suffix = revision.toString(16).padStart(2, '0');
  return {
    id: EPISODE_ID, workId: WORK_ID, episodeNo: 101, title: '성문 앞에서', content: '',
    originalFilename: revision > 3 ? '101-revised.txt' : '101.txt',
    contentUpdatedAt: revision > 3 ? '2026-10-30T12:00:00' : '2026-10-30T09:00:00',
    contentS3Key: `works/${WORK_ID}/episodes/101-r${revision}.txt`, contentS3Version: `synthetic-v${revision}`,
    contentHash: `${suffix}`.repeat(32), charCount: 5200, status: 'UPLOADED', contentRevision: revision,
  };
}

const success = (route: Route, data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, message: '성공', data, error: null }) });
const failure = (route: Route, status: number, code: string, message: string, context: Record<string, unknown> = {}) => route.fulfill({
  status, contentType: 'application/json',
  body: JSON.stringify({ success: false, message, data: null, error: { code, status, details: [], context } }),
});

export async function mockValidationReport(page: Page, scenario: ReportScenario = {}) {
  const state = {
    findings: clone(scenario.findings ?? defaultFindings()),
    staging: { ...clone(stagingFixture.awaitingReview), ...scenario.staging } as Staging,
    summaryPatch: { ...scenario.summary } as Partial<Summary>,
    results: clone(scenario.results ?? resultsFixture.completed) as Record<string, unknown>,
    history: clone(scenario.history ?? review.responses.historyPage.content),
    judgmentFailure: null as null | { code: string; message: string; external?: { findingId: string; judgment: Judgment } },
    requests: [] as Array<{ method: string; path: string; body: unknown }>,
    findingQueries: [] as string[],
    detailGets: 0,
    episodeRevision: scenario.staging?.targetRevision ?? stagingFixture.awaitingReview.targetRevision,
    pastReports: new Map<string, Staging>(),
    eligibility: { ...clone(review.responses.eligibilityReportExists), episodeId: EPISODE_ID, ...scenario.eligibility } as Record<string, unknown>,
    replaceFailure: null as Failure | null,
    recheckFailure: null as Failure | null,
    /** true면 재검수 report를 만든 뒤 응답을 끊는다(응답 유실). */
    recheckResponseLost: false,
    /** 테스트가 풀어 줄 때까지 재검수·현재 검수 응답을 붙잡아 둔다. */
    recheckHold: null as Promise<void> | null,
    currentHold: null as Promise<void> | null,
    episodeDetailHold: null as Promise<void> | null,
    characters: clone(scenario.characters ?? defaultCharacters()),
    worldSettings: clone(scenario.worldSettings ?? defaultWorldSettings()),
    correctionFailure: null as Failure | null,
    /** true면 정정을 저장한 뒤 응답을 끊는다(응답 유실). */
    correctionResponseLost: false,
    /** 발급한 정정 receipt. 같은 키 재전송은 같은 receipt를 돌려준다. */
    corrections: new Map<string, { correctionId: string; body: string; reportVersion: number }>(),
  };

  const counts = () => {
    const current = state.findings.filter(item => !item.stale);
    const of = (branch: string, value: Judgment) => current.filter(item => item.branch === branch && item.judgment.value === value).length;
    const total = (branch: string) => current.filter(item => item.branch === branch).length;
    return {
      settingTotal: total('SETTING'), settingPending: of('SETTING', 'PENDING'), settingNeedsFix: of('SETTING', 'NEEDS_FIX'), settingNotConflict: of('SETTING', 'NOT_CONFLICT'),
      typoTotal: total('TYPO'), typoPending: of('TYPO', 'PENDING'), typoNeedsFix: of('TYPO', 'NEEDS_FIX'), typoKeepOriginal: of('TYPO', 'KEEP_ORIGINAL'),
    };
  };
  // Backend ValidationReviewGate의 공개 결과만 흉내 낸다. 화면은 이 응답 필드로만 권한을 판단한다.
  const summary = (): Summary => {
    const value = counts();
    const pending = value.settingPending + value.typoPending;
    const needsFix = value.settingNeedsFix + value.typoNeedsFix;
    const explicit = pending === 0 && needsFix === 0;
    return {
      ...clone(review.responses.reviewSummary),
      reportId: state.staging.reportId,
      reportVersion: state.staging.reportVersion,
      executionStatus: state.staging.executionStatus,
      mode: state.staging.mode,
      counts: value,
      judgmentLocked: false,
      lockReason: null as unknown as string,
      canCompleteReview: explicit,
      completionMode: explicit ? 'EXPLICIT_REQUIRED' : 'BLOCKED',
      holdReasons: [...(pending ? ['PENDING_JUDGMENTS'] : []), ...(needsFix ? ['NEEDS_FIX_PENDING'] : [])],
      allowedActions: ['SAVE_JUDGMENT', ...(explicit ? ['COMPLETE_REVIEW'] : [])],
      completion: null as unknown as Summary['completion'],
      releaseHold: null,
      application: null as unknown as Summary['application'],
      extractionState: 'NOT_STARTED',
      reviewStage: state.staging.reviewStage,
      ...state.summaryPatch,
    } as Summary;
  };
  const bump = () => { state.staging.reportVersion += 1; };
  // 원고 교체: Backend처럼 현재 report를 퇴역시키지 않고 무효로 만들고 재검수만 허용한다.
  const invalidate = () => {
    state.staging = { ...state.staging, status: 'INVALIDATED', baselineStatus: 'INVALIDATED', reviewStage: 'INVALIDATED', baselineHash: null as unknown as string, reportVersion: state.staging.reportVersion + 1 };
    state.summaryPatch = { ...state.summaryPatch, reviewStage: 'INVALIDATED', judgmentLocked: true, lockReason: 'REPORT_INVALIDATED', allowedActions: ['RECHECK'], holdReasons: ['REPORT_INVALIDATED'] } as Partial<Summary>;
    state.findings = [];
  };
  // 재검수: 이전 report는 이력으로 남고 새 report가 현재가 된다. 확정한 회차는 결과 전용 재검수다.
  const recheck = () => {
    const previous = state.staging;
    const applied = (summary().application as { status?: string } | null)?.status === 'APPLIED' || previous.mode === 'DIAGNOSTIC_ONLY';
    state.pastReports.set(previous.reportId, { ...previous, current: false, status: 'INVALIDATED', baselineStatus: 'INVALIDATED', reviewStage: 'INVALIDATED', executionStatus: 'CANCELED' });
    state.staging = {
      ...previous, reportId: RECHECK_REPORT_ID, baselineId: RECHECK_REPORT_ID, batchId: previous.status === 'INVALIDATED' ? REPLACED_BATCH_ID : previous.batchId,
      revision: previous.revision + 1, reportVersion: 1, baselineRevision: previous.baselineRevision + 1, previousReportId: previous.reportId,
      mode: applied ? 'DIAGNOSTIC_ONLY' : 'BEFORE_CONFIRMATION', targetRevision: state.episodeRevision, executionStatus: 'QUEUED',
      status: 'WAITING_FOR_ERROR_REVIEW', baselineStatus: 'READY', errorReviewStatus: 'NOT_STARTED', reviewStage: 'VALIDATING',
      baselineHash: 'c'.repeat(64), baselineFingerprint: 'c'.repeat(64),
    } as Staging;
    state.summaryPatch = { judgmentLocked: true, lockReason: 'EXECUTION_IN_PROGRESS', allowedActions: [], reviewStage: 'VALIDATING', application: null, completion: null } as unknown as Partial<Summary>;
    state.findings = [];
    state.results = clone(resultsFixture.notStarted) as Record<string, unknown>;
  };

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (method !== 'GET') {
      let body: unknown = null;
      try { body = request.postDataJSON(); } catch { body = '(multipart)'; }
      state.requests.push({ method, path, body });
    }
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'report@example.com', displayName: '리포트 테스트', role: 'AUTHOR', status: 'ACTIVE', phoneVerified: false });
    if (path === `/api/v1/works/${WORK_ID}`) return success(route, { id: WORK_ID, title: '돌아온 검', genre: '판타지', lifecycleStatus: 'ACTIVE', latestEpisodeNo: 101 });
    if (path === '/api/v1/works') return success(route, [{ id: WORK_ID, title: '돌아온 검', genre: '판타지', episodeCount: 101, lifecycleStatus: 'ACTIVE' }]);
    if (path === `/api/v1/works/${WORK_ID}/episodes`) {
      const detail = episodeDetail(state.episodeRevision);
      return success(route, [{ id: EPISODE_ID, episodeNo: 101, title: '성문 앞에서', charCount: 5200, status: 'UPLOADED', batchId: state.staging.batchId,
        originalFilename: detail.originalFilename, contentUpdatedAt: detail.contentUpdatedAt,
        analysisStatus: state.staging.status === 'INVALIDATED' ? 'ERROR_REVIEW_INVALIDATED' : 'ERROR_REVIEW_PENDING',
        validationReportId: state.staging.reportId, validationReviewStage: state.staging.reviewStage }]);
    }
    if (path === `/api/v1/works/${WORK_ID}/episodes/${EPISODE_ID}`) {
      if (state.episodeDetailHold) { const hold = state.episodeDetailHold; state.episodeDetailHold = null; await hold; }
      return success(route, episodeDetail(state.episodeRevision));
    }
    if (path === `/api/v1/works/${WORK_ID}/episodes/${EPISODE_ID}/file` && method === 'PUT') {
      if (state.replaceFailure) {
        const { status, code, message } = state.replaceFailure;
        state.replaceFailure = null;
        return failure(route, status, code, message);
      }
      state.episodeRevision += 1;
      invalidate();
      return success(route, { id: EPISODE_ID, episodeNo: 101, title: '성문 앞에서', analysisStatus: 'ERROR_REVIEW_INVALIDATED', validationReportId: state.staging.reportId });
    }
    if (path === `/api/v1/works/${WORK_ID}/analysis-jobs/batches`) return success(route, { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, hasNext: false });
    // 설정 관리(A5·A10). 일반 저장은 Backend처럼 version을 올리고 현재 report를 무효로 만든다.
    if (path === `/api/v1/works/${WORK_ID}/characters`) {
      const content = state.characters.map(({ id, name, roleLabel }) => ({ id, name, roleLabel }));
      return success(route, { content, page: 0, size: 24, totalElements: content.length, totalPages: 1, hasNext: false });
    }
    const characterMatch = new RegExp(`^/api/v1/works/${WORK_ID}/characters/([0-9a-f-]{36})$`).exec(path);
    if (characterMatch) {
      const character = state.characters.find(item => item.id === characterMatch[1]);
      if (!character) return failure(route, 404, 'CHARACTER_NOT_FOUND', '캐릭터를 찾을 수 없습니다.');
      if (method === 'PATCH') {
        const body = request.postDataJSON() as { items: Array<{ key: string; value: string | null }> };
        for (const item of body.items ?? []) {
          const target = character.items.find(existing => existing.key === item.key);
          if (target) target.value = item.value ?? '';
        }
        invalidate();
      }
      return success(route, character);
    }
    if (path === `/api/v1/works/${WORK_ID}/world-settings`) {
      const content = state.worldSettings.map(({ id, category, subjectName, version, properties }) => ({ id, category, subjectName, version, propertyCount: properties.length }));
      return success(route, { totalWorldSettingCount: content.length, worldSettings: { content, page: 0, size: 24, totalElements: content.length, totalPages: 1, hasNext: false } });
    }
    const worldMatch = new RegExp(`^/api/v1/works/${WORK_ID}/world-settings/([0-9a-f-]{36})(/properties)?$`).exec(path);
    if (worldMatch) {
      const world = state.worldSettings.find(item => item.id === worldMatch[1]);
      if (!world) return failure(route, 404, 'WORLD_SETTING_NOT_FOUND', '대상을 찾을 수 없습니다.');
      if (worldMatch[2] && method === 'PATCH') {
        const body = request.postDataJSON() as { currentScopeName?: string | null; currentSettingName: string; settingValue: string };
        const property = world.properties.find(item => (item.scopeName ?? null) === (body.currentScopeName ?? null) && item.settingName === body.currentSettingName);
        if (property) property.value = body.settingValue;
        world.version += 1;
        invalidate();
      }
      return success(route, world);
    }
    const base = `/api/v1/works/${WORK_ID}/episode-validations`;
    if (path === `${base}/current`) {
      if (state.currentHold) { const hold = state.currentHold; state.currentHold = null; await hold; }
      if (scenario.currentReportMissing) return failure(route, 404, 'VALIDATION_NOT_FOUND', '검수 결과를 찾을 수 없습니다.');
      return success(route, state.staging);
    }
    if (path === `${base}/eligibility`) {
      return success(route, url.searchParams.get('episodeId') ? state.eligibility : { ...clone(review.responses.eligibilityWorkOnlyBlocked) });
    }
    if (path === `${base}/history`) {
      return success(route, { ...clone(review.responses.historyPage), content: state.history, totalElements: state.history.length });
    }
    const match = new RegExp(`^${base}/([0-9a-f-]{36})(/.*)?$`).exec(path);
    if (!match) return success(route, []);
    const [, reportId, rest = ''] = match;
    if (reportId === PAST_REPORT_ID && rest === '') {
      return success(route, { ...state.staging, reportId: PAST_REPORT_ID, baselineId: PAST_REPORT_ID, current: false, revision: 1, status: 'INVALIDATED', baselineStatus: 'INVALIDATED', executionStatus: 'CANCELED', reviewStage: 'INVALIDATED', previousReportId: null });
    }
    const past = state.pastReports.get(reportId);
    if (past && rest === '') return success(route, past);
    if (past && rest === '/review') return success(route, { ...summary(), reportId, reportVersion: past.reportVersion, reviewStage: 'INVALIDATED', allowedActions: [] });
    if (reportId !== state.staging.reportId) return failure(route, 404, 'VALIDATION_NOT_FOUND', '검수 결과를 찾을 수 없습니다.');
    if (rest === '') return success(route, state.staging);
    if (rest === '/review') return success(route, summary());
    if (rest === '/results') return success(route, { ...state.results, reportVersion: state.staging.reportVersion });
    if (rest === '/findings') {
      state.findingQueries.push(url.search);
      const branch = url.searchParams.get('branch');
      const judgment = url.searchParams.get('judgment');
      const outcome = url.searchParams.get('outcome');
      const impact = url.searchParams.get('impact');
      const subjectType = url.searchParams.get('subjectType');
      const pageNo = Number(url.searchParams.get('page') ?? 0);
      const size = Number(url.searchParams.get('size') ?? 20);
      // 목록은 Backend처럼 현재 revision 항목만 돌려준다. 등급·대상 필터는 오탈자와 대상 없는 항목을 뺀다(#314 B2).
      const filtered = state.findings.filter(item => !item.stale && (!branch || item.branch === branch)
        && (!judgment || item.judgment.value === judgment) && (!outcome || item.outcome === outcome)
        && (!impact || (item.branch === 'SETTING' && (item.payload as Record<string, unknown>).impact === impact))
        && (!subjectType || (item.branch === 'SETTING' && item.subject?.type === subjectType)));
      const content = filtered.slice(pageNo * size, pageNo * size + size).map(summaryOf);
      return success(route, { content, page: pageNo, size, totalElements: filtered.length, totalPages: Math.ceil(filtered.length / size), hasNext: (pageNo + 1) * size < filtered.length });
    }
    const findingMatch = /^\/findings\/([0-9a-f-]{36})(\/judgment)?$/.exec(rest);
    if (findingMatch) {
      const finding = state.findings.find(item => item.findingId === findingMatch[1]);
      if (!finding) return failure(route, 404, 'VALIDATION_FINDING_NOT_FOUND', '발견 항목을 찾을 수 없습니다.');
      if (!findingMatch[2]) { state.detailGets += 1; return success(route, finding); }
      const body = request.postDataJSON() as { judgment: Judgment; expectedJudgmentVersion?: number };
      if (state.judgmentFailure) {
        const { code, message, external } = state.judgmentFailure;
        state.judgmentFailure = null;
        if (external) {
          const target = state.findings.find(item => item.findingId === external.findingId)!;
          target.judgment = { value: external.judgment, version: target.judgment.version + 1, decidedAt: '2026-10-30T11:20:00' };
          bump();
        }
        return failure(route, 409, code, message);
      }
      if ((body.expectedJudgmentVersion ?? 0) !== finding.judgment.version) return failure(route, 409, 'VALIDATION_JUDGMENT_VERSION_CONFLICT', '판단이 바뀌었습니다.');
      if (body.judgment !== finding.judgment.value) {
        finding.judgmentHistory = [...finding.judgmentHistory, { findingId: finding.findingId, checkRevision: finding.checkRevision, fromJudgment: finding.judgment.value, toJudgment: body.judgment, reason: 'AUTHOR', changeReason: null as unknown as string, createdAt: '2026-10-30T11:10:00' }];
        finding.judgment = { value: body.judgment, version: finding.judgment.version + 1, decidedAt: '2026-10-30T11:10:00' };
        bump();
      }
      return success(route, summaryOf(finding));
    }
    if (rest === '/review-completion') {
      state.staging.reviewStage = 'REVIEW_COMPLETED';
      state.summaryPatch = { ...state.summaryPatch, completionMode: 'COMPLETED', canCompleteReview: false, judgmentLocked: true, lockReason: 'REVIEW_COMPLETED', allowedActions: ['APPLY_SETTINGS'], extractionState: 'RUNNING', completion: review.responses.reviewSummary.completion };
      bump();
      return success(route, { ...clone(review.responses.reviewCompletion), reportId: state.staging.reportId });
    }
    if (rest === '/settings-application') {
      state.staging.reviewStage = 'APPLIED';
      state.summaryPatch = { ...state.summaryPatch, allowedActions: [], application: { ...clone(review.responses.reviewSummary.application), status: 'APPLIED', holdReasons: [], appliedAt: '2026-10-30T11:30:00' } as Summary['application'], reviewStage: 'APPLIED' };
      bump();
      return success(route, { ...clone(review.responses.settingsApplication), status: 'APPLIED', holdReasons: [], appliedAt: '2026-10-30T11:30:00', lastErrorCode: null });
    }
    if (rest === '/corrections') {
      // Backend ValidationCorrectionServiceImpl: 같은 키는 원래 receipt, 그 밖에는 설정 편집과 receipt를 함께 저장한다.
      const body = request.postDataJSON() as { idempotencyKey: string; expectedReportVersion: number; character?: { targetId: string; edit: { items: Array<{ key: string; value: string | null }> } }; worldSetting?: { targetId: string; edit: { currentScopeName?: string | null; currentSettingName: string; settingValue: string } } };
      const existing = state.corrections.get(body.idempotencyKey);
      const receipt = (correctionId: string, reportVersion: number) => ({ correctionId, reportId: state.staging.reportId, reportVersion,
        baselineId: state.staging.baselineId, baselineRevision: state.staging.baselineRevision, baselineHash: 'a'.repeat(64), entryRef: 'B1', entityVersion: 4 });
      if (existing) return success(route, receipt(existing.correctionId, existing.reportVersion));
      if (state.correctionFailure) {
        const { status, code, message } = state.correctionFailure;
        state.correctionFailure = null;
        return failure(route, status, code, message);
      }
      if (body.expectedReportVersion !== state.staging.reportVersion) return failure(route, 409, 'VALIDATION_REPORT_VERSION_CONFLICT', '검수 상태가 바뀌었습니다.');
      if (body.character) {
        const character = state.characters.find(item => item.id === body.character!.targetId)!;
        for (const item of body.character.edit.items) {
          const target = character.items.find(existing => existing.key === item.key);
          if (target) target.value = item.value ?? '';
        }
      }
      if (body.worldSetting) {
        const world = state.worldSettings.find(item => item.id === body.worldSetting!.targetId)!;
        const edit = body.worldSetting.edit;
        const property = world.properties.find(item => (item.scopeName ?? null) === (edit.currentScopeName ?? null) && item.settingName === edit.currentSettingName);
        if (property) property.value = edit.settingValue;
        world.version += 1;
      }
      // 실제 편집이 기준을 무효로 만들고 receipt는 그 뒤의 report version을 기록한다.
      invalidate();
      state.corrections.set(body.idempotencyKey, { correctionId: CORRECTION_RECEIPT_ID, body: JSON.stringify(body), reportVersion: state.staging.reportVersion });
      if (state.correctionResponseLost) { state.correctionResponseLost = false; return route.abort('failed'); }
      return success(route, receipt(CORRECTION_RECEIPT_ID, state.staging.reportVersion));
    }
    if (rest === '/rechecks') {
      if (state.recheckFailure) {
        const { status, code, message, context } = state.recheckFailure;
        state.recheckFailure = null;
        return failure(route, status, code, message, context);
      }
      const recheckBody = request.postDataJSON() as { correctionReceiptId?: string };
      if (recheckBody.correctionReceiptId && ![...state.corrections.values()].some(item => item.correctionId === recheckBody.correctionReceiptId
        && item.reportVersion === state.staging.reportVersion)) {
        return failure(route, 409, 'VALIDATION_CORRECTION_CONFLICT', '정정 기록을 확인할 수 없습니다.');
      }
      if (state.recheckHold) { const hold = state.recheckHold; state.recheckHold = null; await hold; }
      recheck();
      if (state.recheckResponseLost) { state.recheckResponseLost = false; return route.abort('failed'); }
      return success(route, state.staging);
    }
    if (rest === '/retries') {
      state.staging.executionStatus = 'QUEUED';
      state.staging.reviewStage = 'VALIDATING';
      state.summaryPatch = { ...state.summaryPatch, executionStatus: 'QUEUED', judgmentLocked: true, lockReason: 'EXECUTION_IN_PROGRESS', allowedActions: [], reviewStage: 'VALIDATING' };
      bump();
      return success(route, state.staging);
    }
    return success(route, []);
  });

  return {
    state,
    summary,
    url: (query = '') => `/episode-validation-report?workId=${WORK_ID}&reportId=${state.staging.reportId}${query}`,
    patchStaging: (values: Partial<Staging>) => { Object.assign(state.staging, values); },
    patchSummary: (values: Partial<Summary>) => { state.summaryPatch = { ...state.summaryPatch, ...values }; },
    failNextJudgment: (failure: NonNullable<typeof state.judgmentFailure>) => { state.judgmentFailure = failure; },
    failNextReplace: (failure: Failure) => { state.replaceFailure = failure; },
    failNextRecheck: (failure: Failure) => { state.recheckFailure = failure; },
    failNextCorrection: (failure: Failure) => { state.correctionFailure = failure; },
    loseNextCorrectionResponse: () => { state.correctionResponseLost = true; },
    loseNextRecheckResponse: () => { state.recheckResponseLost = true; },
    holdNextRecheck: () => { let release!: () => void; state.recheckHold = new Promise<void>(resolve => { release = resolve; }); return () => release(); },
    holdNextEpisodeDetail: () => { let release!: () => void; state.episodeDetailHold = new Promise<void>(resolve => { release = resolve; }); return () => release(); },
    holdNextCurrent: () => { let release!: () => void; state.currentHold = new Promise<void>(resolve => { release = resolve; }); return () => release(); },
    requestsTo: (suffix: string, method = 'POST') => state.requests.filter(item => item.method === method && item.path.endsWith(suffix)),
    episodeDetail: () => episodeDetail(state.episodeRevision),
    judgmentPatches: () => state.requests.filter(request => request.method === 'PATCH'),
  };
}

export async function authenticate(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'validation-report-test'));
}

export function findingId(index: number) {
  return findingIds[index];
}
