# Final QA — round 1

**Date:** 2026-08-25T01:29:46+09:00
**Artifacts:** `UserMenu.tsx`, `MemberWithdrawalModal.tsx`, `SLanding.tsx`, `workspace-v2.css`, `overlay-v2.css`, `landing-v2.css`, related docs and E2E
**DESIGN.md read at:** 2026-08-25T01:27:40+09:00
**Prior reviews:** `.reviews/designer-review-round-1.md`, `.reviews/designer-review-round-2.md`
**Voice preset:** project ko-KR UI microcopy (long-form preset not applicable)

## Rubric

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Brand consistency | PASS | `DESIGN.md:9,38`의 landing/workspace 범위를 지켰다. workspace UI는 `src/styles/workspace-v2.css:125-139`의 Theme V2 토큰을, landing notice는 `src/app/components/catchhole/landing-v2.css:10-39`의 status 토큰과 16/10px radius scale을 사용한다. |
| 2 | Typography hierarchy | PASS | landing은 `SLanding.tsx:178,205,227,244,257`에서 h1→h2→h3 순서를 지키고, 모달 제목은 `MemberWithdrawalModal.tsx:143-148`의 `Dialog.Title`로 해당 page heading 아래에 위치한다. |
| 3 | Voice register | PASS | `MemberWithdrawalModal.tsx:27-50,145-167,214-215`의 안내·오류 문구가 구체적인 대상과 다음 행동을 한국어 존댓말로 설명하며 추상적인 AI·마케팅 표현을 추가하지 않는다. |
| 4 | Image / figure | PASS | 이번 기능의 유일한 이미지인 프로필 아바타는 `UserMenu.tsx:114-118,142-145`에서 옆의 이름과 중복되는 장식 이미지이므로 `alt=""`로 보조기술에서 제외했다. 콘텐츠 figure를 추가하지 않았다. |
| 5 | Cross-locale parity | PASS | `DESIGN.md:190-194`가 지원 locale을 ko-KR 하나로 선언하며 이번 기능도 한국어 canonical UI만 추가해 locale 간 누락이 발생하지 않는다. |
| 6 | Accessibility | FAIL | menu/dialog semantics, focus trap, 44px hit area, `lang="ko"`는 충족하지만 danger text 대비가 AA 4.5:1에 미달한다. `--ch-danger`는 흰색 대비 3.91:1이고 7% danger 배경 대비 3.60:1이다. |
| 7 | Performance | PASS | production build가 성공했고 추가 이미지가 없다. build 산출 이미지 최대값은 148.29kB로 500kB 기준 미만이며 추가 외부 폰트나 코드 블록도 없다. |
| 8 | Links | PASS | 이번 기능의 TSX와 CSS에는 신규 hyperlink나 외부 navigation이 없다. 성공 시 기존 내부 route `/landing`만 `UserMenu.tsx:64-72`에서 replace한다. |

## Failed items detail

### [6] Accessibility — danger action text contrast

- **Location:** `src/styles/overlay-v2.css:268`
- **Evidence:** `.member-withdrawal-modal__confirm { ... background: var(--ch-danger); color: #fff; }`에서 `#fff` / `#df4d5f` 대비는 **3.91:1**로, 14px 텍스트의 AA 4.5:1에 미달한다.
- **Location:** `src/styles/workspace-v2.css:76-78`
- **Evidence:** `.user-menu__item--danger { ... color: var(--user-menu-danger); }`의 workspace 값 `#df4d5f`는 7% danger soft 배경(`#fdf3f4`) 대비 **3.60:1**이다.
- **Fix:** 메뉴 danger text는 `--ch-danger-ink`를 사용하고, 확정 버튼은 `--ch-danger-ink` 배경 + `--ch-primary-contrast` 텍스트로 바꾼 뒤 다시 대비와 E2E를 검증한다.

## Validation evidence

- `npm run build`: PASS (existing large JavaScript chunk warning only)
- `npm run lint -- --quiet`: PASS
- `git diff --check`: PASS
- `npm run test:e2e -- e2e/member-withdrawal.spec.ts`: 4/4 PASS
- Designer review round 2: PASS (BLOCK 0, WARN 0)

## Verdict

**REVISION** (round 1) — accessibility 1 item FAIL. Danger text/background contrast를 수정한 뒤 round 2를 수행한다.
