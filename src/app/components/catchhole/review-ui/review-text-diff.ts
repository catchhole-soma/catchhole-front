export type ReviewTextPart = { text: string; changed: boolean };

/** Presentation only. Keep source strings intact; never use the diff to build a saved value. */
export function reviewTextDiff(before: string, after: string): { before: ReviewTextPart[]; after: ReviewTextPart[] } {
  if (before === after) return { before: [{ text: before, changed: false }], after: [{ text: after, changed: false }] };
  const tokenize = (value: string) => value.match(/[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]/gu) ?? [];
  const left = tokenize(before), right = tokenize(after);
  // Bound rendering work for long manuscript values. Highlight the changed interval instead.
  if (left.length * right.length > 160_000) {
    const a = Array.from(before), b = Array.from(after);
    let start = 0, end = 0;
    while (start < Math.min(a.length, b.length) && a[start] === b[start]) start++;
    while (end < Math.min(a.length, b.length) - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
    const parts = (chars: string[]) => [
      { text: chars.slice(0, start).join(''), changed: false },
      { text: chars.slice(start, chars.length - end).join(''), changed: true },
      { text: end ? chars.slice(-end).join('') : '', changed: false },
    ].filter(part => part.text);
    return { before: parts(a), after: parts(b) };
  }
  const table = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i--) for (let j = right.length - 1; j >= 0; j--) {
    table[i][j] = left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const result: { before: ReviewTextPart[]; after: ReviewTextPart[] } = { before: [], after: [] };
  const append = (parts: ReviewTextPart[], text: string, changed: boolean) => {
    const last = parts[parts.length - 1];
    if (last?.changed === changed) last.text += text;
    else parts.push({ text, changed });
  };
  let i = 0, j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      append(result.before, left[i++], false); append(result.after, right[j++], false);
    } else if (j < right.length && (i === left.length || table[i][j + 1] > table[i + 1][j])) {
      append(result.after, right[j++], true);
    } else append(result.before, left[i++], true);
  }
  return result;
}
