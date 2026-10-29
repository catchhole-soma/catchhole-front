/** Display-only input. Identity, direction, and cutoff are decided by the server. */
export type EpisodePerson = { id: string; name: string; description?: string; registered?: boolean };
export type EpisodeConnection = {
  id: string; source: string; target: string; label: string; summary: string;
  direction: 'DIRECTED' | 'MUTUAL' | 'UNDIRECTED'; ended: boolean;
};
export const PERSON_WIDTH = 184;
export const PERSON_HEIGHT = 78;

/** Deterministic components and rings: spatial placement does not imply rank or kinship. */
export function layoutEpisodeRelationships(people: EpisodePerson[], connections: EpisodeConnection[], focusId = '') {
  const byId = new Map(people.map(person => [person.id, person]));
  const adjacent = new Map(people.map(person => [person.id, new Set<string>()]));
  for (const edge of connections) {
    if (edge.source === edge.target || !byId.has(edge.source) || !byId.has(edge.target)) continue;
    adjacent.get(edge.source)!.add(edge.target);
    adjacent.get(edge.target)!.add(edge.source);
  }
  const order = (a: string, b: string) => (adjacent.get(b)?.size ?? 0) - (adjacent.get(a)?.size ?? 0) || a.localeCompare(b);
  const unseen = new Set([...byId.keys()].sort(order));
  const positions = new Map<string, { x: number; y: number }>();
  const components: Array<{ positions: Map<string, { x: number; y: number }>; width: number; height: number }> = [];
  while (unseen.size) {
    const root = unseen.has(focusId) ? focusId : [...unseen][0];
    const levels: string[][] = [[root]];
    unseen.delete(root);
    for (let level = 0; level < levels.length; level++) {
      const next: string[] = [];
      for (const id of levels[level]) for (const neighbor of [...adjacent.get(id)!].sort(order)) {
        if (!unseen.delete(neighbor)) continue;
        next.push(neighbor);
      }
      if (next.length) levels.push(next);
    }
    // Each ring has enough circumference for the widest card, even for dense stars.
    const radii = levels.map((level, index) => index === 0 ? 0 : Math.max(index * 260, level.length * 230 / (2 * Math.PI)));
    for (let index = 1; index < radii.length; index++) radii[index] = Math.max(radii[index], radii[index - 1] + 260);
    const radius = radii[radii.length - 1] ?? 0;
    const center = { x: radius, y: radius };
    const componentPositions = new Map<string, { x: number; y: number }>();
    levels.forEach((level, depth) => level.forEach((id, index) => {
      const angle = (level.length <= 2 ? 0 : -Math.PI / 2) + index * 2 * Math.PI / level.length;
      componentPositions.set(id, { x: center.x + radii[depth] * Math.cos(angle), y: center.y + radii[depth] * Math.sin(angle) });
    }));
    const minX = Math.min(...[...componentPositions.values()].map(position => position.x));
    const minY = Math.min(...[...componentPositions.values()].map(position => position.y));
    let width = 0, height = 0;
    for (const [id, position] of componentPositions) {
      const next = { x: position.x - minX, y: position.y - minY };
      componentPositions.set(id, next); width = Math.max(width, next.x + PERSON_WIDTH); height = Math.max(height, next.y + PERSON_HEIGHT);
    }
    components.push({ positions: componentPositions, width, height });
  }
  const targetWidth = Math.max(...components.map(component => component.width),
    Math.sqrt(components.reduce((area, component) => area + (component.width + 120) * (component.height + 120), 0)) * 1.4, 1);
  let left = 0, top = 0, rowHeight = 0;
  for (const component of components) {
    if (left > 0 && left + component.width > targetWidth) { left = 0; top += rowHeight + 120; rowHeight = 0; }
    for (const [id, position] of component.positions) positions.set(id, { x: left + position.x, y: top + position.y });
    left += component.width + 120; rowHeight = Math.max(rowHeight, component.height);
  }
  const pairEdges = new Map<string, string[]>();
  for (const edge of connections) {
    const pair = JSON.stringify([edge.source, edge.target].sort());
    pairEdges.set(pair, [...pairEdges.get(pair) ?? [], edge.id].sort());
  }
  return { positions, lanes: new Map(connections.map(edge => {
    const ids = pairEdges.get(JSON.stringify([edge.source, edge.target].sort()))!;
    return [edge.id, ids.indexOf(edge.id) - (ids.length - 1) / 2];
  })) };
}
