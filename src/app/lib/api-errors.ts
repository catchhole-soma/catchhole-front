export interface FieldErrorDetail {
  field: string;
  message: string;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details: FieldErrorDetail[];
  context: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    status: number,
    details: FieldErrorDetail[] = [],
    context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.context = context;
  }
}

/** 서버 응답 자체를 받지 못한 경우(CORS, 서버 중단, 네트워크 단절 등). */
export class NetworkError extends Error {
  constructor(message = '백엔드 서버에 연결할 수 없습니다.') {
    super(message);
    this.name = 'NetworkError';
  }
}

let networkErrorListener: (() => void) | null = null;
let authErrorListener: (() => void) | null = null;

export function setNetworkErrorListener(listener: (() => void) | null): void {
  networkErrorListener = listener;
}

export function setAuthErrorListener(listener: (() => void) | null): void {
  authErrorListener = listener;
}

export function notifyNetworkError(): void {
  networkErrorListener?.();
}

export function notifyAuthError(): void {
  authErrorListener?.();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toApiError(error: unknown): ApiError | null {
  if (error instanceof ApiError) return error;
  if (!isRecord(error)) return null;

  const errorBody = isRecord(error.error) ? error.error : null;
  if (!errorBody) return null;

  const details = Array.isArray(errorBody.details)
    ? errorBody.details.flatMap(detail => {
        if (!isRecord(detail) || typeof detail.field !== 'string' || typeof detail.message !== 'string') {
          return [];
        }
        return [{ field: detail.field, message: detail.message }];
      })
    : [];
  const context = isRecord(errorBody.context) ? errorBody.context : {};

  return new ApiError(
    typeof error.message === 'string' ? error.message : '요청 처리 중 오류가 발생했습니다.',
    typeof errorBody.code === 'string' ? errorBody.code : 'UNKNOWN_ERROR',
    typeof errorBody.status === 'number' ? errorBody.status : 0,
    details,
    context,
  );
}
