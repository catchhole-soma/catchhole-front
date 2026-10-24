import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAnalysisJobProgress } from '../api/generated/sdk.gen';
import type { AnalysisJobProgressResponse } from '../api/generated/types.gen';
import { isBlockedOrderedAnalysis, isCompletedOrderedAnalysis, isInvalidatedAnalysis, isOrderedAnalysis } from '../lib/ordered-analysis';

type ProgressScope = {
  workId: string;
  trackedAnalysisJobIds: string[];
  currentAnalysisJobIds: string[];
  supersededJobIds: ReadonlySet<string>;
};

const unique = (ids: string[]) => [...new Set(ids)];
const keyFor = (scope: ProgressScope) => ['analysis-job-progress', scope.workId, {
  tracked: unique(scope.trackedAnalysisJobIds), current: unique(scope.currentAnalysisJobIds),
  superseded: unique(scope.trackedAnalysisJobIds).filter(id => scope.supersededJobIds.has(id)),
}] as const;

function eligibleIds(scope: ProgressScope, jobs: AnalysisJobProgressResponse[]) {
  const byId = new Map(jobs.map(job => [job.id, job]));
  return unique(scope.currentAnalysisJobIds).filter(id => {
    if (scope.supersededJobIds.has(id)) return false;
    const job = byId.get(id);
    if (!job) return true;
    if (isOrderedAnalysis(job)) return !isInvalidatedAnalysis(job) && job.status !== 'CANCELED';
    return job.status !== 'SUCCEEDED' && job.status !== 'FAILED' && job.status !== 'CANCELED';
  });
}

function pollingInterval(scope: ProgressScope, jobs: AnalysisJobProgressResponse[]) {
  const byId = new Map(jobs.map(job => [job.id, job]));
  const ids = eligibleIds(scope, jobs);
  if (ids.length === 0) return false;
  const currentJobs = scope.currentAnalysisJobIds.flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  const active = ids.some(id => {
    const job = byId.get(id);
    return !job || !job.status || job.status === 'RUNNING'
      || job.status === 'PENDING' && !isBlockedOrderedAnalysis(job, currentJobs)
      || isOrderedAnalysis(job) && job.status === 'SUCCEEDED' && !isCompletedOrderedAnalysis(job)
        && job.analysisRun?.journalStatus !== 'INCOMPLETE';
  });
  return active ? 3_000 : 30_000;
}

async function readProgress(scope: ProgressScope, previous: AnalysisJobProgressResponse[], signal: AbortSignal) {
  const byId = new Map(previous.map(job => [job.id, job]));
  const eligible = new Set(eligibleIds(scope, previous));
  const ids = unique(scope.trackedAnalysisJobIds).filter(id => !byId.has(id) || eligible.has(id));
  for (let index = 0; index < ids.length; index += 100) {
    signal.throwIfAborted();
    const chunk = ids.slice(index, index + 100);
    const { data } = await getAnalysisJobProgress({ path: { workId: scope.workId }, query: { analysisJobIds: chunk }, signal, throwOnError: true });
    signal.throwIfAborted();
    const rows = data.data;
    if (!rows || chunk.some(id => !rows.some(job => job.id === id))) throw new Error('분석 진행 상태를 모두 확인하지 못했습니다.');
    rows.forEach(job => { if (job.id) byId.set(job.id, job); });
  }
  return unique(scope.trackedAnalysisJobIds).flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
}

export function useAnalysisJobProgress(scope: ProgressScope & { enabled: boolean }) {
  const queryClient = useQueryClient();
  const queryKey = keyFor(scope);
  const options = (target: ProgressScope) => ({
    queryKey: keyFor(target),
    queryFn: ({ signal }: { signal: AbortSignal }) => readProgress(target,
      queryClient.getQueryData<AnalysisJobProgressResponse[]>(keyFor(target)) ?? [], signal),
    retry: false as const,
  });
  const query = useQuery({
    ...options(scope),
    enabled: scope.enabled && scope.trackedAnalysisJobIds.length > 0
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(scope.workId),
    refetchOnMount: false,
    refetchOnWindowFocus: query => eligibleIds(scope, query.state.data ?? []).length > 0 ? 'always' : false,
    refetchOnReconnect: query => eligibleIds(scope, query.state.data ?? []).length > 0 ? 'always' : false,
    refetchInterval: query => pollingInterval(scope, query.state.data ?? []),
  });

  const refresh = async (responseJobs: AnalysisJobProgressResponse[] = [], nextScope: ProgressScope = scope) => {
    // A read started before retry must not overwrite the resumed state, including same-ID retries.
    await queryClient.cancelQueries({ queryKey: ['analysis-job-progress', scope.workId] });
    const previous = queryClient.getQueryData<AnalysisJobProgressResponse[]>(queryKey) ?? [];
    const byId = new Map(previous.map(job => [job.id, job]));
    responseJobs.forEach(job => { if (job.id) byId.set(job.id, job); });
    const nextJobs = unique(nextScope.trackedAnalysisJobIds).flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
    queryClient.setQueryData(keyFor(nextScope), nextJobs);
    return queryClient.fetchQuery(options(nextScope));
  };

  return { jobs: query.data ?? [], isError: query.isError, refetch: query.refetch, refresh };
}
