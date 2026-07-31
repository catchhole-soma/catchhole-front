import { QueryClient } from '@tanstack/react-query';
import { toApiError } from './api-errors';

/**
 * 인증 갱신과 재요청까지 실패한 401은 Query가 다시 호출하지 않는다.
 */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
  retryLimit = 1,
): boolean {
  return toApiError(error)?.status !== 401 && failureCount < retryLimit;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery,
    },
    mutations: {
      retry: false,
    },
  },
});
