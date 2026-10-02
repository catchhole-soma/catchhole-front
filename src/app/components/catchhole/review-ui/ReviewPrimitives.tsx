import { useId, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, BookOpen, Check, ChevronDown, Info } from 'lucide-react';
import { reviewTextDiff, type ReviewTextPart } from './review-text-diff';
import '../../../../styles/review-clear-blue.css';

export function ReviewSettingHeading({ title, subtitle, image, badge, actions, episode }: {
  title: string; subtitle?: ReactNode; image?: ReactNode; badge?: ReactNode; actions?: ReactNode; episode?: ReactNode;
}) {
  return <header className="review-cb-heading">
    {image && <div className="review-cb-heading__image">{image}</div>}
    <div className="review-cb-heading__identity">
      {subtitle && <div className="review-cb-heading__subtitle">{subtitle}</div>}
      <div className="review-cb-heading__title"><h3>{title}</h3>{badge}</div>
      {episode && <div className="review-cb-heading__episode">{episode}</div>}
    </div>
    {actions && <div className="review-cb-heading__actions">{actions}</div>}
  </header>;
}

function HighlightedText({ parts }: { parts: ReviewTextPart[] }) {
  return <>{parts.map((part, index) => part.changed ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>)}</>;
}

export function ReviewValueComparison({ before, after, mode, beforeLabel = '기존 설정', afterLabel,
  beforeMeta, afterMeta }: {
  before?: string | null; after?: string | null; mode: 'change' | 'ambiguous' | 'neutral';
  beforeLabel?: string; afterLabel?: string; beforeMeta?: ReactNode; afterMeta?: ReactNode;
}) {
  const [stacked, setStacked] = useState(false);
  const same = before === after;
  const hasMetadata = Boolean(beforeMeta || afterMeta);
  const text = useMemo(() => reviewTextDiff(before ?? '', after ?? ''), [before, after]);
  const label = afterLabel ?? (mode === 'change' ? '반영할 최종 내용' : '이번에 찾은 내용');
  return <section className={`review-cb-comparison is-${mode}${same ? ' is-same' : ''}${stacked ? ' is-stacked' : ''}`} aria-label={`${beforeLabel}과 ${label} 비교`}>
    <div className="review-cb-comparison__toolbar">
      <strong>{mode === 'change' ? '반영 전 → 반영 후' : '내용을 비교해 주세요'}</strong>
      <div className="review-cb-comparison__tools">
        {mode === 'change' && !same && <small><span>− 빠지는 내용</span><span>+ 들어오는 내용</span></small>}
        <div className="review-cb-view-toggle" aria-label="비교 배치">
          <button type="button" aria-pressed={!stacked} onClick={() => setStacked(false)}>나란히</button>
          <button type="button" aria-pressed={stacked} onClick={() => setStacked(true)}>한 줄씩</button>
        </div>
      </div>
    </div>
    <div className={`review-cb-comparison__columns${hasMetadata ? ' has-metadata' : ''}`}>
      {([{ name: beforeLabel, meta: beforeMeta, value: before, parts: text.before, side: 'before', sign: mode === 'change' && !same ? '−' : 'A' },
        { name: label, meta: afterMeta, value: after, parts: text.after, side: 'after', sign: mode === 'change' && !same ? '+' : 'B' }] as const).map(column =>
        <div className={`review-cb-comparison__column is-${column.side}`} key={column.side}>
          <div className="review-cb-comparison__label">{column.name}</div>
          {hasMetadata && <div className={`review-cb-comparison__meta${column.meta ? '' : ' is-placeholder'}`} aria-hidden={column.meta ? undefined : true}>{column.meta}</div>}
          <div className="review-cb-comparison__value"><span className="review-cb-comparison__sign" aria-hidden="true">{column.sign}</span>
            <p>{column.value == null ? <span className="review-cb-missing">비교 내용이 제공되지 않았어요</span>
              : column.value === '' ? <span className="review-cb-missing">빈 값</span>
                : mode === 'neutral' ? column.value : <HighlightedText parts={column.parts} />}</p>
          </div>
        </div>)}
    </div>
  </section>;
}

export type ReviewChoice = { id: string; title: string; description?: ReactNode; preview?: ReactNode; image?: ReactNode; footnote?: ReactNode; disabled?: boolean };
export function ReviewChoiceCards({ label, choices, value, onChange, disabled = false }: {
  label?: ReactNode; choices: ReviewChoice[]; value: string | null; onChange: (id: string) => void; disabled?: boolean;
}) {
  const labelId = useId();
  return <section className="review-cb-decisions" aria-labelledby={label ? labelId : undefined}>
    {label && <div className="review-cb-decisions__question"><small>선택해 주세요</small><h4 id={labelId}>{label}</h4></div>}
    <div className={`review-cb-choices${choices.length === 2 ? ' has-two' : ''}`} role="group" aria-labelledby={label ? labelId : undefined}>
      {choices.map(choice => <button key={choice.id} type="button" className="review-cb-choice" aria-pressed={choice.id === value}
        disabled={disabled || choice.disabled} onClick={() => onChange(choice.id)}>
        <span className="review-cb-choice__top">
          {choice.image && <span className="review-cb-choice__image">{choice.image}</span>}
          <span className="review-cb-choice__identity"><strong>{choice.title}</strong>{choice.description && <span>{choice.description}</span>}</span>
          <span className="review-cb-choice__radio" aria-hidden="true">{choice.id === value && <Check size={11} />}</span>
        </span>
        {choice.preview != null && <span className="review-cb-choice__preview">{choice.preview}</span>}
        {choice.footnote && <span className="review-cb-choice__effect">{choice.footnote}</span>}
      </button>)}
    </div>
  </section>;
}

export function ReviewEvidence({ children, summary = '원문과 판단 근거 확인' }: { children: ReactNode; summary?: ReactNode }) {
  return <details className="review-cb-evidence"><summary><span><BookOpen size={14} aria-hidden="true" />{summary}</span>
    <span className="review-cb-evidence__button"><span className="when-closed">펼치기</span><span className="when-open">접기</span><ChevronDown size={14} aria-hidden="true" /></span>
  </summary><div className="review-cb-evidence__body">{children}</div></details>;
}

export function ReviewNotice({ tone = 'info', title, children, action }: {
  tone?: 'info' | 'warning' | 'danger' | 'success'; title?: ReactNode; children?: ReactNode; action?: ReactNode;
}) {
  const Icon = tone === 'success' ? Check : tone === 'warning' || tone === 'danger' ? AlertCircle : Info;
  return <div className={`review-cb-notice is-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
    <Icon size={17} aria-hidden="true" /><div>{title && <strong>{title}</strong>}{children && <div className="review-cb-notice__content">{children}</div>}</div>
    {action && <div className="review-cb-notice__action">{action}</div>}
  </div>;
}

export function ReviewInlineValue({ label, children, tone = 'neutral' }: { label?: ReactNode; children: ReactNode; tone?: 'new' | 'neutral' }) {
  return <div className={`review-cb-inline-value is-${tone}`}>{label && <strong>{label}</strong>}<div>{children}</div></div>;
}
