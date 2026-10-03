import { useCallback, useLayoutEffect, useRef } from 'react';

/** Keep the clicked sidebar in place when a shorter detail replaces the current one. */
export function useReviewScrollStability(contextKey: string) {
  const mainRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const reservedHeight = useRef(0);

  const clearReservation = useCallback(() => {
    reservedHeight.current = 0;
    if (contentRef.current) contentRef.current.style.minHeight = '';
  }, []);

  const preserveViewport = useCallback(() => {
    const main = mainRef.current;
    const content = contentRef.current;
    // Mobile switches between a list and a detail instead of showing them side by side.
    if (!main || !content || window.matchMedia('(max-width: 768px)').matches || main.scrollTop <= 0) return;
    // Reserve only the visible viewport, not the old detail's entire scroll height.
    // Apply before the URL/state update so the browser never clamps scrollTop to zero.
    reservedHeight.current = main.scrollTop + main.clientHeight;
    content.style.minHeight = `${reservedHeight.current}px`;
  }, []);

  useLayoutEffect(() => {
    clearReservation();
  }, [contextKey, clearReservation]);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const releaseWhileScrollingUp = () => {
      const content = contentRef.current;
      if (!content || !reservedHeight.current) return;
      if (main.scrollTop <= 0) {
        clearReservation();
      } else {
        const minimum = main.scrollTop + main.clientHeight;
        if (minimum < reservedHeight.current) {
          reservedHeight.current = minimum;
          content.style.minHeight = `${minimum}px`;
        }
      }
    };
    let width = main.clientWidth;
    let height = main.clientHeight;
    const observer = new ResizeObserver(() => {
      if (main.clientWidth !== width || main.clientHeight !== height) {
        clearReservation();
        width = main.clientWidth;
        height = main.clientHeight;
      }
    });
    observer.observe(main);
    main.addEventListener('scroll', releaseWhileScrollingUp, { passive: true });
    return () => {
      observer.disconnect();
      main.removeEventListener('scroll', releaseWhileScrollingUp);
    };
  }, [contextKey, clearReservation]);

  return { mainRef, contentRef, preserveViewport };
}
