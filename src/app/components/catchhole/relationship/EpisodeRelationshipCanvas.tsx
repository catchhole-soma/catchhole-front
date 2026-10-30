import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, BaseEdge, ConnectionMode, ControlButton, Controls, EdgeLabelRenderer, Handle, MarkerType, Position, ReactFlow, getViewportForBounds, useReactFlow, useStore,
  type Edge, type EdgeProps, type Node, type NodeChange, type NodeProps } from '@xyflow/react';
import { Maximize, RotateCcw, UserRound } from 'lucide-react';
import { layoutEpisodeRelationships, PERSON_HEIGHT, PERSON_WIDTH, type EpisodeConnection, type EpisodePerson } from './episode-relationship-layout';
import { routeEpisodeRelationships, type EpisodeRoute, type Point } from './episode-relationship-routing';
import { layoutEpisodeRelationshipNetwork } from './episode-relationship-network';
import { routeEpisodeRelationshipOverview } from './episode-relationship-overview-routing';
import '@xyflow/react/dist/style.css';

type PersonNode = Node<{ person: EpisodePerson; focused: boolean; hub?: boolean; onFocus: (id: string) => void }, 'episodePerson'>;
type RelationEdge = Edge<{ relation: EpisodeConnection; names: string; route: EpisodeRoute; onSelect: (id: string) => void }, 'episodeRelation'>;

// These cards have fixed geometry. Keeping measured dimensions on controlled
// nodes also preserves React Flow's measured ports across position updates.
const PERSON_DIMENSIONS = { width: PERSON_WIDTH, height: PERSON_HEIGHT };

const Person = memo(function Person({ data }: NodeProps<PersonNode>) {
  return <div className={`episode-person${data.focused ? ' is-focused' : ''}${data.hub ? ' is-hub' : ''}`}>
    {[Position.Top, Position.Bottom, Position.Left, Position.Right].map(position =>
      <Handle key={position} id={position} position={position} type="source" isConnectable={false} />)}
    <button type="button" className="nopan" onClick={event => { if (event.detail === 0) { event.stopPropagation(); data.onFocus(data.person.id); } }}
      aria-label={`${data.person.name} 중심으로 보기`} aria-pressed={data.focused}>
      <span className="episode-person__avatar" aria-hidden="true"><UserRound size={22} /></span>
      <strong>{data.person.name}</strong><small>{data.person.registered === false ? '프로필 미등록' : data.focused ? '중심 인물' : '연결 보기'}</small>
    </button>
  </div>;
});

function Relation({ id, markerEnd, markerStart, selected, data }: EdgeProps<RelationEdge>) {
  if (!data) return null;
  const { route } = data;
  return <>
    <BaseEdge id={id} path={route.path} markerEnd={markerEnd} markerStart={markerStart}
      interactionWidth={24} className={`episode-connection${selected ? ' is-selected' : ''}${data.relation.ended ? ' is-ended' : ''}`} />
    {route.labelLeaderPath && <path d={route.labelLeaderPath} className="episode-connection-label-leader" aria-hidden="true" />}
    <EdgeLabelRenderer><button type="button" className={`episode-connection-label nodrag nopan${selected ? ' is-selected' : ''}`}
      style={{ transform: `translate(-50%, -50%) translate(${route.label.x}px, ${route.label.y}px)`, width: route.labelWidth, height: route.labelHeight }}
      title={data.relation.label}
      aria-label={`${data.names} ${data.relation.label} 근거 보기`} aria-pressed={Boolean(selected)}
      onClick={() => data.onSelect(id)}><span className="episode-connection-label__text">{data.relation.label}{data.relation.ended && <small>종료</small>}</span></button></EdgeLabelRenderer>
  </>;
}
function ViewportControls({ bounds, overview, resetVersion, onReset }: {
  bounds: { x: number; y: number; width: number; height: number }; overview: boolean; resetVersion: number; onReset: () => void;
}) {
  const width = useStore(state => state.width), height = useStore(state => state.height);
  const { setViewport } = useReactFlow();
  const fit = useCallback(() => setViewport(getViewportForBounds(bounds, width, height, 0.05, 1.1, 0.12)), [bounds, width, height, setViewport]);
  const initialView = useCallback(() => setViewport(getViewportForBounds(bounds, width, height, overview ? 0.6 : 0.05, 1.1, 0.12)), [bounds, width, height, overview, setViewport]);
  const previous = useRef({ width: 0, height: 0, resetVersion: -1 });
  useEffect(() => {
    if (width && height && (previous.current.width !== width || previous.current.height !== height || previous.current.resetVersion !== resetVersion)) {
      void initialView();
      previous.current = { width, height, resetVersion };
    }
  }, [width, height, resetVersion, initialView]);
  return <Controls showInteractive={false} showFitView={false}>
    <ControlButton aria-label="전체 보기" title="전체 보기" onClick={() => void fit()}><Maximize /></ControlButton>
    <ControlButton aria-label="배치 초기화" title="배치 초기화" onClick={onReset}><RotateCcw /></ControlButton>
  </Controls>;
}

const nodeTypes = { episodePerson: Person };
const edgeTypes = { episodeRelation: Relation };

export function EpisodeRelationshipCanvas({ people, connections, focusId, selectedId, onFocus, onSelect }: {
  people: EpisodePerson[]; connections: EpisodeConnection[]; focusId: string; selectedId: string;
  onFocus: (id: string) => void; onSelect: (id: string) => void;
}) {
  const overview = !focusId && people.length > 3;
  const layout = useMemo(() => {
    const radial = layoutEpisodeRelationships(people, connections, focusId);
    return focusId || people.length <= 3 ? { ...radial, hubIds: new Set<string>() }
      : { ...radial, ...layoutEpisodeRelationshipNetwork(people, connections) };
  }, [people, connections, focusId]);
  const [moved, setMoved] = useState(new Map<string, Point>());
  const [resetVersion, setResetVersion] = useState(0);
  const positions = useMemo(() => new Map([...layout.positions].map(([id, position]) => [id, moved.get(id) ?? position])), [layout.positions, moved]);
  const routing = useMemo(() => overview
    ? routeEpisodeRelationshipOverview(positions, connections, layout.lanes)
    : routeEpisodeRelationships(positions, connections, layout.lanes), [positions, connections, layout.lanes, overview]);
  const onNodesChange = useCallback((changes: NodeChange<PersonNode>[]) => {
    const changesWithPosition = changes.filter(change => change.type === 'position' && change.position);
    if (!changesWithPosition.length) return;
    setMoved(previous => {
      const next = new Map(previous);
      for (const change of changesWithPosition) if (change.type === 'position' && change.position) next.set(change.id, change.position);
      return next;
    });
  }, []);
  const nodes: PersonNode[] = people.map(person => ({ id: person.id, type: 'episodePerson', position: positions.get(person.id)!,
    ...PERSON_DIMENSIONS, measured: PERSON_DIMENSIONS, draggable: true,
    data: { person, focused: person.id === focusId, hub: layout.hubIds.has(person.id), onFocus } }));
  const names = new Map(people.map(person => [person.id, person.name]));
  const edges: RelationEdge[] = connections.filter(edge => routing.routes.has(edge.id)).map(relation => {
    const source = positions.get(relation.source)!, target = positions.get(relation.target)!;
    const horizontal = Math.abs(target.x - source.x) > Math.abs(target.y - source.y);
    const sourceHandle = horizontal ? target.x > source.x ? Position.Right : Position.Left : target.y > source.y ? Position.Bottom : Position.Top;
    const targetHandle = horizontal ? target.x > source.x ? Position.Left : Position.Right : target.y > source.y ? Position.Top : Position.Bottom;
    const marker = { type: MarkerType.ArrowClosed, color: relation.id === selectedId ? 'var(--ch-primary-ink)' : 'var(--ch-text-muted)', width: 18, height: 18 };
    return { id: relation.id, source: relation.source, target: relation.target, sourceHandle, targetHandle, type: 'episodeRelation',
      selected: relation.id === selectedId, markerEnd: relation.direction !== 'UNDIRECTED' ? marker : undefined,
      markerStart: relation.direction === 'MUTUAL' ? marker : undefined,
      data: { relation, names: `${names.get(relation.source)} ${relation.direction === 'DIRECTED' ? '→' : relation.direction === 'MUTUAL' ? '↔' : '—'} ${names.get(relation.target)}`,
        route: routing.routes.get(relation.id)!, onSelect } };
  });
  return <><p className="episode-relationship-drag-hint">{overview ? '빈 곳을 끌어 이동하고, 인물을 끌어 배치를 바꿔 보세요.' : '인물을 끌어 배치를 바꿀 수 있어요.'}</p><div className={`episode-relationship-canvas${overview ? ' is-overview' : ''}`} aria-label="회차별 인물 관계도">
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} connectionMode={ConnectionMode.Loose}
      minZoom={0.05} maxZoom={1.6} nodesConnectable={false}
      nodesDraggable onNodesChange={onNodesChange} nodeDragThreshold={5} nodeClickDistance={5} elementsSelectable={false}
      onNodeClick={(_, node) => onFocus(node.id)} onEdgeClick={(_, edge) => onSelect(edge.id)}
      proOptions={{ hideAttribution: true }} ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': '확대', 'controls.zoomOut.ariaLabel': '축소', 'controls.fitView.ariaLabel': '전체 보기' }}>
      <ViewportControls bounds={routing.bounds} overview={overview} resetVersion={resetVersion} onReset={() => { setMoved(new Map()); setResetVersion(value => value + 1); }} />
      <Background color="var(--ch-border)" gap={22} size={1} />
    </ReactFlow>
  </div></>;
}
