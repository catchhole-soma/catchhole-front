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
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router';
import {
  getCharacterFactEvidenceOptions,
  getCharacterTimelineInfiniteQueryKey,
  getCharacterTimelineSummaryOptions,
} from '../../../api/generated/@tanstack/react-query.gen';
import { getCharacterTimeline } from '../../../api/generated/sdk.gen';
import type {
  CharacterTimelineFactResponse,
  GetCharacterTimelineData,
  GetCharacterTimelineSummaryData,
} from '../../../api/generated/types.gen';
import { toApiError } from '../../../lib/api-errors';
import { shouldRetryQuery } from '../../../lib/query-client';
import { C } from '../constants';
import { CharacterEvidencePanel } from './CharacterEvidencePanel';
import {
  EMPTY_TIMELINE_SELECTION,
  hasTimelineSelection,
  readTimelineSelection,
  TIMELINE_FACT_TYPES,
  writeTimelineSelection,
  type TimelineFactType,
  type TimelineSelection,
} from './character-timeline-filter';
import './character-timeline.css';

type TimelineFactFilter = 'ALL' | TimelineFactType;
type TimelineViewMode = 'types' | 'all';

interface CharacterTimelineModalProps {
  workId: string;
  characterId: string;
  demoMode: boolean;
  onClose: () => void;
}

interface TimelineModalProps {
  workId: string;
  characterId: string;
  viewMode: TimelineViewMode;
  selection: TimelineSelection;
  factType: TimelineFactFilter;
  fromEpisodeNo: number | null;
  selectedFactId: string | null;
  demoMode: boolean;
  onViewModeChange: (viewMode: TimelineViewMode) => void;
  onSelectionApply: (selection: TimelineSelection) => void;
  onFactTypeChange: (factType: TimelineFactFilter) => void;
  onEpisodeChange: (episodeNo: number | null) => void;
  onEvidenceOpen: (factId: string) => void;
  onEvidenceClose: () => void;
  onClose: () => void;
}

const TIMELINE_PAGE_SIZE = 20;
const FACT_FILTERS: TimelineFactFilter[] = [
  'ALL', ...TIMELINE_FACT_TYPES,
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

function TimelineModal({
  workId,
  characterId,
  viewMode,
  selection,
  factType,
  fromEpisodeNo,
  selectedFactId,
  demoMode,
  onViewModeChange,
  onSelectionApply,
  onFactTypeChange,
  onEpisodeChange,
  onEvidenceOpen,
  onEvidenceClose,
  onClose,
}: TimelineModalProps) {
  const queryClient = useQueryClient();
  const feedRef = useRef<HTMLElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [shortcutRangeIndex, setShortcutRangeIndex] = useState(0);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const selectionApplied = hasTimelineSelection(selection);

  useEffect(() => {
    setShortcutOpen(false);
  }, [characterId, selectionApplied, viewMode]);

  const multiFilterQuery = useMemo(() => ({
    ...(selection.factTypes.length > 0 ? { factTypes: selection.factTypes } : {}),
    ...(selection.factKeys.length > 0 ? { factKeys: selection.factKeys } : {}),
  }), [selection.factKeys, selection.factTypes]);
  const summaryFilterQuery: NonNullable<GetCharacterTimelineSummaryData['query']> = viewMode === 'types'
    ? selectionApplied ? multiFilterQuery : { factType: 'ALL' }
    : { factType };
  const timelineFilterQuery: NonNullable<GetCharacterTimelineData['query']> = viewMode === 'types'
    ? multiFilterQuery
    : { factType };
  const timelineEnabled = viewMode === 'all' || selectionApplied;
  const feedResetKey = [
    viewMode,
    factType,
    fromEpisodeNo ?? '',
    selection.factTypes.join('\u0000'),
    selection.factKeys.join('\u0000'),
  ].join('\u0001');

  const summaryQuery = useQuery({
    ...getCharacterTimelineSummaryOptions({
      path: { workId, characterId },
      query: summaryFilterQuery,
    }),
    enabled: !demoMode && Boolean(workId) && Boolean(characterId),
    retry: (failureCount, error) => (
      toApiError(error)?.status !== 404 && shouldRetryQuery(failureCount, error, 3)
    ),
  });

  const timelineOptions = {
    path: { workId, characterId },
    query: {
      ...timelineFilterQuery,
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
          ...timelineFilterQuery,
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
    enabled: !demoMode && Boolean(workId) && Boolean(characterId) && timelineEnabled,
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
  const selectionItems = useMemo(() => {
    const facets = summary?.factFacets ?? [];
    const parentItems = selection.factTypes.map(type => {
      const facet = facets.find(item => item.factType === type);
      return {
        id: `type:${type}`,
        label: `${facet?.factTypeLabel ?? FACT_FILTER_LABELS[type]} 전체 이력`,
        selection: {
          factTypes: selection.factTypes.filter(selectedType => selectedType !== type),
          factKeys: selection.factKeys,
        } satisfies TimelineSelection,
      };
    });
    const childItems = selection.factKeys.map(factKey => {
      const item = facets.flatMap(facet => facet.factKeys ?? [])
        .find(factKeyCount => factKeyCount.factKey === factKey);
      return {
        id: `key:${factKey}`,
        label: item?.displayName ?? factKey,
        selection: {
          factTypes: selection.factTypes,
          factKeys: selection.factKeys.filter(selectedKey => selectedKey !== factKey),
        } satisfies TimelineSelection,
      };
    });
    return [...parentItems, ...childItems];
  }, [selection.factKeys, selection.factTypes, summary?.factFacets]);
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
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, [feedResetKey]);

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

  const initialError = !demoMode && (
    summaryQuery.isError
    || (timelineEnabled && timelineQuery.isLoadingError)
  );
  const initialLoading = summaryQuery.isPending
    || (timelineEnabled && timelineQuery.isPending);
  const emptyMessage = viewMode === 'all' && factType === 'ALL'
    ? '아직 확정된 설정 이력이 없습니다.'
    : '선택한 종류의 설정 이력이 없습니다.';

  return (
    <motion.div
      className={`character-timeline-backdrop${selectedFactId ? ' character-timeline-backdrop--with-evidence' : ''}`}
      data-testid="character-timeline-backdrop"
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
    >
      <motion.section
        role="dialog"
        aria-label="캐릭터 설정 이력"
        className={`character-timeline-modal${selectedFactId ? ' character-timeline-modal--with-evidence' : ''}${shortcutOpen ? ' character-timeline-modal--shortcut-open' : ''}`}
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
          {timelineEnabled && (
            <button type="button" className="timeline-shortcut-toggle" onClick={() => setShortcutOpen(value => !value)}>
              회차 바로가기
            </button>
          )}
          <button type="button" className="timeline-icon-button" aria-label="타임라인 닫기" onClick={onClose}>
            <X size={19} />
          </button>
        </header>

        <div className="character-timeline-view-tabs" aria-label="타임라인 보기 방식">
          <button
            type="button"
            className={viewMode === 'types' ? 'is-active' : undefined}
            onClick={() => onViewModeChange('types')}
          >
            종류별 보기
          </button>
          <button
            type="button"
            className={viewMode === 'all' ? 'is-active' : undefined}
            onClick={() => onViewModeChange('all')}
          >
            전체 보기
          </button>
        </div>

        {viewMode === 'all' && (
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
        )}

        {viewMode === 'types' && selectionApplied && (
          <div className="character-timeline-applied-filters">
            <div>
              {selectionItems.map(item => (
                <button
                  type="button"
                  key={item.id}
                  className="character-timeline-applied-filter"
                  aria-label={`${item.label} 필터 제거`}
                  onClick={() => onSelectionApply(item.selection)}
                >
                  <span>{item.label}</span>
                  <X size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="선택한 이력 필터 모두 지우기"
              onClick={() => onSelectionApply(EMPTY_TIMELINE_SELECTION)}
            >
              <X size={13} /> 모두 지우기
            </button>
          </div>
        )}

        {demoMode ? (
          <div className="character-timeline-state">
            <Clock3 size={28} />
            <strong>데모 캐릭터에는 확정 이력이 없습니다.</strong>
            <span>실제 작품에서 설정 후보를 확정하면 회차별 타임라인을 확인할 수 있습니다.</span>
          </div>
        ) : initialError ? (
          <div className="character-timeline-state" role="alert">
            <AlertCircle size={28} color={C.danger} />
            <strong>{queryErrorMessage(
              summaryQuery.error ?? timelineQuery.error,
              '타임라인을 불러오지 못했습니다.',
            )}</strong>
            <button type="button" className="timeline-secondary-button" onClick={() => {
              void summaryQuery.refetch();
              if (timelineEnabled) void timelineQuery.refetch();
            }}><RefreshCw size={13} /> 다시 시도</button>
          </div>
        ) : initialLoading ? (
          <div className="character-timeline-state"><Loader2 className="spin" size={22} /> 타임라인을 불러오는 중입니다.</div>
        ) : viewMode === 'types' && !selectionApplied ? (
          <div className="character-timeline-state">
            <SlidersHorizontal size={28} />
            <strong>변화 이력을 보고 싶은 설정을 선택하세요.</strong>
            <span>왼쪽 현재 설정을 클릭하면 여러 항목을 한 타임라인에서 비교할 수 있습니다.</span>
            <button type="button" className="timeline-primary-button" onClick={() => onViewModeChange('all')}>
              전체 이력 보기
            </button>
          </div>
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

            <main ref={feedRef} className="character-timeline-feed" aria-live="polite">
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

export function CharacterTimelineModal({
  workId,
  characterId,
  demoMode,
  onClose,
}: CharacterTimelineModalProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode: TimelineViewMode = searchParams.get('timelineView') === 'all' ? 'all' : 'types';
  const selection = readTimelineSelection(searchParams);
  const factType = timelineFilter(searchParams.get('timelineFactType'));
  const fromEpisodeNo = positiveInteger(searchParams.get('timelineEpisodeNo'));
  const selectedFactId = searchParams.get('timelineFactId');

  const updateTimelineParams = (update: (params: URLSearchParams) => void, replace = false) => {
    setSearchParams(previous => {
      update(previous);
      return previous;
    }, { replace });
  };

  return (
    <TimelineModal
      workId={workId}
      characterId={characterId}
      viewMode={viewMode}
      selection={selection}
      factType={factType}
      fromEpisodeNo={fromEpisodeNo}
      selectedFactId={selectedFactId}
      demoMode={demoMode}
      onViewModeChange={nextViewMode => updateTimelineParams(params => {
        if (nextViewMode === 'all') {
          params.set('timelineView', 'all');
          writeTimelineSelection(params, EMPTY_TIMELINE_SELECTION);
        } else params.delete('timelineView');
        params.delete('timelineEpisodeNo');
        params.delete('timelineFactId');
      })}
      onSelectionApply={nextSelection => updateTimelineParams(params => {
        writeTimelineSelection(params, nextSelection);
        params.delete('timelineView');
        params.delete('timelineEpisodeNo');
        params.delete('timelineFactId');
      })}
      onFactTypeChange={nextFactType => updateTimelineParams(params => {
        params.set('timelineFactType', nextFactType);
        params.delete('timelineEpisodeNo');
        params.delete('timelineFactId');
      })}
      onEpisodeChange={episodeNo => updateTimelineParams(params => {
        if (episodeNo == null) params.delete('timelineEpisodeNo');
        else params.set('timelineEpisodeNo', String(episodeNo));
        params.delete('timelineFactId');
      })}
      onEvidenceOpen={factId => updateTimelineParams(params => params.set('timelineFactId', factId), selectedFactId != null)}
      onEvidenceClose={() => updateTimelineParams(params => params.delete('timelineFactId'), true)}
      onClose={onClose}
    />
  );
}
