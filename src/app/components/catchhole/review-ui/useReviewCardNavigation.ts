import { useCallback, useEffect, useRef, type RefObject } from 'react';

const CARD_SELECTOR = '[data-candidate-id]';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** 요소를 상세 스크롤 영역의 위로 가져오고 초점을 둔다. 움직임 줄이기 설정이면 즉시 이동한다. */
export function focusReviewElement(element: HTMLElement) {
  element.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  element.focus({ preventScroll: true });
}

/**
 * 상세 패널(`containerRef`) 안의 후보 카드(`[data-candidate-id]`) 사이 초점 이동.
 *
 * 마지막으로 초점이 머문 카드를 기억한다. 확정 영역의 `다음 미결정 항목`을 누르면 초점이 버튼으로 옮겨 가므로,
 * 그때는 기억한 카드 다음부터 찾는다(연속으로 누르면 차단 후보를 차례로 돈다).
 */
export function useReviewCardNavigation(containerRef: RefObject<HTMLElement | null>) {
  const lastCardRef = useRef<string | null>(null);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const card = target?.closest<HTMLElement>(CARD_SELECTOR);
      if (card && containerRef.current?.contains(card)) lastCardRef.current = card.dataset.candidateId ?? null;
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, [containerRef]);

  const cards = useCallback(() => Array.from(containerRef.current?.querySelectorAll<HTMLElement>(CARD_SELECTOR) ?? []), [containerRef]);

  /** 막는 후보 중 지금(또는 마지막으로) 초점이 있던 카드 다음의 첫 카드로 간다. 끝이면 처음으로 돈다. */
  const jumpToBlocking = useCallback((candidateIds: string[]) => {
    const list = cards();
    const active = document.activeElement;
    let index = list.findIndex(card => card.contains(active));
    // 확정 영역의 버튼을 누른 경우(브라우저에 따라 초점이 버튼 또는 body에 남는다)에는 마지막 카드부터 이어 찾는다.
    // 묶음 제목처럼 상세 안의 다른 곳에 초점이 있으면 처음부터 찾는다.
    const fromActionBar = !active || active === document.body || Boolean(active.closest('.review-action-bar'))
      || !containerRef.current?.contains(active);
    if (index < 0 && lastCardRef.current && fromActionBar) {
      index = list.findIndex(card => card.dataset.candidateId === lastCardRef.current);
    }
    const blocking = list.filter(card => candidateIds.includes(card.dataset.candidateId ?? ''));
    const next = blocking.find(card => list.indexOf(card) > index) ?? blocking[0];
    if (!next) return false;
    lastCardRef.current = next.dataset.candidateId ?? null;
    focusReviewElement(next);
    return true;
  }, [cards, containerRef]);

  /** 초점이 있는 카드의 다음(이전) 카드로 간다. 카드 밖(묶음 제목 등)이면 첫 카드부터 시작한다. */
  const stepCard = useCallback((direction: 1 | -1) => {
    const list = cards();
    const index = list.findIndex(card => card.contains(document.activeElement));
    const next = index < 0 ? direction > 0 ? list[0] : undefined : list[index + direction];
    if (!next) return false;
    focusReviewElement(next);
    return true;
  }, [cards]);

  return { jumpToBlocking, stepCard };
}
