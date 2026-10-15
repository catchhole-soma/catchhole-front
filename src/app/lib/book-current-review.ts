import type { SettingCandidateResponse } from '../api/generated/types.gen';

type BookReviewCandidate = Pick<SettingCandidateResponse, 'id' | 'analysisJobId' | 'source' | 'reviewStatus'
  | 'manualReviewAvailable' | 'automaticApplicationPending' | 'updatedAt'>;

/** A choice belongs to the displayed source, candidate value and actual target version. */
export function bookReviewValueKey(candidate: BookReviewCandidate, targetId?: string | null, version?: number | null): string | null {
  if (candidate.source?.sourceKind !== 'SETTING_BOOK' || candidate.reviewStatus !== 'PENDING_REVIEW'
    || !candidate.manualReviewAvailable || candidate.automaticApplicationPending || !candidate.id
    || !targetId || version == null || !Number.isSafeInteger(version) || version < 0 || !candidate.updatedAt) return null;
  return JSON.stringify([candidate.id, candidate.analysisJobId, candidate.source.settingBookId,
    candidate.source.revisionId, targetId, version, candidate.updatedAt]);
}

export function isBookProtectionHold(reason?: SettingCandidateResponse['automaticReviewHoldReason']): boolean {
  return reason === 'HUMAN_CURRENT_SETTING_PROTECTED' || reason === 'SETTING_TIME_CONFIRMATION_REQUIRED';
}
