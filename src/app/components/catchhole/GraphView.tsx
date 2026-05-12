import React, { useState, useEffect, useRef, useCallback } from 'react';
import { C } from './constants';
import { Plus, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

type TagType = 'character' | 'location' | 'event' | 'theme' | 'status';

const TAG_CFG: Record<TagType, { color: string; label: string }> = {
  character: { color: '#7C5CFC', label: '캐릭터'   },
  location:  { color: '#4BB8D9', label: '장소'      },
  event:     { color: '#E25C5C', label: '사건'      },
  theme:     { color: '#00C896', label: '테마'      },
  status:    { color: '#F4A261', label: '설정/상태' },
};

interface TagDef     { id: string; type: TagType; }
interface ChapterDef { id: string; label: string; tags: string[]; conflict?: boolean; }

interface SNode {
  id: string; kind: 'tag' | 'chapter';
  label: string; color: string; r: number;
  x: number; y: number; vx: number; vy: number;
  tagType?: TagType; conflict?: boolean; connections: number;
}
interface SEdge { source: string; target: string; color: string; tagType: TagType; }
interface SimState { nodes: SNode[]; edges: SEdge[]; alpha: number; }

const GW = 860, GH = 500;

function mkRand(seed: number) {
  let s = seed | 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

const INIT_TAGS: TagDef[] = [
  { id: '#수아',        type: 'character' },
  { id: '#강민준',      type: 'character' },
  { id: '#이레나',      type: 'character' },
  { id: '#하윤',        type: 'character' },
  { id: '#최검사',      type: 'character' },
  { id: '#법정',        type: 'location'  },
  { id: '#검찰청',      type: 'location'  },
  { id: '#커피숍',      type: 'location'  },
  { id: '#갈등',        type: 'event'     },
  { id: '#화해',        type: 'event'     },
  { id: '#수사',        type: 'event'     },
  { id: '#재판',        type: 'event'     },
  { id: '#로맨스',      type: 'theme'     },
  { id: '#법정드라마',  type: 'theme'     },
  { id: '#반전',        type: 'theme'     },
  { id: '#핵심설정',    type: 'status'    },
  { id: '#설정충돌⚠',  type: 'status'    },
];

const INIT_CHAPTERS: ChapterDef[] = [
  { id: 'c1',   label: '1화',   tags: ['#수아', '#검찰청', '#로맨스'] },
  { id: 'c3',   label: '3화',   tags: ['#강민준', '#검찰청', '#법정드라마'] },
  { id: 'c8',   label: '8화',   tags: ['#이레나', '#수아', '#검찰청'] },
  { id: 'c23',  label: '23화',  tags: ['#수아', '#강민준', '#핵심설정', '#법정'] },
  { id: 'c35',  label: '35화',  tags: ['#수아', '#하윤', '#커피숍', '#로맨스'] },
  { id: 'c47',  label: '47화',  tags: ['#수아', '#강민준', '#법정', '#핵심설정'] },
  { id: 'c67',  label: '67화',  tags: ['#강민준', '#최검사', '#검찰청', '#수사'] },
  { id: 'c89',  label: '89화',  tags: ['#이레나', '#수아', '#법정', '#갈등'] },
  { id: 'c103', label: '103화', tags: ['#수아', '#강민준', '#로맨스', '#갈등'] },
  { id: 'c118', label: '118화', tags: ['#이레나', '#강민준', '#법정', '#재판', '#법정드라마'] },
  { id: 'c123', label: '123화', tags: ['#수아', '#핵심설정', '#검찰청'] },
  { id: 'c142', label: '142화', tags: ['#이레나', '#수아', '#화해', '#핵심설정'] },
  { id: 'c155', label: '155화', tags: ['#수아', '#강민준', '#로맨스', '#반전'] },
  { id: 'c158', label: '158화', tags: ['#수아', '#강민준', '#법정', '#재판'] },
  { id: 'c159', label: '159화', tags: ['#수아', '#강민준', '#법정', '#설정충돌⚠', '#이레나'], conflict: true },
];

function buildGraph(tags: TagDef[], chapters: ChapterDef[]): SimState {
  const rand = mkRand(20250502);
  const tagConn: Record<string, number> = {};
  for (const ch of chapters)
    for (const t of ch.tags) tagConn[t] = (tagConn[t] || 0) + 1;

  const nodes: SNode[] = [];

  tags.forEach((tag, i) => {
    const a = (i / tags.length) * Math.PI * 2;
    const cr = tagConn[tag.id] || 1;
    nodes.push({
      id: tag.id, kind: 'tag', label: tag.id,
      color: TAG_CFG[tag.type].color,
      r: Math.min(32, 14 + cr * 2.4),
      x: GW / 2 + Math.cos(a) * 210 + (rand() - 0.5) * 80,
      y: GH / 2 + Math.sin(a) * 168 + (rand() - 0.5) * 80,
      vx: 0, vy: 0, tagType: tag.type, connections: cr,
    });
  });

  chapters.forEach((ch, i) => {
    const a = (i / chapters.length) * Math.PI * 2;
    nodes.push({
      id: ch.id, kind: 'chapter', label: ch.label,
      color: ch.conflict ? '#E25C5C' : '#72728A',
      r: 15,
      x: GW / 2 + Math.cos(a) * 100 + (rand() - 0.5) * 90,
      y: GH / 2 + Math.sin(a) * 80  + (rand() - 0.5) * 90,
      vx: 0, vy: 0, conflict: ch.conflict, connections: ch.tags.length,
    });
  });

  const tagMap = new Map(tags.map(t => [t.id, t]));
  const edges: SEdge[] = [];
  for (const ch of chapters) {
    for (const tid of ch.tags) {
      const td = tagMap.get(tid);
      if (td) edges.push({ source: ch.id, target: tid, color: TAG_CFG[td.type].color, tagType: td.type });
    }
  }
  return { nodes, edges, alpha: 1 };
}

function forceStep(state: SimState) {
  const { nodes, edges, alpha } = state;
  if (alpha < 0.003) return;

  const REP = 2800 * alpha;
  const SPR = 0.038 * alpha;
  const IDEAL = 88;
  const GRAV = 0.005 * alpha;
  const DAMP = 0.86;

  const nMap = new Map(nodes.map(n => [n.id, n]));

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy + 1;
      const d = Math.sqrt(d2);
      const f = REP / d2;
      const fx = dx / d * f, fy = dy / d * f;
      a.vx -= fx; a.vy -= fy;
      b.vx += fx; b.vy += fy;
    }
  }

  for (const e of edges) {
    const a = nMap.get(e.source), b = nMap.get(e.target);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) + 0.1;
    const f = SPR * (d - IDEAL);
    const fx = dx / d * f, fy = dy / d * f;
    a.vx += fx; a.vy += fy;
    b.vx -= fx; b.vy -= fy;
  }

  for (const n of nodes) {
    n.vx += (GW / 2 - n.x) * GRAV;
    n.vy += (GH / 2 - n.y) * GRAV;
    n.x += n.vx; n.y += n.vy;
    n.vx *= DAMP; n.vy *= DAMP;
    const pad = n.r + 8;
    n.x = Math.max(pad, Math.min(GW - pad, n.x));
    n.y = Math.max(pad, Math.min(GH - pad, n.y));
  }
  state.alpha *= 0.994;
}

interface Props { onBack?: () => void; }

export function GraphView({ onBack: _onBack }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId,    setHoverId]    = useState<string | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<TagType>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });
  const [addInput,   setAddInput]   = useState('');
  const [addTagType, setAddTagType] = useState<TagType>('character');
  const [, bump] = useState(0);

  const simRef   = useRef<SimState>({ nodes: [], edges: [], alpha: 0 });
  const rafRef   = useRef<number>(0);
  const frameRef = useRef(0);
  const isPanning = useRef(false);
  const svgRef   = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const state = buildGraph(INIT_TAGS, INIT_CHAPTERS);
    for (let i = 0; i < 180; i++) forceStep(state);
    state.alpha = 0.12;
    simRef.current = state;

    const loop = () => {
      forceStep(simRef.current);
      frameRef.current++;
      if (frameRef.current % 3 === 0) bump(n => n + 1);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const highlighted = (() => {
    if (!selectedId) return null;
    const s = new Set<string>([selectedId]);
    for (const e of simRef.current.edges) {
      if (e.source === selectedId) s.add(e.target);
      if (e.target === selectedId) s.add(e.source);
    }
    return s;
  })();

  const svgToUnit = useCallback((px: number) => {
    const el = svgRef.current;
    return el ? GW / el.clientWidth * px : px;
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPan(p => ({
      x: p.x + svgToUnit(e.movementX) / zoom,
      y: p.y + svgToUnit(e.movementY) / zoom,
    }));
  }, [zoom, svgToUnit]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom(z => Math.max(0.25, Math.min(4, z * factor)));
  }, []);

  const handleAddTag = useCallback(() => {
    if (!selectedId || !addInput.trim()) return;
    const raw = addInput.trim();
    const tagId = raw.startsWith('#') ? raw : `#${raw}`;
    const sim = simRef.current;
    const chNode = sim.nodes.find(n => n.id === selectedId);
    if (!chNode) return;

    if (!sim.nodes.find(n => n.id === tagId)) {
      const angle = Math.random() * Math.PI * 2;
      sim.nodes.push({
        id: tagId, kind: 'tag', label: tagId,
        color: TAG_CFG[addTagType].color,
        r: 16, connections: 1, tagType: addTagType,
        x: chNode.x + Math.cos(angle) * 70,
        y: chNode.y + Math.sin(angle) * 70,
        vx: 0, vy: 0,
      });
    }

    if (!sim.edges.find(e => e.source === selectedId && e.target === tagId)) {
      sim.edges.push({
        source: selectedId, target: tagId,
        color: TAG_CFG[addTagType].color, tagType: addTagType,
      });
      const n = sim.nodes.find(nd => nd.id === selectedId);
      if (n) n.connections++;
      sim.alpha = Math.max(sim.alpha, 0.35);
    }
    setAddInput('');
    bump(n => n + 1);
  }, [selectedId, addInput, addTagType]);

  const { nodes, edges } = simRef.current;
  const visibleIds = new Set(
    nodes
      .filter(n => n.kind === 'chapter' || !hiddenTypes.has(n.tagType as TagType))
      .map(n => n.id)
  );
  const selectedNode = nodes.find(n => n.id === selectedId) ?? null;
  const hoverNode    = nodes.find(n => n.id === hoverId)    ?? null;

  const connectedEdges = selectedId
    ? edges.filter(e => e.source === selectedId || e.target === selectedId)
    : [];

  const tx = GW / 2 + pan.x;
  const ty = GH / 2 + pan.y;
  const transform = `translate(${tx} ${ty}) scale(${zoom}) translate(${-GW / 2} ${-GH / 2})`;

  return (
    <div style={{
      display: 'flex', height: '100%', background: C.bg,
      fontFamily: "'Pretendard Variable','Pretendard','Apple SD Gothic Neo',-apple-system,sans-serif",
    }}>
      <div style={{
        width: 210, borderRight: `1px solid ${C.border}`, flexShrink: 0,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        <div style={{ padding: '18px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ color: C.t1, fontSize: 14, fontWeight: 700, letterSpacing: '-0.3px', marginBottom: 2 }}>
            해시태그 그래프
          </div>
          <div style={{ color: C.t3, fontSize: 12 }}>빛나는 검사 로맨스</div>
        </div>

        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { k: '회차 노드', v: nodes.filter(n => n.kind === 'chapter').length },
            { k: '태그 노드', v: nodes.filter(n => n.kind === 'tag').length },
            { k: '연결 수',   v: edges.length },
          ].map(s => (
            <div key={s.k} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.t3, fontSize: 12 }}>{s.k}</span>
              <span style={{ color: C.primary, fontSize: 13, fontWeight: 600 }}>{s.v}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 16px 6px' }}>
          <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            태그 유형
          </div>
          {(Object.entries(TAG_CFG) as [TagType, { color: string; label: string }][]).map(([type, cfg]) => {
            const count = nodes.filter(n => n.tagType === type).length;
            const hidden = hiddenTypes.has(type);
            return (
              <button key={type} onClick={() => setHiddenTypes(prev => {
                const s = new Set(prev); hidden ? s.delete(type) : s.add(type); return s;
              })} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '6px 0', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit',
                opacity: hidden ? 0.35 : 1, transition: 'opacity 0.13s',
              }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: cfg.color, flexShrink: 0,
                  boxShadow: hidden ? 'none' : `0 0 5px ${cfg.color}88` }} />
                <span style={{ color: C.t2, fontSize: 12, flex: 1, textAlign: 'left' }}>{cfg.label}</span>
                <span style={{ color: C.t3, fontSize: 11 }}>{count}</span>
              </button>
            );
          })}
        </div>

        <div style={{ padding: '12px 16px', marginTop: 'auto', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 6 }}>
          <button onClick={() => setZoom(z => Math.min(4, z * 1.25))} title="확대" style={btnStyle}>
            <ZoomIn size={13} />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.25, z / 1.25))} title="축소" style={btnStyle}>
            <ZoomOut size={13} />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ ...btnStyle, flex: 1, fontSize: 11, gap: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RotateCcw size={11} /> 초기화
          </button>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: C.bg }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${GW} ${GH}`}
          width="100%" height="100%"
          style={{ display: 'block', cursor: isPanning.current ? 'grabbing' : 'grab' }}
          onMouseDown={e => {
            if (!(e.target as Element).closest('[data-node]')) isPanning.current = true;
          }}
          onMouseMove={onMouseMove}
          onMouseUp={() => { isPanning.current = false; }}
          onMouseLeave={() => { isPanning.current = false; }}
          onWheel={onWheel}
          onClick={e => {
            if (!(e.target as Element).closest('[data-node]')) setSelectedId(null);
          }}
        >
          <defs>
            {(Object.keys(TAG_CFG) as TagType[]).map(type => (
              <filter key={type} id={`gf-${type}`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                <feColorMatrix in="blur" type="matrix"
                  values={`0 0 0 0 ${hexR(TAG_CFG[type].color)}  0 0 0 0 ${hexG(TAG_CFG[type].color)}  0 0 0 0 ${hexB(TAG_CFG[type].color)}  0 0 0 0.7 0`}
                  result="gcolor" />
                <feMerge><feMergeNode in="gcolor" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            ))}
            <filter id="gf-conflict" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.89  0 0 0 0 0.36  0 0 0 0 0.36  0 0 0 0.8 0" result="gc" />
              <feMerge><feMergeNode in="gc" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <g transform={transform}>
            <g>
              {edges.map((e, i) => {
                const src = nodes.find(n => n.id === e.source);
                const tgt = nodes.find(n => n.id === e.target);
                if (!src || !tgt) return null;
                if (!visibleIds.has(e.source) || !visibleIds.has(e.target)) return null;

                const linked = highlighted
                  ? (highlighted.has(e.source) && highlighted.has(e.target))
                  : (hoverId === e.source || hoverId === e.target);

                const opacity = highlighted
                  ? (linked ? 0.85 : 0.04)
                  : hoverId
                    ? (linked ? 0.75 : 0.08)
                    : 0.20;

                return (
                  <line key={i}
                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={e.color}
                    strokeWidth={linked ? 1.6 : 0.9}
                    strokeOpacity={opacity}
                    style={{ transition: 'stroke-opacity 0.12s, stroke-width 0.12s' }}
                  />
                );
              })}
            </g>

            <g>
              {nodes.map(node => {
                if (!visibleIds.has(node.id)) return null;
                const isSel  = selectedId === node.id;
                const isHov  = hoverId    === node.id;
                const isDim  = highlighted ? !highlighted.has(node.id) : false;
                const sc     = isSel ? 1.28 : isHov ? 1.13 : 1;
                const filter = node.conflict
                  ? 'url(#gf-conflict)'
                  : (isSel || isHov) && node.tagType
                    ? `url(#gf-${node.tagType})`
                    : undefined;

                return (
                  <g key={node.id}
                    data-node="1"
                    transform={`translate(${node.x},${node.y}) scale(${sc})`}
                    style={{
                      cursor: 'pointer',
                      opacity: isDim ? 0.1 : 1,
                      transition: 'opacity 0.13s',
                    }}
                    onMouseEnter={() => setHoverId(node.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedId(prev => prev === node.id ? null : node.id);
                    }}
                  >
                    {(isSel || isHov || node.conflict) && (
                      <circle r={node.r + 7} fill={node.color} opacity={0.12} />
                    )}

                    {node.kind === 'tag' ? (
                      <>
                        <circle
                          r={node.r}
                          fill={node.color + '28'}
                          stroke={node.color}
                          strokeWidth={isSel ? 2.2 : 1.5}
                          filter={filter}
                        />
                        <text
                          textAnchor="middle" y={node.r > 22 ? 4 : 3.5}
                          fill={node.color}
                          fontSize={Math.min(11, Math.max(7.5, node.r * 0.52))}
                          fontWeight="700"
                          style={{ fontFamily: 'inherit', pointerEvents: 'none', userSelect: 'none' }}
                        >
                          {node.label}
                        </text>
                      </>
                    ) : (
                      <>
                        <circle
                          r={node.r}
                          fill={C.bg}
                          stroke={node.color}
                          strokeWidth={isSel ? 2.5 : node.conflict ? 2 : 1.5}
                          filter={filter}
                        />
                        <text
                          textAnchor="middle" y={4}
                          fill={node.color}
                          fontSize={8.5}
                          fontWeight="600"
                          style={{ fontFamily: 'inherit', pointerEvents: 'none', userSelect: 'none' }}
                        >
                          {node.label}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {hoverNode && !selectedId && (
          <div style={{
            position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '8px 14px', pointerEvents: 'none', zIndex: 20,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}>
            <span style={{ color: hoverNode.color, fontSize: 13, fontWeight: 700 }}>{hoverNode.label}</span>
            <span style={{ color: C.t3, fontSize: 12, marginLeft: 8 }}>
              {hoverNode.kind === 'chapter'
                ? `태그 ${hoverNode.connections}개${hoverNode.conflict ? ' · ⚠ 충돌' : ''}`
                : `${hoverNode.tagType ? TAG_CFG[hoverNode.tagType as TagType].label : ''} · ${hoverNode.connections}회차 등장`}
            </span>
          </div>
        )}

        <div style={{
          position: 'absolute', bottom: 14, left: 14,
          display: 'flex', gap: 12, alignItems: 'center',
          background: C.surface + 'CC', backdropFilter: 'blur(6px)',
          border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: `1.5px solid #72728A`, background: C.bg }} />
            <span style={{ color: C.t3, fontSize: 11 }}>회차</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#7C5CFC55', border: '1.5px solid #7C5CFC' }} />
            <span style={{ color: C.t3, fontSize: 11 }}>태그</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid #E25C5C`, background: C.bg }} />
            <span style={{ color: C.t3, fontSize: 11 }}>충돌 회차</span>
          </div>
          <div style={{ color: C.t3, fontSize: 11, marginLeft: 4 }}>
            스크롤 · 드래그로 탐색
          </div>
        </div>
      </div>

      <div style={{
        width: 248, borderLeft: `1px solid ${C.border}`, flexShrink: 0,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {selectedNode ? (
          <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {selectedNode.kind === 'tag' ? '태그 노드' : '회차 노드'}
              </div>
              <div style={{
                background: C.surface, borderRadius: 8,
                border: `1px solid ${selectedNode.color}55`, padding: '12px 14px',
              }}>
                <div style={{ color: selectedNode.color, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                  {selectedNode.label}
                </div>
                {selectedNode.kind === 'tag' && selectedNode.tagType && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: selectedNode.color }} />
                    <span style={{ color: C.t3, fontSize: 12 }}>{TAG_CFG[selectedNode.tagType].label}</span>
                  </div>
                )}
                {selectedNode.conflict && (
                  <div style={{ color: '#E25C5C', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>⚠ 설정 충돌 감지</div>
                )}
                <div style={{ color: C.t3, fontSize: 12 }}>
                  {selectedNode.kind === 'chapter'
                    ? `${selectedNode.connections}개 태그와 연결됨`
                    : `${selectedNode.connections}개 회차에서 사용됨`}
                </div>
              </div>
            </div>

            <div>
              <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                연결된 {selectedNode.kind === 'chapter' ? '태그' : '회차'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {connectedEdges.map(e => {
                  const otherId = e.source === selectedId ? e.target : e.source;
                  const other   = nodes.find(n => n.id === otherId);
                  if (!other) return null;
                  return (
                    <button key={otherId} onClick={() => setSelectedId(otherId)} style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '6px 10px', background: C.surface,
                      border: `1px solid ${C.border}`, borderRadius: 5,
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      transition: 'border-color 0.12s',
                    }}
                      onMouseEnter={ev => (ev.currentTarget.style.borderColor = '#3A3A4A')}
                      onMouseLeave={ev => (ev.currentTarget.style.borderColor = C.border)}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: other.kind === 'tag' ? other.color : 'transparent',
                        border: `1.5px solid ${other.color}`,
                      }} />
                      <span style={{ color: C.t1, fontSize: 12 }}>{other.label}</span>
                      {other.conflict && <span style={{ color: '#E25C5C', fontSize: 10, marginLeft: 'auto' }}>⚠</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedNode.kind === 'chapter' && (
              <div>
                <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  태그 추가
                </div>
                <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                  <input
                    value={addInput}
                    onChange={e => setAddInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                    placeholder="#새태그명"
                    style={{
                      flex: 1, height: 32, borderRadius: 5, background: C.bg,
                      border: `1px solid ${C.border}`, color: C.t1, fontSize: 13,
                      padding: '0 10px', fontFamily: 'inherit', outline: 'none',
                    }}
                    onFocus={e => (e.target.style.borderColor = C.primary)}
                    onBlur={e => (e.target.style.borderColor = C.border)}
                  />
                  <button onClick={handleAddTag} style={{
                    width: 32, height: 32, borderRadius: 5, background: addInput ? C.primary : C.border,
                    border: 'none', color: '#fff', cursor: addInput ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.13s',
                  }}>
                    <Plus size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(Object.entries(TAG_CFG) as [TagType, { color: string; label: string }][]).map(([type, cfg]) => (
                    <button key={type} onClick={() => setAddTagType(type)} style={{
                      padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 11,
                      background: addTagType === type ? cfg.color + '22' : 'transparent',
                      border: `1px solid ${addTagType === type ? cfg.color : C.border}`,
                      color: addTagType === type ? cfg.color : C.t3,
                      transition: 'all 0.12s',
                    }}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '20px 16px' }}>
            <div style={{ color: C.t2, fontSize: 13, fontWeight: 600, marginBottom: 12 }}>사용 방법</div>
            {[
              { dot: '#7C5CFC', text: '노드 클릭 — 연결 강조' },
              { dot: '#4BB8D9', text: '배경 드래그 — 이동' },
              { dot: '#00C896', text: '스크롤 — 줌 인/아웃' },
              { dot: '#F4A261', text: '회차 선택 후 태그 추가 가능' },
            ].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: item.dot, marginTop: 4, flexShrink: 0 }} />
                <span style={{ color: C.t3, fontSize: 12, lineHeight: 1.5 }}>{item.text}</span>
              </div>
            ))}

            <div style={{ marginTop: 16, padding: '10px 12px', background: C.surface, borderRadius: 6, border: `1px solid ${C.border}` }}>
              <div style={{ color: C.t3, fontSize: 11, marginBottom: 6 }}>가장 연결된 태그</div>
              {[...nodes]
                .filter(n => n.kind === 'tag')
                .sort((a, b) => b.connections - a.connections)
                .slice(0, 5)
                .map(n => (
                  <div key={n.id} onClick={() => setSelectedId(n.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 0', cursor: 'pointer',
                  }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: n.color }} />
                    <span style={{ color: C.t2, fontSize: 12, flex: 1 }}>{n.label}</span>
                    <span style={{ color: C.t3, fontSize: 11 }}>{n.connections}화</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 5,
  background: '#1A1A22', border: `1px solid ${C.border}`,
  color: C.t2, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function hexToRgb(hex: string) {
  const m = hex.replace('#', '').match(/.{2}/g)!;
  return m.map(h => parseInt(h, 16) / 255);
}
function hexR(hex: string) { return hexToRgb(hex)[0].toFixed(3); }
function hexG(hex: string) { return hexToRgb(hex)[1].toFixed(3); }
function hexB(hex: string) { return hexToRgb(hex)[2].toFixed(3); }
