# 랜딩 인물 예시 이미지

## 랜딩 서비스 카드 (2026-10-12)

- `catchhole-upload-friendly-v1.png`: 원고를 정리하는 파란 트레이와 종이. 업로드 서비스 카드용.
- `catchhole-analysis-friendly-v1.png`: 원고에서 캐릭터·세계관 카드가 정리되는 열린 노트. AI 분석 서비스 카드용.
- 내장 GPT 이미지 생성 도구로 새로 생성한 투명 배경 일러스트. PNG 원본과 알파를 보존하며 카드 안에서 `object-fit: contain`으로 전체 형상을 보여준다.
- [최종 생성 프롬프트](friendly-illustration-prompts.md). 기존 어두운 이미지 파일은 다른 화면의 참조를 위해 보존한다.

## 리엔 예시

- `rien-fire-mage.webp`: 랜딩 영상 위 리엔(직업: 마법사) 카드용.
- 원본: `design-assets/world-subjects/magic-abilities/2026-09-15-v1/05-fire.png` (CatchHole에서 생성한 불 마법 도감 이미지).
- 원본 구도를 유지하여 768×512 WebP, quality 84로 변환했다. 썸네일은 CSS `object-position: left center`로 왼쪽 마법사가 보이게 표시한다.
- 실제 캐릭터의 중립 기본 이미지와 별도로 사용한다.

## 현재 제품 화면 · 2026-10-12

`product-*-20261012.png`는 GPT 생성 그림이나 예전 미니어처 UI가 아닌 현재 코드의 공개 `/demo`에서 새로 캡처한 화면이다. 모든 내용은 `interactiveDemoFixture.ts`의 가상 원고·인물·세계관이다. 전체 탭 화면을 축소하지 않고 핵심 영역을 실제 비율로 확대/부분 노출한다.

| 에셋 | 캡처 대상 |
| --- | --- |
| product-manuscript | 현재 공개 체험의 원문 카드 |
| product-review / product-review-mobile | `PublicCharacterReviewExample` → 실제 `CandidateDetail`, 원문 근거 펼침 |
| product-character | 실제 `CharacterDatabase`의 에단 렌 상세 |
| product-world | 실제 `WorldSettingDatabase`의 거꾸로숲 상세 |
| product-timeline | 실제 `CharacterTimelineModal`, 직업 필터, 6화/1화 |

갱신: `CATCHHOLE_CAPTURE_LANDING=1 CATCHHOLE_E2E_PORT=3102 npm run test:e2e -- e2e/landing-assets.spec.ts --workers=1`. 이 opt-in 시나리오는 기존 `/demo`의 버튼을 순서대로 누르고 현재 컴포넌트를 캡처한다. 캡처 동안 안내 코치마크·가이드 윤곽선·고정 헤더만 숨기며 제품 데이터나 화면 레이아웃을 합성하지 않는다. 기능 화면이 변경되면 이 캡처를 다시 생성하고 랜딩의 데스크톱·모바일 구도를 검증한다.

2026-10-31 #211 후속 반영 뒤 같은 파일명으로 다시 캡처했다. `product-review`·`product-review-mobile`은 근거 끝의 연결 상태 줄 생략(#211 3차), 제목 아래 회차 표기 `6화`, 원문 근거 상자 여백이, `product-world`는 이력 안내 `설정 후보 확정과 직접 입력으로 갱신됨`(설정집 출처 반영)이 바뀌었다. `product-manuscript`·`product-character`·`product-timeline`은 그대로다. 확정 버튼(`모두 확정`)은 캡처 범위 밖이다. 1440·390px 랜딩에서 구도와 가로 넘침 없음을 확인했다.

참고: [Craft](https://www.craft.do/ko) 작성 섹션, [Linear](https://linear.app/) Planning and monitoring 섹션. 해당 사이트의 자산을 복제하지 않았다.

## Public demo completion — 2026-10-12

- `catchhole-story-world-v1.png`: 1536×1024, built-in GPT image generation. Paper manuscript opening into a miniature story world; the image composition defines the completion hero layout. Left negative space holds live text and buttons; mobile shows the artwork below live copy.
- Prompt and provenance: `story-world-prompt.md`. Decorative illustration, not an actual product screenshot. The original generated image is preserved.
