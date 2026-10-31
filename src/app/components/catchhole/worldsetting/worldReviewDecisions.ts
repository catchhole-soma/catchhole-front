import type { Decision, WorldSettingCandidateResponse } from '../../../api/generated/types.gen';

export type WorldReviewDraft = Omit<Decision, 'candidateId' | 'conflictResolved' | 'applyToCurrent' | 'expectedWorldSettingVersion' | 'expectedUpdatedAt'>;

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

/**
 * 묶음의 `선택 항목 대상 연결` 초안. 비교의 제안 경로(`proposed*`)가 아니라 원문 경로(범위·설정명, 범위가 없으면 null)와
 * 추출값을 그대로 쓴다. 다른 대상에 연결할 때 옛 비교의 제안 경로로 저장하거나 원문 경로의 기존 설정 검사를 건너뛰지 않기 위해서다.
 */
export function worldLinkSourceDraft(candidate: WorldSettingCandidateResponse, fallback: WorldReviewDraft, value?: string): WorldReviewDraft {
  const base = worldReviewSourceDraft(candidate, fallback);
  return {
    ...base,
    operation: 'ADD',
    scopeName: candidate.scopeName ?? null,
    settingName: candidate.settingName ?? fallback.settingName,
    value: value ?? candidate.extractedValue ?? base.value,
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

type WorldCategory = NonNullable<WorldSettingCandidateResponse['category']>;

const normalizeWorldName = (value?: string | null) => (value ?? '').trim().normalize('NFC').toLocaleLowerCase('ko-KR');

/** 대상 안의 설정 위치(범위+설정명)를 비교용 키로 만든다. 범위가 없으면 루트(공통 설정)다. */
export function worldPropertyPathKey(scopeName?: string | null, settingName?: string | null): string {
  return JSON.stringify([normalizeWorldName(scopeName) || null, normalizeWorldName(settingName)]);
}

/** 체크한 행 하나(공유 결정이면 같은 결정의 원문 전부)를 같은 대상에 연결하기 위한 단위. */
export interface WorldTargetLinkUnit {
  candidate: WorldSettingCandidateResponse;
  candidateIds: string[];
  /** 원문 기준 초안. 값은 추출값(공유 결정이면 원문들의 추출값을 이은 값)이다. */
  draft: WorldReviewDraft;
  /** 원문마다 내용이 달라 최종 내용을 사람이 정해야 하는 행. */
  conflict: boolean;
}

export interface WorldLinkTarget {
  /** 기존 대상이면 ID, 새 대상이면 null. */
  worldSettingId: string | null;
  category: WorldCategory;
  subjectName: string;
}

export type WorldTargetLinkOutcome = 'add' | 'existing' | 'conflict' | 'duplicate';

/**
 * 선택 대상 연결 계획. 대상에 같은 경로가 없는 행만 ADD 초안으로 저장하고(D4), 같은 경로가 있거나 원문 충돌·선택 안의
 * 경로 중복이 있는 행은 저장하지 않고 결정으로 남긴다. 저장할 행은 모두 같은 대상(분류+이름)이다.
 */
export function planWorldTargetLink(units: WorldTargetLinkUnit[], target: WorldLinkTarget, existingPaths: ReadonlySet<string>) {
  const seen = new Set<string>();
  const rows = units.map(unit => {
    const path = worldPropertyPathKey(unit.draft.scopeName, unit.draft.settingName);
    const outcome: WorldTargetLinkOutcome = unit.conflict ? 'conflict'
      : existingPaths.has(path) ? 'existing'
      : seen.has(path) ? 'duplicate' : 'add';
    if (outcome === 'add') seen.add(path);
    return { unit, outcome };
  });
  const saves = rows.filter(row => row.outcome === 'add').flatMap(({ unit }) => unit.candidateIds.map(candidateId => ({
    candidateId,
    operation: 'ADD' as const,
    category: target.category,
    subjectName: target.subjectName.trim(),
    scopeName: unit.draft.scopeName?.trim() || null,
    settingName: unit.draft.settingName.trim(),
    value: unit.draft.value.trim(),
  })));
  return { rows, saves, pending: rows.filter(row => row.outcome !== 'add') };
}
