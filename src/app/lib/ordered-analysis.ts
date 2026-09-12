import type { AnalysisJobResponse } from '../api/generated/types.gen';

export function isOrderedAnalysis(job: AnalysisJobResponse): boolean {
  return job.analysisRun?.mode === 'ORDERED_PROVISIONAL';
}

export function isInvalidatedAnalysis(job: AnalysisJobResponse): boolean {
  return isOrderedAnalysis(job) && job.analysisRun?.journalStatus === 'INVALIDATED';
}

export function isCompletedOrderedAnalysis(job: AnalysisJobResponse): boolean {
  return isOrderedAnalysis(job) && job.status === 'SUCCEEDED'
    && job.analysisRun?.journalStatus === 'SEALED'
    && (job.reviewMode !== 'AUTOMATIC' || Boolean(job.automaticAppliedAt));
}

function isEarlierInRun(earlier: AnalysisJobResponse, later: AnalysisJobResponse): boolean {
  return isOrderedAnalysis(earlier) && isOrderedAnalysis(later)
    && earlier.analysisRun?.runId === later.analysisRun?.runId
    && earlier.analysisRun?.generation === later.analysisRun?.generation
    && (earlier.analysisRun?.sequence ?? Infinity) < (later.analysisRun?.sequence ?? -1);
}

function stopsFollowingEpisodes(job: AnalysisJobResponse): boolean {
  return job.status === 'FAILED' || job.status === 'CANCELED'
    || job.analysisRun?.journalStatus === 'INCOMPLETE' || isInvalidatedAnalysis(job)
    || job.status === 'SUCCEEDED' && !isCompletedOrderedAnalysis(job);
}

export function isBlockedOrderedAnalysis(job: AnalysisJobResponse, jobs: AnalysisJobResponse[]): boolean {
  return isOrderedAnalysis(job) && job.status === 'PENDING'
    && (isInvalidatedAnalysis(job)
      || jobs.some(earlier => isEarlierInRun(earlier, job) && stopsFollowingEpisodes(earlier)));
}

export function canResumeOrderedAnalysis(job: AnalysisJobResponse, jobs: AnalysisJobResponse[]): boolean {
  return isOrderedAnalysis(job) && !isInvalidatedAnalysis(job)
    && (job.status === 'FAILED'
      || job.status === 'SUCCEEDED' && job.analysisRun?.journalStatus === 'INCOMPLETE')
    && !jobs.some(earlier => isEarlierInRun(earlier, job) && stopsFollowingEpisodes(earlier));
}
