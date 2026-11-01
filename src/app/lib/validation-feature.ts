// 오류 리포트(신규 회차 검수)의 접수·중단 검사 재시도·재검수 진입점.
// 운영 규모(30회차 작품) 검수가 끝까지 도는 것을 로컬에서 확인할 때까지 기본 OFF이며,
// 빌드 시 VITE_EPISODE_VALIDATION_INTAKE_ENABLED가 정확히 'true'일 때만 켠다. 기존 리포트 보기는 플래그와 무관하다.
export const EPISODE_VALIDATION_INTAKE_ENABLED = import.meta.env.VITE_EPISODE_VALIDATION_INTAKE_ENABLED === 'true';

export const EPISODE_VALIDATION_PAUSED_MESSAGE =
  '오류 리포트(신규 회차 검수)는 점검 중이라 새 검수 접수와 재검수를 잠시 막아 두었어요. 기존 리포트는 계속 볼 수 있어요.';
