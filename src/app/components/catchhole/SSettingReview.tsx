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
  confirmSettingCandidateMutation,
  dismissSettingCandidateMutation,
  getCharactersQueryKey,
  getCharactersOptions,
  getSettingCandidateQueryKey,
  getSettingCandidateOptions,
  getSettingCandidatesQueryKey,
  getSettingCandidatesOptions,
  updateSettingCandidateCharacterMatchMutation,
  updateSettingCandidateMutation,
} from '../../api/generated/@tanstack/react-query.gen';
import type {
  CharacterSummaryResponse,
  SettingCandidateResponse,
} from '../../api/generated/types.gen';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { toApiError } from '../../lib/api-errors';
import { shouldRetryQuery } from '../../lib/query-client';
import { C } from './constants';
import { PageNavigation } from './PageNavigation';
import { UserMenu } from './UserMenu';

type ReviewStatus = NonNullable<SettingCandidateResponse['reviewStatus']>;
type MatchStatus = NonNullable<SettingCandidateResponse['matchStatus']>;
type ReviewFilter = ReviewStatus | 'ALL';
type MatchFilter = 'ALL' | 'CONNECTED' | 'UNRESOLVED' | 'AMBIGUOUS';

const DEFAULT_PAGE_SIZE = 20;
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
function toSettingDisplay(attributeName?: string): SettingDisplay {
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
    <div>
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
  matchRequired,
}: {
  episodeRange: string;
  total: number;
  reviewed: number;
  pending: number;
  matchRequired: number;
}) {
  const items = [
    ['분석 대상', episodeRange, C.t1],
    ['전체 후보', `${total}개`, C.t1],
    ['검토 완료', `${reviewed}개`, C.t1],
    ['검토 대기', `${pending}개`, C.t1],
    ['연결 필요', `${matchRequired}개`, matchRequired > 0 ? C.warning : C.t1],
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

function CandidateCard({
  candidate,
  selected,
  disabled = false,
  onClick,
}: {
  candidate: SettingCandidateResponse;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const reviewStatus = candidate.reviewStatus ?? 'PENDING_REVIEW';
  const matchStatus = candidate.matchStatus ?? 'UNRESOLVED';
  const settingDisplay = toSettingDisplay(candidate.attributeName);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '100%', minHeight: 88, padding: '13px 15px', borderRadius: 9,
        border: `1px solid ${selected ? C.primary : C.border}`,
        background: selected ? `${C.primary}14` : C.surface,
        color: C.t1, textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? 0.68 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          padding: '2px 7px', borderRadius: 10, color: C.t2, background: C.bg,
          border: `1px solid ${C.border}`, fontSize: 10, fontWeight: 650,
        }}>
          {candidate.episodeNo == null ? '회차 없음' : `${candidate.episodeNo}화`}
        </span>
        <strong style={{
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: 13,
        }}>
          {candidate.entityName || '이름 없는 캐릭터'}
        </strong>
        <span style={{ color: C.t3, fontSize: 11 }}>·</span>
        <span style={{
          minWidth: 0, flex: 1, color: C.t3, fontSize: 11,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {settingDisplay.typeLabel} · {settingDisplay.nameLabel}
        </span>
        <strong style={{
          maxWidth: '32%', color: C.t2, fontSize: 12,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {candidate.attributeValue || '값 없음'}
        </strong>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <StatusBadge label={REVIEW_LABELS[reviewStatus]} color={reviewColor(reviewStatus)} />
        <StatusBadge label={MATCH_LABELS[matchStatus]} color={matchColor(matchStatus)} />
      </div>
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
  onClose,
  onSubmit,
}: {
  workId: string;
  candidate: SettingCandidateResponse;
  initialResolution: MatchResolution;
  pending: boolean;
  error: string | null;
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
      title="캐릭터 연결 확인"
      description={`“${candidate.rawEntityMention || candidate.entityName || '이름 없음'}” 후보가 누구인지 선택해 주세요.`}
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
  actionError,
  actionPending,
  confirming,
  dismissing,
  onConfirm,
  onDismiss,
  onEdit,
  onMatch,
}: {
  candidate: SettingCandidateResponse;
  actionError: string | null;
  actionPending: boolean;
  confirming: boolean;
  dismissing: boolean;
  onConfirm?: () => void;
  onDismiss?: () => void;
  onEdit?: () => void;
  onMatch?: (resolution: MatchResolution) => void;
}) {
  const reviewStatus = candidate.reviewStatus ?? 'PENDING_REVIEW';
  const matchStatus = candidate.matchStatus ?? 'UNRESOLVED';
  const readOnly = reviewStatus !== 'PENDING_REVIEW';
  const confidence = confidenceDescription(candidate.confidence);
  const quotes = evidenceQuotes(candidate.evidenceSpans);
  const settingDisplay = toSettingDisplay(candidate.attributeName);

  return (
    <article className="setting-candidate-detail" style={{
      border: `1px solid ${C.border}`, borderRadius: 10, padding: 22, background: C.surface,
      minHeight: 410,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <StatusBadge label={REVIEW_LABELS[reviewStatus]} color={reviewColor(reviewStatus)} />
        <StatusBadge label={MATCH_LABELS[matchStatus]} color={matchColor(matchStatus)} />
        <div style={{ flex: 1 }} />
        <span style={{ color: C.t3, fontSize: 12 }}>
          {candidate.episodeNo == null ? '출처 회차 없음' : `${candidate.episodeNo}화`}
        </span>
      </div>

      <h2 style={{ color: C.t1, fontSize: 21, margin: '20px 0 5px' }}>
        {candidate.entityName || '이름 없는 캐릭터'}
      </h2>
      <div style={{ color: C.t3, fontSize: 12 }}>
        원문 표현: “{candidate.rawEntityMention || candidate.entityName || '정보 없음'}”
      </div>

      {matchStatus === 'AMBIGUOUS' && !readOnly && (
        <div role="status" style={{
          marginTop: 18, padding: '13px 15px', borderRadius: 8,
          border: `1px solid ${C.warning}`, background: `${C.warning}12`,
          display: 'flex', alignItems: 'center', gap: 9, color: C.t1, fontSize: 13, fontWeight: 650,
        }}>
          <AlertCircle size={17} color={C.warning} />
          어떤 캐릭터의 설정인지 확인이 필요합니다.
        </div>
      )}

      {readOnly && (
        <div role="status" style={{
          marginTop: 18, padding: '13px 15px', borderRadius: 8,
          border: `1px solid ${reviewColor(reviewStatus)}`,
          background: `${reviewColor(reviewStatus)}12`,
          display: 'flex', alignItems: 'center', gap: 9, color: C.t1, fontSize: 13, fontWeight: 650,
        }}>
          {reviewStatus === 'CONFIRMED'
            ? <CheckCircle2 size={17} color={C.success} />
            : <LockKeyhole size={17} color={C.t3} />}
          {reviewStatus === 'CONFIRMED'
            ? '확정된 후보입니다. 모든 정보는 읽기 전용으로 표시됩니다.'
            : '무시한 후보입니다. 모든 정보는 읽기 전용으로 표시됩니다.'}
        </div>
      )}

      {matchStatus !== 'AMBIGUOUS' && (
        <div style={{
          marginTop: 18, padding: '12px 14px', borderRadius: 8,
          border: `1px solid ${C.border}`, background: C.bg,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ color: C.t3, fontSize: 11 }}>
            {isConnectedMatch(matchStatus)
              ? '연결된 캐릭터'
              : reviewStatus === 'DISMISSED'
                ? '연결하지 않고 무시한 후보'
                : '새 캐릭터 등록 예정'}
          </span>
          <strong style={{ color: C.t1, fontSize: 13 }}>{candidate.entityName || '이름 없음'}</strong>
          {readOnly && <LockKeyhole size={13} color={C.t3} />}
        </div>
      )}

      <div className="setting-candidate-fields" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 22, marginTop: 20,
      }}>
        {[
          ['설정 유형', settingDisplay.typeLabel],
          ['설정명', settingDisplay.nameLabel],
          ['설정값', candidate.attributeValue || '값 없음'],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ color: C.t3, fontSize: 11, marginBottom: 7 }}>{label}</div>
            <strong style={{ color: C.t1, fontSize: 16, overflowWrap: 'anywhere' }}>{value}</strong>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 22, padding: '15px 16px', borderRadius: 8,
        border: `1px solid ${confidence.color}66`, background: `${confidence.color}12`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: confidence.color }}>
          <Sparkles size={15} />
          <strong style={{ fontSize: 13 }}>AI 근거 명확도 {confidence.percent}</strong>
        </div>
        <div style={{ color: C.t2, fontSize: 12, marginTop: 7 }}>{confidence.description}</div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <LockKeyhole size={13} color={C.t3} />
          <span style={{ color: C.t3, fontSize: 11 }}>AI가 추출할 때 참고한 원문 · 읽기 전용</span>
          <div style={{ flex: 1 }} />
          <span style={{ color: C.t3, fontSize: 11 }}>
            {candidate.episodeNo == null ? '출처 회차 없음' : `${candidate.episodeNo}화에서 확인`}
          </span>
        </div>
        {quotes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {quotes.map((quote, index) => (
              <blockquote key={`${quote}-${index}`} style={{
                margin: 0, padding: '12px 14px', borderRadius: 7,
                border: `1px solid ${C.border}`, background: C.bg,
                color: C.t2, fontSize: 12, lineHeight: 1.65,
              }}>
                “{quote}”
              </blockquote>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '12px 14px', borderRadius: 7, border: `1px solid ${C.border}`,
            background: C.bg, color: C.t3, fontSize: 12,
          }}>
            표시할 원문 근거가 없습니다.
          </div>
        )}
      </div>

      {!readOnly && (
        <>
          <div className="setting-candidate-match-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18 }}>
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
          <div className="setting-candidate-review-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <ActionButton
              disabled={!onDismiss || actionPending}
              disabledTitle={dismissing
                ? '설정 후보를 무시하고 있습니다.'
                : actionPending
                  ? '다른 후보 작업이 끝난 뒤 시도해 주세요.'
                  : undefined}
              onClick={onDismiss}
            >
              {dismissing ? '무시 중…' : '무시'}
            </ActionButton>
            <ActionButton
              disabled={!onEdit || actionPending}
              tone={C.warning}
              onClick={onEdit}
            >
              수정
            </ActionButton>
            <ActionButton
              disabled={matchStatus === 'AMBIGUOUS' || !onConfirm || actionPending}
              disabledTitle={matchStatus === 'AMBIGUOUS'
                ? '캐릭터 연결을 먼저 확인해 주세요.'
                : confirming
                  ? '설정 후보를 확정하고 있습니다.'
                  : actionPending
                    ? '다른 후보 작업이 끝난 뒤 시도해 주세요.'
                    : undefined}
              tone={C.success}
              onClick={onConfirm}
            >
              {confirming ? '확정 중…' : '확정'}
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
    </article>
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

export default function SSettingReview() {
  const navigate = useAppNavigate();
  const routerNavigate = useRouterNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const workId = searchParams.get('workId') ?? '';
  const batchId = searchParams.get('batchId') ?? '';
  const selectedCandidateId = searchParams.get('candidate');
  const reviewFilter = parseReviewFilter(searchParams.get('reviewStatus'));
  const matchFilter = parseMatchFilter(searchParams.get('matchStatus'));
  const urlPage = parsePositiveInteger(searchParams.get('page'), 1);
  const size = parsePositiveInteger(searchParams.get('size'), DEFAULT_PAGE_SIZE, 100);
  const apiPage = urlPage - 1;
  const hasContext = Boolean(workId && batchId);
  const [editOpen, setEditOpen] = useState(false);
  const [matchResolution, setMatchResolution] = useState<MatchResolution | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(
    () => Boolean(searchParams.get('candidate')),
  );
  const mountedRef = useRef(false);
  const reviewNavigationState = location.state as {
    returnToAnalysisList?: unknown;
    returnToAnalysisListByUrl?: unknown;
  } | null;
  const returnToAnalysisList = reviewNavigationState?.returnToAnalysisList;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isCurrentReviewContext = (targetWorkId: string, targetCandidateId: string) => {
    if (!mountedRef.current || window.location.pathname !== '/setting-review') return false;
    const currentParams = new URLSearchParams(window.location.search);
    return currentParams.get('workId') === targetWorkId
      && currentParams.get('batchId') === batchId
      && currentParams.get('candidate') === targetCandidateId;
  };

  const listQuery = useQuery({
    ...getSettingCandidatesOptions({
      path: { workId },
      query: {
        batchId,
        reviewStatus: reviewFilter === 'ALL' ? undefined : reviewFilter,
        matchStatuses: matchStatusesForFilter(matchFilter),
        page: apiPage,
        size,
      },
    }),
    enabled: hasContext,
    retry: shouldRetryCandidateQuery,
  });
  const listData = listQuery.data?.data;
  const candidatePage = listData?.candidates;
  const candidates = useMemo(() => candidatePage?.content ?? [], [candidatePage?.content]);
  const firstCandidateId = candidates.find(
    candidate => candidate.reviewStatus === 'PENDING_REVIEW',
  )?.id ?? candidates[0]?.id;

  useEffect(() => {
    // 실패한 refetch가 보존한 이전 목록에서는 이미 처리한 후보를 다시 자동 선택하지 않는다.
    if (!listQuery.isSuccess || listQuery.isFetching || selectedCandidateId || !firstCandidateId) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('candidate', firstCandidateId);
      return next;
    }, { replace: true, state: location.state });
  }, [
    firstCandidateId,
    listQuery.isFetching,
    listQuery.isSuccess,
    location.state,
    selectedCandidateId,
    setSearchParams,
  ]);

  const detailQuery = useQuery({
    ...getSettingCandidateOptions({
      path: { workId, candidateId: selectedCandidateId ?? '' },
      query: { batchId },
    }),
    enabled: hasContext && Boolean(selectedCandidateId),
    retry: shouldRetryCandidateQuery,
  });
  const selectedCandidate = detailQuery.data?.data;
  const confirmMutation = useMutation({
    ...confirmSettingCandidateMutation(),
    onSuccess: async (_, variables) => {
      const targetWorkId = variables.path.workId;
      const targetCandidateId = variables.path.candidateId;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getSettingCandidatesQueryKey({
            path: { workId: targetWorkId },
            query: { batchId },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: getSettingCandidateQueryKey({
            path: { workId: targetWorkId, candidateId: targetCandidateId },
            query: { batchId },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: getCharactersQueryKey({ path: { workId: targetWorkId } }),
        }),
      ]);
      if (!isCurrentReviewContext(targetWorkId, targetCandidateId)) return;
      setSearchParams(previous => {
        if (previous.get('candidate') !== targetCandidateId) {
          return previous;
        }
        const next = new URLSearchParams(previous);
        next.delete('candidate');
        return next;
      }, { replace: true, state: location.state });
    },
  });
  const dismissMutation = useMutation({
    ...dismissSettingCandidateMutation(),
    onSuccess: async (_, variables) => {
      const targetWorkId = variables.path.workId;
      const targetCandidateId = variables.path.candidateId;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getSettingCandidatesQueryKey({
            path: { workId: targetWorkId },
            query: { batchId },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: getSettingCandidateQueryKey({
            path: { workId: targetWorkId, candidateId: targetCandidateId },
            query: { batchId },
          }),
        }),
      ]);
      if (!isCurrentReviewContext(targetWorkId, targetCandidateId)) return;
      setSearchParams(previous => {
        if (previous.get('candidate') !== targetCandidateId) {
          return previous;
        }
        const next = new URLSearchParams(previous);
        next.delete('candidate');
        return next;
      }, { replace: true, state: location.state });
    },
  });
  const updateMutation = useMutation({
    ...updateSettingCandidateMutation(),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getSettingCandidatesQueryKey({
            path: { workId: variables.path.workId },
            query: { batchId },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: getSettingCandidateQueryKey({
            path: {
              workId: variables.path.workId,
              candidateId: variables.path.candidateId,
            },
            query: { batchId },
          }),
        }),
      ]);
      if (isCurrentReviewContext(variables.path.workId, variables.path.candidateId)) {
        setEditOpen(false);
      }
    },
  });
  const matchMutation = useMutation({
    ...updateSettingCandidateCharacterMatchMutation(),
    onSuccess: async (response, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getSettingCandidatesQueryKey({
            path: { workId: variables.path.workId },
            query: { batchId },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: getSettingCandidateQueryKey({
            path: {
              workId: variables.path.workId,
              candidateId: variables.path.candidateId,
            },
            query: { batchId },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: getCharactersQueryKey({ path: { workId: variables.path.workId } }),
        }),
      ]);
      if (!isCurrentReviewContext(variables.path.workId, variables.path.candidateId)) return;
      setMatchResolution(null);
      setSearchParams(previous => {
        const activeMatchFilter = parseMatchFilter(previous.get('matchStatus'));
        const nextMatchStatus = response.data?.matchStatus;
        if (previous.get('candidate') !== variables.path.candidateId
          || matchesMatchFilter(nextMatchStatus, activeMatchFilter)) {
          return previous;
        }
        const next = new URLSearchParams(previous);
        next.delete('candidate');
        return next;
      }, { replace: true, state: location.state });
    },
  });
  const confirmingSelectedCandidate = confirmMutation.isPending
    && confirmMutation.variables.path.candidateId === selectedCandidateId;
  const dismissingSelectedCandidate = dismissMutation.isPending
    && dismissMutation.variables.path.candidateId === selectedCandidateId;
  const selectedCandidateConfirmError = confirmMutation.isError
    && confirmMutation.variables?.path.candidateId === selectedCandidateId
    ? errorMessage(confirmMutation.error, '설정 후보를 확정하지 못했습니다. 다시 시도해 주세요.')
    : null;
  const selectedCandidateDismissError = dismissMutation.isError
    && dismissMutation.variables?.path.candidateId === selectedCandidateId
    ? errorMessage(dismissMutation.error, '설정 후보를 무시하지 못했습니다. 다시 시도해 주세요.')
    : null;
  const selectedCandidateUpdateError = updateMutation.isError
    && updateMutation.variables?.path.candidateId === selectedCandidateId
    ? errorMessage(updateMutation.error, '설정 후보를 수정하지 못했습니다. 입력값을 확인해 주세요.')
    : null;
  const selectedCandidateMatchError = matchMutation.isError
    && matchMutation.variables?.path.candidateId === selectedCandidateId
    ? errorMessage(matchMutation.error, '캐릭터 연결을 저장하지 못했습니다. 다시 시도해 주세요.')
    : null;
  const actionPending = confirmMutation.isPending
    || dismissMutation.isPending
    || updateMutation.isPending
    || matchMutation.isPending;

  const updateFilters = (nextReview: ReviewFilter, nextMatch: MatchFilter) => {
    if (actionPending) return;
    setMobileDetailOpen(false);
    confirmMutation.reset();
    dismissMutation.reset();
    updateMutation.reset();
    matchMutation.reset();
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (nextReview === 'PENDING_REVIEW') next.delete('reviewStatus');
      else next.set('reviewStatus', nextReview);
      if (nextMatch === 'ALL') next.delete('matchStatus');
      else next.set('matchStatus', nextMatch);
      next.set('page', '1');
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  };
  const selectCandidate = (candidateId: string) => {
    if (actionPending) return;
    setMobileDetailOpen(true);
    confirmMutation.reset();
    dismissMutation.reset();
    updateMutation.reset();
    matchMutation.reset();
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('candidate', candidateId);
      return next;
    }, { replace: true, state: location.state });
  };
  const changePage = (page: number) => {
    if (actionPending) return;
    setMobileDetailOpen(false);
    confirmMutation.reset();
    dismissMutation.reset();
    updateMutation.reset();
    matchMutation.reset();
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('page', String(page + 1));
      next.delete('candidate');
      return next;
    }, { replace: true, state: location.state });
  };
  const confirmSelectedCandidate = () => {
    if (!selectedCandidateId || actionPending) return;
    dismissMutation.reset();
    confirmMutation.mutate({
      path: { workId, candidateId: selectedCandidateId },
    });
  };
  const dismissSelectedCandidate = () => {
    if (!selectedCandidateId || actionPending) return;
    confirmMutation.reset();
    dismissMutation.mutate({
      path: { workId, candidateId: selectedCandidateId },
    });
  };
  const updateSelectedCandidate = (attributeName: string, attributeValue: string | null) => {
    if (!selectedCandidateId || actionPending) return;
    updateMutation.mutate({
      path: { workId, candidateId: selectedCandidateId },
      body: { attributeName, attributeValue },
    });
  };
  const matchSelectedCandidate = (resolution: MatchResolution, value: string) => {
    if (!selectedCandidateId || actionPending) return;
    matchMutation.mutate({
      path: { workId, candidateId: selectedCandidateId },
      body: resolution === 'MATCH_EXISTING'
        ? { resolutionType: resolution, matchedCharacterId: value }
        : { resolutionType: resolution, entityName: value },
    });
  };
  const backToAnalysisList = () => {
    if (typeof returnToAnalysisList === 'string' && returnToAnalysisList) {
      if (reviewNavigationState?.returnToAnalysisListByUrl === true) {
        routerNavigate(-2);
        return;
      }
      routerNavigate(-1);
      return;
    }
    navigate(
      workId ? `/dashboard?workId=${encodeURIComponent(workId)}&nav=analyses` : '/works',
      'pop',
      undefined,
      { replace: true },
    );
  };

  const total = listData?.totalCandidateCount ?? 0;
  const reviewed = listData?.reviewedCandidateCount ?? 0;
  const pending = listData?.pendingCandidateCount ?? 0;
  const matchRequired = listData?.matchRequiredCandidateCount ?? 0;
  const totalPages = candidatePage?.totalPages ?? 0;
  const currentPage = candidatePage?.page ?? apiPage;
  const reviewComplete = reviewFilter === 'PENDING_REVIEW' && total > 0 && pending === 0;

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
      <main className="setting-review-main" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="setting-review-content" style={{ maxWidth: 1450, margin: '0 auto', padding: '26px 28px 70px' }}>
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
              <ReviewSummary
                episodeRange={formatEpisodeRange(
                  listData?.episodeStartNo,
                  listData?.episodeEndNo,
                  listData?.episodeCount ?? 0,
                )}
                total={total}
                reviewed={reviewed}
                pending={pending}
                matchRequired={matchRequired}
              />

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
                    description="이번 분석에서는 원문 근거가 명확한 설정을 찾지 못했습니다."
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
                      disabled={actionPending}
                      onChange={value => updateFilters(value, matchFilter)}
                    />
                    <FilterGroup
                      label="캐릭터 연결 상태"
                      value={matchFilter}
                      options={MATCH_FILTERS}
                      disabled={actionPending}
                      onChange={value => updateFilters(reviewFilter, value)}
                    />
                    <div style={{ color: C.t3, fontSize: 11 }}>↑ 회차 번호 · 생성 순</div>

                    {candidates.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {candidates.map(candidate => candidate.id && (
                          <div
                            key={candidate.id}
                          >
                            <CandidateCard
                              candidate={candidate}
                              selected={candidate.id === selectedCandidateId}
                              disabled={actionPending}
                              onClick={() => selectCandidate(candidate.id!)}
                            />
                          </div>
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
                      disabled={listQuery.isFetching || actionPending}
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
                    {!selectedCandidateId ? (
                      <QueryState
                        icon={<Sparkles size={26} color={C.primary} />}
                        title={reviewComplete
                          ? '모든 설정 후보 검토를 완료했습니다.'
                          : '설정 후보를 선택해 주세요.'}
                        description={reviewComplete
                          ? '확정하거나 무시한 후보는 검토 상태 필터에서 다시 확인할 수 있습니다.'
                          : '왼쪽 목록에서 후보를 선택하면 원문 근거와 설정값을 확인할 수 있습니다.'}
                      />
                    ) : detailQuery.isPending ? (
                      <QueryState
                        icon={<Loader2 size={26} color={C.primary} className="spin" />}
                        title="후보 상세를 불러오고 있습니다."
                        description="설정값과 최초 원문 근거를 확인하고 있습니다."
                      />
                    ) : detailQuery.isError || !selectedCandidate ? (
                      <QueryState
                        icon={<AlertCircle size={27} color={C.danger} />}
                        title="후보 상세를 불러오지 못했습니다."
                        description={errorMessage(detailQuery.error, '후보가 현재 검토 묶음에 속하는지 확인해 주세요.')}
                        action={(
                          <button
                            type="button"
                            onClick={() => void detailQuery.refetch()}
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
                      <CandidateDetail
                        candidate={selectedCandidate}
                        actionError={selectedCandidateDismissError ?? selectedCandidateConfirmError}
                        actionPending={actionPending}
                        confirming={confirmingSelectedCandidate}
                        dismissing={dismissingSelectedCandidate}
                        onDismiss={dismissSelectedCandidate}
                        onEdit={() => {
                          updateMutation.reset();
                          setEditOpen(true);
                        }}
                        onMatch={resolution => {
                          matchMutation.reset();
                          setMatchResolution(resolution);
                        }}
                        onConfirm={selectedCandidate.matchStatus === 'AMBIGUOUS'
                          ? undefined
                          : confirmSelectedCandidate}
                      />
                    )}
                  </section>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                <ActionButton disabled={true} tone={C.primary}>
                  {pending === 0 && total > 0 ? '검토 완료 (다음 작업에서 연결)' : `검토 완료 · ${pending}개 후보 남음`}
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
          pending={updateMutation.isPending}
          error={selectedCandidateUpdateError}
          onClose={() => {
            if (updateMutation.isPending) return;
            updateMutation.reset();
            setEditOpen(false);
          }}
          onSubmit={updateSelectedCandidate}
        />
      )}
      {selectedCandidate && matchResolution && (
        <CharacterMatchModal
          key={`${selectedCandidate.id}-${matchResolution}`}
          workId={workId}
          candidate={selectedCandidate}
          initialResolution={matchResolution}
          pending={matchMutation.isPending}
          error={selectedCandidateMatchError}
          onClose={() => {
            if (matchMutation.isPending) return;
            matchMutation.reset();
            setMatchResolution(null);
          }}
          onSubmit={matchSelectedCandidate}
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
        }
      `}</style>
    </div>
  );
}
