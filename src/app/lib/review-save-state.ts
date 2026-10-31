import { toApiError } from './api-errors';

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

/** 요청을 보내기 전에 화면이 거절한 쓰기(읽기 전용 검토·잘못된 입력 등). 서버에 닿지 않았으므로 확실한 실패다. */
export class ClientRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientRejectedError';
  }
}

/**
 * 요청 결과를 알 수 없는 오류인지 판단한다. 확실한 실패는 두 가지뿐이다.
 * - 서버가 돌려준 오류 응답(`ApiError`로 해석되는 본문, 또는 메시지가 있는 JSON 오류 본문)
 * - 요청을 보내기 전에 화면이 거절한 쓰기(`ClientRejectedError`)
 *
 * 그 밖의 오류는 서버가 이미 처리했을 수 있으므로 "결과 미확인"으로 보고 재조회로 판정한다. 네트워크 단절(`NetworkError`),
 * 응답 헤더를 받은 뒤 본문을 읽다 끊긴 경우(`TypeError`), 깨진 본문의 해석 실패(`SyntaxError`), 요청 중단(`AbortError`),
 * 프록시 오류 페이지처럼 해석할 수 없는 본문이 여기에 든다.
 */
export function isResponseLost(error: unknown): boolean {
  if (error instanceof ClientRejectedError) return false;
  if (toApiError(error)) return false;
  if (error instanceof Error) return true;
  return !(typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string');
}

export function unverifiedSaveMessage(attempt: number, final: boolean): string {
  if (final) return '저장 결과를 확인하지 못했어요. 최신 상태를 확인하거나 다시 시도해 주세요.';
  return `저장 결과를 확인하지 못했어요. 최신 상태를 확인하는 중이에요${attempt > 0 ? `(${attempt}/${REVIEW_RECHECK_LIMIT})` : ''}`;
}
