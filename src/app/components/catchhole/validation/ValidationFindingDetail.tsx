import type { ReactNode, Ref } from 'react';
import { Link } from 'react-router';
import { RotateCcw } from 'lucide-react';
import type { ValidationFindingDetailResponse } from '../../../api/generated/types.gen';
import { ReviewChoiceCards, ReviewNotice, ReviewValueComparison } from '../review-ui/ReviewPrimitives';
import { ActionButton } from '../ui-v2/ActionButton';
import {
  basisLabel,
  changeReasonLabel,
  formatDateTime,
  impactLabel,
  JUDGMENT_LABELS,
  judgmentActionDescription,
  judgmentActionLabel,
  outcomeLabel,
  sourceRefLabel,
  subjectHeading,
  subjectTypeLabel,
  type Branch,
  type Judgment,
} from './validation-report-labels';
import type { CorrectionLink, SubjectLink } from './validation-return';

type Occurrence = { key: string; sourceRef: string; start: number | null; end: number | null; quote: string | null };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
function position(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function occurrence(raw: unknown, index: number): Occurrence | null {
  const item = record(raw);
  const sourceRef = text(item.sourceRef) ?? text(item.source_ref);
  if (!sourceRef) return null;
  const start = position(item.start);
  const end = position(item.end);
  return { sourceRef, start, end, quote: text(item.quote), key: start != null && end != null ? `${sourceRef}:${start}:${end}` : `${sourceRef}:q${index}` };
}

function unique(items: Array<Occurrence | null>) {
  const seen = new Set<string>();
  return items.filter((item): item is Occurrence => {
    if (!item || seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function positionLabel(item: Occurrence) {
  return item.start != null && item.end != null ? `${item.start + 1}~${item.end}번째 글자` : '위치 정보 없음';
}

/** 공개 판정 payload에서 화면에 쓰는 필드만 읽는다. 표시값을 원문에서 다시 만들지 않는다. */
function readPayload(detail: ValidationFindingDetailResponse) {
  const payload = record(detail.payload);
  const completion = record(payload.completion);
  const disagreements = Array.isArray(payload.disagreements) ? payload.disagreements : [];
  return {
    reason: text(payload.reason),
    basis: text(payload.basis),
    impact: text(payload.impact),
    impactReason: text(payload.impact_reason),
    targetSpans: Array.isArray(payload.target_spans) ? payload.target_spans : [],
    span: payload.span,
    replacement: typeof payload.replacement === 'string' ? payload.replacement : null,
    comparisonContext: text(record(completion.comparison_context).reason),
    changesExceptions: text(record(completion.changes_exceptions).reason),
    disagreements: disagreements.map(item => text(record(item).reason)).filter((item): item is string => Boolean(item)),
  };
}

function OccurrenceItem({ item, open, onToggle, sourceLink }: {
  item: Occurrence; open: boolean; onToggle: (open: boolean) => void; sourceLink?: string;
}) {
  return (
    <details className="vr-occurrence" open={open} onToggle={event => {
      if (event.currentTarget.open !== open) onToggle(event.currentTarget.open);
    }}>
      <summary><span>{`${sourceRefLabel(item.sourceRef)} · ${positionLabel(item)}`}</span><span>{open ? '접기' : '펼치기'}</span></summary>
      <div className="vr-occurrence__body">
        {item.quote ? <blockquote>{item.quote}</blockquote> : <p className="vr-locked">저장된 인용이 없어요.</p>}
        <div className="vr-occurrence__links">
          {item.sourceRef === 'T1' && sourceLink
            ? <Link className="vr-link-button" to={sourceLink}>전체 원문 보기</Link>
            : <span className="vr-locked">{item.sourceRef === 'T1'
              ? '현재 원고가 검사 당시와 같은지 확인할 수 없어 전체 원문을 열지 않아요.'
              : '이 비교 자료의 원문 위치는 아직 이 화면에서 열 수 없어요.'}</span>}
        </div>
      </div>
    </details>
  );
}

function EvidenceSection({ title, groups, selectedEvidence, onSelectEvidence, sourceLink }: {
  title: string;
  groups: Array<{ label: string; items: Occurrence[] }>;
  selectedEvidence: string | null;
  onSelectEvidence: (key: string | null) => void;
  sourceLink?: string;
}) {
  return (
    <section className="vr-section" aria-label={title}>
      <h3>{title}</h3>
      {groups.map(group => (
        <div className="vr-evidence-group" key={group.label}>
          <h4>{`${group.label} · ${group.items.length}곳`}</h4>
          {group.items.map(item => (
            <OccurrenceItem key={item.key} item={item} open={selectedEvidence === item.key} sourceLink={sourceLink}
              onToggle={open => onSelectEvidence(open ? item.key : null)} />
          ))}
        </div>
      ))}
    </section>
  );
}

/** A10: 정정할 저장 설정 선택. basis가 하나면 바로 이동하고 여럿이면 작가가 고른다. 없으면 이유와 함께 잠근다. */
function CorrectionActions({ corrections }: { corrections: CorrectionLink[] }) {
  if (corrections.length === 0) {
    return (
      <div className="vr-occurrence__links">
        <ActionButton variant="secondary" size="compact" disabled aria-describedby="validation-correction-lock">설정 정보 정정</ActionButton>
        <span id="validation-correction-lock" className="vr-locked">이 항목에는 고칠 수 있는 저장 설정이 연결되지 않았어요.</span>
      </div>
    );
  }
  if (corrections.length === 1) {
    const [only] = corrections;
    return (
      <div className="vr-occurrence__links">
        {only.url
          ? <Link className="ch-action ch-action--secondary vr-fix-link" to={only.url} aria-describedby="validation-correction-target">설정 정보 정정</Link>
          : <ActionButton variant="secondary" size="compact" disabled aria-describedby="validation-correction-target">설정 정보 정정</ActionButton>}
        <span id="validation-correction-target" className="vr-locked">{only.url ? `${only.label} 설정을 고쳐요.` : only.lockReason}</span>
      </div>
    );
  }
  return (
    <div role="group" aria-labelledby="validation-correction-choose">
      <p id="validation-correction-choose" className="vr-muted">이 항목이 비교한 저장 설정이 여러 개예요. 고칠 설정을 골라 주세요.</p>
      <ul className="vr-correction-list">
        {corrections.map((item, index) => (
          <li key={item.key}>
            {item.url
              ? <Link className="ch-action ch-action--secondary vr-fix-link" to={item.url}>{`${item.label} 정정`}</Link>
              : <>
                <ActionButton variant="secondary" size="compact" disabled aria-describedby={`validation-correction-lock-${index}`}>{`${item.label} 정정`}</ActionButton>
                <span id={`validation-correction-lock-${index}`} className="vr-locked">{item.lockReason}</span>
              </>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FindingDetailView({
  detail, headingRef, canJudge, lockMessage, saving, judgmentNotice, onSaveJudgment, selectedEvidence, onSelectEvidence,
  sourceLink, topNotice, fix, subject,
}: {
  detail: ValidationFindingDetailResponse;
  headingRef: Ref<HTMLHeadingElement>;
  canJudge: boolean;
  lockMessage: string | null;
  saving: boolean;
  judgmentNotice: ReactNode;
  onSaveJudgment: (judgment: Judgment) => void;
  selectedEvidence: string | null;
  onSelectEvidence: (key: string | null) => void;
  sourceLink?: string;
  topNotice?: ReactNode;
  /** A9 원고 파일 변경 주소와 A10 정정할 저장 설정. 현재 결과가 아니면 제공하지 않는다. A10은 설정 검사 항목에만 보인다. */
  fix?: { replace: string; corrections: CorrectionLink[] };
  /** A5 대상 설정 보기. 설정 검사 항목에만 보인다. */
  subject?: SubjectLink;
}) {
  const branch: Branch = detail.branch === 'TYPO' ? 'TYPO' : 'SETTING';
  const payload = readPayload(detail);
  const evidence = (detail.evidence ?? []).map(occurrence);
  const typoSpan = branch === 'TYPO' ? occurrence(payload.span, -1) : null;
  const target = unique([
    ...(branch === 'TYPO' ? [typoSpan] : payload.targetSpans.map((span, index) => occurrence(span, index))),
    ...evidence.filter(item => item?.sourceRef === 'T1'),
  ]);
  const basisItems = unique(evidence.filter(item => item && item.sourceRef !== 'T1'));
  const basisBySource = new Map<string, Occurrence[]>();
  for (const item of basisItems) basisBySource.set(item.sourceRef, [...(basisBySource.get(item.sourceRef) ?? []), item]);
  const basisGroups = [...basisBySource].map(([ref, items]) => ({ label: sourceRefLabel(ref), items }));
  const current = detail.judgment?.value ?? 'PENDING';
  const allowed = new Set(detail.allowedJudgments ?? []);
  const impact = branch === 'SETTING' ? impactLabel(payload.impact) : null;
  const title = payload.reason ?? outcomeLabel(detail.outcome);
  const decisive: Judgment = branch === 'SETTING' ? 'NOT_CONFLICT' : 'KEEP_ORIGINAL';
  const choices = (['NEEDS_FIX', decisive] as Judgment[]).filter(value => allowed.has(value)).map(value => ({
    id: value, title: judgmentActionLabel(branch, value), description: judgmentActionDescription(branch, value),
  }));
  const history = detail.judgmentHistory ?? [];
  const basis = basisLabel(payload.basis);
  const needsContext = detail.outcome === 'NEEDS_CONTEXT';
  // 상세 첫 줄: 대상 종류·이름·설정명(#314 B2). 대상이 없으면 표시하지 않는다.
  const heading = branch === 'SETTING' ? subjectHeading(detail.subject, detail.settingName) : null;
  const subjectLine = heading ? [subjectTypeLabel(detail.subject?.type), heading].filter(Boolean).join(' · ') : null;

  return (
    <article className="vr-card vr-detail-card" aria-labelledby="validation-finding-title">
      <header>
        <div className="review-cb-heading">
          <div className="review-cb-heading__identity">
            <div className="review-cb-heading__subtitle">{`${branch === 'SETTING' ? '설정 검사' : '오탈자 검사'} · ${outcomeLabel(detail.outcome)}`}</div>
            {subjectLine && <p className="vr-detail-subject">{subjectLine}</p>}
            <div className="review-cb-heading__title">
              <h2 id="validation-finding-title" ref={headingRef} tabIndex={-1}>{title}</h2>
            </div>
            <div className="vr-status__chips">
              {impact && <span className={`vr-chip ${payload.impact === 'SEVERE' ? 'is-danger' : payload.impact === 'CAUTION' ? 'is-warning' : ''}`}>{`영향 등급 · ${impact}`}</span>}
              <span className={`vr-chip${current === 'PENDING' ? ' is-warning' : ' is-primary'}`}>{`작가 판단 · ${JUDGMENT_LABELS[current]}`}</span>
              {detail.changed && <span className="vr-chip is-warning">새 근거로 다시 확인 필요</span>}
              {detail.stale && <span className="vr-chip">이전 검사 항목</span>}
            </div>
          </div>
        </div>
      </header>
      <div className="vr-detail-body">
        {topNotice}
        {detail.stale && (
          <ReviewNotice tone="warning" title="이 항목은 이전 검사 내용이에요.">
            <p>새 근거로 다시 확인한 최신 항목에서 판단해 주세요. 이전 판단은 이력으로만 남아 있어요.</p>
          </ReviewNotice>
        )}
        {branch === 'SETTING' ? (
          <ReviewValueComparison mode="neutral" beforeLabel="비교 기준" afterLabel="이번 원고"
            before={basisItems[0]?.quote ?? null} after={target[0]?.quote ?? null}
            beforeMeta={basisItems.length ? `${sourceRefLabel(basisItems[0].sourceRef)} · 근거 ${basisItems.length}곳` : '저장된 비교 인용 없음'}
            afterMeta={`발생 위치 ${target.length}곳`} />
        ) : (
          <ReviewValueComparison mode="neutral" beforeLabel="원문" afterLabel="교정 제안"
            before={typoSpan?.quote ?? null} after={payload.replacement}
            beforeMeta={typoSpan ? positionLabel(typoSpan) : undefined} afterMeta="원문은 자동으로 고치지 않아요" />
        )}

        <section className="vr-section" aria-label="판단 이유">
          <h3>판단 이유</h3>
          <dl className="vr-reason-list">
            {basis && <div className={needsContext ? 'is-context' : undefined}><dt>{needsContext ? '추가 확인 필요 사유' : '판단 근거'}</dt><dd>{basis}</dd></div>}
            {payload.disagreements.map(reason => <div className="is-context" key={reason}><dt>비교 기준과 원문이 다름</dt><dd>{reason}</dd></div>)}
            {impact && payload.impactReason && <div><dt>{`영향 등급 · ${impact}`}</dt><dd>{payload.impactReason}</dd></div>}
            {payload.comparisonContext && <div><dt>비교한 시점·조건</dt><dd>{payload.comparisonContext}</dd></div>}
            {payload.changesExceptions && <div><dt>변화·예외 확인</dt><dd>{payload.changesExceptions}</dd></div>}
          </dl>
        </section>

        {branch === 'SETTING' && basisGroups.length > 0 && (
          <EvidenceSection title="비교 기준 근거" groups={basisGroups} selectedEvidence={selectedEvidence} onSelectEvidence={onSelectEvidence} />
        )}
        {target.length > 0 && (
          <EvidenceSection title={branch === 'SETTING' ? '이번 원고의 모든 발생 위치' : '원문 위치'} groups={[{ label: '이번 원고', items: target }]}
            selectedEvidence={selectedEvidence} onSelectEvidence={onSelectEvidence} sourceLink={sourceLink} />
        )}
        {branch === 'SETTING' && subject && (
          <div className="vr-occurrence__links">
            {subject.url !== null ? <>
              <Link className="vr-link-button" to={subject.url} aria-describedby="validation-target-name">대상 설정 보기</Link>
              <span id="validation-target-name" className="vr-locked">{`${subject.label} · 지금 저장된 설정을 열어요.`}</span>
            </> : <>
              <ActionButton variant="secondary" size="compact" disabled aria-describedby="validation-target-lock">대상 설정 보기</ActionButton>
              <span id="validation-target-lock" className="vr-locked">{subject.lockReason}</span>
            </>}
          </div>
        )}

        {(detail.priorRevisions?.length ?? 0) > 0 && (
          <section className="vr-section" aria-label="이전 검사 결과">
            <h3>이전 검사 결과</h3>
            <ul className="vr-hold-list">
              {detail.priorRevisions!.map(prior => (
                <li key={`${prior.findingId}-${prior.checkRevision}`}>
                  {`${outcomeLabel(prior.outcome)} · 당시 판단 ${JUDGMENT_LABELS[prior.judgment?.value ?? 'PENDING']} · ${changeReasonLabel(prior.changeReason)}`}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="vr-judgment" aria-label="작가 판단">
          {choices.length > 0 && (
            <ReviewChoiceCards label={branch === 'SETTING' ? '이 항목을 어떻게 판단할까요?' : '이 제안을 어떻게 처리할까요?'}
              choices={choices} value={current === 'PENDING' ? null : current} disabled={!canJudge || saving}
              onChange={value => onSaveJudgment(value as Judgment)} />
          )}
          {current !== 'PENDING' && allowed.has('PENDING') && (
            <ActionButton variant="secondary" size="compact" icon={<RotateCcw size={14} aria-hidden="true" />}
              disabled={!canJudge || saving} onClick={() => onSaveJudgment('PENDING')}>
              {judgmentActionLabel(branch, 'PENDING')}
            </ActionButton>
          )}
          <p className="vr-muted">판단만 저장해요. 마지막 판단을 저장해도 설정 추출은 시작하지 않아요.</p>
          {lockMessage && <ReviewNotice tone="info" title={lockMessage} />}
          {judgmentNotice}
          {history.length > 0 && (
            <details className="vr-history-log">
              <summary>{`판단 기록 ${history.length}개`}</summary>
              <ol>
                {history.map(entry => (
                  <li key={`${entry.findingId}-${entry.createdAt}-${entry.toJudgment}`}>
                    {[
                      formatDateTime(entry.createdAt),
                      `${entry.fromJudgment ? JUDGMENT_LABELS[entry.fromJudgment] : '처음'} → ${entry.toJudgment ? JUDGMENT_LABELS[entry.toJudgment] : '확인 필요'}`,
                      entry.reason === 'REVISION_SUPERSEDED' ? changeReasonLabel(entry.changeReason) : '작가 판단',
                    ].filter(Boolean).join(' · ')}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </section>

        {fix && (
          <section className="vr-section vr-fix" aria-label="원고·설정 수정">
            <h3>원고·설정 수정</h3>
            <p className="vr-muted">고친 뒤 이 리포트로 돌아와 수정 내용으로 재검수해 주세요. 파일을 바꾸거나 설정을 저장해도 검사는 자동으로 시작하지 않아요.</p>
            <div className="vr-actions">
              <Link className="ch-action ch-action--secondary vr-fix-link" to={fix.replace}>원고 파일 변경</Link>
            </div>
            {branch === 'SETTING' && <>
              <CorrectionActions corrections={fix.corrections} />
              {fix.corrections.some(item => item.url) && (
                <p className="vr-muted">설정 정보 정정은 고른 저장 설정 하나만 고쳐 이 검사 기준과 연결해요. 저장한 뒤 돌아와 수정 내용으로 재검수해 주세요.</p>
              )}
            </>}
          </section>
        )}
      </div>
    </article>
  );
}
