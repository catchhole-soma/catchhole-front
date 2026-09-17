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
