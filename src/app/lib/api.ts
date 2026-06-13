const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export interface FieldErrorDetail {
  field: string;
  message: string;
}

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

export class ApiError extends Error {
  code: string;
  status: number;
  details: FieldErrorDetail[];

  constructor(message: string, code: string, status: number, details: FieldErrorDetail[] = []) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** fetch 자체가 실패한 경우(서버 다운, CORS, 네트워크 오류 등 응답을 받지 못한 경우) */
export class NetworkError extends Error {
  constructor(message = '백엔드 서버에 연결할 수 없습니다.') {
    super(message);
  }
}

let networkErrorListener: (() => void) | null = null;

/** 전역에서 NetworkError 발생을 감지하기 위한 리스너 등록 (BackendStatusProvider에서 사용) */
export function setNetworkErrorListener(fn: (() => void) | null): void {
  networkErrorListener = fn;
}

async function fetchOrThrowNetworkError(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    networkErrorListener?.();
    throw new NetworkError();
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const body: CommonResponse<T> = await res.json();

  if (!body.success || !res.ok) {
    throw new ApiError(
      body.message ?? '요청 처리 중 오류가 발생했습니다.',
      body.error?.code ?? 'UNKNOWN_ERROR',
      body.error?.status ?? res.status,
      body.error?.details ?? [],
    );
  }

  return body.data as T;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchOrThrowNetworkError(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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
  const res = await fetchOrThrowNetworkError(`${API_BASE_URL}${path}`, {
    ...init,
    method: init?.method ?? 'POST',
    credentials: 'include',
    body: formData,
  });

  return handleResponse<T>(res);
}
