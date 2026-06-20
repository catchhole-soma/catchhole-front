# Pencil 마이그레이션 트래킹

`design/catchhole.pen`에 CatchHole-front의 모든 화면·모달을 Figma 와이어프레임 대체 수준으로 옮기기 위한 진행 상황 문서입니다. **매 세션 시작 시 이 문서를 먼저 읽고, 다음에 무엇을 할지 정하세요.**

## 네이밍 규칙

Pencil 노드 이름은 `<코드 컴포넌트명> / <화면-상태>` 형식을 따릅니다.

- 그룹명(`<코드 컴포넌트명>`)은 `src/app/components/catchhole/` 아래의 화면 컴포넌트 파일명을 그대로 사용합니다 (예: `SEpisodeUpload`, `SLogin`, `SSignup`).
- `/` 뒤에는 해당 화면 내부의 단계/상태를 적습니다 (예: `02B Mode B 입력`, `로그인`).
- 전역 모달(여러 화면에서 공통으로 뜨는 모달)은 `Modal / <모달명>` 그룹을 사용합니다 (예: `Modal / TermsModal`).
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

- `SEpisodeUpload / 01 업로드 방식 선택` ✅
- `SEpisodeUpload / 02A Mode A 입력` ✅
- `SEpisodeUpload / 02B Mode B 입력` ✅
- `SEpisodeUpload / 02C Mode C 입력` ✅
- `SEpisodeUpload / 03 회차 분리 확인` ✅
- `SEpisodeUpload / 04 설정 확인` ✅

### SLanding — ✅ 완료

- `SLanding / 랜딩` ✅ — 로그인 이전 단계의 마케팅 랜딩 페이지. Header(로고 + 로그인/회원가입 버튼) + Hero(배지 + 헤드라인 + 서브카피 + CTA 버튼 2개 + 신뢰 항목 2종 + 우측 대시보드 목업 이미지) + Features 섹션(`Feature Card` 컴포넌트 3개 인스턴스: 초고속 AI 대조 분석/일관성 체크/직관적인 리포트) + 하단 CTA 섹션 + Footer

### SLogin — ✅ 완료

- `SLogin / 로그인` ✅ — 좌측 브랜딩 패널(로고/헤드라인/설명/카피라이트+약관 링크) + 우측 폼(이메일/비밀번호, 로그인 버튼, 소셜 로그인, 회원가입 링크)
- 비밀번호 필드의 show/hide(눈모양) 토글 아이콘 ✅ — `Input/Auth Field` 공용 컴포넌트는 그대로 두고, 이 화면의 Password Field 인스턴스만 우측에 eye-off 아이콘이 있는 인라인 프레임으로 교체

### SSignup — ✅ 완료

- `SSignup / 회원가입` ✅ — 좌측 브랜딩 패널(헤드라인/설명/카피라이트만, 링크 없음) + 우측 폼(이름/이메일/휴대폰번호/비밀번호/비밀번호 확인 5개 입력, 약관 동의 체크박스, 회원가입 버튼, 소셜 로그인, 로그인 링크)

### Modal / TermsModal — ✅ 완료

- `Modal / TermsModal` ✅ — 반투명 backdrop + 600px 모달(헤더: 제목+X+탭 2개, 본문: 대표 섹션 3개, 하단: 확인 버튼). 와이어프레임 목적상 약관/개인정보 전체 5개 섹션이 아닌 대표 3개만 포함.

### S0WorkPicker — ✅ 완료

- `S0WorkPicker / Loaded` ✅
- `S0WorkPicker / Loading` ✅
- `S0WorkPicker / Empty` ✅

### S1Dashboard — ✅ 완료

- `S1Dashboard / 설정DB - 캐릭터` ✅
- `S1Dashboard / 분석 리포트` ✅
- `S1Dashboard / 업로드된 원고` ✅
- `Modal / CharDetailModal` ✅ (176px overflow 의심 — Pencil 재시작 후 재검증 필요)
- `S1Dashboard / 그래프 뷰` ✅ — `GraphView.tsx` 기반: 좌측 필터 패널(통계 + 태그 유형 필터 5종 + 관계 유형 필터 7종 + 확대/축소/초기화 컨트롤), 중앙 그래프 캔버스(샘플 노드 8개 + 충돌 회차 강조 + 범례), 우측 패널(사용 방법 가이드 + 가장 연결된 태그 Top5)
- `Modal / UploadModal (회차 올리기)` ✅ — 500px 모달(제목 "회차 올리기" + 2단계 Step Row + 작품 선택/회차 번호 입력 + 파일 드롭 + 설정집 동시 업로드 체크박스 + 뒤로/다음 버튼)
- `Modal / SettingsBuilderModal (캐릭터 설정)` ✅ — 660px 모달(Sparkles 아이콘 + "캐릭터 설정 만들기" 제목 + X + 이름 입력, `generated` 상태: 항목 테이블(이름/직업/첫 등장, 스포일러 잠금 표시 포함) + "항목 추가" 버튼, 하단 항목/스포일러 카운트 + 취소/저장 버튼)
- `Modal / SettingsBuilderModal (직접 입력 모드)` ✅ — NVM-47에서 AI 생성 외 수동 입력 경로 추가(`S1Dashboard.tsx`). 위 모달의 `!generated` 단계: "AI로 생성"/"직접 입력" 탭(밑줄 스타일) + 직접 입력 선택 시 안내 문구 + "직접 입력 시작" 버튼, 하단 안내 문구 "직접 입력을 시작한 뒤 내용을 채워주세요"
- `Modal / WorldBuilderModal (세계관 설정)` ✅ — 660px 모달(Globe 아이콘 + 제목 입력 + 카테고리 선택 탭(지리/역사/마법 체계/조직/문화), `generated` 상태: 항목 테이블(지형/기후/주요 도시) + "항목 추가" 버튼, 하단 항목 카운트 + 취소/저장 버튼)

### S2Editor — ✅ 완료

- `S2Editor / 분석 감지 (편집)` ✅ — Header(뒤로/제목/보기모드·공유·데모재생·분석요청·아바타) + Body 3분할(좌: 설정DB 패널, 중: 원고+상태바, 우: 충돌 카드+AI 제안+전체분석 버튼)
- `S2Editor / 보기 모드 (view)` ✅ — 위 화면을 복제해 Header 우측 버튼을 "편집 모드"로 변경, "분석 요청" 버튼 제거, Header 아래 "읽기 전용 / 편집으로 전환" 배너 추가
- `Modal / S3Modal (분석 요청)` ✅ — 480px 모달(제목 "159화 분석 요청" + 설명 + 체크리스트 3항목(캐릭터 설정 대조/타임라인 검증/관계도 확인) + "분석 시작"/"취소" 버튼)
- `S2Editor / 동적 상태 참고 (데모재생·충돌검사·툴팁)` ✅ — 동적 상태 참고 시트 1종: ① 데모 재생 버튼+상태바 4종(idle/playing/paused/done), ② 우측 패널 충돌검사 상태 2종(none="이상 없음"+감지 대기 안내, scanning="스캔 중"+진행바 3개) — detected 상태는 본 화면 우측 패널에서 이미 표현됨, ③ HighlightedText 호버 툴팁(AlertTriangle 아이콘 + "23화: 갈색 눈으로 설정됨" + 포인터)

### S3Chat — ✅ 완료

- `S3Chat / Empty` ✅
- `S3Chat / With Messages` ✅

### S4Loading — ✅ 완료

- `S4Loading / 분석 진행` ✅

### S5Report — ✅ 완료

- `S5Report / 단일 회차 검수` ✅ — Header(뒤로/제목/공유·원고로 돌아가기·아바타) + Body(요약 통계 바 + 필터 탭 + ErrorCard 3종(확장된 danger/접힌 warning/무시된 카드) + 하단 안내 바)
- `S5Report / 발행 전 전체 검수` ✅ — 위 화면을 복제해 제목을 "발행 전 전체 검수"로, 헤더 버튼을 "리포트로 돌아가기"로 변경하고, Body 상단에 "검수 범위"(빛나는 검사 로맨스 · 전체 158화 + 범위 변경 버튼) 바와 "발행 전 체크리스트" 안내 바를 추가
- 모달: `Modal / ShareModal` ✅

### SSettingReview — ✅ 완료

- `SSettingReview / 검토 화면` ✅ — Header(뒤로/제목/검토 진행률 바/아바타) + Body(InfoBar + SplitPane: 좌측 검색·필터탭·카테고리탭·후보 리스트, 우측 CandidateDetail(배지+값+근거 인용+AI 분석 의견 박스+무시/수정/확정 버튼) + 하단 버튼 행)

### SEpisodeValidationReport — ✅ 완료

- `SEpisodeValidationReport / 검사 결과` ✅ — Header(뒤로/제목/충돌·모순 배지/아바타) + Body(InfoBar + SplitPane: 좌측 검색·카테고리탭·이슈 리스트, 우측 ErrorCard(S5Report의 확장 danger 카드를 재사용/복제) + 하단 버튼 행)

### Modal / BackendStatus — ✅ 완료

- `Modal / BackendStatus (network)` ✅ — WifiOff 아이콘($warning) + "백엔드 서버에 연결할 수 없습니다" + 설명 + 닫기/데모 버전으로 전환 버튼
- `Modal / BackendStatus (no-file)` ✅ — FileQuestion 아이콘($primary) + "업로드할 파일이 없으신가요?" + 설명 + 동일 버튼 구성

### Modal / ShareModal — ✅ 완료

- `Modal / ShareModal` ✅ — 580px, 탭 3개(협업자/링크/내보내기) 중 "협업자 관리" 탭을 기본 상태로 구현. 초대 폼(이메일 입력 + 역할 선택 + 초대 버튼 + 공유 범위) + 협업자 리스트 3명(아바타/이름/역할 배지/이메일·권한/권한 변경/삭제)

### 공용 컴포넌트 — ✅ 완료

- `AppSidebar` ✅
- `GraphView` ✅ — `S1Dashboard / 그래프 뷰`로 마이그레이션
- `ReviewLayout` 계열(ModeCard, InfoBar, SplitPane, SearchInput, CategoryTabs, ListItemCard) ✅ — `SSettingReview`/`SEpisodeValidationReport` 화면에 인라인으로 반영됨

## 컴포넌트 상태 variant 보강

- `File Drop Area`의 "선택됨" 상태 (체크 아이콘 + "N개 파일 선택됨") ✅
- `Status Badge`의 다른 상태 색상 (진행중/대기/오류) ✅
