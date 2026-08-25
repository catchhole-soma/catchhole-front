# Designer review — round 2

**Date:** 2026-08-25T01:26:51+09:00
**Artifact:** `src/app/components/catchhole/UserMenu.tsx` (supporting: `MemberWithdrawalModal.tsx`, `workspace-v2.css`, `overlay-v2.css`, `landing-v2.css`)
**DESIGN.md:** `DESIGN.md`
**DESIGN.md reread:** 2026-08-25T01:26:51+09:00
**Viewport:** desktop and 320×568 mobile

## Summary

- BLOCK: 0
- WARN: 0
- FYI: 1
- Round 1 findings resolved: 5/5

## Round 1 follow-up

### [RESOLVED] 사용자 메뉴 트리거의 실제 클릭 영역

- **Location:** `src/styles/workspace-v2.css:16-45`, `e2e/member-withdrawal.spec.ts:164-174`
- **Evidence:** 실제 `<button>`을 44×44px로 만들고 36px 아바타를 내부 시각 요소로 분리했다. 320px E2E에서도 버튼의 실제 bounding box가 44×44px 이상인지 검증한다.

### [RESOLVED] 메뉴·모달·성공 안내 버튼의 active 상태

- **Location:** `src/styles/workspace-v2.css:43-75`, `src/styles/overlay-v2.css:223-272`, `src/app/components/catchhole/landing-v2.css:34-39`
- **Evidence:** 사용자 메뉴 트리거와 항목, 모달 닫기·취소·확정, 성공 안내 닫기에 active 피드백을 추가했고 disabled 상태에는 destructive action 변형이 적용되지 않는다.

### [RESOLVED] Theme V2 radius scale 정렬

- **Location:** `src/styles/workspace-v2.css:47-76`, `src/app/components/catchhole/landing-v2.css:10-36`
- **Evidence:** popover와 notice는 16px, menu item과 icon button은 10px로 Theme V2 scale에 맞췄다.

### [RESOLVED] 파괴적 작업 경고·오류 안내의 모바일 가독성

- **Location:** `src/styles/overlay-v2.css:232-259`
- **Evidence:** 복구 불가 경고, 확인 힌트, 필드 오류, 폼 오류를 13px과 1.5 이상의 line-height로 올렸고 필드 라벨과 액션은 14px을 유지한다.

### [RESOLVED] 사용자 메뉴 reduced-motion 분기

- **Location:** `src/app/components/catchhole/UserMenu.tsx:10-14`, `src/app/components/catchhole/UserMenu.tsx:130-139`
- **Evidence:** `useReducedMotion()`을 사용해 요청 시 y 이동을 제거하고 전환 시간을 0으로 만든다. 모달과 랜딩 알림의 CSS 애니메이션도 각각 `src/styles/overlay-v2.css:286-288`, `src/app/components/catchhole/landing-v2.css:45-47`에서 제거된다.

## Remaining notes

### [FYI] landing과 인증 workspace의 디자인 범위를 분리함

- **Location:** `DESIGN.md:7-10`, `DESIGN.md:36-40`, `src/styles/workspace-v2.css:117-139`
- **Rule:** landing-only contract를 인증 workspace에 적용하지 않는다.
- **Evidence:** 사용자 메뉴와 탈퇴 모달은 repository Theme V2 `--ch-*` 토큰을 사용하고, `/landing`의 성공 안내만 landing surface 안에서 같은 토큰 체계를 따른다.
- **Fix suggestion:** 현재 경계를 유지한다.

## Validation evidence

- 320×568에서 메뉴·모달 가로 넘침 없음
- 모달 focus trap 및 Escape 후 사용자 메뉴 트리거 focus 복귀 확인
- 모든 주요 상호작용의 hover, focus-visible, active, disabled 상태 확인
- reduced-motion 분기 확인

## Verdict

- **PASS** — BLOCK 0, WARN 0. 구현·브랜드·모바일 상태가 출간 전 최종 QA로 넘어갈 수 있다.
