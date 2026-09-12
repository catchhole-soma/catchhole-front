# React Doctor 즉시 정리 결과

- 기준: 2026-09-08, `origin/main`의 `f83b3f6b1cbc5310608499ce3ffad9a861d58491`.
- 작업 이슈: [catchhole-backend-java #184](https://github.com/catchhole-soma/catchhole-backend-java/issues/184).
- 브랜치: `refactor/gh-184-react-doctor-cleanup`.
- React Doctor 0.9.13 / Knip 6.34.0. 생성 API와 기존 작업트리의 미커밋 변경은 보존했다.

## 검증 결과

| 검사 | 변경 전 | 변경 후 |
| --- | --- | --- |
| React Doctor, 생성 API 제외 | 오류 15 / 경고 298 | 오류 1 / 경고 164 |
| Knip 미사용 파일 | 7 | 0 |
| Knip 미사용 운영 / 개발 의존성 | 50 / 1 | 0 / 0 |
| Knip 외부 미사용 export / type export | 17 / 15 | 0 / 0 |
| Knip 미해결 import | 0 | 0 |
| ESLint | 오류 0 / 경고 39 | 오류 0 / 경고 2 |
| TypeScript / 프로덕션 빌드 | 통과 | 통과 |
| Playwright | 통과 205 / 건너뜀 2 | 통과 205 / 건너뜀 2, flaky 0 |
| JS 번들 / gzip | 1,274.99 / 356.25 KB | 1,175.22 / 331.27 KB |
| CSS 번들 / gzip | 321.05 / 47.48 KB | 318.08 / 46.78 KB |

변경 전 React Doctor 원본은 오류 15 / 경고 301이며, 생성 API 진단 3건을 위 비교에서 제외했다. 변경 후 전체 스캔은 `complete: true`, `skippedChecks: []`이다. 소스 파일은 132개에서 123개로 줄었고, 생성 코드를 제외한 107개를 검사했다. 남은 오류 1건은 아래에 근거를 기록한 오탐이다.

Playwright의 두 live API 테스트는 실행 환경이 없어 건너뛰었다. 실제 백엔드·DB 연동을 검증한 결과는 아니다. 새 잠금 파일로 `npm ci --ignore-scripts` 설치도 통과했다. 빌드의 500 KB 초과 chunk 경고는 남아 있다.

## 바로 정리한 항목

1. 초기 미사용 파일 7개를 삭제했다: `S3Chat.tsx`, `S4Loading.tsx`, `S5Report.tsx`, `SEpisodeValidationReport.tsx`, `TestLogin.tsx`, `mockEpisodeData.ts`, `figma/ImageWithFallback.tsx`.
2. 대시보드에서 열 수 없는 업로드·설정 빌더·리포트·그래프와 전용 상태·fixture·도우미를 제거했다. 그 뒤 참조가 사라진 `GraphView.tsx`, `ShareModal.tsx`도 Knip 확인 후 삭제했다. 총 삭제 파일은 9개다. 업데이트 예정 메뉴와 과거 URL의 작품 목록 리다이렉트는 유지한다.
3. 에디터의 미사용 `DemoEditor`와 전용 도우미를 제거했다. 서버 회차·설정집 원문 reader와 직접 진입 처리는 유지한다. 대시보드는 3,664 → 1,263줄, 에디터는 1,103 → 208줄이 되었다.
4. MUI·Emotion, 미사용 Radix 패키지, 기타 운영 의존성 50개와 Puppeteer를 제거했다. 운영 직접 의존성은 60 → 10개다. 진단 재현을 위해 React Doctor와 Knip을 개발 의존성에 고정 버전으로 추가했다. 선언된 버전과 잠금 파일을 함께 갱신했다.
5. 외부에서 쓰지 않는 export는 내부 사용을 확인해 비공개로 바꾸고, 사용 자체가 없는 선언만 삭제했다. 실제 `/demo` fixture와 E2E의 Vite 모듈 import는 유지한다.
6. 레거시 빌더 전용 API wrapper와 등록되는 곳이 없는 network-error listener를 제거했다. 생성 SDK, `NetworkError` 전파, access token·refresh·세션 만료 처리는 유지한다.
7. 대시보드와 캐릭터 DB의 ref 갱신을 `useLayoutEffect`로 옮겨 커밋된 화면 문맥을 참조하게 했다. 늦은 API 응답을 차단하는 비교 조건은 유지한다.
8. 세계관 근거 토글의 부모 fixture callback을 state updater 밖 이벤트 처리로 옮겼다. 데모에서 근거를 열고 닫고 다시 여는 흐름과 렌더 중 부모 상태 변경 경고가 없는지 검증했다.
9. 업로드 방식 카드를 native button으로 바꾸고 Enter·Space, 포커스 표시, `aria-pressed`, 설명 연결을 추가했다. 회차 제목과 세계관 검색 입력에 접근성 이름을 추가하고 기존 E2E에 회귀 검증을 넣었다.

## 리디자인하면서 정리할 항목

| 작업 단위 | 남은 근거와 검증 조건 |
| --- | --- |
| 화면 책임 분리 | 대형 컴포넌트 14건, 높은 복잡도 29건, 다중 컴포넌트 파일 16건. 대시보드·캐릭터/세계관 검토를 shell, 목록, 편집, 원문 근거의 책임에 맞춰 분리한다. |
| URL·query·draft 상태 | prop 변경에 따른 state 조정 28건, effect chain 1건. 뒤로가기·새로고침·작품 변경·저장 실패 시 입력 보존을 먼저 정의한다. |
| 공용 UI·CSS | 중복 JSX 4건, transition-all 4건, legacy inline style과 Theme V2 혼재. 버튼·탭·필터·모달 계약 및 의미 토큰을 정해 화면 단위로 옮긴다. |
| 번들·모션 | LazyMotion 제안 20건과 단일 큰 JS chunk. route 분리, 로딩·오류 UX, exit 및 reduced-motion 동작을 함께 검증하고 실제 성능을 측정한다. |
| 랜딩 프리뷰·전환 | 설명용 가짜 컨트롤과 label, AnimatePresence 생명주기 진단. 프리뷰와 실제 조작의 경계를 정한 뒤 접근성 구조를 맞춘다. |
| 모달·모바일 | native dialog 제안 4건과 backdrop 이벤트 진단. 기존 Radix 활용, focus trap·Escape·포커스 복귀·스크롤·중첩 근거 패널을 320×568과 확대 화면에서 검증한다. |

현재 로고·워드마크, 사용자 주도 데모 스크롤, 모바일 메뉴, 저장·확정 액션, 후보별 API 계약은 다음 작업에서도 유지한다. 대시보드에서 제거한 목업을 관계도·리포트의 실제 구현으로 간주하지 않는다.

## 오탐과 유보

- `WorldSettingDatabase.tsx`의 `requestPropertyDraftDiscard`는 React state setter가 아니다. 초안이 없으면 callback을 직접 실행하고, 초안이 있으면 객체에 저장해 사용자의 취소 확인 뒤 실행한다. 그 callback 안의 `setExpandedEvidence(null)`에 발생한 `no-impure-state-updater` 오류 1건은 오탐이며 규칙을 꺼서 숨기지 않았다.
- `api-config.ts`의 localStorage access token 경고는 현재 인증 계약에 해당한다. 인증 설계 변경은 백엔드와 별도 검토한다.
- `SEpisodeUpload.tsx`의 분석 종료 refetch는 최신 사용량 중단 집계와 Job ID 기반 중복 방지에 쓰인다. 요청·알림 회귀 근거 없이 제거하지 않는다.
- ESLint 경고 2건은 `AppSidebar.tsx`와 `AppContext.tsx`의 Fast Refresh export 구성이다. 화면·context 책임 분리와 함께 다룬다.
- `postcss.config.mjs`는 Vite 설정 진입점이다. E2E의 `/src/*` import는 Vite 모듈 URL이다. Knip 설정에 이를 반영했으며, 실제 fixture를 미사용으로 오인해 삭제하지 않았다.
- 생성 API 17개 파일은 기준 커밋과 바이트 단위로 동일하다. 생성 코드는 두 진단 설정에서 제외하며 직접 수정하거나 재생성하지 않았다.

## 재현

### NVM-321 랜딩 영상 추가 확인 (2026-09-10)

실사 영상 히어로와 반응형 재생을 추가한 뒤 전체 진단을 다시 실행했다. `complete: true`이며 오류 1건·경고 164건으로 기존 기준과 같다. 새 `landing-video/` 컴포넌트에는 진단이 없으며, 기존 `SLanding.tsx`의 순수 함수 위치 제안과 위에 기록한 오탐·유보 항목은 유지한다. 스크롤 프레임에서는 레이아웃 측정 뒤 스타일 쓰기를 모아서 실행한다.

모바일 영상 이후 원고·설정 자동 추출 및 확정 흐름을 추가한 뒤에도 `complete: true`, `skippedChecks: []`, 오류 1건·경고 164건이며 `landing-video/`의 신규 진단은 없다. 영상과 추출의 재생 제어 표시는 독립 컴포넌트로 분리했다. 관련 브라우저 테스트 7개(320·390px, 자동 진행, 스크롤 독립성, 정지·재개·다시 보기, 모션 감소, 미디어 오류, 기존 데스크톱 흐름)가 통과했다.

```bash
npm ci
npm run typecheck
npm run lint
npm run build
CATCHHOLE_E2E_PORT=3184 npm run test:e2e -- --workers=2
npm run check:unused
npm run doctor -- --no-cache --json
```

`doctor`는 공급망·원격 점수 검사를 생략한 전체 React 진단이며 참고용 종료 정책(`--blocking none`)을 사용한다. JSON의 `complete`, `skippedChecks`, `summary`를 함께 확인한다.

React Doctor 0.9.13은 Git index에 남은 삭제 파일을 maintainability 단계에서 다시 읽어 ENOENT로 일부 검사를 건너뛸 수 있다. 이번 결과는 현재 존재하는 저장소 파일을 Git 메타데이터 없는 임시 폴더에 복사하고, 같은 node_modules·설정·명령으로 다시 검사한 것이다. 복사 manifest로 원본과 일치함을 확인했으며 실제 브랜치의 index·커밋을 변경하지 않았다. 삭제가 커밋된 체크아웃에서는 일반 재현 명령을 사용한다.
