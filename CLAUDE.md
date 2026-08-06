# CLAUDE.md

CatchHole 프론트엔드(`catchhole-front`) 작업 시 참고할 공용 컨텍스트입니다. 팀 전체가 보는 문서이므로 개인 메모는 `CLAUDE.local.md`(gitignore됨)에 작성하세요.

## 프로젝트 개요

CatchHole은 웹소설 작가·편집자가 회차 원고를 업로드하면 AI가 캐릭터·세계관 설정을 추출하고, 후보 검토·설정 DB·검색·캐릭터 설정 이력 타임라인·원문 근거 확인 흐름을 제공하는 툴입니다. 이 레포는 그 프론트엔드(React SPA)입니다. 회차 기반 세계관 후보 검토와 세계관 DB, CharacterFact 기반 캐릭터 타임라인을 MVP로 제공하며, 설정집 원문 분석과 충돌 분석 리포트·관계도·작품 전체 사건 타임라인·그래프 뷰·챗봇은 MVP 이후 범위입니다.

## 기술 스택 & 명령어

- React 18 + TypeScript(strict) + Vite 6
- Hey API 생성 클라이언트 + TanStack Query 5
- Tailwind CSS v4 + MUI 7 + Radix UI(shadcn 스타일 컴포넌트) + react-router 7
- 경로 별칭: `@/*` → `src/*`
- 명령어: `npm run dev` / `npm run build`(`tsc -b && vite build`) / `npm run lint` / `npm run test:e2e` / `npm run api:generate`

## 디렉토리 구조

- `src/app/components/catchhole/` — 화면 컴포넌트
  - `S0WorkPicker`, `S1Dashboard`: 작품 선택과 설정·원고 관리 화면
  - `AnalysisList`, `SEpisodeUpload`, `SSettingReview`: 업로드 묶음별 분석 목록/회차 업로드/설정 검토 플로우
  - `worldsetting/`: 세계관 후보 탭 전환·검토와 확정 세계관 DB 조회·직접 편집 UI
  - `SLogin`, `SSignup`, `AppSidebar`, `ReviewLayout` 등 공용 UI
  - `constants.ts` — 디자인 토큰(`C` 객체)과 공용 타입
- `src/app/context/` — `AppContext`(전역 UI 상태), `BackendStatusContext`(인증 만료 전역 처리)
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
| `/works` | `S0WorkPicker` | 작품 선택 (보호 화면 진입점) |
| `/dashboard` | `S1Dashboard` | 선택된 작품의 대시보드. `?nav=manuscripts\|settingDB\|analyses`로 실제 제공 섹션을 구분한다. `nav=analyses`는 업로드 묶음별 분석 현황을 서버 페이지네이션으로 조회하고 `analysisPage`로 현재 페이지를 복원한다. 설정DB 하위 탭은 `?tab=timeline\|characters\|worldsettings\|worldrules\|search`이며, 지원하지 않는 값은 `characters`로 대체한다. `timeline`은 `timelinePage`, `modal=character-timeline`, `charId`, `timelineFactType`, `timelineEpisodeNo`, `factId`를 URL에 보존하며 기존 캐릭터 목록·원문 근거 API를 재사용한다. `worldsettings`는 확정 세계관 대상의 조회·검색·직접 추가·수정을 제공하고, `worldrules`는 별도 업로드한 설정집 원문을 다룬다. 검색 탭은 `q`, `factType`, `scope`, 1-based `page`, `size=20`을 URL에 보존한다. 관계도·작품 전체 사건 타임라인·분석 리포트·그래프 뷰·챗봇은 업데이트 예정 범위다. |
| `/episode-upload` | `SEpisodeUpload` | 회차 업로드와 기존 설정 구축. 신규 회차 검수는 업데이트 예정으로 비활성화한다. |
| `/setting-review` | `SSettingReview` | 업로드 묶음에서 추출된 캐릭터·세계관 후보를 `candidateType=character\|world`로 나눠 검토한다. `?workId=<id>&batchId=<id>&jobType=<EPISODE_VALIDATION\|SETTING_EXTRACTION>&candidate=<id>`로 검토 문맥·완료 후 목적지·선택 후보를 딥링크하며, 두 탭의 후보 DTO와 mutation은 분리한다. 상단 진행률은 두 후보 집계를 합산하고 뒤로가기는 해당 작품의 `nav=analyses`로 돌아간다. |
| `/editor` | 회차·설정집 원문 보기 | `workId`와 원문 ID가 있는 경우 서버 원문을 읽기 전용으로 표시한다. |
| `/chat`, `/loading`, `/report`, `/episode-validation-report` | 작품 선택으로 이동 | MVP에서 제공하지 않는 레거시 목 화면의 직접 진입을 차단한다. |

화면 전환에는 `TransitionType`(`push-right`/`push-left`/`cover-up`/`pop`/`dissolve`, `constants.ts`)을 사용합니다.

### 화면 ↔ URL 1:1 매핑 (딥링크) 방침

탭/모달 같은 화면 내부 상태도 쿼리 파라미터로 딥링크화합니다(`?nav=`/`?tab=`/`?modal=` 등).

- **목적**: 스크린샷 대신 URL로 화면을 정확히 지칭(PR·이슈·문서, AI에게 작업 전달 시 유용). 예: [`docs/api-requirements.md`](https://github.com/catchhole-soma/catchhole-front/blob/5b971dd383c5421da6134cd6cfcba81a4c1a9488/docs/api-requirements.md)처럼 화면명 옆에 URL을 적어두면 캡처 없이도 "이 화면" 하나로 지칭 가능. 단, 코드만 읽는 에이전트에게 URL은 "화면"이 아니라 `App.tsx` 라우트 표를 통해 찾아갈 파일 좌표일 뿐 — 브라우저 도구가 있어야 실제로 화면을 볼 수 있음.
- **Figma는 대체 아님**: 시각 디자인 협업은 여전히 Figma/Pencil(`design/catchhole.pen`) 몫. 이 방침은 텍스트로 표현 가능한 정보(API 요청사항 등)에 한정.
- **보안 예외**: URL을 인가 수단으로 쓰지 않음 — 권한/개인정보가 필요한 화면·데이터는 서버 측 검증 필수.
- **배포 URL 주의**: 보호 화면은 실제 API 인증과 서버 데이터를 요구하며, 백엔드 연결 실패 시 목 데이터로 전환하지 않는다.

## 인증/세션

API 호출은 `src/app/api/generated/`의 Hey API SDK와 TanStack Query 옵션을 사용합니다. 세션 저장은 `src/app/lib/auth.ts`, access token 자동 갱신은 `src/app/lib/auth-fetch.ts`에서 담당합니다.

- 로그인·회원가입: access token은 응답 body에서 localStorage에 저장하고, refresh token은 서버가 `/api/v1/auth` 경로의 HttpOnly 쿠키로 발급합니다. 회원가입은 한 번의 요청으로 가입과 자동 로그인을 완료합니다.
- Auth 모달 히스토리: 랜딩에서 열면 한 개의 히스토리 항목을 추가해 브라우저 뒤로가기로 닫습니다. 로그인↔회원가입 전환은 현재 항목을 교체하고, 직접 진입·보호 화면 리다이렉트로 열린 모달은 닫을 때 `/landing`으로 대체 이동합니다. 인증 성공은 `/works`, 로그아웃은 `/landing`으로 현재 항목을 교체합니다.
- 인증 요청: `credentials: include`를 사용하며, 보호 API가 401을 반환하면 refresh를 한 번 수행한 뒤 원래 요청을 재시도합니다. 동시에 발생한 401은 하나의 refresh 요청을 공유합니다.
- 인증 확인: `PrivateRoute`는 저장된 토큰 존재 여부뿐 아니라 `GET /api/v1/auth/me` 성공 여부를 TanStack Query로 확인합니다. 401에서만 세션을 제거하며, 5xx나 네트워크 오류는 토큰을 유지하고 화면 진입을 보류한 채 재시도를 제공합니다.
- 로그아웃: 진행 중인 refresh와 localStorage 토큰·Query 캐시를 먼저 제거한 뒤 서버 refresh token 폐기를 요청하고 `/landing`으로 이동합니다.
- 로그인·회원가입 화면에는 현재 제공하는 이메일·비밀번호 방식만 노출합니다.

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

## 상태 관리 & 서버 데이터 원칙

- **`AppContext`** — 화면 간 공유되는 작품 선택과 전환 상태를 관리합니다. 인증·서버 연결 상태와는 분리합니다.
- **`BackendStatusContext`** — 보호 API의 인증 실패 이벤트를 받아 토큰과 Query 캐시를 지우고 로그인으로 이동합니다.
- **서버 데이터 원칙**: 작품·회차·분석·캐릭터 화면은 생성 SDK와 TanStack Query를 통해 실제 API 데이터만 사용합니다. 연결 실패나 파일 미선택을 목 데이터 전환 조건으로 사용하지 않습니다.
- **NVM-260 세계관 데이터 원칙**: 세계관 후보는 회차 분석 배치의 독립 검토 단위이며, 확정 세계관은 `분류 + 대상` 하나에 문자열 key/value 설정 객체를 묶어 표시합니다. 캐릭터 후보 API나 설정집 원문 데이터를 세계관 후보로 추측·변환하지 않습니다.

## 참고 문서

- `design/catchhole.pen` — Pencil 디자인 소스 (위 "디자인 워크플로우" 참고)
- `docs/data-requirements/world-setting.md` — 세계관 후보 검토와 세계관 DB의 MVP 화면·데이터 요구사항

## 이슈 관리

GitHub 이슈는 **항상 `catchhole-backend-java` 레포에 등록**합니다 (프론트/백엔드 공용 이슈 트래커로 사용하기로 팀 합의됨). `catchhole-front` 레포의 이슈 탭은 아예 사용하지 않기로 약속함(여러 레포 이슈탭을 돌아다니며 확인하는 번거로움을 없애기 위함) — **프론트엔드 전용 변경이라 백엔드 작업이 전혀 없는 이슈여도** 예외 없이 `catchhole-backend-java`에 등록합니다. `catchhole-front`에는 이슈를 올리지 않습니다.

이슈/PR에는 영역을 구분할 수 있는 라벨을 정확히 달아주세요(예: 프론트엔드 전용 내용이면 `frontend` 라벨). 이슈 등록 자체는 필수가 아니지만, 등록한다면 이 규칙을 따릅니다.

## 커밋 컨벤션

`<type>(<scope>): <한글 설명>` 형식을 사용합니다.

```
feat(works): 작품 목록과 업로드를 백엔드 API로 연동
fix(episode-upload): 분석 목적 선택과 실패 재시도 상태를 정리
chore(design): Pencil 디자인 파일로 회차 업로드 플로우 와이어프레임 추가
```
