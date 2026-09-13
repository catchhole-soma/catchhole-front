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

## 2026-09-01T14:21:20.000Z — unresolved-scopes-use-an-explicit-merge-

```omd-meta
id: pref_mtir9h5s_655074b6
timestamp: 2026-09-01T14:21:20.000Z
scope: components.button
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "src/app/components/catchhole/worldsetting/WorldSettingReview.tsx"
```

When a world-setting candidate has an unresolved scope but exactly matches an existing scoped property, keep explicit user confirmation and offer a direct action to merge into that existing path instead of requiring manual scope entry or auto-applying it.

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

## 2026-09-06T08:46:10.544Z — mobile-layouts-adapt-controls-for-usability

```omd-meta
id: pref_mtpkhpbk_c399a9d0
timestamp: 2026-09-06T08:46:10.544Z
scope: layout
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "모바일 화면은 잘림과 줄바꿈뿐 아니라 버튼을 드롭다운으로 바꾸는 방식까지 사용자 편의성으로 검토해 달라는 요청"
```

모바일 UI 검토는 잘림, 어색한 줄바꿈, 읽기 어려운 정보 밀도와 터치 영역을 함께 다룬다. PC의 개별 버튼·탭을 그대로 축소하지 않고, 작은 화면에서는 선택 메뉴 등 모바일에 맞는 조작 방식으로 바꾸며 중요한 저장·확정 행동은 쉽게 찾을 수 있게 유지한다.

## 2026-09-06T09:13:59.869Z — demo-starts-at-top-with-user-led-scrolling

```omd-meta
id: pref_mtplhhdp_2bb9988d
timestamp: 2026-09-06T09:13:59.869Z
scope: layout
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "체험할 때 따라가기 UI 쪽으로 바로 내려가지 말고 위에서부터 내려오면서 봐야 한다는 요청"
```

체험 화면은 위에서부터 읽으며 사용자가 직접 내려가게 한다. 안내·강조 버튼을 보여주려는 자동 스크롤과 초기 포커스 이동은 하지 않는다. 화면 회전과 안내 내용 변경도 읽는 위치를 강제로 바꾸지 않는다.

## 2026-09-08T06:22:28.186Z — compact-manuscript-notice-after-demo

```omd-meta
id: pref_mtsa8llp_af66f182
timestamp: 2026-09-08T06:22:28.186Z
scope: layout
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "src/app/components/catchhole/SLanding.tsx; https://github.com/catchhole-soma/catchhole-backend-java/issues/182"
```

Place a compact, always-visible manuscript non-training notice immediately after the product demo and before the three-item core feature summary; keep the heading “작가님의 원고는 AI 학습에 사용하지 않습니다.”, shorten the body to “원고와 분석 결과 모두에 적용됩니다.”, retain the privacy-policy link, and use the shared canvas background with 32px maximum / 26px minimum heading text and 56px desktop / 40px mobile vertical padding.

## 2026-09-10 — landing-live-action-video

```omd-meta
id: pref_nvm321_landing_video
timestamp: 2026-09-10T09:00:00+09:00
scope: layout
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "기존 캐치홀 랜딩의 첫 사진을 승인한 영상으로 교체. 데스크톱은 여백이 사라지며 스크롤 진행, 모바일은 일반 영상 재생 요청. NVM-321"
```

기존 `/landing`의 첫 화면에 승인한 작가→노트북 영상을 사용한다. 데스크톱은 흰 여백과 둥근 모서리로 시작하고 스크롤·드래그 시 영상이 확장되면서 연속적으로 진행한다. 하단에는 설정 추출부터 검수까지 캐치홀 하나로라는 뜻의 큰 문구를 둔다. 승인한 25화 원고와 6개의 추출 설정을 유지한다. 모바일은 스크롤에 시간을 연결하지 않고 일반 영상을 재생한다. 이 명시적 요청은 과거 에디토리얼 전체 배경 Hero 선호를 대체한다.

후속 교정: 영상 첫 화면의 체험·무료 시작 버튼, 설정 추출 보기 버튼과 보조 안내를 처음부터 노출하지 않는다. 데스크톱은 설정 추출이 끝난 마지막 장면, 모바일은 영상 재생이 끝난 뒤 체험·무료 시작 CTA와 신뢰 안내를 표시한다. 상단 헤더 및 하단 랜딩의 기존 CTA는 유지한다.

모바일 후속 교정: 일반 영상만 재생하고 끝내지 않는다. 영상 뒤에도 같은 25화 원고에서 설정이 추출되고 확정되는 장면까지 이어져야 한다. 모바일은 스크롤에 장면 진행을 연결하지 않으며, 읽을 수 있는 세로 카드 배치와 시간 기반 자동 진행·일시정지·다시 보기를 제공한다. 체험·무료 시작 CTA는 영상 종료가 아닌 설정 확정 완료 뒤에 표시한다. 위 모바일 CTA 시점 설명을 이 요청으로 대체한다.

## 2026-09-12T15:12:44.338Z — landing-copy-explains-upload-and-extracti

```omd-meta
id: pref_mtyixxrm_95d688ad
timestamp: 2026-09-12T15:12:44.338Z
scope: voice
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "src/app/components/catchhole/landing-video/LandingVideoHero.tsx; https://github.com/catchhole-soma/catchhole-backend-java/issues/192"
```

Use “작성한 원고를 업로드하면” as the supporting copy and “캐릭터와 세계관 설정을 추출해요.” as the setting-extraction heading on `/landing` so the upload requirement and extraction targets are explicit.

## 2026-09-10 — author-language-and-one-direct-review-count

```omd-meta
id: pref_gh180_author_review_20260910
timestamp: 2026-09-10T05:56:40Z
scope: interaction
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "사용자가 자동 반영 결과의 단일 직접 확인 집계와 root 포함 개발자식 안내 제거를 승인함"
```

분석 결과는 반영됨·제외됨·직접 확인을 중심으로 안내하고, 진행 중인 분석은 따로 보여 준다. 개발자 용어가 아니라 작가가 판단할 의미와 다음 행동으로 오류·모달·판단 근거를 설명한다. 원문·고유명사·설정값은 바꾸지 않는다.
