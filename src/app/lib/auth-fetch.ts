import {
  API_BASE_URL,
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from './api-config';
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
  '/api/v1/auth/phone-verifications',
  REFRESH_PATH,
  '/api/v1/auth/logout',
];

let refreshRequest: Promise<string | null> | null = null;
let refreshAbortController: AbortController | null = null;
let authSessionVersion = 0;

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

async function requestAccessToken(
  sessionVersion: number,
  signal: AbortSignal,
): Promise<string | null> {
  const response = await fetchOrThrowNetworkError(`${API_BASE_URL}${REFRESH_PATH}`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (sessionVersion !== authSessionVersion) return null;

  if (!response.ok) {
    clearAccessToken();
    notifyAuthError();
    return null;
  }

  const body = await response.json() as AuthTokenEnvelope;
  if (sessionVersion !== authSessionVersion) return null;

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
  if (!refreshRequest) {
    const sessionVersion = authSessionVersion;
    const controller = new AbortController();
    refreshAbortController = controller;
    const request = requestAccessToken(sessionVersion, controller.signal)
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return null;
        throw error;
      })
      .finally(() => {
        if (refreshRequest === request) refreshRequest = null;
        if (refreshAbortController === controller) refreshAbortController = null;
      });
    refreshRequest = request;
  }
  return refreshRequest;
}

export function invalidateAuthRefresh(): void {
  authSessionVersion += 1;
  refreshAbortController?.abort();
  refreshAbortController = null;
  refreshRequest = null;
}

export async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const retryRequest = request.clone();
  const response = await fetchOrThrowNetworkError(request);

  if (response.status !== 401 || !canRefresh(request.url) || !getAccessToken()) {
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
