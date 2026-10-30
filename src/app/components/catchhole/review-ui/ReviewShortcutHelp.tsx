import { useEffect, useId, useRef, useState } from 'react';
import { Keyboard } from 'lucide-react';

const SHORTCUTS: Array<[keys: string, action: string]> = [
  ['Alt + ↓ / ↑', '다음·이전 설정으로 이동'],
  ['Alt + Shift + ↓ / ↑', '다음·이전 묶음으로 이동'],
  ['Alt + Enter', '확정 버튼으로 이동(누르지 않음)'],
  ['Alt + .', '다음 미결정 항목으로 이동'],
];

/** 확정 영역 끝의 단축키 안내. 버튼으로 열고 Esc·바깥 클릭으로 닫으며, 닫으면 버튼으로 초점을 돌린다. */
export function ReviewShortcutHelp() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return <div className="review-shortcut" ref={rootRef} onKeyDown={event => {
    if (event.key !== 'Escape' || !open) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    toggleRef.current?.focus();
  }}>
    <button type="button" ref={toggleRef} className="review-shortcut__toggle" aria-expanded={open} aria-controls={open ? panelId : undefined}
      onClick={() => setOpen(value => !value)}>
      <Keyboard size={14} aria-hidden="true" />단축키
    </button>
    {open && <div id={panelId} className="review-shortcut__panel" role="region" aria-label="검토 단축키">
      <dl>{SHORTCUTS.map(([keys, action]) => <div key={keys}><dt><kbd>{keys}</kbd></dt><dd>{action}</dd></div>)}</dl>
      <p>입력 중이거나 한글을 조합하는 중에는 동작하지 않아요. macOS에서는 Alt 대신 Option을 눌러요.</p>
    </div>}
  </div>;
}
