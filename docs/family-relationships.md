# GH260 관계도 — 가족 관계 목록과 검토

관계 화면은 기본 OFF다. `VITE_RELATIONSHIP_WORKSPACE_ENABLED`가 정확히 문자열 `true`인 빌드에서만 사이드바 `관계도` 메뉴와 `/dashboard?workId=<id>&nav=graph`의 가족 관계 목록·검토를 연다. 미설정·`false`·그 외 값은 OFF이며, 기존 main 화면처럼 좌측 `그래프 뷰 · 업데이트 예정`과 작품 설정의 `관계도 · 업데이트 예정` 안내만 유지한다. OFF에서는 신규 가족 관계 탭이나 관계 화면을 제공하지 않는다. 이 정책은 아래 날짜별 메뉴 통합·검증 기록보다 우선한다.

ON 화면은 현재 PROFILE을 바탕으로 정리한 가족 관계를 보여주며 작품 설정 안에 가족 관계 탭을 중복 노출하지 않는다. 확정한 설정과 직접 수정한 설정을 동일한 현재 설정 입력으로 사용한다. 기존 AI 추출·설정 후보 검토 옵션과 집계는 바꾸지 않는다. 명확한 가족 관계는 서버가 자동 반영하며, 대상·의미·시점이 모호한 내용은 `확인 필요`로 모은다. 그림 가계도와 일반 인간관계는 GH261 이후 범위다.

이 플래그는 프론트 화면의 노출 조건이다. Backend 자동 후처리·관계 API·DB는 유지하며 인증과 작품 소유권 검증을 대신하지 않는다. 배포 시 기존 작품 전체를 자동 정리하는 백필은 아직 구현하지 않았으며, 화면을 켜는 것만으로 기존 데이터의 일괄 처리가 시작되지는 않는다.

## 화면과 URL

OFF에서는 `nav=graph`, 이전 `nav=settingDB&tab=relations`, nav 없이 `tab=relations`만 있는 직접 주소를 `nav=settingDB&tab=characters`로 replace한다. 작품 선택을 유지하고 관계 전용 보기·페이지·후보·관계·원문 파라미터를 정리한다. 관계 컴포넌트를 열거나 관계 API를 호출하지 않는다.

ON에서 `nav=graph`가 관계도의 진입점이다. 이전 `nav=settingDB&tab=relations` 링크와 nav 없이 `tab=relations`만 있는 링크는 `nav=graph`로 방문 기록을 replace하고 `tab`만 제거한다. `workId`와 아래 보기·페이지·선택 항목은 그대로 보존하므로 공유 링크, 새로고침과 뒤로가기에서 같은 검토 문맥으로 이어진다.

- `relationView=list|review`: 가족 관계 목록 / 확인 필요. 생략하면 목록이다.
- `relationPage`: 각 보기의 1부터 시작하는 서버 페이지. 보기 전환 시 초기화한다.
- `relationshipCandidate`: 검토 후보 상세. 새로고침·뒤로가기로 복원한다.
- `relationshipId`: 펼친 관계의 근거. 목록 페이지에 없는 직접 링크도 상세 API로 조회하며, 독립 카드에 양쪽 인물·관계 종류·세부 종류·시점·유효 상태를 근거와 철회 액션보다 먼저 표시한다.
- `relationshipFactId`: 원문 근거 모달. 선택한 Fact의 기존 evidence API만 요청한다.

서버 페이지 수가 줄면 마지막 유효 페이지로 복귀한다. 작품 변경 시 컴포넌트를 새로 구성하고 이전 요청 결과가 새 작품의 화면을 바꾸지 않게 한다. 사이드바에서 다른 메뉴로 나가면 관계 보기·페이지·선택 상세·원문 키를 지운다. 작은 화면에서는 보기 버튼을 native select로 바꾸고 폼과 액션을 한 열로 표시한다.

요청 결과는 시작 때의 로그인 세션 번호(`privateImageSessionEpoch`)와 현재 번호가 같고 화면이 유지될 때만 반영한다. 정상 access token 갱신은 같은 세션이므로 성공 결과를 적용한다. 로그아웃·새 로그인·계정 변경 뒤에는 늦은 성공과 오류, 로딩 상태 변경을 무시하며 비운 캐시에 이전 작품 데이터를 다시 넣지 않는다.

## 처리 상태와 집계

ON 화면에서 GET `relationship-processing`을 생성 SDK로 호출하고 `NEVER_PROCESSED`, `PENDING`, `SUCCEEDED`, `FAILED`를 로딩/재시도와 구분해 표시한다. 처리 중 3초, 그 외 30초 간격으로 상태를 확인하고 입력/완료 상태가 바뀌면 목록을 갱신한다. `현재 설정에서 관계 찾기` 상시 버튼은 제공하지 않으며, `FAILED` 안내 안에서만 현재 데이터를 유지한 채 `관계 정리 다시 시도`를 제공한다. 이 액션의 POST는 현재 설정의 관계 정리만 요청하며 AI 작업을 만들지 않는다. `NEVER_PROCESSED`·`PENDING`·`SUCCEEDED`에는 처리 요청 버튼이 없다. OFF에서는 상태 조회와 재시도도 호출하지 않는다.

재시도 요청의 응답이 실패했더라도 이후 상태 조회가 `PENDING` 또는 `SUCCEEDED`를 확인하면 이전 요청 오류를 지운다. 조회가 실패하거나 여전히 `FAILED`이면 오류를 유지한다. 상태 복구 확인이 늦은 요청 오류보다 먼저 도착한 경우도 복구된 상태를 우선한다.

`autoConfirmedCount`와 `reviewRequiredCount`는 **최근 처리 실행에서 발견한 개수**다. `확인 필요`의 현재 개수는 `relationship-candidates?status=PENDING`의 `totalElements`만 사용한다. `unsupportedSourceCount`는 명시적 형식으로 읽지 못한 설정 수이며 관계가 없다는 뜻으로 표시하지 않는다. 원래 설정 검토 화면의 대기 개수에는 더하지 않는다.

## 후보 검토와 동시 변경

서버가 제공한 후보의 주체·상대 이름, 현재 설정값, 직접 수정 여부, 근거 현재성을 표시한다. 표시값과 세부 설정값이 다르면 둘 다 보여주고, 추가 속성은 펼쳐 읽을 수 있게 한다. 상대는 작품의 인물 API를 페이지별로 조회해 직접 선택하며 같은 이름을 자동으로 연결하지 않는다. 종류·세부 종류·서술 의미·시점·시점 설명·원문 호칭을 수정하고, `수정 저장` 성공 후 `관계에 반영`한다. `ASSERTED`, 알려진 상대/시점, 유효 근거, 보류 사유 없음이 모두 필요하다. 이전에 철회한 관계처럼 내용은 맞지만 자동화가 보류한 후보도 `검토 내용 저장`으로 명시적으로 재검토할 수 있다. 서버가 최종 순환·보관·동시 변경 검증을 한다. 후보 제외는 관계 확정과 별개 결정이다.

후보 `expectedVersion`과 근거 `sourceToken`은 편집 시작 때의 값을 보낸다. 저장/결정 실패 시 초안을 유지하고 자동 재시도하지 않는다. 다른 곳에서 후보가 바뀌면 저장을 잠근다. `현재 설정 다시 확인`은 최신 후보와 현재 두 인물의 PROFILE 근거를 조회하지만 입력과 선택된 옛 토큰을 바꾸지 않는다. 사용자가 현재 설정 체크박스를 명시적으로 선택해야 그 Fact의 토큰을 교체한다. 현재 슬롯에서 사라진 기존 근거는 명시적으로 제거할 수 있다. 근거는 1~20개, 호칭과 시점 설명은 각 200자까지다.

저장·결정·명시적 현재 설정 확인의 성공 응답은 후보 상세 캐시에도 반영한다. 후속 조회가 느리거나 실패해도 본인의 성공 응답을 외부 변경으로 오인하지 않는다. 진행 중인 이전 상세 조회는 취소하고, 이미 조회한 더 높은 버전은 성공 응답으로 되돌리지 않아 실제 외부 변경의 잠금을 유지한다. 현재 설정 확인은 계속 초안과 선택한 근거 토큰을 보존한다.

자동 처리 상태가 그대로여도 다른 창의 수동 검토를 감지하도록 현재 대기 개수, 보고 있는 검토 목록, 열린 `PENDING` 후보를 5초마다 조회하고 창 복귀 시에도 확인한다. 후보 상세를 열면 목록 주기 조회는 멈추되 현재 대기 개수와 해당 후보는 계속 확인한다. 숨겨진 창에서는 주기 조회를 멈추고, 확정/제외된 후보나 닫힌 상세는 주기 조회하지 않는다. 다른 창에서 확정/제외해 목록이 줄어들면 현재 대기 개수와 마지막 유효 페이지도 함께 갱신한다. 최신 조회 결과는 초안과 편집 기준 버전을 덮어쓰지 않는다. 버전이나 상태가 바뀌면 결정을 잠그며 사용자가 다시 확인한 뒤에만 새 버전으로 저장한다. 조회 사이의 동시 수정도 서버의 `expectedVersion` 검증으로 보호한다.

관계 목록에는 현재/과거·철회·근거 변경·보관 상태를 모두 표시한다. 이전 근거도 `hasEvidence`가 참이면 원문을 볼 수 있으며, `current=false` 근거에 현재 프로필 내용을 대신 표시하지 않는다. 잘못 확정한 관계는 철회할 수 있다. 작품 속 이혼·관계 종료는 캐릭터 설정을 고쳐 정리할 내용이며 철회와 구분해 안내한다. 정정 API를 사용하는 직접 관계 재작성 UI는 이번 범위에 없다.

보고 있는 관계 목록과 열린 관계 상세도 5초 간격 및 창 복귀 시 조회해 다른 창의 수동 확정·철회를 반영한다. 대기 개수가 바뀌지 않는 철회도 감지하며 목록 밖 직접 링크의 상세에도 같은 규칙을 적용한다. 다른 보기와 숨겨진 창에서는 주기 조회하지 않고 철회가 확인된 상세의 주기 조회는 멈춘다.

## 구현과 검증

`relationship/FamilyRelationshipWorkspace.tsx`, `RelationshipCandidateEditor.tsx`, `RelationshipTargetPicker.tsx`, `RelationshipEvidence.tsx`, `relationships-v2.css`가 화면을 구성한다. Backend와 공유하는 실행 가능한 parser 예시는 [family-relationship-processing-v1.json](contracts/family-relationship-processing-v1.json)의 32건이다. name/display/value 충돌·명시 관계·보류 이유와 과거/불확실한 항목 이름을 고정하며 Front에서 parser를 중복 구현하지 않는다. 모든 요청·응답 타입과 query option은 Java `/v3/api-docs`로부터 `npm run api:generate`한 SDK를 사용한다.

- `e2e/relationship-feature-off.spec.ts`: 기본 OFF 실행에서 데스크톱·320px의 기존 업데이트 예정 안내, 관계 직접 주소의 캐릭터 설정 이동과 관계 API 미호출을 확인한다. ON 실행에서는 건너뛴다.
- `e2e/family-relationships.spec.ts`: ON을 명시한 별도 실행에서 자동/대기 집계 분리, 기존 원문 lazy 조회, 같은 이름의 페이지 선택, 수정 후 확정, 버전·근거 충돌의 입력 보존과 명시적 토큰 교체, 저장/제외 재시도, AI 요청 없음, 320px와 URL 복원을 확인한다. 정상 인증 갱신 뒤 조회/수정/확정/제외/실패 재시도/철회 성공, 실제 세션 변경·작품 이탈 뒤 늦은 응답 차단, 다른 창의 수동 수정/확정과 창 복귀 감지도 대상이다. 상시 처리 요청 버튼은 없고 FAILED에서만 재시도하는 계약을 포함한다. 기본 OFF 실행에서는 건너뛴다.
- `e2e/family-relationships-live.spec.ts`: ON을 명시한 별도 실행에서 전용 localhost 계정·작품에 이름만 있는 인물을 준비하고 public 캐릭터 PATCH로 현재 설정을 저장한다. 자동 배우자 반영, 미해결 부모 후보, 화면 수정·확정, 원본 설정 변경 후 유효성 저하, 제외 후 API 재처리, 철회를 실제 API·PostgreSQL 경로로 재조회한다. 계정과 작품은 기존 `local-live-fixture.ts`가 public purge 완료 후 정리한다. AI 재추출 품질 검증은 포함하지 않는다. 기본 OFF 실행에서는 건너뛴다.

실행 시 기존 서버를 재사용하지 않도록 별도 포트를 지정한다. live 계정/DB 변수는 [로컬 live 테스트 문서](local-image-live-tests.md)의 `CATCHHOLE_E2E_*`를 사용한다. `VITE_API_BASE_URL`과 `CATCHHOLE_E2E_API_BASE_URL`은 같은 격리 API 주소여야 하며 `NO_PROXY`/`no_proxy`에 localhost를 포함한다. 토큰·비밀번호·DSN은 캡처나 문서에 기록하지 않는다.

```sh
# 기본 OFF 화면: 전체 기본 E2E에도 포함
VITE_RELATIONSHIP_WORKSPACE_ENABLED=false CATCHHOLE_E2E_PORT=3106 npm run test:e2e -- e2e/relationship-feature-off.spec.ts --workers=1
# 관계 화면 미리보기 ON을 명시한 별도 실행
VITE_RELATIONSHIP_WORKSPACE_ENABLED=true CATCHHOLE_E2E_PORT=3107 npm run test:e2e -- e2e/family-relationships.spec.ts --workers=1
# 사전 설정한 localhost API/DB/seed 환경에서 실행
VITE_RELATIONSHIP_WORKSPACE_ENABLED=true CATCHHOLE_E2E_PORT=3108 npm run test:e2e -- e2e/family-relationships-live.spec.ts --workers=1
```

브라우저 검토 캡처: [데스크톱](screens/gh260/family-relationships-desktop.png), [320px 후보](screens/gh260/family-review-mobile-320.png), [320px 하단 액션·키보드 초점](screens/gh260/family-review-mobile-actions-320.png).

2026-10-17 검증: 관계 목 E2E 8개, 기존 대시보드/모바일 39개, 실제 localhost PostgreSQL 연동 1개를 통과했다. lint 오류 0(기존 Fast Refresh 경고 2), typecheck/build/Knip 통과. Doctor 193개 진단 중 오류 2개는 기존 WorldSettingDatabase 진단이며 전체 통과로 해석하지 않는다. [실제 자동 반영 화면](screens/gh260/family-live-desktop.png), [실제 철회 결과 320px](screens/gh260/family-live-mobile-320.png). Pencil 동기화는 연결 복구 전까지 대기한다.

2026-10-19 PR 검토 보완: 수정 전 인증 갱신 후 근거 조회 결과가 누락되는 사례와 처리 상태가 그대로인 외부 수정을 놓치는 사례를 각각 실패로 재현했다. 수정 후 관계 목 E2E 18개와 기존 인증 smoke 5개를 통과했다. lint 오류 0(기존 경고 2), typecheck/build/Knip 통과, Doctor는 기존과 같은 193개 진단/오류 2개다. API 계약 변경은 없으며 이 보완에서는 localhost 실연동을 재실행하지 않았다. 공유 parser fixture 32건은 Backend 파일과 동일하다.

### 2026-10-19 관계도 메뉴 통합

기존 좌측 `그래프 뷰`를 `관계도`로 활성화하고 가족 관계 목록·검토의 진입점을 `nav=graph`로 옮겼다. 위 2026-10-17 검증·캡처와 2026-10-19 PR 검토 보완 기록은 당시 동선을 보존한다. 이번 변경은 메뉴·URL 통합이며 기존 API와 처리·편집·근거 확인 동작을 유지한다. 부모에서 자녀를 아래로 배치하는 그림 가계도 구현은 포함하지 않는다.


2026-10-19 관계도 메뉴 통합 검증: 관계 목 E2E 23개와 smoke·챗봇 UI 42개, 총 65개를 통과했다. 기존 관계 링크의 후보·관계·원문·페이지 선택과 replace 이동, 데스크톱/320px 메뉴 진입, 메뉴 이탈 후 늦은 응답 차단을 확인했다. lint 오류 0(기존 경고 2), typecheck/build/Knip 통과. Doctor는 기존과 같은 진단 193개/오류 2개이며 이번 범위 밖의 WorldSettingDatabase 진단을 포함한다. [관계도 메뉴 데스크톱](screens/gh260/relationship-navigation-desktop.png)과 [320px 후보 검토](screens/gh260/relationship-navigation-mobile-320.png)를 확인했다. 이번 변경은 메뉴·URL·화면 배치만 다루며 실제 API 계약과 DB는 바꾸지 않았고 실연동 시나리오는 재실행하지 않았다. Pencil 도구가 현재 세션에 없어 디자인 소스 동기화는 기존 대기 상태를 유지한다.

### 2026-10-19 기본 OFF 노출 정책 — 메뉴 통합 후속 결정

위 메뉴 통합 결과를 기본 배포 화면에서 숨기고 `VITE_RELATIONSHIP_WORKSPACE_ENABLED=true`일 때만 열도록 전환한다. OFF에서는 기존 그래프 뷰·관계도 업데이트 예정 안내를 복원하고 관계 직접 주소도 캐릭터 설정으로 돌린다. ON에서도 상시 관계 찾기 버튼을 제거하며 FAILED 안내의 재시도만 유지한다. 이 결정은 앞선 날짜별 검증·캡처를 삭제하거나 새 정책의 검증 결과로 재사용하지 않는다. Backend 자동 후처리·API·DB와 기존 후보 결정은 유지하며 운영 자동 백필은 별도 후속 범위다.


2026-10-19 기본 비공개 검증: 플래그 미설정 OFF 전용 E2E 4개, ON 가족 관계 E2E 26개, 기본 OFF smoke·챗봇 UI 42개가 통과했다. 설정 검색 → 원고 목록 → 작품 설정 → 설정 검색의 검색어·페이지 복원도 OFF/ON 각 1회 통과했다. OFF 직접 링크의 캐릭터 설정 복귀와 관계 API 요청 0회를 확인했으며, ON의 NEVER_PROCESSED/PENDING/SUCCEEDED 상태에는 수동 처리 버튼이 없고 FAILED 안내에서만 재시도할 수 있다. lint 오류 0(기존 경고 2), typecheck/build/Knip 통과, Doctor 기존 193개 진단/오류 2개다. [기본 화면 데스크톱](screens/gh260/relationship-feature-off-desktop.png), [기본 화면 320px](screens/gh260/relationship-feature-off-mobile-320.png), [상시 처리 버튼 없는 미리보기](screens/gh260/relationship-preview-no-reprocess.png)를 확인했다. 기본 빌드에서는 UI를 공개하지 않으며, 로컬 3000도 별도 opt-in 없이 기존 예정 화면을 유지한다. 이 변경의 실제 API·DB 연동 시나리오는 재실행하지 않았다.

### 2026-10-19 추가 리뷰 — 직접 링크 식별과 다른 창의 검토 반영

목록 밖의 관계 직접 링크에 양쪽 인물·종류·시점·상태가 빠지는 문제와, 다른 창에서 확정/제외한 후보가 목록·대기 개수에 남는 문제를 수정했다. 수정 전 신규 회귀 5개가 모두 실패했고 수정 후 ON 가족 관계 E2E 31개와 기본 OFF E2E 4개가 통과했다. 다른 창의 확정·제외, 관계 목록의 대기 배지, 숨긴 창의 주기 조회 중단과 복귀 직후 갱신, 21→20건 감소 시 2→1페이지 보정을 확인했다. 목록 밖 관계는 실제 20개 페이지 밖의 상세를 별도로 읽고 식별 정보를 확인한 뒤 표시된 버전으로 철회한다.

lint 오류 0(기존 Fast Refresh 경고 2), typecheck/build/Knip 통과. Doctor는 기존과 같은 193개 진단/오류 2개이며 WorldSettingDatabase의 기존 진단이다. UI는 계속 기본 OFF다. API 계약·DB 변경이 없어 이번 프론트 보완에서는 실제 API·DB 연동을 재실행하지 않았으며, 위 날짜별 과거 검증 기록을 이번 실행 결과로 합산하지 않는다.

### 2026-10-19 후속 리뷰 — 관계 갱신·저장 성공·처리 복구

관계 목록과 열린 상세의 다른 창 확정·철회 갱신, 후보 저장과 현재 설정 재확인 성공 뒤의 오인 잠금, 서버 복구 뒤에도 남는 재시도 오류를 보완했다. 신규 회귀 5개는 수정 전 모두 실패했고 수정 후 ON 가족 관계 전체 36개와 기본 OFF 4개가 통과했다. 늦은 구버전 상세 조회, 성공 뒤 후속 조회 지연·실패, 실제 외부 새 버전의 초안 잠금, 숨긴 창의 조회 중단, 복구 조회보다 늦게 도착한 POST 실패도 확인했다.

lint 오류 0(기존 경고 2), typecheck/build/Knip 통과. Doctor는 194개 진단/기존 오류 2개이며 복구 상태에 따라 이전 요청 오류를 지우는 effect에 패턴 경고 1개가 추가됐다. 조건부 해제의 이유와 회귀 근거는 [Doctor 검토 기록](react-doctor-cleanup.md)에 남겼으며 진단을 숨기지 않았다. 기본 OFF와 API·DB 계약은 유지하며 이번 화면 상태 보완에서 실제 API·DB 연동은 재실행하지 않았다.
