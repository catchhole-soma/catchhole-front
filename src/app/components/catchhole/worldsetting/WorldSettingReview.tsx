import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  confirmWorldSettingCandidateMutation,
  dismissWorldSettingCandidateMutation,
  getSettingCandidatesOptions,
  getWorldSettingCandidateOptions,
  getWorldSettingCandidateQueryKey,
  getWorldSettingCandidatesOptions,
  getWorldSettingCandidatesQueryKey,
  getWorldSettingsQueryKey,
  retryWorldSettingCandidateComparisonMutation,
  updateWorldSettingCandidateMutation,
} from '../../../api/generated/@tanstack/react-query.gen';
import type {
  WorldSettingCandidateConfirmRequest,
  WorldSettingCandidateResponse,
} from '../../../api/generated/types.gen';
import { useAppNavigate } from '../../../hooks/useAppNavigate';
import { toApiError } from '../../../lib/api-errors';
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

const DEFAULT_PAGE_SIZE = 20;
const ACTIVE_COMPARISON_POLL_INTERVAL = 2_000;

function isComparisonActive(status?: ComparisonStatus): boolean {
  return status === 'PENDING' || status === 'PROCESSING';
}

const CATEGORY_META: Record<WorldCategory, { label: string; description: string }> = {
  RACE: { label: '종족', description: '공통 신체·문화·기원 특성을 가진 존재 집단' },
  FACTION: { label: '세력', description: '국가·조직·종교·길드처럼 영향력을 가진 집단' },
  LOCATION: { label: '장소', description: '반복 등장하거나 세계 구조에 영향을 주는 공간' },
  MONSTER: { label: '몬스터', description: '지속적인 특성이나 규칙이 있는 몬스터' },
  POWER_SYSTEM: { label: '마법·능력 체계', description: '마법과 능력의 원리·조건·한계' },
  WORLD_RULE_HISTORY: { label: '규칙·역사', description: '세계의 법칙·제도·관습·역사' },
  IMPORTANT_ITEM: { label: '중요 아이템', description: '여러 회차에 영향을 주는 유물·도구' },
};

const OPERATION_META: Record<WorldOperation, { label: string; confirmLabel: string; color: string }> = {
  ADD: { label: '추가 제안', confirmLabel: '추가 확정', color: C.success },
  UPDATE: { label: '수정 제안', confirmLabel: '수정 확정', color: C.warning },
  MERGE: { label: '병합 제안', confirmLabel: '병합 확정', color: C.primary },
  EXCLUDE: { label: '제외 제안', confirmLabel: '제외 확정', color: C.t3 },
};

const REVIEW_META: Record<ReviewStatus, { label: string; color: string }> = {
  PENDING_REVIEW: { label: '검토 대기', color: C.warning },
  CONFIRMED: { label: '확정', color: C.success },
  DISMISSED: { label: '제외', color: C.t3 },
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
  { value: 'DISMISSED', label: '제외' },
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
  return REVIEW_FILTERS.some(filter => filter.value === value)
    ? value as ReviewFilter
    : 'PENDING_REVIEW';
}

function parseCategoryFilter(value: string | null): CategoryFilter {
  return CATEGORY_FILTERS.some(filter => filter.value === value)
    ? value as CategoryFilter
    : 'ALL';
}

function parseOperationFilter(value: string | null): OperationFilter {
  return OPERATION_FILTERS.some(filter => filter.value === value)
    ? value as OperationFilter
    : 'ALL';
}

function shouldRetryCandidateQuery(failureCount: number, error: unknown): boolean {
  return toApiError(error)?.status !== 404 && shouldRetryQuery(failureCount, error, 2);
}

function errorMessage(error: unknown, fallback: string): string {
  return toApiError(error)?.message ?? (error instanceof Error ? error.message : fallback);
}

function formatEpisodeRange(start?: number | null, end?: number | null, count = 0): string {
  if (count === 0 || start == null || end == null) return '대상 회차 없음';
  return start === end ? `${start}화 · 1개 회차` : `${start}–${end}화 · ${count}개 회차`;
}

function confidenceLabel(confidence?: number | null): { value: string; description: string; color: string } {
  if (confidence == null || confidence < 0 || confidence > 1) {
    return { value: '정보 없음', description: '근거 명확도 정보 없음', color: C.t3 };
  }
  const percent = `${Math.round(confidence * 100)}%`;
  if (confidence >= 0.7) {
    return { value: percent, description: '원문에서 명확히 확인되는 설정', color: C.success };
  }
  return { value: percent, description: '원문을 직접 확인해 주세요', color: C.warning };
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

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', minHeight: 24,
      padding: '2px 8px', borderRadius: 12, border: `1px solid ${color}55`,
      background: `${color}18`, color, fontSize: 10, fontWeight: 750,
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
      <button
        type="button"
        aria-label="이전 화면"
        onClick={onBack}
        style={{
          width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`,
          background: 'transparent', color: C.t2, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <ChevronLeft size={18} />
      </button>
      <strong style={{ color: C.t1, fontSize: 17 }}>설정 후보 검토</strong>
      <div style={{ flex: 1 }} />
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
    <section aria-label="설정 후보 검토 요약" style={{
      padding: '18px 22px', borderRadius: 10, border: `1px solid ${C.border}`,
      background: C.surface, display: 'flex', alignItems: 'center', gap: 38, flexWrap: 'wrap',
    }}>
      {items.map(([label, value, color]) => (
        <div key={label}>
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
    <div style={{
      minHeight: 320, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 10,
      border: `1px solid ${C.border}`, borderRadius: 10, background: C.surface,
      textAlign: 'center', padding: 24,
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
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        minHeight: 38, padding: '0 15px', borderRadius: 7,
        border: `1px solid ${disabled ? C.border : `${tone}88`}`,
        background: disabled ? 'transparent' : `${tone}18`,
        color: disabled ? C.t3 : tone, fontFamily: 'inherit',
        fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function SelectFilter<T extends string>({
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
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <span style={{ color: C.t3, fontSize: 11, fontWeight: 650 }}>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value as T)}
        style={{
          height: 36, padding: '0 10px', borderRadius: 7,
          border: `1px solid ${C.border}`, background: C.bg, color: C.t1,
          fontFamily: 'inherit', fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function WorldCandidateCard({
  candidate,
  selected,
  disabled,
  onClick,
}: {
  candidate: WorldSettingCandidateResponse;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const category = candidate.category ? CATEGORY_META[candidate.category] : null;
  const operation = candidate.suggestedOperation ? OPERATION_META[candidate.suggestedOperation] : null;
  const review = REVIEW_META[candidate.reviewStatus ?? 'PENDING_REVIEW'];
  const comparison = COMPARISON_META[candidate.comparisonStatus ?? 'PENDING'];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%', padding: '13px 14px', borderRadius: 9,
        border: `1px solid ${selected ? C.primary : C.border}`,
        background: selected ? `${C.primary}14` : C.surface,
        textAlign: 'left', fontFamily: 'inherit', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Badge label={candidate.sourceEpisodeNo == null ? '회차 정보 없음' : `${candidate.sourceEpisodeNo}화`} color={C.t2} />
        {category && <Badge label={category.label} color={C.primary} />}
        <div style={{ flex: 1 }} />
        {operation && <Badge label={operation.label.replace(' 제안', '')} color={operation.color} />}
      </div>
      <strong style={{
        display: 'block', color: C.t1, fontSize: 13,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {candidate.subjectName || '대상명 없음'} · {candidate.settingName || '설정명 없음'}
      </strong>
      <div style={{
        marginTop: 5, color: C.t2, fontSize: 12,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {candidate.extractedValue || '추출값 없음'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <Badge label={review.label} color={review.color} />
        {candidate.comparisonStatus !== 'COMPLETED' && (
          <Badge label={comparison.label} color={comparison.color} />
        )}
        {candidate.userModified && <Badge label="사용자 수정" color={C.primary} />}
        <div style={{ flex: 1 }} />
        <span style={{ color: C.t3, fontSize: 10 }}>
          근거 {confidenceLabel(candidate.extractionConfidence).value}
        </span>
      </div>
    </button>
  );
}

function DetailValue({ label, value, strong = false }: { label: string; value?: string | null; strong?: boolean }) {
  return (
    <div style={{
      minHeight: 72, padding: '14px 16px', borderRadius: 8,
      border: `1px solid ${strong ? `${C.primary}55` : C.border}`,
      background: strong ? `${C.primary}12` : C.bg,
    }}>
      <div style={{ color: strong ? C.primary : C.t3, fontSize: 10, marginBottom: 7 }}>{label}</div>
      <div style={{ color: C.t1, fontSize: strong ? 16 : 14, fontWeight: strong ? 750 : 650, lineHeight: 1.5 }}>
        {value || '값 없음'}
      </div>
    </div>
  );
}

function WorldCandidateDetail({
  candidate,
  actionPending,
  actionError,
  retrying,
  onDismiss,
  onEdit,
  onConfirm,
  onRetry,
}: {
  candidate: WorldSettingCandidateResponse;
  actionPending: boolean;
  actionError?: string | null;
  retrying: boolean;
  onDismiss: () => void;
  onEdit: () => void;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  const review = REVIEW_META[candidate.reviewStatus ?? 'PENDING_REVIEW'];
  const comparison = COMPARISON_META[candidate.comparisonStatus ?? 'PENDING'];
  const operation = candidate.suggestedOperation ? OPERATION_META[candidate.suggestedOperation] : null;
  const category = candidate.category ? CATEGORY_META[candidate.category] : null;
  const confidence = confidenceLabel(candidate.extractionConfidence);
  const evidence = evidenceSpans(candidate.evidenceSpans);
  const pendingReview = candidate.reviewStatus === 'PENDING_REVIEW';
  const comparisonReady = candidate.comparisonStatus === 'COMPLETED';
  const retryAvailable = candidate.comparisonStatus === 'FAILED'
    || candidate.comparisonStatus === 'RECOMPARISON_REQUIRED';
  const finalOperation = candidate.finalOperation ? OPERATION_META[candidate.finalOperation] : null;

  return (
    <article style={{
      minHeight: 560, padding: 22, borderRadius: 10,
      border: `1px solid ${C.border}`, background: C.surface,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 18, flexWrap: 'wrap' }}>
        <strong style={{ color: C.t1, fontSize: 17, marginRight: 4 }}>세계관 후보 상세</strong>
        <Badge label={review.label} color={review.color} />
        <Badge label={comparison.label} color={comparison.color} />
        {category && <Badge label={category.label} color={C.primary} />}
        {operation && <Badge label={operation.label} color={operation.color} />}
        <div style={{ flex: 1 }} />
        <Badge label={candidate.sourceEpisodeNo == null ? '회차 정보 없음' : `${candidate.sourceEpisodeNo}화`} color={C.t2} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <DetailValue label="대상" value={candidate.subjectName} />
        <DetailValue label="설정명" value={candidate.settingName} />
      </div>

      <div style={{ color: C.t3, fontSize: 11, fontWeight: 700, margin: '20px 0 9px' }}>
        기존 설정과 이번 추출값 비교
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <DetailValue label="비교 당시 기존 확정값" value={candidate.beforeValue} />
        <DetailValue label="이번 회차 추출값" value={candidate.extractedValue} />
      </div>

      {comparisonReady ? (
        <div style={{ marginTop: 12 }}>
          <DetailValue
            label={`확정 시 반영될 값 · ${candidate.proposedSettingName || candidate.settingName || '설정'}`}
            value={candidate.proposedValue}
            strong
          />
          <div style={{
            marginTop: 10, padding: '13px 15px', borderRadius: 8,
            border: `1px solid ${C.border}`, background: C.bg,
          }}>
            <div style={{ color: C.t3, fontSize: 10, marginBottom: 6 }}>AI 비교 이유</div>
            <div style={{ color: C.t2, fontSize: 12, lineHeight: 1.65 }}>
              {candidate.comparisonReason || '비교 이유가 제공되지 않았습니다.'}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          marginTop: 12, padding: '14px 15px', borderRadius: 8,
          border: `1px solid ${comparison.color}55`, background: `${comparison.color}12`,
          color: comparison.color, fontSize: 12, lineHeight: 1.6,
        }}>
          {candidate.comparisonStatus === 'FAILED'
            ? candidate.comparisonErrorMessage || '기존 세계관과 비교하지 못했습니다.'
            : candidate.comparisonStatus === 'RECOMPARISON_REQUIRED'
              ? '확정본이 바뀌어 최신 설정과 다시 비교하고 있습니다.'
              : candidate.comparisonStatus === 'PROCESSING'
                ? '기존 세계관 설정과 비교하고 있습니다.'
                : '기존 세계관 설정과 비교할 차례를 기다리고 있습니다.'}
        </div>
      )}

      <div style={{
        marginTop: 12, padding: '14px 15px', borderRadius: 8,
        border: `1px solid ${C.border}`, background: C.bg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: evidence.length ? 9 : 0 }}>
          <FileText size={14} color={C.primary} />
          <strong style={{ color: C.t2, fontSize: 12 }}>원문 근거</strong>
          <div style={{ flex: 1 }} />
          <span style={{ color: confidence.color, fontSize: 11, fontWeight: 700 }}>
            AI 근거 명확도 {confidence.value}
          </span>
        </div>
        {evidence.length ? evidence.map((span, index) => (
          <blockquote key={`${span.startOffset ?? index}-${span.quote}`} style={{
            margin: index ? '8px 0 0' : 0, paddingLeft: 12,
            borderLeft: `2px solid ${C.primary}88`, color: C.t1,
            fontSize: 12, lineHeight: 1.65,
          }}>
            “{span.quote}”
            {(span.startOffset != null || span.endOffset != null) && (
              <span style={{ display: 'block', color: C.t3, fontSize: 10, marginTop: 3 }}>
                offset {span.startOffset ?? '?'}–{span.endOffset ?? '?'}
              </span>
            )}
          </blockquote>
        )) : (
          <span style={{ color: C.t3, fontSize: 11 }}>{confidence.description} · 표시할 quote가 없습니다.</span>
        )}
      </div>

      {!pendingReview && (
        <div style={{
          marginTop: 12, padding: '14px 15px', borderRadius: 8,
          border: `1px solid ${review.color}55`, background: `${review.color}0F`,
        }}>
          <div style={{ color: review.color, fontSize: 11, fontWeight: 750, marginBottom: 7 }}>
            사용자 최종 결정 · {finalOperation?.label ?? review.label}
          </div>
          <div style={{ color: C.t1, fontSize: 13, lineHeight: 1.6 }}>
            {candidate.finalSubjectName || candidate.subjectName} · {candidate.finalSettingName || candidate.settingName}
            {candidate.reviewStatus === 'CONFIRMED' && ` · ${candidate.finalValue || '값 없음'}`}
          </div>
          <div style={{ color: C.t3, fontSize: 10, marginTop: 5 }}>
            {candidate.reviewedByDisplayName || '검토자 정보 없음'}
            {candidate.reviewedAt ? ` · ${new Date(candidate.reviewedAt).toLocaleString('ko-KR')}` : ''}
          </div>
        </div>
      )}

      {actionError && (
        <div role="alert" style={{
          marginTop: 12, padding: '11px 13px', borderRadius: 7,
          border: `1px solid ${C.danger}55`, background: `${C.danger}12`,
          color: C.danger, fontSize: 12, lineHeight: 1.55,
        }}>
          {actionError}
        </div>
      )}

      {pendingReview && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          <ActionButton disabled={actionPending} onClick={onDismiss}>제외</ActionButton>
          {retryAvailable ? (
            <ActionButton disabled={actionPending} tone={C.warning} onClick={onRetry}>
              {retrying ? '다시 비교 요청 중…' : '다시 비교'}
            </ActionButton>
          ) : (
            <ActionButton disabled={!comparisonReady || actionPending} tone={C.warning} onClick={onEdit}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Pencil size={12} /> 내용 수정
              </span>
            </ActionButton>
          )}
          {comparisonReady && operation && (
            <ActionButton
              disabled={actionPending}
              tone={operation.color}
              onClick={candidate.suggestedOperation === 'EXCLUDE' ? onDismiss : onConfirm}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Check size={13} /> {operation.confirmLabel}
              </span>
            </ActionButton>
          )}
        </div>
      )}
    </article>
  );
}

type CandidateDraft = WorldSettingCandidateConfirmRequest;

function CandidateEditModal({
  candidate,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  candidate: WorldSettingCandidateResponse;
  pending: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (draft: CandidateDraft, identityChanged: boolean) => void;
}) {
  const initialCategory = candidate.category ?? 'RACE';
  const initialSubject = candidate.subjectName ?? '';
  const initialSetting = candidate.proposedSettingName ?? candidate.settingName ?? '';
  const [category, setCategory] = useState<WorldCategory>(initialCategory);
  const [subjectName, setSubjectName] = useState(initialSubject);
  const [settingName, setSettingName] = useState(initialSetting);
  const [operation, setOperation] = useState<WorldOperation>(candidate.suggestedOperation ?? 'ADD');
  const [value, setValue] = useState(candidate.proposedValue ?? candidate.extractedValue ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const identityChanged = category !== initialCategory
    || subjectName.trim() !== initialSubject.trim()
    || settingName.trim() !== initialSetting.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedSubject = subjectName.trim();
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
      settingName: normalizedSetting,
      operation,
      value: normalizedValue,
    }, identityChanged);
  };

  const inputStyle = {
    width: '100%', height: 40, padding: '0 11px', boxSizing: 'border-box' as const,
    borderRadius: 7, border: `1px solid ${C.border}`, background: C.bg,
    color: C.t1, fontFamily: 'inherit', fontSize: 12, outline: 'none',
  };

  return (
    <div
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget && !pending) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, padding: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.68)',
      }}
    >
      <form onSubmit={submit} style={{
        width: 'min(720px, 100%)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
        borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface,
        boxShadow: '0 24px 72px rgba(0,0,0,0.55)',
      }}>
        <div style={{
          padding: '19px 22px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <strong style={{ color: C.t1, fontSize: 16 }}>반영안 수정</strong>
          <div style={{ flex: 1 }} />
          <button type="button" disabled={pending} aria-label="닫기" onClick={onClose} style={{
            border: 'none', background: 'none', color: C.t3,
            cursor: pending ? 'not-allowed' : 'pointer', padding: 4,
          }}><X size={18} /></button>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{
            marginBottom: 18, padding: '12px 14px', borderRadius: 8,
            background: `${C.warning}12`, border: `1px solid ${C.warning}44`,
            color: C.warning, fontSize: 11, lineHeight: 1.6,
          }}>
            분류·대상·설정명을 바꾸면 새 비교 대상을 찾기 위해 다시 비교합니다.
            반영 방식이나 최종값만 바꾸면 바로 확정할 수 있습니다.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: 10 }}>
            <label style={{ color: C.t3, fontSize: 11 }}>
              분류
              <select value={category} onChange={event => setCategory(event.target.value as WorldCategory)} style={{ ...inputStyle, marginTop: 7 }}>
                {CATEGORY_FILTERS.slice(1).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label style={{ color: C.t3, fontSize: 11 }}>
              대상
              <input value={subjectName} onChange={event => setSubjectName(event.target.value)} style={{ ...inputStyle, marginTop: 7 }} />
            </label>
            <label style={{ color: C.t3, fontSize: 11 }}>
              설정명
              <input value={settingName} onChange={event => setSettingName(event.target.value)} style={{ ...inputStyle, marginTop: 7 }} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 10, marginTop: 16 }}>
            <label style={{ color: C.t3, fontSize: 11 }}>
              반영 방식
              <select value={operation} onChange={event => setOperation(event.target.value as WorldOperation)} style={{ ...inputStyle, marginTop: 7 }}>
                {OPERATION_FILTERS.slice(1).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label style={{ color: C.t3, fontSize: 11 }}>
              최종 설정값
              <textarea value={value} onChange={event => setValue(event.target.value)} style={{
                ...inputStyle, height: 92, padding: '10px 11px', marginTop: 7, resize: 'vertical',
              }} />
            </label>
          </div>
          <div style={{
            marginTop: 14, padding: '11px 13px', borderRadius: 7,
            border: `1px solid ${C.border}`, background: C.bg,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          }}>
            <div>
              <div style={{ color: C.t3, fontSize: 10, marginBottom: 4 }}>비교 당시 기존값</div>
              <div style={{ color: C.t2, fontSize: 12 }}>{candidate.beforeValue || '값 없음'}</div>
            </div>
            <div>
              <div style={{ color: C.t3, fontSize: 10, marginBottom: 4 }}>이번 추출값</div>
              <div style={{ color: C.t2, fontSize: 12 }}>{candidate.extractedValue || '값 없음'}</div>
            </div>
          </div>
          {(validationError || error) && (
            <div role="alert" style={{ marginTop: 12, color: C.danger, fontSize: 12 }}>
              {validationError ?? error}
            </div>
          )}
        </div>
        <div style={{
          padding: '15px 22px', borderTop: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <ActionButton disabled={pending} onClick={onClose}>취소</ActionButton>
          <button type="submit" disabled={pending} style={{
            minHeight: 40, padding: '0 17px', borderRadius: 7, border: 'none',
            background: C.primary, color: '#fff', fontFamily: 'inherit',
            fontSize: 12, fontWeight: 750, cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.62 : 1,
          }}>
            {pending ? '처리 중…' : identityChanged ? '변경안 다시 비교' : operation === 'EXCLUDE' ? '제외 확정' : '수정 후 확정'}
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
  const selectedCandidateId = searchParams.get('candidate');
  const reviewFilter = parseReviewFilter(searchParams.get('reviewStatus'));
  const categoryFilter = parseCategoryFilter(searchParams.get('worldCategory'));
  const operationFilter = parseOperationFilter(searchParams.get('operation'));
  const urlPage = parsePositiveInteger(searchParams.get('page'), 1);
  const size = parsePositiveInteger(searchParams.get('size'), DEFAULT_PAGE_SIZE, 100);
  const apiPage = urlPage - 1;
  const hasContext = Boolean(workId && batchId);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmedTarget, setConfirmedTarget] = useState<{ id: string; subjectName: string } | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(() => Boolean(selectedCandidateId));
  const mountedRef = useRef(false);
  const automaticRetryIds = useRef(new Set<string>());
  const reviewNavigationState = location.state as {
    returnToAnalysisList?: unknown;
    returnToAnalysisListByUrl?: unknown;
  } | null;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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
    refetchInterval: query => {
      const data = query.state.data?.data;
      const activeCount = (data?.pendingComparisonCount ?? 0)
        + (data?.processingComparisonCount ?? 0);
      const currentPageActive = data?.candidates?.content?.some(candidate => (
        isComparisonActive(candidate.comparisonStatus)
      ));
      return activeCount > 0 || currentPageActive
        ? ACTIVE_COMPARISON_POLL_INTERVAL
        : false;
    },
  });
  const listData = listQuery.data?.data;
  const candidatePage = listData?.candidates;
  const candidates = useMemo(() => candidatePage?.content ?? [], [candidatePage?.content]);
  const firstCandidateId = candidates.find(candidate => candidate.reviewStatus === 'PENDING_REVIEW')?.id
    ?? candidates[0]?.id;

  const characterSummaryQuery = useQuery({
    ...getSettingCandidatesOptions({
      path: { workId },
      query: { batchId, page: 0, size: 1 },
    }),
    enabled: hasContext,
    retry: shouldRetryCandidateQuery,
  });
  const characterSummary = characterSummaryQuery.data?.data;

  useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isFetching || selectedCandidateId || !firstCandidateId) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('candidate', firstCandidateId);
      return next;
    }, { replace: true, state: location.state });
  }, [firstCandidateId, listQuery.isFetching, listQuery.isSuccess, location.state, selectedCandidateId, setSearchParams]);

  const detailQuery = useQuery({
    ...getWorldSettingCandidateOptions({
      path: { workId, candidateId: selectedCandidateId ?? '' },
      query: { batchId },
    }),
    enabled: hasContext && Boolean(selectedCandidateId),
    retry: shouldRetryCandidateQuery,
    refetchInterval: query => (
      isComparisonActive(query.state.data?.data?.comparisonStatus)
        ? ACTIVE_COMPARISON_POLL_INTERVAL
        : false
    ),
  });
  const selectedCandidate = detailQuery.data?.data;

  const invalidateCandidateState = async (candidateId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getWorldSettingCandidatesQueryKey({ path: { workId }, query: { batchId } }),
      }),
      ...(candidateId ? [queryClient.invalidateQueries({
        queryKey: getWorldSettingCandidateQueryKey({
          path: { workId, candidateId }, query: { batchId },
        }),
      })] : []),
      queryClient.invalidateQueries({
        queryKey: getWorldSettingsQueryKey({ path: { workId } }),
      }),
    ]);
  };

  const clearCurrentCandidate = (candidateId: string) => {
    if (!mountedRef.current || window.location.pathname !== '/setting-review') return;
    const current = new URLSearchParams(window.location.search);
    if (current.get('candidateType') !== 'world' || current.get('candidate') !== candidateId) return;
    setSearchParams(previous => {
      if (previous.get('candidate') !== candidateId) return previous;
      const next = new URLSearchParams(previous);
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  };

  const confirmMutation = useMutation({
    ...confirmWorldSettingCandidateMutation(),
    onSuccess: async (response, variables) => {
      await invalidateCandidateState(variables.path.candidateId);
      if (response.data?.targetWorldSettingId) {
        setConfirmedTarget({
          id: response.data.targetWorldSettingId,
          subjectName: response.data.finalSubjectName ?? response.data.subjectName ?? '확정한 세계관 대상',
        });
      }
      setEditOpen(false);
      clearCurrentCandidate(variables.path.candidateId);
    },
    onError: async (_, variables) => {
      // 409 재비교 전환도 서버에 커밋되므로 오류 응답 뒤 최신 상태를 다시 받는다.
      await invalidateCandidateState(variables.path.candidateId);
    },
  });
  const dismissMutation = useMutation({
    ...dismissWorldSettingCandidateMutation(),
    onSuccess: async (_, variables) => {
      await invalidateCandidateState(variables.path.candidateId);
      setEditOpen(false);
      clearCurrentCandidate(variables.path.candidateId);
    },
  });
  const updateMutation = useMutation({
    ...updateWorldSettingCandidateMutation(),
    onSuccess: async (_, variables) => {
      await invalidateCandidateState(variables.path.candidateId);
      setEditOpen(false);
    },
  });
  const retryMutation = useMutation({
    ...retryWorldSettingCandidateComparisonMutation(),
    onSuccess: async (_, variables) => {
      await invalidateCandidateState(variables.path.candidateId);
    },
  });

  useEffect(() => {
    const candidateId = selectedCandidate?.id;
    if (!candidateId) return;
    if (selectedCandidate.comparisonStatus !== 'RECOMPARISON_REQUIRED') {
      automaticRetryIds.current.delete(candidateId);
      return;
    }
    if (automaticRetryIds.current.has(candidateId) || retryMutation.isPending) return;
    automaticRetryIds.current.add(candidateId);
    retryMutation.mutate({ path: { workId, candidateId } });
  }, [retryMutation, selectedCandidate, workId]);

  const actionPending = confirmMutation.isPending
    || dismissMutation.isPending
    || updateMutation.isPending
    || retryMutation.isPending;
  const selectedActionError = [confirmMutation, dismissMutation, updateMutation, retryMutation]
    .find(mutation => mutation.isError
      && mutation.variables?.path.candidateId === selectedCandidateId)?.error;
  const actionError = selectedActionError
    ? errorMessage(selectedActionError, '후보를 처리하지 못했습니다. 입력값을 유지했으니 다시 시도해 주세요.')
    : null;

  const updateFilters = (
    nextReview: ReviewFilter,
    nextCategory: CategoryFilter,
    nextOperation: OperationFilter,
  ) => {
    if (actionPending) return;
    setMobileDetailOpen(false);
    setEditOpen(false);
    confirmMutation.reset();
    dismissMutation.reset();
    updateMutation.reset();
    retryMutation.reset();
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (nextReview === 'PENDING_REVIEW') next.delete('reviewStatus');
      else next.set('reviewStatus', nextReview);
      if (nextCategory === 'ALL') next.delete('worldCategory');
      else next.set('worldCategory', nextCategory);
      if (nextOperation === 'ALL') next.delete('operation');
      else next.set('operation', nextOperation);
      next.set('page', '1');
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  };

  const selectCandidate = (candidateId: string) => {
    if (actionPending) return;
    setMobileDetailOpen(true);
    setEditOpen(false);
    confirmMutation.reset();
    dismissMutation.reset();
    updateMutation.reset();
    retryMutation.reset();
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('candidate', candidateId);
      return next;
    }, { replace: true, state: location.state });
  };

  const changePage = (page: number) => {
    if (actionPending) return;
    setMobileDetailOpen(false);
    setEditOpen(false);
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('page', String(page + 1));
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  };

  const candidateConfirmBody = (candidate: WorldSettingCandidateResponse): CandidateDraft | null => {
    if (!candidate.category || !candidate.subjectName || !candidate.suggestedOperation
      || candidate.suggestedOperation === 'EXCLUDE') return null;
    const settingName = candidate.proposedSettingName ?? candidate.settingName;
    const value = candidate.proposedValue ?? candidate.extractedValue;
    if (!settingName || !value) return null;
    return {
      operation: candidate.suggestedOperation,
      category: candidate.category,
      subjectName: candidate.subjectName,
      settingName,
      value,
    };
  };

  const confirmSelected = () => {
    if (!selectedCandidateId || !selectedCandidate || actionPending) return;
    const body = candidateConfirmBody(selectedCandidate);
    if (!body) return;
    confirmMutation.mutate({ path: { workId, candidateId: selectedCandidateId }, body });
  };
  const dismissSelected = () => {
    if (!selectedCandidateId || actionPending) return;
    dismissMutation.mutate({
      path: { workId, candidateId: selectedCandidateId },
      body: {},
    });
  };
  const retrySelected = () => {
    if (!selectedCandidateId || actionPending) return;
    automaticRetryIds.current.add(selectedCandidateId);
    retryMutation.mutate({ path: { workId, candidateId: selectedCandidateId } });
  };
  const submitEditedCandidate = (draft: CandidateDraft, identityChanged: boolean) => {
    if (!selectedCandidateId || actionPending) return;
    if (identityChanged) {
      updateMutation.mutate({
        path: { workId, candidateId: selectedCandidateId },
        body: {
          category: draft.category,
          subjectName: draft.subjectName,
          settingName: draft.settingName,
        },
      });
    } else if (draft.operation === 'EXCLUDE') {
      dismissMutation.mutate({
        path: { workId, candidateId: selectedCandidateId },
        body: {},
      });
    } else {
      confirmMutation.mutate({
        path: { workId, candidateId: selectedCandidateId },
        body: draft,
      });
    }
  };

  const backToAnalysisList = () => {
    const returnToAnalysisList = reviewNavigationState?.returnToAnalysisList;
    if (typeof returnToAnalysisList === 'string' && returnToAnalysisList) {
      routerNavigate(reviewNavigationState?.returnToAnalysisListByUrl === true ? -2 : -1);
      return;
    }
    navigate(
      workId ? `/dashboard?workId=${encodeURIComponent(workId)}&nav=analyses` : '/works',
      'pop', undefined, { replace: true },
    );
  };

  const worldTotal = listData?.totalCandidateCount ?? 0;
  const worldReviewed = listData?.reviewedCandidateCount ?? 0;
  const worldPending = listData?.pendingCandidateCount ?? 0;
  const characterTotal = characterSummary?.totalCandidateCount ?? 0;
  const characterReviewed = characterSummary?.reviewedCandidateCount ?? 0;
  const characterPending = characterSummary?.pendingCandidateCount ?? 0;
  const worldAttention = (listData?.pendingComparisonCount ?? 0)
    + (listData?.processingComparisonCount ?? 0)
    + (listData?.failedComparisonCount ?? 0)
    + (listData?.recomparisonRequiredCount ?? 0);
  const characterAttention = characterSummary?.matchRequiredCandidateCount ?? 0;
  const combinedTotal = characterTotal + worldTotal;
  const combinedReviewed = characterReviewed + worldReviewed;
  const combinedPending = characterPending + worldPending;
  const combinedAttention = characterAttention + worldAttention;
  const summaryUnavailable = characterSummaryQuery.isError;
  const reviewComplete = combinedTotal > 0
    && combinedPending === 0
    && combinedAttention === 0
    && !summaryUnavailable
    && !characterSummaryQuery.isPending;
  const totalPages = candidatePage?.totalPages ?? 0;
  const currentPage = candidatePage?.page ?? apiPage;

  useEffect(() => {
    const serverTotalPages = candidatePage?.totalPages;
    if (serverTotalPages == null || apiPage < Math.max(serverTotalPages, 1)) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('page', String(Math.max(serverTotalPages, 1)));
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  }, [apiPage, candidatePage?.totalPages, location.state, setSearchParams]);

  if (!hasContext) {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg }}>
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
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <ReviewHeader onBack={backToAnalysisList} />
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div className="world-setting-review-content" style={{ maxWidth: 1450, margin: '0 auto', padding: '26px 28px 70px' }}>
          {listQuery.isPending && !listQuery.data ? (
            <QueryState
              icon={<Loader2 size={27} color={C.primary} className="spin" />}
              title="세계관 후보를 불러오고 있습니다."
              description="이번 분석 묶음에서 추출된 지속 설정을 확인하고 있습니다."
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
              <ReviewSummary
                episodeRange={formatEpisodeRange(listData?.episodeStartNo, listData?.episodeEndNo, listData?.episodeCount ?? 0)}
                total={combinedTotal}
                reviewed={combinedReviewed}
                pending={combinedPending}
                attentionRequired={combinedAttention}
              />
              <SettingReviewTabs
                active="world"
                disabled={actionPending}
                character={{ reviewed: characterReviewed, total: characterTotal }}
                world={{ reviewed: worldReviewed, total: worldTotal }}
              />

              {confirmedTarget && (
                <div role="status" style={{
                  marginTop: 12, padding: '11px 13px', borderRadius: 8,
                  border: `1px solid ${C.success}55`, background: `${C.success}12`,
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                }}>
                  <Check size={14} color={C.success} />
                  <span style={{ color: C.success, fontSize: 12, fontWeight: 700 }}>
                    {confirmedTarget.subjectName} 설정을 세계관 DB에 반영했습니다.
                  </span>
                  <div style={{ flex: 1 }} />
                  <button type="button" onClick={() => navigate(
                    `/dashboard?workId=${encodeURIComponent(workId)}&nav=settingDB&tab=worldsettings&settingId=${encodeURIComponent(confirmedTarget.id)}`,
                    'push-left',
                  )} style={{
                    border: 'none', background: 'none', color: C.primary,
                    fontFamily: 'inherit', fontSize: 11, fontWeight: 750, cursor: 'pointer',
                  }}>
                    세계관 DB에서 보기
                  </button>
                  <button type="button" aria-label="확정 안내 닫기" onClick={() => setConfirmedTarget(null)} style={{
                    border: 'none', background: 'none', color: C.t3, cursor: 'pointer', padding: 2,
                  }}><X size={14} /></button>
                </div>
              )}

              {summaryUnavailable && (
                <div role="alert" style={{
                  marginTop: 12, padding: '10px 13px', borderRadius: 7,
                  border: `1px solid ${C.warning}55`, background: `${C.warning}12`,
                  color: C.warning, fontSize: 12,
                }}>
                  캐릭터 후보 집계를 불러오지 못해 전체 완료 여부를 확인할 수 없습니다.
                </div>
              )}
              {listQuery.isError && listQuery.data && (
                <div role="alert" style={{
                  marginTop: 12, padding: '10px 13px', borderRadius: 7,
                  border: `1px solid ${C.danger}55`, background: `${C.danger}12`,
                  color: C.danger, fontSize: 12,
                }}>
                  최신 후보를 불러오지 못해 마지막으로 확인한 세계관 목록을 표시합니다.
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
                  marginTop: 18, display: 'grid',
                  gridTemplateColumns: 'minmax(310px, 390px) minmax(0, 1fr)',
                  gap: 18, alignItems: 'start',
                }}>
                  <aside className="world-setting-review-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                    <div style={{
                      padding: 14, borderRadius: 9, border: `1px solid ${C.border}`,
                      background: C.surface, display: 'grid', gap: 11,
                    }}>
                      <SelectFilter
                        label="검토 상태"
                        value={reviewFilter}
                        options={REVIEW_FILTERS}
                        disabled={actionPending}
                        onChange={value => updateFilters(value, categoryFilter, operationFilter)}
                      />
                      <SelectFilter
                        label="세계관 분류"
                        value={categoryFilter}
                        options={CATEGORY_FILTERS}
                        disabled={actionPending}
                        onChange={value => updateFilters(reviewFilter, value, operationFilter)}
                      />
                      <SelectFilter
                        label="제안된 반영 방식"
                        value={operationFilter}
                        options={OPERATION_FILTERS}
                        disabled={actionPending}
                        onChange={value => updateFilters(reviewFilter, categoryFilter, value)}
                      />
                    </div>
                    <div style={{ color: C.t3, fontSize: 11 }}>회차 번호 · 생성 순</div>
                    {candidates.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {candidates.map(candidate => candidate.id && (
                          <WorldCandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            selected={candidate.id === selectedCandidateId}
                            disabled={actionPending}
                            onClick={() => selectCandidate(candidate.id!)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        padding: '30px 18px', borderRadius: 9, border: `1px solid ${C.border}`,
                        background: C.surface, textAlign: 'center', color: C.t3, fontSize: 12,
                      }}>
                        조건에 맞는 세계관 후보가 없습니다.
                        <button type="button" onClick={() => updateFilters('PENDING_REVIEW', 'ALL', 'ALL')} style={{
                          display: 'block', margin: '10px auto 0', border: 'none', background: 'none',
                          color: C.primary, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
                        }}>필터 초기화</button>
                      </div>
                    )}
                    <PageNavigation
                      page={currentPage}
                      totalPages={totalPages}
                      disabled={listQuery.isFetching || actionPending}
                      onPageChange={changePage}
                    />
                  </aside>

                  <section className="world-setting-review-detail">
                    <button
                      type="button"
                      className="world-setting-review-mobile-back"
                      onClick={() => setMobileDetailOpen(false)}
                      style={{
                        display: 'none', marginBottom: 10, border: 'none', background: 'none',
                        color: C.primary, fontFamily: 'inherit', cursor: 'pointer', fontSize: 12,
                      }}
                    >
                      <ChevronLeft size={15} /> 후보 목록으로
                    </button>
                    {!selectedCandidateId ? (
                      <QueryState
                        icon={<Sparkles size={26} color={C.primary} />}
                        title="세계관 후보를 선택해 주세요."
                        description="목록에서 후보를 선택하면 기존값·추출값·제안값과 원문 근거를 확인할 수 있습니다."
                      />
                    ) : detailQuery.isPending ? (
                      <QueryState
                        icon={<Loader2 size={26} color={C.primary} className="spin" />}
                        title="후보 상세를 불러오고 있습니다."
                        description="비교 결과와 원문 근거를 확인하고 있습니다."
                      />
                    ) : detailQuery.isError || !selectedCandidate ? (
                      <QueryState
                        icon={<AlertCircle size={27} color={C.danger} />}
                        title="후보 상세를 불러오지 못했습니다."
                        description={errorMessage(detailQuery.error, '후보가 현재 분석 묶음에 속하는지 확인해 주세요.')}
                        action={<ActionButton tone={C.primary} onClick={() => void detailQuery.refetch()}><RefreshCw size={13} /> 다시 시도</ActionButton>}
                      />
                    ) : (
                      <WorldCandidateDetail
                        candidate={selectedCandidate}
                        actionPending={actionPending}
                        actionError={actionError}
                        retrying={retryMutation.isPending}
                        onDismiss={dismissSelected}
                        onEdit={() => {
                          confirmMutation.reset();
                          dismissMutation.reset();
                          updateMutation.reset();
                          setEditOpen(true);
                        }}
                        onConfirm={confirmSelected}
                        onRetry={retrySelected}
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

      {selectedCandidate && editOpen && (
        <CandidateEditModal
          key={selectedCandidate.id}
          candidate={selectedCandidate}
          pending={actionPending}
          error={actionError}
          onClose={() => {
            if (actionPending) return;
            setEditOpen(false);
          }}
          onSubmit={submitEditedCandidate}
        />
      )}
      <style>{`
        @media (max-width: 768px) {
          .world-setting-review-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .world-setting-review-content {
            padding: 18px 16px calc(32px + env(safe-area-inset-bottom)) !important;
          }
          .world-setting-review-layout.mobile-detail-open .world-setting-review-sidebar {
            display: none !important;
          }
          .world-setting-review-layout:not(.mobile-detail-open) .world-setting-review-detail {
            display: none !important;
          }
          .world-setting-review-mobile-back {
            display: inline-flex !important;
            align-items: center;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
}
