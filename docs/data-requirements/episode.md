# 데이터 요구사항 — Episode(회차)

[← 전체 인덱스](./README.md)

> 회차 업로드 플로우(SEpisodeUpload)는 [upload.md](./upload.md)로 분리했다. 이 문서는 업로드 이후의 회차 조회·관리를 다룬다.

## 목차

- [원고 목록 (대시보드 원고 탭)](#원고-목록-대시보드-원고-탭)

---

## 원고 목록 (대시보드 원고 탭)

**URL**: [`/dashboard`](https://catch-hole.vercel.app/dashboard) (원고 네비)

![대시보드 - 원고 탭](../screens/pUaEk.png)

**1. 화면에 표시할 데이터**
- 회차 행: 회차 번호, 제목, 업로드일, 글자 수, 충돌 건수, 분석 상태

**2. 사용자 액션**
- 회차 클릭 → 상세 / 에디터(MVP 범위 밖)
- 회차 업로드 → [회차 업로드](./upload.md#회차-업로드-sepisodeupload)
- 회차 삭제

**3. 화면 전환 식별자**
- `episodeId`

**4. 데이터 없음 / 실패 표시**
- 회차 0개: 빈 상태 ([빈 상태](../screens/v4hg9.png))
- 조회 실패

**5. BE에 요청할 데이터**
- 작품의 회차 목록: 회차 번호, 제목, 업로드일, 글자 수, 분석 상태(`EpisodeStatus`) — 목록/상세/수정/삭제 API 계약은 [BE episode.md](https://github.com/catchhole-soma/catchhole-backend-java/blob/main/docs/episode.md) 기준
- 충돌 건수는 현재 계약에 없음 — 6번 협의 항목

**6. BE와 협의할 범위·상태값**
- 6-1. 회차별 충돌 건수·분석 상태를 목록에서 바로 줄 수 있는지, 화면엔 어디까지 표시할지
- 6-2. 분할 회차(예: 151-1) 표기 방식 — BE `episodeNo`가 정수라 현 모델과 충돌, 표기 정책 협의 필요
- 6-3. 삭제는 현재 hard delete — 복구 불가 안내(확인 모달) 문구, soft delete(`ARCHIVED`) 전환 여부는 BE TODO와 동일 논의
