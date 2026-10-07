# CatchHole Landing and Setting Review Design System

<!-- design-md:section experience -->
## 1. Experience

<!-- design-md:claim scope kind=product-surface lang=en -->
### Scope

CatchHole `/landing` is the public marketing surface for web-novel authors and editors evaluating a product that turns uploaded episode manuscripts into AI-extracted character and world-setting candidates with source evidence, automatic application, and author review where needed. This contract also defines the explicitly scoped completion and comparison-choice behavior of `/setting-review`; other authenticated workspace routes remain outside its scope.
<!-- design-md:claim-end -->

<!-- design-md:claim primary-tasks kind=user-outcomes count=3 lang=en -->
### Primary tasks

- Experience the manuscript-to-setting review flow without signing in through `/demo` as the primary landing conversion.

- Move to free sign-up as the secondary path when ready to register a work and use the full service.

- Finish all character and world-setting review decisions, then move directly to the selected work's manuscript list.
<!-- design-md:claim-end -->

### Design direction

- Make reference-led landing redesigns visibly distinct through a strong first-screen hero and meaningful section hierarchy; CTA styling alone is not sufficient.

- Use purpose-built, visually distinct images for the hero and each product-flow panel instead of reusing one generic image through repeated crops.

- Present the implemented eight-stage manuscript workflow as one animated exploratory accordion with a clear active step and reduced-motion fallback.

- Present the product capability surface as a structured two-column service catalog on desktop and a single-column catalog on mobile.

- Keep the character-setting review queue decision-focused by automatically dismissing EXCLUDE comparison results without changing confirmed settings or history.

### Principles

- Use NHN Cloud as reference evidence while CatchHole repository facts and explicit owner decisions define product behavior.

- Keep capability claims aligned with shipped product behavior and label relationship maps, chatbot, and error reports as upcoming until implemented.

### Avoid

- Do not apply landing-specific visual rules to authenticated workspace routes; only the explicitly scoped setting-review behavior applies to `/setting-review`.

- Do not reduce the redesign to generic cards, decorative gradients, or repeated crops that obscure the actual product flow.

<!-- design-md:section foundations -->
## 2. Foundations

<!-- design-md:claim foundations kind=rules-or-constraints lang=en -->
### Semantic tokens

- **color.control-border**: `#51565F` — Verified NHN Cloud resource-control border evidence.
- **color.menu-surface**: `#111111` — Reference-only dark expanded menu surface; do not generalize it into the CatchHole workspace palette.
- **color.menu-text**: `#FFFFFF` — Reference-only text color on the dark expanded menu surface.
- **color.muted-control**: `#727781` — Verified NHN Cloud resource-control text and border evidence.
- **color.on-primary**: `#FFFFFF` — Text and icon color on the primary action surface.
- **color.primary**: `#125DE6` — Primary landing conversion and active-step blue, derived from the verified NHN Cloud marketing reference.

### Contrast pairs

- color.on-primary on color.primary: minimum 4.5:1
- color.menu-text on color.menu-surface: minimum 4.5:1

### Reduced motion

Required.

### Foundation rules

- Reserve `#125DE6` for primary conversion, active workflow steps, and focused brand emphasis on `/landing`.

- Keep the verified 30px pill geometry scoped to landing CTAs; resource controls retain their separately evidenced 6px trigger and 8px panel geometry.

- Accordion motion must communicate the active product step and collapse to an immediate state change when reduced motion is requested.
<!-- design-md:claim-end -->

<!-- design-md:section typography-assets -->
## 3. Typography & Assets

### Type roles

| Role | Usage | Family | Weight |
|---|---|---|---|
| landing-display | Hero and major landing section headings with a compact, high-impact hierarchy. | Pretendard Variable | 700–800 |
| landing-ui | Landing navigation, CTA, product-step labels, catalog titles, and supporting copy. | Pretendard Variable | 400–700 |

### Assets

| Asset | Kind | Source status | License status | Source | Notes |
|---|---|---|---|---|---|
| pretendard-variable | font | official | verified | https://www.nhncloud.com/fonts/PretendardVariable.woff2 | Corporate marketing reference use is verified; upstream Pretendard is distributed under SIL Open Font License 1.1. |
| landing-generated-images | image | generated-original | not-required | src/assets/landing/ | One dedicated hero composition and eight purpose-built workflow panel images created for CatchHole. |

### Rules

- Use the landing display role for first-screen impact and the landing UI role for compact product explanation.

- Keep image purpose explicit: the hero explains manuscript-to-setting connection, while each workflow image represents one distinct product stage.

<!-- design-md:section components-states -->
## 4. Components & States

### Component: landing-primary-action

**Semantics:** Navigates directly to the login-free interactive demo and remains the primary landing conversion.

- Anatomy: label, optional directional icon
- Variants: 40px header action, 48px hero and closing action
- States: default, hover, focus-visible
- Token references: color.primary, color.on-primary

- Interaction kind: interactive

#### State applicability

| State | Applicability | Reason |
|---|---|---|
| default | applicable |  |
| hover | applicable |  |
| focus-visible | applicable |  |
| disabled | not-applicable | The public demo route is always available from the landing page. |
| loading | not-applicable | Navigation does not expose an asynchronous loading state in this control. |
| error | not-applicable | Route-level failures are not rendered as a button state. |
| success | not-applicable | Successful navigation replaces the landing route instead of changing the button state. |

### Component: landing-product-accordion

**Semantics:** Explores the real eight-stage CatchHole workflow within one showcase instead of displaying eight isolated screens.

- Anatomy: step trigger, step number, step label, purpose-built panel image, active panel content
- Variants: desktop vertical rails, tablet and mobile horizontal step strip
- States: default, hover, focus-visible, expanded

- Interaction kind: interactive

#### State applicability

| State | Applicability | Reason |
|---|---|---|
| default | applicable |  |
| hover | applicable |  |
| focus-visible | applicable |  |
| disabled | not-applicable | Every workflow step remains selectable. |
| loading | not-applicable | All panel assets are bundled with the landing page. |
| error | not-applicable | The showcase does not call product APIs. |
| success | not-applicable | Selecting a step is represented by the expanded state. |

### Component: setting-review-completion-action

**Semantics:** Leaves `/setting-review` only after both character and world-setting review summaries are available and no candidate still needs direct review or is being analyzed.

- Anatomy: label, remaining-item count
- Variants: character tab, world-setting tab
- States: default, hover, focus-visible, disabled, loading

- Interaction kind: interactive

#### State applicability

| State | Applicability | Reason |
|---|---|---|
| default | applicable |  |
| hover | applicable |  |
| focus-visible | applicable |  |
| disabled | applicable | The action stays disabled until both review summaries load successfully and direct-review and processing candidates reach zero. |
| loading | applicable | The disabled action reflects that one or both aggregate queries are still loading. |
| error | not-applicable | A summary-query failure keeps the action disabled instead of becoming a button error state. |
| success | not-applicable | Completion replaces the review route with the selected work's manuscript list. |

### Rules

- Keep the verified NHN Cloud CTA geometry as landing evidence rather than a universal application button system.

- Use `로그인 없이 체험하기` as the primary action in the header, hero, and closing CTA; free sign-up remains secondary.

- Accordion transitions must preserve keyboard focus, expose the active step, and honor reduced-motion preferences.

- Enable the setting-review completion action only when both character and world-setting summaries loaded successfully and all direct-review and processing counts are zero; otherwise keep it disabled and show the remaining count.

- On completion, replace the current route with `/dashboard?workId={workId}&nav=manuscripts` from either review tab, including direct URL entry.

- Automatically dismiss character-setting candidates whose comparison result is EXCLUDE, omit them from the default review queue, and preserve the confirmed current setting and history; do not apply this rule to world-setting candidates.

<!-- design-md:section layout-platforms -->
## 5. Layout & Platforms

### Responsive constraints

- Minimum supported width: 320px
- Reflow target: 200% zoom

### Layout rules

- Keep a strong split hero at wide viewports, then stack copy before imagery on narrower screens without horizontal overflow.

- Render the service catalog in two columns on desktop and one column on mobile, preserving the same capability order and upcoming labels.

- Reformat the eight-step desktop accordion into a single active panel with a horizontal step strip on tablet and mobile.

- Keep both setting-comparison choice descriptions readable without horizontal overflow at the 320px minimum width and 200% reflow target.

### Platform: web

- Support 320px-wide viewports and reflow at 200% zoom without horizontal scrolling.
- Keep the primary CTA reachable before the showcase and again after the service catalog.

<!-- design-md:section content-locales -->
## 6. Content & Locales

### Voice

- Write Korean landing copy in a direct, capability-led style that explains what the author can inspect, compare, or confirm.

- Use concrete product nouns such as 원고, 회차, 캐릭터, 세계관, 원문 근거, and 설정 이력 instead of abstract AI claims.

### Locale: ko-KR (supported)

- Keep CTA labels short and action-oriented.
- Mark unshipped capabilities with `업데이트 예정` and do not present them as currently available.
- Label the non-current comparison choice `이력에만 저장` and explain it as `회상이나 과거 상태처럼 현재 시점의 설정이 아닐 때 선택합니다. 예: ‘과거에는 용병이었다’는 타임라인에 남기되 현재 직업은 바꾸지 않습니다.`

<!-- design-md:section governance -->
## 7. Governance

<!-- design-md:claim authority kind=project-system lang=en -->
### Authority

This document is the project design contract for the declared scope.
<!-- design-md:claim-end -->

<!-- design-md:claim application-priority order=prompt-fact,repository-fact,system-contract,reference-inspiration lang=en -->
### Application priority

1. Direct user instructions for the requested scope.
2. Repository facts.
3. This system contract.
4. Reference inspiration.
<!-- design-md:claim-end -->

<!-- design-md:claim unknowns policy=absent-at-smallest-unresolved-boundary lang=en -->
### Unknowns

Omit only the smallest unresolved value or group. Do not replace it with a plausible default.
<!-- design-md:claim-end -->

<!-- design-md:claim changes policy=review-record-validate-before-adoption lang=en -->
### Changes

Record, review, and validate changes before adoption.
<!-- design-md:claim-end -->

### Project priority details

1. Direct project-owner instructions for the declared landing and setting-review scopes.

2. CatchHole repository facts and verified implementation behavior.

3. This adopted scoped product-system contract.

4. NHN Cloud reference inspiration within its captured evidence boundary.

### Additional change rules

- Record new owner corrections in `.omd/preferences.md`, review them, and fold them through the Core v2 graph before clearing pending status.

- Update operational docs and the Pencil source whenever an approved landing flow or capability description changes.

### Review results and language

- Use shared batch-wide counts for applied, excluded, direct review, and analyzing. Each candidate belongs to one count. Saved drafts remain in direct review until confirmed or excluded.
- Present applied, excluded, and direct review as the three primary summary cards. Keep analyzing in a separate status line; candidate-type tabs and the disabled completion action use the same remaining-work meaning.
- The pending filter is labeled `미처리` because it includes direct review and ongoing comparisons. Candidate badges distinguish these states.
- Explain review and error messages through manuscript meaning and the next author action. Preserve quoted evidence, proper names, and setting values; do not replace technical-looking words across arbitrary content.
- Reference frames: `gh180DirectReview20260910Desktop`, `gh180DirectReview20260910Mobile`.

- Treat candidates awaiting automatic application as analyzing until their episode completes automatic saving, including candidates whose individual comparison already completed or failed. Lock only those candidates and group writes containing them. After ordered analysis finishes, earlier completed episodes remain reviewable without canceling later results; during an active ordered run, saving candidate changes is temporarily refused with an explanation. If an open edit modal becomes locked after refresh, retain the draft and allow cancellation while disabling submission.

- Mobile review detail back-to-list actions use the same light secondary button treatment in both tabs: surface, border, primary-ink tokens, a minimum 44px touch height, and visible keyboard focus.

### GH180 자동 반영 기본값과 공개 체험 안내

랜딩의 일반 소개는 명확한 설정의 자동 반영과 필요한 항목의 직접 확인을 설명한다. 모든 내용을 작가가 확인한 뒤에만 저장한다고 안내하지 않는다. 8단계 예시와 공개 체험은 단일 회차에서 직접 검토를 선택한 흐름임을 명시하며 기존 단계·버튼·결과를 유지한다. 체험 완료에서는 실제 업로드의 자동 반영 기본값과 단일 회차의 전체 직접 검토 선택지를 구분해 알린다. 일반 소개 문구만 갱신하며 레이아웃·동작·원문·확정 예시는 바꾸지 않는다. Pencil 참고: `gh180LandingAutoCopy20260910`.

### GH199 늦은 검토와 내 이미지

과거 후보 편집은 이미 완료된 다른 회차를 바꾸지 않는다고 안내한다. 현재값 보호로 이력에만 저장되면 `현재 설정은 유지하고, 이 회차의 이력에 저장했습니다.`로 표시한다. 이미지 선택은 기존 밝은 테마와 버튼을 사용하며 보관용 코드 단계 없이 `이미지 올리기`를 제공한다. 기존 암호화 이미지는 교체 안내를 표시한다.

### GH215 Clear Blue 후보 검토

- `/setting-review`는 승인된 Clear Blue 시안의 밝은 파랑, 흰 카드, 진한 본문을 사용한다. 선택 카드와 확정 행동을 파랑으로 강조하며 현재 Theme V2 토큰을 재사용한다.
- 설정 제목 옆에 연결된 대상의 이미지를 표시한다. 신규·미상 대상은 세계관 장르/분류 기본 이미지 또는 캐릭터 중립 이미지를 사용하며 이름만으로 외형을 추측하지 않는다.
- 범위는 제목의 `범위 › 설정명` 문장 대신 별도 메타 정보로 표시한다. 새 설정에 불필요한 빈 기존값 패널을 만들지 않는다. 미비교·대상 미정·비교 실패를 기존 설정 없음으로 해석하지 않는다.
- 실제 반영 전후 변경은 빨강/초록과 −/+로, 미결정인 두 내용은 노랑과 A/B로 표시한다. 제외·이력·이동을 값 삭제로 표현하지 않는다. diff는 표현용이며 저장 문자열을 재구성하는 근거가 아니다.
- 각 선택 카드는 선택할 대상/반영 방식과 그 결과를 함께 보여 준다. 범위 포함 여부가 명확한 경우 예/아니오를 사용하고, 실제 계약에 없는 AI 추천 목록이나 시점 판정을 만들어내지 않는다.
- 캐릭터의 현재 반영·이력 선택 카드에는 `모두 확정할 때 적용`처럼 확정 시점을 반복하는 하단 띠를 두지 않는다. 제목·설명·결과와 선택 표시를 유지하고 확정은 그룹 하단에서 수행한다. `캐릭터 연결 변경`은 설정 제목의 `수정` 왼쪽에 배치하며, 새 인물 등록은 연결 모달에서 제공한다. 별도의 연결 작업 행은 만들지 않는다. 미상 인물의 직접 선택 카드는 유지한다.
- 일반적인 반영 선택은 카드 안에서 저장한다. 고급 수정은 유지하지만 별도의 형식적인 확인 클릭을 요구하지 않는다. 대상 연결과 내용·시점 판단을 구분하고 서버가 인정한 결정만 완료로 표시한다.
- 개별 행은 수정·제외를 제공하고 확정은 기존 그룹 단위를 유지한다. 미처리 기본 필터, 일부 후보가 숨겨진 그룹의 확정 제한, 최신 설정 보호, 이력 저장, 버전 검증을 보존한다.
- 원문·자세한 판단 근거는 펼치기 버튼을 갖춘 한 영역에 보존한다. 완료된 후보에는 과거의 확인 요청을 다시 행동 지시로 표시하지 않는다.
- 별도의 분석 진행 페이지를 만들지 않는다. 검토 중 잠금·중단 상태는 짧은 안내와 기존 분석 화면으로의 이동을 제공한다.
- 최소 320px에서 선택 카드는 세로로 배치하고 값 비교는 기존→새 내용 순서로 쌓는다. 키보드 포커스와 모바일 주요 조작 44px 높이를 유지한다.
- 랜딩의 검토 예시, 공개 체험, 최초 업로드 안내도 같은 사진 제목·diff·선택 카드 컴포넌트를 재사용한다. 안내용 캡처나 이전 검토 UI를 별도로 유지하지 않는다. 랜딩·최초 안내는 읽기 전용이고 공개 체험은 메모리 상태로만 동작한다.
- 최초 안내는 한 줄 5단계와 계정당 최초 노출 정책을 유지한다. 직접 검토 예시는 인물별 그룹 확정, 자동 반영 예시는 명확한 내용의 저장과 미상 대상의 남은 확인을 구분한다. 미상 인물을 기존 인물의 그룹에 합쳐 표시하지 않는다.

상태별 대응과 검증은 `docs/review-clear-blue.md`에 기록한다.

## GH219 사용자 검토와 업로드

현재·이력 선택을 저장해도 서버 캐릭터 그룹 식별자와 읽던 위치를 유지한다. 최종 현재 반영은 그 사이 캐릭터가 수정되어도 선택한 항목에 적용한다. 최종 결과 승인과 완료된 순차 분석 그룹에서 같은 항목을 여러 번 현재 반영하려 하면 현재로 남길 하나를 선택하게 한다. 구형 다회차 직접 검토는 회차 간 비교 체인을 유지한다. 후보 자체의 동시 수정·원문 변경 검증은 유지한다. 이 규칙은 이전의 명시적 사용자 확정에 대한 최신값·삭제 보호 우선 규칙을 대체하며 AI 자동 반영에는 적용하지 않는다.

확정된 REMOVE는 ‘현재 설정에서 제거됨’과 이전 내용·변경 이력 보존을 명시한다. 후보 제외와 이력에만 저장은 기존 의미를 유지한다. 복합 설정 편집은 이름·값을 두 줄로 놓고 근거·삭제 버튼을 오른쪽에 고정해 좁은 칸에서도 보이게 한다.

REMOVE 후보의 추출값은 회복·소생 등 이번 변화이므로 ‘제거한 내용’으로 부르지 않는다. ‘이번 원고에서 확인한 변화’로 표시하고, 순차 분석에서 보존된 비교 전 값이 있으면 ‘비교한 기존 설정’을 함께 표시한다. 과거 비교 전 값이 없는 응답에서 현재 snapshot을 제거 전 값으로 추측하지 않는다.

업로드의 모든 방식과 분리 확인에 ‘원고와 분석 결과는 AI 학습에 사용하지 않습니다.’를 짧게 표시한다. 다회차 여러 파일의 확인 목록은 번호순으로 정렬하고 수정 후 재정렬 버튼을 제공한다. 번호가 정상인 경우 추가 순서 경고나 확인창은 넣지 않는다.

분석 대기·진행 중에는 제목 아래에서 화면을 벗어나도 분석이 계속되며 진행 상황과 결과는 분석 목록에서 확인할 수 있다고 안내한다. 완료·중단·실패·상태 조회 오류 등 실제 진행 중임을 확인할 수 없는 상태에는 이 안내를 표시하지 않는다. 별도 확인창을 추가하지 않는다.

## GH223 장르별 캐릭터 분류명

스탯과 소지품은 모든 장르에서 같은 제목을 사용한다. 스킬 영역만 판타지 `스킬`, 무협 `무공·기예`, 나머지 장르 `기술·특기`로 표시한다. 현재 작품의 장르를 상세·편집·후보 검토·검색·이력에 동일하게 적용하고, 공개 판타지 예시는 장르를 명시한다. 작품의 설정명·원문과 세계관 중요 아이템은 보존한다. 프롬프트와 추출 범위는 장르에 따라 바꾸지 않는다.
