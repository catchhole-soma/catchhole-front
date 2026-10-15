import type { QueryClient } from '@tanstack/react-query';
import type { AnalysisSourceResponse } from '../api/generated/types.gen';
import { settingBookReferenceLabel } from './setting-book-reference';

export function analysisSourceLabel(source?: AnalysisSourceResponse | null, episodeNo?: number | null): string {
  if (source?.sourceKind === 'SETTING_BOOK') {
    return `설정집 · ${source.settingBookName || '이름 없는 설정집'}${source.revisionNo == null ? '' : ` · ${source.revisionNo}차 원문`}${source.referenceTimeKind == null ? '' : ` · ${settingBookReferenceLabel(source.referenceTimeKind, source.referenceEpisodeNo)}`}`;
  }
  const number = source?.sourceKind === 'EPISODE' ? source.episodeNo : episodeNo;
  return number == null ? '출처 정보 없음' : `${number}화`;
}

export function analysisSourceIdentity(source?: AnalysisSourceResponse | null, episodeNo?: number | null): string {
  return source?.sourceKind === 'SETTING_BOOK'
    ? `book:${source.settingBookId ?? ''}:${source.revisionId ?? ''}`
    : `episode:${source?.episodeId ?? source?.episodeNo ?? episodeNo ?? 'unknown'}`;
}

export function analysisSourcesLabel(items: Array<{ source?: AnalysisSourceResponse; sourceEpisodeNo?: number | null; episodeNo?: number | null }>, episodeNos: number[] = []): string {
  const itemLabels = items.flatMap(item => {
    if (item.source?.sourceKind === 'SETTING_BOOK') return [analysisSourceLabel(item.source)];
    const number = item.source?.episodeNo ?? item.sourceEpisodeNo ?? item.episodeNo;
    return number == null ? [] : [`${number}화`];
  });
  const labels = itemLabels.length > 0 ? itemLabels : episodeNos.map(number => `${number}화`);
  return [...new Set(labels)].join(' · ') || '출처 정보 없음';
}

export function bookWorkspaceUrl(workId: string, bookId?: string | null): string {
  const query = new URLSearchParams({ workId, nav: 'settingDB', tab: 'worldrules' });
  if (bookId) query.set('settingBookFileId', bookId);
  return `/dashboard?${query}`;
}

export function analysisSourceReaderUrl(workId: string, source?: AnalysisSourceResponse | null, episodeId?: string | null): string | null {
  const query = new URLSearchParams({ workId });
  if (source?.sourceKind === 'SETTING_BOOK') {
    if (!source.settingBookId || !source.revisionId) return null;
    query.set('settingBookId', source.settingBookId);
    query.set('revisionId', source.revisionId);
  } else {
    const id = source?.episodeId ?? episodeId;
    if (!id) return null;
    query.set('episodeId', id);
  }
  return `/editor?${query}`;
}

export function isSameReviewScope(workId: string, batchId: string, sourceAnalysisJobId?: string): boolean {
  const current = new URLSearchParams(window.location.search);
  return window.location.pathname === '/setting-review' && current.get('workId') === workId
    && current.get('batchId') === batchId && (current.get('sourceAnalysisJobId') ?? undefined) === sourceAnalysisJobId;
}

/** Invalidate every view of applied settings for this work, including current detail/search/history. */
export function invalidateAppliedSettings(queryClient: QueryClient, workId: string) {
  const operations = new Set(['getCharacters', 'getCharacter', 'getCharacterTimeline', 'getCharacterTimelineSummary',
    'getCharacterFact', 'getCharacterFactEvidence', 'searchCharacterFacts', 'getWorldSettings', 'getWorldSetting',
    'getSettingCandidates', 'getWorldSettingCandidates', 'getAnalysisBatches', 'getSettingBooks', 'getSettingBook']);
  return queryClient.invalidateQueries({ predicate: query => {
    const key = query.queryKey[0] as { _id?: string; path?: { workId?: string } } | undefined;
    return key?.path?.workId === workId && Boolean(key._id && operations.has(key._id));
  } });
}
