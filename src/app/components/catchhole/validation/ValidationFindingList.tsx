import type { ReactNode, Ref } from 'react';
import type {
  ValidationFindingSummaryResponse,
  ValidationReviewSummaryCounts,
} from '../../../api/generated/types.gen';
import { PageNavigation } from '../PageNavigation';
import {
  impactLabel,
  JUDGMENT_LABELS,
  judgmentOptions,
  outcomeLabel,
  outcomeOptions,
  type BranchFilter,
  type JudgmentFilter,
} from './validation-report-labels';


function count(value?: number) {
  return value == null ? '—' : `${value}`;
}

/** R3 집계. 필터·페이지와 무관한 서버 값이며 조회 중·실패는 0이 아니라 —로 둔다. */
export function FindingCounts({ counts, unavailable }: { counts?: ValidationReviewSummaryCounts; unavailable: boolean }) {
  const value = (key: keyof ValidationReviewSummaryCounts) => count(unavailable ? undefined : counts?.[key]);
  const groups = [
    { title: '설정 충돌', items: [
      { label: '전체', value: value('settingTotal') },
      { label: '검토 필요', value: value('settingPending'), pending: true },
      { label: '수정 필요', value: value('settingNeedsFix') },
      { label: '충돌 아님', value: value('settingNotConflict') },
    ] },
    { title: '오탈자', items: [
      { label: '전체', value: value('typoTotal') },
      { label: '검토 필요', value: value('typoPending'), pending: true },
      { label: '수정 필요', value: value('typoNeedsFix') },
      { label: '원문 유지', value: value('typoKeepOriginal') },
    ] },
  ];
  return (
    <section className="vr-card vr-counts-strip" aria-labelledby="validation-report-counts" aria-busy={!counts && !unavailable}>
      <h2 id="validation-report-counts">결과 요약</h2>
      <div className="vr-counts">
        {groups.map(group => (
          <div className="vr-counts__group" key={group.title}>
            <h3>{group.title}</h3>
            <dl className="vr-counts__metrics">
              {group.items.map(item => (
                <div key={item.label} className={item.pending ? 'is-pending' : undefined}>
                  <dt>{item.label}</dt><dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      {unavailable && <p className="vr-muted vr-lead" role="status">건수를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.</p>}
    </section>
  );
}

function FilterGroup<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void;
}) {
  return (
    <div className="review-filter" role="group" aria-label={label}>
      <div className="review-filter__label">{label}</div>
      <select className="review-filter__select mobile-choice-select" aria-label={label} value={value}
        onChange={event => onChange(event.target.value as T)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <div className="review-filter__options">
        {options.map(option => (
          <button key={option.value} type="button" aria-pressed={option.value === value}
            className={`review-filter__button${option.value === value ? ' is-active' : ''}`} onClick={() => onChange(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type CountScope = { total?: number; pending?: number; needsFix?: number } | null;

/** 목록 0건 안내. 필터 0건·검토 완료·검사 중·전체 0건을 서버 집계로 구분하며 0건으로 추측하지 않는다. */
export function FindingEmptyState({ scope, execution, defaultView, onShowAll, onReset }: {
  scope: CountScope; execution?: string; defaultView: boolean; onShowAll: () => void; onReset: () => void;
}) {
  if ((execution === 'QUEUED' || execution === 'RUNNING') && (scope?.total ?? 0) === 0) {
    return <div className="vr-empty"><strong>아직 발견한 항목이 없어요.</strong><span>검사가 끝나면 결과를 확인할 수 있어요.</span></div>;
  }
  if (defaultView && scope?.total === 0) return <div className="vr-empty"><strong>확인한 범위에서 찾은 항목이 없어요.</strong></div>;
  if (defaultView && (scope?.total ?? 0) > 0 && scope?.pending === 0) {
    return (
      <div className="vr-empty">
        <strong>표시된 항목의 검토를 마쳤어요.</strong>
        {(scope.needsFix ?? 0) > 0 && <span>{`수정 필요로 표시한 항목 ${scope.needsFix}개는 원고를 고친 뒤 다시 검수해 확인해요.`}</span>}
        {(execution === 'PARTIAL' || execution === 'FAILED') && <span>아직 검사하지 못한 구간이 있어요.</span>}
        <button type="button" className="vr-link-button" onClick={onShowAll}>전체 보기</button>
      </div>
    );
  }
  return (
    <div className="vr-empty">
      <strong>조건에 맞는 항목이 없어요.</strong>
      <button type="button" className="vr-link-button" onClick={onReset}>필터 초기화</button>
    </div>
  );
}

const BRANCH_OPTIONS: Array<{ value: BranchFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'SETTING', label: '설정 충돌' },
  { value: 'TYPO', label: '오탈자' },
];

function FindingRow({ finding, selected, onSelect }: {
  finding: ValidationFindingSummaryResponse; selected: boolean; onSelect: () => void;
}) {
  const impact = finding.branch === 'SETTING' ? impactLabel(finding.summary?.impact) : null;
  const judgment = finding.judgment?.value ?? 'PENDING';
  const quote = finding.summary?.spans?.[0]?.quote;
  return (
    <li>
      <button type="button" className={`vr-row${selected ? ' is-selected' : ''}`} data-finding-id={finding.findingId}
        aria-current={selected ? 'true' : undefined} onClick={onSelect}>
        <span className="vr-row__meta">
          {impact && <span className={`vr-chip ${finding.summary?.impact === 'SEVERE' ? 'is-danger' : finding.summary?.impact === 'CAUTION' ? 'is-warning' : ''}`}>{`영향 ${impact}`}</span>}
          <span className="vr-chip is-primary">{outcomeLabel(finding.outcome)}</span>
          {finding.changed && <span className="vr-chip is-warning">새 근거로 다시 확인 필요</span>}
        </span>
        <span className="vr-row__title">{finding.summary?.reason || outcomeLabel(finding.outcome)}</span>
        {quote && <span className="vr-row__quote">{`이번 원고 · “${quote}”`}</span>}
        <span className="vr-row__foot">
          <span className={`vr-chip${judgment === 'PENDING' ? ' is-warning' : ''}`}>{`작가 판단 · ${JUDGMENT_LABELS[judgment]}`}</span>
          {finding.branch === 'TYPO' && finding.summary?.replacement && <span className="vr-muted">{`제안 · ${finding.summary.replacement}`}</span>}
        </span>
      </button>
    </li>
  );
}

export function FindingListPanel({
  findings, totalElements, loading, error, selectedId, onSelect, branch, judgment, outcome, onFilterChange,
  page, totalPages, onPageChange, emptyState, headingRef,
}: {
  findings: ValidationFindingSummaryResponse[];
  totalElements?: number;
  loading: boolean;
  error: ReactNode;
  selectedId: string | null;
  onSelect: (findingId: string) => void;
  branch: BranchFilter;
  judgment: JudgmentFilter;
  outcome: string;
  onFilterChange: (next: { branch?: BranchFilter; judgment?: JudgmentFilter; outcome?: string }) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  emptyState: ReactNode;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  return (
    <aside className="vr-card vr-sidebar" aria-labelledby="validation-report-list">
      <h2 id="validation-report-list" ref={headingRef} tabIndex={-1}>검사 항목</h2>
      <FilterGroup label="분류" value={branch} options={BRANCH_OPTIONS} onChange={value => onFilterChange({ branch: value })} />
      <FilterGroup label="작가 판단" value={judgment} options={judgmentOptions(branch)} onChange={value => onFilterChange({ judgment: value })} />
      <FilterGroup label="AI 결과 유형" value={outcome} options={outcomeOptions(branch)} onChange={value => onFilterChange({ outcome: value })} />
      <p className="vr-list-note">원고에 처음 나온 순서 · 한 페이지 20개{totalElements != null ? ` · 조건에 맞는 항목 ${totalElements}개` : ''}</p>
      {error}
      {loading && findings.length === 0 ? (
        <div className="vr-empty" role="status">항목을 불러오고 있어요.</div>
      ) : findings.length > 0 ? (
        <ul className="vr-list" aria-label="검사 항목 목록">
          {findings.map(finding => finding.findingId && (
            <FindingRow key={finding.findingId} finding={finding} selected={finding.findingId === selectedId}
              onSelect={() => onSelect(finding.findingId!)} />
          ))}
        </ul>
      ) : emptyState}
      <PageNavigation page={page} totalPages={totalPages} disabled={loading} onPageChange={onPageChange} />
    </aside>
  );
}
