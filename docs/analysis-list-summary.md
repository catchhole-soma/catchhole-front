# 분석 목록 요약 계약 (#288)

`nav=analyses`는 `GET /api/v1/works/{workId}/analysis-jobs/batches?page=&size=10`의 현재 페이지 응답만으로 회차·설정집 카드를 표시한다. `analysisPage`는 URL에서 1부터, API에서는 0부터 시작한다. 전체 Job/회차/설정집, 개별 Job/설정집 본문, 후보 목록을 출처·집계 보완용으로 조회하지 않는다. 상세 조회는 진행·검토·원문으로 이동한 기존 화면에서 수행한다.

## 배포와 생성 코드

새 요약 계약을 제공하는 Backend를 먼저 배포하고 Front를 배포한다. 이전 API나 오래된 fixture에 대한 전체 조회 fallback은 없다. Swagger/OpenAPI가 단일 출처이며 SDK는 다음 명령으로 생성한다.

```bash
CATCHHOLE_OPENAPI_INPUT=http://127.0.0.1:28080/v3/api-docs npm run api:generate
```

## 카드 데이터와 이동

기존 top-level `status`와 `jobGroups`는 원고 배너 등 다른 소비자를 위해 유지된다. 목록의 회차 카드는 `episodeStatus`와 `episodeJobGroups`를 사용한다. `episodeStatus=null`인 설정집 전용 배치는 회차 카드를 표시하지 않는다. 회차 진행 URL은 해당 그룹의 `currentAnalysisJobIds`만 `analysisJobIds`/`currentAnalysisJobIds`에 전달한다. 혼합 배치에서도 설정집 ID를 회차 진행에 섞지 않는다.

`settingBooks`는 카드마다 `settingBookId`, 최신 추출 `sourceAnalysisJobId`, 그 origin의 실제 `batchId`, frozen `revisionId`, 표시 이름, 정규화 `status`, typed `failureCode`, `currentStep`, 원문 변경·과거 여부, `lastActivityAt`, 인물·세계관 후보 요약을 제공한다. 후보 요약은 total/reviewed/pending/directReview/processingCandidateCount다. 전체 원문·Job·상태 journal·원시 오류를 포함하지 않는다.

설정집 상태는 PENDING/IN_PROGRESS/COMPLETED/INTERRUPTED/FAILED/CANCELED/INVALIDATED다. INVALIDATED가 우선이며 ordered 실패는 INTERRUPTED다. SUCCEEDED+SEALED라도 자동 반영 시각이 없으면 설정집은 IN_PROGRESS다. 회차와 설정집의 기존 상태 의미를 프론트에서 임의로 합치지 않는다.

설정집 primary action은 대기·진행 시 진행 화면, 중단 시 사유 화면, 완료 후 directReview+processing 합이 양수이면 검토, 0이면 작품 설정, 과거 완료이면 전체 이력이다. 검토는 인물 directReview=0이고 세계관 directReview>0이면 세계관부터 연다. 검토·양쪽 전체 이력은 origin과 실제 batch를 전달하고, 원문은 settingBookId+revisionId로 분석 당시 버전을 연다. 검토 복귀는 현재 분석 목록 URL과 페이지를 보존한다.

## 갱신과 캐시

현재 페이지 배치 또는 설정집 요약이 진행 중일 때만 10초 간격으로 batches를 갱신한다. 설정집의 정규화 PENDING/IN_PROGRESS도 확인하므로 이전 배치에서 최신 origin으로 연결된 카드의 진행 상태를 놓치지 않는다. 완료·중단 목록은 polling하지 않는다.

처음 확인한 COMPLETED 설정집 origin마다 한 번 현재 설정·검색·이력·근거·설정집·다른 분석 목록 페이지 캐시를 무효화한다. 방금 받은 현재 목록 Query만 정확한 key로 제외하여 첫 응답이나 완료 polling 직후 같은 페이지를 중복 조회하지 않는다. 공유 무효화 helper의 다른 호출자는 기존 기본 동작을 유지한다. 화면 밖에서 완료된 분석과 진행→완료를 모두 처리하고 반복 무효화 루프를 막는다. 사용량 중단도 origin마다 한 번 설정집 문맥으로 알리며, 여러 회차 배치의 중단 알림 합산은 기존 동작을 유지한다.

부모의 episodes 조회와 polling은 원고 탭 또는 실제 회차 목록을 사용하는 열린 재분석 모달에만 활성화한다. 다른 탭으로 전환하면 회차 polling을 멈추고 원고로 돌아오면 다시 조회한다. 원고 배너의 진행→종료 갱신과 재분석 모달의 뒤 회차 집계는 유지한다.

## 검증과 측정 증거

2026-10-24 로컬 correctness 검증:

```bash
npm run test:e2e -- e2e/analysis-list.spec.ts e2e/analysis-list-summary.spec.ts e2e/setting-book-analysis.spec.ts e2e/setting-book-source.spec.ts e2e/ordered-analysis.spec.ts e2e/token-interruption.spec.ts --workers=3
npm run lint
npm run typecheck
npm run build
```

SDK 변경 후 관련 E2E 107/107, 마지막 완료 캐시·중복 조회 변경 후 summary E2E 16/16, 추가 원고 갱신·취소·실패 재시도 7/7을 확인했다. lint는 오류 없이 기존 react-refresh 경고 2개, typecheck와 build는 성공했다. 빌드의 기존 큰 청크 안내는 유지된다.

새 summary E2E는 최초 진입·10초 polling에 불필요한 API가 없는지 320/1280px에서 검증한다. 기존 관련 suite, 오류 재시도, 최신 origin·실제 batch, mixed source, 원문 revision, 이력 필터, 페이지·복귀, 설정집 상태·사용량 안내, 원고 탭 전환, 최초 완료·진행 완료 캐시 무효화를 포함한다. 실제 명령 출력은 작업 산출물의 `runtime/frontend-*.log`에 보존한다. API fixture를 사용하는 E2E 시간은 성능 측정값이 아니다.

별도 합성 작품 2개로 실제 로그인·HttpOnly refresh cookie, 설정집 전용 완료 검토/이력/목록 복귀/frozen 원문 GET, 혼합 배치 설정집 중단 진행과 회차 실패 진행을 브라우저에서 확인했다. 설정집 전용·혼합 배치 모두 초기 batches 조회는 1회이고 상세·후보·회차 조회는 0이며 원문·Job은 클릭 후 200, 다른 작품의 Job/원문 리비전은 404를 유지했다. 결과와 실제 화면은 작업 산출물 `evidence/frontend-live/result.json`과 같은 폴더의 PNG에 보존한다. 이 작품은 성능 측정 전에 제거하고 동일한 성능 fixture를 복원한다.

실제 PostgreSQL·인증된 페이지의 전후 측정과 SQL 원자료는 Backend [분석 목록 조회 개선 보고서](https://github.com/catchhole-soma/catchhole-backend-java/blob/codex/analysis-list-summary/docs/load-tests/2026-10-24-analysis-list.md)와 [#288](https://github.com/catchhole-soma/catchhole-backend-java/issues/288)에 연결한다. 같은 합성 60회차·후보 807개 조건에서 페이지 준비 중앙값은 446.8→129.4ms, p95는 463.3→184.3ms였다. 페이지의 API 호출은 6→3회, API 응답 본문 합계 중앙값은 124,223→7,887bytes로 줄었다. 브라우저 load p95는 65.6→119.2ms로 늘었으며, 페이지 준비와 별도로 원자료에 보존했다. 운영 배포 전 로컬 측정값이다.
