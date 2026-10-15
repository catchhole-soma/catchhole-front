import { Fragment, type ReactNode } from 'react';
import { Check, ChevronLeft } from 'lucide-react';
import { C } from './constants';
import { UserMenu } from './UserMenu';

export function UploadHeader({ onBack, backLabel = '원고 목록으로 돌아가기', title = '회차 업로드', sourceLabel = 'MANUSCRIPT' }: {
  onBack: () => void; backLabel?: string; title?: string; sourceLabel?: string;
}) {
  return (
    <div className="episode-upload-header app-topbar" style={{
      height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 20px', borderBottom: `1px solid ${C.border}`,
    }}>
      <button className="episode-upload-header__back" type="button" aria-label={backLabel} onClick={onBack} style={{
        width: 32, height: 32, borderRadius: 6, border: `1px solid ${C.border}`,
        background: 'transparent', color: C.t2, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><ChevronLeft size={16} /></button>
      <div className="episode-upload-header__title"><small>{sourceLabel}</small><strong role="heading" aria-level={1}>{title}</strong></div>
      <div className="episode-upload-header__spacer" />
      <UserMenu />
    </div>
  );
}

export function UploadStepper({ labels, current }: { labels: string[]; current: number }) {
  return (
    <div className="episode-upload-stepper" style={{ display: 'flex', alignItems: 'center', maxWidth: 860, margin: '0 auto', padding: '24px 20px 0' }}>
      {labels.map((label, index) => (
        <Fragment key={label}>
          <div className="episode-upload-step">
            <div className={`episode-upload-step__number${index + 1 < current ? ' is-complete' : ''}${index + 1 === current ? ' is-current' : ''}`} style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: index + 1 <= current ? C.primary : C.border,
              color: index + 1 <= current ? '#fff' : C.t3,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
            }}>{index + 1 < current ? <Check size={12} /> : index + 1}</div>
            <span className={`episode-upload-step__label${index + 1 === current ? ' is-current' : ''}`} style={{ color: index + 1 === current ? C.t1 : C.t3, fontSize: 12, whiteSpace: 'nowrap' }}>{label}</span>
          </div>
          {index < labels.length - 1 && <div className={`episode-upload-step__line${index + 1 < current ? ' is-complete' : ''}`} style={{ flex: 1, height: 1, background: index + 1 < current ? C.primary : C.border, margin: '0 12px' }} />}
        </Fragment>
      ))}
    </div>
  );
}

export function AnalysisProgressHero({ icon, title, description }: { icon: ReactNode; title: ReactNode; description: ReactNode }) {
  return (
    <div className="episode-processing__hero" style={{ textAlign: 'center', marginBottom: 26 }}>
      {icon}
      <div className="episode-processing__title" style={{ fontSize: 17, fontWeight: 700, marginBottom: 5 }}>{title}</div>
      <div className="episode-processing__description" style={{ color: C.t2, fontSize: 13 }}>{description}</div>
    </div>
  );
}

export function AnalysisProgressCard({ title, status, statusClass, children }: {
  title: ReactNode; status: ReactNode; statusClass: string; children: ReactNode;
}) {
  return (
    <div className="episode-processing-card" style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, background: C.surface }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="episode-processing-card__title" style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        <span className={`episode-processing-card__status status-${statusClass}`}>{status}</span>
      </div>
      {children}
    </div>
  );
}
