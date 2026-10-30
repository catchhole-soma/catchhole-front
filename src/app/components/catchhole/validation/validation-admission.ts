import type { ValidationEligibilityResponse } from '../../../api/generated/types.gen';
import { toApiError } from '../../../lib/api-errors';
import { isReviewStage, type ReviewStage } from './validation-report-labels';

/** 다음 회차 등록을 막는 report. 자격 조회의 nextEpisodeAdmission과 업로드 409 context가 같은 모양으로 들어온다. */
export type AdmissionBlock = {
  reportId: string | null;
  episodeNo: number | null;
  reviewStage: ReviewStage | null;
  message: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuidOrNull(value: unknown) {
  return typeof value === 'string' && UUID.test(value) ? value : null;
}

export function admissionBlockFromEligibility(data?: ValidationEligibilityResponse | null): AdmissionBlock | null {
  const admission = data?.nextEpisodeAdmission;
  if (!admission || admission.allowed !== false) return null;
  return {
    reportId: uuidOrNull(admission.blockingReportId),
    episodeNo: typeof admission.blockingEpisodeNo === 'number' ? admission.blockingEpisodeNo : null,
    reviewStage: isReviewStage(admission.blockingReviewStage) ? admission.blockingReviewStage : null,
    message: admission.message ?? null,
  };
}

/** 409 VALIDATION_NEXT_EPISODE_BLOCKED의 error.context{reportId, episodeId, episodeNo, reviewStage}. */
export function admissionBlockFromError(error: unknown): AdmissionBlock | null {
  const api = toApiError(error);
  if (api?.code !== 'VALIDATION_NEXT_EPISODE_BLOCKED') return null;
  return {
    reportId: uuidOrNull(api.context.reportId),
    episodeNo: typeof api.context.episodeNo === 'number' ? api.context.episodeNo : null,
    reviewStage: isReviewStage(api.context.reviewStage) ? api.context.reviewStage : null,
    message: api.message || null,
  };
}

