import type {
  SettingCandidateListResponse,
  SettingCandidateResponse,
  WorldSettingCandidateListResponse,
} from '../api/generated/types.gen';

type CandidateSummary = SettingCandidateListResponse | WorldSettingCandidateListResponse;
type Count = number | null;

export interface SettingReviewProgress {
  total: number;
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
    total: (character?.totalCandidateCount ?? 0) + (world?.totalCandidateCount ?? 0),
    confirmed: sumKnown(character?.confirmedCandidateCount, world?.confirmedCandidateCount),
    dismissed: sumKnown(character?.dismissedCandidateCount, world?.dismissedCandidateCount),
    directReview: sumKnown(character?.directReviewCandidateCount, world?.directReviewCandidateCount),
    processing: sumKnown(character?.processingCandidateCount, world?.processingCandidateCount),
  };
}

type CandidateReviewState = Partial<Pick<SettingCandidateResponse,
  'reviewStatus' | 'comparisonStatus' | 'automaticApplicationPending'>>;

export const AUTOMATIC_APPLICATION_PENDING_MESSAGE = '이 회차의 설정을 자동으로 반영하고 있습니다. 완료된 뒤 다시 확인해 주세요.';
export const REVIEWABLE_COMPARISON_FAILURE_MESSAGE = '자동 비교를 마치지 못해 대상과 내용을 확인해 주세요.';

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
