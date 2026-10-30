import { PERSON_HEIGHT, PERSON_WIDTH, type EpisodeConnection } from './episode-relationship-layout';
import { episodeRelationshipLabelSize, type EpisodeRoute, type Point } from './episode-relationship-routing';

type Box = Point & { width: number; height: number };
type Obstacle = Box & { id: string };
type Port = { cell: number; points: Point[] };
export type EpisodeOrthogonalRoute = EpisodeRoute & { sections: Point[][]; labelRect: Box; obstacleFallback: boolean };
const GAP = 16;
const CLEARANCE = 6;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const overlaps = (a: Box, b: Box, gap = GAP) => a.x < b.x + b.width + gap && a.x + a.width + gap > b.x
  && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
const length = (points: Point[]) => points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);

function segmentHits(a: Point, b: Point, box: Box) {
  if (Math.abs(a.x - b.x) < 0.0001) return a.x > box.x && a.x < box.x + box.width && Math.max(a.y, b.y) > box.y && Math.min(a.y, b.y) < box.y + box.height;
  return a.y > box.y && a.y < box.y + box.height && Math.max(a.x, b.x) > box.x && Math.min(a.x, b.x) < box.x + box.width;
}
function simplify(points: Point[]) {
  const result: Point[] = [];
  for (const point of points) {
    const last = result[result.length - 1], before = result[result.length - 2];
    if (last && last.x === point.x && last.y === point.y) continue;
    if (last && before && ((before.x === last.x && last.x === point.x) || (before.y === last.y && last.y === point.y))) {
      // Do not erase a reversal, which would change the actual route.
      if ((last.x - before.x) * (point.x - last.x) + (last.y - before.y) * (point.y - last.y) >= 0) result.pop();
    }
    result.push(point);
  }
  return result;
}

/** Small binary heap with parallel arrays: routing does not allocate an object per expansion. */
class Heap {
  states: number[] = []; scores: number[] = []; costs: number[] = [];
  push(state: number, score: number, cost: number) {
    let index = this.states.length;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.scores[parent] < score || this.scores[parent] === score && this.states[parent] <= state) break;
      this.states[index] = this.states[parent]; this.scores[index] = this.scores[parent]; this.costs[index] = this.costs[parent]; index = parent;
    }
    this.states[index] = state; this.scores[index] = score; this.costs[index] = cost;
  }
  pop(): [number, number] {
    const answer: [number, number] = [this.states[0], this.costs[0]];
    const state = this.states.pop()!, score = this.scores.pop()!, cost = this.costs.pop()!;
    if (!this.states.length) return answer;
    let index = 0;
    while (index * 2 + 1 < this.states.length) {
      let child = index * 2 + 1;
      if (child + 1 < this.states.length && (this.scores[child + 1] < this.scores[child]
        || this.scores[child + 1] === this.scores[child] && this.states[child + 1] < this.states[child])) child++;
      if (score < this.scores[child] || score === this.scores[child] && state <= this.states[child]) break;
      this.states[index] = this.states[child]; this.scores[index] = this.scores[child]; this.costs[index] = this.costs[child]; index = child;
    }
    this.states[index] = state; this.scores[index] = score; this.costs[index] = cost;
    return answer;
  }
}

class RoutingGrid {
  step: number; x: number; y: number; width: number; height: number;
  blocked: Uint8Array; horizontal: Uint8Array; vertical: Uint8Array;
  labelHorizontal: Uint16Array; labelVertical: Uint16Array;
  usedHorizontal: Uint8Array; usedVertical: Uint8Array;
  seen: Int32Array; costs: Float64Array; previous: Int32Array; origins: Int32Array;
  generation = 0;
  constructor(cards: Obstacle[], labels: Box[]) {
    const boxes = [...cards, ...labels];
    const minX = Math.min(...boxes.map(box => box.x)) - 160, minY = Math.min(...boxes.map(box => box.y)) - 160;
    const maxX = Math.max(...boxes.map(box => box.x + box.width)) + 160, maxY = Math.max(...boxes.map(box => box.y + box.height)) + 160;
    // Bound memory and search even when a user drags a card a long distance away.
    this.step = Math.max(16, Math.ceil(Math.sqrt((maxX - minX) * (maxY - minY) / 30000) / 8) * 8);
    this.x = Math.floor(minX / this.step) * this.step; this.y = Math.floor(minY / this.step) * this.step;
    this.width = Math.ceil((maxX - this.x) / this.step) + 1; this.height = Math.ceil((maxY - this.y) / this.step) + 1;
    const count = this.width * this.height;
    this.blocked = new Uint8Array(count); this.horizontal = new Uint8Array(count); this.vertical = new Uint8Array(count);
    this.labelHorizontal = new Uint16Array(count); this.labelVertical = new Uint16Array(count);
    this.usedHorizontal = new Uint8Array(count); this.usedVertical = new Uint8Array(count);
    this.seen = new Int32Array(count * 2); this.costs = new Float64Array(count * 2); this.previous = new Int32Array(count * 2); this.origins = new Int32Array(count * 2);
    for (const card of cards) this.mark({ x: card.x - CLEARANCE, y: card.y - CLEARANCE, width: card.width + CLEARANCE * 2, height: card.height + CLEARANCE * 2 }, 0);
    labels.forEach((box, index) => this.mark(box, index + 1));
  }
  point(cell: number): Point { return { x: this.x + cell % this.width * this.step, y: this.y + Math.floor(cell / this.width) * this.step }; }
  cell(point: Point) { return Math.round((point.y - this.y) / this.step) * this.width + Math.round((point.x - this.x) / this.step); }
  mark(box: Box, label: number) {
    const left = (box.x - this.x) / this.step, right = (box.x + box.width - this.x) / this.step;
    const top = (box.y - this.y) / this.step, bottom = (box.y + box.height - this.y) / this.step;
    for (let y = Math.max(0, Math.ceil(top)); y <= Math.min(this.height - 1, Math.floor(bottom)); y++) {
      for (let x = Math.max(0, Math.floor(left)); x < Math.min(this.width - 1, Math.ceil(right)); x++) {
        const cell = y * this.width + x;
        if (label) this.labelHorizontal[cell] = label; else this.horizontal[cell] = 1;
      }
      if (!label) for (let x = Math.max(0, Math.ceil(left)); x <= Math.min(this.width - 1, Math.floor(right)); x++) this.blocked[y * this.width + x] = 1;
    }
    for (let x = Math.max(0, Math.ceil(left)); x <= Math.min(this.width - 1, Math.floor(right)); x++) {
      for (let y = Math.max(0, Math.floor(top)); y < Math.min(this.height - 1, Math.ceil(bottom)); y++) {
        const cell = y * this.width + x;
        if (label) this.labelVertical[cell] = label; else this.vertical[cell] = 1;
      }
    }
  }
  /** Card border → outward elbow → grid point. The border endpoint never changes identity. */
  ports(card: Obstacle, cards: Obstacle[], lane: number): Port[] {
    const offsetY = Math.max(-card.height / 2 + 12, Math.min(card.height / 2 - 12, lane * 8));
    const offsetX = Math.max(-card.width / 2 + 12, Math.min(card.width / 2 - 12, lane * 8));
    const midX = card.x + card.width / 2 + offsetX, midY = card.y + card.height / 2 + offsetY;
    const outward = [
      [{ x: card.x + card.width, y: midY }, { x: this.x + Math.ceil((card.x + card.width + CLEARANCE + 1 - this.x) / this.step) * this.step, y: midY }],
      [{ x: card.x, y: midY }, { x: this.x + Math.floor((card.x - CLEARANCE - 1 - this.x) / this.step) * this.step, y: midY }],
      [{ x: midX, y: card.y + card.height }, { x: midX, y: this.y + Math.ceil((card.y + card.height + CLEARANCE + 1 - this.y) / this.step) * this.step }],
      [{ x: midX, y: card.y }, { x: midX, y: this.y + Math.floor((card.y - CLEARANCE - 1 - this.y) / this.step) * this.step }],
    ];
    const ports: Port[] = [];
    outward.forEach(([border, elbow]) => {
      const cell = this.cell(elbow), point = this.point(cell), points = simplify([border, elbow, point]);
      if (cell < 0 || cell >= this.blocked.length || this.blocked[cell]) return;
      if (cards.some(other => other.id !== card.id && points.slice(1).some((p, index) => segmentHits(points[index], p, other)))) return;
      ports.push({ cell, points });
    });
    return ports;
  }
  search(starts: Port[], goal: number, ownLabel: number): Point[] | null {
    if (!starts.length || this.blocked[goal]) return null;
    const generation = ++this.generation, heap = new Heap();
    const gx = goal % this.width, gy = Math.floor(goal / this.width);
    const heuristic = (cell: number) => (Math.abs(cell % this.width - gx) + Math.abs(Math.floor(cell / this.width) - gy)) * this.step;
    starts.forEach((port, index) => {
      for (let axis = 0; axis < 2; axis++) {
        const state = port.cell * 2 + axis, cost = length(port.points);
        if (this.seen[state] === generation && this.costs[state] <= cost) continue;
        this.seen[state] = generation; this.costs[state] = cost; this.previous[state] = -1; this.origins[state] = index;
        heap.push(state, cost + heuristic(port.cell), cost);
      }
    });
    let expanded = 0;
    while (heap.states.length && expanded++ < Math.min(30000, this.blocked.length * 2)) {
      const [state, cost] = heap.pop();
      if (cost !== this.costs[state]) continue;
      const cell = state >> 1, axis = state & 1;
      if (cell === goal) {
        const path: Point[] = [];
        let current = state;
        while (this.previous[current] !== -1) { path.push(this.point(current >> 1)); current = this.previous[current]; }
        return simplify([...starts[this.origins[current]].points, ...path.reverse()]);
      }
      const x = cell % this.width, y = Math.floor(cell / this.width);
      for (let direction = 0; direction < 4; direction++) {
        if (direction === 0 && x === this.width - 1 || direction === 1 && x === 0 || direction === 2 && y === this.height - 1 || direction === 3 && y === 0) continue;
        const horizontal = direction < 2, next = cell + [1, -1, this.width, -this.width][direction];
        const segment = direction === 1 || direction === 3 ? next : cell;
        if (this.blocked[next] || (horizontal ? this.horizontal[segment] : this.vertical[segment])) continue;
        const label = horizontal ? this.labelHorizontal[segment] : this.labelVertical[segment];
        const used = horizontal ? this.usedHorizontal[segment] : this.usedVertical[segment];
        const nextAxis = horizontal ? 0 : 1, nextState = next * 2 + nextAxis;
        // Cards are hard obstacles; labels and already used tracks are costly rather than
        // making a tightly packed or manually dragged graph impossible to route.
        const nextCost = cost + this.step + (axis !== nextAxis ? 12 : 0) + (label && label !== ownLabel ? 384 : 0) + Math.min(used, 4) * 80;
        if (this.seen[nextState] === generation && this.costs[nextState] <= nextCost) continue;
        this.seen[nextState] = generation; this.costs[nextState] = nextCost; this.previous[nextState] = state;
        heap.push(nextState, nextCost + heuristic(next), nextCost);
      }
    }
    return null;
  }
  reserve(points: Point[], delta = 1) {
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1], b = points[index];
      const horizontal = a.y === b.y, mask = horizontal ? this.usedHorizontal : this.usedVertical;
      const steps = Math.ceil((Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / this.step);
      for (let step = 0; step < steps; step++) {
        const fraction = (step + 0.5) / steps;
        const x = (a.x + (b.x - a.x) * fraction - this.x) / this.step;
        const y = (a.y + (b.y - a.y) * fraction - this.y) / this.step;
        // Tracks are indexed by their left/top grid vertex, not the nearest vertex.
        const cell = (horizontal ? Math.round(y) : Math.floor(y)) * this.width + (horizontal ? Math.floor(x) : Math.round(x));
        if (cell >= 0 && cell < mask.length) mask[cell] = Math.max(0, Math.min(255, mask[cell] + delta));
      }
    }
  }
}

/** Keeps supplied positions unchanged; all route IDs and semantic directions remain server-owned. */
export function routeEpisodeRelationshipsOrthogonally(
  positions: Map<string, Point>, connections: EpisodeConnection[], lanes?: Map<string, number>,
): { routes: Map<string, EpisodeOrthogonalRoute>; bounds: Box } {
  const cards: Obstacle[] = [...positions].sort(([a], [b]) => compare(a, b)).map(([id, point]) => ({ id, ...point, width: PERSON_WIDTH, height: PERSON_HEIGHT }));
  const byId = new Map(cards.map(card => [card.id, card]));
  const edges = connections.filter(edge => edge.source !== edge.target && positions.has(edge.source) && positions.has(edge.target)).sort((a, b) => compare(a.id, b.id));
  const pair = (edge: EpisodeConnection) => JSON.stringify([edge.source, edge.target].sort(compare));
  const groups = new Map<string, EpisodeConnection[]>();
  for (const edge of edges) groups.set(pair(edge), [...groups.get(pair(edge)) ?? [], edge]);
  const laneById = new Map(edges.map(edge => { const group = groups.get(pair(edge))!; return [edge.id, lanes?.get(edge.id) ?? group.indexOf(edge) - (group.length - 1) / 2]; }));
  const labels: Box[] = [], occupied: Box[] = [...cards];
  for (const edge of edges) {
    const source = byId.get(edge.source)!, target = byId.get(edge.target)!, size = episodeRelationshipLabelSize(edge);
    const ax = source.x + PERSON_WIDTH / 2, ay = source.y + PERSON_HEIGHT / 2;
    const dx = target.x - source.x, dy = target.y - source.y, distance = Math.max(1, Math.hypot(dx, dy));
    const orientation = compare(edge.source, edge.target) < 0 ? 1 : -1;
    const nx = -dy / distance * orientation, ny = dx / distance * orientation;
    const spacing = Math.abs(nx) * (size.width + GAP) + Math.abs(ny) * (size.height + GAP);
    const lane = laneById.get(edge.id)!;
    let chosen: Box | undefined;
    for (let ring = 0; ring < 48 && !chosen; ring++) {
      for (const sign of ring ? [1, -1] : [0]) {
        const offset = (lane + ring * sign) * spacing;
        for (const fraction of [0.5, 0.4, 0.6, 0.3, 0.7]) {
          const box = { x: ax + dx * fraction + nx * offset - size.width / 2, y: ay + dy * fraction + ny * offset - size.height / 2, ...size };
          if (!occupied.some(other => overlaps(box, other))) { chosen = box; break; }
        }
        if (chosen) break;
      }
    }
    if (!chosen) chosen = { x: Math.max(0, ...occupied.map(box => box.x + box.width)) + GAP, y: ay - size.height / 2, ...size };
    labels.push(chosen); occupied.push(chosen);
  }
  const routes = new Map<string, EpisodeOrthogonalRoute>();
  if (!cards.length) return { routes, bounds: { x: 0, y: 0, width: 24, height: 24 } };
  const grid = new RoutingGrid(cards, labels);
  const boundsPoints = cards.flatMap(box => [box, { x: box.x + box.width, y: box.y + box.height }]);
  edges.forEach((edge, index) => {
    const source = byId.get(edge.source)!, target = byId.get(edge.target)!, labelRect = labels[index];
    const label = { x: labelRect.x + labelRect.width / 2, y: labelRect.y + labelRect.height / 2 };
    const goal = grid.cell(label), gridLabel = grid.point(goal), elbow = { x: label.x, y: gridLabel.y };
    const lane = laneById.get(edge.id)!;
    const from = grid.search(grid.ports(source, cards, lane), goal, index + 1);
    // The second half should not retrace the first half as a long dead-end spur.
    // Restore global usage before reserving the final route exactly once.
    if (from) grid.reserve(from);
    const to = grid.search(grid.ports(target, cards, -lane), goal, index + 1);
    if (from) grid.reserve(from, -1);
    let points: Point[];
    const obstacleFallback = !from || !to;
    if (from && to) points = simplify([...from, elbow, label, elbow, gridLabel, ...to.slice(0, -1).reverse()]);
    else {
      // Overlapping dragged cards or an exhausted bounded search cannot always have a
      // clear route. Preserve the connection rather than silently dropping its ID.
      const start = { x: source.x + PERSON_WIDTH / 2, y: source.y + PERSON_HEIGHT };
      const end = { x: target.x + PERSON_WIDTH / 2, y: target.y };
      points = simplify([start, { x: start.x, y: label.y }, label, { x: end.x, y: label.y }, end]);
    }
    grid.reserve(points);
    routes.set(edge.id, { path: points.map((point, position) => `${position ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '),
      sections: [points], start: points[0], end: points[points.length - 1], label, labelRect,
      labelWidth: labelRect.width, labelHeight: labelRect.height, obstacleFallback });
    boundsPoints.push(...points, labelRect, { x: labelRect.x + labelRect.width, y: labelRect.y + labelRect.height });
  });
  const minX = Math.min(...boundsPoints.map(point => point.x)), minY = Math.min(...boundsPoints.map(point => point.y));
  const maxX = Math.max(...boundsPoints.map(point => point.x)), maxY = Math.max(...boundsPoints.map(point => point.y));
  return { routes, bounds: { x: minX - 12, y: minY - 12, width: maxX - minX + 24, height: maxY - minY + 24 } };
}
