import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  icon?: ReactNode;
  size?: 'compact' | 'default';
  variant?: 'ghost' | 'primary' | 'secondary';
};

export function ActionButton({
  children,
  className,
  icon,
  size = 'default',
  type = 'button',
  variant = 'primary',
  ...props
}: ActionButtonProps) {
  const classes = [
    'ch-action',
    `ch-action--${variant}`,
    size === 'compact' ? 'ch-action--compact' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <button type={type} className={classes} {...props}>
      {children}
      {icon}
    </button>
  );
}
