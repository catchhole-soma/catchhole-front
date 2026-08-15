import type { ReactNode } from 'react';

type PageHeadingProps = {
  action?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: ReactNode;
};

export function PageHeading({ action, description, eyebrow, title }: PageHeadingProps) {
  return (
    <div className="workspace-page-heading">
      <div className="workspace-page-heading__copy">
        {eyebrow && <span className="workspace-page-heading__eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="workspace-page-heading__action">{action}</div>}
    </div>
  );
}
