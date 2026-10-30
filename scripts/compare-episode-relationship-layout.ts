/** Read-only geometry comparison. No browser, API, DB, or model calls.
 * Usage: npm run compare:relationships -- --input graph.json --out directory [--only hub-overview]
 * Historical comparisons require frozen sources under <out>/baseline-source.
 * Current hub-overview and ring-current-routing do not require a baseline.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getViewportForBounds } from '@xyflow/react';
import type { EpisodeConnection, EpisodePerson } from '../src/app/components/catchhole/relationship/episode-relationship-layout';

type Point = { x: number; y: number };
type Box = Point & { width: number; height: number };
type Route = { path: string; label: Point; labelWidth: number; labelHeight: number; start: Point; end: Point; sections?: Point[][]; obstacleFallback?: boolean; labelLeaderPath?: string };
type Geometry = { positions: Map<string, Point>; routes: Map<string, Route>; bounds: Box };
type Layout = { positions: Map<string, Point>; lanes: Map<string, number> };
type LayoutFunction = (people: EpisodePerson[], edges: EpisodeConnection[]) => Layout;
type RoutingFunction = (positions: Map<string, Point>, edges: EpisodeConnection[], lanes: Map<string, number>) => Pick<Geometry, 'routes' | 'bounds'>;
type Graph = {
  nodes: Array<{ id: string; name: string; description?: string | null; profileRegistered?: boolean }>;
  edges: Array<{ id: string; sourceNodeId: string; targetNodeId: string; label: string; summary: string; direction: EpisodeConnection['direction']; status: string }>;
};
type Segment = { a: Point; b: Point };
type Candidate = { name: string; sourceHashes: Record<string, string>; run: () => Promise<Geometry> | Geometry };

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const PRODUCT = resolve(REPO, 'src/app/components/catchhole/relationship');
const USAGE = `Usage: npm run compare:relationships -- --input graph.json --out directory [--only hub-overview]
Both paths are required. Input is a relationship-graph response containing nodes and edges.
Use --only hub-overview to measure the current overview without historical files.
Historical comparisons require episode-relationship-layout.ts and episode-relationship-routing.ts
plus their local imports under <out>/baseline-source. Preserve these before changing product code.
Optional historical network/orthogonal sources and improved-quadratic-source are used when present.`;
function readOptions() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') { console.log(USAGE); return null; }
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index], value = args[index + 1];
    if (!['--input', '--out', '--only'].includes(key) || values.has(key) || !value || value.startsWith('--')) {
      throw new Error(`Invalid or incomplete argument: ${key}\n${USAGE}`);
    }
    values.set(key, value);
  }
  if (!values.has('--input') || !values.has('--out')) throw new Error(`--input and --out are required.\n${USAGE}`);
  const only = values.get('--only')?.split(',').map(name => name.trim());
  if (only?.some(name => !name)) throw new Error(`--only requires comma-separated candidate names.\n${USAGE}`);
  return { INPUT: resolve(values.get('--input')!), OUTPUT: resolve(values.get('--out')!), ONLY: only ? new Set(only) : null };
}
const STEPS = 64;
const EPSILON = 1e-7;
const CARD = { width: 184, height: 78 };
const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const boxIntersects = (a: Box, b: Box) => a.x < b.x + b.width - EPSILON && a.x + a.width > b.x + EPSILON
  && a.y < b.y + b.height - EPSILON && a.y + a.height > b.y + EPSILON;
const inside = (box: Box, point: Point) => point.x >= box.x - EPSILON && point.x <= box.x + box.width + EPSILON
  && point.y >= box.y - EPSILON && point.y <= box.y + box.height + EPSILON;
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const round = (n: number) => Math.round(n * 1e4) / 1e4;

/** ELK sections are exact polylines. Curved SVG commands use a fixed 64-segment approximation. */
function polylines(route: Route): Point[][] {
  if (route.sections?.length) return route.sections;
  const tokens = route.path.match(/[MLQCHVZmlqchvz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  const lines: Point[][] = [];
  let current: Point = { x: 0, y: 0 }, command = '', index = 0;
  const value = () => {
    const number = Number(tokens[index++]);
    if (!Number.isFinite(number)) throw new Error('Invalid SVG coordinate');
    return number;
  };
  const point = (): Point => ({ x: value(), y: value() });
  const append = (p: Point) => { lines.at(-1)!.push(p); current = p; };
  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++];
    if (command === 'M') { current = point(); lines.push([current]); command = 'L'; }
    else if (command === 'L') append(point());
    else if (command === 'H') append({ x: value(), y: current.y });
    else if (command === 'V') append({ x: current.x, y: value() });
    else if (command === 'Q') {
      const start = current, control = point(), end = point();
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS, u = 1 - t;
        append({ x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
          y: u * u * start.y + 2 * u * t * control.y + t * t * end.y });
      }
    } else if (command === 'C') {
      const start = current, c1 = point(), c2 = point(), end = point();
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS, u = 1 - t;
        append({ x: u ** 3 * start.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * end.x,
          y: u ** 3 * start.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * end.y });
      }
    } else throw new Error(`Unsupported SVG command ${command}; measurement must not silently omit paths`);
  }
  return lines;
}

function segments(lines: Point[][]): Segment[] {
  return lines.flatMap(line => line.slice(1).map((b, i) => ({ a: line[i], b })))
    .filter(({ a, b }) => Math.hypot(a.x - b.x, a.y - b.y) > EPSILON);
}

function crossing(a: Segment, b: Segment): Point | 'overlap' | null {
  const r = subtract(a.b, a.a), s = subtract(b.b, b.a), q = subtract(b.a, a.a);
  const denominator = cross(r, s);
  if (Math.abs(denominator) < EPSILON) {
    if (Math.abs(cross(q, r)) > EPSILON) return null;
    const rr = r.x ** 2 + r.y ** 2;
    const t0 = (q.x * r.x + q.y * r.y) / rr;
    const t1 = t0 + (s.x * r.x + s.y * r.y) / rr;
    return Math.min(1, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > EPSILON ? 'overlap' : null;
  }
  const t = cross(q, s) / denominator, u = cross(q, r) / denominator;
  // Shared node endpoints are excluded at the relationship-pair level below. Include bend/sample boundaries.
  return t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON
    ? { x: a.a.x + t * r.x, y: a.a.y + t * r.y } : null;
}

/** Clip to a slightly inset rectangle so merely following a card border is not penetration. */
function penetrates(segment: Segment, box: Box) {
  const b = { x: box.x + EPSILON, y: box.y + EPSILON, width: box.width - 2 * EPSILON, height: box.height - 2 * EPSILON };
  const d = subtract(segment.b, segment.a);
  const p = [-d.x, d.x, -d.y, d.y];
  const q = [segment.a.x - b.x, b.x + b.width - segment.a.x, segment.a.y - b.y, b.y + b.height - segment.a.y];
  let start = 0, end = 1;
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < EPSILON) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) start = Math.max(start, t); else end = Math.min(end, t);
    if (start > end) return false;
  }
  return end - start > EPSILON;
}

function measure(geometry: Geometry, people: EpisodePerson[], edges: EpisodeConnection[]) {
  const cards = [...geometry.positions].map(([id, point]) => ({ id, ...point, ...CARD }));
  const routes = [...geometry.routes].map(([id, route]) => ({ id, route, segments: segments(polylines(route)), lines: polylines(route) }));
  const leaders = routes.filter(({ route }) => route.labelLeaderPath).map(({ id, route }) => {
    const lines = polylines({ ...route, path: route.labelLeaderPath!, sections: undefined });
    return { id, lines, segments: segments(lines) };
  });
  const edgeById = new Map(edges.map(edge => [edge.id, edge]));
  const labels = routes.map(({ id, route }) => ({ id, x: route.label.x - route.labelWidth / 2,
    y: route.label.y - route.labelHeight / 2, width: route.labelWidth, height: route.labelHeight }));
  let crossingPairs = 0, crossingPoints = 0, sharedEndpointPairsExcluded = 0, collinearOverlapPairs = 0;
  const crossingExamples: string[][] = [], penetrations: string[][] = [], labelCardOverlaps: string[][] = [], labelLabelOverlaps: string[][] = [];
  let cardOverlapPairs = 0, otherLabelPenetrations = 0;
  for (let i = 0; i < routes.length; i++) {
    const a = routes[i], source = edgeById.get(a.id)!;
    for (let j = i + 1; j < routes.length; j++) {
      const b = routes[j], target = edgeById.get(b.id)!;
      if ([source.source, source.target].some(id => id === target.source || id === target.target)) { sharedEndpointPairsExcluded++; continue; }
      const intersections: Point[] = [];
      let overlap = false;
      for (const one of a.segments) for (const two of b.segments) {
        if (Math.max(one.a.x, one.b.x) + EPSILON < Math.min(two.a.x, two.b.x)
          || Math.max(two.a.x, two.b.x) + EPSILON < Math.min(one.a.x, one.b.x)
          || Math.max(one.a.y, one.b.y) + EPSILON < Math.min(two.a.y, two.b.y)
          || Math.max(two.a.y, two.b.y) + EPSILON < Math.min(one.a.y, one.b.y)) continue;
        const result = crossing(one, two);
        if (result === 'overlap') overlap = true;
        else if (result && !intersections.some(p => Math.hypot(p.x - result.x, p.y - result.y) < 0.5)) intersections.push(result);
      }
      if (overlap) collinearOverlapPairs++;
      if (intersections.length) { crossingPairs++; crossingPoints += intersections.length; if (crossingExamples.length < 12) crossingExamples.push([a.id, b.id]); }
    }
    for (const card of cards) {
      if (card.id === source.source || card.id === source.target) continue;
      if (a.segments.some(segment => penetrates(segment, card))) penetrations.push([a.id, card.id]);
    }
    for (const label of labels) if (label.id !== a.id && a.segments.some(segment => penetrates(segment, label))) otherLabelPenetrations++;
  }
  for (let i = 0; i < labels.length; i++) {
    for (const card of cards) if (boxIntersects(labels[i], card)) labelCardOverlaps.push([labels[i].id, card.id]);
    for (let j = i + 1; j < labels.length; j++) if (boxIntersects(labels[i], labels[j])) labelLabelOverlaps.push([labels[i].id, labels[j].id]);
  }
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) if (boxIntersects(cards[i], cards[j])) cardOverlapPairs++;
  const allPoints = [...cards, ...labels].flatMap(box => [box, { x: box.x + box.width, y: box.y + box.height }])
    .concat(routes.flatMap(route => route.lines.flat()), leaders.flatMap(leader => leader.lines.flat()));
  const finite = allPoints.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)) && Object.values(geometry.bounds).every(Number.isFinite);
  const sameIds = (actual: string[], expected: string[]) => JSON.stringify(actual.sort()) === JSON.stringify(expected.sort());
  const endpointMismatches = routes.filter(({ id, route }) => {
    const edge = edgeById.get(id)!;
    const source = geometry.positions.get(edge.source), target = geometry.positions.get(edge.target);
    if (!source || !target) return true;
    // ELK ports can be outside card boundaries; allow two graph units for port geometry.
    const padded = (p: Point) => ({ x: p.x - 2, y: p.y - 2, width: CARD.width + 4, height: CARD.height + 4 });
    return !inside(padded(source), route.start) || !inside(padded(target), route.end);
  }).map(route => route.id);
  return {
    nodes: cards.length, edges: routes.length, crossingPairs, crossingPoints, collinearOverlapPairs, sharedEndpointPairsExcluded,
    obstacleFallbackRoutes: routes.filter(({ route }) => route.obstacleFallback).length,
    roundedDetourRoutes: routes.filter(({ route }) => /\bL\b/.test(route.path) && /\bQ\b/.test(route.path)).length,
    lineCardPenetrationPairs: penetrations.length, labelsTouchingCards: labelCardOverlaps.length,
    labelOverlapPairs: labelLabelOverlaps.length, cardOverlapPairs, lineOtherLabelPenetrationPairs: otherLabelPenetrations,
    labelLeaderRoutes: leaders.length,
    labelLeaderCardPenetrationPairs: leaders.reduce((count, leader) => count + cards.filter(card =>
      leader.segments.some(segment => penetrates(segment, card))).length, 0),
    labelLeaderOtherLabelPenetrationPairs: leaders.reduce((count, leader) => count + labels.filter(label => label.id !== leader.id
      && leader.segments.some(segment => penetrates(segment, label))).length, 0),
    bounds: geometry.bounds, area: round(geometry.bounds.width * geometry.bounds.height), finite,
    pointsOutsideBounds: allPoints.filter(p => !inside(geometry.bounds, p)).length,
    viewportFits: [[1280, 720], [1440, 900], [900, 600]].map(([width, height]) => {
      const viewport = getViewportForBounds(geometry.bounds, width, height, 0.05, 1.1, 0.12);
      return { width, height, zoom: round(viewport.zoom), projectedCardWidth: round(CARD.width * viewport.zoom),
        projected12pxLabel: round(12 * viewport.zoom), projected14pxName: round(14 * viewport.zoom) };
    }),
    nodeIdsPreserved: sameIds([...geometry.positions.keys()], people.map(person => person.id)),
    edgeIdsPreserved: sameIds([...geometry.routes.keys()], edges.map(edge => edge.id)),
    endpointMismatches,
    examples: { crossingPairs: crossingExamples, lineCardPenetrations: penetrations.slice(0, 12),
      labelCardOverlaps: labelCardOverlaps.slice(0, 12), labelLabelOverlaps: labelLabelOverlaps.slice(0, 12) },
  };
}

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
function svg(name: string, geometry: Geometry, people: EpisodePerson[], edges: EpisodeConnection[]) {
  const byId = new Map(edges.map(edge => [edge.id, edge]));
  const paths = [...geometry.routes].map(([id, route]) => `<path d="${escape(route.path)}" fill="none" stroke="${byId.get(id)?.ended ? '#9ca3af' : '#64748b'}" stroke-width="1.5" ${byId.get(id)?.ended ? 'stroke-dasharray="6 4"' : ''}/>`).join('');
  const leaders = [...geometry.routes.values()].filter(route => route.labelLeaderPath).map(route =>
    `<path d="${escape(route.labelLeaderPath!)}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 3"/>`).join('');
  const cards = people.map(person => {
    const p = geometry.positions.get(person.id)!;
    return `<g><rect x="${p.x}" y="${p.y}" width="${CARD.width}" height="${CARD.height}" rx="8" fill="white" stroke="#94a3b8"/><text x="${p.x + 12}" y="${p.y + 34}" font-size="14" font-weight="600">${escape(person.name)}</text><text x="${p.x + 12}" y="${p.y + 57}" fill="#64748b" font-size="11">합성 인물</text></g>`;
  }).join('');
  const labels = [...geometry.routes].map(([id, route]) => {
    const label = byId.get(id)!.label, max = Math.max(1, Math.floor((route.labelWidth - 12) / 12));
    const chars = Array.from(label), lines = chars.length > max ? [chars.slice(0, max).join(''), chars.slice(max).join('')] : [label];
    return `<g><rect x="${route.label.x - route.labelWidth / 2}" y="${route.label.y - route.labelHeight / 2}" width="${route.labelWidth}" height="${route.labelHeight}" rx="5" fill="#f8fafc" stroke="#cbd5e1"/><text x="${route.label.x}" y="${route.label.y - (lines.length - 1) * 7 + 4}" text-anchor="middle" font-size="12">${lines.map((line, i) => `<tspan x="${route.label.x}" dy="${i ? 14 : 0}">${escape(line)}</tspan>`).join('')}</text></g>`;
  }).join('');
  const b = geometry.bounds;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.width} ${b.height}" width="1440" height="900"><title>${escape(name)} · approximate geometry preview</title><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="#f1f5f9"/><g font-family="system-ui,sans-serif" fill="#0f172a">${paths}${leaders}${cards}${labels}</g></svg>`;
}

async function main() {
  const options = readOptions();
  if (!options) return;
  const { INPUT, OUTPUT, ONLY } = options;
  const wanted = (name: string) => !ONLY || ONLY.has(name);
  if (!existsSync(INPUT)) throw new Error(`Graph input does not exist: ${INPUT}\n${USAGE}`);
  const graph: Graph = JSON.parse(readFileSync(INPUT, 'utf8'));
  const people: EpisodePerson[] = graph.nodes.map(node => ({ id: node.id, name: node.name, description: node.description ?? undefined, registered: node.profileRegistered }));
  const edges: EpisodeConnection[] = graph.edges.map(edge => ({ id: edge.id, source: edge.sourceNodeId, target: edge.targetNodeId,
    label: edge.label, summary: edge.summary, direction: edge.direction, ended: edge.status === 'ENDED' }));
  const original = JSON.stringify({ people, edges });
  const baselineLayoutPath = resolve(OUTPUT, 'baseline-source/episode-relationship-layout.ts');
  const baselineRoutingPath = resolve(OUTPUT, 'baseline-source/episode-relationship-routing.ts');
  const needsBaseline = ['baseline-ring-original-routing', 'network-original-routing', 'network-current-routing',
    'network-frozen-improved-quadratic', 'network-orthogonal'].some(wanted);
  if (needsBaseline && (!existsSync(baselineLayoutPath) || !existsSync(baselineRoutingPath))) {
    throw new Error(`Historical comparison requires frozen sources under ${resolve(OUTPUT, 'baseline-source')}.\n${USAGE}`);
  }
  const baselineLayout = needsBaseline ? (await import(pathToFileURL(baselineLayoutPath).href)).layoutEpisodeRelationships as LayoutFunction : null;
  const baselineRouting = needsBaseline ? (await import(pathToFileURL(baselineRoutingPath).href)).routeEpisodeRelationships as RoutingFunction : null;
  const currentLayoutPath = resolve(PRODUCT, 'episode-relationship-layout.ts');
  const currentRoutingPath = resolve(PRODUCT, 'episode-relationship-routing.ts');
  const currentLayout = (await import(pathToFileURL(currentLayoutPath).href)).layoutEpisodeRelationships as LayoutFunction;
  const currentRouting = (await import(pathToFileURL(currentRoutingPath).href)).routeEpisodeRelationships as RoutingFunction;
  const improvedLayoutPath = resolve(OUTPUT, 'improved-quadratic-source/episode-relationship-layout.ts');
  const improvedRoutingPath = resolve(OUTPUT, 'improved-quadratic-source/episode-relationship-routing.ts');
  const needsImproved = wanted('ring-frozen-improved-quadratic') || wanted('network-frozen-improved-quadratic');
  const improvedLayout = needsImproved && existsSync(improvedLayoutPath)
    ? (await import(pathToFileURL(improvedLayoutPath).href)).layoutEpisodeRelationships as LayoutFunction : null;
  const improvedRouting = needsImproved && existsSync(improvedRoutingPath)
    ? (await import(pathToFileURL(improvedRoutingPath).href)).routeEpisodeRelationships as RoutingFunction : null;
  const candidates: Candidate[] = [
    { name: 'ring-current-routing', sourceHashes: { layout: digest(currentLayoutPath), routing: digest(currentRoutingPath) }, run: () => {
      const layout = currentLayout(people, edges); return { positions: layout.positions, ...currentRouting(layout.positions, edges, layout.lanes) };
    } },
  ];
  if (baselineLayout && baselineRouting) candidates.unshift({ name: 'baseline-ring-original-routing',
    sourceHashes: { layout: digest(baselineLayoutPath), routing: digest(baselineRoutingPath) }, run: () => {
      const layout = baselineLayout(people, edges); return { positions: layout.positions, ...baselineRouting(layout.positions, edges, layout.lanes) };
    } });
  if (improvedLayout && improvedRouting) candidates.push({ name: 'ring-frozen-improved-quadratic',
    sourceHashes: { layout: digest(improvedLayoutPath), routing: digest(improvedRoutingPath) }, run: () => {
      const layout = improvedLayout(people, edges); return { positions: layout.positions, ...improvedRouting(layout.positions, edges, layout.lanes) };
    } });
  const elkPath = resolve(PRODUCT, 'episode-relationship-elk.ts');
  if ((wanted('elk-right') || wanted('elk-down')) && existsSync(elkPath)) {
    const elk = (await import(pathToFileURL(elkPath).href)).layoutEpisodeRelationshipsWithElk;
    for (const direction of ['RIGHT', 'DOWN']) candidates.push({ name: `elk-${direction.toLowerCase()}`, sourceHashes: { layout: digest(elkPath) },
      run: () => elk(people, edges, { direction }) });
  }
  const networkPath = resolve(PRODUCT, 'episode-relationship-network.ts');
  if (existsSync(networkPath)) {
    const network = (await import(pathToFileURL(networkPath).href)).layoutEpisodeRelationshipNetwork;
    if (baselineLayout && baselineRouting) {
      for (const [name, routing, path] of [['original', baselineRouting, baselineRoutingPath], ['current', currentRouting, currentRoutingPath]] as const) {
        candidates.push({ name: `network-${name}-routing`, sourceHashes: { layout: digest(networkPath), routing: digest(path) }, run: async () => {
          const layout = await network(people, edges); const lanes = baselineLayout(people, edges).lanes;
          return { positions: layout.positions, ...routing(layout.positions, edges, lanes) };
        } });
      }
    }
    if (baselineLayout && improvedRouting) candidates.push({ name: 'network-frozen-improved-quadratic',
      sourceHashes: { layout: digest(networkPath), routing: digest(improvedRoutingPath) }, run: async () => {
        const layout = await network(people, edges); const lanes = baselineLayout(people, edges).lanes;
        return { positions: layout.positions, ...improvedRouting(layout.positions, edges, lanes) };
      } });
    const frozenNetworkPath = resolve(OUTPUT, 'baseline-source/episode-relationship-network.ts');
    const frozenOrthogonalPath = resolve(OUTPUT, 'baseline-source/episode-relationship-orthogonal.ts');
    const orthogonalLayoutPath = existsSync(frozenNetworkPath) ? frozenNetworkPath : networkPath;
    const orthogonalPath = existsSync(frozenOrthogonalPath) ? frozenOrthogonalPath : resolve(PRODUCT, 'episode-relationship-orthogonal.ts');
    if (wanted('network-orthogonal') && baselineLayout && existsSync(orthogonalPath)) {
      // A new network implementation must not silently replace the before-state geometry.
      const orthogonalNetwork = (await import(pathToFileURL(orthogonalLayoutPath).href)).layoutEpisodeRelationshipNetwork;
      const orthogonal = (await import(pathToFileURL(orthogonalPath).href)).routeEpisodeRelationshipsOrthogonally;
      candidates.push({ name: 'network-orthogonal', sourceHashes: { layout: digest(orthogonalLayoutPath), routing: digest(orthogonalPath) }, run: async () => {
        const layout = await orthogonalNetwork(people, edges); const lanes = baselineLayout(people, edges).lanes;
        return { positions: layout.positions, ...orthogonal(layout.positions, edges, lanes) };
      } });
    }
    const overviewPath = resolve(PRODUCT, 'episode-relationship-overview-routing.ts');
    if (existsSync(overviewPath)) {
      const overview = (await import(pathToFileURL(overviewPath).href)).routeEpisodeRelationshipOverview;
      candidates.push({ name: 'hub-overview', sourceHashes: { layout: digest(networkPath), routing: digest(overviewPath) }, run: async () => {
        const layout = await network(people, edges); const lanes = currentLayout(people, edges).lanes;
        return { positions: layout.positions, ...overview(layout.positions, edges, lanes) };
      } });
    }
  }
  const results = [];
  const selected = ONLY ? candidates.filter(candidate => ONLY.has(candidate.name)) : candidates;
  if (ONLY && selected.length !== ONLY.size) throw new Error(`Requested candidate unavailable; available: ${candidates.map(candidate => candidate.name).join(', ')}`);
  mkdirSync(OUTPUT, { recursive: true });
  for (const candidate of selected) {
    const durations = [], times = [];
    let geometry: Geometry | undefined;
    for (let run = 0; run < 3; run++) {
      const start = performance.now(); geometry = await candidate.run(); durations.push(performance.now() - start);
      times.push(round(durations.at(-1)!));
    }
    if (!geometry) throw new Error('Candidate produced no geometry');
    const result = { name: candidate.name, sourceHashes: candidate.sourceHashes, runtimeMs: { first: times[0], repeats: times.slice(1), median: round([...durations].sort((a, b) => a - b)[1]) },
      inputMeaningUnchanged: JSON.stringify({ people, edges }) === original, ...measure(geometry, people, edges) };
    results.push(result);
    writeFileSync(resolve(OUTPUT, `${candidate.name}.svg`), svg(candidate.name, geometry, people, edges));
    writeFileSync(resolve(OUTPUT, `${candidate.name}.geometry.json`), JSON.stringify({ positions: [...geometry.positions], routes: [...geometry.routes], bounds: geometry.bounds }, null, 2));
    console.log(JSON.stringify({ name: result.name, crossingPairs: result.crossingPairs, lineCardPairs: result.lineCardPenetrationPairs,
      labelCardPairs: result.labelsTouchingCards, labelPairs: result.labelOverlapPairs, zoom1280: result.viewportFits[0].zoom, medianMs: result.runtimeMs.median,
      collinearOverlapPairs: result.collinearOverlapPairs, fallbackRoutes: result.obstacleFallbackRoutes,
      labelLeaderRoutes: result.labelLeaderRoutes, leaderCardPairs: result.labelLeaderCardPenetrationPairs,
      leaderOtherLabelPairs: result.labelLeaderOtherLabelPenetrationPairs,
      roundedDetourRoutes: result.roundedDetourRoutes,
      idsPreserved: result.nodeIdsPreserved && result.edgeIdsPreserved, endpointMismatches: result.endpointMismatches.length }));
  }
  const report = { generatedAt: new Date().toISOString(), input: INPUT, inputSha256: digest(INPUT), nodeCount: people.length, edgeCount: edges.length,
    methodology: {
      curvedPathSamplesPerCommand: STEPS, sections: 'ELK and orthogonal sections measured as exact straight segments',
      crossings: 'Count unique edge pairs with at least one sampled point intersection; exclude every pair sharing a node. Deduplicate intersection points within 0.5 graph units per edge pair. Collinear overlaps counted separately.',
      penetration: 'Count distinct edge/card pairs crossing a non-endpoint card interior. Label/card and label/label use exact rectangles. Foreign label penetration is an extra readability diagnostic.',
      leaders: 'Optional label leader paths are decorative, not additional relationship edges. Count their card and foreign-label penetrations separately and include their geometry in bounds checks.',
      bounds: 'All cards, label rectangles, and sampled paths checked against reported bounds. Curved tangencies or very short excursions can be missed between samples.',
      fit: 'React Flow getViewportForBounds, minZoom=0.05, maxZoom=1.1, padding=0.12; projected text sizes are estimates, not browser font measurements.',
      runtime: 'Three sequential in-process layout+routing runs, module import excluded; first and repeats included. Hardware/load dependent, not a browser performance benchmark.',
      svg: 'Synthetic geometry preview only. Font wrapping, arrowheads, actual CSS, pan/zoom and interactions require separate browser verification.',
    }, results };
  writeFileSync(resolve(OUTPUT, ONLY ? 'comparison-partial.json' : 'comparison.json'), JSON.stringify(report, null, 2));
  writeFileSync(resolve(OUTPUT, `comparison-${report.generatedAt.replace(/[:.]/g, '-')}.json`), JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
