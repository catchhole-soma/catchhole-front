import { getViewportForBounds } from '@xyflow/react';

// The smallest primary relationship label is 14px (family-tree-v2.css).
export const FAMILY_TREE_READABLE_ZOOM = 12 / 14;
export const FAMILY_TREE_MIN_ZOOM = 0.005;

type Person = {
  id: string; name: string; characterId?: string | null; nodeType?: 'CHARACTER' | 'MENTION';
  position: { x: number; y: number }; width: number; height: number;
};
type Connection = { source: string; target: string };

export function familyViewportAnchor(nodes: Person[], edges: Connection[], focusCharacterId: string) {
  const focused = nodes.find(node => node.nodeType !== 'MENTION' && (node.characterId ?? node.id) === focusCharacterId);
  if (focused) return focused;
  const neighbors = new Map(nodes.map(node => [node.id, new Set<string>()]));
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    neighbors.get(edge.source)?.add(edge.target);
    neighbors.get(edge.target)?.add(edge.source);
  }
  const registered = nodes.filter(node => node.nodeType !== 'MENTION');
  return [...(registered.length ? registered : nodes)].sort((a, b) =>
    (neighbors.get(b.id)?.size ?? 0) - (neighbors.get(a.id)?.size ?? 0)
    || a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id))[0];
}

export function familyViewports(bounds: { width: number; height: number }, width: number, height: number,
  anchor: Person | undefined, truncated: boolean) {
  // Leave space for the control row (two rows on narrow canvases).
  const usableHeight = Math.max(1, height - (width < 360 ? 120 : 68));
  const overview = getViewportForBounds({ x: 0, y: 0, ...bounds }, width, usableHeight, FAMILY_TREE_MIN_ZOOM, 1, 0.08);
  const needsFocus = truncated || overview.zoom < FAMILY_TREE_READABLE_ZOOM;
  const readable = {
    x: width / 2 - (anchor ? anchor.position.x + anchor.width / 2 : bounds.width / 2),
    y: usableHeight / 2 - (anchor ? anchor.position.y + anchor.height / 2 : bounds.height / 2),
    zoom: 1,
  };
  return { overview, readable, needsFocus, initial: needsFocus ? readable : overview };
}
