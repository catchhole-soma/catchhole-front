import ELK from 'elkjs/lib/elk.bundled.js';

const FAMILY_TREE_NODE_WIDTH = 192;
const FAMILY_TREE_NODE_HEIGHT = 88;

type FamilyTreePoint = { x: number; y: number };
type FamilyTreeInputNode = { id: string; name: string; nodeType?: 'CHARACTER' | 'MENTION'; characterId?: string | null; candidateId?: string | null; candidateIds?: string[]; mentionGroupId?: string | null };
type FamilyTreeRole = 'PARENT' | 'FATHER' | 'MOTHER' | 'CHILD' | 'SON' | 'DAUGHTER' | 'ANCESTOR' | 'DESCENDANT';
export type FamilyTreeInputEdge = {
  id: string;
  sourceType?: 'RELATIONSHIP' | 'MENTION';
  relationshipId?: string | null;
  candidateId?: string | null;
  subjectCharacterId: string;
  objectCharacterId: string;
  kind: 'PARENT_OF' | 'SPOUSE' | 'SIBLING' | 'ANCESTOR_OF';
  generationGap?: number | null;
  subjectRole?: FamilyTreeRole | null;
  objectRole?: FamilyTreeRole | null;
  subtype?: string;
  temporalScope?: string;
  timeLabel?: string;
};
export type FamilyTreeInput = { nodes: FamilyTreeInputNode[]; edges: FamilyTreeInputEdge[] };
type FamilyTreeLayoutNode = FamilyTreeInputNode & {
  position: FamilyTreePoint; width: number; height: number;
  generation: number; componentId: string; bandId?: string;
};
type FamilyTreeLayoutEdge = FamilyTreeInputEdge & {
  source: string; target: string;
  sourceHandle: 'top' | 'bottom' | 'left' | 'right';
  targetHandle: 'top' | 'bottom' | 'left' | 'right';
  points: FamilyTreePoint[]; labelPosition: FamilyTreePoint;
  labelAnchor: FamilyTreePoint; labelSize: { width: number; height: number };
};
type FamilyTreeJunction = {
  id: string; position: FamilyTreePoint; parentIds: string[]; childIds: string[]; relationshipIds: string[];
};
type FamilyTreeLayoutWarning = {
  code: 'PARENT_CYCLE' | 'GENERATION_CONFLICT' | 'MISSING_PERSON' | 'DUPLICATE_ID' | 'DENSE_GRAPH' | 'LAYOUT_FALLBACK';
  message: string; relationshipIds: string[];
};
type FamilyTreeEndpointLabel = {
  id: string; personId: string; personName: string; role: FamilyTreeRole; label: string;
  position: FamilyTreePoint; size: { width: number; height: number }; relationshipIds: string[];
};
export type FamilyTreeConnection = {
  id: string; kind: FamilyTreeInputEdge['kind']; subtype?: string; temporalScope?: string; timeLabel?: string;
  generationGap?: number | null; detailLabel?: string;
  lineageBreak?: { position: FamilyTreePoint; direction: 'vertical' | 'horizontal' };
  paths: FamilyTreePoint[][]; label: string; labelPosition: FamilyTreePoint; labelSize: { width: number; height: number };
  relationshipIds: string[]; personIds: string[]; endpointLabels: FamilyTreeEndpointLabel[];
};
export type FamilyTreeLayout = {
  nodes: FamilyTreeLayoutNode[]; edges: FamilyTreeLayoutEdge[]; junctions: FamilyTreeJunction[];
  connections: FamilyTreeConnection[];
  regions: { id: string; label: string; position: FamilyTreePoint; width: number; height: number }[];
  components: { id: string; x: number; y: number; width: number; height: number }[];
  warnings: FamilyTreeLayoutWarning[]; width: number; height: number;
};
export type FamilyTreeLayoutOptions = { nodeWidth?: number; nodeHeight?: number; nodeGap?: number; generationGap?: number };

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const isUnknownAncestry = (edge: FamilyTreeInputEdge) => edge.kind === 'ANCESTOR_OF' && edge.generationGap == null;
const isLineage = (edge: FamilyTreeInputEdge) => edge.kind === 'PARENT_OF' || edge.kind === 'ANCESTOR_OF';

class Groups {
  private readonly parents = new Map<string, string>();
  constructor(ids: string[]) { ids.forEach(id => this.parents.set(id, id)); }
  find(id: string): string {
    const parent = this.parents.get(id)!;
    if (parent === id) return id;
    const root = this.find(parent);
    this.parents.set(id, root);
    return root;
  }
  join(a: string, b: string) {
    const roots = [this.find(a), this.find(b)].sort(compare);
    this.parents.set(roots[1], roots[0]);
  }
}

function directedGraph(ids: string[], edges: FamilyTreeInputEdge[], groups?: Groups) {
  const graph = new Map<string, Set<string>>();
  const root = (id: string) => groups ? groups.find(id) : id;
  ids.forEach(id => graph.set(root(id), new Set()));
  edges.forEach(edge => {
    const from = root(edge.subjectCharacterId), to = root(edge.objectCharacterId);
    if (from !== to) graph.get(from)!.add(to);
  });
  return graph;
}

function reaches(graph: Map<string, Set<string>>, from: string, to: string) {
  const pending = [from], seen = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === to) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    graph.get(current)?.forEach(next => pending.push(next));
  }
  return false;
}

function stronglyConnected(ids: string[], edges: FamilyTreeInputEdge[]) {
  const graph = directedGraph(ids, edges), indices = new Map<string, number>(), low = new Map<string, number>();
  const stack: string[] = [], active = new Set<string>(), result: string[][] = [];
  let index = 0;
  function visit(id: string) {
    indices.set(id, index); low.set(id, index++); stack.push(id); active.add(id);
    graph.get(id)!.forEach(next => {
      if (!indices.has(next)) { visit(next); low.set(id, Math.min(low.get(id)!, low.get(next)!)); }
      else if (active.has(next)) low.set(id, Math.min(low.get(id)!, indices.get(next)!));
    });
    if (indices.get(id) === low.get(id)) {
      const component: string[] = [];
      let item: string;
      do { item = stack.pop()!; active.delete(item); component.push(item); } while (item !== id);
      result.push(component.sort(compare));
    }
  }
  ids.forEach(id => { if (!indices.has(id)) visit(id); });
  return result;
}

function generationRanks(nodes: FamilyTreeInputNode[], edges: FamilyTreeInputEdge[], warnings: FamilyTreeLayoutWarning[]) {
  const ids = nodes.map(node => node.id), parents = edges.filter(edge => edge.kind === 'PARENT_OF');
  // Solve stated distances first, then compress only unoccupied generations.
  // An unknown distance never supplies a fabricated one-generation constraint.
  const lineage = edges.filter(edge => isLineage(edge) && !isUnknownAncestry(edge));
  const groups = new Groups(ids);
  for (const component of stronglyConnected(ids, lineage)) {
    const members = new Set(component);
    const internal = lineage.filter(edge => members.has(edge.subjectCharacterId) && members.has(edge.objectCharacterId));
    if (component.length > 1 || internal.some(edge => edge.subjectCharacterId === edge.objectCharacterId)) {
      component.forEach(id => groups.join(component[0], id));
      warnings.push({ code: 'PARENT_CYCLE', message: '계보 관계가 순환해 일부 인물의 세대를 정렬하지 못했어요. 표시된 관계와 근거를 확인해 주세요.', relationshipIds: internal.map(edge => edge.id) });
    }
  }
  function align(a: string, b: string, relationshipIds: string[]) {
    const from = groups.find(a), to = groups.find(b);
    if (from === to) return;
    const graph = directedGraph(ids, lineage, groups);
    const distances = new Map([[from, 0]]), pending = [from];
    for (let index = 0; index < pending.length; index++) {
      const current = pending[index];
      for (const edge of lineage) {
        const source = groups.find(edge.subjectCharacterId), target = groups.find(edge.objectCharacterId);
        const next = source === current ? target : target === current ? source : null;
        if (!next || distances.has(next)) continue;
        const gap = edge.kind === 'PARENT_OF' ? 1 : Math.max(1, edge.generationGap ?? 1);
        distances.set(next, distances.get(current)! + (source === current ? gap : -gap));
        pending.push(next);
      }
    }
    if (reaches(graph, from, to) || reaches(graph, to, from) || distances.has(to) && distances.get(to) !== 0) {
      warnings.push({ code: 'GENERATION_CONFLICT', message: '계보 방향을 유지하기 위해 일부 가족을 같은 높이에 놓지 못했어요.', relationshipIds });
      return;
    }
    groups.join(a, b);
  }
  edges.filter(edge => edge.kind === 'SPOUSE').forEach(edge => align(edge.subjectCharacterId, edge.objectCharacterId, [edge.id]));
  const byChild = new Map<string, FamilyTreeInputEdge[]>();
  parents.forEach(edge => { const list = byChild.get(edge.objectCharacterId) ?? []; list.push(edge); byChild.set(edge.objectCharacterId, list); });
  byChild.forEach(list => list.slice(1).forEach(edge => align(list[0].subjectCharacterId, edge.subjectCharacterId, [list[0].id, edge.id])));
  edges.filter(edge => edge.kind === 'SIBLING').forEach(edge => align(edge.subjectCharacterId, edge.objectCharacterId, [edge.id]));
  const graph = directedGraph(ids, lineage, groups);
  const constraints = new Map([...graph.keys()].map(id => [id, [] as { id: string; distance: number; edgeId: string }[]]));
  lineage.forEach(edge => {
    const from = groups.find(edge.subjectCharacterId), to = groups.find(edge.objectCharacterId);
    if (from === to) return;
    const distance = edge.kind === 'PARENT_OF' ? 1 : Math.max(1, edge.generationGap ?? 1);
    constraints.get(from)!.push({ id: to, distance, edgeId: edge.id });
    constraints.get(to)!.push({ id: from, distance: -distance, edgeId: edge.id });
  });
  const rank = new Map<string, number>();
  let conflict = false;
  for (const root of [...graph.keys()].sort(compare)) {
    if (rank.has(root)) continue;
    const queue = [root]; rank.set(root, 0);
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      for (const next of constraints.get(id)!) {
        const value = rank.get(id)! + next.distance;
        if (!rank.has(next.id)) { rank.set(next.id, value); queue.push(next.id); }
        else if (rank.get(next.id) !== value) conflict = true;
      }
    }
    const minimum = Math.min(...queue.map(id => rank.get(id)!));
    queue.forEach(id => rank.set(id, rank.get(id)! - minimum));
  }
  if (conflict) {
    warnings.push({ code: 'GENERATION_CONFLICT', message: '명시된 세대 수가 서로 맞지 않아 계보 방향을 우선해 표시했어요.', relationshipIds: lineage.map(edge => edge.id) });
    const incoming = new Map([...graph.keys()].map(id => [id, 0]));
    graph.forEach(children => children.forEach(id => incoming.set(id, incoming.get(id)! + 1)));
    rank.forEach((_, id) => rank.set(id, 0));
    const queue = [...incoming].filter(([, degree]) => degree === 0).map(([id]) => id).sort(compare);
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      [...graph.get(id)!].sort(compare).forEach(child => {
        rank.set(child, Math.max(rank.get(child)!, rank.get(id)! + 1));
        incoming.set(child, incoming.get(child)! - 1);
        if (incoming.get(child) === 0) queue.push(child);
      });
    }
  }
  const levels = [...new Set(rank.values())].sort((a, b) => a - b);
  return new Map(ids.map(id => [id, levels.indexOf(rank.get(groups.find(id)) ?? 0)]));
}

function parentJunctions(nodes: FamilyTreeLayoutNode[], edges: FamilyTreeInputEdge[], generationGap: number): FamilyTreeJunction[] {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const byChildAndKind = new Map<string, FamilyTreeInputEdge[]>();
  for (const edge of edges.filter(item => item.kind === 'PARENT_OF')) {
    const key = JSON.stringify([edge.objectCharacterId, edge.subtype ?? '', edge.temporalScope ?? '', edge.timeLabel ?? '']);
    const list = byChildAndKind.get(key) ?? []; list.push(edge); byChildAndKind.set(key, list);
  }
  const combinations = new Map<string, { parentIds: string[]; childIds: string[]; relationshipIds: string[] }>();
  byChildAndKind.forEach(list => {
    const parentIds = [...new Set(list.map(edge => edge.subjectCharacterId))].sort(compare);
    if (parentIds.length < 2) return;
    const first = list[0];
    const key = JSON.stringify([parentIds, first.subtype ?? '', first.temporalScope ?? '', first.timeLabel ?? '']);
    const group = combinations.get(key) ?? { parentIds, childIds: [], relationshipIds: [] };
    group.childIds.push(first.objectCharacterId); group.relationshipIds.push(...list.map(edge => edge.id)); combinations.set(key, group);
  });
  const result: FamilyTreeJunction[] = [];
  [...combinations].sort(([a], [b]) => compare(a, b)).forEach(([key, group], index) => {
    const parents = group.parentIds.map(id => byId.get(id)!), children = group.childIds.map(id => byId.get(id)!);
    const top = Math.max(...parents.map(node => node.position.y + node.height));
    const bottom = Math.min(...children.map(node => node.position.y));
    // A cycle cannot have an honest downward parent-combination connector.
    if (bottom <= top) return;
    const x = average([...parents, ...children].map(node => node.position.x + node.width / 2));
    const y = top + Math.min((bottom - top) / 2, generationGap / 2) + (index % 3 - 1) * 12;
    result.push({ id: `parents:${key}`, position: { x, y }, ...group,
      childIds: group.childIds.sort(compare), relationshipIds: group.relationshipIds.sort(compare) });
  });
  return result;
}

function routeEdges(nodes: FamilyTreeLayoutNode[], edges: FamilyTreeInputEdge[], junctions: FamilyTreeJunction[], generationGap: number) {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const rightBoundary = Math.max(...nodes.map(node => node.position.x + node.width));
  const sideBlocked = (person: FamilyTreeLayoutNode, right: boolean) => nodes.some(node => node.id !== person.id
    && (right ? node.position.x > person.position.x : node.position.x < person.position.x)
    && node.bandId === person.bandId && node.position.y < person.position.y + person.height / 2
    && node.position.y + node.height > person.position.y + person.height / 2);
  const junctionByEdge = new Map(junctions.flatMap(junction => junction.relationshipIds.map(id => [id, junction] as const)));
  const pairs = new Map<string, FamilyTreeInputEdge[]>();
  edges.forEach(edge => {
    const key = JSON.stringify([edge.subjectCharacterId, edge.objectCharacterId].sort(compare));
    const pair = pairs.get(key) ?? []; pair.push(edge); pairs.set(key, pair);
  });
  const routed = edges.map((edge, edgeIndex): FamilyTreeLayoutEdge => {
    const source = byId.get(edge.subjectCharacterId)!, target = byId.get(edge.objectCharacterId)!;
    const pair = pairs.get(JSON.stringify([source.id, target.id].sort(compare)))!;
    const lane = pair.findIndex(item => item.id === edge.id) - (pair.length - 1) / 2;
    const sourceCenter = source.position.x + source.width / 2, targetCenter = target.position.x + target.width / 2;
    let sourceHandle: FamilyTreeLayoutEdge['sourceHandle'], targetHandle: FamilyTreeLayoutEdge['targetHandle'];
    let points: FamilyTreePoint[], labelPosition: FamilyTreePoint;
    if (edge.kind === 'ANCESTOR_OF' && source.bandId !== target.bandId) {
      // Unknown-generation islands are connected sideways, outside the known
      // family's numbered rows. This line asserts ancestry, not a guessed rank.
      const forward = source.position.x < target.position.x;
      sourceHandle = forward ? 'right' : 'left'; targetHandle = forward ? 'left' : 'right';
      const start = { x: source.position.x + (forward ? source.width : 0), y: source.position.y + source.height / 2 };
      const end = { x: target.position.x + (forward ? 0 : target.width), y: target.position.y + target.height / 2 };
      const sourceBand = nodes.filter(node => node.bandId === source.bandId);
      const targetBand = nodes.filter(node => node.bandId === target.bandId);
      const leftBand = forward ? sourceBand : targetBand, rightBand = forward ? targetBand : sourceBand;
      const middleX = (Math.max(...leftBand.map(node => node.position.x + node.width))
        + Math.min(...rightBand.map(node => node.position.x))) / 2;
      const before = sideBlocked(source, forward) ? (() => {
        sourceHandle = 'top';
        const top = { x: sourceCenter, y: source.position.y };
        return [top, { x: top.x, y: top.y - 64 }, { x: middleX, y: top.y - 64 }];
      })() : [start, { x: middleX, y: start.y }];
      const after = sideBlocked(target, !forward) ? (() => {
        targetHandle = 'top';
        const top = { x: targetCenter, y: target.position.y };
        return [{ x: middleX, y: top.y - 64 }, { x: top.x, y: top.y - 64 }, top];
      })() : [{ x: middleX, y: end.y }, end];
      points = [...before, ...after];
      labelPosition = { x: middleX, y: (start.y + end.y) / 2 };
    } else if (edge.kind === 'ANCESTOR_OF' && source.generation < target.generation) {
      // Distant ancestry gets its own outer lane. It must not run through the
      // direct-child bar or appear to originate from a nearer descendant.
      sourceHandle = 'right'; targetHandle = 'right';
      const start = { x: source.position.x + source.width, y: source.position.y + source.height / 2 };
      const end = { x: target.position.x + target.width, y: target.position.y + target.height / 2 };
      const bandRight = Math.max(...nodes.filter(node => node.bandId === source.bandId).map(node => node.position.x + node.width));
      const ancestry = edges.filter(item => item.kind === 'ANCESTOR_OF' && byId.get(item.subjectCharacterId)!.bandId === source.bandId
        && byId.get(item.objectCharacterId)!.bandId === source.bandId)
        .sort((a, b) => byId.get(a.objectCharacterId)!.position.y - byId.get(b.objectCharacterId)!.position.y || compare(a.id, b.id));
      const index = ancestry.findIndex(item => item.id === edge.id);
      const sameRow = ancestry.filter(item => byId.get(item.objectCharacterId)!.generation === target.generation).length > 1;
      const outerX = bandRight + 132 + index * (sameRow ? 196 : 88);
      const exitY = start.y - index * 18;
      const before = sideBlocked(source, true) ? (() => {
        sourceHandle = 'top';
        const top = { x: sourceCenter, y: source.position.y };
        const gutter = top.y - 64 - index * 24;
        return [top, { x: top.x, y: gutter }, { x: outerX, y: gutter }];
      })() : [start, { x: start.x + 80, y: start.y }, { x: start.x + 80, y: exitY }, { x: outerX, y: exitY }];
      const after = sideBlocked(target, true) ? (() => {
        targetHandle = 'top';
        const top = { x: targetCenter, y: target.position.y };
        const gutter = top.y - 64;
        return [{ x: outerX, y: gutter }, { x: top.x, y: gutter }, top];
      })() : [{ x: outerX, y: end.y }, end];
      points = [...before, ...after];
      labelPosition = { x: outerX, y: end.y - 120 };
    } else if (isLineage(edge) && source.generation < target.generation) {
      sourceHandle = 'bottom'; targetHandle = 'top';
      const start = { x: sourceCenter, y: source.position.y + source.height }, end = { x: targetCenter, y: target.position.y };
      const junction = junctionByEdge.get(edge.id);
      const middle = junction?.position ?? { x: average([sourceCenter, targetCenter]),
        y: start.y + (edge.kind === 'ANCESTOR_OF' ? 64 : Math.min((end.y - start.y) / 2, generationGap / 2)) + lane * 16 };
      const outside = rightBoundary + 48 + edgeIndex % 8 * 16;
      const before = middle.y - start.y > generationGap
        ? [start, { x: start.x, y: start.y + 32 }, { x: outside, y: start.y + 32 }, { x: outside, y: middle.y }, middle]
        : [start, { x: start.x, y: middle.y }, middle];
      const after = end.y - middle.y > generationGap
        ? [{ x: outside, y: middle.y }, { x: outside, y: end.y - 32 }, { x: end.x, y: end.y - 32 }, end]
        : [{ x: end.x, y: middle.y }, end];
      points = [...before, ...after];
      labelPosition = { x: start.x + (middle.x - start.x) * 0.42 + lane * 22, y: middle.y - 14 - (edgeIndex % 2) * 20 };
    } else {
      // Horizontal/detoured links preserve original source/target even for contradictory parent data.
      const forward = source.position.x <= target.position.x;
      sourceHandle = forward ? 'right' : 'left'; targetHandle = forward ? 'left' : 'right';
      const start = { x: source.position.x + (forward ? source.width : 0), y: source.position.y + source.height / 2 };
      const end = { x: target.position.x + (forward ? 0 : target.width), y: target.position.y + target.height / 2 };
      if (source.id === target.id) {
        sourceHandle = 'right'; targetHandle = 'top';
        const top = source.position.y - 32 - Math.abs(lane) * 16;
        points = [start, { x: start.x + 36, y: start.y }, { x: start.x + 36, y: top }, { x: sourceCenter, y: top }, { x: sourceCenter, y: source.position.y }];
      } else if (source.generation === target.generation && pair.length === 1 && !nodes.some(node => node.id !== source.id && node.id !== target.id
        && node.generation === source.generation && node.position.x > Math.min(source.position.x, target.position.x)
        && node.position.x < Math.max(source.position.x, target.position.x))) {
        points = [start, end];
      } else {
        const top = Math.min(source.position.y, target.position.y) - 32 - (edgeIndex % 4) * 18 - Math.abs(lane) * 12;
        const exitX = start.x + (forward ? 18 : -18), entryX = end.x + (forward ? -18 : 18);
        points = [start, { x: exitX, y: start.y }, { x: exitX, y: top }, { x: entryX, y: top }, { x: entryX, y: end.y }, end];
      }
      const middleIndex = Math.floor((points.length - 1) / 2), left = points[middleIndex], right = points[middleIndex + 1] ?? left;
      labelPosition = { x: average([left.x, right.x]), y: average([left.y, right.y]) - 12 };
    }
    return { ...edge, relationshipId: edge.sourceType === 'MENTION' ? null : edge.relationshipId ?? edge.id, source: source.id, target: target.id, sourceHandle, targetHandle, points, labelPosition,
      labelAnchor: labelPosition, labelSize: { width: 180, height: 80 } };
  });
  placeLabels(routed, nodes, junctions);
  return routed;
}

function placeLabels(edges: FamilyTreeLayoutEdge[], nodes: FamilyTreeLayoutNode[], junctions: FamilyTreeJunction[]) {
  type Rectangle = { x: number; y: number; width: number; height: number };
  const occupied: Rectangle[] = [
    ...nodes.map(node => ({ ...node.position, width: node.width, height: node.height })),
    ...junctions.map(junction => ({ x: junction.position.x - 6, y: junction.position.y - 6, width: 12, height: 12 })),
  ];
  const left = Math.min(...nodes.map(node => node.position.x)) - 112;
  const right = Math.max(...nodes.map(node => node.position.x + node.width));
  const rectangle = (point: FamilyTreePoint, size: { width: number; height: number }) =>
    ({ x: point.x - size.width / 2, y: point.y - size.height / 2, ...size });
  const available = (rect: Rectangle) => rect.x >= left && rect.y >= 16 && !occupied.some(other =>
    rect.x < other.x + other.width + 8 && rect.x + rect.width + 8 > other.x
    && rect.y < other.y + other.height + 8 && rect.y + rect.height + 8 > other.y);
  for (const edge of edges) {
    const origin = edge.labelPosition;
    const candidates: FamilyTreePoint[] = [origin];
    if (edge.kind === 'PARENT_OF') {
      const start = edge.points[0], end = edge.points[edge.points.length - 1];
      const rowPositions = [start.y + edge.labelSize.height / 2 + 8, end.y - edge.labelSize.height / 2 - 8];
      const centers = [...new Set(nodes.map(node => node.position.x + node.width / 2))];
      candidates.push(...centers.flatMap(x => rowPositions.map(y => ({ x, y })))
        .sort((a, b) => (a.x - origin.x) ** 2 + (a.y - origin.y) ** 2 - (b.x - origin.x) ** 2 - (b.y - origin.y) ** 2));
    } else {
      const people = nodes.filter(node => node.id === edge.source || node.id === edge.target);
      const x = average(people.map(node => node.position.x + node.width / 2));
      candidates.push({ x, y: Math.min(...people.map(node => node.position.y)) - edge.labelSize.height / 2 - 8 },
        { x, y: Math.max(...people.map(node => node.position.y + node.height)) + edge.labelSize.height / 2 + 8 });
    }
    for (let ring = 0; ring <= 6; ring++) {
      for (let column = -ring; column <= ring; column++) {
        const row = ring - Math.abs(column);
        for (const direction of row ? [-1, 1] : [1]) candidates.push({ x: origin.x + column * 196, y: origin.y + row * direction * 96 });
      }
    }
    let selected = candidates.find(point => available(rectangle(point, edge.labelSize)));
    if (!selected) {
      let row = 0;
      do { selected = { x: right + 130, y: 64 + row++ * 96 }; } while (!available(rectangle(selected, edge.labelSize)));
    }
    edge.labelPosition = selected;
    occupied.push(rectangle(selected, edge.labelSize));
    let nearest = edge.points[0], distance = Number.POSITIVE_INFINITY;
    edge.points.slice(1).forEach((point, index) => {
      const previous = edge.points[index];
      const projected = { x: Math.max(Math.min(point.x, previous.x), Math.min(Math.max(point.x, previous.x), selected.x)),
        y: Math.max(Math.min(point.y, previous.y), Math.min(Math.max(point.y, previous.y), selected.y)) };
      const squared = (projected.x - selected.x) ** 2 + (projected.y - selected.y) ** 2;
      if (squared < distance) { distance = squared; nearest = projected; }
    });
    edge.labelAnchor = nearest;
  }
}

// A spouse chain gets a stable left-to-right order, so a person with two partners
// sits between them. This changes geometry only; it does not create a marriage.
function arrangeSpouseRows(nodes: FamilyTreeLayoutNode[], edges: FamilyTreeInputEdge[], gap: number) {
  const rows = new Map<number, FamilyTreeLayoutNode[]>();
  nodes.forEach(node => { const row = rows.get(node.generation) ?? []; row.push(node); rows.set(node.generation, row); });
  rows.forEach(row => {
    row.sort((a, b) => a.position.x - b.position.x || compare(a.id, b.id));
    const byId = new Map(row.map(node => [node.id, node]));
    const adjacent = new Map(row.map(node => [node.id, new Set<string>()]));
    edges.filter(edge => edge.kind === 'SPOUSE' && byId.has(edge.subjectCharacterId) && byId.has(edge.objectCharacterId))
      .forEach(edge => { adjacent.get(edge.subjectCharacterId)!.add(edge.objectCharacterId); adjacent.get(edge.objectCharacterId)!.add(edge.subjectCharacterId); });
    const visited = new Set<string>(), ordered: FamilyTreeLayoutNode[] = [];
    for (const node of row) {
      if (visited.has(node.id)) continue;
      const pending = [node.id], members = new Set<string>();
      while (pending.length) {
        const id = pending.pop()!;
        if (members.has(id)) continue;
        members.add(id); adjacent.get(id)!.forEach(next => pending.push(next));
      }
      const endpoints = [...members].filter(id => adjacent.get(id)!.size === 1).sort(compare);
      if (members.size > 1 && endpoints.length === 2 && [...members].every(id => adjacent.get(id)!.size <= 2)) {
        let id: string | undefined = endpoints[0];
        while (id) {
          visited.add(id); ordered.push(byId.get(id)!);
          id = [...adjacent.get(id)!].find(next => !visited.has(next));
        }
      } else {
        row.filter(item => members.has(item.id)).forEach(item => { visited.add(item.id); ordered.push(item); });
      }
    }
    const start = Math.min(...row.map(node => node.position.x));
    ordered.forEach((node, index) => { node.position.x = start + index * (node.width + gap); });
  });
  // Keep siblings near the center of their own confirmed parent set. Partners
  // already placed in this row remain together rather than being torn apart.
  [...rows].sort(([a], [b]) => a - b).forEach(([generation, row]) => {
    if (!generation || edges.some(edge => edge.kind === 'SPOUSE' && row.some(node => node.id === edge.subjectCharacterId || node.id === edge.objectCharacterId))) return;
    const byId = new Map(nodes.map(node => [node.id, node]));
    const groups = new Map<string, FamilyTreeLayoutNode[]>();
    for (const node of row) {
      const parentIds = [...new Set(edges.filter(edge => edge.kind === 'PARENT_OF' && edge.objectCharacterId === node.id
        && byId.get(edge.subjectCharacterId)!.generation < generation).map(edge => edge.subjectCharacterId))].sort(compare);
      const key = parentIds.length ? JSON.stringify(parentIds) : `unconnected:${node.id}`;
      const group = groups.get(key) ?? []; group.push(node); groups.set(key, group);
    }
    const blocks = [...groups.values()].map(group => {
      const parents = edges.filter(edge => edge.kind === 'PARENT_OF' && edge.objectCharacterId === group[0].id
        && byId.get(edge.subjectCharacterId)!.generation < generation).map(edge => byId.get(edge.subjectCharacterId)!);
      group.sort((a, b) => a.position.x - b.position.x || compare(a.id, b.id));
      const width = group.reduce((sum, node) => sum + node.width, 0) + (group.length - 1) * gap;
      const ancestors = edges.filter(edge => edge.kind === 'ANCESTOR_OF' && !isUnknownAncestry(edge) && edge.objectCharacterId === group[0].id
        && byId.get(edge.subjectCharacterId)!.generation < generation).map(edge => byId.get(edge.subjectCharacterId)!);
      const anchors = parents.length ? parents : ancestors;
      const center = anchors.length ? average([...new Set(anchors)].map(node => node.position.x + node.width / 2))
        : average(group.map(node => node.position.x + node.width / 2));
      return { group, desired: center - width / 2, width };
    }).sort((a, b) => a.desired - b.desired || compare(a.group[0].id, b.group[0].id));
    let cursor = Number.NEGATIVE_INFINITY;
    for (const block of blocks) {
      const start = Math.max(cursor, block.desired);
      block.group.forEach((node, index) => { node.position.x = start + index * (node.width + gap); });
      cursor = start + block.width + gap;
    }
    const shift = average(blocks.map(block => block.desired - block.group[0].position.x));
    row.forEach(node => { node.position.x += shift; });
  });
}

function shortConnectionLabel(edge: FamilyTreeInputEdge, childCount?: number) {
  const history = edge.temporalScope === 'HISTORICAL' ? '과거 ' : '';
  if (edge.kind === 'ANCESTOR_OF') return `${history}${edge.generationGap != null ? `${edge.generationGap}대손` : '후손 · 세대 미상'}`;
  if (edge.kind === 'SPOUSE') return `${history}배우자`;
  if (edge.kind === 'SIBLING') return `${history}${edge.subtype === 'HALF' ? '이복 형제' : edge.subtype === 'STEP' ? '의붓 형제' : '형제·자매'}`;
  const subtype = edge.subtype === 'ADOPTIVE' ? '입양 · ' : edge.subtype === 'STEP' ? '의붓 · ' : '';
  return (childCount ?? 1) > 1 ? `${history}${subtype}자녀 ${childCount}명` : `${history}${subtype}`.trim().replace(/ ·$/, '');
}

const ROLE_LABELS: Record<FamilyTreeRole, string> = { PARENT: '부모', FATHER: '아버지', MOTHER: '어머니', CHILD: '자녀', SON: '아들', DAUGHTER: '딸', ANCESTOR: '조상', DESCENDANT: '후손' };

function endpointLabel(node: FamilyTreeLayoutNode, edges: FamilyTreeLayoutEdge[], side: 'parent' | 'child', position: FamilyTreePoint): FamilyTreeEndpointLabel {
  const roles = edges.map(edge => side === 'parent' ? edge.subjectRole : edge.objectRole);
  const first = roles[0];
  const specific = side === 'parent' ? first === 'FATHER' || first === 'MOTHER' : first === 'SON' || first === 'DAUGHTER';
  // Generic can also mean conflicting source facts, so one specific edge cannot override it.
  const role: FamilyTreeRole = specific && roles.every(value => value === first) ? first! : side === 'parent' ? 'PARENT' : 'CHILD';
  const relationshipIds = edges.map(edge => edge.id).sort(compare);
  return { id: `${side}:${node.id}:${relationshipIds.join(',')}`, personId: node.id, personName: node.name, role, label: ROLE_LABELS[role],
    position, size: { width: 60, height: 44 }, relationshipIds };
}

function ancestryConnection(edge: FamilyTreeLayoutEdge, byId: Map<string, FamilyTreeLayoutNode>): FamilyTreeConnection {
  // Keep the break on the routed line, including detours around a known family.
  const points: FamilyTreePoint[] = [];
  for (const point of edge.points) {
    const previous = points[points.length - 1], before = points[points.length - 2];
    if (previous && previous.x === point.x && previous.y === point.y) continue;
    if (before && previous && (before.x === previous.x && previous.x === point.x || before.y === previous.y && previous.y === point.y)) points.pop();
    points.push({ ...point });
  }
  const segments = points.slice(1).map((to, index) => {
    const from = points[index];
    return { index, from, to, vertical: from.x === to.x, length: Math.abs(to.x - from.x) + Math.abs(to.y - from.y) };
  }).filter(segment => segment.length >= 48);
  const priority = (segment: typeof segments[number]) => segment.vertical && segment.length >= 128 ? 2 : !segment.vertical ? 1 : 0;
  segments.sort((a, b) => priority(b) - priority(a) || b.index - a.index || b.length - a.length);
  const segment = segments[0];
  const position = segment ? { x: (segment.from.x + segment.to.x) / 2,
    y: segment.vertical && segment.length >= 240 ? segment.to.y - Math.sign(segment.to.y - segment.from.y) * 180
      : (segment.from.y + segment.to.y) / 2 - (segment.vertical && segment.length >= 180 ? 32 : 0) } : edge.labelAnchor;
  const direction = segment?.vertical ? 'vertical' as const : 'horizontal' as const;
  const paths = segment ? (() => {
    const dx = Math.sign(segment.to.x - segment.from.x), dy = Math.sign(segment.to.y - segment.from.y);
    return [
      [...points.slice(0, segment.index + 1), { x: position.x - dx * 12, y: position.y - dy * 12 }],
      [{ x: position.x + dx * 12, y: position.y + dy * 12 }, ...points.slice(segment.index + 1)],
    ];
  })() : [edge.points.map(point => ({ ...point }))];
  const endpoint = (nodeId: string, role: 'ANCESTOR' | 'DESCENDANT', point: FamilyTreePoint, handle: FamilyTreeLayoutEdge['sourceHandle']): FamilyTreeEndpointLabel =>
    ({ id: `${role}:${edge.id}`, personId: nodeId, personName: byId.get(nodeId)!.name, role, label: ROLE_LABELS[role],
      position: nearEndpoint(point, handle), size: { width: 60, height: 44 }, relationshipIds: [edge.id] });
  return { id: `relationship:${edge.id}`, kind: edge.kind, subtype: edge.subtype, temporalScope: edge.temporalScope, timeLabel: edge.timeLabel,
    generationGap: edge.generationGap, paths, lineageBreak: segment ? { position, direction } : undefined,
    label: shortConnectionLabel(edge), detailLabel: '중간 계보 생략',
    labelPosition: { x: position.x, y: position.y + 56 },
    labelSize: { width: 168, height: 60 }, relationshipIds: [edge.id], personIds: [edge.source, edge.target],
    endpointLabels: [
      endpoint(edge.source, 'ANCESTOR', edge.points[0], edge.sourceHandle),
      endpoint(edge.target, 'DESCENDANT', edge.points[edge.points.length - 1], edge.targetHandle),
    ] };
}

function visualConnections(nodes: FamilyTreeLayoutNode[], edges: FamilyTreeLayoutEdge[], regions: FamilyTreeLayout['regions']): FamilyTreeConnection[] {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const center = (node: FamilyTreeLayoutNode) => node.position.x + node.width / 2;
  const scope = (edge: FamilyTreeInputEdge) => JSON.stringify([edge.subtype ?? '', edge.temporalScope ?? '', edge.timeLabel ?? '']);
  const parentSets = new Map<string, FamilyTreeLayoutEdge[]>();
  for (const edge of edges.filter(edge => edge.kind === 'PARENT_OF' && byId.get(edge.source)!.generation < byId.get(edge.target)!.generation)) {
    const key = JSON.stringify([edge.target, scope(edge)]), set = parentSets.get(key) ?? [];
    set.push(edge); parentSets.set(key, set);
  }
  const groups = new Map<string, { parentIds: string[]; childIds: string[]; edges: FamilyTreeLayoutEdge[] }>();
  parentSets.forEach(set => {
    const parentIds = [...new Set(set.map(edge => edge.source))].sort(compare);
    // Different parent generations are an ambiguous layout, so keep their
    // separately routed original connections rather than implying a union.
    if (new Set(parentIds.map(id => byId.get(id)!.generation)).size !== 1) return;
    const key = JSON.stringify([parentIds, scope(set[0])]);
    const group = groups.get(key) ?? { parentIds, childIds: [], edges: [] };
    group.childIds.push(set[0].target); group.edges.push(...set); groups.set(key, group);
  });
  const bundles = [...groups].sort(([a], [b]) => compare(a, b));
  const used = new Set<string>(), result: FamilyTreeConnection[] = [];
  for (const [groupIndex, [key, group]] of bundles.entries()) {
    const first = group.edges[0], parents = group.parentIds.map(id => byId.get(id)!);
    const children = group.childIds.map(id => byId.get(id)!);
    const parentBottom = Math.max(...parents.map(node => node.position.y + node.height));
    const childTop = Math.min(...children.map(node => node.position.y));
    // Multi-generation connectors keep the safe original detours around cards.
    if (children.some(node => node.generation !== parents[0].generation + 1)) continue;
    const parentCenter = average(parents.map(center));
    const spouse = group.parentIds.length === 2 ? edges.find(edge => edge.kind === 'SPOUSE'
      && group.parentIds.includes(edge.source) && group.parentIds.includes(edge.target)
      && edge.temporalScope === first.temporalScope && (edge.timeLabel ?? '') === (first.timeLabel ?? '')
      && edge.points.length === 2 && edge.points[0].y === edge.points[1].y) : undefined;
    const lane = groupIndex % 3;
    const joinY = spouse ? spouse.points[0].y : parentBottom + 56 + lane * 12;
    const branchY = Math.max(joinY + 32, childTop - 56 - lane * 12);
    const paths: FamilyTreePoint[][] = [];
    if (!spouse) {
      parents.forEach(node => paths.push([{ x: center(node), y: node.position.y + node.height }, { x: center(node), y: joinY }]));
      if (parents.length > 1) paths.push([{ x: Math.min(...parents.map(center)), y: joinY }, { x: Math.max(...parents.map(center)), y: joinY }]);
    }
    paths.push([{ x: parentCenter, y: joinY }, { x: parentCenter, y: branchY }]);
    const childAnchors = children.map(node => {
      const owners = bundles.filter(([, bundle]) => bundle.childIds.includes(node.id));
      const slot = owners.findIndex(([id]) => id === key) - (owners.length - 1) / 2;
      return { node, x: center(node) + Math.max(-node.width / 3, Math.min(node.width / 3, slot * 24)) };
    });
    const minimum = Math.min(parentCenter, ...childAnchors.map(anchor => anchor.x));
    const maximum = Math.max(parentCenter, ...childAnchors.map(anchor => anchor.x));
    if (minimum !== maximum) paths.push([{ x: minimum, y: branchY }, { x: maximum, y: branchY }]);
    childAnchors.forEach(({ node, x }) => paths.push([{ x, y: branchY }, { x, y: node.position.y }]));
    const siblingIds = edges.filter(edge => edge.kind === 'SIBLING' && !used.has(edge.id)
      && group.childIds.includes(edge.source) && group.childIds.includes(edge.target)
      && (edge.subtype === 'FULL' ? first.subtype === 'BIOLOGICAL'
        : (!edge.subtype || edge.subtype === 'UNSPECIFIED') && (!first.subtype || first.subtype === 'BIOLOGICAL' || first.subtype === 'UNSPECIFIED'))
      && edge.temporalScope === first.temporalScope && (edge.timeLabel ?? '') === (first.timeLabel ?? '')).map(edge => edge.id);
    const relationshipIds = [...group.edges.map(edge => edge.id), ...siblingIds].sort(compare);
    relationshipIds.forEach(id => used.add(id));
    const endpointLabels = [
      ...parents.map(node => endpointLabel(node, group.edges.filter(edge => edge.source === node.id), 'parent',
        { x: center(node), y: node.position.y + node.height + 28 })),
      ...childAnchors.map(({ node, x }) => endpointLabel(node, group.edges.filter(edge => edge.target === node.id), 'child', { x, y: node.position.y - 28 })),
    ];
    result.push({ id: `family:${key}`, kind: 'PARENT_OF', subtype: first.subtype, temporalScope: first.temporalScope, timeLabel: first.timeLabel,
      paths, label: shortConnectionLabel(first, children.length), labelPosition: { x: parentCenter, y: (joinY + branchY) / 2 }, labelSize: { width: 112, height: 44 },
      relationshipIds, personIds: [...group.parentIds, ...group.childIds].sort(compare), endpointLabels });
  }
  edges.filter(edge => !used.has(edge.id)).forEach(edge => {
    if (edge.kind === 'ANCESTOR_OF') {
      result.push(ancestryConnection(edge, byId));
      return;
    }
    const endpointLabels = edge.kind === 'PARENT_OF' ? [
      endpointLabel(byId.get(edge.source)!, [edge], 'parent', nearEndpoint(edge.points[0], edge.sourceHandle)),
      endpointLabel(byId.get(edge.target)!, [edge], 'child', nearEndpoint(edge.points[edge.points.length - 1], edge.targetHandle)),
    ] : [];
    result.push({ id: `relationship:${edge.id}`, kind: edge.kind, subtype: edge.subtype, temporalScope: edge.temporalScope, timeLabel: edge.timeLabel,
      paths: [edge.points.map(point => ({ ...point }))], label: shortConnectionLabel(edge),
      labelPosition: edge.kind === 'PARENT_OF' ? { ...edge.labelPosition } : {
        x: (edge.points[Math.floor((edge.points.length - 1) / 2)].x + edge.points[Math.ceil((edge.points.length - 1) / 2)].x) / 2,
        y: (edge.points[Math.floor((edge.points.length - 1) / 2)].y + edge.points[Math.ceil((edge.points.length - 1) / 2)].y) / 2,
      }, labelSize: { width: edge.kind === 'SPOUSE' ? 104 : 112, height: 44 }, relationshipIds: [edge.id], personIds: [...new Set([edge.source, edge.target])].sort(compare), endpointLabels });
  });
  // Share identical source roles across branches, including biological/adoptive
  // children. Keep each branch and its evidence separate; the role opens their union.
  const sourceLabels = new Map<string, FamilyTreeEndpointLabel>();
  for (const connection of result) {
    connection.endpointLabels = connection.endpointLabels.filter(label => {
      if (!['PARENT', 'FATHER', 'MOTHER', 'ANCESTOR'].includes(label.role)) return true;
      const key = JSON.stringify([label.personId, label.role, connection.temporalScope, connection.timeLabel]);
      const shared = sourceLabels.get(key);
      if (!shared) { sourceLabels.set(key, label); return true; }
      shared.relationshipIds = [...new Set([...shared.relationshipIds, ...label.relationshipIds])].sort(compare);
      return false;
    });
  }
  placeEndpointLabels(result, nodes, regions);
  placeConnectionLabels(result, nodes, regions);
  return result.sort((a, b) => compare(a.id, b.id));
}

function nearEndpoint(point: FamilyTreePoint, handle: FamilyTreeLayoutEdge['sourceHandle']) {
  return { x: point.x + (handle === 'left' ? -36 : handle === 'right' ? 36 : 0), y: point.y + (handle === 'top' ? -28 : handle === 'bottom' ? 28 : 0) };
}

function placeEndpointLabels(connections: FamilyTreeConnection[], nodes: FamilyTreeLayoutNode[], regions: FamilyTreeLayout['regions']) {
  const occupied = [...nodes.map(node => ({ ...node.position, width: node.width, height: node.height })),
    ...regions.map(region => ({ ...region.position, width: region.width, height: 70 }))];
  for (const label of connections.flatMap(connection => connection.endpointLabels)) {
    const rect = (point: FamilyTreePoint) => ({ x: point.x - label.size.width / 2, y: point.y - label.size.height / 2, ...label.size });
    const free = (point: FamilyTreePoint) => {
      const box = rect(point);
      return !occupied.some(other => box.x < other.x + other.width + 4 && box.x + box.width + 4 > other.x
        && box.y < other.y + other.height + 4 && box.y + box.height + 4 > other.y);
    };
    const origin = label.position, candidates = [origin];
    // Search locally first so a role stays next to its own person, including parallel adoption paths.
    for (let ring = 1; ring <= 12; ring++) {
      for (let x = -ring; x <= ring; x++) {
        const y = ring - Math.abs(x);
        for (const sign of y ? [-1, 1] : [1]) candidates.push({ x: origin.x + x * 68, y: origin.y + y * sign * 48 });
      }
    }
    label.position = candidates.find(free) ?? origin;
    occupied.push(rect(label.position));
  }
}

function placeConnectionLabels(connections: FamilyTreeConnection[], nodes: FamilyTreeLayoutNode[], regions: FamilyTreeLayout['regions']) {
  type Rectangle = { x: number; y: number; width: number; height: number };
  const occupied: Rectangle[] = [
    ...nodes.map(node => ({ ...node.position, width: node.width, height: node.height })),
    ...regions.map(region => ({ ...region.position, width: region.width, height: 70 })),
    ...connections.flatMap(connection => connection.endpointLabels.map(label => ({ x: label.position.x - label.size.width / 2, y: label.position.y - label.size.height / 2, ...label.size }))),
    ...connections.flatMap(connection => connection.lineageBreak
      ? [{ x: connection.lineageBreak.position.x - 12, y: connection.lineageBreak.position.y - 12, width: 24, height: 24 }] : []),
  ];
  for (const connection of connections) {
    if (!connection.label) continue;
    const origin = connection.labelPosition, size = connection.labelSize;
    const rect = (point: FamilyTreePoint) => ({ x: point.x - size.width / 2, y: point.y - size.height / 2, ...size });
    const free = (point: FamilyTreePoint) => {
      const box = rect(point);
      return !occupied.some(other => box.x < other.x + other.width + 8 && box.x + box.width + 8 > other.x
        && box.y < other.y + other.height + 8 && box.y + box.height + 8 > other.y);
    };
    const candidates = [origin];
    for (let step = 1; step <= 12; step++) {
      candidates.push({ x: origin.x, y: origin.y - step * 52 }, { x: origin.x, y: origin.y + step * 52 },
        { x: origin.x - step * 128, y: origin.y }, { x: origin.x + step * 128, y: origin.y });
    }
    let selected = candidates.find(free);
    if (!selected) {
      const right = Math.max(...nodes.map(node => node.position.x + node.width));
      let row = 0;
      do { selected = { x: right + 80, y: 32 + row++ * 52 }; } while (!free(selected));
    }
    connection.labelPosition = selected; occupied.push(rect(selected));
  }
}

/** Only confirmed input edges influence layout; no names, birth order, missing parents, or marriage are inferred. */
export async function layoutFamilyTree(input: FamilyTreeInput, options: FamilyTreeLayoutOptions = {}): Promise<FamilyTreeLayout> {
  const width = options.nodeWidth ?? FAMILY_TREE_NODE_WIDTH, height = options.nodeHeight ?? FAMILY_TREE_NODE_HEIGHT;
  const nodeGap = Math.max(128, options.nodeGap ?? 128);
  const warnings: FamilyTreeLayoutWarning[] = [], seenNodes = new Set<string>(), seenEdges = new Set<string>();
  const nodes = [...input.nodes].sort((a, b) => compare(a.id, b.id)).filter(node => {
    if (seenNodes.has(node.id)) { warnings.push({ code: 'DUPLICATE_ID', message: '중복된 인물 식별자를 한 번만 표시했어요.', relationshipIds: [] }); return false; }
    seenNodes.add(node.id); return true;
  });
  const edges = [...input.edges].sort((a, b) => compare(a.id, b.id)).filter(edge => {
    if (seenEdges.has(edge.id)) { warnings.push({ code: 'DUPLICATE_ID', message: '중복된 관계 식별자를 한 번만 표시했어요.', relationshipIds: [edge.id] }); return false; }
    seenEdges.add(edge.id);
    if (!seenNodes.has(edge.subjectCharacterId) || !seenNodes.has(edge.objectCharacterId)) {
      warnings.push({ code: 'MISSING_PERSON', message: '양쪽 인물이 모두 조회되지 않은 관계는 그림에 연결하지 못했어요. 관계 목록에서 확인해 주세요.', relationshipIds: [edge.id] }); return false;
    }
    return true;
  });
  if (!nodes.length) return { nodes: [], edges: [], junctions: [], connections: [], regions: [], components: [], warnings, width: 0, height: 0 };
  const connected = new Groups(nodes.map(node => node.id));
  edges.forEach(edge => connected.join(edge.subjectCharacterId, edge.objectCharacterId));
  const components = new Map<string, FamilyTreeInputNode[]>();
  nodes.forEach(node => { const id = connected.find(node.id), group = components.get(id) ?? []; group.push(node); components.set(id, group); });
  const result: FamilyTreeLayout = { nodes: [], edges: [], junctions: [], connections: [], regions: [], components: [], warnings, width: 0, height: 0 };
  let offsetX = 0;
  const elk = new ELK();
  for (const [componentId, members] of [...components].sort(([a], [b]) => compare(a, b))) {
    const memberIds = new Set(members.map(node => node.id)), componentEdges = edges.filter(edge => memberIds.has(edge.subjectCharacterId));
    const generationGap = Math.max(componentEdges.some(edge => edge.kind === 'ANCESTOR_OF') ? 180 : 160, options.generationGap ?? 160);
    for (const cycle of stronglyConnected([...memberIds], componentEdges.filter(isLineage))) {
      const cycleIds = new Set(cycle);
      const internal = componentEdges.filter(edge => isLineage(edge) && cycleIds.has(edge.subjectCharacterId) && cycleIds.has(edge.objectCharacterId));
      if (internal.some(isUnknownAncestry) && (cycle.length > 1 || internal.some(edge => edge.subjectCharacterId === edge.objectCharacterId))) {
        warnings.push({ code: 'PARENT_CYCLE', message: '세대 미상 관계를 포함한 계보가 순환해요. 관계와 근거를 확인해 주세요.', relationshipIds: internal.map(edge => edge.id) });
      }
    }
    const knownGroups = new Groups(members.map(node => node.id));
    componentEdges.filter(edge => !isUnknownAncestry(edge)).forEach(edge => knownGroups.join(edge.subjectCharacterId, edge.objectCharacterId));
    const bands = new Map<string, FamilyTreeInputNode[]>();
    members.forEach(node => { const id = knownGroups.find(node.id), list = bands.get(id) ?? []; list.push(node); bands.set(id, list); });
    // The largest known family remains central. Separate islands connected only
    // by unknown ancestry live in a clearly bounded side area, with their own rows.
    const orderedBands = [...bands].sort(([a, an], [b, bn]) => bn.length - an.length || compare(a, b));
    const placed: FamilyTreeLayoutNode[] = [];
    const regions: FamilyTreeLayout['regions'] = [];
    let sideY = 128;
    for (const [bandIndex, [bandId, bandMembers]] of orderedBands.entries()) {
      const bandIds = new Set(bandMembers.map(node => node.id));
      const bandEdges = componentEdges.filter(edge => bandIds.has(edge.subjectCharacterId) && bandIds.has(edge.objectCharacterId));
      const rank = generationRanks(bandMembers, bandEdges, warnings);
      const elkX = new Map<string, number>();
      const dense = nodes.length > 350 || edges.length > 1400;
      if (dense) {
        if (!warnings.some(warning => warning.code === 'DENSE_GRAPH')) warnings.push({ code: 'DENSE_GRAPH', message: '인물이나 관계가 많아 세대별 단순 배치로 표시했어요. 확대하거나 인물을 선택해 확인해 주세요.', relationshipIds: [] });
      } else {
        try {
          const graph = await elk.layout({ id: bandId,
            layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'DOWN', 'elk.edgeRouting': 'ORTHOGONAL',
              'elk.partitioning.activate': 'true', 'elk.spacing.nodeNode': String(nodeGap), 'elk.layered.spacing.nodeNodeBetweenLayers': String(generationGap),
              'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES', 'elk.randomSeed': '1' },
            children: bandMembers.map(node => ({ id: node.id, width, height, layoutOptions: { 'elk.partitioning.partition': String(rank.get(node.id)) } })),
            edges: bandEdges.filter(edge => isLineage(edge) && !isUnknownAncestry(edge) && rank.get(edge.subjectCharacterId)! < rank.get(edge.objectCharacterId)!)
              .map(edge => ({ id: edge.id, sources: [edge.subjectCharacterId], targets: [edge.objectCharacterId] })),
          });
          graph.children?.forEach(node => elkX.set(node.id, node.x ?? 0));
        } catch {
          warnings.push({ code: 'LAYOUT_FALLBACK', message: '자동 배치를 완료하지 못해 세대별 기본 배치로 표시했어요. 관계와 근거는 그대로 확인할 수 있어요.', relationshipIds: [] });
        }
      }
      const rows = new Map<number, FamilyTreeInputNode[]>();
      bandMembers.forEach(node => { const generation = rank.get(node.id)!, row = rows.get(generation) ?? []; row.push(node); rows.set(generation, row); });
      const bandNodes: FamilyTreeLayoutNode[] = [];
      let rowY = 128;
      for (const [generation, row] of [...rows].sort(([a], [b]) => a - b)) {
        if (generation > 0) {
          const hasDirectChildren = bandEdges.some(edge => edge.kind === 'PARENT_OF' && row.some(node => node.id === edge.objectCharacterId));
          rowY += height + (hasDirectChildren ? generationGap : Math.min(generationGap, 128));
        }
        row.sort((a, b) => (elkX.get(a.id) ?? 0) - (elkX.get(b.id) ?? 0) || compare(a.id, b.id));
        let cursor = 0;
        row.forEach(node => {
          const x = Math.max(cursor, elkX.get(node.id) ?? cursor);
          bandNodes.push({ ...node, characterId: node.nodeType === 'MENTION' ? null : node.characterId ?? node.id,
            position: { x, y: rowY }, width, height, generation, componentId, bandId });
          cursor = x + width + nodeGap;
        });
      }
      arrangeSpouseRows(bandNodes, bandEdges, nodeGap);
      const left = Math.min(...bandNodes.map(node => node.position.x));
      const right = Math.max(...bandNodes.map(node => node.position.x + width));
      const bottom = Math.max(...bandNodes.map(node => node.position.y + height));
      if (bandIndex === 0) {
        bandNodes.forEach(node => { node.position.x += offsetX + 128 - left; });
      } else {
        // Side islands are intentionally not aligned to a numbered generation.
        const regionWidth = right - left + 64;
        const regionHeight = bottom - 128 + 160;
        bandNodes.forEach(node => { node.position.x += offsetX - regionWidth - 160 + 32 - left; node.position.y += sideY - 128 + 88; });
        regions.push({ id: `unknown:${bandId}`, label: '세대 미상', position: { x: offsetX - regionWidth - 160, y: sideY }, width: regionWidth, height: regionHeight });
        sideY += regionHeight + 100;
      }
      placed.push(...bandNodes);
    }
    const junctions = parentJunctions(placed, componentEdges, generationGap);
    const routed = routeEdges(placed, componentEdges, junctions, generationGap);
    const connections = visualConnections(placed, routed, regions);
    const pathPoints = connections.flatMap(connection => connection.paths.flat());
    const labelBoxes = connections.flatMap(connection => [
      ...(connection.label ? [{ position: connection.labelPosition, size: connection.labelSize }] : []),
      ...connection.endpointLabels,
    ]);
    const left = Math.min(...placed.map(node => node.position.x), ...pathPoints.map(point => point.x),
      ...labelBoxes.map(label => label.position.x - label.size.width / 2), ...regions.map(region => region.position.x));
    const top = Math.min(...placed.map(node => node.position.y), ...pathPoints.map(point => point.y),
      ...labelBoxes.map(label => label.position.y - label.size.height / 2), ...regions.map(region => region.position.y));
    const contentRight = Math.max(...placed.map(node => node.position.x + width), ...pathPoints.map(point => point.x),
      ...labelBoxes.map(label => label.position.x + label.size.width / 2), ...regions.map(region => region.position.x + region.width));
    const contentBottom = Math.max(...placed.map(node => node.position.y + height), ...pathPoints.map(point => point.y),
      ...labelBoxes.map(label => label.position.y + label.size.height / 2), ...regions.map(region => region.position.y + region.height));
    const shift = (point: FamilyTreePoint) => ({ x: point.x + offsetX + 32 - left, y: point.y + 32 - top });
    placed.forEach(node => { node.position = shift(node.position); });
    regions.forEach(region => { region.position = shift(region.position); });
    junctions.forEach(junction => { junction.position = shift(junction.position); });
    routed.forEach(edge => { edge.points = edge.points.map(shift); edge.labelPosition = shift(edge.labelPosition); edge.labelAnchor = shift(edge.labelAnchor); });
    connections.forEach(connection => { connection.paths = connection.paths.map(path => path.map(shift)); connection.labelPosition = shift(connection.labelPosition); connection.endpointLabels.forEach(label => { label.position = shift(label.position); }); if (connection.lineageBreak) connection.lineageBreak.position = shift(connection.lineageBreak.position); });
    const right = offsetX + contentRight - left + 64;
    const bottom = contentBottom - top + 64;
    result.nodes.push(...placed); result.edges.push(...routed); result.junctions.push(...junctions); result.connections.push(...connections); result.regions.push(...regions);
    result.components.push({ id: componentId, x: offsetX, y: 0, width: right - offsetX, height: bottom });
    result.height = Math.max(result.height, bottom); offsetX = right + 160;
  }
  result.nodes.sort((a, b) => compare(a.id, b.id)); result.edges.sort((a, b) => compare(a.id, b.id));
  result.width = offsetX - 160;
  return result;
}
