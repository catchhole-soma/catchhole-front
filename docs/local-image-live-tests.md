# 이미지·첫 안내 실서버 테스트

`private-images-live`, `character-images-live`, `analysis-mode-guide-live`는 `e2e/local-live-fixture.ts`를 공유한다. 각 테스트 및 재시도마다 새 계정이 생성되고, 성공·실패 후 작품 영구 삭제를 기다린 다음 생성한 계정을 정리한다. 운영 API·DB는 지원하지 않으며 두 주소 모두 localhost여야 한다. 전용 seed 계정의 비밀번호 해시만 복사하고 seed의 작품·안내·보관함은 변경하지 않는다. 회원가입·SMS·이메일 발송은 실행하지 않는다.

필요 환경 변수:

- `CATCHHOLE_E2E_API_BASE_URL`: 로컬 API 주소
- `CATCHHOLE_E2E_DATABASE_URL`: 명시적으로 선택한 로컬 테스트 PostgreSQL URL
- `CATCHHOLE_E2E_SEED_EMAIL`, `CATCHHOLE_E2E_SEED_PASSWORD`: 기존 전용 테스트 계정
- `CATCHHOLE_E2E_PYTHON`: psycopg가 설치된 Python 경로. 생략 시 python3

환경 변수는 로컬 환경에서 주입하고 저장소나 실행 로그에 비밀번호·토큰을 기록하지 않는다. DB 환경 변수까지 없으면 일반 E2E 실행에서는 이 테스트들을 건너뛴다. 테스트 서버의 작품 purge 스케줄러는 활성화되어 있어야 한다.

```sh
npx playwright test e2e/private-images-live.spec.ts e2e/character-images-live.spec.ts e2e/analysis-mode-guide-live.spec.ts --workers=1 --repeat-each=2
```

`--repeat-each=2`에서도 별도 계정을 준비하므로 안내 기록·보관함·같은 이름의 대상이 충돌하지 않는다. 테스트 실패 시에도 fixture teardown을 실행하며, 작품 삭제가 실패하면 계정을 남겨 원인을 확인할 수 있도록 오류를 반환한다. 프로세스 강제 종료까지 자동 정리되는 구조는 아니다.

## 신규 회차 검수 실제 연결 (`episode-validation-live`, GH314 V1)

`e2e/episode-validation-live.spec.ts`도 같은 fixture로 실행마다 새 계정을 만들고 테스트 작품을 파기한다. 위 네 변수에 더해 **같은 로컬 API에 연결된 추출 Worker와 검수 Worker**가 떠 있어야 하며, 이를 명시하는 `CATCHHOLE_E2E_VALIDATION_WORKER=1`이 없으면 건너뛴다(skip은 통과로 세지 않는다). 실제 모델을 호출하므로 사용자가 승인한 실행에서만 켠다.

- Backend: `VALIDATION_EXECUTION_ENABLED=true`와 모든 분기·역할 예산(`validation.execution.*`), `WORK_PURGE_SCHEDULING_ENABLED=true`. Front 개발 서버 origin을 `CORS_ALLOWED_ORIGINS`에 넣는다.
- AI: `scripts.run_analysis_worker`(기본 kind)와 `scripts/run_validation_worker.py --enable --poll-seconds <n>`를 같은 `SPRING_INTERNAL_API_*`·일회용 DB로 실행한다.
- 확인 범위는 핵심 경로 하나다: 1화 기존 설정 구축 → 2화 신규 회차 검수(추출 Job 없음) → 실제 리포트 → 화면 판단 저장 1건 → `검토 완료 후 설정 추출` → APPLIED 또는 APPLICATION_HELD, 검토 전 다음 회차 업로드 409와 업로드 화면 차단 안내. 합성 원고 두 회차(각 300자 안팎)라 한 실행의 검수 호출은 약 10~20회다.

```sh
CATCHHOLE_E2E_VALIDATION_WORKER=1 CATCHHOLE_E2E_PORT=3321 VITE_API_BASE_URL=http://localhost:18080 \
  npx playwright test e2e/episode-validation-live.spec.ts --workers=1
```

2026-10-30 로컬 실행은 2회 모두 통과했다(7.4분·4.7분, 검수 228초, 설정 0·오탈자 1 → APPLIED). 단, 이때 검수 Worker는 AI main 그대로가 아니라 대상 span 참조(`TSEG1`→`T1`)를 고치는 진단 래퍼로 실행했다. AI main 그대로는 설정 검사가 끝나지 않아 이 spec이 `실제 모델 검사가 두 분기 모두 끝나야 합니다`에서 실패한다. 원인과 수정 범위는 AI `docs/episode-validation-evaluation.md`, 스택 구성은 Front PR #106의 V1 절에 있다.

### 설정 정정과 재검수 왕복 (`episode-validation-correction-live`, GH314 F3)

`e2e/episode-validation-correction-live.spec.ts`는 위와 같은 변수·Worker·`CATCHHOLE_E2E_VALIDATION_WORKER=1` 조건에서만 실행하고, 없으면 건너뛴다. 실제 모델을 호출한다.

- 원고: 1화는 위 spec과 같고(서윤 `서른 살`), 2화는 위 2화 첫 문단 뒤에 변화가 아닌 나이 모순 `등대지기 서윤은 스물여덟 살이다.` 한 문단만 더했다(오탈자 `됬다` 유지). 1화 업로드·설정 구축과 신규 회차 검수 접수는 두 spec이 `e2e/validation-live-helpers.ts`를 같이 쓴다.
- 흐름: 1화 기존 설정 구축(서윤 현재 나이 30 확인) → 2화 신규 회차 검수 → 검토 대기(AWAITING_REVIEW)에서 서윤 캐릭터 basis가 있는 설정 검사 항목 선택(나이 slot basis 우선) → 리포트 `설정 정보 정정` → 캐릭터 상세에서 나이 28 저장(`POST /corrections` 하나, 일반 PATCH 없음) → receipt·`correctionResult=linked` → 현재 report 유지 + `RECHECK` → `수정 내용으로 재검수` → 새 report(`previousReportId`=이전 report, 이전 report `current=false`) 검사 종료(완료 여부는 아래 참고).
- 2화 검사와 재검수는 각각 PARTIAL로 끝나면 서버가 `RETRY`를 허용할 때만 리포트의 `중단된 검사 다시 시도`로 한 번씩 다시 시도할 수 있다(annotation `retry-used`=`first`·`recheck`, `retry-seconds-first`·`retry-seconds-recheck`). 2화 검사가 그래도 COMPLETED가 아니면 `/results`의 상태·실패 코드를 담아 실패한다. 재검수 실행 완료(COMPLETED)는 #341(검수 Worker가 변화·예외 조회 없는 충돌 의심 판정을 분기 전체 실패로 처리) 해결 전까지 soft이며(annotation `recheck-execution`, 미완료면 `age-conflict-after=미판정`), 해결 뒤 hard로 되돌린다. 재검수가 FAILED·CANCELED로 끝나면 실패한다.
- 정정은 고정 기준과 현재 설정이 그대로일 때만 저장되므로 검토 완료·설정 추출 전에 한다. 정정 409·응답 유실 안내가 나오면 그 화면 문구로 실패한다.
- 흐름 사실은 바로 실패시키고, 모델 판정(정정 전 서윤 나이 충돌이 있음·재검수 뒤 없음)은 soft assertion과 annotation(`age-conflict-before`·`age-conflict-after`, 항목 수, 선택 항목, snapshot version, 사용량)으로 남긴다. 서윤 basis가 있는 설정 검사 항목이 없으면 실패한다.

```sh
CATCHHOLE_E2E_VALIDATION_WORKER=1 CATCHHOLE_E2E_PORT=3321 VITE_API_BASE_URL=http://localhost:18080 \
  npx playwright test e2e/episode-validation-correction-live.spec.ts --workers=1
```
