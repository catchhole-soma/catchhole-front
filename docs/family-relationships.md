# GH260 가족 관계 목록과 검토

`/dashboard?workId=<id>&nav=settingDB&tab=relations`에서 현재 PROFILE을 바탕으로 정리한 가족 관계를 본다. 확정한 설정과 직접 수정한 설정을 동일한 현재 설정 입력으로 사용한다. 기존 AI 추출·설정 후보 검토 옵션과 집계는 바꾸지 않는다. 명확한 가족 관계는 서버가 자동 반영하며, 대상·의미·시점이 모호한 내용은 이 화면의 `확인 필요`로 모은다. 그림 가계도와 일반 인간관계는 GH261 이후 범위다.

## 화면과 URL

- `relationView=list|review`: 가족 관계 목록 / 확인 필요. 생략하면 목록이다.
- `relationPage`: 각 보기의 1부터 시작하는 서버 페이지. 보기 전환 시 초기화한다.
- `relationshipCandidate`: 검토 후보 상세. 새로고침·뒤로가기로 복원한다.
- `relationshipId`: 펼친 관계의 근거. 목록 페이지에 없는 직접 링크도 상세 API로 조회한다.
- `relationshipFactId`: 원문 근거 모달. 선택한 Fact의 기존 evidence API만 요청한다.

서버 페이지 수가 줄면 마지막 유효 페이지로 복귀한다. 작품 변경 시 컴포넌트를 새로 구성하고 이전 요청 결과가 새 작품의 화면을 바꾸지 않게 한다. 다른 설정 탭으로 나가면 선택 상세·원문 키를 지운다. 작은 화면에서는 보기 버튼을 native select로 바꾸고 폼과 액션을 한 열로 표시한다.

요청 결과는 시작 때의 로그인 세션 번호(`privateImageSessionEpoch`)와 현재 번호가 같고 화면이 유지될 때만 반영한다. 정상 access token 갱신은 같은 세션이므로 성공 결과를 적용한다. 로그아웃·새 로그인·계정 변경 뒤에는 늦은 성공과 오류, 로딩 상태 변경을 무시하며 비운 캐시에 이전 작품 데이터를 다시 넣지 않는다.

## 처리 상태와 집계

GET/POST `relationship-processing`을 생성 SDK로 호출한다. POST는 현재 설정의 관계 정리만 요청하며 AI 작업을 만들지 않는다. `NEVER_PROCESSED`, `PENDING`, `SUCCEEDED`, `FAILED`를 로딩/재시도와 구분해 표시한다. 처리 중 3초, 그 외 30초 간격으로 상태를 확인하고 입력/완료 상태가 바뀌면 목록을 갱신한다. 실패 시 현재 데이터와 수동 재시도 버튼을 유지한다.

`autoConfirmedCount`와 `reviewRequiredCount`는 **최근 처리 실행에서 발견한 개수**다. `확인 필요`의 현재 개수는 `relationship-candidates?status=PENDING`의 `totalElements`만 사용한다. `unsupportedSourceCount`는 명시적 형식으로 읽지 못한 설정 수이며 관계가 없다는 뜻으로 표시하지 않는다. 원래 설정 검토 화면의 대기 개수에는 더하지 않는다.

## 후보 검토와 동시 변경

서버가 제공한 후보의 주체·상대 이름, 현재 설정값, 직접 수정 여부, 근거 현재성을 표시한다. 표시값과 세부 설정값이 다르면 둘 다 보여주고, 추가 속성은 펼쳐 읽을 수 있게 한다. 상대는 작품의 인물 API를 페이지별로 조회해 직접 선택하며 같은 이름을 자동으로 연결하지 않는다. 종류·세부 종류·서술 의미·시점·시점 설명·원문 호칭을 수정하고, `수정 저장` 성공 후 `관계에 반영`한다. `ASSERTED`, 알려진 상대/시점, 유효 근거, 보류 사유 없음이 모두 필요하다. 이전에 철회한 관계처럼 내용은 맞지만 자동화가 보류한 후보도 `검토 내용 저장`으로 명시적으로 재검토할 수 있다. 서버가 최종 순환·보관·동시 변경 검증을 한다. 후보 제외는 관계 확정과 별개 결정이다.

후보 `expectedVersion`과 근거 `sourceToken`은 편집 시작 때의 값을 보낸다. 저장/결정 실패 시 초안을 유지하고 자동 재시도하지 않는다. 다른 곳에서 후보가 바뀌면 저장을 잠근다. `현재 설정 다시 확인`은 최신 후보와 현재 두 인물의 PROFILE 근거를 조회하지만 입력과 선택된 옛 토큰을 바꾸지 않는다. 사용자가 현재 설정 체크박스를 명시적으로 선택해야 그 Fact의 토큰을 교체한다. 현재 슬롯에서 사라진 기존 근거는 명시적으로 제거할 수 있다. 근거는 1~20개, 호칭과 시점 설명은 각 200자까지다.

자동 처리 상태가 그대로여도 다른 창의 수동 검토를 감지하도록 열린 `PENDING` 후보를 5초마다 조회하고 창 복귀 시에도 확인한다. 숨겨진 창에서는 주기 조회를 멈추고, 확정/제외된 후보나 닫힌 상세는 주기 조회하지 않는다. 최신 조회 결과는 초안과 편집 기준 버전을 덮어쓰지 않는다. 버전이나 상태가 바뀌면 결정을 잠그며 사용자가 다시 확인한 뒤에만 새 버전으로 저장한다. 조회 사이의 동시 수정도 서버의 `expectedVersion` 검증으로 보호한다.

관계 목록에는 현재/과거·철회·근거 변경·보관 상태를 모두 표시한다. 이전 근거도 `hasEvidence`가 참이면 원문을 볼 수 있으며, `current=false` 근거에 현재 프로필 내용을 대신 표시하지 않는다. 잘못 확정한 관계는 철회할 수 있다. 작품 속 이혼·관계 종료는 캐릭터 설정을 고쳐 정리할 내용이며 철회와 구분해 안내한다. 정정 API를 사용하는 직접 관계 재작성 UI는 이번 범위에 없다.

## 구현과 검증

`relationship/FamilyRelationshipWorkspace.tsx`, `RelationshipCandidateEditor.tsx`, `RelationshipTargetPicker.tsx`, `RelationshipEvidence.tsx`, `relationships-v2.css`가 화면을 구성한다. Backend와 공유하는 실행 가능한 parser 예시는 [family-relationship-processing-v1.json](contracts/family-relationship-processing-v1.json)의 32건이다. name/display/value 충돌·명시 관계·보류 이유와 과거/불확실한 항목 이름을 고정하며 Front에서 parser를 중복 구현하지 않는다. 모든 요청·응답 타입과 query option은 Java `/v3/api-docs`로부터 `npm run api:generate`한 SDK를 사용한다.

- `e2e/family-relationships.spec.ts`: 자동/대기 집계 분리, 기존 원문 lazy 조회, 같은 이름의 페이지 선택, 수정 후 확정, 버전·근거 충돌의 입력 보존과 명시적 토큰 교체, 저장/제외 재시도, AI 요청 없음, 320px와 URL 복원. 정상 인증 갱신 뒤 조회/수정/확정/제외/재처리/철회 성공, 실제 세션 변경·작품 이탈 뒤 늦은 응답 차단, 다른 창의 수동 수정/확정과 창 복귀 감지도 검증한다.
- `e2e/family-relationships-live.spec.ts`: 전용 localhost 계정·작품에 이름만 있는 인물을 준비하고 public 캐릭터 PATCH로 현재 설정을 저장한다. 자동 배우자 반영, 미해결 부모 후보, 화면 수정·확정, 원본 설정 변경 후 유효성 저하, 제외 후 재처리, 철회를 실제 API·PostgreSQL 경로로 재조회한다. 계정과 작품은 기존 `local-live-fixture.ts`가 public purge 완료 후 정리한다. AI 재추출 품질 검증은 포함하지 않는다.

실행 시 기존 서버를 재사용하지 않도록 별도 포트를 지정한다. live 계정/DB 변수는 [로컬 live 테스트 문서](local-image-live-tests.md)의 `CATCHHOLE_E2E_*`를 사용한다. `VITE_API_BASE_URL`과 `CATCHHOLE_E2E_API_BASE_URL`은 같은 격리 API 주소여야 하며 `NO_PROXY`/`no_proxy`에 localhost를 포함한다. 토큰·비밀번호·DSN은 캡처나 문서에 기록하지 않는다.

```sh
CATCHHOLE_E2E_PORT=3107 npm run test:e2e -- e2e/family-relationships.spec.ts --workers=1
# 사전 설정한 localhost API/DB/seed 환경에서 실행
CATCHHOLE_E2E_PORT=3108 npm run test:e2e -- e2e/family-relationships-live.spec.ts --workers=1
```

브라우저 검토 캡처: [데스크톱](screens/gh260/family-relationships-desktop.png), [320px 후보](screens/gh260/family-review-mobile-320.png), [320px 하단 액션·키보드 초점](screens/gh260/family-review-mobile-actions-320.png).

2026-10-17 검증: 관계 목 E2E 8개, 기존 대시보드/모바일 39개, 실제 localhost PostgreSQL 연동 1개를 통과했다. lint 오류 0(기존 Fast Refresh 경고 2), typecheck/build/Knip 통과. Doctor 193개 진단 중 오류 2개는 기존 WorldSettingDatabase 진단이며 전체 통과로 해석하지 않는다. [실제 자동 반영 화면](screens/gh260/family-live-desktop.png), [실제 철회 결과 320px](screens/gh260/family-live-mobile-320.png). Pencil 동기화는 연결 복구 전까지 대기한다.

2026-10-19 PR 검토 보완: 수정 전 인증 갱신 후 근거 조회 결과가 누락되는 사례와 처리 상태가 그대로인 외부 수정을 놓치는 사례를 각각 실패로 재현했다. 수정 후 관계 목 E2E 18개와 기존 인증 smoke 5개를 통과했다. lint 오류 0(기존 경고 2), typecheck/build/Knip 통과, Doctor는 기존과 같은 193개 진단/오류 2개다. API 계약 변경은 없으며 이 보완에서는 localhost 실연동을 재실행하지 않았다. 공유 parser fixture 32건은 Backend 파일과 동일하다.
