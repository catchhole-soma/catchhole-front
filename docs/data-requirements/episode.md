# 데이터 요구사항 — Episode(회차)

[← 전체 인덱스](./README.md)


> 회차 업로드 플로우(SEpisodeUpload)는 [upload.md](./upload.md)로 분리했다. 이 문서는 업로드 이후의 회차 조회·관리를 다룬다.

## 목차

- [원고 목록 (대시보드 원고 탭)](#원고-목록-대시보드-원고-탭)

---

## 원고 목록 (대시보드 원고 탭)

**URL**: [`/dashboard`](https://www.catchhole.com/dashboard) (원고 네비)

![대시보드 - 원고 탭](../screens/pUaEk.png)

**1. 화면에 표시할 데이터**
- 회차 행: 회차 번호, 제목, 업로드일, 글자 수, 분석 상태
- 업로드한 설정집: 제목 미리보기


**2. 사용자 액션**
- 회차 클릭 → 상세 / 에디터(MVP 범위 밖)
- 회차 업로드 → [회차 업로드](./upload.md#회차-업로드-sepisodeupload)
- 회차 삭제
- 설정집 클릭 → 원문 보기, 설정집 수동 업로드 ([FE #27 리뷰 합의](https://github.com/catchhole-soma/catchhole-front/pull/27#discussion_r3570356580))

**3. 화면 전환 식별자**
- `episodeId`


**4. 데이터 없음 / 실패 표시**
- 회차 0개: 빈 상태 ([빈 상태](../screens/v4hg9.png))
- 조회 실패

**5. BE에 요청할 데이터**
- 작품의 회차 목록: 회차 번호, 제목, 업로드일, 글자 수, 분석 상태(`EpisodeStatus`) — 목록/상세/수정/삭제 API 계약은 [BE episode.md](https://github.com/catchhole-soma/catchhole-backend-java/blob/main/docs/episode.md) 기준
- 설정집 목록(제목·업로드 시점)·원문 조회·수동 업로드 API — 현행 계약에 설정집 엔드포인트가 없어 신설 필요. 이게 정해져야 FE가 설정집 원문 보기·수동 업로드를 붙일 수 있음

**6. BE와 협의할 범위·상태값**
- 회차별 충돌 건수는 목록 표시에서 제외 — 충돌·리포트 기능 계약이 나온 뒤 필요 시 재검토
- 설정집 저장 모델·API 계약 신설 — 업로드 플로우로 들어온 설정집 파일의 저장·조회 방식 포함
- 분할 회차(예: 151-1) 표기 방식 — BE `episodeNo`가 정수라 현 모델과 충돌, 표기 정책 협의 필요
- 삭제는 현재 hard delete — 복구 불가 안내(확인 모달) 문구, soft delete(`ARCHIVED`) 전환 여부는 BE TODO와 동일 논의
