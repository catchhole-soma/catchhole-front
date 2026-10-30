import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';

type ReviewShortcut = 'next-card' | 'previous-card' | 'next-group' | 'previous-group' | 'primary' | 'blocking';

/** 글자를 입력하는 컨트롤. 체크박스·라디오·버튼형 input은 단축키를 받아도 입력을 잃지 않는다. */
const NON_TEXT_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(target.type);
}

/**
 * 검토 상세의 단축키(D7). Alt 조합만 쓰고, 입력·선택 컨트롤에 초점이 있거나 한글 조합(IME) 중이면 해석하지 않는다.
 * - Alt+↓/↑: 다음/이전 후보 카드  - Alt+Shift+↓/↑: 다음/이전 묶음
 * - Alt+Enter: 확정 버튼으로 초점(실행하지 않음)  - Alt+.: 다음 미결정 항목
 */
export function reviewShortcutFor(event: ReactKeyboardEvent<HTMLElement>): ReviewShortcut | null {
  if (!event.altKey || event.ctrlKey || event.metaKey) return null;
  if (event.nativeEvent.isComposing || event.keyCode === 229) return null;
  if (isTextEntry(event.target)) return null;
  if (event.key === 'ArrowDown') return event.shiftKey ? 'next-group' : 'next-card';
  if (event.key === 'ArrowUp') return event.shiftKey ? 'previous-group' : 'previous-card';
  if (event.shiftKey) return null;
  if (event.key === 'Enter') return 'primary';
  // macOS의 Option+.은 다른 글자를 만들므로 물리 키 위치로 판단한다.
  if (event.code === 'Period') return 'blocking';
  return null;
}

/** 상세 패널(`containerRef`)의 keydown 처리기를 만든다. 처리한 단축키만 기본 동작을 막는다. */
export function useReviewKeyboardNavigation({ containerRef, disabled = false, stepCard, stepGroup, jumpToBlocking }: {
  containerRef: RefObject<HTMLElement | null>;
  /** 모달이 열려 있는 등 단축키를 받지 않을 때. */
  disabled?: boolean;
  stepCard: (direction: 1 | -1) => boolean;
  stepGroup: (direction: 1 | -1) => boolean;
  jumpToBlocking: () => boolean;
}) {
  return (event: ReactKeyboardEvent<HTMLElement>) => {
    if (disabled || event.defaultPrevented) return;
    const shortcut = reviewShortcutFor(event);
    if (!shortcut) return;
    let handled = false;
    if (shortcut === 'next-card' || shortcut === 'previous-card') handled = stepCard(shortcut === 'next-card' ? 1 : -1);
    else if (shortcut === 'next-group' || shortcut === 'previous-group') handled = stepGroup(shortcut === 'next-group' ? 1 : -1);
    else if (shortcut === 'blocking') handled = jumpToBlocking();
    else {
      const button = containerRef.current?.querySelector<HTMLElement>('[data-review-primary-action]');
      button?.focus();
      handled = Boolean(button);
    }
    if (handled) event.preventDefault();
  };
}
