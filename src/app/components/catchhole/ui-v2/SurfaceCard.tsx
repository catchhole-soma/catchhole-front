import type { HTMLAttributes, ReactNode } from 'react';

type SurfaceCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: 'default' | 'soft';
};

export function SurfaceCard({ children, className, tone = 'default', ...props }: SurfaceCardProps) {
  const classes = [
    'ch-surface-card',
    tone === 'soft' ? 'ch-surface-card--soft' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
