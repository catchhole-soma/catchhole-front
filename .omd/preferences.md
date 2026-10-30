---
schema: omd.preferences/v1
design_md_hash_at_creation: 3f461326c2750b266dfb7b7706ac254de665a31def7c5bc6cbab09b282d19a5d
---

# Preference Log

## 2026-10-21 — 가계도 기본 공개

사용자는 Vercel 계정 설정 없이 코드의 기본값으로 가계도를 공개하고 프론트 PR 머지·운영 배포를 진행하도록 승인했다. `VITE_RELATIONSHIP_WORKSPACE_ENABLED`는 정확히 문자열 `false`인 경우에만 화면을 끄며 미설정·빈 문자열·그 외 값은 켠다. 사이드바 `관계도`에서 기존 가계도·가족 관계 목록·확인·연결을 제공하고, 일반 인물 관계도는 계속 `업데이트 예정`으로 둔다. 기본 E2E는 ON, 명시적 `false`의 OFF 검증은 별도 CI로 유지한다. 운영 데이터의 일회성 백필은 같은 날 별도로 완료했으며 화면 진입·플래그 변경·머지는 백필을 실행하지 않는다. 이 공개 결정은 아래 과거 기록의 기본 OFF 선호만 대체하며 기존 디자인·근거·인증·추가 LLM 없음 원칙은 유지한다.

## 2026-10-20 — 명시된 조상·후손과 대손 수

명시된 조상·후손 관계는 직접 부모·자녀와 구분하고 `ANCESTOR_OF`·`DESCENDANT_OF`의 방향을 유지한다. 원문에 명시된 nullable `generationGap`은 `N대손`으로, 없는 값은 `세대 차이 미상`으로 표시한다. 중간 인물을 추정·생성하지 않으며 후보 그림의 점선과 목록·근거 요약의 `중간 계보 생략`으로 해당 연결의 표현 범위를 알린다. 원래 설정·인용을 보존하고 세대 수 편집은 가족 판단 저장과 분리한다. 추가 LLM 책임이나 기본 OFF 정책은 바꾸지 않는다. DESIGN.md와 화면 계약에 기록하며 기존 Pencil 연결 대기 상태는 유지한다.

혼합 예시 피드백: 직접 자녀는 함께 바로 아래, 3대손·5대손은 명시된 차이 순서대로 아래에 놓고 빈 세대만 압축한다. 세대 미상 후손은 별도 옆 영역에 둔다. 조상 선을 직접 자녀 연결선에 섞지 않고 각 근거를 유지한다. 프로필 없는 동일 인물은 이름으로 자동 합치지 않고 사용자 명시 묶기와 해제로 다룬다.

## 2026-10-20 — 검색하거나 중심으로 선택한 인물의 색상 강조

사용자는 검색 또는 `특정 인물 중심으로 보기`에서 선택한 사람이 가계도에서 다른 색으로 눈에 띄길 요청했다. 진한 파란 카드·흰 글자와 `검색 결과`/`중심 인물` 표시로 구분한다. 검색 초기화와 전체 보기에서 해당 강조를 해제하며 가족 배치와 확대·이동 위치는 유지한다. 기존 프로필·근거 열기와 미등록 인물 표기도 유지한다.

## 2026-10-20 — 종류 탭과 내부 보기의 강조 구분

사용자는 맨 위 `관계도` 제목을 제거하고, 상단 종류 탭의 선택된 흰 배경은 위쪽 두 모서리만 살짝 둥글게(8px) 바꾸길 요청했다. 아래 가계도·가족 관계 목록·확인·연결 보기에서는 흰 배경을 제거하고 파란 글자와 밑줄만 유지한다. 이 교정은 아래 기록의 두 단계 모두 흰 사각형을 사용하던 선호를 대체한다. 기존 보기·URL·모바일 선택과 Pencil 연결 대기는 유지한다.

## 2026-10-20 — 관계도 종류 선택과 흰색 활성 탭

사용자는 `다른 인물에서 보기`를 `특정 인물 중심으로 보기`로 바꾸고, 상단에 `가계도 / 인물 관계도`를 기존 탭과 비슷하게 표시하길 요청했다. 인물 관계도는 `업데이트 예정`의 비활성 항목으로 둔다. 상단의 `현재는 부모·자녀…` 설명은 제거한다. 기존 가계도·가족 관계 목록·확인·연결 보기의 활성 항목은 흰 사각형 배경과 기존 파란 글자·밑줄을 함께 유지한다. 종류 탭과 내부 보기의 크기·간격을 구분하고 모바일의 기존 보기 선택과 URL은 유지한다. DESIGN.md와 구현에 반영했으며 Pencil 앱 연결 오류로 디자인 원본 동기화는 대기한다.

## 2026-10-20 — 연결할 인물 카드를 직접 가리키기

사용자는 `관계 미리보기` 제목을 없애고 클릭할 카드 옆에 `← 캐릭터를 연결하려면 클릭`처럼 행동을 명시하길 요청했다. 두 인물 그림은 유지하고 넓은 부모·자녀 화면에서는 상대 카드 오른쪽 안내가 카드를 가리키게 한다. 좁은 화면과 배우자·형제 그림에서는 안내를 카드 안에 두고, 연결된 상대는 변경 안내로 표현한다. 편집 중·확인 필요 상태와 기존 선택·저장 흐름은 유지한다.

## 2026-10-19 — 확정 관계는 두 이름을 함께, 펼친 근거는 바로 읽기

사용자는 확정 관계에서 한 사람 이름만 강조되는 요약과 근거를 펼친 안에 다시 박스·버튼이 중첩되는 구성을 지적했다. 두 이름을 동등하게 표시하고 부모는 왼쪽·자녀는 오른쪽, 배우자·형제자매는 동등한 연결로 읽게 한다. 근거 펼침은 설정·출처·실제 인용문을 바로 보여 주며 전체 원문만 보조 행동으로 연다. 수정 폼은 상대가 기준 인물에게 어떤 가족인지 먼저 묻고 보조 필드·저장·제외·재확인을 분리한다. 의미가 불명확한 철회 문구는 `이 연결이 잘못됐어요` → `연결 제외하기`로 바꾸고 프로필·원문 유지와 가계도 연결 제외의 영향을 알린다. 확정 목록에서 상대 이름만 우선하던 아래 기록은 이 선호로 대체하며, 기존 API·검증·기본 OFF·추가 LLM 없음과 Pencil 연결 대기는 유지한다.

## 2026-10-19 — 확정 가족 관계 목록에도 같은 읽기 순서 적용

사용자는 후보 목록 개선에 이어 확정된 가족 관계 목록도 바꾸길 요청했다. 큰 개별 카드와 방향 메타 정보 대신 하나의 흰 목록에서 상대 이름, 기준 인물과의 관계, 현재 유효 상태를 읽도록 한다. 행 전체를 누르면 근거를 바로 아래에 펼치고 다시 눌러 접는다. 과거·시점 설명·세부 유형, 재검토·보관·철회 상태와 기존 원문·철회 보호는 유지한다. 목록 밖 직접 링크와 가계도에서 선택한 관계에도 같은 요약을 적용하고, 성공한 처리 요약은 가족 관계 목록에서도 접는다. DESIGN.md와 화면 계약에 반영하며 Pencil 연결 대기는 유지한다.

## 2026-10-19 — 가족 후보 목록은 이름과 다음 행동이 먼저

사용자는 `프로필 연결 · 선택 사항`, `비요른 · 얀델`, `자녀 → 부모 · 현재 관계`가 반복되는 큰 카드 목록의 가시성과 가운뎃점 표기를 지적했다. 목록은 흰 표면 안의 구분선으로 간결하게 나누고, 상대 이름을 첫 줄에 강조한 뒤 `비요른의 부모`처럼 관계를 읽게 한다. `확인할 가족 관계`와 `가족 프로필 연결`을 구분하고 선택 여부는 별도 표기로 둔다. 필요한 검토 사유·과거·시점 설명·세부 관계는 보존하고, 행 전체에서 프로필 연결 또는 관계 확인으로 이동한다. 성공한 처리 요약은 접고 목록 복귀 시 초점을 되돌린다. 이 교정은 앞선 후보 상세의 두 인물 그림을 유지하며 목록 표현을 대체한다. DESIGN.md와 화면 계약에 반영하고 Pencil 연결 대기는 유지한다.

## 2026-10-19 — 가족 관계 확인은 두 인물 그림에서 행동

사용자는 글이 많은 후보 상세에서 누가 누구와 어떤 관계이고 어느 인물의 프로필이 없는지 알기 어렵다고 지적했다. 후보 편집은 두 인물의 연결 그림을 먼저 보여 주고, `프로필 미등록`인 상대 카드를 눌러 실제 프로필 선택으로 이어지게 한다. 부모는 위·자녀는 아래, 배우자·형제는 같은 높이로 표시하며 불확실한 관계는 점선과 `확인 필요`로 구분한다. 선택한 프로필은 저장 전 상태를 표시하고 자동 연결하지 않는다. 별도 상대 선택 행과 중복 문장·장문 안내를 줄이고, 실제 설정은 짧은 보조 정보로, 자세한 근거와 수정은 펼침으로 유지한다. 이 선호는 아래 이전 기록의 후보 편집에서 설정을 먼저 크게 읽히던 배치를 대체하며, 가계도에서 여는 인물 근거 상세의 관계 문장·설정·원문 순서는 유지한다. DESIGN.md와 화면 계약에 반영하며 Pencil 연결 대기는 유지한다.

## 2026-10-19 — 가족 관계 확인도 사용자 행동 중심으로

사용자는 가족 근거·후보 화면의 정보 위계가 부족하다고 지적하고, GH215 설정 후보 확정의 사용자 중심 흐름을 참고한 실제 수정을 요청했다. 가족 관계가 불확실한 경우와 가족 관계는 명확하지만 프로필만 없는 경우를 구분한다. 실제 설정을 먼저 읽고 필요한 질문에 답하게 하며, 선택적 프로필 연결과 관계 내용 수정을 나눈다. 상태 안내는 실제 서버의 표시 자격을 따르고 모든 후보가 가계도에 없다고 단정하지 않는다. 기존 수정 저장 → 반영의 두 버튼은 목적이 드러나는 한 행동으로 이어 주되 별도 API와 검증은 유지한다. DESIGN.md와 구현에 반영하며 Pencil 동기화는 연결 복구 후 진행한다.

## 2026-10-19 — 미등록 인물의 표시 문구

사용자는 `설정에서만 언급` 대신 `프로필 미등록`을 선택했다. 가계도 카드·근거 상태·관계 선택 목록에 동일한 표현을 사용하고 도움말도 맞춘다. 근거 열기와 선택적 인물 연결 동작은 유지한다. 이전 표시 문구 선호를 대체하며 DESIGN.md와 구현에 반영했다.

## 2026-10-19 — 가계도에서 기존 프로필 사진 재사용

사용자는 가계도의 기본 인물 아이콘을 유지하되 프로필 사진이 있으면 사진으로 표시하길 요청했다. 등록 인물의 기존 표시 이미지를 재사용하고, 미등록 언급·사진 없음·실패는 기본 아이콘을 쓴다. 사진 변경은 가계도에도 반영하되 관계나 배치를 변경하지 않는다. DESIGN.md와 구현에 반영했다.

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


## 2026-09-16T05:13:28.972Z — feedback-discovery-and-shorter-opinions

```omd-meta
id: pref_mu3nap3g_2cd26367
timestamp: 2026-09-16T05:13:28.972Z
scope: components.dialog
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "Java issue #196; AppSidebar.tsx; FeedbackDialog.tsx"
```

Remove the workspace remaining-usage display, emphasize feedback with a visible mobile label, and invite experienced users once per account; lower the general feedback minimum to accept shorter opinions.

This supersedes the prior workspace usage-gauge preference for this surface. The approved trigger is at least three actual uploaded episodes across active works, excluding prior feedback authors, shown on the manuscript list after activity settles. The user requested a lower minimum; 10 Unicode characters after trimming is the implementation choice. Quota-exhaustion requests retain their separate policy.


## 2026-09-17 — analysis-guide-real-screens

```omd-meta
id: pref_gh194_analysis_guide_real_screens
timestamp: 2026-09-17
scope: components.dialog
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "AnalysisModeGuideDialog.tsx; GH194"
```

첫 분석 안내 모달은 더 크게 표시하고 실제 업로드·검토 화면으로 두 방식의 차이를 보여 준다. 자동 반영은 미확인 하나만, 직접 검토는 모든 설정을 확인하는 모습을 표시한다. 사용자가 대상을 고르거나 확정하는 실습 이벤트를 요구하지 않는다. 단계와 비교 방식 탐색만 제공한다.


## 2026-09-17 — analysis-guide-one-row-live-components

```omd-meta
id: pref_gh194_guide_live_components
timestamp: 2026-09-17
scope: components.dialog
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "AnalysisModeGuideDialog.tsx; GH194"
```

첫 분석 안내의 단계와 방식 탭을 이중으로 두지 않는다. 반영 방식 → 모든 설정 직접 검토 → AI 자동 반영 → 자동 반영에서도 필요한 직접 검토 → 검토 완료 순서의 한 줄 단계 바를 사용한다. 캡처 이미지를 쓰지 않고 실제 서비스 컴포넌트를 예시 데이터로 렌더링한다. 예시 내부의 이벤트는 작동하지 않으며 탐색만 허용한다. 이 교정은 앞선 캡처·방식 탭 구성을 대체한다.

## 2026-09-19 GH199 사용자 승인 반영

- 과거 후보 변경으로 완료된 뒤 회차를 취소하지 않는다. 최신값·제거·직접 수정 보호가 우선이며 충돌 후보는 이력에만 저장한다. `OrderedReviewImpactNotice`와 확정 결과 안내에 반영했다.
- 내 이미지에서 보관용 코드 절차를 제거하고 로그인·작품 접근 권한을 사용한다. 기존 밝은 선택창에서 바로 업로드하며 기존 암호화 이미지는 재업로드·교체를 안내한다. DESIGN.md와 docs/private-world-images.md에 반영했다.

- GH199 안내 문구 추가 수정: 로그인/코드 설명 대신 작품 전용·본인에게만 보이는 이미지임을 강조한다. `이 작품에만 사용하는 이미지이며, 나만 볼 수 있어요.`로 반영했다.

- GH199 용량 정책 사용자 결정: 작품당 50개 유지, 이미지 한 장은 5MB 이하. 선택 파일과 PNG 변환 결과 모두 검사하고 화면 안내에 반영한다.

## 2026-10-02 — clear-blue-review-implementation

```omd-meta
id: pref_gh215_clear_blue_review
timestamp: 2026-10-02
scope: setting-review
signal: user-statement
confidence: explicit
status: applied
source_agent: codex
source_context: "Java issue #215; approved separate Clear Blue HTML based on v8 43-state review atlas"
```

승인된 Clear Blue 테마와 사진·질문·결과 선택 카드·변경 diff를 실제 캐릭터/세계관 후보 검토에 적용한다. 기존 시안과 팀 공유 문서는 보존한다. 분석 진행 화면은 이미 있으므로 검토를 위한 새 진행 화면을 만들지 않고 필요한 짧은 잠금 안내와 기존 화면 연결로 통합한다. 모든 실제 검토 상태를 확인하며, 기존 그룹 확정·기본 미처리 필터·원문·버전/현재값 보호를 유지한다. 과거 범위 병합의 모달 선입력 선호는 일반 선택의 인라인 결정으로 대체하고 고급 수정은 유지한다.

동일한 화면을 소개하는 랜딩 예시·로그인 없이 체험하기·첫 업로드 안내도 함께 갱신한다. 실제 컴포넌트를 재사용해 소개와 제품의 모습이 어긋나지 않도록 한다. 예시에서 실제 작품 저장이나 인증 저장소 변경을 수행하지 않는다.

## 2026-10-03 — compact-character-review-actions

```omd-meta
id: pref_gh215_compact_character_actions
timestamp: 2026-10-03
scope: setting-review
signal: user-correction
confidence: explicit
status: applied
source_agent: codex
source_context: "캐릭터 선택 카드의 반복 확정 안내 삭제, 연결 변경을 수정 왼쪽에 배치, 신규 등록은 모달 안으로 이동 요청"
```

현재 반영·이력 카드의 하단 반복 안내를 제거한다. 캐릭터 연결 변경·수정·제외를 제목 옆에 모으고 기존 연결 상태·변경·신규 등록을 나열하던 별도 행은 제거한다. 새 캐릭터 등록은 연결 모달 안에서 선택한다. 그룹 확정과 확정 전 재선택, 미상 인물의 직접 선택은 유지한다. DESIGN.md에 함께 반영했다.

## 2026-10-03 같은 회차의 수동 최종 결과 존중

사용자는 같은 회차 후보를 수정·제외한 선택과 화면에 남아 있는 최종 문장을 그대로 승인하기로 결정했다. 제외한 선행 후보 때문에 다른 후보의 병합 문장을 다시 생성하거나 AI 재비교를 강제하지 않는다. 수정한 값은 저장된 최종 초안, 제외는 해당 후보만 제외, 나머지 선택은 보존한다. 원문 변경·동시 수정·대상 연결·후행 현재값 보호는 별도 검증한다. 관련 작업은 Java 이슈 #215 및 프론트/Java `feat/gh-215-review-clear-blue` 브랜치에서 함께 관리한다.

## 2026-10-06 GH219 사용자 결정

현재 설정 수정 이후에도 최종 확정의 명시적 현재 반영 선택을 존중한다. 후보·원문 동시 변경과 자동 반영 보호는 유지한다. 현재 설정 제거와 이력 보존을 구분한다. 업로드마다 원고·분석 결과의 학습 미사용을 짧게 안내한다. 다회차 파일은 번호순 목록과 재정렬 버튼을 제공하고 정상 번호에는 반복 경고를 넣지 않는다. DESIGN.md에 반영했다.

추가 요청: 분석 중 화면에서 다른 화면으로 이동해도 분석이 유지된다는 안내를 보여 준다. 서버 작업과 워커가 화면 이동과 독립적으로 동작하는 것을 확인했고, 진행 중 제목 아래에 짧은 안내와 분석 목록에서 다시 확인할 수 있다는 설명을 추가했다.

## 2026-10-07 GH223 장르별 용어

사용자는 일상·로맨스에서도 스탯이 등장하므로 모든 장르에 스탯을 유지하고, 아이템은 모두 소지품으로 바꾸기로 했다. 스킬 제목만 판타지=스킬, 무협=무공·기예, 나머지=기술·특기로 구분한다. 작품별 프롬프트 변경은 하지 않으며 공통 추출 기준을 유지한다. DESIGN.md에 반영했다.

## 2026-10-12T07:07:36Z — landing-reveal-and-friendly-card-art

```omd-meta
id: pref_mv4wuepy_0605fb99
timestamp: 2026-10-12T07:07:36Z
scope: motion
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "src/app/components/catchhole/SLanding.tsx; src/app/components/catchhole/landing-v2.css"
```

Landing scroll reveals should be clearly perceptible, start at the product walkthrough heading, and use only subtle, quickly clearing blur. The owner approved a substantial redesign of the lower cards and backgrounds, then requested friendly GPT-generated illustrations instead of the dark manuscript artwork.

사용자 피드백: 기존 24px 등장 효과는 눈에 띄지 않았고 디자인도 밋밋했다. 카드·배경 재구성은 승인했으며, 적용 후 5px 흐림은 과해 2px·350ms로 줄였다. 제품 흐름 제목부터 전체 하단에 적용한다. 업로드·분석 이미지는 친근한 입체 일러스트로 교체한다.

## 2026-10-12 — landing-product-showcase

사용자는 8단계 미리보기의 장식 이미지도 제거하거나 화면을 보여주는 방식 자체를 바꾸길 요청했다. 세로 이미지 레일을 제거하고 상단 단계 선택·전체 너비 화면·짧은 설명으로 변경했다. 시작 계기는 웹소설을 좋아하는 한 독자로서 작가의 설정 관리 수고를 덜고 싶었다는 이야기이며, 하단에 편안한 해요체로 반영했다. 자동 설정 충돌 검수를 제공하거나 직접 확인이 전혀 필요 없다고 약속하지 않는다. 이 결정은 DESIGN.md의 기존 세로 아코디언·단계별 이미지 방향보다 우선하는 사용자 교정이다.

## 2026-10-12 — 네 장면의 제품 이야기 승인

사용자는 탭+전체 화면 구조가 투박하다고 평가한 뒤 실제 Craft·Linear 레퍼런스를 확인하고, Craft의 부드러운 분위기와 Linear의 핵심 화면 확대를 조합하는 방향을 승인했다. 기존 구조 유지 제약은 없으며 실제 제품 화면을 다시 확인해 쓰도록 요청했다. 원고 추출·원문 비교·설정집·변화 이력 네 장면으로 구성하고, 현재 제품 컴포넌트를 가상 데이터로 실행해 새로 캡처한다. 이전 8단계 탭·이미지 레일 지침보다 이 사용자 선택을 우선한다.

## 2026-10-12 — 완료 화면과 자유 탐색 교정

사용자는 Linear·Craft 방향을 완료 화면에도 실제로 적용하길 명시했다. 보라색 큰 박스와 좌우 카드 구성은 거절했다. 레퍼런스는 색만 가져오지 않고 실제 제목·CTA·여백·정보 위계로 반영한다. 완료 화면을 Linear 하단 CTA의 중앙 두 줄 제목과 pill 버튼, 따뜻한 중립 배경, 아래의 간결한 검토 기록으로 재구성했다. 안내가 끝나면 자유 탐색을 허용하면서 완료 사실을 계속 알려야 하며, 창을 닫았다는 이유로 이전 안내를 반복하지 않는다. 자동 완료 전환 없이 사용자가 마침 버튼을 누른다.

### 2026-10-12 — 이미지부터 구성한 완료 화면 승인

- 사용자: “이미지 생성해서 … 그걸 토대로 사이트 코드 구현”. 내장 GPT로 종이책에서 숲과 세계관이 펼쳐지는 이미지를 생성해 그 여백과 색을 기준으로 코드 구현.
- 적용 후 사용자: “얘네는 빼도 될 거 같다 위에 디자인이 좋아서”. 이미지와 완료 CTA는 유지하고 아래 체험 기록 전체 제거.
- 이 화면의 승인 방향은 크림·세이지 톤, 넉넉한 이미지 여백, 실제 텍스트와 절제된 pill 버튼. 이전 보라색 카드/중앙 텍스트만의 시안으로 되돌리지 않는다.


## 2026-10-14 — 간결한 챗봇 답변 안내

승인된 챗봇 품질 보완에 따라 여러 제한 안내는 짧은 개수 안내와 펼치기/접기로 표시한다. 안내가 하나면 원문 한 문장을 바로 표시한다. 정확히 같은 문장만 합치고 서로 다른 서버 안내는 모두 보존하며, 정규식으로 안내·고유명사·설정값·오류를 숨기거나 바꾸지 않는다. 키보드 조작·초점·접근성 상태와 320px 화면을 함께 검증한다. 이 결정은 챗봇 안내의 표현 범위에 적용하며 API·사용량·근거 검증 계약은 유지한다.

## 2026-10-15 — 챗봇 근거 번호와 인용문 가독성

사용자는 답변 뒤의 `근거 1`과 근거 창의 정보 위계 개선을 승인하고, 근거가 여러 개인 상황도 재현해 검증하도록 요청했다. 답변의 근거 표시는 클릭 가능한 `[1]` 배지로 제공하고 해당 번호의 근거로 이동한다. 전체 근거 버튼에는 개수를 표시한다. 근거 창은 회차·인용문을 중심으로 구성하고 원문 보기와 설정 보기를 구분한다. 중간 근거 조회가 실패해도 원래 번호와 자리를 유지하며, 여러 근거 이동·닫기 초점 복귀·긴 원문·320px 화면을 검증한다. 원문과 설정값, 권한 확인과 질문 재검증 계약은 유지한다. 이 교정은 챗봇 화면에만 적용한다.


## 2026-10-15 — 챗봇 대화방 목록과 읽기 위치

사용자는 배포 전 기본 화면 정리 범위로 불필요한 제외 집계와 상시 Enter 안내 제거, 방을 선택하는 형태의 대화 목록, 좌측 메뉴 높이 복구, 챗봇 메뉴의 분석 리포트·그래프 뷰 위 이동, 수동 스크롤 뒤 질문으로 돌아가는 현상 수정을 승인했다.

방 목록에는 API가 이미 제공하는 생성 시각과 질문 수를 표시하고 현재 선택을 강조한다. 첫 질문 제목을 만들기 위한 추가 조회나 저장은 하지 않는다. 폭 1,100px 이하에서는 목록을 접고 펼치며 상단 새 대화와 2시간 만료를 유지한다. 대화 진입·페이지 전환·본인 새 질문 시에만 한 번 이동하고 주기 조회·답변 갱신은 읽던 위치를 보존한다.

서버가 만든 고정 제외 안내의 `관련 설정이 없는 N명/개` 집계만 생략한다. 미검토·판단 보류와 답변의 불확실성은 남기고 일반 답변·설정값·인용을 가공하지 않는다. 이 좁은 예외는 2026-10-14의 모든 서버 안내 보존 선호보다 우선한다. 입력 안내를 지워도 Enter 전송·Shift+Enter 줄바꿈·한글 조합 방지와 인증·접수·근거 검증 계약은 유지한다.

## 2026-10-16 — dashboard-adjacent-upload-actions

```omd-meta
id: pref_dashboard_upload_actions_20261016
timestamp: 2026-10-16
scope: components.button
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "src/app/components/catchhole/S1Dashboard.tsx; /dashboard"
```

Show a setting-book upload button alongside the episode upload button in the setting dashboard header.

## 2026-10-19 — 가계도는 가족 구조와 인물 식별을 우선

사용자는 초기 가계도 캡처에 대해 “가시성이 심하게 부족”하고 “뭘 나타내고 있는거야”라고 지적했다. 인물과 비슷한 크기의 관계 설명 상자, 중복 부모 선, 분리된 라벨로 가족 구조를 읽기 어렵게 만든 표현을 개선한다. 인물 이름과 부모·자녀의 연결 구조가 먼저 읽혀야 하며, 관계별 자세한 설명과 근거 접근을 같은 수준의 큰 상자로 반복하지 않는다. 이 교정은 가계도 화면에 적용하며 저장 관계나 추출 규칙을 변경하라는 요청은 아니다. 현재 구현은 DESIGN.md의 GH261 절에 기록하고 후속 캡처로 검증한다.

## 2026-10-19 — 미등록 가족 인물 표시와 직접 연결

사용자는 캐릭터로 등록되지 않은 얀델도 비요른의 현재 가족 설정에 이름이 명시되어 있으면 가계도에 표시하도록 승인했다. `설정에서만 언급` 상태의 인물은 캐릭터 상세 모달 대신 해당 설정과 근거를 열고, 사용자가 원할 때 등록된 인물을 직접 선택하여 연결한다. 나중에 동명 캐릭터가 등장하더라도 자동으로 연결하거나 같은 이름의 언급을 합치지 않는다. 이 변경은 기존 추출 결과의 표시·연결에 한정하며 추가 LLM 추출과 캐릭터 자동 등록을 하지 않는다. 근거가 바뀌거나 관계가 추측·부정·충돌인 경우는 표시 자격을 다시 판단한다.

## 2026-10-19 — 가계도 안내 밀도와 캔버스 배경 교정

사용자는 긴 상시 설명과 가로로 흩어진 건수·선택적 연결 안내를 조잡하다고 평가했고, 가계도 안팎이 같은 배경색인 점을 지적했다. 상단에는 인물·관계 수와 접힌 `가계도 안내`만 남긴다. 범례·조작 방법·선택적 연결 설명은 안내 안에 보존하고 확인·연결 건수는 기존 보기 탭에서 확인한다. 캔버스는 흰 표면과 옅은 점 격자로 외부 회색 배경과 구분한다. 아들·딸·아버지·어머니 표시는 설계 검토만 요청했으므로 현재 관계 표기나 성별 데이터를 변경하지 않는다.

## 2026-10-19 — 부모·자녀 선 양끝의 호칭

후속 요청에서 사용자는 호칭 구분 구현과 한 선의 양끝에 `아버지`, `아들`처럼 표시하는 방식을 제안했다. 현재 근거에서 명시된 끝점의 호칭만 사용하고 알 수 없는 끝점은 `부모·자녀`를 유지한다. `얀델의 아들`은 얀델=부모, 비요른=아들이며 부모의 성별을 추측하지 않는다. 단일 자녀 연결은 중앙 개수 대신 양끝 호칭으로, 여러 자녀는 각 인물의 가지에서 호칭을 읽게 한다. 추가 AI 추출이나 성별 필수 입력을 도입하지 않는다. 이 요청은 앞선 호칭의 설계 검토만 하라는 범위를 구현으로 확장한다.


## 2026-10-19 — 성공 처리 안내 제거와 모든 가족 근거의 즉시 인용

사용자는 성공한 가족 관계 처리 결과를 접어 두는 방식도 제거하고, 연결을 취소하는 행동을 `이 연결 삭제`와 확인 단계의 `삭제하기`로 명확하게 표시하도록 요청했다. 삭제는 기존 철회 API의 의미를 유지하며 인물·프로필 설정·원문을 지우지 않는다. 앞선 성공 결과 접기와 `이 연결이 잘못됐어요`·`연결 제외하기` 표현은 이 교정으로 대체한다.

후보 편집과 프로필 미등록 인물도 근거를 펼치면 실제 원문 인용이 바로 보여야 한다. 위에서 읽은 현재 설정을 원문 영역의 카드로 다시 반복하지 않고, 출처·인용과 작은 전체 원문 행동을 같은 평평한 표면에 둔다. 닫힌 원문을 미리 요청하지 않으며 구조화 현재 설정, 이전 근거 경고, 인용 조회 실패·재시도와 편집 초안 보호를 유지한다. 이 교정은 표시와 조작 흐름만 바꾸고 추출·동일 인물 판단·관계 확정 조건을 변경하지 않는다.


## 2026-10-20 — 가족 판단을 한 곳의 세 선택으로 통일

사용자는 다섯 값 의미 선택창과 화면마다 다른 가족 확인 흐름을 단순하게 바꾸는 제안을 승인했다. 두 인물 그림 아래 한 곳에서 `실제 가족이에요`·`가족이 아니에요`·`아직 모르겠어요`를 고르고 `판단 저장`으로 반영한다. 명시된 가족 후보는 상태행과 `판단 변경`을, 다른 판단값은 펼친 선택 영역을 제공한다. 아직 모름은 실제로 저장해 후보를 유지하고 가계도에서 제외한다. 가족 판단 저장으로 프로필을 자동 연결하지 않으며 미저장 상대·관계·시점 초안과 분리한다. 목록 복귀는 저장하지 않고, 선택 취소는 판단만 되돌린다. 기존 의미 드롭다운·중복 제외 액션은 제거한다. 최신 근거 명시 선택과 버전·세션 보호는 유지한다.


## 2026-10-20 — 관계 수정 버튼의 가독성

사용자는 `수정 내용만 저장`과 `설정이 바뀌었나요? / 현재 설정 다시 확인` 문구의 가시성이 낮다고 지적했다. 오른쪽에 흩어진 흐린 글씨를 편집 입력과 왼쪽으로 정렬하고, `변경사항 저장`을 진한 주 버튼으로, `최신 설정 불러오기`를 구분선 아래 테두리 버튼으로 표현한다. 글자 크기·굵기와 대비를 명시하며 모바일에서는 한 열 전체 너비를 사용한다. 저장·조회 동작은 그대로 유지한다.

## 2026-10-20 — 상시 최신 설정 버튼 제거

사용자는 새로고침으로 해결할 수 있는 일에 별도 버튼을 계속 두는 이유를 물었고, 진입·변경 감지 시 자동 조회하고 실패 때만 재시도하는 방향을 승인했다. 앞선 테두리형 `최신 설정 불러오기` 버튼도 제거한다. 조회는 초안과 근거 선택을 유지하며, 외부 수정 확인과 최신 근거 채택은 명시적 행동으로 분리한다. 정상 화면에는 긴 조회 안내나 항상 열린 근거 선택 목록을 추가하지 않는다.

사용자는 이어서 상시 `근거 선택` 버튼의 필요성을 물었고 정상 화면에서 제거하는 방향을 승인했다. 평소에는 `변경사항 저장`과 `원문 근거 보기`만 제공한다. 근거의 변경·누락·인물 불일치로 저장에 필요한 확인이 있을 때만 근거 선택을 드러내고, 선택을 되돌릴 수 있도록 해결 중인 영역은 저장 성공까지 유지한다.

## 2026-10-20 — 확정 관계의 이름 간격

사용자는 `테르시아 — 형제자매 — 에르웬` 목록에서 이름과 연결 표시가 멀리 떨어져 깨져 보인다고 지적했다. 두 인물과 관계는 내용 폭에 맞춰 한 묶음으로 읽히게 하고, 짧은 이름을 동일 비율의 큰 열에 분산하지 않는다. 긴 이름·320px 줄바꿈과 부모→자녀 순서는 유지한다.

## 2026-10-20 — 관계 프로필 선택의 첫 등장 표시

사용자는 레벨 값만 보이던 인물 선택 항목을 다른 항목과 동일하게 첫 등장 회차로 통일하는 방향을 승인했다. 모든 항목은 `첫 등장 N화`, 정보가 없으면 `첫 등장 회차 미확인`으로 표시한다.

## 2026-10-20 — 설정집 분석에서 가계도로 이어지는 안내

사용자는 가계도를 직접 그리는 화면이 아니므로 가족 관계를 적은 설정집을 분석하면 가계도를 채울 수 있다는 안내와 설정집 업로드 이동 버튼을 제안했다. 가계도 위에 짧은 안내와 하나의 업로드 진입 행동을 두며, 현재 작품의 기존 업로드 창을 재사용한다.

## 2026-10-20 — 가계도 도움말의 불필요한 문장 제거

사용자는 가계도 안내의 작품 전체 선택적 인물 연결 건수 문장과 바로 아래의 이동·확대 및 배우자 미확인 부모 연결 안내 문장을 제거하도록 요청했다. 나머지 호칭·범례·프로필 및 근거 안내는 유지한다.

## 2026-10-20 — 과거 관계 필터와 뒤로가기 순서

사용자는 기본 체크박스로 표시한 `과거 관계 포함`과 화살표가 뒤에 놓인 `후보 목록 ←`을 교정하도록 요청했다. 과거 관계는 둥근 토글 버튼으로 표현하고 선택 시 파란 강조와 체크 아이콘을 함께 표시한다. 뒤로가기는 `← 후보 목록`과 `← 근거로 돌아가기`처럼 화살표를 앞에 두며 기존 필터 URL·복귀·미저장 보호 동작을 유지한다.

## 2026-10-20 — 미등록 인물을 직접 묶고 해제하기

사용자는 프로필을 만들지 않은 같은 인물을 직접 한 노드로 묶고 다시 해제할 수 있게 하기를 승인했다. 같은 이름이라는 이유로 자동으로 합치지 않는다. 선택할 때 어느 인물의 어떤 관계인지와 두 관계의 근거를 보여 주고, 묶인 노드에서도 각 관계의 근거를 쉽게 전환한다. 기존의 짧은 안내 선호를 유지해 설명을 반복하지 않고 정상 상태의 조회 버튼을 추가하지 않는다.

## 2026-10-19T05:20:59.406Z — shared-setting-review-header

```omd-meta
id: pref_mvet3gni_ad9136f4
timestamp: 2026-10-19T05:20:59.406Z
scope: components.navigation
signal: user-correction
confidence: explicit
status: pending
source_agent: codex
source_context: "src/app/components/catchhole/characterreview/CharacterSettingReview.tsx; src/app/components/catchhole/worldsetting/WorldSettingReview.tsx; /setting-review"
```

Use a shared page header that covers both character and world-setting candidates on `/setting-review`. The implemented title is `설정 후보 검토`; candidate types remain distinguished by their tabs.

## 2026-10-27T11:29:42.000Z — error-report-setting-review-consistency

```omd-meta
id: pref_mvqlsfw0_49da71ce
timestamp: 2026-10-27T11:29:42.000Z
scope: visualTheme
signal: user-statement
confidence: explicit
status: pending
source_agent: codex
source_context: "docs/planning/gh-300-error-report-design-draft.md; /setting-review; GH300"
```

Keep the current error-report draft structure and align its final visual design as closely as possible with the current character and world-setting confirmation screens.

2026-10-27 사용자는 오류 리포트 초안에서 현재 수정할 부분을 찾지 못했으며, 최종 디자인에서 캐릭터·세계관 설정 확정 화면과 최대한 통일성을 유지하도록 요청했다. 현재 초안의 정보 구조와 흐름을 유지하고 최종 작업 시 실제 `/setting-review`의 캐릭터·세계관 화면을 함께 비교한다. 공통 패널·버튼·필터·선택/상태 표시·글자·간격·원문 근거 표현을 맞추되, 오류 리포트의 판단 저장과 설정 확정의 서로 다른 동작 의미는 보존한다. 이번 피드백은 최종 시각 정리의 기준이며 기능 구현 완료나 최종 시안 확정을 뜻하지 않는다.

## 2026-10-29 — 회차별 인물 관계도와 자동 반영 (#323)

사용자는 기존 캐릭터·세계관 분석을 유지하고 관계를 별도 분석하여 자동 반영하는 방향의 구현을 승인했다. 회차를 선택하면 그 회차까지 드러난 관계·이름·근거를 보여 주며 최신 분석 회차가 기본이다. 별도의 애매함 판단·필수 검토 목록은 만들지 않고, 근거가 확인된 만큼만 표시한다. 관계를 누르면 두 인물의 이름·설명·실제 인용을 바로 읽고 잘못된 설명이나 연결만 선택적으로 고친다. 기존 가계도 동작은 유지한다. 이 요청이 이전 `인물 관계도 · 업데이트 예정` 제한을 대체한다.

## 2026-10-29 일반 설정의 잘못된 인용만 숨김

사용자는 일반 설정 근거에 위치 정보가 없으면 원문 대조를 생략하고 인용을 숨기며, 위치가 있어도 원문과 다르면 전체 분석을 실패시키지 말고 해당 인용만 숨기는 방향을 승인했다. 설정값과 정상 인용은 유지하고, 위치가 없는 인용을 원문 문자열 검색으로 복구하거나 저장 인용 fallback으로 다시 보여 주지 않는다.

## 2026-10-29 — 복수 인물 관계의 초기 겹침 제거

사용자는 같은 두 인물의 쌍방 관계·양쪽 일방 관계가 겹치는 초기 화면을 개선하고, 드래그로 인물과 선의 각도를 조정할 수 있는지 검토하길 요청했다. 관계를 합치거나 버리지 않고 라벨·연결점의 공간을 확보하며 카드 드래그와 따라 움직이는 선을 제공한다. 화면 배치만 변경하고 관계 의미·방향·서버 데이터는 유지한다. 디자인 계약과 화면 문서에 반영하며 Pencil 동기화는 연결 복구 대기다.


## 2026-10-29 — 복잡한 관계망에서도 연결 구조와 중심 인물 유지

여러 인물과 복수 관계가 있는 예시에서도 관계를 합치거나 숨기지 않고 읽을 수 있도록 전체 보기와 중심 보기를 구분한다. 채택한 배치 방향은 4명 이상 전체 보기의 결정적 네트워크 배치, 3명 이하의 기존 방사형 배치, 선택 인물 중심의 관계 개수에 따른 간격 배분이다. 관계가 가장 많은 상대는 중심 인물 왼쪽에 둔다. 근거 선택·같은 범위 갱신은 드래그 위치를 유지하고, 회차·중심 인물 전환은 새 기본 배치로 시작한다. 이 기록은 앞선 복수 관계 분리·직접 이동 선호를 보완하는 구현 결정이며 새 관계 의미나 사용자 검토 단계를 추가하지 않는다. 중심 보기와 전체 보기의 12개 이하 관계는 곡선, 전체 보기의 13개 이상 관계는 고정 좌표 직교 경로로 구분한다. 공유 구간이나 교차가 완전히 사라진 것으로 안내하지 않으며 측정은 화면 문서에 별도로 기록한다.

## 2026-10-29 — 전체 관계망 간격과 초기 확대 실험

사용자는 전체 관계도를 한 화면에 모으면서 복잡해지는지 확인하기 위해 전체 보기의 간격만 넓혀 보고, 마음에 들지 않으면 되돌리는 실험을 승인했다. 전체 네트워크 좌표 간격을 1.35배 늘리고 첫 화면·배치 초기화는 최소 0.6배를 유지한다. 빈 공간을 끌어 이동하며 명시적 `전체 보기`는 기존처럼 모두 맞춘다. 인물 중심 보기는 유지하고 변경 전 소스를 별도로 보존했다. 이 요청은 전체 관계망 최초 진입에도 항상 전체 맞춤을 적용하던 동작을 대체한다.

## 2026-10-30 — 전체 관계망 간격 추가 확대

사용자는 이전보다 더 넓은 간격을 요청했다. 전체 네트워크 좌표 배율을 1.35에서 1.8로 높여 직전보다 인물 간 거리를 약 33% 넓힌다. 카드 크기·최초 최소 확대율 0.6·인물 중심 보기·명시적 전체 맞춤은 그대로 유지한다. 직전 상태를 보존해 이번 수치 조정만 되돌릴 수 있다.


## 2026-10-30 — 참고 이미지의 중심축·주변 인물 구도로 되돌릴 수 있는 실험

사용자는 관계도 참고 이미지를 바탕으로 단순히 간격을 더 넓히는 대신 배치와 선의 인상을 바꾸는 실험을 승인했다. 4명 이상 전체 보기에서는 연결 수가 높은 인물을 가로 중심축으로 놓고 주변 인물을 위·아래 부채꼴로 모으며, 공유 인물은 연결된 중심축 사이에 한 번만 표시한다. 중심축은 연결 구조를 읽는 장치이며 주요 인물·서열·진영을 단정하지 않는다. 연한 파란 중심축 카드, 테두리 없는 관계 이름, 곡선과 필요한 둥근 대각 우회로 읽기 쉽게 구성한다.

이 요청이 앞선 전체 보기의 stress 배치·1.8배 간격·13개 이상 직교 경로 전환을 대체한다. 앞선 날짜별 선택과 측정은 과거 실험 기록으로 유지한다. 인물 중심 보기와 3명 이하의 기존 배치, 초기·초기화 최소 0.6배, 명시적 전체 맞춤, 드래그 중 선 보존, 같은 범위 갱신·근거 선택의 위치 유지는 그대로 둔다. 인물·관계 ID와 모든 관계 의미를 보존하며 인물 복제나 관계 병합은 하지 않는다. 복원용 소스는 workspace의 `.codex-artifacts/relationship-50people-100edges-local-20261029/hub-diagram-20261030/before-source/`에 보존했고, Pencil 동기화는 기존 transport 실패로 대기 중이다.


## 2026-10-30 — 인물 관계도 왼쪽·기본 진입

사용자는 관계도 종류 탭을 왼쪽 `인물 관계도`, 오른쪽 `가계도` 순서로 바꾸고 관계도 메뉴에 처음 들어가면 인물 관계도가 보이길 요청했다. 종류와 가족 상세 상태가 없는 `nav=graph`는 인물 관계도를 열고 가계도를 선택하면 `relationMode=family`를 명시한다. 명시적 종류 선택이 우선하며 종류가 없는 기존 가족 보기·중심·후보·관계·원문 상세 링크는 가족 화면으로 호환한다. 이전 가족 기본 진입 선호를 이 결정으로 대체하되 가족 기능·근거·분석 정책은 유지한다. 현재 프로필 모달을 무지정 인물 관계도 위에 노출하지 않고 탭 키보드 이동도 새 순서를 따른다. 기존 Pencil transport 연결 실패로 동기화는 대기한다.


## 2026-10-30 — 관계도 리뷰 지적 수정 승인

사용자는 PR의 재조회 오류 시 수정 초안 유실과 부분 분석 상태 누락을 수정하도록 승인했다. 같은 범위의 일시적 조회 실패에서는 열린 편집을 유지하고, 이용불가 응답과 작품·회차·세션 변경은 기존 정보 격리 경계로 둔다. 부분 분석은 관계가 0개여도 의미가 맞는 짧고 중립적인 안내만 추가하며 필수 검토 큐는 만들지 않는다.
