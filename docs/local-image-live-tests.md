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
