import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Link2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useSearchParams } from 'react-router';
import {
  getSettingCandidateOptions,
  getSettingCandidatesOptions,
} from '../../api/generated/@tanstack/react-query.gen';
import type { SettingCandidateResponse } from '../../api/generated/types.gen';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { toApiError } from '../../lib/api-errors';
import { C } from './constants';
import { PageNavigation } from './PageNavigation';
import { UserMenu } from './UserMenu';

type ReviewStatus = NonNullable<SettingCandidateResponse['reviewStatus']>;
type MatchStatus = NonNullable<SettingCandidateResponse['matchStatus']>;
type ReviewFilter = ReviewStatus | 'ALL';
type MatchFilter = MatchStatus | 'ALL';

const DEFAULT_PAGE_SIZE = 20;
const REVIEW_FILTERS: Array<{ value: ReviewFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'PENDING_REVIEW', label: '검토 대기' },
  { value: 'CONFIRMED', label: '확정' },
  { value: 'DISMISSED', label: '무시' },
];
const MATCH_FILTERS: Array<{ value: MatchFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'MATCHED', label: '기존 캐릭터 연결됨' },
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
  UNRESOLVED: '새 캐릭터 후보',
  AMBIGUOUS: '캐릭터 연결 확인 필요',
};

function parsePositiveInteger(value: string | null, fallback: number, maximum?: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return maximum === undefined ? parsed : Math.min(parsed, maximum);
}

function parseReviewFilter(value: string | null): ReviewFilter {
  return REVIEW_FILTERS.some(filter => filter.value === value)
    ? value as ReviewFilter
    : 'ALL';
}

function parseMatchFilter(value: string | null): MatchFilter {
  return MATCH_FILTERS.some(filter => filter.value === value)
    ? value as MatchFilter
    : 'ALL';
}

function reviewColor(status: ReviewStatus | undefined): string {
  if (status === 'CONFIRMED') return C.success;
  if (status === 'DISMISSED') return C.t3;
  return C.warning;
}

function matchColor(status: MatchStatus | undefined): string {
  if (status === 'AMBIGUOUS') return C.warning;
  if (status === 'MATCHED') return C.primary;
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
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
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
              onClick={() => onChange(option.value)}
              style={{
                minHeight: 30, padding: '0 10px', borderRadius: 7,
                border: `1px solid ${active ? C.primary : C.border}`,
                background: active ? `${C.primary}18` : 'transparent',
                color: active ? C.primary : C.t2,
                fontSize: 11, fontWeight: active ? 700 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
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

function ReviewHeader({
  total,
  reviewed,
  onBack,
}: {
  total: number;
  reviewed: number;
  onBack: () => void;
}) {
  const percentage = total === 0 ? 0 : Math.round((reviewed / total) * 100);
  return (
    <header style={{
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
      <span style={{ color: C.t2, fontSize: 12 }}>{reviewed}/{total} 검토 완료</span>
      <div
        role="progressbar"
        aria-label="설정 후보 검토 진행률"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={reviewed}
        style={{ width: 120, height: 6, borderRadius: 4, background: C.border, overflow: 'hidden' }}
      >
        <div style={{
          width: `${percentage}%`, height: '100%', borderRadius: 4,
          background: C.primary, transition: 'width 0.2s ease',
        }} />
      </div>
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
    <section style={{
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
  onClick,
}: {
  candidate: SettingCandidateResponse;
  selected: boolean;
  onClick: () => void;
}) {
  const reviewStatus = candidate.reviewStatus ?? 'PENDING_REVIEW';
  const matchStatus = candidate.matchStatus ?? 'UNRESOLVED';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', minHeight: 88, padding: '13px 15px', borderRadius: 9,
        border: `1px solid ${selected ? C.primary : C.border}`,
        background: selected ? `${C.primary}14` : C.surface,
        color: C.t1, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
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
          {candidate.attributeName || '설정명 없음'}
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
  tone = C.t2,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  tone?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? '다음 작업 단위에서 연결됩니다.' : undefined}
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

function CandidateDetail({ candidate }: { candidate: SettingCandidateResponse }) {
  const reviewStatus = candidate.reviewStatus ?? 'PENDING_REVIEW';
  const matchStatus = candidate.matchStatus ?? 'UNRESOLVED';
  const readOnly = reviewStatus !== 'PENDING_REVIEW';
  const confidence = confidenceDescription(candidate.confidence);
  const quotes = evidenceQuotes(candidate.evidenceSpans);

  return (
    <article style={{
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

      {matchStatus === 'AMBIGUOUS' && (
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
            {matchStatus === 'MATCHED'
              ? '연결된 캐릭터'
              : reviewStatus === 'DISMISSED'
                ? '연결하지 않고 무시한 후보'
                : '새 캐릭터 등록 예정'}
          </span>
          <strong style={{ color: C.t1, fontSize: 13 }}>{candidate.entityName || '이름 없음'}</strong>
          {readOnly && <LockKeyhole size={13} color={C.t3} />}
        </div>
      )}

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 22, marginTop: 20,
      }}>
        {[
          ['값 유형', candidate.valueType || 'UNKNOWN'],
          ['설정명', candidate.attributeName || '정보 없음'],
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
          {matchStatus === 'AMBIGUOUS' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18 }}>
              <ActionButton disabled tone={C.primary}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Link2 size={13} /> 기존 캐릭터에 연결
                </span>
              </ActionButton>
              <ActionButton disabled tone={C.primary}>새 캐릭터로 등록</ActionButton>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <ActionButton disabled>무시</ActionButton>
            <ActionButton disabled tone={C.warning}>수정</ActionButton>
            <ActionButton disabled tone={C.success}>확정</ActionButton>
          </div>
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

export default function SSettingReview() {
  const navigate = useAppNavigate();
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

  const listQuery = useQuery({
    ...getSettingCandidatesOptions({
      path: { workId },
      query: {
        batchId,
        reviewStatus: reviewFilter === 'ALL' ? undefined : reviewFilter,
        matchStatus: matchFilter === 'ALL' ? undefined : matchFilter,
        page: apiPage,
        size,
      },
    }),
    enabled: hasContext,
    retry: (failureCount, error) => toApiError(error)?.status !== 404 && failureCount < 2,
  });
  const listData = listQuery.data?.data;
  const candidatePage = listData?.candidates;
  const candidates = useMemo(() => candidatePage?.content ?? [], [candidatePage?.content]);
  const firstCandidateId = candidates[0]?.id;

  useEffect(() => {
    if (selectedCandidateId || !firstCandidateId) return;
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('candidate', firstCandidateId);
      return next;
    }, { replace: true });
  }, [firstCandidateId, selectedCandidateId, setSearchParams]);

  const detailQuery = useQuery({
    ...getSettingCandidateOptions({
      path: { workId, candidateId: selectedCandidateId ?? '' },
      query: { batchId },
    }),
    enabled: hasContext && Boolean(selectedCandidateId),
    retry: (failureCount, error) => toApiError(error)?.status !== 404 && failureCount < 2,
  });
  const selectedCandidate = detailQuery.data?.data;

  const updateFilters = (nextReview: ReviewFilter, nextMatch: MatchFilter) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (nextReview === 'ALL') next.delete('reviewStatus');
      else next.set('reviewStatus', nextReview);
      if (nextMatch === 'ALL') next.delete('matchStatus');
      else next.set('matchStatus', nextMatch);
      next.set('page', '1');
      next.delete('candidate');
      return next;
    }, { replace: true });
  };
  const selectCandidate = (candidateId: string) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('candidate', candidateId);
      return next;
    }, { replace: true });
  };
  const changePage = (page: number) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('page', String(page + 1));
      next.delete('candidate');
      return next;
    }, { replace: true });
  };
  const backToManuscripts = () => navigate(
    workId ? `/dashboard?workId=${encodeURIComponent(workId)}&nav=manuscripts` : '/works',
    'pop',
  );

  const total = listData?.totalCandidateCount ?? 0;
  const reviewed = listData?.reviewedCandidateCount ?? 0;
  const pending = listData?.pendingCandidateCount ?? 0;
  const matchRequired = listData?.matchRequiredCandidateCount ?? 0;
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
    }, { replace: true });
  }, [apiPage, candidatePage?.totalPages, setSearchParams]);

  if (!hasContext) {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg }}>
        <ReviewHeader total={0} reviewed={0} onBack={backToManuscripts} />
        <main style={{ maxWidth: 920, margin: '0 auto', padding: '60px 24px' }}>
          <QueryState
            icon={<AlertCircle size={28} color={C.warning} />}
            title="검토할 분석 정보를 찾을 수 없습니다."
            description="작품과 업로드 묶음 정보가 모두 필요합니다. 분석 완료 화면에서 다시 들어와 주세요."
            action={<ActionButton tone={C.primary} onClick={backToManuscripts}>이전 화면으로</ActionButton>}
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
      <ReviewHeader total={total} reviewed={reviewed} onBack={backToManuscripts} />
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 1450, margin: '0 auto', padding: '26px 28px 70px' }}>
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
                <div style={{
                  marginTop: 18, display: 'grid',
                  gridTemplateColumns: 'minmax(310px, 390px) minmax(0, 1fr)',
                  gap: 18, alignItems: 'start',
                }}>
                  <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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

                    {candidates.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {candidates.map(candidate => candidate.id && (
                          <CandidateCard
                            key={candidate.id}
                            candidate={candidate}
                            selected={candidate.id === selectedCandidateId}
                            onClick={() => selectCandidate(candidate.id!)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        padding: '30px 18px', borderRadius: 9, border: `1px solid ${C.border}`,
                        background: C.surface, textAlign: 'center', color: C.t3, fontSize: 12,
                      }}>
                        조건에 맞는 설정 후보가 없습니다.
                      </div>
                    )}

                    <PageNavigation
                      page={currentPage}
                      totalPages={totalPages}
                      disabled={listQuery.isFetching}
                      onPageChange={changePage}
                    />
                  </aside>

                  <section>
                    {!selectedCandidateId ? (
                      <QueryState
                        icon={<Sparkles size={26} color={C.primary} />}
                        title="설정 후보를 선택해 주세요."
                        description="왼쪽 목록에서 후보를 선택하면 원문 근거와 설정값을 확인할 수 있습니다."
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
                      <CandidateDetail candidate={selectedCandidate} />
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
    </div>
  );
}
