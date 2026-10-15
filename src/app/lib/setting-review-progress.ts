import type {
  SettingCandidateListResponse,
  SettingCandidateResponse,
  WorldSettingCandidateListResponse,
  WorldSettingCandidateResponse,
  AnalysisSourceResponse,
} from '../api/generated/types.gen';

type CandidateSummary = SettingCandidateListResponse | WorldSettingCandidateListResponse;
type Count = number | null;

export interface SettingReviewProgress {
  total: Count;
  confirmed: Count;
  dismissed: Count;
  directReview: Count;
  processing: Count;
}

function sumKnown(first: number | undefined, second: number | undefined): Count {
  return first == null || second == null ? null : first + second;
}

export function combinedSettingReviewProgress(
  character?: CandidateSummary,
  world?: CandidateSummary,
): SettingReviewProgress {
  return {
    total: sumKnown(character?.totalCandidateCount, world?.totalCandidateCount),
    confirmed: sumKnown(character?.confirmedCandidateCount, world?.confirmedCandidateCount),
    dismissed: sumKnown(character?.dismissedCandidateCount, world?.dismissedCandidateCount),
    directReview: sumKnown(character?.directReviewCandidateCount, world?.directReviewCandidateCount),
    processing: sumKnown(character?.processingCandidateCount, world?.processingCandidateCount),
  };
}

type CandidateReviewState = Partial<Pick<SettingCandidateResponse,
  'reviewStatus' | 'comparisonStatus' | 'automaticApplicationPending'>>;

const AUTOMATIC_APPLICATION_PENDING_MESSAGE = '이 회차의 설정을 자동으로 반영하고 있습니다. 완료된 뒤 다시 확인해 주세요.';
export function automaticApplicationPendingMessage(source?: AnalysisSourceResponse) {
  return source?.sourceKind === 'SETTING_BOOK'
    ? '이 설정집의 설정을 자동으로 반영하고 있습니다. 완료된 뒤 다시 확인해 주세요.'
    : AUTOMATIC_APPLICATION_PENDING_MESSAGE;
}
export const REVIEWABLE_COMPARISON_FAILURE_MESSAGE = '자동 비교를 마치지 못해 대상과 내용을 확인해 주세요.';
/** 후보 비교 상태만으로 원본 회차 분석이 중단됐다고 판단하지 않는다. */
export function orderedComparisonRecoveryMessage(
  candidate: CandidateReviewState & Partial<Pick<WorldSettingCandidateResponse,
    'analysisMode' | 'manualReviewAvailable' | 'comparisonFailureCode'
    | 'sourceAnalysisJobStatus' | 'sourceAnalysisJournalStatus' | 'source'>>,
  activeComparisonJobCount = 0,
): string | null {
  const book = candidate.source?.sourceKind === 'SETTING_BOOK';
  if (candidate.analysisMode !== 'ORDERED_PROVISIONAL'
      || candidate.reviewStatus !== 'PENDING_REVIEW'
      || isAutomaticApplicationPending(candidate)
      || (candidate.manualReviewAvailable && candidate.comparisonFailureCode !== 'AI_TOKEN_QUOTA_EXHAUSTED')) return null;
  if (candidate.sourceAnalysisJournalStatus === 'INVALIDATED') {
    return book ? '설정집 원문이나 설정이 변경되어 기존 분석을 이어서 처리할 수 없습니다. 설정집 화면에서 최신 원문을 확인해 주세요.'
      : '원고나 설정이 변경되어 기존 분석을 이어서 처리할 수 없습니다. 분석 목록에서 현재 상태를 확인해 주세요.';
  }
  if (candidate.sourceAnalysisJobStatus === 'PENDING' || candidate.sourceAnalysisJobStatus === 'RUNNING') {
    return book ? '이 설정집의 분석을 진행하고 있습니다. 완료되면 같은 화면에서 검토할 수 있습니다.'
      : '이 회차의 분석을 진행하고 있습니다. 완료되면 같은 화면에서 검토할 수 있습니다.';
  }
  if (candidate.sourceAnalysisJobStatus === 'FAILED' || candidate.sourceAnalysisJournalStatus === 'INCOMPLETE') {
    return book ? '완료된 단계는 유지됩니다. 설정집 화면에서 중단된 분석을 재개해 주세요.'
      : '순차 분석의 설정은 개별로 다시 비교할 수 없습니다. 분석 목록에서 중단된 회차의 재개 여부를 확인해 주세요.';
  }
  if (candidate.sourceAnalysisJobStatus == null && candidate.sourceAnalysisJournalStatus == null
      && activeComparisonJobCount > 0) {
    return book ? '설정집의 설정 비교가 진행 중입니다. 완료된 뒤 같은 화면에서 확인해 주세요.'
      : '설정 비교가 진행 중입니다. 완료된 뒤 회차별 상태를 확인해 주세요.';
  }
  return book ? '설정집의 설정은 개별로 다시 비교할 수 없습니다. 설정집 화면에서 분석 상태를 확인해 주세요.'
    : '순차 분석의 설정은 개별로 다시 비교할 수 없습니다. 분석 목록에서 회차별 진행 상태를 확인해 주세요.';
}

/** 서버가 직접 확인을 허용한 후보만 사용자 검토로 안내하며 저장된 실패 상태는 유지한다. */
export function isReviewableComparisonFailure(candidate: CandidateReviewState & Partial<Pick<SettingCandidateResponse,
  'manualReviewAvailable' | 'comparisonFailureCode'>>): boolean {
  return candidate.reviewStatus === 'PENDING_REVIEW'
    && candidate.comparisonStatus === 'FAILED'
    && candidate.manualReviewAvailable === true
    && candidate.comparisonFailureCode !== 'AI_TOKEN_QUOTA_EXHAUSTED'
    && !isAutomaticApplicationPending(candidate);
}

export function isAutomaticApplicationPending(candidate: CandidateReviewState): boolean {
  return candidate.reviewStatus === 'PENDING_REVIEW' && candidate.automaticApplicationPending === true;
}

export function isCandidateComparisonProcessing(candidate: CandidateReviewState): boolean {
  return candidate.reviewStatus === 'PENDING_REVIEW'
    && (isAutomaticApplicationPending(candidate)
      || candidate.comparisonStatus === 'PENDING' || candidate.comparisonStatus === 'PROCESSING');
}

export function needsDirectCandidateReview(candidate: CandidateReviewState): boolean {
  return candidate.reviewStatus === 'PENDING_REVIEW' && !isCandidateComparisonProcessing(candidate);
}

export function remainingReviewLabel(progress: SettingReviewProgress): string {
  if (progress.directReview == null || progress.processing == null) return '남은 설정을 확인해 주세요';
  return [
    progress.directReview > 0 ? `직접 확인 ${progress.directReview}개` : null,
    progress.processing > 0 ? `분석 중 ${progress.processing}개` : null,
  ].filter(Boolean).join(' · ') || '검토 상태 확인 중';
}

const AUTOMATIC_HOLD_LABELS = {
  SUBJECT_CONFIRMATION_REQUIRED: '같은 대상인지 확인',
  SUBJECT_RESOLUTION_FAILED: '연결할 대상 확인',
  COMPARISON_INPUT_TOO_LARGE: '비교할 내용 확인',
  DEPENDENCY_CONFIRMATION_REQUIRED: '관련 설정 확인',
  CURRENT_SETTING_CHANGED: '현재 설정 다시 확인',
  HUMAN_CURRENT_SETTING_PROTECTED: '직접 정한 현재 설정 확인',
  SETTING_TIME_CONFIRMATION_REQUIRED: '설정 시점 확인',
  SETTING_VALUE_CONFIRMATION_REQUIRED: '설정값 확인',
  SETTING_LOCATION_CONFLICT: '반영할 항목 확인',
  REVIEW_REQUIRED: '직접 확인 필요',
};

export function automaticReviewHoldLabel(candidate: CandidateReviewState & {
  automaticReviewHoldReason?: SettingCandidateResponse['automaticReviewHoldReason'];
}): string | null {
  if (!needsDirectCandidateReview(candidate) || !candidate.automaticReviewHoldReason) return null;
  return AUTOMATIC_HOLD_LABELS[candidate.automaticReviewHoldReason] ?? '직접 확인 필요';
}

export function automaticReviewHoldMessage(candidate: CandidateReviewState & {
  automaticReviewHoldReason?: SettingCandidateResponse['automaticReviewHoldReason'];
}): { title: string; description: string } | null {
  if (!needsDirectCandidateReview(candidate)) return null;
  if (candidate.automaticReviewHoldReason === 'HUMAN_CURRENT_SETTING_PROTECTED') return {
    title: '직접 정한 현재 설정이 있어요',
    description: '직접 입력하거나 수정한 설정을 유지했습니다. 이번 내용으로 바꿀지, 이력에만 남길지 선택해 주세요.',
  };
  if (candidate.automaticReviewHoldReason === 'SETTING_TIME_CONFIRMATION_REQUIRED') return {
    title: '설정 시점을 확인해 주세요',
    description: '언제의 설정인지 확인이 필요해 현재 설정은 유지했습니다. 과거 내용이나 미래 계획은 이력에 남기고, 현재 반영할 내용은 직접 정해 주세요.',
  };
  return null;
}
