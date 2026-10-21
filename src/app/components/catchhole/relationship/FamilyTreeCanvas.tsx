import { createContext, memo, useContext, useEffect, useMemo, useRef, useState, type FocusEvent } from 'react';
import {
  BaseEdge, ConnectionMode, EdgeLabelRenderer, Handle, Panel, Position,
  ReactFlow, ReactFlowProvider, getViewportForBounds, useReactFlow, useStore,
  type Edge, type EdgeProps, type Node, type NodeProps,
} from '@xyflow/react';
import { ChevronDown, ChevronRight, Maximize, Minus, Plus, UserRound, X } from 'lucide-react';
import { ActionButton } from '../ui-v2/ActionButton';
import { CharacterSubjectImage } from '../character/CharacterSubjectImage';
import type { WorldSettingImageResponse } from '../../../api/generated/types.gen';
import { KIND_LABELS, SUBTYPE_LABELS, type RelationshipSubtype } from './relationship-presentation';
import { layoutFamilyTree, type FamilyTreeConnection as Connection } from './family-tree-layout';
import '@xyflow/react/dist/style.css';

const KeyboardPanContext = createContext({ current: false });

type Layout = Awaited<ReturnType<typeof layoutFamilyTree>>;
type PersonNode = Node<{ name: string; nodeId: string; characterId?: string | null; candidateId?: string | null; nodeType?: 'CHARACTER' | 'MENTION'; image?: WorldSettingImageResponse | null; highlight?: 'focus' | 'search'; onOpen: (id: string) => void; disabled: boolean }, 'person'>;
type GenerationRegionNode = Node<{ label: string }, 'generationRegion'>;
type FamilyNode = PersonNode | GenerationRegionNode;
type FamilyEdge = Edge<{
  connection: Connection; candidateId?: string | null; relationshipId?: string | null; accessibleLabel: string; sources: Layout['edges']; onOpen: (id: string, endpointId?: string) => void; disabled: boolean;
}, 'family'>;

function relationshipDescription(edge: Layout['edges'][number]) {
  return `${KIND_LABELS[edge.kind]}${edge.kind === 'ANCESTOR_OF' ? ` · ${edge.generationGap != null ? `${edge.generationGap}대손` : '세대 미상'}` : ''}${edge.subtype && edge.subtype !== 'UNSPECIFIED' ? ` · ${SUBTYPE_LABELS[edge.subtype as RelationshipSubtype] ?? edge.subtype}` : ''}${edge.temporalScope === 'HISTORICAL' ? ' · 과거' : ''}${edge.timeLabel ? ` · ${edge.timeLabel}` : ''}`;
}

function relationshipNames(edge: Layout['edges'][number], names: Map<string, string>) {
  return `${names.get(edge.source) ?? '인물'} ${edge.kind === 'PARENT_OF' || edge.kind === 'ANCESTOR_OF' ? '→' : '↔'} ${names.get(edge.target) ?? '인물'}`;
}

function revealFocusedControl(event: FocusEvent<HTMLElement>, flow: ReturnType<typeof useReactFlow>, center: { x: number; y: number }, tabNavigation: boolean) {
  if (!tabNavigation || !event.currentTarget.matches(':focus-visible')) return;
  const canvas = event.currentTarget.closest('.react-flow')?.getBoundingClientRect();
  if (!canvas) return;
  const control = event.currentTarget.getBoundingClientRect();
  const viewport = flow.getViewport();
  // Native focus can briefly scroll the label portal before React Flow resets it.
  // Project the graph position instead of trusting that transient DOM position.
  const x = viewport.x + center.x * viewport.zoom;
  const y = viewport.y + center.y * viewport.zoom;
  if (x - control.width / 2 < 8 || x + control.width / 2 > canvas.width - 8 || y - control.height / 2 < 8 || y + control.height / 2 > canvas.height - 72) {
    void flow.setCenter(center.x, center.y, { zoom: viewport.zoom, duration: 0 });
  }
}

const Person = memo(function Person({ data }: NodeProps<PersonNode>) {
  const flow = useReactFlow();
  const keyboardPan = useContext(KeyboardPanContext);
  const mention = data.nodeType === 'MENTION';
  const highlightLabel = data.highlight === 'focus' ? '중심 인물' : data.highlight === 'search' ? '검색 결과' : '';
  return <div className={`family-tree-person${mention ? ' is-mention' : ''}${data.highlight ? ' is-highlighted' : ''}`} data-character-id={data.characterId ?? undefined} data-node-id={data.nodeId} data-highlight={data.highlight}>
    {([['top', Position.Top], ['bottom', Position.Bottom], ['left', Position.Left], ['right', Position.Right]] as const)
      .map(([id, position]) => <Handle key={id} id={id} type="source" position={position} isConnectable={false} />)}
    <button type="button" className="nodrag nopan" aria-label={`${data.name} ${mention ? '설정 근거 보기' : '프로필 열기'}`} aria-description={highlightLabel || undefined} data-candidate-id={data.candidateId ?? undefined} disabled={data.disabled}
      onFocus={event => {
        const node = flow.getNode(data.nodeId);
        if (node) revealFocusedControl(event, flow, { x: node.position.x + (node.width ?? 192) / 2, y: node.position.y + (node.height ?? 88) / 2 }, keyboardPan.current);
      }} onClick={() => data.onOpen((mention ? data.candidateId : data.characterId) ?? '')}>
      <span className="family-tree-avatar" aria-hidden="true">{!mention && data.image?.source !== 'DEFAULT'
        ? <CharacterSubjectImage image={data.image ?? undefined} className="family-tree-avatar-image" fallback={<UserRound size={24} />} />
        : <UserRound size={24} />}</span>
      <strong title={data.name}>{data.name}</strong><span className={mention ? "family-tree-mention-hint" : "family-tree-profile-hint"}>{mention ? `${highlightLabel ? `${highlightLabel} · ` : ''}프로필 미등록` : highlightLabel || '프로필 보기'} <ChevronRight size={12} aria-hidden="true" /></span>
    </button>
  </div>;
});

function FamilyConnection({ id, data, selected }: EdgeProps<FamilyEdge>) {
  const flow = useReactFlow();
  const keyboardPan = useContext(KeyboardPanContext);
  if (!data) return null;
  const { connection, accessibleLabel, onOpen } = data;
  const singleId = connection.relationshipIds.length === 1 ? connection.relationshipIds[0] : undefined;
  return <>
    {connection.paths.map((points, index) => {
      const path = points.map((point, pointIndex) => `${pointIndex ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
      return <BaseEdge key={path} id={`${id}:${index}`} path={path} interactionWidth={24}
        className={`family-tree-line family-tree-line--${connection.kind.toLowerCase()} family-tree-line--${connection.subtype?.toLowerCase()}${connection.temporalScope === 'HISTORICAL' ? ' is-historical' : ''}${selected ? ' is-selected' : ''}`} />;
    })}
    {connection.lineageBreak && <path data-lineage-break={connection.id}
      className={`family-tree-line family-tree-lineage-break${selected ? ' is-selected' : ''}`}
      d={connection.lineageBreak.direction === 'vertical'
        ? `M ${connection.lineageBreak.position.x - 9} ${connection.lineageBreak.position.y - 2} l 18 -8 M ${connection.lineageBreak.position.x - 9} ${connection.lineageBreak.position.y + 10} l 18 -8`
        : `M ${connection.lineageBreak.position.x - 10} ${connection.lineageBreak.position.y + 9} l 8 -18 M ${connection.lineageBreak.position.x + 2} ${connection.lineageBreak.position.y + 9} l 8 -18`}
      fill="none" aria-hidden="true" />}
    {connection.label && <EdgeLabelRenderer><button type="button" className={`family-tree-edge-label nodrag nopan${selected ? ' is-selected' : ''}`}
      data-connection-id={connection.id} data-relationship-ids={JSON.stringify(connection.relationshipIds)} data-relationship-id={singleId ? data.relationshipId ?? undefined : undefined} data-candidate-id={singleId ? data.candidateId ?? undefined : undefined}
      disabled={data.disabled} onFocus={event => revealFocusedControl(event, flow, connection.labelPosition, keyboardPan.current)}
      title={accessibleLabel} aria-label={accessibleLabel} aria-pressed={Boolean(selected)}
      style={{ width: connection.labelSize.width, height: connection.labelSize.height, transform: `translate(-50%, -50%) translate(${connection.labelPosition.x}px, ${connection.labelPosition.y}px)` }}
      onClick={event => { event.stopPropagation(); onOpen(connection.id); }}>
      <span className={connection.detailLabel ? 'family-tree-lineage-label' : undefined}>{connection.detailLabel
        ? <><span>{connection.label}</span><small>{connection.detailLabel}</small></>
        : connection.label}{!singleId && <ChevronDown size={13} aria-hidden="true" />}</span>
    </button></EdgeLabelRenderer>}
    {connection.endpointLabels.map((label, index) => {
      const source = label.relationshipIds.length === 1 ? data.sources.find(edge => edge.id === label.relationshipIds[0]) : undefined;
      const labelSources = data.sources.filter(edge => label.relationshipIds.includes(edge.id));
      const subtype = labelSources.length && labelSources.every(edge => edge.subtype === labelSources[0].subtype) ? labelSources[0].subtype : undefined;
      const context = `${subtype === 'ADOPTIVE' ? ' · 입양' : subtype === 'STEP' ? ' · 의붓' : ''}${connection.temporalScope === 'HISTORICAL' ? ' · 과거' : ''}`;
      const title = `${label.personName} · ${label.label}${context} 관계${label.relationshipIds.length > 1 ? ` ${label.relationshipIds.length}개` : ''} 근거 보기`;
      const representative = !connection.label && index === 0;
      return <EdgeLabelRenderer key={label.id}><button type="button" className={`family-tree-edge-label family-tree-endpoint-label nodrag nopan${selected ? ' is-selected' : ''}`}
        data-endpoint-label-id={label.id} data-endpoint-person-id={label.personId} data-endpoint-role={label.role} data-endpoint-relationship-ids={JSON.stringify(label.relationshipIds)}
        data-connection-id={representative ? connection.id : undefined} data-relationship-ids={representative ? JSON.stringify(connection.relationshipIds) : undefined}
        data-relationship-id={source && source.sourceType !== 'MENTION' ? source.relationshipId ?? source.id : undefined}
        data-candidate-id={source?.sourceType === 'MENTION' ? source.candidateId ?? undefined : undefined}
        title={title} aria-label={title} aria-pressed={Boolean(selected)} disabled={data.disabled}
        onFocus={event => revealFocusedControl(event, flow, label.position, keyboardPan.current)}
        style={{ width: label.size.width, height: label.size.height, transform: `translate(-50%, -50%) translate(${label.position.x}px, ${label.position.y}px)` }}
        onClick={event => { event.stopPropagation(); onOpen(connection.id, label.id); }}><span>{label.label}</span>
      </button></EdgeLabelRenderer>;
    })}
  </>;
}
function GenerationRegion({ data }: NodeProps<GenerationRegionNode>) {
  return <div className="family-tree-generation-region"><strong>{data.label}</strong><span>정확한 세대 간격을 알 수 없어요</span></div>;
}
const nodeTypes = { person: Person, generationRegion: GenerationRegion };
const edgeTypes = { family: FamilyConnection };

// Fit only on the initial graph or an explicit display-scope change. Data polling must not move the viewport.
function ViewportControls({ scopeKey, ready, bounds }: { scopeKey: string; ready: boolean; bounds: { width: number; height: number } }) {
  const flow = useReactFlow();
  const width = useStore(state => state.width);
  const height = useStore(state => state.height);
  const fittedScope = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !flow.viewportInitialized || !width || !height || fittedScope.current === scopeKey) return;
    // Coordinates and sizes come from our layout. Wait for the viewport, not controlled-node measurement echoes.
    const frame = requestAnimationFrame(() => {
      fittedScope.current = scopeKey;
      void flow.setViewport(getViewportForBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height }, width, Math.max(1, height - 68), 0.005, 1, 0.08), { duration: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [bounds.height, bounds.width, flow, height, ready, scopeKey, width]);
  return <Panel position="bottom-left" className="family-tree-controls">
    <ActionButton variant="secondary" aria-label="확대" onClick={() => void flow.zoomIn({ duration: 0 })}><Plus size={18} aria-hidden="true" /></ActionButton>
    <ActionButton variant="secondary" aria-label="축소" onClick={() => void flow.zoomOut({ duration: 0 })}><Minus size={18} aria-hidden="true" /></ActionButton>
    <ActionButton variant="secondary" icon={<Maximize size={16} aria-hidden="true" />} onClick={() => void flow.setViewport(getViewportForBounds({ x: 0, y: 0, ...bounds }, width, Math.max(1, height - 68), 0.005, 1, 0.08), { duration: 0 })}>전체 보기</ActionButton>
  </Panel>;
}

export function FamilyTreeCanvas({ layout, images, scopeKey, ready, focusCharacterId, searchMatchIds, selectedRelationshipId, selectedCandidateId, onOpenCharacter, onOpenRelationship, onOpenMention }: {
  images: ReadonlyMap<string, WorldSettingImageResponse | null | undefined>;
  focusCharacterId: string; searchMatchIds: ReadonlySet<string>;
  layout: Layout; scopeKey: string; ready: boolean; selectedRelationshipId: string; selectedCandidateId: string;
  onOpenCharacter: (id: string) => void; onOpenRelationship: (id: string) => void; onOpenMention: (id: string) => void;
}) {
  const keyboardPan = useRef(false);
  const [selection, setSelection] = useState<{ scope: string; id: string; endpointId?: string } | null>(null);
  const selectionPanel = useRef<HTMLElement>(null);
  const explorer = useRef<HTMLDivElement>(null);
  const names = useMemo(() => new Map(layout.nodes.map(node => [node.id, node.name])), [layout.nodes]);
  const selectedConnection = selection?.scope === scopeKey ? layout.connections.find(connection => connection.id === selection.id) : undefined;
  const selectedEndpoint = selectedConnection?.endpointLabels.find(label => label.id === selection?.endpointId);
  const selectedConnectionId = selectedConnection?.id;
  const selectionKey = selectedConnection ? `${selectedConnection.id}:${selectedEndpoint?.id ?? ''}` : undefined;
  useEffect(() => {
    if (!selectionKey) return;
    selectionPanel.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    selectionPanel.current?.focus({ preventScroll: true });
  }, [selectionKey]);
  function openSource(edge: Layout['edges'][number]) {
    if (edge.sourceType === 'MENTION') { if (edge.candidateId) onOpenMention(edge.candidateId); }
    else onOpenRelationship(edge.relationshipId ?? edge.id);
  }
  function openConnection(id: string, endpointId?: string) {
    const connection = layout.connections.find(item => item.id === id);
    if (!ready || !connection) return;
    const ids = connection.endpointLabels.find(label => label.id === endpointId)?.relationshipIds ?? connection.relationshipIds;
    if (ids.length === 1) {
      setSelection(null);
      const source = layout.edges.find(edge => edge.id === ids[0]);
      if (source) openSource(source);
    } else {
      setSelection({ scope: scopeKey, id, endpointId });
      onOpenRelationship('');
    }
  }
  function closeConnection() {
    const id = selectedConnection?.id;
    setSelection(null);
    if (!id) return;
    const trigger = explorer.current?.querySelector<HTMLElement>(selectedEndpoint
      ? `[data-endpoint-label-id="${CSS.escape(selectedEndpoint.id)}"]` : `[data-connection-id="${CSS.escape(id)}"]`);
    trigger?.closest('.family-tree-canvas')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    trigger?.focus({ preventScroll: true });
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => { keyboardPan.current = event.key === 'Tab'; };
    const pointer = () => { keyboardPan.current = false; };
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', pointer, true);
    return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', pointer, true); };
  }, []);
  const nodes = useMemo<FamilyNode[]>(() => [
    ...layout.regions.map(region => ({
      id: region.id, type: 'generationRegion' as const, position: region.position, width: region.width, height: region.height,
      data: { label: region.label }, zIndex: -1, focusable: false, draggable: false, connectable: false, selectable: false,
    })),
    ...layout.nodes.map(node => ({
    id: node.id, type: 'person', position: node.position, width: node.width, height: node.height,
    // Fixed handle geometry keeps edge portals mounted across controlled-node updates.
    // Otherwise React Flow clears measured handles until the next DOM measurement.
    handles: [
      { id: 'top', type: 'source', position: Position.Top, x: node.width / 2 - 3, y: -3, width: 6, height: 6 },
      { id: 'bottom', type: 'source', position: Position.Bottom, x: node.width / 2 - 3, y: node.height - 3, width: 6, height: 6 },
      { id: 'left', type: 'source', position: Position.Left, x: -3, y: node.height / 2 - 3, width: 6, height: 6 },
      { id: 'right', type: 'source', position: Position.Right, x: node.width - 3, y: node.height / 2 - 3, width: 6, height: 6 },
    ],
    data: { name: node.name, nodeId: node.id, characterId: node.characterId, candidateId: node.candidateId, nodeType: node.nodeType, image: images.get(node.id),
      highlight: node.nodeType !== 'MENTION' && (node.characterId ?? node.id) === focusCharacterId ? 'focus' : searchMatchIds.has(node.id) ? 'search' : undefined,
      onOpen: node.nodeType === 'MENTION' ? onOpenMention : onOpenCharacter, disabled: !ready || (node.nodeType === 'MENTION' && !node.candidateId) },
    focusable: false, draggable: false, connectable: false,
  } as PersonNode))], [layout.nodes, layout.regions, images, focusCharacterId, searchMatchIds, onOpenCharacter, onOpenMention, ready]);
  const byId = new Map(layout.edges.map(edge => [edge.id, edge]));
  const edges: FamilyEdge[] = layout.connections.flatMap(connection => {
    const relation = byId.get(connection.relationshipIds[0]);
    if (!relation) return [];
    const sourceIds = new Set([...connection.relationshipIds, ...connection.endpointLabels.flatMap(label => label.relationshipIds)]);
    return [{
      id: connection.id, source: relation.source, target: relation.target, type: 'family', sourceHandle: relation.sourceHandle, targetHandle: relation.targetHandle,
      selected: selectedConnectionId === connection.id || connection.relationshipIds.some(id => { const edge = byId.get(id); return edge?.sourceType === 'MENTION' ? edge.candidateId === selectedCandidateId : (edge?.relationshipId ?? id) === selectedRelationshipId; }), focusable: false,
      data: { connection, sources: [...sourceIds].flatMap(id => byId.get(id) ?? []), candidateId: relation.sourceType === 'MENTION' ? relation.candidateId : undefined, relationshipId: relation.sourceType !== 'MENTION' ? relation.relationshipId ?? relation.id : undefined, onOpen: openConnection, disabled: !ready,
        accessibleLabel: connection.relationshipIds.length === 1 ? `${relationshipNames(relation, names)}${connection.kind === 'ANCESTOR_OF' ? ` ${connection.label} · 중간 계보 생략` : ''} 관계 근거 보기`
          : `${connection.label} 관계 ${connection.relationshipIds.length}개 보기`,
      },
    }];
  });
  const panelRelations = (selectedEndpoint?.relationshipIds ?? selectedConnection?.relationshipIds)?.flatMap(id => byId.get(id) ?? []) ?? [];
  return <div className="family-tree-explorer" ref={explorer}>
    <div className="family-tree-canvas" tabIndex={-1} role="region" aria-label="가계도" aria-busy={!ready}>
    <KeyboardPanContext.Provider value={keyboardPan}><ReactFlowProvider><ReactFlow<FamilyNode, FamilyEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      connectionMode={ConnectionMode.Loose} nodesDraggable={false} nodesConnectable={false}
      elementsSelectable={false} deleteKeyCode={null} minZoom={0.005} maxZoom={1.6} zoomOnDoubleClick={false}
      panOnScroll={false} zoomOnScroll={false} preventScrolling={false}
      onEdgeClick={(_, edge) => openConnection(edge.id)}>
      <ViewportControls scopeKey={scopeKey} ready={ready} bounds={{ width: layout.width, height: layout.height }} />
    </ReactFlow></ReactFlowProvider></KeyboardPanContext.Provider>
    {!ready && <div className="family-tree-updating" role="status">배치를 정리하고 있어요.</div>}
    </div>
    {selectedConnection && <section className="family-tree-connection-detail" aria-label="선택한 가족 연결" tabIndex={-1} ref={selectionPanel}>
      <header><div><h3>{selectedEndpoint ? `${selectedEndpoint.personName} · ${selectedEndpoint.label}` : selectedConnection.label || '가족 관계'}</h3>
        <p>{(selectedEndpoint ? [...new Set(panelRelations.flatMap(relation => [relation.source, relation.target]))] : selectedConnection.personIds)
          .map(id => names.get(id)).filter(Boolean).join(' · ')}</p></div>
        <ActionButton variant="ghost" aria-label="가족 연결 닫기" onClick={closeConnection} icon={<X size={18} aria-hidden="true" />}>닫기</ActionButton></header>
      <p className="relationship-muted">함께 표시한 관계예요. 확인할 관계를 선택하면 근거가 열려요.</p>
      <div className="family-tree-connection-relations">{panelRelations.map(relation => <button key={relation.id} type="button" data-relationship-id={relation.sourceType === 'MENTION' ? undefined : relation.relationshipId ?? relation.id} data-candidate-id={relation.sourceType === 'MENTION' ? relation.candidateId ?? undefined : undefined}
        aria-label={`${relationshipNames(relation, names)} 관계 근거 보기`} aria-pressed={relation.sourceType === 'MENTION' ? selectedCandidateId === relation.candidateId : selectedRelationshipId === (relation.relationshipId ?? relation.id)} disabled={!ready}
        onClick={() => openSource(relation)}>
        <strong>{relationshipNames(relation, names)}</strong><span>{relationshipDescription(relation)}{relation.sourceType === 'MENTION' ? ' · 프로필 미등록' : ''}</span><ChevronRight size={18} aria-hidden="true" />
      </button>)}</div>
    </section>}
  </div>;
}
