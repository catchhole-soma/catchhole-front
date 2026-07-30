import { C } from './constants';

interface Props {
  page: number;
  totalPages: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}

export function PageNavigation({
  page,
  totalPages,
  disabled = false,
  onPageChange,
}: Props) {
  if (totalPages <= 1) return null;

  const previousDisabled = disabled || page <= 0;
  const nextDisabled = disabled || page >= totalPages - 1;
  const buttonStyle = (isDisabled: boolean) => ({
    height: 32,
    padding: '0 14px',
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: 'transparent',
    color: isDisabled ? C.t3 : C.t2,
    fontSize: 13,
    cursor: isDisabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
    opacity: isDisabled ? 0.4 : 1,
  });

  return (
    <nav
      aria-label="목록 페이지 이동"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}
    >
      <button
        type="button"
        aria-label="이전 페이지"
        onClick={() => onPageChange(page - 1)}
        disabled={previousDisabled}
        style={buttonStyle(previousDisabled)}
      >
        ← 이전
      </button>
      <span aria-live="polite" style={{ color: C.t2, fontSize: 13 }}>
        {page + 1} / {totalPages}
      </span>
      <button
        type="button"
        aria-label="다음 페이지"
        onClick={() => onPageChange(page + 1)}
        disabled={nextDisabled}
        style={buttonStyle(nextDisabled)}
      >
        다음 →
      </button>
    </nav>
  );
}
