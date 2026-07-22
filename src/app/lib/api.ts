import { ACCESS_TOKEN_KEY, API_BASE_URL, getAccessToken } from './api-config';
import { fetchWithAuth } from './auth-fetch';
import {
  ApiError,
  NetworkError,
  notifyAuthError,
  setAuthErrorListener,
  setNetworkErrorListener,
  type FieldErrorDetail,
} from './api-errors';

export {
  ACCESS_TOKEN_KEY,
  ApiError,
  NetworkError,
  setAuthErrorListener,
  setNetworkErrorListener,
};
export type { FieldErrorDetail };

interface ErrorResponse {
  code: string;
  status: number;
  details: FieldErrorDetail[];
}

interface CommonResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  error: ErrorResponse | null;
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  const body: CommonResponse<T> = await res.json();

  if (!body.success || !res.ok) {
    const status = body.error?.status ?? res.status;
    const isAuthEndpoint = res.url.includes('/api/v1/auth/login') || res.url.includes('/api/v1/auth/signup');
    if (status === 401 && getAccessToken() && !isAuthEndpoint) {
      notifyAuthError();
    }
    throw new ApiError(
      body.message ?? '요청 처리 중 오류가 발생했습니다.',
      body.error?.code ?? 'UNKNOWN_ERROR',
      status,
      body.error?.details ?? [],
    );
  }

  return body.data as T;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...init?.headers,
    },
  });

  return handleResponse<T>(res);
}

/**
 * multipart/form-data 요청용. Content-Type을 직접 지정하지 않아
 * 브라우저가 boundary를 포함한 헤더를 자동으로 설정하도록 한다.
 */
export async function apiFetchForm<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(`${API_BASE_URL}${path}`, {
    ...init,
    method: init?.method ?? 'POST',
    credentials: 'include',
    headers: {
      ...authHeaders(),
      ...init?.headers,
    },
    body: formData,
  });

  return handleResponse<T>(res);
}
