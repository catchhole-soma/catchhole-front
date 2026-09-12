# CatchHole Front Agent Guide

이 문서는 `CatchHole-Front`에서 작업하는 자동화 에이전트가 따라야 할 저장소 규칙입니다. 제품·디자인·라우팅 배경은 `CLAUDE.md`를 함께 확인합니다.

## 기본 검증

변경 범위에 맞춰 아래 명령을 실행하고 결과를 남깁니다.

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm run check:unused
npm run doctor
```

실제 API 연동 변경은 브라우저에서 요청·응답, 인증 저장소와 쿠키, 백엔드 DB 반영까지 확인합니다.

- 미사용 코드·의존성은 고정 버전 Knip으로 검사합니다. `knip.json`은 PostCSS 설정과 E2E의 Vite `/src/*` 모듈 경로를 포함합니다. 생성 API는 검사에서 제외하고, fixture는 실제 import 경로를 확인한 뒤 제거합니다.
- React Doctor는 고정 버전으로 전체 범위를 검사하는 참고용 명령입니다. `doctor.config.json`은 생성 API 파일만 제외하며, 남은 진단·오탐과 리디자인 후속 범위는 `docs/react-doctor-cleanup.md`에 기록합니다. 종료 코드 0만으로 오류가 없다고 판단하지 않습니다.

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
- GH180 다회차 업로드는 선행 단일 회차 개수 조건 없이 두 방식 모두 제공한다. `upload-policy`는 작품 전체 미확정 캐릭터·세계관 후보와 분량 상한 안내에만 사용하며 자격 확인 호출이나 사용 가능 여부 분기를 추가하지 않는다. 안내 조회 로딩·실패가 단일 자동 반영이나 다회차 업로드를 잠그지 않는다. 미확정 설정은 먼저 검토하면 도움이 된다는 경고만 표시하며 업로드를 막지 않는다.
- 다회차는 분석 방식 선택 없이 항상 `analysisMode=ORDERED_PROVISIONAL`, `reviewMode=AUTOMATIC`을 보낸다. 한 회차의 자동 저장 완료 뒤 다음 회차를 분석한다. 단일 회차도 ordered+automatic이 기본이며 모든 설정 직접 검토를 선택하면 `reviewMode=MANUAL`과 기존 분석 모드 생략 계약을 사용한다. 업로드 방식을 바꾸면 단일 반영 선택을 AUTOMATIC으로 되돌린다.
- 모든 회차 업로드는 선택 원고 전체의 공백 포함 Unicode 문자 수 합계 250,000자까지 허용한다. 감지 응답의 `totalUploadCharacters`를 사용하고 공백 제외 기존 `charCount/totalCharCount`를 제한에 사용하지 않는다. 감지 단계의 분량 초과 서버 오류도 최종 저장 버튼을 잠근다. 최종 검증은 Backend가 동일 원본을 다시 계산한다.
- 자동 반영 결과도 기존 검토의 기본 `PENDING_REVIEW`를 유지하고 확정된 정상 후보를 기본 검토 큐에 다시 포함하지 않는다. 모든 Job의 성공·저장 완료 뒤 확인이 필요한 설정 검토를 열며, 이미 반영된 내용은 기존 확정/전체 필터와 작품 설정에서 조회한다.
- 누적 Job은 `analysisRun`의 실행 ID·세대·순서·변경 기록 상태를 사용한다. 같은 실행의 선행 실패·미완료로 차단된 `PENDING`은 진행 중으로 세지 않아 실패 회차 재개를 막지 않는다. `SUCCEEDED+INCOMPLETE`도 미완료이며, 모든 Job의 `SEALED`와 자동 모드의 `automaticAppliedAt`까지 확인해야 후보 검토를 연다. 서버 목록 집계와 완료·실패 숫자도 같은 기준을 따른다. 차단된 대기만 남으면 `IN_PROGRESS`로 표시하지 않고 완료된 앞 회차 유무에 따라 실패/일부 실패를, 무효화된 실행은 취소를 표시한다.
- 누적 재개는 동일 Job ID를 반환할 수 있으므로 재개 응답으로 상세 Query 캐시를 갱신하고 현재 Job을 다시 조회한다. `INVALIDATED`는 기존 실행의 재개·후보 검토를 제공하지 않고 원고 목록 확인 또는 범위를 확인한 새 분석 시작을 안내한다. 내부 무효화 사유 문자열은 화면에 표시하지 않는다. 일반 회차의 기존 종료·재시도 정책은 유지한다.
- 무효화된 실행의 `새 순차 분석`은 원본 batch에서 현재 `ARCHIVED`가 아닌 회차 전체를 대상으로 한다. 확인창에서 최신 회차 목록·개수와 AI 사용량 재차감을 표시하고 명시적 시작 뒤에만 새 ordered 생성 요청을 보낸다. 현재 Job이 `PENDING/RUNNING`이면 잠근다. 서버의 시작 상태·진행 작업 검증 오류를 유지하고 기본 분석으로 자동 전환하지 않는다. 사용량 부족이면 이 확인창을 닫고 공통 사용량 안내만 유지한다.
- 비동기 Job의 `failureCode=AI_TOKEN_QUOTA_EXHAUSTED`도 전역 사용량 안내 이벤트를 발생시킨다. `tokenInterruptedAfterExtraction=true`이면 전체 회차 실패 재시도에 포함하지 않고, 보존된 결과와 세계관 중단 건수를 안내한 뒤 `candidateType=world` 검토로 이동시킨다. 단, 현재 대상 회차가 `ARCHIVED`이면 결과 이용 불가가 우선이므로 검토 이동과 재시도를 모두 막습니다. 분석 목록의 한 갱신에서 여러 배치가 함께 종료되면 새 중단 건수를 합산해 한 번 안내하며 첫 배치만 소비하지 않습니다.
- 사용량 소진 모달은 생성 SDK로 미처리 추가 사용량 요청을 먼저 조회하고, 요청이 없을 때만 trim 후 Unicode 35~1000자인 `feedback`과 발생 원인 `context`를 전송한다. 입력 폼 액션은 `제출`과 `취소`로 구분하고, 입력 실패 시 내용을 유지하며 한 회원의 미처리 요청은 하나만 허용한다. 서비스 이메일은 보조 연락처로 표시하며 원고·민감정보와 정확한 token 수치는 전송·노출하지 않는다. 동기 요청이 사용량 부족으로 막히면 그 요청을 시작한 확인 모달을 닫아 사용량 안내 종료 뒤 다시 드러나지 않게 한다. 운영자 승인 UI는 만들지 않고 Backend가 신규 회원 초기 지급량과 같은 설정값을 추가 지급하며, 사이드바 비율은 누적 지급량이 아니라 현재 1회 제공량을 100% 기준으로 표시한다.
- 실패 원문은 화면에 직접 표시하지 않는다. Job과 후보의 typed failure code 및 Backend가 정규화한 사용자 메시지만 사용하고 내부 URL, `Client error 409`, stack trace를 렌더링하지 않는다.
- 분석 목록은 생성 SDK의 배치 조회를 사용해 `UploadBatch` 단위로 10개씩 서버 페이지네이션하고, URL의 1-based `analysisPage`를 API의 0-based `page`로 변환합니다. 진행·실패·결과 재진입에는 목적별 `currentAnalysisJobIds`를 그대로 사용합니다.
- 배치의 `REVIEW_REQUIRED`는 회차 분석 완료 후 남은 설정 확인을 뜻한다. 목록은 `분석 완료 · N개 확인 가능`으로 표시하며 캐릭터·세계관 미확정 수를 합산한다. 자동 분석의 보류 후보는 뒤 회차를 막지 않는다. 목록 DTO에 없는 자동/수동 여부를 추측해 자동 저장 개수를 만들지 않으며, 직접 검토의 완료 버튼 조건은 유지한다.
- 설정 검색은 URL에 `q`, `factType`, `scope`, 1-based `page`, 고정 `size=20`을 유지하고 API 호출에서만 `page`를 0-based로 변환합니다. 검색어·필터 변경은 URL 페이지를 1로 되돌리고, Fact 상세 모달을 닫을 때는 `modal`과 `factId`만 제거합니다.
- 원고 목록은 행별 진행·결과·실패 재시도 대신 최근 배치 상태 배너에서 분석 목록으로 안내합니다. 원문 변경으로 `REANALYSIS_REQUIRED`가 된 회차의 새 분석 시작 액션은 별도로 유지합니다.
- 원고 목록은 행의 `IN_PROGRESS`뿐 아니라 원고 화면의 배치 진행 조회에서도 활성 분석을 감지해 10초 갱신한다. 배치 진행 시작·종료 전이에는 목록을 즉시 무효화하고 종료 후 최종 상태를 받는다. 업로드·재분석 Job 생성 성공 시에도 해당 작품의 원고 목록과 분석 배치 캐시를 함께 무효화한다. 목록·배치에 활성 작업이 없으면 반복 조회를 멈추며, 캐시 상태를 바탕으로 서버 분석 상태를 추측해 덮어쓰지 않는다.
- 파일을 교체한 회차의 `재분석`은 원문 청킹과 캐릭터·세계관 후보 재추출이 목적이므로 `episodeId`를 지정한 `SETTING_EXTRACTION` Job을 생성합니다. 시작 전에는 해당 회차만 다시 분석하고 후속 회차에서 축적된 현재 설정 때문에 중복·시간 순서 불일치 후보가 생길 수 있음을 안내하며, 확정 설정은 자동 변경되지 않는다고 명시합니다. 구현되지 않은 충돌 검수용 `EPISODE_VALIDATION`으로 보내지 않되 과거 검수 Job의 진행 화면 조회 호환은 유지합니다.

## 인증과 세션

- `/login`과 `/signup`은 랜딩 위에 표시하는 라우트 모달로 유지합니다. 랜딩에서 열 때만 브라우저 뒤로가기로 닫고, 직접 진입·보호 라우트 리다이렉트로 연 경우 닫을 때 `/landing`으로 대체 이동합니다. 로그인↔회원가입 전환과 인증 성공에는 `replace`를 사용하며, 로그아웃은 `/landing`으로 대체 이동합니다.
- `/demo`는 `PrivateRoute`와 Auth용 `PublicLayout` 밖의 독립 공개 라우트로 유지합니다. `interactiveDemoFixture.ts`와 컴포넌트 메모리만 사용하고 생성 SDK·API·localStorage·sessionStorage에 연결하지 않으며, 새로고침과 `다시 체험하기`는 첫 단계로 초기화합니다.
- `/demo`의 결과 탐색 화면은 배포 화면의 `CharacterDatabase`, `CharacterTimelineModal`, `WorldSettingDatabase`를 fixture 주입으로 그대로 재사용합니다. 같은 화면을 데모 전용 JSX·CSS로 복제하지 않습니다.
- `/demo`는 진입·새 화면·재체험 시 맨 위에서 읽게 한다. 안내 대상을 보여주려고 자동 스크롤하거나 초기 포커스를 보내지 않으며, 안내 변경·화면 회전에도 사용자의 읽는 위치를 유지한다. 사용자가 직접 연 수정 폼의 입력 포커스는 `preventScroll`로 처리한다.
- access token은 응답 body에서 받아 localStorage에 저장하고, refresh token은 HttpOnly 쿠키로만 취급합니다. refresh token을 JavaScript에서 읽거나 로그에 남기지 않습니다.
- 모든 백엔드 요청은 `credentials: include`와 공통 `fetchWithAuth` 경로를 유지합니다.
- 보호 API의 401은 refresh 한 번과 원 요청 한 번만 재시도하며, signup/login/signup-policy/email-verifications/phone-verifications/refresh/logout에는 refresh 재시도를 적용하지 않습니다.
- 로그아웃이나 세션 제거 시 진행 중인 refresh를 즉시 무효화하고, 이전 세션에서 시작된 refresh 응답으로 access token을 복원하지 않습니다.
- 회원가입은 `signup-policy`의 서버 지정 `EMAIL`/`PHONE` 인증을 사용합니다. 정책 조회 실패 시 가입을 막고 재시도를 제공합니다. EMAIL은 전화번호 입력 없이 `email-verifications` 확인 뒤 `emailVerificationToken`을, PHONE은 기존 `phoneVerificationToken`을 보냅니다. 이메일은 trim만 적용하고 대소문자를 보존합니다. 인증 대상 변경 시 토큰·진행 상태와 이전 발송·확인의 늦은 응답을 폐기합니다.
- 회원가입 화면은 Backend의 현재 `PUBLISHED` 이용약관·개인정보처리방침을 조회해 한 체크박스로 동의·확인을 함께 표시하고, 만 14세 이상 확인은 별도 필수 체크로 표시합니다. 가입 요청에는 `termsAccepted`, `privacyPolicyAcknowledged`, `age14OrOlderConfirmed`와 사용자가 본 `termsDocumentId`, `privacyPolicyDocumentId`를 보냅니다.
- Backend가 가입 시점의 현재 게시본과 문서 ID를 같은 트랜잭션에서 검증하고 문서 FK·종류·버전·행위·서버 기록 시각을 저장합니다. 문서가 교체된 409 응답에서는 체크를 해제하고 최신 게시본을 다시 조회해 재확인받습니다. Front에 문서 원문이나 현재 버전을 하드코딩하지 않습니다.
- AI 원고 처리 고지는 개인정보처리방침에 포함하며 회원가입 이후 업로드·재시도·재분석마다 별도 동의나 반복 고지를 표시하지 않습니다.
- GA4·Meta Pixel의 자동 수집 항목·목적·보유기간·국외 처리·거부방법은 개인정보처리방침에 공개합니다. 별도 쿠키 배너나 회원가입 선택 체크박스는 두지 않으며 실제 측정 코드는 NVM-308·NVM-309 범위에서 방침과 일치하도록 설치합니다.
- 인증 진행 복원에는 이메일·전화번호별 sessionStorage 키에 `verificationId`, 인증 대상, 인증 만료 시각, 재전송 가능 시각만 보관합니다. 인증번호·비밀번호·가입 토큰은 컴포넌트 메모리에만 두고 브라우저 저장소·로그·공유 Mutation 캐시에 남기지 않습니다.
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
- 후보의 `valueValidation.status=INVALID`는 row 내 danger 경고와 Backend `message`로 표시하고 그룹 확정과 비교 시작·재시도를 잠근다. `repairable=true`만 수정·제외를 허용하고, schema 해석 오류인 `false`는 수정 버튼을 잠근 채 제외만 유지한다. 수정 불가일 때는 Backend의 입력 지시 대신 `설정값의 형식을 확인해야 합니다.`와 원문 확인·제외 선택을 안내한다. NUMBER 수정값은 숫자 문자열, BOOLEAN은 소문자 `true`/`false`로 프론트에서도 검증하며, 저장 성공 후 재조회한 `VALID` 결과에서만 비교와 확정 잠금을 해제한다.
- `PENDING`·`PROCESSING` 비교와 기존 캐릭터 연결이 필요한 `WAITING_FOR_CHARACTER_MATCH`는 확정을 잠근다. 단, `matchStatus=UNRESOLVED`인 신규 캐릭터 등록 예정 후보는 현행 확정을 허용한다. 서버가 같은 이름의 기존 캐릭터를 다시 찾으면 연결·비교 Job을 만든 뒤 재확정을 요구하고, 실제 신규 캐릭터라면 빈 snapshot에 설정을 바로 반영한다. 배포 전 후보가 `MATCHED/AUTO_MATCHED_BY_NAME + NOT_REQUIRED`로 남아 있으면 `현재 설정 비교 시작` retry를 제공한다. `FAILED`·`RECOMPARISON_REQUIRED`는 상세과 1차 원문 근거를 유지한 채 retry를 제공하며, `EXCLUDE`는 기존 무시 액션, `REVIEW_REQUIRED`는 후보 수정·재비교 또는 이력 저장으로 유도한다.

## 캐릭터 snapshot과 이력

- 캐릭터 상세의 현재값은 `WorkCharacter` snapshot을 기준으로 표시하고, `CharacterFact`는 이력과 snapshot 출처로 취급한다. 단일 `characterFactId` 존재 여부로 snapshot 설정의 저장 여부를 추측하지 않는다.
- 현재값 하나가 여러 Fact에서 합성될 수 있으므로 상세 응답의 `sourceFacts`를 사용한다. 출처가 하나면 곧바로 기존 단건 evidence query를 열고, 여러 개면 회차별 탭을 제공하되 선택한 Fact의 원문만 lazy 조회한다.
- 캐릭터 타임라인은 snapshot 기여 여부로 Fact를 숨기지 않는다. 검색은 `contributesToCurrentSnapshot`을 우선하고 구서버에서만 deprecated `isCurrent`를 fallback으로 사용한다. `CURRENT/HISTORICAL` API enum은 호환을 유지하되 화면에서는 `현재값 근거/그 외 이력`으로 표현한다.

## 세계관 설정 (NVM-268)

- `/setting-review`는 캐릭터·세계관 후보의 공통 검토 화면이지만 두 후보를 한 목록이나 한 DTO로 합치지 않는다. `candidateType=world`만 세계관 후보 생성 SDK를 사용하고, 값이 없거나 `character`면 기존 캐릭터 후보 계약을 그대로 사용한다.
- 상단·탭·하단 검토 집계: 같은 업로드 묶음의 캐릭터·세계관 목록에서 `confirmedCandidateCount`, `dismissedCandidateCount`, `directReviewCandidateCount`, `processingCandidateCount`를 합쳐 반영됨·제외됨·직접 확인·분석 중을 표시한다. 네 수의 합은 전체 후보 수이며 필터·페이지와 무관하다. 미확정 중 비교 `PENDING/PROCESSING` 또는 서버가 `automaticApplicationPending=true`로 표시한 회차의 자동 반영 대기 후보는 분석 중이고 나머지는 직접 확인이다. 정상 비교 뒤 자동 반영 보류, 연결 대기, 발견 후보, 수정안 저장 후 미확정도 직접 확인에 각각 한 번 포함한다. 새 집계가 없는 구응답은 숫자를 추측하지 않고 `—`로 표시한다. 두 종류 응답이 준비되고 남은 검토와 분석 중이 모두 0이어야 완료다.
- 후보 종류를 바꿀 때 캐릭터·세계관 탭 모두 선택 그룹을 `group`으로 보관하고 각 탭의 `reviewStatus`, `page`를 탭별 URL 보조 값에 저장해 돌아올 때 복원한다. 이전 `candidate` 딥링크는 후보가 속한 그룹을 찾은 뒤 canonical `group`으로 교체한다. 세계관 필터 `worldCategory`, `operation`과 캐릭터 `matchStatus`도 탭 전환 시 함께 보관·제거해 서로의 URL과 API 요청에 섞지 않는다.
- 세계관 후보의 MVP 출처는 회차 원문뿐이다. `worldrules` 설정집 원문을 분석 후보로 추측하거나 자동 병합하지 않는다.
- `SCOPE_MISMATCH`는 처리 실패가 아니라 범위 비교가 필요한 `COMPLETED + REVIEW_REQUIRED` 후보다. 원문 `scopeName/settingName`과 기존 `matchedScopeName/matchedPropertyName`을 값과 함께 나란히 표시하며, 원문 경로를 제안 경로로 덮지 않는다. 사람이 최종 반영안을 저장하기 전에는 그룹 확정을 허용하지 않고 기존 `SCOPE_UNRESOLVED`의 범위 미정 안내는 유지한다.
- 세계관 검토 사유는 `SUBJECT_UNRESOLVED` → 대상 연결 확인 필요, `SCOPE_UNRESOLVED` → 범위 확인 필요, `SCOPE_MISMATCH` → 범위 비교 필요, `BATCH_LIMIT_EXCEEDED` → 비교 분량 확인 필요, `GENERAL_UNCERTAINTY` → 대상·내용 확인 필요로 구분한다. 일반 불확실성은 정상 `COMPLETED+REVIEW_REQUIRED` 응답이며 실패로 표현하지 않는다. 사유가 없는 일반 보류와 그룹 집계는 검토 필요로 표시한다. 대상 연결 보류의 기존값은 없음이 아니라 비교 대상 미정이다. 서버 보류/실패 안내는 AI 비교 판단으로 소개하지 않는다.
- 미처리 후보의 비교가 `FAILED`여도 `manualReviewAvailable=true`이고 자동 반영 대기·사용량 중단이 아니면 주요 상태를 `검토 필요`, 보조 안내를 `자동 비교를 마치지 못해 대상과 내용을 확인해 주세요.`로 표시한다. 저장된 실패 상태·원문·진단·수동 저장 후 확정 조건은 보존하며 재분석을 요청하거나 완료로 변환하지 않는다. 수정 불가능한 값 형식은 잠긴 버튼을 누르라고 안내하지 않고 원문 확인·후보 제외를 안내한다. 실제 회차 중단, 수동 확인 불가 실패, 사용량 부족, 혼합 그룹의 실제 실패/중단은 숨기지 않는다.
- 세계관 그룹의 검토 수는 서버의 정상 검토 제안 수에 수동 확인 가능한 실패 후보를 중복 없이 더한다. 전체 반영됨·제외됨·직접 확인·분석 중 집계는 기존 서버 값을 유지한다. 반영 방식 필터의 `REVIEW_REQUIRED`는 `AI 판단 보류`로 이름 붙여 전체 직접 검토 대상과 구분하며 API 필터 값은 유지한다.
- 범위 미정 후보도 원문 설정명과 비교한 기존 설정명을 각각 유지한다. 범위 미정 원문 경로를 공통 설정이라고 단정하지 않고, 편집창에는 원문 값을 우선 채운다. 공개 `comparisonDiagnostics`는 마지막 비교에서 선택한 범위·설정명만 보여 주며 내부 규칙·후보 참조·대상 ID는 노출하지 않는다. 이 기록은 확정된 연결이 아니며 직접 저장 전 그룹 확정은 계속 차단한다.
- 직접 확인 안내는 검토 필요와 저장 완료를 의미 클래스와 밝은 Theme V2 토큰으로 구분한다. class 없는 legacy `C.bg` 인라인 배경을 추가하지 않으며, 실제 제목·본문의 명암비와 320px 화면을 함께 검증한다.
- 세계관 후보 목록·상세는 같은 `batchId`의 `분류 + 대상` 그룹과 `scopeName › settingName` diff row로 표시하되 후보 ID·비교 상태는 row별로 유지한다. 범위가 없는 row는 설정명만 표시한다. 그룹 확정·제외는 전용 단일 요청을 사용하고 기존 단일 후보 mutation을 반복 호출하지 않는다.
- 세계관 검토 묶음은 분류·이름 기준이며 같은 주체로 확정됐다는 뜻이 아니다. 기본 설명에서 같은 대상으로 단정하지 않는다. 미수정·비교 완료·검토 대기 후보에 서로 다른 `targetWorldSettingId`가 명시된 경우에만 서로 다른 기존 연결 안내를 표시한다. null 대상, 비교 묶음 ID, 진단 선택 기록으로 신규 대상 동일성이나 자동 반영 보류 원인을 추론하지 않는다. `automaticReviewHoldReason`가 제공된 경우에만 같은 대상·관련 설정·현재 설정 변경·설정값·반영할 항목 확인을 자연어 배지로 구분한다. 과거 null은 보류 원인을 추측하지 않는다.
- `AI_TOKEN_QUOTA_EXHAUSTED`로 중단된 세계관 후보는 일반 `다시 비교` 대상에서 제외하고 상단에 정확한 중단 건수와 `남은 비교 재개` 배치 액션을 표시한다. 그룹 전체를 사용량 중단으로 표시하는 것은 실패 row가 모두 이 code일 때뿐이며, 다른 실패 code와 섞이면 혼합 상태와 배치 재개·일반 다시 비교를 함께 안내합니다. 재개는 생성 SDK의 배치 mutation을 한 번 호출하고 응답 뒤 목록·배치 집계를 무효화해 polling으로 진행 상태를 갱신한다. 새로고침 후에도 목록의 `activeComparisonJobCount > 0`인 동안은 재개된 `PENDING` 후보를 단건 재시도하거나 최종 중단 알림을 먼저 표시하지 않고, 값이 0인 고아 `PENDING` 후보만 자동 복구한다. 재개 완료는 `failedComparisonCount`와 `recomparisonRequiredCount`도 모두 0일 때만 성공으로 표시합니다.
- 분석 사용량 중단 알림의 배치별 확인 상태는 `AnalysisList`, `SEpisodeUpload`, `WorldSettingReview`가 공용 모듈로 공유한다. 비교가 진행 중일 때는 기준 건수를 기록하고 정산 뒤 증가한 새 중단 세대에만 알린다. 후보 집계가 아직 로드되지 않은 `undefined`를 0건 회복으로 해석하지 않으며, 실제 0건 응답에서만 다음 중단 세대를 위해 상태를 초기화한다.
- 세계관 검토의 검토 상태·세계관 분류·제안된 반영 방식 필터는 캐릭터 검토와 같이 데스크톱에서는 버튼 그룹, 768px 이하에서는 이름이 있는 native select로 표시하며, 활성값과 변경 처리는 같은 URL query 계약을 사용한다.
- 그룹 안 한 row라도 비교 대기·처리·실패·재비교 필요이면 그룹 확정을 잠근다. 재비교 중에도 이전 diff와 1차 추출 원문 근거를 유지하고, 2차 비교 응답으로 quote·회차·offset을 덮어쓰지 않는다.
- 세계관 그룹의 모든 후보가 `ORDERED_PROVISIONAL`이면 같은 설정 경로도 서로 다른 회차 사이에는 순차 갱신 대상으로 확정 요청을 허용한다. 같은 회차 중복과 분석 방식이 없거나 섞인 구응답은 기존 중복 검사를 유지한다. 실제 이전값 일치와 변경 순서는 Backend가 최종 검증한다.
- 같은 범위+설정명의 여러 1차 추출값은 AI가 후보 하나로 통합하고 `SINGLE/MERGED/CONFLICT` 상태를 반환한다. Front는 `MERGED`를 `여러 내용 정리됨`, `CONFLICT`를 `내용 확인 필요`로 표현하고 내부 enum을 노출하지 않는다. 세계관 row는 선택 체크박스를 사용하지 않고 각 row의 `제외`로 해당 후보 하나만 즉시 제외한다. 하단은 남은 검토 대기 row 전체를 처리하는 `모두 확정`만 두며 선택 항목 제외 버튼을 두지 않는다. 이 흐름에서 일부 row만 확정한 뒤 남은 row를 재비교하는 구형 체크박스 시나리오는 만들지 않는다. `CONFLICT` row는 최종값을 저장하기 전에는 모두 확정을 잠그되 row 제외은 허용한다. 모든 `evidenceSpans` quote는 생략 없이 표시한다.
- AI `ADD` 제안이 `existingRootPropertyNamesToMove`를 함께 반환하면 기존 `AI 비교 판단` 문장 안에 `root 설정명 → 제안 범위 › 설정명`을 명시해 확정의 부수 효과를 숨기지 않는다. 작가가 제안을 수정했거나 반영 방식을 `ADD`가 아닌 것으로 바꾸면 이동 안내를 표시하지 않는다. 반영 방식 필터 또는 여러 source를 정리한 비교 판단에 분류 필터가 적용돼 일부 후보가 숨겨질 수 있을 때도 이동 안내와 일괄 확정을 막는다.
- 작가가 세계관 후보의 분류·대상·범위·설정명·반영 방식·최종값을 저장하면 전용 후보 결정 mutation으로 즉시 Backend 후보의 `final*` 초안을 갱신하되 2차 LLM 재비교는 호출하지 않는다. 일반 수정은 해당 row 하나만, 상세 header의 `분류·대상 일괄 수정`은 모든 미확정 row를 한 요청에서 원자적으로 저장한다. 분류·대상이 바뀌면 조회 결과를 무효화해 row를 새 그룹으로 이동시키고 그 그룹을 자동 선택한다. 이후 `모두 확정`은 서버에 저장된 최종 결정을 반영하며 Backend가 반환한 `ADD` 경로 중복·`UPDATE/MERGE` 경로 부재·루트/범위 경로 충돌을 그대로 안내한다.
- `REVIEW_REQUIRED + SCOPE_UNRESOLVED` row는 일치 가능한 기존 경로를 자동 적용하지 않고 `기존 범위 › 설정명에 병합` 빠른 선택을 제공한다. 이 선택은 수정 모달에 기존 경로와 `MERGE`를 미리 채우며, 같은 `comparisonDecisionId`의 모든 미확정 source를 한 PATCH로 저장한다. 일부 source가 필터로 숨거나 연결 후보의 경로·제안값이 다르면 빠른 선택을 숨기고, `CONFLICT`는 모달에서 최종값을 확인한 뒤에만 해결된 것으로 처리한다.
- `REVIEW_REQUIRED + BATCH_LIMIT_EXCEEDED` row는 범위 미확정과 구분해 `출력 한도 검토`로 표시한다. 자동 추가·재비교하지 않고 그룹 확정을 잠근 뒤, 수정 모달에 1차 원문의 범위·설정명·값과 안전한 기본 `ADD`를 미리 채운다. 작가가 반영 방식과 최종값을 확인해 수정안을 저장해야만 확정할 수 있고, `CONFLICT`는 서로 다른 추출값을 하나의 최종값으로 확인한 후 `conflictResolved=true`로 보낸다.
- 출력 한도 초과의 `CONFLICT` 후보를 반영할 때 미리 채운 추출값을 그대로 두거나 공백·줄바꿈만 바꾼 저장은 막는다. 오류와 입력을 유지하고 최종값을 정리하기 전에는 후보 결정 PATCH와 그룹 확정을 진행하지 않는다. `EXCLUDE`는 허용한다.
- 기존 속성과 의미가 같아 `반영하지 않음`이 제안된 row는 Backend의 `beforeValue`로 실제 기존 설정값을 표시한다. 이 값은 삭제되지 않으므로 danger 색상이나 `−` 기호를 쓰지 않고 중립색 `비교한 기존값`으로 표시한다. 특정 기존 속성과 비교하지 않은 일시적 사건 등의 제외만 `비교 대상 없음`으로 표시하며, 값이 없다는 뜻의 `없음`과 혼동하지 않는다.
- 확정 세계관 목록은 `분류 + 대상`을 한 항목으로 표시하고 API의 평면 `properties[]` 경로를 루트 `공통 설정`과 `scopeName` 섹션으로 묶어 펼친다. 선택적 1단계 범위와 같은 설정명의 다른 범위 중복은 세계관에만 허용하며 캐릭터 설정 UI·DTO에 `scopeName`을 추가하지 않는다. FE가 JSON 전체를 덮어쓰지 않는다.
- `/dashboard?nav=settingDB&tab=worldsettings`는 세계관 대상 목록·상세와 직접 추가·수정을 생성 SDK로 제공한다. 검색·분류·정렬·1-based 페이지·선택 대상·생성/수정 모달 상태는 `q`, `category`, `sort`, `page`, `settingId`, `modal` URL 계약을 따른다.
- 세계관 DB 직접 변경은 JSON 전체가 아니라 설정 한 개용 mutation만 호출하고 상세 응답의 현재 `version`을 보낸다. 409 충돌에서는 입력을 닫거나 초기화하지 않고 상세를 다시 받아 최신 버전으로 재시도할 수 있게 한다.
- 세계관 DB의 직접 입력은 새 대상·설정 추가와 수정까지만 제공한다. 삭제·보관·복원은 구현하지 않는다.
- 회차 후보의 의미적 중복은 2차 LLM 제안을 따르고, 세계관 DB 직접 입력의 `분류 + 대상명`·설정명 중복은 Backend가 전체 데이터 기준으로 최종 검증한다. FE는 페이지네이션된 목록만으로 중복을 확정하지 않고 서버 오류를 표시한다.
- `e2e/world-setting.spec.ts`는 후보·직접 입력의 목 API 회귀를, `e2e/world-setting-live.spec.ts`는 인증 환경 변수가 있을 때 직접 입력의 Front→Backend→PostgreSQL 저장·재조회와 테스트 작품 정리를 검증한다. live 테스트가 회차 업로드의 1·2차 LLM 후보 생성을 검증한다고 해석하지 않는다.
- 화면·데이터 요구사항의 기준은 `docs/data-requirements/world-setting.md`이며, 실제 API 연동은 Backend OpenAPI와 생성 SDK를 따른다.

## 캐릭터 상세 설정 편집

- 모바일은 가로 넘침뿐 아니라 줄바꿈·터치 영역·정보 밀도와 조작 방식을 검토한다. 여러 설정 탭·필터는 선택 메뉴로 압축하되 저장·확정 같은 주 행동은 직접 노출한다. 표현을 바꿔도 URL·뒤로가기·새로고침·입력 보존 계약을 유지한다.
- 모바일 상세·편집 모달의 본문 높이는 고정 header 높이를 빼서 추측하지 않는다. 실제 header·footer가 차지한 뒤 남은 높이를 flex와 `min-height: 0`으로 배분하고, 320×568에서도 마지막 입력과 저장 버튼에 접근 가능한지 확인한다.

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

- 사용자 안내·오류·판단 근거는 작가가 해야 할 행동과 원고의 의미로 설명한다. 원문·고유명사·설정값에 기술 용어 일괄 치환을 적용하지 않으며, 공개 비교 사유는 서버가 정제한 문장을 표시한다. 내부 비교 오류와 식별자·규칙 이름은 표시하지 않는다.

- 자동 반영 대기는 후보의 원본 회차 작업이 자동 모드로 대기·진행 중이며 자동 저장을 아직 완료하지 않았을 때 서버가 판단한다. 비교 완료·실패 여부만으로 직접 검토를 열지 않는다. 해당 후보의 수정·제외·연결·재비교와 이를 포함하는 묶음 확정·일괄 수정은 잠그고, 이미 완료된 다른 회차의 보류 후보는 개별 검토할 수 있다. 열린 모달에서 대기가 감지되면 입력을 보존하고 저장만 잠근다. 필터·다른 페이지로 후보가 숨겨져 있어도 전체 분석 중 수로 갱신을 유지하며, 자동 반영 완료 뒤 최종 결과를 받고 반복 조회를 멈춘다. 새 후보 필드가 없는 구응답은 자동 반영 대기로 추측하지 않는다.
- 완료된 앞 회차의 후보 변경도 후속 분석을 무효화할 수 있으므로 자동 완료 후 캐릭터 검토와 ordered 세계관의 수정·연결 모달/그룹 확정 영역에 영향을 미리 안내한다. 이 안내는 기존 mutation을 바꾸거나 추가 확인 클릭을 요구하지 않는다. 분석 중 수정 예약·종료 후 자동 반영은 미구현이며, 예약된 것처럼 안내하지 않는다. 새 자동 보류 사유는 `SUBJECT_RESOLUTION_FAILED`를 `연결할 대상 확인`, `COMPARISON_INPUT_TOO_LARGE`를 `비교할 내용 확인`으로 표시한다.
