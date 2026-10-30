import test from 'node:test';
import assert from 'node:assert/strict';
import { routeEpisodeRelationshipOverview } from '../src/app/components/catchhole/relationship/episode-relationship-overview-routing';
import { PERSON_HEIGHT, PERSON_WIDTH, type EpisodeConnection } from '../src/app/components/catchhole/relationship/episode-relationship-layout';
import type { EpisodeRoute, Point } from '../src/app/components/catchhole/relationship/episode-relationship-routing';

type Box = Point & { width: number; height: number };
const relation = (id: string, source: string, target: string): EpisodeConnection => ({ id, source, target,
  label: '함께 싸우며 쌓은 신뢰와 아직 남은 경계', summary: '원래 설명', direction: 'DIRECTED', ended: false });
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width - 1e-6 && a.x + a.width > b.x + 1e-6
  && a.y < b.y + b.height - 1e-6 && a.y + a.height > b.y + 1e-6;
function samples(route: EpisodeRoute) {
  const tokens = route.path.match(/[MLQC]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!;
  const points: Point[] = [];
  let index = 0, current = route.start;
  const point = () => ({ x: Number(tokens[index++]), y: Number(tokens[index++]) });
  while (index < tokens.length) {
    const command = tokens[index++], start = current;
    if (command === 'M') { current = point(); points.push(current); continue; }
    const control = point(), second = command === 'C' ? point() : control;
    const end = command === 'L' ? control : point();
    for (let step = 1; step <= 100; step++) {
      const t = step / 100, u = 1 - t;
      current = command === 'L' ? { x: u * start.x + t * end.x, y: u * start.y + t * end.y }
        : command === 'Q' ? { x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
          y: u * u * start.y + 2 * u * t * control.y + t * t * end.y }
          : { x: u ** 3 * start.x + 3 * u * u * t * control.x + 3 * u * t * t * second.x + t ** 3 * end.x,
            y: u ** 3 * start.y + 3 * u * u * t * control.y + 3 * u * t * t * second.y + t ** 3 * end.y };
      points.push(current);
    }
  }
  return points;
}
function assertGeometry(positions: Map<string, Point>, edges: EpisodeConnection[], clear = false) {
  const before = structuredClone({ positions, edges });
  const result = routeEpisodeRelationshipOverview(positions, edges);
  assert.deepEqual({ positions, edges }, before, 'never mutate IDs, direction, state or inputs');
  assert.deepEqual([...result.routes.keys()].sort(), edges.map(edge => edge.id).sort());
  const boxes: Box[] = [...positions.values()].map(point => ({ ...point, width: PERSON_WIDTH, height: PERSON_HEIGHT }));
  for (const edge of edges) {
    const route = result.routes.get(edge.id)!;
    const label = { x: route.label.x - route.labelWidth / 2, y: route.label.y - route.labelHeight / 2, width: route.labelWidth, height: route.labelHeight };
    assert.ok(boxes.every(box => !overlaps(label, box)), `${edge.id}: label/card overlap`); boxes.push(label);
    for (const [point, id] of [[route.start, edge.source], [route.end, edge.target]] as const) {
      const card = positions.get(id)!;
      assert.ok(point.x >= card.x - 1e-6 && point.x <= card.x + PERSON_WIDTH + 1e-6
        && point.y >= card.y - 1e-6 && point.y <= card.y + PERSON_HEIGHT + 1e-6, 'endpoint remains on its own card');
      assert.ok(Math.min(Math.abs(point.x - card.x), Math.abs(point.x - card.x - PERSON_WIDTH),
        Math.abs(point.y - card.y), Math.abs(point.y - card.y - PERSON_HEIGHT)) < 1e-6, 'endpoint lies on card boundary');
    }
    for (const point of [...samples(route), label, { x: label.x + label.width, y: label.y + label.height }]) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      assert.ok(point.x >= result.bounds.x && point.x <= result.bounds.x + result.bounds.width
        && point.y >= result.bounds.y && point.y <= result.bounds.y + result.bounds.height, 'geometry inside returned bounds');
    }
    if (clear) for (const [id, card] of positions) if (id !== edge.source && id !== edge.target) {
      assert.ok(samples(route).every(point => point.x <= card.x || point.x >= card.x + PERSON_WIDTH
        || point.y <= card.y || point.y >= card.y + PERSON_HEIGHT), `${edge.id}: penetrates unrelated card ${id}`);
    }
  }
  return result;
}

for (const target of [{ x: 650, y: 0 }, { x: 0, y: 450 }, { x: 600, y: 400 }]) {
  test(`five mixed parallel relations at ${target.x},${target.y} retain IDs and distinct curves`, () => {
    const edges = Array.from({ length: 5 }, (_, index) => ({ ...relation(`e${index}`, index === 2 ? 'b' : 'a', index === 2 ? 'a' : 'b'),
      direction: index === 0 || index === 4 ? 'MUTUAL' as const : index === 3 ? 'UNDIRECTED' as const : 'DIRECTED' as const, ended: index === 4 }));
    const result = assertGeometry(new Map([['a', { x: 0, y: 0 }], ['b', target]]), edges);
    assert.equal(new Set([...result.routes.values()].map(route => route.path)).size, 5);
  });
}

test('a straight connection bends around an unrelated card without a shared trunk', () => {
  const positions = new Map([['a', { x: 0, y: 180 }], ['b', { x: 1200, y: 180 }], ['obstacle', { x: 500, y: 180 }]]);
  const result = assertGeometry(positions, [relation('across', 'a', 'b')], true);
  assert.match(result.routes.get('across')!.path, /^M .+ Q /);
});

test('blocked curves use rounded diagonal corner paths without penetrating intervening cards', () => {
  const positions = new Map([['a', { x: 0, y: 0 }], ['b', { x: 1600, y: 0 }]]);
  for (let row = -12; row <= 12; row++) {
    positions.set(`wall-${row}`, { x: 700, y: row * PERSON_HEIGHT });
  }
  const result = assertGeometry(positions, [relation('across-wall', 'a', 'b')], true);
  assert.match(result.routes.get('across-wall')!.path, / L /, 'blocked single curves must use a visible corner detour');
});

test('reordering positions and API edges keeps the same overview geometry', () => {
  const positions = new Map([['a', { x: -500, y: 0 }], ['b', { x: 500, y: 0 }], ['c', { x: 0, y: 400 }]]);
  const edges = [relation('ab', 'a', 'b'), relation('ba', 'b', 'a'), relation('bc', 'b', 'c'), relation('ca', 'c', 'a')];
  assert.deepEqual(assertGeometry(new Map([...positions].reverse()), [...edges].reverse()), assertGeometry(positions, edges));
});

test('empty, isolated and overlapping dragged people keep finite geometry', () => {
  assert.equal(routeEpisodeRelationshipOverview(new Map(), []).routes.size, 0);
  assertGeometry(new Map([['solo', { x: -10, y: 100 }]]), []);
  assertGeometry(new Map([['a', { x: 0, y: 0 }], ['b', { x: 0, y: 0 }], ['c', { x: 0, y: 0 }]]),
    [relation('ab', 'a', 'b'), relation('bc', 'b', 'c'), relation('ca', 'c', 'a')]);
});

test('fifty cards and one hundred edges preserve every separate relationship and collision-free label', () => {
  const positions = new Map(Array.from({ length: 50 }, (_, index) => [`p${index}`, { x: index % 10 * 360, y: Math.floor(index / 10) * 300 }]));
  const edges = Array.from({ length: 100 }, (_, index) => relation(`e${String(index).padStart(3, '0')}`, `p${index % 50}`, `p${(index % 50 + (index < 50 ? 1 : 13)) % 50}`));
  assertGeometry(positions, edges);
});
