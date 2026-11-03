import type { Page, Route } from '@playwright/test';
import review from './validation-review-v1.json' with { type: 'json' };
import stagingFixture from './validation-staging-v1.json' with { type: 'json' };
import resultsFixture from './validation-results-v1.json' with { type: 'json' };

/**
 * GH314 오류 리포트 목 API. 응답 모양은 Backend 계약 JSON(validation-review-v1.json)·staging/results fixture를
 * 복제하고 값만 바꾼다. 계약에 없는 필드는 만들지 않는다.
 */
export const WORK_ID = '00000000-0000-4000-8000-0000000000a1';
export const REPORT_ID = stagingFixture.awaitingReview.reportId;
export const PAST_REPORT_ID = review.responses.historyPage.content[1].reportId;
export const EPISODE_ID = stagingFixture.awaitingReview.episodeId;
export const BATCH_ID = stagingFixture.awaitingReview.batchId;
/** 재검수가 만드는 새 report. 계약 예시의 UUID 형식만 따른다. */
export const RECHECK_REPORT_ID = '00000000-0000-4000-8000-000000000012';
const REPLACED_BATCH_ID = '00000000-0000-4000-8000-000000000022';
/** #314 B2 대상. 계약 예시(findingSummary·findingSummaryWorld)의 대상 ID 형식을 따른다. */
export const CHARACTER_ID = review.responses.findingSummary.subject.id;
export const WORLD_ID = review.responses.findingSummaryWorld.subject.id;
export const ERWEN_ID = '00000000-0000-4000-8000-000000000603';
export const CORRECTION_RECEIPT_ID = '00000000-0000-4000-8000-000000000701';

type Subject = { type: 'CHARACTER' | 'WORLD_SETTING'; id: string | null; name: string } | null;
type Basis = (typeof review.responses.findingDetail.basis)[number];
type Detail = Omit<typeof review.responses.findingDetail, 'subject' | 'settingName' | 'settingKey' | 'basis'> & {
  subject: Subject; settingName: string | null; settingKey: string | null; basis: Basis[];
};
type Summary = typeof review.responses.reviewSummary;
type Staging = typeof stagingFixture.awaitingReview;
type HistoryRow = (typeof review.responses.historyPage.content)[number];
type Judgment = 'PENDING' | 'NEEDS_FIX' | 'NOT_CONFLICT' | 'KEEP_ORIGINAL';

const clone = <T,>(value: T): T => structuredClone(value);
const findingIds = ['101', '111', '121', '131', '141', '151'].map(suffix => `00000000-0000-4000-8000-000000000${suffix}`);

function completion(reason: string, refs: string[]) {
  return { reason, evidence_refs: refs };
}

type Evidence = (typeof review.responses.findingDetail.evidence)[number];
type BasisQuote = (typeof review.responses.findingDetail.basisQuotes)[number];
type Block = (typeof review.responses.findingDetail.blocks)[number];
type SourceLine = { start: number; end: number; text: string };
type SourceWindow = { sourceRef: string; start: number; end: number; totalCodePoints: number; hasMoreBefore: boolean; hasMoreAfter: boolean; lines: SourceLine[] };
const cp = (value: string) => Array.from(value).length;

/**
 * 합성 원고(실제 원고가 아니다). 웹소설 원고 파일처럼 문단마다 CRLF와 빈 줄을 둔다.
 * T1=이번 원고 101화, R1=20화, R3=24화, R2=설정집. 문맥 블록의 앞뒤 줄과 더 보기는 이 글을 서버 규칙대로 잘라 준다.
 */
const paragraphs = (...lines: string[]) => lines.join('\r\n\r\n');
const SYNTHETIC_SOURCES: Record<string, string> = {
  T1: paragraphs(
    '새벽이 오기 전, 성 밖의 들판은 조용했다.', '말발굽 소리가 멀리서 가까워졌다.', '성문 앞에 모인 사람들이 숨을 죽였다.', '북쪽 하늘이 붉게 물들고 있었다.',
    '비요른은 그 검을 뽑았다.', '칼날이 떨리는 소리가 성벽에 부딪혔다.', '아무도 그 검이 어디서 왔는지 묻지 않았다.', '부서졌던 검신이 달빛 아래 날카롭게 빛났다.',
    '왕궁 앞뜰에 발을 디딘 에르웬이 짧은 주문을 읊자, 손끝에서 작은 불꽃이 피어났다.', '경비병들이 서로를 돌아보았다.', '그러면 되요 정말 괜찮겠어?',
    '에르웬은 붉은 망토를 여몄다.', '바람이 다시 거세졌다.', '붉은 망토 자락이 바람에 흩날렸다.', '성문이 천천히 열리기 시작했다.', '누군가 낮게 비요른의 이름을 불렀다.'),
  R1: paragraphs(
    '전령이 성문을 두드렸다.', '병사들이 서둘러 성벽으로 올라갔다.', '격전은 해가 질 때까지 이어졌다.', '비요른은 마지막 힘을 짜내 도끼를 막아 냈다.', '그의 검은 손잡이만 남긴 채 산산이 부서졌다.', '비요른은 남은 손잡이를 허리에 찼다.',
    '성벽 위에 바람이 거셌다.', '에르웬의 푸른 망토가 바람에 날렸다.', '두 사람은 말없이 북쪽을 바라보았다.', '밤이 깊어 갔다.'),
  R2: paragraphs('왕궁의 규칙', '왕궁 안에서는 누구도 마법을 사용할 수 없다.', '왕궁 앞뜰의 경계는 따로 정하지 않았다.'),
  R3: paragraphs(
    '대장간 앞은 늘 시끄러웠다.', '망치 소리가 골목을 가득 채웠다.', '비요른은 부서진 검을 대장간에 맡기지 않았다.', '그는 손잡이를 다시 허리에 찼다.',
    '새 검을 사겠냐는 물음에 고개를 저었다.'),
};
const EPISODE_OF: Record<string, number | null> = { T1: 101, R1: 20, R2: null, R3: 24 };

/** code point 위치. 합성 글에 없는 문장이면 테스트 작성 오류다. */
function positionOf(ref: string, quote: string) {
  const text = SYNTHETIC_SOURCES[ref];
  const at = text.indexOf(quote);
  if (at < 0) throw new Error(`synthetic source ${ref} has no "${quote}"`);
  const start = cp(text.slice(0, at));
  return { start, end: start + cp(quote) };
}

/** Backend `ValidationSourceWindow`와 같은 규칙: CRLF·LF·CR 줄 끝, 공백만 있는 줄 제외, 위아래를 번갈아 채우고 3,000자 상한. */
function sourceLines(text: string): SourceLine[] {
  const chars = Array.from(text);
  const lines: SourceLine[] = [];
  let start = 0;
  for (let i = 0; i <= chars.length; i++) {
    if (i < chars.length && chars[i] !== '\n' && chars[i] !== '\r') continue;
    const value = chars.slice(start, i).join('');
    if (value.trim()) lines.push({ start, end: i, text: value });
    if (chars[i] === '\r' && chars[i + 1] === '\n') i++;
    start = i + 1;
  }
  return lines;
}
function sourceWindow(ref: string, anchorStart: number, anchorEnd: number, before: number, after: number): SourceWindow {
  const text = SYNTHETIC_SOURCES[ref];
  const lines = sourceLines(text);
  let first = lines.findIndex(line => line.end > anchorStart);
  if (first < 0) first = lines.length;
  let last = lines.length - 1;
  while (last >= 0 && lines[last].start >= anchorEnd) last--;
  if (anchorStart === anchorEnd) last = Math.min(last, first - 1);
  let lo = first, hi = last, used = 0, up = before > 0, down = after > 0, addedBefore = 0, addedAfter = 0;
  for (let k = first; k <= last; k++) used += lines[k].end - lines[k].start;
  const length = (line: SourceLine) => line.end - line.start;
  while (up || down) {
    if (up) {
      if (lo === 0 || used + length(lines[lo - 1]) > 3000) up = false;
      else { lo--; used += length(lines[lo]); up = ++addedBefore < before; }
    }
    if (down) {
      if (hi === lines.length - 1 || used + length(lines[hi + 1]) > 3000) down = false;
      else { hi++; used += length(lines[hi]); down = ++addedAfter < after; }
    }
  }
  const picked = lo <= hi ? lines.slice(lo, hi + 1) : [];
  return {
    sourceRef: ref, start: picked[0]?.start ?? anchorStart, end: picked.length ? picked[picked.length - 1].end : anchorStart, totalCodePoints: cp(text),
    hasMoreBefore: lo > 0, hasMoreAfter: hi < lines.length - 1, lines: picked,
  };
}

type TextKind = 'TARGET' | 'EPISODE' | 'SETTING_BOOK';
type BlockQuote = { quote: string; start: number | null; end: number | null };

function textLabel(ref: string, start: number, end: number) {
  const episodeNo = EPISODE_OF[ref];
  const position = `${start + 1}~${end}자`;
  return episodeNo != null ? `${episodeNo}화 · ${position}` : `설정집 · 합성 설정집 · ${position}`;
}

/** 원문 블록(서버 `ValidationFindingLabels`와 같은 label·처음 위아래 2줄). `quotes`는 이 블록이 강조하는 인용 전부다. */
function textBlock(kind: TextKind, ref: string, quote: string, label?: string): Block {
  const { start, end } = positionOf(ref, quote);
  return {
    kind, label: label ?? textLabel(ref, start, end), quote, quotes: [{ quote, start, end }], sourceRef: ref, start, end,
    episodeNo: EPISODE_OF[ref], settingValue: null, context: sourceWindow(ref, start, end, 2, 2), contextStatus: 'READY',
  } as unknown as Block;
}

/**
 * 서버 블록 합치기(2026-11-03)와 같은 규칙: 같은 출처의 인용을 원문 순서로 보고, 각 인용의 처음 앞뒤 2줄 창이 겹치거나 맞닿으면
 * (다음 창의 첫 줄이 앞 창의 마지막 줄 바로 다음 줄 이전) 한 블록으로 합친다. 합친 블록은 덮는 범위 label·창을 쓰고 `quotes`에 인용을 모두 담는다.
 */
function mergedTextBlocks(kind: TextKind, ref: string, quotes: string[]): Block[] {
  const lines = sourceLines(SYNTHETIC_SOURCES[ref]);
  const groups: Array<{ quotes: Array<{ quote: string; start: number; end: number }>; last: number }> = [];
  const placed = quotes.map(quote => ({ quote, ...positionOf(ref, quote) })).sort((a, b) => a.start - b.start || a.end - b.end);
  for (const item of placed) {
    const window = sourceWindow(ref, item.start, item.end, 2, 2);
    const first = lines.findIndex(line => line.start === window.start);
    const last = lines.findIndex(line => line.end === window.end);
    const group = groups[groups.length - 1];
    if (group && first <= group.last + 1) {
      group.quotes.push(item);
      group.last = Math.max(group.last, last);
    } else groups.push({ quotes: [item], last });
  }
  return groups.map(group => {
    const start = Math.min(...group.quotes.map(item => item.start));
    const end = Math.max(...group.quotes.map(item => item.end));
    return {
      kind, label: textLabel(ref, start, end), quote: group.quotes[0].quote, quotes: group.quotes, sourceRef: ref, start, end,
      episodeNo: EPISODE_OF[ref], settingValue: null, context: sourceWindow(ref, start, end, 2, 2), contextStatus: 'READY',
    } as unknown as Block;
  });
}
function settingBlock(quotes: BasisQuote[], settingValue: string | null): Block {
  const items: BlockQuote[] = quotes.map(quote => ({ quote: quote.quote, start: null, end: null }));
  return { kind: 'SETTING', label: quotes[0].label, quote: quotes[0].quote, quotes: items, sourceRef: null, start: null, end: null, episodeNo: null,
    settingValue, context: null, contextStatus: null } as unknown as Block;
}

/** 계약 evidence 예시 모양으로 원문 조각을 만든다. 근거 문장이 조각 안에 있으면 서버처럼 강조 구간을 채운다. */
function chunk(sourceRef: string, quote: string, used: boolean, sentences: string[] = []): Evidence {
  const { start, end } = positionOf(sourceRef, quote);
  const episodeNo = EPISODE_OF[sourceRef];
  const highlights = sentences.map(sentence => {
    const at = cp(quote.slice(0, quote.indexOf(sentence)));
    return { start: at, end: at + cp(sentence) };
  });
  return {
    sourceRef, start, end, quote, sourceKind: episodeNo == null ? 'SETTING_BOOK' : 'EPISODE', episodeNo: episodeNo as number,
    label: episodeNo == null ? `설정집 · 합성 설정집 · ${start + 1}~${end}자` : `${episodeNo}화 · ${start + 1}~${end}자`,
    usedByDecision: used, highlights,
  } as unknown as Evidence;
}
/** 저장 설정값 근거 문장(서버 label `설정 · 대상 · 설정명`). */
function settingQuote(subjectName: string, settingName: string | null, quote: string): BasisQuote {
  return { kind: 'SETTING', label: ['설정', subjectName, settingName].filter(Boolean).join(' · '), quote, sourceRef: null, start: null, end: null,
    episodeNo: null, subjectName, settingName, settingBookTitle: null } as unknown as BasisQuote;
}
/** 이전 회차 근거 문장. 위치는 합성 원고 전체 기준 code point다. */
function episodeQuote(ref: string, sentence: string): BasisQuote {
  const { start, end } = positionOf(ref, sentence);
  return { kind: 'EPISODE', label: `${EPISODE_OF[ref]}화`, quote: sentence, sourceRef: ref, start, end,
    episodeNo: EPISODE_OF[ref], subjectName: null, settingName: null, settingBookTitle: null } as unknown as BasisQuote;
}

/**
 * 서버 순서: 이번 원고 위치 → 설정값 → 이전 회차(회차 순) → 설정집. 같은 출처의 앞뒤 줄이 겹치거나 맞닿는 인용은 한 블록이고,
 * 같은 저장 설정값을 가리키는 설정 인용도 한 블록이다(서버 규칙과 같다).
 */
function blocksOf(targets: string[], quotes: BasisQuote[], settingValues: Record<string, string> = {}): Block[] {
  const episodes = quotes.filter(quote => quote.kind !== 'SETTING')
    .sort((a, b) => ((a.kind === 'SETTING_BOOK' ? 1 : 0) - (b.kind === 'SETTING_BOOK' ? 1 : 0))
      || ((a.episodeNo ?? 1e9) - (b.episodeNo ?? 1e9)) || ((a.start ?? 0) - (b.start ?? 0)));
  const settings: Array<{ quotes: BasisQuote[]; value: string | null }> = [];
  for (const quote of quotes.filter(item => item.kind === 'SETTING')) {
    const value = settingValues[quote.quote] ?? null;
    const same = value == null ? undefined : settings.find(group => group.value === value && group.quotes[0].label === quote.label);
    if (same) same.quotes.push(quote); else settings.push({ quotes: [quote], value });
  }
  const sources: Array<{ kind: TextKind; ref: string; quotes: string[] }> = [];
  for (const quote of episodes) {
    const ref = quote.sourceRef as string;
    const last = sources[sources.length - 1];
    if (last && last.ref === ref) last.quotes.push(quote.quote);
    else sources.push({ kind: quote.kind === 'SETTING_BOOK' ? 'SETTING_BOOK' : 'EPISODE', ref, quotes: [quote.quote] });
  }
  return [
    ...mergedTextBlocks('TARGET', 'T1', targets),
    ...settings.map(group => settingBlock(group.quotes, group.value)),
    ...sources.flatMap(source => mergedTextBlocks(source.kind, source.ref, source.quotes)),
  ];
}

/** 계약의 findingDetail을 복제해 값만 바꾼다. payload는 공개 허용 키만 사용한다. */
function settingDetail(index: number, values: {
  outcome: string; basis: string; impact: string; reason: string; impactReason: string; target: string[];
  basisEvidence: Evidence[]; context: string; exceptions: string; disagreements?: string[]; changed?: boolean;
  subject: Subject; settingName?: string | null; settingKey?: string | null; basisEntries?: Basis[];
  topic?: string | null; basisQuotes?: BasisQuote[]; settingValues?: Record<string, string>;
  /** 판정이 쓴 제목(2026-11-03). 없으면 이 변경 전 결과처럼 null이다. */
  headline?: string | null;
}): Detail {
  const detail = clone(review.responses.findingDetail) as unknown as Detail & { payload: Record<string, unknown> };
  // #314 B2: 대상·설정명·정정 기준 항목은 계약 모양을 따르고 값만 장면에 맞게 바꾼다.
  detail.subject = values.subject;
  detail.settingName = values.settingName ?? null;
  detail.settingKey = values.settingKey ?? null;
  detail.basis = values.basisEntries ?? [];
  detail.topic = values.topic ?? null as unknown as string;
  (detail as unknown as { headline: string | null }).headline = values.headline ?? null;
  detail.targetEpisodeNo = 101;
  detail.basisQuotes = values.basisQuotes ?? [];
  const targetSpans = values.target.map(quote => ({ source_ref: 'T1', ...positionOf('T1', quote), quote }));
  detail.findingId = findingIds[index];
  detail.checkId = `00000000-0000-4000-8000-00000000020${index}`;
  detail.unitRef = `Q${index + 1}`;
  detail.checkRevision = 1;
  detail.currentCheckRevision = 1;
  detail.outcome = values.outcome;
  detail.stale = false;
  detail.changed = values.changed ?? false;
  detail.payload = {
    reason: values.reason, basis: values.basis, impact: values.impact, impact_reason: values.impactReason,
    target_spans: targetSpans, evidence_refs: ['T1', 'E1'],
    disagreements: (values.disagreements ?? []).map(reason => ({ fact_ref: 'B1', evidence_ref: 'E1', reason })),
    completion: {
      comparison_context: completion(values.context, ['T1']),
      changes_exceptions: completion(values.exceptions, []),
      no_pending_clues: completion('남은 단서가 없어요.', []),
      required_reads: completion('필요한 원문을 모두 읽었어요.', []),
    },
  };
  // 저장 인용(evidence)은 계약 필드로 남기지만 화면은 blocks만 쓴다.
  detail.evidence = [...values.basisEvidence, ...values.target.map(quote => chunk('T1', quote, false))];
  detail.blocks = blocksOf(values.target, detail.basisQuotes, values.settingValues);
  detail.judgment = { value: 'PENDING', version: 0, decidedAt: null as unknown as string };
  detail.allowedJudgments = ['PENDING', 'NEEDS_FIX', 'NOT_CONFLICT'];
  detail.judgmentHistory = [];
  detail.priorRevisions = [];
  return detail;
}

function typoDetail(index: number, values: { outcome: string; reason: string; quote: string; replacement: string }): Detail {
  const detail = clone(review.responses.findingDetail) as unknown as Detail & { payload: Record<string, unknown> };
  // 오탈자는 대상·설정명이 없고 basis는 빈 배열이다(계약 findingSummaryTypo).
  detail.subject = null;
  detail.settingName = null;
  detail.settingKey = null;
  detail.basis = [];
  detail.topic = null as unknown as string;
  (detail as unknown as { headline: string | null }).headline = null;
  detail.targetEpisodeNo = 101;
  detail.basisQuotes = [];
  detail.findingId = findingIds[index];
  detail.branch = 'TYPO';
  detail.unitRef = 'TSEG1';
  detail.checkId = null as unknown as string;
  detail.checkRevision = null as unknown as number;
  detail.currentCheckRevision = null as unknown as number;
  detail.outcome = values.outcome;
  detail.stale = false;
  detail.changed = false;
  detail.payload = {
    reason: values.reason, category: values.outcome, replacement: values.replacement,
    span: { source_ref: 'T1', ...positionOf('T1', values.quote), quote: values.quote },
  };
  detail.evidence = [chunk('T1', `그러면 ${values.quote} 정말`, false)];
  detail.blocks = [textBlock('TARGET', 'T1', values.quote)];
  detail.judgment = { value: 'PENDING', version: 0, decidedAt: null as unknown as string };
  detail.allowedJudgments = ['PENDING', 'NEEDS_FIX', 'KEEP_ORIGINAL'];
  detail.judgmentHistory = [];
  detail.priorRevisions = [];
  return detail;
}

/** 계약 basis 예시를 복제해 값만 바꾼다. */
function basisEntry(values: Partial<Basis> & Pick<Basis, 'entryRef' | 'subjectType' | 'targetId' | 'subjectName'>): Basis {
  return {
    ...clone(review.responses.findingDetail.basis[0]),
    entryHash: values.entryRef === 'B1' ? 'c'.repeat(64) : values.entryRef === 'B2' ? 'd'.repeat(64) : 'e'.repeat(64),
    factType: null as unknown as string, factKey: null as unknown as string, scopeName: null, settingName: null,
    ...values,
  } as Basis;
}

export const BJORN_BASIS = basisEntry({ entryRef: 'B1', subjectType: 'CHARACTER', targetId: CHARACTER_ID, subjectName: '비요른', factType: 'ITEM', factKey: 'item.검', currentVersion: 3 });
export const PALACE_BASIS = basisEntry({ entryRef: 'B2', subjectType: 'WORLD_SETTING', targetId: WORLD_ID, subjectName: '왕궁', scopeName: '마법', settingName: '사용 제한', currentVersion: 4 } as unknown as Partial<Basis> & Pick<Basis, 'entryRef' | 'subjectType' | 'targetId' | 'subjectName'>);
export const ERWEN_BASIS = basisEntry({ entryRef: 'B3', subjectType: 'CHARACTER', targetId: ERWEN_ID, subjectName: '에르웬', currentVersion: 2 });

/** 합성 이전 회차 조각(실제 원고가 아니다). 판정이 쓴 조각과 검색만 한 조각을 함께 둔다. */
const SWORD_CHUNK = chunk('R1', '비요른은 마지막 힘을 짜내 도끼를 막아 냈다.\r\n\r\n그의 검은 손잡이만 남긴 채 산산이 부서졌다.', true, ['그의 검은 손잡이만 남긴 채 산산이 부서졌다.']);
const FORGE_CHUNK = chunk('R3', '비요른은 부서진 검을 대장간에 맡기지 않았다.', true, ['비요른은 부서진 검을 대장간에 맡기지 않았다.']);
const CLOAK_CHUNK = chunk('R1', '성벽 위에 바람이 거셌다.\r\n\r\n에르웬의 푸른 망토가 바람에 날렸다.', true, ['에르웬의 푸른 망토가 바람에 날렸다.']);

export function defaultFindings(): Detail[] {
  return [
    settingDetail(0, {
      subject: { type: 'CHARACTER', id: CHARACTER_ID, name: '비요른' }, settingName: '검', settingKey: 'ITEM:item.검', basisEntries: [BJORN_BASIS],
      outcome: 'CONFLICT', basis: 'DIRECT_CONTRADICTION', impact: 'SEVERE',
      topic: '검의 상태',
      // 판정이 쓴 제목과 원인→결과 두 문장(2026-11-03 형식).
      headline: '비요른의 검 상태가 기존 설정과 달라요',
      reason: '기존 설정은 비요른의 검이 산산이 부서져 손잡이만 남았다고 해요. 그런데 101화에서는 그 검을 다시 뽑아 들어요.',
      impactReason: '부서진 검으로 성문을 여는 장면의 성립 조건이에요.',
      target: ['비요른은 그 검을 뽑았다.'],
      basisEvidence: [SWORD_CHUNK, FORGE_CHUNK, chunk('R3', '대장간 앞은 늘 시끄러웠다.', false)],
      // 근거 순서는 판정이 낸 순서(24화가 먼저)여도 블록은 회차 순으로 쌓인다.
      basisQuotes: [settingQuote('비요른', '검', '산산이 부서져 손잡이만 남음'), episodeQuote('R3', '비요른은 부서진 검을 대장간에 맡기지 않았다.'),
        episodeQuote('R1', '그의 검은 손잡이만 남긴 채 산산이 부서졌다.')],
      settingValues: { '산산이 부서져 손잡이만 남음': '20화 전투 중 산산이 부서져 손잡이만 남음' },
      context: '20화 이후 검을 다시 얻었다는 기록과 비교했어요.',
      exceptions: '수리하거나 새로 얻었다는 설명을 찾지 못했어요.',
    }),
    settingDetail(1, {
      subject: { type: 'WORLD_SETTING', id: WORLD_ID, name: '왕궁' }, settingName: '마법 / 사용 제한', settingKey: '["마법","사용 제한"]',
      basisEntries: [PALACE_BASIS, ERWEN_BASIS],
      outcome: 'NEEDS_CONTEXT', basis: 'AMBIGUOUS_MEANING', impact: 'SEVERE',
      topic: '앞뜰의 마법 사용',
      headline: '왕궁 앞뜰이 마법 금지 구역인지 확인이 필요해요',
      reason: '왕궁 앞뜰이 마법 금지 구역에 들어가는지 알 수 없어요.',
      impactReason: '주문으로 탈출하는 장면의 성립 조건이에요.',
      target: ['왕궁 앞뜰에 발을 디딘 에르웬이 짧은 주문을 읊자, 손끝에서 작은 불꽃이 피어났다.'],
      basisEvidence: [chunk('R2', '왕궁 안에서는 누구도 마법을 사용할 수 없다.', false)],
      context: '앞뜰이 ‘왕궁 안’에 포함되는지 설정에 적혀 있지 않아요.',
      exceptions: '앞뜰에 대한 예외 규칙을 찾지 못했어요.',
    }),
    settingDetail(2, {
      // 질문 속성이 고정 slot과 정확히 맞지 않아 설정명은 없다(대상만 표시). 같은 내용이 원고 두 곳에 있다.
      // 두 곳의 앞뒤 줄이 겹쳐 이번 원고 블록 하나로 합친다. 판정 제목이 없는 이전 결과라 화면이 제목을 만든다.
      subject: { type: 'CHARACTER', id: ERWEN_ID, name: '에르웬' }, settingName: null, basisEntries: [ERWEN_BASIS],
      outcome: 'SUSPECTED_CONFLICT', basis: 'CHANGE_NOT_FOUND', impact: 'REFERENCE', changed: true,
      topic: '망토 색',
      reason: '망토의 색이 이전 회차와 달라요.',
      impactReason: '행동이나 사건에 쓰이지 않는 부수적 묘사예요.',
      target: ['에르웬은 붉은 망토를 여몄다.', '붉은 망토 자락이 바람에 흩날렸다.'],
      basisEvidence: [CLOAK_CHUNK],
      basisQuotes: [episodeQuote('R1', '에르웬의 푸른 망토가 바람에 날렸다.')],
      context: '같은 망토를 계속 입고 있는 장면과 비교했어요.',
      exceptions: '망토를 바꿨다는 설명을 찾지 못했어요.',
    }),
    typoDetail(3, { outcome: 'SPELLING', reason: '‘되어요’의 준말은 ‘돼요’예요.', quote: '되요', replacement: '돼요' }),
  ];
}

/** 설정 항목의 이번 원고 위치를 바꾼다. 블록은 서버 규칙(앞뒤 줄이 겹치거나 맞닿으면 합침)대로 다시 만든다. */
export function retarget(detail: Detail, targets: string[]): Detail {
  const next = clone(detail) as Detail & { payload: Record<string, unknown> };
  next.payload = { ...next.payload, target_spans: targets.map(quote => ({ source_ref: 'T1', ...positionOf('T1', quote), quote })) };
  next.blocks = blocksOf(targets, next.basisQuotes);
  return next;
}

function summaryOf(detail: Detail) {
  const payload = detail.payload as Record<string, unknown>;
  const spans = detail.branch === 'TYPO' ? [payload.span] : payload.target_spans as unknown[];
  return {
    ...clone(review.responses.findingSummary),
    findingId: detail.findingId, branch: detail.branch, unitRef: detail.unitRef, checkId: detail.checkId,
    checkRevision: detail.checkRevision, outcome: detail.outcome, judgment: detail.judgment, changed: detail.changed,
    subject: detail.subject, settingName: detail.settingName, settingKey: detail.settingKey, topic: detail.topic,
    headline: (detail as unknown as { headline?: string | null }).headline ?? null,
    summary: {
      impact: detail.branch === 'SETTING' ? payload.impact as string : null as unknown as string,
      reason: payload.reason as string,
      replacement: detail.branch === 'TYPO' ? payload.replacement as string : null,
      spans: (spans as Array<Record<string, unknown>>).map(span => ({ sourceRef: span.source_ref, start: span.start, end: span.end, quote: span.quote })),
    },
  };
}

export type ReportScenario = {
  findings?: Detail[];
  staging?: Partial<Staging>;
  summary?: Partial<Summary>;
  results?: Record<string, unknown>;
  history?: HistoryRow[];
  currentReportMissing?: boolean;
  /** 회차 단위 자격 조회(GET /eligibility?episodeId=)의 값. 기본은 현재 report가 있는 최신 회차다. */
  eligibility?: Record<string, unknown>;
  /** 설정 관리 화면의 캐릭터·세계관 상세(A5·A10). 기본은 basis가 가리키는 대상 세 개다. */
  characters?: CharacterDetail[];
  worldSettings?: WorldDetail[];
};

type Failure = { status: number; code: string; message: string; context?: Record<string, unknown> };

const characterSetting = (prefix: string, name: string, value: string) => ({
  key: `${prefix}${name}`, displayName: name, value, valueType: 'STRING', attributeNameEditable: true, attributeNamePrefix: prefix,
  displayNameEditable: true, properties: [] as Array<{ key: string; displayName: string; value: string | null; valueType: string }>, sourceFacts: [], hasEvidence: false,
});
type CharacterDetail = {
  id: string; name: string; roleLabel: string | null; currentAge: number | null; currentLevel: number | null;
  profile: ReturnType<typeof characterSetting>[]; stats: ReturnType<typeof characterSetting>[]; skills: ReturnType<typeof characterSetting>[];
  items: ReturnType<typeof characterSetting>[]; statuses: ReturnType<typeof characterSetting>[];
};
const CHARACTER_GROUPS = ['profile', 'stats', 'skills', 'items', 'statuses'] as const;
type CharacterEdit = Pick<CharacterDetail, 'currentAge' | 'currentLevel'> & Record<typeof CHARACTER_GROUPS[number], Array<{
  key: string; value: string | null; properties: Array<{ key: string; value: string | null; valueType: string }>;
}>>;
/** 정정 저장(Backend correctCharacterSetting)처럼 편집한 값·세부 속성을 snapshot에 그대로 남긴다. 다시 읽은 상세는 보낸 편집과 같다. */
function applyCharacterEdit(character: CharacterDetail, edit: CharacterEdit) {
  character.currentAge = edit.currentAge ?? null;
  character.currentLevel = edit.currentLevel ?? null;
  for (const group of CHARACTER_GROUPS) {
    for (const item of edit[group] ?? []) {
      const target = character[group].find(existing => existing.key === item.key);
      if (!target) continue;
      target.value = item.value ?? '';
      target.properties = (item.properties ?? []).map(property => ({ ...property, displayName: property.key === 'name' ? '이름' : property.key }));
    }
  }
}
type WorldDetail = {
  id: string; category: string; subjectName: string; version: number;
  properties: Array<{ scopeName: string | null; settingName: string; value: string }>;
};

/** 설정 관리 목 데이터. 정정 대상은 계약 basis의 targetId와 같다. 원문 인용은 넣지 않는다. */
function defaultCharacters(): CharacterDetail[] {
  return [
    { id: CHARACTER_ID, name: '비요른', roleLabel: '주인공', currentAge: 27, currentLevel: null,
      profile: [characterSetting('profile.', '출신', '북부')], stats: [], skills: [], items: [characterSetting('item.', '검', '부서진 검')], statuses: [] },
    { id: ERWEN_ID, name: '에르웬', roleLabel: '마법사', currentAge: 24, currentLevel: null,
      profile: [characterSetting('profile.', '망토', '푸른 망토')], stats: [], skills: [], items: [], statuses: [] },
  ];
}

function defaultWorldSettings(): WorldDetail[] {
  return [{
    id: WORLD_ID, category: 'LOCATION', subjectName: '왕궁', version: 4,
    properties: [
      { scopeName: null, settingName: '위치', value: '수도 중심' },
      { scopeName: '마법', settingName: '사용 제한', value: '왕궁 안에서는 누구도 마법을 사용할 수 없다' },
    ],
  }];
}

/** 회차 상세(GET /episodes/{id}). 원문은 목 응답에 넣지 않는다. */
function episodeDetail(revision: number) {
  const suffix = revision.toString(16).padStart(2, '0');
  return {
    id: EPISODE_ID, workId: WORK_ID, episodeNo: 101, title: '성문 앞에서', content: '',
    originalFilename: revision > 3 ? '101-revised.txt' : '101.txt',
    contentUpdatedAt: revision > 3 ? '2026-10-30T12:00:00' : '2026-10-30T09:00:00',
    contentS3Key: `works/${WORK_ID}/episodes/101-r${revision}.txt`, contentS3Version: `synthetic-v${revision}`,
    contentHash: `${suffix}`.repeat(32), charCount: 5200, status: 'UPLOADED', contentRevision: revision,
  };
}

const success = (route: Route, data: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, message: '성공', data, error: null }) });
const failure = (route: Route, status: number, code: string, message: string, context: Record<string, unknown> = {}) => route.fulfill({
  status, contentType: 'application/json',
  body: JSON.stringify({ success: false, message, data: null, error: { code, status, details: [], context } }),
});

export async function mockValidationReport(page: Page, scenario: ReportScenario = {}) {
  const state = {
    findings: clone(scenario.findings ?? defaultFindings()),
    staging: { ...clone(stagingFixture.awaitingReview), ...scenario.staging } as Staging,
    summaryPatch: { ...scenario.summary } as Partial<Summary>,
    results: clone(scenario.results ?? resultsFixture.completed) as Record<string, unknown>,
    history: clone(scenario.history ?? review.responses.historyPage.content),
    judgmentFailure: null as null | { code: string; message: string; external?: { findingId: string; judgment: Judgment } },
    requests: [] as Array<{ method: string; path: string; body: unknown }>,
    findingQueries: [] as string[],
    detailGets: 0,
    episodeRevision: scenario.staging?.targetRevision ?? stagingFixture.awaitingReview.targetRevision,
    pastReports: new Map<string, Staging>(),
    eligibility: { ...clone(review.responses.eligibilityReportExists), episodeId: EPISODE_ID, ...scenario.eligibility } as Record<string, unknown>,
    replaceFailure: null as Failure | null,
    recheckFailure: null as Failure | null,
    /** true면 재검수 report를 만든 뒤 응답을 끊는다(응답 유실). */
    recheckResponseLost: false,
    /** 테스트가 풀어 줄 때까지 재검수·현재 검수 응답을 붙잡아 둔다. */
    recheckHold: null as Promise<void> | null,
    currentHold: null as Promise<void> | null,
    episodeDetailHold: null as Promise<void> | null,
    characters: clone(scenario.characters ?? defaultCharacters()),
    worldSettings: clone(scenario.worldSettings ?? defaultWorldSettings()),
    correctionFailure: null as Failure | null,
    /** true면 정정을 저장한 뒤 응답을 끊는다(응답 유실). */
    correctionResponseLost: false,
    /** 테스트가 풀어 줄 때까지 정정 요청 처리를 붙잡아 둔다. 풀면 저장한 뒤 응답한다. */
    correctionHold: null as Promise<void> | null,
    /** 발급한 정정 receipt. 같은 키 재전송은 같은 receipt를 돌려준다. */
    corrections: new Map<string, { correctionId: string; body: string; reportVersion: number }>(),
    /** 문맥 블록 더 보기 요청의 query 문자열. */
    contextRequests: [] as string[],
    contextFailure: null as Failure | null,
  };

  const counts = () => {
    const current = state.findings.filter(item => !item.stale);
    const of = (branch: string, value: Judgment) => current.filter(item => item.branch === branch && item.judgment.value === value).length;
    const total = (branch: string) => current.filter(item => item.branch === branch).length;
    return {
      settingTotal: total('SETTING'), settingPending: of('SETTING', 'PENDING'), settingNeedsFix: of('SETTING', 'NEEDS_FIX'), settingNotConflict: of('SETTING', 'NOT_CONFLICT'),
      typoTotal: total('TYPO'), typoPending: of('TYPO', 'PENDING'), typoNeedsFix: of('TYPO', 'NEEDS_FIX'), typoKeepOriginal: of('TYPO', 'KEEP_ORIGINAL'),
    };
  };
  // Backend ValidationReviewGate의 공개 결과만 흉내 낸다. 화면은 이 응답 필드로만 권한을 판단한다.
  const summary = (): Summary => {
    const value = counts();
    const pending = value.settingPending + value.typoPending;
    const needsFix = value.settingNeedsFix + value.typoNeedsFix;
    const explicit = pending === 0 && needsFix === 0;
    return {
      ...clone(review.responses.reviewSummary),
      reportId: state.staging.reportId,
      reportVersion: state.staging.reportVersion,
      executionStatus: state.staging.executionStatus,
      mode: state.staging.mode,
      counts: value,
      judgmentLocked: false,
      lockReason: null as unknown as string,
      canCompleteReview: explicit,
      completionMode: explicit ? 'EXPLICIT_REQUIRED' : 'BLOCKED',
      holdReasons: [...(pending ? ['PENDING_JUDGMENTS'] : []), ...(needsFix ? ['NEEDS_FIX_PENDING'] : [])],
      allowedActions: ['SAVE_JUDGMENT', ...(explicit ? ['COMPLETE_REVIEW'] : [])],
      completion: null as unknown as Summary['completion'],
      releaseHold: null,
      application: null as unknown as Summary['application'],
      extractionState: 'NOT_STARTED',
      reviewStage: state.staging.reviewStage,
      ...state.summaryPatch,
    } as Summary;
  };
  const bump = () => { state.staging.reportVersion += 1; };
  // 원고 교체: Backend처럼 현재 report를 퇴역시키지 않고 무효로 만들고 재검수만 허용한다.
  const invalidate = () => {
    state.staging = { ...state.staging, status: 'INVALIDATED', baselineStatus: 'INVALIDATED', reviewStage: 'INVALIDATED', baselineHash: null as unknown as string, reportVersion: state.staging.reportVersion + 1 };
    state.summaryPatch = { ...state.summaryPatch, reviewStage: 'INVALIDATED', judgmentLocked: true, lockReason: 'REPORT_INVALIDATED', allowedActions: ['RECHECK'], holdReasons: ['REPORT_INVALIDATED'] } as Partial<Summary>;
    state.findings = [];
  };
  // 재검수: 이전 report는 이력으로 남고 새 report가 현재가 된다. 확정한 회차는 결과 전용 재검수다.
  const recheck = () => {
    const previous = state.staging;
    const applied = (summary().application as { status?: string } | null)?.status === 'APPLIED' || previous.mode === 'DIAGNOSTIC_ONLY';
    state.pastReports.set(previous.reportId, { ...previous, current: false, status: 'INVALIDATED', baselineStatus: 'INVALIDATED', reviewStage: 'INVALIDATED', executionStatus: 'CANCELED' });
    state.staging = {
      ...previous, reportId: RECHECK_REPORT_ID, baselineId: RECHECK_REPORT_ID, batchId: previous.status === 'INVALIDATED' ? REPLACED_BATCH_ID : previous.batchId,
      revision: previous.revision + 1, reportVersion: 1, baselineRevision: previous.baselineRevision + 1, previousReportId: previous.reportId,
      mode: applied ? 'DIAGNOSTIC_ONLY' : 'BEFORE_CONFIRMATION', targetRevision: state.episodeRevision, executionStatus: 'QUEUED',
      status: 'WAITING_FOR_ERROR_REVIEW', baselineStatus: 'READY', errorReviewStatus: 'NOT_STARTED', reviewStage: 'VALIDATING',
      baselineHash: 'c'.repeat(64), baselineFingerprint: 'c'.repeat(64),
    } as Staging;
    state.summaryPatch = { judgmentLocked: true, lockReason: 'EXECUTION_IN_PROGRESS', allowedActions: [], reviewStage: 'VALIDATING', application: null, completion: null } as unknown as Partial<Summary>;
    state.findings = [];
    state.results = clone(resultsFixture.notStarted) as Record<string, unknown>;
  };

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (method !== 'GET') {
      let body: unknown = null;
      try { body = request.postDataJSON(); } catch { body = '(multipart)'; }
      state.requests.push({ method, path, body });
    }
    if (path.endsWith('/auth/me')) return success(route, { id: 1, email: 'report@example.com', displayName: '리포트 테스트', role: 'AUTHOR', status: 'ACTIVE', phoneVerified: false });
    if (path === `/api/v1/works/${WORK_ID}`) return success(route, { id: WORK_ID, title: '돌아온 검', genre: '판타지', lifecycleStatus: 'ACTIVE', latestEpisodeNo: 101 });
    if (path === '/api/v1/works') return success(route, [{ id: WORK_ID, title: '돌아온 검', genre: '판타지', episodeCount: 101, lifecycleStatus: 'ACTIVE' }]);
    if (path === `/api/v1/works/${WORK_ID}/episodes`) {
      const detail = episodeDetail(state.episodeRevision);
      return success(route, [{ id: EPISODE_ID, episodeNo: 101, title: '성문 앞에서', charCount: 5200, status: 'UPLOADED', batchId: state.staging.batchId,
        originalFilename: detail.originalFilename, contentUpdatedAt: detail.contentUpdatedAt,
        analysisStatus: state.staging.status === 'INVALIDATED' ? 'ERROR_REVIEW_INVALIDATED' : 'ERROR_REVIEW_PENDING',
        validationReportId: state.staging.reportId, validationReviewStage: state.staging.reviewStage }]);
    }
    if (path === `/api/v1/works/${WORK_ID}/episodes/${EPISODE_ID}`) {
      if (state.episodeDetailHold) { const hold = state.episodeDetailHold; state.episodeDetailHold = null; await hold; }
      return success(route, episodeDetail(state.episodeRevision));
    }
    if (path === `/api/v1/works/${WORK_ID}/episodes/${EPISODE_ID}/file` && method === 'PUT') {
      if (state.replaceFailure) {
        const { status, code, message } = state.replaceFailure;
        state.replaceFailure = null;
        return failure(route, status, code, message);
      }
      state.episodeRevision += 1;
      invalidate();
      return success(route, { id: EPISODE_ID, episodeNo: 101, title: '성문 앞에서', analysisStatus: 'ERROR_REVIEW_INVALIDATED', validationReportId: state.staging.reportId });
    }
    if (path === `/api/v1/works/${WORK_ID}/analysis-jobs/batches`) return success(route, { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0, hasNext: false });
    // 설정 관리(A5·A10). 일반 저장은 Backend처럼 version을 올리고 현재 report를 무효로 만든다.
    if (path === `/api/v1/works/${WORK_ID}/characters`) {
      const content = state.characters.map(({ id, name, roleLabel }) => ({ id, name, roleLabel }));
      return success(route, { content, page: 0, size: 24, totalElements: content.length, totalPages: 1, hasNext: false });
    }
    const characterMatch = new RegExp(`^/api/v1/works/${WORK_ID}/characters/([0-9a-f-]{36})$`).exec(path);
    if (characterMatch) {
      const character = state.characters.find(item => item.id === characterMatch[1]);
      if (!character) return failure(route, 404, 'CHARACTER_NOT_FOUND', '캐릭터를 찾을 수 없습니다.');
      if (method === 'PATCH') {
        const body = request.postDataJSON() as { items: Array<{ key: string; value: string | null }> };
        for (const item of body.items ?? []) {
          const target = character.items.find(existing => existing.key === item.key);
          if (target) target.value = item.value ?? '';
        }
        invalidate();
      }
      return success(route, character);
    }
    if (path === `/api/v1/works/${WORK_ID}/world-settings`) {
      const content = state.worldSettings.map(({ id, category, subjectName, version, properties }) => ({ id, category, subjectName, version, propertyCount: properties.length }));
      return success(route, { totalWorldSettingCount: content.length, worldSettings: { content, page: 0, size: 24, totalElements: content.length, totalPages: 1, hasNext: false } });
    }
    const worldMatch = new RegExp(`^/api/v1/works/${WORK_ID}/world-settings/([0-9a-f-]{36})(/properties)?$`).exec(path);
    if (worldMatch) {
      const world = state.worldSettings.find(item => item.id === worldMatch[1]);
      if (!world) return failure(route, 404, 'WORLD_SETTING_NOT_FOUND', '대상을 찾을 수 없습니다.');
      if (worldMatch[2] && method === 'PATCH') {
        const body = request.postDataJSON() as { currentScopeName?: string | null; currentSettingName: string; settingValue: string };
        const property = world.properties.find(item => (item.scopeName ?? null) === (body.currentScopeName ?? null) && item.settingName === body.currentSettingName);
        if (property) property.value = body.settingValue;
        world.version += 1;
        invalidate();
      }
      return success(route, world);
    }
    const base = `/api/v1/works/${WORK_ID}/episode-validations`;
    if (path === `${base}/current`) {
      if (state.currentHold) { const hold = state.currentHold; state.currentHold = null; await hold; }
      if (scenario.currentReportMissing) return failure(route, 404, 'VALIDATION_NOT_FOUND', '검수 결과를 찾을 수 없습니다.');
      return success(route, state.staging);
    }
    if (path === `${base}/eligibility`) {
      return success(route, url.searchParams.get('episodeId') ? state.eligibility : { ...clone(review.responses.eligibilityWorkOnlyBlocked) });
    }
    if (path === `${base}/history`) {
      return success(route, { ...clone(review.responses.historyPage), content: state.history, totalElements: state.history.length });
    }
    const match = new RegExp(`^${base}/([0-9a-f-]{36})(/.*)?$`).exec(path);
    if (!match) return success(route, []);
    const [, reportId, rest = ''] = match;
    if (reportId === PAST_REPORT_ID && rest === '') {
      return success(route, { ...state.staging, reportId: PAST_REPORT_ID, baselineId: PAST_REPORT_ID, current: false, revision: 1, status: 'INVALIDATED', baselineStatus: 'INVALIDATED', executionStatus: 'CANCELED', reviewStage: 'INVALIDATED', previousReportId: null });
    }
    const past = state.pastReports.get(reportId);
    if (past && rest === '') return success(route, past);
    if (past && rest === '/review') return success(route, { ...summary(), reportId, reportVersion: past.reportVersion, reviewStage: 'INVALIDATED', allowedActions: [] });
    if (reportId !== state.staging.reportId) return failure(route, 404, 'VALIDATION_NOT_FOUND', '검수 결과를 찾을 수 없습니다.');
    if (rest === '') return success(route, state.staging);
    if (rest === '/review') return success(route, summary());
    if (rest === '/results') return success(route, { ...state.results, reportVersion: state.staging.reportVersion });
    if (rest === '/findings') {
      state.findingQueries.push(url.search);
      const branch = url.searchParams.get('branch');
      const judgment = url.searchParams.get('judgment');
      const outcome = url.searchParams.get('outcome');
      const impact = url.searchParams.get('impact');
      const subjectType = url.searchParams.get('subjectType');
      const pageNo = Number(url.searchParams.get('page') ?? 0);
      const size = Number(url.searchParams.get('size') ?? 20);
      // 목록은 Backend처럼 현재 revision 항목만 돌려준다. 등급·대상 필터는 오탈자와 대상 없는 항목을 뺀다(#314 B2).
      const filtered = state.findings.filter(item => !item.stale && (!branch || item.branch === branch)
        && (!judgment || item.judgment.value === judgment) && (!outcome || item.outcome === outcome)
        && (!impact || (item.branch === 'SETTING' && (item.payload as Record<string, unknown>).impact === impact))
        && (!subjectType || (item.branch === 'SETTING' && item.subject?.type === subjectType)));
      const content = filtered.slice(pageNo * size, pageNo * size + size).map(summaryOf);
      return success(route, { content, page: pageNo, size, totalElements: filtered.length, totalPages: Math.ceil(filtered.length / size), hasNext: (pageNo + 1) * size < filtered.length });
    }
    // 문맥 블록 더 보기: Backend처럼 그 항목 블록이 인용한 출처만, 줄 수·anchor 상한 안에서 합성 원고를 자른다.
    const contextMatch = /^\/findings\/([0-9a-f-]{36})\/source-context$/.exec(rest);
    if (contextMatch) {
      const finding = state.findings.find(item => item.findingId === contextMatch[1]);
      if (!finding) return failure(route, 404, 'VALIDATION_FINDING_NOT_FOUND', '발견 항목을 찾을 수 없습니다.');
      state.contextRequests.push(url.search);
      if (state.contextFailure) {
        const { status, code, message, context } = state.contextFailure;
        state.contextFailure = null;
        return failure(route, status, code, message, context);
      }
      const ref = url.searchParams.get('sourceRef') ?? '';
      const number = (key: string) => Number(url.searchParams.get(key) ?? 0);
      const [anchorStart, anchorEnd, before, after] = [number('anchorStart'), number('anchorEnd'), number('before'), number('after')];
      const cited = ((finding.blocks ?? []) as Array<{ sourceRef?: string | null }>).some(block => block.sourceRef === ref);
      const text = SYNTHETIC_SOURCES[ref];
      if (!cited || !text || anchorStart < 0 || anchorEnd < anchorStart || anchorEnd - anchorStart > 1000 || anchorEnd > cp(text)
        || before < 0 || after < 0 || before > 30 || after > 30) return failure(route, 400, 'REQUEST_VALIDATION_FAILED', '요청 값이 올바르지 않습니다.');
      return success(route, sourceWindow(ref, anchorStart, anchorEnd, before, after));
    }
    const findingMatch = /^\/findings\/([0-9a-f-]{36})(\/judgment)?$/.exec(rest);
    if (findingMatch) {
      const finding = state.findings.find(item => item.findingId === findingMatch[1]);
      if (!finding) return failure(route, 404, 'VALIDATION_FINDING_NOT_FOUND', '발견 항목을 찾을 수 없습니다.');
      if (!findingMatch[2]) { state.detailGets += 1; return success(route, finding); }
      const body = request.postDataJSON() as { judgment: Judgment; expectedJudgmentVersion?: number };
      if (state.judgmentFailure) {
        const { code, message, external } = state.judgmentFailure;
        state.judgmentFailure = null;
        if (external) {
          const target = state.findings.find(item => item.findingId === external.findingId)!;
          target.judgment = { value: external.judgment, version: target.judgment.version + 1, decidedAt: '2026-10-30T11:20:00' };
          bump();
        }
        return failure(route, 409, code, message);
      }
      if ((body.expectedJudgmentVersion ?? 0) !== finding.judgment.version) return failure(route, 409, 'VALIDATION_JUDGMENT_VERSION_CONFLICT', '판단이 바뀌었습니다.');
      if (body.judgment !== finding.judgment.value) {
        finding.judgmentHistory = [...finding.judgmentHistory, { findingId: finding.findingId, checkRevision: finding.checkRevision, fromJudgment: finding.judgment.value, toJudgment: body.judgment, reason: 'AUTHOR', changeReason: null as unknown as string, createdAt: '2026-10-30T11:10:00' }];
        finding.judgment = { value: body.judgment, version: finding.judgment.version + 1, decidedAt: '2026-10-30T11:10:00' };
        bump();
      }
      return success(route, summaryOf(finding));
    }
    if (rest === '/review-completion') {
      state.staging.reviewStage = 'REVIEW_COMPLETED';
      state.summaryPatch = { ...state.summaryPatch, completionMode: 'COMPLETED', canCompleteReview: false, judgmentLocked: true, lockReason: 'REVIEW_COMPLETED', allowedActions: ['APPLY_SETTINGS'], extractionState: 'RUNNING', completion: review.responses.reviewSummary.completion };
      bump();
      return success(route, { ...clone(review.responses.reviewCompletion), reportId: state.staging.reportId });
    }
    if (rest === '/settings-application') {
      state.staging.reviewStage = 'APPLIED';
      state.summaryPatch = { ...state.summaryPatch, allowedActions: [], application: { ...clone(review.responses.reviewSummary.application), status: 'APPLIED', holdReasons: [], appliedAt: '2026-10-30T11:30:00' } as Summary['application'], reviewStage: 'APPLIED' };
      bump();
      return success(route, { ...clone(review.responses.settingsApplication), status: 'APPLIED', holdReasons: [], appliedAt: '2026-10-30T11:30:00', lastErrorCode: null });
    }
    if (rest === '/corrections') {
      // Backend ValidationCorrectionServiceImpl: 같은 키는 원래 receipt, 그 밖에는 설정 편집과 receipt를 함께 저장한다.
      const body = request.postDataJSON() as { idempotencyKey: string; expectedReportVersion: number; character?: { targetId: string; edit: CharacterEdit }; worldSetting?: { targetId: string; edit: { currentScopeName?: string | null; currentSettingName: string; settingValue: string } } };
      if (state.correctionHold) { const hold = state.correctionHold; state.correctionHold = null; await hold; }
      const existing = state.corrections.get(body.idempotencyKey);
      const receipt = (correctionId: string, reportVersion: number) => ({ correctionId, reportId: state.staging.reportId, reportVersion,
        baselineId: state.staging.baselineId, baselineRevision: state.staging.baselineRevision, baselineHash: 'a'.repeat(64), entryRef: 'B1', entityVersion: 4 });
      if (existing) return success(route, receipt(existing.correctionId, existing.reportVersion));
      if (state.correctionFailure) {
        const { status, code, message } = state.correctionFailure;
        state.correctionFailure = null;
        return failure(route, status, code, message);
      }
      if (body.expectedReportVersion !== state.staging.reportVersion) return failure(route, 409, 'VALIDATION_REPORT_VERSION_CONFLICT', '검수 상태가 바뀌었습니다.');
      if (body.character) {
        applyCharacterEdit(state.characters.find(item => item.id === body.character!.targetId)!, body.character.edit);
      }
      if (body.worldSetting) {
        const world = state.worldSettings.find(item => item.id === body.worldSetting!.targetId)!;
        const edit = body.worldSetting.edit;
        const property = world.properties.find(item => (item.scopeName ?? null) === (edit.currentScopeName ?? null) && item.settingName === edit.currentSettingName);
        if (property) property.value = edit.settingValue;
        world.version += 1;
      }
      // 실제 편집이 기준을 무효로 만들고 receipt는 그 뒤의 report version을 기록한다.
      invalidate();
      state.corrections.set(body.idempotencyKey, { correctionId: CORRECTION_RECEIPT_ID, body: JSON.stringify(body), reportVersion: state.staging.reportVersion });
      if (state.correctionResponseLost) { state.correctionResponseLost = false; return route.abort('failed'); }
      return success(route, receipt(CORRECTION_RECEIPT_ID, state.staging.reportVersion));
    }
    if (rest === '/rechecks') {
      if (state.recheckFailure) {
        const { status, code, message, context } = state.recheckFailure;
        state.recheckFailure = null;
        return failure(route, status, code, message, context);
      }
      const recheckBody = request.postDataJSON() as { correctionReceiptId?: string };
      if (recheckBody.correctionReceiptId && ![...state.corrections.values()].some(item => item.correctionId === recheckBody.correctionReceiptId
        && item.reportVersion === state.staging.reportVersion)) {
        return failure(route, 409, 'VALIDATION_CORRECTION_CONFLICT', '정정 기록을 확인할 수 없습니다.');
      }
      if (state.recheckHold) { const hold = state.recheckHold; state.recheckHold = null; await hold; }
      recheck();
      if (state.recheckResponseLost) { state.recheckResponseLost = false; return route.abort('failed'); }
      return success(route, state.staging);
    }
    if (rest === '/retries') {
      state.staging.executionStatus = 'QUEUED';
      state.staging.reviewStage = 'VALIDATING';
      state.summaryPatch = { ...state.summaryPatch, executionStatus: 'QUEUED', judgmentLocked: true, lockReason: 'EXECUTION_IN_PROGRESS', allowedActions: [], reviewStage: 'VALIDATING' };
      bump();
      return success(route, state.staging);
    }
    return success(route, []);
  });

  return {
    state,
    summary,
    url: (query = '') => `/episode-validation-report?workId=${WORK_ID}&reportId=${state.staging.reportId}${query}`,
    patchStaging: (values: Partial<Staging>) => { Object.assign(state.staging, values); },
    patchSummary: (values: Partial<Summary>) => { state.summaryPatch = { ...state.summaryPatch, ...values }; },
    failNextJudgment: (failure: NonNullable<typeof state.judgmentFailure>) => { state.judgmentFailure = failure; },
    failNextReplace: (failure: Failure) => { state.replaceFailure = failure; },
    failNextRecheck: (failure: Failure) => { state.recheckFailure = failure; },
    failNextCorrection: (failure: Failure) => { state.correctionFailure = failure; },
    failNextContext: (failure: Failure) => { state.contextFailure = failure; },
    loseNextCorrectionResponse: () => { state.correctionResponseLost = true; },
    loseNextRecheckResponse: () => { state.recheckResponseLost = true; },
    holdNextCorrection: () => { let release!: () => void; state.correctionHold = new Promise<void>(resolve => { release = resolve; }); return () => release(); },
    holdNextRecheck: () => { let release!: () => void; state.recheckHold = new Promise<void>(resolve => { release = resolve; }); return () => release(); },
    holdNextEpisodeDetail: () => { let release!: () => void; state.episodeDetailHold = new Promise<void>(resolve => { release = resolve; }); return () => release(); },
    holdNextCurrent: () => { let release!: () => void; state.currentHold = new Promise<void>(resolve => { release = resolve; }); return () => release(); },
    requestsTo: (suffix: string, method = 'POST') => state.requests.filter(item => item.method === method && item.path.endsWith(suffix)),
    episodeDetail: () => episodeDetail(state.episodeRevision),
    judgmentPatches: () => state.requests.filter(request => request.method === 'PATCH'),
  };
}

export async function authenticate(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('accessToken', 'validation-report-test'));
}

export function findingId(index: number) {
  return findingIds[index];
}
