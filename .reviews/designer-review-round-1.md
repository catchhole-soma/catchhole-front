# Designer review — round 1

**Date:** 2026-08-25T01:22:47+09:00
**Artifact:** `src/app/components/catchhole/UserMenu.tsx` (supporting: `MemberWithdrawalModal.tsx`, `workspace-v2.css`, `overlay-v2.css`, `landing-v2.css`)
**DESIGN.md:** `DESIGN.md`
**DESIGN.md reread:** 2026-08-25T01:21:00+09:00
**Viewport:** both

## Summary

- BLOCK: 2
- WARN: 3
- FYI: 1

## Issues

### [BLOCK] 사용자 메뉴 트리거의 실제 클릭 영역이 44px보다 작음

- **Location:** `src/styles/workspace-v2.css:31-36`
- **Rule:** Mobile responsiveness — interactive hit area must be at least 44×44px.
- **Evidence:** wrapper는 44px이지만 실제 `<button class="user-menu__trigger">`가 36×36px이어서 주변 4px은 클릭 대상이 아니다.
- **Fix suggestion:** 버튼 자체는 44×44px로 만들고, 내부에 36px 시각 아바타를 둔다.

### [BLOCK] 메뉴·모달·성공 안내 버튼의 active 상태가 정의되지 않음

- **Location:** `src/styles/workspace-v2.css:59-70`, `src/styles/overlay-v2.css:223-269`, `src/app/components/catchhole/landing-v2.css:34-38`
- **Rule:** Component states — applicable interactive controls require default, hover, focus-visible, active, and disabled states.
- **Evidence:** hover/focus/disabled는 있으나 누름 상태를 구분할 active 규칙이 없다.
- **Fix suggestion:** 활성 버튼에만 1px 이동 또는 미세 scale을 적용하고 disabled에는 적용되지 않도록 제한한다.

### [WARN] 메뉴와 성공 안내의 radius 값이 Theme V2 scale에서 벗어남

- **Location:** `src/styles/workspace-v2.css:43,61`, `src/app/components/catchhole/landing-v2.css:22`
- **Rule:** Radius scale — repository Theme V2 uses 10, 16, 24, 32 and pill geometry.
- **Evidence:** popover와 notice가 14px, menu item이 9px을 사용한다.
- **Fix suggestion:** popover·notice는 16px, menu item은 10px로 정렬한다.

### [WARN] 복구 불가 경고와 오류 안내가 모바일에서 12px임

- **Location:** `src/styles/overlay-v2.css:237,249-250`
- **Rule:** Mobile responsiveness — text below 14px should be reviewed for readability.
- **Evidence:** 파괴적 작업의 핵심 경고·오류·확인 힌트가 12px이다.
- **Fix suggestion:** 위험 경고와 검증 피드백을 13–14px로 올리고 현재 line-height를 유지한다.

### [WARN] 사용자 메뉴의 120ms 이동 애니메이션에 reduced-motion 분기가 없음

- **Location:** `src/app/components/catchhole/UserMenu.tsx:133-134`
- **Rule:** DESIGN.md § Foundations — reduced motion is required.
- **Evidence:** CSS 모달과 랜딩 알림은 reduced-motion을 처리하지만 Motion popover는 항상 y 이동을 실행한다.
- **Fix suggestion:** `useReducedMotion()`에 따라 initial/exit 이동과 duration을 제거한다.

### [FYI] landing-only DESIGN.md를 인증 workspace에 확장 적용하지 않음

- **Location:** `DESIGN.md:33-34`, `src/styles/workspace-v2.css:117-131`
- **Rule:** DESIGN.md § Avoid — do not apply the landing-only contract to authenticated workspace routes.
- **Evidence:** 사용자 메뉴는 landing `#125DE6` 대신 repository `--ch-*` Theme V2 토큰과 danger 의미색을 사용한다.
- **Fix suggestion:** 현재 경계를 유지한다.

## Verdict

- **BLOCK** — hit area와 component active state를 수정한 뒤 round 2 재검수가 필요하다.
