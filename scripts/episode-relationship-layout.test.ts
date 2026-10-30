import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutEpisodeRelationships, PERSON_WIDTH, PERSON_HEIGHT, type EpisodeConnection } from '../src/app/components/catchhole/relationship/episode-relationship-layout';
import { routeEpisodeRelationships, type Point } from '../src/app/components/catchhole/relationship/episode-relationship-routing';

const edge = (id: string, source: string, target: string): EpisodeConnection => ({ id, source, target, label: '신뢰', summary: '', direction: 'DIRECTED', ended: false });

test('dense star plus disconnected components preserve every node without card overlap', () => {
  const people = Array.from({ length: 35 }, (_, index) => ({ id: String(index), name: `인물 ${index}` }));
  const connections = people.slice(1, 30).map(person => edge(`r${person.id}`, '0', person.id));
  const { positions } = layoutEpisodeRelationships(people, connections, '0');
  assert.equal(positions.size, people.length);
  const cards = [...positions.values()];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    assert.ok(Math.abs(cards[i].x - cards[j].x) >= PERSON_WIDTH || Math.abs(cards[i].y - cards[j].y) >= PERSON_HEIGHT, `overlap ${i}, ${j}`);
  }
});

test('layout is deterministic despite API node and edge ordering', () => {
  const people = ['c', 'b', 'a', 'd'].map(id => ({ id, name: id }));
  const edges = [edge('1', 'a', 'b'), edge('2', 'b', 'c')];
  const first = layoutEpisodeRelationships(people, edges);
  const second = layoutEpisodeRelationships([...people].reverse(), [...edges].reverse());
  assert.deepEqual(first.positions, second.positions);
});

test('reciprocal attitudes and another relation retain distinct lanes and IDs', () => {
  const people = ['a', 'b'].map(id => ({ id, name: id }));
  const edges = [edge('trust', 'a', 'b'), edge('fear', 'b', 'a'), edge('colleague', 'a', 'b')];
  const { lanes } = layoutEpisodeRelationships(people, edges);
  assert.equal(lanes.size, 3);
  assert.equal(new Set(lanes.values()).size, 3);
  assert.deepEqual(edges.map(item => item.direction), ['DIRECTED', 'DIRECTED', 'DIRECTED']);
});

type Box = Point & { width: number; height: number };
const EPSILON = 1e-7;

function intersects(a: Box, b: Box) {
  return a.x < b.x + b.width - EPSILON && a.x + a.width > b.x + EPSILON
    && a.y < b.y + b.height - EPSILON && a.y + a.height > b.y + EPSILON;
}

function assertContains(bounds: Box, point: Point, message: string) {
  assert.ok(point.x >= bounds.x - EPSILON && point.x <= bounds.x + bounds.width + EPSILON
    && point.y >= bounds.y - EPSILON && point.y <= bounds.y + bounds.height + EPSILON, message);
}

function assertRouteGeometry(positions: Map<string, Point>, routed: ReturnType<typeof routeEpisodeRelationships>) {
  const cards = [...positions].map(([id, point]) => ({ id, ...point, width: PERSON_WIDTH, height: PERSON_HEIGHT }));
  const labels: Array<Box & { id: string }> = [];
  assert.ok(Object.values(routed.bounds).every(Number.isFinite), 'bounds must be finite');
  assert.ok(routed.bounds.width > 0 && routed.bounds.height > 0, 'bounds must have positive dimensions');
  for (const card of cards) {
    assertContains(routed.bounds, card, `card ${card.id} top-left outside bounds`);
    assertContains(routed.bounds, { x: card.x + card.width, y: card.y + card.height }, `card ${card.id} bottom-right outside bounds`);
  }
  for (const [id, route] of routed.routes) {
    assert.ok([route.label.x, route.label.y, route.labelWidth, route.labelHeight,
      route.start.x, route.start.y, route.end.x, route.end.y].every(Number.isFinite), `${id}: finite geometry`);
    assert.ok(route.labelWidth > 0 && route.labelHeight > 0, `${id}: positive label dimensions`);
    const label = { id, x: route.label.x - route.labelWidth / 2, y: route.label.y - route.labelHeight / 2,
      width: route.labelWidth, height: route.labelHeight };
    for (const card of cards) assert.ok(!intersects(label, card), `${id}: label overlaps card ${card.id}`);
    for (const previous of labels) assert.ok(!intersects(label, previous), `${id}: label overlaps ${previous.id}`);
    labels.push(label);
    assertContains(routed.bounds, label, `${id}: label top-left outside bounds`);
    assertContains(routed.bounds, { x: label.x + label.width, y: label.y + label.height }, `${id}: label bottom-right outside bounds`);

    // Check the rendered quadratic, not its control polygon: a control point can lie outside the visible curve.
    const path = route.path.match(/^M ([^ ]+) ([^ ]+) Q ([^ ]+) ([^ ]+) ([^ ]+) ([^ ]+)$/);
    assert.ok(path, `${id}: quadratic SVG path`);
    const [sx, sy, cx, cy, ex, ey] = path.slice(1).map(Number);
    assert.ok([sx, sy, cx, cy, ex, ey].every(Number.isFinite), `${id}: finite SVG path`);
    assert.deepEqual({ x: sx, y: sy }, route.start);
    assert.deepEqual({ x: ex, y: ey }, route.end);
    for (let step = 0; step <= 100; step++) {
      const t = step / 100;
      const point = { x: (1 - t) ** 2 * sx + 2 * (1 - t) * t * cx + t ** 2 * ex,
        y: (1 - t) ** 2 * sy + 2 * (1 - t) * t * cy + t ** 2 * ey };
      assertContains(routed.bounds, point, `${id}: curve at ${t} outside bounds`);
    }
  }
}

function longRelations(count: number): EpisodeConnection[] {
  return Array.from({ length: count }, (_, index) => ({
    ...edge(`relation-${index}`, index % 2 === 0 ? 'a' : 'b', index % 2 === 0 ? 'b' : 'a'),
    label: ['위험한 상황에서 함께 싸우며 쌓은 신뢰', '상대의 숨겨진 의도를 강하게 경계함', '목적을 이루기 위해 함께 행동하는 동료',
      '서로 다른 판단으로 생겨난 갈등과 불신', '오랜 사건을 겪으며 유지해 온 협력'][index],
    direction: index === 2 ? 'MUTUAL' : index === 3 ? 'UNDIRECTED' : 'DIRECTED',
    ended: index === 4,
  }));
}

for (const [orientation, target] of [
  ['horizontal', { x: 460, y: 0 }],
  ['vertical', { x: 0, y: 340 }],
  ['diagonal', { x: 360, y: 280 }],
] as const) {
  for (const count of [3, 4, 5]) test(`${count} long ${orientation} relations keep labels clear of cards and each other inside bounds`, () => {
    const positions = new Map<string, Point>([['a', { x: 0, y: 0 }], ['b', target]]);
    const relations = longRelations(count);
    const { lanes } = layoutEpisodeRelationships([{ id: 'a', name: '아라' }, { id: 'b', name: '보라' }], relations);
    const routed = routeEpisodeRelationships(positions, relations, lanes);
    assert.equal(routed.routes.size, count);
    assertRouteGeometry(positions, routed);
  });
}

test('reciprocal directed and mutual routes preserve their IDs and source/target endpoints without changing meaning', () => {
  const positions = new Map<string, Point>([['a', { x: -240, y: -100 }], ['b', { x: 280, y: 220 }]]);
  const relations = longRelations(3);
  const original = structuredClone(relations);
  const { lanes } = layoutEpisodeRelationships([{ id: 'a', name: '아라' }, { id: 'b', name: '보라' }], relations);
  const routed = routeEpisodeRelationships(positions, relations, lanes);
  assert.deepEqual([...routed.routes.keys()].sort(), relations.map(relation => relation.id).sort());
  assert.deepEqual(relations, original, 'routing must not reverse, merge, or relabel server relationships');
  assert.equal(new Set([...routed.routes.values()].map(route => route.path)).size, 3, 'each relation keeps a distinct selectable curve');
  const onBorder = (point: Point, card: Point) => {
    const within = point.x >= card.x - EPSILON && point.x <= card.x + PERSON_WIDTH + EPSILON
      && point.y >= card.y - EPSILON && point.y <= card.y + PERSON_HEIGHT + EPSILON;
    const boundary = Math.min(Math.abs(point.x - card.x), Math.abs(point.x - card.x - PERSON_WIDTH),
      Math.abs(point.y - card.y), Math.abs(point.y - card.y - PERSON_HEIGHT)) < EPSILON;
    return within && boundary;
  };
  for (const relation of relations) {
    const route = routed.routes.get(relation.id)!;
    assert.ok(onBorder(route.start, positions.get(relation.source)!), `${relation.id}: starts at its source card`);
    assert.ok(onBorder(route.end, positions.get(relation.target)!), `${relation.id}: ends at its target card`);
  }
  assertRouteGeometry(positions, routed);
});

test('routing is deterministic across API node, relation and lane ordering with multiple pairs and an intervening card', () => {
  const people = ['a', 'b', 'c'].map(id => ({ id, name: id }));
  const positions = new Map<string, Point>([['a', { x: -300, y: 0 }], ['b', { x: 300, y: 0 }], ['c', { x: 0, y: 0 }]]);
  const relations = [...longRelations(5), { ...edge('other-pair', 'c', 'b'), label: '또 다른 인물과 함께 행동하는 동료 관계', direction: 'MUTUAL' as const }];
  const firstLanes = layoutEpisodeRelationships(people, relations).lanes;
  const reversed = [...relations].reverse();
  const secondLanes = layoutEpisodeRelationships([...people].reverse(), reversed).lanes;
  const first = routeEpisodeRelationships(positions, relations, firstLanes);
  const second = routeEpisodeRelationships(new Map([...positions].reverse()), reversed, new Map([...secondLanes].reverse()));
  assert.deepEqual(first, second);
  assert.equal(first.routes.size, relations.length);
  assertRouteGeometry(positions, first);
});

test('coincident dragged cards still produce finite, separated labels and bounded routes', () => {
  const positions = new Map<string, Point>([['a', { x: -90, y: 45 }], ['b', { x: -90, y: 45 }]]);
  const relations = longRelations(5);
  const { lanes } = layoutEpisodeRelationships([{ id: 'a', name: '아라' }, { id: 'b', name: '보라' }], relations);
  const routed = routeEpisodeRelationships(positions, relations, lanes);
  assert.equal(routed.routes.size, 5);
  assertRouteGeometry(positions, routed);
  assert.deepEqual(routed, routeEpisodeRelationships(positions, relations, lanes));
});

test('routing bends around an unrelated card between two people', () => {
  const people = ['a', 'b', 'obstacle'].map(id => ({ id, name: id }));
  const positions = new Map<string, Point>([['a', { x: 0, y: 0 }], ['b', { x: 700, y: 0 }], ['obstacle', { x: 350, y: 0 }]]);
  const relations = [edge('trust', 'a', 'b')];
  const routed = routeEpisodeRelationships(positions, relations, layoutEpisodeRelationships(people, relations).lanes);
  const numbers = routed.routes.get('trust')!.path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number);
  const [sx, sy, cx, cy, ex, ey] = numbers;
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const x = (1 - t) ** 2 * sx + 2 * (1 - t) * t * cx + t ** 2 * ex;
    const y = (1 - t) ** 2 * sy + 2 * (1 - t) * t * cy + t ** 2 * ey;
    assert.ok(!(x > 350 && x < 350 + PERSON_WIDTH && y > 0 && y < PERSON_HEIGHT), 'unrelated person must not be crossed');
  }
});

test('focused layout gives the busiest pair a horizontal route while keeping all neighbors', () => {
  const people = ['center', 'busy', 'one', 'two', 'three'].map(id => ({ id, name: id }));
  const relations = [0, 1, 2, 3, 4].map(i => edge(`busy-${i}`, 'center', 'busy'))
    .concat(['one', 'two', 'three'].map(id => edge(id, 'center', id)));
  const { positions } = layoutEpisodeRelationships(people, relations, 'center');
  assert.equal(positions.size, people.length);
  assert.ok(Math.abs(positions.get('center')!.y - positions.get('busy')!.y) < 1e-7);
  assert.ok(positions.get('busy')!.x < positions.get('center')!.x);
  assert.deepEqual(positions, layoutEpisodeRelationships([...people].reverse(), [...relations].reverse(), 'center').positions);
});

test('one heavily connected focus neighbor does not squeeze the remaining cards together', () => {
  const people = Array.from({ length: 11 }, (_, index) => ({ id: String(index), name: `인물 ${index}` }));
  const connections = Array.from({ length: 91 }, (_, index) => edge(`busy-${index}`, '0', '1'));
  connections.push(...people.slice(2).map(person => edge(`other-${person.id}`, '0', person.id)));
  const cards = [...layoutEpisodeRelationships(people, connections, '0').positions.values()];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    assert.ok(Math.abs(cards[i].x - cards[j].x) >= PERSON_WIDTH || Math.abs(cards[i].y - cards[j].y) >= PERSON_HEIGHT);
  }
});
