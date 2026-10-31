/**
 * 설정 검토 화면의 스크롤·초점 위치를 sessionStorage에 보관한다.
 *
 * 탭·필터·페이지·선택 그룹은 URL이 담당한다. 스크롤과 초점 후보는 공유 링크에 의미가 없고
 * history를 늘리지 않아야 하므로 URL에 넣지 않는다. 탭 전환은 화면을 언마운트하므로 메모리 상태로는
 * 부족하고, 세션 범위라 다른 작품·계정으로 이어지지 않는다.
 */
export type ReviewCandidateType = 'character' | 'world';

export interface ReviewPosition {
  scrollTop: number;
  candidateId: string | null;
  groupKey: string | null;
  savedAt: number;
}

type PositionStorage = Pick<Storage, 'getItem' | 'setItem'>;

const KEY_PREFIX = 'catchhole:review-position';
export const REVIEW_POSITION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function reviewPositionKey({ workId, batchId, sourceAnalysisJobId, candidateType }: {
  workId: string;
  batchId: string;
  sourceAnalysisJobId?: string | null;
  candidateType: ReviewCandidateType;
}): string {
  return `${KEY_PREFIX}:${workId}:${batchId}:${sourceAnalysisJobId || 'EPISODE'}:${candidateType}`;
}

function sessionStore(): PositionStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveReviewPosition(
  key: string,
  position: Omit<ReviewPosition, 'savedAt'>,
  now = Date.now(),
  storage: PositionStorage | null = sessionStore(),
): void {
  try {
    storage?.setItem(key, JSON.stringify({ ...position, savedAt: now }));
  } catch {
    // 저장소가 막혀도 검토는 계속한다.
  }
}

export function readReviewPosition(
  key: string,
  now = Date.now(),
  storage: PositionStorage | null = sessionStore(),
): ReviewPosition | null {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ReviewPosition>;
    if (typeof value.scrollTop !== 'number' || !Number.isFinite(value.scrollTop) || value.scrollTop < 0) return null;
    if (typeof value.savedAt !== 'number' || now - value.savedAt > REVIEW_POSITION_MAX_AGE_MS) return null;
    return {
      scrollTop: value.scrollTop,
      candidateId: typeof value.candidateId === 'string' ? value.candidateId : null,
      groupKey: typeof value.groupKey === 'string' ? value.groupKey : null,
      savedAt: value.savedAt,
    };
  } catch {
    return null;
  }
}
