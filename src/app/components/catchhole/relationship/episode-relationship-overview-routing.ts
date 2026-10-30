import { PERSON_HEIGHT, PERSON_WIDTH, type EpisodeConnection } from './episode-relationship-layout';
import { episodeRelationshipLabelSize, type EpisodeRoute, type Point } from './episode-relationship-routing';

type Box = Point & { width: number; height: number };
type Curve = { path: string; start: Point; end: Point; points: Point[]; bounds: Box };
type Choice = { curve: Curve; label: Point; cardHits: number; score: number };
const GAP = 10;
const boxAt = (point: Point, width: number, height: number): Box => ({ x: point.x - width / 2, y: point.y - height / 2, width, height });
const overlap = (a: Box, b: Box, gap = 0) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x
  && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
const boundsOf = (points: Point[]): Box => {
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};
const corners = (box: Box) => [box, { x: box.x + box.width, y: box.y + box.height }];

/** Liang–Barsky clipping also detects horizontal / vertical passages through a card. */
function segmentHits(a: Point, b: Point, box: Box) {
  let low = 0, high = 1;
  for (const axis of ['x', 'y'] as const) {
    const delta = b[axis] - a[axis], minimum = box[axis], maximum = minimum + (axis === 'x' ? box.width : box.height);
    if (Math.abs(delta) < 1e-8) { if (a[axis] <= minimum || a[axis] >= maximum) return false; }
    else {
      const one = (minimum - a[axis]) / delta, two = (maximum - a[axis]) / delta;
      low = Math.max(low, Math.min(one, two)); high = Math.min(high, Math.max(one, two));
      if (high <= low) return false;
    }
  }
  return high > low;
}
function curveHits(curve: Curve, box: Box) {
  if (!overlap(curve.bounds, box)) return false;
  return curve.points.slice(1).some((point, index) => segmentHits(curve.points[index], point, box));
}
function border(center: Point, toward: Point) {
  const dx = toward.x - center.x, dy = toward.y - center.y;
  const scale = 1 / Math.max(Math.abs(dx) / (PERSON_WIDTH / 2), Math.abs(dy) / (PERSON_HEIGHT / 2), 1e-8);
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}
function labelPoints(curve: Curve) {
  const lengths = curve.points.map((point, index) => index ? Math.hypot(point.x - curve.points[index - 1].x, point.y - curve.points[index - 1].y) : 0);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  return Array.from({ length: 43 }, (_, index) => 0.08 + index * 0.02)
    .sort((a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5) || a - b).map(fraction => {
    let remaining = total * fraction;
    for (let index = 1; index < curve.points.length; index++) {
      if (remaining <= lengths[index]) {
        const a = curve.points[index - 1], b = curve.points[index], t = remaining / Math.max(lengths[index], 1e-8);
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      remaining -= lengths[index];
    }
    return curve.end;
  });
}
function makeCurve(source: Point, target: Point, normal: Point, bend: number, fraction = 0.5): Curve {
  if (Math.hypot(target.x - source.x, target.y - source.y) < 1) {
    // A user may drag two people onto each other. Keep a finite visible loop and both identities.
    const start = { x: source.x + PERSON_WIDTH / 2, y: source.y }, end = { x: target.x, y: target.y - PERSON_HEIGHT / 2 };
    const reach = 130 + Math.abs(bend), one = { x: start.x + reach, y: start.y }, two = { x: end.x, y: end.y - reach };
    const points = Array.from({ length: 25 }, (_, index) => {
      const t = index / 24, u = 1 - t;
      return { x: u ** 3 * start.x + 3 * u ** 2 * t * one.x + 3 * u * t ** 2 * two.x + t ** 3 * end.x,
        y: u ** 3 * start.y + 3 * u ** 2 * t * one.y + 3 * u * t ** 2 * two.y + t ** 3 * end.y };
    });
    return { start, end, points, bounds: boundsOf([start, end, one, two]),
      path: `M ${start.x} ${start.y} C ${one.x} ${one.y} ${two.x} ${two.y} ${end.x} ${end.y}` };
  }
  const control = { x: source.x + (target.x - source.x) * fraction + normal.x * bend * 2,
    y: source.y + (target.y - source.y) * fraction + normal.y * bend * 2 };
  const start = border(source, control), end = border(target, control);
  const at = (t: number) => ({ x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
    y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y });
  const points = Array.from({ length: 25 }, (_, index) => at(index / 24));
  const extrema = [start, end];
  for (const axis of ['x', 'y'] as const) {
    const t = (start[axis] - control[axis]) / (start[axis] - 2 * control[axis] + end[axis]);
    if (t > 0 && t < 1) extrema.push(at(t));
  }
  return { start, end, points, bounds: boundsOf(extrema), path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}` };
}

/** Only blocked curves use this visibility graph. Its diagonals skirt card corners, not grid lanes. */
function visibilityRouter(cards: Map<string, Box>) {
  const obstacles = [...cards].map(([id, box]) => ({ id, box: { x: box.x - 24, y: box.y - 24, width: box.width + 48, height: box.height + 48 } }));
  let graph: { vertices: Point[]; neighbours: { index: number; distance: number }[][] } | undefined;
  const visible = (a: Point, b: Point, excluded: string[] = []) => {
    const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y);
    return !obstacles.some(({ id, box }) => !excluded.includes(id) && left < box.x + box.width && right > box.x
      && top < box.y + box.height && bottom > box.y && segmentHits(a, b, box));
  };
  return (sourceId: string, targetId: string, source: Point, target: Point, labels: Box[]): Curve | undefined => {
    if (!graph) {
      const vertices = obstacles.flatMap(({ box }) => [box, { x: box.x + box.width, y: box.y },
        { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height }])
        .filter(point => !obstacles.some(({ box }) => point.x > box.x && point.x < box.x + box.width && point.y > box.y && point.y < box.y + box.height));
      const neighbours: { index: number; distance: number }[][] = vertices.map(() => []);
      for (let a = 0; a < vertices.length; a++) for (let b = a + 1; b < vertices.length; b++) {
        if (!visible(vertices[a], vertices[b])) continue;
        const distance = Math.hypot(vertices[a].x - vertices[b].x, vertices[a].y - vertices[b].y);
        neighbours[a].push({ index: b, distance }); neighbours[b].push({ index: a, distance });
      }
      graph = { vertices, neighbours };
    }
    const { vertices, neighbours } = graph, count = vertices.length;
    const distances = Array<number>(count).fill(Infinity), previous = Array<number>(count).fill(-1), visited = new Set<number>();
    const labelCost = (a: Point, b: Point) => {
      const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y);
      let hits = 0;
      for (const box of labels) if (left < box.x + box.width && right > box.x && top < box.y + box.height && bottom > box.y && segmentHits(a, b, box)) hits++;
      return hits * 1200;
    };
    for (let index = 0; index < count; index++) if (visible(source, vertices[index], [sourceId])) {
      distances[index] = Math.hypot(vertices[index].x - source.x, vertices[index].y - source.y) + labelCost(source, vertices[index]);
    }
    let finish = -1, total = Infinity;
    for (let iteration = 0; iteration < count; iteration++) {
      let current = -1;
      for (let index = 0; index < count; index++) if (!visited.has(index) && (current < 0 || distances[index] < distances[current])) current = index;
      if (current < 0 || !Number.isFinite(distances[current]) || distances[current] >= total) break;
      visited.add(current);
      if (visible(vertices[current], target, [targetId])) {
        const cost = distances[current] + Math.hypot(vertices[current].x - target.x, vertices[current].y - target.y) + labelCost(vertices[current], target);
        if (cost < total) { total = cost; finish = current; }
      }
      for (const neighbour of neighbours[current]) {
        if (visited.has(neighbour.index)) continue;
        const cost = distances[current] + neighbour.distance + labelCost(vertices[current], vertices[neighbour.index]);
        if (cost < distances[neighbour.index]) { distances[neighbour.index] = cost; previous[neighbour.index] = current; }
      }
    }
    if (finish < 0) return undefined;
    const waypoints: Point[] = [target];
    for (let index = finish; index >= 0; index = previous[index]) waypoints.unshift(vertices[index]);
    waypoints.unshift(source);
    waypoints[0] = border(source, waypoints[1]); waypoints[waypoints.length - 1] = border(target, waypoints[waypoints.length - 2]);
    const start = waypoints[0], end = waypoints[waypoints.length - 1], points = [start];
    let path = `M ${start.x} ${start.y}`;
    for (let index = 1; index < waypoints.length - 1; index++) {
      const a = waypoints[index - 1], corner = waypoints[index], b = waypoints[index + 1];
      const before = Math.hypot(corner.x - a.x, corner.y - a.y), after = Math.hypot(b.x - corner.x, b.y - corner.y);
      const radius = Math.min(16, before / 3, after / 3);
      const entry = { x: corner.x + (a.x - corner.x) * radius / before, y: corner.y + (a.y - corner.y) * radius / before };
      const exit = { x: corner.x + (b.x - corner.x) * radius / after, y: corner.y + (b.y - corner.y) * radius / after };
      path += ` L ${entry.x} ${entry.y} Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`; points.push(entry);
      for (let step = 1; step <= 8; step++) {
        const t = step / 8, u = 1 - t;
        points.push({ x: u * u * entry.x + 2 * u * t * corner.x + t * t * exit.x, y: u * u * entry.y + 2 * u * t * corner.y + t * t * exit.y });
      }
    }
    path += ` L ${end.x} ${end.y}`; points.push(end);
    return { path, start, end, points, bounds: boundsOf(waypoints) };
  };
}

/** Overview-only curves: keep each relationship separate without shared trunks or maze-like turns. */
export function routeEpisodeRelationshipOverview(positions: Map<string, Point>, edges: EpisodeConnection[], lanes: Map<string, number> = new Map()) {
  const cards = new Map([...positions].sort(([a], [b]) => a.localeCompare(b)).map(([id, point]) => [id, { ...point, width: PERSON_WIDTH, height: PERSON_HEIGHT }]));
  const occupied = [...cards.values()], placed: Curve[] = [];
  const detourAroundCards = visibilityRouter(cards);
  const routes = new Map<string, EpisodeRoute>();
  const points = occupied.flatMap(corners);
  const valid = edges.filter(edge => edge.source !== edge.target && cards.has(edge.source) && cards.has(edge.target));
  const pairs = new Map<string, EpisodeConnection[]>();
  const pairKey = (edge: EpisodeConnection) => JSON.stringify([edge.source, edge.target].sort());
  for (const edge of valid) pairs.set(pairKey(edge), [...pairs.get(pairKey(edge)) ?? [], edge]);
  const center = (id: string) => { const card = cards.get(id)!; return { x: card.x + PERSON_WIDTH / 2, y: card.y + PERSON_HEIGHT / 2 }; };
  const length = (edge: EpisodeConnection) => { const a = center(edge.source), b = center(edge.target); return Math.hypot(b.x - a.x, b.y - a.y); };
  // Short fan spokes get first choice of label space; long cross-cluster links route around them.
  const ordered = [...pairs.values()].sort((a, b) => length(a[0]) - length(b[0]) || pairKey(a[0]).localeCompare(pairKey(b[0])));
  for (const group of ordered) {
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const laneOf = (edge: EpisodeConnection) => lanes.get(edge.id) ?? sorted.indexOf(edge) - (sorted.length - 1) / 2;
    for (const edge of [...sorted].sort((a, b) => Math.abs(laneOf(a)) - Math.abs(laneOf(b)) || a.id.localeCompare(b.id))) {
      const source = center(edge.source), target = center(edge.target), distance = Math.max(1, length(edge));
      const orientation = edge.source.localeCompare(edge.target) < 0 ? 1 : -1;
      const normal = { x: -(target.y - source.y) / distance * orientation, y: (target.x - source.x) / distance * orientation || (distance === 1 ? 1 : 0) };
      const size = episodeRelationshipLabelSize(edge);
      const spacing = Math.abs(normal.x) * (size.width + GAP) + Math.abs(normal.y) * (size.height + GAP);
      const preferred = laneOf(edge) * spacing;
      const step = Math.max(48, Math.min(120, distance * 0.12));
      const bends = [preferred, ...[1, -1, 2, -2, 3, -3, 4, -4].map(multiplier => preferred + multiplier * step)];
      // Keep a small margin because sampled curves otherwise miss shallow corner crossings.
      const otherCards = [...cards].filter(([id]) => id !== edge.source && id !== edge.target)
        .map(([, card]) => ({ x: card.x - 4, y: card.y - 4, width: card.width + 8, height: card.height + 8 }));
      let best: Choice | undefined;
      let safest: { curve: Curve; cardHits: number; score: number } | undefined;
      const consider = (curve: Curve, extraCost = 0) => {
        const cardHits = otherCards.filter(card => curveHits(curve, card)).length;
        const cost = occupied.slice(cards.size).filter(box => curveHits(curve, box)).length * 10000 + extraCost;
        if (!safest || cardHits < safest.cardHits || (cardHits === safest.cardHits && cost < safest.score)) safest = { curve, cardHits, score: cost };
        if (best && (cardHits > best.cardHits || (cardHits === best.cardHits && cost > best.score))) return;
        for (const [index, label] of labelPoints(curve).entries()) {
          const box = boxAt(label, size.width, size.height);
          if (occupied.some(other => overlap(box, other, GAP))) continue;
          const score = cost + placed.filter(previous => curveHits(previous, box)).length * 10000 + index;
          if (!best || cardHits < best.cardHits || (cardHits === best.cardHits && score < best.score)) best = { curve, label, cardHits, score };
        }
      };
      const candidates = [
        ...bends.map(bend => ({ bend, fraction: 0.5, detour: false })),
        ...[0.25, 0.75].flatMap(fraction => [2, -2, 4, -4, 6, -6].map(multiplier => ({ bend: preferred + multiplier * step, fraction, detour: true }))),
      ];
      for (const { bend, fraction, detour } of candidates) {
        if (detour && best?.cardHits === 0) break;
        const curve = makeCurve(source, target, normal, bend, fraction);
        consider(curve, Math.abs(bend - preferred) * 0.1 + Math.abs(fraction - 0.5) * distance * 0.03);
        if (best?.cardHits === 0 && best.score === 0) break;
      }
      if (!best || best.cardHits > 0) {
        const curve = detourAroundCards(edge.source, edge.target, source, target, occupied.slice(cards.size));
        if (curve) consider(curve);
      }
      let labelLeaderPath: string | undefined;
      if (!best || (safest && safest.cardHits < best.cardHits)) {
        // Never discard a card-safe route merely because its label needs a nearby free space.
        const curve = safest?.curve ?? makeCurve(source, target, normal, preferred), origin = labelPoints(curve)[0];
        let label = origin, anchor = curve.start, found = false;
        const anchors = [...curve.points, ...labelPoints(curve)];
        for (let step = 1; step <= 512; step++) {
          const ring = Math.ceil(step / 8), angle = step % 8 * Math.PI / 4;
          const candidate = { x: origin.x + Math.cos(angle) * ring * (size.width + GAP), y: origin.y + Math.sin(angle) * ring * (size.height + GAP) };
          if (occupied.some(other => overlap(boxAt(candidate, size.width, size.height), other, GAP))) continue;
          label = candidate;
          const visibleAnchor = [...anchors].sort((a, b) => Math.hypot(a.x - label.x, a.y - label.y) - Math.hypot(b.x - label.x, b.y - label.y))
            .find(point => !occupied.some(box => segmentHits(point, label, box)));
          if (visibleAnchor) { anchor = visibleAnchor; found = true; break; }
        }
        // Overlapping dragged cards can cover every anchor. Bound the search and preserve finite geometry.
        if (!found) {
          const right = Math.max(...occupied.map(box => box.x + box.width));
          label = { x: right + GAP + size.width / 2, y: origin.y };
        }
        labelLeaderPath = `M ${anchor.x} ${anchor.y} L ${label.x} ${label.y}`;
        best = { curve, label, cardHits: otherCards.filter(card => curveHits(curve, card)).length, score: Infinity };
      }
      const { curve, label } = best, box = boxAt(label, size.width, size.height);
      occupied.push(box); placed.push(curve); points.push(...corners(box), ...corners(curve.bounds));
      routes.set(edge.id, { path: curve.path, start: curve.start, end: curve.end, label, labelWidth: size.width, labelHeight: size.height, ...(labelLeaderPath ? { labelLeaderPath } : {}) });
    }
  }
  const bounds = points.length ? boundsOf(points) : { x: 0, y: 0, width: 0, height: 0 };
  return { routes, bounds: { x: bounds.x - 12, y: bounds.y - 12, width: bounds.width + 24, height: bounds.height + 24 } };
}
