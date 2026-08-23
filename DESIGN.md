# NHN Cloud Reference Design System

<!-- design-md:section experience -->
## 1. Experience

<!-- design-md:claim scope kind=product-surface lang=en -->
### Product Surface Scope

CatchHole's `/landing` is the public marketing surface for web-novel authors and editors evaluating a React product that turns uploaded episode manuscripts into AI-extracted character and world-setting candidates with source evidence and author confirmation. This contract is scoped to that landing surface; `/login`, `/signup`, `/demo`, and authenticated workspace routes retain their existing behavior and product-specific systems.
<!-- design-md:claim-end -->

<!-- design-md:claim primary-tasks kind=user-outcomes count=2 lang=en -->
### Primary Tasks

- Experience CatchHole's manuscript-to-setting review flow without signing in through `/demo` as the primary landing conversion.
- Move to free sign-up as a secondary path when ready to register a work and use the full service.
<!-- design-md:claim-end -->

### Visual Theme & Atmosphere

NHN Cloud is a cloud and IT-service company whose public platform describes a broad set of infrastructure and platform services for business operations and service development. Its corporate history traces the cloud service to a 2014 OpenStack launch and records NHN Cloud Corp.'s 2022 establishment, while the current company site frames the role as enabling customers' next technical challenge. On the captured corporate marketing route, that promise is expressed with a narrow, high-contrast action system: a bright `#125DE6` blue on fully rounded CTAs, white labels, dark resource menus, and the loaded `Pretendard Variable` face. The company’s official symbol describes three dots as both cloud and connection; the visual interface does not literalize that story with a broad decorative palette. It instead uses blue as a deliberate conversion signal. [NHN Cloud Company](https://company.nhncloud.com/about?lang=en) and the public [cloud platform](https://www.nhncloud.com/kr) are distinct from the developer-facing TOAST UI catalog and from the documentation chrome captured below.

### Do's and Don'ts

### Do

- Use `#125DE6` and a 30px radius only for the captured corporate marketing CTA pattern.
- Use loaded `Pretendard Variable` for corporate-marketing reproductions.
- Keep the 6px trigger and 8px expanded-menu geometry tied to their observed resource control.
- Treat TOAST UI and NHN Cloud docs as separately evidenced developer/documentation surfaces.

### Don't

- Do not merge TOAST UI catalog chrome or documentation-chrome colors into the corporate marketing token set.
- Do not substitute `Noto Sans KR`, `Noto Sans CJK KR`, or a system font for the verified corporate `Pretendard Variable` role.
- Do not invent grid, editor, calendar, error, hover, disabled, or responsive variants from TOAST UI’s product list.
- Do not generalize the menu overlay shadow into a broad elevation ladder.

### Brand Narrative

NHN Cloud's official history records an OpenStack public-cloud launch in 2014, a cloud-center build in Pangyo in 2015, and the launch of NHN Cloud in April 2022. The company now describes itself as a cloud and IT-service business, with current growth efforts spanning data/AI services, private and global markets, and regional data centers. Its official logo explanation centres connection and boundless possibility; the three-dot symbol is described as a cloud and as a prompt for easy, flexible collaboration.

The developer-facing counterpart is TOAST UI: its own site calls it a JavaScript UI library and free open-source project constantly managed by NHN Cloud, listing applications such as Grid, Editor, Calendar, Chart, and Image Editor alongside smaller components and front-end guides. The catalog is informative evidence of the developer ecosystem, not proof that its catalog-page typography or any unobserved component value is the NHN Cloud corporate design system.

### Principles

1. **Enable a customer’s technical journey.**
   *UI implication:* Prefer a clear capability and an unambiguous next action over decorative language.

2. **Connection is a brand idea, not a license to invent a token system.**
   *UI implication:* Keep the action lane focused; do not turn the corporate logo story into unsupported visual rules.

3. **Corporate marketing and developer catalog are distinct public domains.**
   *UI implication:* Attribute each token and component to its captured route before reuse.

4. **Open-source developer tools need precise boundaries.**
   *UI implication:* Describe TOAST UI's documented applications and components without claiming unseen states or styles.

### Personas

- **Enterprise technical evaluator:** visits the public cloud marketing route to understand services and a next step; the verified CTA values belong to this route.
- **Developer evaluating a UI utility:** visits TOAST UI’s catalog for applications, components, and guides; this is a developer/documentation journey, not the NHN Cloud console.
- **Cloud documentation reader:** uses `docs.nhncloud.com` for reference material; its loaded Noto Sans KR documentation chrome remains surface-local.

<!-- design-md:section foundations -->
## 2. Foundations

<!-- design-md:claim foundations kind=rules-or-constraints lang=en -->
### Color Palette & Roles

**Corporate marketing route — selector-backed machine tokens**

- Primary action: `#125DE6` — observed as the filled CTA background and border.
- On primary: `#FFFFFF` — observed CTA label color.
- Dark menu surface: `#111111` — observed expanded menu background.
- Muted control text: `#727781` — observed resource-menu trigger text and menu border.
- Control border: `#51565F` — observed resource-menu trigger border.

The capture also records `#E9F1FF` in documentation chrome. It is not promoted as a corporate marketing or TOAST UI token: the page is a separate documentation shell.
<!-- design-md:claim-end -->

### Depth & Elevation

The captured corporate CTA samples have no shadow. The expanded resource menu alone records an overlay shadow of `0px 4px 8px rgba(0, 0, 0, 0.06)` behind a `#111111` panel and `#727781` hairline. Do not turn that one menu observation into a general card-elevation system.

### Motion & Easing

No computed duration, easing curve, or motion sequence was supplied as a reliable token. The menu-open capture establishes the resulting expanded panel only. Treat motion values as unresolved until a relevant public surface is captured with explicit computed transition evidence.

**Proof:** see .verification.md (## Proof — Tier 1 live inspect)

<!-- design-md:section typography-assets -->
## 3. Typography & Assets

### Typography Rules

- **Live corporate computed use:** `Pretendard Variable` is the only general corporate UI family promoted here. It has 480 visible uses across the corporate marketing capture and a loaded FontFace/source match at `https://www.nhncloud.com/fonts/PretendardVariable.woff2`.
- **Live documentation-chrome use:** `Noto Sans KR` is loaded/high confidence with 203 visible uses on `docs.nhncloud.com`, from Google Fonts sources. It is documentation chrome evidence, not a replacement for the corporate token family.
- **Unresolved catalog use:** the TOAST UI catalog computes `Noto Sans CJK KR` on 122 visible samples, but the collector found no matching loaded FontFace or source. It remains unresolved.
- **Declared-only assets:** `common`, `Noto Sans`, `Noto Sans JP`, `swiper-icons`, and `tui-calendar-font-icon` have declaration/source evidence but zero visible observed use. They are not promoted or substituted.
- **Font licence boundary:** Pretendard’s upstream project distributes the family under SIL Open Font License 1.1. The licence describes the family; the corporate FontFaceSet/source evidence above is what establishes current NHN Cloud web use.

<!-- design-md:section components-states -->
## 4. Components & States

### Component Stylings

### Corporate Header CTA

**40px primary action**
- Background: #125DE6
- Text: #FFFFFF
- Border: 1px solid #125DE6
- Radius: 30px
- Padding: 8px 19px
- Height: 40px
- Font: 15px / 400 / Pretendard Variable
- Use: Corporate-marketing header CTA; `home::[captured element]`.

### Corporate Section CTA

**48px primary action**
- Background: #125DE6
- Text: #FFFFFF
- Border: 1px solid #125DE6
- Radius: 30px
- Padding: 10px 27px
- Height: 48px
- Font: 17px / 500 / Pretendard Variable
- Use: Corporate-marketing section CTA; `home::[captured element]`.

### Resource Menu Trigger

**Expanded trigger**
- Text: #727781
- Border: 1px solid #51565F
- Radius: 6px
- Padding: 10px 16px
- Height: 42px
- Font: 16px / 400 / Pretendard Variable
- Use: Corporate-marketing resource/menu trigger; `home::[captured element]`; expanded/menu-open was observed.

### Resource Menu

**Expanded panel**
- Background: #111111
- Text: #FFFFFF
- Border: 1px solid #727781
- Radius: 8px
- Padding: 8px 0px
- Shadow: 0px 4px 8px rgba(0, 0, 0, 0.06)
- Font: 16px / 400 / Pretendard Variable
- Use: Expanded corporate-marketing menu panel; `home::[captured element]`.

No TOAST widget, input, grid, editor, hover color, error treatment, or responsive variant is specified here without a captured selector/value pair on an actual relevant surface.

### States

- Corporate header and section CTA selectors carry collector markers for hover and pressed, but no separate computed state values are promoted.
- The corporate resource trigger was observed expanded/menu-open with the 42px, 6px-radius trigger values above.
- The expanded corporate menu panel was observed at `#111111`, with a 1px `#727781` border, 8px radius, and the recorded overlay shadow.
- A documentation-chrome CTA was observed separately at `surface-3::[captured element]`: `#125DE6`, white text, 30px radius, `9px 20px` padding, and Noto Sans KR 15px/300. It is not promoted as the corporate CTA token.
- No focus, disabled, error, success, loading, empty, toast, dialog, or form-validation state is asserted.

<!-- design-md:section layout-platforms -->
## 5. Layout & Platforms

### Layout Principles

The corporate marketing capture pairs a 40px header action with 48px section actions, keeping the bright blue lane intentionally limited. The 30px CTA radius belongs to this marketing surface; the observed 6px trigger and 8px menu panel are a separate resource-control cluster. The source artifact does not establish a universal grid, app-shell spacing scale, or layout rule for the cloud console, TOAST UI applications, or documentation pages.

### Responsive Behavior

The supplied capture is 1440×900 only. It establishes 40px and 48px CTA examples and a 42px resource trigger at that viewport, but it does not establish a mobile breakpoint, responsive menu geometry, or touch-target policy. Preserve the observed values only where the same surface is being recreated; validate any responsive implementation separately.

<!-- design-md:section content-locales -->
## 6. Content & Locales

### Voice & Tone

The official company statement is business-enabling and practical: it positions NHN Cloud as technology support for customers' new journeys. Keep corporate copy direct, capability-led, and concrete about the operational outcome. The TOAST UI catalog has a different, developer-oriented voice: it presents applications, components, tools, and front-end guidance. That public catalog voice is useful context for developers, but it does not turn documentation labels into corporate-marketing microcopy. [Company statement](https://company.nhncloud.com/about?lang=en) · [TOAST UI](https://ui.toast.com/)

<!-- design-md:section governance -->
## 7. Governance

### Agent Prompt Guide

For a corporate NHN Cloud marketing treatment, use `Pretendard Variable`, a white-on-`#125DE6` 30px pill CTA, and choose either the 40px / `8px 19px` / 15px-400 header sample or the 48px / `10px 27px` / 17px-500 section sample. For the captured resource menu, use a transparent `#727781` / `#51565F` 6px trigger and an expanded `#111111` panel with an 8px radius and the observed light overlay shadow. Do not use this small marketing sample to synthesize a cloud-console UI or TOAST UI widget library.

<!-- design-md:claim authority kind=evidence-backed-reconstruction lang=en -->
### Authority

This document is an evidence-backed reconstruction, not authority for an unrelated target project.
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
