# 데이터 요구사항 — Auth(인증)

[← 전체 인덱스](./README.md)

## 목차

- [랜딩 (SLanding)](#랜딩-slanding)
- [로그인 (SLogin)](#로그인-slogin)
- [회원가입 (SSignup)](#회원가입-ssignup)
- [약관·개인정보 모달 (TermsModal)](#약관개인정보-모달-termsmodal)

---

## 랜딩 (SLanding)

**URL**: [`/landing`](https://www.catchhole.com/landing)

![랜딩 화면](../screens/k7pzFp.png)

**1. 화면에 표시할 데이터**
- 서비스 소개(Hero), 기능 카드, 신뢰 요소

**2. 사용자 액션**
- [로그인](#로그인-slogin) 이동 / [회원가입](#회원가입-ssignup) 이동

**3. 화면 전환 식별자**
- 없음

**4. 데이터 없음 / 실패 표시**
- 정적 화면 (해당 없음)

**5. BE에 요청할 데이터**
- 없음 (정적). 단, 소개 수치(예: 누적 검수 건수)를 동적으로 보여줄 경우 해당 통계

**6. BE와 협의할 범위·상태값**
- 랜딩 통계 수치를 동적으로 제공할지 여부

---

## 로그인 (SLogin)

**URL**: [`/login`](https://www.catchhole.com/login)

![로그인 화면](../screens/tNdOk.png)

**1. 화면에 표시할 데이터**
- 이메일·비밀번호 입력
- 소셜 로그인(카카오/구글) 버튼
- 회원가입 이동 링크, 약관 링크

**2. 사용자 액션**
- 로그인 제출 → [작품 목록](./work.md#작품-목록-s0workpicker)
- 소셜 로그인 (카카오/구글 — 연동 방식은 6번 협의 항목)
- [회원가입](#회원가입-ssignup) 이동
- [약관·개인정보 모달](#약관개인정보-모달-termsmodal) 열기

**3. 화면 전환 식별자**
- 로그인 성공 시 accessToken 저장 (이후 화면 접근 권한). `?terms=`로 약관 모달

**4. 데이터 없음 / 실패 표시**
- 이메일 형식 오류, 로그인 실패(잘못된 자격), 네트워크 오류, 제출 중 로딩 ([에러·제출중 상태](../screens/w5lmQO.png))

**5. BE에 요청할 데이터**
- 로그인 API: 이메일·비밀번호 → accessToken (refresh token은 HttpOnly 쿠키로 함께 발급 — 계약은 [BE auth.md](https://github.com/catchhole-soma/catchhole-backend-java/blob/main/docs/auth.md) 기준)
- 인증 실패 사유(아이디/비번 불일치 `AUTH_INVALID_CREDENTIALS` 등)
- 현재 사용자 조회 `GET /api/v1/auth/me` — 새로고침 후 필명 등 표시용

**6. BE와 협의할 범위·상태값**
- 소셜 로그인(OAuth) 제공 범위·연동 방식
- 회원 role(`USER`/`ADMIN`)의 FE 사용 여부 — MVP에선 미사용으로 둘지, 어드민 전용 기능(모니터링 등)을 둘지 (BE global.md의 `ADMIN_URLS` 정책 문서화 TODO와 연동)
- 토큰 갱신은 refresh 쿠키 회전(`POST /api/v1/auth/refresh`) 방식으로 확정 — FE의 401 처리 시 refresh 호출 흐름과 `credentials: 'include'` 적용 범위 협의
- 로그인 실패 응답 형식(에러 코드/메시지)

---

## 회원가입 (SSignup)

**URL**: [`/signup`](https://www.catchhole.com/signup)

![회원가입 화면](../screens/VI8zP.png)

**1. 화면에 표시할 데이터**
- 필명·이메일·전화번호·비밀번호·비밀번호 확인 입력
- 약관 동의 체크, 약관 링크

**2. 사용자 액션**
- 가입 제출 → 자동 로그인 → [작품 목록](./work.md#작품-목록-s0workpicker)
- [약관·개인정보 모달](#약관개인정보-모달-termsmodal) 열기
- [로그인](#로그인-slogin) 이동

**3. 화면 전환 식별자**
- 가입 성공 시 자동 로그인(accessToken). `?terms=`로 약관 모달

**4. 데이터 없음 / 실패 표시**
- 필드 검증(이메일·전화 형식, 비밀번호 길이·일치), 이메일 중복, 네트워크 오류, 제출 중 로딩 ([에러·제출중 상태](../screens/ThXIG.png))

**5. BE에 요청할 데이터**
- 회원가입 API: 필명(`displayName`)·이메일·전화번호·비밀번호
- 중복 시 실패 사유(`AUTH_EMAIL_DUPLICATED` / `AUTH_PHONE_NUMBER_DUPLICATED`)

**6. BE와 협의할 범위·상태값**
- 중복 검증은 가입 시점 에러 응답으로 확정 — 입력 중 실시간 중복 확인 API 신설 여부만 협의
- 필수 약관 항목, 비밀번호 정책(길이·문자 구성)

---

## 약관·개인정보 모달 (TermsModal)

**URL**: [`/login?terms=terms`](https://www.catchhole.com/login?terms=terms)

![약관·개인정보 모달](../screens/BQqMv.png)

**1. 화면에 표시할 데이터**
- 이용약관 / 개인정보 처리방침 본문 (탭 전환)

**2. 사용자 액션**
- 탭 전환(약관 ↔ 개인정보), 닫기

**3. 화면 전환 식별자**
- `?terms=terms|privacy` (로그인·회원가입 화면 위에 표시)

**4. 데이터 없음 / 실패 표시**
- 본문 로드 실패

**5. BE에 요청할 데이터**
- 약관·개인정보 본문 (정적 포함 또는 서버 제공)

**6. BE와 협의할 범위·상태값**
- 본문은 MVP에선 정적 포함(FE 하드코딩)이 잠정안 — 동의 이력을 증빙 수준으로 남기기로 확정되면 서버 제공(또는 서버 버전 관리 + FE 본문)으로 전환 검토
- 약관 버전 관리: 가입 시 동의한 약관 버전(`termsVersion` 등)을 함께 저장할지
