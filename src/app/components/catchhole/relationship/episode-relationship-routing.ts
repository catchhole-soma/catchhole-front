import { PERSON_HEIGHT, PERSON_WIDTH, type EpisodeConnection } from './episode-relationship-layout';

export type Point = { x: number; y: number };
type Box = Point & { width: number; height: number };
export type EpisodeRoute = {
  path: string; label: Point; labelWidth: number; labelHeight: number; start: Point; end: Point;
  labelLeaderPath?: string;
};

const GAP = 16;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width + GAP && a.x + a.width + GAP > b.x
  && a.y < b.y + b.height + GAP && a.y + a.height + GAP > b.y;
const labelBox = (point: Point, width: number, height: number): Box =>
  ({ x: point.x - width / 2, y: point.y - height / 2, width, height });

/** Fixed CSS bounds keep routing independent of fonts loading and zoom. Long labels use two lines. */
export function episodeRelationshipLabelSize(edge: EpisodeConnection) {
  const textWidth = Array.from(edge.label).reduce((width, char) => width + ((char.codePointAt(0) ?? 0) > 127 ? 12 : 7.5), 0)
    + (edge.ended ? 34 : 0);
  return { width: Math.max(64, Math.min(176, Math.ceil(textWidth + 20))), height: textWidth > 156 ? 50 : 32 };
}

type Curve = { start: Point; end: Point; control: Point; points: Point[] };

function curveThrough(source: Point, target: Point, label: Point): Curve {
  let control = { x: 2 * label.x - (source.x + target.x) / 2, y: 2 * label.y - (source.y + target.y) / 2 };
  let start = source, end = target;
  for (let iteration = 0; iteration < 3; iteration++) {
    start = borderPoint(source, control); end = borderPoint(target, control);
    control = { x: 2 * label.x - (start.x + end.x) / 2, y: 2 * label.y - (start.y + end.y) / 2 };
  }
  const points = Array.from({ length: 17 }, (_, step) => {
    const t = step / 16;
    return { x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
      y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y };
  });
  return { start, end, control, points };
}

function crosses(a: Point, b: Point, c: Point, d: Point) {
  if (Math.max(a.x, b.x) <= Math.min(c.x, d.x) || Math.max(c.x, d.x) <= Math.min(a.x, b.x)
    || Math.max(a.y, b.y) <= Math.min(c.y, d.y) || Math.max(c.y, d.y) <= Math.min(a.y, b.y)) return false;
  const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < -0.001 && side(c, d, a) * side(c, d, b) < -0.001;
}

function passesThrough(points: Point[], box: Box) {
  const corners = [{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height }];
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index];
    if (Math.max(a.x, b.x) < box.x || Math.min(a.x, b.x) > box.x + box.width
      || Math.max(a.y, b.y) < box.y || Math.min(a.y, b.y) > box.y + box.height) continue;
    if (a.x > box.x && a.x < box.x + box.width && a.y > box.y && a.y < box.y + box.height) return true;
    if (corners.some((corner, i) => crosses(a, b, corner, corners[(i + 1) % 4]))) return true;
  }
  return false;
}

function borderPoint(center: Point, toward: Point): Point {
  const dx = toward.x - center.x, dy = toward.y - center.y;
  const scale = 1 / Math.max(Math.abs(dx) / (PERSON_WIDTH / 2), Math.abs(dy) / (PERSON_HEIGHT / 2), 0.001);
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

/** Route display edges only; their IDs, direction and meaning remain server-owned. */
export function routeEpisodeRelationships(positions: Map<string, Point>, edges: EpisodeConnection[], lanes: Map<string, number>) {
  const cards = [...positions.values()].map(point => ({ ...point, width: PERSON_WIDTH, height: PERSON_HEIGHT }));
  const occupied = [...cards];
  const routes = new Map<string, EpisodeRoute>();
  const previousCurves: Array<{ edge: EpisodeConnection; points: Point[] }> = [];
  const boundsPoints = cards.flatMap(box => [box, { x: box.x + box.width, y: box.y + box.height }]);
  const valid = edges.filter(edge => edge.source !== edge.target && positions.has(edge.source) && positions.has(edge.target));
  const pair = (edge: EpisodeConnection) => JSON.stringify([edge.source, edge.target].sort());
  const groups = new Map<string, EpisodeConnection[]>();
  for (const edge of valid) groups.set(pair(edge), [...groups.get(pair(edge)) ?? [], edge]);

  for (const [, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const maxWidth = Math.max(...group.map(edge => episodeRelationshipLabelSize(edge).width));
    const maxHeight = Math.max(...group.map(edge => episodeRelationshipLabelSize(edge).height));
    // Reserve the central lane first, then each outer lane, independent of response ordering.
    for (const edge of group.sort((a, b) => Math.abs(lanes.get(a.id) ?? 0) - Math.abs(lanes.get(b.id) ?? 0) || a.id.localeCompare(b.id))) {
      const a = positions.get(edge.source)!, b = positions.get(edge.target)!;
      const source = { x: a.x + PERSON_WIDTH / 2, y: a.y + PERSON_HEIGHT / 2 };
      const target = { x: b.x + PERSON_WIDTH / 2, y: b.y + PERSON_HEIGHT / 2 };
      const dy = target.y - source.y;
      const dx = target.x - source.x || (dy === 0 ? 1 : 0), length = Math.max(1, Math.hypot(dx, dy));
      const orientation = edge.source.localeCompare(edge.target) < 0 ? 1 : -1;
      const normal = { x: -dy / length * orientation, y: dx / length * orientation };
      const spacing = Math.abs(normal.x) * (maxWidth + GAP) + Math.abs(normal.y) * (maxHeight + GAP);
      const lane = lanes.get(edge.id) ?? 0;
      const size = episodeRelationshipLabelSize(edge);
      let label = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
      let found = false;
      let bestScore = Infinity;
      let candidates = 0;
      let chosenCurve: Curve | undefined;
      const otherCards = [...positions].filter(([id]) => id !== edge.source && id !== edge.target)
        .map(([, point]) => ({ x: point.x - 8, y: point.y - 8, width: PERSON_WIDTH + 16, height: PERSON_HEIGHT + 16 }));
      // Search the lane and nearby positions against every card and already placed label.
      // An outward fallback also handles user-dragged cards that leave no room between them.
      for (let step = 0; step < 100 && candidates < 20; step++) {
        const offsets = step === 0 ? [lane * spacing]
          : lane === 0 ? [step * spacing, -step * spacing] : [lane * spacing + Math.sign(lane) * step * spacing];
        for (const offset of offsets) {
          for (const fraction of [0.5, 0.4, 0.6, 0.3, 0.7]) {
            const candidate = { x: source.x + dx * fraction + normal.x * offset, y: source.y + dy * fraction + normal.y * offset };
            const box = labelBox(candidate, size.width, size.height);
            if (occupied.some(other => overlaps(box, other))) continue;
            const curve = curveThrough(source, target, candidate);
            // Prefer paths that avoid cards and labels before reducing crossings. A small
            // distance cost keeps detours bounded instead of shrinking the whole canvas.
            let score = Math.abs(offset - lane * spacing) * 0.03 + Math.abs(fraction - 0.5) * length * 0.03;
            score += otherCards.filter(card => passesThrough(curve.points, card)).length * 2000;
            score += occupied.slice(cards.length).filter(other => passesThrough(curve.points, other)).length * 800;
            for (const previous of previousCurves) {
              if (passesThrough(previous.points, box)) score += 800;
              if ([previous.edge.source, previous.edge.target].some(id => id === edge.source || id === edge.target)) continue;
              let crossed = false;
              for (let i = 1; i < curve.points.length && !crossed; i++) for (let j = 1; j < previous.points.length; j++) {
                if (crosses(curve.points[i - 1], curve.points[i], previous.points[j - 1], previous.points[j])) { crossed = true; break; }
              }
              if (crossed) score += 40;
            }
            candidates++;
            if (score < bestScore) { bestScore = score; label = candidate; chosenCurve = curve; found = true; }
            if (score === 0 || candidates >= 20) break;
          }
          if (bestScore === 0 || candidates >= 20) break;
        }
        if (bestScore === 0) break;
      }
      if (!found) label = { x: Math.max(...occupied.map(box => box.x + box.width)) + size.width / 2 + GAP * 2, y: label.y };
      const { start, end, control, points } = chosenCurve ?? curveThrough(source, target, label);
      previousCurves.push({ edge, points });
      const box = labelBox(label, size.width, size.height);
      occupied.push(box);
      boundsPoints.push(start, end, box, { x: box.x + box.width, y: box.y + box.height });
      // Include the actual quadratic extrema, rather than the much larger control polygon.
      for (const axis of ['x', 'y'] as const) {
        const denominator = start[axis] - 2 * control[axis] + end[axis];
        const t = denominator === 0 ? -1 : (start[axis] - control[axis]) / denominator;
        if (t > 0 && t < 1) boundsPoints.push({
          x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
          y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
        });
      }
      routes.set(edge.id, { path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
        label, labelWidth: size.width, labelHeight: size.height, start, end });
    }
  }
  const minX = boundsPoints.length ? Math.min(...boundsPoints.map(point => point.x)) : 0;
  const minY = boundsPoints.length ? Math.min(...boundsPoints.map(point => point.y)) : 0;
  const maxX = boundsPoints.length ? Math.max(...boundsPoints.map(point => point.x)) : 1;
  const maxY = boundsPoints.length ? Math.max(...boundsPoints.map(point => point.y)) : 1;
  return { routes, bounds: { x: minX - 12, y: minY - 12, width: maxX - minX + 24, height: maxY - minY + 24 } };
}
