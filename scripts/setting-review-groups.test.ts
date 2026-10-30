import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isUnlinkedCandidateGroup,
  nextGroupKeyAfter,
  normalizeCharacterGroupName,
} from '../src/app/lib/setting-review-groups.ts';

const groups = (...keys: string[]) => keys.map(groupKey => ({ groupKey }));

test('가운데 그룹이 사라지면 직전 목록에서 바로 뒤에 있던 그룹을 고른다', () => {
  assert.equal(nextGroupKeyAfter(groups('a', 'b', 'c'), 'b', groups('a', 'c')), 'c');
});

test('마지막 그룹이 사라지면 다음 페이지에서 당겨진 그룹을, 없으면 현재 첫 그룹을 고른다', () => {
  assert.equal(nextGroupKeyAfter(groups('a', 'b', 'c'), 'c', groups('a', 'b', 'd')), 'd');
  assert.equal(nextGroupKeyAfter(groups('a', 'b', 'c'), 'c', groups('a', 'b')), 'a');
});

test('첫 그룹이 사라지면 두 번째였던 그룹을 고른다', () => {
  assert.equal(nextGroupKeyAfter(groups('a', 'b', 'c'), 'a', groups('b', 'c')), 'b');
});

test('사라진 그룹을 직전 목록에서 찾지 못하면 현재 첫 그룹을 고르고, 남아 있어도 다시 고르지 않는다', () => {
  assert.equal(nextGroupKeyAfter(groups('a', 'b'), 'x', groups('b', 'a')), 'b');
  assert.equal(nextGroupKeyAfter(groups('a', 'b', 'c'), 'b', groups('a', 'b', 'c')), 'c');
});

test('현재 목록이 비면 null을 돌려 페이지 보정에 맡긴다', () => {
  assert.equal(nextGroupKeyAfter(groups('a'), 'a', []), null);
  assert.equal(nextGroupKeyAfter([], 'a', []), null);
  assert.equal(nextGroupKeyAfter(groups('a', 'b'), 'b', groups('b')), null);
});

test('기존 연결이 아닌 빈 이름·미상 묶음만 미연결 후보로 본다', () => {
  assert.equal(normalizeCharacterGroupName('  미상  '), '미상');
  assert.equal(normalizeCharacterGroupName(' Leon   Hart '), 'leon hart');
  assert.equal(isUnlinkedCandidateGroup({ groupKey: '미상', entityName: ' 미상 ' }), true);
  assert.equal(isUnlinkedCandidateGroup({ groupKey: '__unnamed__:1', entityName: '' }), true);
  assert.equal(isUnlinkedCandidateGroup({ groupKey: '', entityName: null }), true);
  assert.equal(isUnlinkedCandidateGroup({ groupKey: '레온', entityName: '레온' }), false);
  assert.equal(isUnlinkedCandidateGroup({ groupKey: '인물 미상', entityName: '인물 미상' }), false);
  assert.equal(isUnlinkedCandidateGroup({ groupKey: 'existing:1', entityName: '미상' }), false);
});
