import type { NavigateFunction } from 'react-router';

export type ReviewReturnState = {
  returnToAnalysisList?: unknown;
};

/**
 * 검토 진입 전 분석 목록으로 돌아간다.
 *
 * 검토 과정에서 query가 여러 번 replace되거나 새로고침되어도 history 깊이를 추측하지 않고
 * 진입 시 저장한 명시적 URL을 사용한다.
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
  navigate(savedUrl, { replace: true });
}
