import * as Dialog from '@radix-ui/react-dialog';
import { useRef, type ReactNode, type KeyboardEventHandler } from 'react';
import { X } from 'lucide-react';

/** Shared world-setting dialog: keeps focus and scrolling inside the active layer. */
export function WorldSettingDialog({
  title, description, children, onClose, pending = false, className = '',
  modal = true, role = 'dialog', returnFocusId, onKeyDown,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  pending?: boolean;
  className?: string;
  modal?: boolean;
  role?: 'dialog' | 'alertdialog';
  returnFocusId?: string;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open modal={modal} onOpenChange={open => { if (!open && !pending) onClose(); }}>
      <Dialog.Portal container={!modal ? document.querySelector<HTMLElement>('.interactive-demo-page') : undefined}>
        <div className="theme-v2 database-v2 world-setting-dialog-layer">
          <Dialog.Overlay className="world-setting-dialog-backdrop" />
          <Dialog.Content
            role={role}
            onKeyDown={onKeyDown}
            className={`database-modal world-setting-dialog ${className}`}
            {...(description ? {} : { 'aria-describedby': undefined })}
            onOpenAutoFocus={event => {
              event.preventDefault();
              returnFocusRef.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
                ? document.activeElement : null;
              // The public demo keeps the reader's position and its coachmark accessible.
              if (modal) titleRef.current?.focus({ preventScroll: true });
            }}
            onCloseAutoFocus={event => {
              event.preventDefault();
              if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus({ preventScroll: true });
              else if (returnFocusId) {
                const item = document.querySelector<HTMLElement>(`[data-world-setting-id="${CSS.escape(returnFocusId)}"]`);
                (item ?? document.querySelector<HTMLElement>('.world-setting-search__input'))?.focus({ preventScroll: true });
              }
            }}
            onEscapeKeyDown={event => { if (pending) event.preventDefault(); }}
            onInteractOutside={event => { if (pending || !modal) event.preventDefault(); }}
          >
            <div className="database-modal__header world-setting-dialog__header">
              <div>
                <Dialog.Title ref={titleRef} tabIndex={-1}>{title}</Dialog.Title>
                {description && <Dialog.Description>{description}</Dialog.Description>}
              </div>
              <button type="button" className="database-modal__close" aria-label="닫기" disabled={pending} onClick={onClose}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="world-setting-dialog__content">{children}</div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
