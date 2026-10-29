# 회차별 인물 관계도 화면·검증 (#323)

공통 데이터·운영 계약은 [회차별 인물 관계도 계약](episode-relationships.md)을 따른다.

## 화면과 출처

`/dashboard?workId=<id>&nav=graph&relationMode=people`에서 분석한 회차를 선택한다. 기본은 최신 관계 분석이 반영된 회차다. 선택한 회차까지 드러난 이름, 관계 설명과 근거만 표시한다. 이전 회차를 고르면 당시 알 수 없었던 정체나 뒤 회차의 근거를 가져오지 않는다. 회차 선택 목록은 번호만 표시한다.

가계도는 기존 기본 진입점과 URL·조회·후보 검토를 유지한다. 두 종류의 공통 탭만 `RelationshipWorkspace`로 옮겼다. 인물 관계도에는 후보 확정·애매함 판단·필수 검토 목록을 만들지 않는다. 가족 후보를 인물 관계로 변환하지 않는다.

## URL과 조회

- `relationMode=people`: 인물 관계도. 없으면 가계도.
- `relationEpisode=N`: 이 회차까지의 관계. 없으면 최신 반영 회차.
- `relationFocus=<nodeId>`: 해당 인물과 직접 연결된 관계를 중심으로 보기.
- `relationEdge=<edgeId>`: 선택한 연결의 회차별 설명·인용을 바로 펼친다.
- 다른 메뉴로 나갈 때 가족·일반 관계 선택을 함께 정리한다. 명시적 관계 화면 OFF에서도 동일하게 제거한다.

생성 SDK의 `getEpisodeRelationshipGraph`와 `getEpisodeRelationshipEdge`를 사용한다. 회차는 Query key에 포함하고 이전 회차의 데이터를 placeholder로 사용하지 않는다. 최신 보기는 10초 갱신과 창 포커스 갱신을 사용한다. 특정 회차는 분석 중일 때만 주기 조회하며 포커스 갱신은 유지한다. 성공 응답이 없는 경우 예시 데이터로 대체하지 않는다.

서버가 회차 기준으로 제공한 노드 이름·프로필 등록 여부만 사용한다. 현재 캐릭터 목록·상세·이미지 API를 추가로 조회하지 않으며, 인물 카드는 해당 인물의 연결을 강조한다. 프로필 미등록도 근거가 명확하면 표시할 수 있지만 프론트가 동일 인물로 합치거나 프로필을 생성하지 않는다.

## 그림과 근거

연결된 묶음을 나누고 각 묶음에서 중심 인물 주변으로 배치한다. 배치의 높이·좌우 위치는 가족 관계나 서열을 뜻하지 않는다. 같은 쌍의 여러 관계를 별도 선으로 유지한다. `DIRECTED`는 한 방향 화살표, `MUTUAL`은 양방향, `UNDIRECTED`는 화살표 없는 선이다. 종료된 관계는 점선과 `종료` 표기를 함께 사용한다.

관계의 짧은 이름을 누르거나 그림 아래 목록의 두 인물을 누르면 같은 근거를 펼친다. 상세는 두 이름을 동일하게 강조하고 설명, 회차, 실제 인용을 같은 흰 표면에 표시한다. 근거 안에 또 다른 근거 버튼을 넣지 않는다. 키보드로 접근 가능한 목록은 작은 화면의 대안도 된다.

회차를 바꾸면 현재 선택과 중심 인물을 정리한다. 같은 회차를 갱신하거나 연결을 선택할 때에는 확대·이동 위치를 초기화하지 않는다. 회차·중심 인물 또는 화면 크기가 바뀔 때 전체 보기를 다시 맞춘다.

## 선택적 정정

`설명 수정`은 AI가 잘못 읽은 설명을 정정하는 행동이다. 작품 속 관계의 실제 변화·종료를 입력하는 기능이 아니다. 서버의 `expectedVersion`과 함께 저장하며 모든 회차의 해당 관계 설명에 적용됨을 편집창에서 알린다.

`이 연결 삭제`는 인물이나 원문을 지우지 않고 잘못된 연결을 모든 회차에서 제외한다. 확인 후 DELETE를 한 번 실행하고 서버의 자동 복원 방지 기록을 유지한다. 저장 실패와 409에서 초안을 보존한다. 409에서는 최신 내용을 조회한 뒤 사용자가 `변경 내용 확인`으로 기준 버전을 받아들여야 재시도할 수 있다. 조회만으로 버전이나 초안을 자동 채택하지 않는다. 세션 변경·이탈 뒤 늦은 mutation 응답으로 화면을 변경하지 않는다. 생성 Query key에 인증 세션 태그를 붙이고 비활성 캐시를 즉시 정리해 다른 계정에 직전 이름·근거를 재사용하지 않는다.

## 검증

- `scripts/episode-relationship-layout.test.ts`: 큰 별 모양 묶음과 독립 묶음의 노드 겹침, 안정된 배치, 같은 쌍의 복수 선 보존.
- `e2e/episode-relationships.spec.ts`: 최신 기본값, 회차 URL·뒤로가기, 미래 이름·인용 차단, 늦은 응답, 중심 강조, 가족·현재 프로필 API 미호출, 정정 충돌, 삭제, 실패 재시도, 320px 및 데스크톱 캡처.
- 가족 관계 기존 회귀와 명시적 OFF 회귀를 별도로 실행한다.
- 목 응답 기반 UI 검증과 실제 API·DB·LLM 검증은 구분해서 기록한다.

### 2026-10-29 프론트 검증 기록

- `npm run lint`: 오류 0, 기존 Fast Refresh 경고 2개.
- `npm run typecheck`, `npm run build`, `git diff --check`: 통과. 빌드의 기존 청크 크기 경고는 유지.
- `npm run test:layout`: 기존 가계도 37개 + 인물 배치 3개, 40개 통과.
- 전체 Playwright ON 실행: 836개 통과, 20개 건너뜀, 1개 실패. 실패는 `smoke.spec.ts`의 인물 관계도 `disabled` 기대가 기존 업데이트 예정 상태를 가정해서 발생했다. 새 탭 진입·빈 상태를 검증하도록 갱신한 뒤 해당 테스트 1개 재실행 통과.
- 최종 인물 관계도 전용 Playwright 9개 통과. 세션 변경 시 이전 이름·근거 제거, 같은 두 사람 사이 양방향 관계와 종료된 일방 관계의 선 분리도 포함한다.
- 명시적 OFF Playwright 4개 통과. 새 회차·중심 인물·연결 URL도 제거하고 관계 API를 호출하지 않는다.
- `npm run check:unused`: 기존 `e2e/episode-source-list.ts`, `scripts/analysis-list-benchmark.mjs` 2개 미사용 파일로 실패. 새 코드의 미사용 항목은 없었다.
- `npm run doctor`: 저장소 전체 기존 진단을 포함해 234건을 보고했다. 새 근거 목록의 index key는 출처 회차·인용 범위·인용문 key로 수정했다. 신규 화면의 복잡도 경고는 조건별 데이터·오류 처리에 관한 참고 진단이며, 기존 세계관 상태 갱신 오류 2개는 이 작업에서 수정하지 않았다.
- 실제 Java MVC에서 내보낸 OpenAPI로 SDK를 생성했다. 최신 Java main에 이미 추가된 `ERROR_REVIEW_*` 회차 상태 4개의 표기만 `AnalysisList`에 보완했다. 새 오류 검수 동선을 구현한 것은 아니다.

캡처는 [데스크톱](screens/gh323/episode-relationships-desktop.png), [320px 관계도](screens/gh323/episode-relationships-mobile-320.png), [320px 인용](screens/gh323/episode-relationships-evidence-mobile-320.png)에 있다. 모두 합성 목 데이터로 시각 검증했다. 실제 API 검증 결과는 아래에 별도로 기록한다.


### 실제 브라우저 → Spring → 격리 PostgreSQL

`e2e/episode-relationships-live.spec.ts` 1개가 실제 API로 통과했다. Backend 전용 테스트에서 만든 두 회차·세 인물의 합성 작품만 사용했으며 기존 로컬 DB와 사용자 작품은 변경하지 않았다.

- 최신 2화에서 관계 3개, 1화에서 당시 활성 동행 1개와 인용 1개만 표시했다. 2화의 새 인물 세린·관계 종료 상태가 1화에는 노출되지 않았다.
- 2화의 아라 → 보라 경계 설명을 화면에서 수정해 PATCH 200을 확인했다. 브라우저 새로고침과 별도 GET에서 동일한 정정값을 다시 읽었다.
- 아라 ↔ 세린 친구 연결을 화면에서 삭제해 DELETE 200을 확인했다. 새로고침과 별도 GET에서 해당 연결이 제외되고 나머지 2개 관계와 정정값이 유지됐다.
- 실제 Backend가 발급한 테스트 JWT를 로컬 저장소에 넣었고 브라우저 관계 요청의 Bearer 전송을 확인했다. 이 검증은 로그인·refresh 쿠키 발급을 다시 실행한 테스트가 아니며, 주입 방식상 refresh 쿠키가 없음을 확인했다.
- 재현은 격리 fixture를 새로 만든 뒤 `VITE_API_BASE_URL=http://localhost:18233 CATCHHOLE_E2E_PORT=3324 CATCHHOLE_RELATIONSHIP_LIVE_FIXTURE=<0600 fixture JSON 경로> npx playwright test e2e/episode-relationships-live.spec.ts --workers=1`로 실행한다. fixture 경로를 생략하면 테스트는 건너뛴다. 테스트는 합성 연결을 수정·삭제하므로 기존 작품에 사용하지 않는다.
- 이 브라우저 테스트는 관계 LLM 추출 품질을 평가하지 않는다. Worker 실호출과 DB 행 직접 확인은 Backend·AI 검증 기록을 함께 본다.

Backend가 격리 DB 행도 직접 확인했다. 경계 연결은 `corrected_summary`에 정정문과 `version=2`가 저장됐고, 친구 연결은 `suppressed=true`, `version=2`였다. 실제 화면 캡처는 [1화](screens/gh323/episode-relationships-live-episode-1.png)와 [저장 후 근거](screens/gh323/episode-relationships-live-correction.png)에 있다.
