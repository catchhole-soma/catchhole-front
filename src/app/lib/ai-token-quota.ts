export const AI_TOKEN_QUOTA_EXHAUSTED_EVENT = 'catchhole:ai-token-quota-exhausted';

export function notifyAiTokenQuotaExhausted(): void {
  window.dispatchEvent(new Event(AI_TOKEN_QUOTA_EXHAUSTED_EVENT));
}

export function subscribeAiTokenQuotaExhausted(listener: () => void): () => void {
  window.addEventListener(AI_TOKEN_QUOTA_EXHAUSTED_EVENT, listener);
  return () => window.removeEventListener(AI_TOKEN_QUOTA_EXHAUSTED_EVENT, listener);
}
