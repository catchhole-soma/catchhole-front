# 검토 흐름 조작 수 측정 (#211 후속)

정답을 미리 아는 합성 사례로 설정 후보 검토 화면의 화면 왕복·검색 반복·저장/확정 동작 수를 기록한다. 이 폴더의 JSON은 `e2e/review-flow-metrics.spec.ts`가 만든 결과를 그대로 옮긴 것이다. 인물명·설정값·원문은 모두 합성 데이터다.

## 파일

| 파일 | 내용 |
|---|---|
| `baseline-2026-10-30.json` | 기준선. #211 후속 개선 전 main 화면(`4f60c0c`)을 기준선 어댑터로 측정 |

JSON의 `uiCommit`은 측정한 화면 코드의 커밋, `headCommit`은 측정 spec·어댑터가 들어 있는 커밋이다. `scenarios.*.trace`에 어댑터가 밟은 조작과 요청이 순서대로 남는다.

## 합성 사례와 끝 조건

- A 캐릭터: 미상 묶음 후보 4건(1화 직업→인물H, 2화 소속·상태→인물B, 3화 나이→새 인물 인물J). 기존 인물 9명 중 인물H는 8명 단위 목록의 2페이지에 있다. 인물A 묶음(반영 방식 저장 완료 1건)이 다음 그룹으로 남아 있다. 끝 조건은 4건 모두 확정.
- B 세계관: 대상 미연결(`SUBJECT_UNRESOLVED`) 후보 5건을 모두 기존 대상 장소X에 연결해 확정. 같은 분류의 다른 장소 7개가 있어 장소X는 대상 목록 첫 페이지에 보이지 않는다.
- C 복구: A의 첫 현재 반영 선택 PATCH가 서버에는 저장되지만 응답이 유실된다. 끝 조건은 서버 저장과 화면의 저장 완료 표시가 일치하는 것.

## 지표

- `screenRoundTrips`: 검토 화면 밖 이동 + URL `group` 변경(사이드바 선택 `userGroupChanges`와 연결·확정 뒤 자동 이동 `autoGroupChanges`) + 캐릭터/세계관 탭 전환.
- `searchInputs`: 검색 입력 횟수 + 응답을 받은 `GET characters` 목록 요청(연결 모달의 페이지 넘김 포함) + 응답을 받은 `GET world-settings?q=` 요청. 화면이 스스로 취소한 조회는 `cancelledReads`로 따로 둔다.
- `saveRequests`: 보낸 PATCH/POST 수(응답 유실 포함), 경로별 `saveRequestsByRoute`. `clicks`, `pickerOpens`, `textEntries`, `pageLoads`, `failedWrites`는 이름 그대로다.
- 시간은 기록하지 않는다. 목 API라 원문 읽기·서버 대기 시간이 0으로 분리되며, 수치는 조작 수로만 읽는다.

## 2026-10-30 기준선

main 화면에서 세 시나리오 모두 끝 조건에 도달했다. 아래는 목 API 기준 조작 수이며 시간이 아니다.

| 시나리오 | 화면 왕복(자동) | 검색(입력/요청) | 모달 열기 | 쓰기 요청 | 클릭 |
|---|---|---|---|---|---|
| A 캐릭터 | 13 (7) | 5 (0/5) | 4 | 11 (연결 4·반영 방식 4·묶음 확정 3) | 26 |
| B 세계관 | 0 | 10 (5/5) | 0 | 6 (결정 저장 5·모두 확정 1) | 11 |
| C 복구 구간 | 0 | 0 | 0 | 2 (유실 1·재전송 1) | 2 |

- A: 후보마다 미상 묶음을 사이드바에서 다시 열고, 연결 직후 화면이 연결된 인물 묶음으로 자동 이동해 그 자리에서 현재 반영을 고른다. 인물 묶음은 확정 후 첫 그룹으로 자동 이동하므로 남은 묶음을 사이드바에서 다시 찾는다.
- B: 대상 검색·선택·`이 내용으로 검토 완료`를 행마다 반복하고 마지막에 `모두 확정`을 한 번 누른다.
- C: 응답 유실 뒤 화면은 목록을 다시 읽지 않아 오류만 보이고 선택은 비어 있으며 확정은 "확인할 설정이 남아 있어요"로 막힌다(서버에는 이미 저장됨). 같은 선택을 한 번 더 누르면 같은 PATCH가 다시 저장되고 저장 완료로 바뀐다. 표의 C 행은 실패한 선택부터 복구까지의 구간이며, 그 전 연결 절차는 JSON `phases.main`에 있다.

한계: 목 API·합성 사례 1건의 조작 수만 비교한다. 어댑터는 화면 문구와 역할 이름에 의존하므로 문구가 바뀌면 어댑터를 함께 고친다. 운영 데이터·실서버에서 측정하지 않았다.

## 다시 실행하기

npm이 없는 환경에서는 `node`로 각 도구를 직접 실행한다.

```bash
# 개선 화면(기본 METRICS_FLOW=improved). 개선 어댑터가 준비되기 전에는 skip된다.
node node_modules/vite/bin/vite.js --port 3000 --strictPort &
METRICS_FLOW=improved METRICS_LABEL=after-<단계> node node_modules/@playwright/test/cli.js test e2e/review-flow-metrics.spec.ts --workers=1

# 기준선: main 체크아웃에서 기준선 어댑터로 실행
METRICS_FLOW=baseline METRICS_LABEL=baseline-main METRICS_UI_COMMIT=<main 커밋> \
  node node_modules/@playwright/test/cli.js test e2e/review-flow-metrics.spec.ts --workers=1
cat test-results/review-flow-metrics/baseline-main.json
```

결과는 `test-results/review-flow-metrics/<METRICS_LABEL>.json`에 남는다. 다른 dev 서버와 포트를 나누려면 `CATCHHOLE_E2E_PORT=<포트>`를 주는데, 이때 Playwright가 `npm run dev -- --port <포트> --strictPort`로 서버를 직접 띄우므로 npm이 없으면 같은 인자를 Vite로 넘기는 `npm` 대체 스크립트를 PATH 앞에 둔다. 측정 전에는 절감률을 문서·PR·이슈에 쓰지 않는다.
