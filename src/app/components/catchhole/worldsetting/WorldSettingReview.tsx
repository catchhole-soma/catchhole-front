import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  FileText,
  Globe2,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import {
  useLocation,
  useNavigate as useRouterNavigate,
  useSearchParams,
} from 'react-router';
import {
  confirmWorldSettingCandidateGroupMutation,
  dismissWorldSettingCandidateGroupMutation,
  getAnalysisBatchesQueryKey,
  getSettingCandidatesOptions,
  getWorldSettingCandidateOptions,
  getWorldSettingCandidatesOptions,
  getWorldSettingCandidatesQueryKey,
  getWorldSettingsQueryKey,
  resumeTokenInterruptedWorldSettingComparisonsMutation,
  resumeTokenInterruptedWorldSettingComparisonsMutationKey,
  retryWorldSettingCandidateComparisonMutation,
  updateWorldSettingCandidateDecisionsMutation,
} from '../../../api/generated/@tanstack/react-query.gen';
import type {
  Decision,
  WorldSettingCandidateGroupResponse,
  WorldSettingCandidateResponse,
} from '../../../api/generated/types.gen';
import { useAppNavigate } from '../../../hooks/useAppNavigate';
import { returnToAnalysisList, type ReviewReturnState } from '../../../lib/review-navigation';
import { toApiError } from '../../../lib/api-errors';
import { notifyAiTokenQuotaExhausted } from '../../../lib/ai-token-quota';
import { shouldRetryQuery } from '../../../lib/query-client';
import { C } from '../constants';
import { PageNavigation } from '../PageNavigation';
import { UserMenu } from '../UserMenu';
import { SettingReviewTabs } from './SettingReviewTabs';

type WorldCategory = NonNullable<WorldSettingCandidateResponse['category']>;
type WorldOperation = NonNullable<WorldSettingCandidateResponse['suggestedOperation']>;
type ReviewStatus = NonNullable<WorldSettingCandidateResponse['reviewStatus']>;
type ComparisonStatus = NonNullable<WorldSettingCandidateResponse['comparisonStatus']>;
type ReviewFilter = ReviewStatus | 'ALL';
type CategoryFilter = WorldCategory | 'ALL';
type OperationFilter = WorldOperation | 'ALL';
type DecisionDraft = Omit<Decision, 'candidateId' | 'conflictResolved'>;
type StatusPresentation = { label: string; color: string; textColor?: string };
type InterruptionNoticeState = {
  activeBaselineCount: number | null;
  lastSettledCount: number | null;
};

const DEFAULT_PAGE_SIZE = 20;
const ACTIVE_COMPARISON_POLL_INTERVAL = 2_000;

const CATEGORY_META: Record<WorldCategory, { label: string; description: string; color: string }> = {
  RACE: { label: '종족', description: '공통 신체·문화·기원 특성을 가진 존재 집단', color: '#087EF2' },
  FACTION: { label: '세력', description: '국가·조직·종교·길드처럼 영향력을 가진 집단', color: '#4BB8D9' },
  LOCATION: { label: '장소', description: '반복 등장하거나 세계 구조에 영향을 주는 공간', color: '#00C896' },
  MONSTER: { label: '몬스터', description: '지속적인 특성이나 규칙이 있는 몬스터', color: '#E25C5C' },
  POWER_SYSTEM: { label: '마법·능력 체계', description: '마법과 능력의 원리·조건·한계', color: '#3976D4' },
  WORLD_RULE_HISTORY: { label: '규칙·역사', description: '세계의 법칙·제도·관습·역사', color: '#D4A04A' },
  IMPORTANT_ITEM: { label: '중요 아이템', description: '여러 회차에 영향을 주는 유물·도구', color: '#F4A261' },
};

const OPERATION_META: Record<WorldOperation, { label: string; color: string }> = {
  ADD: { label: '추가', color: C.success },
  UPDATE: { label: '수정', color: C.warning },
  MERGE: { label: '병합', color: C.primary },
  EXCLUDE: { label: '반영하지 않음', color: C.t3 },
};

const OPERATION_OPTIONS: Array<{ value: WorldOperation; label: string }> = Object.entries(OPERATION_META)
  .map(([value, meta]) => ({ value: value as WorldOperation, label: meta.label }));

const REVIEW_META: Record<ReviewStatus, { label: string; color: string }> = {
  PENDING_REVIEW: { label: '검토 대기', color: C.warning },
  CONFIRMED: { label: '확정', color: C.success },
  DISMISSED: { label: '제외됨', color: C.t3 },
};

const COMPARISON_META: Record<ComparisonStatus, { label: string; color: string }> = {
  PENDING: { label: '비교 대기', color: C.t3 },
  PROCESSING: { label: '비교 중', color: C.primary },
  COMPLETED: { label: '비교 완료', color: C.success },
  FAILED: { label: '비교 실패', color: C.danger },
  RECOMPARISON_REQUIRED: { label: '재비교 필요', color: C.warning },
};

const REVIEW_FILTERS: Array<{ value: ReviewFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'PENDING_REVIEW', label: '검토 대기' },
  { value: 'CONFIRMED', label: '확정' },
  { value: 'DISMISSED', label: '제외됨' },
];

const CATEGORY_FILTERS: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'ALL', label: '전체 분류' },
  ...Object.entries(CATEGORY_META).map(([value, meta]) => ({
    value: value as WorldCategory,
    label: meta.label,
  })),
];

const OPERATION_FILTERS: Array<{ value: OperationFilter; label: string }> = [
  { value: 'ALL', label: '전체 반영 방식' },
  ...Object.entries(OPERATION_META).map(([value, meta]) => ({
    value: value as WorldOperation,
    label: meta.label,
  })),
];

function parsePositiveInteger(value: string | null, fallback: number, maximum?: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return maximum === undefined ? parsed : Math.min(parsed, maximum);
}

function parseReviewFilter(value: string | null): ReviewFilter {
  return REVIEW_FILTERS.some(filter => filter.value === value) ? value as ReviewFilter : 'PENDING_REVIEW';
}

function parseCategoryFilter(value: string | null): CategoryFilter {
  return CATEGORY_FILTERS.some(filter => filter.value === value) ? value as CategoryFilter : 'ALL';
}

function parseOperationFilter(value: string | null): OperationFilter {
  return OPERATION_FILTERS.some(filter => filter.value === value) ? value as OperationFilter : 'ALL';
}

function shouldRetryCandidateQuery(failureCount: number, error: unknown): boolean {
  return toApiError(error)?.status !== 404 && shouldRetryQuery(failureCount, error, 2);
}

function errorMessage(error: unknown, fallback: string): string {
  return toApiError(error)?.message ?? (error instanceof Error ? error.message : fallback);
}

function isWorldReviewLocation(): boolean {
  const currentParams = new URLSearchParams(window.location.search);
  return window.location.pathname === '/setting-review'
    && currentParams.get('candidateType') === 'world';
}

function isComparisonActive(status?: ComparisonStatus): boolean {
  return status === 'PENDING' || status === 'PROCESSING';
}

function resolvedTargetSubjectName(candidate: WorldSettingCandidateResponse): string | undefined {
  return candidate.targetSubjectName ?? candidate.subjectName;
}

function formatEpisodeRange(start?: number | null, end?: number | null, count = 0): string {
  if (count === 0 || start == null || end == null) return '대상 회차 없음';
  return start === end ? `${start}화 · 1개 회차` : `${start}–${end}화 · ${count}개 회차`;
}

function episodeEvidenceLabel(episodeNos: number[] | undefined): string {
  const values = [...new Set(episodeNos ?? [])].sort((a, b) => a - b);
  return values.length ? `${values.map(value => `${value}화`).join('·')} 근거` : '회차 근거 없음';
}

function operationSummary(group: WorldSettingCandidateGroupResponse): string {
  const entries = [
    [group.addCount, '추가'],
    [group.updateCount, '수정'],
    [group.mergeCount, '병합'],
    [group.excludeCount, '반영 안 함'],
  ] as const;
  const summary = entries.filter(([count]) => (count ?? 0) > 0).map(([count, label]) => `${label} ${count}`).join(' · ');
  return summary || '변경 방식 확인 중';
}

interface EvidenceSpan {
  quote: string;
  startOffset?: number;
  endOffset?: number;
}

function evidenceSpans(value: unknown): EvidenceSpan[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'object' && value !== null && Array.isArray((value as { spans?: unknown }).spans)
      ? (value as { spans: unknown[] }).spans
      : [];
  return source.flatMap(item => {
    if (typeof item !== 'object' || item === null) return [];
    const span = item as Record<string, unknown>;
    const quote = span.quote ?? span.text ?? span.sourceText;
    if (typeof quote !== 'string' || !quote.trim()) return [];
    return [{
      quote: quote.trim(),
      startOffset: typeof span.startOffset === 'number' ? span.startOffset : undefined,
      endOffset: typeof span.endOffset === 'number' ? span.endOffset : undefined,
    }];
  });
}

function candidateDecision(candidate: WorldSettingCandidateResponse): DecisionDraft | null {
  if (candidate.finalOperation
      && candidate.finalCategory
      && candidate.finalSubjectName
      && candidate.finalSettingName
      && candidate.finalValue) {
    return {
      operation: candidate.finalOperation,
      category: candidate.finalCategory,
      subjectName: candidate.finalSubjectName,
      scopeName: candidate.finalScopeName ?? undefined,
      settingName: candidate.finalSettingName,
      value: candidate.finalValue,
      reviewNote: candidate.reviewNote ?? undefined,
    };
  }
  const operation = candidate.suggestedOperation;
  const category = candidate.category;
  const subjectName = resolvedTargetSubjectName(candidate);
  const scopeName = candidate.proposedScopeName ?? candidate.scopeName ?? undefined;
  const settingName = candidate.proposedSettingName ?? candidate.settingName;
  const value = candidate.proposedValue ?? candidate.extractedValue;
  if (!operation || !category || !subjectName || !settingName || !value) return null;
  return { operation, category, subjectName, scopeName, settingName, value };
}

function groupDecisionIdentity(
  group: WorldSettingCandidateGroupResponse,
  decisions: Record<string, DecisionDraft>,
): { category?: WorldCategory; subjectName?: string } {
  const identities = (group.candidates ?? []).flatMap(candidate => {
    const decision = (candidate.id ? decisions[candidate.id] : undefined) ?? candidateDecision(candidate);
    return decision ? [{ category: decision.category, subjectName: decision.subjectName }] : [];
  });
  const firstIdentity = identities[0];
  const sameIdentity = firstIdentity && identities.every(identity => (
    identity.category === firstIdentity.category
    && identity.subjectName.trim().normalize('NFC').toLocaleLowerCase('ko-KR')
      === firstIdentity.subjectName.trim().normalize('NFC').toLocaleLowerCase('ko-KR')
  ));
  if (sameIdentity) return firstIdentity;
  return {
    category: group.category ?? undefined,
    subjectName: group.subjectName ?? undefined,
  };
}

function userFacingComparisonReason(candidate: WorldSettingCandidateResponse): string | null {
  if (!candidate.comparisonReason) return null;
  const targetName = resolvedTargetSubjectName(candidate);
  let reason = candidate.comparisonReason;
  if (targetName) {
    reason = reason.replace(/T\d+/g, `기존 '${targetName}' 설정`);
  }
  return reason
    .replace(/\bkey로/gi, '설정 항목으로')
    .replace(/\bkey를/gi, '설정 항목을')
    .replace(/\bkey가/gi, '설정 항목이')
    .replace(/\bkey별/gi, '설정 항목별')
    .replace(/\bkey\b/gi, '설정 항목')
    .replace(/\bversion\b/gi, '확정 내용')
    .replace(/\bADD\b/g, '추가')
    .replace(/\bUPDATE\b/g, '수정')
    .replace(/\bMERGE\b/g, '병합')
    .replace(/\bEXCLUDE\b/g, '반영하지 않음');
}

function Badge({
  label,
  color,
  textColor = color,
}: {
  label: string;
  color: string;
  textColor?: string;
}) {
  return (
    <span className="review-badge" style={{
      display: 'inline-flex', alignItems: 'center', minHeight: 24,
      padding: '2px 8px', borderRadius: 12, border: `1px solid ${color}55`,
      background: `${color}18`, color: textColor, fontSize: 10, fontWeight: 750,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function ReviewHeader({ onBack }: { onBack: () => void }) {
  return (
    <header className="review-header app-topbar" style={{
      height: 62, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 28px', borderBottom: `1px solid ${C.border}`, background: C.bg,
    }}>
      <button type="button" aria-label="이전 화면" onClick={onBack} className="review-header__back" style={{
        width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`,
        background: 'transparent', color: C.t2, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ChevronLeft size={18} />
      </button>
      <div className="review-header__title">
        <small>AI ANALYSIS</small>
        <strong>세계관 후보 확정</strong>
      </div>
      <div className="review-header__spacer" />
      <UserMenu />
    </header>
  );
}

function ReviewSummary({
  episodeRange,
  total,
  reviewed,
  pending,
  attentionRequired,
}: {
  episodeRange: string;
  total: number;
  reviewed: number;
  pending: number;
  attentionRequired: number;
}) {
  const items = [
    ['분석 대상', episodeRange, C.t1],
    ['전체 후보', `${total}개`, C.t1],
    ['검토 완료', `${reviewed}개`, C.t1],
    ['검토 대기', `${pending}개`, pending > 0 ? C.warning : C.t1],
    ['확인 필요', `${attentionRequired}개`, attentionRequired > 0 ? C.warning : C.t1],
  ];
  return (
    <section className="setting-review-summary" aria-label="설정 후보 검토 요약" style={{
      padding: '18px 22px', borderRadius: 10, border: `1px solid ${C.border}`,
      background: C.surface, display: 'flex', alignItems: 'center', gap: 38, flexWrap: 'wrap',
    }}>
      {items.map(([label, value, color]) => (
        <div className="setting-review-summary__item" key={label}>
          <div style={{ color: C.t3, fontSize: 11, marginBottom: 5 }}>{label}</div>
          <strong style={{ color, fontSize: 15 }}>{value}</strong>
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <Badge label={`${reviewed}/${total} 검토`} color={C.primary} />
    </section>
  );
}

function QueryState({
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
      minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 10, border: `1px solid ${C.border}`,
      borderRadius: 10, background: C.surface, textAlign: 'center', padding: 24,
    }}>
      {icon}
      <strong style={{ color: C.t1, fontSize: 15 }}>{title}</strong>
      <span style={{ color: C.t3, fontSize: 12, lineHeight: 1.6 }}>{description}</span>
      {action}
    </div>
  );
}

function ActionButton({
  children,
  tone = C.t2,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  tone?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="review-action" disabled={disabled} onClick={onClick} style={{
      minHeight: 38, padding: '0 15px', borderRadius: 7,
      border: `1px solid ${disabled ? C.border : `${tone}88`}`,
      background: disabled ? 'transparent' : `${tone}18`,
      color: disabled ? C.t3 : tone, fontFamily: 'inherit', fontSize: 12,
      fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    }}>
      {children}
    </button>
  );
}

function FilterGroup<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className="review-filter" role="group" aria-label={label}>
      <div className="review-filter__label" style={{ color: C.t3, fontSize: 11, fontWeight: 650, marginBottom: 7 }}>{label}</div>
      <div className="review-filter__options" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {options.map(option => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              className={`review-filter__button${active ? ' is-active' : ''}`}
              onClick={() => onChange(option.value)}
              style={{
                minHeight: 30, padding: '0 10px', borderRadius: 7,
                border: `1px solid ${active ? C.primary : C.border}`,
                background: active ? `${C.primary}18` : 'transparent',
                color: active ? C.primary : C.t2,
                fontFamily: 'inherit', fontSize: 11, fontWeight: active ? 700 : 500,
                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.58 : 1,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function groupFailureKind(group: WorldSettingCandidateGroupResponse) {
  const failedCandidates = group.candidates?.filter(candidate => (
    candidate.comparisonStatus === 'FAILED'
  )) ?? [];
  const tokenInterruptedCount = failedCandidates.filter(candidate => (
    candidate.comparisonFailureCode === 'AI_TOKEN_QUOTA_EXHAUSTED'
  )).length;
  if (tokenInterruptedCount === 0) return 'FAILURE';
  if (tokenInterruptedCount === failedCandidates.length) return 'TOKEN_INTERRUPTED';
  return 'MIXED';
}

function groupStatusMeta(group: WorldSettingCandidateGroupResponse): StatusPresentation {
  const failureKind = groupFailureKind(group);
  switch (group.status) {
    case 'PENDING': return { label: '비교 대기', color: C.t3 };
    case 'PROCESSING': return { label: '비교 중', color: C.primary };
    case 'FAILED': return failureKind === 'TOKEN_INTERRUPTED'
      ? { label: '사용량 부족으로 중단', color: C.warning, textColor: 'var(--ch-warning-ink)' }
      : failureKind === 'MIXED'
        ? { label: '비교 중단·실패 혼합', color: C.danger, textColor: 'var(--ch-danger-ink)' }
        : { label: '비교 실패', color: C.danger };
    case 'RECOMPARISON_REQUIRED': return {
      label: group.recomparisonScope === 'GROUP' ? '그룹 재비교 필요' : '일부 재비교 필요',
      color: C.warning,
    };
    default: return { label: '검토 대기', color: C.warning };
  }
}

function WorldCandidateGroupCard({
  group,
  decisions,
  selected,
  disabled,
  onClick,
}: {
  group: WorldSettingCandidateGroupResponse;
  decisions: Record<string, DecisionDraft>;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const identity = groupDecisionIdentity(group, decisions);
  const category = identity.category ? CATEGORY_META[identity.category] : null;
  const status = groupStatusMeta(group);
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`world-candidate-group-card${selected ? ' is-selected' : ''}`} style={{
      width: '100%', padding: '15px 15px 14px', borderRadius: 10,
      border: `1px solid ${selected ? C.primary : C.border}`,
      background: selected ? `${C.primary}14` : C.surface,
      textAlign: 'left', fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.65 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        {category && <Badge label={category.label} color={category.color} />}
        <strong style={{
          color: C.t1, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {identity.subjectName || '대상명 없음'}
        </strong>
        <div style={{ flex: 1 }} />
        <Badge label={`${group.changeCount ?? 0}개 설정`} color={C.primary} />
      </div>
      <div style={{ color: C.t2, fontSize: 11, marginTop: 10 }}>{operationSummary(group)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 11, flexWrap: 'wrap' }}>
        <Badge label={episodeEvidenceLabel(group.evidenceEpisodeNos)} color={C.t2} />
        <Badge label={status.label} color={status.color} textColor={status.textColor} />
      </div>
    </button>
  );
}

function RecomparisonNotice({ group }: { group: WorldSettingCandidateGroupResponse }) {
  if (group.status === 'READY') return null;
  const status = groupStatusMeta(group);
  const failureKind = groupFailureKind(group);
  const reason = group.candidates?.find(candidate => candidate.comparisonErrorMessage)?.comparisonErrorMessage;
  const description = group.status === 'FAILED'
    ? failureKind === 'TOKEN_INTERRUPTED'
      ? '1차 추출 결과는 보존되어 있습니다. 상단의 남은 비교 재개로 이 항목을 이어서 처리할 수 있습니다.'
      : failureKind === 'MIXED'
        ? '사용량 부족으로 중단된 항목은 상단에서 재개하고, 그 외 실패 항목은 하단의 다시 비교로 처리해 주세요.'
        : '기존 세계관과 비교 결과를 만들지 못했습니다. 다시 비교하거나 설정을 수정해 주세요.'
    : group.status === 'RECOMPARISON_REQUIRED'
      ? reason || (group.recomparisonScope === 'GROUP'
        ? '대상의 생성·이름·분류가 바뀌어 이 대상의 모든 설정 항목을 다시 비교합니다.'
        : '확정된 내용이 바뀐 설정 항목만 최신 상태로 다시 비교합니다.')
      : group.status === 'PROCESSING'
        ? '최신 세계관 설정과 비교하고 있습니다. 완료되면 같은 화면에서 검토할 수 있습니다.'
        : '기존 세계관 설정과 비교할 차례를 기다리고 있습니다.';
  return (
    <div role="status" style={{
      margin: '0 22px 16px', padding: '12px 14px', borderRadius: 8,
      border: `1px solid ${status.color}55`, background: `${status.color}12`,
      color: status.textColor ?? status.color, fontSize: 12, lineHeight: 1.6,
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      {group.status === 'PROCESSING' || group.status === 'PENDING'
        ? <Loader2 size={15} className="spin" style={{ marginTop: 2, flexShrink: 0 }} />
        : <AlertCircle size={15} style={{ marginTop: 2, flexShrink: 0 }} />}
      <div><strong>{status.label}</strong><br />{description}</div>
    </div>
  );
}

function WorldKeyDiffRow({
  candidate,
  decision,
  conflictResolved,
  recompared,
  disabled,
  onExclude,
  onEdit,
}: {
  candidate: WorldSettingCandidateResponse;
  decision: DecisionDraft | null;
  conflictResolved: boolean;
  recompared: boolean;
  disabled: boolean;
  onExclude: () => void;
  onEdit: () => void;
}) {
  const operation = decision?.operation ?? candidate.suggestedOperation;
  const consolidationStatus = candidate.consolidationStatus ?? 'SINGLE';
  const hasConflict = consolidationStatus === 'CONFLICT';
  const sourceValues = (candidate.extractedValue ?? '').split('\n').map(value => value.trim()).filter(Boolean);
  const operationMeta = operation ? OPERATION_META[operation] : null;
  const comparison: StatusPresentation = candidate.comparisonStatus === 'FAILED'
    && candidate.comparisonFailureCode === 'AI_TOKEN_QUOTA_EXHAUSTED'
    ? { label: '사용량 부족으로 중단', color: C.warning, textColor: 'var(--ch-warning-ink)' }
    : COMPARISON_META[candidate.comparisonStatus ?? 'PENDING'];
  const evidence = evidenceSpans(candidate.evidenceSpans);
  const scopeName = decision
    ? decision.scopeName ?? null
    : candidate.proposedScopeName ?? candidate.scopeName ?? null;
  const keyName = decision?.settingName ?? candidate.proposedSettingName ?? candidate.settingName ?? '설정명 없음';
  const propertyPath = scopeName ? `${scopeName} › ${keyName}` : keyName;
  const proposedValue = decision?.value ?? candidate.proposedValue ?? candidate.extractedValue;
  const proposedTone = hasConflict && !conflictResolved
    ? C.warning
    : operation === 'EXCLUDE' ? C.primary : C.success;
  const proposedLabel = hasConflict && !conflictResolved
    ? '확인이 필요한 추출값'
    : operation === 'EXCLUDE' ? '추출된 값' : '+ 제안값';
  const preservesExistingValue = operation === 'EXCLUDE';
  const beforeTone = preservesExistingValue ? C.t2 : C.danger;
  const beforeLabel = preservesExistingValue
    ? (candidate.beforeValue ? '비교한 기존값' : '비교 대상')
    : '− 기존값';
  const beforeValue = candidate.beforeValue
    || (operation === 'EXCLUDE' ? '비교 대상 없음' : '없음');
  const comparisonReason = userFacingComparisonReason(candidate);
  const canEdit = candidate.reviewStatus === 'PENDING_REVIEW'
    && candidate.comparisonStatus === 'COMPLETED'
    && decision !== null;
  const canExclude = candidate.reviewStatus === 'PENDING_REVIEW';
  return (
    <section className="world-setting-diff-row" style={{
      padding: '18px 22px', borderTop: `1px solid ${C.border}`,
      opacity: candidate.reviewStatus === 'PENDING_REVIEW' ? 1 : 0.68,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <strong style={{ color: C.t1, fontSize: 14, overflowWrap: 'anywhere' }}>{propertyPath}</strong>
        <div style={{ flex: 1 }} />
        {operationMeta && <Badge label={operationMeta.label} color={operationMeta.color} />}
        {consolidationStatus === 'MERGED' && <Badge label="여러 내용 정리됨" color={C.primary} />}
        {hasConflict && (
          <Badge label={conflictResolved ? '내용 확인 완료' : '내용 확인 필요'} color={conflictResolved ? C.success : C.warning} />
        )}
        <Badge
          label={candidate.sourceEpisodeNo == null ? '회차 근거 없음' : `${candidate.sourceEpisodeNo}화 근거`}
          color={C.t2}
        />
        {candidate.comparisonStatus !== 'COMPLETED' && (
          <Badge label={comparison.label} color={comparison.color} textColor={comparison.textColor} />
        )}
        {recompared && <Badge label="재비교됨" color={C.success} />}
        {candidate.reviewStatus && candidate.reviewStatus !== 'PENDING_REVIEW' && (
          <Badge label={REVIEW_META[candidate.reviewStatus].label} color={REVIEW_META[candidate.reviewStatus].color} />
        )}
        <button type="button" disabled={disabled || !canEdit} onClick={onEdit} style={{
          minHeight: 28, padding: '0 8px', borderRadius: 6, border: `1px solid ${C.border}`,
          background: 'transparent', color: disabled || !canEdit ? C.t3 : C.t2,
          fontFamily: 'inherit', fontSize: 10, cursor: disabled || !canEdit ? 'not-allowed' : 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}><Pencil size={10} /> 수정</button>
        {canExclude && (
          <button type="button" disabled={disabled} onClick={onExclude} aria-label={`${propertyPath} 제외`} style={{
            minHeight: 28, padding: '0 9px', borderRadius: 6, border: `1px solid ${C.danger}66`,
            background: `${C.danger}0D`, color: disabled ? C.t3 : C.danger,
            fontFamily: 'inherit', fontSize: 10, fontWeight: 750,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}>제외</button>
        )}
      </div>

      <div className="world-setting-key-diff-values" style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10,
        margin: '13px 0 0',
      }}>
        <div style={{
          minHeight: 72, padding: '12px 14px', borderRadius: 8,
          border: `1px solid ${preservesExistingValue ? C.border : `${C.danger}2F`}`,
          background: preservesExistingValue ? `${C.t2}08` : `${C.danger}0B`,
        }}>
          <div style={{ color: beforeTone, fontSize: 10, fontWeight: 750, marginBottom: 7 }}>{beforeLabel}</div>
          <div style={{ color: C.t2, fontSize: 12, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
            {beforeValue}
          </div>
        </div>
        <div style={{
          minHeight: 72, padding: '12px 14px', borderRadius: 8,
          border: `1px solid ${proposedTone}77`, background: `${proposedTone}16`,
          boxShadow: `inset 3px 0 0 ${proposedTone}`,
        }}>
          <div style={{ color: proposedTone, fontSize: 10, fontWeight: 800, marginBottom: 7 }}>{proposedLabel}</div>
          {hasConflict && !conflictResolved && sourceValues.length > 1 ? (
            <div style={{ display: 'grid', gap: 7 }}>
              {sourceValues.map((value, index) => (
                <div key={`${index}-${value}`} style={{ color: C.t1, fontSize: 12, fontWeight: 700, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
                  <span style={{ color: C.warning, fontSize: 9, marginRight: 7 }}>추출 {index + 1}</span>
                  {value}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: C.t1, fontSize: 13, fontWeight: 750, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
              {proposedValue || '값 없음'}
            </div>
          )}
        </div>
      </div>

      {consolidationStatus === 'MERGED' && (
        <div style={{
          margin: '10px 0 0', padding: '9px 12px', borderRadius: 7,
          border: `1px solid ${C.primary}3D`, background: `${C.primary}0A`,
          color: C.t2, fontSize: 11, lineHeight: 1.6,
        }}>
          여러 원문에서 추출된 내용을 하나의 설정으로 정리했습니다.
        </div>
      )}
      {hasConflict && !conflictResolved && (
        <div role="alert" style={{
          margin: '10px 0 0', padding: '10px 12px', borderRadius: 7,
          border: `1px solid ${C.warning}55`, background: `${C.warning}12`,
          color: C.warning, fontSize: 11, lineHeight: 1.6,
        }}>
          원문 내용이 서로 달라 자동으로 하나로 합치지 않았습니다. 수정에서 최종 설정값을 정해 주세요.
        </div>
      )}

      {comparisonReason && (
        <div style={{
          margin: '10px 0 0', padding: '10px 12px', borderRadius: 7,
          border: `1px solid ${C.primary}44`, background: `${C.primary}0C`,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <Sparkles size={13} color={C.primary} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: C.primary, fontSize: 10, fontWeight: 750, marginBottom: 4 }}>AI 비교 판단</div>
            <div style={{ color: C.t2, fontSize: 11, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
              {comparisonReason}
            </div>
          </div>
        </div>
      )}

      <div className="theme-evidence world-setting-evidence-card" style={{
        margin: '10px 0 0', padding: '10px 12px', borderRadius: 7,
        border: `1px solid ${C.border}`, background: C.bg,
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <FileText size={13} color={C.primary} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: C.primary, fontSize: 10, fontWeight: 750, marginBottom: 4 }}>1차 추출 원문</div>
          {evidence.length ? (
            <div style={{ display: 'grid', gap: 7 }}>
              {evidence.map((span, index) => (
                <div className="theme-evidence__quote" key={`${span.startOffset ?? 'unknown'}-${span.endOffset ?? index}-${span.quote}`} style={{
                  color: C.t1, fontSize: 11, lineHeight: 1.6, overflowWrap: 'anywhere',
                }}>
                  {evidence.length > 1 && (
                    <span style={{ color: C.t3, fontSize: 9, marginRight: 7 }}>근거 {index + 1}</span>
                  )}
                  “{span.quote}”
                </div>
              ))}
            </div>
          ) : (
            <div className="theme-evidence__empty" style={{ color: C.t3, fontSize: 11, lineHeight: 1.6 }}>표시할 원문 근거가 없습니다.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function WorldCandidateGroupDetail({
  group,
  resolvedConflictIds,
  recomparedIds,
  decisions,
  actionPending,
  actionError,
  onExclude,
  onEdit,
  onEditIdentity,
  onConfirm,
  onRetry,
  confirmationFiltered,
}: {
  group: WorldSettingCandidateGroupResponse;
  resolvedConflictIds: Set<string>;
  recomparedIds: Set<string>;
  decisions: Record<string, DecisionDraft>;
  actionPending: boolean;
  actionError?: string | null;
  onExclude: (candidateId: string) => void;
  onEdit: (candidate: WorldSettingCandidateResponse) => void;
  onEditIdentity: () => void;
  onConfirm: () => void;
  onRetry: () => void;
  confirmationFiltered: boolean;
}) {
  const candidates = group.candidates ?? [];
  const identity = groupDecisionIdentity(group, decisions);
  const category = identity.category ? CATEGORY_META[identity.category] : null;
  const pendingCandidates = candidates.filter(candidate => candidate.id && candidate.reviewStatus === 'PENDING_REVIEW');
  const duplicatePropertyPaths = (() => {
    const seen = new Map<string, string>();
    const duplicates = new Set<string>();
    for (const candidate of pendingCandidates) {
      if (!candidate.id) continue;
      if ((decisions[candidate.id]?.operation ?? candidate.suggestedOperation) === 'EXCLUDE') continue;
      const settingName = decisions[candidate.id]?.settingName
        ?? candidate.proposedSettingName
        ?? candidate.settingName;
      if (!settingName) continue;
      const selectedDecision = decisions[candidate.id] ?? candidateDecision(candidate);
      const scopeName = selectedDecision
        ? selectedDecision.scopeName ?? null
        : candidate.proposedScopeName ?? candidate.scopeName ?? null;
      const category = selectedDecision?.category ?? candidate.category;
      const subjectName = selectedDecision?.subjectName ?? resolvedTargetSubjectName(candidate);
      const normalizedScope = scopeName?.trim().normalize('NFC').toLocaleLowerCase('ko-KR') || null;
      const normalizedSetting = settingName.trim().normalize('NFC').toLocaleLowerCase('ko-KR');
      const normalizedSubject = subjectName?.trim().normalize('NFC').toLocaleLowerCase('ko-KR') ?? null;
      const normalized = JSON.stringify([category, normalizedSubject, normalizedScope, normalizedSetting]);
      const displayPath = scopeName ? `${scopeName.trim()} › ${settingName.trim()}` : settingName.trim();
      if (seen.has(normalized)) duplicates.add(seen.get(normalized) ?? displayPath);
      else seen.set(normalized, displayPath);
    }
    return [...duplicates];
  })();
  const unresolvedConflicts = pendingCandidates.filter(candidate => candidate.id
    && candidate.consolidationStatus === 'CONFLICT'
    && !resolvedConflictIds.has(candidate.id)
    && !candidate.userModified
    && (decisions[candidate.id]?.operation ?? candidate.suggestedOperation) !== 'EXCLUDE');
  const retryAvailable = candidates.some(candidate => (
    candidate.comparisonStatus === 'FAILED'
      && candidate.comparisonFailureCode !== 'AI_TOKEN_QUOTA_EXHAUSTED'
  ) || candidate.comparisonStatus === 'RECOMPARISON_REQUIRED');
  const confirmable = pendingCandidates.length > 0 && pendingCandidates
    .every(candidate => candidate.reviewStatus === 'PENDING_REVIEW'
      && candidate.comparisonStatus === 'COMPLETED'
      && Boolean(candidate.id && (decisions[candidate.id] ?? candidateDecision(candidate))))
    && duplicatePropertyPaths.length === 0
    && unresolvedConflicts.length === 0
    && !confirmationFiltered;
  return (
    <article className="world-candidate-detail-card" style={{ borderRadius: 11, border: `1px solid ${C.border}`, background: C.surface, overflow: 'hidden' }}>
      <header style={{ padding: '21px 22px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ color: C.t1, fontSize: 18 }}>
            {category?.label ?? '세계관'} · {identity.subjectName || '대상명 없음'}
          </strong>
          <div style={{ flex: 1 }} />
          <Badge label={`${group.changeCount ?? candidates.length}개 설정`} color={C.primary} />
          <button type="button" disabled={actionPending || pendingCandidates.length === 0} onClick={onEditIdentity} style={{
            minHeight: 32, padding: '0 10px', borderRadius: 6, border: `1px solid ${C.border}`,
            background: 'transparent', color: actionPending || pendingCandidates.length === 0 ? C.t3 : C.t2,
            fontFamily: 'inherit', fontSize: 11, fontWeight: 750,
            cursor: actionPending || pendingCandidates.length === 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}><Pencil size={11} /> 분류·대상 일괄 수정</button>
        </div>
        <p style={{ margin: '7px 0 0', color: C.t2, fontSize: 12, lineHeight: 1.6 }}>
          같은 대상에서 추출된 설정을 항목별로 검토합니다.
        </p>
      </header>

      <RecomparisonNotice group={group} />
      {candidates.map(candidate => candidate.id && (
        <WorldKeyDiffRow
          key={candidate.id}
          candidate={candidate}
          decision={decisions[candidate.id] ?? candidateDecision(candidate)}
          conflictResolved={resolvedConflictIds.has(candidate.id) || Boolean(candidate.userModified)}
          recompared={recomparedIds.has(candidate.id)}
          disabled={actionPending}
          onExclude={() => onExclude(candidate.id!)}
          onEdit={() => onEdit(candidate)}
        />
      ))}

      {duplicatePropertyPaths.length > 0 && (
        <div role="alert" style={{
          margin: '16px 22px 0', padding: '11px 13px', borderRadius: 7,
          border: `1px solid ${C.warning}55`, background: `${C.warning}12`,
          color: C.warning, fontSize: 12, lineHeight: 1.55,
        }}>
          같은 대상 안에서 같은 범위와 설정명 ‘{duplicatePropertyPaths.join('’, ‘')}’이 여러 번 있습니다.
          내용을 하나로 합치거나 중복 항목을 제외해 주세요.
        </div>
      )}

      {unresolvedConflicts.length > 0 && (
        <div role="alert" style={{
          margin: '16px 22px 0', padding: '11px 13px', borderRadius: 7,
          border: `1px solid ${C.warning}55`, background: `${C.warning}12`,
          color: C.warning, fontSize: 12, lineHeight: 1.55,
        }}>
          원문마다 내용이 다른 설정입니다. 수정에서 최종 내용을 정하거나 해당 항목을 제외해 주세요.
        </div>
      )}

      {actionError && (
        <div role="alert" style={{
          margin: '16px 22px 0', padding: '11px 13px', borderRadius: 7,
          border: `1px solid ${C.danger}55`, background: `${C.danger}12`,
          color: C.danger, fontSize: 12, lineHeight: 1.55,
        }}>
          {actionError}
        </div>
      )}

      {confirmationFiltered && pendingCandidates.length > 0 && (
        <div role="alert" style={{
          margin: '16px 22px 0', padding: '11px 13px', borderRadius: 7,
          border: `1px solid ${C.warning}55`, background: `${C.warning}12`,
          color: C.warning, fontSize: 12, lineHeight: 1.55,
        }}>
          반영 방식 필터를 해제한 뒤 이 대상의 모든 설정을 함께 확정해 주세요.
        </div>
      )}

      <footer style={{
        position: 'sticky', bottom: 0, zIndex: 2, marginTop: 18, padding: '16px 22px',
        borderTop: `1px solid ${C.border}`, background: `${C.surface}F5`,
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 9, flexWrap: 'wrap',
      }}>
        {retryAvailable && (
          <ActionButton disabled={actionPending} tone={C.warning} onClick={onRetry}>
            <RefreshCw size={12} /> 다시 비교
          </ActionButton>
        )}
        <button type="button" disabled={actionPending || !confirmable} onClick={onConfirm} style={{
          minHeight: 40, padding: '0 17px', borderRadius: 7, border: 'none',
          background: actionPending || !confirmable ? C.border : C.primary,
          color: actionPending || !confirmable ? C.t3 : '#fff', fontFamily: 'inherit',
          fontSize: 12, fontWeight: 800, cursor: actionPending || !confirmable ? 'not-allowed' : 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          {actionPending ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
          모두 확정
        </button>
      </footer>
    </article>
  );
}

function CandidateEditModal({
  initialDecision,
  identityOnly = false,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  initialDecision: DecisionDraft;
  identityOnly?: boolean;
  pending: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (draft: DecisionDraft) => void;
}) {
  const initialCategory = initialDecision.category;
  const initialSubject = initialDecision.subjectName;
  const initialScope = initialDecision.scopeName ?? '';
  const initialSetting = initialDecision.settingName;
  const [category, setCategory] = useState<WorldCategory>(initialCategory);
  const [subjectName, setSubjectName] = useState(initialSubject);
  const [scopeName, setScopeName] = useState(initialScope);
  const [settingName, setSettingName] = useState(initialSetting);
  const [operation, setOperation] = useState<WorldOperation>(initialDecision.operation);
  const [value, setValue] = useState(initialDecision.value);
  const [validationError, setValidationError] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedSubject = subjectName.trim();
    const normalizedScope = scopeName.trim() || undefined;
    const normalizedSetting = settingName.trim();
    const normalizedValue = value.trim();
    if (!normalizedSubject || !normalizedSetting || !normalizedValue) {
      setValidationError('대상명·설정명·최종 설정값을 모두 입력해 주세요.');
      return;
    }
    setValidationError(null);
    onSubmit({
      category,
      subjectName: normalizedSubject,
      scopeName: normalizedScope,
      settingName: normalizedSetting,
      operation,
      value: normalizedValue,
    });
  };

  const inputStyle = {
    width: '100%', height: 40, padding: '0 11px', boxSizing: 'border-box' as const,
    borderRadius: 7, border: `1px solid ${C.border}`, background: C.bg,
    color: C.t1, fontFamily: 'inherit', fontSize: 12, outline: 'none',
  };

  return (
    <div className="review-modal-layer" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !pending) onClose();
    }} style={{
      position: 'fixed', inset: 0, zIndex: 200, padding: 20, display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.68)',
    }}>
      <form className="review-modal" onSubmit={submit} style={{
        width: 'min(720px, 100%)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
        borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface,
        boxShadow: '0 24px 72px rgba(0,0,0,0.55)',
      }}>
        <div style={{ padding: '19px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center' }}>
          <strong style={{ color: C.t1, fontSize: 16 }}>
            {identityOnly
              ? '분류·대상 일괄 수정'
              : `${initialDecision.scopeName ? `${initialDecision.scopeName} › ` : ''}${initialDecision.settingName || '설정 항목'} 반영 내용 수정`}
          </strong>
          <div style={{ flex: 1 }} />
          <button type="button" disabled={pending} aria-label="닫기" onClick={onClose} style={{
            border: 'none', background: 'none', color: C.t3, cursor: pending ? 'not-allowed' : 'pointer', padding: 4,
          }}><X size={18} /></button>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{
            marginBottom: 18, padding: '12px 14px', borderRadius: 8,
            background: `${C.warning}12`, border: `1px solid ${C.warning}44`,
            color: C.warning, fontSize: 11, lineHeight: 1.6,
          }}>
            {identityOnly
              ? '이 묶음의 모든 미확정 설정에 분류와 대상을 함께 적용합니다. 범위·설정명·반영 방식·최종값은 그대로 유지하며 LLM 재비교는 호출하지 않습니다.'
              : '이 설정 항목 하나의 분류·대상·범위·설정명·반영 방식·최종값을 수정합니다. 다른 항목에는 적용되지 않으며 LLM 재비교도 호출하지 않습니다.'}
          </div>
          <div className="world-setting-edit-identity" style={{
            display: 'grid', gridTemplateColumns: '0.9fr 1.4fr', gap: 10,
          }}>
            <label style={{ color: C.t3, fontSize: 11 }}>분류
              <select value={category} onChange={event => setCategory(event.target.value as WorldCategory)} style={{ ...inputStyle, marginTop: 7 }}>
                {CATEGORY_FILTERS.slice(1).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label style={{ color: C.t3, fontSize: 11 }}>대상
              <input value={subjectName} onChange={event => setSubjectName(event.target.value)} style={{ ...inputStyle, marginTop: 7 }} />
            </label>
          </div>
          {!identityOnly && (
            <>
              <div className="world-setting-edit-property" style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.4fr', gap: 10, marginTop: 16 }}>
                <label style={{ color: C.t3, fontSize: 11 }}>범위 (선택)
                  <input
                    value={scopeName}
                    onChange={event => setScopeName(event.target.value)}
                    placeholder="예: 1층"
                    style={{ ...inputStyle, marginTop: 7 }}
                  />
                </label>
                <label style={{ color: C.t3, fontSize: 11 }}>설정명
                  <input value={settingName} onChange={event => setSettingName(event.target.value)} style={{ ...inputStyle, marginTop: 7 }} />
                </label>
              </div>
              <div className="world-setting-edit-value" style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 10, marginTop: 16 }}>
                <label style={{ color: C.t3, fontSize: 11 }}>반영 방식
                  <select value={operation} onChange={event => setOperation(event.target.value as WorldOperation)} style={{ ...inputStyle, marginTop: 7 }}>
                    {OPERATION_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label style={{ color: C.t3, fontSize: 11 }}>최종 설정값
                  <textarea value={value} onChange={event => setValue(event.target.value)} style={{
                    ...inputStyle, height: 92, padding: '10px 11px', marginTop: 7, resize: 'vertical',
                  }} />
                </label>
              </div>
            </>
          )}
          {(validationError || error) && <div role="alert" style={{ marginTop: 12, color: C.danger, fontSize: 12 }}>{validationError ?? error}</div>}
        </div>
        <div style={{ padding: '15px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <ActionButton disabled={pending} onClick={onClose}>취소</ActionButton>
          <button type="submit" disabled={pending} style={{
            minHeight: 40, padding: '0 17px', borderRadius: 7, border: 'none',
            background: C.primary, color: '#fff', fontFamily: 'inherit', fontSize: 12,
            fontWeight: 750, cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.62 : 1,
          }}>
            {pending ? '처리 중…' : identityOnly ? '일괄 수정 적용' : '수정안 적용'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function WorldSettingReview() {
  const navigate = useAppNavigate();
  const routerNavigate = useRouterNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const workId = searchParams.get('workId') ?? '';
  const batchId = searchParams.get('batchId') ?? '';
  const selectedGroupKey = searchParams.get('group');
  const legacyCandidateId = searchParams.get('candidate');
  const reviewFilter = parseReviewFilter(searchParams.get('reviewStatus'));
  const categoryFilter = parseCategoryFilter(searchParams.get('worldCategory'));
  const operationFilter = parseOperationFilter(searchParams.get('operation'));
  const urlPage = parsePositiveInteger(searchParams.get('page'), 1);
  const size = parsePositiveInteger(searchParams.get('size'), DEFAULT_PAGE_SIZE, 100);
  const apiPage = urlPage - 1;
  const hasContext = Boolean(workId && batchId);
  const [resolvedConflictIds, setResolvedConflictIds] = useState<Set<string>>(new Set());
  const [recomparedIds, setRecomparedIds] = useState<Set<string>>(new Set());
  const [decisionOverrides, setDecisionOverrides] = useState<Record<string, DecisionDraft>>({});
  const [editCandidate, setEditCandidate] = useState<WorldSettingCandidateResponse | null>(null);
  const [editIdentityOnly, setEditIdentityOnly] = useState(false);
  const [confirmedTarget, setConfirmedTarget] = useState<{
    id?: string;
    subjectName: string;
    targetCount: number;
    appliedCount: number;
    excludedCount: number;
  } | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(() => Boolean(selectedGroupKey || legacyCandidateId));
  const [legacyResolutionError, setLegacyResolutionError] = useState(false);
  const [legacyResolutionAttempt, setLegacyResolutionAttempt] = useState(0);
  const selectionGroupRef = useRef<string | null>(null);
  const resolvingLegacyCandidateRef = useRef<string | null>(null);
  const automaticRetryIds = useRef(new Set<string>());
  const leavingReviewRef = useRef(false);
  const reviewNavigationState = location.state as ReviewReturnState | null;

  const listQuery = useQuery({
    ...getWorldSettingCandidatesOptions({
      path: { workId },
      query: {
        batchId,
        reviewStatus: reviewFilter === 'ALL' ? undefined : reviewFilter,
        category: categoryFilter === 'ALL' ? undefined : categoryFilter,
        operation: operationFilter === 'ALL' ? undefined : operationFilter,
        page: apiPage,
        size,
      },
    }),
    enabled: hasContext,
    retry: shouldRetryCandidateQuery,
    // 비교 상태 폴링 중이라는 이유만으로 큰 검토 화면을 주기적으로 재렌더링하지 않는다.
    notifyOnChangeProps: ['data', 'error', 'status'],
    refetchInterval: query => {
      const data = query.state.data?.data;
      const activeCount = (data?.pendingComparisonCount ?? 0) + (data?.processingComparisonCount ?? 0);
      const currentPageActive = data?.groups?.content?.some(group => group.candidates?.some(candidate => (
        isComparisonActive(candidate.comparisonStatus)
      )));
      return activeCount > 0 || currentPageActive ? ACTIVE_COMPARISON_POLL_INTERVAL : false;
    },
  });
  const listData = listQuery.data?.data;
  const activeComparisonJobCount = listData?.activeComparisonJobCount ?? 0;
  const legacyCandidateQuery = useQuery({
    ...getWorldSettingCandidateOptions({
      path: { workId, candidateId: legacyCandidateId ?? '' },
      query: { batchId },
    }),
    enabled: hasContext && Boolean(legacyCandidateId),
    retry: shouldRetryCandidateQuery,
  });
  const groupPage = listData?.groups;
  const groups = useMemo(() => groupPage?.content ?? [], [groupPage?.content]);
  const selectedGroup = groups.find(group => group.groupKey === selectedGroupKey)
    ?? (legacyCandidateId ? groups.find(group => group.candidates?.some(candidate => candidate.id === legacyCandidateId)) : undefined);

  const characterSummaryQuery = useQuery({
    ...getSettingCandidatesOptions({
      path: { workId },
      query: { batchId, page: 0, size: 1, includeLegacyCandidates: false },
    }),
    enabled: hasContext,
    retry: shouldRetryCandidateQuery,
  });
  const characterSummary = characterSummaryQuery.data?.data;

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
      const targetReview: ReviewFilter = reviewFilter === 'ALL'
        || targetCandidate.reviewStatus === reviewFilter ? reviewFilter : 'ALL';
      const targetCategory: CategoryFilter = categoryFilter === 'ALL'
        || targetCandidate.category === categoryFilter ? categoryFilter : 'ALL';
      const candidateOperation = targetCandidate.finalOperation ?? targetCandidate.suggestedOperation;
      const targetOperation: OperationFilter = operationFilter === 'ALL'
        || candidateOperation === operationFilter ? operationFilter : 'ALL';
      let targetPage = 0;
      let targetGroupKey: string | null = null;

      while (!cancelled) {
        const response = await queryClient.fetchQuery(getWorldSettingCandidatesOptions({
          path: { workId },
          query: {
            batchId,
            reviewStatus: targetReview === 'ALL' ? undefined : targetReview,
            category: targetCategory === 'ALL' ? undefined : targetCategory,
            operation: targetOperation === 'ALL' ? undefined : targetOperation,
            page: targetPage,
            size,
          },
        }));
        const responseData = response.data;
        const owningGroup = responseData?.groups?.content?.find(group => (
          group.candidates?.some(candidate => candidate.id === legacyCandidateId)
        ));
        if (owningGroup?.groupKey) {
          targetGroupKey = owningGroup.groupKey;
          break;
        }
        targetPage += 1;
        if (targetPage >= (responseData?.groups?.totalPages ?? 0)) break;
      }

      if (cancelled || !targetGroupKey) {
        if (!cancelled) setLegacyResolutionError(true);
        return;
      }
      setLegacyResolutionError(false);
      setMobileDetailOpen(true);
      setSearchParams(previous => {
        const next = new URLSearchParams(previous);
        if (targetReview === 'PENDING_REVIEW') next.delete('reviewStatus');
        else next.set('reviewStatus', targetReview);
        if (targetCategory === 'ALL') next.delete('worldCategory');
        else next.set('worldCategory', targetCategory);
        if (targetOperation === 'ALL') next.delete('operation');
        else next.set('operation', targetOperation);
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
    categoryFilter,
    legacyCandidateId,
    legacyCandidateQuery.data?.data,
    legacyCandidateQuery.isSuccess,
    legacyResolutionAttempt,
    location.state,
    operationFilter,
    queryClient,
    reviewFilter,
    setSearchParams,
    size,
    workId,
  ]);

  useEffect(() => {
    if (legacyCandidateId) return;
    if (leavingReviewRef.current || window.location.pathname !== '/setting-review') return;
    // 수정 응답으로 대상 그룹이 바뀐 동안에는 이전 목록의 첫 그룹으로 되돌리지 않는다.
    if (!listQuery.isSuccess || listQuery.fetchStatus === 'fetching') return;
    const nextGroup = selectedGroup ?? groups[0];
    if (!nextGroup?.groupKey) return;
    if (selectedGroupKey === nextGroup.groupKey && !legacyCandidateId) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('group', nextGroup.groupKey!);
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  }, [groups, legacyCandidateId, listQuery.fetchStatus, listQuery.isSuccess, location.state, selectedGroup, selectedGroupKey, setSearchParams]);

  useEffect(() => {
    const groupKey = selectedGroup?.groupKey ?? null;
    if (selectionGroupRef.current === groupKey) return;
    selectionGroupRef.current = groupKey;
    setEditCandidate(null);
    setEditIdentityOnly(false);
  }, [selectedGroup]);

  useEffect(() => {
    selectionGroupRef.current = null;
    setResolvedConflictIds(new Set());
    setRecomparedIds(new Set());
    setDecisionOverrides({});
    setEditCandidate(null);
    setEditIdentityOnly(false);
  }, [batchId, workId]);

  const invalidateReviewState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getWorldSettingCandidatesQueryKey({ path: { workId }, query: { batchId } }) }),
      queryClient.invalidateQueries({ queryKey: getWorldSettingsQueryKey({ path: { workId } }) }),
    ]);
  };

  const invalidateResumeState = async () => {
    await Promise.all([
      invalidateReviewState(),
      queryClient.invalidateQueries({
        queryKey: getAnalysisBatchesQueryKey({ path: { workId } }),
        refetchType: 'all',
      }),
    ]);
  };

  const confirmMutation = useMutation({
    ...confirmWorldSettingCandidateGroupMutation(),
    onSuccess: async (response, variables) => {
      const confirmedIds = new Set(variables.body.candidates.map(candidate => candidate.candidateId));
      const result = response.data;
      const resultCandidates = result?.candidates ?? [];
      if (result && resultCandidates.length) {
        const excludedCount = resultCandidates.filter(candidate => candidate.finalOperation === 'EXCLUDE').length;
        const appliedCandidates = resultCandidates.filter(candidate => candidate.finalOperation !== 'EXCLUDE');
        const finalTargetKeys = new Set(appliedCandidates.flatMap(candidate => {
          const category = candidate.finalCategory ?? candidate.category;
          const subjectName = candidate.finalSubjectName ?? candidate.subjectName;
          return category && subjectName
            ? [`${category}|${subjectName.trim().normalize('NFC').toLocaleLowerCase('ko-KR')}`]
            : [];
        }));
        setConfirmedTarget({
          id: result.worldSettingId ?? undefined,
          subjectName: appliedCandidates[0]?.finalSubjectName
            ?? appliedCandidates[0]?.subjectName
            ?? resultCandidates[0]?.finalSubjectName
            ?? resultCandidates[0]?.subjectName
            ?? selectedGroup?.subjectName
            ?? '확정한 세계관 대상',
          targetCount: finalTargetKeys.size,
          appliedCount: resultCandidates.length - excludedCount,
          excludedCount,
        });
      }
      setDecisionOverrides(previous => Object.fromEntries(
        Object.entries(previous).filter(([candidateId]) => !confirmedIds.has(candidateId)),
      ));
      setResolvedConflictIds(previous => new Set(
        [...previous].filter(candidateId => !confirmedIds.has(candidateId)),
      ));
      setRecomparedIds(previous => new Set(
        [...previous].filter(candidateId => !confirmedIds.has(candidateId)),
      ));
      // mutation pending 상태를 목록·상세 캐시 갱신까지 유지해 이전 응답으로 중복 액션하지 못하게 한다.
      await invalidateReviewState();
    },
    onError: async () => {
      await invalidateReviewState();
    },
  });
  const dismissMutation = useMutation({
    ...dismissWorldSettingCandidateGroupMutation(),
    onSuccess: async (_response, variables) => {
      const dismissedIds = new Set(variables.body.candidateIds);
      setDecisionOverrides(previous => Object.fromEntries(
        Object.entries(previous).filter(([candidateId]) => !dismissedIds.has(candidateId)),
      ));
      setResolvedConflictIds(previous => new Set(
        [...previous].filter(candidateId => !dismissedIds.has(candidateId)),
      ));
      setRecomparedIds(previous => new Set(
        [...previous].filter(candidateId => !dismissedIds.has(candidateId)),
      ));
      await invalidateReviewState();
    },
  });
  const retryMutation = useMutation({
    ...retryWorldSettingCandidateComparisonMutation(),
    onSuccess: async () => {
      await invalidateReviewState();
    },
  });
  const resumeInterruptedMutation = useMutation({
    ...resumeTokenInterruptedWorldSettingComparisonsMutation({ path: { workId, batchId } }),
    onSuccess: async () => {
      await invalidateResumeState();
    },
    onError: async () => {
      await invalidateResumeState();
    },
  });
  const activeResumeRequestCount = useIsMutating({
    mutationKey: resumeTokenInterruptedWorldSettingComparisonsMutationKey({ path: { workId, batchId } }),
    exact: true,
  });
  const resumeRequestPending = resumeInterruptedMutation.isPending || activeResumeRequestCount > 0;
  const updateDecisionMutation = useMutation({
    ...updateWorldSettingCandidateDecisionsMutation(),
    onSuccess: async (response, variables) => {
      const updatedIds = new Set(variables.body.candidates.map(candidate => candidate.candidateId));
      const firstDecision = variables.body.candidates[0];
      const nextGroupKey = response.data?.groupKey;
      setDecisionOverrides(previous => Object.fromEntries(
        Object.entries(previous).filter(([candidateId]) => !updatedIds.has(candidateId)),
      ));
      setEditCandidate(null);
      setEditIdentityOnly(false);
      selectionGroupRef.current = null;
      if (isWorldReviewLocation()) {
        setSearchParams(previous => {
          const next = new URLSearchParams(previous);
          if (nextGroupKey) next.set('group', nextGroupKey);
          if (firstDecision && categoryFilter !== 'ALL' && categoryFilter !== firstDecision.category) {
            next.set('worldCategory', firstDecision.category);
          }
          if (firstDecision && operationFilter !== 'ALL' && operationFilter !== firstDecision.operation) {
            next.set('operation', firstDecision.operation);
          }
          next.set('page', '1');
          next.delete('candidate');
          return next;
        }, { replace: true, state: location.state });
      }
      await invalidateReviewState();
    },
  });

  useEffect(() => {
    const candidates = selectedGroup?.candidates ?? [];
    const recoveredIds: string[] = [];
    for (const candidate of candidates) {
      if (!candidate.id) continue;
      if (candidate.comparisonStatus === 'COMPLETED'
          && automaticRetryIds.current.has(candidate.id)) {
        recoveredIds.push(candidate.id);
        automaticRetryIds.current.delete(candidate.id);
      } else if (candidate.comparisonStatus === 'FAILED') {
        automaticRetryIds.current.delete(candidate.id);
      }
    }
    if (recoveredIds.length) {
      setRecomparedIds(previous => new Set([...previous, ...recoveredIds]));
    }
    const retryCandidate = candidates.find(candidate => candidate.id
      && (candidate.comparisonStatus === 'RECOMPARISON_REQUIRED'
        || (candidate.comparisonStatus === 'PENDING' && activeComparisonJobCount === 0))
      && !automaticRetryIds.current.has(candidate.id));
    if (!retryCandidate?.id || retryMutation.isPending) return;
    automaticRetryIds.current.add(retryCandidate.id);
    retryMutation.mutate({ path: { workId, candidateId: retryCandidate.id } });
  }, [activeComparisonJobCount, retryMutation, selectedGroup, workId]);

  const actionPending = confirmMutation.isPending
    || dismissMutation.isPending
    || retryMutation.isPending
    || resumeRequestPending
    || updateDecisionMutation.isPending;
  const resetActionsIfSettled = () => {
    // 네트워크 요청이 살아 있는 mutation은 유지하고, 이전 완료·오류 표시만 탐색 시 정리한다.
    if (actionPending) return;
    confirmMutation.reset();
    dismissMutation.reset();
    retryMutation.reset();
    updateDecisionMutation.reset();
  };
  const selectedActionError = updateDecisionMutation.error
    ?? confirmMutation.error
    ?? dismissMutation.error
    ?? retryMutation.error;
  const apiActionError = toApiError(selectedActionError);
  const conflictScope = apiActionError?.context?.scope;
  const conflictReason = apiActionError?.context?.reasonMessage;
  const actionError = selectedActionError
    ? `${typeof conflictScope === 'string' ? `${conflictScope} 재비교 · ` : ''}${typeof conflictReason === 'string'
      ? conflictReason
      : errorMessage(selectedActionError, '대상 그룹을 처리하지 못했습니다. 최신 상태를 확인해 주세요.')}`
    : null;

  const updateFilters = (nextReview: ReviewFilter, nextCategory: CategoryFilter, nextOperation: OperationFilter) => {
    setMobileDetailOpen(false);
    setEditCandidate(null);
    setEditIdentityOnly(false);
    resetActionsIfSettled();
    selectionGroupRef.current = null;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (nextReview === 'PENDING_REVIEW') next.delete('reviewStatus');
      else next.set('reviewStatus', nextReview);
      if (nextCategory === 'ALL') next.delete('worldCategory');
      else next.set('worldCategory', nextCategory);
      if (nextOperation === 'ALL') next.delete('operation');
      else next.set('operation', nextOperation);
      next.set('page', '1');
      next.delete('group');
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  };

  const selectGroup = (groupKey: string) => {
    setMobileDetailOpen(true);
    setEditCandidate(null);
    setEditIdentityOnly(false);
    resetActionsIfSettled();
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('group', groupKey);
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  };

  const changePage = (page: number) => {
    setMobileDetailOpen(false);
    selectionGroupRef.current = null;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('page', String(page + 1));
      next.delete('group');
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  };

  const pendingCandidates = (selectedGroup?.candidates ?? []).filter(candidate => (
    candidate.id && candidate.reviewStatus === 'PENDING_REVIEW'
  ));
  const confirmAll = () => {
    if (!selectedGroup || !batchId || actionPending || operationFilter !== 'ALL') return;
    const candidates = pendingCandidates.flatMap(candidate => {
      if (!candidate.id) return [];
      const decision = decisionOverrides[candidate.id] ?? candidateDecision(candidate);
      return decision ? [{
        candidateId: candidate.id,
        ...decision,
        conflictResolved: candidate.consolidationStatus === 'CONFLICT'
          ? resolvedConflictIds.has(candidate.id) || candidate.userModified
          : undefined,
      }] : [];
    });
    if (!candidates.length || candidates.length !== pendingCandidates.length) return;
    confirmMutation.mutate({ path: { workId }, body: { batchId, candidates } });
  };

  const dismissCandidate = (candidateId: string) => {
    if (!candidateId || actionPending) return;
    dismissMutation.mutate({
      path: { workId },
      body: { batchId, candidateIds: [candidateId] },
    });
  };

  const retryGroup = () => {
    if (!selectedGroup || actionPending) return;
    const candidate = selectedGroup.candidates?.find(item => item.id
      && (
        (item.comparisonStatus === 'FAILED'
          && item.comparisonFailureCode !== 'AI_TOKEN_QUOTA_EXHAUSTED')
        || item.comparisonStatus === 'RECOMPARISON_REQUIRED'
      ));
    if (!candidate?.id) return;
    automaticRetryIds.current.add(candidate.id);
    retryMutation.mutate({ path: { workId, candidateId: candidate.id } });
  };

  const submitEditedCandidate = (draft: DecisionDraft) => {
    if (!editCandidate?.id || actionPending) return;
    const candidates = editIdentityOnly
      ? pendingCandidates.flatMap(candidate => {
        if (!candidate.id) return [];
        const decision = decisionOverrides[candidate.id] ?? candidateDecision(candidate);
        return decision ? [{
          candidateId: candidate.id,
          ...decision,
          category: draft.category,
          subjectName: draft.subjectName,
        }] : [];
      })
      : [{ candidateId: editCandidate.id, ...draft }];
    if (!candidates.length || (editIdentityOnly && candidates.length !== pendingCandidates.length)) return;
    const resolvedConflictId = !editIdentityOnly && editCandidate.consolidationStatus === 'CONFLICT'
      ? editCandidate.id
      : null;
    updateDecisionMutation.mutate({
      path: { workId },
      body: { batchId, candidates },
    }, {
      onSuccess: () => {
        if (!resolvedConflictId) return;
        setResolvedConflictIds(previous => new Set([...previous, resolvedConflictId]));
      },
    });
  };

  const backToAnalysisList = () => {
    // 화면 전환 애니메이션 동안 남아 있는 effect가 검토 URL을 다시 쓰지 못하게 한다.
    leavingReviewRef.current = true;
    returnToAnalysisList(
      routerNavigate,
      reviewNavigationState,
      workId ? `/dashboard?workId=${encodeURIComponent(workId)}&nav=analyses` : '/works',
    );
  };

  const worldTotal = listData?.totalCandidateCount ?? 0;
  const worldReviewed = listData?.reviewedCandidateCount ?? 0;
  const worldPending = listData?.pendingCandidateCount ?? 0;
  const tokenInterruptedCount = listData?.tokenInterruptedComparisonCount ?? 0;
  const activeWorldComparisonCount = (listData?.pendingComparisonCount ?? 0)
    + (listData?.processingComparisonCount ?? 0);
  const canResumeTokenInterrupted = Boolean(listData?.canResumeTokenInterruptedComparisons)
    && tokenInterruptedCount > 0;
  const resumeResult = resumeInterruptedMutation.data?.data?.batchId === batchId
    ? resumeInterruptedMutation.data.data
    : undefined;
  const resumeError = resumeInterruptedMutation.variables?.path.batchId === batchId
    ? resumeInterruptedMutation.error
    : null;
  const interruptionNoticeStates = useRef(new Map<string, InterruptionNoticeState>());

  useEffect(() => {
    if (resumeRequestPending) return;
    const previousState = interruptionNoticeStates.current.get(batchId) ?? {
      activeBaselineCount: null,
      lastSettledCount: null,
    };
    if (activeComparisonJobCount > 0) {
      const activeBaselineCount = previousState.activeBaselineCount === null
        ? tokenInterruptedCount
        : Math.min(previousState.activeBaselineCount, tokenInterruptedCount);
      interruptionNoticeStates.current.set(batchId, { ...previousState, activeBaselineCount });
      return;
    }
    if (tokenInterruptedCount <= 0) {
      interruptionNoticeStates.current.delete(batchId);
      return;
    }

    const comparisonBaseline = previousState.activeBaselineCount ?? previousState.lastSettledCount;
    const shouldNotify = previousState.lastSettledCount === null
      || (comparisonBaseline !== null && tokenInterruptedCount > comparisonBaseline);
    interruptionNoticeStates.current.set(batchId, {
      activeBaselineCount: null,
      lastSettledCount: tokenInterruptedCount,
    });
    if (!shouldNotify) return;

    notifyAiTokenQuotaExhausted({
      kind: 'analysis-interrupted',
      interruptedComparisonCount: tokenInterruptedCount,
    });
  }, [activeComparisonJobCount, batchId, resumeRequestPending, tokenInterruptedCount]);

  const characterTotal = characterSummary?.totalCandidateCount ?? 0;
  const characterReviewed = characterSummary?.reviewedCandidateCount ?? 0;
  const characterPending = characterSummary?.pendingCandidateCount ?? 0;
  const worldAttention = (listData?.pendingComparisonCount ?? 0)
    + (listData?.processingComparisonCount ?? 0)
    + (listData?.failedComparisonCount ?? 0)
    + (listData?.recomparisonRequiredCount ?? 0)
    + (listData?.conflictCandidateCount ?? 0);
  const characterAttention = characterSummary?.matchRequiredCandidateCount ?? 0;
  const combinedTotal = characterTotal + worldTotal;
  const combinedReviewed = characterReviewed + worldReviewed;
  const combinedPending = characterPending + worldPending;
  const combinedAttention = characterAttention + worldAttention;
  const remainingWorldComparisonIssueCount = (listData?.failedComparisonCount ?? 0)
    + (listData?.recomparisonRequiredCount ?? 0);
  const summaryUnavailable = characterSummaryQuery.isError;
  const reviewComplete = combinedTotal > 0 && combinedPending === 0 && combinedAttention === 0
    && !summaryUnavailable && !characterSummaryQuery.isPending;
  const totalPages = groupPage?.totalPages ?? 0;
  const currentPage = groupPage?.page ?? apiPage;

  useEffect(() => {
    if (leavingReviewRef.current || window.location.pathname !== '/setting-review') return;
    const serverTotalPages = groupPage?.totalPages;
    if (serverTotalPages == null || apiPage < Math.max(serverTotalPages, 1)) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('page', String(Math.max(serverTotalPages, 1)));
      next.delete('group');
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  }, [apiPage, groupPage?.totalPages, location.state, setSearchParams]);

  if (!hasContext) {
    return (
      <div className="setting-review-screen theme-v2 workspace-v2 world-review-v2">
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
    <div className="setting-review-screen theme-v2 workspace-v2 world-review-v2" style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.bg,
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <ReviewHeader onBack={backToAnalysisList} />
      <main className="setting-review-main" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="world-setting-review-content" style={{ maxWidth: 1450, margin: '0 auto', padding: '26px 28px 70px' }}>
          <ReviewSummary
            episodeRange={formatEpisodeRange(listData?.episodeStartNo, listData?.episodeEndNo, listData?.episodeCount ?? 0)}
            total={combinedTotal}
            reviewed={combinedReviewed}
            pending={combinedPending}
            attentionRequired={combinedAttention}
          />
          <SettingReviewTabs
            active="world"
            character={{ reviewed: characterReviewed, total: characterTotal }}
            world={{ reviewed: worldReviewed, total: worldTotal }}
          />

          {tokenInterruptedCount > 0 && (
            <div className="world-token-resume-banner world-token-resume-banner--warning" role="status">
              <AlertCircle size={17} />
              <div className="world-token-resume-banner__body">
                <strong>{tokenInterruptedCount}개 세계관 설정 비교가 사용량 부족으로 중단됐습니다.</strong>
                <span>완료된 추출과 비교 결과는 유지됩니다. 추가 사용량을 받은 뒤 남은 비교만 이어서 처리할 수 있습니다.</span>
              </div>
              <ActionButton
                disabled={!canResumeTokenInterrupted
                  || activeWorldComparisonCount > 0
                  || resumeRequestPending}
                tone={C.warning}
                onClick={() => resumeInterruptedMutation.mutate({ path: { workId, batchId } })}
              >
                {resumeRequestPending
                  ? <><Loader2 size={13} className="spin" /> 재개 요청 중…</>
                  : <><RefreshCw size={13} /> 남은 비교 재개</>}
              </ActionButton>
            </div>
          )}

          {resumeResult && tokenInterruptedCount === 0 && (
            <div
              className={`world-token-resume-banner world-token-resume-banner--${activeWorldComparisonCount > 0
                ? 'progress'
                : remainingWorldComparisonIssueCount > 0
                  ? 'warning'
                  : 'success'}`}
              role="status"
            >
              {activeWorldComparisonCount > 0
                ? <Loader2 size={17} className="spin" />
                : remainingWorldComparisonIssueCount > 0
                  ? <AlertCircle size={17} />
                  : <Check size={17} />}
              <div className="world-token-resume-banner__body">
                <strong>
                  {activeWorldComparisonCount > 0
                    ? `${activeWorldComparisonCount}개 남은 비교를 진행하고 있습니다.`
                    : remainingWorldComparisonIssueCount > 0
                      ? `${remainingWorldComparisonIssueCount}개 비교 결과를 추가로 확인해 주세요.`
                      : `${resumeResult.resumedCandidateCount ?? 0}개 남은 비교를 모두 처리했습니다.`}
                </strong>
                <span>
                  {activeWorldComparisonCount === 0 && remainingWorldComparisonIssueCount > 0
                    ? '실패하거나 재비교가 필요한 후보에서 다시 비교해 주세요.'
                    : '후보 상태는 이 화면에서 자동으로 갱신됩니다.'}
                </span>
              </div>
            </div>
          )}

          {resumeError && (
            <div className="world-token-resume-banner world-token-resume-banner--danger" role="alert">
              <AlertCircle size={17} />
              <div className="world-token-resume-banner__body">
                <strong>남은 비교를 재개하지 못했습니다.</strong>
                <span>{errorMessage(resumeError, '추가 사용량을 확인한 뒤 다시 시도해 주세요.')}</span>
              </div>
            </div>
          )}

          {listQuery.isPending && !listQuery.data ? (
            <QueryState
              icon={<Loader2 size={27} color={C.primary} className="spin" />}
              title="세계관 후보를 불러오고 있습니다."
              description="같은 분류와 대상의 설정 항목을 하나의 그룹으로 묶고 있습니다."
            />
          ) : listQuery.isError && !listQuery.data ? (
            <QueryState
              icon={<AlertCircle size={28} color={C.danger} />}
              title="세계관 후보를 불러오지 못했습니다."
              description={errorMessage(listQuery.error, '잠시 후 다시 시도해 주세요.')}
              action={<ActionButton tone={C.primary} onClick={() => void listQuery.refetch()}><RefreshCw size={13} /> 다시 시도</ActionButton>}
            />
          ) : (
            <>
              {confirmedTarget && (
                <div role="status" style={{
                  marginTop: 12, padding: '11px 13px', borderRadius: 8,
                  border: `1px solid ${C.success}55`, background: `${C.success}12`,
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                }}>
                  <Check size={14} color={C.success} />
                  <span style={{ color: C.success, fontSize: 12, fontWeight: 700 }}>
                    {confirmedTarget.appliedCount > 0 && confirmedTarget.excludedCount > 0
                      ? confirmedTarget.targetCount > 1
                        ? `${confirmedTarget.targetCount}개 세계관 대상에 설정 ${confirmedTarget.appliedCount}개를 반영하고 ${confirmedTarget.excludedCount}개를 제외했습니다.`
                        : `${confirmedTarget.subjectName} 설정 ${confirmedTarget.appliedCount}개를 반영하고 ${confirmedTarget.excludedCount}개를 제외했습니다.`
                      : confirmedTarget.appliedCount > 0
                        ? confirmedTarget.targetCount > 1
                          ? `${confirmedTarget.targetCount}개 세계관 대상에 설정 ${confirmedTarget.appliedCount}개를 반영했습니다.`
                          : `${confirmedTarget.subjectName} 설정 ${confirmedTarget.appliedCount}개를 세계관 설정에 저장했습니다.`
                        : `${confirmedTarget.subjectName} 설정 ${confirmedTarget.excludedCount}개를 검토 결과 제외했습니다.`}
                  </span>
                  <div style={{ flex: 1 }} />
                  {confirmedTarget.id && (
                    <button type="button" onClick={() => navigate(
                      `/dashboard?workId=${encodeURIComponent(workId)}&nav=settingDB&tab=worldsettings&settingId=${encodeURIComponent(confirmedTarget.id!)}`,
                      'push-left',
                    )} style={{
                      border: 'none', background: 'none', color: C.primary,
                      fontFamily: 'inherit', fontSize: 11, fontWeight: 750, cursor: 'pointer',
                    }}>세계관 설정에서 보기</button>
                  )}
                  <button type="button" aria-label="확정 안내 닫기" onClick={() => setConfirmedTarget(null)} style={{
                    border: 'none', background: 'none', color: C.t3, cursor: 'pointer', padding: 2,
                  }}><X size={14} /></button>
                </div>
              )}

              {summaryUnavailable && (
                <div role="alert" style={{
                  marginTop: 12, padding: '10px 13px', borderRadius: 7,
                  border: `1px solid ${C.warning}55`, background: `${C.warning}12`, color: C.warning, fontSize: 12,
                }}>캐릭터 후보 집계를 불러오지 못해 전체 완료 여부를 확인할 수 없습니다.</div>
              )}
              {listQuery.isError && listQuery.data && (
                <div role="alert" style={{
                  marginTop: 12, padding: '10px 13px', borderRadius: 7,
                  border: `1px solid ${C.danger}55`, background: `${C.danger}12`, color: C.danger, fontSize: 12,
                }}>최신 후보를 불러오지 못해 마지막으로 확인한 대상 그룹을 표시합니다.</div>
              )}

              {legacyCandidateId && legacyResolutionError && (
                <div role="alert" style={{
                  marginTop: 12, padding: '10px 13px', borderRadius: 7,
                  border: `1px solid ${C.danger}55`, background: `${C.danger}12`,
                  color: C.danger, fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}>
                  <span>공유된 세계관 후보의 묶음 위치를 찾지 못했습니다.</span>
                  <button type="button" onClick={() => {
                    resolvingLegacyCandidateRef.current = null;
                    setLegacyResolutionError(false);
                    setLegacyResolutionAttempt(attempt => attempt + 1);
                  }} style={{
                    minHeight: 32, padding: '0 11px', borderRadius: 6,
                    border: `1px solid ${C.danger}88`, background: 'transparent',
                    color: C.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>다시 시도</button>
                </div>
              )}

              {worldTotal === 0 ? (
                <div style={{ marginTop: 20 }}>
                  <QueryState
                    icon={<Globe2 size={29} color={C.primary} />}
                    title="이번 분석에서 추출된 세계관 후보가 없습니다."
                    description="캐릭터 후보는 위 탭에서 계속 검토할 수 있습니다."
                  />
                </div>
              ) : (
                <div className={`world-setting-review-layout${mobileDetailOpen ? ' mobile-detail-open' : ''}`} style={{
                  marginTop: 18, display: 'grid', gridTemplateColumns: 'minmax(310px, 390px) minmax(0, 1fr)',
                  gap: 18, alignItems: 'start',
                }}>
                  <aside className="world-setting-review-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                    <FilterGroup label="검토 상태" value={reviewFilter} options={REVIEW_FILTERS} disabled={false}
                      onChange={value => updateFilters(value, categoryFilter, operationFilter)} />
                    <FilterGroup label="세계관 분류" value={categoryFilter} options={CATEGORY_FILTERS} disabled={false}
                      onChange={value => updateFilters(reviewFilter, value, operationFilter)} />
                    <FilterGroup label="제안된 반영 방식" value={operationFilter} options={OPERATION_FILTERS} disabled={false}
                      onChange={value => updateFilters(reviewFilter, categoryFilter, value)} />
                    <div style={{ color: C.t3, fontSize: 11 }}>대상별 변경 묶음 · 생성 순</div>
                    {groups.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {groups.map(group => group.groupKey && (
                          <WorldCandidateGroupCard
                            key={group.groupKey}
                            group={group}
                            decisions={decisionOverrides}
                            selected={group.groupKey === selectedGroup?.groupKey}
                            disabled={false}
                            onClick={() => selectGroup(group.groupKey!)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="review-empty-state" style={{
                        padding: '30px 18px', borderRadius: 9, border: `1px solid ${C.border}`,
                        background: C.surface, textAlign: 'center', color: C.t3, fontSize: 12,
                      }}>
                        <div className="review-empty-state__title">조건에 맞는 세계관 대상이 없습니다.</div>
                        <button className="review-empty-state__action" type="button" onClick={() => updateFilters('PENDING_REVIEW', 'ALL', 'ALL')} style={{
                          display: 'block', margin: '10px auto 0', border: 'none', background: 'none',
                          color: C.primary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                        }}>필터 초기화</button>
                      </div>
                    )}
                    <PageNavigation page={currentPage} totalPages={totalPages}
                      disabled={listQuery.isPending} onPageChange={changePage} />
                  </aside>

                  <section className="world-setting-review-detail">
                    <button type="button" className="world-setting-review-mobile-back" onClick={() => setMobileDetailOpen(false)} style={{
                      display: 'none', marginBottom: 10, border: 'none', background: 'none',
                      color: C.primary, fontFamily: 'inherit', cursor: 'pointer', fontSize: 12,
                    }}><ChevronLeft size={15} /> 대상 목록으로</button>
                    {!selectedGroup ? (
                      <QueryState
                        icon={<Sparkles size={26} color={C.primary} />}
                        title="세계관 대상을 선택해 주세요."
                        description="목록에서 대상을 선택하면 같은 대상의 설정 항목과 1차 원문 근거를 함께 확인할 수 있습니다."
                      />
                    ) : (
                      <WorldCandidateGroupDetail
                        group={selectedGroup}
                        resolvedConflictIds={resolvedConflictIds}
                        recomparedIds={recomparedIds}
                        decisions={decisionOverrides}
                        actionPending={actionPending}
                        actionError={actionError}
                        onExclude={dismissCandidate}
                        onEditIdentity={() => {
                          const candidate = pendingCandidates.find(item => item.id && candidateDecision(item));
                          if (!candidate) return;
                          confirmMutation.reset();
                          dismissMutation.reset();
                          updateDecisionMutation.reset();
                          setEditIdentityOnly(true);
                          setEditCandidate(candidate);
                        }}
                        onEdit={candidate => {
                          confirmMutation.reset();
                          dismissMutation.reset();
                          updateDecisionMutation.reset();
                          setEditIdentityOnly(false);
                          setEditCandidate(candidate);
                        }}
                        onConfirm={confirmAll}
                        onRetry={retryGroup}
                        confirmationFiltered={operationFilter !== 'ALL'}
                      />
                    )}
                  </section>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                <ActionButton disabled tone={reviewComplete ? C.success : C.primary}>
                  {reviewComplete
                    ? '전체 후보 검토 완료 (다음 작업에서 연결)'
                    : `검토 완료 · ${combinedPending}개 후보 · ${combinedAttention}개 확인 필요`}
                </ActionButton>
              </div>
            </>
          )}
        </div>
      </main>

      {editCandidate?.id && candidateDecision(editCandidate) && (
        <CandidateEditModal
          key={`${editCandidate.id}-${editIdentityOnly ? 'identity' : 'candidate'}`}
          initialDecision={decisionOverrides[editCandidate.id] ?? candidateDecision(editCandidate)!}
          identityOnly={editIdentityOnly}
          pending={actionPending}
          error={actionError}
          onClose={() => {
            if (actionPending) return;
            setEditCandidate(null);
            setEditIdentityOnly(false);
          }}
          onSubmit={submitEditedCandidate}
        />
      )}
      <style>{`
        @media (max-width: 768px) {
          .world-setting-review-layout { grid-template-columns: minmax(0, 1fr) !important; }
          .world-setting-review-content { padding: 18px 16px calc(32px + env(safe-area-inset-bottom)) !important; }
          .world-setting-review-layout.mobile-detail-open .world-setting-review-sidebar { display: none !important; }
          .world-setting-review-layout:not(.mobile-detail-open) .world-setting-review-detail { display: none !important; }
          .world-setting-review-mobile-back { display: inline-flex !important; align-items: center; gap: 4px; }
          .world-setting-key-diff-values { grid-template-columns: minmax(0, 1fr) !important; }
          .world-setting-edit-identity, .world-setting-edit-property, .world-setting-edit-value { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
