import { Fragment, type ReactNode } from 'react';

// These are the citation forms appended by the server's plain-text renderers.
// Ordinary numbers and mentions of “근거” in prose are not citation markers.
const citationPattern = /[ \t]+(?:·[ \t]+)?근거[ \t]+([1-9]\d*(?:,[ \t]*[1-9]\d*)*)[ \t]*$|[ \t]+\(근거[ \t]+([1-9]\d*(?:,[ \t]*[1-9]\d*)*)\)[ \t]*$|(?<=[.!?…])[ \t]+\(근거[ \t]+([1-9]\d*(?:,[ \t]*[1-9]\d*)*)\)(?=[ \t])/g;
const quotedTextPattern = /“[^”]*”|‘[^’]*’|「[^」]*」|『[^』]*』|"(?:\\.|[^"\\])*"|(?<![\p{L}\p{N}])'(?:\\.|[^'\\])*'|`[^`]*`/gu;

export function ChatAnswerText({
  text,
  sourceCount,
  onSourceClick,
}: {
  text: string;
  sourceCount: number;
  onSourceClick: (sourceNumber: number, trigger: HTMLButtonElement) => void;
}) {
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
