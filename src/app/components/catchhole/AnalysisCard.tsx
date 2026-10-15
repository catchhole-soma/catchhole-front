import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type AnalysisTone = 'primary' | 'warning' | 'danger' | 'success';

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

/** The analysis list uses one frame for episode and setting-book sources. */
export function AnalysisCard({ title, status, description, icon: StatusIcon, tone, children, activityAt, actions, testId }: {
  title: ReactNode;
  status: ReactNode;
  description: ReactNode;
  icon: LucideIcon;
  tone: AnalysisTone;
  children?: ReactNode;
  activityAt?: string;
  actions: ReactNode;
  testId?: string;
}) {
  return (
    <article className="analysis-batch-card" data-testid={testId}>
      <div className="analysis-batch-card__main">
        <div className={`analysis-batch-card__icon analysis-tone--${tone}`}><StatusIcon size={19} /></div>
        <div className="analysis-batch-card__body">
          <div className="analysis-batch-card__title-row">
            <div className="analysis-batch-card__title">{title}</div>
            <span className={`analysis-status analysis-tone--${tone}`}>{status}</span>
          </div>
          <div className="analysis-batch-card__description">{description}</div>
          {children}
        </div>
      </div>
      <div className="analysis-card-footer">
        <time>최근 활동 {formatDateTime(activityAt)}</time>
        <div className="analysis-card-actions">{actions}</div>
      </div>
    </article>
  );
}

export function CandidateReviewCount({ label, totalCount, reviewedCount, pendingCount }: {
  label: string; totalCount: number; reviewedCount: number; pendingCount: number;
}) {
  if (totalCount === 0) return null;
  return (
    <div className="analysis-review-count">
      {label} {reviewedCount}/{totalCount}개 검토 완료
      {pendingCount > 0 && <span className="analysis-review-count__pending">{pendingCount}개 대기</span>}
    </div>
  );
}
