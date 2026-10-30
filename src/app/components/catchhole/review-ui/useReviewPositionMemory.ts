import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { readReviewPosition, saveReviewPosition } from '../../../lib/review-position-store';

function candidateElement(root: HTMLElement, candidateId: string): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-candidate-id]'))
    .find(element => element.dataset.candidateId === candidateId);
}

/**
 * 검토 화면의 스크롤·초점 후보를 탭 전환·새로고침·분석 목록 왕복 뒤 한 번 복원한다.
 *
 * 저장은 언마운트(탭 전환·목록 이동)와 beforeunload(새로고침)에서 한다. 복원은 URL의 선택 그룹이
 * 저장 당시와 같을 때만 하고, 복원을 시도하기 전에는 저장하지 않아 빈 위치로 덮어쓰지 않는다.
 */
export function useReviewPositionMemory({ mainRef, storageKey, groupKey, ready }: {
  mainRef: RefObject<HTMLElement>;
  storageKey: string | null;
  groupKey: string | null;
  ready: boolean;
}) {
  // StrictMode의 가짜 언마운트 저장보다 먼저 읽어 둔다.
  const [initialPosition] = useState(() => storageKey ? readReviewPosition(storageKey) : null);
  const scrollTopRef = useRef(0);
  const candidateIdRef = useRef<string | null>(null);
  const groupKeyRef = useRef(groupKey);
  const settledRef = useRef(false);

  useEffect(() => {
    // 다른 그룹으로 옮기면 이전 그룹의 초점 후보는 복원 대상이 아니다.
    if (groupKeyRef.current !== groupKey) candidateIdRef.current = null;
    groupKeyRef.current = groupKey;
  }, [groupKey]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main || !storageKey) return;
    const trackScroll = () => { scrollTopRef.current = main.scrollTop; };
    // 탭·필터처럼 후보 밖으로 초점이 옮겨도 마지막으로 읽던 후보를 기억한다.
    const trackFocus = (event: FocusEvent) => {
      const owner = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-candidate-id]') : null;
      if (owner?.dataset.candidateId) candidateIdRef.current = owner.dataset.candidateId;
    };
    main.addEventListener('scroll', trackScroll, { passive: true });
    main.addEventListener('focusin', trackFocus);
    return () => {
      main.removeEventListener('scroll', trackScroll);
      main.removeEventListener('focusin', trackFocus);
    };
  }, [mainRef, storageKey]);

  const save = useCallback(() => {
    if (!storageKey || !settledRef.current) return;
    saveReviewPosition(storageKey, {
      scrollTop: scrollTopRef.current,
      candidateId: candidateIdRef.current,
      groupKey: groupKeyRef.current,
    });
  }, [storageKey]);

  useEffect(() => {
    window.addEventListener('beforeunload', save);
    return () => {
      window.removeEventListener('beforeunload', save);
      save();
    };
  }, [save]);

  useLayoutEffect(() => {
    if (!ready || settledRef.current) return;
    settledRef.current = true;
    const main = mainRef.current;
    if (!main || !initialPosition || initialPosition.groupKey !== groupKey) return;
    let applied = false;
    // 선택 그룹이 그려진 다음 프레임에 스크롤해야 높이가 확정된 상세에 맞는다.
    const frame = requestAnimationFrame(() => {
      applied = true;
      main.scrollTop = initialPosition.scrollTop;
      scrollTopRef.current = main.scrollTop;
      const target = initialPosition.candidateId ? candidateElement(main, initialPosition.candidateId) : undefined;
      if (target) {
        target.focus({ preventScroll: true });
        candidateIdRef.current = initialPosition.candidateId;
      }
    });
    return () => {
      if (applied) return;
      cancelAnimationFrame(frame);
      settledRef.current = false;
    };
  }, [groupKey, initialPosition, mainRef, ready]);
}
