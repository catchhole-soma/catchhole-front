import { expect, test } from '@playwright/test';
import { reviewTextDiff } from '../src/app/components/catchhole/review-ui/review-text-diff';

test('비교 강조는 한글·줄바꿈·기호를 포함한 양쪽 원문을 그대로 보존한다', () => {
  const before = '벽의 수정이 주변을 밝힌다.\n마력: 20 / 🔮';
  const after = '벽의 수정은 마력을 소모하며 주변을 밝힌다.\n마력: 18 / 🔮';
  const result = reviewTextDiff(before, after);
  expect(result.before.map(part => part.text).join('')).toBe(before);
  expect(result.after.map(part => part.text).join('')).toBe(after);
  expect(result.after.filter(part => part.changed).map(part => part.text).join('')).toContain('소모하며');
  expect(result.after.some(part => !part.changed && part.text.includes('주변을 밝힌다.'))).toBe(true);
});

test('동일값과 순수 추가·삭제를 실제 변경과 구분한다', () => {
  expect(reviewTextDiff('왕실 기사단', '왕실 기사단').after).toEqual([{ text: '왕실 기사단', changed: false }]);
  expect(reviewTextDiff('', '새 설정').after.every(part => part.changed)).toBe(true);
  expect(reviewTextDiff('종료된 상태', '').before.every(part => part.changed)).toBe(true);
  expect(reviewTextDiff('', '').after.map(part => part.text).join('')).toBe('');
});

test('매우 긴 값은 계산량을 제한하고 이모지와 끝부분을 보존한다', () => {
  const prefix = '같은 내용 '.repeat(1000);
  const before = `${prefix}변경 전 🐉\n보존할 끝부분`;
  const after = `${prefix}변경 후 🌊\n보존할 끝부분`;
  const result = reviewTextDiff(before, after);
  expect(result.before.map(part => part.text).join('')).toBe(before);
  expect(result.after.map(part => part.text).join('')).toBe(after);
  expect(result.after[result.after.length - 1]).toEqual({ text: '\n보존할 끝부분', changed: false });
  expect(result.after.length).toBeLessThanOrEqual(3);
});
