# CatchHole Landing and Setting Review Design System

<!-- design-md:section experience -->
## 1. Experience

<!-- design-md:claim scope kind=product-surface lang=en -->
### Scope

CatchHole `/landing` is the public marketing surface for web-novel authors and editors evaluating a product that turns uploaded episode manuscripts into AI-extracted character and world-setting candidates with source evidence and author confirmation. This contract also defines the explicitly scoped completion and comparison-choice behavior of `/setting-review`; other authenticated workspace routes remain outside its scope.
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

**Semantics:** Leaves `/setting-review` only after both character and world-setting review summaries are available and no candidate still needs review or attention.

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
| disabled | applicable | The action stays disabled until both review summaries load successfully and pending or attention-required candidates reach zero. |
| loading | applicable | The disabled action reflects that one or both aggregate queries are still loading. |
| error | not-applicable | A summary-query failure keeps the action disabled instead of becoming a button error state. |
| success | not-applicable | Completion replaces the review route with the selected work's manuscript list. |

### Rules

- Keep the verified NHN Cloud CTA geometry as landing evidence rather than a universal application button system.

- Use `로그인 없이 체험하기` as the primary action in the header, hero, and closing CTA; free sign-up remains secondary.

- Accordion transitions must preserve keyboard focus, expose the active step, and honor reduced-motion preferences.

- Enable the setting-review completion action only when both character and world-setting summaries loaded successfully and all pending or attention-required counts are zero; otherwise keep it disabled and show the remaining count.

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
