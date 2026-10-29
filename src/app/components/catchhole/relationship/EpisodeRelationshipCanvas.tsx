import { memo, useEffect, useMemo, useRef } from 'react';
import { Background, BaseEdge, ConnectionMode, Controls, EdgeLabelRenderer, Handle, MarkerType, Position, ReactFlow, useReactFlow, useStore,
  type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react';
import { UserRound } from 'lucide-react';
import { layoutEpisodeRelationships, PERSON_HEIGHT, PERSON_WIDTH, type EpisodeConnection, type EpisodePerson } from './episode-relationship-layout';
import '@xyflow/react/dist/style.css';

type PersonNode = Node<{ person: EpisodePerson; focused: boolean; onFocus: (id: string) => void }, 'episodePerson'>;
type RelationEdge = Edge<{ relation: EpisodeConnection; names: string; lane: number; onSelect: (id: string) => void }, 'episodeRelation'>;

const Person = memo(function Person({ data }: NodeProps<PersonNode>) {
  return <div className={`episode-person${data.focused ? ' is-focused' : ''}`}>
    {[Position.Top, Position.Bottom, Position.Left, Position.Right].map(position =>
      <Handle key={position} id={position} position={position} type="source" isConnectable={false} />)}
    <button type="button" className="nodrag nopan" onClick={() => data.onFocus(data.person.id)}
      aria-label={`${data.person.name} 중심으로 보기`} aria-pressed={data.focused}>
      <span className="episode-person__avatar" aria-hidden="true"><UserRound size={22} /></span>
      <strong>{data.person.name}</strong><small>{data.person.registered === false ? '프로필 미등록' : data.focused ? '중심 인물' : '연결 보기'}</small>
    </button>
  </div>;
});

function Relation({ id, sourceX, sourceY, targetX, targetY, markerEnd, markerStart, selected, data }: EdgeProps<RelationEdge>) {
  if (!data) return null;
  const dx = targetX - sourceX, dy = targetY - sourceY, length = Math.max(1, Math.hypot(dx, dy));
  // Canonical orientation keeps reciprocal directed edges in distinct lanes.
  const orientation = data.relation.source.localeCompare(data.relation.target) < 0 ? 1 : -1;
  const offset = data.lane * 100 * orientation;
  const control = { x: (sourceX + targetX) / 2 - dy / length * offset, y: (sourceY + targetY) / 2 + dx / length * offset };
  const label = { x: (sourceX + 2 * control.x + targetX) / 4, y: (sourceY + 2 * control.y + targetY) / 4 };
  return <>
    <BaseEdge id={id} path={`M ${sourceX} ${sourceY} Q ${control.x} ${control.y} ${targetX} ${targetY}`} markerEnd={markerEnd} markerStart={markerStart}
      interactionWidth={24} className={`episode-connection${selected ? ' is-selected' : ''}${data.relation.ended ? ' is-ended' : ''}`} />
    <EdgeLabelRenderer><button type="button" className={`episode-connection-label nodrag nopan${selected ? ' is-selected' : ''}`}
      style={{ transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)` }}
      aria-label={`${data.names} ${data.relation.label} 근거 보기`} aria-pressed={Boolean(selected)}
      onClick={() => data.onSelect(id)}>{data.relation.label}{data.relation.ended && <small>종료</small>}</button></EdgeLabelRenderer>
  </>;
}
function ResponsiveViewport() {
  const width = useStore(state => state.width), height = useStore(state => state.height);
  const { fitView } = useReactFlow();
  const previous = useRef({ width: 0, height: 0 });
  useEffect(() => {
    if (previous.current.width && previous.current.height && width && height
      && (previous.current.width !== width || previous.current.height !== height)) {
      void fitView({ padding: 0.24, maxZoom: 1.1 });
    }
    previous.current = { width, height };
  }, [width, height, fitView]);
  return null;
}

const nodeTypes = { episodePerson: Person };
const edgeTypes = { episodeRelation: Relation };

export function EpisodeRelationshipCanvas({ people, connections, focusId, selectedId, onFocus, onSelect }: {
  people: EpisodePerson[]; connections: EpisodeConnection[]; focusId: string; selectedId: string;
  onFocus: (id: string) => void; onSelect: (id: string) => void;
}) {
  const layout = useMemo(() => layoutEpisodeRelationships(people, connections, focusId), [people, connections, focusId]);
  const nodes: PersonNode[] = people.map(person => ({ id: person.id, type: 'episodePerson', position: layout.positions.get(person.id)!,
    width: PERSON_WIDTH, height: PERSON_HEIGHT, draggable: false, data: { person, focused: person.id === focusId, onFocus } }));
  const names = new Map(people.map(person => [person.id, person.name]));
  const edges: RelationEdge[] = connections.filter(edge => names.has(edge.source) && names.has(edge.target)).map(relation => {
    const source = layout.positions.get(relation.source)!, target = layout.positions.get(relation.target)!;
    const horizontal = Math.abs(target.x - source.x) > Math.abs(target.y - source.y);
    const sourceHandle = horizontal ? target.x > source.x ? Position.Right : Position.Left : target.y > source.y ? Position.Bottom : Position.Top;
    const targetHandle = horizontal ? target.x > source.x ? Position.Left : Position.Right : target.y > source.y ? Position.Top : Position.Bottom;
    const marker = { type: MarkerType.ArrowClosed, color: relation.id === selectedId ? 'var(--ch-primary-ink)' : 'var(--ch-text-muted)', width: 18, height: 18 };
    return { id: relation.id, source: relation.source, target: relation.target, sourceHandle, targetHandle, type: 'episodeRelation',
      selected: relation.id === selectedId, markerEnd: relation.direction !== 'UNDIRECTED' ? marker : undefined,
      markerStart: relation.direction === 'MUTUAL' ? marker : undefined,
      data: { relation, names: `${names.get(relation.source)} ${relation.direction === 'DIRECTED' ? '→' : relation.direction === 'MUTUAL' ? '↔' : '—'} ${names.get(relation.target)}`,
        lane: layout.lanes.get(relation.id) ?? 0, onSelect } };
  });
  return <div className="episode-relationship-canvas" aria-label="회차별 인물 관계도">
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} connectionMode={ConnectionMode.Loose}
      fitView fitViewOptions={{ padding: 0.24, maxZoom: 1.1 }} minZoom={0.15} maxZoom={1.6} nodesConnectable={false}
      nodesDraggable={false} elementsSelectable={false} onEdgeClick={(_, edge) => onSelect(edge.id)}
      proOptions={{ hideAttribution: true }} ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': '확대', 'controls.zoomOut.ariaLabel': '축소', 'controls.fitView.ariaLabel': '전체 보기' }}>
      <ResponsiveViewport />
      <Background color="var(--ch-border)" gap={22} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  </div>;
}
