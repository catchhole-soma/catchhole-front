import type {
  SettingCandidateConfirmRequest,
  SettingCandidateResponse,
} from '../../../api/generated/types.gen';

export type CharacterFactApplicationMode = NonNullable<SettingCandidateConfirmRequest['applicationMode']>;

export interface CharacterFactComparisonPolicy {
  canApplyProposal: boolean;
  canSaveHistory: boolean;
  canConfirm: boolean;
  retryAvailable: boolean;
  defaultApplicationMode: CharacterFactApplicationMode;
}

/** 비교 패널과 실제 확정 요청이 같은 상태 전이 정책을 사용하도록 허용 동작을 한곳에서 계산한다. */
export function getCharacterFactComparisonPolicy(
  candidate: SettingCandidateResponse,
): CharacterFactComparisonPolicy {
  const valueInvalid = candidate.valueValidation?.status === 'INVALID';
  const completed = candidate.comparisonStatus === 'COMPLETED';
  const operation = candidate.suggestedOperation ?? null;
  const canConfirmNewCharacter = !valueInvalid
    && candidate.comparisonStatus === 'WAITING_FOR_CHARACTER_MATCH'
    && candidate.matchStatus === 'UNRESOLVED';
  const canBootstrapLegacyComparison = candidate.comparisonStatus === 'NOT_REQUIRED'
    && candidate.matchedCharacterId != null
    && (candidate.matchStatus === 'MATCHED' || candidate.matchStatus === 'AUTO_MATCHED_BY_NAME');
  const canApplyProposal = !valueInvalid
    && completed
    && (operation === 'ADD' || operation === 'UPDATE' || operation === 'MERGE' || operation === 'REMOVE');
  const canSaveHistory = !valueInvalid && completed && operation != null && operation !== 'EXCLUDE';
  const canAcceptExclusion = !valueInvalid && completed && operation === 'EXCLUDE';

  return {
    canApplyProposal,
    canSaveHistory,
    canConfirm: canConfirmNewCharacter || canApplyProposal || canSaveHistory || canAcceptExclusion,
    retryAvailable: !valueInvalid && (
      canBootstrapLegacyComparison
      || candidate.comparisonStatus === 'FAILED'
      || candidate.comparisonStatus === 'RECOMPARISON_REQUIRED'
    ),
    defaultApplicationMode: canApplyProposal || canConfirmNewCharacter
      ? 'APPLY_PROPOSAL'
      : 'HISTORY_ONLY',
  };
}

/** 저장해 둔 사용자 선택이 재비교 결과에서 더 이상 허용되지 않으면 현재 정책의 기본값으로 보정한다. */
export function resolveCharacterFactApplicationMode(
  candidate: SettingCandidateResponse,
  requestedMode?: CharacterFactApplicationMode,
): CharacterFactApplicationMode {
  const policy = getCharacterFactComparisonPolicy(candidate);
  if (requestedMode === 'APPLY_PROPOSAL'
    && (policy.canApplyProposal || policy.defaultApplicationMode === 'APPLY_PROPOSAL')) {
    return requestedMode;
  }
  if (requestedMode === 'HISTORY_ONLY' && policy.canSaveHistory) return requestedMode;
  return policy.defaultApplicationMode;
}
