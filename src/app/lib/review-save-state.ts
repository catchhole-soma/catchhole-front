import { NetworkError, toApiError } from './api-errors';

/**
 * 검토 화면의 저장 상태. 서버에는 "저장 중/결과 미확인" 개념이 없으므로 재조회 결과로 판정한다.
 *
 * - `saved`: 다시 받은 서버 값이 작가의 선택과 같다.
 * - `failed`: 서버가 오류 응답을 돌려줬다. 메시지는 서버 문장을 그대로 쓰고 입력은 유지한다.
 * - `unverified`: 요청은 보냈지만 응답을 받지 못했다. 저장됐을 수도 있으므로 저장 완료로 표시하지 않고
 *   자동 재조회로 확인한다. `final`이면 자동 확인을 마쳤고 작가의 확인·재시도를 기다린다.
 */
export type ReviewSaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'failed'; message: string; retry: () => void }
  | { kind: 'unverified'; attempt: number; final: boolean; retry: () => void; check: () => void };

/** 응답을 받지 못한 직후 바로 한 번, 이후 1→3→8초 뒤 최대 3회 다시 확인한다. */
export const REVIEW_RECHECK_DELAYS_MS = [1_000, 3_000, 8_000] as const;
export const REVIEW_RECHECK_LIMIT = REVIEW_RECHECK_DELAYS_MS.length;

export const REVIEW_SAVE_TEXT = {
  saving: '저장 중…',
  // 확정 버튼이 묶음에 따라 `확정하고 다음`/`모두 확정`으로 바뀌므로 버튼 이름 대신 `확정`으로 부른다.
  saved: '저장했어요 · 확정 전까지 바꿀 수 있어요',
  localChoice: '선택됨 · 확정할 때 적용',
  check: '최신 상태 확인',
  retry: '다시 시도',
} as const;

/**
 * 요청 결과를 알 수 없는 오류인지 판단한다. 네트워크 단절과 서버 응답 형식이 아닌 오류(빈 본문·프록시 오류 페이지 등)는
 * 서버가 이미 처리했을 수 있다. 클라이언트에서 막은 오류(`Error`)와 서버가 만든 오류 응답(`message`·`error`)은 실패로 본다.
 */
export function isResponseLost(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  if (error instanceof Error) return false;
  if (toApiError(error)) return false;
  return !(typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string');
}

export function unverifiedSaveMessage(attempt: number, final: boolean): string {
  if (final) return '저장 결과를 확인하지 못했어요. 최신 상태를 확인하거나 다시 시도해 주세요.';
  return `저장 결과를 확인하지 못했어요. 최신 상태를 확인하는 중이에요${attempt > 0 ? `(${attempt}/${REVIEW_RECHECK_LIMIT})` : ''}`;
}
