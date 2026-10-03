import type { Decision, WorldSettingCandidateResponse } from '../../../api/generated/types.gen';

export type WorldReviewDraft = Omit<Decision, 'candidateId' | 'conflictResolved'>;

/** The API stores a MERGE final value verbatim; preserve both texts in a manual merge. */
export function combineWorldReviewValues(before?: string | null, incoming?: string | null): string {
  const values = [before?.trim(), incoming?.trim()].filter((value): value is string => Boolean(value));
  return [...new Set(values)].join('\n');
}

/** Rebuilding a choice always starts with extraction/comparison, never the previous final draft. */
export function worldReviewSourceDraft(candidate: WorldSettingCandidateResponse, fallback: WorldReviewDraft): WorldReviewDraft {
  const originalScope = candidate.comparisonReviewReason === 'SCOPE_UNRESOLVED'
    || candidate.comparisonReviewReason === 'SCOPE_MISMATCH'
    || candidate.comparisonReviewReason === 'BATCH_LIMIT_EXCEEDED';
  return {
    operation: candidate.suggestedOperation && candidate.suggestedOperation !== 'REVIEW_REQUIRED' ? candidate.suggestedOperation : 'ADD',
    category: candidate.category ?? fallback.category,
    subjectName: candidate.targetSubjectName ?? candidate.subjectName ?? fallback.subjectName,
    scopeName: (originalScope ? candidate.scopeName : candidate.proposedScopeName ?? candidate.scopeName) ?? null,
    settingName: (originalScope ? candidate.settingName : candidate.proposedSettingName ?? candidate.settingName) ?? fallback.settingName,
    value: (originalScope ? candidate.extractedValue : candidate.proposedValue ?? candidate.extractedValue) ?? fallback.value,
  };
}

export function sameWorldReviewDraft(left: WorldReviewDraft, right: WorldReviewDraft): boolean {
  return left.operation === right.operation && left.category === right.category
    && left.subjectName.trim() === right.subjectName.trim()
    && (left.scopeName?.trim() || null) === (right.scopeName?.trim() || null)
    && left.settingName.trim() === right.settingName.trim() && left.value.trim() === right.value.trim();
}

/** A shared comparison decision must remain one atomic choice, including hidden-source guards. */
export function compatibleWorldReviewSources(
  candidate: WorldSettingCandidateResponse,
  candidates: WorldSettingCandidateResponse[],
  filtered: boolean,
): string[] {
  if (filtered || !candidate.id) return [];
  const sources = candidate.comparisonDecisionId
    ? candidates.filter(source => source.comparisonDecisionId === candidate.comparisonDecisionId)
    : [candidate];
  const signature = (source: WorldSettingCandidateResponse) => JSON.stringify([
    source.category, source.targetWorldSettingId, source.targetSubjectName ?? source.subjectName,
    source.scopeName, source.settingName, source.proposedValue ?? source.extractedValue,
    source.matchedScopeName, source.matchedPropertyName, source.beforeValue, source.proposedValue,
    source.comparisonReviewReason, source.consolidationStatus,
  ]);
  const finalSignature = (source: WorldSettingCandidateResponse) => JSON.stringify([
    source.finalOperation, source.finalCategory, source.finalSubjectName, source.finalScopeName,
    source.finalSettingName, source.finalValue,
  ]);
  return sources.length && sources.every(source => Boolean(source.id)
    && source.reviewStatus === 'PENDING_REVIEW'
    && !source.automaticApplicationPending
    && (source.comparisonStatus === 'COMPLETED' || source.manualReviewAvailable === true)
    && signature(source) === signature(candidate)
    && finalSignature(source) === finalSignature(candidate))
    ? sources.map(source => source.id!) : [];
}
