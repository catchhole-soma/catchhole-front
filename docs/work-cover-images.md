# 작품 편집 표지 (GH436)

작품 목록 → 수정 → 표지 이미지 선택/미리보기 → 저장으로 표지를 설정한다. JPG·PNG·WebP, 최대 5MB, 각 변 4096px를 안내한다. 생성 화면은 그대로이며 모든 사용자/작품에 동일한 계약을 적용한다.

- 선택·교체·삭제는 모달 초안이다. 취소/닫기는 서버 요청 없이 폐기한다. 저장 실패 때 초안과 기존 서버 표지를 유지해 재시도할 수 있다. 삭제를 저장하면 기존 그라데이션/BookOpen으로 돌아간다.
- `WorkCoverEditor`가 파일 시그니처·크기·브라우저 디코딩/해상도를 사전 검사한다. 서버가 실제 파일 검증을 다시 수행한다. Blob URL은 선택 변경/닫기/세션 변경 때 해제한다.
- `WorkCoverImage`는 인증된 생성 SDK로 현재 표지 PNG를 조회하고 세션별 Query/Blob URL로 표시한다. 원격 공개 URL이나 장기 localStorage 이미지 캐시는 쓰지 않는다. 실패하면 기본 표지로 표시한다.
- 목록의 190px 표지 영역과 카드 배치는 유지하며 `object-fit: cover`로 채운다. 편집에서는 작은 미리보기와 44px 버튼, 모바일 모달 내부 스크롤을 제공한다.
- 표지를 변경한 경우 `updateWorkCover` multipart의 JSON metadata와 선택 파일을 보낸다. metadata에는 작품 정보·REPLACE/REMOVE·열었을 때 coverVersion이 포함된다. 표지 변경이 없으면 기존 updateWork를 사용한다.
- 저장 응답으로 목록/상세 캐시를 먼저 갱신하고 기존 관련 조회를 무효화한다. 409는 최신 상태로 다시 열도록 안내한다. 응답 유실은 성공/실패를 단정하지 않고 목록 확인을 안내한다. AI 분석 API를 호출하지 않는다.

## 생성 API

백엔드 GH436의 Swagger를 실행한 뒤 아래 절차로 생성했다. 생성 파일을 직접 편집하지 않는다.

```sh
CATCHHOLE_OPENAPI_INPUT=http://localhost:18437/v3/api-docs npm run api:generate
```

서버 계약·V126·파일 정리·배포 순서는 백엔드 `docs/work-cover-images.md`를 따른다. 백엔드 먼저 배포하고 프론트를 배포한다.

## 실제 연결 검증

`e2e/work-cover-live.spec.ts`는 `local-live-fixture`의 localhost 전용 일회 계정을 사용한다. 실행 조건은 `CATCHHOLE_E2E_API_BASE_URL`, `CATCHHOLE_E2E_DATABASE_URL`, `CATCHHOLE_E2E_SEED_EMAIL`, `CATCHHOLE_E2E_SEED_PASSWORD`, 선택 `CATCHHOLE_E2E_PYTHON`이다. 실제 쓰기 실패를 검사하려면 백엔드 e2e 프로필의 전용 파일 저장소 경로를 `CATCHHOLE_E2E_STORAGE_ROOT`에 전달한다. 공유/운영 저장소에는 이 테스트를 실행하지 않는다.

등록 → 저장 → 새로고침 → 새 브라우저 인증 → JPG/WebP 교체 → 삭제를 확인한다. 등록/교체/삭제 취소, 위장 파일, 파일 디렉터리 쓰기 실패 후 재시도, 타인 GET/PATCH 404와 익명 401, 모바일 320px, 작품 파기 후 파일 정리를 검사한다. accessToken localStorage와 HttpOnly 쿠키 사용, refreshToken localStorage 미사용도 확인한다.

실제 화면: [편집](screens/gh436/cover-edit-desktop.png) · [목록](screens/gh436/cover-list-desktop.png) · [모바일](screens/gh436/cover-edit-mobile.png).
