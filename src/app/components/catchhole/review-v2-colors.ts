import { C } from './constants';

/**
 * Theme V2 review surfaces are light, while the legacy CatchHole palette is dark-theme first.
 * Keep legacy tones for borders and tints, but use semantic ink tokens for readable text.
 */
export const REVIEW_TEXT = {
  ink: 'var(--ch-ink, #191e26)',
  text: 'var(--ch-text, #333a46)',
  muted: 'var(--ch-text-muted, #657083)',
  primary: 'var(--ch-primary-ink, #005aaf)',
  success: 'var(--ch-success-ink, #066947)',
  warning: 'var(--ch-warning-ink, #8a4b00)',
  danger: 'var(--ch-danger-ink, #a1263a)',
} as const;

export function reviewToneInk(tone: string): string {
  switch (tone) {
    case C.t1:
      return REVIEW_TEXT.ink;
    case C.t2:
      return REVIEW_TEXT.text;
    case C.t3:
      return REVIEW_TEXT.muted;
    case C.primary:
      return REVIEW_TEXT.primary;
    case C.success:
      return REVIEW_TEXT.success;
    case C.warning:
      return REVIEW_TEXT.warning;
    case C.danger:
      return REVIEW_TEXT.danger;
    default:
      return REVIEW_TEXT.text;
  }
}
