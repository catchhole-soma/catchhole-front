export const AI_TOKEN_QUOTA_EXHAUSTED_EVENT = 'catchhole:ai-token-quota-exhausted';

export type AiTokenQuotaNotice = {
  kind: 'request-blocked' | 'analysis-failed' | 'analysis-interrupted';
  failedEpisodeCount?: number;
  totalEpisodeCount?: number;
  interruptedComparisonCount?: number;
};

const DEFAULT_NOTICE: AiTokenQuotaNotice = { kind: 'request-blocked' };

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
