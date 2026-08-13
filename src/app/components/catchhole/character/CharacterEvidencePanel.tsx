import { useEffect, useMemo, useRef } from 'react';
import { AlertCircle, FileText, Loader2, RefreshCw, X } from 'lucide-react';
import type {
  CharacterFactEvidenceResponse,
  CharacterFactEvidenceSpanResponse,
} from '../../../api/generated/types.gen';
import { C } from '../constants';

interface Props {
  evidence: CharacterFactEvidenceResponse | null;
  loading: boolean;
  error: string | null;
  sources?: CharacterEvidenceSourceTab[];
  activeSourceFactId?: string | null;
  synthesized?: boolean;
  context?: {
    factTypeLabel: string;
    displayName: string;
    factValue: string | null;
  };
  onSourceSelect?: (characterFactId: string) => void;
  onRetry: () => void;
  onClose: () => void;
}

export interface CharacterEvidenceSourceTab {
  characterFactId: string;
  sourceEpisodeNo?: number | null;
  hasEvidence: boolean;
}

interface HighlightRange {
  start: number;
  end: number;
}

function evidenceSourceLabel(
  sources: CharacterEvidenceSourceTab[],
  sourceIndex: number,
): string {
  const source = sources[sourceIndex];
  const hasSameEpisode = (candidate: CharacterEvidenceSourceTab) => (
    source.sourceEpisodeNo == null
      ? candidate.sourceEpisodeNo == null
      : candidate.sourceEpisodeNo === source.sourceEpisodeNo
  );
  const matchingSources = sources.filter(hasSameEpisode);
  const matchingSourceIndex = sources
    .slice(0, sourceIndex + 1)
    .filter(hasSameEpisode)
    .length;

  if (source.sourceEpisodeNo == null) {
    return `회차 없는 근거 ${matchingSourceIndex}`;
  }
  return matchingSources.length > 1
    ? `${source.sourceEpisodeNo}화 · 근거 ${matchingSourceIndex}`
    : `${source.sourceEpisodeNo}화`;
}

function validHighlightRanges(
  content: string,
  spans: CharacterFactEvidenceSpanResponse[],
): HighlightRange[] {
  const codePointToCodeUnit = [0];
  for (const character of content) {
    codePointToCodeUnit.push(
      codePointToCodeUnit[codePointToCodeUnit.length - 1] + character.length,
    );
  }

  const ranges = spans
    .flatMap(span => {
      const start = span.startOffset;
      const end = span.endOffset;
      if (
        start == null
        || end == null
        || !Number.isInteger(start)
        || !Number.isInteger(end)
        || start < 0
        || end <= start
        || end >= codePointToCodeUnit.length
      ) {
        return [];
      }
      const startCodeUnit = codePointToCodeUnit[start];
      const endCodeUnit = codePointToCodeUnit[end];
      if (content.slice(startCodeUnit, endCodeUnit) !== span.quote) {
        return [];
      }
      return [{ start: startCodeUnit, end: endCodeUnit }];
    })
    .sort((left, right) => left.start - right.start || left.end - right.end);

  return ranges.reduce<HighlightRange[]>((merged, range) => {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
      return merged;
    }
    merged.push({ ...range });
    return merged;
  }, []);
}

function HighlightedSource({
  content,
  ranges,
}: {
  content: string;
  ranges: HighlightRange[];
}) {
  const firstHighlightRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const firstHighlight = firstHighlightRef.current;
    const scrollContainer = firstHighlight?.closest<HTMLElement>('.character-evidence-panel__body');
    if (!firstHighlight || !scrollContainer) return;

    // 바깥 모달까지 scrollIntoView 하지 않고 원문 패널 내부에서만 첫 근거를 중앙으로 옮긴다.
    const containerRect = scrollContainer.getBoundingClientRect();
    const highlightRect = firstHighlight.getBoundingClientRect();
    const targetTop = scrollContainer.scrollTop
      + highlightRect.top
      - containerRect.top
      - (scrollContainer.clientHeight - highlightRect.height) / 2;
    scrollContainer.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  }, [content, ranges]);

  const segments = useMemo(() => {
    const result: Array<{ text: string; highlighted: boolean; start: number }> = [];
    let cursor = 0;
    ranges.forEach(range => {
      if (cursor < range.start) {
        result.push({ text: content.slice(cursor, range.start), highlighted: false, start: cursor });
      }
      result.push({
        text: content.slice(range.start, range.end),
        highlighted: true,
        start: range.start,
      });
      cursor = range.end;
    });
    if (cursor < content.length) {
      result.push({ text: content.slice(cursor), highlighted: false, start: cursor });
    }
    return result;
  }, [content, ranges]);

  return (
    <div
      data-testid="character-evidence-source"
      style={{
        padding: 20,
        borderRadius: 8,
        border: `1px solid ${C.border}`,
        background: C.bg,
        color: C.t2,
        fontSize: 13,
        lineHeight: 1.85,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
      }}
    >
      {segments.map((segment, index) => (
        segment.highlighted
          ? (
              <mark
                // 원문 offset이 key이므로 같은 텍스트가 여러 번 등장해도 안정적으로 구분된다.
                key={`highlight-${segment.start}`}
                ref={index === segments.findIndex(value => value.highlighted)
                  ? firstHighlightRef
                  : undefined}
                data-testid="character-evidence-highlight"
                style={{
                  padding: '2px 1px',
                  borderRadius: 3,
                  background: C.primary + '52',
                  color: C.t1,
                }}
              >
                {segment.text}
              </mark>
            )
          : <span key={`source-${segment.start}`}>{segment.text}</span>
      ))}
    </div>
  );
}

function QuoteFallback({
  spans,
}: {
  spans: CharacterFactEvidenceSpanResponse[];
}) {
  if (spans.length === 0) {
    return (
      <div style={{ color: C.t3, fontSize: 13, textAlign: 'center', padding: '42px 16px' }}>
        저장된 원문 근거가 없습니다.
      </div>
    );
  }

  return (
    <div>
      <div style={{ color: C.warning, fontSize: 12, marginBottom: 12 }}>
        원문에서 위치를 확인할 수 없어 저장된 인용문만 표시합니다.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {spans.map((span, index) => (
          <blockquote
            key={`${span.quote}-${index}`}
            style={{
              margin: 0,
              padding: '14px 16px',
              borderRadius: 7,
              borderLeft: `3px solid ${C.primary}`,
              background: C.bg,
              color: C.t2,
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            “{span.quote}”
          </blockquote>
        ))}
      </div>
    </div>
  );
}

export function CharacterEvidencePanel({
  evidence,
  loading,
  error,
  sources = [],
  activeSourceFactId,
  synthesized = false,
  context,
  onSourceSelect,
  onRetry,
  onClose,
}: Props) {
  const content = evidence?.content ?? null;
  const spans = useMemo(
    () => evidence?.evidenceSpans ?? [],
    [evidence?.evidenceSpans],
  );
  const validRanges = useMemo(
    () => content == null ? [] : validHighlightRanges(content, spans),
    [content, spans],
  );
  const canHighlight = content != null && validRanges.length > 0;
  const sourceUnavailable = evidence != null && content == null && spans.length > 0;

  return (
    <section className="character-evidence-panel" aria-label="캐릭터 설정 원문 근거">
      <header style={{
        minHeight: 87,
        padding: '20px 22px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: C.primary + '18',
          color: C.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <FileText size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: C.t1, fontSize: 15, fontWeight: 700 }}>원문 근거</div>
          <div style={{ color: C.t3, fontSize: 11, marginTop: 3 }}>
            {evidence?.episode
              ? `${evidence.episode.episodeNo}화${evidence.episode.title ? ` · ${evidence.episode.title}` : ''}`
              : '출처 회차 없음'}
          </div>
        </div>
        <button
          type="button"
          aria-label="원문 근거 닫기"
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', padding: 5, lineHeight: 0 }}
        >
          <X size={18} />
        </button>
      </header>

      {sources.length > 1 && (
        <div className="character-evidence-panel__provenance">
          {synthesized && (
            <div className="character-evidence-panel__synthesized">
              여러 근거를 종합해 만든 현재값입니다.
            </div>
          )}
          <div
            role="group"
            aria-label="현재값을 구성한 원문 근거"
            className="character-evidence-panel__source-tabs"
          >
            {sources.map((source, index) => {
              const selected = source.characterFactId === activeSourceFactId;
              const label = evidenceSourceLabel(sources, index);
              return (
                <button
                  key={source.characterFactId}
                  type="button"
                  aria-pressed={selected}
                  disabled={!source.hasEvidence || !onSourceSelect}
                  title={source.hasEvidence ? `${label} 원문 근거 보기` : `${label}에는 저장된 원문이 없습니다.`}
                  onClick={() => onSourceSelect?.(source.characterFactId)}
                  className={`character-evidence-panel__source-tab${selected ? ' is-selected' : ''}`}
                >
                  {label}
                  {!source.hasEvidence && <span>원문 없음</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {context && (
        <div className="character-evidence-panel__context" style={{ padding: '13px 22px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ color: C.primary, fontSize: 10, fontWeight: 700 }}>{context.factTypeLabel}</div>
          <div style={{ color: C.t1, fontSize: 13, fontWeight: 700, marginTop: 4 }}>{context.displayName}</div>
          <div style={{ color: C.t2, fontSize: 12, lineHeight: 1.6, marginTop: 3 }}>{context.factValue || '—'}</div>
        </div>
      )}

      <div className="character-evidence-panel__body">
        {loading && (
          <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.t3, fontSize: 13 }}>
            <Loader2 size={18} className="spin" /> 원문 근거를 불러오는 중입니다.
          </div>
        )}

        {!loading && error && (
          <div role="alert" style={{ minHeight: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: C.t3, fontSize: 13 }}>
            <AlertCircle size={24} color={C.danger} />
            <span>{error}</span>
            <button type="button" onClick={onRetry} style={retryButtonStyle}>
              <RefreshCw size={13} /> 다시 시도
            </button>
          </div>
        )}

        {!loading && !error && evidence && (
          <>
            {canHighlight
              ? <HighlightedSource content={content} ranges={validRanges} />
              : <QuoteFallback spans={spans} />}
            {sourceUnavailable && (
              <button type="button" onClick={onRetry} style={{ ...retryButtonStyle, marginTop: 14 }}>
                <RefreshCw size={13} /> 전체 원문 다시 불러오기
              </button>
            )}
          </>
        )}

        {!loading && !error && !evidence && (
          <div style={{ color: C.t3, fontSize: 13, textAlign: 'center', padding: '42px 16px' }}>
            원문 근거를 찾을 수 없습니다.
          </div>
        )}
      </div>
    </section>
  );
}

const retryButtonStyle = {
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: 'transparent',
  color: C.t2,
  fontSize: 12,
  fontFamily: 'inherit',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
} as const;
