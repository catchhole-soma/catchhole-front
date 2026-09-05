# 브랜드 로고 및 URL 공유

- 이슈: https://github.com/catchhole-soma/catchhole-backend-java/issues/167
- 승인: 2026-09-05, 4A 접힌 띠 기반 입체 4번 유광 아크릴. 인용부호 없음.
- 화면용: `public/brand/catchhole-glossy-v1.png` — 512×512 RGBA, 투명 배경. 사용자 승인에 따라 원본의 중립색 배경·바닥 그림자와 여백만 코드로 제거하고, 아크릴 내부 반사광과 파란색을 보존했다. 심볼이 정사각 캔버스의 약 90%를 차지하도록 정리했다.
- 파비콘: `public/brand/catchhole-favicon-v1.png` — 32×32 투명 PNG.
- 홈 화면 아이콘: `public/brand/catchhole-apple-touch-v1.png` — 180×180 흰 배경 PNG.
- 공유용: `public/brand/catchhole-share-v1.png` — 승인된 흰 배경 원본. 외부 접근 가능한 정적 파일로 유지.
- 원본 SHA-256: `ba15954519509e82f0a17aa22a64ef00f73b4d1ae1c6d38d7a708d715b511496`. 원본 및 공유용 파일은 픽셀·바이트 변경 없이 보존했다.
- 사용처: 랜딩 헤더/푸터/제품 데모, 로그인/회원가입, 공개 체험, 법률 문서, 작품 선택 및 대시보드 등 WorkspaceTopbar 공통 셸.
- `BrandLogo`는 왼쪽 유광 아크릴 심볼과 오른쪽 기존 `catchhole-wordmark.png`를 함께 표시한다. 기존 글자 모양과 파란 포인트를 그대로 보존하며 접근 가능한 이름과 브랜드 버튼 이동 동작도 유지한다. 파비콘만 심볼 단독이다.
- 심볼 높이는 공통 44px, 모바일 40px, 인증 패널 44px, 인증 모바일 48px, 랜딩 미니 데모 24px. 워드마크 폭은 각각 158/130/180/154/82px이며 원본의 기존 여백 크롭만 유지한다.
- favicon/apple-touch-icon도 승인된 로고를 사용한다. 에셋이 바뀌면 경로 버전을 올려 브라우저와 공유 서비스 캐시를 갱신한다.
- `index.html`에 description, Open Graph, Twitter 메타데이터를 정적으로 선언한다. 배포 주소는 `https://www.catchhole.com/`이며 공유 이미지에도 절대 HTTPS URL을 사용한다.
- 정적 SPA 공유 미리보기는 제품 공통 소개만 포함한다. 회원·작품·원고 정보는 메타데이터에 넣지 않는다.
- 배포 후 새 URL과 이미지가 공개 200 응답인지 확인하고, 기존 카카오 등 공유 서비스 캐시는 해당 서비스의 미리보기 캐시 갱신 후 다시 확인한다. 로컬 검증만으로 실제 메신저 카드 반영을 보장하지 않는다.

검증: `npm run lint`, `npm run build`, `npm run test:e2e -- e2e/brand-logo.spec.ts`. 브라우저 렌더링 외에 JavaScript 실행 전 원본 HTML의 메타데이터와 이미지 응답을 검사한다.
