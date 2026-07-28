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
- 신규 `AnalysisJob` 하나는 단일 회차 상태만 나타냅니다. 업로드 진행 화면의 전체 성공·일부 실패·진행 중 표시는 같은 batch의 현재 Job 목록을 집계해 계산하고, 다른 Job이 아직 진행 중이면 실패 재시도를 먼저 열지 않습니다.
- 실패 재시도 응답도 새 회차별 Job 목록입니다. 기존 실패·성공 Job ID는 추적 이력으로 유지하고 새 ID만 현재 polling 대상으로 전환합니다.

## 인증과 세션

- `/login`과 `/signup`은 랜딩 위에 표시하는 라우트 모달로 유지합니다. 랜딩에서 열 때만 브라우저 뒤로가기로 닫고, 직접 진입·보호 라우트 리다이렉트로 연 경우 닫을 때 `/landing`으로 대체 이동합니다. 로그인↔회원가입 전환과 인증 성공에는 `replace`를 사용하며, 로그아웃은 `/landing`으로 대체 이동합니다.
- access token은 응답 body에서 받아 localStorage에 저장하고, refresh token은 HttpOnly 쿠키로만 취급합니다. refresh token을 JavaScript에서 읽거나 로그에 남기지 않습니다.
- 모든 백엔드 요청은 `credentials: include`와 공통 `fetchWithAuth` 경로를 유지합니다.
- 보호 API의 401은 refresh 한 번과 원 요청 한 번만 재시도하며, signup/login/refresh/logout에는 refresh 재시도를 적용하지 않습니다.
- 로그아웃이나 세션 제거 시 진행 중인 refresh를 즉시 무효화하고, 이전 세션에서 시작된 refresh 응답으로 access token을 복원하지 않습니다.
- 회원가입은 가입과 토큰 발급을 한 요청으로 완료합니다. 소셜 로그인은 실제 OAuth 계약이 준비되기 전까지 비활성 상태로 둡니다.
- 실제 로그인·회원가입 성공으로 access token을 저장할 때는 데모 모드와 데모 작품 데이터를 함께 제거해 실제 API 모드로 전환합니다.
- 인증 상태는 `GET /api/v1/auth/me`로 검증하며, localStorage 토큰 존재만으로 로그인 성공을 판단하지 않습니다.
- `/auth/me`의 401에서만 세션을 제거하고 로그인으로 이동합니다. 5xx나 네트워크 오류에서는 토큰을 유지하고 보호 화면 진입을 보류한 채 재시도를 제공합니다.

## 변경 원칙

- `design/catchhole.pen`, `docs/auth.md`, 화면 흐름 문서를 함께 확인하고 기존 Obsidian Violet 토큰을 재사용합니다.
- 사용자 입력 제약은 프론트 검증과 OpenAPI DTO 계약을 일치시킵니다.
- 민감한 토큰, 쿠키, 비밀번호를 테스트 출력·문서·커밋에 남기지 않습니다.
- 커밋과 push는 실제 연동 검증이 끝나고 사용자가 명시적으로 요청한 뒤에만 수행합니다.

## GitHub 협업

- PR 본문은 `.github/PULL_REQUEST_TEMPLATE.md`의 개요·작업 내용·Jira 이슈·PR 유형·확인 사항·참고 사항 구조를 유지하고 실제 변경과 검증 결과로 채웁니다.
