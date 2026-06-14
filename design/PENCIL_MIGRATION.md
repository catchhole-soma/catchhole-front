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
| `Status Badge` | ✅ | 상태 배지 (기본 색상만, 다른 상태 색상 variant ⬜) |
| `Checkbox Row` | ✅ | 체크박스 + 라벨 행 |
| `File Drop Area` | ✅ | 파일 드롭 영역 (정상 상태 + 에러 상태 참고 프레임) |

## 화면 그룹

### SEpisodeUpload — ✅ 완료

회차 업로드 플로우 6단계 전부 마이그레이션 완료.

- `SEpisodeUpload / 01 업로드 방식 선택` ✅
- `SEpisodeUpload / 02A Mode A 입력` ✅
- `SEpisodeUpload / 02B Mode B 입력` ✅
- `SEpisodeUpload / 02C Mode C 입력` ✅
- `SEpisodeUpload / 03 회차 분리 확인` ✅
- `SEpisodeUpload / 04 설정 확인` ✅

### SLogin — ✅ 완료

- `SLogin / 로그인` ✅ — 좌측 브랜딩 패널(로고/헤드라인/설명/카피라이트+약관 링크) + 우측 폼(이메일/비밀번호, 로그인 버튼, 소셜 로그인, 회원가입 링크)
- 비밀번호 필드의 show/hide(눈모양) 토글 아이콘은 `Input/Auth Field`에 인라인으로 추가하지 않음 — 후속 보강 시 컴포넌트에 슬롯 추가 검토 ⬜

### SSignup — ✅ 완료

- `SSignup / 회원가입` ✅ — 좌측 브랜딩 패널(헤드라인/설명/카피라이트만, 링크 없음) + 우측 폼(이름/이메일/휴대폰번호/비밀번호/비밀번호 확인 5개 입력, 약관 동의 체크박스, 회원가입 버튼, 소셜 로그인, 로그인 링크)

### Modal / TermsModal — ✅ 완료

- `Modal / TermsModal` ✅ — 반투명 backdrop + 600px 모달(헤더: 제목+X+탭 2개, 본문: 대표 섹션 3개, 하단: 확인 버튼). 와이어프레임 목적상 약관/개인정보 전체 5개 섹션이 아닌 대표 3개만 포함.

### S0WorkPicker — ⬜ 미착수

- Loading / Empty / Loaded 3 variant

### S1Dashboard — ⬜ 미착수

- settingDB / reports / graph / manuscripts 4개 탭
- 모달: UploadModal, SettingsBuilderModal, WorldBuilderModal, CharDetailModal

### S2Editor — ⬜ 미착수

- edit / view 모드
- 데모 재생 상태: idle / playing / paused / done
- 충돌 검사 상태: none / scanning / detected
- S3Modal(분석 요청 모달), HighlightedText 툴팁

### S3Chat — ⬜ 미착수

- empty / with-messages

### S4Loading — ⬜ 미착수

- 3단계 진행 화면

### S5Report — ⬜ 미착수

- single / prePublish 모드 + 필터 탭
- 모달: `Modal / ShareModal`

### SSettingReview — ⬜ 미착수

- 코드 조사 필요 (`SSettingReview.tsx`)

### SEpisodeValidationReport — ⬜ 미착수

- 코드 조사 필요 (`SEpisodeValidationReport.tsx`)

### Modal / BackendStatus — ⬜ 미착수

- 데모 모드 전환 프롬프트 (`network` / `no-file` variant), 백드롭 + 중앙 모달(아이콘+제목+설명+버튼 2개)

### Modal / ShareModal — ⬜ 미착수

- 580px, 탭 3개(협업자/링크/내보내기)

### 공용 컴포넌트 — ⬜ 미착수

- `AppSidebar`
- `GraphView`
- `ReviewLayout` 계열: ModeCard, InfoBar, SplitPane, SearchInput, CategoryTabs, ListItemCard

## 컴포넌트 상태 variant 보강 (백로그)

- `File Drop Area`의 "선택됨" 상태 (체크 아이콘 + "N개 파일 선택됨")
- `Status Badge`의 다른 상태 색상 (진행중/대기/오류 등)
