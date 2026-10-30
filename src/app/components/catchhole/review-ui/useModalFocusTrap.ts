import { useEffect, useRef, type RefObject } from 'react';

/**
 * 검토 화면 모달의 키보드 계약. 열면 첫 조작 요소로 초점을 옮기고, Tab을 모달 안에 가두며, Esc로 닫고(요청 중이면 무시),
 * 닫히면 연 요소로 초점을 돌려준다. 열려 있는 동안 뒤 화면은 스크롤하지 않는다.
 */
export function useModalFocusTrap(dialogRef: RefObject<HTMLElement | null>, pending: boolean, onClose: () => void,
  /** 모달을 연 요소. 열리는 동안 그 요소가 잠기면(disabled) 열린 뒤의 activeElement로는 찾을 수 없어 연 쪽에서 넘긴다. */
  returnFocusTo?: HTMLElement | null) {
  const returnFocusRef = useRef(returnFocusTo);
  const onCloseRef = useRef(onClose);
  const pendingRef = useRef(pending);

  useEffect(() => {
    onCloseRef.current = onClose;
    pendingRef.current = pending;
  }, [onClose, pending]);

  useEffect(() => {
    const previousActiveElement = returnFocusRef.current ?? (document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null);
    const dialog = dialogRef.current;
    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const focusableElements = () => (
      dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)) : []
    );
    (focusableElements()[0] ?? dialog)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pendingRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [dialogRef]);
}
