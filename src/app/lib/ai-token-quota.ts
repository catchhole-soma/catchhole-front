export const AI_TOKEN_QUOTA_EXHAUSTED_EVENT = 'catchhole:ai-token-quota-exhausted';

export type AiTokenQuotaNotice = {
  kind: 'request-blocked' | 'analysis-failed' | 'analysis-interrupted';
  failedEpisodeCount?: number;
  totalEpisodeCount?: number;
  interruptedComparisonCount?: number;
};

type AnalysisInterruptionState = {
  activeBaselineCount: number | null;
  lastSettledCount: number | null;
};

type AnalysisInterruptionObservation = {
  batchId: string;
  interruptedComparisonCount: number;
  active: boolean;
};

const DEFAULT_NOTICE: AiTokenQuotaNotice = { kind: 'request-blocked' };
const analysisInterruptionStates = new Map<string, AnalysisInterruptionState>();

export function observeAnalysisInterruption({
  batchId,
  interruptedComparisonCount,
  active,
}: AnalysisInterruptionObservation): boolean {
  const previousState = analysisInterruptionStates.get(batchId) ?? {
    activeBaselineCount: null,
    lastSettledCount: null,
  };
  if (active) {
    const activeBaselineCount = previousState.activeBaselineCount === null
      ? interruptedComparisonCount
      : Math.min(previousState.activeBaselineCount, interruptedComparisonCount);
    analysisInterruptionStates.set(batchId, { ...previousState, activeBaselineCount });
    return false;
  }
  if (interruptedComparisonCount <= 0) {
    analysisInterruptionStates.delete(batchId);
    return false;
  }

  const comparisonBaseline = previousState.activeBaselineCount ?? previousState.lastSettledCount;
  const shouldNotify = previousState.lastSettledCount === null
    || (comparisonBaseline !== null && interruptedComparisonCount > comparisonBaseline);
  analysisInterruptionStates.set(batchId, {
    activeBaselineCount: null,
    lastSettledCount: interruptedComparisonCount,
  });
  return shouldNotify;
}

export function notifyAiTokenQuotaExhausted(
  notice: AiTokenQuotaNotice = DEFAULT_NOTICE,
): void {
  window.dispatchEvent(new CustomEvent<AiTokenQuotaNotice>(
    AI_TOKEN_QUOTA_EXHAUSTED_EVENT,
    { detail: notice },
  ));
}

export function subscribeAiTokenQuotaExhausted(
  listener: (notice: AiTokenQuotaNotice) => void,
): () => void {
  const handler = (event: Event) => {
    const detail = event instanceof CustomEvent
      ? event.detail as AiTokenQuotaNotice | undefined
      : undefined;
    listener(detail ?? DEFAULT_NOTICE);
  };
  window.addEventListener(AI_TOKEN_QUOTA_EXHAUSTED_EVENT, handler);
  return () => window.removeEventListener(AI_TOKEN_QUOTA_EXHAUSTED_EVENT, handler);
}
