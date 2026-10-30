import test from 'node:test';
import assert from 'node:assert/strict';
import { routeEpisodeRelationshipsOrthogonally } from '../src/app/components/catchhole/relationship/episode-relationship-orthogonal';
import { PERSON_HEIGHT, PERSON_WIDTH, type EpisodeConnection } from '../src/app/components/catchhole/relationship/episode-relationship-layout';
import type { Point } from '../src/app/components/catchhole/relationship/episode-relationship-routing';

type Box = Point & { width: number; height: number };
const relation = (id: string, source: string, target: string): EpisodeConnection => ({ id, source, target,
  label: '위험한 상황에서 함께 싸우며 쌓은 신뢰', summary: '설명', direction: 'DIRECTED', ended: false });
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width - 1e-6 && a.x + a.width > b.x + 1e-6
  && a.y < b.y + b.height - 1e-6 && a.y + a.height > b.y + 1e-6;
function penetrates(a: Point, b: Point, box: Box) {
  if (a.x === b.x) return a.x > box.x + 1e-6 && a.x < box.x + box.width - 1e-6 && Math.max(a.y, b.y) > box.y + 1e-6 && Math.min(a.y, b.y) < box.y + box.height - 1e-6;
  return a.y > box.y + 1e-6 && a.y < box.y + box.height - 1e-6 && Math.max(a.x, b.x) > box.x + 1e-6 && Math.min(a.x, b.x) < box.x + box.width - 1e-6;
}
function onBorder(point: Point, card: Point) {
  return point.x >= card.x && point.x <= card.x + PERSON_WIDTH && point.y >= card.y && point.y <= card.y + PERSON_HEIGHT
    && (point.x === card.x || point.x === card.x + PERSON_WIDTH || point.y === card.y || point.y === card.y + PERSON_HEIGHT);
}
function assertGeometry(positions: Map<string, Point>, edges: EpisodeConnection[], clear = true) {
  const original = structuredClone({ positions, edges });
  const result = routeEpisodeRelationshipsOrthogonally(positions, edges);
  assert.deepEqual({ positions, edges }, original, 'positions and relationship semantics remain unchanged');
  assert.deepEqual([...result.routes.keys()].sort(), edges.map(edge => edge.id).sort());
  const boxes: Box[] = [...positions.values()].map(point => ({ ...point, width: PERSON_WIDTH, height: PERSON_HEIGHT }));
  const contains = (point: Point) => assert.ok(point.x >= result.bounds.x && point.x <= result.bounds.x + result.bounds.width
    && point.y >= result.bounds.y && point.y <= result.bounds.y + result.bounds.height, 'point contained in bounds');
  for (const edge of edges) {
    const route = result.routes.get(edge.id)!;
    assert.ok(onBorder(route.start, positions.get(edge.source)!));
    assert.ok(onBorder(route.end, positions.get(edge.target)!));
    if (clear) assert.equal(route.obstacleFallback, false, `bounded routing fallback ${edge.id}`);
    for (const box of boxes) assert.ok(!overlaps(route.labelRect, box), `${edge.id} label overlap`);
    boxes.push(route.labelRect);
    contains(route.labelRect); contains({ x: route.labelRect.x + route.labelWidth, y: route.labelRect.y + route.labelHeight });
    for (const section of route.sections) for (let index = 0; index < section.length; index++) {
      const point = section[index]; contains(point);
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      if (!index) continue;
      const previous = section[index - 1];
      assert.ok(previous.x === point.x || previous.y === point.y, 'all route segments orthogonal');
      if (clear) for (const [id, card] of positions) if (id !== edge.source && id !== edge.target) {
        assert.ok(!penetrates(previous, point, { ...card, width: PERSON_WIDTH, height: PERSON_HEIGHT }), `${edge.id} crosses unrelated card ${id}`);
      }
    }
  }
  return result;
}

for (const target of [{ x: 600, y: 0 }, { x: 0, y: 420 }, { x: 500, y: 350 }]) {
  test(`five parallel mixed directions at ${target.x},${target.y} retain separate labels and source/target endpoints`, () => {
    const positions = new Map([['a', { x: 0, y: 0 }], ['b', target]]);
    const edges = Array.from({ length: 5 }, (_, index) => ({ ...relation(`e${index}`, index === 2 ? 'b' : 'a', index === 2 ? 'a' : 'b'),
      direction: index === 0 || index === 4 ? 'MUTUAL' as const : index === 3 ? 'UNDIRECTED' as const : 'DIRECTED' as const, ended: index === 4 }));
    const result = assertGeometry(positions, edges);
    assert.equal(new Set([...result.routes.values()].map(route => route.path)).size, 5);
  });
}

test('a connection detours around unrelated cards between its endpoints', () => {
  const positions = new Map([['source', { x: 0, y: 180 }], ['target', { x: 1200, y: 180 }],
    ['middle', { x: 500, y: 180 }], ['above', { x: 500, y: -40 }], ['below', { x: 500, y: 400 }]]);
  assertGeometry(positions, [relation('across', 'source', 'target'), relation('vertical', 'above', 'below')]);
});

test('coordinate insertion and API relationship order do not change geometry', () => {
  const positions = new Map([['a', { x: -400, y: -180 }], ['b', { x: 400, y: 0 }], ['c', { x: 0, y: 420 }]]);
  const edges = [relation('ab', 'a', 'b'), relation('bc', 'b', 'c'), relation('ca', 'c', 'a')];
  const first = assertGeometry(positions, edges);
  const second = assertGeometry(new Map([...positions].reverse()), [...edges].reverse());
  assert.deepEqual(second, first);
});

test('empty and isolated inputs remain finite and invent no routes', () => {
  assert.deepEqual(routeEpisodeRelationshipsOrthogonally(new Map(), []), { routes: new Map(), bounds: { x: 0, y: 0, width: 24, height: 24 } });
  const result = routeEpisodeRelationshipsOrthogonally(new Map([['solo', { x: 100, y: -100 }]]), []);
  assert.equal(result.routes.size, 0); assert.ok(Object.values(result.bounds).every(Number.isFinite));
});

test('overlapping dragged nodes retain all connections and expose bounded fallback when needed', () => {
  const positions = new Map([['a', { x: 0, y: 0 }], ['b', { x: 0, y: 0 }], ['c', { x: 0, y: 0 }]]);
  const edges = [relation('a-b', 'a', 'b'), relation('b-c', 'b', 'c')];
  assertGeometry(positions, edges, false);
});

test('fifty fixed cards and one hundred relationships keep all IDs without card penetration', () => {
  const positions = new Map(Array.from({ length: 50 }, (_, index) => [`p${index}`, { x: index % 10 * 320, y: Math.floor(index / 10) * 240 }]));
  const edges = Array.from({ length: 100 }, (_, index) => relation(`e${String(index).padStart(3, '0')}`, `p${index % 50}`, `p${(index % 50 + (index < 50 ? 1 : 13)) % 50}`));
  const result = assertGeometry(positions, edges);
  // Both endpoint searches meet at the label. Reserving the first half during the
  // second search prevents a long shared tail that would look like a dead-end T.
  // Tiny grid/card connector reversals and the connector hidden by the label remain valid.
  for (const [id, route] of result.routes) {
    const segments = route.sections.flatMap(points => points.slice(1).map((b, index) => ({ a: points[index], b })));
    for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
      const one = segments[i], two = segments[j], horizontal = one.a.y === one.b.y;
      if (horizontal !== (two.a.y === two.b.y)) continue;
      const axis = horizontal ? 'x' : 'y', crossAxis = horizontal ? 'y' : 'x';
      if (one.a[crossAxis] !== two.a[crossAxis]) continue;
      const low = Math.max(Math.min(one.a[axis], one.b[axis]), Math.min(two.a[axis], two.b[axis]));
      const high = Math.min(Math.max(one.a[axis], one.b[axis]), Math.max(two.a[axis], two.b[axis]));
      let repeated = Math.max(0, high - low);
      const box = route.labelRect, width = horizontal ? box.width : box.height, height = horizontal ? box.height : box.width;
      if (one.a[crossAxis] >= box[crossAxis] - 8 && one.a[crossAxis] <= box[crossAxis] + height + 8) {
        repeated -= Math.max(0, Math.min(high, box[axis] + width + 8) - Math.max(low, box[axis] - 8));
      }
      assert.ok(repeated <= 32, `${id}: retraces ${repeated}px outside its label`);
    }
  }
});
