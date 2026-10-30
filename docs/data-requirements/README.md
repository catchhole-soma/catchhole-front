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

#### 5-1 권장 형식

5-1은 API나 응답 DTO를 직접 설계하는 항목이 아니다. **화면이 데이터를 사용하는 의미 단위**로 묶고, BE가 각 의미를 DTO 필드로 옮길 수 있도록 형태·필수성과 값 없음의 의미를 표로 명확히 작성한다. 여기서 나눈 묶음은 API 또는 DTO 경계를 강제하지 않으며, 실제 결합·분리 방식과 필드명은 Swagger와 BE 도메인 문서에서 정한다.

- 최초 화면 데이터, 조건부로 추가 조회하는 데이터, 작업 완료 후 갱신할 데이터를 구분한다.
- 목록 자체의 의미와 목록 항목별 데이터를 분리한다.
- API 경로·HTTP 메서드·DTO 이름 대신 데이터의 의미를 적는다. 이미 확정된 계약 이름이 중요할 때만 괄호로 함께 표기한다.
- polling 간격, 모달 열림, 버튼 비활성 같은 FE 동작은 5-1에 반복하지 않고, 그 동작에 필요한 BE 제공 데이터만 적는다.
- 작업 완료 데이터는 특정 작업 응답에 반드시 포함하라는 뜻이 아니라, BE 응답 또는 FE 재조회로 확보해야 할 최신 화면 상태로 적는다.
- BE 제공 데이터가 전혀 없는 정적 화면은 불필요한 표를 만들지 않고 `현재 BE → FE 제공 데이터 없음`으로 명시한다.

데이터가 있는 묶음은 다음 형식을 사용한다.

```md
**목록 데이터**

| 데이터 의미 | 형태·필수성 | 값 없음·조건 |
| --- | --- | --- |
| 전체 개수 | 0 이상의 정수·필수 | 항목이 없으면 `0` |
| 항목 목록 | 목록·필수 | 항목이 없으면 빈 목록 |
| 항목 제목 | 목록 항목별 단일 값·선택 | `null`이면 제목을 얻지 못한 상태 |
```

**5-2. FE → BE 전달 데이터 요구사항**에는 다음을 적습니다.

- 사용자가 입력·선택·수정한 값, 업로드 파일, 작업 대상 식별자
- 데이터의 의미, 단일 값/목록 여부, 필수/선택/조건부 여부
- 어떤 사용자 액션에서 전달되는지와 FE 검증 기준
- 확정·무시·삭제처럼 상태를 변경할 때 대상과 사용자의 의도

모달 열림 여부, 포커스, 펼침 상태처럼 BE로 전달하지 않는 클라이언트 전용 상태는 5-2에서 제외합니다. 3번의 식별자는 화면 이동 문맥, 5-2의 식별자는 BE 작업 대상을 설명하므로 같은 값이 양쪽에 등장할 수 있습니다.

- 배포: https://www.catchhole.com — 로그인 후 실제 API 데이터로만 화면을 구성하며, 백엔드 연동 기준은 [NVM-218](https://aiswmproject.atlassian.net/browse/NVM-218)을 참고합니다.
- 백엔드 API 계약: [공개 Swagger](https://api.catchhole.com/swagger-ui/index.html) · [BE 도메인 문서](https://github.com/catchhole-soma/catchhole-backend-java/tree/main/docs)

## 도메인별 문서

- [auth](./auth.md) — 랜딩 · 로그인 · 회원가입 · 약관 · 보호 라우트 인증 확인
- [work](./work.md) — 작품 목록 · 작품 등록 · 대시보드
- [upload](./upload.md) — 회차 업로드 (SEpisodeUpload)
- [episode](./episode.md) — 원고 목록
- [character](./character.md) — 설정DB · 설정 검토 · 캐릭터
- [world-setting](./world-setting.md) — NVM-260 세계관 MVP · NVM-268 1단계 범위 경로 · 세계관 DB
- [analysis](./analysis.md) — 분석 진행 · 오류 리포트 · 회차 검사

## 화면 ↔ 도메인 매핑

| 화면 | URL | 도메인 |
| --- | --- | --- |
| 랜딩 | [`/landing`](https://www.catchhole.com/landing) | [auth](./auth.md#랜딩-slanding) |
| 로그인 | [`/login`](https://www.catchhole.com/login) | [auth](./auth.md#로그인-slogin) |
| 회원가입 | [`/signup`](https://www.catchhole.com/signup) | [auth](./auth.md#회원가입-ssignup) |
| 약관·개인정보 모달 | [`/login?terms=terms`](https://www.catchhole.com/login?terms=terms) | [auth](./auth.md#약관개인정보-모달-termsmodal) |
| 작품 목록 | [`/works`](https://www.catchhole.com/works) | [work](./work.md#작품-목록-s0workpicker) |
| 사용자 메뉴·회원 탈퇴 | 보호 화면 공통 · 별도 경로 없음 | [auth](./auth.md#사용자-메뉴회원-탈퇴-usermenu) |
| 작품 등록 모달 | — | [work](./work.md#작품-등록-모달-workcreatemodal) |
| 대시보드 | [`/dashboard`](https://www.catchhole.com/dashboard) | [원고](./episode.md#원고-목록-대시보드-원고-탭) · [분석](./analysis.md#분석-목록-analysislist) · [캐릭터·설정집·검색](./character.md#작품-설정-캐릭터-탭) · [세계관](./world-setting.md#작품-설정-세계관-탭) |
| 회차 업로드 | [`/episode-upload`](https://www.catchhole.com/episode-upload) | [upload](./upload.md#회차-업로드-sepisodeupload) |
| 회차 원문 보기 | [`/editor`](https://www.catchhole.com/editor) | [episode](./episode.md#회차-원문-보기) |
| 원고 목록 | [`/dashboard?nav=manuscripts`](https://www.catchhole.com/dashboard?nav=manuscripts) | [episode](./episode.md#원고-목록-대시보드-원고-탭) |
| 설정DB | [`/dashboard?nav=settingDB`](https://www.catchhole.com/dashboard?nav=settingDB&tab=characters) | [character](./character.md#설정db-캐릭터-탭) |
| 세계관 DB | [`/dashboard?nav=settingDB&tab=worldsettings`](https://www.catchhole.com/dashboard?nav=settingDB&tab=worldsettings) | [world-setting](./world-setting.md#설정db-세계관-db-탭) |
| 설정 검토 | [`/setting-review`](https://www.catchhole.com/setting-review) | [캐릭터 후보](./character.md#설정-검토-ssettingreview) · [세계관 후보](./world-setting.md#설정-후보-검토--세계관-후보-탭) |
| 분석 진행 (Post-MVP 전체 화면) | [`/loading`](https://www.catchhole.com/loading) | [analysis](./analysis.md#분석-진행-s4loading) |
| 오류 리포트 (Post-MVP) | [`/report`](https://www.catchhole.com/report) | [analysis](./analysis.md#오류-리포트-s5report) |
| 오류 리포트 (단일 회차 · 화면 명세 검토안) | 예정: `/episode-validation-report` | [analysis](./analysis.md#충돌-의심-상세-리포트-sepisodevalidationreport) |

대시보드 공통 UI 상태: [모바일 메뉴 서랍](../screens/DY6xk.png) · [업데이트 예정 토스트](../screens/rXnD6.png) · [모바일 업데이트 예정 토스트](../screens/T0B8WR.png). 이 상태들은 별도 서버 데이터 계약을 추가하지 않는다.

> 캡처 이미지(`../screens/*.png`)는 Pencil 노드 id를 파일명으로 씁니다. 현재 활성 범위는 `Active / ...` 프레임의 PNG를 사용하고, Post-MVP 전체 화면은 보존 프레임을 계속 참조합니다. 시각 디자인 원본은 `design/catchhole.pen`입니다.

### GH300 오류 리포트 정책 기준

**AI 결과 분류 합의:** 설정 검사 결과는 `설정 충돌 / 충돌 의심 / 추가 확인 필요`의 세 유형이다. 설정 충돌은 같은 대상·시점·조건에서 양립할 수 없는 내용이 직접 근거로 확인된 경우, 충돌 의심은 기존 상태와 어긋나 보이나 변화·예외를 확인하지 못한 경우, 추가 확인 필요는 대상·시점·해석이 불명확해 비교 판단이 어려운 경우다. 세 유형 모두 시스템 판단으로 작가가 `충돌 아님`으로 정정할 수 있으며 영향 등급 `심각 / 주의 / 참고`와 별개다. 검색 횟수나 검색 결과 없음만으로 충돌 의심을 설정 충돌로 높이지 않는다. 실행 미완료·자료 조회 실패는 추가 확인 필요가 아닌 검사 미완료다. 세 유형의 미검토는 모두 추출 보류이며 자동 0건은 세 유형 합계 0건을 뜻한다.

2026-10-28부터 [오류 리포트 화면안](analysis.md#충돌-의심-상세-리포트-sepisodevalidationreport)은 오류 검사·작가 검토를 설정 추출보다 먼저 수행한다. [제품 기획](../planning/gh-300-error-report-product-brief.md)·[구현 계획](../planning/gh-300-error-report-implementation-plan.md)을 함께 확인한다. 기존 설정 구축 화면의 완료/재시도 규칙을 새 검수에 그대로 적용하지 않으며, Pencil/PNG는 상태·행동 동기화 대기다. 이후 합의한 오탈자 독립 병렬 검사와 질문 생성/누락 방지의 구현 제안은 [상세안](../planning/gh-300-validation-question-planning.md)을 따른다. 두 검사 모두 정상 완료·설정 검사 3유형 합계·오탈자 제안 모두 0건이면 자동 추출한다. 항목이 있었다면 설정 모두 충돌 아님·오탈자 확인 완료·수정 대기 없음 뒤 명시적 완료 버튼을 사용한다. 의도한 표현은 유지할 수 있다. 오탈자 미검토·수정 대기·실패/일부 중단/재시도 실패는 추출 보류이며 검사 생략 우회 없이 같은 입력 성공 결과를 보존해 미완료 범위를 재시도한다. 오탈자는 문자 오타·맞춤법·띄어쓰기·분명한 문자/조사 중복·누락을 검사하고 허용 표기·의도적 표현·문체 통일·윤문·추측 보충·고유명사 표기 차이는 제외한다. 이름 주변 일반 오타는 검사하며 이름 차이를 설정 검사로 자동 이관하지 않는다. 수정 필요/원문 유지/검토 필요로 되돌리기를 사용하고 원문 유지만 현재 항목을 해소한다. 수정 필요는 외부 수정·파일 교체·새 검사로 확인하며 수정 완료 체크 우회·원문 자동 편집·예외 사전 등록·새 원고 판단 자동 승계는 없다. 배치·enum/HTTP 필드는 제안이고 오탈자 초기 모델은 사용자 지정 **6.1 Terra**, 추론은 **low**(사용자 표현 lite를 낮은 추론으로 해석)이며 품질 수치·처리 시간 한도는 미정이다. 같은 신규 회차 내부 모순 검사는 첫 버전에서 제외하며, 과거 확정 설정·앞선 원문과 비교하기 위한 현재 회차 문맥 해석은 유지한다.
