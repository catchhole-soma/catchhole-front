# CatchHole Workflow Board 검토 결과

`design/catchhole.pen`의 WF-01~WF-05를 `docs/screen-flow.md`, 실제 라우트, 각 화면의 이동 코드와 대조한 결과입니다. 이번 작업에서는 Pencil 보드와 검토 문서만 수정했으며 애플리케이션 코드는 변경하지 않았습니다.

## 검토 기준

- 라우트와 인증 게이트: [`App.tsx`](../../src/app/App.tsx)
- 전체 화면 흐름: [`screen-flow.md`](../screen-flow.md)
- 사이드바 이동: [`AppSidebar.tsx`](../../src/app/components/catchhole/AppSidebar.tsx)
- 회차 업로드 분기: [`SEpisodeUpload.tsx`](../../src/app/components/catchhole/SEpisodeUpload.tsx)
- 검토·리포트 이동: [`SSettingReview.tsx`](../../src/app/components/catchhole/SSettingReview.tsx), [`S5Report.tsx`](../../src/app/components/catchhole/S5Report.tsx)
- Pencil 상태 목록: [`PENCIL_MIGRATION.md`](../../design/PENCIL_MIGRATION.md)

## 이번에 보드에서 바로 수정한 내용

1. 모든 보드의 단일 문자 화살표를 길이가 확보된 방향형 패스로 교체했습니다.
2. 보드 제목, 부제, 전환 설명의 계층과 크기를 보강했습니다.
3. 보라색 사용자 이동, 주황색 조건·모달, 초록색 자동 완료, 빨간색 코드 미연결을 설명하는 범례를 각 보드에 추가했습니다.
4. WF-02 부제에 사이드바 항목이 순차 단계가 아니라 독립 분기임을 명시했습니다.
5. WF-04의 분석 완료 후 결과 이동을 실제 코드에 맞게 `자동 완료`에서 `버튼 선택 + 조건 분기`로 수정했습니다.
6. WF-05의 전체 검수 성공 화면을 구현 완료 상태가 아닌 `코드 미구현 디자인 제안`으로 표시했습니다.
7. WF-02의 레거시 업로드 모달 제목에 `진입점 없음`을 명시했습니다.

## 코드와 흐름의 불일치

| ID | 우선순위 | 판정 | 근거 | 사용자 영향 |
| --- | --- | --- | --- | --- |
| F-01 | 높음 | 챗봇에서 사이드바의 분석 리포트·그래프·원고 목록을 누르면 선택한 섹션이 보존되지 않습니다. | [`AppSidebar.tsx#L57`](../../src/app/components/catchhole/AppSidebar.tsx#L57)는 대시보드 밖에서 `/dashboard`로 이동한 뒤 `onNavChange`를 호출하지만, [`S3Chat.tsx#L277`](../../src/app/components/catchhole/S3Chat.tsx#L277)은 해당 콜백을 전달하지 않습니다. | 어떤 항목을 눌러도 대시보드 기본값인 설정 DB로 도착할 수 있습니다. |
| F-02 | 높음 | 회차 업로드 Stepper의 현재 단계 계산이 실제 화면보다 한 단계 뒤처집니다. | [`SEpisodeUpload.tsx#L447`](../../src/app/components/catchhole/SEpisodeUpload.tsx#L447)에서 `processing`이 `2 + (includeSettings ? 1 : 0)`을 반환합니다. | 분석 중인데 회차 정보 또는 설정집 결과 단계가 활성화되어 현재 위치를 잘못 안내합니다. |
| F-03 | 높음 | 설정 후보 검토 완료 CTA의 문구와 목적지가 다릅니다. | [`SSettingReview.tsx#L350`](../../src/app/components/catchhole/SSettingReview.tsx#L350)의 `회차 검사 시작 →` 버튼은 `/dashboard`로 이동합니다. | 사용자는 새 검사가 시작된다고 기대하지만 실제로는 대시보드로 돌아갑니다. |
| F-04 | 중간 | 발행 전 전체 검수의 0건 성공 UI는 코드에 없습니다. | [`S5Report.tsx#L620`](../../src/app/components/catchhole/S5Report.tsx#L620) 이후는 고정 `ERROR_DATA`를 집계·렌더링하며 0건 전용 분기가 없습니다. | Pencil의 성공 상태를 구현 완료 화면으로 오해할 수 있습니다. WF-05에서는 코드 미구현으로 정정했습니다. |
| F-05 | 중간 | 발행 전 검수의 주요 버튼 세 개가 동작하지 않습니다. | [`S5Report.tsx#L698`](../../src/app/components/catchhole/S5Report.tsx#L698)의 `범위 변경`, [`S5Report.tsx#L763`](../../src/app/components/catchhole/S5Report.tsx#L763)의 `전체 펼치기`, `리포트 복사`에 핸들러가 없습니다. | 흐름상 다음 행동처럼 보이지만 실제로는 막힌 경로입니다. |
| F-06 | 중간 | “대시보드 내부 상태는 모두 쿼리 파라미터로 딥링크된다”는 문서 설명이 실제보다 넓습니다. | [`screen-flow.md#L188`](../screen-flow.md#L188)과 달리 [`S1Dashboard.tsx#L2826`](../../src/app/components/catchhole/S1Dashboard.tsx#L2826)의 업로드·설정 빌더·세계관 빌더·공유 모달은 로컬 상태입니다. | 새로고침·공유 링크로 같은 모달 상태를 복원할 수 없습니다. |
| F-07 | 중간 | 리포트의 공유 흐름은 `내보내기` 탭으로 열리지만 WF-05는 공용 기본 모달 상태를 사용합니다. | [`S5Report.tsx#L794`](../../src/app/components/catchhole/S5Report.tsx#L794)는 `defaultTab="export"`를 전달합니다. 공용 기본값은 [`ShareModal.tsx#L77`](../../src/app/components/catchhole/ShareModal.tsx#L77)의 `collab`입니다. | 보드가 실제 첫 화면과 다른 공유 탭을 보여줄 수 있습니다. |

## 보드에서 빠졌거나 의미가 약한 흐름

| ID | 대상 | 현재 상태 | 검토가 필요한 이유 |
| --- | --- | --- | --- |
| B-01 | WF-01 | 작품 조회의 Loading·Loaded·Empty만 표현 | 실제 화면에는 API 오류·재시도와 새 작품 등록 모달도 있습니다. 인증 실패·제출 중 상태도 핵심 분기로 보강할 가치가 있습니다. |
| B-02 | WF-02 | 독립 사이드바 항목을 긴 순차 흐름으로 배치 | 부제로 독립 분기임을 보강했지만, 전체 배치는 여전히 순서를 가진 프로세스로 읽힐 수 있습니다. 허브-분기 구조가 더 정확합니다. |
| B-03 | WF-03 | 분석 진행 중 화면에서 종료 | [`S4Loading.tsx#L77`](../../src/app/components/catchhole/S4Loading.tsx#L77)의 자동 `/report` 이동과 WF-05 연결이 보드 안에서 직접 보이지 않습니다. 모달 취소·에디터 뒤로 이동도 생략되어 있습니다. |
| B-04 | WF-04 | 성공 경로 중심 | 파일 검증 실패, 분석 실패, 재시도, 취소, 데모 모드 전환이 없습니다. 현재 분석 시뮬레이션은 항상 성공하므로 제품 정책 결정도 필요합니다. |
| B-05 | WF-05 | 진입·상태 변화 중심 | 설정 검토·검사 결과의 대시보드 복귀, 단일 리포트의 에디터 복귀, 모달 닫기 같은 종료 경로가 빠져 있습니다. |
| B-06 | 공통 | 보드 사이 연결이 텍스트 문서에만 존재 | WF-03 → WF-05, WF-04 → WF-05처럼 보드 경계에서 이어지는 흐름은 작은 `다음 Workflow` 연결 노드가 있으면 추적이 쉬워집니다. |

## 현재 판정

- 라우트 목록과 핵심 성공 경로는 대체로 코드와 일치합니다.
- WF-04의 완료 후 이동과 WF-05의 미구현 성공 상태는 보드에서 바로잡았습니다.
- F-01~F-07은 애플리케이션 코드 또는 제품 정책 결정이 필요한 항목이므로 이번 작업에서는 수정하지 않았습니다.
- B-01~B-06은 보드 범위를 넓힐지 팀 검토 후 반영하는 것이 안전합니다.
