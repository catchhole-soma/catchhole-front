# CatchHole 프론트엔드 화면 흐름 (Screen Flow)

CatchHole 프론트엔드의 화면(라우트)과 주요 화면 상태 사이의 이동 흐름을 Mermaid로 정리한 문서입니다.
인증·원고 관리·회차 업로드의 MVP 기준은 `docs/data-requirements` 문서와 Pencil 화면을 함께 따릅니다.

각 노드는 **한글 화면 이름 + 경로**로 표기합니다. 경로(`/works` 등)로 코드의 라우트(`src/app/App.tsx`)와 1:1 매칭됩니다.

아래 표의 경로와 각 다이어그램 밑의 딥링크는 `계획 URL`로 명시한 항목을 제외하면 배포 사이트 <https://catch-hole.vercel.app> 로 연결되는 **실제 클릭 가능한 링크**입니다. 단,
- **로그인 보호 화면**은 토큰이 없으면 `/login`으로 리다이렉트됩니다(먼저 로그인 필요).
- `<id>`가 들어간 딥링크는 실제 ID를 채워야 동작하므로 링크 대신 형식만 표기했습니다.
- 아직 구현되지 않은 목표 동선은 반드시 `계획` 또는 `계획 URL`로 표시하며 실제 딥링크로 취급하지 않습니다.

근거(화면 계약이나 구현이 바뀌면 함께 갱신):
- 인증 화면 계약 — [`data-requirements/auth.md`](data-requirements/auth.md)
- 원고 조회·관리 계약 — [`data-requirements/episode.md`](data-requirements/episode.md)
- 회차 업로드 계약 — [`data-requirements/upload.md`](data-requirements/upload.md)
- 라우트 정의 / 인증 게이트 — `src/app/App.tsx`
- 화면 간 전환 — 각 컴포넌트의 `navigate(...)` 호출
- 사이드바 네비게이션 — `src/app/components/catchhole/AppSidebar.tsx`

> **2026-08 MVP 노출 범위**: 실제 동선은 작품 선택, 원고 목록과 읽기 전용 원문 보기, 설정 DB(캐릭터 타임라인·캐릭터 DB·세계관 DB·설정집 목록·설정 검색), 분석 목록, 회차 업로드의 기존 설정 구축, 캐릭터·세계관 설정 후보 검토입니다. 캐릭터 타임라인은 확정된 `CharacterFact` 전체 이력을 회차별로 조회하고 기존 원문 근거 패널을 재사용합니다. 설정집 원문 분석과 충돌 분석 리포트·그래프 뷰·챗봇·관계도·작품 전체 사건 타임라인은 업데이트 예정 범위입니다. `/chat`, `/loading`, `/report`, `/episode-validation-report` 직접 진입은 작품 선택으로 이동합니다. 아래의 후속 화면 다이어그램은 이후 범위 설계 참고용이며 현재 제공 기능을 뜻하지 않습니다.

## Pencil Workflow Boards

Pencil은 아래 보드에서 실제 화면과 전환 설명을 함께 보여줍니다. 흐름이 달라질 때는 이 문서의 Mermaid를 먼저 갱신하고, 보드와 PNG를 동기화합니다.

| Workflow | Pencil Board ID | PNG |
| --- | --- | --- |
| WF-01 / 인증·작품 진입 | `q7BIt` | [WF-01.png](workflows/WF-01.png) |
| WF-02 / 작품·대시보드 | `xuHzb` | [WF-02.png](workflows/WF-02.png) |
| WF-03 / 원고 관리·원문·분석 | `XqFyi` | [WF-03.png](workflows/WF-03.png) |
| WF-04 / 회차 업로드 | `RLw7i` | [WF-04.png](workflows/WF-04.png) |
| WF-05 / 검토·리포트 | `i7MrrQ` | [WF-05.png](workflows/WF-05.png) |

## 화면 한눈에 보기

| 화면 이름 | 경로 (클릭 시 이동) | 무슨 화면인가 |
| --- | --- | --- |
| 랜딩 | [`/landing`](https://catch-hole.vercel.app/landing) | 로그인 전 서비스 소개 페이지 |
| 로그인 / 회원가입 | [`/login`](https://catch-hole.vercel.app/login) · [`/signup`](https://catch-hole.vercel.app/signup) | 랜딩 위 라우트 모달로 제공하는 이메일·비밀번호 인증과 약관 동의 |
| 작품 선택 | [`/works`](https://catch-hole.vercel.app/works) | 작업할 작품을 고르는 진입점 |
| 대시보드 | [`/dashboard`](https://catch-hole.vercel.app/dashboard) | 작품의 설정DB·리포트·분석 목록·그래프·원고 허브 |
| **분석 목록** | [`/dashboard?nav=analyses`](https://catch-hole.vercel.app/dashboard?nav=analyses) | 함께 올린 회차의 분석·실패·설정 후보 검토 상태를 업로드 묶음별로 확인 |
| 회차 원문 보기 | [`/editor`](https://catch-hole.vercel.app/editor) | 선택한 회차 원본을 읽기 전용으로 확인 |
| AI 챗봇 | [`/chat`](https://catch-hole.vercel.app/chat) | 설정 관련 질의응답 챗봇 |
| 분석 진행 | [`/loading`](https://catch-hole.vercel.app/loading) | 작업·회차 상태 추적(완료 후 사용자가 결과로 이동) |
| 충돌·모순 리포트 | [`/report`](https://catch-hole.vercel.app/report) | 분석 결과(충돌/모순) 리포트 |
| 회차 업로드 | [`/episode-upload`](https://catch-hole.vercel.app/episode-upload) | 방식 선택·입력·선택적 분리 확인·분석 추적 플로우 |
| **설정 후보 검토** | [`/setting-review`](https://catch-hole.vercel.app/setting-review) | AI가 회차 원문에서 뽑아낸 **캐릭터·세계관 후보**를 탭별로 확인·확정 |
| **회차 검사 결과** | [`/episode-validation-report`](https://catch-hole.vercel.app/episode-validation-report) | 새로 올린 회차가 **기존 설정과 충돌·모순**되는지 검사한 결과 |

## 범례 (Legend)

```mermaid
flowchart LR
  pub["공개 라우트"]:::public
  priv["인증 보호 라우트"]:::private
  modal["모달 / 화면 내부 상태"]:::modal
  decision{"분기 / 조건"}:::decision

  classDef public fill:#1A1A22,stroke:#00C896,stroke-width:1.5px,color:#F0F0F5;
  classDef private fill:#1A1A22,stroke:#7C5CFC,stroke-width:1.5px,color:#F0F0F5;
  classDef modal fill:#0F0F13,stroke:#9090A8,stroke-dasharray:4 3,color:#F0F0F5;
  classDef decision fill:#0F0F13,stroke:#F4A261,color:#F0F0F5;
```

---

## 1. 전체 라우트 맵

진입점에서 인증 토큰 유무로 갈라지고, 보호 라우트는 모두 `PrivateRoute` 게이트를 통과해야 합니다.

```mermaid
flowchart TD
  entry(["앱 진입 /"]) --> root{"로그인 되어 있나?<br/>(accessToken)"}
  root -- "아니오" --> landing
  root -- "예" --> works

  subgraph PUBLIC["공개 (로그인 불필요)"]
    direction TB
    landing["랜딩 페이지<br/>/landing"]
    login["로그인 라우트 모달<br/>/login"]
    signup["회원가입 라우트 모달<br/>/signup"]
  end

  landing -- "모달 열기" --> login
  landing -- "모달 열기" --> signup
  login <-->|"현재 항목 대체"| signup
  login -- "닫기 · Esc · 뒤로" --> landing
  signup -- "닫기 · Esc · 뒤로" --> landing

  login -- "로그인 성공" --> gate
  signup -- "가입 = 자동 로그인" --> gate

  gate{{"로그인 안 되어 있으면<br/>로그인 화면으로 보냄<br/>(PrivateRoute)"}}:::decision

  subgraph PRIVATE["로그인 후 (보호 화면)"]
    direction TB
    works["작품 선택<br/>/works"]
    dashboard["대시보드<br/>/dashboard"]
    editor["회차 원문 보기<br/>/editor"]
    chat["AI 챗봇<br/>/chat"]
    loading["분석 진행<br/>/loading"]
    report["충돌·모순 리포트<br/>/report"]
    upload["회차 업로드<br/>/episode-upload"]
    review["설정 후보 검토<br/>/setting-review"]
    valreport["회차 검사 결과<br/>/episode-validation-report"]
  end

  gate --> works

  classDef public fill:#1A1A22,stroke:#00C896,stroke-width:1.5px,color:#F0F0F5;
  classDef private fill:#1A1A22,stroke:#7C5CFC,stroke-width:1.5px,color:#F0F0F5;
  classDef decision fill:#0F0F13,stroke:#F4A261,color:#F0F0F5;

  class landing,login,signup public;
  class works,dashboard,editor,chat,loading,report,upload,review,valreport private;
```

---

## 2. 인증 흐름 (Auth)

```mermaid
flowchart TD
  landing["랜딩 페이지<br/>/landing"]:::public
  landing -- "로그인" --> login
  landing -- "회원가입" --> signup

  login["로그인 라우트 모달<br/>/login"]:::public
  signup["회원가입 라우트 모달<br/>/signup"]:::public

  landing -- "로그인 선택<br/>(history push)" --> login
  landing -- "회원가입 선택<br/>(history push)" --> signup
  login -- "닫기 · 배경 · Esc · 뒤로" --> landing
  signup -- "닫기 · 배경 · Esc · 뒤로" --> landing

  login -- "회원가입 링크<br/>(history replace)" --> signup
  signup -- "로그인 링크<br/>(history replace)" --> login

  login -- "이메일·비밀번호 제출" --> loginReq{"로그인 결과"}:::decision
  loginReq -- "성공" --> ok["로그인 토큰 저장"]:::private
  loginReq -- "입력·인증·네트워크 오류" --> login
  loginReq -. "제출 중: 입력·중복 요청 잠금" .-> login

  signup -- "휴대폰 번호 입력<br/>인증번호 받기" --> sendCode{"SMS 발송 결과"}:::decision
  sendCode -- "중복 번호·한도·서비스 장애" --> signup
  sendCode -- "성공: 5분 타이머·60초 재전송" --> otp["6자리 인증번호 입력"]:::public
  otp -- "60초 뒤 재전송<br/>이전 번호 폐기" --> sendCode
  otp -- "인증번호 확인" --> confirmCode{"인증 결과"}:::decision
  confirmCode -- "오입력: 입력·타이머 유지" --> otp
  confirmCode -- "5회 초과·만료: 새 발송 필요" --> signup
  confirmCode -- "성공: 10분 가입 토큰<br/>메모리에만 보관" --> verified["휴대폰 인증 완료"]:::public
  verified -- "인증된 번호 수정<br/>토큰·진행 상태 폐기" --> signup
  verified --> agree{"필수 약관·개인정보<br/>모두 동의했나?"}:::decision
  agree -- "아니오: 가입 버튼 비활성" --> signup
  agree -- "예: 회원가입 제출" --> signupReq{"회원가입 결과"}:::decision
  signupReq -- "성공 = 자동 로그인" --> ok
  signupReq -- "입력·중복·네트워크 오류" --> signup
  signupReq -. "제출 중: 입력·중복 요청 잠금" .-> signup

  login -. "약관/개인정보 보기" .-> terms["약관·개인정보 모달<br/>이용약관 / 개인정보 탭"]:::modal
  signup -. "약관/개인정보 보기" .-> terms
  terms -. "닫기 · Esc · 뒤로" .-> login
  terms -. "닫기 · Esc · 뒤로" .-> signup

  ok --> works["작품 선택<br/>/works"]:::private
  works -- "로그아웃" --> landing

  classDef public fill:#1A1A22,stroke:#00C896,stroke-width:1.5px,color:#F0F0F5;
  classDef private fill:#1A1A22,stroke:#7C5CFC,stroke-width:1.5px,color:#F0F0F5;
  classDef modal fill:#0F0F13,stroke:#9090A8,stroke-dasharray:4 3,color:#F0F0F5;
  classDef decision fill:#0F0F13,stroke:#F4A261,color:#F0F0F5;
```

> `/login`과 `/signup`은 독립된 전체 화면 대신 랜딩을 배경으로 유지하는 라우트 모달입니다. 데스크톱은 중앙 모달, 모바일은 전체 화면으로 표시합니다. 랜딩에서 연 모달은 브라우저 뒤로가기로 닫고, 직접 진입·보호 라우트 리다이렉트로 열린 모달은 닫을 때 `/landing`으로 대체 이동합니다. 인증 성공은 `/works`, 로그아웃은 `/landing`으로 현재 히스토리 항목을 대체합니다.
>
> MVP 회원가입은 이메일·비밀번호와 SOLAPI 휴대폰 번호 소유 인증을 사용합니다. 인증 진행 복원에는 `verificationId`, 전화번호, 만료·재전송 시각만 sessionStorage에 저장하고, 1회용 `phoneVerificationToken`은 메모리에만 둡니다. 소셜 로그인과 PASS 실명 본인인증은 별도 범위입니다.
> 딥링크: 약관·개인정보 모달을 바로 열기 — [`/login?terms=terms`](https://catch-hole.vercel.app/login?terms=terms) · [`/login?terms=privacy`](https://catch-hole.vercel.app/login?terms=privacy) (회원가입은 [`/signup?terms=terms`](https://catch-hole.vercel.app/signup?terms=terms) · [`/signup?terms=privacy`](https://catch-hole.vercel.app/signup?terms=privacy)).

---

## 3. 메인 작업 흐름 (Main Workflow)

작품 선택 → 대시보드 원고 목록 → 회차 업로드 → 업로드 묶음별 분석 목록 → 설정 후보 검토·결과 확인의 핵심 동선입니다.

```mermaid
flowchart TD
  works["작품 선택<br/>/works"]:::private
  dashboard["대시보드<br/>/dashboard"]:::private
  manuscripts["원고 목록<br/>/dashboard?nav=manuscripts"]:::private
  analyses["분석 목록<br/>/dashboard?workId&nav=analyses"]:::private
  source["회차 원문 보기<br/>/editor · 읽기 전용"]:::private
  upload["회차 업로드<br/>/episode-upload"]:::private
  uploadProgress["업로드 분석 진행<br/>/episode-upload 내부 단계"]:::private
  loading["기존 작업 분석 진행<br/>/loading"]:::private
  report["충돌·모순 리포트<br/>/report"]:::private
  review["설정 후보 검토<br/>/setting-review?workId&batchId&jobType"]:::private

  works -- "작품 선택" --> dashboard
  dashboard -- "작품 변경" --> works
  dashboard --> manuscripts

  manuscripts -- "회차 원문 보기" --> source
  source -- "뒤로" --> manuscripts
  manuscripts -- "회차 올리기" --> upload
  upload -- "회차 저장·분석 시작" --> uploadProgress
  manuscripts -- "진행·실패·검토 필요 배너" --> analyses
  analyses -- "진행 보기 / 실패 확인" --> uploadProgress
  analyses -- "결과 보기" --> review
  uploadProgress -- "신규 회차 검수 완료 후<br/>설정 후보 검토" --> review
  uploadProgress -- "기존 설정 구축 완료 후<br/>설정 후보 검토" --> review
  uploadProgress -- "뒤로" --> analyses
  review -- "뒤로" --> analyses

  analyses -- "검수 결과 진행 보기" --> loading
  loading -- "완료 후 결과 확인" --> report
  dashboard -- "발행 전 검수" --> report

  report -- "원고 목록으로" --> manuscripts
  valreport -- "뒤로" --> manuscripts
  settingDB -- "원고 목록" --> manuscripts

  classDef private fill:#1A1A22,stroke:#7C5CFC,stroke-width:1.5px,color:#F0F0F5;
```

> 회차 원문 보기는 선택한 회차 원본을 그대로 보여주는 **읽기 전용** 화면입니다. 설정집은 이 동선과 원고 목록에 노출하지 않고 설정DB의 `설정집 목록` 탭에서 목록·원문·수정·삭제를 제공합니다. 원문 편집, 분석 요청, 설정 DB 편집, 공유·다운로드는 제공하지 않습니다.
> 리포트는 **단일 회차 검수**([`/report`](https://catch-hole.vercel.app/report)) / **발행 전 전체 검수**([`/report?mode=prePublish`](https://catch-hole.vercel.app/report?mode=prePublish)) 두 모드가 있습니다.

---

## 4. 대시보드 내부 네비게이션 (사이드바 · 탭 · 모달)

대시보드 내부 상태는 모두 쿼리 파라미터로 딥링크됩니다. 사이드바는 다른 화면에서 눌러도 먼저 대시보드로 돌아간 뒤 해당 섹션으로 이동합니다.

```mermaid
flowchart TD
  dashboard["대시보드<br/>/dashboard"]:::private

  subgraph SIDEBAR["사이드바"]
    direction TB
    nav_settingDB["설정 DB"]
    nav_reports["분석 리포트"]
    nav_analyses["분석 목록"]
    nav_graph["그래프 뷰"]
    nav_manuscripts["원고 목록"]
    nav_chat["AI 챗봇<br/>/chat"]:::private
  end

  dashboard --> nav_settingDB
  dashboard --> nav_reports
  dashboard --> nav_analyses
  dashboard --> nav_graph
  dashboard --> nav_manuscripts
  dashboard --> nav_chat

  subgraph TABS["설정 DB 하위 탭"]
    direction LR
    t_char["캐릭터 DB"]
    t_rel["관계도"]
    t_time["캐릭터 타임라인"]
    t_worlddb["세계관 DB"]
    t_world["설정집 목록"]
    t_search["검색"]
  end
  nav_settingDB --> t_char & t_worlddb & t_rel & t_time & t_world & t_search

  subgraph ANALYSES["분석 목록"]
    direction TB
    analysis_batches["UploadBatch별 분석 카드<br/>최근 분석 요청순·서버 페이지 10개"]
    analysis_actions["배치 상태별 단일 액션<br/>진행 보기 · 실패 확인 · 결과 보기"]
  end
  nav_analyses --> analysis_batches
  analysis_batches --> analysis_actions

  t_char -. "카드 클릭" .-> m_chardetail["캐릭터 상세 모달<br/>(→ 삭제 확인)"]:::modal
  t_char -. "설정 만들기" .-> m_settings["캐릭터 설정 빌더<br/>(AI 생성 / 직접 입력)"]:::modal
  t_time -. "캐릭터 선택" .-> m_chartimeline["캐릭터 설정 이력 모달<br/>유형 필터 · 회차 바로가기 · cursor 조회"]:::modal
  m_chartimeline -. "근거" .-> m_timeline_evidence["기존 CharacterFact 원문 근거 패널<br/>전체 원문 · quote 하이라이트"]:::modal

  subgraph WORLD_SETTINGS["확정 세계관 관리"]
    direction TB
    world_list["분류·대상 목록<br/>검색·필터·정렬·페이지"]
    world_detail["선택 대상 상세<br/>설정 key/value 목록"]
    world_create["새 대상 추가 모달<br/>분류·대상·첫 설정"]:::modal
    world_edit["대상 정보 수정 모달"]:::modal
    world_property["설정 추가·수정<br/>상세 인라인 편집"]:::modal
  end

  t_worlddb --> world_list
  world_list -- "대상 선택" --> world_detail
  t_worlddb -. "새 대상 추가" .-> world_create
  world_detail -. "대상 정보 수정" .-> world_edit
  world_detail -. "설정 추가·수정" .-> world_property

  subgraph SETTING_BOOKS["설정집 파일 관리"]
    direction TB
    setting_source["설정집 파일 목록<br/>최근 업로드 순"]
    setting_viewer["전체 원문<br/>조회·수정"]
    setting_upload["설정집 업로드 모달<br/>원본·편집용 텍스트 저장"]:::modal
    setting_delete["설정집 삭제 확인<br/>soft delete"]:::modal
  end

  t_world --> setting_source
  setting_source -- "파일 선택" --> setting_viewer
  t_world -. "설정집 업로드" .-> setting_upload
  setting_viewer -. "삭제" .-> setting_delete

  subgraph MANUSCRIPTS["원고 목록 상태·관리"]
    direction TB
    episode_list["회차 목록<br/>번호 내림차순·20개 페이지"]
    analysis_notice["진행·실패·검토 필요 배너<br/>분석 목록으로 이동"]:::modal
    list_state["목록 로딩·원고 빈 상태<br/>조회 실패·액션 실패"]:::modal
    source_viewer["회차 원문 보기<br/>읽기 전용"]:::private
    title_edit["회차 제목 인라인 수정"]:::modal
    file_replace["회차 파일 변경 모달<br/>성공 전 기존 원문·분석 유지"]:::modal
    delete_confirm["회차 삭제 확인<br/>soft delete"]:::modal
  end

  nav_manuscripts --> episode_list
  nav_manuscripts -. "현재 분석 배치 안내" .-> analysis_notice
  analysis_notice --> nav_analyses
  nav_manuscripts -. "빈·실패 상태" .-> list_state
  episode_list -- "원문 보기" --> source_viewer
  episode_list -. "제목 입력·수정" .-> title_edit
  episode_list -. "파일 변경" .-> file_replace
  episode_list -. "삭제" .-> delete_confirm

  dashboard -- "회차 올리기 (전체 플로우)" --> upload["회차 업로드<br/>/episode-upload"]:::private

  classDef private fill:#1A1A22,stroke:#7C5CFC,stroke-width:1.5px,color:#F0F0F5;
  classDef modal fill:#0F0F13,stroke:#9090A8,stroke-dasharray:4 3,color:#F0F0F5;
```

대시보드의 `회차 올리기`는 `/episode-upload` 전체 플로우로 이동합니다. 회차 분석에서 확정한 세계관은 `세계관 DB` 탭에 분류·대상별로 저장하며, 설정집 목록과 섞지 않습니다. 원고 목록에는 설정집 영역을 표시하지 않습니다. 설정집 목록 탭의 `설정집 업로드`는 별도 모달을 열며, TXT·DOCX 원본과 화면 조회·수정용 텍스트를 분리해 저장합니다. 설정집 분석·추출은 MVP 범위에 포함하지 않습니다.

> 세계관 DB와 설정 검색은 각각의 `q`·`page`를 보조 URL 키에 저장했다가 활성 탭의 공통 키로 복원합니다. 세계관 DB의 첫 대상 자동 선택은 데스크톱에만 적용하며, 900px 이하에서는 검색·분류·정렬을 1열로 쌓고 목록을 먼저 표시합니다. `대상 목록으로`를 선택한 뒤에도 `settingId` 없이 목록에 머뭅니다.

> 세계관 생성·대상 정보 수정 모달은 브라우저 Back으로 닫혀도 같은 화면 안에서 미저장 draft를 보존해 Forward 또는 재진입 시 복원합니다. 설정 근거는 최신 근거를 먼저 표시하고 과거 이력을 이어 표시하되 같은 후보는 중복하지 않습니다. HTTP 409 중 `WORLD_SETTING_VERSION_CONFLICT`에만 최신값 재조회 동선을 제공하며 대상명·설정명 중복은 입력과 오류 안내를 유지합니다.

> 사이드바 하단은 API의 `remainingPercent`만 `남은 사용량`으로 표시합니다. 정확한 token 수와 처리 중 예약량은 사용자에게 노출하지 않습니다. 분석 생성·재시도에서 `AI_TOKEN_QUOTA_EXHAUSTED` 응답을 받으면 전역 안내 모달을 열어 기본 사용량 소진과 피드백 연락처를 안내하며, 내부 token 용어와 수치는 표시하지 않습니다.

> 분석 목록은 `UploadBatch` 단위로 최근 분석 요청순 10개씩 서버 페이지네이션합니다. 각 카드에서 캐릭터 설정 후보와 세계관 설정 후보의 검토 완료·대기 수를 분리해 표시하고, 두 종류의 대기 후보를 모두 반영해 분석 중·일부 실패·실패·검토 필요·완료 상태를 구분합니다. 상태에 맞는 `진행 보기`·`실패 확인`·`결과 보기` 중 하나만 제공하며, 분석이 끝난 배치의 `결과 보기`는 설정 후보 검토로 바로 이동합니다.

> 원고 목록 행에는 분석 `진행 보기`·`결과 보기`·`다시 시도`와 `미처리` 열을 두지 않습니다. 진행·부분 실패·실패·설정 후보 검토 필요 상태는 목록 위 배너에서 알리고, 실제 후속 액션은 업로드 묶음별 분석 목록에서 제공합니다. 원문 변경으로 `재분석 필요`가 된 회차의 `재분석` 액션은 유지하며, 분석 중인 회차의 파일 변경·삭제·중복 분석 요청은 비활성화합니다.

> 딥링크 (클릭 시 이동):
> - 사이드바 — [설정 DB](https://catch-hole.vercel.app/dashboard?nav=settingDB) · [분석 리포트](https://catch-hole.vercel.app/dashboard?nav=reports) · [분석 목록](https://catch-hole.vercel.app/dashboard?nav=analyses) · [그래프 뷰](https://catch-hole.vercel.app/dashboard?nav=graph) · [원고 목록](https://catch-hole.vercel.app/dashboard?nav=manuscripts)
> - 설정DB 탭 — [캐릭터 타임라인](https://catch-hole.vercel.app/dashboard?nav=settingDB&tab=timeline) · [캐릭터 DB](https://catch-hole.vercel.app/dashboard?nav=settingDB&tab=characters) · [세계관 DB](https://catch-hole.vercel.app/dashboard?nav=settingDB&tab=worldsettings) · [관계도](https://catch-hole.vercel.app/dashboard?nav=settingDB&tab=relations) · [설정집 목록](https://catch-hole.vercel.app/dashboard?nav=settingDB&tab=worldrules) · [검색](https://catch-hole.vercel.app/dashboard?nav=settingDB&tab=search)
> - 관계도 샘플 — [triangle](https://catch-hole.vercel.app/dashboard?nav=settingDB&tab=relations&relGraph=triangle) · [prosecution](https://catch-hole.vercel.app/dashboard?nav=settingDB&tab=relations&relGraph=prosecution) · [court](https://catch-hole.vercel.app/dashboard?nav=settingDB&tab=relations&relGraph=court)
> - ID 필요(형식만) — 캐릭터 상세 `?modal=char-detail&charId=<id>`, 그래프 노드 `?nav=graph&node=<id>`

---

## 5. 회차 업로드 플로우

회차 업로드 화면은 한 라우트 안에서 단계를 진행합니다. MVP 분기점은 2개입니다.

1. **업로드 방식** — `2B 다회차 단일 파일`일 때만 "회차 분리 확인" 단계가 추가됩니다. 2A·2C는 건너뜁니다.
2. **분석 목적** — 입력 폼에서 고른 `신규 회차 검수` / `기존 설정 구축`에 따라 설정 후보 검토 완료 후 다음 목적지가 갈립니다.

`설정집도 함께 업로드`는 단계 분기가 아닙니다. 설정집 원본 저장 결과를 회차 저장·분석과 독립적으로 처리하며, MVP에서는 설정집 분석·추출이나 결과 확인 화면을 거치지 않습니다.

```mermaid
flowchart TD
  start(["회차 업로드 진입<br/>/episode-upload"]):::private --> mode["1. 업로드 방식 선택"]

  mode --> mA["2A. 단일 회차 입력<br/>번호·선택 제목·TXT/DOCX 1개"]
  mode --> mB["2B. 다회차 단일 파일 입력<br/>명시적인 회차 제목 행 감지"]
  mode --> mC["2C. 다회차 여러 파일 입력<br/>TXT 최소 2개·파일별 매핑"]

  mB -- "2개 이상 정상 감지" --> bp["3. 회차 분리 확인<br/>고정 경계·번호·선택 제목"]
  mB -. "파일 수정 필요 / 처리 실패" .-> mBState["원본 수정·재선택<br/>또는 같은 파일 재시도"]:::modal

  mA --> persist["회차 저장 + 분석 시작<br/>선택 설정집 원본은 독립 저장"]
  mC -- "모든 파일 번호 유효" --> persist
  bp -- "모든 고정 경계 확정" --> persist

  persist -- "회차 저장 성공" --> proc["5. 분석 진행<br/>회차별 Job PENDING / RUNNING"]
  persist -. "전체 저장 실패<br/>어떤 회차도 생성 안 함" .-> persist
  persist -. "설정집만 실패<br/>회차 분석은 계속" .-> retrySetting["설정집 원본만 재시도"]:::modal
  persist -. "회차 저장 성공·분석 시작 실패" .-> retryAnalysis["분석만 다시 시작"]:::modal
  retryAnalysis --> proc

  proc --> state{"회차별 Job·Episode 상태"}:::decision
  state -- "활성 Job 종료 후<br/>일부·전체 FAILED" --> retry["사용자용 실패 안내<br/>실패 회차만 새 Job으로 재시도"]:::modal --> proc
  state -- "조회 실패" --> reload["마지막 성공 데이터 유지<br/>다시 불러오기"]:::modal --> proc
  state -- "모든 현재 Job SUCCEEDED" --> success["분석 완료<br/>현재 회차 상태 불일치 시 재분석 안내"]

  success --> review["설정 후보 검토<br/>/setting-review?workId&batchId&jobType"]:::private
  proc -- "뒤로<br/>서버 작업은 계속" --> analyses["분석 목록<br/>/dashboard?workId&nav=analyses"]:::private
  review -- "뒤로" --> analyses

  postMvp["Post-MVP<br/>설정집 분석 결과 확인"]:::modal
  persist -. "MVP에서는 경유하지 않음" .-> postMvp

  start -. "뒤로" .-> dashboard["대시보드<br/>/dashboard"]:::private

  classDef private fill:#1A1A22,stroke:#7C5CFC,stroke-width:1.5px,color:#F0F0F5;
  classDef modal fill:#0F0F13,stroke:#9090A8,stroke-dasharray:4 3,color:#F0F0F5;
  classDef decision fill:#0F0F13,stroke:#F4A261,color:#F0F0F5;
```

> 회차 처리 상태: `UPLOADED` → `CHUNKING` → `CHUNKED` → `PREPROCESSING` → `PREPROCESSED` → `ANALYZING` → `ANALYZED`. 실제 진행률을 계산할 수 없으므로 숫자 퍼센트를 표시하지 않습니다.

> 분석 화면을 벗어나도 서버 작업은 취소되지 않습니다. 분석 진행 단계와 설정 후보 검토의 뒤로가기는 현재 작품의 `nav=analyses`로 돌아갑니다. 완료 후 자동 이동하지 않으며, 모든 대상 회차가 성공하고 후보 조회 결과가 준비됐을 때(후보 0건 포함) `설정 후보 검토`가 활성화됩니다.

---

## 6. 검토 · 리포트 흐름

분석이 끝난 뒤 사용자가 명시적으로 이동하는 결과 화면들입니다. `신규 회차 검수`와 `기존 설정 구축` 모두 같은 `batchId`의 설정 후보 검토로 이동하고, 모든 후보의 확정·무시가 끝난 뒤 분석 목적에 맞는 다음 단계로 진행합니다.

```mermaid
flowchart TD
  review["설정 후보 검토<br/>/setting-review<br/>캐릭터 후보 · 세계관 후보"]:::private
  review -- "이전" --> analyses["분석 목록<br/>/dashboard?workId&nav=analyses"]:::private

  manuscripts["원고 목록<br/>/dashboard?workId&nav=manuscripts"]:::private

  settingDB["설정 DB<br/>/dashboard?nav=settingDB"]:::private
  worldDB["세계관 DB<br/>/dashboard?nav=settingDB&tab=worldsettings"]:::private
  purpose{"업로드 분석 목적"}:::decision
  review -. "검토 완료 후 다음 단계<br/>후속 구현" .-> purpose
  review -- "세계관 DB에서 보기" --> worldDB
  purpose -. "기존 설정 구축" .-> settingDB
  settingDB -- "원고 목록" --> manuscripts

  valreport["회차 검사 결과<br/>/episode-validation-report<br/>(신규 회차 ↔ 기존 설정 충돌 검사)"]:::private
  validation["오류 탐지 작업 진행<br/>/loading?workId&analysisJobIds"]:::private
  purpose -. "신규 회차 검수<br/>오류 탐지 작업 생성" .-> validation
  validation -. "모든 작업 성공" .-> valreport
  valreport -- "뒤로" --> manuscripts

  report["충돌·모순 리포트<br/>/report<br/>(단일 회차 / 발행 전 전체)"]:::private
  report -- "원문 보기" --> source["회차 원문 보기<br/>/editor · 읽기 전용"]:::private
  source -- "뒤로" --> manuscripts
  report -- "뒤로" --> dashboard
  report -. "공유" .-> share["공유·협업 모달"]:::modal

  classDef private fill:#1A1A22,stroke:#7C5CFC,stroke-width:1.5px,color:#F0F0F5;
  classDef modal fill:#0F0F13,stroke:#9090A8,stroke-dasharray:4 3,color:#F0F0F5;
  classDef decision fill:#0F0F13,stroke:#F4A261,color:#F0F0F5;
```

> 딥링크 (클릭 시 이동): [분석 목록](https://catch-hole.vercel.app/dashboard?nav=analyses) · 리포트 [발행 전 검수](https://catch-hole.vercel.app/report?mode=prePublish).
> ID 필요(형식만): 캐릭터 설정 후보 검토 `?workId=<id>&batchId=<id>&candidate=<id>`, 세계관 후보 검토 `?workId=<id>&batchId=<id>&candidateType=world&candidate=<id>` ([/setting-review](https://catch-hole.vercel.app/setting-review)), 세계관 상세 `?workId=<id>&nav=settingDB&tab=worldsettings&settingId=<id>`, 회차 검사 결과 `?issue=<id>` ([/episode-validation-report](https://catch-hole.vercel.app/episode-validation-report)).

> 세계관 후보가 `PENDING`·`PROCESSING`이면 목록과 선택 상세를 2초 간격으로 갱신하고 terminal 상태에서 멈춥니다. 확정 충돌의 자동 재비교는 상태 전환마다 한 번만 보내며, 회복 뒤 같은 후보가 다시 충돌하면 새 전환으로 다시 자동 재비교합니다.

> 세계관 후보 목록의 최초 조회가 실패해도 공통 캐릭터·세계관 후보 탭은 오류 상태 위에 유지하여 정상 조회 가능한 다른 후보 종류로 이동할 수 있습니다.
