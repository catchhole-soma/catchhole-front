# CatchHole Frontend

웹소설/웹툰 작가·편집자가 회차 원고를 업로드하면 기존 설정집(인물/아이템/스킬/타임라인 등)과의 충돌·모순을 AI로 검사해주는 툴 **CatchHole**의 프론트엔드(React SPA)입니다.

## 기술 스택

- React 18 + TypeScript(strict) + Vite 6
- Tailwind CSS v4 + MUI 7 + Radix UI(shadcn 스타일 컴포넌트)
- react-router 7

## 시작하기

```bash
npm install

# 환경변수 설정
cp .env.example .env
# .env에서 VITE_API_BASE_URL을 백엔드 API 주소로 설정 (기본값: http://localhost:8080)

npm run dev
```

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 (Vite) |
| `npm run build` | 타입 체크(`tsc -b`) + 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 로컬 프리뷰 |

백엔드 연결이 안 되거나 `.env`가 없어도, 앱이 **데모 모드**로 전환되어 목 데이터로 화면을 둘러볼 수 있습니다 (자세한 동작은 `CLAUDE.md`의 "상태 관리 & 데모 모드" 참고).

## 주요 라우트

| 경로 | 화면 | 설명 |
| --- | --- | --- |
| `/login` | SLogin | 로그인 (공개) |
| `/signup` | SSignup | 회원가입 (공개) |
| `/` | S0WorkPicker | 작품 선택 (진입점) |
| `/dashboard` | S1Dashboard | 선택된 작품의 대시보드 |
| `/editor` | S2Editor | 원고 에디터 |
| `/chat` | S3Chat | 챗봇 |
| `/loading` | S4Loading | 분석 진행률 |
| `/report` | S5Report | 충돌/모순 리포트 |
| `/episode-upload` | SEpisodeUpload | 회차 업로드 (모드 선택 → 파일 업로드 → 회차 분리 확인 → 설정집 분석) |
| `/setting-review` | SSettingReview | 추출된 설정 후보 검토 |
| `/episode-validation-report` | SEpisodeValidationReport | 회차 검사(충돌/모순) 결과 |

`/login`, `/signup`을 제외한 모든 라우트는 인증(accessToken)이 필요합니다.

## 프로젝트 구조

```
src/app/
  components/catchhole/   # 화면 컴포넌트, 디자인 토큰(constants.ts), 타입, 목 데이터
  context/                 # AppContext, BackendStatusContext
  lib/                      # api, auth, worksApi, fileValidation
```

상세 구조, 디자인 시스템(토큰), 디자인 워크플로우, 커밋 컨벤션 등은 [`CLAUDE.md`](./CLAUDE.md)를 참고하세요.

## 배포

Vercel을 사용하며, `vercel.json`에 SPA 라우팅(파일시스템 우선 + `index.html` 폴백)이 설정되어 있습니다.

## 참고 문서

- [`CLAUDE.md`](./CLAUDE.md) — 프로젝트 컨텍스트, 디자인 시스템, 워크플로우, 컨벤션
