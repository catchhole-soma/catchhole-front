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

### Component: setting-review-group-action-bar

**Semantics:** Confirms the selected character or world-setting group from a bar that stays at the bottom of the review detail scroll area, states what the confirmation will do, and moves focus to the candidates that still need a decision.

- Anatomy: count line (`확정 가능 N · 이력 저장 H · 제외 E`, zero items omitted, `결정 필요 M` in warning ink), blocking reason line, optional secondary action (`다시 비교`), `다음 미결정 항목`, primary action, keyboard-shortcut toggle, status rows (confirmation error, unverified result); the selection bar stacks on top inside the same bar
- Variants: character tab, world-setting tab; primary label `확정하고 다음` when another unprocessed group remains in the tab, `모두 확정` for the last group, `확정 중…` while confirming
- States: default, hover, focus-visible, disabled, loading, error

- Interaction kind: interactive

#### State applicability

| State | Applicability | Reason |
|---|---|---|
| default | applicable |  |
| hover | applicable |  |
| focus-visible | applicable |  |
| disabled | applicable | Blocking candidates, hidden-candidate filters, automatic application or an unverified save keep the primary action `aria-disabled`; it stays focusable and its reason is linked with `aria-describedby`. |
| loading | applicable | The primary action reads `확정 중…` while the group confirmation request or its result check is in flight. |
| error | applicable | A responded confirmation error shows the server message below the buttons; a lost response shows the unverified-save row with check and retry. |
| success | not-applicable | Success moves to the next unprocessed group (focus on its title) or to the tab completion state instead of changing the bar. |

### Rules

- Keep the verified NHN Cloud CTA geometry as landing evidence rather than a universal application button system.

- Use `로그인 없이 체험하기` as the primary action in the header, hero, and closing CTA; free sign-up remains secondary.

- Accordion transitions must preserve keyboard focus, expose the active step, and honor reduced-motion preferences.

- Enable the setting-review completion action only when both character and world-setting summaries loaded successfully and all direct-review and processing counts are zero; otherwise keep it disabled and show the remaining count.

- On completion, replace the current route with `/dashboard?workId={workId}&nav=manuscripts` from either review tab, including direct URL entry.

- Automatically dismiss character-setting candidates whose comparison result is EXCLUDE, omit them from the default review queue, and preserve the confirmed current setting and history; do not apply this rule to world-setting candidates.

- Keep the setting-review group action bar sticky at the bottom of `.setting-review-main`; group cards clip with `overflow: clip` rather than `hidden` so they never become the sticky scroll container. At 650px and below, lay the action buttons and the selection-bar buttons out in two 44px columns and keep the stacked bar within roughly a third of a 320×568 viewport.

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
- Label the non-current comparison choice `이력에만 저장` and explain it as `회상이나 과거 상태처럼 현재 시점의 설정이 아닐 때 선택합니다. 예: ‘과거에는 용병이었다’는 타임라인에 남기되 현재 직업은 바꾸지 않습니다.` Within a review group, show the example sentence only on the first card that still needs a decision; other cards keep the first sentence.

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
- 캐릭터의 현재 반영·이력 선택 카드에는 `확정할 때 적용`처럼 확정 시점을 반복하는 하단 띠를 두지 않는다. 제목·설명·결과와 선택 표시를 유지하고 확정은 상세 하단의 고정 확정 영역에서 수행하며, 그 영역이 확정 가능/결정 필요 수와 막는 항목으로의 이동을 함께 제공한다. `캐릭터 연결 변경`은 설정 제목의 `수정` 왼쪽에 배치하며, 새 인물 등록은 연결 모달에서 제공한다. 별도의 연결 작업 행은 만들지 않는다. 미상 인물의 직접 선택 카드는 유지한다.
- 일반적인 반영 선택은 카드 안에서 저장한다. 고급 수정은 유지하지만 별도의 형식적인 확인 클릭을 요구하지 않는다. 대상 연결과 내용·시점 판단을 구분하고 서버가 인정한 결정만 완료로 표시한다.
- 개별 행은 수정·제외를 제공하고 확정은 기존 그룹 단위를 유지한다. 미처리 기본 필터, 일부 후보가 숨겨진 그룹의 확정 제한, 최신 설정 보호, 이력 저장, 버전 검증을 보존한다.
- 원문·자세한 판단 근거는 펼치기 버튼을 갖춘 한 영역에 보존한다. 완료된 후보에는 과거의 확인 요청을 다시 행동 지시로 표시하지 않는다.
- 별도의 분석 진행 페이지를 만들지 않는다. 검토 중 잠금·중단 상태는 짧은 안내와 기존 분석 화면으로의 이동을 제공한다.
- 최소 320px에서 선택 카드는 세로로 배치하고 값 비교는 기존→새 내용 순서로 쌓는다. 키보드 포커스와 모바일 주요 조작 44px 높이를 유지한다.
- 랜딩의 검토 예시, 공개 체험, 최초 업로드 안내도 같은 사진 제목·diff·선택 카드 컴포넌트를 재사용한다. 안내용 캡처나 이전 검토 UI를 별도로 유지하지 않는다. 랜딩·최초 안내는 읽기 전용이고 공개 체험은 메모리 상태로만 동작한다.
- 최초 안내는 한 줄 5단계와 계정당 최초 노출 정책을 유지한다. 직접 검토 예시는 인물별 그룹 확정, 자동 반영 예시는 명확한 내용의 저장과 미상 대상의 남은 확인을 구분한다. 미상 인물을 기존 인물의 그룹에 합쳐 표시하지 않는다.
- (#211 후속 1차, 2026-10-30) 단건 연결 뒤에도 작가가 보던 묶음·페이지·스크롤을 유지한다. 후보가 묶음을 떠나면 그룹 헤더 아래 중립 안내 `‘설정명’ 설정을 ‘인물’에 연결했어요.`와 `연결한 묶음 보기`·`닫기`를 보여 주고, 이동은 작가가 버튼으로 고른다. 이름 있는 묶음이 비면 직전 목록의 다음 미처리 묶음을 열고 같은 안내를 유지한다(미연결 묶음은 아래 완료 상태). 320px에서는 안내 버튼을 44px 높이로 세로 배치한다.
- (#211 후속 미연결 묶음 유지, 2026-10-31) 미연결(`미상`·빈 이름) 묶음에서 연결·제외해도 화면은 그 묶음에 머문다. 연결할 때마다 같은 중립 안내 제목 끝에 `(이번에 연결 N개 · M명)`을 붙이고 본문을 `이 묶음에서 계속 연결할 수 있어요. 옮긴 설정은 미연결 후보를 모두 정리한 뒤 인물별로 모아 볼 수 있어요.`로 바꾸며 `연결한 묶음 보기`·`닫기`는 유지한다. 묶음이 비면 상세의 그 자리에 흰 카드 완료 상태를 둔다: 성공 잉크 체크와 제목 `미연결 후보를 모두 정리했어요.`(h2, 묶음이 빈 직후에만 초점), `이번에 옮긴 설정 N개 · M명이에요. 인물 묶음에서 이어서 검토해 주세요.`, `옮긴 인물 묶음` 목록(행마다 인물 이름 · `옮긴 설정 N개` · 보조 버튼 `보기`, 접근 이름 `인물 묶음 보기`), 주 버튼 `다음 미처리 묶음`(열 묶음이 없으면 숨김, 다른 페이지를 찾는 동안 `다음 묶음을 찾는 중…`). 새로고침 뒤처럼 옮긴 기록이 없으면 목록 대신 `옮겨 간 설정은 왼쪽 목록의 인물 묶음에서 확인할 수 있어요.`를 쓴다. 다른 묶음에서 다시 연결한 설정은 새 인물 행으로 옮겨 센다. 미상 묶음이 다음 페이지로 밀렸는지 찾는 동안은 같은 카드에 `남은 미연결 후보 위치를 확인하고 있어요.`(status)를, 그 페이지를 읽지 못하면 경고 잉크 아이콘과 `남은 미연결 후보 위치를 확인하지 못했어요.`·`다른 페이지의 목록을 읽지 못했어요. 다시 시도하거나 왼쪽 목록에서 볼 묶음을 골라 주세요.`(alert)와 주 버튼 `다시 시도`를 둔다. `다음 미처리 묶음`이 다른 페이지에서 묶음을 찾지 못하면 카드 안에 `다음 미처리 묶음을 찾지 못했어요. 다시 누르거나 왼쪽 목록에서 골라 주세요.`(경고 잉크, alert)를 보인다. 버튼은 모두 44px이고 650px 이하에서는 이름 줄 아래로 버튼을 전체 너비로 세로 배치한다. 이름 있는 묶음의 다음 묶음 이동·확정 흐름은 바꾸지 않는다.
- 기존 연결이 아닌 `미상`·빈 이름 묶음은 `미연결 후보`, 제목 `인물 미확인`, 설명 `인물이 확인되지 않은 설정이에요. 같은 인물로 가정하지 않으니 설정마다 대상을 확인해 연결해 주세요.`, 사이드바 `미연결 후보 N개`, 카드 부제 `캐릭터 · 미연결`로 표현한다. `같은 캐릭터 후보`는 이름이 있는 묶음에만 쓴다.
- 저장 상태는 색만으로 전달하지 않고 문장으로 구분한다: 서버 저장 `저장했어요 · 확정 전까지 바꿀 수 있어요`, 요청 중 `저장 중…`, 응답을 잃은 선택 `저장 결과를 확인하지 못했어요` 경고와 자동 확인 진행(n/3), 끝내 확인하지 못하면 `최신 상태 확인`·`다시 시도`. 서버에 저장하지 않는 캐릭터 로컬 선택은 선택 카드 아래 한 줄 상태 `선택됨 · 확정할 때 적용`으로 표시한다(#211 후속 3차부터 확정 버튼 이름이 `확정하고 다음`/`모두 확정`으로 바뀌므로 문구에서 `모두`를 뺐다). 이는 선택 카드마다 반복하던 하단 띠(제거 유지)와 다르며, 작가가 고른 경우에만 한 번 나타난다.
- 그룹 확정 뒤에는 직전 목록 순서의 다음 미처리 그룹으로 이동하고 그룹 제목에 초점을 두며 상세를 맨 위에서 읽게 한다. 탭의 마지막 그룹이면 자동 탭 전환 없이 완료 상태와 다른 후보 검토 버튼을 보여 준다. 스크롤·초점 후보는 탭 왕복·새로고침·분석 목록 왕복 뒤 복원한다.
- (#211 후속 2차, 2026-10-31) 캐릭터 연결 모달의 검색은 `작품 전체에서 인물 검색`이다. 결과 행은 이름(검색어 일치 부분 강조) · `첫 등장 N화`(없으면 `첫 등장 정보 없음`) · 역할 · 대표 정보 순으로 쓰고, 같은 페이지의 동명은 `같은 이름 N명 — 첫 등장·역할로 구분` 배지로 구분한다. 결과 없음(status, `새 인물로 등록`), 검색 실패(alert, `다시 시도`, 입력 유지), 정보 없음(행 안 문장)을 서로 다른 문장과 role로 나누고 색만으로 구분하지 않는다.
- 연결 미리보기는 데스크톱에서 검색 목록 오른쪽, 760px 이하에서 목록 아래에 둔다. 모달 맨 위에 무엇을 연결하는지(`설정명 · 이번 값 · N화`, 선택이면 `선택 N개 · 회차 · 적용: 연결만`) 요약한다. 미리보기는 서버 비교가 아니므로 `대상에 저장된 현재 설정`·`이 설정의 기존값`이라고 부르고 `기존값 없음`(중립)과 `비교 정보를 불러오지 못했어요`(경고·다시 시도)를 구분한다.
- 대기 후보 카드 머리 왼쪽에 44px 체크박스(`선택: 설정명`), 묶음 머리에 `모두 선택(N)`을 둔다. 하나 이상 체크하면 확정 영역 맨 위에 파란 테두리 선택 바(`N개 선택 · 회차`, `선택 항목 연결`/세계관 `선택 항목 대상 연결`, `선택 해제`)를 함께 고정하고, 필터로 숨을 수 있으면 그 사실을 한 줄로 알린다. 320px에서는 선택 바 버튼을 44px 높이로 세로 배치한다. 한 번에 100개(세계관은 원문 수)를 넘게 체크하면 선택 바에 `한 번에 100개까지 연결할 수 있어요. 선택을 줄여 주세요.`(alert)를 띄우고 연결 버튼을 잠근다. 선택 연결이 거절된 카드는 danger 테두리·`aria-invalid`·서버 문장으로 표시한다. 미연결 묶음에는 묶음 전체 `캐릭터 일괄 연결`을 두지 않는다.
- 세계관 선택 대상 연결의 미리보기는 대상의 분류·이름·설정 수·저장된 설정 상위 5개와 체크한 행마다 `기존값 없음 → 추가로 저장` 또는 `기존값 있음 → 병합/교체 결정 필요`(경고 잉크)를 보여 준다. 결정으로 남긴 행에는 `대상은 골랐어요. 기존값과 어떻게 합칠지 정해 주세요.`와 기존 병합/교체 카드를 연다.
- (#211 후속 3차, 2026-10-31) 묶음 확정은 상세 스크롤 영역 하단에 붙는 고정 확정 영역(`setting-review-group-action-bar`)에서 한다. 왼쪽에 `확정 가능 N · 이력 저장 H · 제외 E`(0 생략)와 경고 잉크의 `결정 필요 M`, 막는 이유 한 줄을, 오른쪽에 `다음 미결정 항목`과 주 버튼을 둔다. 주 버튼은 같은 탭에 열 묶음이 남으면 `확정하고 다음`, 마지막 묶음이면 `모두 확정`이며 요청은 기존 그룹 확정 그대로다. 확정 뒤에는 직전 목록 순서의 다음 미처리 묶음 제목으로 가고, 마지막 묶음 뒤에는 자동 탭 전환 없이 완료 상태에 `세계관(캐릭터) 후보 N개가 남았어요`와 기존 이동 버튼을 둔다. 막힌 주 버튼은 `aria-disabled`로 초점을 받고 이유를 `aria-describedby`로 잇는다. 같은 문장의 경고가 위에 이미 있으면(세계관 중복·충돌·필터·미저장·설정집 선택·결과 확인) 문장을 되풀이하지 않고 그 경고에 잇는다. 선택 바는 같은 영역 맨 위에 쌓고, 650px 이하에서는 버튼을 두 칸(44px)으로 놓으며 선택 중에는 이유 문장을 접는다. 세계관의 이동 안내·순차 분석 영향 안내는 고정 영역 위 일반 흐름에 둔다.
- 결정이 끝난 대기 카드는 처음 열 때 한 줄 요약(설정명, 반영 방식 · 최종값 한 줄, 배지 `저장했어요`/`제외 예정`/`선택됨 · 확정할 때 적용`/`연결됨`, `펼치기`)으로 접는다. 요약에서도 체크박스와 `캐릭터 연결 변경`·`수정`·`제외`를 유지하고 펼치면 원문·근거를 그대로 보며 `접기`로 되돌린다. 막는 후보·저장 중·결과 미확인·오류·값 오류·자동 반영 대기·묶음에서 대상만 고른 행은 항상 펼친다. 이 화면에서 방금 고른 카드는 펼친 채 둔다.
- 반복을 줄인다: `이력에만 저장` 예문은 묶음의 첫 미결정 카드에만, 근거 끝의 연결 상태 줄은 제목 줄에 연결 상태가 드러나지 않을 때만 둔다. 연결이 모호한 캐릭터 후보의 인라인 인물 선택은 등록 인물 3명 + `새로운 인물` + `검색으로 찾기`(원문 표현을 검색어로 넣은 작품 전체 검색)다. 세계관 묶음에 대상 미정 행이 둘 이상이면 행마다 검색 목록을 펼치지 않고 이번 검토에서 고른 대상(최대 3) + 새 등록 + `대상 검색`을 먼저 보여 준다.
- 키보드: 상세 패널에서 `Alt+↓/↑` 다음·이전 설정 카드, `Alt+Shift+↓/↑` 다음·이전 묶음(페이지 경계는 옆 페이지의 첫·마지막 묶음), `Alt+Enter` 주 버튼으로 초점(실행하지 않음), `Alt+.` 다음 미결정 항목. 글자 입력 컨트롤·선택 메뉴·한글 조합 중·모달이 열린 동안에는 동작하지 않는다. 선택 카드는 radiogroup이며 Tab 한 번으로 들어와 방향키로 초점만 옮기고 Space·Enter로 고른다. 확정 영역 끝 `단축키` 버튼이 네 줄 안내를 열고 Esc로 닫는다(768px 이하에서는 숨김). 세계관 수정 창도 Esc로 닫히고 연 버튼으로 초점이 돌아온다.

상태별 대응과 검증은 `docs/review-clear-blue.md`에 기록한다.

## GH219 사용자 검토와 업로드

현재·이력 선택을 저장해도 서버 캐릭터 그룹 식별자와 읽던 위치를 유지한다. 최종 현재 반영은 그 사이 캐릭터가 수정되어도 선택한 항목에 적용한다. 최종 결과 승인과 완료된 순차 분석 그룹에서 같은 항목을 여러 번 현재 반영하려 하면 현재로 남길 하나를 선택하게 한다. 구형 다회차 직접 검토는 회차 간 비교 체인을 유지한다. 후보 자체의 동시 수정·원문 변경 검증은 유지한다. 이 규칙은 이전의 명시적 사용자 확정에 대한 최신값·삭제 보호 우선 규칙을 대체하며 AI 자동 반영에는 적용하지 않는다.

확정된 REMOVE는 ‘현재 설정에서 제거됨’과 이전 내용·변경 이력 보존을 명시한다. 후보 제외와 이력에만 저장은 기존 의미를 유지한다. 복합 설정 편집은 이름·값을 두 줄로 놓고 근거·삭제 버튼을 오른쪽에 고정해 좁은 칸에서도 보이게 한다.

REMOVE 후보의 추출값은 회복·소생 등 이번 변화이므로 ‘제거한 내용’으로 부르지 않는다. ‘이번 원고에서 확인한 변화’로 표시하고, 순차 분석에서 보존된 비교 전 값이 있으면 ‘비교한 기존 설정’을 함께 표시한다. 과거 비교 전 값이 없는 응답에서 현재 snapshot을 제거 전 값으로 추측하지 않는다.

업로드의 모든 방식과 분리 확인에 ‘원고와 분석 결과는 AI 학습에 사용하지 않습니다.’를 짧게 표시한다. 다회차 여러 파일의 확인 목록은 번호순으로 정렬하고 수정 후 재정렬 버튼을 제공한다. 번호가 정상인 경우 추가 순서 경고나 확인창은 넣지 않는다.

분석 대기·진행 중에는 제목 아래에서 화면을 벗어나도 분석이 계속되며 진행 상황과 결과는 분석 목록에서 확인할 수 있다고 안내한다. 완료·중단·실패·상태 조회 오류 등 실제 진행 중임을 확인할 수 없는 상태에는 이 안내를 표시하지 않는다. 별도 확인창을 추가하지 않는다.

## GH223 장르별 캐릭터 분류명

스탯과 소지품은 모든 장르에서 같은 제목을 사용한다. 스킬 영역만 판타지 `스킬`, 무협 `무공·기예`, 나머지 장르 `기술·특기`로 표시한다. 현재 작품의 장르를 상세·편집·후보 검토·검색·이력에 동일하게 적용하고, 공개 판타지 예시는 장르를 명시한다. 작품의 설정명·원문과 세계관 중요 아이템은 보존한다. 프롬프트와 추출 범위는 장르에 따라 바꾸지 않는다.

## GH260 가족 관계 목록과 후보 확인

작품 설정의 `가족 관계` 탭은 밝은 Theme V2 표면과 의미 토큰을 사용한다. 상단 처리 안내, 가족 관계 목록/확인 필요 두 보기, 인물 이름·관계·시점·유효성 카드, 현재 설정/원문 근거, 후보 수정 폼으로 구성한다. 모바일에서는 native 보기 select와 한 열 폼·44px 액션을 사용한다. 대기 집계는 설정 검토와 분리하고, 최신 처리 개수와 현재 대기 개수를 구분한다. 모호한 이름은 인물 페이지에서 직접 고르고 저장 후 반영한다. 오류와 근거 변경 시 입력을 유지하며 현재 근거는 명시적 선택으로 바꾼다. 그림 가계도는 GH261 범위다. Pencil MCP 연결 실패로 활성 프레임 동기화는 `design/PENCIL_MIGRATION.md`에 대기로 기록한다.

## GH261 가계도

2026-10-21 공개 결정에 따라 관계 화면은 기본 ON이다. `VITE_RELATIONSHIP_WORKSPACE_ENABLED`가 정확히 문자열 `false`이면 OFF이며 미설정·빈 문자열·그 외 값은 ON이다. ON의 `가계도` 종류 안에서는 가계도·목록·확인 필요 세 보기를 제공하고 기본 내부 보기는 가계도다. 관계도 메뉴 전체의 기본 종류와 탭 순서는 아래 2026-10-30 진입 정책을 따른다. 밝은 Theme V2 캔버스에서 인물 이름과 가족 구조를 우선한다. 관계마다 인물 카드 크기의 설명 상자를 반복하지 않는다. 확인된 배우자는 같은 행의 가로선으로 잇고, 그 부모 조합의 자녀는 가운데에서 내려온 한 줄과 자녀 분기선으로 표시한다. 배우자가 확인되지 않은 공동 부모는 카드 아래의 별도 합류선을 사용하며 혼인을 추정하지 않는다.

같은 부모의 확인된 형제 관계는 부모 묶음에 포함하여 중복 선을 줄이고, 부모 미상 형제나 이복 관계 등은 별도 선을 유지한다. `배우자`, `자녀 2명`, `입양`, `과거`처럼 짧은 표기를 선 위에 두고, 세부 유형과 각 인물 쌍의 근거는 연결 선택 후 목록에서 읽는다. 저장 관계 ID는 합치거나 버리지 않는다. 이름은 두 줄까지 허용하고 화면 확대·이동은 주기 조회마다 초기화하지 않는다. 320px에서는 보기 선택과 확대/축소/전체 보기·목록 대안을 제공한다. 2026-10-19 사용자의 가시성 교정으로 이전 큰 관계 라벨 배치를 대체하며, Pencil 연결이 복구되면 같은 화면과 흐름을 동기화한다.

### GH261 설정에서만 언급된 가족

현재 프로필에 명시된 이름을 가진 미등록 상대도 서버가 표시 가능하다고 판단하면 가계도에 표시한다. 카드와 근거의 상태에는 `프로필 미등록`을 표시하고 클릭하면 현재 설정·원문 근거를 연다. 등록 캐릭터의 프로필 모달과 구분하고 임의의 프로필·이미지를 만들지 않는다. 인물 연결은 선택 사항이며 근거 영역의 `프로필 연결`에서 기존 인물을 직접 선택한 뒤 `프로필 연결하기`로 반영한다. 같은 이름만으로 언급 노드를 합치거나 뒤늦게 등장한 캐릭터에 자동 연결하지 않는다. 가계도·목록과 함께 후보 보기는 `확인·연결`로 표현하고 필수 확인과 선택적 연결을 구분한다. 근거 변경·보관·제외로 표시 자격이 사라지면 예전 가계도 그림을 그대로 남기지 않는다.

### GH261 간결한 안내와 구분된 캔버스

가계도 상단에는 현재 표시된 인물·관계 수와 접힌 `가계도 안내`를 한 줄로 놓는다. 확인·연결 탭과 중복되는 액션·건수, 긴 상시 설명은 제거하고 범례·조작 방법·선택적 연결 설명은 안내를 펼쳐 읽는다. 안내의 선택적 연결 건수는 작품 전체 기준이며 보이는 노드 수로 추측하지 않는다. 캔버스는 `--ch-surface` 흰 표면과 `--ch-border`의 옅은 점 격자로 외부 `--ch-canvas`와 구분하며 선 위 라벨도 같은 흰 표면을 사용한다. 도움말은 320px에서도 화면 안에 놓고 키보드로 접고 펼칠 수 있게 한다.

### GH261 선 양끝의 가족 호칭

부모·자녀 연결은 각 인물 쪽 끝에서 역할을 읽는다. 서버가 현재 유효한 관계 근거에서 명시적으로 확인한 `아버지·어머니`, `아들·딸`만 구체적으로 표시하고, 없는 값이나 상충하는 값은 `부모·자녀`로 유지한다. `얀델의 아들`로 얀델의 성별을 추측하지 않으며 이름·좌우 위치로 호칭을 정하지 않는다. 단일 자녀 선의 중앙 `자녀 1명`은 양끝 호칭으로 대체하고 입양·과거 같은 정보는 보존한다. 여러 인물이 공유하는 선에서는 인물별 끝점에 한 번씩 표시하고 그 호칭에 관련된 근거만 연다. 배우자선과 부모 역할을 구분하고 기존 가족 구조·관계 ID·키보드 탐색을 보존한다.

### GH261 기존 프로필 이미지

등록된 인물에 표시할 프로필 이미지가 있으면 가계도 카드에도 같은 썸네일을 원형으로 표시한다. 이미지 없음·공통 기본·조회 실패와 설정에서만 언급된 인물은 기존 기본 인물 아이콘을 유지한다. 개인 이미지는 기존 인증된 이미지 조회와 세션별 정리를 재사용한다. 작은 화면에도 등록 인물의 사진과 이름을 함께 보여 주고, 사진만 바뀌었을 때 가족 배치·확대·이동 위치는 유지한다.

### GH261 가족 근거와 확인을 사용자 행동으로 구분

GH215의 필요한 질문 → 결과를 알 수 있는 선택 → 명시적 반영 원칙을 가족 관계에 적용한다. 후보 편집은 두 인물의 관계 그림 → 필요한 선택 → 자세한 근거 순서로 읽고, 실제 가족 설정은 그림 아래의 짧은 보조 정보로 남긴다. `확인·연결` 목록의 현재 페이지를 `확인할 가족 관계`와 `가족 프로필 연결`로 나누고, 연결에는 별도의 `선택 사항` 표기를 둔다. 전체 집계나 페이지를 클라이언트에서 다시 계산하지 않는다. `displayableAsMention`은 표시 자격이며 현재 초점·시점 범위에서 실제 표시 중이라는 뜻으로 안내하지 않는다.

후보 목록은 큰 독립 카드 대신 흰 목록 안의 구분선으로 행을 나눈다. 상대 이름을 먼저 강조하고 그 아래에 `비요른의 부모`처럼 기준 인물과의 관계를 쓴다. 이름 사이의 가운뎃점, `자녀 → 부모` 같은 방향 메타 정보와 반복되는 현재 관계 표기를 제거한다. 과거·시점 설명·입양 등 의미가 다른 정보는 짧은 보조 표기로 보존한다. 필수 확인 행은 `관계 확인`과 기존 사유를 함께 표시해 확정된 가족 관계로 읽히지 않게 한다. 각 행 전체를 하나의 버튼으로 만들고 이름·관계·다음 행동이 함께 읽히게 하며, 목록 복귀 시 실행한 행으로 초점을 돌린다. 완료로 사라진 행은 목록 제목이나 현재 보기 조작으로 복귀한다. 성공한 최근 처리 결과는 가계도·가족 관계 목록·확인·연결 모든 보기에서 표시하지 않는다. 접힌 성공 요약도 두지 않으며 처리 중·실패·미처리 안내와 조회 오류는 유지한다.

확정 가족 관계 목록도 같은 흰 목록과 구분선을 사용하되 두 인물의 이름을 같은 크기와 강조로 표시한다. 부모는 왼쪽, 자녀는 오른쪽에 놓고 각 이름 위에 `부모`·`자녀`를 표시한다. `CHILD_OF`는 응답의 인물 순서를 바꿔 같은 방향으로 읽히게 하고, 배우자·형제자매는 동등한 두 이름 사이에 관계를 표시한다. 이름과 연결 표시는 내용 폭에 맞춰 가까이 묶고 양쪽을 같은 비율로 넓히지 않는다. 긴 이름은 사용 가능한 폭에서 줄바꿈하며 모바일에서도 인물 순서와 관계 표기를 유지한다. 별도 메타 정보 줄에서 `반영됨`·현재 설정 확인 필요·보관·철회를 구분한다. 정상 유효 관계가 아닌 항목은 `관계 기록`을 붙여 현재 사실로 단정하지 않는다. 현재 시점은 반복하지 않지만 과거·시점 설명·세부 유형은 유지한다. 목록 밖 직접 링크와 가계도에서 선택한 관계에도 동일한 요약을 사용하며 API에 없는 사진·성별은 추정하지 않는다.

행 전체의 `근거 보기`를 누르면 바로 아래에 설정 → 출처 → 실제 원문 인용을 펼친다. 이때 기존 Fact 근거 API를 조회하며 추가 버튼을 눌러야 인용이 나오는 중첩 카드는 사용하지 않는다. 설정과 인용은 같은 흰 표면에 평평하게 놓고, 작은 `전체 원문 보기`로 기존 원문 모달을 연다. 현재 설정의 구조화 값·충돌 표시와 이전 근거 상태를 보존하고 로딩·실패·빈 인용을 구분한다. 관계를 접으면 펼친 근거도 닫는다. 잘못된 확정은 `이 연결 삭제` → 영향 확인 → `삭제하기`로 취소한다. 프로필 설정과 원문은 유지하고 가계도 연결을 제외하며, 같은 관계를 자동 정리로 다시 생성하지 않고 검토 대상으로 보류한다. 작품 속 이혼·관계 종료와는 구분한다.

미등록 인물 근거는 이름·상태, 방향을 지킨 관계 문장, 실제 가족 설정, 접힌 원문 근거 순으로 읽는다. `프로필 연결`과 `관계 내용 수정`을 분리한다. 가족 판단은 두 인물 그림 아래 한 곳에서 제공한다. 명시된 가족 후보는 짧은 상태와 `판단 변경`을 표시하고, 불확실·비유·부정·상충 후보는 선택 영역을 처음부터 펼친다. 어느 경로든 `실제 가족이에요`·`가족이 아니에요`·`아직 모르겠어요`의 같은 선택지를 사용하고 `판단 저장`으로 반영한다. 프로필만 없다는 이유로 가족 여부를 다시 묻지 않는다. 시점 미상은 필요한 입력을 직접 보여 주며 나머지 세부 수정은 접는다. 완료·제외 상태에는 이전 판단 질문을 남기지 않는다.

후보 편집의 두 인물 그림은 부모를 위, 자녀를 아래에 두고 배우자·형제는 같은 높이로 잇는다. 후보 API의 관계 방향만 사용하고, 성별 호칭은 추정하지 않는다. `관계 미리보기` 제목은 생략하고 편집 중에만 `저장 전`을 표시한다. 의미가 불확실하면 같은 배치를 유지하되 점선·`확인 필요`·`검토할 관계`로 구분한다. 등록된 기준 인물은 읽기 전용 카드로, 연결할 프로필이 없는 상대는 `프로필 미등록`인 버튼 카드로 표시한다. 넓은 부모·자녀 그림에서는 상대 카드 오른쪽에 `← 캐릭터를 연결하려면 클릭` 안내를 두고, 좁은 화면이나 배우자·형제 그림에서는 화살표 없이 카드 안에 안내한다. 이미 선택한 프로필에는 `연결할 캐릭터를 바꾸려면 클릭`을 표시하며 조작할 수 없는 상태에는 클릭 안내를 숨긴다. 카드나 안내를 눌러 실제 인물 목록을 열고, 선택·닫기 뒤 그 카드로 초점을 돌린다. 인물 선택 목록의 보조 정보는 `첫 등장 N화`로 통일하고, 회차가 없으면 `첫 등장 회차 미확인`을 표시한다. 선택한 프로필은 `연결할 프로필 · 저장 전`으로 표시하며 카드 선택만으로 저장하지 않는다. 별도 `상대 인물` 행과 중복 관계 요약·장문 안내는 반복하지 않는다. 320px에서도 인물 이름과 상태를 함께 읽고 조작할 수 있게 한다.

`판단 저장`은 가족이면 `ASSERTED`, 아직 모르면 `UNCERTAIN`으로 저장하고 후보를 유지한다. 가족이 아니면 기존 후보 제외를 실행한다. 불확실 판단은 실제로 저장되어 재진입에도 유지되며 가계도에서 제외된다. 가족 판단을 저장해도 프로필을 자동 연결·확정하지 않으며, 다른 표시 조건까지 서버가 검증한 결과만 따른다. 미저장 프로필·관계·시점은 판단 저장에 포함하지 않고 화면에 보존한다. 근거는 사용자가 명시적으로 선택한 최신 토큰만 사용할 수 있다. 판단 선택 중에는 다른 저장·반영을 잠그며 `선택 취소`는 판단 선택만 되돌린다. 목록 복귀는 저장하지 않는다.

판단을 마친 뒤 연결한 대상이 있으면 `프로필 연결하기` 또는 `가계도에 반영하기` 한 번으로 필요한 수정 저장과 관계 확정을 이어간다. `변경사항 저장`은 접힌 수정 영역에서 제공한다. 저장 뒤 확정 실패는 부분 성공을 알리고 저장된 버전으로 재시도한다. 기존 API·근거 토큰·동시 변경·인증 보호와 추가 LLM 없음 원칙을 유지한다. 화면 노출은 위의 기본 공개·명시적 OFF 정책을 따른다.

`관계 내용 수정`을 펼치면 상대 이름과 `기준 인물에게 어떤 가족인가요?` 질문을 먼저 읽는다. 관계 선택은 `부모`·`자녀`·`배우자`·`형제자매`처럼 상대의 역할로 표현하고 저장 enum의 방향을 유지한다. 원문에 나온 이름, 가족의 세부 관계, 관계 시점을 목적별로 나누며 `변경사항 저장`을 별도 영역에 둔다. 다섯 가지 내부 판단값의 `서술의 의미` 선택창은 제거하며 후보 제외도 공통 가족 판단 영역으로 통일한다. 현재 설정 다시 확인은 별도의 근거 복구 행동으로 유지한다.


### GH261 성공 안내 제거와 원문 근거의 일관된 펼침

성공한 관계 정리의 결과 안내와 최근 실행 건수는 어느 보기에서도 노출하지 않는다. 현재 확인·연결 건수, 처리 중·실패·아직 처리하지 않은 상태, 조회 오류와 실패 재시도는 유지한다. 화면에서 성공 요약을 없애더라도 자동 처리와 갱신 감지는 유지한다.

후보 편집과 미등록 인물 근거에서도 `원문 근거`를 펼치면 출처와 저장된 인용문이 바로 나온다. 닫힌 상태에서는 인용 조회를 시작하지 않으며, 펼친 안에 다시 근거 버튼이나 같은 현재 설정 카드를 만들지 않는다. 현재 설정은 위쪽의 기존 위치에서 한 번만 읽고, 구조화된 값의 충돌·추가 속성은 보존한다. 펼친 원문에는 이전 근거 경고, 원문 없음, 불러오는 중·실패·재시도를 유지하며 필요한 경우 작은 `전체 원문 보기`로 기존 모달을 연다. 확정 관계·후보·미등록 인물 모두 같은 인용 표현을 사용한다.

삭제 행동은 `이 연결 삭제`와 확인 단계의 `삭제하기`로 짧게 표시하고, 처리된 관계는 `삭제된 연결`로 구분한다. 이 행동은 가계도 연결을 제거하며 두 인물의 프로필 설정과 원문을 삭제하지 않는다. 기존 철회 기록과 같은 관계의 자동 복원 보류 정책을 유지하고, 실제 작품 속 관계 종료와 구분한다.


### GH261 관계 수정 행동의 가독성

펼친 관계 수정의 저장은 `변경사항 저장`으로 짧게 표시하고 진한 primary-ink 배경의 주 행동으로 구분한다. 편집 입력과 왼쪽 기준선을 맞춘다. `설정이 바뀌었나요?`와 상시 `최신 설정 불러오기` 버튼은 제공하지 않는다. 편집 진입과 변경 감지 시 최신 후보·근거를 자동 조회하고, 조회 실패 안내 안에서만 `다시 시도`를 제공한다.

저장·재시도 버튼은 14px/600, 44px 이상의 높이와 명확한 키보드 초점을 갖고 활성 텍스트는 4.5:1 이상의 대비를 유지한다. 비활성도 글자가 투명해지지 않도록 중립 배경·본문 대비로 구분한다. 320px에서는 버튼을 가득 채운 한 열로 배치한다.

자동 조회는 입력·가족 판단·선택한 근거를 덮어쓰지 않는다. 다른 곳에서 후보가 수정되면 최신 내용을 보여 주고 저장을 잠근다. `변경 내용 확인`은 이미 조회한 최신 기준을 명시적으로 받아들이는 행동이며, 사용자가 수정한 필드는 유지하고 수정하지 않은 필드만 최신값으로 맞춘다. 바뀐 근거는 별도로 직접 선택해야 한다. 정상 상태에는 `근거 선택` 버튼과 선택 목록을 표시하지 않고, 기존 근거가 변경·누락되거나 선택한 인물의 근거가 아닐 때만 필요한 확인 영역을 드러낸다. 확인을 시작한 영역은 선택·제거 후에도 유지하여 되돌릴 수 있고, 저장 성공 후 문제가 해결되면 숨긴다. 조회·확인만으로 저장·확정·분석을 실행하지 않는다.


### GH261 관계도 종류와 활성 탭 — 2026-10-20 당시 기록

아래의 초기 순서·업데이트 예정 상태는 과거 기록이다. 현재 탭 활성화·순서·기본 진입은 GH323과 2026-10-30 정책을 따르며 선택 스타일은 유지한다.

별도 `관계도` 제목 없이 `가계도 / 인물 관계도` 종류 탭으로 시작한다. 가계도만 사용 가능하며 인물 관계도에는 `업데이트 예정`을 표시하고 비활성으로 둔다. 새 종류나 URL 상태를 임의로 구현하지 않는다. 내부의 가계도·가족 관계 목록·확인·연결은 기존 보기·초안·조회 동작을 유지한다. 선택된 종류는 `--ch-surface`의 흰 배경과 위쪽 두 모서리만 8px 둥글게 표시하고 파란 글자와 밑줄을 유지한다. 내부 보기에는 흰 배경을 넣지 않고 파란 글자와 밑줄로 선택을 구분한다. 종류 탭은 더 큰 글자와 높이로 구분하며 `현재는 부모·자녀…` 설명은 제거한다. 인물 디렉터리 버튼과 검색 안내는 `특정 인물 중심으로 보기`를 사용한다. 종류 선택은 320px에서도 두 열 안에 표시하고 예정 배지는 줄바꿈한다. 내부 보기의 모바일 native select와 44px 조작·키보드 초점은 유지한다.

### GH261 설정집으로 가계도 채우기 안내

가계도 검색 도구 위에 `설정집으로 가계도를 채워 보세요`와 `가족 관계를 적은 설정집을 분석하면, 확인된 관계가 가계도에 반영돼요.`를 짧게 표시한다. `설정집 업로드하기`는 같은 작품의 기존 설정집 업로드 모달로 이동한다. 빈 가계도와 기존 가계도 모두에서 제공하며 320px에서는 안내 아래에 전체 너비 버튼을 놓는다. 모든 문장이 즉시 관계가 된다고 약속하지 않고 기존 명시적 관계·검토 정책을 유지한다.

### GH261 과거 관계 필터와 뒤로가기

`과거 관계 포함`은 기본 체크박스 대신 44px 이상 높이의 둥근 토글 버튼으로 표시한다. 선택 상태는 파란 테두리·옅은 배경·체크 아이콘과 `aria-pressed`로 함께 전달하며 클릭·키보드로 전환한다. 가족 후보 편집의 뒤로가기는 화살표를 텍스트 앞에 두어 `← 후보 목록`, `← 근거로 돌아가기` 순서로 읽힌다.

### GH261 검색 결과와 중심 인물 강조

검색어에 맞는 인물과 선택한 중심 인물은 진한 `--ch-primary-ink` 배경·흰 글자·바깥 테두리로 강조한다. 기존 보조 문구 자리에서 `검색 결과` 또는 `중심 인물`을 표시하고 접근성 설명에도 같은 상태를 제공한다. 프로필 미등록 인물은 검색 강조 중에도 미등록 표기와 점선 테두리를 유지한다. 검색을 비우면 검색 강조만 해제하고 `작품 전체 보기`는 검색과 중심 인물을 함께 해제한다. 카드 크기·가족 배치·확대와 이동 위치를 강조 때문에 변경하지 않는다.

### GH261 명시된 조상·후손 관계 — 2026-10-20

명시된 `ANCESTOR_OF`·`DESCENDANT_OF`는 `조상`·`후손`으로 표시한다. 직접 부모·자녀와 구분하며 부모·자녀 호칭으로 바꾸지 않는다. 후보 그림은 조상을 위, 후손을 아래에 두고 확정 요약은 조상을 왼쪽에 놓는다. 실제 두 인물만 표시하고 중간 부모·인물·혼인 관계를 만들어 넣지 않는다.

서버의 nullable `generationGap`이 있으면 `N대손`, 없으면 `세대 차이 미상`으로 표시한다. 원문의 수치를 프론트에서 추측하거나 기본값으로 채우지 않는다. 후보 그림은 점선과 `중간 계보 생략`으로 직접 부모 연결과 구분하고, 목록·근거 요약도 같은 생략 표기를 사용한다. 이 표기는 해당 연결이 중간 인물을 표시하지 않는다는 뜻이며 작품 전체에 중간 계보가 없다고 단정하지 않는다. 원래 가족 설정과 원문 인용은 그대로 보존한다.

관계 수정에서 상대의 `조상`·`후손` 역할을 선택하고, 이 관계에만 선택 입력인 `대손 수`를 제공한다. 1 이상의 정수만 저장하며 비워 두면 미상이다. 다른 관계 종류로 바꾸면 세대 수를 비운다. 가족 판단 저장은 기존 세대 수를 사용하고 미저장 관계·세대 수는 별도 초안으로 유지한다. 근거·버전 확인과 추가 LLM 없음 원칙을 유지한다. 화면 노출은 위의 기본 공개·명시적 OFF 정책을 따른다.

혼합 가계도에서는 자녀·3대손·5대손의 순서를 높이로 구분한다. 실제 인물이 없는 세대는 압축하되 명시된 차이는 관계 라벨에 남기고, 3대손에서 5대손으로 계보를 추측해 잇지 않는다. 세대 간격을 모르는 관계로만 연결된 인물은 부드러운 배경의 `세대 미상` 옆 영역에 둔다. 조상 선은 직접 자녀 묶음 바깥으로 돌려 부모·자녀처럼 보이지 않게 하며 각 선의 근거를 유지한다. 영역 배경은 `--ch-surface-soft`, 경계는 `--ch-border-strong`, 제목은 `--ch-ink`를 사용한다.

### 미등록 인물의 명시적 묶기 — 2026-10-20

미등록 인물 근거 패널에 `같은 인물로 묶기`를 제공한다. 선택 목록은 같은 이름을 자동으로 선택하지 않고 `누구의 어떤 관계인지`를 함께 표시한다. 선택된 각 관계의 두 인물과 현재 설정·접힌 원문 근거를 보여 준 뒤 사용자가 저장한다. 정상 화면의 설명은 짧게 유지하고, 조회 버튼은 충돌·실패로 근거 확인이 필요한 때에만 제공한다.

묶인 노드는 프로필 미등록 상태를 유지한다. 클릭한 패널에서 각 관계를 선택해 근거를 읽고 `묶기 해제`로 다시 분리한다. 개별 관계를 수정·판단·연결하면 그 관계만 분리됨을 저장 전에 안내한다. 선택 입력과 버튼은 Theme V2 색상·44px 조작 높이를 따르고 320px에서 한 열로 줄바꿈한다. 중간 인물이나 새 프로필을 생성하지 않는다.

### GH323 회차별 인물 관계도 — 2026-10-29

사용자의 구현 승인에 따라 `인물 관계도` 종류 탭을 활성화한다. 2026-10-30 교정으로 탭은 왼쪽 `인물 관계도`, 오른쪽 `가계도` 순서이며 일반 관계도 진입의 기본은 인물 관계도다. 기존 가계도 기능과 가족 상세 링크는 유지한다. 인물 관계도는 회차 선택 → 인물과 짧은 관계 선 → 선택한 두 인물의 설명과 실제 인용 순서로 읽힌다. 최신 분석 회차를 기본으로 하며 과거 회차에는 당시 드러난 정보만 보여 준다. 현재 프로필로 이동하거나 현재 이미지를 가져와 미래의 정체를 노출하지 않는다.

흰 캔버스 안에서 인물을 이름 카드로 표시하고 일방 태도는 한 방향, 상호 관계는 양방향, 방향 없는 관계는 일반 선으로 구분한다. 상세에서는 두 사람 이름을 같은 크기로 보여 준다. 선택한 인물은 파란 배경으로 강조한다. 관계 설명과 원문 인용은 같은 평평한 표면에서 바로 읽으며 근거 버튼을 중첩하지 않는다. 별도 애매함 판단·확정 큐와 검토 건수를 표시하지 않는다.

설명 수정과 잘못된 연결 삭제는 근거 아래의 선택적 행동이다. 이야기 속 상태 변화와 분석 오류 정정을 구분하며 전체 회차에 적용되는 영향을 저장 전에 짧게 알린다. 320px에서는 도구를 한 열로 정리하고 관계 목록으로도 모든 연결의 근거를 열 수 있게 한다. 상세 계약은 `docs/episode-relationships-ui.md`를 따른다.

## 일반 설정의 원문 근거 표시 (2026-10-29)

캐릭터·세계관 설정은 인용 위치가 없거나 분석 당시 원문과 맞지 않아도 설정값을 유지한다. 서버가 검증한 인용만 공개하며, 원문을 함께 받은 화면에서도 코드 포인트 위치와 해당 구간의 일치를 확인한다. 잘못된 인용을 저장된 인용 박스로 다시 표시하지 않는다. 정상 인용이 함께 있으면 정상 인용만 표시하고, 모두 숨겨지면 기존 빈 상태에서 `표시할 원문 근거가 없습니다.`만 안내한다. 새로운 검토 단계나 경고 패널을 추가하지 않는다.

### GH323 복수 관계와 인물 이동 — 2026-10-29

같은 두 사람 사이의 여러 선은 라벨의 공간과 카드 경계의 연결점을 나누어 첫 화면부터 구분한다. 라벨은 최대 두 줄로 제한하고 원문 관계 이름을 접근성 이름·상세에서 보존한다. 카드는 끌어 이동할 수 있고 선·라벨은 새 위치에 맞춰 바뀐다. 간단한 이동 안내와 전체 보기·배치 초기화를 제공하며, 같은 회차의 갱신·근거 선택에서 배치를 유지한다. 새로고침 또는 회차/중심 인물 전환은 기본 배치를 복원한다. 선 굽힘점 직접 조작·배치 서버 저장은 이번 범위에 포함하지 않는다.


### GH323 전체 관계망과 중심 인물 배치 — 2026-10-30 현재 실험

사용자의 관계도 참고 이미지를 바탕으로, 전체 보기에서 인물이 4명 이상이면 연결 수가 많은 인물을 중심축으로 골라 가로 뼈대에 놓고 주변 인물을 위·아래 부채꼴로 모은다. 여러 중심축 인물과 연결된 사람은 그 사이에 한 번만 표시하고, 연결이 적거나 더 먼 인물은 바깥에 둔다. 중심축의 연한 파란 카드 강조는 연결 구조를 읽기 위한 구분이며 작품의 주요 인물·서열·진영을 판정한 결과가 아니다. 중심축을 고를 만한 차이가 없는 경로형 묶음은 인접한 사람들을 가까이 두고, 서로 연결되지 않은 묶음은 분리한다. 같은 입력은 배열 순서와 관계 방향에 무관하게 같은 기본 배치를 만든다.

전체 보기의 선은 개별 곡선으로 표시하고 카드에 가로막히면 필요한 구간만 둥근 대각 우회 경로를 사용한다. 관계 이름은 무거운 테두리 없이 선 위의 흰 바탕에서 읽게 한다. 경로 위에 라벨 자리가 없을 때는 가까운 빈 자리에 놓고 화살촉 없는 얇은 점선으로 원래 선과 연결한다. 같은 두 인물의 여러 관계도 각각의 ID·방향·종료 상태·라벨·근거를 보존하며 인물을 복제하거나 관계를 합치지 않는다. 위치는 가족 관계·서열·방향을 뜻하지 않으며 모든 교차·공유 구간 제거를 보장하지 않는다.

3명 이하의 전체 보기와 특정 인물 중심 보기는 기존 방사형 배치·곡선을 유지한다. 중심 보기에서는 선택한 인물과 직접 연결된 상대를 둘러 배치하고, 복수 관계가 가장 많은 상대를 왼쪽에 놓으며 관계가 많은 쌍의 라벨에 더 넓은 공간을 배분한다.

근거 선택과 같은 작품·회차·중심 인물의 갱신은 옮긴 카드 좌표와 확대·이동 위치를 유지한다. 드래그 중에도 선과 연결점을 유지하며 위치만 바꾸고 서버 관계를 수정하지 않는다. 회차·중심 인물 전환 또는 새로고침은 기본 배치로 시작한다. 4명 이상 전체 보기의 최초·초기화 화면은 최소 0.6배로 시작하고, 명시적 `전체 보기`는 현재 카드·선·라벨 전체를 화면에 맞춘다. `배치 초기화`는 옮긴 위치를 지운다. 중심 보기와 3명 이하 전체 보기는 기존 전체 맞춤을 유지한다.

이번 변경은 이전 stress 배치의 1.8배 간격과 관계 수에 따른 직교 경로 전환을 대체하는 되돌릴 수 있는 로컬 실험이다. 이전 실측은 과거 비교 기록으로 남기며 최신 화면의 검증 결과로 재사용하지 않는다. 복원용 소스는 workspace의 `.codex-artifacts/relationship-50people-100edges-local-20261029/hub-diagram-20261030/before-source/`에 보존한다. Pencil은 앞서 발생한 transport 연결 실패로 동기화 대기 상태이며 이번 문서 갱신을 `.pen` 반영 완료로 간주하지 않는다.


### GH323 관계도 탭 순서와 기본 진입 — 2026-10-30

종류 탭은 `인물 관계도 / 가계도` 순서로 표시한다. 별도 종류나 가족 상세 상태가 없는 `nav=graph` 진입은 인물 관계도를 연다. `relationMode=people`과 `relationMode=family`의 명시적 선택을 우선하고 가계도를 선택하면 `family`를 URL에 남긴다. 종류가 생략된 기존 가족 보기·중심·후보·관계·근거 상세 링크는 가족 화면으로 유지하며 이전 `tab=relations` 가족 링크도 선택 상태를 보존해 정규화한다. 현재 프로필 모달은 가족 종류에서만 표시하고 무지정 인물 관계도에 함께 노출하지 않는다.

활성 종류의 둥근 흰 배경·파란 글자·밑줄과 내부 보기의 기존 스타일은 유지한다. 키보드 Home은 왼쪽 인물 관계도, End는 오른쪽 가계도를 고른다. 화면 기본값만 바꾸며 가족·일반 관계 데이터, 분석, 근거와 회차별 표시 정책은 바꾸지 않는다. 이 정책이 이전 가계도 우선 진입·탭 순서를 대체한다.


### GH323 재조회 오류와 부분 분석 안내 — 2026-10-30

같은 작품·회차·세션의 네트워크/5xx 갱신 실패에서는 마지막 성공 그래프와 열린 수정 초안·409 확인 상태를 유지하고 `관계도를 갱신하지 못했어요. 이전 내용을 표시하고 있어요.`와 재시도를 제공한다. 이용불가 4xx 응답이나 범위·세션 전환에는 이전 관계·근거·초안을 표시하지 않는다. 부분 분석은 빈 그래프를 포함해 `관계 분석에 반영하지 못한 내용이 있어요.` 한 줄로 알리며 별도의 필수 검토·경고 패널을 만들지 않는다. 기존 실패/무효화 안내가 있으면 그 안내를 우선한다.
