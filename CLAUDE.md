# CLAUDE.md

CatchHole 프론트엔드(`catchhole-front`) 작업 시 참고할 공용 컨텍스트입니다. 팀 전체가 보는 문서이므로 개인 메모는 `CLAUDE.local.md`(gitignore됨)에 작성하세요.

## 프로젝트 개요

CatchHole은 웹소설/웹툰 작가·편집자가 회차 원고를 업로드하면 기존 설정집(인물/아이템/스킬/타임라인 등)과의 충돌·모순을 AI로 검사해주는 툴입니다. 이 레포는 그 프론트엔드(React SPA)입니다.

## 기술 스택 & 명령어

- React 18 + TypeScript(strict) + Vite 6
- Hey API 생성 클라이언트 + TanStack Query 5
- Tailwind CSS v4 + MUI 7 + Radix UI(shadcn 스타일 컴포넌트) + react-router 7
- 경로 별칭: `@/*` → `src/*`
- 명령어: `npm run dev` / `npm run build`(`tsc -b && vite build`) / `npm run lint` / `npm run test:e2e` / `npm run api:generate`

## 디렉토리 구조

- `src/app/components/catchhole/` — 화면 컴포넌트
  - `S0WorkPicker`, `S1Dashboard` ~ `S5Report`: 메인 작업 흐름 화면
  - `AnalysisList`, `SEpisodeUpload`, `SEpisodeValidationReport`, `SSettingReview`: 업로드 묶음별 분석 목록/회차 업로드/검사/설정 검토 플로우
  - `SLogin`, `SSignup`, `AppSidebar`, `GraphView`, `ReviewLayout` 등 공용 UI
  - `constants.ts` — 디자인 토큰(`C` 객체)과 공용 타입(`types.ts`)·목 데이터(`mockEpisodeData.ts`)
- `src/app/context/` — `AppContext`(전역 상태), `BackendStatusContext`(백엔드 연결 상태 감지 → 데모 모드 판단)
- `src/app/api/generated/` — 백엔드 OpenAPI에서 Hey API로 생성한 타입·SDK·TanStack Query 옵션 (직접 수정 금지)
- `src/app/api/client-config.ts` — 생성 클라이언트의 base URL, 인증, 공통 fetch 런타임 설정
- `src/app/lib/` — `api.ts`, `auth.ts`, `auth-fetch.ts`, `query-client.ts`, `worksApi.ts`, `fileValidation.ts`

## 라우팅

라우트는 `src/app/App.tsx`에서 정의합니다. `/landing`, `/login`, `/signup`은 공개 라우트이며, `/login`과 `/signup`은 랜딩을 배경으로 유지하는 라우트 모달입니다. 그 외 화면은 `PrivateRoute`로 감싸져 있어 accessToken이 없으면 `/login` 모달로 리다이렉트됩니다.

| 경로 | 화면 | 설명 |
| --- | --- | --- |
| `/landing` | `SLanding` | 비로그인 서비스 소개 화면과 Auth 모달의 공통 배경 |
| `/login` | `SLogin` | 랜딩 위 로그인 라우트 모달(공개). `?terms=terms\|privacy`로 약관/개인정보 모달 딥링크 |
| `/signup` | `SSignup` | 랜딩 위 회원가입 라우트 모달(공개). `?terms=terms\|privacy`로 약관/개인정보 모달 딥링크 |
| `/` | `S0WorkPicker` | 작품 선택 (진입점) |
| `/dashboard` | `S1Dashboard` | 선택된 작품의 대시보드. `?nav=settingDB\|reports\|analyses\|graph\|manuscripts`로 좌측 섹션을 구분한다. `nav=analyses`는 업로드 묶음별 분석 현황을 서버 페이지네이션으로 조회하고 `analysisPage`로 현재 페이지를 복원한다. `?tab=characters\|relations\|timeline\|worldrules\|search`로 설정DB 하위 탭, `?modal=char-detail&charId=<id>`로 캐릭터 상세 모달, `?modal=character-archive`로 보관된 캐릭터 목록, `?nav=settingDB&tab=relations`일 때 `?relGraph=triangle\|prosecution\|court`로 관계도 샘플 선택, `?nav=graph&node=<id>`로 그래프뷰 선택 노드까지 딥링크 가능 |
| `/editor` | `S2Editor` | 원고 에디터. `?modal=analysis-request`로 분석 요청 모달 딥링크 |
| `/chat` | `S3Chat` | 챗봇 |
| `/loading` | `S4Loading` | 분석 진행률 |
| `/report` | `S5Report` | 충돌/모순 리포트. `?mode=prePublish`로 발행 전 전체 검수 화면 딥링크(없으면 단일 회차 모드) |
| `/episode-upload` | `SEpisodeUpload` | 회차 업로드 (모드 선택 → 파일 업로드 → 회차 분리 확인 → 설정집 분석) |
| `/setting-review` | `SSettingReview` | 업로드 묶음에서 추출된 설정 후보 검토. `?workId=<id>&batchId=<id>&jobType=<EPISODE_VALIDATION\|SETTING_EXTRACTION>&candidate=<id>`로 검토 문맥·완료 후 목적지·선택 후보를 딥링크하며, 뒤로가기는 해당 작품의 `nav=analyses`로 돌아간다. |
| `/episode-validation-report` | `SEpisodeValidationReport` | 회차 검사(충돌/모순) 결과. `?issue=<id>`로 선택된 이슈 딥링크 |

화면 전환에는 `TransitionType`(`push-right`/`push-left`/`cover-up`/`pop`/`dissolve`, `constants.ts`)을 사용합니다.

### 화면 ↔ URL 1:1 매핑 (딥링크) 방침

탭/모달 같은 화면 내부 상태도 쿼리 파라미터로 딥링크화합니다(`?nav=`/`?tab=`/`?modal=` 등).

- **목적**: 스크린샷 대신 URL로 화면을 정확히 지칭(PR·이슈·문서, AI에게 작업 전달 시 유용). 예: [`docs/api-requirements.md`](https://github.com/catchhole-soma/catchhole-front/blob/5b971dd383c5421da6134cd6cfcba81a4c1a9488/docs/api-requirements.md)처럼 화면명 옆에 URL을 적어두면 캡처 없이도 "이 화면" 하나로 지칭 가능. 단, 코드만 읽는 에이전트에게 URL은 "화면"이 아니라 `App.tsx` 라우트 표를 통해 찾아갈 파일 좌표일 뿐 — 브라우저 도구가 있어야 실제로 화면을 볼 수 있음.
- **Figma는 대체 아님**: 시각 디자인 협업은 여전히 Figma/Pencil(`design/catchhole.pen`) 몫. 이 방침은 텍스트로 표현 가능한 정보(API 요청사항 등)에 한정.
- **보안 예외**: URL을 인가 수단으로 쓰지 않음 — 권한/개인정보가 필요한 화면·데이터는 서버 측 검증 필수.
- **배포 URL 주의**: `https://catch-hole.vercel.app/`은 백엔드 미연동([NVM-48](https://aiswmproject.atlassian.net/browse/NVM-48) 진행 중)이라 첫 접속 시 데모 모드 전환이 한 번 필요.

## 인증/세션

API 호출은 `src/app/api/generated/`의 Hey API SDK와 TanStack Query 옵션을 사용합니다. 세션 저장은 `src/app/lib/auth.ts`, access token 자동 갱신은 `src/app/lib/auth-fetch.ts`에서 담당합니다.

- 로그인·회원가입: access token은 응답 body에서 localStorage에 저장하고, refresh token은 서버가 `/api/v1/auth` 경로의 HttpOnly 쿠키로 발급합니다. 회원가입은 한 번의 요청으로 가입과 자동 로그인을 완료합니다. 실제 토큰을 저장할 때는 데모 모드와 데모 작품 데이터를 제거합니다.
- Auth 모달 히스토리: 랜딩에서 열면 한 개의 히스토리 항목을 추가해 브라우저 뒤로가기로 닫습니다. 로그인↔회원가입 전환은 현재 항목을 교체하고, 직접 진입·보호 화면 리다이렉트로 열린 모달은 닫을 때 `/landing`으로 대체 이동합니다. 인증 성공은 `/works`, 로그아웃은 `/landing`으로 현재 항목을 교체합니다.
- 인증 요청: `credentials: include`를 사용하며, 보호 API가 401을 반환하면 refresh를 한 번 수행한 뒤 원래 요청을 재시도합니다. 동시에 발생한 401은 하나의 refresh 요청을 공유합니다.
- 인증 확인: `PrivateRoute`는 저장된 토큰 존재 여부뿐 아니라 `GET /api/v1/auth/me` 성공 여부를 TanStack Query로 확인합니다. 401에서만 세션을 제거하며, 5xx나 네트워크 오류는 토큰을 유지하고 화면 진입을 보류한 채 재시도를 제공합니다.
- 로그아웃: 진행 중인 refresh와 localStorage 토큰·Query 캐시를 먼저 제거한 뒤 서버 refresh token 폐기를 요청하고 `/landing`으로 이동합니다.
- 소셜 로그인(카카오/Google)은 OAuth 계약이 준비될 때까지 비활성 상태이며 mock token을 발급하지 않습니다.

## 백엔드 API 문서 (Swagger)

로컬에서 `catchhole-backend-java`를 `./gradlew bootRun`으로 띄우면(Docker Desktop 필요, `compose.yaml`이 로컬 Postgres 컨테이너를 자동 기동):

- Swagger UI: `{VITE_API_BASE_URL}/swagger-ui/index.html`
- OpenAPI JSON: `{VITE_API_BASE_URL}/v3/api-docs`

OpenAPI 계약을 변경한 뒤에는 생성물을 갱신합니다. 기본 입력은 `http://localhost:8080/v3/api-docs`이며, 다른 환경이나 포트를 사용할 때는 입력 URL을 명시합니다.

```bash
CATCHHOLE_OPENAPI_INPUT=http://localhost:18080/v3/api-docs npm run api:generate
```

`src/app/api/generated/`는 생성 전용이므로 직접 고치지 않습니다. 생성 결과가 기대와 다르면 백엔드 Swagger annotation 또는 `openapi-ts.config.ts`를 먼저 수정합니다.

## 디자인 시스템 — "Obsidian Violet"

다크 테마 기반. `src/app/components/catchhole/constants.ts`의 `C` 객체가 코드 상의 단일 진실 소스입니다.

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `bg` | `#0F0F13` | 전체 배경 |
| `surface` | `#1A1A22` | 카드/패널 배경 |
| `border` | `#2A2A36` | 보더 |
| `primary` | `#7C5CFC` | 주요 액션/선택 상태 |
| `success` | `#00C896` | 완료/정상 |
| `warning` | `#F4A261` | 주의 |
| `danger` | `#FF4D4D` | 오류/삭제 |
| `t1`/`t2`/`t3` | `#F0F0F5`/`#9090A8`/`#55556A` | 텍스트 강조/보조/저강조 |

새 UI를 만들 때는 이 토큰을 그대로 재사용하세요. Tailwind 유틸리티 클래스와 MUI 컴포넌트가 혼용되어 있습니다.

## 디자인 워크플로우

두 가지 디자인 산출물 경로가 있으며, 서로 대체 관계가 아니라 보완 관계입니다.

1. **Stitch → Figma (팀 공유용 와이어프레임)**: 화면을 Puppeteer로 정적 HTML 스냅샷 추출(`.stitch/*.html`, **gitignore됨 — 임시 작업 폴더**) → Stitch 프로젝트에 업로드 → Figma에서 팀과 함께 정리.
   - **Stitch MCP 도구 자체(`mcp__stitch__*`)엔 code/HTML import 기능이 없음** — `generate_screen_from_text`/`edit_screens`는 텍스트 프롬프트 해석 방식이라 원본과 1:1로 똑같지 않음. 코드를 그대로(픽셀 단위로) 올리려면 위에서 설명한 `.stitch/*.html` 스냅샷을 `upload_html_to_stitch.py`(`.stitch/` 내, Stitch `screens:batchCreate` REST API를 직접 호출하는 래퍼 — `google-labs-code-stitch-skills` 플러그인의 `upload-to-stitch` 스킬 의존)로 업로드하는 게 실제 경로. MCP 도구 호출은 모델 출력 토큰 제한(~16K) 때문에 파일 base64를 통째로 못 보내서 이 스크립트가 필요함.
2. **`design/catchhole.pen` (Pencil, 레포 내 버전관리 디자인 소스)**: Pencil MCP로 직접 편집·스크린샷 추출 가능한 `.pen` 파일. 코드와 함께 git으로 추적되는 디자인 소스로, `.stitch/design.md`의 Obsidian Violet 토큰과 실제 React 화면을 참고해 작성됨.
   - 캔버스는 **화면 원본 영역**과 **Workflow Boards 영역**으로 분리합니다. 라우트·분기의 기준 문서는 `docs/screen-flow.md`이며, Pencil 보드는 실제 화면을 포함한 시각적 보완 자료입니다.
   - 원본 화면은 `<컴포넌트> / <상태>`, 보드는 `Workflow Board / WF-XX <이름>` 형식으로 이름을 붙입니다.
   - Workflow 복제본에는 `sourceNodeId` 메타데이터를 기록하고 복제본 내부 내용은 직접 수정하지 않습니다. 원본이 바뀌면 복제본을 다시 만든 뒤 번호 마커와 Description만 재적용합니다.
   - 전환 색상은 사용자 이동 `primary`, 모달·조건 분기 `warning`, 자동 완료 `success`, 실패 `danger`로 통일합니다.
   - 리뷰용 PNG는 `docs/workflows/WF-01.png`부터 `WF-05.png`까지 관리하며, 보드 변경 후 함께 다시 내보냅니다.
   - 파일럿 보드 `M7oaU`의 구성을 보드 템플릿으로 사용합니다. 중복 보기 화면 `EyLZo`는 제거했으며 `FrYW0`를 공통 읽기 전용 원문 보기 원본으로 사용합니다.

## 상태 관리 & 데모 모드

- **`AppContext`** — 화면 간 공유되는 UI 상태: `selectedWork`(작품 선택, `WorkId`: `detective`/`murim`), 레거시 `editorMode`(`edit`/`view`), `reportMode`(`single`/`prePublish`) 등. 인증/백엔드 연결과는 무관. MVP의 `/editor`는 읽기 전용이므로 새 화면·Workflow에는 편집 전환을 노출하지 않습니다.
- **`BackendStatusContext`** — `.env`의 `VITE_API_BASE_URL`로 설정된 백엔드와의 연결 상태를 감지(`api.ts`의 네트워크 에러 리스너 경유). 연결이 끊기거나(`promptKind: 'network'`) 업로드할 파일이 없을 때(`promptKind: 'no-file'`) 데모 모드 전환을 프롬프트로 제안.
- **데모 모드**: 사용자가 전환을 수락하면 `mockEpisodeData.ts` 등의 목 데이터로 화면을 그대로 시연 (mock-first 개발 방식 — 백엔드 없이도 FE 작업/리뷰 가능).

## 참고 문서

- `design/catchhole.pen` — Pencil 디자인 소스 (위 "디자인 워크플로우" 참고)

## 이슈 관리

GitHub 이슈는 **항상 `catchhole-backend-java` 레포에 등록**합니다 (프론트/백엔드 공용 이슈 트래커로 사용하기로 팀 합의됨). `catchhole-front` 레포의 이슈 탭은 아예 사용하지 않기로 약속함(여러 레포 이슈탭을 돌아다니며 확인하는 번거로움을 없애기 위함) — **프론트엔드 전용 변경이라 백엔드 작업이 전혀 없는 이슈여도** 예외 없이 `catchhole-backend-java`에 등록합니다. `catchhole-front`에는 이슈를 올리지 않습니다.

이슈/PR에는 영역을 구분할 수 있는 라벨을 정확히 달아주세요(예: 프론트엔드 전용 내용이면 `frontend` 라벨). 이슈 등록 자체는 필수가 아니지만, 등록한다면 이 규칙을 따릅니다.

## 커밋 컨벤션

`<type>(<scope>): <한글 설명>` 형식을 사용합니다.

```
feat(works): 작품 목록/업로드를 백엔드 API로 연동하고 데모 모드 추가
fix(episode-upload): 데모 모드 전환 시 같은 화면에서 데모 데이터로 바로 진행
chore(design): Pencil 디자인 파일로 회차 업로드 플로우 와이어프레임 추가
```
