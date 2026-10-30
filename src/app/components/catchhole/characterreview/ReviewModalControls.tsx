import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { C } from '../constants';
import { REVIEW_TEXT, reviewToneInk } from '../review-v2-colors';

export function ActionButton({
  children,
  disabled = false,
  disabledTitle,
  title,
  tone = C.t2,
  type = 'button',
  ariaPressed,
  ariaDescribedBy,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  disabledTitle?: string;
  /** 사용할 수 있을 때의 보조 설명. */
  title?: string;
  ariaDescribedBy?: string;
  tone?: string;
  type?: 'button' | 'submit';
  ariaPressed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      aria-pressed={ariaPressed}
      aria-describedby={ariaDescribedBy}
      onClick={onClick}
      className="review-action"
      title={disabled ? disabledTitle : title}
      style={{
        minHeight: 38, padding: '0 18px', borderRadius: 7,
        border: `1px solid ${disabled ? C.border : tone}`,
        background: disabled ? C.bg : `${tone}12`,
        color: disabled ? REVIEW_TEXT.muted : reviewToneInk(tone), fontFamily: 'inherit',
        fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.58 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function ModalLayer({
  title,
  description,
  pending,
  width = 620,
  onClose,
  children,
}: {
  title: string;
  description: string;
  pending: boolean;
  /** 최대 너비(px). 좁은 화면에서는 항상 화면 너비를 넘지 않는다. */
  width?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const pendingRef = useRef(pending);

  useEffect(() => {
    onCloseRef.current = onClose;
    pendingRef.current = pending;
  }, [onClose, pending]);

  useEffect(() => {
    const previousActiveElement = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
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
  }, []);

  return (
    <div
      className="review-modal-layer"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 220, padding: 24,
        background: 'rgba(4, 4, 8, 0.76)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        className="review-modal"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          width: `min(${width}px, 100%)`, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
          borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface,
          boxShadow: '0 24px 80px rgba(0,0,0,0.58)', padding: 26, boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 id={titleId} style={{ color: REVIEW_TEXT.ink, fontSize: 18, margin: 0 }}>
              {title}
            </h2>
            <p style={{ color: REVIEW_TEXT.muted, fontSize: 12, lineHeight: 1.6, margin: '6px 0 0' }}>
              {description}
            </p>
          </div>
          <button
            type="button"
            aria-label={`${title} 닫기`}
            disabled={pending}
            onClick={onClose}
            style={{
              border: 'none', background: 'transparent', color: REVIEW_TEXT.muted,
              padding: 4, lineHeight: 0, cursor: pending ? 'default' : 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
