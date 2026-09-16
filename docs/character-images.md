# 캐릭터 카드와 대표 이미지 — GH194

번호 안내: 2026-09-16 main 통합으로 미배포 GH194 migration을 V55~V60에서 **V57~V62**로 이동했다. 아래 계약은 최종 번호로 표기하며, 이전 검증 실행 당시에는 각 번호가 2씩 작았다. SQL 내용과 기존 사용자 선택은 보존했다.

<!-- 생성 프롬프트는 아래 자산 기록을 따른다. -->

목록 카드 높이 177px와 기존 반응형 열·페이지 구성은 유지한다. 왼쪽 이미지와 오른쪽 이름·첫 등장 회차만 표시하며 회차가 없으면 `첫 등장 회차 미확인`으로 안내한다. 나이·대표 설정과 영문 라벨은 카드에서 제거하고 상세의 기존 편집·이력·근거는 유지한다.

`이미지 변경`은 `modal=char-detail&charId=...&mode=image`로 표현한다. 직접 진입·새로고침·뒤로가기를 지원하며 닫으면 같은 상세와 목록 페이지로 돌아간다. 공개 데모는 번들 기본 그림을 표시하고 이미지 변경 API를 호출하지 않는다.

## 선택 방식

- 기존 종족 도감의 이름·별칭 검색과 직접 선택.
- 외형을 특정하지 않는 공통 기본 이미지 직접 선택.
- 종족 정보에 따라 자동 선택: 확정된 종족의 명확한 단일 일치만 Backend가 확정/수정 시 저장한다. 조회에서는 재매칭하지 않는다. 이름만 있거나 불명확하면 공통 기본 그림을 표시한다.
- 같은 작품의 내 이미지 보관함·암호화 업로드·선택을 세계관과 공유한다. CHI1·잠금·키 보관 안내는 [개인 이미지 계약](private-world-images.md)을 따른다.

카드는 목록 응답의 image만 사용하며 카드마다 상세 요청을 하지 않는다. 공용 그림은 예시임을 상세·선택창에서 알린다. 직접 선택은 자동 연결보다 우선하며 버전 충돌 시 선택 초안을 유지하고 최신 조회 뒤 다시 저장한다. 공통 기본을 직접 고르면 종족 정보가 추가되어도 그대로 유지한다.

## 자산과 검증

- 번들: `src/assets/characters/character-neutral-v1.webp`, 640×640, 약 19KB.
- 원본·이름·SHA 인덱스: 상위 workspace `design-assets/characters/default/character-neutral-v1.png`, `ASSET_INDEX.json`.
- 제작 도구: 기본 image_gen. 원본을 보존하고 배포용 WebP만 크기·용량을 최적화했다.
- 특정 성별·나이·종족·성격을 뜻하지 않는 안개 속 인물 윤곽이다. 새 종족 그림은 만들지 않고 기존 도감을 재활용한다.

`e2e/character-images-live.spec.ts`는 별도 로컬 계정·작품·캐릭터 fixture에서 카드 높이·표시 항목·모바일 넘침, 도감 선택, 409 초안 유지, 기본/자동 복귀, URL 복원, 개인 업로드·잠금·복구, 세계관 공유·사용 중 삭제 방지를 확인한다. 실제 작가 계정의 보관함이나 키를 사용하지 않는다.

## 생성 프롬프트

```text
Use case: stylized-concept.
Asset type: neutral default portrait artwork for a fantasy novel character card in Catchhole.
Primary request: one square polished cinematic fantasy illustration for a character whose appearance is unknown. A single quiet, softly suggested head-and-shoulders silhouette made from layered pearl-grey mist, facing forward, emerging gently from a diffuse blue-grey and warm ivory background. Identity must remain unreadable: no eyes, nose, mouth, visible skin, hair, ears, horns, gender, age, race, identifiable costume, weapons, armor, halo, wings or emblems. The head and shoulders should be recognisable only as an abstract placeholder for a person, with soft edges fading into luminous fog, not a hooded assassin, ghost, horror monster or specific character.
Style: refined semi-realistic fantasy concept art, subtle natural light, atmospheric depth, elegant and calm, inviting rather than sinister. Use the finish of high-quality fantasy landscape paintings but extremely simple portrait composition.
Composition: centered large silhouette, plenty of breathing room, readily legible at 110px thumbnail, comfortable square and portrait crops. Restrained cool grey-blue midtones with a little warm light; clear tonal separation without dramatic blackness.
Constraints: single image, no text, no lettering, no watermark, no border, no multi-panel layout.
```
