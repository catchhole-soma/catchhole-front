# CLAUDE.md

CatchHole 프론트엔드(`catchhole-front`) 작업 시 참고할 공용 컨텍스트입니다. 팀 전체가 보는 문서이므로 개인 메모는 `CLAUDE.local.md`(gitignore됨)에 작성하세요.

## 프로젝트 개요

CatchHole은 웹소설/웹툰 작가·편집자가 회차 원고를 업로드하면 기존 설정집(인물/아이템/스킬/타임라인 등)과의 충돌·모순을 AI로 검사해주는 툴입니다. 이 레포는 그 프론트엔드(React SPA)입니다.

## 기술 스택 & 명령어

- React 18 + TypeScript(strict) + Vite 6
- Tailwind CSS v4 + MUI 7 + Radix UI(shadcn 스타일 컴포넌트) + react-router 7
- 경로 별칭: `@/*` → `src/*`
- 명령어: `npm run dev` / `npm run build`(`tsc -b && vite build`) / `npm run preview`

## 디렉토리 구조

- `src/app/components/catchhole/` — 화면 컴포넌트
  - `S0WorkPicker`, `S1Dashboard` ~ `S5Report`: 메인 작업 흐름 화면
  - `SEpisodeUpload`, `SEpisodeValidationReport`, `SSettingReview`: 회차 업로드/검사/설정 검토 플로우
  - `SLogin`, `SSignup`, `AppSidebar`, `GraphView`, `ReviewLayout` 등 공용 UI
  - `constants.ts` — 디자인 토큰(`C` 객체)과 공용 타입(`types.ts`)·목 데이터(`mockEpisodeData.ts`)
- `src/app/context/` — `AppContext`(전역 상태), `BackendStatusContext`(백엔드 연결 상태 감지 → 데모 모드 판단)
- `src/app/lib/` — `api.ts`, `auth.ts`, `worksApi.ts`, `fileValidation.ts`

## 라우팅

라우트는 `src/app/App.tsx`에서 정의합니다. `/login`, `/signup`을 제외한 모든 라우트는 `PrivateRoute`로 감싸져 있어 accessToken이 없으면 `/login`으로 리다이렉트됩니다.

| 경로 | 화면 | 설명 |
| --- | --- | --- |
| `/login` | `SLogin` | 로그인 (공개) |
| `/signup` | `SSignup` | 회원가입 (공개) |
| `/` | `S0WorkPicker` | 작품 선택 (진입점) |
| `/dashboard` | `S1Dashboard` | 선택된 작품의 대시보드 |
| `/editor` | `S2Editor` | 원고 에디터 |
| `/chat` | `S3Chat` | 챗봇 |
| `/loading` | `S4Loading` | 분석 진행률 |
| `/report` | `S5Report` | 충돌/모순 리포트 |
| `/episode-upload` | `SEpisodeUpload` | 회차 업로드 (모드 선택 → 파일 업로드 → 회차 분리 확인 → 설정집 분석) |
| `/setting-review` | `SSettingReview` | 추출된 설정 후보 검토 |
| `/episode-validation-report` | `SEpisodeValidationReport` | 회차 검사(충돌/모순) 결과 |

화면 전환에는 `TransitionType`(`push-right`/`push-left`/`cover-up`/`pop`/`dissolve`, `constants.ts`)을 사용합니다.

## 인증/세션

핵심 로직은 `src/app/lib/auth.ts`에 있습니다.

- 로그인: `POST /api/v1/auth/login` → accessToken을 localStorage에 저장
- 회원가입: `POST /api/v1/auth/signup` → 가입 즉시 자동 로그인
- 로그아웃: `POST /api/v1/auth/logout` → localStorage 토큰 제거
- `SLogin.tsx`의 소셜 로그인(카카오/구글) 버튼은 아직 **목(mock) 구현** — 실제 OAuth 연동 전까지 mock token만 저장됨
- 인증 상태는 `AppContext`가 아니라 localStorage(accessToken) 기준으로 `PrivateRoute`가 직접 판단

## 백엔드 API 문서 (Swagger)

로컬에서 `catchhole-backend-java`를 `./gradlew bootRun`으로 띄우면(Docker Desktop 필요, `compose.yaml`이 로컬 Postgres 컨테이너를 자동 기동):

- Swagger UI: `{VITE_API_BASE_URL}/swagger-ui/index.html`
- OpenAPI JSON: `{VITE_API_BASE_URL}/v3/api-docs`

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
2. **`design/catchhole.pen` (Pencil, 레포 내 버전관리 디자인 소스)**: Pencil MCP로 직접 편집·스크린샷 추출 가능한 `.pen` 파일. 코드와 함께 git으로 추적되는 디자인 소스로, `.stitch/design.md`의 Obsidian Violet 토큰과 `SEpisodeUpload.tsx` 등 실제 화면을 참고해 작성됨. 현재 회차 업로드 플로우 핵심 4화면(업로드 모드 선택/단일 회차 입력/회차 분리 확인/설정 확인) 포함.

## 상태 관리 & 데모 모드

- **`AppContext`** — 화면 간 공유되는 UI 상태: `selectedWork`(작품 선택, `WorkId`: `detective`/`murim`), `editorMode`(`edit`/`view`), `reportMode`(`single`/`prePublish`) 등. 인증/백엔드 연결과는 무관.
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
