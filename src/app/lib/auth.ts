import type { CommonResponseAuthTokenResponse } from '../api/generated/types.gen';
import { clearAccessToken, setAccessToken } from './api-config';
import { ApiError } from './api-errors';
import { invalidateAuthRefresh } from './auth-fetch';

export function saveAuthToken(response: CommonResponseAuthTokenResponse): void {
  const accessToken = response.data?.accessToken;
  if (!response.success || !accessToken) {
    const details = (response.error?.details ?? []).flatMap(detail =>
      detail.field && detail.message
        ? [{ field: detail.field, message: detail.message }]
        : [],
    );
    throw new ApiError(
      response.message ?? '인증 토큰을 확인할 수 없습니다.',
      response.error?.code ?? 'AUTH_TOKEN_MISSING',
      response.error?.status ?? 500,
      details,
    );
  }

  setAccessToken(accessToken);
}

export function clearAuthSession(): void {
  invalidateAuthRefresh();
  clearAccessToken();
}
