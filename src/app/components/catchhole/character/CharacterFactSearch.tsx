import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { AlertCircle, ChevronRight, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import {
  getCharacterFactOptions,
  searchCharacterFactsOptions,
} from '../../../api/generated/@tanstack/react-query.gen';
import type {
  CharacterFactSearchResponse,
  SearchCharacterFactsData,
} from '../../../api/generated/types.gen';
import { toApiError } from '../../../lib/api-errors';
import { shouldRetryQuery } from '../../../lib/query-client';
import { C } from '../constants';
import { PageNavigation } from '../PageNavigation';

type SearchQuery = NonNullable<SearchCharacterFactsData['query']>;
type FactTypeFilter = NonNullable<SearchQuery['factType']>;
type ScopeFilter = NonNullable<SearchQuery['scope']>;
type ResultFactType = NonNullable<CharacterFactSearchResponse['factType']>;

interface Props {
  workId: string;
  enabled: boolean;
}

const PAGE_SIZE = 20;
const FACT_TYPE_OPTIONS: ReadonlyArray<{ value: FactTypeFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'AGE', label: '나이' },
  { value: 'LEVEL', label: '레벨' },
  { value: 'STAT', label: '스탯' },
  { value: 'SKILL', label: '스킬' },
  { value: 'ITEM', label: '아이템' },
  { value: 'STATUS', label: '상태' },
];
const SCOPE_OPTIONS: ReadonlyArray<{ value: ScopeFilter; label: string }> = [
  { value: 'ALL', label: '전체 이력' },
  // API enum은 하위 호환을 위해 유지하되, UI에서는 snapshot 기여 여부라는 실제 의미를 설명한다.
  { value: 'CURRENT', label: '현재값 근거' },
  { value: 'HISTORICAL', label: '그 외 이력' },
];
const FACT_TYPES = new Set<FactTypeFilter>(FACT_TYPE_OPTIONS.map(option => option.value));
const SCOPES = new Set<ScopeFilter>(SCOPE_OPTIONS.map(option => option.value));
const FACT_TYPE_COLORS: Record<ResultFactType, string> = {
  AGE: '#FB923C',
  LEVEL: '#F472B6',
  STAT: '#38BDF8',
  SKILL: '#A78BFA',
  ITEM: '#FBBF24',
  STATUS: '#FB7185',
};

function isFactType(value: string | null): value is FactTypeFilter {
  return value !== null && FACT_TYPES.has(value as FactTypeFilter);
}

function isScope(value: string | null): value is ScopeFilter {
  return value !== null && SCOPES.has(value as ScopeFilter);
}

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function sourceLabel(result: CharacterFactSearchResponse): string {
  const characterName = result.characterName ?? '이름 없는 캐릭터';
  return result.sourceEpisodeNo == null
    ? `${characterName} · 출처 회차 없음`
    : `${characterName} · ${result.sourceEpisodeNo}화에서 확인`;
}

function factTypeColor(factType: CharacterFactSearchResponse['factType']): string {
  return factType ? FACT_TYPE_COLORS[factType] : C.primary;
}

function contributesToCurrentSnapshot(
  fact: Pick<CharacterFactSearchResponse, 'contributesToCurrentSnapshot' | 'isCurrent'>,
): boolean {
  // 새 계약을 우선하고, isCurrent는 이전 Backend 응답과의 호환에만 사용한다.
  return fact.contributesToCurrentSnapshot ?? fact.isCurrent ?? false;
}

function queryErrorMessage(error: unknown, fallback: string): string {
  return toApiError(error)?.message ?? (error instanceof Error ? error.message : fallback);
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`character-fact-chip${active ? ' is-active' : ''}`}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        height: 30,
        padding: '0 13px',
        borderRadius: 16,
        border: `1px solid ${active ? C.primary : C.border}`,
        background: active ? C.primary + '20' : C.surface,
        color: active ? C.primary : C.t2,
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: active ? 650 : 450,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function StatePanel({
  kind,
  message,
  onRetry,
}: {
  kind: 'loading' | 'empty' | 'error' | 'disabled';
  message: string;
  onRetry?: () => void;
}) {
  const error = kind === 'error';
  return (
    <div
      className={`character-fact-state database-state is-${kind}`}
      role={error ? 'alert' : 'status'}
      style={{
        minHeight: 250,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        background: C.surface,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: C.t2,
        fontSize: 13,
      }}
    >
      {kind === 'loading' && <Loader2 size={22} className="spin" color={C.primary} />}
      {error && <AlertCircle size={24} color={C.danger} />}
      {kind === 'empty' && <Search size={23} color={C.t3} />}
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            height: 34,
            padding: '0 14px',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: C.bg,
            color: C.t2,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 12,
          }}
        >
          <RefreshCw size={13} /> 다시 시도
        </button>
      )}
    </div>
  );
}

export function CharacterFactSearch({ workId, enabled }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawQuery = searchParams.get('q');
  const appliedQuery = (rawQuery ?? '').trim();
  const factType: FactTypeFilter = isFactType(searchParams.get('factType'))
    ? searchParams.get('factType') as FactTypeFilter
    : 'ALL';
  const scope: ScopeFilter = isScope(searchParams.get('scope'))
    ? searchParams.get('scope') as ScopeFilter
    : 'ALL';
  const urlPage = parsePage(searchParams.get('page'));
  const selectedFactId = searchParams.get('modal') === 'fact-detail'
    ? searchParams.get('factId')
    : null;
  const [draftQuery, setDraftQuery] = useState(appliedQuery);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    const ensure = (key: string, value: string) => {
      if (next.get(key) === value) return;
      next.set(key, value);
      changed = true;
    };

    ensure('q', appliedQuery);
    ensure('factType', factType);
    ensure('scope', scope);
    ensure('page', String(urlPage));
    ensure('size', String(PAGE_SIZE));
    if (rawQuery !== null && rawQuery !== appliedQuery) {
      ensure('page', '1');
    }

    if (changed) {
      setSearchParams(next, { replace: true });
    }
  }, [
    appliedQuery,
    factType,
    rawQuery,
    scope,
    searchParams,
    setSearchParams,
    urlPage,
  ]);

  useEffect(() => {
    setDraftQuery(appliedQuery);
  }, [appliedQuery]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const normalized = draftQuery.trim();
      if (normalized === appliedQuery) return;

      setSearchParams(current => {
        const next = new URLSearchParams(current);
        next.set('q', normalized);
        next.set('page', '1');
        next.set('size', String(PAGE_SIZE));
        return next;
      }, { replace: true });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [appliedQuery, draftQuery, setSearchParams]);

  const searchQuery = useQuery({
    ...searchCharacterFactsOptions({
      path: { workId },
      query: {
        q: appliedQuery,
        factType,
        scope,
        page: urlPage - 1,
        size: PAGE_SIZE,
      },
    }),
    enabled: enabled && Boolean(workId),
    retry: (failureCount, error) => shouldRetryQuery(failureCount, error, 2),
  });
  const detailQuery = useQuery({
    ...getCharacterFactOptions({
      path: { workId, characterFactId: selectedFactId ?? '' },
    }),
    enabled: enabled && Boolean(workId) && Boolean(selectedFactId),
    retry: (failureCount, error) => (
      toApiError(error)?.status !== 404
      && shouldRetryQuery(failureCount, error, 2)
    ),
  });

  const pageData = searchQuery.data?.data;
  const results = useMemo(() => pageData?.content ?? [], [pageData?.content]);
  const totalElements = pageData?.totalElements ?? 0;
  const totalPages = pageData?.totalPages ?? 0;
  const detail = detailQuery.data?.data;
  const detailNotFound = toApiError(detailQuery.error)?.status === 404;

  const setFilter = (key: 'factType' | 'scope', value: FactTypeFilter | ScopeFilter) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.set(key, value);
      next.set('page', '1');
      next.set('size', String(PAGE_SIZE));
      return next;
    });
  };

  const setPage = (apiPage: number) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.set('page', String(apiPage + 1));
      next.set('size', String(PAGE_SIZE));
      return next;
    });
  };

  const openDetail = (characterFactId: string | undefined) => {
    if (!characterFactId) return;
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.set('modal', 'fact-detail');
      next.set('factId', characterFactId);
      return next;
    });
  };

  const closeDetail = () => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.delete('modal');
      next.delete('factId');
      return next;
    });
  };

  const openCharacterDetail = () => {
    if (!detail?.characterId) return;
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.set('tab', 'characters');
      next.set('modal', 'char-detail');
      next.set('charId', detail.characterId as string);
      next.delete('factId');
      next.delete('mode');
      return next;
    });
  };

  return (
    <>
      <div
        className={`character-fact-search__field${focused ? ' is-focused' : ''}`}
        style={{
          height: 46,
          padding: '0 15px',
          marginBottom: 16,
          borderRadius: 9,
          border: `1px solid ${focused ? C.primary : C.border}`,
          background: C.surface,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transition: 'border-color 0.15s',
        }}
      >
        <Search size={17} color={focused ? C.primary : C.t3} />
        <input
          className="character-fact-search-input"
          aria-label="설정 검색"
          value={draftQuery}
          onChange={event => setDraftQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="설정명 또는 값 검색"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: C.t1,
            fontFamily: 'inherit',
            fontSize: 14,
          }}
        />
        {draftQuery && (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={() => setDraftQuery('')}
            style={{
              border: 'none',
              background: 'none',
              color: C.t3,
              cursor: 'pointer',
              lineHeight: 0,
              padding: 3,
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="character-fact-search__filters" style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        <div className="character-fact-search__filter-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="character-fact-search__filter-label" style={{ width: 70, color: C.t2, fontSize: 12, fontWeight: 650 }}>설정 유형</span>
          {FACT_TYPE_OPTIONS.map(option => (
            <Chip
              key={option.value}
              active={factType === option.value}
              onClick={() => setFilter('factType', option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
        <div className="character-fact-search__filter-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="character-fact-search__filter-label" style={{ width: 70, color: C.t2, fontSize: 12, fontWeight: 650 }}>설정 시점</span>
          {SCOPE_OPTIONS.map(option => (
            <Chip
              key={option.value}
              active={scope === option.value}
              onClick={() => setFilter('scope', option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </div>

      <div
        className="character-fact-search__summary"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          minHeight: 22,
        }}
      >
        <span aria-live="polite" style={{ color: C.t2, fontSize: 13, fontWeight: 600 }}>
          검색 결과 {totalElements}개
        </span>
        {totalPages > 0 && (
          <span style={{ color: C.t3, fontSize: 12 }}>
            {urlPage} / {totalPages} 페이지
          </span>
        )}
      </div>

      {!enabled && (
        <StatePanel kind="disabled" message="실제 작품을 선택하면 설정 검색을 사용할 수 있습니다." />
      )}
      {enabled && searchQuery.isPending && (
        <StatePanel kind="loading" message="설정 검색 결과를 불러오는 중입니다." />
      )}
      {enabled && searchQuery.isError && (
        <StatePanel
          kind="error"
          message={queryErrorMessage(searchQuery.error, '설정 검색 결과를 불러오지 못했습니다.')}
          onRetry={() => {
            void searchQuery.refetch();
          }}
        />
      )}
      {enabled && !searchQuery.isPending && !searchQuery.isError && results.length === 0 && (
        <StatePanel kind="empty" message="검색 결과가 없습니다" />
      )}
      {enabled && !searchQuery.isPending && !searchQuery.isError && results.length > 0 && (
        <>
          <div
            className="character-fact-results"
            data-testid="character-fact-results"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 12,
            }}
          >
            {results.map((result, index) => (
              <button
                className="character-fact-result-card"
                key={result.characterFactId ?? `${result.characterName}-${index}`}
                type="button"
                onClick={() => openDetail(result.characterFactId)}
                style={{
                  minHeight: 132,
                  padding: '16px 18px',
                  borderRadius: 9,
                  border: `1px solid ${C.border}`,
                  background: C.surface,
                  textAlign: 'left',
                  cursor: result.characterFactId ? 'pointer' : 'default',
                  fontFamily: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  color: C.t1,
                  transition: 'border-color 0.15s, transform 0.15s',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 5,
                    border: `1px solid ${factTypeColor(result.factType)}`,
                    background: factTypeColor(result.factType) + '16',
                    color: factTypeColor(result.factType),
                    fontSize: 11,
                    fontWeight: 650,
                  }}>
                    {result.factTypeLabel ?? result.factType ?? '설정'}
                  </span>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 10,
                    border: `1px solid ${contributesToCurrentSnapshot(result) ? C.success : C.warning}`,
                    color: contributesToCurrentSnapshot(result) ? C.success : C.warning,
                    fontSize: 10,
                    fontWeight: 650,
                  }}>
                    {contributesToCurrentSnapshot(result) ? '현재값 근거' : '그 외 이력'}
                  </span>
                  <ChevronRight size={16} color={C.t3} style={{ marginLeft: 'auto' }} />
                </span>
                <strong style={{
                  fontSize: 15,
                  lineHeight: 1.35,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                }}>
                  {result.displayName ?? '설정명 없음'}
                </strong>
                <span style={{
                  color: C.t2,
                  fontSize: 13,
                  lineHeight: 1.35,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                }}>
                  {result.factValue ?? '—'}
                </span>
                <span style={{ color: C.t2, fontSize: 12 }}>{sourceLabel(result)}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <PageNavigation
              page={urlPage - 1}
              totalPages={totalPages}
              disabled={searchQuery.isFetching}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {selectedFactId && (
        <motion.div
          className="fact-detail-modal-backdrop theme-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          data-testid="fact-detail-modal-backdrop"
          onClick={closeDetail}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 230,
            padding: '64px 20px',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.76)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          <motion.div
            className="fact-detail-modal theme-modal"
            role="dialog"
            aria-label="설정 상세"
            aria-modal="true"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={event => event.stopPropagation()}
            style={{
              width: 760,
              maxWidth: 'calc(100vw - 40px)',
              minHeight: 360,
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: C.surface,
              boxShadow: '0 24px 70px rgba(0,0,0,0.62)',
              overflow: 'hidden',
            }}
          >
            <div className="fact-detail-header theme-modal__header" style={{
              minHeight: 72,
              padding: '0 28px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <strong style={{ color: C.t1, fontSize: 20 }}>
                {detail?.factTypeLabel ?? '설정 상세'}
              </strong>
              {detail && (
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 12,
                  border: `1px solid ${contributesToCurrentSnapshot(detail) ? C.success : C.warning}`,
                  color: contributesToCurrentSnapshot(detail) ? C.success : C.warning,
                  fontSize: 11,
                  fontWeight: 650,
                }}>
                  {contributesToCurrentSnapshot(detail) ? '현재값 근거' : '그 외 이력'}
                </span>
              )}
              <button
                type="button"
                aria-label="설정 상세 닫기"
                onClick={closeDetail}
                style={{
                  width: 34,
                  height: 34,
                  marginLeft: 'auto',
                  borderRadius: 7,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.t2,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {detailQuery.isPending && (
              <div style={{ minHeight: 330, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.t2, fontSize: 13 }}>
                <Loader2 size={20} className="spin" color={C.primary} /> 설정 정보를 불러오는 중입니다.
              </div>
            )}

            {detailQuery.isError && (
              <div role="alert" style={{ minHeight: 330, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <AlertCircle size={28} color={C.danger} />
                <span style={{ color: C.t2, fontSize: 13 }}>
                  {detailNotFound
                    ? '설정 정보를 찾을 수 없습니다.'
                    : queryErrorMessage(detailQuery.error, '설정 정보를 불러오지 못했습니다.')}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!detailNotFound && (
                    <button
                      type="button"
                      onClick={() => {
                        void detailQuery.refetch();
                      }}
                      style={{
                        height: 34,
                        padding: '0 14px',
                        borderRadius: 6,
                        border: `1px solid ${C.border}`,
                        background: C.bg,
                        color: C.t2,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      다시 시도
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeDetail}
                    style={{
                      height: 34,
                      padding: '0 14px',
                      borderRadius: 6,
                      border: `1px solid ${C.border}`,
                      background: C.bg,
                      color: C.t2,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}

            {detail && !detailQuery.isPending && !detailQuery.isError && (
              <div className="fact-detail-content theme-modal__body" style={{ padding: '24px 28px 28px', display: 'grid', gap: 18 }}>
                <section style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <div style={{ color: C.t2, fontSize: 12, fontWeight: 650, marginBottom: 8 }}>설정명</div>
                    <div style={{
                      padding: '14px 18px',
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      background: C.bg,
                      color: C.t1,
                      fontSize: 15,
                      fontWeight: 700,
                    }}>
                      {detail.displayName ?? '설정명 없음'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: C.t2, fontSize: 12, fontWeight: 650, marginBottom: 8 }}>설정값</div>
                    <div style={{
                      padding: '16px 18px',
                      borderRadius: 8,
                      border: `1px solid ${C.border}`,
                      background: C.bg,
                      color: C.t1,
                      fontSize: 17,
                      fontWeight: 700,
                    }}>
                      {detail.factValue ?? '—'}
                    </div>
                  </div>
                </section>

                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', background: C.bg }}>
                  <div style={{
                    minHeight: 52,
                    padding: '0 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}>
                    <span style={{ color: C.t2, fontSize: 12 }}>적용 시작 회차</span>
                    <strong style={{ color: C.t1, fontSize: 13, textAlign: 'right' }}>
                      {detail.effectiveFromEpisodeNo == null
                        ? '적용 회차 정보 없음'
                        : `${detail.effectiveFromEpisodeNo}화부터 적용`}
                    </strong>
                  </div>
                </div>

                <div className="fact-detail-owner" style={{
                  minHeight: 66,
                  padding: '0 16px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  background: C.bg,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: C.t3, fontSize: 11, marginBottom: 4 }}>소유 캐릭터</div>
                    <strong style={{ color: C.t1, fontSize: 14 }}>{detail.characterName ?? '—'}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={openCharacterDetail}
                    disabled={!detail.characterId}
                    style={{
                      height: 36,
                      padding: '0 14px',
                      borderRadius: 7,
                      border: `1px solid ${C.border}`,
                      background: C.surface,
                      color: C.t2,
                      cursor: detail.characterId ? 'pointer' : 'default',
                      fontFamily: 'inherit',
                      fontSize: 12,
                    }}
                  >
                    캐릭터 상세 보기
                  </button>
                </div>

                <section>
                  <div style={{ color: C.t1, fontSize: 13, fontWeight: 650, marginBottom: 10 }}>
                    {detail.sourceEpisodeNo == null
                      ? '출처 회차 없음'
                      : `${detail.sourceEpisodeNo}화에서 확인된 문장`}
                  </div>
                  {(detail.evidenceQuotes ?? []).length > 0 ? (
                    <div style={{ display: 'grid', gap: 9 }}>
                      {(detail.evidenceQuotes ?? []).map((quote, index) => (
                        <blockquote
                          className="theme-evidence__quote"
                          key={`${quote}-${index}`}
                          style={{
                            margin: 0,
                            padding: '14px 16px',
                            borderLeft: `3px solid ${C.primary}`,
                            borderRadius: 7,
                            background: C.bg,
                            color: C.t2,
                            fontSize: 13,
                            lineHeight: 1.6,
                          }}
                        >
                          “{quote}”
                        </blockquote>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="theme-evidence theme-evidence__empty"
                      role="status"
                      style={{
                        padding: '14px 16px',
                        borderRadius: 7,
                        border: `1px solid ${C.border}`,
                        background: C.bg,
                        color: C.t2,
                        fontSize: 13,
                      }}
                    >
                      저장된 원문 근거가 없습니다.
                    </div>
                  )}
                </section>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
