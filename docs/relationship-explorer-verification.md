# GH412 관계도 탐색 검증

- 기준: 2026-11-10 격리 작업 브랜치, 합성 데이터. 운영 원고·분석은 변경하지 않았다.
- `npm run build`: 통과. 기존 번들 크기 경고 유지.
- `npm run lint`: 오류 0, 기존 Fast Refresh 경고 2.
- `npm run test:layout`: 77 통과, 선택 실행 1 생략.
- `GH412_FIXTURE_INPUT=/tmp/gh412-explorer-contract.json CATCHHOLE_E2E_PORT=18412 npx playwright test e2e/episode-relationships.spec.ts e2e/relationship-explorer-contract.spec.ts --workers=2`: 40 통과.

`GH412_FIXTURE_OUTPUT=/tmp/gh412-explorer-contract.json ./gradlew test --tests '*EpisodeRelationshipGraphPostgresIntegrationTest'`로 실제 PostgreSQL/Flyway와 Spring MVC 응답을 생성한다. 브라우저 계약 검증은 이 응답을 그대로 재생한다. 운영 서버나 실제 네트워크 왕복을 측정한 테스트는 아니다. 인증/잘못된 페이지/없는 회차의 상태 코드도 서버 테스트에서 확인한다.

브라우저에서는 큰 관계도의 선택 화면, 초기 표시 밖 인물·별칭 검색, 한글 조합 중 요청 억제, 직접 관계 100개 페이지, 종료 관계, URL 복원, 뒤로가기, 320px, 기존 정정 초안·403/404·503·방향·복수 관계를 검증한다. 완료 상태의 정기 조회가 없고 명시적 새로고침 후에도 이동한 카드 위치가 유지되는지 확인한다.

![데스크톱 인물 선택](screens/gh412/explorer-desktop.png)

![320px 인물 선택](screens/gh412/explorer-mobile-320.png)

![실제 서버 응답의 검색과 원문 근거](screens/gh412/spring-postgres-explorer.png)

Pencil 활성 문서가 다른 작업 경로를 가리켜 `.pen` 동기화는 대기 중이다. `DESIGN.md`와 `design/PENCIL_MIGRATION.md`에 현재 UI 정책과 대기 사유를 기록했다.
