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
- 없음 (정적 화면 — 현재 통계 수치 노출 영역 없음. 추후 통계 영역 추가 시 가입 작가 수 등 변동 수치만 동적 제공 — 노출 항목 확정 후 재협의)


**6. BE와 협의할 범위·상태값**
- 없음

---

## 로그인 (SLogin)


**URL**: [`/login`](https://www.catchhole.com/login)

![로그인 화면](../screens/tNdOk.png)

> **MVP 범위 메모**: 로그인은 이메일·비밀번호만 — 소셜 로그인(카카오/구글)은 MVP 이후 재논의. 회원 role(`USER`/`ADMIN`)은 FE 미사용(관리자 페이지 개발 시 재논의).


**1. 화면에 표시할 데이터**
- 이메일·비밀번호 입력
- 회원가입 이동 링크, 약관 링크


**2. 사용자 액션**
- 로그인 제출 → [작품 목록](./work.md#작품-목록-s0workpicker)
- [회원가입](#회원가입-ssignup) 이동
- [약관·개인정보 모달](#약관개인정보-모달-termsmodal) 열기

**3. 화면 전환 식별자**
- 로그인 성공 시 accessToken 저장 (이후 화면 접근 권한). `?terms=`로 약관 모달


**4. 데이터 없음 / 실패 표시**
- 이메일 형식 오류, 로그인 실패(잘못된 자격), 네트워크 오류, 제출 중 로딩 ([에러·제출중 상태](../screens/w5lmQO.png))

**5. BE에 요청할 데이터**
- 로그인 API: 이메일·비밀번호 → accessToken (refresh token은 HttpOnly 쿠키로 함께 발급 — 계약은 [BE auth.md](https://github.com/catchhole-soma/catchhole-backend-java/blob/main/docs/auth.md) 기준)
- 토큰 갱신 `POST /api/v1/auth/refresh` — 401 발생 시 공통 인터셉터에서 refresh 호출 후 원 요청 재시도, refresh도 실패하면 로그인 화면 이동. `credentials: 'include'`는 로그인·토큰 갱신·로그아웃 요청에만 적용
- 로그인 실패는 401 + `AUTH_INVALID_CREDENTIALS` 단일 코드 (이메일 미존재/비밀번호 불일치 구분 없음) — FE는 코드 기준 공통 안내 표시
- 현재 사용자 조회 `GET /api/v1/auth/me` — 새로고침 후 필명 등 표시용

**6. BE와 협의할 범위·상태값**
- 없음

---

## 회원가입 (SSignup)

**URL**: [`/signup`](https://www.catchhole.com/signup)

![회원가입 화면](../screens/VI8zP.png)

**1. 화면에 표시할 데이터**
- 필명·이메일·전화번호·비밀번호·비밀번호 확인 입력
- 약관 동의 체크 (이용약관·개인정보 수집이용 필수 2종 — 마케팅 수신 동의는 MVP 제외), 약관 링크


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
- 중복 시 실패 사유(`AUTH_EMAIL_DUPLICATED` / `AUTH_PHONE_NUMBER_DUPLICATED`) — 실시간 중복 확인 API 없이 가입 제출 시 이 에러 코드로 해당 입력란에 안내
- 비밀번호 정책: 8자 이상 64자 이하, 영문·숫자 각 1개 이상 (특수문자 선택) — FE·BE 동일 기준 검증

**6. BE와 협의할 범위·상태값**
- 없음

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
- 없음 (본문은 FE 정적 콘텐츠로 관리)


**6. BE와 협의할 범위·상태값**
- 없음 (MVP에선 동의 이력·약관 버전 저장 없음. BE에서 약관 버전 관리를 시작할 때 본문 서버 제공 + 동의한 약관 버전·시점 저장으로 전환 재논의)
