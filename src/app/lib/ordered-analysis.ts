import type { AnalysisJobResponse } from '../api/generated/types.gen';

type OrderedAnalysisState = Pick<AnalysisJobResponse, 'status' | 'reviewMode' | 'automaticAppliedAt'>
  & { analysisRun?: AnalysisJobResponse['analysisRun'] | null };

export function isOrderedAnalysis(job: OrderedAnalysisState): boolean {
  return job.analysisRun?.mode === 'ORDERED_PROVISIONAL';
}

export function isInvalidatedAnalysis(job: OrderedAnalysisState): boolean {
  return isOrderedAnalysis(job) && job.analysisRun?.journalStatus === 'INVALIDATED';
}

export function isCompletedOrderedAnalysis(job: OrderedAnalysisState): boolean {
  return isOrderedAnalysis(job) && job.status === 'SUCCEEDED'
    && job.analysisRun?.journalStatus === 'SEALED'
    && (job.reviewMode !== 'AUTOMATIC' || Boolean(job.automaticAppliedAt));
}

function isEarlierInRun(earlier: OrderedAnalysisState, later: OrderedAnalysisState): boolean {
  return isOrderedAnalysis(earlier) && isOrderedAnalysis(later)
    && earlier.analysisRun?.runId === later.analysisRun?.runId
    && earlier.analysisRun?.generation === later.analysisRun?.generation
    && (earlier.analysisRun?.sequence ?? Infinity) < (later.analysisRun?.sequence ?? -1);
}

function stopsFollowingEpisodes(job: OrderedAnalysisState): boolean {
  return job.status === 'FAILED' || job.status === 'CANCELED'
    || job.analysisRun?.journalStatus === 'INCOMPLETE' || isInvalidatedAnalysis(job)
    || job.status === 'SUCCEEDED' && !isCompletedOrderedAnalysis(job);
}

export function isBlockedOrderedAnalysis(job: OrderedAnalysisState, jobs: OrderedAnalysisState[]): boolean {
  return isOrderedAnalysis(job) && job.status === 'PENDING'
    && (isInvalidatedAnalysis(job)
      || jobs.some(earlier => isEarlierInRun(earlier, job) && stopsFollowingEpisodes(earlier)));
}

export function canResumeOrderedAnalysis(job: OrderedAnalysisState, jobs: OrderedAnalysisState[]): boolean {
  return isOrderedAnalysis(job) && !isInvalidatedAnalysis(job)
    && (job.status === 'FAILED'
      || job.status === 'SUCCEEDED' && job.analysisRun?.journalStatus === 'INCOMPLETE')
    && !jobs.some(earlier => isEarlierInRun(earlier, job) && stopsFollowingEpisodes(earlier));
}
