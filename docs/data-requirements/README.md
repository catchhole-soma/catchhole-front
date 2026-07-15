# 화면별 기능·데이터 요구사항

FE가 와이어프레임을 기준으로 각 화면의 기능, 사용자 액션, 화면 상태와 FE·BE 간 데이터 요구사항을 정리한 문서입니다.

이 문서는 화면별 기획과 화면에서 필요한 데이터의 단일 출처입니다. 1\~4번은 화면 기획, 5번은 화면 구현에 필요한 양방향 데이터, 6번은 아직 확정되지 않은 협의 사항을 다룹니다. API 경로, HTTP 메서드, 전체 요청·응답 DTO와 인증·재시도 같은 기술 구현은 Swagger와 BE 도메인 문서를 기준으로 합니다.


각 화면은 6개 항목으로 정리합니다. 5번은 데이터 흐름의 방향을 구분해 5-1과 5-2로 작성합니다:


1. 화면에 표시할 데이터
2. 사용자 액션
3. 화면 전환 식별자
4. 데이터 없음 / 실패 표시
5. 화면 데이터 요구사항
   - 5-1. BE → FE 제공 데이터 요구사항
   - 5-2. FE → BE 전달 데이터 요구사항
6. BE와 협의할 범위·상태값


**역할 분담**: 1\~5는 FE가 작성·관리하고, **6은 BE가 답변할 몫**입니다(기획·디자인 판단이 필요한 항목은 팀 공동). 협의가 확정되면 결과를 1\~5로 승격하고 6에서 지웁니다. **6번이 비고 5-1·5-2에 확정된 데이터 요구사항이 반영되면 그 화면은 협의 완료**입니다.

### 화면별 검토 절차

화면 요구사항은 다음 순서로 한 화면씩 검토합니다.

1. 검토할 화면 하나를 정합니다. 사용자가 다음 화면을 요청하기 전에는 다른 화면으로 넘어가거나 여러 화면을 일괄 수정하지 않습니다.
2. 문서에 연결된 캡처 이미지의 파일명으로 Pencil 노드 id를 확인하고 `design/catchhole.pen` 원본을 기획 기준으로 검토합니다. 캡처 이미지는 실제 배치와 시각 상태를 확인하는 보조 자료로 사용합니다.
3. FE 코드는 현재 구현 여부와 원본 대비 누락·차이를 확인하는 보조 자료로 사용합니다. 코드의 하드코딩 문구, mock 데이터, 임시 이메일 같은 예시는 확정된 기획으로 간주하지 않습니다.
4. Pencil 원본, 현재 문서, FE 구현을 대조해 1\~6번의 보강안과 미확정 쟁점을 먼저 정리합니다. 이 단계에서는 문서를 수정하지 않습니다.
5. 사용자와 쟁점을 하나씩 논의합니다. 확정된 기획과 데이터 요구사항은 1\~5번에 반영하고, 아직 결정되지 않은 내용만 6번에 남깁니다.
6. 사용자가 승인한 뒤 해당 화면의 문서만 수정하고 `git diff --check`로 형식을 확인합니다. 다음 화면은 사용자가 요청할 때 같은 절차로 시작합니다.

검토 과정에서도 1\~4번은 화면 기획, 5번은 화면에 필요한 양방향 데이터, 6번은 미확정 협의 사항이라는 문서 경계를 유지합니다. API 경로·HTTP 메서드·전체 DTO 같은 구현 계약은 이 문서에 복제하지 않고 Swagger와 BE 도메인 문서를 기준으로 합니다.

### 5번 작성 기준

5번은 API 경로·HTTP 메서드나 전체 DTO를 복제하는 API 명세가 아니라, **해당 화면이 실제로 받고 보내야 하는 데이터의 의미와 조건**을 기록합니다. 정확한 API 계약의 단일 출처는 Swagger와 BE 도메인 문서로 유지합니다.

**5-1. BE → FE 제공 데이터 요구사항**에는 다음을 적습니다.

- 화면 최초 표시, 새로고침, 사용자 액션 완료 후 FE가 받아야 하는 데이터
- 데이터의 의미, 단일 값/목록 여부, 필수/선택/조건부 여부
- 화면에서 사용하는 위치와 표시 조건
- 값이 없을 때 `null`·빈 목록·0 중 어떤 의미인지
- 상태값의 가능한 값과 각 값에 따른 화면 처리
- 집계·정렬·계산 값이라면 그 기준

**5-2. FE → BE 전달 데이터 요구사항**에는 다음을 적습니다.

- 사용자가 입력·선택·수정한 값, 업로드 파일, 작업 대상 식별자
- 데이터의 의미, 단일 값/목록 여부, 필수/선택/조건부 여부
- 어떤 사용자 액션에서 전달되는지와 FE 검증 기준
- 확정·무시·삭제처럼 상태를 변경할 때 대상과 사용자의 의도

모달 열림 여부, 포커스, 펼침 상태처럼 BE로 전달하지 않는 클라이언트 전용 상태는 5-2에서 제외합니다. 3번의 식별자는 화면 이동 문맥, 5-2의 식별자는 BE 작업 대상을 설명하므로 같은 값이 양쪽에 등장할 수 있습니다.

- 배포: https://www.catchhole.com — 첫 접속 시 데모 모드 전환을 수락하면 mock 데이터로 화면 열람 가능 (백엔드 연동은 [NVM-218](https://aiswmproject.atlassian.net/browse/NVM-218))
- 백엔드 API 계약: [공개 Swagger](https://api.catchhole.com/swagger-ui/index.html) · [BE 도메인 문서](https://github.com/catchhole-soma/catchhole-backend-java/tree/main/docs)

## 도메인별 문서

- [auth](./auth.md) — 랜딩 · 로그인 · 회원가입 · 약관
- [work](./work.md) — 작품 목록 · 작품 등록 · 대시보드
- [upload](./upload.md) — 회차 업로드 (SEpisodeUpload)
- [episode](./episode.md) — 원고 목록
- [character](./character.md) — 설정DB · 설정 검토 · 캐릭터
- [analysis](./analysis.md) — 분석 진행 · 오류 리포트 · 회차 검사

## 화면 ↔ 도메인 매핑

| 화면 | URL | 도메인 |
| --- | --- | --- |
| 랜딩 | [`/landing`](https://www.catchhole.com/landing) | [auth](./auth.md#랜딩-slanding) |
| 로그인 | [`/login`](https://www.catchhole.com/login) | [auth](./auth.md#로그인-slogin) |
| 회원가입 | [`/signup`](https://www.catchhole.com/signup) | [auth](./auth.md#회원가입-ssignup) |
| 약관·개인정보 모달 | [`/login?terms=terms`](https://www.catchhole.com/login?terms=terms) | [auth](./auth.md#약관개인정보-모달-termsmodal) |
| 작품 목록 | [`/works`](https://www.catchhole.com/works) | [work](./work.md#작품-목록-s0workpicker) |
| 작품 등록 모달 | — | [work](./work.md#작품-등록-모달-uploadmodal) |
| 대시보드 | [`/dashboard`](https://www.catchhole.com/dashboard) | [work](./work.md#대시보드-s1dashboard) |
| 회차 업로드 | [`/episode-upload`](https://www.catchhole.com/episode-upload) | [upload](./upload.md#회차-업로드-sepisodeupload) |
| 원고 목록 | [`/dashboard?nav=manuscripts`](https://www.catchhole.com/dashboard?nav=manuscripts) | [episode](./episode.md#원고-목록-대시보드-원고-탭) |
| 설정DB | [`/dashboard?nav=settingDB`](https://www.catchhole.com/dashboard?nav=settingDB&tab=characters) | [character](./character.md#설정db-캐릭터-탭) |
| 설정 검토 | [`/setting-review`](https://www.catchhole.com/setting-review) | [character](./character.md#설정-검토-ssettingreview) |
| 분석 진행 | [`/loading`](https://www.catchhole.com/loading) | [analysis](./analysis.md#분석-진행-s4loading) |
| 오류 리포트 | [`/report`](https://www.catchhole.com/report) | [analysis](./analysis.md#오류-리포트-s5report) |
| 회차 검사 결과 | [`/episode-validation-report`](https://www.catchhole.com/episode-validation-report) | [analysis](./analysis.md#회차-검사-결과-sepisodevalidationreport) |

> 캡처 이미지(`../screens/*.png`)는 Pencil 노드 id를 파일명으로 씁니다. 시각 디자인 원본은 `design/catchhole.pen`.
