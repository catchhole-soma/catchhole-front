import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findPendingGroupOnPages,
  isUnlinkedCandidateGroup,
  nextGroupKeyAfter,
  otherPageOrder,
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

test('연결로 새로 생긴 그룹보다 원래 다음 차례였던 그룹을 먼저 고른다', () => {
  // 직전 [A, 레온, B, 미상]에서 레온 전부를 기존 인물 X에 연결하면 재조회 목록에 existing:X가 레온 자리에 생긴다.
  assert.equal(nextGroupKeyAfter(groups('a', '레온', 'b', '미상'), '레온', groups('a', 'existing:x', 'b', '미상')), 'b');
  // 원래 다음 차례가 모두 사라졌다면 직전 목록에 없던 그룹(연결로 생긴 그룹)을 고른다.
  assert.equal(nextGroupKeyAfter(groups('a', '레온', 'b'), '레온', groups('a', 'existing:x')), 'existing:x');
});

test('마지막 미상 묶음이 비면 새로 생긴 그룹을, 없으면 현재 첫 그룹을 고른다', () => {
  assert.equal(nextGroupKeyAfter(groups('a', 'b', '미상'), '미상', groups('a', 'existing:x', 'b')), 'existing:x');
  assert.equal(nextGroupKeyAfter(groups('a', 'b', '미상'), '미상', groups('a', 'b')), 'a');
  assert.equal(nextGroupKeyAfter(groups('a', '미상'), '미상', []), null);
});

test('사라진 그룹을 직전 목록에서 찾지 못하면 새로 생긴 그룹, 없으면 현재 첫 그룹을 고르고, 남아 있어도 다시 고르지 않는다', () => {
  assert.equal(nextGroupKeyAfter(groups('a', 'b'), 'x', groups('a', 'c', 'b')), 'c');
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

test('지금 페이지에 열 묶음이 없으면 다음 페이지부터 끝까지, 이어서 첫 페이지부터 지금 페이지 앞까지 찾는다', () => {
  assert.deepEqual(otherPageOrder(1, 4), [2, 3, 0]);
  assert.deepEqual(otherPageOrder(0, 3), [1, 2]);
  assert.deepEqual(otherPageOrder(2, 3), [0, 1]);
  assert.deepEqual(otherPageOrder(0, 1), []);
  assert.deepEqual(otherPageOrder(0, 0), []);
});

test('페이지를 순서대로 읽어 미처리 후보가 남은 첫 묶음과 페이지를 찾고, 끝까지 없으면 null이다', async () => {
  const pages: Record<number, Array<{ groupKey: string; candidates: Array<{ reviewStatus: string }> }>> = {
    0: [{ groupKey: 'a', candidates: [{ reviewStatus: 'CONFIRMED' }] }],
    1: [{ groupKey: 'b', candidates: [{ reviewStatus: 'DISMISSED' }] }, { groupKey: 'c', candidates: [{ reviewStatus: 'PENDING_REVIEW' }] }],
    2: [{ groupKey: 'd', candidates: [{ reviewStatus: 'PENDING_REVIEW' }] }],
  };
  const read: number[] = [];
  const fetchPage = async (page: number) => { read.push(page); return pages[page]; };
  assert.deepEqual(await findPendingGroupOnPages([1, 2, 0], fetchPage), { groupKey: 'c', page: 1 });
  assert.deepEqual(read, [1]);
  assert.deepEqual(await findPendingGroupOnPages([1, 2], fetchPage, 'c'), { groupKey: 'd', page: 2 });
  assert.equal(await findPendingGroupOnPages([0], fetchPage), null);
});
