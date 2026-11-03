import { useState, type ReactNode, type Ref } from 'react';
import { Link } from 'react-router';
import { RotateCcw } from 'lucide-react';
import type { ValidationFindingBlock, ValidationFindingDetailResponse } from '../../../api/generated/types.gen';
import { ReviewChoiceCards, ReviewNotice } from '../review-ui/ReviewPrimitives';
import { ActionButton } from '../ui-v2/ActionButton';
import {
  changeReasonLabel,
  findingContrast,
  findingFixHint,
  findingTitle,
  formatDateTime,
  impactLabel,
  JUDGMENT_LABELS,
  judgmentActionDescription,
  judgmentActionLabel,
  outcomeLabel,
  type Branch,
  type Judgment,
} from './validation-report-labels';
import type { CorrectionLink, SubjectLink } from './validation-return';
import { ContextBlocks } from './ValidationContextBlocks';

/**
 * 발견 항목 상세(오류 리포트 가독성 2026-11-02, 문맥 블록·판정 작성 제목 2026-11-03). 제목은 판정이 쓴 `headline`(없으면 대상·확인 항목으로 만든 문장),
 * 그 아래 판정이 쓴 원인→결과 사유,
 * 비교는 `ValidationContextBlocks`가 서버 `blocks[]`를 GitHub 파일 머리말 같은 블록으로 쌓는다(이번 원고 → 기준 → 근거).
 * 수정 전후처럼 보이는 −/+ 표시와 별도 `근거로 쓴 원문` 목록·`전체 원문 보기` 링크는 두지 않는다.
 * 근거·회차 표기는 서버가 만든 label만 쓰고 내부 참조(T1·E·B·R)를 만들지 않는다. 판정의 completion(조회 과정 기록)은 표시하지 않는다.
 */

type Span = { start: number; end: number; quote: string };

const codePoints = (text: string) => Array.from(text);
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}
function span(value: unknown): Span | null {
  const item = record(value);
  const quote = text(item.quote);
  return quote && isInt(item.start) && isInt(item.end) ? { start: item.start, end: item.end, quote } : null;
}

/** 공개 판정 payload에서 화면에 쓰는 필드만 읽는다. completion(조회 과정 기록)은 읽지 않는다. */
function readPayload(detail: ValidationFindingDetailResponse) {
  const payload = record(detail.payload);
  return {
    reason: text(payload.reason),
    impact: text(payload.impact),
    impactReason: text(payload.impact_reason),
    targetSpans: (Array.isArray(payload.target_spans) ? payload.target_spans : []).map(span).filter((item): item is Span => item !== null),
    typoSpan: span(payload.span),
    replacement: typeof payload.replacement === 'string' ? payload.replacement : null,
    disagreements: (Array.isArray(payload.disagreements) ? payload.disagreements : [])
      .map(item => text(record(item).reason)).filter((item): item is string => Boolean(item)),
  };
}

/** 이전 서버(blocks 없음)와의 호환: 판정 위치와 근거 문장만으로 앞뒤 줄 없는 블록을 만든다. */
function fallbackBlocks(detail: ValidationFindingDetailResponse, targets: Span[]): ValidationFindingBlock[] {
  const episode = detail.targetEpisodeNo != null ? `${detail.targetEpisodeNo}화` : '이번 원고';
  const quotes = detail.basisQuotes ?? [];
  return [
    ...targets.map(target => ({ kind: 'TARGET' as const, label: `${episode} · ${target.start + 1}~${target.end}자`, quote: target.quote, start: target.start, end: target.end })),
    ...quotes.filter(quote => quote.kind === 'SETTING').map(quote => ({ kind: 'SETTING' as const, label: quote.label, quote: quote.quote })),
    ...quotes.filter(quote => quote.kind !== 'SETTING').map(quote => ({
      kind: quote.kind, quote: quote.quote, start: quote.start, end: quote.end,
      label: isInt(quote.start) && isInt(quote.end) ? `${quote.label} · ${quote.start + 1}~${quote.end}자` : quote.label,
    })),
  ];
}

/** 설정 고치기. 저장 설정이 하나면 바로 이동하고, 여럿이면 작은 선택 목록을 연다. 연결이 없으면 이유와 함께 잠근다. */
function SettingFix({ corrections }: { corrections: CorrectionLink[] }) {
  const [choosing, setChoosing] = useState(false);
  if (corrections.length === 0) {
    return <>
      <ActionButton variant="secondary" disabled aria-describedby="validation-correction-lock">설정 고치기</ActionButton>
      <span id="validation-correction-lock" className="vr-locked">이 항목에는 고칠 수 있는 저장 설정이 연결되지 않았어요.</span>
    </>;
  }
  if (corrections.length === 1) {
    const [only] = corrections;
    return only.url
      ? <>
        <Link className="ch-action ch-action--secondary vr-fix-link" to={only.url} aria-describedby="validation-correction-target">설정 고치기</Link>
        <span id="validation-correction-target" className="vr-locked">{only.label}</span>
      </>
      : <>
        <ActionButton variant="secondary" disabled aria-describedby="validation-correction-target">설정 고치기</ActionButton>
        <span id="validation-correction-target" className="vr-locked">{only.lockReason}</span>
      </>;
  }
  return (
    <div className="vr-fix__chooser">
      <ActionButton variant="secondary" aria-expanded={choosing} aria-controls="validation-correction-choices"
        onClick={() => setChoosing(value => !value)}>설정 고치기</ActionButton>
      {choosing && (
        <ul id="validation-correction-choices" className="vr-correction-list" aria-label="고칠 설정">
          {corrections.map((item, index) => (
            <li key={item.key}>
              {item.url
                ? <Link className="ch-action ch-action--secondary vr-fix-link" to={item.url}>{item.label}</Link>
                : <>
                  <ActionButton variant="secondary" disabled aria-describedby={`validation-correction-lock-${index}`}>{item.label}</ActionButton>
                  <span id={`validation-correction-lock-${index}`} className="vr-locked">{item.lockReason}</span>
                </>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function typoHeading(outcome: string | undefined, quote: string | undefined, replacement: string | null) {
  if (quote && replacement != null && codePoints(quote).length <= 24 && codePoints(replacement).length <= 24) return `‘${quote}’ → ‘${replacement}’`;
  return `${outcomeLabel(outcome)} 교정 제안`;
}

export function FindingDetailView({
  detail, headingRef, canJudge, lockMessage, saving, judgmentNotice, onSaveJudgment, contextPath, topNotice, fix, subject,
}: {
  detail: ValidationFindingDetailResponse;
  headingRef: Ref<HTMLHeadingElement>;
  canJudge: boolean;
  lockMessage: string | null;
  saving: boolean;
  judgmentNotice: ReactNode;
  onSaveJudgment: (judgment: Judgment) => void;
  /** 문맥 블록 더 보기 요청 경로. 없으면 처음 받은 앞뒤 줄만 보인다. */
  contextPath?: { workId: string; reportId: string };
  topNotice?: ReactNode;
  /** A9 원고 파일 변경 주소와 A10 정정할 저장 설정. 현재 결과가 아니면 제공하지 않는다. 설정 고치기는 설정 검사 항목에만 보인다. */
  fix?: { replace: string; corrections: CorrectionLink[] };
  /** A5 대상 설정 보기. 설정 검사 항목에만 보인다. */
  subject?: SubjectLink;
}) {
  const branch: Branch = detail.branch === 'TYPO' ? 'TYPO' : 'SETTING';
  const payload = readPayload(detail);
  const targets = branch === 'TYPO' ? (payload.typoSpan ? [payload.typoSpan] : []) : payload.targetSpans;
  const blocks = detail.blocks ?? fallbackBlocks(detail, targets);
  const hasBasis = blocks.some(block => block.kind !== 'TARGET');
  const current = detail.judgment?.value ?? 'PENDING';
  const allowed = new Set(detail.allowedJudgments ?? []);
  const impact = branch === 'SETTING' ? impactLabel(payload.impact) : null;
  const decisive: Judgment = branch === 'SETTING' ? 'NOT_CONFLICT' : 'KEEP_ORIGINAL';
  const choices = (['NEEDS_FIX', decisive] as Judgment[]).filter(value => allowed.has(value)).map(value => ({
    id: value, title: judgmentActionLabel(branch, value), description: judgmentActionDescription(branch, value),
  }));
  const history = detail.judgmentHistory ?? [];

  // 제목(2026-11-03): 설정은 판정이 쓴 `headline`, 없으면 `○○이 기존 기록과 달라요` 같은 A안 문장. 오탈자는 `‘원문’ → ‘제안’`.
  // 아래 한 줄은 판정이 쓴 사유(충돌·의심은 `기존 설정은 … 그런데 31화에서는 …` 두 문장)이고, 사유가 없을 때만 인용으로 대비를 만든다.
  const settingHeading = findingTitle(detail) ?? text(detail.topic);
  const title = branch === 'SETTING'
    ? settingHeading ?? payload.reason ?? outcomeLabel(detail.outcome)
    : typoHeading(detail.outcome, payload.typoSpan?.quote, payload.replacement);
  const basis = branch === 'SETTING' ? detail.basisQuotes?.[0] : null;
  const judgedSentence = payload.reason && payload.reason !== title ? payload.reason : null;
  const sentence = judgedSentence
    ?? (branch === 'SETTING' && !payload.reason ? findingContrast(basis, detail.targetEpisodeNo, targets[0]?.quote) : null);
  const fixHint = branch === 'SETTING' ? findingFixHint(detail.outcome, basis, detail.targetEpisodeNo) : null;

  return (
    <article className="vr-card vr-detail-card" aria-labelledby="validation-finding-title">
      <header>
        <div className="review-cb-heading">
          <div className="review-cb-heading__identity">
            <div className="review-cb-heading__subtitle">{`${branch === 'SETTING' ? '설정 검사' : '오탈자 검사'} · ${outcomeLabel(detail.outcome)}`}</div>
            <div className="review-cb-heading__title">
              <h2 id="validation-finding-title" ref={headingRef} tabIndex={-1}>{title}</h2>
            </div>
            {sentence && <p className="vr-detail-summary">{sentence}</p>}
            {fixHint && <p className="vr-detail-hint">{fixHint}</p>}
            <div className="vr-status__chips">
              {impact && <span className={`vr-chip ${payload.impact === 'SEVERE' ? 'is-danger' : payload.impact === 'CAUTION' ? 'is-warning' : ''}`}>{`영향 · ${impact}`}</span>}
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
        {blocks.length > 0 && (
          <ContextBlocks key={detail.findingId} blocks={blocks} replacement={branch === 'TYPO' ? payload.replacement : null}
            path={contextPath && detail.findingId ? { ...contextPath, findingId: detail.findingId } : null}
            label={branch === 'SETTING' ? '이번 원고와 근거 비교' : '원문과 교정 제안'}
            empty={branch !== 'SETTING' || hasBasis ? null : detail.outcome === 'NEEDS_CONTEXT' ? '저장된 설정에 이 내용이 없어요.'
              : detail.outcome === 'CONFLICT' || detail.outcome === 'SUSPECTED_CONFLICT' ? '판정이 근거 문장을 따로 남기지 않았어요.' : null}
            footnote={branch === 'TYPO' ? '원문은 자동으로 고치지 않아요.' : undefined} />
        )}
        {(impact && payload.impactReason) || payload.disagreements.length > 0 ? (
          <ul className="vr-detail-notes">
            {impact && payload.impactReason && <li><strong>{`영향 · ${impact}`}</strong>{payload.impactReason}</li>}
            {payload.disagreements.map(reason => <li className="is-context" key={reason}><strong>저장된 설정과 이전 원고가 달라요</strong>{reason}</li>)}
          </ul>
        ) : null}

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
            <ReviewChoiceCards semantics="toggle" label={branch === 'SETTING' ? '이 항목을 어떻게 판단할까요?' : '이 제안을 어떻게 처리할까요?'}
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
          <section className="vr-section vr-fix" aria-label="고치기">
            <h3>고치기</h3>
            <div className="vr-fix__actions">
              <Link className="ch-action ch-action--secondary vr-fix-link" to={fix.replace}>원고 고치기</Link>
              {branch === 'SETTING' && <SettingFix corrections={fix.corrections} />}
            </div>
            <p className="vr-muted">고친 뒤 이 리포트로 돌아와 재검수해 주세요.</p>
          </section>
        )}
      </div>
    </article>
  );
}
