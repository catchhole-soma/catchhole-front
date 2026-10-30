import { guardReviewSourceMutation, useReviewAnalysisSource } from '../../../hooks/useReviewAnalysisSource';
import { analysisSourceLabel, analysisSourceReaderUrl, analysisSourcesLabel, bookWorkspaceUrl, isSameReviewScope } from '../../../lib/analysis-source';
import { bookReviewValueKey } from '../../../lib/book-current-review';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronLeft,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  useLocation,
  useNavigate as useRouterNavigate,
  useSearchParams,
} from 'react-router';
import {
  confirmSettingCandidateGroupMutation,
  dismissSettingCandidateMutation,
  getCharactersQueryKey,
  getSettingCandidateOptions,
  getSettingCandidatesQueryKey,
  getSettingCandidatesOptions,
  getWorldSettingCandidateSummaryOptions,
  retrySettingCandidateComparisonMutation,
  updateSettingCandidateCharacterMatchMutation,
  updateSettingCandidateGroupCharacterMatchMutation,
  updateSettingCandidateMutation,
} from '../../../api/generated/@tanstack/react-query.gen';
import type { Options } from '../../../api/generated/sdk.gen';
import type {
  CharacterSummaryResponse,
  ConfirmSettingCandidateGroupData,
  DismissSettingCandidateData,
  GetSettingCandidatesResponse,
  RetrySettingCandidateComparisonData,
  SettingCandidateGroupResponse,
  SettingCandidateResponse,
  UpdateSettingCandidateCharacterMatchData,
  UpdateSettingCandidateData,
} from '../../../api/generated/types.gen';
import {
  isUnidentifiedCharacterName,
  isUnlinkedCandidateGroup,
  nextGroupKeyAfter,
  normalizeCharacterGroupName,
} from '../../../lib/setting-review-groups';
import { isResponseLost, REVIEW_SAVE_TEXT, unverifiedSaveMessage, type ReviewSaveState } from '../../../lib/review-save-state';
import { reviewPositionKey } from '../../../lib/review-position-store';
import { useReviewPositionMemory } from '../review-ui/useReviewPositionMemory';
import { useCandidateSaveTracker, type SaveCheckResult } from './useCandidateSaveTracker';
import {
  replaceWithManuscriptList,
  returnToAnalysisList,
  type ReviewReturnState,
} from '../../../lib/review-navigation';
import { toApiError } from '../../../lib/api-errors';
import { shouldRetryQuery } from '../../../lib/query-client';
import {
  automaticApplicationPendingMessage,
  automaticReviewHoldLabel,
  automaticReviewHoldMessage,
  isAutomaticApplicationPending,
  combinedSettingReviewProgress,
  isCandidateComparisonProcessing,
  needsDirectCandidateReview,
  remainingReviewLabel,
} from '../../../lib/setting-review-progress';
import { SettingReviewSummary } from '../SettingReviewSummary';
import { OrderedReviewImpactNotice } from '../OrderedReviewImpactNotice';
import { C } from '../constants';
import { useCharacterSettingLabels } from '../character/CharacterSettingLabelProvider';
import { PageNavigation } from '../PageNavigation';
import { REVIEW_TEXT, reviewToneInk } from '../review-v2-colors';
import { UserMenu } from '../UserMenu';
import { CharacterReviewComparison, CharacterTargetChoices } from './CharacterReviewPresentation';
import { errorMessage, toSettingDisplay, validateCandidateDisplayValue } from './characterReviewFormat';
import { ActionButton } from './ReviewModalControls';
import { CandidateEditModal } from './CandidateEditModal';
import { CharacterMatchModal, type MatchResolution } from './CharacterMatchModal';
import { ReviewSubjectThumbnail } from '../review-ui/ReviewSubjectThumbnail';
import { useReviewScrollStability } from '../review-ui/useReviewScrollStability';
import { ReviewEvidence, ReviewInlineValue, ReviewNotice, ReviewSettingHeading } from '../review-ui/ReviewPrimitives';
import {
  getCharacterFactComparisonPolicy,
  resolveCharacterFactApplicationMode,
  type CharacterFactApplicationMode,
} from '../character/character-fact-comparison-policy';
import { OtherSettingReviewAction, SettingReviewTabs } from '../worldsetting/SettingReviewTabs';

// 랜딩·최초 안내가 같은 버튼을 이 모듈에서 가져간다.
export { ActionButton };

type ReviewStatus = NonNullable<SettingCandidateResponse['reviewStatus']>;
type MatchStatus = NonNullable<SettingCandidateResponse['matchStatus']>;
type ReviewFilter = ReviewStatus | 'ALL';
type MatchFilter = 'ALL' | 'CONNECTED' | 'UNRESOLVED' | 'AMBIGUOUS';

const DEFAULT_PAGE_SIZE = 20;
const ACTIVE_COMPARISON_POLL_INTERVAL = 2_000;
const REVIEW_FILTERS: Array<{ value: ReviewFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'PENDING_REVIEW', label: '미처리' },
  { value: 'CONFIRMED', label: '반영됨' },
  { value: 'DISMISSED', label: '제외됨' },
];
const MATCH_FILTERS: Array<{ value: MatchFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'CONNECTED', label: '연결됨' },
  { value: 'UNRESOLVED', label: '새 캐릭터 후보' },
  { value: 'AMBIGUOUS', label: '캐릭터 연결 확인 필요' },
];

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  PENDING_REVIEW: '직접 확인',
  CONFIRMED: '반영됨',
  DISMISSED: '제외됨',
};
const MATCH_LABELS: Record<MatchStatus, string> = {
  MATCHED: '기존 캐릭터 연결됨',
  AUTO_MATCHED_BY_NAME: '신규 캐릭터에 연결됨',
  UNRESOLVED: '새 캐릭터 후보',
  AMBIGUOUS: '캐릭터 연결 확인 필요',
};

function shouldRetryCandidateQuery(failureCount: number, error: unknown): boolean {
  return toApiError(error)?.status !== 404
    && shouldRetryQuery(failureCount, error, 2);
}

function isCharacterComparisonActive(
  status?: SettingCandidateResponse['comparisonStatus'],
): boolean {
  return status === 'PENDING' || status === 'PROCESSING';
}

function hasCharacterFactComparison(candidate: SettingCandidateResponse): boolean {
  return candidate.candidateKind !== 'CHARACTER_DISCOVERY';
}

// Group confirmation accepts a completed exclusion proposal as one decision without
// creating a current value or history. Single-candidate confirmation remains unchanged.
function isGroupExclusionProposal(candidate: SettingCandidateResponse): boolean {
  return candidate.comparisonStatus === 'COMPLETED' && candidate.suggestedOperation === 'EXCLUDE';
}

function isCandidateValueInvalid(candidate: SettingCandidateResponse): boolean {
  return candidate.valueValidation?.status === 'INVALID';
}

function isCandidateValueRepairable(candidate: SettingCandidateResponse): boolean {
  return isCandidateValueInvalid(candidate)
    && candidate.valueValidation?.repairable !== false;
}

function parsePositiveInteger(value: string | null, fallback: number, maximum?: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return maximum === undefined ? parsed : Math.min(parsed, maximum);
}

function parseReviewFilter(value: string | null): ReviewFilter {
  return REVIEW_FILTERS.some(filter => filter.value === value)
    ? value as ReviewFilter
    : 'PENDING_REVIEW';
}

function parseMatchFilter(value: string | null): MatchFilter {
  // 기존 공유 URL의 MATCHED 필터도 새 통합 연결 필터로 이어지게 한다.
  if (value === 'MATCHED' || value === 'AUTO_MATCHED_BY_NAME') return 'CONNECTED';
  return MATCH_FILTERS.some(filter => filter.value === value)
    ? value as MatchFilter
    : 'ALL';
}

function isConnectedMatch(status: MatchStatus | undefined): boolean {
  return status === 'MATCHED' || status === 'AUTO_MATCHED_BY_NAME';
}

function matchStatusesForFilter(filter: MatchFilter): MatchStatus[] | undefined {
  if (filter === 'ALL') return undefined;
  if (filter === 'CONNECTED') return ['MATCHED', 'AUTO_MATCHED_BY_NAME'];
  return [filter];
}

function matchesMatchFilter(status: MatchStatus | undefined, filter: MatchFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'CONNECTED') return isConnectedMatch(status);
  return status === filter;
}

function matchesReviewFilter(status: ReviewStatus, filter: ReviewFilter): boolean {
  return filter === 'ALL' || status === filter;
}

function isCharacterReviewLocation(workId: string, batchId: string, sourceAnalysisJobId?: string): boolean {
  const currentParams = new URLSearchParams(window.location.search);
  return isSameReviewScope(workId, batchId, sourceAnalysisJobId)
    && currentParams.get('candidateType') !== 'world';
}

// 구버전 단건 페이지를 묶는 fallback도 서버와 같은 정규화 이름 키를 쓴다.
const characterGroupKey = normalizeCharacterGroupName;

type MatchVariables = Options<UpdateSettingCandidateCharacterMatchData>;
type UpdateVariables = Options<UpdateSettingCandidateData>;
type ConfirmVariables = Options<ConfirmSettingCandidateGroupData>;

/** 저장 결과를 확인하려고 기억해 두는 작가의 의도. 재조회 판정과 재시도에 같은 값을 쓴다. */
type CharacterSaveIntent =
  | { kind: 'match'; candidateId: string; variables: MatchVariables }
  | { kind: 'update'; candidateId: string; variables: UpdateVariables }
  | { kind: 'dismiss'; candidateId: string; variables: Options<DismissSettingCandidateData> }
  | { kind: 'retry'; candidateId: string; previousStatus?: SettingCandidateResponse['comparisonStatus'];
    variables: Options<RetrySettingCandidateComparisonData> }
  | { kind: 'confirm'; groupKey: string; previousGroups: SettingCandidateGroupResponse[]; variables: ConfirmVariables };

function saveKey(intent: CharacterSaveIntent): string {
  return intent.kind === 'confirm' ? `confirm:${intent.groupKey}` : intent.candidateId;
}

function sameText(first?: string | null, second?: string | null): boolean {
  return (first ?? '').trim() === (second ?? '').trim();
}

/** 다시 읽은 후보가 작가가 보낸 변경을 이미 담고 있는지 판단한다. */
function candidateMatchesIntent(candidate: SettingCandidateResponse, intent: CharacterSaveIntent): boolean {
  if (intent.kind === 'match') {
    const body = intent.variables.body;
    return body.resolutionType === 'MATCH_EXISTING'
      ? candidate.matchedCharacterId === body.matchedCharacterId
      : !candidate.matchedCharacterId && candidate.matchStatus === 'UNRESOLVED'
        && normalizeCharacterGroupName(candidate.entityName) === normalizeCharacterGroupName(body.entityName);
  }
  if (intent.kind === 'update') {
    const body = intent.variables.body;
    return sameText(candidate.attributeValue, body.attributeValue)
      && (!body.reviewedApplicationMode || candidate.reviewedApplicationMode === body.reviewedApplicationMode);
  }
  if (intent.kind === 'dismiss') return candidate.reviewStatus === 'DISMISSED';
  if (intent.kind === 'retry') {
    const status = candidate.comparisonStatus;
    return status === 'PENDING' || status === 'PROCESSING' || status === 'COMPLETED' && intent.previousStatus !== 'COMPLETED';
  }
  return false;
}

function replaceCandidateInList(
  response: GetSettingCandidatesResponse | undefined,
  saved: SettingCandidateResponse,
): GetSettingCandidatesResponse | undefined {
  const groupPage = response?.data?.groups;
  if (!response?.data || !groupPage?.content) return response;
  return { ...response, data: { ...response.data, groups: { ...groupPage, content: groupPage.content.map(group => (
    group.candidates?.some(candidate => candidate.id === saved.id)
      ? { ...group, candidates: group.candidates.map(candidate => candidate.id === saved.id ? saved : candidate) }
      : group
  )) } } };
}

/** 확정·연결로 현재 그룹이 사라질 때 다음 그룹을 고르기 위한 직전 목록. 재조회가 끝난 뒤(armed)에만 판단한다. */
interface PendingGroupAdvance {
  groupKey: string;
  previous: SettingCandidateGroupResponse[];
  force: boolean;
  armed: boolean;
  /** 다음 그룹으로 URL을 바꾼 뒤 반영되기를 기다리는 대상. */
  target?: string | null;
  linkedCandidateId?: string;
}

interface RecentCandidateLink {
  candidateId: string;
  sourceGroupKey: string;
  label: string;
  discovery: boolean;
  characterName: string;
  targetGroupKey: string | null;
  hiddenByFilter: boolean;
  advancedGroupKey?: string | null;
}

interface MatchContext {
  sourceGroupKey: string | null;
  previousGroups: SettingCandidateGroupResponse[];
  label: string;
  discovery: boolean;
}

function withSelectableGroupKey(
  group: SettingCandidateGroupResponse,
  index: number,
): SettingCandidateGroupResponse {
  if (group.groupKey?.trim()) return group;
  const firstCandidateId = group.candidates?.find(candidate => candidate.id)?.id;
  return {
    ...group,
    // URL에서 빈 문자열은 선택 없음과 구분되지 않는다. 이름 없는 legacy 그룹도 선택할 수 있도록
    // 서버 식별자를 바꾸지 않는 화면 전용 key를 부여한다.
    groupKey: `__unnamed__:${firstCandidateId ?? index}`,
  };
}

function reviewColor(status: ReviewStatus | undefined): string {
  if (status === 'CONFIRMED') return C.success;
  if (status === 'DISMISSED') return C.t3;
  return C.warning;
}

function matchColor(status: MatchStatus | undefined): string {
  if (status === 'AMBIGUOUS') return C.warning;
  if (isConnectedMatch(status)) return C.primary;
  return C.t2;
}

function formatEpisodeRange(start?: number | null, end?: number | null, count = 0): string {
  if (count === 0 || start == null || end == null) return '대상 회차 없음';
  return start === end ? `${start}화 · 1개 회차` : `${start}–${end}화 · ${count}개 회차`;
}

function confidenceDescription(confidence?: number): {
  percent: string;
  description: string;
  color: string;
} {
  if (confidence == null || confidence < 0 || confidence > 1) {
    return { percent: '정보 없음', description: '근거 명확도 정보 없음', color: C.t3 };
  }
  if (confidence >= 0.9) {
    return {
      percent: `${Math.round(confidence * 100)}%`,
      description: '직접적인 수치 또는 설정표 근거',
      color: C.primary,
    };
  }
  if (confidence >= 0.7) {
    return {
      percent: `${Math.round(confidence * 100)}%`,
      description: '원문에서 명확히 확인되는 설정',
      color: C.primary,
    };
  }
  return {
    percent: `${Math.round(confidence * 100)}%`,
    description: '원문을 직접 확인해 주세요',
    color: C.warning,
  };
}

function evidenceQuotes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (typeof item !== 'object' || item === null) return [];
    const candidate = item as Record<string, unknown>;
    const quote = candidate.quote ?? candidate.text ?? candidate.sourceText;
    return typeof quote === 'string' && quote.trim() ? [quote.trim()] : [];
  });
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 700,
      color: reviewToneInk(color), background: `${color}18`, border: `1px solid ${color}66`, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function FilterGroup<T extends string>({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className="review-filter" role="group" aria-label={label}>
      <div className="review-filter__label">{label}</div>
      <select
        className="review-filter__select mobile-choice-select"
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value as T)}
      >
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <div className="review-filter__options">
        {options.map(option => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              className={`review-filter__button${active ? ' is-active' : ''}`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReviewHeader({ onBack }: { onBack: () => void }) {
  return (
    <header className="review-header app-topbar" style={{
      height: 62, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 28px', borderBottom: `1px solid ${C.border}`, background: C.bg,
    }}>
      <button
        type="button"
        aria-label="이전 화면"
        onClick={onBack}
        className="review-header__back"
        style={{
          width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`,
          background: 'transparent', color: REVIEW_TEXT.text, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ChevronLeft size={18} />
      </button>
      <div className="review-header__title">
        <small>AI ANALYSIS</small>
        <strong>설정 후보 검토</strong>
      </div>
      <div className="review-header__spacer" />
      <UserMenu />
    </header>
  );
}

export function CandidateGroupCard({
  group,
  selected,
  disabled = false,
  onClick,
}: {
  group: SettingCandidateGroupResponse;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const candidates = group.candidates ?? [];
  const directReviewCount = candidates.filter(needsDirectCandidateReview).length;
  const processingCount = candidates.filter(isCandidateComparisonProcessing).length;
  const matchStatuses = Array.from(new Set(candidates.map(candidate => candidate.matchStatus).filter(Boolean)));

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`candidate-group-card${selected ? ' is-selected' : ''}`}
      style={{
        width: '100%', minHeight: 82, padding: '14px 15px', borderRadius: 9,
        border: `1px solid ${selected ? C.primary : C.border}`,
        background: selected ? `${C.primary}14` : C.surface,
        color: REVIEW_TEXT.ink, textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? 0.68 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isUnlinkedCandidateGroup(group)
            ? `미연결 후보 ${group.candidateCount ?? candidates.length}개`
            : group.entityName || '이름 없는 캐릭터'}
        </strong>
        <StatusBadge label={`${group.candidateCount ?? candidates.length}개 설정`} color={C.primary} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, color: REVIEW_TEXT.muted, fontSize: 11 }}>
        <span>{analysisSourcesLabel(candidates, group.evidenceEpisodeNos)}</span>
        {directReviewCount > 0 && <span style={{ color: REVIEW_TEXT.warning }}>· 직접 확인 {directReviewCount}개</span>}
        {processingCount > 0 && <span style={{ color: REVIEW_TEXT.primary }}>· 분석 중 {processingCount}개</span>}
      </div>
      {matchStatuses.length > 0 && (
        <div style={{ display: 'flex', gap: 5, marginTop: 9, flexWrap: 'wrap' }}>
          {matchStatuses.map(status => status && (
            <StatusBadge key={status} label={MATCH_LABELS[status]} color={matchColor(status)} />
          ))}
        </div>
      )}
    </button>
  );
}

function CandidateInlineValueEditor({ candidate, disabled, onSave }: {
  candidate: SettingCandidateResponse;
  disabled: boolean;
  onSave: (value: string | null) => void;
}) {
  const [value, setValue] = useState(candidate.attributeValue ?? '');
  const inputId = useId();
  const invalid = validateCandidateDisplayValue(candidate.valueType, value);
  return <form className="review-inline-editor" onSubmit={event => {
    event.preventDefault();
    if (!disabled && !invalid) onSave(value.trim() || null);
  }}>
    <label htmlFor={inputId}>올바른 설정값<input id={inputId} value={value} disabled={disabled}
      aria-invalid={Boolean(invalid)} aria-describedby={invalid ? `${inputId}-error` : undefined}
      onChange={event => setValue(event.target.value)} /></label>
    {invalid && <span role="alert" id={`${inputId}-error`}>{invalid}</span>}
    <ActionButton type="submit" disabled={disabled || Boolean(invalid)} tone={C.primary}>수정한 값 저장</ActionButton>
  </form>;
}

export function CandidateDetail({
  candidate,
  workId,
  previewCharacters,
  applicationMode,
  actionError,
  actionPending,
  dismissing,
  retrying,
  retryError,
  onDismiss,
  onEdit,
  onMatch,
  onResolveTarget,
  onSaveValue,
  onReviewDecision,
  onApplicationModeChange,
  onRetryComparison,
  manuallyReviewed,
  decisionChosen = false,
  localChoiceMarked = false,
  saveState,
  saveActionsDisabled = false,
}: {
  candidate: SettingCandidateResponse;
  workId?: string;
  previewCharacters?: CharacterSummaryResponse[];
  applicationMode: CharacterFactApplicationMode;
  actionError: string | null;
  actionPending: boolean;
  dismissing: boolean;
  retrying: boolean;
  retryError: string | null;
  onDismiss?: () => void;
  onEdit?: () => void;
  onMatch?: (resolution: MatchResolution) => void;
  onResolveTarget?: (resolution: MatchResolution, value: string) => void;
  onSaveValue?: (value: string | null) => void;
  onReviewDecision?: (mode: CharacterFactApplicationMode) => void;
  onApplicationModeChange: (mode: CharacterFactApplicationMode) => void;
  onRetryComparison?: () => void;
  manuallyReviewed: boolean;
  decisionChosen?: boolean;
  /** 서버 저장 없이 확정 때 적용할 선택을 작가가 고른 상태. 저장 완료와 구분해 표시한다. */
  localChoiceMarked?: boolean;
  saveState?: ReviewSaveState;
  saveActionsDisabled?: boolean;
}) {
  const labels = useCharacterSettingLabels();
  const reviewStatus = candidate.reviewStatus ?? 'PENDING_REVIEW';
  const matchStatus = candidate.matchStatus ?? 'UNRESOLVED';
  const readOnly = reviewStatus !== 'PENDING_REVIEW';
  const automaticPending = isAutomaticApplicationPending(candidate);
  const processing = isCandidateComparisonProcessing(candidate);
  const confidence = confidenceDescription(candidate.confidence ?? undefined);
  const quotes = evidenceQuotes(candidate.evidenceSpans);
  const evidenceUrl = workId && candidate.source?.sourceKind === 'SETTING_BOOK' ? analysisSourceReaderUrl(workId, candidate.source) : null;
  const settingDisplay = toSettingDisplay(candidate.attributeName, candidate.attributeDisplayName, labels);
  const comparisonEnabled = hasCharacterFactComparison(candidate);
  const invalidValue = isCandidateValueInvalid(candidate);
  const invalidValueRepairable = isCandidateValueRepairable(candidate);
  const needsTarget = matchStatus === 'AMBIGUOUS';
  const existingCharacterConnected = isConnectedMatch(matchStatus);
  const headingTitle = comparisonEnabled ? settingDisplay.nameLabel
    : needsTarget ? '인물 확인' : existingCharacterConnected ? '인물 연결' : '새로운 인물';
  const disabled = actionPending || automaticPending;
  const holdLabel = automaticReviewHoldLabel(candidate);
  const holdMessage = automaticReviewHoldMessage(candidate);
  const comparisonReasonVisible = !readOnly && !automaticPending && comparisonEnabled && !invalidValue
    && (candidate.manualReviewAvailable || candidate.suggestedOperation === 'REVIEW_REQUIRED');
  const removed = reviewStatus === 'CONFIRMED' && candidate.suggestedOperation === 'REMOVE' && !candidate.historyOnly;
  const statusLabel = removed ? '현재 설정에서 제거됨' : readOnly ? REVIEW_LABELS[reviewStatus]
    : processing ? '분석 중' : invalidValue ? '값 확인 필요' : manuallyReviewed ? '반영 준비'
    : needsTarget ? '인물 확인 필요' : candidate.comparisonStatus === 'FAILED' && !candidate.manualReviewAvailable
      ? candidate.comparisonFailureCode === 'AI_TOKEN_QUOTA_EXHAUSTED' ? '사용량 확인 필요' : '비교 실패'
      : candidate.manualReviewAvailable || candidate.suggestedOperation === 'REVIEW_REQUIRED'
      ? '확인 필요' : candidate.suggestedOperation === 'EXCLUDE' ? '제외 제안'
      : candidate.suggestedOperation === 'ADD' ? '새 설정' : '직접 확인';
  const unlinked = !candidate.matchedCharacterId && isUnidentifiedCharacterName(candidate.entityName);
  return <section className={`review-cb-card setting-candidate-detail${readOnly ? ' is-read-only' : ''}`}
    aria-label={`${headingTitle} 설정 후보`} data-candidate-id={candidate.id} tabIndex={-1}>
    <ReviewSettingHeading title={headingTitle}
      subtitle={`캐릭터 · ${unlinked ? '미연결' : candidate.entityName || '인물 미상'}`}
      image={<ReviewSubjectThumbnail kind="character" workId={workId} characterId={candidate.matchedCharacterId} />}
      badge={<StatusBadge label={statusLabel} color={processing ? C.primary : readOnly ? reviewColor(reviewStatus) : manuallyReviewed ? C.success : C.warning} />}
      episode={analysisSourceLabel(candidate.source, candidate.episodeNo)}
      actions={!readOnly && <>
        {!automaticPending && <ActionButton disabled={!onMatch || disabled || invalidValue}
          onClick={() => onMatch?.('MATCH_EXISTING')}>캐릭터 연결 변경</ActionButton>}
        <ActionButton disabled={!onEdit || disabled || invalidValue && !invalidValueRepairable}
          disabledTitle={automaticPending ? automaticApplicationPendingMessage(candidate.source) : invalidValue && !invalidValueRepairable ? '이 설정의 입력 형식을 확인하지 못해 지금은 수정할 수 없습니다.' : undefined}
          onClick={onEdit}>수정</ActionButton>
        <ActionButton disabled={!onDismiss || actionPending || automaticPending} tone={C.danger} onClick={onDismiss}>{dismissing ? '제외 중…' : '제외'}</ActionButton>
      </>} />

    {automaticPending ? <ReviewNotice title="분석이 진행 중이에요">분석이 끝나면 설정을 수정하고 확정할 수 있어요.</ReviewNotice> : <>
      {readOnly && <ReviewNotice tone={reviewStatus === 'CONFIRMED' ? 'success' : 'info'} title={removed ? '현재 설정에서 제거했어요' : reviewStatus === 'CONFIRMED' ? '반영을 마친 설정이에요' : '검토 목록에서 제외했어요'}>
        {removed ? '이 설정은 현재 설정에서 제거되었고, 이전 내용과 이번 변경은 이력에 남아 있습니다.' : reviewStatus === 'CONFIRMED' ? candidate.historyOnly ? candidate.source?.sourceKind === 'SETTING_BOOK' ? '현재 설정은 유지하고, 이 설정집의 이력에 저장했습니다.' : '현재 설정은 유지하고, 이 회차의 이력에 저장했습니다.' : '확정된 후보입니다. 저장된 내용과 근거를 확인할 수 있어요.' : '이 후보는 추가하지 않았어요. 기존 설정과 이력은 그대로 유지됩니다.'}
      </ReviewNotice>}
      {!readOnly && holdMessage && <ReviewNotice tone="warning" title={holdMessage.title}>{holdMessage.description}</ReviewNotice>}
      {invalidValue && <ReviewNotice tone="danger" title="설정값의 형식을 확인해 주세요">
        {invalidValueRepairable ? candidate.valueValidation?.message ?? '이 설정값을 올바르게 읽지 못했습니다.' : '지금은 이 항목을 수정할 수 없습니다. 원문을 확인한 뒤 제외하면 나머지 설정을 검토할 수 있어요.'}
      </ReviewNotice>}
      {invalidValue && invalidValueRepairable && !readOnly && onSaveValue && <CandidateInlineValueEditor key={candidate.id}
        candidate={candidate} disabled={disabled} onSave={onSaveValue} />}
      {needsTarget && !readOnly && <>
        <ReviewInlineValue label={candidate.source?.sourceKind === 'SETTING_BOOK' ? '이번 설정집에서' : '이번 원고에서'}>{candidate.attributeValue || '인물의 등장'}</ReviewInlineValue>
        {(workId || previewCharacters) && onResolveTarget ? <CharacterTargetChoices candidate={candidate} workId={workId} previewCharacters={previewCharacters}
          disabled={disabled || invalidValue} resolutionError={actionError} onResolve={onResolveTarget} onBrowse={() => onMatch?.('MATCH_EXISTING')} />
          : <ReviewNotice title="누구에 관한 내용인가요?" action={<ActionButton disabled={disabled || invalidValue} onClick={() => onMatch?.('MATCH_EXISTING')}>캐릭터 연결</ActionButton>}>원문에 등장한 인물을 선택해 주세요.</ReviewNotice>}
      </>}
      {comparisonEnabled && !invalidValue && <CharacterReviewComparison candidate={candidate}
        applicationMode={applicationMode} reviewed={manuallyReviewed} decisionChosen={decisionChosen} disabled={disabled || readOnly}
        onModeChange={onApplicationModeChange} onReview={onReviewDecision} onEdit={onEdit}
        onRetry={onRetryComparison} retrying={retrying} retryError={retryError}
        saveState={saveState} localChoiceMarked={localChoiceMarked} />}
      {!comparisonEnabled && !needsTarget && <ReviewInlineValue
        label={existingCharacterConnected ? '연결된 인물' : reviewStatus === 'CONFIRMED' ? '등록된 인물' : readOnly ? candidate.source?.sourceKind === 'SETTING_BOOK' ? '설정집에서 찾은 인물' : '원고에서 찾은 인물' : '새로 등록할 인물'}
        tone={existingCharacterConnected ? 'neutral' : 'new'}>{candidate.entityName || '이름을 확인해 주세요'}</ReviewInlineValue>}
    </>}
    {saveState?.kind === 'unverified' && <ReviewNotice tone="warning" title={unverifiedSaveMessage(saveState.attempt, saveState.final)}
      action={saveState.final ? <span className="review-cb-notice__buttons">
        <button type="button" className="review-cb-secondary" disabled={saveActionsDisabled} onClick={saveState.check}>{REVIEW_SAVE_TEXT.check}</button>
        <button type="button" className="review-cb-secondary" disabled={saveActionsDisabled} onClick={saveState.retry}>{REVIEW_SAVE_TEXT.retry}</button>
      </span> : undefined} />}
    {actionError && <ReviewNotice tone="danger">{actionError}</ReviewNotice>}
    <ReviewEvidence summary={`원문 근거 확인 · ${analysisSourceLabel(candidate.source, candidate.episodeNo)}`}>
      {evidenceUrl && <a className="world-setting-evidence-reader" href={evidenceUrl}>분석 당시 원문 보기</a>}
      <div className="character-setting-evidence-card theme-evidence">
        <strong>1차 추출 원문</strong>
        {quotes.length ? quotes.map((quote, index) => <blockquote className="theme-evidence__quote" key={`${index}-${quote}`}>{quote}</blockquote>)
          : <p>표시할 원문 근거가 없습니다.</p>}
        <p>원문 표현 · {candidate.rawEntityMention || candidate.entityName || '정보 없음'}</p>
        <small>근거 명확도 {confidence.percent} · {confidence.description}</small>
      </div>
      {candidate.comparisonReason && !comparisonReasonVisible && <div><strong>AI 판단 근거</strong><p>{candidate.comparisonReason}</p></div>}
      {holdLabel && <p>확인 요청 · {holdLabel}</p>}
      <p>{MATCH_LABELS[matchStatus]}</p>
    </ReviewEvidence>
  </section>;
}

export function QueryState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="setting-review-page" style={{
      minHeight: 320, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 10,
      border: `1px solid ${C.border}`, borderRadius: 10, background: C.surface,
      textAlign: 'center', padding: 24,
    }}>
      {icon}
      <strong style={{ color: REVIEW_TEXT.ink, fontSize: 15 }}>{title}</strong>
      <span style={{ color: REVIEW_TEXT.muted, fontSize: 12, lineHeight: 1.6 }}>{description}</span>
      {action}
    </div>
  );
}

export function CharacterSettingReview({ applicationModes, onApplicationModeChange, onClearApplicationModes }: {
  applicationModes: Record<string, CharacterFactApplicationMode>;
  onApplicationModeChange: (candidateId: string, mode: CharacterFactApplicationMode) => void;
  onClearApplicationModes: (candidateIds: string[]) => void;
}) {
  const labels = useCharacterSettingLabels();
  const routerNavigate = useRouterNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const workId = searchParams.get('workId') ?? '';
  const batchId = searchParams.get('batchId') ?? '';
  const sourceAnalysisJobId = searchParams.get('sourceAnalysisJobId') ?? undefined;
  const sourceScope = useReviewAnalysisSource(workId, batchId, sourceAnalysisJobId);
  const selectedGroupKey = searchParams.get('group');
  const legacyCandidateId = searchParams.get('candidate');
  const reviewFilter = parseReviewFilter(searchParams.get('reviewStatus'));
  const matchFilter = parseMatchFilter(searchParams.get('matchStatus'));
  const urlPage = parsePositiveInteger(searchParams.get('page'), 1);
  const size = parsePositiveInteger(searchParams.get('size'), DEFAULT_PAGE_SIZE, 100);
  const apiPage = urlPage - 1;
  const { mainRef, contentRef, preserveViewport } = useReviewScrollStability(
    JSON.stringify([workId, batchId, sourceAnalysisJobId, reviewFilter, matchFilter, apiPage, size]),
  );
  const hasContext = Boolean(workId && batchId);
  const [editCandidate, setEditCandidate] = useState<SettingCandidateResponse | null>(null);
  const [currentApplications, setCurrentApplications] = useState<Record<string, string>>({});
  const setCurrentApplication = (candidateId: string, valueKey: string | null) => setCurrentApplications(previous => {
    const next = { ...previous };
    if (valueKey) next[candidateId] = valueKey; else delete next[candidateId];
    return next;
  });
  const [groupMatchOpen, setGroupMatchOpen] = useState(false);
  const [matchTarget, setMatchTarget] = useState<{
    candidate: SettingCandidateResponse;
    resolution: MatchResolution;
  } | null>(null);
  const [legacyResolutionError, setLegacyResolutionError] = useState(false);
  const [legacyResolutionAttempt, setLegacyResolutionAttempt] = useState(0);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(
    () => Boolean(searchParams.get('group') || searchParams.get('candidate')),
  );
  const selectionGroupRef = useRef<string | null>(null);
  const resolvingLegacyCandidateRef = useRef<string | null>(null);
  const [recentLink, setRecentLink] = useState<RecentCandidateLink | null>(null);
  const [advanceSignal, setAdvanceSignal] = useState(0);
  const advanceRef = useRef<PendingGroupAdvance | null>(null);
  const focusGroupKeyRef = useRef<string | null>(null);
  const matchContextRef = useRef(new Map<string, MatchContext>());
  const chooseCurrentRef = useRef(new Map<string, Pick<SettingCandidateResponse, 'currentSnapshotVersion' | 'matchedCharacterId'>>());
  const confirmRequestRef = useRef<{ groupKey: string; previousGroups: SettingCandidateGroupResponse[] } | null>(null);
  const leavingReviewRef = useRef(false);
  const reviewNavigationState = location.state as ReviewReturnState | null;

  const listOptions = getSettingCandidatesOptions({
    path: { workId },
    query: {
        sourceAnalysisJobId, batchId,
        reviewStatus: reviewFilter === 'ALL' ? undefined : reviewFilter,
        matchStatuses: matchStatusesForFilter(matchFilter),
        page: apiPage,
        size,
        includeLegacyCandidates: false,
    },
  });
  const listQuery = useQuery({
    ...listOptions,
    enabled: hasContext,
    retry: shouldRetryCandidateQuery,
    // 필터 query key가 바뀌어도 탭·필터·현재 그룹을 포함한 검토 셸은 유지한다.
    // 새 응답이 오기 전까지 직전 목록을 표시하므로 연속 클릭 대상이 DOM에서 사라지지 않는다.
    placeholderData: previousData => previousData,
    // 세계관 후보와 동일하게 비교 중 후보가 있는 목록만 주기적으로 다시 받는다.
    // 동일한 응답이어도 조회가 끝나면 필터·페이지 변경 후 대상 선택을 보정해야 한다.
    notifyOnChangeProps: ['data', 'error', 'status', 'fetchStatus'],
    refetchInterval: query => {
      const data = query.state.data?.data;
      const currentPageActive = data?.groups?.content?.some(group => group.candidates?.some(candidate => (
        isCharacterComparisonActive(candidate.comparisonStatus)
      ))) ?? data?.candidates?.content?.some(candidate => (
        isCharacterComparisonActive(candidate.comparisonStatus)
      ));
      const hasActiveComparison = data?.processingCandidateCount != null
        ? data.processingCandidateCount > 0 : currentPageActive;
      return hasActiveComparison ? ACTIVE_COMPARISON_POLL_INTERVAL : false;
    },
  });
  const listData = listQuery.data?.data;
  const legacyCandidateQuery = useQuery({
    ...getSettingCandidateOptions({
      path: { workId, candidateId: legacyCandidateId ?? '' },
      query: { sourceAnalysisJobId, batchId },
    }),
    enabled: hasContext && Boolean(legacyCandidateId),
    retry: shouldRetryCandidateQuery,
  });
  const usesLegacyCandidatePage = listData?.groups == null && listData?.candidates != null;
  const legacyGroupedActionsUnsafe = usesLegacyCandidatePage
    && ((listData?.candidates?.totalPages ?? 0) > 1 || listData?.candidates?.hasNext === true);
  const legacyGroupPage = useMemo(() => {
    const candidatePage = listData?.candidates;
    if (!candidatePage) return undefined;
    const grouped = new Map<string, SettingCandidateResponse[]>();
    (candidatePage.content ?? []).forEach(candidate => {
      const key = characterGroupKey(candidate.entityName);
      grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
    });
    const content: SettingCandidateGroupResponse[] = Array.from(grouped.entries())
      .map(([groupKey, candidates]) => ({
        groupKey,
        entityName: candidates[0]?.entityName ?? '',
        candidateCount: candidates.length,
        evidenceEpisodeNos: Array.from(new Set(candidates.flatMap(candidate => (
          candidate.episodeNo == null ? [] : [candidate.episodeNo]
        )))).sort((first, second) => first - second),
        candidates,
      }))
      // 구버전 Java의 단건 페이지를 사용하는 배포 구간에도 미상 그룹을 마지막에 유지한다.
      .sort((first, second) => Number(['', '미상'].includes(characterGroupKey(first.entityName)))
        - Number(['', '미상'].includes(characterGroupKey(second.entityName))));
    return {
      content,
      page: candidatePage.page,
      size: candidatePage.size,
      totalElements: content.length,
      totalPages: candidatePage.totalPages,
      hasNext: candidatePage.hasNext,
    };
  }, [listData?.candidates]);
  // Java와 Front를 순차 배포할 때도 목록이 비지 않도록 한 릴리스 동안 단건 페이지를 폴백으로 읽는다.
  const groupPage = listData?.groups ?? legacyGroupPage;
  const groups = useMemo(
    () => (groupPage?.content ?? []).map(withSelectableGroupKey),
    [groupPage?.content],
  );
  const selectedGroup = groups.find(group => group.groupKey === selectedGroupKey)
    ?? (legacyCandidateId
      ? groups.find(group => group.candidates?.some(candidate => candidate.id === legacyCandidateId))
      : undefined);
  const selectedGroupCandidates = useMemo(
    () => selectedGroup?.candidates ?? [],
    [selectedGroup?.candidates],
  );
  const pendingGroupCandidates = selectedGroupCandidates.filter(candidate => (
    candidate.reviewStatus === 'PENDING_REVIEW'
  ));
  const groupExclusionCount = pendingGroupCandidates.filter(isGroupExclusionProposal).length;
  const comparisonCandidates = pendingGroupCandidates.filter(candidate => (
    hasCharacterFactComparison(candidate) && candidate.analysisMode !== 'ORDERED_PROVISIONAL'
  ));
  const comparisonRevision = comparisonCandidates[0]?.comparisonRevision ?? undefined;
  const acceptsDisplayedResults = pendingGroupCandidates.length > 0
    && pendingGroupCandidates.every(candidate => candidate.analysisMode === 'CONFIRMED_ONLY' && candidate.analysisJobId)
    && new Set(pendingGroupCandidates.map(candidate => candidate.analysisJobId)).size === 1;
  const groupHasSharedComparisonRevision = acceptsDisplayedResults || comparisonCandidates.length === 0 || (
    Boolean(comparisonRevision)
    && comparisonCandidates.every(candidate => candidate.comparisonRevision === comparisonRevision)
  );
  const groupHasInvalidCandidate = pendingGroupCandidates.some(isCandidateValueInvalid);
  const groupAutomaticPending = pendingGroupCandidates.some(isAutomaticApplicationPending);
  const candidateAutomaticPending = (candidateId?: string) => selectedGroupCandidates.some(candidate => (
    candidate.id === candidateId && isAutomaticApplicationPending(candidate)
  ));

  const worldSummaryQuery = useQuery({
    ...getWorldSettingCandidateSummaryOptions({
      path: { workId },
      query: { sourceAnalysisJobId, batchId },
    }),
    enabled: hasContext,
    retry: shouldRetryCandidateQuery,
    refetchInterval: query => {
      const data = query.state.data?.data;
      const activeCount = (data?.pendingComparisonCount ?? 0) + (data?.processingComparisonCount ?? 0);
      return (data?.processingCandidateCount ?? activeCount) > 0 ? ACTIVE_COMPARISON_POLL_INTERVAL : false;
    },
  });
  const worldSummary = worldSummaryQuery.data?.data;

  useEffect(() => {
    setLegacyResolutionError(false);
    setLegacyResolutionAttempt(0);
  }, [legacyCandidateId]);

  useEffect(() => {
    if (!legacyCandidateId || !legacyCandidateQuery.isSuccess) return;
    if (resolvingLegacyCandidateRef.current === legacyCandidateId) return;
    const targetCandidate = legacyCandidateQuery.data?.data;
    if (!targetCandidate) return;
    resolvingLegacyCandidateRef.current = legacyCandidateId;
    let cancelled = false;

    const resolveOwningGroup = async () => {
      const candidateReview = targetCandidate.reviewStatus ?? 'PENDING_REVIEW';
      const targetReview: ReviewFilter = matchesReviewFilter(candidateReview, reviewFilter)
        ? reviewFilter
        : 'ALL';
      // 현재 URL 필터가 후보를 포함하면 사용자의 탐색 문맥을 보존한다. 후보가 필터 밖이면
      // 전체로 넓혀 공유 링크가 반드시 실제 그룹을 찾도록 한다.
      const targetMatch: MatchFilter = matchesMatchFilter(targetCandidate.matchStatus, matchFilter)
        ? matchFilter
        : 'ALL';
      let targetPage = 0;
      let targetGroupKey: string | null = null;

      while (!cancelled) {
        const response = await queryClient.fetchQuery(getSettingCandidatesOptions({
          path: { workId },
          query: {
            sourceAnalysisJobId, batchId,
            reviewStatus: targetReview === 'ALL' ? undefined : targetReview,
            matchStatuses: matchStatusesForFilter(targetMatch),
            page: targetPage,
            size,
            includeLegacyCandidates: false,
          },
        }));
        const responseData = response.data;
        const responseGroups = responseData?.groups?.content
          ?? Array.from((responseData?.candidates?.content ?? []).reduce((grouped, candidate) => {
            const key = characterGroupKey(candidate.entityName);
            grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
            return grouped;
          }, new Map<string, SettingCandidateResponse[]>()).entries()).map(([groupKey, candidates]) => ({
            groupKey,
            entityName: candidates[0]?.entityName ?? '',
            candidateCount: candidates.length,
            evidenceEpisodeNos: [],
            candidates,
          }));
        const owningGroupIndex = responseGroups.findIndex(group => (
          group.candidates?.some(candidate => candidate.id === legacyCandidateId)
        ));
        if (owningGroupIndex >= 0) {
          targetGroupKey = withSelectableGroupKey(
            responseGroups[owningGroupIndex],
            owningGroupIndex,
          ).groupKey ?? null;
          break;
        }
        const totalPages = responseData?.groups?.totalPages
          ?? responseData?.candidates?.totalPages
          ?? 0;
        targetPage += 1;
        if (targetPage >= totalPages) break;
      }

      if (cancelled || !targetGroupKey) return;
      setLegacyResolutionError(false);
      setMobileDetailOpen(true);
      setSearchParams(previous => {
        const next = new URLSearchParams(previous);
        if (targetReview === 'PENDING_REVIEW') next.delete('reviewStatus');
        else next.set('reviewStatus', targetReview);
        if (targetMatch === 'ALL') next.delete('matchStatus');
        else next.set('matchStatus', targetMatch);
        next.set('page', String(targetPage + 1));
        next.set('group', targetGroupKey);
        next.delete('candidate');
        return next;
      }, { replace: true, state: location.state });
    };

    void resolveOwningGroup().catch(() => {
      if (cancelled) return;
      resolvingLegacyCandidateRef.current = null;
      setLegacyResolutionError(true);
    });
    return () => {
      cancelled = true;
      if (resolvingLegacyCandidateRef.current === legacyCandidateId) {
        resolvingLegacyCandidateRef.current = null;
      }
    };
  }, [
    batchId,
    sourceAnalysisJobId,
    legacyCandidateId,
    legacyCandidateQuery.data?.data,
    legacyCandidateQuery.isSuccess,
    legacyResolutionAttempt,
    location.state,
    matchFilter,
    queryClient,
    reviewFilter,
    setSearchParams,
    size,
    workId,
  ]);

  useEffect(() => {
    if (leavingReviewRef.current || window.location.pathname !== '/setting-review') return;
    // 단건 공유 URL은 대상 후보의 실제 필터·페이지·그룹을 먼저 찾은 뒤 canonical group URL로 바꾼다.
    if (legacyCandidateId) return;
    if (!listQuery.isSuccess || listQuery.fetchStatus === 'fetching') return;
    // keepPreviousData가 이전 페이지를 잠시 유지하는 동안 그 목록으로 canonical URL을
    // 되돌리지 않는다. 현재 URL의 페이지 응답이 도착한 뒤에만 선택을 보정한다.
    if (groupPage?.page != null && groupPage.page !== apiPage) return;
    const advance = advanceRef.current;
    if (advance?.target !== undefined) {
      // 다음 그룹으로 바꾼 URL이 반영될 때까지 첫 그룹 보정을 하지 않는다.
      if (selectedGroupKey === advance.groupKey) return;
      advanceRef.current = null;
    } else if (advance && advance.groupKey !== selectedGroupKey) {
      // 요청 중 작가가 다른 그룹을 골랐다면 그 선택을 유지한다.
      advanceRef.current = null;
    } else if (advance) {
      const listed = groups.some(group => group.groupKey === advance.groupKey);
      // 재조회가 끝나기 전에는 사라진 그룹을 첫 그룹으로 바꾸지 않고 기다린다.
      if (!advance.armed && !listed) return;
      if (advance.armed) {
        if (!advance.force && listed) {
          advanceRef.current = null;
        } else {
          const nextKey = nextGroupKeyAfter(advance.previous, advance.groupKey, groups.filter(group => (
            group.candidates?.some(candidate => candidate.reviewStatus === 'PENDING_REVIEW')
          )));
          advance.target = nextKey;
          focusGroupKeyRef.current = nextKey;
          if (advance.linkedCandidateId) {
            setRecentLink(link => link && link.candidateId === advance.linkedCandidateId ? { ...link, advancedGroupKey: nextKey } : link);
          }
          preserveViewport();
          setSearchParams(previous => {
            if (previous.get('group') !== advance.groupKey) return previous;
            const next = new URLSearchParams(previous);
            if (nextKey) next.set('group', nextKey);
            else next.delete('group');
            next.delete('candidate');
            return next;
          }, { replace: true, state: location.state });
          return;
        }
      }
    }
    const nextGroup = selectedGroup ?? groups[0];
    if (!nextGroup?.groupKey) {
      if (!selectedGroupKey && !legacyCandidateId) return;
      setSearchParams(previous => {
        const next = new URLSearchParams(previous);
        next.delete('group');
        next.delete('candidate');
        return next;
      }, { replace: true, state: location.state });
      return;
    }
    if (selectedGroupKey === nextGroup.groupKey && !legacyCandidateId) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('group', nextGroup.groupKey!);
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  }, [advanceSignal, apiPage, groupPage?.page, groups, legacyCandidateId, listQuery.fetchStatus, listQuery.isSuccess, location.state, preserveViewport, selectedGroup, selectedGroupKey, setSearchParams]);

  useEffect(() => {
    const groupKey = selectedGroup?.groupKey;
    if (!groupKey || focusGroupKeyRef.current !== groupKey) return;
    focusGroupKeyRef.current = null;
    // 확정·연결 뒤 다음 묶음으로 넘어가면 제목에서 다시 읽기 시작한다.
    const main = mainRef.current;
    main?.querySelector<HTMLElement>('[data-review-group-title]')?.focus({ preventScroll: true });
    if (main) main.scrollTop = 0;
  }, [mainRef, selectedGroup?.groupKey]);

  useReviewPositionMemory({
    mainRef,
    storageKey: hasContext ? reviewPositionKey({ workId, batchId, sourceAnalysisJobId, candidateType: 'character' }) : null,
    groupKey: selectedGroupKey,
    ready: listQuery.isSuccess && !listQuery.isPlaceholderData && Boolean(selectedGroup)
      && selectedGroup?.groupKey === selectedGroupKey,
  });

  useEffect(() => {
    const groupKey = selectedGroup?.groupKey ?? null;
    if (selectionGroupRef.current === groupKey) return;
    selectionGroupRef.current = groupKey;
    setEditCandidate(null);
    setMatchTarget(null);
    setGroupMatchOpen(false);
  }, [selectedGroup]);

  useEffect(() => {
    selectionGroupRef.current = null;
    resolvingLegacyCandidateRef.current = null;
    setEditCandidate(null);
    setMatchTarget(null);
    setGroupMatchOpen(false);
  }, [batchId, sourceAnalysisJobId, workId]);

  const currentApplicationKey = (candidate: SettingCandidateResponse) => hasCharacterFactComparison(candidate) ? bookReviewValueKey(
    candidate, candidate.matchedCharacterId, candidate.currentSnapshotVersion,
  ) : null;
  const appliesToCurrent = (candidate: SettingCandidateResponse) => Boolean(candidate.id
    && candidate.applyToCurrentAvailable === true && currentApplicationKey(candidate)
    && currentApplications[candidate.id] === currentApplicationKey(candidate));

  const applicationModeForCandidate = (candidate: SettingCandidateResponse): CharacterFactApplicationMode => (
    candidate.reviewedApplicationMode
      ? candidate.reviewedApplicationMode
      : candidate.source?.sourceKind === 'SETTING_BOOK' && candidate.suggestedOperation === 'REMOVE' ? 'HISTORY_ONLY'
      : hasCharacterFactComparison(candidate)
      ? resolveCharacterFactApplicationMode(
          candidate,
          candidate.id ? applicationModes[candidate.id] : undefined,
        )
      : 'APPLY_PROPOSAL'
  );

  const invalidateCandidateData = async (targetWorkId = workId) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getSettingCandidatesQueryKey({
          path: { workId: targetWorkId },
          query: { sourceAnalysisJobId, batchId },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: getCharactersQueryKey({ path: { workId: targetWorkId } }),
      }),
    ]);
  };

  const refreshAutomaticApplicationState = async (error: unknown) => {
    if (toApiError(error)?.status === 409 && sourceAnalysisJobId) await sourceScope.refresh();
    const code = toApiError(error)?.code;
    if (code === 'ANALYSIS_AUTOMATIC_APPLICATION_PENDING' || code === 'SETTING_CANDIDATE_COMPARISON_STALE') await invalidateCandidateData();
  };

  const fetchCandidate = async (candidateId: string) => (await queryClient.fetchQuery({
    ...getSettingCandidateOptions({ path: { workId, candidateId }, query: { sourceAnalysisJobId, batchId } }),
    staleTime: 0,
  })).data;

  /** 재조회가 끝난 뒤 다음 그룹 판단을 허용한다. 그 사이 새 요청이 같은 자리를 차지했다면 건드리지 않는다. */
  const armAdvance = (advance: PendingGroupAdvance) => {
    if (advanceRef.current !== advance) return;
    advance.armed = true;
    setAdvanceSignal(signal => signal + 1);
  };

  const afterConfirmSaved = async (variables: ConfirmVariables, groupKey: string | null,
    previousGroups: SettingCandidateGroupResponse[]) => {
    variables.body.candidates.forEach(candidate => setCurrentApplication(candidate.candidateId, null));
    let advance: PendingGroupAdvance | null = null;
    // 느린 확정 중 세계관 탭으로 이동했다면 이전 캐릭터 화면의 URL을 다시 쓰지 않는다.
    if (groupKey != null && isCharacterReviewLocation(workId, batchId, sourceAnalysisJobId)) {
      advance = { groupKey, previous: previousGroups, force: true, armed: false };
      advanceRef.current = advance;
    }
    await invalidateCandidateData(variables.path.workId);
    if (!advance) return;
    if (queryClient.getQueryState(listOptions.queryKey)?.status === 'error') {
      // 확정 뒤 목록을 다시 받지 못하면 이전 목록으로 확정한 묶음이나 다음 묶음을 고르지 않는다.
      if (advanceRef.current === advance) advanceRef.current = null;
      setSearchParams(previous => {
        if (previous.get('group') !== groupKey) return previous;
        const next = new URLSearchParams(previous);
        next.delete('group');
        next.delete('candidate');
        return next;
      }, { replace: true, state: location.state });
      return;
    }
    armAdvance(advance);
  };

  const afterUpdateSaved = async (candidateId: string, saved: SettingCandidateResponse | undefined, targetWorkId = workId) => {
    setEditCandidate(current => current?.id === candidateId ? null : current);
    preserveViewport();
    const chosen = chooseCurrentRef.current.get(candidateId);
    chooseCurrentRef.current.delete(candidateId);
    // A draft save may advance the candidate timestamp, but cannot silently accept a changed current target.
    if (chosen && saved && isSameReviewScope(workId, batchId, sourceAnalysisJobId)
      && saved.currentSnapshotVersion === chosen.currentSnapshotVersion
      && saved.matchedCharacterId === chosen.matchedCharacterId && saved.applyToCurrentAvailable) {
      setCurrentApplication(candidateId, currentApplicationKey(saved));
    }
    // 내용/반영 방식 저장은 대상 연결을 바꾸지 않으므로 서버의 그룹 키를 유지한다.
    await invalidateCandidateData(targetWorkId);
  };

  /**
   * 단건 연결 뒤에도 작가가 보던 묶음·페이지·스크롤을 유지한다. 후보가 다른 묶음으로 옮겨 가면 안내로 알리고,
   * 이동은 안내의 버튼으로 작가가 고른다. 이 후보가 마지막이라 묶음이 비면 직전 목록의 다음 묶음을 연다.
   */
  const afterMatchSaved = async (candidateId: string, saved: SettingCandidateResponse | undefined, targetWorkId = workId) => {
    onClearApplicationModes([candidateId]);
    const context = matchContextRef.current.get(candidateId);
    matchContextRef.current.delete(candidateId);
    setMatchTarget(current => current?.candidate.id === candidateId ? null : current);
    if (saved) {
      queryClient.setQueryData(listOptions.queryKey, previous => replaceCandidateInList(previous, saved));
    }
    let advance: PendingGroupAdvance | null = null;
    if (context?.sourceGroupKey && isCharacterReviewLocation(workId, batchId, sourceAnalysisJobId)) {
      preserveViewport();
      const targetGroupKey = saved?.matchedCharacterId ? `existing:${saved.matchedCharacterId}` : null;
      const hiddenByFilter = Boolean(saved) && !matchesMatchFilter(saved?.matchStatus,
        parseMatchFilter(new URLSearchParams(window.location.search).get('matchStatus')));
      // 안내는 후보가 실제로 이 묶음을 떠날 때만 준비한다. 화면에 띄울지는 재조회 결과로 다시 판단한다.
      const leavesGroup = hiddenByFilter || (targetGroupKey ?? normalizeCharacterGroupName(saved?.entityName)) !== context.sourceGroupKey;
      setRecentLink(saved && leavesGroup ? {
        candidateId,
        sourceGroupKey: context.sourceGroupKey,
        label: context.label,
        discovery: context.discovery,
        characterName: saved.entityName || '새 인물',
        targetGroupKey,
        hiddenByFilter,
      } : null);
      advance = { groupKey: context.sourceGroupKey, previous: context.previousGroups, force: false, armed: false,
        linkedCandidateId: candidateId };
      advanceRef.current = advance;
    }
    await invalidateCandidateData(targetWorkId);
    if (advance) armAdvance(advance);
  };

  const confirmMutation = useMutation({
    ...guardReviewSourceMutation(confirmSettingCandidateGroupMutation(), sourceScope.canWrite),
    onSuccess: async (_response, variables) => {
      const request = confirmRequestRef.current;
      confirmRequestRef.current = null;
      await afterConfirmSaved(variables, request?.groupKey ?? null, request?.previousGroups ?? []);
    },
    onError: async (error, variables) => {
      if (isResponseLost(error)) return;
      confirmRequestRef.current = null;
      variables.body.candidates.forEach(candidate => setCurrentApplication(candidate.candidateId, null));
      await refreshAutomaticApplicationState(error);
      await invalidateCandidateData(variables.path.workId);
    },
  });
  const retryComparisonMutation = useMutation({
    ...guardReviewSourceMutation(retrySettingCandidateComparisonMutation(), sourceScope.canWrite),
    onError: refreshAutomaticApplicationState,
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: getSettingCandidatesQueryKey({
          path: { workId: variables.path.workId },
          query: { sourceAnalysisJobId, batchId },
        }),
      });
    },
  });
  const dismissMutation = useMutation({
    ...guardReviewSourceMutation(dismissSettingCandidateMutation(), sourceScope.canWrite),
    onError: refreshAutomaticApplicationState,
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: getSettingCandidatesQueryKey({
          path: { workId: variables.path.workId },
          query: { sourceAnalysisJobId, batchId },
        }),
      });
    },
  });
  const updateMutation = useMutation({
    ...guardReviewSourceMutation(updateSettingCandidateMutation(), sourceScope.canWrite),
    onError: refreshAutomaticApplicationState,
    onSuccess: async (response, variables) => {
      await afterUpdateSaved(variables.path.candidateId, response.data, variables.path.workId);
    },
  });
  const matchMutation = useMutation({
    ...guardReviewSourceMutation(updateSettingCandidateCharacterMatchMutation(), sourceScope.canWrite),
    onError: refreshAutomaticApplicationState,
    onSuccess: async (response, variables) => {
      queryClient.setQueryData(getSettingCandidateOptions({
        path: variables.path,
        query: { sourceAnalysisJobId, batchId },
      }).queryKey, response);
      await afterMatchSaved(variables.path.candidateId, response.data, variables.path.workId);
    },
  });

  const saveTracker = useCandidateSaveTracker<CharacterSaveIntent>({
    check: async (_key, intent): Promise<SaveCheckResult> => {
      if (intent.kind === 'confirm') {
        // 응답을 잃은 확정도 재조회에서 그룹이 사라지면 성공으로 본다. 그 전에 첫 그룹으로 되돌리지 않게 붙잡아 둔다.
        if (advanceRef.current?.groupKey !== intent.groupKey) {
          advanceRef.current = { groupKey: intent.groupKey, previous: intent.previousGroups, force: false, armed: false };
        }
        const response = await queryClient.fetchQuery({ ...listOptions, staleTime: 0 });
        const group = response.data?.groups?.content?.find(item => item.groupKey === intent.groupKey);
        const submitted = new Set(intent.variables.body.candidates.map(candidate => candidate.candidateId));
        if (!group) return reviewFilter === 'PENDING_REVIEW' ? 'matched' : 'unknown';
        return group.candidates?.some(candidate => candidate.id && submitted.has(candidate.id)
          && candidate.reviewStatus === 'PENDING_REVIEW') ? 'different' : 'matched';
      }
      const candidate = await fetchCandidate(intent.candidateId);
      void invalidateCandidateData();
      if (!candidate) return 'unknown';
      return candidateMatchesIntent(candidate, intent) ? 'matched' : 'different';
    },
    onConfirmed: (_key, intent) => {
      if (intent.kind === 'confirm') {
        void afterConfirmSaved(intent.variables, intent.groupKey, intent.previousGroups);
        return;
      }
      const verified = queryClient.getQueryData(getSettingCandidateOptions({
        path: { workId, candidateId: intent.candidateId }, query: { sourceAnalysisJobId, batchId },
      }).queryKey)?.data;
      if (intent.kind === 'match') void afterMatchSaved(intent.candidateId, verified);
      else if (intent.kind === 'update') void afterUpdateSaved(intent.candidateId, verified);
      else void invalidateCandidateData();
    },
    resend: (key, intent) => {
      if (intent.kind !== 'update') {
        // 확정은 서버의 decision hash, 연결·제외·재비교는 같은 최종 상태로 수렴하므로 같은 요청을 다시 보낸다.
        submitIntent(intent);
        return;
      }
      // 반영 방식 저장은 버전 검증이 있으므로 최신 updatedAt을 읽어 이미 저장됐으면 보내지 않는다.
      void (async () => {
        let latest: SettingCandidateResponse | undefined;
        try {
          latest = await fetchCandidate(intent.candidateId);
        } catch {
          latest = undefined;
        }
        if (!latest) {
          saveTracker.lose(key, intent);
          return;
        }
        if (candidateMatchesIntent(latest, intent)) {
          saveTracker.settle(key);
          await afterUpdateSaved(intent.candidateId, latest);
          return;
        }
        submitIntent({ ...intent, variables: { ...intent.variables,
          body: { ...intent.variables.body, expectedUpdatedAt: latest.updatedAt } } });
      })();
    },
  });

  /** 저장 요청을 보내고 응답이 없으면 재조회로 결과를 확인한다. 상태 코드가 있는 오류는 기존 오류 문구로 보여 준다. */
  const submitIntent = (intent: CharacterSaveIntent) => {
    const key = saveKey(intent);
    const callbacks = {
      onSuccess: () => saveTracker.settle(key),
      onError: (error: unknown) => {
        if (isResponseLost(error)) saveTracker.lose(key, intent);
        else saveTracker.settle(key);
      },
    };
    saveTracker.begin(key, intent);
    if (intent.kind === 'match') matchMutation.mutate(intent.variables, callbacks);
    else if (intent.kind === 'update') updateMutation.mutate(intent.variables, callbacks);
    else if (intent.kind === 'dismiss') dismissMutation.mutate(intent.variables, callbacks);
    else if (intent.kind === 'retry') retryComparisonMutation.mutate(intent.variables, callbacks);
    else {
      confirmRequestRef.current = { groupKey: intent.groupKey, previousGroups: intent.previousGroups };
      confirmMutation.mutate(intent.variables, callbacks);
    }
  };
  const groupMatchMutation = useMutation({
    ...guardReviewSourceMutation(updateSettingCandidateGroupCharacterMatchMutation(), sourceScope.canWrite),
    onError: refreshAutomaticApplicationState,
    onSuccess: async (response, variables) => {
      onClearApplicationModes(variables.body.candidateIds);
      setGroupMatchOpen(false);
      selectionGroupRef.current = null;
      if (isCharacterReviewLocation(workId, batchId, sourceAnalysisJobId)) {
        setSearchParams(previous => {
          const next = new URLSearchParams(previous);
          if (response.data?.groupKey) next.set('group', response.data.groupKey);
          next.delete('candidate');
          return next;
        }, { replace: true, state: location.state });
      }
      await invalidateCandidateData(variables.path.workId);
    },
  });

  // 응답을 받지 못한 오류는 연결 실패 문구 대신 저장 결과 확인 상태로 보여 준다.
  const respondedError = (mutation: { isError: boolean; error: unknown }) => mutation.isError && !isResponseLost(mutation.error);
  const unverifiedMessageFor = (key?: string | null) => {
    const state = saveTracker.stateFor(key);
    return state.kind === 'unverified' ? unverifiedSaveMessage(state.attempt, state.final) : null;
  };
  const selectedCandidateUpdateError = unverifiedMessageFor(editCandidate?.id) ?? (respondedError(updateMutation)
    && updateMutation.variables?.path.candidateId === editCandidate?.id
    ? errorMessage(updateMutation.error, '설정 후보를 수정하지 못했습니다. 입력값을 확인해 주세요.')
    : null);
  const selectedCandidateMatchError = unverifiedMessageFor(matchTarget?.candidate.id) ?? (respondedError(matchMutation)
    && matchMutation.variables?.path.candidateId === matchTarget?.candidate.id
    ? errorMessage(matchMutation.error, '캐릭터 연결을 저장하지 못했습니다. 다시 시도해 주세요.')
    : null);
  const dismissErrorForCandidate = (candidateId?: string) => respondedError(dismissMutation)
    && dismissMutation.variables?.path.candidateId === candidateId
    ? errorMessage(dismissMutation.error, '설정 후보를 제외하지 못했습니다. 다시 시도해 주세요.')
    : null;
  const retryErrorForCandidate = (candidateId?: string) => respondedError(retryComparisonMutation)
    && retryComparisonMutation.variables?.path.candidateId === candidateId
    ? errorMessage(retryComparisonMutation.error, '현재 설정을 다시 비교하지 못했습니다. 다시 시도해 주세요.')
    : null;
  const groupConfirmError = respondedError(confirmMutation)
    ? errorMessage(confirmMutation.error, '캐릭터 설정 묶음을 확정하지 못했습니다. 다시 시도해 주세요.')
    : null;
  const groupMatchError = groupMatchMutation.isError
    ? errorMessage(groupMatchMutation.error, '캐릭터 연결을 일괄 적용하지 못했습니다.')
    : null;
  const actionPending = sourceScope.blocked || confirmMutation.isPending
    || dismissMutation.isPending
    || updateMutation.isPending
    || matchMutation.isPending
    || retryComparisonMutation.isPending
    || groupMatchMutation.isPending
    // 필터·페이지가 바뀐 직후 placeholder 목록은 새 URL 조건과 일치하지 않는다.
    // 조회용 탐색은 유지하되 이전 행에 대한 쓰기만 잠근다.
    || listQuery.isPlaceholderData;

  const resetActionsIfSettled = () => {
    if (actionPending) return;
    confirmMutation.reset();
    dismissMutation.reset();
    updateMutation.reset();
    matchMutation.reset();
    retryComparisonMutation.reset();
    groupMatchMutation.reset();
  };
  /** 작가가 직접 다른 묶음·필터·페이지로 옮기면 연결 안내와 자동 다음 묶음 이동을 거둔다. */
  const clearNavigationIntent = () => {
    advanceRef.current = null;
    focusGroupKeyRef.current = null;
    setRecentLink(null);
  };
  const updateFilters = (nextReview: ReviewFilter, nextMatch: MatchFilter) => {
    setMobileDetailOpen(false);
    setEditCandidate(null);
    setMatchTarget(null);
    setGroupMatchOpen(false);
    resetActionsIfSettled();
    clearNavigationIntent();
    selectionGroupRef.current = null;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (nextReview === 'PENDING_REVIEW') next.delete('reviewStatus');
      else next.set('reviewStatus', nextReview);
      if (nextMatch === 'ALL') next.delete('matchStatus');
      else next.set('matchStatus', nextMatch);
      next.set('page', '1');
      // 새 필터 응답을 기다리는 동안 현재 그룹을 유지한다. 응답에 그룹이 없으면
      // 세계관과 같은 선택 보정 effect가 첫 그룹으로 바꾸거나 선택을 제거한다.
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  };
  const selectGroup = (groupKey: string) => {
    preserveViewport();
    resetActionsIfSettled();
    clearNavigationIntent();
    setMobileDetailOpen(true);
    setEditCandidate(null);
    setMatchTarget(null);
    setGroupMatchOpen(false);
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('group', groupKey);
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  };
  /** 연결 안내의 버튼으로만 연결한 묶음으로 이동한다. 실제 페이지는 후보 ID로 서버에서 찾는다. */
  const openLinkedGroup = (link: RecentCandidateLink) => {
    preserveViewport();
    resetActionsIfSettled();
    clearNavigationIntent();
    setMobileDetailOpen(true);
    setEditCandidate(null);
    setMatchTarget(null);
    setGroupMatchOpen(false);
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (link.targetGroupKey) next.set('group', link.targetGroupKey);
      else next.delete('group');
      next.set('candidate', link.candidateId);
      return next;
    }, { replace: true, state: location.state });
  };
  const changePage = (page: number) => {
    setMobileDetailOpen(false);
    clearNavigationIntent();
    selectionGroupRef.current = null;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('page', String(page + 1));
      next.delete('group');
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  };
  const dismissCandidate = (candidateId: string) => {
    if (actionPending || candidateAutomaticPending(candidateId) || saveTracker.busy(candidateId)) return;
    confirmMutation.reset();
    submitIntent({ kind: 'dismiss', candidateId, variables: { query: { sourceAnalysisJobId }, path: { workId, candidateId } } });
  };
  const updateSelectedCandidate = (
    candidateId: string,
    attributeName: string,
    attributeValue: string | null,
    reviewedApplicationMode?: CharacterFactApplicationMode,
    expectedUpdatedAt?: string,
    chooseCurrent = false,
  ) => {
    const candidate = selectedGroupCandidates.find(item => item.id === candidateId);
    if (actionPending || !candidate || candidateAutomaticPending(candidateId) || saveTracker.busy(candidateId)) return;
    setCurrentApplication(candidateId, null);
    if (chooseCurrent) {
      chooseCurrentRef.current.set(candidateId, {
        currentSnapshotVersion: candidate.currentSnapshotVersion, matchedCharacterId: candidate.matchedCharacterId,
      });
    } else {
      chooseCurrentRef.current.delete(candidateId);
    }
    submitIntent({ kind: 'update', candidateId, variables: {
      query: { sourceAnalysisJobId }, path: { workId, candidateId },
      body: { attributeName, attributeValue, expectedUpdatedAt: expectedUpdatedAt ?? candidate.updatedAt,
        ...(reviewedApplicationMode ? { reviewedApplicationMode } : {}) },
    } });
  };
  const matchSelectedGroup = (resolution: MatchResolution, value: string) => {
    const candidateIds = pendingGroupCandidates.flatMap(candidate => candidate.id ? [candidate.id] : []);
    if (!selectedGroup || candidateIds.length === 0 || actionPending || legacyGroupedActionsUnsafe) return;
    if (groupHasInvalidCandidate || groupAutomaticPending) {
      setGroupMatchOpen(false);
      return;
    }
    groupMatchMutation.mutate({
      query: { sourceAnalysisJobId }, path: { workId },
      body: resolution === 'MATCH_EXISTING'
        ? { batchId, candidateIds, resolutionType: resolution, matchedCharacterId: value }
        : { batchId, candidateIds, resolutionType: resolution, entityName: value },
    });
  };
  const matchSelectedCandidate = (candidateId: string, resolution: MatchResolution, value: string) => {
    if (actionPending || saveTracker.busy(candidateId)) return;
    const candidate = selectedGroupCandidates.find(item => item.id === candidateId);
    if (!candidate || isCandidateValueInvalid(candidate) || isAutomaticApplicationPending(candidate)) {
      setMatchTarget(null);
      return;
    }
    setRecentLink(null);
    matchContextRef.current.set(candidateId, {
      sourceGroupKey: selectedGroup?.groupKey ?? null,
      previousGroups: groups,
      label: hasCharacterFactComparison(candidate)
        ? toSettingDisplay(candidate.attributeName, candidate.attributeDisplayName, labels).nameLabel
        : candidate.rawEntityMention || candidate.entityName || '이름 없는 인물',
      discovery: !hasCharacterFactComparison(candidate),
    });
    submitIntent({ kind: 'match', candidateId, variables: {
      query: { sourceAnalysisJobId }, path: { workId, candidateId },
      body: resolution === 'MATCH_EXISTING'
        ? { resolutionType: resolution, matchedCharacterId: value }
        : { resolutionType: resolution, entityName: value },
    } });
  };
  const retryCandidateComparison = (candidateId: string) => {
    const candidate = selectedGroupCandidates.find(item => item.id === candidateId);
    if (actionPending || !candidate || candidate.analysisMode === 'ORDERED_PROVISIONAL'
      || isCandidateValueInvalid(candidate) || isAutomaticApplicationPending(candidate) || saveTracker.busy(candidateId)) return;
    submitIntent({ kind: 'retry', candidateId, previousStatus: candidate.comparisonStatus,
      variables: { query: { sourceAnalysisJobId }, path: { workId, candidateId } } });
  };

  const hasManualReview = (candidate: SettingCandidateResponse) =>
    candidate.reviewedApplicationMode != null
    && candidate.manualReviewAvailable === true
    && (candidate.source?.sourceKind !== 'SETTING_BOOK' || candidate.suggestedOperation !== 'REMOVE'
      || candidate.reviewedApplicationMode === 'HISTORY_ONLY');
  const currentSelections = new Map<string, SettingCandidateResponse[]>();
  for (const candidate of pendingGroupCandidates) {
    if (!hasCharacterFactComparison(candidate) || isGroupExclusionProposal(candidate)
      || applicationModeForCandidate(candidate) !== 'APPLY_PROPOSAL') continue;
    const key = candidate.resolvedCanonicalFactKey || candidate.attributeName;
    if (key) currentSelections.set(key, [...(currentSelections.get(key) ?? []), candidate]);
  }
  // 구형 다회차 검토는 같은 항목을 앞 회차부터 적용하는 비교 체인을 유지한다.
  const usesFinalCurrentSelection = acceptsDisplayedResults
    || pendingGroupCandidates.every(candidate => candidate.analysisMode === 'ORDERED_PROVISIONAL');
  const duplicateCurrentSelection = usesFinalCurrentSelection
    ? [...currentSelections.values()].find(candidates => candidates.length > 1)
    : undefined;
  const groupConfirmBlockedReason = legacyGroupedActionsUnsafe
    ? '이 캐릭터의 설정이 일부만 표시되어 한꺼번에 확정할 수 없습니다.'
    : pendingGroupCandidates.length === 0
    ? '확정할 검토 대기 설정이 없습니다.'
    : groupAutomaticPending
      ? automaticApplicationPendingMessage(sourceScope.source)
    : pendingGroupCandidates.some(candidate => saveTracker.unresolved(candidate.id))
      ? '저장 결과를 확인하는 설정이 있어요. 확인이 끝난 뒤 확정할 수 있어요.'
    : pendingGroupCandidates.some(isCandidateValueInvalid)
      ? '값 형식이 잘못된 설정을 수정하거나 제외한 뒤 확정해 주세요.'
    : pendingGroupCandidates.some(candidate => candidate.matchStatus === 'AMBIGUOUS')
      ? '캐릭터 연결이 모호한 설정을 먼저 해소해 주세요.'
      : pendingGroupCandidates.some(candidate => candidate.reviewedApplicationMode != null && !candidate.manualReviewAvailable)
        ? '이 후보의 기준 상태가 바뀌었습니다. 최신 검토 상태를 확인해 주세요.'
      : pendingGroupCandidates.some(candidate => hasCharacterFactComparison(candidate)
          && (candidate.manualReviewAvailable || candidate.analysisMode === 'ORDERED_PROVISIONAL' && candidate.userModified)
          && !hasManualReview(candidate))
        ? '확인할 설정이 남아 있어요. 각 설정에서 저장할 방법을 선택해 주세요.'
      : pendingGroupCandidates.some(candidate => candidate.suggestedOperation === 'REVIEW_REQUIRED'
          && !hasManualReview(candidate) && (!candidate.id || !applicationModes[candidate.id]))
        ? '판단이 필요한 설정에서 저장할 방법을 선택해 주세요.'
      : duplicateCurrentSelection
        ? `‘${toSettingDisplay(duplicateCurrentSelection[0].attributeName, duplicateCurrentSelection[0].attributeDisplayName, labels).nameLabel}’에 현재 반영을 여러 번 선택했어요. 현재로 남길 하나를 선택하고 나머지는 이력에 저장하거나 제외해 주세요.`
      : pendingGroupCandidates.some(candidate => currentApplicationKey(candidate)
          && applicationModeForCandidate(candidate) === 'APPLY_PROPOSAL' && !isGroupExclusionProposal(candidate)
          && !appliesToCurrent(candidate))
        ? '현재 설정에 반영할지 이력에만 남길지 각 항목에서 선택해 주세요.'
      : !groupHasSharedComparisonRevision
        ? '모든 설정의 비교 결과가 준비된 뒤 함께 확정할 수 있습니다.'
      : pendingGroupCandidates.some(candidate => (
          hasCharacterFactComparison(candidate)
          && !hasManualReview(candidate)
          && !isGroupExclusionProposal(candidate)
          && !getCharacterFactComparisonPolicy(candidate).canConfirm
        ))
        ? '모든 설정의 현재값 비교가 끝난 뒤 함께 확정할 수 있습니다.'
        : pendingGroupCandidates.some(candidate => !candidate.id)
          ? '식별할 수 없는 설정이 있어 확정할 수 없습니다.'
          : null;
  const selectedGroupUnlinked = Boolean(selectedGroup && isUnlinkedCandidateGroup(selectedGroup));
  // 연결한 후보가 재조회 뒤 이 묶음에서 빠졌을 때만 안내한다. 같은 묶음에 남으면 카드만 갱신된다.
  const visibleRecentLink = recentLink && !selectedGroupCandidates.some(candidate => candidate.id === recentLink.candidateId)
    && (selectedGroupKey === recentLink.sourceGroupKey
      || recentLink.advancedGroupKey != null && selectedGroupKey === recentLink.advancedGroupKey)
    ? recentLink : null;
  const confirmSaveKey = selectedGroup?.groupKey ? `confirm:${selectedGroup.groupKey}` : null;
  const confirmSaveState = saveTracker.stateFor(confirmSaveKey);
  const confirmSelectedGroup = () => {
    if (!selectedGroup?.groupKey || actionPending || groupConfirmBlockedReason || saveTracker.busy(confirmSaveKey)) return;
    submitIntent({ kind: 'confirm', groupKey: selectedGroup.groupKey, previousGroups: groups, variables: {
      query: { sourceAnalysisJobId }, path: { workId },
      body: {
        batchId,
        comparisonRevision,
        acceptDisplayedResults: acceptsDisplayedResults || undefined,
        candidates: pendingGroupCandidates.map(candidate => ({
          candidateId: candidate.id!,
          applicationMode: isGroupExclusionProposal(candidate) ? 'APPLY_PROPOSAL' : applicationModeForCandidate(candidate),
          baseSnapshotVersion: appliesToCurrent(candidate) ? candidate.currentSnapshotVersion : candidate.comparisonBaseSnapshotVersion ?? null,
          applyToCurrent: appliesToCurrent(candidate) ? true : undefined,
          applyEditedValue: hasManualReview(candidate) || candidate.analysisMode === 'ORDERED_PROVISIONAL' && candidate.userModified ? true : undefined,
          expectedUpdatedAt: appliesToCurrent(candidate) || acceptsDisplayedResults || hasManualReview(candidate) ? candidate.updatedAt : undefined,
        })),
      },
    } });
  };
  const backToAnalysisList = () => {
    // 화면 전환 애니메이션 동안 남아 있는 effect가 검토 URL을 다시 쓰지 못하게 한다.
    leavingReviewRef.current = true;
    returnToAnalysisList(
      routerNavigate,
      reviewNavigationState,
      sourceScope.source?.sourceKind === 'SETTING_BOOK' ? bookWorkspaceUrl(workId, sourceScope.source.settingBookId) : workId ? `/dashboard?workId=${encodeURIComponent(workId)}&nav=analyses` : '/works',
    );
  };
  const finishReview = () => {
    leavingReviewRef.current = true;
    if (sourceScope.source?.sourceKind === 'SETTING_BOOK') routerNavigate(bookWorkspaceUrl(workId, sourceScope.source.settingBookId), { replace: true });
    else replaceWithManuscriptList(routerNavigate, workId);
  };

  const total = listData?.totalCandidateCount ?? 0;
  const pending = listData?.pendingCandidateCount ?? 0;
  const worldPending = worldSummary?.pendingCandidateCount ?? 0;
  const combinedPending = pending + worldPending;
  const reviewProgress = combinedSettingReviewProgress(listData, worldSummary);
  const characterReviewComplete = reviewFilter === 'PENDING_REVIEW' && listQuery.isSuccess
    && !listQuery.isPlaceholderData && listData?.pendingCandidateCount === 0
    && (listData.processingCandidateCount ?? 0) === 0 && total > 0 && groups.length === 0;
  const totalPages = groupPage?.totalPages ?? 0;
  const currentPage = groupPage?.page ?? apiPage;
  const reviewComplete = listQuery.isSuccess
    && listData?.batchId === batchId
    && worldSummaryQuery.isSuccess
    && combinedPending === 0
    && (reviewProgress.directReview ?? 0) === 0
    && (reviewProgress.processing ?? 0) === 0
    && Boolean(workId);

  useEffect(() => {
    if (leavingReviewRef.current || window.location.pathname !== '/setting-review') return;
    if (listQuery.fetchStatus === 'fetching') return;
    if (groupPage?.page != null && groupPage.page !== apiPage) return;
    const serverTotalPages = groupPage?.totalPages;
    if (serverTotalPages == null || apiPage < Math.max(serverTotalPages, 1)) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('page', String(Math.max(serverTotalPages, 1)));
      next.delete('group');
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  }, [apiPage, groupPage?.page, groupPage?.totalPages, listQuery.fetchStatus, location.state, setSearchParams]);

  if (!hasContext) {
    return (
      <div className="setting-review-screen theme-v2 workspace-v2">
        <ReviewHeader onBack={backToAnalysisList} />
        <main style={{ maxWidth: 920, margin: '0 auto', padding: '60px 24px' }}>
          <QueryState
            icon={<AlertCircle size={28} color={C.warning} />}
            title="검토할 분석 정보를 찾을 수 없습니다."
            description="작품과 업로드 묶음 정보가 모두 필요합니다. 분석 완료 화면에서 다시 들어와 주세요."
            action={<ActionButton tone={C.primary} onClick={backToAnalysisList}>분석 목록으로</ActionButton>}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="setting-review-screen theme-v2 workspace-v2" style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <ReviewHeader onBack={backToAnalysisList} />
      <main ref={mainRef} className="setting-review-main" style={{ flex: 1, overflowY: 'auto' }}>
        <div ref={contentRef} className="setting-review-content" style={{ maxWidth: 1450, margin: '0 auto', padding: '26px 28px 70px' }}>
          {sourceScope.message && <p data-testid="book-review-source-state" role="status">{sourceScope.message}</p>}
          <SettingReviewSummary
            episodeRange={sourceScope.source?.sourceKind === 'SETTING_BOOK' ? analysisSourceLabel(sourceScope.source) : sourceAnalysisJobId && !sourceScope.source ? '분석 출처 확인 중' : listData ? formatEpisodeRange(
              listData.episodeStartNo,
              listData.episodeEndNo,
              listData.episodeCount ?? 0,
            ) : listQuery.isError ? '회차 정보 확인 불가' : undefined}
            progress={reviewProgress}
            unavailable={listQuery.isError && !listData || worldSummaryQuery.isError && !worldSummary}
          />
          <SettingReviewTabs
            active="character"
            character={{ total: listData?.totalCandidateCount, directReview: listData?.directReviewCandidateCount, processing: listData?.processingCandidateCount, unavailable: listQuery.isError && !listData }}
            world={{ total: worldSummary?.totalCandidateCount, directReview: worldSummary?.directReviewCandidateCount, processing: worldSummary?.processingCandidateCount, unavailable: worldSummaryQuery.isError && !worldSummary }}
          />

          {listQuery.isPending && !listQuery.data ? (
            <QueryState
              icon={<Loader2 size={27} color={C.primary} className="spin" />}
              title="설정 후보를 불러오고 있습니다."
              description="이번 업로드 묶음의 회차 범위와 검토 상태를 확인하고 있습니다."
            />
          ) : listQuery.isError && !listQuery.data ? (
            <QueryState
              icon={<AlertCircle size={28} color={C.danger} />}
              title="설정 후보를 불러오지 못했습니다."
              description={errorMessage(listQuery.error, '잠시 후 다시 시도해 주세요.')}
              action={(
                <button
                  type="button"
                  onClick={() => void listQuery.refetch()}
                  style={{
                    minHeight: 36, padding: '0 14px', borderRadius: 7,
                    border: `1px solid ${C.primary}`, background: `${C.primary}12`,
                    color: REVIEW_TEXT.primary, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={13} /> 다시 시도
                  </span>
                </button>
              )}
            />
          ) : (
            <>
              {worldSummaryQuery.isError && (
                <div role="alert" style={{
                  marginTop: 12, padding: '10px 13px', borderRadius: 7,
                  border: `1px solid ${C.warning}55`, background: `${C.warning}12`,
                  color: REVIEW_TEXT.warning, fontSize: 12,
                }}>
                  세계관 후보 집계를 불러오지 못해 전체 완료 여부를 확인할 수 없습니다.
                </div>
              )}

              {listQuery.isError && listQuery.data && (
                <div role="alert" style={{
                  marginTop: 12, padding: '10px 13px', borderRadius: 7,
                  border: `1px solid ${C.danger}55`, background: `${C.danger}12`,
                  color: REVIEW_TEXT.danger, fontSize: 12,
                }}>
                  최신 후보를 불러오지 못해 마지막으로 확인한 목록을 표시합니다.
                </div>
              )}

              {legacyCandidateId && legacyResolutionError && (
                <div role="alert" style={{
                  marginTop: 12, padding: '10px 13px', borderRadius: 7,
                  border: `1px solid ${C.danger}55`, background: `${C.danger}12`,
                  color: REVIEW_TEXT.danger, fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <span>공유된 후보의 묶음 위치를 찾지 못했습니다.</span>
                  <button
                    type="button"
                    onClick={() => {
                      resolvingLegacyCandidateRef.current = null;
                      setLegacyResolutionError(false);
                      setLegacyResolutionAttempt(attempt => attempt + 1);
                    }}
                    style={{
                      minHeight: 32, padding: '0 11px', borderRadius: 6,
                      border: `1px solid ${C.danger}88`, background: 'transparent',
                      color: REVIEW_TEXT.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {total === 0 ? (
                <div style={{ marginTop: 20 }}>
                  <QueryState
                    icon={<Sparkles size={29} color={C.primary} />}
                    title="검토할 설정 후보가 없습니다."
                    description="이번 분석에서 추출된 캐릭터 후보가 없습니다. 세계관 후보는 위 탭에서 계속 검토할 수 있습니다."
                  />
                </div>
              ) : (
                <div className={`setting-review-layout${mobileDetailOpen ? ' mobile-detail-open' : ''}`} style={{
                  marginTop: 18, display: 'grid',
                  gridTemplateColumns: 'minmax(310px, 390px) minmax(0, 1fr)',
                  gap: 18, alignItems: 'start',
                }}>
                  <aside className="setting-review-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <FilterGroup
                      label="검토 상태"
                      value={reviewFilter}
                      options={REVIEW_FILTERS}
                      onChange={value => updateFilters(value, matchFilter)}
                    />
                    <FilterGroup
                      label="캐릭터 연결 상태"
                      value={matchFilter}
                      options={MATCH_FILTERS}
                      onChange={value => updateFilters(reviewFilter, value)}
                    />
                    <div style={{ color: REVIEW_TEXT.muted, fontSize: 11 }}>{sourceScope.source?.sourceKind === 'SETTING_BOOK' ? '↑ 생성 순' : '↑ 회차 번호 · 생성 순'}</div>

                    {groups.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {groups.map(group => (
                          <CandidateGroupCard
                            key={group.groupKey!}
                            group={group}
                            selected={group.groupKey === selectedGroupKey}
                            disabled={false}
                            onClick={() => selectGroup(group.groupKey!)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="review-empty-state" style={{
                        padding: '30px 18px', borderRadius: 9, border: `1px solid ${C.border}`,
                        background: C.surface, textAlign: 'center', color: REVIEW_TEXT.muted, fontSize: 12,
                      }}>
                        <div className="review-empty-state__title">{characterReviewComplete ? '캐릭터 검토를 마쳤어요' : '조건에 맞는 설정 후보가 없습니다.'}</div>
                        {characterReviewComplete && worldPending > 0 && <div className="review-type-complete-mobile-action"><OtherSettingReviewAction current="character" /></div>}
                      </div>
                    )}

                    <PageNavigation
                      page={currentPage}
                      totalPages={totalPages}
                      disabled={listQuery.isPending}
                      onPageChange={changePage}
                    />
                  </aside>

                  <section className="setting-review-detail">
                    <button
                      type="button"
                      className="setting-review-mobile-back"
                      onClick={() => setMobileDetailOpen(false)}
                    >
                      <ChevronLeft size={15} /> 후보 목록으로
                    </button>
                    {!selectedGroup ? (
                      <QueryState
                        icon={<Sparkles size={26} color={C.primary} />}
                        title={characterReviewComplete ? '캐릭터 검토를 마쳤어요'
                          : groups.length === 0 ? '조건에 맞는 캐릭터 후보가 없습니다.' : '캐릭터 후보 묶음을 선택해 주세요.'}
                        description={characterReviewComplete
                          ? worldPending > 0 ? '남은 세계관 후보를 확인해 주세요. 반영·제외한 캐릭터 설정은 검토 상태 필터에서 다시 볼 수 있어요.' : '반영·제외한 캐릭터 설정은 검토 상태 필터에서 다시 볼 수 있어요.'
                          : groups.length === 0 ? '검토 상태와 캐릭터 연결 상태 필터를 바꾸면 다른 후보를 확인할 수 있어요.'
                          : '같은 이름으로 추출된 설정을 함께 확인하고 한 번에 확정할 수 있습니다.'}
                        action={characterReviewComplete && worldPending > 0 ? <OtherSettingReviewAction current="character" /> : undefined}
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <article style={{
                          border: `1px solid ${C.border}`, borderRadius: 10,
                          background: C.surface, overflow: 'hidden',
                        }}>
                          <header style={{ padding: '18px 20px 15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 180 }}>
                              <div style={{ color: REVIEW_TEXT.muted, fontSize: 11 }}>{selectedGroupUnlinked ? '미연결 후보' : '같은 캐릭터 후보'}</div>
                              <h2 className="setting-review-group-title" data-review-group-title tabIndex={-1}
                                style={{ color: REVIEW_TEXT.ink, fontSize: 18, fontWeight: 700, margin: '4px 0 0' }}>
                                {selectedGroupUnlinked ? '인물 미확인' : selectedGroup.entityName || '이름 없는 캐릭터'}
                                <span style={{ color: REVIEW_TEXT.muted, fontSize: 12, fontWeight: 500, marginLeft: 8 }}>
                                  {selectedGroupCandidates.length}개 설정
                                </span>
                              </h2>
                            </div>
                            {pendingGroupCandidates.length > 0 && (
                              <ActionButton
                                disabled={actionPending
                                  || groupAutomaticPending
                                  || groupHasInvalidCandidate
                                  || matchFilter !== 'ALL'
                                  || legacyGroupedActionsUnsafe}
                                disabledTitle={groupAutomaticPending ? automaticApplicationPendingMessage(sourceScope.source) : groupHasInvalidCandidate
                                  ? '값 형식이 잘못된 설정을 수정하거나 제외한 뒤 일괄 연결해 주세요.'
                                  : legacyGroupedActionsUnsafe
                                  ? '이 캐릭터의 설정이 일부만 표시되어 한꺼번에 연결할 수 없습니다.'
                                  : matchFilter !== 'ALL'
                                  ? '연결 상태 필터를 전체로 바꾼 뒤 그룹 전체 연결을 변경해 주세요.'
                                  : undefined}
                                tone={C.primary}
                                onClick={() => {
                                  groupMatchMutation.reset();
                                  setGroupMatchOpen(true);
                                }}
                              >
                                캐릭터 일괄 연결
                              </ActionButton>
                            )}
                            </div>
                            <p style={{ margin: '7px 0 0', color: REVIEW_TEXT.text, fontSize: 12, lineHeight: 1.6 }}>
                              {selectedGroupUnlinked
                                ? '인물이 확인되지 않은 설정이에요. 같은 인물로 가정하지 않으니 설정마다 대상을 확인해 연결해 주세요.'
                                : '같은 캐릭터에서 추출된 설정을 아래로 이어서 검토하고 남은 항목을 함께 확정합니다.'}
                            </p>
                            {pendingGroupCandidates.some(candidate => candidate.manualReviewAvailable
                              && !isAutomaticApplicationPending(candidate)) && <OrderedReviewImpactNotice />}
                            {visibleRecentLink && <ReviewNotice tone="info"
                              title={`‘${visibleRecentLink.label}’ ${visibleRecentLink.discovery ? '인물 후보를' : '설정을'} ‘${visibleRecentLink.characterName}’에 연결했어요.`}
                              action={<span className="review-cb-notice__buttons">
                                <button type="button" className="review-cb-secondary" onClick={() => openLinkedGroup(visibleRecentLink)}>연결한 묶음 보기</button>
                                <button type="button" className="review-cb-secondary" onClick={() => setRecentLink(null)}>닫기</button>
                              </span>}>
                              {visibleRecentLink.hiddenByFilter ? '이 필터에서는 보이지 않아요.'
                                : visibleRecentLink.advancedGroupKey !== undefined && visibleRecentLink.advancedGroupKey === selectedGroupKey
                                  ? '원래 묶음에 남은 설정이 없어 다음 묶음을 열었어요.'
                                  : '이 묶음에서는 더 이상 보이지 않아요.'}
                            </ReviewNotice>}
                          </header>

                          {selectedGroupCandidates.map(candidate => candidate.id && (
                            <CandidateDetail
                              key={candidate.id}
                              candidate={candidate}
                              workId={workId}
                              onSaveValue={value => updateSelectedCandidate(candidate.id!, candidate.attributeName!, value)}
                              onReviewDecision={candidate.manualReviewAvailable
                                ? mode => updateSelectedCandidate(candidate.id!, candidate.attributeName!, candidate.attributeValue?.trim() || null, mode,
                                  undefined, mode === 'APPLY_PROPOSAL' && candidate.source?.sourceKind === 'SETTING_BOOK') : undefined}
                              onResolveTarget={(resolution, value) => matchSelectedCandidate(candidate.id!, resolution, value)}
                              manuallyReviewed={hasManualReview(candidate)}
                              decisionChosen={currentApplicationKey(candidate)
                                ? appliesToCurrent(candidate) || applicationModeForCandidate(candidate) === 'HISTORY_ONLY'
                                : hasManualReview(candidate) || Boolean(applicationModes[candidate.id!])}
                              applicationMode={applicationModeForCandidate(candidate)}
                              actionError={dismissErrorForCandidate(candidate.id)
                                ?? (respondedError(updateMutation) && updateMutation.variables?.path.candidateId === candidate.id
                                  ? errorMessage(updateMutation.error, '설정값을 저장하지 못했습니다. 입력을 유지했어요.') : null)
                                ?? (respondedError(matchMutation) && matchMutation.variables?.path.candidateId === candidate.id
                                  ? errorMessage(matchMutation.error, '인물을 연결하지 못했습니다. 다시 선택해 주세요.') : null)}
                              actionPending={actionPending || saveTracker.busy(candidate.id)}
                              saveState={saveTracker.stateFor(candidate.id).kind === 'idle' && hasManualReview(candidate)
                                ? { kind: 'saved' } : saveTracker.stateFor(candidate.id)}
                              saveActionsDisabled={actionPending}
                              localChoiceMarked={!hasManualReview(candidate) && (currentApplicationKey(candidate)
                                ? appliesToCurrent(candidate) : Boolean(applicationModes[candidate.id!]))}
                              dismissing={dismissMutation.isPending
                                && dismissMutation.variables.path.candidateId === candidate.id}
                              retrying={retryComparisonMutation.isPending
                                && retryComparisonMutation.variables.path.candidateId === candidate.id}
                              retryError={retryErrorForCandidate(candidate.id)}
                              onDismiss={candidate.reviewStatus === 'PENDING_REVIEW'
                                ? () => dismissCandidate(candidate.id!)
                                : undefined}
                              onEdit={candidate.reviewStatus === 'PENDING_REVIEW'
                                ? () => {
                                    updateMutation.reset();
                                    setEditCandidate(candidate);
                                  }
                                : undefined}
                              onMatch={candidate.reviewStatus === 'PENDING_REVIEW'
                                && !isCandidateValueInvalid(candidate)
                                ? resolution => {
                                    matchMutation.reset();
                                    setMatchTarget({ candidate, resolution });
                                  }
                                : undefined}
                              onApplicationModeChange={mode => {
                                setCurrentApplication(candidate.id!, mode === 'APPLY_PROPOSAL' && candidate.applyToCurrentAvailable
                                  ? currentApplicationKey(candidate) : null);
                                onApplicationModeChange(candidate.id!, mode);
                              }}
                              onRetryComparison={() => retryCandidateComparison(candidate.id!)}
                            />
                          ))}

                          {pendingGroupCandidates.length > 0 && (
                            <footer style={{
                              position: 'sticky', bottom: 0, zIndex: 2,
                              borderTop: `1px solid ${C.border}`,
                              padding: '14px 18px', background: `${C.surface}F5`,
                              boxShadow: '0 -8px 24px rgba(0,0,0,0.18)',
                              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                            }}>
                              <div style={{ flex: 1, minWidth: 220 }}>
                                <strong style={{ color: 'var(--ch-ink)', fontSize: 13 }}>
                                  {selectedGroupUnlinked
                                    ? `미연결 후보 ${pendingGroupCandidates.length}개 설정을 함께 확정합니다.`
                                    : `${selectedGroup.entityName}의 ${pendingGroupCandidates.length}개 설정을 함께 확정합니다.`}
                                </strong>
                                {groupExclusionCount > 0 && <div className="review-group-decision-count" style={{ color: REVIEW_TEXT.text, fontSize: 12, marginTop: 4 }}>
                                  반영 {pendingGroupCandidates.length - groupExclusionCount}개 · 제외 {groupExclusionCount}개
                                </div>}
                                <div style={{ color: groupConfirmBlockedReason ? REVIEW_TEXT.warning : REVIEW_TEXT.muted, fontSize: 11, marginTop: 4 }}>
                                  {matchFilter !== 'ALL'
                                    ? '그룹 전체를 안전하게 확정하려면 연결 상태 필터를 전체로 바꿔 주세요.'
                                    : groupConfirmBlockedReason
                                      ?? '각 항목에서 선택한 확정 방식을 함께 적용합니다.'}
                                </div>
                              </div>
                              <ActionButton
                                disabled={Boolean(groupConfirmBlockedReason) || matchFilter !== 'ALL' || actionPending
                                  || saveTracker.busy(confirmSaveKey)}
                                disabledTitle={matchFilter !== 'ALL'
                                  ? '연결 상태 필터를 전체로 바꿔 주세요.'
                                  : groupConfirmBlockedReason ?? undefined}
                                tone={C.success}
                                onClick={confirmSelectedGroup}
                              >
                                {confirmMutation.isPending
                                  ? '전체 확정 중…'
                                  : `${pendingGroupCandidates.length}개 설정 모두 확정`}
                              </ActionButton>
                              {groupConfirmError && (
                                <div role="alert" style={{ width: '100%', color: REVIEW_TEXT.danger, fontSize: 12 }}>
                                  {groupConfirmError}
                                </div>
                              )}
                              {confirmSaveState.kind === 'unverified' && (
                                <div className="review-group-save-state" role="status">
                                  <span>{unverifiedSaveMessage(confirmSaveState.attempt, confirmSaveState.final)}</span>
                                  {/* 서버는 같은 묶음의 같은 결정을 decision hash로 한 번만 반영하므로 재전송해도 중복 반영되지 않는다. */}
                                  {confirmSaveState.final && <span className="review-cb-notice__buttons">
                                    <button type="button" className="review-cb-secondary" disabled={actionPending} onClick={confirmSaveState.check}>{REVIEW_SAVE_TEXT.check}</button>
                                    <button type="button" className="review-cb-secondary" disabled={actionPending} onClick={confirmSaveState.retry}>{REVIEW_SAVE_TEXT.retry}</button>
                                  </span>}
                                </div>
                              )}
                            </footer>
                          )}
                        </article>
                      </div>
                    )}
                  </section>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                <ActionButton
                  disabled={!reviewComplete}
                  tone={reviewComplete ? C.success : C.primary}
                  onClick={finishReview}
                >
                  {reviewComplete
                    ? sourceScope.source?.sourceKind === 'SETTING_BOOK' ? '설정집으로' : '원고 목록으로'
                    : remainingReviewLabel(reviewProgress)}
                </ActionButton>
              </div>
            </>
          )}
        </div>
      </main>
      {editCandidate?.id && (
        <CandidateEditModal
          key={editCandidate.id}
          candidate={editCandidate}
          pending={updateMutation.isPending}
          automaticPending={candidateAutomaticPending(editCandidate.id)}
          readOnly={sourceScope.blocked}
          error={selectedCandidateUpdateError}
          onClose={() => {
            if (updateMutation.isPending) return;
            updateMutation.reset();
            setEditCandidate(null);
          }}
          onSubmit={(attributeName, attributeValue, mode) => (
            updateSelectedCandidate(editCandidate.id!, attributeName, attributeValue, mode, editCandidate.updatedAt)
          )}
        />
      )}
      {selectedGroup && pendingGroupCandidates[0] && groupMatchOpen && (
        <CharacterMatchModal
          key={`group-${selectedGroup.groupKey}`}
          workId={workId}
          candidate={pendingGroupCandidates[0]}
          initialResolution="MATCH_EXISTING"
          groupCandidateCount={pendingGroupCandidates.length}
          pending={groupMatchMutation.isPending}
          automaticPending={groupAutomaticPending}
          readOnly={sourceScope.blocked}
          error={groupMatchError}
          onClose={() => {
            if (groupMatchMutation.isPending) return;
            groupMatchMutation.reset();
            setGroupMatchOpen(false);
          }}
          onSubmit={matchSelectedGroup}
        />
      )}
      {matchTarget?.candidate.id && (
        <CharacterMatchModal
          key={`${matchTarget.candidate.id}-${matchTarget.resolution}`}
          workId={workId}
          candidate={matchTarget.candidate}
          initialResolution={matchTarget.resolution}
          pending={matchMutation.isPending}
          automaticPending={candidateAutomaticPending(matchTarget.candidate.id)}
          readOnly={sourceScope.blocked}
          error={selectedCandidateMatchError}
          onClose={() => {
            if (matchMutation.isPending) return;
            matchMutation.reset();
            setMatchTarget(null);
          }}
          onSubmit={(resolution, value) => (
            matchSelectedCandidate(matchTarget.candidate.id!, resolution, value)
          )}
        />
      )}
      <style>{`
        @media (max-width: 768px) {
          .setting-review-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .setting-review-content {
            padding: 18px 16px calc(32px + env(safe-area-inset-bottom)) !important;
          }

          .setting-review-layout.mobile-detail-open .setting-review-sidebar {
            display: none !important;
          }

          .setting-review-layout:not(.mobile-detail-open) .setting-review-detail {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
