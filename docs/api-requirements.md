# 화면별 필요 데이터 및 API 요청사항 (NVM-38)

프론트 화면 기준으로 정리한 필요 데이터/API 요청사항입니다. 캐릭터 도메인 필드명·상태값은 백엔드 `catchhole-backend-java/docs/character.md`를 기준 문서로 그대로 따릅니다(여기서 재정의하지 않음).

> **환경 구분 주의**: 아래 "연동 완료"는 모두 **로컬 docker로 띈 백엔드(`./gradlew bootRun`) 기준**으로 확인한 것입니다. 실제 배포 URL(`https://catch-hole.vercel.app/`)에는 아직 백엔드가 연결되어 있지 않습니다(소마 AWS 지원 전이라 백엔드 호스팅 자체가 없음 — NVM-48/백엔드 배포 의존). 따라서 "연동 가능/완료"라는 표현은 전부 로컬 환경 기준이며, 배포 환경에서의 동작을 보장하지 않습니다.

## 작품 (Work)

- 화면: `S0WorkPicker`
- 필요 데이터: 작품 목록(id, title, genre, episodeCount)
- 현재 상태: `GET /api/v1/works`, `POST /api/v1/works` 연동 완료 (`worksApi.ts`)

## 회차 (Episode)

- 화면: `SEpisodeUpload`
- 필요 데이터: 회차 업로드(원고 파일, 설정집 파일 선택), 업로드 결과(batchId, episodeCount)
- 현재 상태: `POST /api/v1/works/{id}/episodes` 연동 완료

## 분석 작업 (Analysis Job)

- 화면: `S4Loading`, `SEpisodeValidationReport`
- 필요 데이터: 작업 상태(PENDING/RUNNING/SUCCEEDED/FAILED), 진행 단계, 결과 요약
- 현재 상태: `analysis-jobs` 경로 swagger에 존재(연동 범위는 별도 확인 필요)

## 캐릭터 설정 — 캐릭터 DB 탭 (NVM-47, S1Dashboard)

- 필요 데이터: 작품별 캐릭터 목록(`WorkCharacter`: name/roleLabel/currentAge/currentLevel/profileJson/statsJson/skillsJson/itemsJson/statusesJson/firstAppearanceEpisodeId/reviewStatus/status), 캐릭터 추가/확정/무시
- **현재 상태: 백엔드 REST API 미구현 (`NVM-140` 진행 중, `@RestController` 없음)**. DB/도메인 모델(`WorkCharacter`, `CharacterFact`)은 `NVM-137`에서 완료됨. 프론트는 그동안 mock 데이터로 UI만 구현.
- 요청사항: `NVM-140` API가 나오면 아래 엔드포인트 필요
  - `GET /api/v1/works/{workId}/characters` — 캐릭터 목록 조회
  - `POST /api/v1/works/{workId}/characters` — 캐릭터 추가
  - `PATCH /api/v1/works/{workId}/characters/{id}/confirm` — 확정
  - `PATCH /api/v1/works/{workId}/characters/{id}/dismiss` — 무시

## 캐릭터 설정 후보 확인 — AI 추출 검토 (NVM-154, SSettingReview)

- 필요 데이터: `SettingCandidate` 목록(entityName/attributeName/attributeValue/confidence/reviewStatus/evidenceSpans), 개별 확정/수정/무시
- 현재 상태: 마찬가지로 백엔드 API 미구현, 프론트 mock(`mockEpisodeData.ts`)으로 UI 구현
- **신규 요청 항목**: 고신뢰도 후보를 한 번에 처리하는 벌크 확정 API — `PATCH /api/v1/works/{workId}/setting-candidates/bulk-confirm` (body: 신뢰도 threshold 또는 후보 id 목록). 프론트는 이 기능을 mock 단계에서 먼저 구현(NVM-154), 백엔드 측 엔드포인트가 아직 계획에 없어 여기서 요청.

## 상태값/필드명 합의 사항

- `CharacterReviewStatus` / `CharacterFactReviewStatus` / `SettingCandidateReviewStatus`: 모두 `PENDING_REVIEW` / `CONFIRMED` / `DISMISSED` (백엔드 `docs/character.md` 기준)
- 프론트 전용 `EDITED` 상태(수정 후 확정)는 백엔드에 대응 값이 없음 — 저장 시 `CONFIRMED`로 매핑하는 방식으로 처리 예정

## 에러 케이스 (초안)

- 작품/회차/캐릭터 미존재 시 404 + 공통 에러 응답(`global.md` 기준 Envelope)
- 분석 작업 진행 중 중복 요청 시 409 또는 진행 중 작업 정보 반환
