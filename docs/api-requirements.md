# 화면별 필요 데이터 및 API 요청사항 ([NVM-38](https://aiswmproject.atlassian.net/browse/NVM-38) 화면별 필요 데이터 및 API 요청사항 정리)

프론트 화면 기준으로 정리한 필요 데이터/API 요청사항입니다. 캐릭터 도메인 필드명·상태값은 백엔드 [`docs/character.md`](https://github.com/catchhole-soma/catchhole-backend-java/blob/main/docs/character.md)를 기준 문서로 그대로 따릅니다(여기서 재정의하지 않음).

> **환경 구분 주의**: 아래 "연동 완료"는 모두 **로컬 docker로 띈 백엔드(`./gradlew bootRun`) 기준**으로 확인한 것입니다. 실제 배포 URL(`https://catch-hole.vercel.app/`)에는 아직 백엔드가 연결되어 있지 않습니다(소마 AWS 지원 전이라 백엔드 호스팅 자체가 없음 — [NVM-48](https://aiswmproject.atlassian.net/browse/NVM-48) 프론트엔드 배포 환경 구성/백엔드 배포 의존). 따라서 "연동 가능/완료"라는 표현은 전부 로컬 환경 기준이며, 배포 환경에서의 동작을 보장하지 않습니다.

공통 응답 Envelope은 [`global.md`](https://github.com/catchhole-soma/catchhole-backend-java/blob/main/docs/global.md) 기준 `{ success, message, data, error, timestamp }` 형태를 그대로 사용합니다. 아래 예시는 `data` 필드 내용만 표기합니다.

## 작품 (Work) / 회차 (Episode) — 요청사항 없음

- `S0WorkPicker`(`/works`)의 작품 목록/생성, `SEpisodeUpload`(`/episode-upload`)의 회차 업로드는 이미 로컬 docker 백엔드 기준으로 연동 완료(`worksApi.ts`)되어 있어 별도 요청사항이 없습니다(실 배포 Vercel 환경에서는 미확인).

## 분석 작업 (Analysis Job)

- 화면:
  - `S4Loading` (`/loading`) — 분석 진행 중 보여주는 진행률 화면(청킹/추출 등 단계 표시)
  - `SEpisodeValidationReport` (`/episode-validation-report`) — 분석 완료 후 새 회차와 기존 설정 간 충돌·모순을 리포트로 보여주는 화면
- 프론트는 아직 `mockCreateAnalysisJob`으로 mock 처리 중이라, 실제 연동 전에 아래 계약(swagger 스키마 인용)을 미리 맞춰두고 싶습니다.

**`POST /api/v1/analysis-jobs`**
```json
// request body
{ "jobType": "EPISODE_VALIDATION", "batchId": "01970c2e-...d111" }
// response.data
{
  "id": "01970c2e-...d333", "workId": "01970c2e-...d444", "workTitle": "빛나는 검사 로맨스",
  "batchId": "01970c2e-...d111", "jobType": "EPISODE_VALIDATION", "status": "PENDING",
  "currentStep": "원문 청킹", "modelName": "gpt-4.1-mini"
}
```

## 캐릭터 설정 — 캐릭터 DB 탭 ([NVM-47](https://aiswmproject.atlassian.net/browse/NVM-47) 설정 DB 대시보드 - 캐릭터 DB 탭 API 연동 및 CRUD, S1Dashboard)

- 화면: `S1Dashboard` (`/dashboard`) → "캐릭터 DB" 탭 — 선택한 작품의 캐릭터 카드 목록, 캐릭터 추가/수정/확정/무시
- [NVM-140](https://aiswmproject.atlassian.net/browse/NVM-140)(캐릭터 설정 저장·수정·확정·무시 API 구현) 작업하실 때 아래 모양으로 부탁드립니다. 프론트는 그동안 mock으로 UI 먼저 구현해뒀습니다.

**`GET /api/v1/works/{workId}/characters`**
```json
// response.data
[
  {
    "id": "c1a2...", "name": "수아", "roleLabel": "주인공",
    "currentAge": 23, "currentLevel": null,
    "profileJson": { "gender": "여성", "affiliation": "검사 지망생" },
    "statsJson": null, "skillsJson": null, "itemsJson": null, "statusesJson": null,
    "firstAppearanceEpisodeId": "ep-1...", "reviewStatus": "CONFIRMED", "status": "ACTIVE"
  }
]
```

**`POST /api/v1/works/{workId}/characters`**
```json
// request body
{ "name": "수아", "roleLabel": "주인공", "currentAge": 23, "profileJson": { "gender": "여성" } }
// response.data → 위 GET 응답의 개별 항목과 동일한 구조
```

**`PATCH /api/v1/works/{workId}/characters/{id}/confirm`** / **`.../dismiss`**
```json
// request body 없음
// response.data
{ "id": "c1a2...", "reviewStatus": "CONFIRMED" }
```

## 캐릭터 설정 후보 확인 — AI 추출 검토 ([NVM-154](https://aiswmproject.atlassian.net/browse/NVM-154) AI 추출 캐릭터 설정 확인 및 최소 수정 UI 구현, SSettingReview)

- 화면: `SSettingReview` (`/setting-review`) — AI가 회차에서 추출한 설정 후보를 사람이 검토/확정/수정/무시하는 화면. 회차 업로드 흐름에서 설정집을 같이 올렸을 때 등장
- 위와 같은 맥락으로, 아래 모양 부탁드립니다. 프론트는 `mockEpisodeData.ts`로 UI 먼저 구현해뒀습니다.

**`GET /api/v1/works/{workId}/setting-candidates`**
```json
// response.data
[
  {
    "id": "sc1...", "entityType": "CHARACTER", "entityName": "수아",
    "attributeName": "age", "attributeValue": "23", "valueType": "NUMBER",
    "confidence": 0.94, "reviewStatus": "PENDING_REVIEW",
    "evidenceSpans": [{ "episodeNo": 3, "quote": "수아는 23살의..." }]
  }
]
```

**`PATCH /api/v1/works/{workId}/setting-candidates/{id}/confirm`** / **`.../dismiss`**
```json
// request body 없음
// response.data
{ "id": "sc1...", "reviewStatus": "CONFIRMED" }
```

## 상태값/필드명 합의 사항

- `CharacterReviewStatus` / `CharacterFactReviewStatus` / `SettingCandidateReviewStatus`: 모두 `PENDING_REVIEW` / `CONFIRMED` / `DISMISSED` (백엔드 [`docs/character.md`](https://github.com/catchhole-soma/catchhole-backend-java/blob/main/docs/character.md) 기준)
- 프론트 전용 `EDITED` 상태(수정 후 확정)는 백엔드에 대응 값이 없음 — 저장 시 `CONFIRMED`로 매핑하는 방식으로 처리 예정

## 에러 케이스 (초안)

- 작품/회차/캐릭터 미존재 시 404 + 공통 에러 응답([`global.md`](https://github.com/catchhole-soma/catchhole-backend-java/blob/main/docs/global.md) 기준 Envelope)
- 분석 작업 진행 중 중복 요청 시 409 또는 진행 중 작업 정보 반환
