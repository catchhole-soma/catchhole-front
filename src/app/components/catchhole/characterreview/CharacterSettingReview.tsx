import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Link2,
  Loader2,
  LockKeyhole,
  Search,
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
  confirmSettingCandidateGroupMutation,
  dismissSettingCandidateMutation,
  getCharactersQueryKey,
  getCharactersOptions,
  getSettingCandidateOptions,
  getSettingCandidatesQueryKey,
  getSettingCandidatesOptions,
  getWorldSettingCandidatesOptions,
  retrySettingCandidateComparisonMutation,
  updateSettingCandidateCharacterMatchMutation,
  updateSettingCandidateGroupCharacterMatchMutation,
  updateSettingCandidateMutation,
} from '../../../api/generated/@tanstack/react-query.gen';
import type {
  CharacterSummaryResponse,
  SettingCandidateGroupResponse,
  SettingCandidateResponse,
} from '../../../api/generated/types.gen';
import { returnToAnalysisList, type ReviewReturnState } from '../../../lib/review-navigation';
import { toApiError } from '../../../lib/api-errors';
import { shouldRetryQuery } from '../../../lib/query-client';
import { C } from '../constants';
import { PageNavigation } from '../PageNavigation';
import { UserMenu } from '../UserMenu';
import {
  CharacterFactComparisonPanel,
} from '../character/CharacterFactComparisonPanel';
import {
  getCharacterFactComparisonPolicy,
  resolveCharacterFactApplicationMode,
  type CharacterFactApplicationMode,
} from '../character/character-fact-comparison-policy';
import { SettingReviewTabs } from '../worldsetting/SettingReviewTabs';

type ReviewStatus = NonNullable<SettingCandidateResponse['reviewStatus']>;
type MatchStatus = NonNullable<SettingCandidateResponse['matchStatus']>;
type ReviewFilter = ReviewStatus | 'ALL';
type MatchFilter = 'ALL' | 'CONNECTED' | 'UNRESOLVED' | 'AMBIGUOUS';

const DEFAULT_PAGE_SIZE = 20;
const ACTIVE_COMPARISON_POLL_INTERVAL = 2_000;
const REVIEW_FILTERS: Array<{ value: ReviewFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'PENDING_REVIEW', label: '검토 대기' },
  { value: 'CONFIRMED', label: '확정' },
  { value: 'DISMISSED', label: '무시' },
];
const MATCH_FILTERS: Array<{ value: MatchFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'CONNECTED', label: '연결됨' },
  { value: 'UNRESOLVED', label: '새 캐릭터 후보' },
  { value: 'AMBIGUOUS', label: '캐릭터 연결 확인 필요' },
];

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  PENDING_REVIEW: '검토 대기',
  CONFIRMED: '확정',
  DISMISSED: '무시',
};
const MATCH_LABELS: Record<MatchStatus, string> = {
  MATCHED: '기존 캐릭터 연결됨',
  AUTO_MATCHED_BY_NAME: '신규 캐릭터에 연결됨',
  UNRESOLVED: '새 캐릭터 후보',
  AMBIGUOUS: '캐릭터 연결 확인 필요',
};
const SETTING_TYPE_LABELS: Record<string, string> = {
  age: '나이/레벨',
  level: '나이/레벨',
  profile: '프로필',
  stats: '스탯',
  skill: '스킬',
  skills: '스킬',
  item: '아이템',
  items: '아이템',
  status: '상태',
  statuses: '상태',
  time: '시간/사건',
};
const SETTING_NAME_LABELS: Record<string, string> = {
  age: '나이',
  level: '레벨',
  profile: '프로필',
  'profile.gender': '성별',
  'profile.species': '종족',
  'profile.affiliation': '소속',
  'profile.occupation': '직업',
  'profile.eye_color': '눈 색깔',
  'profile.description': '설명',
  'stats.strength': '근력',
  'stats.mana': '마나',
  'stats.physique': '육체',
  'stats.mental': '정신',
  'stats.supernatural': '이능',
  'stats.item_level': '아이템 레벨',
  'stats.combat_power': '전투지수',
  'stats.agility': '민첩성',
  'stats.endurance': '지구력',
  'stats.soul_power': '영혼력',
  'stats.magic_resistance': '항마력',
  'stats.physical_resistance': '물리내성',
  'stats.natural_regeneration': '자연재생력',
  'stats.bone_strength': '골강도',
  'stats.energy': '기력',
  'stats.perception': '인지력',
  'stats.mental_power': '정신력',
  'statuses.condition': '상태',
  'skills.skill': '스킬',
  'items.item': '아이템',
};

interface SettingDisplay {
  typeLabel: string;
  nameLabel: string;
}

/**
 * 저장용 attributeName은 유지하고, 목록과 상세에서 사용할 사용자용 문구만 만든다.
 */
function toSettingDisplay(attributeName?: string | null): SettingDisplay {
  const normalized = attributeName?.trim();
  if (!normalized) return { typeLabel: '설정', nameLabel: '설정명 없음' };

  const [prefix, ...suffixParts] = normalized.split('.');
  const suffix = suffixParts.join('.');
  return {
    typeLabel: SETTING_TYPE_LABELS[prefix] ?? '기타',
    nameLabel: SETTING_NAME_LABELS[normalized]
      ?? (suffix ? suffix.replace(/_/g, ' ') : normalized.replace(/_/g, ' ')),
  };
}

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
  return candidate.candidateKind !== 'CHARACTER_DISCOVERY'
    && candidate.comparisonStatus != null;
}

function splitDynamicSettingName(attributeName: string, dynamicPrefix?: string | null): {
  prefix: string;
  suffix: string;
} {
  const normalized = attributeName.trim();
  if (dynamicPrefix && normalized.startsWith(dynamicPrefix)) {
    return {
      prefix: dynamicPrefix,
      suffix: normalized.slice(dynamicPrefix.length).replace(/_/g, ' '),
    };
  }
  const separatorIndex = normalized.indexOf('.');
  if (separatorIndex < 0) return { prefix: `${normalized}.`, suffix: '' };
  return {
    prefix: normalized.slice(0, separatorIndex + 1),
    suffix: normalized.slice(separatorIndex + 1).replace(/_/g, ' '),
  };
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

function isCharacterReviewLocation(): boolean {
  const currentParams = new URLSearchParams(window.location.search);
  return window.location.pathname === '/setting-review'
    && currentParams.get('candidateType') !== 'world';
}

function characterGroupKey(entityName?: string | null): string {
  return (entityName ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
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

function errorMessage(error: unknown, fallback: string): string {
  return toApiError(error)?.message ?? (error instanceof Error ? error.message : fallback);
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
      color, background: `${color}18`, border: `1px solid ${color}66`, whiteSpace: 'nowrap',
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
    <div role="group" aria-label={label}>
      <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 7 }}>{label}</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {options.map(option => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              style={{
                minHeight: 30, padding: '0 10px', borderRadius: 7,
                border: `1px solid ${active ? C.primary : C.border}`,
                background: active ? `${C.primary}18` : 'transparent',
                color: active ? C.primary : C.t2,
                fontSize: 11, fontWeight: active ? 700 : 500,
                cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                opacity: disabled ? 0.58 : 1,
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
    ['검토 대기', `${pending}개`, C.t1],
    ['확인 필요', `${attentionRequired}개`, attentionRequired > 0 ? C.warning : C.t1],
  ];
  return (
    <section className="setting-review-summary" aria-label="설정 후보 검토 요약" style={{
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
      <StatusBadge label={`${reviewed}/${total} 검토`} color={C.primary} />
    </section>
  );
}

function CandidateGroupCard({
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
  const attentionCount = candidates.filter(candidate => (
    candidate.matchStatus === 'AMBIGUOUS'
    || candidate.comparisonStatus === 'FAILED'
    || candidate.comparisonStatus === 'RECOMPARISON_REQUIRED'
  )).length;
  const matchStatuses = Array.from(new Set(candidates.map(candidate => candidate.matchStatus).filter(Boolean)));
  const episodes = group.evidenceEpisodeNos ?? [];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%', minHeight: 82, padding: '14px 15px', borderRadius: 9,
        border: `1px solid ${selected ? C.primary : C.border}`,
        background: selected ? `${C.primary}14` : C.surface,
        color: C.t1, textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? 0.68 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {group.entityName || '이름 없는 캐릭터'}
        </strong>
        <StatusBadge label={`${group.candidateCount ?? candidates.length}개 설정`} color={C.primary} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, color: C.t3, fontSize: 11 }}>
        <span>{episodes.length > 0 ? `${episodes.join(', ')}화` : '출처 회차 없음'}</span>
        {attentionCount > 0 && <span style={{ color: C.warning }}>· {attentionCount}개 확인 필요</span>}
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

function ActionButton({
  children,
  disabled = false,
  disabledTitle,
  tone = C.t2,
  type = 'button',
  ariaPressed,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  disabledTitle?: string;
  tone?: string;
  type?: 'button' | 'submit';
  ariaPressed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-pressed={ariaPressed}
      onClick={onClick}
      title={disabled ? disabledTitle ?? '다음 작업 단위에서 연결됩니다.' : undefined}
      style={{
        minHeight: 38, padding: '0 18px', borderRadius: 7,
        border: `1px solid ${disabled ? C.border : tone}`,
        background: disabled ? C.bg : `${tone}12`,
        color: disabled ? C.t3 : tone, fontFamily: 'inherit',
        fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.58 : 1,
      }}
    >
      {children}
    </button>
  );
}

const modalInputStyle = {
  width: '100%',
  minHeight: 40,
  boxSizing: 'border-box' as const,
  borderRadius: 7,
  border: `1px solid ${C.border}`,
  background: C.bg,
  color: C.t1,
  padding: '0 12px',
  fontFamily: 'inherit',
  fontSize: 13,
};

function ModalLayer({
  title,
  description,
  pending,
  onClose,
  children,
}: {
  title: string;
  description: string;
  pending: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;
    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const focusableElements = () => (
      dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)) : []
    );
    (focusableElements()[0] ?? dialog)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [onClose, pending]);

  return (
    <div
      onMouseDown={event => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 220, padding: 24,
        background: 'rgba(4, 4, 8, 0.76)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          width: 'min(620px, 100%)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
          borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface,
          boxShadow: '0 24px 80px rgba(0,0,0,0.58)', padding: 26, boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 id={titleId} style={{ color: C.t1, fontSize: 18, margin: 0 }}>
              {title}
            </h2>
            <p style={{ color: C.t3, fontSize: 12, lineHeight: 1.6, margin: '6px 0 0' }}>
              {description}
            </p>
          </div>
          <button
            type="button"
            aria-label={`${title} 닫기`}
            disabled={pending}
            onClick={onClose}
            style={{
              border: 'none', background: 'transparent', color: C.t3,
              padding: 4, lineHeight: 0, cursor: pending ? 'default' : 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CandidateEditModal({
  candidate,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  candidate: SettingCandidateResponse;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (attributeName: string, attributeValue: string | null) => void;
}) {
  const originalName = candidate.attributeName?.trim() ?? '';
  const editableName = candidate.attributeNameEditable === true
    && Boolean(candidate.attributeNamePrefix);
  const dynamicName = splitDynamicSettingName(originalName, candidate.attributeNamePrefix);
  const [attributeSuffix, setAttributeSuffix] = useState(dynamicName.suffix);
  const [attributeValue, setAttributeValue] = useState(candidate.attributeValue ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextName = editableName ? `${dynamicName.prefix}${attributeSuffix.trim()}` : originalName;
    if (!nextName) {
      setValidationError('설정명 정보가 없어 수정할 수 없습니다.');
      return;
    }
    if (editableName && !attributeSuffix.trim()) {
      setValidationError('설정명 뒷부분을 입력해 주세요.');
      return;
    }
    setValidationError(null);
    onSubmit(nextName, attributeValue.trim() || null);
  };

  return (
    <ModalLayer
      title="설정 후보 수정"
      description="설정명이나 값을 바꾸면 화면에 표시하지 않는 AI 세부 속성은 정리되며, 최초 원문 근거는 유지됩니다."
      pending={pending}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <div style={{ marginTop: 22 }}>
          <label htmlFor="candidate-attribute-name" style={{ color: C.t2, fontSize: 12 }}>
            설정명
          </label>
          {!editableName ? (
            <>
              <input
                id="candidate-attribute-name"
                value={toSettingDisplay(originalName).nameLabel}
                readOnly
                aria-describedby="candidate-attribute-name-help"
                style={{ ...modalInputStyle, marginTop: 7, color: C.t3 }}
              />
              <div id="candidate-attribute-name-help" style={{ color: C.t3, fontSize: 11, marginTop: 6 }}>
                이 설정명은 변경할 수 없습니다.
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', marginTop: 7 }}>
              <span style={{
                minHeight: 40, padding: '0 11px', borderRadius: '7px 0 0 7px',
                border: `1px solid ${C.border}`, borderRight: 'none', background: C.bg,
                color: C.t3, display: 'inline-flex', alignItems: 'center', fontSize: 13,
                flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                {SETTING_TYPE_LABELS[dynamicName.prefix.slice(0, -1)] ?? '설정'}
              </span>
              <input
                id="candidate-attribute-name"
                aria-label="설정명 뒷부분"
                value={attributeSuffix}
                disabled={pending}
                onChange={event => setAttributeSuffix(event.target.value)}
                style={{
                  ...modalInputStyle,
                  width: 'auto',
                  minWidth: 0,
                  flex: 1,
                  borderRadius: '0 7px 7px 0',
                }}
              />
            </div>
          )}
        </div>
        <div style={{ marginTop: 18 }}>
          <label htmlFor="candidate-attribute-value" style={{ color: C.t2, fontSize: 12 }}>
            설정값
          </label>
          <input
            id="candidate-attribute-value"
            value={attributeValue}
            disabled={pending}
            onChange={event => setAttributeValue(event.target.value)}
            style={{ ...modalInputStyle, marginTop: 7 }}
          />
        </div>
        {(validationError || error) && (
          <div role="alert" style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 7,
            border: `1px solid ${C.danger}55`, background: `${C.danger}12`,
            color: C.danger, fontSize: 12,
          }}>
            {validationError ?? error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
          <ActionButton disabled={pending} onClick={onClose}>취소</ActionButton>
          <ActionButton type="submit" disabled={pending} tone={C.primary}>
            {pending ? '저장 중…' : '저장'}
          </ActionButton>
        </div>
      </form>
    </ModalLayer>
  );
}

type MatchResolution = 'MATCH_EXISTING' | 'CREATE_NEW';

function CharacterMatchModal({
  workId,
  candidate,
  initialResolution,
  pending,
  error,
  groupCandidateCount,
  onClose,
  onSubmit,
}: {
  workId: string;
  candidate: SettingCandidateResponse;
  initialResolution: MatchResolution;
  pending: boolean;
  error: string | null;
  groupCandidateCount?: number;
  onClose: () => void;
  onSubmit: (resolution: MatchResolution, value: string) => void;
}) {
  const [resolution, setResolution] = useState(initialResolution);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [newCharacterName, setNewCharacterName] = useState(candidate.entityName ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const charactersQuery = useQuery({
    ...getCharactersOptions({ path: { workId }, query: { page, size: 8 } }),
    enabled: resolution === 'MATCH_EXISTING',
  });
  const characterPage = charactersQuery.data?.data;
  useEffect(() => {
    const matchedCharacterId = candidate.matchedCharacterId;
    if (!matchedCharacterId
      || !characterPage?.content?.some(character => character.id === matchedCharacterId)) {
      return;
    }
    setSelectedCharacterId(current => current || matchedCharacterId);
  }, [candidate.matchedCharacterId, characterPage?.content]);
  const characters = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    const content = characterPage?.content ?? [];
    if (!keyword) return content;
    return content.filter(character => character.name?.toLocaleLowerCase().includes(keyword));
  }, [characterPage?.content, search]);
  const selectedCharacterVisible = characters.some(character => character.id === selectedCharacterId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (resolution === 'MATCH_EXISTING' && !selectedCharacterVisible) {
      setValidationError('현재 목록에서 연결할 캐릭터를 선택해 주세요.');
      return;
    }
    const value = resolution === 'MATCH_EXISTING'
      ? selectedCharacterId
      : newCharacterName.trim();
    if (!value) {
      setValidationError(
        resolution === 'MATCH_EXISTING'
          ? '연결할 기존 캐릭터를 선택해 주세요.'
          : '새 캐릭터 이름을 입력해 주세요.',
      );
      return;
    }
    setValidationError(null);
    onSubmit(resolution, value);
  };

  return (
    <ModalLayer
      title={groupCandidateCount ? '캐릭터 일괄 연결' : '캐릭터 연결 확인'}
      description={groupCandidateCount
        ? `“${candidate.entityName || '이름 없음'}”의 검토 대기 설정 ${groupCandidateCount}개에 같은 연결 결정을 적용합니다.`
        : `“${candidate.rawEntityMention || candidate.entityName || '이름 없음'}” 후보가 누구인지 선택해 주세요.`}
      pending={pending}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 20 }}>
          {([
            ['MATCH_EXISTING', '기존 캐릭터에 연결'],
            ['CREATE_NEW', '새 캐릭터로 등록'],
          ] as const).map(([value, label]) => (
            <ActionButton
              key={value}
              disabled={pending}
              tone={resolution === value ? C.primary : C.t3}
              ariaPressed={resolution === value}
              onClick={() => {
                setResolution(value);
                setValidationError(null);
              }}
            >
              {label}
            </ActionButton>
          ))}
        </div>

        {resolution === 'MATCH_EXISTING' ? (
          <div style={{ marginTop: 18 }}>
            <label htmlFor="character-page-search" style={{ color: C.t2, fontSize: 12 }}>
              현재 페이지에서 검색
            </label>
            <div style={{ position: 'relative', marginTop: 7 }}>
              <Search
                size={14}
                color={C.t3}
                style={{ position: 'absolute', left: 12, top: 13 }}
              />
              <input
                id="character-page-search"
                value={search}
                disabled={pending}
                onChange={event => {
                  setSearch(event.target.value);
                  setSelectedCharacterId('');
                  setValidationError(null);
                }}
                style={{ ...modalInputStyle, paddingLeft: 34 }}
              />
            </div>

            <div style={{
              minHeight: 180, maxHeight: 260, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12,
            }}>
              {charactersQuery.isPending ? (
                <div style={{ color: C.t3, fontSize: 12, padding: 20, textAlign: 'center' }}>
                  <Loader2 size={15} className="spin" /> 캐릭터를 불러오는 중입니다.
                </div>
              ) : charactersQuery.isError ? (
                <div role="alert" style={{ color: C.danger, fontSize: 12, padding: 20, textAlign: 'center' }}>
                  <div>{errorMessage(charactersQuery.error, '캐릭터 목록을 불러오지 못했습니다.')}</div>
                  <div style={{ marginTop: 10 }}>
                    <ActionButton
                      disabled={charactersQuery.isFetching}
                      tone={C.danger}
                      onClick={() => void charactersQuery.refetch()}
                    >
                      다시 불러오기
                    </ActionButton>
                  </div>
                </div>
              ) : characters.length === 0 ? (
                <div style={{ color: C.t3, fontSize: 12, padding: 20, textAlign: 'center' }}>
                  현재 페이지에 조건과 맞는 캐릭터가 없습니다.
                </div>
              ) : characters.map((character: CharacterSummaryResponse) => (
                <button
                  key={character.id}
                  type="button"
                  disabled={pending || !character.id}
                  aria-pressed={selectedCharacterId === character.id}
                  onClick={() => setSelectedCharacterId(character.id ?? '')}
                  style={{
                    minHeight: 48, borderRadius: 7, padding: '9px 12px',
                    border: `1px solid ${selectedCharacterId === character.id ? C.primary : C.border}`,
                    background: selectedCharacterId === character.id ? `${C.primary}14` : C.bg,
                    color: C.t1, textAlign: 'left', fontFamily: 'inherit',
                    cursor: pending ? 'default' : 'pointer',
                  }}
                >
                  <strong style={{ fontSize: 13 }}>{character.name || '이름 없음'}</strong>
                  <span style={{ color: C.t3, fontSize: 11, marginLeft: 8 }}>
                    {character.representativeAttributeLabel && character.representativeAttributeValue
                      ? `${character.representativeAttributeLabel} · ${character.representativeAttributeValue}`
                      : character.firstAppearanceEpisodeNo == null
                        ? '대표 정보 없음'
                        : `${character.firstAppearanceEpisodeNo}화 첫 등장`}
                  </span>
                </button>
              ))}
            </div>
            <PageNavigation
              page={characterPage?.page ?? page}
              totalPages={characterPage?.totalPages ?? 0}
              disabled={pending || charactersQuery.isFetching}
              onPageChange={nextPage => {
                setPage(nextPage);
                setSearch('');
                setSelectedCharacterId('');
              }}
            />
          </div>
        ) : (
          <div style={{ marginTop: 18 }}>
            <label htmlFor="new-character-name" style={{ color: C.t2, fontSize: 12 }}>
              새 캐릭터 이름
            </label>
            <input
              id="new-character-name"
              value={newCharacterName}
              disabled={pending}
              onChange={event => setNewCharacterName(event.target.value)}
              style={{ ...modalInputStyle, marginTop: 7 }}
            />
          </div>
        )}

        {(validationError || error) && (
          <div role="alert" style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 7,
            border: `1px solid ${C.danger}55`, background: `${C.danger}12`,
            color: C.danger, fontSize: 12,
          }}>
            {validationError ?? error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
          <ActionButton disabled={pending} onClick={onClose}>취소</ActionButton>
          <ActionButton type="submit" disabled={pending} tone={C.primary}>
            {pending ? '연결 중…' : resolution === 'MATCH_EXISTING' ? '선택한 캐릭터에 연결' : '새 캐릭터로 등록'}
          </ActionButton>
        </div>
      </form>
    </ModalLayer>
  );
}

function CandidateDetail({
  candidate,
  applicationMode,
  actionError,
  actionPending,
  dismissing,
  retrying,
  retryError,
  onDismiss,
  onEdit,
  onMatch,
  onApplicationModeChange,
  onRetryComparison,
}: {
  candidate: SettingCandidateResponse;
  applicationMode: CharacterFactApplicationMode;
  actionError: string | null;
  actionPending: boolean;
  dismissing: boolean;
  retrying: boolean;
  retryError: string | null;
  onDismiss?: () => void;
  onEdit?: () => void;
  onMatch?: (resolution: MatchResolution) => void;
  onApplicationModeChange: (mode: CharacterFactApplicationMode) => void;
  onRetryComparison?: () => void;
}) {
  const reviewStatus = candidate.reviewStatus ?? 'PENDING_REVIEW';
  const matchStatus = candidate.matchStatus ?? 'UNRESOLVED';
  const readOnly = reviewStatus !== 'PENDING_REVIEW';
  const confidence = confidenceDescription(candidate.confidence ?? undefined);
  const quotes = evidenceQuotes(candidate.evidenceSpans);
  const settingDisplay = toSettingDisplay(candidate.attributeName ?? undefined);
  const comparisonEnabled = hasCharacterFactComparison(candidate);
  return (
    <section className="setting-candidate-detail" aria-label={`${settingDisplay.nameLabel} 설정 후보`} style={{
      padding: '17px 20px', borderTop: `1px solid ${C.border}`, background: C.surface,
      opacity: readOnly ? 0.72 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <span style={{ color: C.t3, fontSize: 12 }}>{settingDisplay.typeLabel}</span>
        <span style={{ color: C.t3, fontSize: 11 }}>·</span>
        <strong style={{ color: C.t1, fontSize: 14 }}>{settingDisplay.nameLabel}</strong>
        <StatusBadge label={REVIEW_LABELS[reviewStatus]} color={reviewColor(reviewStatus)} />
        <StatusBadge label={MATCH_LABELS[matchStatus]} color={matchColor(matchStatus)} />
        <span style={{ color: confidence.color, fontSize: 10, fontWeight: 700 }}>
          근거 명확도 {confidence.percent}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: C.t3, fontSize: 12 }}>
          {candidate.episodeNo == null ? '출처 회차 없음' : `${candidate.episodeNo}화`}
        </span>
        {!readOnly && (
          <>
            <ActionButton
              disabled={!onEdit || actionPending}
              tone={C.warning}
              onClick={onEdit}
            >
              수정
            </ActionButton>
            <ActionButton
              disabled={!onDismiss || actionPending}
              disabledTitle={dismissing
                ? '설정 후보를 제외하고 있습니다.'
                : actionPending
                  ? '다른 후보 작업이 끝난 뒤 시도해 주세요.'
                  : undefined}
              tone={C.danger}
              onClick={onDismiss}
            >
              {dismissing ? '제외 중…' : '제외'}
            </ActionButton>
          </>
        )}
      </div>

      {matchStatus === 'AMBIGUOUS' && !readOnly && (
        <div role="status" style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 7,
          border: `1px solid ${C.warning}`, background: `${C.warning}12`,
          display: 'flex', alignItems: 'center', gap: 8, color: C.t1, fontSize: 11, fontWeight: 650,
        }}>
          <AlertCircle size={14} color={C.warning} />
          어떤 캐릭터의 설정인지 확인이 필요합니다.
        </div>
      )}

      {readOnly && (
        <div role="status" style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 7,
          border: `1px solid ${reviewColor(reviewStatus)}`,
          background: `${reviewColor(reviewStatus)}12`,
          display: 'flex', alignItems: 'center', gap: 8, color: C.t1, fontSize: 11, fontWeight: 650,
        }}>
          {reviewStatus === 'CONFIRMED' ? <CheckCircle2 size={14} color={C.success} /> : <LockKeyhole size={14} color={C.t3} />}
          {reviewStatus === 'CONFIRMED'
            ? '확정된 후보입니다. 모든 정보는 읽기 전용으로 표시됩니다.'
            : '연결하지 않고 무시한 후보입니다. 모든 정보는 읽기 전용으로 표시됩니다.'}
        </div>
      )}

      <div style={{
        marginTop: 12, padding: '11px 13px', borderRadius: 7,
        border: `1px solid ${C.border}`, background: C.bg,
        display: 'grid', gridTemplateColumns: 'minmax(110px, 0.35fr) minmax(0, 1fr)', gap: 12,
      }}>
        <div>
          <div style={{ color: C.t3, fontSize: 10, marginBottom: 4 }}>원문 표현</div>
          <div style={{ color: C.t2, fontSize: 11, overflowWrap: 'anywhere' }}>
            {candidate.rawEntityMention || candidate.entityName || '정보 없음'}
          </div>
        </div>
        <div>
          <div style={{ color: C.t3, fontSize: 10, marginBottom: 4 }}>추출된 설정값</div>
          <strong style={{ color: C.t1, fontSize: 13, lineHeight: 1.55, overflowWrap: 'anywhere' }}>
            {candidate.attributeValue || '값 없음'}
          </strong>
        </div>
      </div>

      <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: quotes.length ? 6 : 0 }}>
          <LockKeyhole size={12} color={C.primary} />
          <span style={{ color: C.primary, fontSize: 10, fontWeight: 750 }}>1차 추출 원문</span>
        </div>
        {quotes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {quotes.map((quote, index) => (
              <blockquote key={`${quote}-${index}`} style={{
                margin: 0, color: C.t2, fontSize: 11, lineHeight: 1.6,
              }}>
                “{quote}”
              </blockquote>
            ))}
          </div>
        ) : (
          <div style={{ color: C.t3, fontSize: 11 }}>표시할 원문 근거가 없습니다.</div>
        )}
      </div>

      {comparisonEnabled && (
        <CharacterFactComparisonPanel
          candidate={candidate}
          applicationMode={applicationMode}
          disabled={actionPending || readOnly}
          retrying={retrying}
          retryError={retryError}
          onApplicationModeChange={onApplicationModeChange}
          onRetry={onRetryComparison}
        />
      )}

      {!readOnly && (
        <>
          <div className="setting-candidate-match-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ color: C.t3, fontSize: 10, marginRight: 'auto', alignSelf: 'center' }}>
              {isConnectedMatch(matchStatus) ? `${candidate.entityName}에 연결됨` : `${candidate.entityName || '이름 없음'} 신규 등록 예정`}
            </span>
            <ActionButton
              disabled={!onMatch || actionPending}
              tone={C.primary}
              onClick={() => onMatch?.('MATCH_EXISTING')}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Link2 size={13} /> {isConnectedMatch(matchStatus) ? '기존 캐릭터 변경' : '기존 캐릭터에 연결'}
              </span>
            </ActionButton>
            <ActionButton
              disabled={!onMatch || actionPending}
              tone={C.primary}
              onClick={() => onMatch?.('CREATE_NEW')}
            >
              {matchStatus === 'UNRESOLVED' ? '새 캐릭터 이름 변경' : '새 캐릭터로 등록'}
            </ActionButton>
          </div>
          {actionError && (
            <div role="alert" style={{
              marginTop: 10, padding: '10px 13px', borderRadius: 7,
              border: `1px solid ${C.danger}55`, background: `${C.danger}12`,
              color: C.danger, fontSize: 12, lineHeight: 1.55,
            }}>
              {actionError}
            </div>
          )}
        </>
      )}
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

export function CharacterSettingReview() {
  const routerNavigate = useRouterNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const workId = searchParams.get('workId') ?? '';
  const batchId = searchParams.get('batchId') ?? '';
  const selectedGroupKey = searchParams.get('group');
  const legacyCandidateId = searchParams.get('candidate');
  const reviewFilter = parseReviewFilter(searchParams.get('reviewStatus'));
  const matchFilter = parseMatchFilter(searchParams.get('matchStatus'));
  const urlPage = parsePositiveInteger(searchParams.get('page'), 1);
  const size = parsePositiveInteger(searchParams.get('size'), DEFAULT_PAGE_SIZE, 100);
  const apiPage = urlPage - 1;
  const hasContext = Boolean(workId && batchId);
  const [editCandidate, setEditCandidate] = useState<SettingCandidateResponse | null>(null);
  const [groupMatchOpen, setGroupMatchOpen] = useState(false);
  const [matchTarget, setMatchTarget] = useState<{
    candidate: SettingCandidateResponse;
    resolution: MatchResolution;
  } | null>(null);
  const [applicationModes, setApplicationModes] = useState<Record<string, CharacterFactApplicationMode>>({});
  const [mobileDetailOpen, setMobileDetailOpen] = useState(
    () => Boolean(searchParams.get('group') || searchParams.get('candidate')),
  );
  const selectionGroupRef = useRef<string | null>(null);
  const confirmingGroupKeyRef = useRef<string | null>(null);
  const resolvingLegacyCandidateRef = useRef<string | null>(null);
  const leavingReviewRef = useRef(false);
  const reviewNavigationState = location.state as ReviewReturnState | null;

  const listQuery = useQuery({
    ...getSettingCandidatesOptions({
      path: { workId },
      query: {
          batchId,
          reviewStatus: reviewFilter === 'ALL' ? undefined : reviewFilter,
          matchStatuses: matchStatusesForFilter(matchFilter),
          page: apiPage,
          size,
          includeLegacyCandidates: false,
      },
    }),
    enabled: hasContext,
    retry: shouldRetryCandidateQuery,
    // 필터 query key가 바뀌어도 탭·필터·현재 그룹을 포함한 검토 셸은 유지한다.
    // 새 응답이 오기 전까지 직전 목록을 표시하므로 연속 클릭 대상이 DOM에서 사라지지 않는다.
    placeholderData: previousData => previousData,
    // 세계관 후보와 동일하게 비교 중 후보가 있는 목록만 주기적으로 다시 받는다.
    notifyOnChangeProps: ['data', 'error', 'status'],
    refetchInterval: query => {
      const data = query.state.data?.data;
      const currentPageActive = data?.groups?.content?.some(group => group.candidates?.some(candidate => (
        isCharacterComparisonActive(candidate.comparisonStatus)
      ))) ?? data?.candidates?.content?.some(candidate => (
        isCharacterComparisonActive(candidate.comparisonStatus)
      ));
      return currentPageActive ? ACTIVE_COMPARISON_POLL_INTERVAL : false;
    },
  });
  const listData = listQuery.data?.data;
  const legacyCandidateQuery = useQuery({
    ...getSettingCandidateOptions({
      path: { workId, candidateId: legacyCandidateId ?? '' },
      query: { batchId },
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

  const worldSummaryQuery = useQuery({
    ...getWorldSettingCandidatesOptions({
      path: { workId },
      query: { batchId, page: 0, size: 1 },
    }),
    enabled: hasContext,
    retry: shouldRetryCandidateQuery,
  });
  const worldSummary = worldSummaryQuery.data?.data;

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
            batchId,
            reviewStatus: targetReview === 'ALL' ? undefined : targetReview,
            matchStatuses: matchStatusesForFilter(targetMatch),
            page: targetPage,
            size,
            includeLegacyCandidates: true,
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
      resolvingLegacyCandidateRef.current = null;
    });
    return () => {
      cancelled = true;
      if (resolvingLegacyCandidateRef.current === legacyCandidateId) {
        resolvingLegacyCandidateRef.current = null;
      }
    };
  }, [
    batchId,
    legacyCandidateId,
    legacyCandidateQuery.data?.data,
    legacyCandidateQuery.isSuccess,
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
  }, [apiPage, groupPage?.page, groups, legacyCandidateId, listQuery.fetchStatus, listQuery.isSuccess, location.state, selectedGroup, selectedGroupKey, setSearchParams]);

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
    setApplicationModes({});
  }, [batchId, workId]);

  const applicationModeForCandidate = (candidate: SettingCandidateResponse): CharacterFactApplicationMode => (
    hasCharacterFactComparison(candidate)
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
          query: { batchId },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: getCharactersQueryKey({ path: { workId: targetWorkId } }),
      }),
    ]);
  };

  const confirmMutation = useMutation({
    ...confirmSettingCandidateGroupMutation(),
    onSuccess: async (_response, variables) => {
      const submittedGroupKey = confirmingGroupKeyRef.current;
      confirmingGroupKeyRef.current = null;
      // 느린 확정 중 세계관 탭으로 이동했다면 이전 캐릭터 화면의 URL을 다시 쓰지 않는다.
      if (isCharacterReviewLocation()) {
        setSearchParams(previous => {
          const next = new URLSearchParams(previous);
          // 요청 중 사용자가 다른 그룹을 골랐다면 그 새 선택은 그대로 유지한다.
          if (submittedGroupKey != null && previous.get('group') === submittedGroupKey) {
            next.delete('group');
            next.delete('candidate');
          }
          return next;
        }, { replace: true, state: location.state });
      }
      await invalidateCandidateData(variables.path.workId);
    },
    onError: async (_, variables) => {
      confirmingGroupKeyRef.current = null;
      await invalidateCandidateData(variables.path.workId);
    },
  });
  const retryComparisonMutation = useMutation({
    ...retrySettingCandidateComparisonMutation(),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: getSettingCandidatesQueryKey({
          path: { workId: variables.path.workId },
          query: { batchId },
        }),
      });
    },
  });
  const dismissMutation = useMutation({
    ...dismissSettingCandidateMutation(),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: getSettingCandidatesQueryKey({
          path: { workId: variables.path.workId },
          query: { batchId },
        }),
      });
    },
  });
  const updateMutation = useMutation({
    ...updateSettingCandidateMutation(),
    onSuccess: async (response, variables) => {
      setEditCandidate(null);
      selectionGroupRef.current = null;
      setSearchParams(previous => {
        const next = new URLSearchParams(previous);
        const nextGroupKey = characterGroupKey(response.data?.entityName);
        if (nextGroupKey) next.set('group', nextGroupKey);
        next.delete('candidate');
        return next;
      }, { replace: true, state: location.state });
      await invalidateCandidateData(variables.path.workId);
    },
  });
  const matchMutation = useMutation({
    ...updateSettingCandidateCharacterMatchMutation(),
    onSuccess: async (response, variables) => {
      setMatchTarget(null);
      selectionGroupRef.current = null;
      setSearchParams(previous => {
        const next = new URLSearchParams(previous);
        const activeMatchFilter = parseMatchFilter(previous.get('matchStatus'));
        if (!matchesMatchFilter(response.data?.matchStatus, activeMatchFilter)) {
          next.delete('group');
        } else {
          const nextGroupKey = characterGroupKey(response.data?.entityName);
          if (nextGroupKey) next.set('group', nextGroupKey);
        }
        next.delete('candidate');
        return next;
      }, { replace: true, state: location.state });
      await invalidateCandidateData(variables.path.workId);
    },
  });
  const groupMatchMutation = useMutation({
    ...updateSettingCandidateGroupCharacterMatchMutation(),
    onSuccess: async (response, variables) => {
      setGroupMatchOpen(false);
      selectionGroupRef.current = null;
      setSearchParams(previous => {
          const next = new URLSearchParams(previous);
          if (response.data?.groupKey) next.set('group', response.data.groupKey);
          next.delete('candidate');
          return next;
      }, { replace: true, state: location.state });
      await invalidateCandidateData(variables.path.workId);
    },
  });

  const selectedCandidateUpdateError = updateMutation.isError
    && updateMutation.variables?.path.candidateId === editCandidate?.id
    ? errorMessage(updateMutation.error, '설정 후보를 수정하지 못했습니다. 입력값을 확인해 주세요.')
    : null;
  const selectedCandidateMatchError = matchMutation.isError
    && matchMutation.variables?.path.candidateId === matchTarget?.candidate.id
    ? errorMessage(matchMutation.error, '캐릭터 연결을 저장하지 못했습니다. 다시 시도해 주세요.')
    : null;
  const dismissErrorForCandidate = (candidateId?: string) => dismissMutation.isError
    && dismissMutation.variables?.path.candidateId === candidateId
    ? errorMessage(dismissMutation.error, '설정 후보를 제외하지 못했습니다. 다시 시도해 주세요.')
    : null;
  const retryErrorForCandidate = (candidateId?: string) => retryComparisonMutation.isError
    && retryComparisonMutation.variables?.path.candidateId === candidateId
    ? errorMessage(retryComparisonMutation.error, '현재 설정을 다시 비교하지 못했습니다. 다시 시도해 주세요.')
    : null;
  const groupConfirmError = confirmMutation.isError
    ? errorMessage(confirmMutation.error, '캐릭터 설정 묶음을 확정하지 못했습니다. 다시 시도해 주세요.')
    : null;
  const groupMatchError = groupMatchMutation.isError
    ? errorMessage(groupMatchMutation.error, '캐릭터 연결을 일괄 적용하지 못했습니다.')
    : null;
  const actionPending = confirmMutation.isPending
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
  const updateFilters = (nextReview: ReviewFilter, nextMatch: MatchFilter) => {
    setMobileDetailOpen(false);
    setEditCandidate(null);
    setMatchTarget(null);
    setGroupMatchOpen(false);
    resetActionsIfSettled();
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
    resetActionsIfSettled();
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
  const dismissCandidate = (candidateId: string) => {
    if (actionPending) return;
    confirmMutation.reset();
    dismissMutation.mutate({ path: { workId, candidateId } });
  };
  const updateSelectedCandidate = (
    candidateId: string,
    attributeName: string,
    attributeValue: string | null,
  ) => {
    if (actionPending) return;
    updateMutation.mutate({
      path: { workId, candidateId },
      body: { attributeName, attributeValue },
    });
  };
  const matchSelectedGroup = (resolution: MatchResolution, value: string) => {
    const candidateIds = pendingGroupCandidates.flatMap(candidate => candidate.id ? [candidate.id] : []);
    if (!selectedGroup || candidateIds.length === 0 || actionPending || legacyGroupedActionsUnsafe) return;
    groupMatchMutation.mutate({
      path: { workId },
      body: resolution === 'MATCH_EXISTING'
        ? { batchId, candidateIds, resolutionType: resolution, matchedCharacterId: value }
        : { batchId, candidateIds, resolutionType: resolution, entityName: value },
    });
  };
  const matchSelectedCandidate = (candidateId: string, resolution: MatchResolution, value: string) => {
    if (actionPending) return;
    matchMutation.mutate({
      path: { workId, candidateId },
      body: resolution === 'MATCH_EXISTING'
        ? { resolutionType: resolution, matchedCharacterId: value }
        : { resolutionType: resolution, entityName: value },
    });
  };
  const retryCandidateComparison = (candidateId: string) => {
    if (actionPending) return;
    retryComparisonMutation.mutate({ path: { workId, candidateId } });
  };

  const groupConfirmBlockedReason = legacyGroupedActionsUnsafe
    ? '서버 업데이트 전 호환 목록에서는 묶음 전체를 보장할 수 없어 일괄 확정을 지원하지 않습니다.'
    : pendingGroupCandidates.length === 0
    ? '확정할 검토 대기 설정이 없습니다.'
    : pendingGroupCandidates.some(candidate => candidate.matchStatus === 'AMBIGUOUS')
      ? '캐릭터 연결이 모호한 설정을 먼저 해소해 주세요.'
      : pendingGroupCandidates.some(candidate => (
          hasCharacterFactComparison(candidate)
          && !getCharacterFactComparisonPolicy(candidate).canConfirm
        ))
        ? '모든 설정의 현재값 비교가 끝난 뒤 함께 확정할 수 있습니다.'
        : pendingGroupCandidates.some(candidate => !candidate.id)
          ? '식별할 수 없는 설정이 있어 확정할 수 없습니다.'
          : null;
  const confirmSelectedGroup = () => {
    if (!selectedGroup || actionPending || groupConfirmBlockedReason) return;
    confirmingGroupKeyRef.current = selectedGroup.groupKey ?? null;
    confirmMutation.mutate({
      path: { workId },
      body: {
        batchId,
        candidates: pendingGroupCandidates.map(candidate => ({
          candidateId: candidate.id!,
          applicationMode: applicationModeForCandidate(candidate),
          baseSnapshotVersion: candidate.comparisonBaseSnapshotVersion ?? null,
        })),
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

  const total = listData?.totalCandidateCount ?? 0;
  const reviewed = listData?.reviewedCandidateCount ?? 0;
  const pending = listData?.pendingCandidateCount ?? 0;
  const matchRequired = listData?.matchRequiredCandidateCount ?? 0;
  const worldTotal = worldSummary?.totalCandidateCount ?? 0;
  const worldReviewed = worldSummary?.reviewedCandidateCount ?? 0;
  const worldPending = worldSummary?.pendingCandidateCount ?? 0;
  const worldAttention = (worldSummary?.pendingComparisonCount ?? 0)
    + (worldSummary?.processingComparisonCount ?? 0)
    + (worldSummary?.failedComparisonCount ?? 0)
    + (worldSummary?.recomparisonRequiredCount ?? 0)
    + (worldSummary?.conflictCandidateCount ?? 0);
  const combinedTotal = total + worldTotal;
  const combinedReviewed = reviewed + worldReviewed;
  const combinedPending = pending + worldPending;
  const combinedAttention = matchRequired + worldAttention;
  const totalPages = groupPage?.totalPages ?? 0;
  const currentPage = groupPage?.page ?? apiPage;
  const reviewComplete = combinedTotal > 0
    && combinedPending === 0
    && combinedAttention === 0
    && !worldSummaryQuery.isError
    && !worldSummaryQuery.isPending;

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
      <main className="setting-review-main" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="setting-review-content" style={{ maxWidth: 1450, margin: '0 auto', padding: '26px 28px 70px' }}>
          {listQuery.data && (
            <ReviewSummary
              episodeRange={formatEpisodeRange(
                listData?.episodeStartNo,
                listData?.episodeEndNo,
                listData?.episodeCount ?? 0,
              )}
              total={combinedTotal}
              reviewed={combinedReviewed}
              pending={combinedPending}
              attentionRequired={combinedAttention}
            />
          )}
          <SettingReviewTabs
            active="character"
            character={{ reviewed, total }}
            world={{ reviewed: worldReviewed, total: worldTotal }}
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
                    color: C.primary, fontSize: 12, fontWeight: 700, cursor: 'pointer',
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
                  color: C.warning, fontSize: 12,
                }}>
                  세계관 후보 집계를 불러오지 못해 전체 완료 여부를 확인할 수 없습니다.
                </div>
              )}

              {listQuery.isError && listQuery.data && (
                <div role="alert" style={{
                  marginTop: 12, padding: '10px 13px', borderRadius: 7,
                  border: `1px solid ${C.danger}55`, background: `${C.danger}12`,
                  color: C.danger, fontSize: 12,
                }}>
                  최신 후보를 불러오지 못해 마지막으로 확인한 목록을 표시합니다.
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
                    <div style={{ color: C.t3, fontSize: 11 }}>↑ 회차 번호 · 생성 순</div>

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
                      <div style={{
                        padding: '30px 18px', borderRadius: 9, border: `1px solid ${C.border}`,
                        background: C.surface, textAlign: 'center', color: C.t3, fontSize: 12,
                      }}>
                        {reviewComplete
                          ? '모든 설정 후보 검토를 완료했습니다.'
                          : '조건에 맞는 설정 후보가 없습니다.'}
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
                        title={reviewComplete
                          ? '모든 설정 후보 검토를 완료했습니다.'
                          : '캐릭터 후보 묶음을 선택해 주세요.'}
                        description={reviewComplete
                          ? '확정하거나 무시한 후보는 검토 상태 필터에서 다시 확인할 수 있습니다.'
                          : '같은 이름으로 추출된 설정을 함께 확인하고 한 번에 확정할 수 있습니다.'}
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
                              <div style={{ color: C.t3, fontSize: 11 }}>같은 캐릭터 후보</div>
                              <h2 style={{ color: C.t1, fontSize: 18, fontWeight: 700, margin: '4px 0 0' }}>
                                {selectedGroup.entityName || '이름 없는 캐릭터'}
                                <span style={{ color: C.t3, fontSize: 12, fontWeight: 500, marginLeft: 8 }}>
                                  {selectedGroupCandidates.length}개 설정
                                </span>
                              </h2>
                            </div>
                            {pendingGroupCandidates.length > 0 && (
                              <ActionButton
                                disabled={actionPending || matchFilter !== 'ALL' || legacyGroupedActionsUnsafe}
                                disabledTitle={legacyGroupedActionsUnsafe
                                  ? '서버 업데이트 전 호환 목록에서는 그룹 일부만 보일 수 있어 일괄 연결할 수 없습니다.'
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
                            <p style={{ margin: '7px 0 0', color: C.t2, fontSize: 12, lineHeight: 1.6 }}>
                              같은 캐릭터에서 추출된 설정을 아래로 이어서 검토하고 남은 항목을 함께 확정합니다.
                            </p>
                          </header>

                          {selectedGroupCandidates.map(candidate => candidate.id && (
                            <CandidateDetail
                              key={candidate.id}
                              candidate={candidate}
                              applicationMode={applicationModeForCandidate(candidate)}
                              actionError={dismissErrorForCandidate(candidate.id)}
                              actionPending={actionPending}
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
                                ? resolution => {
                                    matchMutation.reset();
                                    setMatchTarget({ candidate, resolution });
                                  }
                                : undefined}
                              onApplicationModeChange={mode => {
                                setApplicationModes(previous => ({
                                  ...previous,
                                  [candidate.id!]: mode,
                                }));
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
                                <strong style={{ color: C.t1, fontSize: 13 }}>
                                  {selectedGroup.entityName}의 {pendingGroupCandidates.length}개 설정을 함께 확정합니다.
                                </strong>
                                <div style={{ color: groupConfirmBlockedReason ? C.warning : C.t3, fontSize: 11, marginTop: 4 }}>
                                  {matchFilter !== 'ALL'
                                    ? '그룹 전체를 안전하게 확정하려면 연결 상태 필터를 전체로 바꿔 주세요.'
                                    : groupConfirmBlockedReason
                                      ?? '각 항목의 제안을 함께 처리합니다. ‘반영하지 않음’ 제안은 저장하지 않고 자동으로 제외합니다.'}
                                </div>
                              </div>
                              <ActionButton
                                disabled={Boolean(groupConfirmBlockedReason) || matchFilter !== 'ALL' || actionPending}
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
                                <div role="alert" style={{ width: '100%', color: C.danger, fontSize: 12 }}>
                                  {groupConfirmError}
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
                <ActionButton disabled={true} tone={C.primary}>
                  {reviewComplete
                    ? '전체 후보 검토 완료 (다음 작업에서 연결)'
                    : `검토 완료 · ${combinedPending}개 후보 · ${combinedAttention}개 확인 필요`}
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
          error={selectedCandidateUpdateError}
          onClose={() => {
            if (updateMutation.isPending) return;
            updateMutation.reset();
            setEditCandidate(null);
          }}
          onSubmit={(attributeName, attributeValue) => (
            updateSelectedCandidate(editCandidate.id!, attributeName, attributeValue)
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
