import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findGroupOnPages,
  findPendingGroupOnPages,
  isUnlinkedCandidateGroup,
  isUnlinkedGroupKey,
  mergeUnlinkedLinks,
  retargetUnlinkedLinks,
  unlinkedLinkTarget,
  nextGroupKeyAfter,
  nextGroupKeyWrapping,
  otherPageOrder,
  normalizeCharacterGroupName,
  summarizeUnlinkedLinks,
  unlinkedGroupAfterChange,
  UNNAMED_GROUP_KEY,
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

test('URL 묶음 key만으로 미연결 묶음(미상·이름 없음)을 알아본다', () => {
  assert.equal(isUnlinkedGroupKey('미상'), true);
  assert.equal(isUnlinkedGroupKey(UNNAMED_GROUP_KEY), true);
  // 예전 key는 지금 목록의 key와 달라 비었는지 알 수 없으므로 미연결 묶음 자리로 붙잡지 않는다.
  assert.equal(isUnlinkedGroupKey('__unnamed__:c1'), false);
  assert.equal(isUnlinkedGroupKey('레온'), false);
  assert.equal(isUnlinkedGroupKey('인물 미상'), false);
  assert.equal(isUnlinkedGroupKey('existing:1'), false);
  assert.equal(isUnlinkedGroupKey(''), false);
  assert.equal(isUnlinkedGroupKey(null), false);
});

const pending = (id: string) => ({ id, reviewStatus: 'PENDING_REVIEW' });
const unknown = (...ids: string[]) => ({ groupKey: '미상', candidates: ids.map(pending) });

test('미연결 묶음에 미처리 후보가 남아 있으면 그대로 둔다', () => {
  assert.equal(unlinkedGroupAfterChange([unknown('c1', 'c2')], '미상', ['c1'], [{ groupKey: 'existing:x' }, unknown('c2')]), 'stay');
});

test('미연결 묶음이 비면 완료 상태로, 전체 필터에서 처리된 후보만 남아도 완료 상태로 본다', () => {
  assert.equal(unlinkedGroupAfterChange([unknown('c1')], '미상', ['c1'], [{ groupKey: 'existing:x' }]), 'done');
  assert.equal(unlinkedGroupAfterChange([unknown('c1', 'c2')], '미상', ['c1', 'c2'], []), 'done');
  assert.equal(unlinkedGroupAfterChange([unknown('c1')], '미상', ['c1'],
    [{ groupKey: '미상', candidates: [{ id: 'c0', reviewStatus: 'CONFIRMED' }] }]), 'done');
});

test('미처리 후보가 남았는데 지금 목록에 없으면 다른 페이지로 밀렸는지 찾는다', () => {
  // 직전 [레온, 미상(c1·c2)]에서 c1을 새 인물에 연결하면 그 인물 묶음이 앞에 끼어들어 미상 묶음이 다음 페이지로 밀린다.
  assert.equal(unlinkedGroupAfterChange([{ groupKey: '레온' }, unknown('c1', 'c2')], '미상', ['c1'],
    [{ groupKey: 'existing:x' }, { groupKey: '레온' }]), 'find');
  // 직전 목록을 모르면(새로고침 뒤) 남은 후보를 알 수 없으므로 완료로 본다(다른 페이지 확인은 화면이 따로 한다).
  assert.equal(unlinkedGroupAfterChange([], '미상', [], []), 'done');
});

test('구버전 후보 단위 페이지가 여러 쪽이면 지금 목록만으로 완료로 단정하지 않고 다른 페이지를 확인한다', () => {
  const partialList = { partialList: true };
  assert.equal(unlinkedGroupAfterChange([unknown('c1')], '미상', ['c1'], [{ groupKey: '레온' }], partialList), 'find');
  assert.equal(unlinkedGroupAfterChange([], '미상', [], [{ groupKey: '미상', candidates: [{ id: 'c0', reviewStatus: 'DISMISSED' }] }], partialList), 'find');
  assert.equal(unlinkedGroupAfterChange([unknown('c1', 'c2')], '미상', ['c1'], [unknown('c2')], partialList), 'stay');
});

test('미연결 묶음을 정리한 뒤 다음 미처리 묶음은 뒤에 있던 묶음, 앞쪽 묶음, 새로 생긴 묶음 순으로 고른다', () => {
  // 미상은 맨 뒤라 뒤에 있던 묶음이 없다. 연결로 생긴 existing:x보다 직전 목록의 첫 묶음으로 돌아간다.
  assert.equal(nextGroupKeyWrapping(groups('a', 'b', '미상'), '미상', groups('existing:x', 'a', 'b')), 'a');
  assert.equal(nextGroupKeyWrapping(groups('a', '미상', '__unnamed__:blank'), '미상', groups('a', '__unnamed__:blank')), '__unnamed__:blank');
  // 직전 목록의 묶음이 모두 사라졌으면 새로 생긴(또는 다른 페이지에서 당겨진) 묶음을 고른다.
  assert.equal(nextGroupKeyWrapping(groups('미상'), '미상', groups('existing:x', 'existing:y')), 'existing:x');
  // 직전 목록이 없으면(새로고침 뒤 복원) 지금 목록의 첫 묶음이다.
  assert.equal(nextGroupKeyWrapping([], '미상', groups('a', 'b')), 'a');
  assert.equal(nextGroupKeyWrapping(groups('a', '미상'), '미상', groups('미상')), null);
  assert.equal(nextGroupKeyWrapping(groups('미상'), '미상', []), null);
});

test('미연결 묶음에서 옮긴 기록은 후보마다 마지막 연결로 바꾸고 인물별로 처음 연결한 순서로 센다', () => {
  const person = (key: string, name: string, groupKey: string | null = key) => ({ key, name, groupKey });
  const records = mergeUnlinkedLinks(
    [{ candidateId: 'c1', target: person('existing:b', '인물B') }, { candidateId: 'c2', target: person('existing:h', '인물H') }],
    [{ candidateId: 'c3', target: person('existing:b', '인물B') }, { candidateId: 'c2', target: person('인물j', '인물J', null) },
      { candidateId: 'c4', target: null }],
  );
  assert.deepEqual(records.map(record => record.candidateId), ['c1', 'c2', 'c3', 'c4']);
  assert.deepEqual(summarizeUnlinkedLinks(records), {
    settingCount: 4,
    people: [
      { key: 'existing:b', name: '인물B', groupKey: 'existing:b', count: 2, candidateIds: ['c1', 'c3'] },
      { key: '인물j', name: '인물J', groupKey: null, count: 1, candidateIds: ['c2'] },
    ],
    untracked: 1,
  });
  assert.deepEqual(summarizeUnlinkedLinks([]), { settingCount: 0, people: [], untracked: 0 });
});

test('조건에 맞는 묶음을 페이지 순서대로 찾는다', async () => {
  const pages: Record<number, Array<{ groupKey: string }>> = { 1: [{ groupKey: 'a' }], 2: [{ groupKey: '미상' }] };
  const read: number[] = [];
  const fetchPage = async (page: number) => { read.push(page); return pages[page]; };
  assert.deepEqual(await findGroupOnPages([1, 2, 0], fetchPage, group => group.groupKey === '미상'), { groupKey: '미상', page: 2 });
  assert.deepEqual(read, [1, 2]);
  assert.equal(await findGroupOnPages([0, 1], fetchPage, group => group.groupKey === '미상'), null);
});

test('연결된 후보가 있는 인물 묶음을 서버 묶음 규칙으로 정하고, 다시 미연결이면 따로 알린다', () => {
  assert.deepEqual(unlinkedLinkTarget({ matchedCharacterId: 'b', entityName: '인물B' }), { key: 'existing:b', name: '인물B', groupKey: 'existing:b' });
  assert.deepEqual(unlinkedLinkTarget({ matchedCharacterId: null, entityName: ' Leon  Hart ' }), { key: 'leon hart', name: ' Leon  Hart ', groupKey: null });
  assert.equal(unlinkedLinkTarget({ matchedCharacterId: null, entityName: '미상' }), 'unlinked');
  assert.equal(unlinkedLinkTarget({ matchedCharacterId: null, entityName: '' }), 'unlinked');
});

test('기록한 후보를 다른 묶음에서 다시 연결하면 기록과 보기 대상 후보를 새 대상으로 옮긴다', () => {
  const a = { key: 'existing:a', name: '인물A', groupKey: 'existing:a' };
  const b = { key: 'existing:b', name: '인물B', groupKey: 'existing:b' };
  const links = { 미상: [{ candidateId: 'c1', target: a }, { candidateId: 'c2', target: a }], 다른: [{ candidateId: 'x', target: a }] };
  const moved = retargetUnlinkedLinks(links, [{ candidateId: 'c1', target: b }, { candidateId: 'zz', target: b }]);
  assert.deepEqual(moved.미상, [{ candidateId: 'c1', target: b }, { candidateId: 'c2', target: a }]);
  assert.deepEqual(moved.다른, links.다른);
  // A의 보기는 아직 A에 있는 c2로 찾고, B 행이 새로 생긴다.
  assert.deepEqual(summarizeUnlinkedLinks(moved.미상).people.map(person => [person.key, person.candidateIds]),
    [['existing:b', ['c1']], ['existing:a', ['c2']]]);
  // 둘 다 B로 옮기면 A 행은 사라지고 B 한 행으로 합쳐진다.
  const merged = retargetUnlinkedLinks(moved, [{ candidateId: 'c2', target: b }]);
  assert.deepEqual(summarizeUnlinkedLinks(merged.미상).people.map(person => [person.key, person.count]), [['existing:b', 2]]);
  // 대상을 모르면 설정 수에만 남기고, 다시 미연결이면 기록에서 뺀다.
  const unknown = retargetUnlinkedLinks(merged, [{ candidateId: 'c1', target: null }, { candidateId: 'c2', target: 'unlinked' }]);
  assert.deepEqual(unknown.미상, [{ candidateId: 'c1', target: null }]);
});
