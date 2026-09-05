---
schema: omd.preferences/v1
design_md_hash_at_creation: 3f461326c2750b266dfb7b7706ac254de665a31def7c5bc6cbab09b282d19a5d
---

# Preference Log

## 2026-08-23T10:09:10.182Z — landing-login-free-demo-cta-is-primary

```omd-meta
id: pref_mt5naiay_6861179c
timestamp: 2026-08-23T10:09:10.182Z
scope: components.button
signal: user-statement
confidence: explicit
status: applied
applied_at: 2026-08-23T13:38:46Z
applied_design_md_hash: 6988a42f214c76e1ae10d202fd4b7163ea57ac006522865916f0939881454cca
source_agent: codex
source_context: "src/app/components/catchhole/SLanding.tsx"
```

On the landing page, the login-free demo CTA is primary and sign-up is secondary.

## 2026-08-23T11:04:21.048Z — full-landing-redesigns-should-make-the-vi

```omd-meta
id: pref_mt5p9gzf_d79ac96b
timestamp: 2026-08-23T11:04:21.048Z
scope: layout
signal: user-correction
confidence: explicit
status: applied
applied_at: 2026-08-23T13:38:46Z
applied_design_md_hash: 6988a42f214c76e1ae10d202fd4b7163ea57ac006522865916f0939881454cca
source_agent: codex
source_context: "src/app/components/catchhole/SLanding.tsx"
```

Full landing redesigns should make the visual hierarchy and section structure visibly different, not stop at CTA styling.

## 2026-08-23T11:27:57.000Z — reference-led-heroes-need-strong-first-screen-impact

```omd-meta
id: pref_mt5r2vut_2fded35a
timestamp: 2026-08-23T11:27:57.000Z
scope: layout.hero
signal: user-correction
confidence: explicit
status: applied
applied_at: 2026-08-23T13:38:46Z
applied_design_md_hash: 6988a42f214c76e1ae10d202fd4b7163ea57ac006522865916f0939881454cca
source_agent: codex
source_context: "src/app/components/catchhole/SLanding.tsx"
```

Reference-led landing hero iterations should carry the reference's strong first-screen visual impact, not only its CTA styling.

## 2026-08-23T12:07:34.849Z — landing-assets-need-distinct-purpose-built-images

```omd-meta
id: pref_mt5risax_9312dae3
timestamp: 2026-08-23T12:07:34.849Z
scope: visualTheme
signal: user-correction
confidence: explicit
status: applied
applied_at: 2026-08-23T13:38:46Z
applied_design_md_hash: 6988a42f214c76e1ae10d202fd4b7163ea57ac006522865916f0939881454cca
source_agent: codex
source_context: "src/app/components/catchhole/landing-v2.css"
```

Landing heroes and multi-panel showcases should use purpose-built, visually distinct images instead of reusing one generic image through repeated crops.

## 2026-08-23T12:45:02.771Z — landing-capabilities-belong-in-a-service-catalog

```omd-meta
id: pref_mt5suyt0_62f9b360
timestamp: 2026-08-23T12:45:02.771Z
scope: layout
signal: user-correction
confidence: explicit
status: applied
applied_at: 2026-08-23T13:38:46Z
applied_design_md_hash: 6988a42f214c76e1ae10d202fd4b7163ea57ac006522865916f0939881454cca
source_agent: codex
source_context: "src/app/components/catchhole/SLanding.tsx"
```

Landing capability sections should present the product's diverse service surface in a structured two-column catalog instead of reducing it to a generic sequential workflow.

## 2026-08-24T04:50:04.000Z — approved-landing-hero-uses-full-section-ba

```omd-meta
id: pref_mt6rbzpu_23bdaa61
timestamp: 2026-08-24T04:50:04.000Z
scope: layout
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "design/catchhole.pen#omdLandingFullPageActive"
```

The approved landing hero uses its purpose-built artwork as a full-section background with centered copy; do not replace it with a cropped standalone split-column image.

## 2026-08-24T08:44:27.699Z — for-korean-service-analytics-and-adverti

```omd-meta
id: pref_mt6zpfas_0a223f5f
timestamp: 2026-08-24T08:44:27.699Z
scope: components.dialog
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "src/app/components/catchhole/TrackingConsentManager.tsx"
```

For Korean service analytics and advertising disclosures, prefer a clear privacy-policy notice over a separate cookie-consent banner or signup checkbox.

## 2026-08-25T09:59:43.375Z — in-the-quota-feedback-form-use-submit-fo

```omd-meta
id: pref_mt8hu2a8_977ef0e7
timestamp: 2026-08-25T09:59:43.375Z
scope: components.dialog
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "src/app/components/catchhole/AiTokenQuotaModal.tsx"
```

In the quota feedback form, use Submit for the primary action and Cancel for the dismiss action instead of a generic Confirm label.

## 2026-08-25T10:41:00.000Z — quota-exhaustion-dismisses-initiating-con

```omd-meta
id: pref_mt8jb5ef_e26dadc5
timestamp: 2026-08-25T10:41:00.000Z
scope: components.dialog
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "src/app/components/catchhole/S1Dashboard.tsx"
```

When quota exhaustion interrupts an action, dismiss its initiating confirmation modal before showing the quota modal so closing the quota notice cannot reveal stale confirmation UI.

## 2026-08-25T10:41:00.001Z — refilled-usage-displays-against-current-g

```omd-meta
id: pref_mt8jb5eh_83d72a48
timestamp: 2026-08-25T10:41:00.001Z
scope: visualTheme
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "src/app/components/catchhole/AppSidebar.tsx"
```

After a refill equal to the default grant, remaining-usage UI should show 100% against the current grant unit rather than lifetime cumulative grants.

## 2026-08-28T07:53:32.000Z — feedback-request-and-success-copy-should

```omd-meta
id: pref_mtcnncl7_90b30df4
timestamp: 2026-08-28T07:53:32.000Z
scope: voice
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "src/app/components/catchhole/FeedbackDialog.tsx"
```

Feedback request and success copy should express gratitude for the user's contribution instead of only issuing directives or confirming receipt.

## 2026-08-29T06:19:34.863Z — once-all-setting-review-items-are-confir

```omd-meta
id: pref_mtdzqd5x_bf644f83
timestamp: 2026-08-29T06:19:34.863Z
scope: components.button
signal: user-correction
confidence: explicit
status: applied
applied_at: 2026-08-29T07:43:03Z
applied_design_md_hash: 57bd598376e2436af13245debc2ea266951ce9eea5aa056ccfc5dd5a894c0c4c
source_agent: codex
source_context: "src/app/components/catchhole/SSettingReview.tsx"
```

Once all setting-review items are confirmed, enable the completion button and have it navigate to the manuscript list instead of leaving browser Back as the only exit.

## 2026-08-29T06:27:52.946Z — character-settings-marked-do-not-apply-n

```omd-meta
id: pref_mte011hn_59e9112b
timestamp: 2026-08-29T06:27:52.946Z
scope: visualTheme
signal: user-correction
confidence: explicit
status: superseded
superseded_by: pref_mte1s17c_30bbc591
source_agent: codex
source_context: "src/app/components/catchhole/character/CharacterFactComparisonPanel.tsx; src/app/components/catchhole/characterreview/CharacterSettingReview.tsx"
```

Character settings marked “Do not apply” need unmistakable visual treatment, and group confirmation must clearly communicate that those settings will be excluded rather than saved.

## 2026-08-29T06:29:22.910Z — the-save-to-history-only-option-needs-co

```omd-meta
id: pref_mte02ywo_2bd2857b
timestamp: 2026-08-29T06:29:22.910Z
scope: voice
signal: user-correction
confidence: explicit
status: applied
applied_at: 2026-08-29T07:43:03Z
applied_design_md_hash: 57bd598376e2436af13245debc2ea266951ce9eea5aa056ccfc5dd5a894c0c4c
source_agent: codex
source_context: "src/app/components/catchhole/character/CharacterFactComparisonPanel.tsx"
```

The “Save to history only” option needs concrete explanatory copy and a past-only example, such as a recalled former condition, that distinguishes timeline history from the character’s current setting.

## 2026-08-29T07:16:51.861Z — character-setting-exclude-is-auto-dismissed

```omd-meta
id: pref_mte1s17c_30bbc591
timestamp: 2026-08-29T07:16:51.861Z
scope: visualTheme
signal: user-correction
confidence: explicit
status: applied
applied_at: 2026-08-29T07:43:03Z
applied_design_md_hash: 57bd598376e2436af13245debc2ea266951ce9eea5aa056ccfc5dd5a894c0c4c
source_agent: codex
source_context: "src/app/components/catchhole/characterreview/CharacterSettingReview.tsx"
```

Character setting candidates whose comparison result is EXCLUDE are automatically dismissed and hidden from the default review queue without changing the confirmed current setting or its history; world-setting EXCLUDE behavior remains unchanged.

## 2026-08-29T08:00:48.898Z — the-history-only-choice-layout-should-pl

```omd-meta
id: pref_mte3cjy7_c377b531
timestamp: 2026-08-29T08:00:48.898Z
scope: layout
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "src/app/components/catchhole/character/CharacterFactComparisonPanel.tsx"
```

The History-only choice layout should place its example on a separate line below the usage explanation for easier scanning.

## 2026-09-02T09:52:14.000Z — catchhole-logos-use-simple-bright-landing-blue

```omd-meta
id: pref_mtjx397w_b55dc891
timestamp: 2026-09-02T09:52:14.000Z
scope: color
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "public/brand/catchhole-symbol.png; public/brand/catchhole-wordmark.png; src/app/components/catchhole/landing-v2.css"
```

CatchHole logo concepts should be simple and use the landing page's brighter blue visual language rather than dark navy and coral.

## 2026-09-04T03:57:28.000Z — early-logo-rounds-explore-ten-distinct-directions

```omd-meta
id: pref_mtmfaq0r_380c28ec
timestamp: 2026-09-04T03:57:28.000Z
scope: visualTheme
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "public/brand/catchhole-symbol.png; public/brand/catchhole-wordmark.png"
```

Early CatchHole logo rounds should explore roughly ten structurally distinct directions informed by strong brand precedents instead of converging on one obvious literal symbol.

## 2026-09-05T11:37:04.144Z — refine-selected-folded-ribbon-and-ch-logo

```omd-meta
id: pref_mtob5mds_aa29c164
timestamp: 2026-09-05T11:37:04.144Z
scope: color
signal: user-statement
confidence: explicit
status: pending
source_agent: codex
source_context: "design/logo-explorations/2026-09-05/04-folded-ribbon.png; design/logo-explorations/2026-09-05/06-ch-imprint.png"
```

The owner prefers the folded-ribbon logo (04) and compact CH stamp (06) from the September 5 exploration and wants to refine their colors while preserving their selected forms; neither a final logo nor a final palette has been chosen.

## 2026-09-05T11:40:03.103Z — approved-logo-baseline-is-4a

```omd-meta
id: pref_mtob9ggv_023f6d33
timestamp: 2026-09-05T11:40:03.103Z
scope: visualTheme
signal: user-statement
confidence: explicit
status: pending
source_agent: codex
source_context: "design/logo-explorations/2026-09-05/colors-01/04-a.png"
```

The owner has confirmed 4A, the bright-blue and sky-blue folded ribbon, as the CatchHole logo baseline; preserve its selected form and palette while exploring only small optional accent additions, which are not yet approved.

## 2026-09-05T12:01:14.145Z — final-logo-is-glossy-acrylic-4a

```omd-meta
id: pref_mtoc0p7l_473fdce2
timestamp: 2026-09-05T12:01:14.145Z
scope: visualTheme
signal: user-statement
confidence: explicit
status: pending
source_agent: codex
source_context: "design/logo-explorations/2026-09-05/depth-01/04-glossy-acrylic.png"
```

The owner has confirmed dimensional variant 04, glossy opaque acrylic based on the approved 4A folded ribbon, as the final CatchHole logo direction: retain the bright-blue main face, sky-blue folded face, controlled gloss and thickness, and no quotation accent; prior flat and alternative material images remain historical references.

## 2026-09-05T12:42:06.847Z — retain-wordmark-beside-glossy-symbol

```omd-meta
id: pref_mtodh9q7_12f839cd
timestamp: 2026-09-05T12:42:06.847Z
scope: visualTheme
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "src/app/components/catchhole/ui-v2/BrandLogo.tsx"
```

Preserve the existing CatchHole wordmark and place the approved glossy acrylic symbol to its left in product branding; do not replace the wordmark with a symbol-only presentation.
