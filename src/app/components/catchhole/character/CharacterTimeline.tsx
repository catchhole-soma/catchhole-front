import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router';
import {
  getCharacterFactEvidenceOptions,
  getCharactersOptions,
  getCharacterTimelineInfiniteQueryKey,
  getCharacterTimelineSummaryOptions,
} from '../../../api/generated/@tanstack/react-query.gen';
import { getCharacterTimeline } from '../../../api/generated/sdk.gen';
import type {
  CharacterDetailResponse,
  CharacterSummaryResponse,
  CharacterTimelineFactResponse,
} from '../../../api/generated/types.gen';
import { useResponsiveGridPagination } from '../../../hooks/useResponsiveGridPagination';
import { toApiError } from '../../../lib/api-errors';
import { shouldRetryQuery } from '../../../lib/query-client';
import { C } from '../constants';
import { PageNavigation } from '../PageNavigation';
import { CharacterEvidencePanel } from './CharacterEvidencePanel';
import './character-timeline.css';

type TimelineFactFilter = 'ALL' | 'PROFILE' | 'AGE' | 'LEVEL' | 'STAT' | 'SKILL' | 'ITEM' | 'STATUS';

interface Props {
  workId: string;
  demoMode: boolean;
  demoCharacters: CharacterDetailResponse[];
  onAnalyze: () => void;
}

interface TimelineModalProps {
  workId: string;
  characterId: string;
  factType: TimelineFactFilter;
  fromEpisodeNo: number | null;
  selectedFactId: string | null;
  demoMode: boolean;
  onFactTypeChange: (factType: TimelineFactFilter) => void;
  onEpisodeChange: (episodeNo: number | null) => void;
  onEvidenceOpen: (factId: string) => void;
  onEvidenceClose: () => void;
  onClose: () => void;
}

const TIMELINE_CARD_HEIGHT = 64;
const TIMELINE_GRID_GAP = 14;
const TIMELINE_PAGE_SIZE = 20;
const FACT_FILTERS: TimelineFactFilter[] = [
  'ALL', 'PROFILE', 'AGE', 'LEVEL', 'STAT', 'SKILL', 'ITEM', 'STATUS',
];
const FACT_FILTER_LABELS: Record<TimelineFactFilter, string> = {
  ALL: '전체',
  PROFILE: '프로필',
  AGE: '나이',
  LEVEL: '레벨',
  STAT: '스탯',
  SKILL: '스킬',
  ITEM: '아이템',
  STATUS: '상태',
};
const FACT_COLORS: Record<Exclude<TimelineFactFilter, 'ALL'>, string> = {
  PROFILE: '#8B6DFF',
  AGE: '#F4A261',
  LEVEL: '#E879B9',
  STAT: '#4BB8D9',
  SKILL: '#7655E8',
  ITEM: '#D4A04A',
  STATUS: '#E25C5C',
};

function positiveInteger(value: string | null): number | null {
  if (value == null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

function timelineFilter(value: string | null): TimelineFactFilter {
  return FACT_FILTERS.includes(value as TimelineFactFilter)
    ? value as TimelineFactFilter
    : 'ALL';
}

function queryErrorMessage(error: unknown, fallback: string): string {
  return toApiError(error)?.message ?? fallback;
}

function avatarColor(id: string): string {
  const palette = [C.primary, '#E25C5C', '#4BB8D9', C.success, '#D4A04A', '#B48BFF'];
  const index = [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

function TimelineCharacterCard({
  character,
  onClick,
}: {
  character: CharacterSummaryResponse;
  onClick: () => void;
}) {
  const id = character.id ?? character.name ?? 'character';
  const name = character.name?.trim() || '이름 없음';
  const color = avatarColor(id);
  return (
    <button type="button" className="character-timeline-card" onClick={onClick}>
      <span className="character-timeline-card__avatar" style={{ color, borderColor: `${color}66`, background: `${color}18` }}>
        {name.slice(0, 1)}
      </span>
      <span className="character-timeline-card__copy">
        <strong>{name}</strong>
        <small>첫 등장 {character.firstAppearanceEpisodeNo == null ? '—' : `${character.firstAppearanceEpisodeNo}화`}</small>
      </span>
      <ChevronRight size={15} aria-hidden="true" />
    </button>
  );
}

function TimelineModal({
  workId,
  characterId,
  factType,
  fromEpisodeNo,
  selectedFactId,
  demoMode,
  onFactTypeChange,
  onEpisodeChange,
  onEvidenceOpen,
  onEvidenceClose,
  onClose,
}: TimelineModalProps) {
  const queryClient = useQueryClient();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [shortcutRangeIndex, setShortcutRangeIndex] = useState(0);
  const [shortcutOpen, setShortcutOpen] = useState(false);

  const summaryQuery = useQuery({
    ...getCharacterTimelineSummaryOptions({
      path: { workId, characterId },
      query: { factType },
    }),
    enabled: !demoMode && Boolean(workId) && Boolean(characterId),
    retry: (failureCount, error) => (
      toApiError(error)?.status !== 404 && shouldRetryQuery(failureCount, error, 3)
    ),
  });

  const timelineOptions = {
    path: { workId, characterId },
    query: {
      factType,
      ...(fromEpisodeNo == null ? {} : { fromEpisodeNo }),
      size: TIMELINE_PAGE_SIZE,
    },
  } as const;
  const timelineQueryKey = getCharacterTimelineInfiniteQueryKey(timelineOptions);
  const timelineQuery = useInfiniteQuery({
    queryKey: timelineQueryKey,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await getCharacterTimeline({
        path: { workId, characterId },
        query: {
          factType,
          size: TIMELINE_PAGE_SIZE,
          ...(pageParam == null
            ? fromEpisodeNo == null ? {} : { fromEpisodeNo }
            : { cursor: pageParam }),
        },
        signal,
        throwOnError: true,
      });
      return data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: lastPage => (
      lastPage.data?.hasNext && lastPage.data.nextCursor
        ? lastPage.data.nextCursor
        : undefined
    ),
    enabled: !demoMode && Boolean(workId) && Boolean(characterId),
    retry: (failureCount, error) => (
      toApiError(error)?.status !== 400
      && toApiError(error)?.status !== 404
      && shouldRetryQuery(failureCount, error, 3)
    ),
  });

  const evidenceQuery = useQuery({
    ...getCharacterFactEvidenceOptions({
      path: { workId, characterFactId: selectedFactId ?? '' },
    }),
    enabled: !demoMode && Boolean(workId) && Boolean(selectedFactId),
    retry: (failureCount, error) => (
      toApiError(error)?.status !== 404 && shouldRetryQuery(failureCount, error, 3)
    ),
  });

  const summary = summaryQuery.data?.data;
  const facts = useMemo(() => {
    const seen = new Set<string>();
    return (timelineQuery.data?.pages ?? [])
      .flatMap(page => page.data?.content ?? [])
      .filter(fact => {
        if (!fact.characterFactId || seen.has(fact.characterFactId)) return false;
        seen.add(fact.characterFactId);
        return true;
      });
  }, [timelineQuery.data?.pages]);
  const selectedFact = facts.find(fact => fact.characterFactId === selectedFactId) ?? null;
  const fetchNextPage = timelineQuery.fetchNextPage;
  const hasNextPage = timelineQuery.hasNextPage;
  const isFetchingNextPage = timelineQuery.isFetchingNextPage;
  const isFetchNextPageError = timelineQuery.isFetchNextPageError;

  const groups = useMemo(() => {
    const result: Array<{ key: string; episodeNo: number | null; facts: CharacterTimelineFactResponse[] }> = [];
    facts.forEach(fact => {
      const episodeNo = fact.sourceType === 'MANUAL' ? null : fact.sourceEpisodeNo ?? null;
      const key = episodeNo == null ? 'manual' : `episode-${episodeNo}`;
      const lastGroup = result[result.length - 1];
      if (lastGroup?.key === key) lastGroup.facts.push(fact);
      else result.push({ key, episodeNo, facts: [fact] });
    });
    return result;
  }, [facts]);

  const episodeRanges = useMemo(() => {
    const rangeStarts = new Set<number>();
    (summary?.episodes ?? []).forEach(episode => {
      if (episode.episodeNo != null) rangeStarts.add(Math.floor((episode.episodeNo - 1) / 10) * 10 + 1);
    });
    return [...rangeStarts].sort((left, right) => left - right);
  }, [summary?.episodes]);
  const activeRangeStart = episodeRanges[shortcutRangeIndex] ?? null;
  const activeRangeEpisodes = (summary?.episodes ?? []).filter(episode => (
    activeRangeStart != null
    && episode.episodeNo != null
    && episode.episodeNo >= activeRangeStart
    && episode.episodeNo < activeRangeStart + 10
  ));

  useEffect(() => {
    if (episodeRanges.length === 0) {
      setShortcutRangeIndex(0);
      return;
    }
    const selectedRangeStart = fromEpisodeNo == null
      ? null
      : Math.floor((fromEpisodeNo - 1) / 10) * 10 + 1;
    const selectedIndex = selectedRangeStart == null ? -1 : episodeRanges.indexOf(selectedRangeStart);
    setShortcutRangeIndex(current => (
      selectedIndex >= 0 ? selectedIndex : Math.min(current, episodeRanges.length - 1)
    ));
  }, [episodeRanges, fromEpisodeNo]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasNextPage || isFetchNextPageError) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) {
        void fetchNextPage();
      }
    }, { rootMargin: '160px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (selectedFactId) onEvidenceClose();
      else onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onEvidenceClose, selectedFactId]);

  const initialError = !demoMode && (summaryQuery.isError || timelineQuery.isLoadingError);
  const emptyMessage = factType === 'ALL'
    ? '아직 확정된 설정 이력이 없습니다.'
    : '선택한 유형의 설정 이력이 없습니다.';

  return (
    <motion.div
      className="character-timeline-backdrop"
      data-testid="character-timeline-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label="캐릭터 설정 이력"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`character-timeline-modal${selectedFactId ? ' character-timeline-modal--with-evidence' : ''}${shortcutOpen ? ' character-timeline-modal--shortcut-open' : ''}`}
        onClick={event => event.stopPropagation()}
      >
        <header className="character-timeline-modal__header">
          <span className="character-timeline-modal__icon"><Clock3 size={19} /></span>
          <div className="character-timeline-modal__title">
            <strong>{summary?.characterName ?? '캐릭터 타임라인'}</strong>
            <span>
              첫 등장 {summary?.firstAppearanceEpisodeNo == null ? '—' : `${summary.firstAppearanceEpisodeNo}화`}
              {' · '}{summary?.totalFactCount ?? 0}개 설정
              {' · '}{summary?.totalEpisodeCount ?? 0}개 회차
            </span>
          </div>
          <button type="button" className="timeline-shortcut-toggle" onClick={() => setShortcutOpen(value => !value)}>
            회차 바로가기
          </button>
          <button type="button" className="timeline-icon-button" aria-label="타임라인 닫기" onClick={onClose}>
            <X size={19} />
          </button>
        </header>

        <div className="character-timeline-filters" aria-label="설정 유형 필터">
          {FACT_FILTERS.map(filter => {
            const count = filter === 'ALL'
              ? summary?.totalFactCount ?? 0
              : summary?.factTypeCounts?.find(item => item.factType === filter)?.count ?? 0;
            return (
              <button
                type="button"
                key={filter}
                className={factType === filter ? 'is-active' : undefined}
                onClick={() => onFactTypeChange(filter)}
              >
                {FACT_FILTER_LABELS[filter]} <span>{count}</span>
              </button>
            );
          })}
        </div>

        {demoMode ? (
          <div className="character-timeline-state">
            <Clock3 size={28} />
            <strong>데모 캐릭터에는 확정 이력이 없습니다.</strong>
            <span>실제 작품에서 설정 후보를 확정하면 회차별 타임라인을 확인할 수 있습니다.</span>
          </div>
        ) : initialError ? (
          <div className="character-timeline-state" role="alert">
            <AlertCircle size={28} color={C.danger} />
            <strong>{queryErrorMessage(summaryQuery.error ?? timelineQuery.error, '타임라인을 불러오지 못했습니다.')}</strong>
            <button type="button" className="timeline-secondary-button" onClick={() => {
              void summaryQuery.refetch();
              void timelineQuery.refetch();
            }}><RefreshCw size={13} /> 다시 시도</button>
          </div>
        ) : (summaryQuery.isPending || timelineQuery.isPending) ? (
          <div className="character-timeline-state"><Loader2 className="spin" size={22} /> 타임라인을 불러오는 중입니다.</div>
        ) : (
          <div className="character-timeline-layout">
            <aside className="character-timeline-shortcuts" aria-label="회차 바로가기">
              <div className="character-timeline-shortcuts__head">
                <strong>회차 바로가기</strong>
                <button type="button" aria-label="회차 바로가기 닫기" onClick={() => setShortcutOpen(false)}><X size={15} /></button>
              </div>
              {episodeRanges.length > 0 ? (
                <>
                  <label className="character-timeline-episode-select">
                    <span className="sr-only">회차 선택</span>
                    <select
                      value={fromEpisodeNo ?? ''}
                      onChange={event => onEpisodeChange(event.target.value ? Number(event.target.value) : null)}
                    >
                      <option value="">첫 회차부터</option>
                      {(summary?.episodes ?? []).map(episode => (
                        <option key={episode.episodeId} value={episode.episodeNo}>{episode.episodeNo}화</option>
                      ))}
                    </select>
                  </label>
                  <div className="character-timeline-range-nav">
                    <button type="button" aria-label="이전 회차 범위" disabled={shortcutRangeIndex === 0} onClick={() => setShortcutRangeIndex(index => index - 1)}><ChevronLeft size={15} /></button>
                    <span>{activeRangeStart}–{(activeRangeStart ?? 1) + 9}화</span>
                    <button type="button" aria-label="다음 회차 범위" disabled={shortcutRangeIndex >= episodeRanges.length - 1} onClick={() => setShortcutRangeIndex(index => index + 1)}><ChevronRight size={15} /></button>
                  </div>
                  <div className="character-timeline-episode-list">
                    {activeRangeEpisodes.map(episode => (
                      <button
                        type="button"
                        key={episode.episodeId}
                        className={fromEpisodeNo === episode.episodeNo ? 'is-active' : undefined}
                        onClick={() => {
                          onEpisodeChange(episode.episodeNo ?? null);
                          setShortcutOpen(false);
                        }}
                      >
                        <span>{episode.episodeNo}화</span><small>{episode.factCount}개</small>
                      </button>
                    ))}
                  </div>
                  {fromEpisodeNo != null && (
                    <button type="button" className="character-timeline-reset" onClick={() => onEpisodeChange(null)}>첫 회차부터 보기</button>
                  )}
                  {(summary?.manualFactCount ?? 0) > 0 && <small className="character-timeline-manual-count">사용자 입력 {summary?.manualFactCount}개</small>}
                </>
              ) : <p>회차 출처가 있는 설정이 없습니다.</p>}
            </aside>

            <main className="character-timeline-feed" aria-live="polite">
              {facts.length === 0 ? (
                <div className="character-timeline-empty">{emptyMessage}</div>
              ) : groups.map(group => (
                <section key={group.key} className="character-timeline-group">
                  <header><strong>{group.episodeNo == null ? '사용자 입력' : `${group.episodeNo}화`}</strong><span>{group.facts.length}개</span></header>
                  <div className="character-timeline-group__facts">
                    {group.facts.map(fact => {
                      const filter = fact.factType as Exclude<TimelineFactFilter, 'ALL'>;
                      const color = FACT_COLORS[filter] ?? C.primary;
                      const selected = fact.characterFactId === selectedFactId;
                      return (
                        <article key={fact.characterFactId} className={`character-timeline-fact${selected ? ' is-selected' : ''}`} style={{ '--fact-color': color } as React.CSSProperties}>
                          <span className="character-timeline-fact__bar" />
                          <div className="character-timeline-fact__copy">
                            <span>{fact.factTypeLabel ?? FACT_FILTER_LABELS[filter] ?? fact.factType}</span>
                            <strong>{fact.displayName ?? '설정명 없음'}</strong>
                            <p>{fact.factValue || '—'}</p>
                          </div>
                          <button
                            type="button"
                            className="timeline-evidence-button"
                            disabled={!fact.hasEvidence || !fact.characterFactId}
                            title={fact.hasEvidence ? '원문 근거 보기' : '저장된 원문 근거가 없습니다.'}
                            onClick={() => fact.characterFactId && onEvidenceOpen(fact.characterFactId)}
                          >
                            <FileText size={13} /> 근거
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}

              {timelineQuery.isFetchNextPageError && (
                <div className="character-timeline-load-error" role="alert">
                  다음 설정을 불러오지 못했습니다.
                  {toApiError(timelineQuery.error)?.status === 400 ? (
                    <button
                      type="button"
                      onClick={() => void queryClient.resetQueries({ queryKey: timelineQueryKey, exact: true })}
                    >
                      <RefreshCw size={12} /> 처음부터 다시 불러오기
                    </button>
                  ) : (
                    <button type="button" onClick={() => timelineQuery.fetchNextPage()}><RefreshCw size={12} /> 다시 시도</button>
                  )}
                </div>
              )}
              <div ref={loadMoreRef} className="character-timeline-load-more">
                {timelineQuery.isFetchingNextPage && <><Loader2 className="spin" size={15} /> 다음 설정을 불러오는 중입니다.</>}
                {!timelineQuery.hasNextPage && facts.length > 0 && <span>모든 설정 이력을 확인했습니다.</span>}
                {timelineQuery.hasNextPage && !timelineQuery.isFetchingNextPage && (
                  <button type="button" onClick={() => timelineQuery.fetchNextPage()}>더 불러오기</button>
                )}
              </div>
            </main>

            {selectedFactId && (
              <div className="character-timeline-evidence">
                <CharacterEvidencePanel
                  evidence={evidenceQuery.data?.data ?? null}
                  loading={evidenceQuery.isPending}
                  error={evidenceQuery.isError
                    ? queryErrorMessage(evidenceQuery.error, '원문 근거를 불러오지 못했습니다.')
                    : null}
                  context={selectedFact ? {
                    factTypeLabel: selectedFact.factTypeLabel ?? selectedFact.factType ?? '설정',
                    displayName: selectedFact.displayName ?? '설정명 없음',
                    factValue: selectedFact.factValue ?? null,
                  } : undefined}
                  onRetry={() => evidenceQuery.refetch()}
                  onClose={onEvidenceClose}
                />
              </div>
            )}
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}

export function CharacterTimeline({ workId, demoMode, demoCharacters, onAnalyze }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const previousPageSizeRef = useRef<number | null>(null);
  const {
    containerRef,
    contentStartRef,
    columnCount,
    pageSize,
    ready: layoutReady,
  } = useResponsiveGridPagination({
    minItemWidth: 220,
    itemHeight: TIMELINE_CARD_HEIGHT,
    gap: TIMELINE_GRID_GAP,
    maxColumns: 4,
    maxPageSize: 24,
    reservedBottomSpace: 72,
    mobilePageSize: 8,
  });
  const requestedPage = positiveInteger(searchParams.get('timelinePage')) ?? 1;
  const page = requestedPage - 1;
  const selectedCharacterId = searchParams.get('modal') === 'character-timeline'
    ? searchParams.get('charId')
    : null;
  const factType = timelineFilter(searchParams.get('timelineFactType'));
  const fromEpisodeNo = positiveInteger(searchParams.get('timelineEpisodeNo'));
  const selectedFactId = selectedCharacterId ? searchParams.get('factId') : null;

  const charactersQuery = useQuery({
    ...getCharactersOptions({ path: { workId }, query: { page, size: pageSize } }),
    enabled: !demoMode && Boolean(workId) && layoutReady,
  });
  const demoPage = useMemo(() => {
    const start = page * pageSize;
    return demoCharacters.slice(start, start + pageSize).map(character => ({
      id: character.id,
      name: character.name,
      firstAppearanceEpisodeNo: character.firstAppearanceEpisode?.episodeNo,
    } satisfies CharacterSummaryResponse));
  }, [demoCharacters, page, pageSize]);
  const characters = demoMode ? demoPage : charactersQuery.data?.data?.content ?? [];
  const totalPages = demoMode
    ? Math.ceil(demoCharacters.length / pageSize)
    : charactersQuery.data?.data?.totalPages ?? 0;

  useEffect(() => {
    if (!layoutReady) return;
    const previousPageSize = previousPageSizeRef.current;
    previousPageSizeRef.current = pageSize;
    if (previousPageSize == null || previousPageSize === pageSize) return;

    // 화면에 보이던 첫 캐릭터의 절대 순번을 새 페이지 크기에도 포함한다.
    const firstVisibleIndex = page * previousPageSize;
    const resizedPage = Math.floor(firstVisibleIndex / pageSize);
    if (resizedPage === page) return;
    setSearchParams(previous => {
      previous.set('timelinePage', String(resizedPage + 1));
      return previous;
    }, { replace: true });
  }, [layoutReady, page, pageSize, setSearchParams]);

  useEffect(() => {
    if (!layoutReady || totalPages === 0 || page < totalPages) return;
    setSearchParams(previous => {
      previous.set('timelinePage', String(totalPages));
      return previous;
    }, { replace: true });
  }, [layoutReady, page, setSearchParams, totalPages]);

  const updateTimelineParams = (update: (params: URLSearchParams) => void, replace = false) => {
    setSearchParams(previous => {
      update(previous);
      return previous;
    }, { replace });
  };
  const closeModal = () => updateTimelineParams(params => {
    params.delete('modal');
    params.delete('charId');
    params.delete('timelineFactType');
    params.delete('timelineEpisodeNo');
    params.delete('factId');
  });

  const loading = !demoMode && (!layoutReady || charactersQuery.isPending);
  const error = !demoMode && charactersQuery.isError;

  return (
    <>
      <div ref={containerRef} className="character-timeline-page">
        <header className="character-timeline-page__header">
          <div>
            <h2>캐릭터 타임라인</h2>
            <p>캐릭터를 선택해 회차별로 축적된 설정 이력을 확인할 수 있습니다.</p>
          </div>
        </header>
        <div ref={contentStartRef} />

        {loading && <div className="character-timeline-list-state"><Loader2 className="spin" size={18} /> 캐릭터 목록을 불러오는 중입니다.</div>}
        {error && (
          <div className="character-timeline-list-state" role="alert">
            <AlertCircle size={24} color={C.danger} />
            <span>{queryErrorMessage(charactersQuery.error, '캐릭터 목록을 불러오지 못했습니다.')}</span>
            <button type="button" className="timeline-secondary-button" onClick={() => charactersQuery.refetch()}><RefreshCw size={13} /> 다시 시도</button>
          </div>
        )}
        {!loading && !error && characters.length === 0 && (
          <div className="character-timeline-list-state">
            <span className="character-timeline-empty-icon"><Users size={26} /></span>
            <strong>등록된 캐릭터가 없습니다</strong>
            <span>원고를 분석하여 캐릭터를 추출해 보세요!</span>
            <button type="button" className="timeline-primary-button" onClick={onAnalyze}><Upload size={13} /> 원고 분석하기</button>
          </div>
        )}
        {!loading && !error && characters.length > 0 && (
          <>
            <div className="character-timeline-card-grid" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
              {characters.map(character => (
                <TimelineCharacterCard
                  key={character.id}
                  character={character}
                  onClick={() => character.id && updateTimelineParams(params => {
                    params.set('modal', 'character-timeline');
                    params.set('charId', character.id!);
                    params.set('timelineFactType', 'ALL');
                    params.delete('timelineEpisodeNo');
                    params.delete('factId');
                  })}
                />
              ))}
            </div>
            <div className="character-timeline-pagination">
              <PageNavigation
                page={page}
                totalPages={totalPages}
                disabled={!demoMode && charactersQuery.isFetching}
                onPageChange={nextPage => updateTimelineParams(params => params.set('timelinePage', String(nextPage + 1)))}
              />
            </div>
          </>
        )}
      </div>

      {selectedCharacterId && (
        <TimelineModal
          workId={workId}
          characterId={selectedCharacterId}
          factType={factType}
          fromEpisodeNo={fromEpisodeNo}
          selectedFactId={selectedFactId}
          demoMode={demoMode}
          onFactTypeChange={nextFactType => updateTimelineParams(params => {
            params.set('timelineFactType', nextFactType);
            params.delete('timelineEpisodeNo');
            params.delete('factId');
          })}
          onEpisodeChange={episodeNo => updateTimelineParams(params => {
            if (episodeNo == null) params.delete('timelineEpisodeNo');
            else params.set('timelineEpisodeNo', String(episodeNo));
            params.delete('factId');
          })}
          onEvidenceOpen={factId => updateTimelineParams(params => params.set('factId', factId), selectedFactId != null)}
          onEvidenceClose={() => updateTimelineParams(params => params.delete('factId'), true)}
          onClose={closeModal}
        />
      )}
    </>
  );
}
