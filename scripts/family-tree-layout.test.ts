import assert from 'node:assert/strict';
import test from 'node:test';
import { familyTreeFixtures, createLargeFamilyFixture } from '../e2e/fixtures/family-tree-fixtures.ts';
import { layoutFamilyTree } from '../src/app/components/catchhole/relationship/family-tree-layout.ts';
import type { FamilyTreeInput, FamilyTreeLayout } from '../src/app/components/catchhole/relationship/family-tree-layout.ts';

function noOverlap(layout: FamilyTreeLayout) {
  layout.nodes.forEach((left, index) => layout.nodes.slice(index + 1).forEach(right => {
    const intersect = left.position.x < right.position.x + right.width && left.position.x + left.width > right.position.x
      && left.position.y < right.position.y + right.height && left.position.y + left.height > right.position.y;
    assert.equal(intersect, false, `${left.id} overlaps ${right.id}`);
  }));
}

function labelTargetsRemainAccessible(layout: FamilyTreeLayout) {
  const people = layout.nodes.map(node => ({ id: node.id, ...node.position, width: node.width, height: node.height }));
  const labels = layout.connections.flatMap(connection => [
    ...(connection.label ? [{ id: connection.id, x: connection.labelPosition.x - connection.labelSize.width / 2, y: connection.labelPosition.y - connection.labelSize.height / 2, ...connection.labelSize }] : []),
    ...connection.endpointLabels.map(label => ({ id: label.id, x: label.position.x - label.size.width / 2, y: label.position.y - label.size.height / 2, ...label.size })),
  ]);
  [...people, ...labels].forEach(item => {
    assert.ok(item.x >= 0 && item.y >= 0 && item.x + item.width <= layout.width && item.y + item.height <= layout.height,
      `${item.id} falls outside fit bounds`);
  });
  labels.forEach((label, index) => [...people, ...labels.slice(index + 1)].forEach(other => {
    const intersects = label.x < other.x + other.width && label.x + label.width > other.x
      && label.y < other.y + other.height && label.y + label.height > other.y;
    assert.equal(intersects, false, `label ${label.id} covers ${other.id}`);
  }));
}

function allRecordsPreserved(input: FamilyTreeInput, layout: FamilyTreeLayout) {
  assert.deepEqual(layout.nodes.map(node => node.id).sort(), input.nodes.map(node => node.id).sort());
  assert.deepEqual(layout.edges.map(edge => edge.id).sort(), input.edges.map(edge => edge.id).sort());
  assert.deepEqual(layout.connections.flatMap(connection => connection.relationshipIds).sort(), input.edges.map(edge => edge.id).sort(),
    '실제 관계마다 정확히 한 표시 연결에서 근거를 열 수 있다');
  assert.ok(layout.connections.every(connection => connection.paths.every(path => path.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)))));
  const byId = new Map(layout.nodes.map(node => [node.id, node]));
  layout.edges.forEach(edge => {
    assert.equal(edge.source, input.edges.find(item => item.id === edge.id)!.subjectCharacterId);
    assert.equal(edge.target, input.edges.find(item => item.id === edge.id)!.objectCharacterId);
    assert.ok(edge.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
    const source = byId.get(edge.source)!, target = byId.get(edge.target)!;
    const start = edge.points[0], end = edge.points.at(-1)!;
    assert.ok(start.x >= source.position.x && start.x <= source.position.x + source.width);
    assert.ok(start.y >= source.position.y && start.y <= source.position.y + source.height);
    assert.ok(end.x >= target.position.x && end.x <= target.position.x + target.width);
    assert.ok(end.y >= target.position.y && end.y <= target.position.y + target.height);
  });
}

for (const fixture of familyTreeFixtures) {
  test(`${fixture.label}: 인물 중복·관계 유실 없이 겹치지 않는 배치`, async () => {
    const result = await layoutFamilyTree(fixture);
    noOverlap(result); allRecordsPreserved(fixture, result); labelTargetsRemainAccessible(result);
    const cycleIds = new Set(result.warnings.filter(warning => warning.code === 'PARENT_CYCLE').flatMap(warning => warning.relationshipIds));
    const byId = new Map(result.nodes.map(node => [node.id, node]));
    fixture.edges.filter(edge => edge.kind === 'PARENT_OF' && !cycleIds.has(edge.id)).forEach(edge => {
      const parent = byId.get(edge.subjectCharacterId)!, child = byId.get(edge.objectCharacterId)!;
      assert.ok(parent.position.y + parent.height < child.position.y, `parent direction ${edge.id}`);
    });
  });
}

test('같은 확인된 부모 집합과 공통 자녀는 공유 연결점 하나를 사용한다', async () => {
  const result = await layoutFamilyTree(familyTreeFixtures[0]);
  assert.equal(result.junctions.length, 1);
  const junction = result.junctions[0];
  assert.deepEqual(junction.parentIds, ['p1', 'p2']);
  assert.deepEqual(junction.childIds, ['c1', 'c2']);
  assert.deepEqual(junction.relationshipIds, ['r2', 'r3', 'r4', 'r5']);
  for (const id of junction.relationshipIds) assert.ok(result.edges.find(edge => edge.id === id)!.points.some(point => point.x === junction.position.x && point.y === junction.position.y));
  assert.equal(result.nodes.length, 4, '연결점은 실제 인물이나 혼인 노드가 아니다');
  assert.equal(result.connections.length, 2, '배우자 1개와 부모·자녀 묶음 1개로 표시한다');
  const family = result.connections.find(connection => connection.kind === 'PARENT_OF')!;
  assert.equal(family.label, '자녀 2명');
  assert.deepEqual(family.relationshipIds, ['r2', 'r3', 'r4', 'r5', 'r6']);
  assert.equal(family.paths.length, 4, '배우자 중앙줄, 자녀 가로줄, 자녀별 세로줄을 한 번씩 그린다');
  const spouse = result.connections.find(connection => connection.kind === 'SPOUSE')!;
  assert.equal(family.paths[0][0].x, (spouse.paths[0][0].x + spouse.paths[0][1].x) / 2);
  assert.equal(family.paths[0][0].y, spouse.paths[0][0].y);
});

test('친생·입양 연결점은 구분하고 동일 인물 쌍의 복수 관계 ID와 클릭 위치를 보존한다', async () => {
  const result = await layoutFamilyTree(familyTreeFixtures[3]);
  assert.equal(result.junctions.length, 2);
  const parallel = result.edges.filter(edge => edge.source === 'p1' && edge.target === 'c1');
  assert.deepEqual(parallel.map(edge => edge.subtype).sort(), ['ADOPTIVE', 'BIOLOGICAL']);
  assert.notDeepEqual(parallel[0].labelPosition, parallel[1].labelPosition);
  assert.equal(result.edges.some(edge => edge.kind === 'SPOUSE'), false, '공동 부모만으로 혼인을 만들지 않는다');
  assert.equal(result.connections.length, 2);
  assert.deepEqual(result.connections.map(connection => connection.subtype).sort(), ['ADOPTIVE', 'BIOLOGICAL']);
  assert.ok(result.connections.every(connection => connection.paths[0][0].y >= result.nodes.find(node => node.id === 'p1')!.position.y + 88));
});

test('부모 미상 형제는 실제 형제만 같은 높이에 배치하고 부모를 만들지 않는다', async () => {
  const result = await layoutFamilyTree(familyTreeFixtures[2]);
  assert.equal(new Set(result.nodes.map(node => node.position.y)).size, 1);
  assert.equal(result.junctions.length, 0);
  assert.equal(result.nodes.length, 3);
  assert.ok(result.edges.every(edge => edge.kind === 'SIBLING'));
  assert.equal(result.connections.length, 2);
  assert.ok(result.connections.every(connection => connection.kind === 'SIBLING' && connection.label === '형제·자매'));
});

test('재혼은 공유 배우자를 가운데 두고 자녀를 해당 부모 조합 아래 배치한다', async () => {
  const result = await layoutFamilyTree(familyTreeFixtures[1]);
  const byId = new Map(result.nodes.map(node => [node.id, node]));
  const x = (id: string) => byId.get(id)!.position.x;
  assert.ok(x('p2') < x('p1') && x('p1') < x('p3'));
  assert.ok(x('c1') < x('p1') && x('c2') > x('p1'));
  assert.equal(result.connections.filter(connection => connection.kind === 'SPOUSE').length, 2);
  assert.equal(result.connections.filter(connection => connection.kind === 'PARENT_OF').length, 2);
  assert.equal(result.connections.find(connection => connection.kind === 'SIBLING')!.label, '이복 형제');
  assert.equal(result.connections.find(connection => connection.relationshipIds.includes('r1'))!.label, '과거 배우자');
});

test('단독 부모의 자녀와 근거를 묶되 배우자나 다른 부모를 만들지 않는다', async () => {
  const input: FamilyTreeInput = { nodes: ['p', 'a', 'b'].map(id => ({ id, name: id })), edges: [
    { id: 'pa', subjectCharacterId: 'p', objectCharacterId: 'a', kind: 'PARENT_OF' },
    { id: 'pb', subjectCharacterId: 'p', objectCharacterId: 'b', kind: 'PARENT_OF' },
  ] };
  const result = await layoutFamilyTree(input);
  allRecordsPreserved(input, result); labelTargetsRemainAccessible(result);
  assert.equal(result.connections.length, 1); assert.equal(result.connections[0].label, '자녀 2명');
  assert.deepEqual(result.connections[0].personIds, ['a', 'b', 'p']);
});

test('다른 시점의 배우자는 현재 부모 연결의 출발점으로 합치지 않는다', async () => {
  const input = { ...familyTreeFixtures[0], edges: familyTreeFixtures[0].edges.map(edge => edge.kind === 'SPOUSE' ? { ...edge, temporalScope: 'HISTORICAL' } : edge) };
  const result = await layoutFamilyTree(input);
  const family = result.connections.find(connection => connection.kind === 'PARENT_OF')!;
  const parents = result.nodes.filter(node => node.id === 'p1' || node.id === 'p2');
  assert.ok(family.paths[0][0].y >= Math.max(...parents.map(node => node.position.y + node.height)));
  assert.equal(result.connections.find(connection => connection.kind === 'SPOUSE')!.label, '과거 배우자');
});

test('친생·입양 부모 집합이 같아도 양친 친생 형제 근거는 친생 묶음에만 포함한다', async () => {
  const input: FamilyTreeInput = { nodes: ['p1', 'p2', 'c1', 'c2'].map(id => ({ id, name: id })), edges: [
    ...['BIOLOGICAL', 'ADOPTIVE'].flatMap(subtype => ['p1', 'p2'].flatMap(parent => ['c1', 'c2'].map(child => ({
      id: `${subtype}:${parent}:${child}`, subjectCharacterId: parent, objectCharacterId: child, kind: 'PARENT_OF' as const, subtype,
    })))),
    { id: 'full-siblings', subjectCharacterId: 'c1', objectCharacterId: 'c2', kind: 'SIBLING', subtype: 'FULL' },
  ] };
  const result = await layoutFamilyTree(input);
  allRecordsPreserved(input, result); labelTargetsRemainAccessible(result);
  assert.equal(result.connections.length, 2);
  assert.equal(result.connections.find(connection => connection.relationshipIds.includes('full-siblings'))!.subtype, 'BIOLOGICAL');
  const onlyAdoptive = await layoutFamilyTree({ ...input, edges: input.edges.filter(edge => edge.subtype !== 'BIOLOGICAL') });
  assert.equal(onlyAdoptive.connections.find(connection => connection.relationshipIds.includes('full-siblings'))!.kind, 'SIBLING');
});

test('출생 순서나 입력 순서·표시명으로 배치가 바뀌지 않는다', async () => {
  const fixture = familyTreeFixtures[1];
  const first = await layoutFamilyTree(fixture);
  const second = await layoutFamilyTree({ nodes: [...fixture.nodes].reverse().map(node => ({ ...node, name: `${node.name} 이름 변경` })), edges: [...fixture.edges].reverse() });
  assert.deepEqual(first.nodes.map(({ id, position }) => ({ id, position })), second.nodes.map(({ id, position }) => ({ id, position })));
  assert.deepEqual(first.edges, second.edges);
});

test('분리된 가족의 영역은 겹치지 않고 독립 인물도 보존한다', async () => {
  const result = await layoutFamilyTree(familyTreeFixtures[4]);
  assert.equal(result.components.length, 3);
  result.components.slice(1).forEach((component, index) => assert.ok(result.components[index].x + result.components[index].width < component.x));
});

test('부모 순환과 세대 정렬 모순을 경고하면서 원래 방향과 모든 관계를 유지한다', async () => {
  const cycle = await layoutFamilyTree(familyTreeFixtures[5]);
  assert.deepEqual(cycle.warnings.find(warning => warning.code === 'PARENT_CYCLE')!.relationshipIds, ['r1', 'r2', 'r3']);
  allRecordsPreserved(familyTreeFixtures[5], cycle);
  const conflict = await layoutFamilyTree(familyTreeFixtures[6]);
  assert.ok(conflict.warnings.some(warning => warning.code === 'GENERATION_CONFLICT'));
  allRecordsPreserved(familyTreeFixtures[6], conflict);
});

test('빈 입력과 조회되지 않은 인물 연결을 명시적으로 처리한다', async () => {
  assert.equal((await layoutFamilyTree({ nodes: [], edges: [] })).width, 0);
  const result = await layoutFamilyTree({ nodes: [{ id: 'a', name: '가람' }], edges: [{ id: 'missing', subjectCharacterId: 'a', objectCharacterId: 'b', kind: 'PARENT_OF' }] });
  assert.equal(result.nodes.length, 1); assert.equal(result.edges.length, 0);
  assert.deepEqual(result.warnings[0].relationshipIds, ['missing']);
  assert.equal(result.warnings[0].code, 'MISSING_PERSON');
});

test('두 세대를 건너뛰는 부모 관계는 중간 인물 카드를 가로지르지 않는다', async () => {
  const input: FamilyTreeInput = { nodes: ['a', 'b', 'c'].map(id => ({ id, name: id })), edges: [
    { id: 'ab', subjectCharacterId: 'a', objectCharacterId: 'b', kind: 'PARENT_OF' },
    { id: 'bc', subjectCharacterId: 'b', objectCharacterId: 'c', kind: 'PARENT_OF' },
    { id: 'ac', subjectCharacterId: 'a', objectCharacterId: 'c', kind: 'PARENT_OF', subtype: 'ADOPTIVE' },
  ] };
  const result = await layoutFamilyTree(input), middle = result.nodes.find(node => node.id === 'b')!;
  const points = result.edges.find(edge => edge.id === 'ac')!.points;
  points.slice(1).forEach((point, index) => {
    const previous = points[index];
    const crosses = previous.x === point.x
      ? point.x > middle.position.x && point.x < middle.position.x + middle.width && Math.max(point.y, previous.y) > middle.position.y && Math.min(point.y, previous.y) < middle.position.y + middle.height
      : point.y > middle.position.y && point.y < middle.position.y + middle.height && Math.max(point.x, previous.x) > middle.position.x && Math.min(point.x, previous.x) < middle.position.x + middle.width;
    assert.equal(crosses, false);
  });
});

test('500명 경계는 모든 인물·관계와 부모 방향을 보존하는 빠른 기본 배치를 사용한다', { timeout: 10_000 }, async () => {
  const fixture = createLargeFamilyFixture(500), start = performance.now();
  const result = await layoutFamilyTree(fixture);
  assert.ok(performance.now() - start < 5_000);
  assert.equal(result.warnings.filter(warning => warning.code === 'DENSE_GRAPH').length, 1);
  allRecordsPreserved(fixture, result); noOverlap(result); labelTargetsRemainAccessible(result);
  const byId = new Map(result.nodes.map(node => [node.id, node]));
  assert.ok(result.edges.every(edge => byId.get(edge.source)!.generation < byId.get(edge.target)!.generation));
});

test('분리된 인물 500명도 반복 ELK 호출 없이 유실·겹침 없이 배치한다', { timeout: 10_000 }, async () => {
  const fixture = createLargeFamilyFixture(500);
  const result = await layoutFamilyTree({ nodes: fixture.nodes, edges: [] });
  assert.equal(result.nodes.length, 500); assert.equal(result.components.length, 500); noOverlap(result);
  assert.equal(result.warnings.filter(warning => warning.code === 'DENSE_GRAPH').length, 1);
});

test('300명은 실제 ELK로 배치하고 모든 인물·관계·라벨 접근 영역을 유지한다', { timeout: 20_000 }, async () => {
  const fixture = createLargeFamilyFixture(300), start = performance.now();
  const result = await layoutFamilyTree(fixture);
  assert.ok(performance.now() - start < 15_000);
  assert.equal(result.warnings.some(warning => warning.code === 'DENSE_GRAPH' || warning.code === 'LAYOUT_FALLBACK'), false);
  allRecordsPreserved(fixture, result); noOverlap(result); labelTargetsRemainAccessible(result);
});

test('동일 부모의 많은 자녀·여러 부모의 공통 자녀에서도 라벨과 카드가 겹치지 않는다', async () => {
  const parents = Array.from({ length: 5 }, (_, index) => ({ id: `p${index}`, name: `부모${index}` }));
  const children = Array.from({ length: 8 }, (_, index) => ({ id: `c${index}`, name: `자녀${index}` }));
  const input: FamilyTreeInput = { nodes: [...parents, ...children], edges: parents.flatMap(parent => children.map(child => ({
    id: `${parent.id}-${child.id}`, subjectCharacterId: parent.id, objectCharacterId: child.id, kind: 'PARENT_OF' as const,
  }))) };
  const result = await layoutFamilyTree(input);
  allRecordsPreserved(input, result); noOverlap(result); labelTargetsRemainAccessible(result);
  assert.equal(result.junctions.length, 1);
});


test('설정 언급 인물은 같은 이름의 등록 인물이나 다른 언급과 합치지 않고 출처를 보존한다', async () => {
  const input: FamilyTreeInput = {
    nodes: [
      { id: 'bjorn', name: '비요른', nodeType: 'CHARACTER', characterId: 'bjorn' },
      { id: 'other-child', name: '다른 자녀', nodeType: 'CHARACTER', characterId: 'other-child' },
      { id: 'yandel', name: '얀델', nodeType: 'CHARACTER', characterId: 'yandel' },
      { id: 'mention:first', name: '얀델', nodeType: 'MENTION', characterId: null, candidateId: 'first' },
      { id: 'mention:second', name: '얀델', nodeType: 'MENTION', characterId: null, candidateId: 'second' },
    ],
    edges: [
      { id: 'mention:first', subjectCharacterId: 'mention:first', objectCharacterId: 'bjorn', kind: 'PARENT_OF', sourceType: 'MENTION', candidateId: 'first' },
      { id: 'mention:second', subjectCharacterId: 'mention:second', objectCharacterId: 'other-child', kind: 'PARENT_OF', sourceType: 'MENTION', candidateId: 'second' },
    ],
  };
  const result = await layoutFamilyTree(input);
  allRecordsPreserved(input, result); noOverlap(result); labelTargetsRemainAccessible(result);
  assert.equal(result.nodes.filter(node => node.name === '얀델').length, 3);
  for (const candidateId of ['first', 'second']) {
    const mentioned = result.nodes.find(node => node.id === `mention:${candidateId}`)!;
    const edge = result.edges.find(item => item.id === `mention:${candidateId}`)!;
    assert.equal(mentioned.nodeType, 'MENTION'); assert.equal(mentioned.characterId, null);
    assert.equal(mentioned.candidateId, candidateId); assert.equal(edge.sourceType, 'MENTION');
    assert.equal(edge.relationshipId, null); assert.equal(edge.candidateId, candidateId);
    assert.ok(mentioned.position.y < result.nodes.find(node => node.id === edge.target)!.position.y);
  }
});


test('양끝 호칭은 각각의 명시 역할을 쓰고 단자녀 중앙 개수를 반복하지 않는다', async () => {
  const input: FamilyTreeInput = { nodes: [{ id: 'parent', name: '얀델' }, { id: 'child', name: '비요른' }],
    edges: [{ id: 'r', subjectCharacterId: 'parent', objectCharacterId: 'child', kind: 'PARENT_OF', subjectRole: 'PARENT', objectRole: 'SON' }] };
  const result = await layoutFamilyTree(input);
  const connection = result.connections[0];
  assert.equal(connection.label, '');
  assert.deepEqual(connection.endpointLabels.map(label => [label.personId, label.role, label.label, label.relationshipIds]), [
    ['parent', 'PARENT', '부모', ['r']], ['child', 'SON', '아들', ['r']],
  ]);
  labelTargetsRemainAccessible(result);
});

test('공유선은 인물마다 호칭 하나와 관련 부모간선만 묶고 generic 또는 상충을 덮지 않는다', async () => {
  const base = familyTreeFixtures[0];
  const typed = { ...base, edges: base.edges.map(edge => edge.kind === 'PARENT_OF' ? {
    ...edge, subjectRole: edge.subjectCharacterId === 'p1' ? 'FATHER' as const : 'MOTHER' as const,
    objectRole: edge.objectCharacterId === 'c1' ? 'SON' as const : 'DAUGHTER' as const,
  } : edge) };
  const result = await layoutFamilyTree(typed);
  const family = result.connections.find(connection => connection.kind === 'PARENT_OF')!;
  assert.equal(family.endpointLabels.length, 4);
  for (const label of family.endpointLabels.filter(item => item.role === 'FATHER' || item.role === 'MOTHER')) {
    const node = result.nodes.find(item => item.id === label.personId)!;
    assert.equal(label.position.x, node.position.x + node.width / 2);
    assert.equal(label.position.y, node.position.y + node.height + 28);
  }
  assert.deepEqual(family.endpointLabels.map(label => [label.personId, label.role, label.relationshipIds]), [
    ['p1', 'FATHER', ['r2', 'r4']], ['p2', 'MOTHER', ['r3', 'r5']], ['c1', 'SON', ['r2', 'r3']], ['c2', 'DAUGHTER', ['r4', 'r5']],
  ]);
  assert.ok(family.relationshipIds.includes('r6'));
  assert.ok(family.endpointLabels.every(label => !label.relationshipIds.includes('r6')), '흡수한 형제 근거는 부모 호칭 근거에 포함하지 않는다');
  labelTargetsRemainAccessible(result);
  const conflicted = await layoutFamilyTree({ ...typed, edges: typed.edges.map(edge => edge.id === 'r3' ? { ...edge, objectRole: 'CHILD' } : edge.id === 'r4' ? { ...edge, subjectRole: 'MOTHER' } : edge) });
  const labels = conflicted.connections.flatMap(connection => connection.endpointLabels);
  assert.equal(labels.find(label => label.personId === 'p1')!.role, 'PARENT');
  assert.equal(labels.find(label => label.personId === 'c1')!.role, 'CHILD');
  labelTargetsRemainAccessible(conflicted);
});

test('친생·입양 자녀가 함께 있어도 부모 호칭은 한 번만 표시하고 각 부모의 근거를 모두 보존한다', async () => {
  const input: FamilyTreeInput = {
    nodes: ['mother', 'father', 'son', 'daughter', 'adopted'].map(id => ({ id, name: id })),
    edges: ['mother', 'father'].flatMap(parent => ['son', 'daughter', 'adopted'].map(child => ({
      id: `${parent}-${child}`, subjectCharacterId: parent, objectCharacterId: child,
      kind: 'PARENT_OF' as const, subtype: child === 'adopted' ? 'ADOPTIVE' : 'BIOLOGICAL',
      subjectRole: parent === 'mother' ? 'MOTHER' as const : 'FATHER' as const,
      objectRole: child === 'daughter' ? 'DAUGHTER' as const : 'SON' as const,
      temporalScope: 'CURRENT',
    }))),
  };
  const result = await layoutFamilyTree(input);
  allRecordsPreserved(input, result); labelTargetsRemainAccessible(result);
  assert.deepEqual(result.connections.map(connection => connection.subtype).sort(), ['ADOPTIVE', 'BIOLOGICAL']);
  for (const parent of ['mother', 'father']) {
    const labels = result.connections.flatMap(connection => connection.endpointLabels).filter(label => label.personId === parent);
    assert.equal(labels.length, 1);
    assert.deepEqual(labels[0].relationshipIds, [`${parent}-adopted`, `${parent}-daughter`, `${parent}-son`]);
  }
  const adoption = result.connections.find(connection => connection.subtype === 'ADOPTIVE')!;
  assert.equal(adoption.label, '입양');
  assert.deepEqual(adoption.relationshipIds, ['father-adopted', 'mother-adopted']);
  assert.deepEqual(adoption.endpointLabels.find(label => label.personId === 'adopted')!.relationshipIds, ['father-adopted', 'mother-adopted']);
});

test('같은 인물이라도 다른 부모 호칭과 관계 시점은 합치지 않는다', async () => {
  const input: FamilyTreeInput = {
    nodes: ['parent', 'a', 'b', 'c', 'd', 'e'].map(id => ({ id, name: id })),
    edges: [
      { id: 'a', subjectRole: 'MOTHER' as const, subtype: 'BIOLOGICAL', temporalScope: 'CURRENT' },
      { id: 'b', subjectRole: 'PARENT' as const, subtype: 'ADOPTIVE', temporalScope: 'CURRENT' },
      { id: 'c', subjectRole: 'FATHER' as const, subtype: 'STEP', temporalScope: 'CURRENT' },
      { id: 'd', subjectRole: 'MOTHER' as const, subtype: 'BIOLOGICAL', temporalScope: 'HISTORICAL', timeLabel: '혼인 전' },
      { id: 'e', subjectRole: 'MOTHER' as const, subtype: 'BIOLOGICAL', temporalScope: 'HISTORICAL', timeLabel: '혼인 후' },
    ].map(edge => ({ ...edge, subjectCharacterId: 'parent', objectCharacterId: edge.id, kind: 'PARENT_OF' as const })),
  };
  const result = await layoutFamilyTree(input);
  allRecordsPreserved(input, result); labelTargetsRemainAccessible(result);
  const labels = result.connections.flatMap(connection => connection.endpointLabels).filter(label => label.personId === 'parent');
  assert.equal(labels.length, 5);
  assert.deepEqual(labels.flatMap(label => label.relationshipIds).sort(), ['a', 'b', 'c', 'd', 'e']);
});

test('5대손은 두 인물과 별도 조상 연결만 만들고 중간 세대를 압축한다', async () => {
  const input: FamilyTreeInput = {
    nodes: [{ id: 'ancestor', name: '아르덴' }, { id: 'descendant', name: '비칼' }],
    edges: [{ id: 'ancestry', subjectCharacterId: 'ancestor', objectCharacterId: 'descendant', kind: 'ANCESTOR_OF', generationGap: 5 }],
  };
  for (const options of [{}, { nodeWidth: 136, nodeHeight: 88 }]) {
    const result = await layoutFamilyTree(input, options);
    allRecordsPreserved(input, result); noOverlap(result); labelTargetsRemainAccessible(result);
    assert.equal(result.nodes.length, 2);
    assert.equal(result.junctions.length, 0);
    assert.equal(result.nodes.find(node => node.id === 'descendant')!.generation, 1, '비어 있는 5개 층을 만들지 않는다');
    const connection = result.connections[0];
    assert.equal(connection.kind, 'ANCESTOR_OF');
    assert.equal(connection.generationGap, 5);
    assert.equal(connection.label, '5대손');
    assert.equal(connection.detailLabel, '중간 계보 생략');
    assert.equal(connection.paths.length, 2);
    assert.ok(connection.lineageBreak);
    assert.equal(connection.lineageBreak!.direction, 'vertical');
    assert.deepEqual(connection.endpointLabels.map(label => label.label), ['조상', '후손']);
    const marker = connection.lineageBreak!.position;
    for (const label of connection.endpointLabels) {
      assert.ok(Math.abs(marker.x - label.position.x) >= label.size.width / 2 + 10
        || Math.abs(marker.y - label.position.y) >= label.size.height / 2 + 12, '생략 기호와 양끝 호칭은 겹치지 않는다');
    }
  }
});

test('한 조상의 여러 후손은 각자의 세대 수를 자기 가지에 표시한다', async () => {
  const input = familyTreeFixtures.find(fixture => fixture.id === 'explicit-ancestry')!;
  for (const options of [{}, { nodeWidth: 136, nodeHeight: 88 }]) {
    const result = await layoutFamilyTree(input, options);
    labelTargetsRemainAccessible(result);
    const ancestorLabels = result.connections.flatMap(connection => connection.endpointLabels).filter(label => label.role === 'ANCESTOR');
    assert.equal(ancestorLabels.length, 1);
    assert.deepEqual(ancestorLabels[0].relationshipIds, ['r1', 'r2']);
    for (const connection of result.connections) {
      const targetId = input.edges.find(edge => edge.id === connection.relationshipIds[0])!.objectCharacterId;
      const target = result.nodes.find(node => node.id === targetId)!;
      assert.ok(connection.lineageBreak);
      if (connection.generationGap != null) {
        assert.ok(connection.lineageBreak.position.x > target.position.x + target.width, '먼 후손 선은 가족 영역 바깥에 둔다');
        assert.equal(connection.labelPosition.x, connection.lineageBreak.position.x, '세대 수가 다른 후손 가지로 이동하면 안 된다');
      } else {
        assert.ok(result.regions.some(region => target.position.x >= region.position.x && target.position.x < region.position.x + region.width));
      }
    }
  }
});

test('미등록 조상의 세대 미상 관계와 알려진 부모 경로를 별도로 유지한다', async () => {
  const input: FamilyTreeInput = {
    nodes: [
      { id: 'a', name: '아르덴' }, { id: 'b', name: '레온' }, { id: 'c', name: '비칼' },
      { id: 'mention:a', name: '태조', nodeType: 'MENTION', candidateId: 'claim' },
    ],
    edges: [
      { id: 'ab', subjectCharacterId: 'a', objectCharacterId: 'b', kind: 'PARENT_OF' },
      { id: 'bc', subjectCharacterId: 'b', objectCharacterId: 'c', kind: 'PARENT_OF' },
      { id: 'ac', subjectCharacterId: 'a', objectCharacterId: 'c', kind: 'ANCESTOR_OF', generationGap: 2 },
      { id: 'claim', subjectCharacterId: 'mention:a', objectCharacterId: 'c', kind: 'ANCESTOR_OF', generationGap: null, sourceType: 'MENTION', candidateId: 'claim' },
    ],
  };
  const result = await layoutFamilyTree(input);
  allRecordsPreserved(input, result); noOverlap(result); labelTargetsRemainAccessible(result);
  assert.equal(result.nodes.length, 4);
  assert.equal(result.connections.filter(connection => connection.kind === 'ANCESTOR_OF').length, 2);
  assert.equal(result.connections.find(connection => connection.relationshipIds.includes('claim'))!.label, '후손 · 세대 미상');
  assert.equal(result.edges.find(edge => edge.id === 'claim')!.candidateId, 'claim');
  const byId = new Map(result.nodes.map(node => [node.id, node]));
  assert.ok(byId.get('a')!.position.y < byId.get('b')!.position.y);
  assert.ok(byId.get('b')!.position.y < byId.get('c')!.position.y);
  assert.equal(result.connections.filter(connection => connection.kind === 'PARENT_OF').flatMap(connection => connection.relationshipIds).includes('ac'), false);
});

test('조상과 부모 관계가 섞인 순환도 경고하면서 원래 근거를 보존한다', async () => {
  const input: FamilyTreeInput = {
    nodes: ['a', 'b', 'c'].map(id => ({ id, name: id })),
    edges: [
      { id: 'ab', subjectCharacterId: 'a', objectCharacterId: 'b', kind: 'ANCESTOR_OF', generationGap: 5 },
      { id: 'bc', subjectCharacterId: 'b', objectCharacterId: 'c', kind: 'PARENT_OF' },
      { id: 'ca', subjectCharacterId: 'c', objectCharacterId: 'a', kind: 'PARENT_OF' },
    ],
  };
  const result = await layoutFamilyTree(input);
  allRecordsPreserved(input, result); labelTargetsRemainAccessible(result);
  assert.deepEqual(result.warnings.find(warning => warning.code === 'PARENT_CYCLE')!.relationshipIds, ['ab', 'bc', 'ca']);
});

test('자녀·3대손·5대손을 구분하고 세대 미상은 별도 영역에 둔다', async () => {
  const input: FamilyTreeInput = {
    nodes: ['arden', 'son', 'daughter', 'third', 'fifth', 'unknown'].map(id => ({ id, name: id })),
    edges: [
      { id: 'son', subjectCharacterId: 'arden', objectCharacterId: 'son', kind: 'PARENT_OF', objectRole: 'SON' },
      { id: 'daughter', subjectCharacterId: 'arden', objectCharacterId: 'daughter', kind: 'PARENT_OF', objectRole: 'DAUGHTER' },
      { id: 'third', subjectCharacterId: 'arden', objectCharacterId: 'third', kind: 'ANCESTOR_OF', generationGap: 3 },
      { id: 'fifth', subjectCharacterId: 'arden', objectCharacterId: 'fifth', kind: 'ANCESTOR_OF', generationGap: 5 },
      { id: 'unknown', subjectCharacterId: 'arden', objectCharacterId: 'unknown', kind: 'ANCESTOR_OF' },
    ],
  };
  for (const options of [{}, { nodeWidth: 136 }]) {
    const result = await layoutFamilyTree(input, options);
    allRecordsPreserved(input, result); noOverlap(result); labelTargetsRemainAccessible(result);
    const people = new Map(result.nodes.map(node => [node.id, node]));
    assert.deepEqual(['arden', 'son', 'daughter', 'third', 'fifth'].map(id => people.get(id)!.generation), [0, 1, 1, 2, 3]);
    assert.equal(result.regions.length, 1);
    assert.notEqual(people.get('unknown')!.bandId, people.get('arden')!.bandId);
    const family = result.connections.find(connection => connection.kind === 'PARENT_OF')!;
    const familyRight = Math.max(...family.paths.flat().map(point => point.x));
    for (const id of ['third', 'fifth']) {
      const connection = result.connections.find(item => item.relationshipIds.includes(id))!;
      assert.ok(connection.lineageBreak!.position.x > familyRight);
      assert.equal(result.edges.find(edge => edge.id === id)!.source, 'arden');
      assert.ok(connection.labelPosition.y < people.get(id)!.position.y + people.get(id)!.height);
    }
    // A distant link may touch its endpoints, never an unrelated person.
    for (const connection of result.connections.filter(item => item.kind === 'ANCESTOR_OF')) {
      for (const path of connection.paths) for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i];
        for (const person of result.nodes.filter(node => !connection.personIds.includes(node.id))) {
          const crosses = Math.max(a.x, b.x) > person.position.x && Math.min(a.x, b.x) < person.position.x + person.width
            && Math.max(a.y, b.y) > person.position.y && Math.min(a.y, b.y) < person.position.y + person.height;
          assert.equal(crosses, false, `${connection.id} crosses ${person.id}`);
        }
      }
    }
  }
});

test('명시된 세대 차이를 양방향으로 계산하며 큰 숫자의 빈 층을 만들지 않는다', async () => {
  const input: FamilyTreeInput = {
    nodes: ['a', 'b', 'c'].map(id => ({ id, name: id })),
    edges: [
      { id: 'ac', subjectCharacterId: 'a', objectCharacterId: 'c', kind: 'ANCESTOR_OF', generationGap: 1000 },
      { id: 'bc', subjectCharacterId: 'b', objectCharacterId: 'c', kind: 'PARENT_OF' },
    ],
  };
  const result = await layoutFamilyTree(input);
  allRecordsPreserved(input, result); labelTargetsRemainAccessible(result);
  assert.deepEqual(['a', 'b', 'c'].map(id => result.nodes.find(node => node.id === id)!.generation), [0, 1, 2]);
  assert.ok(result.height < 1000);
});

test('조상 연결은 옆 배우자 카드를 통과하지 않고 세대 차이가 있는 배우자를 강제로 같은 줄에 놓지 않는다', async () => {
  const input: FamilyTreeInput = {
    nodes: ['a', 'b', 'c'].map(id => ({ id, name: id })),
    edges: [
      { id: 'ab', subjectCharacterId: 'a', objectCharacterId: 'b', kind: 'SPOUSE' },
      { id: 'ac', subjectCharacterId: 'a', objectCharacterId: 'c', kind: 'ANCESTOR_OF', generationGap: 5 },
    ],
  };
  const result = await layoutFamilyTree(input);
  allRecordsPreserved(input, result); labelTargetsRemainAccessible(result);
  const spouse = result.nodes.find(node => node.id === 'b')!;
  const ancestry = result.edges.find(edge => edge.id === 'ac')!;
  assert.equal(ancestry.sourceHandle, 'top');
  ancestry.points.slice(1).forEach((point, index) => {
    const previous = ancestry.points[index];
    const crosses = Math.max(point.x, previous.x) > spouse.position.x && Math.min(point.x, previous.x) < spouse.position.x + spouse.width
      && Math.max(point.y, previous.y) > spouse.position.y && Math.min(point.y, previous.y) < spouse.position.y + spouse.height;
    assert.equal(crosses, false);
  });
  const mixed = await layoutFamilyTree({ ...input, edges: [...input.edges,
    { id: 'bc', subjectCharacterId: 'b', objectCharacterId: 'c', kind: 'PARENT_OF' }] });
  assert.deepEqual(['a', 'b', 'c'].map(id => mixed.nodes.find(node => node.id === id)!.generation), [0, 1, 2]);
  assert.ok(mixed.warnings.some(warning => warning.relationshipIds.includes('ab')));
  assert.ok(!mixed.warnings.some(warning => warning.message.includes('명시된 세대 수가 서로 맞지')));
});
