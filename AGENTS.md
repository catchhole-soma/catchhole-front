# CatchHole Front Agent Guide

이 문서는 `CatchHole-Front`에서 작업하는 자동화 에이전트가 따라야 할 저장소 규칙입니다. 제품·디자인·라우팅 배경은 `CLAUDE.md`를 함께 확인합니다.

## 기본 검증

변경 범위에 맞춰 아래 명령을 실행하고 결과를 남깁니다.

```bash
npm run lint
npm run build
npm run test:e2e
```

실제 API 연동 변경은 브라우저에서 요청·응답, 인증 저장소와 쿠키, 백엔드 DB 반영까지 확인합니다.

## OpenAPI와 생성 코드

- 백엔드 Swagger/OpenAPI가 API 계약의 단일 출처입니다.
- Hey API 설정은 `openapi-ts.config.ts`, 런타임 설정은 `src/app/api/client-config.ts`에 둡니다.
- 기본 생성 입력은 `http://localhost:8080/v3/api-docs`입니다. 다른 환경이나 포트는 `CATCHHOLE_OPENAPI_INPUT=<OpenAPI URL> npm run api:generate`로 지정합니다.
- `src/app/api/generated/`는 항상 생성기로 갱신하고 직접 수정하지 않습니다. 생성 오류는 백엔드 OpenAPI annotation 또는 생성기 설정에서 해결합니다.
- 서버 상태를 다루는 새 API 호출은 생성된 SDK와 `@tanstack/react-query.gen.ts`의 query/mutation options를 우선 사용합니다.
- 회차 감지·업로드 multipart 요청도 생성 SDK를 사용하고 JSON part 이름은 `metadata`로 유지합니다. 직접 `FormData`를 직렬화해야 할 때도 생성 타입의 `EpisodeDetectionRequest`와 `EpisodeUploadRequest`를 사용해 같은 계약을 보존합니다.
- 회차 감지 결과는 `detectedEpisodes`/`detectionOrder`, 사용자가 편집해 최종 전송하는 값은 `episodeConfirmations`/`confirmation`으로 구분합니다. 감지값과 확정값을 모두 `episodes`나 `drafts`로 부르지 않아 API 단계가 코드에서 드러나게 합니다.
- 최종 업로드에서 `SINGLE_EPISODE`는 `singleEpisodeNo`만 확정값으로 보내고 `episodeConfirmations`를 보내지 않습니다. 두 다회차 방식은 단일 회차 전용 필드 없이 감지 결과 전체와 대응하는 `episodeConfirmations`를 반드시 전송합니다.
- 분석 작업 생성 응답은 회차별 `AnalysisJobResponse[]`입니다. `UploadBatch`를 대표 Job 하나로 축약하지 말고 반환된 모든 Job ID를 저장·URL 복원·polling 대상으로 사용합니다.
- 신규 `AnalysisJob` 하나는 단일 회차 상태만 나타냅니다. 업로드 진행 화면의 전체 성공·일부 실패·진행 중 표시는 같은 batch의 현재 Job 목록을 집계해 계산하고, 다른 Job이 아직 진행 중이면 실패 재시도나 세계관 중단 알림·검토 이동을 먼저 열지 않습니다. 모든 Job 종료 뒤 일반 실패와 세계관 토큰 중단이 함께 남으면 `실패 확인`을 먼저 제공하고, 실패 회차 복구 뒤 `남은 비교 확인`으로 전환합니다.
- 실패 재시도 응답도 새 회차별 Job 목록입니다. 전체 과거 Job ID는 추적 이력으로 유지하되, 현재 polling 목록에서는 재시도 대상 실패 ID만 새 ID로 교체하고 기존 성공·복구 불가 current ID는 유지합니다.
- 비동기 Job의 `failureCode=AI_TOKEN_QUOTA_EXHAUSTED`도 전역 사용량 안내 이벤트를 발생시킨다. `tokenInterruptedAfterExtraction=true`이면 전체 회차 실패 재시도에 포함하지 않고, 보존된 결과와 세계관 중단 건수를 안내한 뒤 `candidateType=world` 검토로 이동시킨다. 단, 현재 대상 회차가 `ARCHIVED`이면 결과 이용 불가가 우선이므로 검토 이동과 재시도를 모두 막습니다. 분석 목록의 한 갱신에서 여러 배치가 함께 종료되면 새 중단 건수를 합산해 한 번 안내하며 첫 배치만 소비하지 않습니다.
- 사용량 소진 모달은 생성 SDK로 미처리 추가 사용량 요청을 먼저 조회하고, 요청이 없을 때만 trim 후 Unicode 35~1000자인 `feedback`과 발생 원인 `context`를 전송한다. 입력 폼 액션은 `제출`과 `취소`로 구분하고, 입력 실패 시 내용을 유지하며 한 회원의 미처리 요청은 하나만 허용한다. 서비스 이메일은 보조 연락처로 표시하며 원고·민감정보와 정확한 token 수치는 전송·노출하지 않는다. 동기 요청이 사용량 부족으로 막히면 그 요청을 시작한 확인 모달을 닫아 사용량 안내 종료 뒤 다시 드러나지 않게 한다. 운영자 승인 UI는 만들지 않고 Backend가 신규 회원 초기 지급량과 같은 설정값을 추가 지급하며, 사이드바 비율은 누적 지급량이 아니라 현재 1회 제공량을 100% 기준으로 표시한다.
- 실패 원문은 화면에 직접 표시하지 않는다. Job과 후보의 typed failure code 및 Backend가 정규화한 사용자 메시지만 사용하고 내부 URL, `Client error 409`, stack trace를 렌더링하지 않는다.
- 분석 목록은 생성 SDK의 배치 조회를 사용해 `UploadBatch` 단위로 10개씩 서버 페이지네이션하고, URL의 1-based `analysisPage`를 API의 0-based `page`로 변환합니다. 진행·실패·결과 재진입에는 목적별 `currentAnalysisJobIds`를 그대로 사용합니다.
- 설정 검색은 URL에 `q`, `factType`, `scope`, 1-based `page`, 고정 `size=20`을 유지하고 API 호출에서만 `page`를 0-based로 변환합니다. 검색어·필터 변경은 URL 페이지를 1로 되돌리고, Fact 상세 모달을 닫을 때는 `modal`과 `factId`만 제거합니다.
- 원고 목록은 행별 진행·결과·실패 재시도 대신 최근 배치 상태 배너에서 분석 목록으로 안내합니다. 원문 변경으로 `REANALYSIS_REQUIRED`가 된 회차의 새 분석 시작 액션은 별도로 유지합니다.
- 파일을 교체한 회차의 `재분석`은 원문 청킹과 캐릭터·세계관 후보 재추출이 목적이므로 `episodeId`를 지정한 `SETTING_EXTRACTION` Job을 생성합니다. 시작 전에는 해당 회차만 다시 분석하고 후속 회차에서 축적된 현재 설정 때문에 중복·시간 순서 불일치 후보가 생길 수 있음을 안내하며, 확정 설정은 자동 변경되지 않는다고 명시합니다. 구현되지 않은 충돌 검수용 `EPISODE_VALIDATION`으로 보내지 않되 과거 검수 Job의 진행 화면 조회 호환은 유지합니다.

## 인증과 세션

- `/login`과 `/signup`은 랜딩 위에 표시하는 라우트 모달로 유지합니다. 랜딩에서 열 때만 브라우저 뒤로가기로 닫고, 직접 진입·보호 라우트 리다이렉트로 연 경우 닫을 때 `/landing`으로 대체 이동합니다. 로그인↔회원가입 전환과 인증 성공에는 `replace`를 사용하며, 로그아웃은 `/landing`으로 대체 이동합니다.
- `/demo`는 `PrivateRoute`와 Auth용 `PublicLayout` 밖의 독립 공개 라우트로 유지합니다. `interactiveDemoFixture.ts`와 컴포넌트 메모리만 사용하고 생성 SDK·API·localStorage·sessionStorage에 연결하지 않으며, 새로고침과 `다시 체험하기`는 첫 단계로 초기화합니다.
- `/demo`의 결과 탐색 화면은 배포 화면의 `CharacterDatabase`, `CharacterTimelineModal`, `WorldSettingDatabase`를 fixture 주입으로 그대로 재사용합니다. 같은 화면을 데모 전용 JSX·CSS로 복제하지 않습니다.
- access token은 응답 body에서 받아 localStorage에 저장하고, refresh token은 HttpOnly 쿠키로만 취급합니다. refresh token을 JavaScript에서 읽거나 로그에 남기지 않습니다.
- 모든 백엔드 요청은 `credentials: include`와 공통 `fetchWithAuth` 경로를 유지합니다.
- 보호 API의 401은 refresh 한 번과 원 요청 한 번만 재시도하며, signup/login/phone-verifications/refresh/logout에는 refresh 재시도를 적용하지 않습니다.
- 로그아웃이나 세션 제거 시 진행 중인 refresh를 즉시 무효화하고, 이전 세션에서 시작된 refresh 응답으로 access token을 복원하지 않습니다.
- 회원가입 전 `phone-verifications` 발송·확인을 완료하고, 가입 요청에는 전화번호 대신 발급된 `phoneVerificationToken`을 보냅니다. 인증된 번호가 바뀌면 토큰과 진행 상태를 즉시 폐기합니다.
- 회원가입 화면은 Backend의 현재 `PUBLISHED` 이용약관·개인정보처리방침을 조회해 한 체크박스로 동의·확인을 함께 표시하고, 만 14세 이상 확인은 별도 필수 체크로 표시합니다. 가입 요청에는 `termsAccepted`, `privacyPolicyAcknowledged`, `age14OrOlderConfirmed`와 사용자가 본 `termsDocumentId`, `privacyPolicyDocumentId`를 보냅니다.
- Backend가 가입 시점의 현재 게시본과 문서 ID를 같은 트랜잭션에서 검증하고 문서 FK·종류·버전·행위·서버 기록 시각을 저장합니다. 문서가 교체된 409 응답에서는 체크를 해제하고 최신 게시본을 다시 조회해 재확인받습니다. Front에 문서 원문이나 현재 버전을 하드코딩하지 않습니다.
- AI 원고 처리 고지는 개인정보처리방침에 포함하며 회원가입 이후 업로드·재시도·재분석마다 별도 동의나 반복 고지를 표시하지 않습니다.
- GA4·Meta Pixel의 자동 수집 항목·목적·보유기간·국외 처리·거부방법은 개인정보처리방침에 공개합니다. 별도 쿠키 배너나 회원가입 선택 체크박스는 두지 않으며 실제 측정 코드는 NVM-308·NVM-309 범위에서 방침과 일치하도록 설치합니다.
- 휴대폰 인증 진행 복원에는 `verificationId`, 전화번호, 인증 만료 시각, 재전송 가능 시각만 sessionStorage에 보관합니다. `phoneVerificationToken`은 컴포넌트 메모리에만 두고 localStorage/sessionStorage/로그에 남기지 않습니다.
- 실제 Backend를 사용하는 live E2E는 매 실행마다 가입하지 않고 사전에 휴대폰 인증된 전용 계정으로 로그인합니다.
- 회원가입은 가입과 토큰 발급을 한 요청으로 완료합니다. 소셜 로그인은 실제 OAuth 계약이 준비되기 전까지 비활성 상태로 둡니다.
- 실제 로그인·회원가입 성공으로 access token을 저장할 때는 데모 모드와 데모 작품 데이터를 함께 제거해 실제 API 모드로 전환합니다.
- 인증 상태는 `GET /api/v1/auth/me`로 검증하며, localStorage 토큰 존재만으로 로그인 성공을 판단하지 않습니다.
- `/auth/me`의 401에서만 세션을 제거하고 로그인으로 이동합니다. 5xx나 네트워크 오류에서는 토큰을 유지하고 보호 화면 진입을 보류한 채 재시도를 제공합니다.

## 변경 원칙

- 제품 브랜드는 `ui-v2/BrandLogo.tsx`에서 왼쪽 `public/brand/catchhole-glossy-v1.png` 심볼과 오른쪽 기존 `catchhole-wordmark.png`를 함께 표시합니다. 글자를 제거하거나 새 폰트로 대체하지 않으며, 워드마크 원본 여백 크롭을 심볼에 적용하지 않습니다. 파비콘은 심볼 단독입니다. 공유 카드 제목·설명·절대 이미지 URL은 크롤러가 JavaScript 없이 읽는 `index.html`에서 유지합니다.

- 회원가입을 포함한 화면 디자인·상태·흐름을 바꾸면 `design/catchhole.pen`, `docs/data-requirements/auth.md`, `docs/screen-flow.md`를 구현과 함께 갱신하고 기존 Obsidian Violet 토큰을 재사용합니다.
- `/demo`의 단계·코치마크·CTA 흐름을 바꾸면 `design/catchhole.pen`, `docs/screen-flow.md`, `design/PENCIL_MIGRATION.md`의 대표 프레임과 Workflow 정보를 함께 갱신합니다.
- OmD 스킬은 저장소의 `.cursor/skills/`에 복제하지 않고 각 에이전트의 전역 설치본을 사용합니다. Cursor 규칙에는 저장소에 존재하지 않는 로컬 스킬 경로나 slash command를 안내하지 않습니다.
- Theme V2의 밝은 modal·card surface 안에서는 legacy dark `C.t*` 색상을 인라인으로 지정하지 않고 `--ch-*` 의미 토큰을 사용합니다. 연락처·액션 같은 일반 크기 텍스트는 실제 브라우저에서 4.5:1 이상 명암비와 식별 수단을 검증하고 E2E 스타일 assertion을 남겨, CSS override와 인라인 색상 조합으로 글자가 사라지는 회귀를 막습니다. 밝은 surface의 작은 경고 텍스트·액션에는 장식용 `--ch-warning` 대신 명암비를 보장한 `--ch-warning-ink`를 사용합니다.
- 사용자 입력 제약은 프론트 검증과 OpenAPI DTO 계약을 일치시킵니다.
- 민감한 토큰, 쿠키, 비밀번호를 테스트 출력·문서·커밋에 남기지 않습니다.
- 커밋과 push는 실제 연동 검증이 끝나고 사용자가 명시적으로 요청한 뒤에만 수행합니다.

## 설정 후보 검토

- 기본 검토 상태 필터는 `PENDING_REVIEW`로 유지한다. 이 기본 검토 흐름에서 확정·무시 후에는 서버에서 다시 받은 다음 검토 대기 후보를 자동 선택하고, `ALL`은 URL에 명시해 기본값과 구분한다.
- 후보 수정 폼은 사용자용 설정명과 표시값만 전송한다. `valueType`, `valueJson`, 원문 근거와 raw AI payload를 클라이언트에서 재조립하거나 수정 요청에 포함하지 않는다.
- 고정 schema 설정명은 잠그고, 동적 pattern 설정명은 기존 prefix를 잠근 채 suffix만 수정한다. 편집 가능 여부와 prefix는 Backend 응답의 `attributeNameEditable`, `attributeNamePrefix`만 사용하며 FE key 목록으로 추측하지 않는다. 최종 key 검증과 `valueJson.name` 동기화도 Backend 계약을 따른다.
- 내용 미수정 후보의 rich JSON은 Backend가 유지한다. `SettingValueType.JSON` 복합 후보의 이름 또는 값이 실제로 바뀌면 현재 JSON을 name-only로 축소하는 MVP 정책이며, 숨은 level·effect·quantity를 FE가 추측해 보존하지 않는다.
- 비어 있는 표시값은 빈 문자열이 아니라 `null`로 전송해 원래 `null`인 후보를 실제 수정으로 오인하지 않게 한다.
- 캐릭터 연결 변경은 후보 내용 수정과 별도 mutation으로 처리한다. 기존 캐릭터 연결과 신규 등록 예정 지정은 모두 `PENDING_REVIEW`를 유지하며, 실패하면 사용자의 모달 입력과 선택을 유지한다.
- `MATCHED`와 `AUTO_MATCHED_BY_NAME`은 모두 연결 완료로 조회하되 배지에서는 분석 시점부터 존재한 기존 캐릭터 연결과 이번 확정에서 생성된 신규 캐릭터 연결을 구분한다. 신규 캐릭터를 만든 최초 확정 후보와 같은 이름으로 자동 연결된 형제 후보는 모두 `AUTO_MATCHED_BY_NAME`이다.
- 캐릭터 후보의 2차 비교는 세계관 후보 DTO·컴포넌트와 합치지 않는다. 공통 색상·상태 표현만 재사용하고, 캐릭터에는 `AI 제안대로 현재 설정 반영(APPLY_PROPOSAL)`과 `이력에만 저장(HISTORY_ONLY)` 두 확정 방식만 노출한다.
- 캐릭터 후보 목록은 같은 분석 배치의 `정규화한 캐릭터 이름`별 그룹으로 표시하고 `미상`은 마지막에 둔다. 그룹 상세은 모든 row를 세로로 이어서 보여준다. row별 설정명·설정값 수정과 제외, 단건 캐릭터 연결은 유지하되 단건 확정은 노출하지 않는다. 그룹 header의 `캐릭터 일괄 연결`은 모든 대기 후보를 하나의 기존 캐릭터 또는 동일 이름의 신규 캐릭터 등록 예정 상태로 함께 바꾸며, 일반 수정 폼에서는 캐릭터 이름을 편집하지 않는다.
- 신규 캐릭터 그룹 화면의 목록·집계 조회는 `includeLegacyCandidates=false`를 보내 deprecated 단건 페이지의 중복 payload를 받지 않는다. 구버전 Backend가 이 파라미터를 무시하고 `groups` 없이 `candidates`만 반환하는 배포 구간에는 기존 단건 페이지를 이름별로 묶는 fallback을 유지한다. 단, legacy 응답이 여러 페이지면 같은 이름 그룹의 전체 범위를 보장할 수 없으므로 일괄 연결·확정은 잠그고 조회와 단건 작업만 허용한다.
- 비교 결과의 사용자용 diff는 Backend의 `proposedFactValue`와 `snapshotChanges[].beforeFactValue/proposedFactValue`를 우선한다. 구조화 JSON을 화면에서 다시 조립하지 않으며 구응답 호환 표시가 필요할 때만 fallback으로 직렬화한다.
- 후보의 `valueValidation.status=INVALID`는 row 내 danger 경고와 Backend `message`로 표시하고 그룹 확정과 비교 시작·재시도를 잠근다. `repairable=true`만 수정·제외를 허용하고, schema 해석 오류인 `false`는 수정 버튼을 잠근 채 제외만 유지한다. NUMBER 수정값은 숫자 문자열, BOOLEAN은 소문자 `true`/`false`로 프론트에서도 검증하며, 저장 성공 후 재조회한 `VALID` 결과에서만 비교와 확정 잠금을 해제한다.
- `PENDING`·`PROCESSING` 비교와 기존 캐릭터 연결이 필요한 `WAITING_FOR_CHARACTER_MATCH`는 확정을 잠근다. 단, `matchStatus=UNRESOLVED`인 신규 캐릭터 등록 예정 후보는 현행 확정을 허용한다. 서버가 같은 이름의 기존 캐릭터를 다시 찾으면 연결·비교 Job을 만든 뒤 재확정을 요구하고, 실제 신규 캐릭터라면 빈 snapshot에 설정을 바로 반영한다. 배포 전 후보가 `MATCHED/AUTO_MATCHED_BY_NAME + NOT_REQUIRED`로 남아 있으면 `현재 설정 비교 시작` retry를 제공한다. `FAILED`·`RECOMPARISON_REQUIRED`는 상세과 1차 원문 근거를 유지한 채 retry를 제공하며, `EXCLUDE`는 기존 무시 액션, `REVIEW_REQUIRED`는 후보 수정·재비교 또는 이력 저장으로 유도한다.

## 캐릭터 snapshot과 이력

- 캐릭터 상세의 현재값은 `WorkCharacter` snapshot을 기준으로 표시하고, `CharacterFact`는 이력과 snapshot 출처로 취급한다. 단일 `characterFactId` 존재 여부로 snapshot 설정의 저장 여부를 추측하지 않는다.
- 현재값 하나가 여러 Fact에서 합성될 수 있으므로 상세 응답의 `sourceFacts`를 사용한다. 출처가 하나면 곧바로 기존 단건 evidence query를 열고, 여러 개면 회차별 탭을 제공하되 선택한 Fact의 원문만 lazy 조회한다.
- 캐릭터 타임라인은 snapshot 기여 여부로 Fact를 숨기지 않는다. 검색은 `contributesToCurrentSnapshot`을 우선하고 구서버에서만 deprecated `isCurrent`를 fallback으로 사용한다. `CURRENT/HISTORICAL` API enum은 호환을 유지하되 화면에서는 `현재값 근거/그 외 이력`으로 표현한다.

## 세계관 설정 (NVM-268)

- `/setting-review`는 캐릭터·세계관 후보의 공통 검토 화면이지만 두 후보를 한 목록이나 한 DTO로 합치지 않는다. `candidateType=world`만 세계관 후보 생성 SDK를 사용하고, 값이 없거나 `character`면 기존 캐릭터 후보 계약을 그대로 사용한다.
- 상단 전체 진행률은 같은 `batchId`의 캐릭터·세계관 후보 집계를 각각 조회해 FE에서 합산한다. 두 종류의 검토 대기가 모두 0이고 캐릭터 연결 필요와 세계관 비교 대기·처리·실패·재비교 필요가 모두 0일 때만 전체 완료다.
- 후보 종류를 바꿀 때 캐릭터·세계관 탭 모두 선택 그룹을 `group`으로 보관하고 각 탭의 `reviewStatus`, `page`를 탭별 URL 보조 값에 저장해 돌아올 때 복원한다. 이전 `candidate` 딥링크는 후보가 속한 그룹을 찾은 뒤 canonical `group`으로 교체한다. 세계관 필터 `worldCategory`, `operation`과 캐릭터 `matchStatus`도 탭 전환 시 함께 보관·제거해 서로의 URL과 API 요청에 섞지 않는다.
- 세계관 후보의 MVP 출처는 회차 원문뿐이다. `worldrules` 설정집 원문을 분석 후보로 추측하거나 자동 병합하지 않는다.
- 세계관 후보 목록·상세는 같은 `batchId`의 `분류 + 대상` 그룹과 `scopeName › settingName` diff row로 표시하되 후보 ID·비교 상태는 row별로 유지한다. 범위가 없는 row는 설정명만 표시한다. 그룹 확정·제외는 전용 단일 요청을 사용하고 기존 단일 후보 mutation을 반복 호출하지 않는다.
- `AI_TOKEN_QUOTA_EXHAUSTED`로 중단된 세계관 후보는 일반 `다시 비교` 대상에서 제외하고 상단에 정확한 중단 건수와 `남은 비교 재개` 배치 액션을 표시한다. 그룹 전체를 사용량 중단으로 표시하는 것은 실패 row가 모두 이 code일 때뿐이며, 다른 실패 code와 섞이면 혼합 상태와 배치 재개·일반 다시 비교를 함께 안내합니다. 재개는 생성 SDK의 배치 mutation을 한 번 호출하고 응답 뒤 목록·배치 집계를 무효화해 polling으로 진행 상태를 갱신한다. 새로고침 후에도 목록의 `activeComparisonJobCount > 0`인 동안은 재개된 `PENDING` 후보를 단건 재시도하거나 최종 중단 알림을 먼저 표시하지 않고, 값이 0인 고아 `PENDING` 후보만 자동 복구한다. 재개 완료는 `failedComparisonCount`와 `recomparisonRequiredCount`도 모두 0일 때만 성공으로 표시합니다.
- 분석 사용량 중단 알림의 배치별 확인 상태는 `AnalysisList`, `SEpisodeUpload`, `WorldSettingReview`가 공용 모듈로 공유한다. 비교가 진행 중일 때는 기준 건수를 기록하고 정산 뒤 증가한 새 중단 세대에만 알린다. 후보 집계가 아직 로드되지 않은 `undefined`를 0건 회복으로 해석하지 않으며, 실제 0건 응답에서만 다음 중단 세대를 위해 상태를 초기화한다.
- 세계관 검토의 검토 상태·세계관 분류·제안된 반영 방식 필터는 캐릭터 검토와 같은 버튼 선택 그룹으로 표시하며, 활성값은 URL query 계약을 그대로 사용한다.
- 그룹 안 한 row라도 비교 대기·처리·실패·재비교 필요이면 그룹 확정을 잠근다. 재비교 중에도 이전 diff와 1차 추출 원문 근거를 유지하고, 2차 비교 응답으로 quote·회차·offset을 덮어쓰지 않는다.
- 같은 범위+설정명의 여러 1차 추출값은 AI가 후보 하나로 통합하고 `SINGLE/MERGED/CONFLICT` 상태를 반환한다. Front는 `MERGED`를 `여러 내용 정리됨`, `CONFLICT`를 `내용 확인 필요`로 표현하고 내부 enum을 노출하지 않는다. 세계관 row는 선택 체크박스를 사용하지 않고 각 row의 `제외`로 해당 후보 하나만 즉시 제외한다. 하단은 남은 검토 대기 row 전체를 처리하는 `모두 확정`만 두며 선택 항목 제외 버튼을 두지 않는다. 이 흐름에서 일부 row만 확정한 뒤 남은 row를 재비교하는 구형 체크박스 시나리오는 만들지 않는다. `CONFLICT` row는 최종값을 저장하기 전에는 모두 확정을 잠그되 row 제외은 허용한다. 모든 `evidenceSpans` quote는 생략 없이 표시한다.
- AI `ADD` 제안이 `existingRootPropertyNamesToMove`를 함께 반환하면 기존 `AI 비교 판단` 문장 안에 `root 설정명 → 제안 범위 › 설정명`을 명시해 확정의 부수 효과를 숨기지 않는다. 작가가 제안을 수정했거나 반영 방식을 `ADD`가 아닌 것으로 바꾸면 이동 안내를 표시하지 않는다. 반영 방식 필터 또는 여러 source를 정리한 비교 판단에 분류 필터가 적용돼 일부 후보가 숨겨질 수 있을 때도 이동 안내와 일괄 확정을 막는다.
- 작가가 세계관 후보의 분류·대상·범위·설정명·반영 방식·최종값을 저장하면 전용 후보 결정 mutation으로 즉시 Backend 후보의 `final*` 초안을 갱신하되 2차 LLM 재비교는 호출하지 않는다. 일반 수정은 해당 row 하나만, 상세 header의 `분류·대상 일괄 수정`은 모든 미확정 row를 한 요청에서 원자적으로 저장한다. 분류·대상이 바뀌면 조회 결과를 무효화해 row를 새 그룹으로 이동시키고 그 그룹을 자동 선택한다. 이후 `모두 확정`은 서버에 저장된 최종 결정을 반영하며 Backend가 반환한 `ADD` 경로 중복·`UPDATE/MERGE` 경로 부재·루트/범위 경로 충돌을 그대로 안내한다.
- 기존 속성과 의미가 같아 `반영하지 않음`이 제안된 row는 Backend의 `beforeValue`로 실제 기존 설정값을 표시한다. 이 값은 삭제되지 않으므로 danger 색상이나 `−` 기호를 쓰지 않고 중립색 `비교한 기존값`으로 표시한다. 특정 기존 속성과 비교하지 않은 일시적 사건 등의 제외만 `비교 대상 없음`으로 표시하며, 값이 없다는 뜻의 `없음`과 혼동하지 않는다.
- 확정 세계관 목록은 `분류 + 대상`을 한 항목으로 표시하고 API의 평면 `properties[]` 경로를 루트 `공통 설정`과 `scopeName` 섹션으로 묶어 펼친다. 선택적 1단계 범위와 같은 설정명의 다른 범위 중복은 세계관에만 허용하며 캐릭터 설정 UI·DTO에 `scopeName`을 추가하지 않는다. FE가 JSON 전체를 덮어쓰지 않는다.
- `/dashboard?nav=settingDB&tab=worldsettings`는 세계관 대상 목록·상세와 직접 추가·수정을 생성 SDK로 제공한다. 검색·분류·정렬·1-based 페이지·선택 대상·생성/수정 모달 상태는 `q`, `category`, `sort`, `page`, `settingId`, `modal` URL 계약을 따른다.
- 세계관 DB 직접 변경은 JSON 전체가 아니라 설정 한 개용 mutation만 호출하고 상세 응답의 현재 `version`을 보낸다. 409 충돌에서는 입력을 닫거나 초기화하지 않고 상세를 다시 받아 최신 버전으로 재시도할 수 있게 한다.
- 세계관 DB의 직접 입력은 새 대상·설정 추가와 수정까지만 제공한다. 삭제·보관·복원은 구현하지 않는다.
- 회차 후보의 의미적 중복은 2차 LLM 제안을 따르고, 세계관 DB 직접 입력의 `분류 + 대상명`·설정명 중복은 Backend가 전체 데이터 기준으로 최종 검증한다. FE는 페이지네이션된 목록만으로 중복을 확정하지 않고 서버 오류를 표시한다.
- `e2e/world-setting.spec.ts`는 후보·직접 입력의 목 API 회귀를, `e2e/world-setting-live.spec.ts`는 인증 환경 변수가 있을 때 직접 입력의 Front→Backend→PostgreSQL 저장·재조회와 테스트 작품 정리를 검증한다. live 테스트가 회차 업로드의 1·2차 LLM 후보 생성을 검증한다고 해석하지 않는다.
- 화면·데이터 요구사항의 기준은 `docs/data-requirements/world-setting.md`이며, 실제 API 연동은 Backend OpenAPI와 생성 SDK를 따른다.

## 캐릭터 상세 설정 편집

- 사용자가 새 설정을 추가하면 `manual_*` 임시 key를 만들지 않는다. 설정 유형의 고정 prefix와 화면 설정명을 조합한 의미 있는 pattern key를 사용하고, Backend가 exact → alias → pattern 순서로 최종 canonical key를 결정하게 한다.
- 새 설정 입력 행은 key와 별개의 화면 전용 ID를 React key로 사용한다. 설정명을 입력할 때 suffix가 계속 바뀌어도 input이 remount되어 포커스가 끊기지 않게 하기 위함이다.
- 서버에서 이미 내려온 레거시 `manual_*` 설정은 삭제하거나 임의 변환하지 않고 응답의 편집 메타데이터에 따라 계속 표시·수정한다.

## GitHub 협업

- PR 본문은 `.github/PULL_REQUEST_TEMPLATE.md`의 개요·작업 내용·Jira 이슈·PR 유형·확인 사항·참고 사항 구조를 유지하고 실제 변경과 검증 결과로 채웁니다.

<!-- omd:start v=1 hash=fcd83d14cd18 -->
## Design System (oh-my-design)

**Before any UI, styling, copy, or motion change, open and read `./DESIGN.md` in full.** It is the standalone design contract. If an exact valid adopted Core v2 manifest exists, its hash-bound System Graph is machine authority and DESIGN.md is the projection. A migration candidate remains non-authoritative.

If present, read `./.omd/preferences.md` — pending explicit corrections override the current contract until atomically folded into the graph/projection. Apply them and flag conflicts.
<!-- omd:end -->
