import type {
  CharacterCorrection,
  ValidationFindingBasis,
  ValidationFindingDetailResponse,
  ValidationStagingResponse,
} from '../../../api/generated/types.gen';
import { SUBJECT_TYPE_LABELS, validationReportUrl, type SubjectType } from './validation-report-labels';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENUM = /^[A-Z_]{1,40}$/;
const PAGE = /^[1-9]\d{0,4}$/;
const ENTRY_REF = /^B[1-9]\d{0,5}$/;
const HASH = /^[0-9a-f]{32,128}$/i;
const VERSION = /^(0|[1-9]\d{0,9})$/;
// 설정명·경로 이름은 식별자로만 옮긴다. 줄바꿈 등 제어 문자가 섞인 값은 버린다.
const NAME = /^[^\p{Cc}]{1,200}$/u;

const REPORT_RETURN_VALUE = 'validation-report';
/** A5 대상 설정 보기로 열었음을 대시보드 안내에 알리는 값. 정정 문맥과 구분한다. */
export const REPORT_VIEW_SUBJECT = 'subject';

/**
 * 리포트 URL의 선택·필터 키와 복귀 문맥 키. 원고 목록의 `page`와 겹치지 않도록 `report` 접두사를 붙인다.
 * 인용·근거·원문·설정값은 넣지 않고 식별자와 필터 값만 옮긴다. 정정 receipt는 다른 수정 화면을 거쳐도 재검수까지 이어지게 그대로 옮긴다.
 */
const RETURN_PAIRS = [
  ['findingId', 'reportFindingId', (value: string) => UUID.test(value)],
  ['branch', 'reportBranch', (value: string) => value === 'SETTING' || value === 'TYPO'],
  ['judgment', 'reportJudgment', (value: string) => ENUM.test(value)],
  ['outcome', 'reportOutcome', (value: string) => ENUM.test(value)],
  ['impact', 'reportImpact', (value: string) => ENUM.test(value)],
  ['subjectType', 'reportSubjectType', (value: string) => ENUM.test(value)],
  ['page', 'reportPage', (value: string) => PAGE.test(value)],
  ['correctionReceiptId', 'correctionReceiptId', (value: string) => UUID.test(value)],
] as const;

export type ReportReturn = { reportId: string; url: string };

function returnQuery(reportId: string, reportParams: URLSearchParams) {
  const params = new URLSearchParams({ returnTo: REPORT_RETURN_VALUE, reportId });
  for (const [source, target, valid] of RETURN_PAIRS) {
    const value = reportParams.get(source);
    if (value && valid(value)) params.set(target, value);
  }
  return params.toString();
}

function settingDbUrl(workId: string, type: SubjectType, targetId: string) {
  const base = `/dashboard?workId=${encodeURIComponent(workId)}&nav=settingDB`;
  return type === 'CHARACTER'
    ? `${base}&tab=characters&modal=char-detail&charId=${encodeURIComponent(targetId)}`
    : `${base}&tab=worldsettings&settingId=${encodeURIComponent(targetId)}`;
}

export type SubjectLink = { url: string; label: string } | { url: null; lockReason: string };

/**
 * A5 `대상 설정 보기`. 서버가 고정 기준에서 연결한 실제 캐릭터·세계관 ID가 있을 때만 그 상세를 연다.
 * ID가 없으면 이름이 같은 설정을 찾아 연결하지 않고 잠근다(#314 B2 `subject.id`).
 */
export function subjectLink(workId: string, reportId: string, detail: ValidationFindingDetailResponse, reportParams: URLSearchParams): SubjectLink {
  const subject = detail.subject;
  const type = subject?.type;
  if (!subject || !type || !SUBJECT_TYPE_LABELS[type]) return { url: null, lockReason: '연결된 대상이 없어요.' };
  if (!subject.id || !UUID.test(subject.id)) {
    return { url: null, lockReason: '연결된 대상이 없어요. 이름이 같은 설정으로 대신 연결하지 않아요.' };
  }
  return {
    url: `${settingDbUrl(workId, type, subject.id)}&${returnQuery(reportId, reportParams)}&reportView=${REPORT_VIEW_SUBJECT}`,
    label: [SUBJECT_TYPE_LABELS[type], subject.name].filter(Boolean).join(' · '),
  };
}

type FactType = CharacterCorrection['factType'];
const FACT_TYPES: ReadonlySet<string> = new Set<FactType>(['PROFILE', 'AGE', 'LEVEL', 'STAT', 'SKILL', 'ITEM', 'STATUS', 'TIME']);

/**
 * A10 정정 문맥. 발견 항목 상세의 `basis[i]`와 report 단건 조회의 고정 기준 값만 옮긴다(Backend validation-execution-v1.md
 * "발견 항목에서 정정 요청 만들기"). 화면이 새로 만들거나 추측한 값은 없다. reportVersion은 판단마다 오르므로 요청 직전에 다시 읽는다.
 */
export type CorrectionContext = {
  reportId: string;
  baselineId: string;
  baselineRevision: number;
  baselineHash: string;
  entryRef: string;
  entryHash: string;
  subjectType: SubjectType;
  targetId: string;
  /** 고정 기준 당시 캐릭터 snapshotVersion 또는 세계관 version. 캐릭터 expectedSnapshotVersion·세계관 expectedVersion */
  currentVersion: number;
  /** 캐릭터: basis가 가리키는 slot. 없으면 작가가 바꾼 slot 하나를 쓴다. */
  factType: FactType | null;
  factKey: string | null;
  /** 세계관: basis가 가리키는 저장 경로. settingName이 없으면 작가가 고른 현재 경로를 쓴다. */
  scopeName: string | null;
  settingName: string | null;
};

const CORRECTION_PARAMS = {
  baselineId: 'correctionBaselineId',
  baselineRevision: 'correctionBaselineRevision',
  baselineHash: 'correctionBaselineHash',
  entryRef: 'correctionEntryRef',
  entryHash: 'correctionEntryHash',
  subjectType: 'correctionSubjectType',
  targetId: 'correctionTargetId',
  currentVersion: 'correctionVersion',
  factType: 'correctionFactType',
  factKey: 'correctionFactKey',
  scopeName: 'correctionScopeName',
  settingName: 'correctionSettingName',
} as const;

/** 정정이 끝나면(연결 성공·기준 연결 없이 저장) 지우는 정정 요청 키. */
export const CORRECTION_PARAM_KEYS: readonly string[] = Object.values(CORRECTION_PARAMS);
/** 정정 결과(`linked`·`unlinked`). 새로고침 뒤에도 결과 안내를 유지한다. */
export const CORRECTION_RESULT_KEY = 'correctionResult';
export const CORRECTION_RECEIPT_KEY = 'correctionReceiptId';

/** 작가가 고를 저장 설정 하나. 정정 문맥을 만들 수 없으면 context 없이 잠금 사유를 둔다. */
export type CorrectionChoice = { key: string; label: string } & ({ context: CorrectionContext } | { context: null; lockReason: string });

/** 작가가 고를 저장 설정의 이름. `대상 · 설정명`이며 설정명을 모르면 대상 이름만 쓴다(내부 참조는 쓰지 않는다). */
function basisLabel(basis: ValidationFindingBasis, detail: ValidationFindingDetailResponse) {
  // slot·경로는 finding의 설정명이 그 항목을 가리킬 때만 서버가 채운다.
  const setting = basis.subjectType === 'WORLD_SETTING'
    ? basis.settingName ? [basis.scopeName, basis.settingName].filter(Boolean).join(' / ') : null
    : basis.factType ? detail.settingName ?? null : null;
  const name = [basis.subjectName, setting].filter(Boolean).join(' · ');
  return name || (basis.subjectType ? `${SUBJECT_TYPE_LABELS[basis.subjectType]} 설정` : '저장된 설정');
}

/**
 * A10 정정할 저장 설정 목록. basis가 여러 개면 작가가 고르고 하나면 그것을 쓴다(#428부터 리포트 위 정정 창의 문맥으로 쓴다).
 * 고정 기준(baselineHash)이 없거나 당시 version이 없는 항목은 정정 요청을 만들 수 없어 잠근다.
 * 문맥은 대시보드 주소로 받은 정정 문맥과 같은 검증(`readCorrectionContext`)을 거친다.
 */
export function correctionChoices(
  reportId: string,
  staging: ValidationStagingResponse | undefined,
  detail: ValidationFindingDetailResponse,
): CorrectionChoice[] {
  const baselineReady = Boolean(staging?.baselineId && staging.baselineRevision != null && staging.baselineHash);
  const unlinkable = '연결된 저장 설정을 확인할 수 없어 정정으로 연결할 수 없어요.';
  return (detail.basis ?? []).map((basis, index) => {
    const key = `${basis.entryRef ?? index}:${basis.targetId ?? ''}`;
    const label = basisLabel(basis, detail);
    const type = basis.subjectType;
    if (!baselineReady) return { key, label, context: null, lockReason: '검사 기준을 확인할 수 없어 정정으로 연결할 수 없어요.' };
    if (basis.currentVersion == null) return { key, label, context: null, lockReason: '검사 당시 설정 버전이 없어 정정으로 연결할 수 없어요.' };
    if (!type || !basis.targetId || !UUID.test(basis.targetId) || !basis.entryRef || !ENTRY_REF.test(basis.entryRef)
      || !basis.entryHash || !HASH.test(basis.entryHash)) {
      return { key, label, context: null, lockReason: unlinkable };
    }
    const params = new URLSearchParams({
      [CORRECTION_PARAMS.baselineId]: staging!.baselineId!,
      [CORRECTION_PARAMS.baselineRevision]: String(staging!.baselineRevision),
      [CORRECTION_PARAMS.baselineHash]: staging!.baselineHash!,
      [CORRECTION_PARAMS.entryRef]: basis.entryRef,
      [CORRECTION_PARAMS.entryHash]: basis.entryHash,
      [CORRECTION_PARAMS.subjectType]: type,
      [CORRECTION_PARAMS.targetId]: basis.targetId,
      [CORRECTION_PARAMS.currentVersion]: String(basis.currentVersion),
    });
    if (type === 'CHARACTER' && basis.factType && basis.factKey) {
      params.set(CORRECTION_PARAMS.factType, basis.factType);
      params.set(CORRECTION_PARAMS.factKey, basis.factKey);
    }
    if (type === 'WORLD_SETTING' && basis.settingName) {
      params.set(CORRECTION_PARAMS.settingName, basis.settingName);
      if (basis.scopeName) params.set(CORRECTION_PARAMS.scopeName, basis.scopeName);
    }
    const context = readCorrectionContext(params, reportId);
    return context ? { key, label, context } : { key, label, context: null, lockReason: unlinkable };
  });
}

/** 대시보드 URL의 정정 문맥을 검증해 읽는다. 한 값이라도 형식이 맞지 않으면 정정으로 연결하지 않는다. */
export function readCorrectionContext(params: URLSearchParams, reportId: string): CorrectionContext | null {
  const get = (key: keyof typeof CORRECTION_PARAMS) => params.get(CORRECTION_PARAMS[key]);
  const subjectType = get('subjectType');
  const baselineId = get('baselineId') ?? '';
  const targetId = get('targetId') ?? '';
  const baselineRevision = get('baselineRevision') ?? '';
  const currentVersion = get('currentVersion') ?? '';
  const baselineHash = get('baselineHash') ?? '';
  const entryRef = get('entryRef') ?? '';
  const entryHash = get('entryHash') ?? '';
  if ((subjectType !== 'CHARACTER' && subjectType !== 'WORLD_SETTING') || !UUID.test(baselineId) || !UUID.test(targetId)
    || !VERSION.test(baselineRevision) || !VERSION.test(currentVersion) || !HASH.test(baselineHash)
    || !ENTRY_REF.test(entryRef) || !HASH.test(entryHash)) return null;
  const factType = get('factType');
  const factKey = get('factKey');
  const scopeName = get('scopeName');
  const settingName = get('settingName');
  const characterSlot = subjectType === 'CHARACTER' && factType && factKey;
  if (characterSlot && (!FACT_TYPES.has(factType) || !NAME.test(factKey))) return null;
  if (subjectType === 'WORLD_SETTING' && settingName && (!NAME.test(settingName) || (scopeName != null && !NAME.test(scopeName)))) return null;
  return {
    reportId, baselineId, baselineRevision: Number(baselineRevision), baselineHash, entryRef, entryHash, subjectType, targetId,
    currentVersion: Number(currentVersion),
    factType: characterSlot ? factType as FactType : null,
    factKey: characterSlot ? factKey : null,
    scopeName: subjectType === 'WORLD_SETTING' && settingName ? scopeName : null,
    settingName: subjectType === 'WORLD_SETTING' ? settingName : null,
  };
}

/** 리포트 주소에 붙이면 리포트가 재검수를 한 번 바로 접수하는 표시. 원고 교체를 마친 뒤 한 번 눌러 재검수하기 위함이다. */
export const RECHECK_START_KEY = 'recheck';

export function withRecheckStart(reportUrl: string): string {
  return `${reportUrl}${reportUrl.includes('?') ? '&' : '?'}${RECHECK_START_KEY}=1`;
}

/** 대시보드 URL의 복귀 문맥을 검증해 리포트 주소로 되돌린다. 형식이 맞지 않는 값은 버린다. */
export function readReportReturn(params: URLSearchParams, workId: string): ReportReturn | null {
  if (params.get('returnTo') !== REPORT_RETURN_VALUE) return null;
  const reportId = params.get('reportId') ?? '';
  if (!UUID.test(reportId) || !UUID.test(workId)) return null;
  const extra = new URLSearchParams();
  for (const [source, target, valid] of RETURN_PAIRS) {
    const value = params.get(target);
    if (value && valid(value)) extra.set(source, value);
  }
  const query = extra.toString();
  return { reportId, url: validationReportUrl(workId, reportId, query ? `&${query}` : '') };
}
