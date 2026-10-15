import { Fragment, type ReactNode } from 'react';

// These are the citation forms appended by the server's plain-text renderers.
// Ordinary numbers and mentions of “근거” in prose are not citation markers.
const citationPattern = /[ \t]+(?:·[ \t]+)?근거[ \t]+([1-9]\d*(?:,[ \t]*[1-9]\d*)*)[ \t]*$|[ \t]+\(근거[ \t]+([1-9]\d*(?:,[ \t]*[1-9]\d*)*)\)[ \t]*$|(?<=[.!?…])[ \t]+\(근거[ \t]+([1-9]\d*(?:,[ \t]*[1-9]\d*)*)\)(?=[ \t])/g;
const quotedTextPattern = /“[^”]*”|‘[^’]*’|「[^」]*」|『[^』]*』|"(?:\\.|[^"\\])*"|(?<![\p{L}\p{N}])'(?:\\.|[^'\\])*'|`[^`]*`/gu;

function withoutLegacyEmptySettingCount(text: string) {
  const lines = text.split('\n');
  // Compatibility for stored, rule-rendered positive collections only. Do not
  // rewrite arbitrary prose, quotations, or an inconclusive negative answer.
  if (!/^(?:현재 등록된 인물|등록된 관련 설정 항목|조회한 변경 이력|세계관에 등록된 (?:설정 주체|[^\n]+ 설정)|세계관의 선택한 분류에 등록된 설정 주체) \d+(?:명|개|건) 중 질문한 조건에 맞는 것으로 확인한 (?:인물|항목|이력)은 [1-9]\d*(?:명|개|건)(?:이에요|예요)\.$/.test(lines[0]))
    return text;
  const quotedRanges = Array.from(text.matchAll(quotedTextPattern), (match) => [match.index, match.index + match[0].length]);
  let offset = 0;
  return lines.flatMap((line) => {
    const start = offset;
    offset += line.length + 1;
    if (quotedRanges.some(([from, to]) => start < to && start + line.length > from)) return [line];
    const match = /^(확인한 결과에는 포함하지 않았어요: |다음 대상은 확인한 수에서 제외했어요: )관련 설정이 없는 \d+(?:명|개|건)((?:, (?:조건 충족 여부가 불확실한|아직 검토하지 못한|판단을 보류한) \d+(?:명|개|건))*)(\.?)$/.exec(line);
    if (!match) return [line];
    return match[2] ? [match[1] + match[2].slice(2) + match[3]] : [];
  }).join('\n');
}

export function ChatAnswerText({
  text,
  sourceCount,
  onSourceClick,
}: {
  text: string;
  sourceCount: number;
  onSourceClick: (sourceNumber: number, trigger: HTMLButtonElement) => void;
}) {
  text = withoutLegacyEmptySettingCount(text);
  const quotedRanges = Array.from(text.matchAll(quotedTextPattern), (match) => [
    match.index,
    match.index + match[0].length,
  ]);
  let lineOffset = 0;
  return (
    <p>
      {text.split('\n').map((line, lineIndex) => {
        const offset = lineOffset;
        lineOffset += line.length + 1;
        const parts: ReactNode[] = [];
        let cursor = 0;
        for (const match of line.matchAll(citationPattern)) {
          if (
            quotedRanges.some(
              ([start, end]) =>
                offset + match.index < end &&
                offset + match.index + match[0].length > start,
            )
          )
            continue;
          const numbers = (match[1] ?? match[2] ?? match[3]).split(',').map(Number);
          // Preserve the entire marker if it references missing/unknown numbers.
          if (numbers.some((n) => !Number.isSafeInteger(n) || n > sourceCount))
            continue;
          parts.push(line.slice(cursor, match.index));
          parts.push(
            <Fragment key={match.index}>
              {' '}
              <span className="chat-citations">
                {numbers.map((number, index) => (
                  <button
                    key={`${number}:${index}`}
                    type="button"
                    className="chat-citation"
                    aria-label={`근거 ${number} 보기`}
                    aria-haspopup="dialog"
                    onClick={(event) => onSourceClick(number, event.currentTarget)}
                  >
                    [{number}]
                  </button>
                ))}
              </span>
            </Fragment>,
          );
          cursor = match.index + match[0].length;
        }
        parts.push(line.slice(cursor));
        return (
          <Fragment key={lineIndex}>
            {lineIndex > 0 && '\n'}
            {parts}
          </Fragment>
        );
      })}
    </p>
  );
}
