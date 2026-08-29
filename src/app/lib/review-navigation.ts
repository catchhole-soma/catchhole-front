import type { NavigateFunction } from 'react-router';

export type ReviewReturnState = {
  returnToAnalysisList?: unknown;
  returnHistoryDelta?: unknown;
};

/**
 * 검토 진입 전 분석 목록으로 돌아간다.
 *
 * 알려진 진입 흐름에서는 기존 history 항목으로 돌아가 중복 대시보드·완료된 진행 화면을
 * 남기지 않는다. 새로고침·직접 URL 진입처럼 history를 신뢰할 수 없으면 저장 URL을 사용한다.
 */
export function returnToAnalysisList(
  navigate: NavigateFunction,
  state: ReviewReturnState | null,
  fallbackUrl: string,
) {
  const savedUrl = typeof state?.returnToAnalysisList === 'string'
    && state.returnToAnalysisList
    ? state.returnToAnalysisList
    : fallbackUrl;
  const returnHistoryDelta = state?.returnHistoryDelta === -1 || state?.returnHistoryDelta === -2
    ? state.returnHistoryDelta
    : null;
  const historyIndex = (window.history.state as { idx?: number } | null)?.idx;
  if (returnHistoryDelta != null
    && typeof historyIndex === 'number'
    && historyIndex >= Math.abs(returnHistoryDelta)) {
    navigate(returnHistoryDelta);
    return;
  }
  navigate(savedUrl, { replace: true });
}

/** 완료된 설정 검토 route를 원고 목록으로 교체해 뒤로가기로 다시 열리지 않게 한다. */
export function replaceWithManuscriptList(
  navigate: NavigateFunction,
  workId: string,
) {
  navigate(`/dashboard?workId=${encodeURIComponent(workId)}&nav=manuscripts`, { replace: true });
}
