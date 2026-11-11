import { useFirstAnalysisCompletionReport } from '../../hooks/useFirstAnalysisCompletionReport';

/** 로그인한 화면에 한 번 두어 첫 분석 완료 GA4 이벤트를 보낼 차례인지 확인한다. 화면에는 아무것도 그리지 않는다. */
export function FirstAnalysisCompletionReporter() {
  useFirstAnalysisCompletionReport();
  return null;
}
