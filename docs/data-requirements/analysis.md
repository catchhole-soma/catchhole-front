# 데이터 요구사항 — Analysis(분석)

> 분석 진행(S4Loading)은 BE `analysis`(analysis-job) 도메인과 대응한다. 오류 리포트·회차 검사(충돌 검수)의 BE 도메인 배치(analysis 산하 vs 별도 도메인)는 협의 필요([NVM-142](https://aiswmproject.atlassian.net/browse/NVM-142)와 연동).

[← 전체 인덱스](./README.md)

## 목차

- [분석 진행 (S4Loading)](#분석-진행-s4loading)
- [오류 리포트 (S5Report)](#오류-리포트-s5report)
- [회차 검사 결과 (SEpisodeValidationReport)](#회차-검사-결과-sepisodevalidationreport)

---

## 분석 진행 (S4Loading)

**URL**: [`/loading`](https://catch-hole.vercel.app/loading)

![분석 진행 중](../screens/Z0hcsQ.png)

**1. 화면에 표시할 데이터**
- 진행 애니메이션, 단계별 진행(캐릭터 설정 확인 → 타임라인 검증 → 관계·능력 탐지)
- 회차별 처리 상태(청킹 → 전처리 → AI 추출, `Episode.status`) — 작업 상세 응답에 회차별 상태를 포함하는 것은 BE 후속 확장 대상 ([5. 분석 진행](./upload.md#5-분석-진행)과 공통)

**2. 사용자 액션**
- 자동 완료 후 결과 화면으로 이동

**3. 화면 전환 식별자**
- `analysisJobId`, `episodeId` → 완료 시 [오류 리포트](#오류-리포트-s5report)로 이동 (회차 업로드 쪽은 이 화면을 거치지 않고 자체 진행 단계에서 분기 — [회차 업로드의 분석 진행](./upload.md#5-분석-진행) 참고)

**4. 데이터 없음 / 실패 표시**
- 분석 실패(FAILED) 상태, 재시도 안내

**5. BE에 요청할 데이터**
- 분석 작업 상태: `status`(`PENDING`/`RUNNING`/`SUCCEEDED`/`FAILED`) + 현재 단계(`currentStep`) — 진행률(%)은 BE가 제공하지 않기로 확정(fake percentage 미저장)이므로 단계 매칭 기반 UI로 표시
- 실패 시 `errorMessage`
- 완료 시 결과 식별자

**6. BE와 협의할 범위·상태값**
- 6-1. 진행 상태를 폴링으로 받을지 푸시(SSE 등)로 받을지
- 6-2. `currentStep`은 계약상 자유 텍스트(길이 100 제한만 있음) — AI 워커의 `AnalysisStep` enum 8종(`LOADING`/`CHUNKING`/`PREPROCESSING`/`EMBEDDING`/`SETTING_EXTRACTION`/`VALIDATION`/`PERSISTING`/`DONE`)을 계약 값 집합으로 승격할지 합의 필요([NVM-203](https://aiswmproject.atlassian.net/browse/NVM-203))
- 6-3. 실패(`FAILED`) 후 "다시 시도"의 서버 동작: 실패한 작업을 `PENDING`으로 되돌려 재실행할지, 새 분석 작업을 생성할지 — [BE analysis.md](https://github.com/catchhole-soma/catchhole-backend-java/blob/main/docs/analysis.md)의 '정책 미확정 TODO'와 동일 항목이라 그 논의에 합류하면 됨

---

## 오류 리포트 (S5Report)

**URL**: [`/report`](https://catch-hole.vercel.app/report) · 발행 전 전체 검수: [`/report?mode=prePublish`](https://catch-hole.vercel.app/report?mode=prePublish)

![오류 리포트 - 단일 회차 검수](../screens/vH0dF.png)

회차 원고와 기존 설정 DB를 대조해 충돌/모순을 보여준다. 대시보드·에디터에서 분석을 실행했을 때 도착하는 결과 화면으로, 단일 회차 또는 `?mode=prePublish`로 작품 전체 회차를 대상으로 한다. ([회차 검사 결과](#회차-검사-결과-sepisodevalidationreport)와 카드 구조는 같고, 대상 범위·진입 경로만 다름)

**1. 화면에 표시할 데이터**
- 요약: 탐지 오류 수, 심각도별(심각/주의/낮음) 집계
- 필터: 전체 / 높음 / 중간 이하
- 오류 카드별:
  - 오류 유형(태그), 심각도(높음/중간/낮음)
  - 제목, 변경 화살표(기존 값 → 현재 값)
  - 원문 인용 비교 — **기존 근거 문장**(근거 회차·문단)과 **문제된 신규 원문 문장**(회차·행), 하이라이트
  - 설정 등장 이력 (회차별 일치/충돌)
  - AI 수정 제안

**2. 사용자 액션**
- 오류 무시 / 되돌리기, 카드 펼치기
- 에디터에서 수정(MVP 범위 밖), 원문 화수로 이동, AI 제안 적용
- 공유, 발행 전 전체 검수 모드 전환

**3. 화면 전환 식별자**
- `episodeId`, `?mode=prePublish`, (오류) `issueId`

**4. 데이터 없음 / 실패 표시**
- 충돌 없음 상태 ([발행 전 검수 충돌 없음](../screens/f7ojLm.png))
- 발행 전 전체 검수 모드 ([화면 캡처](../screens/j7heI.png))

**5. BE에 요청할 데이터**
- 오류(충돌/모순) 목록, 각 항목:
  - 오류 유형, 심각도
  - 문제된 신규 원문 문장
  - 비교 대상 기존 근거 문장
  - 근거 회차/문단 위치
  - 설정 등장 이력
  - 수정 제안

**6. BE와 협의할 범위·상태값**
- 6-1. 심각도 단계 기준값과 표기 방식
- 6-2. 근거 위치 정보 형식 (회차 / 문단 / 행 단위)
- 6-3. 오류 유형 분류 체계 (사실·타임라인·관계·소지품·수치 등)
- 6-4. AI 수정 제안 제공 여부·형식
- 6-5. "발행 전 전체 검수"의 범위 지정 방식(전체 회차 일괄)
- 6-6. **충돌/리포트 BE 도메인 미정**: 이 화면 응답을 analysis 도메인에 둘지 별도 domain(예: report/conflict)으로 뺄지 BE 협의 필요

---

## 회차 검사 결과 (SEpisodeValidationReport)

**URL**: [`/episode-validation-report`](https://catch-hole.vercel.app/episode-validation-report)

![회차 검사 결과](../screens/EmGjn.png)

신규 회차 검수(EPISODE_VALIDATION) 후 충돌/모순 결과. [오류 리포트](#오류-리포트-s5report)와 오류 카드 구조는 동일하고, **방금 업로드한 회차(들)만 대상으로 한다**는 점과 회차 업로드 플로우의 종착지라는 진입 경로만 다르다.

**1. 화면에 표시할 데이터**
- 충돌·오류 건수 뱃지, 필터(전체/충돌/오류/무시)
- 오류 카드 (오류 리포트와 동일 구조)

**2. 사용자 액션**
- 무시 / 필터, (수정), 이슈 선택

**3. 화면 전환 식별자**
- `episodeId`(들), (이슈) `?issue=`

**4. 데이터 없음 / 실패 표시**
- 충돌 없음 상태 ([충돌 없음](../screens/uxGcn.png))

**5. BE에 요청할 데이터**
- 회차 검사 결과(충돌/모순) — 오류 리포트와 동일 구조

**6. BE와 협의할 범위·상태값**
- 6-1. 오류 리포트와 동일 (심각도·근거 위치·유형 분류·수정 제안)
- 6-2. 단일 회차 검수와 동일 응답 스키마를 공유할지
- 6-3. **충돌/리포트 BE 도메인 미정**: 오류 리포트와 동일한 협의 대상(analysis 산하 vs 별도 domain)
