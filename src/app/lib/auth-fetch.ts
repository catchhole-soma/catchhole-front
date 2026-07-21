import { API_BASE_URL, clearAccessToken, setAccessToken } from './api-config';
import {
  NetworkError,
  notifyAuthError,
  notifyNetworkError,
} from './api-errors';

interface AuthTokenEnvelope {
  success?: boolean;
  data?: {
    accessToken?: string;
  };
}

const REFRESH_PATH = '/api/v1/auth/refresh';
const NO_REFRESH_PATHS = [
  '/api/v1/auth/signup',
  '/api/v1/auth/login',
  REFRESH_PATH,
  '/api/v1/auth/logout',
];

let refreshRequest: Promise<string | null> | null = null;

async function fetchOrThrowNetworkError(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    notifyNetworkError();
    throw new NetworkError();
  }
}

function canRefresh(url: string): boolean {
  return !NO_REFRESH_PATHS.some(path => url.includes(path));
}

async function requestAccessToken(): Promise<string | null> {
  const response = await fetchOrThrowNetworkError(`${API_BASE_URL}${REFRESH_PATH}`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    clearAccessToken();
    notifyAuthError();
    return null;
  }

  const body = await response.json() as AuthTokenEnvelope;
  const accessToken = body.success ? body.data?.accessToken : undefined;
  if (!accessToken) {
    clearAccessToken();
    notifyAuthError();
    return null;
  }

  setAccessToken(accessToken);
  return accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  refreshRequest ??= requestAccessToken().finally(() => {
    refreshRequest = null;
  });
  return refreshRequest;
}

export async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const retryRequest = request.clone();
  const response = await fetchOrThrowNetworkError(request);

  if (response.status !== 401 || !canRefresh(request.url)) {
    return response;
  }

  const accessToken = await refreshAccessToken();
  if (!accessToken) return response;

  const headers = new Headers(retryRequest.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  const retriedResponse = await fetchOrThrowNetworkError(new Request(retryRequest, { headers }));

  if (retriedResponse.status === 401) {
    clearAccessToken();
    notifyAuthError();
  }

  return retriedResponse;
}
