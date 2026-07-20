# Pencil 마이그레이션 트래킹

`design/catchhole.pen`에 CatchHole-front의 모든 화면·모달을 Figma 와이어프레임 대체 수준으로 옮기기 위한 진행 상황 문서입니다. **매 세션 시작 시 이 문서를 먼저 읽고, 다음에 무엇을 할지 정하세요.**

## 네이밍 규칙

Pencil 노드 이름은 `<코드 컴포넌트명> / <화면-상태>` 형식을 따릅니다.

- 그룹명(`<코드 컴포넌트명>`)은 `src/app/components/catchhole/` 아래의 화면 컴포넌트 파일명을 그대로 사용합니다 (예: `SEpisodeUpload`, `SLogin`, `SSignup`).
- `/` 뒤에는 해당 화면 내부의 단계/상태를 적습니다 (예: `02B Mode B 입력`, `로그인`).
- 전역 모달(여러 화면에서 공통으로 뜨는 모달)은 `<모달 컴포넌트명> / <한글 설명>` 형식을 사용합니다 (예: `TermsModal / 약관·개인정보 모달`). 모달 컴포넌트명은 실제 코드에 존재하는 이름을 그대로 써야 합니다 — 코드에 없는 이름(예: 컨텍스트만 있고 컴포넌트가 없는 경우)을 지어내지 않습니다 (예: `BackendStatus`는 `BackendStatusProvider`/`useBackendStatus`만 존재하므로 `BackendStatusModal`이 아니라 `BackendStatus`로 표기).
- 재사용 컴포넌트(`reusable: true`)는 `<카테고리>/<이름>` 형식을 그대로 유지합니다 (예: `Button/Primary`, `Input/Auth Field`).

각 항목의 상태는 ✅ 완료 / 🚧 진행중 / ⬜ 미착수 세 가지로만 표시합니다. 담당 세션 날짜나 커밋 해시는 적지 않습니다(금방 stale해지므로) — 이력은 `git log`로 추적하세요.

## 재사용 컴포넌트

| 컴포넌트 | 상태 | 설명 |
| --- | --- | --- |
| `Button/Primary` | ✅ | 주요 액션 버튼 |
| `Button/Ghost` | ✅ | 보조/취소 버튼 |
| `Header Bar` | ✅ | 화면 상단 헤더 (뒤로가기 + 제목) |
| `Input/Text Field` | ✅ | 라벨 + 입력값 2단 구성 입력 필드 |
| `Input/Auth Field` | ✅ | 아이콘 + placeholder, 로그인/회원가입용 입력 필드 |
| `Mode Card` | ✅ | 업로드 방식(A/B/C) 선택 카드 |
| `Status Badge` | ✅ | 상태 배지 — 기본(완료) + 진행중/대기/오류 색상 variant |
| `Checkbox Row` | ✅ | 체크박스 + 라벨 행 |
| `File Drop Area` | ✅ | 파일 드롭 영역 (정상/에러/선택됨 상태 참고 프레임) |
| `Feature Card` | ✅ | 아이콘 + 제목 + 설명, 랜딩 페이지 기능 소개 카드 |

## 화면 그룹

### SEpisodeUpload — ✅ 완료

회차 업로드 플로우 6단계 전부 마이그레이션 완료.

- `SEpisodeUpload / 1. 업로드 방식 선택` ✅
- `SEpisodeUpload / 2A. 단일 회차 업로드` ✅
- `SEpisodeUpload / 2B. 다회차 단일 파일 업로드 (AI 자동 분리)` ✅
- `SEpisodeUpload / 2C. 다회차 여러 파일 업로드 (파일당 1회차)` ✅
- `SEpisodeUpload / 3. 회차 분리 확인` ✅
- `SEpisodeUpload / 4. 설정 확인` ✅
- `SEpisodeUpload / 5. 분석 진행중` ✅ — `step==='processing'` 분기, `PROCESSING_SEQUENCE` 7단계 칩(원문 저장 완료→원문 청킹 중→청크 저장 완료→LLM 전처리 중→LLM 전처리 완료→AI 설정 추출 중→설정 후보 생성 완료) + 회차별 진행 카드 2개(실행 중/완료) + 비활성 "분석 진행 중..." 버튼

### SLanding — ✅ 완료

- `SLanding / 랜딩` ✅ — 로그인 이전 단계의 마케팅 랜딩 페이지. Header(로고 + 로그인/회원가입 버튼) + Hero(배지 + 헤드라인 + 서브카피 + CTA 버튼 2개 + 신뢰 항목 2종 + 우측 대시보드 목업 이미지) + Features 섹션(`Feature Card` 컴포넌트 3개 인스턴스: 초고속 AI 대조 분석/일관성 체크/직관적인 리포트) + 하단 CTA 섹션 + Footer

### SLogin — ✅ 완료

- `SLogin / 로그인` ✅ — 좌측 브랜딩 패널(로고/헤드라인/설명/카피라이트+약관 링크) + 우측 폼(이메일/비밀번호, 로그인 버튼, 소셜 로그인, 회원가입 링크)
- 비밀번호 필드의 show/hide(눈모양) 토글 아이콘 ✅ — `Input/Auth Field` 공용 컴포넌트는 그대로 두고, 이 화면의 Password Field 인스턴스만 우측에 eye-off 아이콘이 있는 인라인 프레임으로 교체
- `SLogin / 에러·제출중 상태` ✅ — `handleLogin()` 검증/인증 실패 로직 반영: 비밀번호 필드 테두리 `$danger` + "이메일 또는 비밀번호가 올바르지 않습니다." + 로그인 버튼 "로그인 중..."(opacity 0.7)

### SSignup — ✅ 완료

- `SSignup / 회원가입` ✅ — 좌측 브랜딩 패널(헤드라인/설명/카피라이트만, 링크 없음) + 우측 폼(이름/이메일/휴대폰번호/비밀번호/비밀번호 확인 5개 입력, 약관 동의 체크박스, 회원가입 버튼, 소셜 로그인, 로그인 링크)
- `SSignup / 에러·제출중 상태` ✅ — `handleSignup()` 검증 로직 반영: 휴대폰 번호/비밀번호 확인 필드 테두리 `$danger` + 에러 문구 + 회원가입 버튼 "가입 중..."(opacity 0.7)

### TermsModal — ✅ 완료

- `TermsModal / 약관·개인정보 모달` ✅ — 반투명 backdrop + 600px 모달(헤더: 제목+X+탭 2개, 본문: 대표 섹션 3개, 하단: 확인 버튼). 와이어프레임 목적상 약관/개인정보 전체 5개 섹션이 아닌 대표 3개만 포함.

### S0WorkPicker — ✅ 완료

- `S0WorkPicker / 작품 목록 (Loaded)` ✅
- `S0WorkPicker / 로딩 중 (Loading)` ✅
- `S0WorkPicker / 작품 없음 (Empty)` ✅

### S1Dashboard — ✅ 완료

- `S1Dashboard / 설정DB 탭 - 캐릭터` ✅
- `S1Dashboard / 설정DB 탭 - 타임라인` ✅ — `TimelineView()` 기반: 필터 칩 5종(전체/인물별/사건별/아이템별/오류별) + 가로 타임라인 트랙 대표 5노드(1화~159화, 시간흐름 오류/설정 충돌 표시) + 범례
- `S1Dashboard / 설정DB 탭 - 세계관 규칙` ✅ — `WorldRulesView()` 기반: 카드 그리드 3열(법정·수사 규칙/캐릭터 공통 설정/장소 설정) + "세계관 설정 만들기" placeholder 카드
- `S1Dashboard / 설정DB 탭 - 검색` ✅ — `SearchView()` 기반: 검색창 + 카테고리 칩 9종 + 결과 카드 대표 6개
- `S1Dashboard / 분석 리포트 탭` ✅
- `S1Dashboard / 업로드된 원고 탭` ✅
- `S1Dashboard / 업로드된 원고 탭 - Empty 상태` ✅ — `selectedWork==='murim'` 분기: FileText 아이콘 + "아직 업로드된 원고가 없습니다." + "회차 올리기로 첫 원고를 추가하세요."
- `S1Dashboard / 관계도 그래프뷰 - Empty 상태 (디자인 제안, 코드 미구현)` ✅ — `GraphView.tsx`에 전용 empty 분기는 없음(노드 데이터 하드코딩). 필터 전부 OFF 시나리오를 추론해 제안: Graph Canvas를 "표시할 노드가 없습니다" 안내로, Top Tags Box를 "표시할 데이터가 없습니다"로 교체
- `CharDetailModal / 캐릭터 상세 모달` ✅ (176px overflow 의심 — Pencil 재시작 후 재검증 필요)
- `CharDetailModal / 캐릭터 삭제 확인 모달` ✅ — NVM-47에서 캐릭터 통째로 삭제 기능 추가(`S1Dashboard.tsx`). 헤더 우측에 삭제 버튼 추가, 클릭 시 "정말 삭제할까요?" + 취소/삭제(빨간 버튼) 확인 단계로 전환
- `S1Dashboard / 관계도 그래프뷰` ✅ — `GraphView.tsx` 기반: 좌측 필터 패널(통계 + 태그 유형 필터 5종 + 관계 유형 필터 7종 + 확대/축소/초기화 컨트롤), 중앙 그래프 캔버스(샘플 노드 8개 + 충돌 회차 강조 + 범례), 우측 패널(사용 방법 가이드 + 가장 연결된 태그 Top5)
- `UploadModal / 회차·설정집 업로드 모달` ✅ — 500px 모달(제목 "회차 올리기" + 2단계 Step Row + 작품 선택/회차 번호 입력 + 파일 드롭 + 설정집 동시 업로드 체크박스 + 뒤로/다음 버튼)
- `SettingsBuilderModal / 캐릭터 설정 빌더 모달` ✅ — 660px 모달(Sparkles 아이콘 + "캐릭터 설정 만들기" 제목 + X + 이름 입력, `generated` 상태: 항목 테이블(이름/직업/첫 등장, 스포일러 잠금 표시 포함) + "항목 추가" 버튼, 하단 항목/스포일러 카운트 + 취소/저장 버튼)
- `SettingsBuilderModal / 직접 입력 설정 빌더 모달` ✅ — NVM-47에서 AI 생성 외 수동 입력 경로 추가(`S1Dashboard.tsx`). 위 모달의 `!generated` 단계: "AI로 생성"/"직접 입력" 탭(밑줄 스타일) + 직접 입력 선택 시 안내 문구 + "직접 입력 시작" 버튼, 하단 안내 문구 "직접 입력을 시작한 뒤 내용을 채워주세요"
- `WorldBuilderModal / 세계관 설정 빌더 모달` ✅ — 660px 모달(Globe 아이콘 + 제목 입력 + 카테고리 선택 탭(지리/역사/마법 체계/조직/문화), `generated` 상태: 항목 테이블(지형/기후/주요 도시) + "항목 추가" 버튼, 하단 항목 카운트 + 취소/저장 버튼)

### SourceViewer — ✅ 완료

- `SourceViewer / 회차 원본` ✅ — 공통 `/editor` 라우트에서 회차 메타데이터와 원문을 읽기 전용으로 표시
- `SourceViewer / 설정집 원본` ✅ — 같은 라우트에서 설정집 파일 메타데이터와 변환 원문을 읽기 전용으로 표시
- `SourceViewer / 원문 조회 중` ✅ — 메타데이터·원문 로딩 상태
- `SourceViewer / 조회·변환·접근 오류` ✅ — 네트워크 조회 실패, TXT·DOCX 변환 실패, 삭제·접근 불가 상태와 원고 목록 복귀
- 기존 `S2Editor` 편집·분석 화면과 `S3Modal` 분석 요청 모달은 레거시 디자인 참고용이며 MVP 라우트·Workflow Board에는 사용하지 않음

### S3Chat — ✅ 완료

- `S3Chat / 빈 화면 (Empty)` ✅
- `S3Chat / 대화 진행 중 (With Messages)` ✅

### S4Loading — ✅ 완료

- `S4Loading / 분석 진행 중` ✅

### S5Report — ✅ 완료

- `S5Report / 단일 회차 검수` ✅ — Header(뒤로/제목/공유·원고 목록으로·아바타) + Body(요약 통계 바 + 필터 탭 + ErrorCard 3종(확장된 danger/접힌 warning/무시된 카드) + 수정 제안 복사·원문 보기 액션 + 하단 안내 바)
- `S5Report / 발행 전 전체 검수` ✅ — 위 화면을 복제해 제목을 "발행 전 전체 검수"로, 헤더 버튼을 "리포트로 돌아가기"로 변경하고, Body 상단에 "검수 범위"(빛나는 검사 로맨스 · 전체 158화 + 범위 변경 버튼) 바와 "발행 전 체크리스트" 안내 바를 추가
- `S5Report / 발행 전 전체 검수 - 충돌 없음 (디자인 제안, 코드 미구현)` ✅ — `S5Report.tsx`엔 0건 분기가 없음(`ERROR_DATA` 8개 하드코딩). `SEpisodeValidationReport`의 성공 패턴을 차용해 제안: 통계 0건 + Error Cards List를 성공 메시지로 교체
- 모달: `ShareModal / 공유·협업 모달` ✅

### SSettingReview — ✅ 완료

- `SSettingReview / 설정 후보 검토` ✅ — Header(뒤로/제목/검토 진행률 바/아바타) + Body(InfoBar + SplitPane: 좌측 검색·필터탭·카테고리탭·후보 리스트, 우측 CandidateDetail(배지+값+근거 인용+AI 분석 의견 박스+무시/수정/확정 버튼) + 하단 버튼 행)
- NVM-154에서 후보 리스트에 보유정보/시간정보/스탯 충돌 예시 3건 추가(`S1Dashboard.tsx`가 아니라 `mockEpisodeData.ts` 변경에 대응) — "강민준 · 보유 아이템"(권총 분실 등 다중 아이템), "수아 · 시간 경과"(3년 점프, 나이 재계산 필요), "강민준 · 계급/직급"(반장 진급)
- `SSettingReview / 설정 후보 검토 - 후보 없음` ✅ — `filtered.length===0` + 미선택 상태 결합, "0 / 0 검토 완료" + "해당하는 설정 후보가 없습니다." 안내

### SEpisodeValidationReport — ✅ 완료

- `SEpisodeValidationReport / 회차 검사 결과` ✅ — Header(뒤로/제목/충돌·모순 배지/아바타) + Body(InfoBar + SplitPane: 좌측 검색·카테고리탭·이슈 리스트, 우측 ErrorCard(S5Report의 확장 danger 카드를 재사용/복제) + 하단 버튼 행)
- `SEpisodeValidationReport / 회차 검사 결과 - 충돌 없음` ✅ — `issues.length===0` 분기: CircleCheckBig 아이콘 + "충돌/모순이 발견되지 않았습니다" + 배지 "충돌 0건"/"모순 0건"

### BackendStatus — ✅ 완료

- `BackendStatus / 네트워크 끊김 데모 전환 모달` ✅ — WifiOff 아이콘($warning) + "백엔드 서버에 연결할 수 없습니다" + 설명 + 닫기/데모 버전으로 전환 버튼
- `BackendStatus / 업로드 파일 없음 데모 전환 모달` ✅ — FileQuestion 아이콘($primary) + "업로드할 파일이 없으신가요?" + 설명 + 동일 버튼 구성

### ShareModal — ✅ 완료

- `ShareModal / 공유·협업 모달` ✅ — 580px, 탭 3개(협업자/링크/내보내기) 중 "협업자 관리" 탭을 기본 상태로 구현. 초대 폼(이메일 입력 + 역할 선택 + 초대 버튼 + 공유 범위) + 협업자 리스트 3명(아바타/이름/역할 배지/이메일·권한/권한 변경/삭제)

### 공용 컴포넌트 — ✅ 완료

- `AppSidebar` ✅
- `GraphView` ✅ — `S1Dashboard / 관계도 그래프뷰`로 마이그레이션
- `ReviewLayout` 계열(ModeCard, InfoBar, SplitPane, SearchInput, CategoryTabs, ListItemCard) ✅ — `SSettingReview`/`SEpisodeValidationReport` 화면에 인라인으로 반영됨

## 컴포넌트 상태 variant 보강

- `File Drop Area`의 "선택됨" 상태 (체크 아이콘 + "N개 파일 선택됨") ✅
- `Status Badge`의 다른 상태 색상 (진행중/대기/오류) ✅

## Workflow Boards

라우트와 분기의 기준 문서는 `docs/screen-flow.md`입니다. Workflow Board는 실제 화면 복제본, 번호 마커, 전환 설명을 한곳에 모은 시각적 리뷰 자료이며 파일럿 `M7oaU`의 구성을 템플릿으로 사용합니다. 중복 보기 화면 `EyLZo`는 제거하고 `FrYW0`를 공통 읽기 전용 원문 보기 원본으로 통합했습니다.

| Workflow | 상태 | Pencil Board ID | 리뷰 PNG |
| --- | --- | --- | --- |
| WF-01 / 인증·작품 진입 | ✅ 완료 | `q7BIt` | `docs/workflows/WF-01.png` |
| WF-02 / 작품·대시보드 | ✅ 완료 | `xuHzb` | `docs/workflows/WF-02.png` |
| WF-03 / 원고 관리·원문·분석 | ✅ 완료 | `XqFyi` | `docs/workflows/WF-03.png` |
| WF-04 / 회차 업로드 | ✅ 완료 | `RLw7i` | `docs/workflows/WF-04.png` |
| WF-05 / 검토·리포트 | ✅ 완료 | `i7MrrQ` | `docs/workflows/WF-05.png` |

### Workflow Board 유지보수 체크리스트

- `docs/screen-flow.md`, `src/app/App.tsx`, 실제 `navigate(...)` 호출을 대조해 모든 전환과 분기를 확인합니다.
- 화면 내용은 화면 원본 영역에서만 수정합니다. Workflow 복제본에는 `sourceNodeId` 메타데이터를 기록하고 내부 내용은 직접 수정하지 않습니다.
- 원본 변경 시 해당 복제본을 다시 생성하고 번호 마커와 Description을 재적용합니다.
- 전환 색상은 사용자 이동 `primary`, 모달·조건 분기 `warning`, 자동 완료 `success`, 실패 `danger`를 사용합니다.
- 각 보드에 `snapshot_layout(problemsOnly: true)`를 실행해 겹침과 잘림이 없는지 확인합니다.
- 보드 변경 후 `docs/workflows/WF-01.png`~`WF-05.png`를 다시 내보내고 문서 링크와 화면 가독성을 확인합니다.
- Pencil 저장 후 `git status`에서 `design/catchhole.pen` 변경 여부를 확인합니다.
- `design/images/현동멘토님 와이어프레임 예시.png`는 로컬 참고용으로만 사용하며 커밋하지 않습니다.
