import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import { layoutEpisodeRelationshipNetwork } from '../src/app/components/catchhole/relationship/episode-relationship-network';
import { PERSON_HEIGHT, PERSON_WIDTH, type EpisodeConnection, type EpisodePerson } from '../src/app/components/catchhole/relationship/episode-relationship-layout';

const people = (count: number): EpisodePerson[] => Array.from({ length: count }, (_, index) => ({ id: `n${String(index).padStart(3, '0')}`, name: `인물 ${index}` }));
const edge = (id: string, source: string, target: string): EpisodeConnection => ({ id, source, target, label: '함께 행동', summary: '', direction: 'DIRECTED', ended: false });

function assertCards(positions: Map<string, { x: number; y: number }>, expectedCount: number) {
  assert.equal(positions.size, expectedCount);
  const points = [...positions.values()];
  for (const point of points) assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.y >= 0);
  for (let left = 0; left < points.length; left++) for (let right = left + 1; right < points.length; right++) {
    assert.ok(Math.abs(points[left].x - points[right].x) >= PERSON_WIDTH + 95.99
      || Math.abs(points[left].y - points[right].y) >= PERSON_HEIGHT + 87.99,
    `cards ${left}, ${right} overlap or lose their label corridor`);
  }
}

test('empty, singleton, isolates, unknown endpoints and self-relations stay finite', () => {
  assertCards(layoutEpisodeRelationshipNetwork([], []).positions, 0);
  assertCards(layoutEpisodeRelationshipNetwork(people(1), [edge('self', 'n000', 'n000')]).positions, 1);
  assertCards(layoutEpisodeRelationshipNetwork(people(25), [edge('unknown', 'n000', 'missing')]).positions, 25);
});

test('deterministic API ordering and reciprocal relations preserve every input', () => {
  const nodes = people(30), links = nodes.slice(1, 22).map((node, index) => edge(`r${index}`, nodes[index % 5].id, node.id));
  links.push(edge('reverse', 'n001', 'n000'), { ...edge('mutual', 'n000', 'n001'), direction: 'MUTUAL' });
  const before = structuredClone({ nodes, links });
  const first = layoutEpisodeRelationshipNetwork(nodes, links);
  const second = layoutEpisodeRelationshipNetwork([...nodes].reverse(), [...links].reverse());
  assert.deepEqual(first.positions, second.positions);
  assert.deepEqual(first.hubIds, second.hubIds);
  assert.deepEqual({ nodes, links }, before);
  assertCards(first.positions, nodes.length);
});

test('100-node hub and a dense clique keep cards and label corridors clear', () => {
  const nodes = people(100);
  const links = nodes.slice(1, 80).map(node => edge(`hub-${node.id}`, 'n000', node.id));
  for (let left = 80; left < 95; left++) for (let right = left + 1; right < 95; right++) links.push(edge(`clique-${left}-${right}`, nodes[left].id, nodes[right].id));
  assertCards(layoutEpisodeRelationshipNetwork(nodes, links).positions, 100);
});

test('graph neighbors are closer on average than distant people without inventing a direction', () => {
  const nodes = people(20), links = nodes.slice(1).map((node, index) => edge(`path-${index}`, nodes[index].id, node.id));
  const first = layoutEpisodeRelationshipNetwork(nodes, links);
  const reversed = layoutEpisodeRelationshipNetwork(nodes, links.map(link => ({ ...link, source: link.target, target: link.source })));
  assert.deepEqual(first.positions, reversed.positions, 'semantic arrows must not impose a spatial hierarchy');
  const distance = (a: string, b: string) => {
    const x = first.positions.get(a)!, y = first.positions.get(b)!;
    return Math.hypot(x.x - y.x, x.y - y.y);
  };
  const linkedMean = links.reduce((sum, link) => sum + distance(link.source, link.target), 0) / links.length;
  const distantMean = nodes.slice(0, 10).reduce((sum, node, index) => sum + distance(node.id, nodes[index + 10].id), 0) / 10;
  assert.ok(linkedMean < distantMean);
  assertCards(first.positions, nodes.length);
});

const fixturePath = process.env.EPISODE_RELATIONSHIP_GRAPH_FIXTURE;
test('local 50-person 100-edge fixture has stable clear geometry', { skip: !fixturePath }, context => {
  const graph = JSON.parse(readFileSync(fixturePath!, 'utf8')) as {
    nodes: EpisodePerson[];
    edges: Array<{ id: string; sourceNodeId: string; targetNodeId: string; label: string; summary: string; direction: EpisodeConnection['direction']; status: string }>;
  };
  const links = graph.edges.map(item => ({ ...item, source: item.sourceNodeId, target: item.targetNodeId, ended: item.status === 'ENDED' }));
  const start = performance.now();
  const result = layoutEpisodeRelationshipNetwork(graph.nodes, links);
  const elapsed = performance.now() - start;
  assertCards(result.positions, graph.nodes.length);
  assert.equal(graph.nodes.length, 50); assert.equal(links.length, 100);
  assert.deepEqual(result.positions, layoutEpisodeRelationshipNetwork([...graph.nodes].reverse(), [...links].reverse()).positions);
  context.diagnostic(JSON.stringify({ elapsedMs: Math.round(elapsed * 10) / 10,
    width: Math.max(...[...result.positions.values()].map(point => point.x)) + PERSON_WIDTH,
    height: Math.max(...[...result.positions.values()].map(point => point.y)) + PERSON_HEIGHT }));
});


test('independent high-degree anchors form a horizontal backbone with shared people between them', () => {
  const nodes: EpisodePerson[] = ['a', 'b', 'c', 'shared-ab', 'shared-bc',
    ...['a', 'b', 'c'].flatMap(hub => Array.from({ length: 5 }, (_, index) => `${hub}-person-${index}`)),
  ].map(id => ({ id, name: id }));
  const links = [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'),
    edge('a-shared', 'a', 'shared-ab'), edge('b-shared-a', 'b', 'shared-ab'),
    edge('c-shared', 'c', 'shared-bc'), edge('b-shared-c', 'b', 'shared-bc'),
    ...['a', 'b', 'c'].flatMap(hub => Array.from({ length: 5 }, (_, index) => edge(`${hub}-${index}`, hub, `${hub}-person-${index}`))),
  ];
  const result = layoutEpisodeRelationshipNetwork(nodes, links);
  assert.deepEqual(result.hubIds, new Set(['a', 'b', 'c']));
  const a = result.positions.get('a')!, b = result.positions.get('b')!, c = result.positions.get('c')!;
  assert.equal(a.y, b.y); assert.equal(b.y, c.y);
  assert.ok(b.x > Math.min(a.x, c.x) && b.x < Math.max(a.x, c.x), 'strongest anchor occupies the middle');
  for (const [id, left, right] of [['shared-ab', a, b], ['shared-bc', b, c]] as const) {
    const point = result.positions.get(id)!;
    assert.ok(point.x >= Math.min(left.x, right.x) && point.x <= Math.max(left.x, right.x));
    assert.notEqual(point.y, left.y, 'shared people leave the backbone open');
  }
  for (const hub of ['a', 'b', 'c']) {
    const anchor = result.positions.get(hub)!;
    const members = nodes.filter(node => node.id.startsWith(`${hub}-person-`)).map(node => result.positions.get(node.id)!);
    assert.ok(members.some(point => point.y < anchor.y) && members.some(point => point.y > anchor.y), 'fans use both sides');
    for (const point of members) for (const other of ['a', 'b', 'c'].filter(id => id !== hub)) {
      const unrelated = result.positions.get(other)!;
      assert.ok(Math.hypot(point.x - anchor.x, point.y - anchor.y) < Math.hypot(point.x - unrelated.x, point.y - unrelated.y));
    }
  }
  assertCards(result.positions, nodes.length);
});

test('reciprocal and parallel edges do not inflate an anchor or duplicate people', () => {
  const nodes = people(12), links = nodes.slice(1).map(node => edge(`spoke-${node.id}`, 'n000', node.id));
  const first = layoutEpisodeRelationshipNetwork(nodes, links);
  const repeated = layoutEpisodeRelationshipNetwork(nodes, [...links,
    ...Array.from({ length: 30 }, (_, index) => edge(`parallel-${index}`, index % 2 ? 'n001' : 'n002', index % 2 ? 'n002' : 'n001')),
  ]);
  assert.deepEqual(first.hubIds, new Set(['n000']));
  assert.deepEqual(repeated.hubIds, first.hubIds);
  assertCards(repeated.positions, nodes.length);
});
