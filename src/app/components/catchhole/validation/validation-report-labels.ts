import type {
  ValidationApplicationHoldReason,
  ValidationEligibilityResponse,
  ValidationFindingJudgment,
  ValidationReviewSummaryResponse,
  ValidationStagingResponse,
} from '../../../api/generated/types.gen';

/** 서버 enum은 화면 문구로만 바꾼다. 알 수 없는 값은 내부 이름 대신 일반 문구로 표시한다. */
export type Judgment = NonNullable<ValidationFindingJudgment['value']>;
export type Branch = 'SETTING' | 'TYPO';
export type ReviewStage = NonNullable<ValidationStagingResponse['reviewStage']>;
type ExecutionStatus = NonNullable<ValidationStagingResponse['executionStatus']>;
type HoldReason = NonNullable<ValidationReviewSummaryResponse['holdReasons']>[number];
type LockReason = NonNullable<ValidationReviewSummaryResponse['lockReason']>;

const SETTING_OUTCOMES = ['CONFLICT', 'SUSPECTED_CONFLICT', 'NEEDS_CONTEXT'] as const;
const TYPO_OUTCOMES = ['SPELLING', 'SPACING', 'TYPO'] as const;

const OUTCOME_LABELS: Record<string, string> = {
  CONFLICT: '설정 충돌',
  SUSPECTED_CONFLICT: '충돌 의심',
  NEEDS_CONTEXT: '추가 확인 필요',
  SPELLING: '맞춤법',
  SPACING: '띄어쓰기',
  TYPO: '오타',
};

export function outcomeLabel(outcome?: string | null): string {
  return (outcome && OUTCOME_LABELS[outcome]) || '결과 유형 확인 필요';
}

const IMPACT_LABELS: Record<string, string> = { SEVERE: '심각', CAUTION: '주의', REFERENCE: '참고' };

export function impactLabel(impact?: string | null): string | null {
  return impact ? IMPACT_LABELS[impact] ?? null : null;
}

export const JUDGMENT_LABELS: Record<Judgment, string> = {
  PENDING: '검토 필요',
  NEEDS_FIX: '수정 필요',
  NOT_CONFLICT: '충돌 아님',
  KEEP_ORIGINAL: '원문 유지',
};

export type BranchFilter = Branch | 'ALL';
export type JudgmentFilter = Judgment | 'ALL';

export function judgmentOptions(branch: BranchFilter): Array<{ value: JudgmentFilter; label: string }> {
  return [
    { value: 'PENDING', label: JUDGMENT_LABELS.PENDING },
    { value: 'NEEDS_FIX', label: JUDGMENT_LABELS.NEEDS_FIX },
    ...(branch !== 'TYPO' ? [{ value: 'NOT_CONFLICT' as const, label: JUDGMENT_LABELS.NOT_CONFLICT }] : []),
    ...(branch !== 'SETTING' ? [{ value: 'KEEP_ORIGINAL' as const, label: JUDGMENT_LABELS.KEEP_ORIGINAL }] : []),
    { value: 'ALL', label: '전체' },
  ];
}

export function outcomeOptions(branch: BranchFilter): Array<{ value: string; label: string }> {
  return [
    { value: 'ALL', label: '전체' },
    ...(branch !== 'TYPO' ? SETTING_OUTCOMES.map(value => ({ value, label: outcomeLabel(value) })) : []),
    ...(branch !== 'SETTING' ? TYPO_OUTCOMES.map(value => ({ value, label: outcomeLabel(value) })) : []),
  ];
}

/** 판단 버튼 문구. 설정 검사(A6~A8)와 오탈자(A16~A18)의 의미를 섞지 않는다. */
export function judgmentActionLabel(branch: Branch, judgment: Judgment): string {
  if (judgment === 'PENDING') return '검토 필요로 되돌리기';
  if (branch === 'SETTING') return judgment === 'NEEDS_FIX' ? '수정 필요로 표시' : '충돌 아님으로 표시';
  return judgment === 'NEEDS_FIX' ? '수정 필요' : '원문 유지';
}

export function judgmentActionDescription(branch: Branch, judgment: Judgment): string {
  if (judgment === 'NEEDS_FIX') return branch === 'SETTING'
    ? '판단만 저장해요. 원고와 설정 정보는 바뀌지 않아요.'
    : '판단만 저장해요. 원고 파일을 고친 뒤 다시 검수해 확인해요.';
  return branch === 'SETTING'
    ? '이 항목은 충돌이 아니라고 기록해요. AI의 원래 결과와 사유는 그대로 남아요.'
    : '현재 원고의 이 표현만 그대로 둬요. 다른 위치나 회차에는 적용하지 않아요.';
}

const BASIS_LABELS: Record<string, string> = {
  DIRECT_CONTRADICTION: '같은 대상·시점·조건에서 양립할 수 없는 근거를 확인했어요.',
  CHANGE_NOT_FOUND: '기존 상태와 어긋나 보이지만 그 사이의 변화나 예외를 찾지 못했어요.',
  AMBIGUOUS_MEANING: '대상·시점·해석이 분명하지 않아 비교 판단이 어려워요.',
  DB_RAW_DISAGREEMENT: '비교 기준과 원문이 다름',
};

export function basisLabel(basis?: unknown): string | null {
  return typeof basis === 'string' ? BASIS_LABELS[basis] ?? null : null;
}

export const EXECUTION_LABELS: Record<ExecutionStatus, string> = {
  NOT_STARTED: '검사 전',
  QUEUED: '검사 대기',
  RUNNING: '검사 중',
  PARTIAL: '일부 중단',
  FAILED: '검사 실패',
  COMPLETED: '검사 완료',
  CANCELED: '검사 취소',
};

const BRANCH_STATUS_LABELS: Record<string, string> = {
  COMPLETED: '완료',
  PARTIAL: '일부 완료',
  RUNNING: '진행 중',
  QUEUED: '대기',
  FAILED: '마치지 못함',
  CANCELED: '취소',
  NOT_STARTED: '시작 전',
};

export function branchStatusLabel(status: unknown): string {
  return typeof status === 'string' ? BRANCH_STATUS_LABELS[status] ?? '확인 필요' : '확인 중';
}

export const REVIEW_STAGE_LABELS: Record<ReviewStage, string> = {
  PREPARING_BASELINE: '기준 준비 중',
  VALIDATING: '검사 중',
  AWAITING_REVIEW: '작가 검토',
  REVIEW_COMPLETED: '설정 추출 중',
  EXTRACTION_FAILED: '설정 추출 실패',
  APPLICATION_HELD: '확정 보류',
  APPLIED: '확정 완료',
  HELD_INCOMPLETE: '기준 준비 보류',
  INVALIDATED: '무효',
};

export type StageTone = 'primary' | 'warning' | 'danger' | 'success';

/**
 * 분석 목록 카드·원고 목록 배지·원고 배너가 함께 쓰는 검수 단계 문구. reviewStage만 기준으로 고르며
 * 배치 status·EPISODE_VALIDATION Job 유형으로 단계를 추측하지 않는다.
 */
export const VALIDATION_STAGE_SUMMARY: Record<ReviewStage, { label: string; description: string; tone: StageTone }> = {
  PREPARING_BASELINE: { label: '오류 검사 준비 중', description: '비교할 기준을 준비하고 있어요.', tone: 'primary' },
  VALIDATING: { label: '오류 검사 중', description: '설정 충돌과 오탈자를 확인하고 있어요. 발견한 항목은 리포트에서 바로 읽을 수 있어요.', tone: 'primary' },
  AWAITING_REVIEW: { label: '오류 검토', description: '오류 리포트에서 검사 결과를 확인하고 판단을 남겨 주세요.', tone: 'warning' },
  REVIEW_COMPLETED: { label: '설정 추출 중', description: '검토를 마쳤어요. 이번 회차의 설정을 추출하고 있어요.', tone: 'primary' },
  EXTRACTION_FAILED: { label: '설정 추출 실패', description: '검사와 검토 결과는 그대로 남아 있어요. 추출 상태를 확인해 주세요.', tone: 'danger' },
  APPLICATION_HELD: { label: '확정 보류', description: '이번 시도에서는 어떤 설정도 반영하지 않았어요. 오류 리포트에서 보류 사유를 확인해 주세요.', tone: 'warning' },
  APPLIED: { label: '확정 완료', description: '오류 검토를 마치고 이번 회차의 설정을 확정했어요.', tone: 'success' },
  HELD_INCOMPLETE: { label: '기준 준비 보류', description: '비교할 기준을 준비하지 못했어요.', tone: 'warning' },
  INVALIDATED: { label: '재검수 필요', description: '원고 또는 비교한 설정이 바뀌었어요. 수정 내용을 반영해 다시 검수해 주세요.', tone: 'warning' },
};

/** 결과가 곧 바뀌는 단계. 목록은 이 단계에서만 요약을 다시 읽는다. */
export const ACTIVE_VALIDATION_STAGES: ReadonlySet<ReviewStage> = new Set(['PREPARING_BASELINE', 'VALIDATING', 'REVIEW_COMPLETED']);

/** reviewStage가 없는 구응답의 원고 목록 analysisStatus 표시. 행동 가능 여부 판단에는 쓰지 않는다. */
export const ERROR_REVIEW_STATUS_LABELS: Record<'ERROR_REVIEW_PREPARING' | 'ERROR_REVIEW_PENDING' | 'ERROR_REVIEW_HELD' | 'ERROR_REVIEW_INVALIDATED', string> = {
  ERROR_REVIEW_PREPARING: '오류 검사 중',
  ERROR_REVIEW_PENDING: '오류 검토',
  ERROR_REVIEW_HELD: '오류 검사 보류',
  ERROR_REVIEW_INVALIDATED: '재검수 필요',
};

export const NEXT_EPISODE_BLOCKED_COPY = '이 회차의 검토와 설정 저장을 마친 뒤 다음 회차를 등록할 수 있어요.';
export const MULTI_EPISODE_VALIDATION_REASON = '신규 회차 검수는 마지막 회차 뒤에 새로 추가하는 단일 회차만 지원해요.';

type EligibilityReason = NonNullable<ValidationEligibilityResponse['reasonCode']>;
/**
 * 접수 거절 사유. 서버는 2~6번 사유에 같은 문구를 쓰므로 화면은 reasonCode로 구분한다
 * (Backend docs/validation-review-v1.md "접수 자격 조회").
 */
export const ELIGIBILITY_REASON_COPY: Record<EligibilityReason, string> = {
  ELIGIBLE: '이 회차의 검수를 시작할 수 있어요.',
  REPORT_EXISTS: '이 회차에는 이미 검수가 있어요. 현재 검수를 확인해 주세요.',
  EPISODE_NOT_FOUND: '삭제되었거나 이 작품에 없는 회차라 검수를 시작할 수 없어요.',
  NOT_SINGLE_APPEND_UPLOAD: '마지막 회차 바로 뒤에 단일 회차로 올린 새 원고만 검수할 수 있어요.',
  NOT_LATEST_EPISODE: '이 회차 뒤에 다른 회차가 있어요. 신규 회차 검수는 가장 마지막 회차만 할 수 있어요.',
  SOURCE_PURGE_PENDING: '이전 원문을 정리하고 있어 지금은 검수를 시작할 수 없어요. 잠시 후 다시 시도해 주세요.',
  ANALYSIS_ALREADY_STARTED: '이미 설정 추출을 시작한 회차라 검수를 시작할 수 없어요.',
  NEXT_EPISODE_BLOCKED: NEXT_EPISODE_BLOCKED_COPY,
  COMPARISON_MATERIAL_REQUIRED: '첫 회차 검수에는 설정집이나 직접 입력한 설정 등 비교할 자료가 필요해요.',
};

export function validationReportUrl(workId: string, reportId: string, extra = '') {
  return `/episode-validation-report?workId=${encodeURIComponent(workId)}&reportId=${encodeURIComponent(reportId)}${extra}`;
}

export function isReviewStage(value: unknown): value is ReviewStage {
  return typeof value === 'string' && value in VALIDATION_STAGE_SUMMARY;
}

export const LOCK_REASON_COPY: Record<LockReason, string> = {
  REPORT_INVALIDATED: '원고 또는 비교한 설정이 바뀌어 이 결과에는 판단을 남길 수 없어요.',
  BASELINE_NOT_READY: '비교할 기준을 준비하지 못해 판단을 남길 수 없어요.',
  EXECUTION_NOT_STARTED: '검사가 시작되면 판단을 남길 수 있어요.',
  EXECUTION_IN_PROGRESS: '검사가 끝나면 판단을 남길 수 있어요. 지금은 발견한 항목을 읽기만 할 수 있어요.',
  EXECUTION_CANCELED: '검사가 취소되어 판단을 남길 수 없어요.',
  REVIEW_COMPLETED: '검토를 마쳐 판단을 바꿀 수 없어요.',
};

export const HOLD_REASON_COPY: Record<HoldReason, string> = {
  EXECUTION_NOT_COMPLETED: '아직 검사를 마치지 못했어요.',
  PENDING_JUDGMENTS: '확인할 내용이 있어요. 검토 필요 항목에 판단을 남겨 주세요.',
  NEEDS_FIX_PENDING: '수정 필요로 표시한 항목이 있어요. 원고나 설정을 고친 뒤 다시 검수해 주세요.',
  DIAGNOSTIC_ONLY: '이전 원고의 설정은 확정했어요. 이번 재검수는 검사 결과만 제공해요.',
  REPORT_INVALIDATED: '원고 또는 비교한 설정이 바뀌었어요. 수정 내용을 반영해 다시 검수해 주세요.',
  BASELINE_NOT_READY: '비교할 기준을 준비하지 못했어요.',
  RELEASE_HELD: '자동으로 설정 추출을 시작하지 못했어요. 검토 완료 후 설정 추출로 다시 시도해 주세요.',
};

type ApplicationHoldCode = NonNullable<ValidationApplicationHoldReason['code']>;
const APPLICATION_HOLD_COPY: Record<ApplicationHoldCode, string> = {
  EXTRACTION_NOT_FINISHED: '설정 추출이 끝나지 않았어요.',
  REPORT_INVALIDATED: '원고 또는 비교한 설정이 바뀌었어요.',
  SOURCE_CHANGED: '설정을 추출한 뒤 원고가 바뀌었어요.',
  COMPARISON_PENDING: '기존 설정과 비교하고 있는 후보가 있어요.',
  COMPARISON_FAILED: '기존 설정과 비교하지 못한 후보가 있어요.',
  TOKEN_QUOTA: 'AI 사용량이 부족해 비교를 마치지 못한 후보가 있어요.',
  REVIEW_REQUIRED: '직접 확인이 필요한 후보가 있어요.',
  VALUE_INVALID: '설정값의 형식을 확인해야 하는 후보가 있어요.',
  SUBJECT_UNRESOLVED: '연결할 대상을 확인해야 하는 후보가 있어요.',
  SCOPE_UNRESOLVED: '세계관 범위를 확인해야 하는 후보가 있어요.',
  DECISION_PENDING: '반영 방식을 정해야 하는 후보가 있어요.',
  CANDIDATE_CHANGED: '확정 전에 바뀐 설정이 있어 다시 확인해야 해요.',
  UNKNOWN_ERROR: '확정 중 문제가 생겨 아무것도 반영하지 않았어요.',
};

const CANDIDATE_TYPE_LABELS: Record<string, string> = { CHARACTER: '캐릭터', WORLD_SETTING: '세계관', EPISODE: '회차' };

/** 같은 사유·대상 종류는 한 줄로 묶어 건수를 함께 보여 준다. */
export function applicationHoldLines(reasons: ValidationApplicationHoldReason[] = []) {
  const grouped = new Map<string, { label: string; count: number; candidateType?: string }>();
  for (const reason of reasons) {
    const key = `${reason.candidateType ?? ''}:${reason.code ?? ''}`;
    const text = reason.code ? APPLICATION_HOLD_COPY[reason.code] : '확정할 수 없는 후보가 있어요.';
    const type = reason.candidateType ? CANDIDATE_TYPE_LABELS[reason.candidateType] : undefined;
    const existing = grouped.get(key);
    if (existing) existing.count += 1;
    else grouped.set(key, { label: type ? `${type} · ${text}` : text, count: 1, candidateType: reason.candidateType });
  }
  return [...grouped.values()];
}

const CHANGE_REASON_LABELS: Record<string, string> = { NEW_CLUE: '새 단서를 찾아 다시 확인했어요.' };

export function changeReasonLabel(reason?: string | null): string {
  return (reason && CHANGE_REASON_LABELS[reason]) || '검사 내용이 바뀌어 다시 확인했어요.';
}

/** 출처 참조는 내부 식별자이므로 역할과 순번으로만 표시한다. */
export function sourceRefLabel(sourceRef?: string | null): string {
  if (!sourceRef || sourceRef === 'T1') return '이번 원고';
  const match = /^([A-Z]+)(\d+)$/.exec(sourceRef);
  if (match?.[1] === 'R') return `비교 원문 ${match[2]}`;
  if (match?.[1] === 'B') return `저장된 설정 ${match[2]}`;
  return '비교 자료';
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

export function formatDateTime(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : DATE_TIME_FORMAT.format(date);
}
