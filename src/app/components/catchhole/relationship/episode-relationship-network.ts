import {
  PERSON_HEIGHT, PERSON_WIDTH, type EpisodeConnection, type EpisodePerson,
} from './episode-relationship-layout';

type Point = { x: number; y: number };
type Neighbors = Map<string, string[]>;
type Component = { ids: string[]; positions: Map<string, Point>; hubIds: string[]; width: number; height: number };
const STEP_X = PERSON_WIDTH + 96;
const STEP_Y = PERSON_HEIGHT + 88;
const HUB_STEP = 700;
const COMPONENT_GAP = 180;
const compareIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** Display-only anchors and fans. Undirected adjacency never changes an edge's meaning. */
export function layoutEpisodeRelationshipNetwork(
  people: readonly EpisodePerson[], connections: readonly EpisodeConnection[],
): { positions: Map<string, Point>; hubIds: Set<string> } {
  const ids = [...new Set(people.map(person => person.id))].sort(compareIds);
  const adjacent = new Map(ids.map(id => [id, new Set<string>()]));
  for (const edge of connections) {
    if (edge.source === edge.target || !adjacent.has(edge.source) || !adjacent.has(edge.target)) continue;
    adjacent.get(edge.source)!.add(edge.target);
    adjacent.get(edge.target)!.add(edge.source);
  }
  const neighbors: Neighbors = new Map(ids.map(id => [id, [...adjacent.get(id)!].sort(compareIds)]));
  const unseen = new Set(ids), components: Component[] = [];
  for (const id of ids) {
    if (!unseen.delete(id)) continue;
    const members = [id];
    for (let index = 0; index < members.length; index++) {
      for (const neighbor of neighbors.get(members[index])!) if (unseen.delete(neighbor)) members.push(neighbor);
    }
    components.push(layoutComponent(members.sort(compareIds), neighbors));
  }
  components.sort((a, b) => b.width * b.height - a.width * a.height || compareIds(a.ids[0], b.ids[0]));
  const area = components.reduce((sum, item) => sum + (item.width + COMPONENT_GAP) * (item.height + COMPONENT_GAP), 0);
  const targetWidth = Math.max(1, Math.sqrt(area * 1.5), ...components.map(item => item.width));
  const packed = new Map<string, Point>(), hubs = new Set<string>();
  let left = 0, top = 0, rowHeight = 0;
  for (const component of components) {
    if (left > 0 && left + component.width > targetWidth) {
      left = 0; top += rowHeight + COMPONENT_GAP; rowHeight = 0;
    }
    for (const [id, point] of component.positions) packed.set(id, { x: left + point.x, y: top + point.y });
    component.hubIds.forEach(id => hubs.add(id));
    left += component.width + COMPONENT_GAP;
    rowHeight = Math.max(rowHeight, component.height);
  }
  return { positions: new Map(ids.map(id => [id, packed.get(id)!])), hubIds: new Set(ids.filter(id => hubs.has(id))) };
}

function distancesFrom(source: string, neighbors: Neighbors) {
  const distances = new Map([[source, 0]]), queue = [source];
  for (let index = 0; index < queue.length; index++) {
    for (const neighbor of neighbors.get(queue[index])!) {
      if (distances.has(neighbor)) continue;
      distances.set(neighbor, distances.get(queue[index])! + 1); queue.push(neighbor);
    }
  }
  return distances;
}

function selectHubs(ids: string[], neighbors: Neighbors): string[] {
  const ranked = [...ids].sort((a, b) => neighbors.get(b)!.length - neighbors.get(a)!.length || compareIds(a, b));
  const maximum = neighbors.get(ranked[0])!.length;
  if (maximum < 3) return [];
  const hubs = [ranked[0]], covered = new Set([ranked[0], ...neighbors.get(ranked[0])!]);
  // A second anchor must serve its own neighbors, rather than merely repeat a dense clique.
  const average = ids.reduce((sum, id) => sum + neighbors.get(id)!.length, 0) / ids.length;
  const threshold = Math.max(3, Math.min(maximum * 0.4, average * 1.7));
  for (const id of ranked.slice(1)) {
    if (hubs.length >= 6 || neighbors.get(id)!.length < threshold) break;
    if (neighbors.get(id)!.filter(neighbor => !covered.has(neighbor)).length < 3) continue;
    hubs.push(id); covered.add(id); neighbors.get(id)!.forEach(neighbor => covered.add(neighbor));
  }
  return hubs;
}

function orderHubs(hubs: string[], neighbors: Neighbors, distances: Map<string, Map<string, number>>) {
  if (hubs.length < 3) return hubs;
  const strongest = hubs[0];
  const affinity = new Map<string, Map<string, number>>();
  for (const a of hubs) affinity.set(a, new Map(hubs.map(b => {
    const common = neighbors.get(a)!.filter(id => neighbors.get(b)!.includes(id)).length;
    return [b, a === b ? 0 : 8 / distances.get(a)!.get(b)! + common * 2];
  })));
  let best = [...hubs], score = Infinity;
  const visit = (order: string[], rest: string[]) => {
    if (rest.length) {
      for (const id of rest) visit([...order, id], rest.filter(other => other !== id));
      return;
    }
    let next = Math.abs(order.indexOf(strongest) - (order.length - 1) / 2) * 30;
    for (let a = 0; a < order.length; a++) for (let b = a + 1; b < order.length; b++) {
      next += affinity.get(order[a])!.get(order[b])! * (b - a);
    }
    if (next < score) { best = order; score = next; }
  };
  visit([], [...hubs].sort(compareIds));
  return best;
}

function layoutComponent(ids: string[], neighbors: Neighbors): Component {
  const selected = selectHubs(ids, neighbors), positions = new Map<string, Point>();
  if (!selected.length) {
    // Paths/cycles have no meaningful high-degree anchor. Keep consecutive people nearby.
    const start = ids.find(id => neighbors.get(id)!.length < 2) ?? ids[0];
    const ordered = [start], seen = new Set(ordered);
    for (let index = 0; index < ordered.length; index++) for (const id of neighbors.get(ordered[index])!) {
      if (!seen.has(id)) { seen.add(id); ordered.push(id); }
    }
    const columns = Math.ceil(Math.sqrt(ids.length * 1.5));
    ordered.forEach((id, index) => {
      const row = Math.floor(index / columns), column = index % columns;
      positions.set(id, { x: (row % 2 ? columns - column - 1 : column) * STEP_X, y: row * 220 });
    });
    return normalize(ids, positions, []);
  }
  const distances = new Map(selected.map(id => [id, distancesFrom(id, neighbors)]));
  const hubs = orderHubs(selected, neighbors, distances), hubSet = new Set(hubs);
  hubs.forEach((id, index) => positions.set(id, { x: index * HUB_STEP, y: 0 }));
  const groups = new Map(hubs.map(id => [id, [] as string[]]));
  const shared: Array<{ id: string; anchors: string[] }> = [];
  const owner = new Map<string, string>();
  const ranked = ids.filter(id => !hubSet.has(id)).sort((a, b) =>
    Math.min(...hubs.map(hub => distances.get(hub)!.get(a)!)) - Math.min(...hubs.map(hub => distances.get(hub)!.get(b)!))
    || neighbors.get(b)!.length - neighbors.get(a)!.length || compareIds(a, b));
  for (const id of ranked) {
    const anchors = hubs.filter(hub => neighbors.get(id)!.includes(hub));
    if (anchors.length > 1) { shared.push({ id, anchors }); continue; }
    const ordered = [...hubs].sort((a, b) => {
      const distance = distances.get(a)!.get(id)! - distances.get(b)!.get(id)!;
      const affinity = (hub: string) => neighbors.get(id)!.filter(neighbor =>
        neighbors.get(hub)!.includes(neighbor) || owner.get(neighbor) === hub).length;
      return distance || affinity(b) - affinity(a) || groups.get(a)!.length - groups.get(b)!.length || compareIds(a, b);
    });
    owner.set(id, ordered[0]); groups.get(ordered[0])!.push(id);
  }
  // Shared neighbors sit between the anchors they actually touch, not in a duplicate group.
  for (const { id, anchors } of shared) {
    const xs = anchors.map(hub => positions.get(hub)!.x), center = xs.reduce((sum, x) => sum + x, 0) / xs.length;
    const width = Math.max(STEP_X, Math.max(...xs) - Math.min(...xs));
    const candidates: Point[] = [];
    for (let row = 0; row < ids.length; row++) {
      for (const sign of [-1, 1]) for (const offset of [0, -0.2, 0.2, -0.4, 0.4]) {
        candidates.push({ x: center + offset * width, y: sign * (230 + row * 220) });
      }
    }
    place(id, candidates, positions);
  }
  for (const hub of hubs) {
    const anchor = positions.get(hub)!, members = groups.get(hub)!;
    const columns = hubs.length === 1 ? Math.max(3, Math.min(9, Math.ceil(Math.sqrt(members.length)))) : 3;
    for (const id of members) {
      const depth = distances.get(hub)!.get(id)!;
      const candidates: Point[] = [];
      const linked = neighbors.get(id)!.map(neighbor => positions.get(neighbor)).filter((point): point is Point => !!point);
      const preferX = linked.length ? linked.reduce((sum, point) => sum + point.x, 0) / linked.length : anchor.x;
      // Leaves and more distant people start farther out; the backbone stays open.
      const firstRing = Math.max(0, depth - 1, neighbors.get(id)!.length === 1 && members.length > 5 ? 1 : 0);
      for (let ring = firstRing; ring < ids.length + firstRing; ring++) {
        const row: Point[] = [];
        for (let column = 0; column < columns; column++) {
          const offset = (column - (columns - 1) / 2) * STEP_X;
          const arc = 80 * (1 - Math.abs(column - (columns - 1) / 2) / Math.max(1, (columns - 1) / 2));
          for (const sign of [-1, 1]) row.push({ x: anchor.x + offset, y: sign * (230 + ring * 220 + arc) });
        }
        row.sort((a, b) => {
          const score = (point: Point) => Math.abs(point.x - preferX)
            + linked.reduce((sum, other) => sum + Math.abs(point.y - other.y) * 0.1, 0);
          return score(a) - score(b) || a.y - b.y || a.x - b.x;
        });
        candidates.push(...row);
      }
      place(id, candidates, positions);
    }
  }
  return normalize(ids, positions, hubs);
}

function place(id: string, candidates: Point[], positions: Map<string, Point>) {
  const occupied = [...positions.values()];
  const clear = (point: Point) => occupied.every(other => Math.abs(point.x - other.x) >= STEP_X - 0.0001
    || Math.abs(point.y - other.y) >= STEP_Y - 0.0001);
  const position = candidates.find(clear)
    ?? { x: Math.max(0, ...occupied.map(point => point.x)) + STEP_X, y: 0 };
  positions.set(id, position);
}

function normalize(ids: string[], positions: Map<string, Point>, hubIds: string[]): Component {
  const minX = Math.min(...[...positions.values()].map(point => point.x));
  const minY = Math.min(...[...positions.values()].map(point => point.y));
  const normalized = new Map(ids.map(id => {
    const point = positions.get(id)!;
    return [id, { x: point.x - minX, y: point.y - minY }];
  }));
  return { ids, positions: normalized, hubIds,
    width: Math.max(...[...normalized.values()].map(point => point.x)) + PERSON_WIDTH,
    height: Math.max(...[...normalized.values()].map(point => point.y)) + PERSON_HEIGHT };
}
