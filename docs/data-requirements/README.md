# 화면별 데이터 요구사항

FE가 와이어프레임 기준으로 각 화면에서 필요한 데이터를 정리한 문서입니다. BE는 이 문서를 보고 API를 설계·구현합니다.

각 화면은 6개 항목으로 정리합니다:

1. 화면에 표시할 데이터
2. 사용자 액션
3. 화면 전환 식별자
4. 데이터 없음 / 실패 표시
5. BE에 요청할 데이터
6. BE와 협의할 범위·상태값

- 배포: https://catch-hole.vercel.app (백엔드 미연동 — 첫 접속 시 데모 모드 전환 필요)

## 도메인별 문서

- [auth](./auth.md) — 랜딩 · 로그인 · 회원가입 · 약관
- [work](./work.md) — 작품 목록 · 작품 등록 · 대시보드
- [episode](./episode.md) — 회차 업로드 · 원고 목록
- [character](./character.md) — 설정DB · 설정 검토 · 캐릭터
- [report](./report.md) — 분석 진행 · 오류 리포트 · 회차 검사

## 화면 ↔ 도메인 매핑

| 화면 | URL | 도메인 |
| --- | --- | --- |
| 랜딩 | [`/landing`](https://catch-hole.vercel.app/landing) | [auth](./auth.md#랜딩-slanding) |
| 로그인 | [`/login`](https://catch-hole.vercel.app/login) | [auth](./auth.md#로그인-slogin) |
| 회원가입 | [`/signup`](https://catch-hole.vercel.app/signup) | [auth](./auth.md#회원가입-ssignup) |
| 약관·개인정보 모달 | [`/login?terms=terms`](https://catch-hole.vercel.app/login?terms=terms) | [auth](./auth.md#약관개인정보-모달-termsmodal) |
| 작품 목록 | [`/works`](https://catch-hole.vercel.app/works) | [work](./work.md#작품-목록-s0workpicker) |
| 작품 등록 모달 | — | [work](./work.md#작품-등록-모달-uploadmodal) |
| 대시보드 | [`/dashboard`](https://catch-hole.vercel.app/dashboard) | [work](./work.md#대시보드-s1dashboard) |
| 회차 업로드 | [`/episode-upload`](https://catch-hole.vercel.app/episode-upload) | [episode](./episode.md#회차-업로드-sepisodeupload) |
| 원고 목록 | [`/dashboard`](https://catch-hole.vercel.app/dashboard) | [episode](./episode.md#원고-목록-대시보드-원고-탭) |
| 설정DB | [`/dashboard?nav=settingDB`](https://catch-hole.vercel.app/dashboard?nav=settingDB&tab=characters) | [character](./character.md#설정db-캐릭터-탭) |
| 설정 검토 | [`/setting-review`](https://catch-hole.vercel.app/setting-review) | [character](./character.md#설정-검토-ssettingreview) |
| 분석 진행 | [`/loading`](https://catch-hole.vercel.app/loading) | [report](./report.md#분석-진행-s4loading) |
| 오류 리포트 | [`/report`](https://catch-hole.vercel.app/report) | [report](./report.md#오류-리포트-s5report) |
| 회차 검사 결과 | [`/episode-validation-report`](https://catch-hole.vercel.app/episode-validation-report) | [report](./report.md#회차-검사-결과-sepisodevalidationreport) |

> 캡처 이미지(`../screens/*.png`)는 Pencil 노드 id를 파일명으로 씁니다. 시각 디자인 원본은 `design/catchhole.pen`.
