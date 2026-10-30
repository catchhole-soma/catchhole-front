import type { FlowAdapter } from '../fixture';

/*
 * 개선 어댑터(F1~F3 화면) 자리. 개선 화면이 머지된 뒤 V1에서 구현한다.
 * 예정 절차(gh211 V 브리프):
 * - A: 후보2·3 체크 → `선택 항목 연결` → 검색 `인물B` → 미리보기 확인 → 연결(현재 묶음 유지) →
 *   후보1 `캐릭터 연결 변경` → 검색 `인물H` → 연결 → 후보4 새 인물 → 각 그룹에서 현재 반영 선택 → `확정하고 다음`.
 * - B: 5행 체크 → `선택 항목 대상 연결` → 검색 1회 → 적용 → `확정하고 다음`.
 * - C: 선택 → 오류 → 자동 재확인으로 `저장했어요` 전이 확인(추가 조작 0 또는 수동 1회).
 * 끝 조건은 기준선과 같다(A: 4건 CONFIRMED, B: 5건 CONFIRMED, C: 해당 후보 reviewedApplicationMode 저장).
 */
const notImplemented = async () => {
  throw new Error('개선 어댑터는 아직 구현되지 않았습니다.');
};

export const improvedFlow: FlowAdapter = {
  name: 'improved',
  file: 'e2e/review-flow-metrics/flows/improved.ts',
  skipReason: '개선 화면(F1~F3)이 아직 없어 개선 어댑터는 V1에서 구현한다. 기준선은 METRICS_FLOW=baseline으로 실행한다.',
  scenarios: { A: notImplemented, B: notImplemented, C: notImplemented },
};
