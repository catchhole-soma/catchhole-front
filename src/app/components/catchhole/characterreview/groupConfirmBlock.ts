import type { SettingCandidateResponse } from '../../../api/generated/types.gen';
import { getCharacterFactComparisonPolicy, type CharacterFactApplicationMode } from '../character/character-fact-comparison-policy';
import { isAutomaticApplicationPending } from '../../../lib/setting-review-progress';

/**
 * 그룹 확정을 막는 이유와 그 이유에 걸린 후보.
 *
 * `reason`은 기존 차단 문장 체인의 첫 문장(화면·e2e가 쓰는 문구 그대로)이다. `candidateIds`는 체인의 어느 문장이든
 * 후보 하나 때문에 막힌 후보를 화면 순서대로 모두 담는다. 그룹 전체 사유(일부만 표시·대기 0·자동 반영 대기)는 빈 배열이다.
 * `결정 필요 N`과 `다음 미결정 항목` 이동이 이 목록을 쓴다.
 */
export interface GroupConfirmBlock {
  reason: string;
  candidateIds: string[];
}

export function hasCharacterFactComparison(candidate: SettingCandidateResponse): boolean {
  return candidate.candidateKind !== 'CHARACTER_DISCOVERY';
}

// Group confirmation accepts a completed exclusion proposal as one decision without
// creating a current value or history. Single-candidate confirmation remains unchanged.
export function isGroupExclusionProposal(candidate: SettingCandidateResponse): boolean {
  return candidate.comparisonStatus === 'COMPLETED' && candidate.suggestedOperation === 'EXCLUDE';
}

export function isCandidateValueInvalid(candidate: SettingCandidateResponse): boolean {
  return candidate.valueValidation?.status === 'INVALID';
}

/** 서버가 저장한 직접 검토 선택. 로컬 Set으로 완료를 추측하지 않는다. */
export function hasManualReview(candidate: SettingCandidateResponse): boolean {
  return candidate.reviewedApplicationMode != null
    && candidate.manualReviewAvailable === true
    && (candidate.source?.sourceKind !== 'SETTING_BOOK' || candidate.suggestedOperation !== 'REMOVE'
      || candidate.reviewedApplicationMode === 'HISTORY_ONLY');
}

export interface CharacterGroupBlockInput {
  /** 그룹의 검토 대기 후보(화면 순서). */
  candidates: SettingCandidateResponse[];
  /** 구버전 단건 페이지라 그룹의 일부만 보이는 경우. */
  legacyPartial: boolean;
  automaticPendingMessage: string;
  /** 같은 항목의 현재 반영을 하나만 허용하는 그룹(최종 결과 승인·완료된 순차 분석). */
  usesFinalCurrentSelection: boolean;
  /** 대기 후보의 비교 revision이 서로 맞는지(또는 확인이 필요 없는지). */
  sharedComparisonRevision: boolean;
  isSaveUnresolved: (candidateId?: string) => boolean;
  /** 서버 저장 없이 작가가 고른 반영 방식이 있는지. */
  hasLocalChoice: (candidate: SettingCandidateResponse) => boolean;
  applicationMode: (candidate: SettingCandidateResponse) => CharacterFactApplicationMode;
  /** 설정집 현재 반영처럼 현재/이력 선택을 따로 받아야 하는데 아직 고르지 않았는지. */
  needsCurrentChoice: (candidate: SettingCandidateResponse) => boolean;
  settingLabel: (candidate: SettingCandidateResponse) => string;
}

const SAVE_UNRESOLVED = '저장 결과를 확인하는 설정이 있어요. 확인이 끝난 뒤 확정할 수 있어요.';
const VALUE_INVALID = '값 형식이 잘못된 설정을 수정하거나 제외한 뒤 확정해 주세요.';
const AMBIGUOUS = '캐릭터 연결이 모호한 설정을 먼저 해소해 주세요.';
const BASE_CHANGED = '이 후보의 기준 상태가 바뀌었습니다. 최신 검토 상태를 확인해 주세요.';
const MANUAL_UNSAVED = '확인할 설정이 남아 있어요. 각 설정에서 저장할 방법을 선택해 주세요.';
const REVIEW_UNCHOSEN = '판단이 필요한 설정에서 저장할 방법을 선택해 주세요.';
const CURRENT_UNCHOSEN = '현재 설정에 반영할지 이력에만 남길지 각 항목에서 선택해 주세요.';
const REVISION_MISMATCH = '모든 설정의 비교 결과가 준비된 뒤 함께 확정할 수 있습니다.';
const POLICY_UNCONFIRMABLE = '모든 설정의 현재값 비교가 끝난 뒤 함께 확정할 수 있습니다.';
const MISSING_ID = '식별할 수 없는 설정이 있어 확정할 수 없습니다.';

/** 같은 항목을 현재 설정에 여러 번 반영하려는 후보 묶음. 첫 묶음의 후보 순서를 유지한다. */
function duplicateCurrentSelection(
  candidates: SettingCandidateResponse[],
  applicationMode: (candidate: SettingCandidateResponse) => CharacterFactApplicationMode,
): SettingCandidateResponse[] | undefined {
  const selections = new Map<string, SettingCandidateResponse[]>();
  for (const candidate of candidates) {
    if (!hasCharacterFactComparison(candidate) || isGroupExclusionProposal(candidate)
      || applicationMode(candidate) !== 'APPLY_PROPOSAL') continue;
    const key = candidate.resolvedCanonicalFactKey || candidate.attributeName;
    if (key) selections.set(key, [...(selections.get(key) ?? []), candidate]);
  }
  return [...selections.values()].find(group => group.length > 1);
}

/**
 * 캐릭터 그룹 확정을 막는 이유를 기존 문장 체인 순서대로 고르고, 후보 때문에 막힌 후보를 함께 돌려준다.
 * 막는 것이 없으면 `null`이다. 문장은 기존 화면과 같다(e2e가 문구를 그대로 찾는다).
 */
export function computeGroupConfirmBlock(input: CharacterGroupBlockInput): GroupConfirmBlock | null {
  const { candidates } = input;
  if (input.legacyPartial) return { reason: '이 캐릭터의 설정이 일부만 표시되어 한꺼번에 확정할 수 없습니다.', candidateIds: [] };
  if (candidates.length === 0) return { reason: '확정할 검토 대기 설정이 없습니다.', candidateIds: [] };
  if (candidates.some(isAutomaticApplicationPending)) return { reason: input.automaticPendingMessage, candidateIds: [] };

  const duplicates = input.usesFinalCurrentSelection ? duplicateCurrentSelection(candidates, input.applicationMode) : undefined;
  const duplicateIds = new Set(duplicates?.map(candidate => candidate.id));
  const checks: Array<{ reason: string; blocks: (candidate: SettingCandidateResponse) => boolean }> = [
    { reason: SAVE_UNRESOLVED, blocks: candidate => input.isSaveUnresolved(candidate.id) },
    { reason: VALUE_INVALID, blocks: isCandidateValueInvalid },
    { reason: AMBIGUOUS, blocks: candidate => candidate.matchStatus === 'AMBIGUOUS' },
    { reason: BASE_CHANGED, blocks: candidate => candidate.reviewedApplicationMode != null && !candidate.manualReviewAvailable },
    { reason: MANUAL_UNSAVED, blocks: candidate => hasCharacterFactComparison(candidate)
      && (Boolean(candidate.manualReviewAvailable) || candidate.analysisMode === 'ORDERED_PROVISIONAL' && Boolean(candidate.userModified))
      && !hasManualReview(candidate) },
    { reason: REVIEW_UNCHOSEN, blocks: candidate => candidate.suggestedOperation === 'REVIEW_REQUIRED'
      && !hasManualReview(candidate) && !input.hasLocalChoice(candidate) },
    { reason: duplicates ? `‘${input.settingLabel(duplicates[0])}’에 현재 반영을 여러 번 선택했어요. 현재로 남길 하나를 선택하고 나머지는 이력에 저장하거나 제외해 주세요.` : '',
      blocks: candidate => duplicateIds.has(candidate.id) },
    { reason: CURRENT_UNCHOSEN, blocks: input.needsCurrentChoice },
  ];
  const policyBlocks = (candidate: SettingCandidateResponse) => hasCharacterFactComparison(candidate)
    && !hasManualReview(candidate) && !isGroupExclusionProposal(candidate)
    && !getCharacterFactComparisonPolicy(candidate).canConfirm;

  const candidateIds = candidates.flatMap(candidate => candidate.id
    && (checks.some(check => check.blocks(candidate)) || policyBlocks(candidate)) ? [candidate.id] : []);
  const firstCheck = checks.find(check => candidates.some(check.blocks));
  const reason = firstCheck?.reason
    ?? (!input.sharedComparisonRevision ? REVISION_MISMATCH
      : candidates.some(policyBlocks) ? POLICY_UNCONFIRMABLE
      : candidates.some(candidate => !candidate.id) ? MISSING_ID : null);
  return reason ? { reason, candidateIds } : null;
}
