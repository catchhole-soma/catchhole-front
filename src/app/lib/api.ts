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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

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
