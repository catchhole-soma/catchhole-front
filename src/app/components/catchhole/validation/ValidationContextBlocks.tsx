import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, RefreshCw } from 'lucide-react';
import { getValidationFindingSourceContext } from '../../../api/generated/sdk.gen';
import type { ValidationFindingBlock, ValidationSourceContextResponse } from '../../../api/generated/types.gen';
import { toApiError } from '../../../lib/api-errors';

/**
 * 오류 리포트 문맥 블록(2026-11-03). GitHub 파일 머리말처럼 `이번 원고 · 31화 · 2201~2241자` → `기준 · 설정 · 대상 · 설정명` →
 * `근거 · 13화 · 7534~7562자` 블록을 위에서부터 쌓는다. 원문 블록은 인용 문장을 강조하고 서버가 준 위아래 2줄을 보이며,
 * `위로 더 보기`·`아래로 더 보기`는 같은 출처를 5줄씩 더 읽는다(원문 처음·끝에 닿으면 숨긴다). 처음 두 블록만 펼친다.
 * 블록·위치 표기는 서버 label만 쓰고 내부 참조(T1·R#·E#·B#)로 만들지 않는다. 원문은 URL·브라우저 저장소에 넣지 않는다.
 * 앞뒤 줄이 겹치거나 맞닿는 인용(같은 출처)은 서버가 한 블록으로 합쳐 `quotes`에 모두 담는다(2026-11-03). 같은 줄을 두 번 보이지 않고
 * 블록 안에서 인용마다 강조한다. 더 보기는 합친 창의 처음·끝에서 이어 읽는다.
 */

const MORE_LINES = 5;
const OPEN_BY_DEFAULT = 2;
const PREFIX: Record<string, string> = { TARGET: '이번 원고', SETTING: '기준', EPISODE: '근거', SETTING_BOOK: '근거' };
const LOCKED_MESSAGE = '검사 뒤 원고가 바뀌었거나 지워져 앞뒤 문장은 보여 드릴 수 없어요.';
const LOCKED_MORE_MESSAGE = '검사 뒤 원고가 바뀌었거나 지워져 더 보여 드릴 수 없어요.';
const UNREADABLE_MESSAGE = '앞뒤 문장을 불러오지 못했어요.';
/** 서버 `source-context`의 anchor 상한(code point). */
const ANCHOR_LIMIT = 1000;

type Line = { start: number; end: number; text: string };
type Range = { start: number; end: number };
type ContextWindow = { start: number; end: number; hasMoreBefore: boolean; hasMoreAfter: boolean; lines: Line[] };
type Loading = 'up' | 'down' | 'retry';
type BlockState = { window: ContextWindow | null; loading: Loading | null; error: string | null; locked: boolean };
export type ContextPath = { workId: string; reportId: string; findingId: string };

const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

function toWindow(context?: ValidationSourceContextResponse | null): ContextWindow | null {
  if (!context || !isInt(context.start) || !isInt(context.end)) return null;
  const lines = (context.lines ?? []).flatMap(line => (
    isInt(line.start) && isInt(line.end) && typeof line.text === 'string' ? [{ start: line.start, end: line.end, text: line.text }] : []));
  return { start: context.start, end: context.end, hasMoreBefore: Boolean(context.hasMoreBefore), hasMoreAfter: Boolean(context.hasMoreAfter), lines };
}

function initialState(block: ValidationFindingBlock): BlockState {
  const status = block.contextStatus;
  return {
    window: toWindow(block.context),
    loading: null,
    error: status === 'SOURCE_UNREADABLE' ? UNREADABLE_MESSAGE : status && status !== 'READY' ? LOCKED_MESSAGE : null,
    locked: Boolean(status && status !== 'READY' && status !== 'SOURCE_UNREADABLE'),
  };
}

/** 블록이 강조할 원문 구간. 서버 `quotes`(합친 블록은 여럿)가 있으면 그것, 없으면(이전 서버) 블록의 start·end 하나. */
function quoteRanges(block: ValidationFindingBlock): Range[] {
  const listed = (block.quotes ?? []).flatMap(item => (isInt(item.start) && isInt(item.end) ? [{ start: item.start, end: item.end }] : []));
  if (listed.length > 0) return listed.sort((a, b) => a.start - b.start);
  const start = block.start ?? 0;
  return [{ start, end: block.end ?? start }];
}

/**
 * 다시 불러오기에 보낼 anchor. 서버 더 보기 API의 anchor는 1,000자까지라 합친 블록 전체(첫 인용~마지막 인용)를 한 번에 물으면
 * 넘칠 수 있다. 인용마다(1,000자가 넘는 인용은 1,000자씩) 나눠 묻고 돌아온 창을 합친다. 합친 블록은 인용 위아래 2줄이 겹치거나
 * 맞닿아 만들어졌으므로 인용별 창을 합치면 처음 블록과 같은 줄이 된다.
 */
function retryAnchors(block: ValidationFindingBlock): Range[] {
  return quoteRanges(block).flatMap(({ start, end }) => {
    if (end - start <= ANCHOR_LIMIT) return [{ start, end }];
    const pieces: Range[] = [];
    for (let at = start; at < end; at += ANCHOR_LIMIT) pieces.push({ start: at, end: Math.min(end, at + ANCHOR_LIMIT) });
    return pieces;
  });
}

/** 같은 출처의 여러 창을 줄 시작 위치로 합친다. 같은 줄은 한 번만 남긴다. */
function mergeWindows(windows: ContextWindow[]): ContextWindow | null {
  if (windows.length === 0) return null;
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const byStart = new Map<number, Line>();
  for (const window of sorted) for (const line of window.lines) if (!byStart.has(line.start)) byStart.set(line.start, line);
  const last = sorted.reduce((latest, window) => (window.end >= latest.end ? window : latest));
  return {
    start: sorted[0].start, end: last.end, hasMoreBefore: sorted[0].hasMoreBefore, hasMoreAfter: last.hasMoreAfter,
    lines: [...byStart.values()].sort((a, b) => a.start - b.start),
  };
}

/** 블록의 인용 문장. 합친 블록은 원문 순서대로 여럿이다. */
function quoteTexts(block: ValidationFindingBlock): string[] {
  const listed = (block.quotes ?? []).flatMap(item => (typeof item.quote === 'string' && item.quote ? [item.quote] : []));
  return listed.length > 0 ? listed : [block.quote ?? ''];
}

/** 한 줄을 강조 구간들로 나눈다(겹치는 구간은 하나로). */
function markedParts(line: Line, ranges: Range[]) {
  const chars = Array.from(line.text);
  const cuts = ranges
    .map(range => ({ from: Math.max(range.start, line.start) - line.start, to: Math.min(range.end, line.end) - line.start }))
    .filter(cut => cut.from < cut.to)
    .sort((a, b) => a.from - b.from)
    .reduce<Array<{ from: number; to: number }>>((all, cut) => {
      const last = all[all.length - 1];
      if (last && cut.from <= last.to) last.to = Math.max(last.to, cut.to);
      else all.push({ ...cut });
      return all;
    }, []);
  const parts: Array<{ text: string; mark: boolean }> = [];
  let at = 0;
  for (const cut of cuts) {
    if (cut.from > at) parts.push({ text: chars.slice(at, cut.from).join(''), mark: false });
    parts.push({ text: chars.slice(cut.from, cut.to).join(''), mark: true });
    at = cut.to;
  }
  if (at < chars.length) parts.push({ text: chars.slice(at).join(''), mark: false });
  return parts;
}

/** 한 줄 안에서 [start,end) code point 구간을 나눈다. */
function splitLine(line: Line, start: number, end: number) {
  const chars = Array.from(line.text);
  const from = Math.max(start, line.start) - line.start;
  const to = Math.min(end, line.end) - line.start;
  if (from >= to) return null;
  return { before: chars.slice(0, from).join(''), mark: chars.slice(from, to).join(''), after: chars.slice(to).join(''), endsHere: end <= line.end };
}

function LineText({ line, ranges, replacement }: { line: Line; ranges: Range[]; replacement: string | null }) {
  if (replacement == null) {
    const marked = markedParts(line, ranges);
    if (!marked.some(part => part.mark)) return <>{line.text}</>;
    return <>{marked.map((part, index) => (part.mark ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>))}</>;
  }
  const [{ start, end }] = ranges;
  const parts = splitLine(line, start, end);
  if (!parts) return <>{line.text}</>;
  // 오탈자: 원문 부분을 지운 표시로 두고 제안을 바로 뒤에 보인다. 원문을 고치지는 않는다.
  return <>
    {parts.before}
    <del className="vr-inline-change__from"><span className="vr-sr-only">원문 </span>{parts.mark}</del>
    {parts.endsHere && <>
      <span className="vr-inline-change__arrow" aria-hidden="true">→</span>
      <ins className="vr-inline-change__to"><span className="vr-sr-only">제안 </span>{replacement}</ins>
    </>}
    {parts.after}
  </>;
}

function QuoteOnly({ quotes, replacement }: { quotes: string[]; replacement: string | null }) {
  return (
    <ol className="vr-block__lines">
      {quotes.map((quote, index) => {
        const line = { start: 0, end: Array.from(quote).length, text: quote };
        return (
          <li key={index} className="vr-block__line is-quote">
            <LineText line={line} ranges={[{ start: 0, end: line.end }]} replacement={replacement} />
          </li>
        );
      })}
    </ol>
  );
}

/** 저장 설정값 안에서 인용(합친 블록은 여럿)을 강조한다. 값이 없거나 인용이 값 안에 없으면 인용만 줄마다 보인다. */
function SettingValue({ block }: { block: ValidationFindingBlock }) {
  const quotes = quoteTexts(block).filter(Boolean);
  const value = block.settingValue;
  const ranges: Range[] = [];
  if (value) {
    for (const quote of quotes) {
      const at = value.indexOf(quote);
      if (at < 0) { ranges.length = 0; break; }
      const start = Array.from(value.slice(0, at)).length;
      ranges.push({ start, end: start + Array.from(quote).length });
    }
  }
  if (!value || ranges.length === 0) {
    return (
      <ol className="vr-block__lines">
        {quotes.map((quote, index) => <li key={index} className="vr-block__line is-quote"><mark>{quote}</mark></li>)}
      </ol>
    );
  }
  const line = { start: 0, end: Array.from(value).length, text: value };
  return (
    <ol className="vr-block__lines">
      <li className="vr-block__line is-quote"><LineText line={line} ranges={ranges} replacement={null} /></li>
    </ol>
  );
}

function MoreButton({ direction, loading, disabled, onClick }: { direction: 'up' | 'down'; loading: boolean; disabled: boolean; onClick: () => void }) {
  const Icon = direction === 'up' ? ArrowUp : ArrowDown;
  return (
    <button type="button" className={`vr-block__more is-${direction}`} disabled={disabled} aria-busy={loading || undefined} onClick={onClick}>
      <Icon size={14} aria-hidden="true" />
      {direction === 'up' ? '위로 더 보기' : '아래로 더 보기'}
    </button>
  );
}

function TextBody({ block, state, replacement, onMore }: {
  block: ValidationFindingBlock; state: BlockState; replacement: string | null; onMore: (kind: Loading) => void;
}) {
  const ranges = quoteRanges(block);
  const view = state.window;
  const busy = state.loading !== null;
  return (
    <div className="vr-block__body">
      {view && view.hasMoreBefore && !state.locked && (
        <MoreButton direction="up" loading={state.loading === 'up'} disabled={busy} onClick={() => onMore('up')} />
      )}
      {view && view.lines.length > 0 ? (
        <ol className="vr-block__lines">
          {view.lines.map(line => {
            const quoted = ranges.some(range => line.start < range.end && range.start < line.end);
            return (
              <li key={line.start} className={`vr-block__line${quoted ? ' is-quote' : ''}`}>
                <LineText line={line} ranges={ranges} replacement={replacement} />
              </li>
            );
          })}
        </ol>
      ) : <QuoteOnly quotes={quoteTexts(block)} replacement={replacement} />}
      {view && view.hasMoreAfter && !state.locked && (
        <MoreButton direction="down" loading={state.loading === 'down'} disabled={busy} onClick={() => onMore('down')} />
      )}
      {state.error && (
        <p className="vr-block__note" role="status">
          {state.error}
          {!state.locked && !view && block.sourceRef && (
            <button type="button" className="vr-block__retry" disabled={busy} onClick={() => onMore('retry')}>
              <RefreshCw size={13} aria-hidden="true" />다시 불러오기
            </button>
          )}
        </p>
      )}
    </div>
  );
}

export function ContextBlocks({ blocks, path, replacement, label, empty, footnote }: {
  blocks: ValidationFindingBlock[];
  path: ContextPath | null;
  /** 오탈자 제안. 이번 원고 블록의 인용 자리에 바꿀 말을 함께 보인다. */
  replacement: string | null;
  label: string;
  /** 근거 블록이 없을 때 이번 원고 블록 뒤에 둘 안내. */
  empty?: string | null;
  footnote?: ReactNode;
}) {
  const [states, setStates] = useState<BlockState[]>(() => blocks.map(initialState));
  const [open, setOpen] = useState<Set<number>>(() => new Set(blocks.map((_, index) => index).slice(0, OPEN_BY_DEFAULT)));
  const update = (index: number, change: (state: BlockState) => BlockState) => setStates(all => all.map((state, at) => at === index ? change(state) : state));

  const loadMore = async (index: number, kind: Loading) => {
    const block = blocks[index];
    const current = states[index];
    if (!path || !block?.sourceRef || !current || current.loading) return;
    const view = current.window;
    const sourceRef = block.sourceRef;
    const queries = kind === 'up' && view ? [{ anchorStart: view.start, anchorEnd: view.start, before: MORE_LINES, after: 0 }]
      : kind === 'down' && view ? [{ anchorStart: view.end, anchorEnd: view.end, before: 0, after: MORE_LINES }]
        : retryAnchors(block).map(range => ({ anchorStart: range.start, anchorEnd: range.end, before: 2, after: 2 }));
    update(index, state => ({ ...state, loading: kind, error: null }));
    try {
      const responses = await Promise.all(queries.map(query => getValidationFindingSourceContext({ path, query: { sourceRef, ...query } })));
      const windows = responses.map(({ data }) => toWindow(data?.data));
      const next = windows.every((window): window is ContextWindow => window !== null) ? mergeWindows(windows) : null;
      update(index, state => {
        if (!next) return { ...state, loading: null, error: UNREADABLE_MESSAGE };
        const previous = state.window;
        if (kind === 'retry' || !previous) return { window: next, loading: null, error: null, locked: false };
        if (kind === 'up') {
          const added = next.lines.filter(line => line.end <= previous.start);
          return { ...state, loading: null, window: { ...previous, start: added[0]?.start ?? previous.start, hasMoreBefore: next.hasMoreBefore, lines: [...added, ...previous.lines] } };
        }
        const added = next.lines.filter(line => line.start >= previous.end);
        return { ...state, loading: null, window: { ...previous, end: added.length ? added[added.length - 1].end : previous.end, hasMoreAfter: next.hasMoreAfter, lines: [...previous.lines, ...added] } };
      });
    } catch (error) {
      const apiError = toApiError(error);
      const locked = apiError?.code === 'VALIDATION_SOURCE_CONTEXT_UNAVAILABLE' && apiError.context.reason !== 'SOURCE_UNREADABLE';
      update(index, state => ({ ...state, loading: null, locked: state.locked || locked,
        error: locked ? (state.window ? LOCKED_MORE_MESSAGE : LOCKED_MESSAGE) : '앞뒤 문장을 더 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.' }));
    }
  };

  const toggle = (index: number) => setOpen(previous => {
    const next = new Set(previous);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });

  const rendered = blocks.map((block, index) => ({ block, index }));
  const targets = rendered.filter(item => item.block.kind === 'TARGET');
  const rest = rendered.filter(item => item.block.kind !== 'TARGET');
  const renderBlock = ({ block, index }: { block: ValidationFindingBlock; index: number }) => {
    const kind = block.kind ?? 'TARGET';
    const expanded = open.has(index);
    const headerId = `validation-block-${index}`;
    const bodyId = `validation-block-body-${index}`;
    const state = states[index] ?? initialState(block);
    return (
      <section key={index} className={`vr-block is-${kind.toLowerCase().replace('_', '-')}${expanded ? ' is-open' : ''}`} aria-labelledby={headerId}>
        <h3 className="vr-block__head">
          <button type="button" id={headerId} aria-expanded={expanded} aria-controls={bodyId} onClick={() => toggle(index)}>
            <span className="vr-block__role">{PREFIX[kind] ?? '근거'}</span>
            <span className="vr-block__label">{block.label}</span>
            <ChevronDown className="vr-block__chevron" size={15} aria-hidden="true" />
          </button>
        </h3>
        <div id={bodyId} hidden={!expanded}>
          {expanded && (kind === 'SETTING'
            ? <div className="vr-block__body"><SettingValue block={block} /></div>
            : <TextBody block={block} state={state} replacement={kind === 'TARGET' ? replacement : null} onMore={type => void loadMore(index, type)} />)}
        </div>
      </section>
    );
  };

  return (
    <section className="vr-blocks" aria-label={label}>
      {targets.map(renderBlock)}
      {empty && rest.length === 0 && (
        <section className="vr-block is-note" aria-label="기준">
          <p className="vr-block__head"><span className="vr-block__role">기준</span></p>
          <p className="vr-block__empty">{empty}</p>
        </section>
      )}
      {rest.map(renderBlock)}
      {footnote && <p className="vr-blocks__footnote">{footnote}</p>}
    </section>
  );
}
