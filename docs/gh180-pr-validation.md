# GH180 프론트 PR 검증 — 2026-09-13

최신 main `7cd479347c4c1f3448c876fe43f6667cb278f95d`의 이메일 가입, 접근성 개선,
세계관 공유 판단 수정 및 영상 Hero를 보존하며 회차별 자동 반영 흐름을 통합했다.
생성 SDK는 통합 Java API의 실제 `/v3/api-docs`에서 재생성했다.

- 단일 자동 반영 기본값, 직접 검토 선택, 다회차 10회 선행 조건 제거와 250,000자 제한을 검증했다.
- 자동 저장 완료 시각까지 결과 이동과 후보 변경을 잠그며, 이전 완료 회차의 검토는 유지한다.
- main의 기존 범위 병합 바로가기에도 연결된 후보 전체의 자동 저장 대기 잠금을 적용했다.
- 영상·추출 장면·CTA 시점은 그대로 두고 일반 서비스 설명을 자동 반영 기본값과 맞췄다.
- 업로드 카드와 미확정 안내 사이를 20px로 띄웠다. 현재 사이트와 PR 코드 모두 1280/320px에서 간격 20px·가로 넘침 없음을 확인했다.

## 검증

- `npm run build`: TypeScript와 production build 통과. 기존 bundle 크기 안내는 남아 있다.
- `npm run lint`: 오류 0, 기존 Fast Refresh 경고 2.
- `npm run check:unused`: 통과. 기존 Knip entry 중복 안내 1.
- `CATCHHOLE_E2E_PORT=3100 npm run test:e2e -- --workers=4`: 305 통과, 사전 계정이 필요한 live 2개 제외. 이전 완료 문구를 기대한 테스트 1개가 실패했다.
- 해당 기대 문구와 자동 저장 완료 시각 fixture를 현재 계약에 맞춘 뒤 `... npm run test:e2e -- e2e/upload-policy.spec.ts --workers=4`: 18개 전체 통과. 합쳐서 최종 306개 시나리오가 확인됐다.
- `npm run doctor`: 참고 검사 실행. 169개 진단(오류 분류 1 포함)을 모두 해결했다는 뜻은 아니다. 오류 분류가 가리킨 WorldSettingDatabase의 기존 선택 콜백은 이번 PR에서 변경되지 않았으며 광범위한 UI 정리는 별도 범위다. lint/typecheck/build 통과와 Doctor 무진단을 혼동하지 않는다.

[데스크톱 여백](screens/gh180-upload-spacing-1280.png) · [320px 여백](screens/gh180-upload-spacing-320.png)

검증은 합성 응답과 별도 브라우저 컨텍스트를 사용했다. 사용자의 로그인·작품·후보는 변경하지 않았다.
Java/API와 AI Worker의 새 계약을 먼저 반영한 뒤 이 프론트를 배포한다. 이 작업은 PR 생성이며 운영 배포를 수행하지 않는다.
