export interface SettingEvidenceSpan {
  quote: string;
  startOffset: number;
  endOffset: number;
}

/** Missing offsets never trigger quote search; only exact source slices are displayed. */
export function readSettingEvidence(value: unknown, content: string | null): SettingEvidenceSpan[] {
  if (content === null || !Array.isArray(value)) return [];
  const characters = Array.from(content);
  const source: unknown[] = value;
  return source.flatMap(item => {
    if (item == null || typeof item !== 'object') return [];
    const { quote, startOffset, endOffset } = item as Record<string, unknown>;
    if (typeof quote !== 'string' || !quote.trim()
      || typeof startOffset !== 'number' || typeof endOffset !== 'number'
      || !Number.isSafeInteger(startOffset) || !Number.isSafeInteger(endOffset)
      || startOffset < 0 || endOffset <= startOffset
      || endOffset - startOffset !== Array.from(quote).length) return [];
    if (endOffset > characters.length || characters.slice(startOffset, endOffset).join('') !== quote) return [];
    return [{ quote, startOffset, endOffset }];
  });
}
