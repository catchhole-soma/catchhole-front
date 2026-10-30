import assert from 'node:assert/strict';
import test from 'node:test';
import { readSettingEvidence } from '../src/app/lib/setting-evidence.ts';

const content = '😀 갈색 눈';
const valid = { quote: '갈색 눈', startOffset: 2, endOffset: 6 };

test('정상 인용은 코드 포인트 위치를 유지하고 다른 불량 인용만 제거한다', () => {
  assert.deepEqual(readSettingEvidence([
    valid,
    { quote: '없는 문장', startOffset: 0, endOffset: 5 },
    { quote: '갈색 눈' },
    { quote: '갈색 눈', startOffset: -1, endOffset: 3 },
    { quote: '갈색 눈', startOffset: 2.5, endOffset: 6.5 },
    { quote: '갈색 눈', startOffset: 2, endOffset: 20 },
    { quote: '갈색 눈', startOffset: '2', endOffset: '6' },
  ], content), [valid]);
});

test('길이가 맞아도 실제 원문 구간과 다르면 인용을 숨긴다', () => {
  assert.deepEqual(readSettingEvidence([{ ...valid, quote: '파란 눈' }], content), []);
  assert.deepEqual(readSettingEvidence([valid], '😀 파란 눈'), []);
});

test('원문을 읽지 못했거나 위치가 없는 인용을 문자열 검색으로 복구하지 않는다', () => {
  assert.deepEqual(readSettingEvidence([valid], null), []);
  assert.deepEqual(readSettingEvidence([{ quote: valid.quote }], content), []);
  assert.deepEqual(readSettingEvidence(null, content), []);
});

test('인용 양끝 공백도 원문 그대로 보존한다', () => {
  const span = { quote: ' 갈색 ', startOffset: 1, endOffset: 5 };
  assert.deepEqual(readSettingEvidence([span], content), [span]);
});
