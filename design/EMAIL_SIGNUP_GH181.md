# GH-181 이메일 인증 회원가입 디자인 반영안

구현 기준: `SSignup.tsx`, `useSignupVerification.ts`, [인증 데이터 계약](../docs/data-requirements/auth.md#회원가입-ssignup).

실제 브라우저 캡처:

- [데스크톱 기본](../docs/screens/email-signup-desktop.png)
- [인증번호 입력·재전송 대기](../docs/screens/email-signup-code.png)
- [이메일 인증 완료](../docs/screens/email-signup-verified.png)
- [320px 모바일](../docs/screens/email-signup-mobile.png)

## Pencil 원본 반영 대상

| 원본 ID | 현재 프레임 | 반영 내용 |
| --- | --- | --- |
| `tMALM` | Active / Signup / Default | 전화번호 입력 제거, 이메일 아래 전체 너비 인증번호 받기, 이메일 인증 전 안내 |
| `VzawP` | Active / Signup / Phone Code Input | Email Code Input으로 이름 변경, 이메일 입력·6자리 코드·API 만료 타이머·스팸함 안내 |
| `MF1bl` | Active / Signup / Resend Waiting | 이메일 인증 상태, 발송 버튼에 남은 재전송 대기 초 표시 |
| `j1BByU` | Active / Signup / Phone Verified | Email Verified로 이름 변경, 코드 입력 제거, 이메일 인증 완료·가입 토큰 잔여시간 표시 |
| `RXyHs` | Active / Signup / Error | 이메일 중복·코드 오류·발송 제한·서비스 오류 안내, 입력 유지 |
| `HDeLo` | Active / Signup / Mobile / Default | 320px에서 긴 이메일과 발송 버튼을 서로 다른 행으로 표시 |
| `P0YjRs`, `MaREr`, `Gmae3`, `BKd2a` | 모바일 코드·대기·완료·오류 | 위 데스크톱 상태와 동일한 데이터와 조작 흐름 적용 |
| `virQv`, `NkhK3`, `GfeiI` | Legal Documents Loaded / Loading / Error | 이메일 인증 입력으로 교체, 기존 법률 확인·만 14세 이상 확인 유지 |

추가로 Policy Loading / Policy Error / Signup Token Expired 상태가 필요하다. 정책 로딩·오류에서는 인증 발송과 가입을 비활성화하며 오류에는 `인증 방식 다시 불러오기`를 제공한다. 이미 조회한 정책을 같은 방식으로 재조회하면 완료 토큰은 보존하고 조회 중 제출만 막는다. 최초 정책 조회 전에는 이메일 입력을 잠가 복원할 인증 주소와 새 입력이 충돌하지 않게 한다.

미래 PHONE 정책용 원본은 별도 상태로 보존한다. API 정책을 사용자가 바꾸는 토글은 추가하지 않는다. 이메일 인증의 시간은 기본 인증번호 5분·재전송 60초·가입 토큰 10분이고 화면에는 서버 응답의 초를 표시한다.

이메일 발송 후 인증 완료 전까지 코드 입력칸 아래에 메일 아이콘과 `인증메일이 도착하지 않았다면 스팸함도 확인해주세요.` 안내 상자를 표시한다. `스팸함`은 굵게 강조하고 Theme V2의 `--ch-surface-soft` 배경과 `--ch-text` 글자를 사용한다. 320px에서도 안내 문장이 자연스럽게 줄바꿈되며 인증 완료 또는 이메일 변경 시 숨긴다. 코드 입력·재전송 대기 원본과 해당 모바일·WF-01 복제본에도 같은 안내를 반영한다.

기존 `SSignup` 원본과 `Workflow Board / WF-01` 복제본은 같은 계약으로 동기화한다. 복제본은 원본에서 다시 만들고 `sourceNodeId`를 보존하며 WF-01 PNG를 다시 내보낸다. 이용약관·개인정보처리방침 원문을 이 디자인 변경에서 임의로 게시하거나 수정하지 않는다.

## 편집·검증 상태

코드와 위 네 개 실제 브라우저 캡처는 반영했다. Pencil 파일 편집은 보류 상태다. Pencil의 `get_app_state`와 `read_skill`은 열린 디자인 파일이 없다고 실패했고, VS Code의 pen.dev 확장에서 파일을 열려는 시점에는 Mac 잠금으로 조작이 차단되었다. 빈 실행으로 파일 컨텍스트를 확보하려던 호출은 구체적인 변경 범위를 확인할 수 없다는 자동 승인 검토 거절을 받았다. `.pen` 파일은 MCP로만 접근하라는 도구 제약에 따라 직접 패치하지 않았다.

2026-09-08 스팸함 안내 상자 개선: 로컬 3101 화면에서 표시를 확인했고 이메일 인증 E2E 12개(320px 포함), 빌드가 통과했다. lint는 오류 없이 기존 경고 39개다. 위 캡처 파일은 안내 상자 개선 전 상태다. Pencil `get_app_state`와 `read_skill`을 다시 확인했지만 모두 열린 디자인 파일 컨텍스트가 없다는 오류로 실패하여 이번 안내 상자의 `.pen` 반영도 보류 상태다.
