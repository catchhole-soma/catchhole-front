import { useEffect, useRef } from 'react';
import {
  queryOptions,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
  type QueryFunction,
  type SkipToken,
} from '@tanstack/react-query';
import {
  applyValidationSettingsMutation,
  completeValidationReviewMutation,
  getEpisodesOptions,
  getEpisodeValidationStagingOptions,
  getValidationExecutionResultsOptions,
  getValidationFindingOptions,
  getValidationReviewSummaryOptions,
  getWorkOptions,
  listEpisodeValidationHistoryOptions,
  listValidationFindingsOptions,
  retryValidationExecutionMutation,
  saveValidationJudgmentMutation,
} from '../api/generated/@tanstack/react-query.gen';
import type {
  PageResponseValidationFindingSummaryResponse,
  ValidationFindingDetailResponse,
  ValidationFindingSummaryResponse,
  ValidationReviewSummaryResponse,
  ValidationStagingResponse,
} from '../api/generated/types.gen';
import { shouldRetryQuery } from '../lib/query-client';
import type { Branch, Judgment } from '../components/catchhole/validation/validation-report-labels';

const FINDINGS_PAGE_SIZE = 20;
const ACTIVE_POLL_MS = 3_000;
const SETTLED_POLL_MS = 30_000;
const ACTIVE_EXECUTION = new Set(['QUEUED', 'RUNNING']);
// 기준 준비·검사·검토 종료 뒤 추출 중에는 결과가 곧 바뀌므로 짧게 확인한다.
const ACTIVE_STAGES = new Set(['PREPARING_BASELINE', 'VALIDATING', 'REVIEW_COMPLETED']);
// 인용·판정 본문을 담는 조회. reportVersion이 바뀌거나 결과가 무효가 되면 이전 응답을 버린다.
const QUOTE_QUERIES = new Set(['listValidationFindings', 'getValidationFinding', 'getValidationExecutionResults']);

export type FindingFilters = {
  branch?: Branch;
  judgment?: Judgment;
  outcome?: string;
  /** API의 0-based 페이지 */
  page: number;
};

type ReportQueryParams = { _id?: string; path?: { reportId?: string } };

function reportParams(query: Query): ReportQueryParams | null {
  const first = query.queryKey[0];
  return first && typeof first === 'object' ? first as ReportQueryParams : null;
}

/**
 * 생성된 query options의 key 뒤에 reportVersion을 붙인다. 판단 저장·재시도·실행 게시가 version을 올리면
 * 목록·상세·결과를 새 key로 다시 읽고, 같은 대상의 직전 응답만 placeholder로 유지한다.
 */
function versionedQuery<TData, TParams>(
  generated: { queryKey: readonly [TParams]; queryFn?: QueryFunction<TData, [TParams]> | SkipToken },
  reportVersion: number | null,
  keepPrevious: boolean,
) {
  const params = generated.queryKey[0];
  const queryFn = generated.queryFn;
  return queryOptions({
    queryKey: [params, { reportVersion }] as const,
    queryFn: typeof queryFn === 'function' ? context => queryFn({ ...context, queryKey: [params] }) : skipToken,
    // 무효·파기된 결과는 비활성 조회의 placeholder로도 이전 인용을 다시 보여 주지 않는다.
    placeholderData: (previous, previousQuery) => (
      keepPrevious && previousQuery && JSON.stringify(previousQuery.queryKey[0]) === JSON.stringify(params) ? previous : undefined
    ),
  });
}

function isReportInvalidated(staging?: ValidationStagingResponse, summary?: ValidationReviewSummaryResponse) {
  return staging?.current === false
    || staging?.status === 'INVALIDATED'
    || staging?.reviewStage === 'INVALIDATED'
    || summary?.reviewStage === 'INVALIDATED';
}

function pollingInterval(staging?: ValidationStagingResponse, summary?: ValidationReviewSummaryResponse): number | false {
  if (staging?.current === false) return false;
  const execution = summary?.executionStatus ?? staging?.executionStatus;
  const stage = summary?.reviewStage ?? staging?.reviewStage;
  if ((execution && ACTIVE_EXECUTION.has(execution)) || (stage && ACTIVE_STAGES.has(stage))) return ACTIVE_POLL_MS;
  // 완료된 report도 원고 교체·기준 변경으로 무효가 될 수 있어 화면이 열린 동안 계속 확인한다.
  return SETTLED_POLL_MS;
}

type ValidationCoverageView = {
  gridReady: boolean | null;
  requiredStages: number | null;
  completedStages: number | null;
  incompleteStages: number;
};

export type ValidationResultsView = {
  status: string | null;
  settingStatus: string | null;
  typoStatus: string | null;
  completedChecks: number | null;
  totalChecks: number | null;
  coverage: ValidationCoverageView | null;
};

function numberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' ? value : null;
}

/** `/results`는 Map 응답이므로 화면에 필요한 요약 필드만 읽는다. 인용·근거 목록은 상세 조회를 사용한다. */
function readResults(data: Record<string, unknown> | undefined): ValidationResultsView | null {
  if (!data) return null;
  const coverage = data.coverage && typeof data.coverage === 'object' ? data.coverage as Record<string, unknown> : null;
  const stages = Array.isArray(coverage?.stages) ? coverage.stages : [];
  return {
    status: stringOrNull(data.status),
    settingStatus: stringOrNull(data.settingStatus),
    typoStatus: stringOrNull(data.typoStatus),
    completedChecks: numberOrNull(data.completedChecks),
    totalChecks: numberOrNull(data.totalChecks),
    coverage: coverage ? {
      gridReady: typeof coverage.gridReady === 'boolean' ? coverage.gridReady : null,
      requiredStages: numberOrNull(coverage.requiredStages),
      completedStages: numberOrNull(coverage.completedStages),
      incompleteStages: stages.filter(stage => stage && typeof stage === 'object'
        && (stage as Record<string, unknown>).successful === false).length,
    } : null,
  };
}

function newIdempotencyKey(prefix: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

/** 한 번의 요청 의도 동안 같은 키를 재사용하고, 보고 있는 reportVersion이 바뀌면 새 키를 만든다. */
function useIdempotencyKey(prefix: string) {
  const current = useRef<{ key: string; version: number } | null>(null);
  return {
    take: (version: number) => {
      if (!current.current || current.current.version !== version) current.current = { key: newIdempotencyKey(prefix), version };
      return current.current.key;
    },
    reset: () => { current.current = null; },
  };
}

export function useEpisodeValidationReport({ workId, reportId, filters, findingId, historyOpen, historyPage }: {
  workId: string;
  reportId: string;
  filters: FindingFilters;
  findingId: string | null;
  historyOpen: boolean;
  historyPage: number;
}) {
  const queryClient = useQueryClient();
  const enabled = Boolean(workId && reportId);
  const path = { workId, reportId };

  const stagingOptions = getEpisodeValidationStagingOptions({ path });
  const summaryOptions = getValidationReviewSummaryOptions({ path });
  // 두 조회를 함께 보고 주기를 정한다. 갱신은 선택·스크롤·초점을 바꾸지 않는 background refetch다.
  const currentInterval = () => pollingInterval(
    queryClient.getQueryData(stagingOptions.queryKey)?.data,
    queryClient.getQueryData(summaryOptions.queryKey)?.data,
  );
  const pollSettings = {
    enabled,
    retry: shouldRetryQuery,
    refetchInterval: currentInterval,
    refetchOnWindowFocus: () => currentInterval() !== false,
    refetchOnReconnect: () => currentInterval() !== false,
  };
  const stagingQuery = useQuery({ ...stagingOptions, ...pollSettings });
  const summaryQuery = useQuery({ ...summaryOptions, ...pollSettings });
  const staging = stagingQuery.data?.data;
  const summary = summaryQuery.data?.data;

  const invalidated = isReportInvalidated(staging, summary);
  // 두 조회의 version이 잠시 다를 수 있어 더 최신 값을 기준으로 삼는다.
  const versions = [staging?.reportVersion, summary?.reportVersion].filter((value): value is number => typeof value === 'number');
  const reportVersion = versions.length ? Math.max(...versions) : null;
  const quotesEnabled = enabled && reportVersion !== null && !invalidated && staging?.current !== false;

  const resultsQuery = useQuery({
    ...versionedQuery(getValidationExecutionResultsOptions({ path }), reportVersion, quotesEnabled),
    enabled: quotesEnabled,
    retry: shouldRetryQuery,
  });
  const findingsQuery = useQuery({
    ...versionedQuery(listValidationFindingsOptions({
      path,
      query: {
        branch: filters.branch,
        judgment: filters.judgment,
        outcome: filters.outcome,
        page: filters.page,
        size: FINDINGS_PAGE_SIZE,
      },
    }), reportVersion, quotesEnabled),
    enabled: quotesEnabled,
    retry: shouldRetryQuery,
  });
  const detailQuery = useQuery({
    ...versionedQuery(getValidationFindingOptions({ path: { ...path, findingId: findingId ?? '' } }), reportVersion, quotesEnabled),
    enabled: quotesEnabled && Boolean(findingId),
    retry: false,
  });

  const episodeId = staging?.episodeId ?? '';
  const historyQuery = useQuery({
    ...listEpisodeValidationHistoryOptions({ path: { workId }, query: { episodeId, page: historyPage, size: 20 } }),
    enabled: enabled && Boolean(episodeId) && (historyOpen || staging?.current === false),
    retry: shouldRetryQuery,
  });
  const episodesQuery = useQuery({
    ...getEpisodesOptions({ path: { workId } }),
    enabled: Boolean(workId) && Boolean(episodeId),
    staleTime: 60_000,
    retry: false,
  });
  const workQuery = useQuery({ ...getWorkOptions({ path: { workId } }), enabled: Boolean(workId), staleTime: 60_000, retry: false });

  // 파기·교체·이전 version의 인용은 캐시에서도 지워 다시 표시하지 않는다.
  useEffect(() => {
    if (!reportId) return;
    queryClient.removeQueries({
      predicate: query => {
        const params = reportParams(query);
        if (!params?._id || !QUOTE_QUERIES.has(params._id) || params.path?.reportId !== reportId) return false;
        if (invalidated) return true;
        const tag = query.queryKey[1] as { reportVersion?: number | null } | undefined;
        return tag?.reportVersion !== reportVersion;
      },
    });
  }, [invalidated, queryClient, reportId, reportVersion]);

  /** 저장 응답을 다시 읽기 전에 현재 상세·목록 행에 반영해 선택과 판단 표시가 흔들리지 않게 한다. */
  const applySavedJudgment = (saved: ValidationFindingSummaryResponse) => {
    const matches = (id: string) => (query: Query) => {
      const params = reportParams(query) as (ReportQueryParams & { path?: { findingId?: string } }) | null;
      return params?._id === id && params.path?.reportId === reportId;
    };
    queryClient.setQueriesData<{ data?: ValidationFindingDetailResponse }>({ predicate: matches('getValidationFinding') }, old => (
      old?.data && old.data.findingId === saved.findingId ? { ...old, data: { ...old.data, judgment: saved.judgment } } : old
    ));
    queryClient.setQueriesData<{ data?: PageResponseValidationFindingSummaryResponse }>({ predicate: matches('listValidationFindings') }, old => (
      old?.data?.content ? { ...old, data: { ...old.data, content: old.data.content.map(row => row.findingId === saved.findingId ? { ...row, ...saved } : row) } } : old
    ));
  };

  const refreshReport = () => queryClient.invalidateQueries({
    predicate: query => reportParams(query)?.path?.reportId === reportId
      || (reportParams(query)?._id === 'listEpisodeValidationHistory'),
  });

  const saveJudgment = useMutation(saveValidationJudgmentMutation());
  const retry = useMutation(retryValidationExecutionMutation());
  const completion = useMutation(completeValidationReviewMutation());
  const application = useMutation(applyValidationSettingsMutation());
  const retryKey = useIdempotencyKey('validation-retry');
  const completionKey = useIdempotencyKey('validation-review-completion');
  const applicationKey = useIdempotencyKey('validation-settings-application');

  return {
    staging,
    summary,
    stagingQuery,
    summaryQuery,
    invalidated,
    reportVersion,
    results: readResults(resultsQuery.data?.data),
    resultsQuery,
    findings: findingsQuery.data?.data,
    findingsQuery,
    detail: detailQuery.data?.data,
    detailQuery,
    history: historyQuery.data?.data,
    historyQuery,
    episode: episodesQuery.data?.data?.find(item => item.id === episodeId),
    work: workQuery.data?.data,
    refreshReport,
    applySavedJudgment,
    saveJudgment,
    retry,
    completion,
    application,
    retryKey,
    completionKey,
    applicationKey,
  };
}
