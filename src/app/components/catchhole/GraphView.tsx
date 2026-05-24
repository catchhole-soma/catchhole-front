import React, { useState, useEffect, useRef, useCallback } from 'react';
import { C } from './constants';
import { Plus, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

type TagType = 'character' | 'location' | 'event' | 'theme' | 'status';
type EdgeRelationType = 'chapter-tag' | 'romantic' | 'enemy' | 'family' | 'colleague' | 'resides' | 'leads' | 'background';

const TAG_CFG: Record<TagType, { color: string; label: string }> = {
  character: { color: '#7C5CFC', label: '캐릭터'   },
  location:  { color: '#4BB8D9', label: '장소'      },
  event:     { color: '#E25C5C', label: '사건'      },
  theme:     { color: '#00C896', label: '테마'      },
  status:    { color: '#F4A261', label: '설정/상태' },
};

const EDGE_CFG: Record<EdgeRelationType, { color: string; label: string; strokeDasharray?: string; strokeWidth: number; directed: boolean }> = {
  'chapter-tag': { color: '',        label: '회차→태그',  strokeWidth: 0.9, directed: false },
  'romantic':    { color: '#FF6B9D', label: '연인',       strokeDasharray: '3,3', strokeWidth: 1.6, directed: false },
  'enemy':       { color: '#E25C5C', label: '적대',       strokeDasharray: '6,3', strokeWidth: 1.8, directed: false },
  'family':      { color: '#F4A261', label: '가족',       strokeWidth: 2.2, directed: false },
  'colleague':   { color: '#4BB8D9', label: '동료/상사',  strokeWidth: 1.3, directed: true  },
  'resides':     { color: '#00C896', label: '거주/활동',  strokeWidth: 1.1, directed: true  },
  'leads':       { color: '#A78BFA', label: '주도/관여',  strokeWidth: 1.1, directed: true  },
  'background':  { color: '#72728A', label: '배경 장소',  strokeWidth: 0.9, directed: true  },
};

const IDEAL_MAP: Record<EdgeRelationType, number> = {
  'romantic': 70, 'family': 65, 'enemy': 115, 'colleague': 85,
  'resides': 80, 'leads': 80, 'background': 90, 'chapter-tag': 88,
};

interface TagDef     { id: string; type: TagType; }
interface ChapterDef { id: string; label: string; tags: string[]; conflict?: boolean; }
interface TagRelation { source: string; target: string; relationType: Exclude<EdgeRelationType, 'chapter-tag'>; }

interface SNode {
  id: string; kind: 'tag' | 'chapter';
  label: string; color: string; r: number;
  x: number; y: number; vx: number; vy: number;
  tagType?: TagType; conflict?: boolean; connections: number;
}
interface SEdge {
  source: string; target: string; color: string;
  tagType?: TagType;
  relationType: EdgeRelationType;
  directed: boolean;
  label?: string;
}
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
  { id: '#수아',       type: 'character' },
  { id: '#강민준',     type: 'character' },
  { id: '#이레나',     type: 'character' },
  { id: '#하윤',       type: 'character' },
  { id: '#최검사',     type: 'character' },
  { id: '#박형사',     type: 'character' },
  { id: '#오변호사',   type: 'character' },
  { id: '#김판사',     type: 'character' },
  { id: '#신비서',     type: 'character' },
  { id: '#정형사',     type: 'character' },
  { id: '#이증인',     type: 'character' },
  { id: '#박부장',     type: 'character' },
  { id: '#한원장',     type: 'character' },
  { id: '#최변호사',   type: 'character' },
  { id: '#서형사',     type: 'character' },
  { id: '#법정',       type: 'location'  },
  { id: '#검찰청',     type: 'location'  },
  { id: '#커피숍',     type: 'location'  },
  { id: '#구치소',     type: 'location'  },
  { id: '#수사대',     type: 'location'  },
  { id: '#회의실',     type: 'location'  },
  { id: '#증거보관실', type: 'location'  },
  { id: '#검사실',     type: 'location'  },
  { id: '#갈등',       type: 'event'     },
  { id: '#화해',       type: 'event'     },
  { id: '#수사',       type: 'event'     },
  { id: '#재판',       type: 'event'     },
  { id: '#증거조작',   type: 'event'     },
  { id: '#내부고발',   type: 'event'     },
  { id: '#체포',       type: 'event'     },
  { id: '#심문',       type: 'event'     },
  { id: '#탄원',       type: 'event'     },
  { id: '#기소',       type: 'event'     },
  { id: '#무죄선고',   type: 'event'     },
  { id: '#항소',       type: 'event'     },
  { id: '#로맨스',     type: 'theme'     },
  { id: '#법정드라마', type: 'theme'     },
  { id: '#반전',       type: 'theme'     },
  { id: '#정의',       type: 'theme'     },
  { id: '#배신',       type: 'theme'     },
  { id: '#진실',       type: 'theme'     },
  { id: '#핵심설정',   type: 'status'    },
  { id: '#설정충돌⚠', type: 'status'    },
  { id: '#미확인설정', type: 'status'    },
  { id: '#핵심증거',   type: 'status'    },
];

const INIT_CHAPTERS: ChapterDef[] = [
  { id: 'c1',   label: '1화',   tags: ['#수아', '#검찰청', '#로맨스'] },
  { id: 'c3',   label: '3화',   tags: ['#강민준', '#검찰청', '#법정드라마'] },
  { id: 'c8',   label: '8화',   tags: ['#이레나', '#수아', '#검찰청'] },
  { id: 'c12',  label: '12화',  tags: ['#강민준', '#수사대', '#수사'] },
  { id: 'c18',  label: '18화',  tags: ['#이레나', '#법정', '#재판', '#법정드라마'] },
  { id: 'c23',  label: '23화',  tags: ['#수아', '#강민준', '#핵심설정', '#법정'] },
  { id: 'c27',  label: '27화',  tags: ['#수아', '#강민준', '#커피숍', '#로맨스', '#갈등'] },
  { id: 'c35',  label: '35화',  tags: ['#수아', '#하윤', '#커피숍', '#로맨스'] },
  { id: 'c42',  label: '42화',  tags: ['#박형사', '#수사대', '#체포'] },
  { id: 'c47',  label: '47화',  tags: ['#수아', '#강민준', '#법정', '#핵심설정'] },
  { id: 'c55',  label: '55화',  tags: ['#최검사', '#검찰청', '#내부고발', '#배신'] },
  { id: 'c67',  label: '67화',  tags: ['#강민준', '#최검사', '#검찰청', '#수사'] },
  { id: 'c71',  label: '71화',  tags: ['#오변호사', '#법정', '#재판', '#기소'] },
  { id: 'c80',  label: '80화',  tags: ['#수아', '#강민준', '#이레나', '#갈등', '#진실'] },
  { id: 'c89',  label: '89화',  tags: ['#이레나', '#수아', '#법정', '#갈등'] },
  { id: 'c95',  label: '95화',  tags: ['#김판사', '#법정', '#무죄선고', '#정의'] },
  { id: 'c103', label: '103화', tags: ['#수아', '#강민준', '#로맨스', '#갈등'] },
  { id: 'c107', label: '107화', tags: ['#신비서', '#검사실', '#핵심증거', '#증거조작'], conflict: true },
  { id: 'c115', label: '115화', tags: ['#수아', '#하윤', '#커피숍', '#로맨스'] },
  { id: 'c118', label: '118화', tags: ['#이레나', '#강민준', '#법정', '#재판', '#법정드라마'] },
  { id: 'c123', label: '123화', tags: ['#수아', '#핵심설정', '#검찰청'] },
  { id: 'c130', label: '130화', tags: ['#이레나', '#오변호사', '#법정', '#항소', '#법정드라마'] },
  { id: 'c142', label: '142화', tags: ['#이레나', '#수아', '#화해', '#핵심설정'] },
  { id: 'c145', label: '145화', tags: ['#강민준', '#최검사', '#수사대', '#반전'] },
  { id: 'c150', label: '150화', tags: ['#수아', '#박형사', '#구치소', '#탄원'] },
  { id: 'c155', label: '155화', tags: ['#수아', '#강민준', '#로맨스', '#반전'] },
  { id: 'c158', label: '158화', tags: ['#수아', '#강민준', '#법정', '#재판'] },
  { id: 'c159', label: '159화', tags: ['#수아', '#강민준', '#법정', '#설정충돌⚠', '#이레나'], conflict: true },
  { id: 'c160', label: '160화', tags: ['#강민준', '#수아', '#법정', '#재판', '#정의', '#미확인설정'], conflict: true },
  { id: 'c163', label: '163화', tags: ['#이레나', '#강민준', '#설정충돌⚠', '#반전'], conflict: true },
];

const TAG_RELATIONS: TagRelation[] = [
  // romantic
  { source: '#수아',     target: '#강민준',    relationType: 'romantic' },
  // enemy
  { source: '#수아',     target: '#이레나',    relationType: 'enemy' },
  { source: '#강민준',   target: '#이레나',    relationType: 'enemy' },
  { source: '#강민준',   target: '#이증인',    relationType: 'enemy' },
  { source: '#강민준',   target: '#최변호사',  relationType: 'enemy' },
  { source: '#최검사',   target: '#이레나',    relationType: 'enemy' },
  // family
  { source: '#수아',     target: '#하윤',      relationType: 'family' },
  // colleague
  { source: '#강민준',   target: '#최검사',    relationType: 'colleague' },
  { source: '#강민준',   target: '#박형사',    relationType: 'colleague' },
  { source: '#박형사',   target: '#서형사',    relationType: 'colleague' },
  { source: '#최검사',   target: '#정형사',    relationType: 'colleague' },
  { source: '#이레나',   target: '#오변호사',  relationType: 'colleague' },
  { source: '#오변호사', target: '#최변호사',  relationType: 'colleague' },
  { source: '#신비서',   target: '#박부장',    relationType: 'colleague' },
  { source: '#박부장',   target: '#한원장',    relationType: 'colleague' },
  { source: '#오변호사', target: '#김판사',    relationType: 'colleague' },
  // resides (character → location)
  { source: '#수아',     target: '#검찰청',    relationType: 'resides' },
  { source: '#강민준',   target: '#검찰청',    relationType: 'resides' },
  { source: '#최검사',   target: '#검사실',    relationType: 'resides' },
  { source: '#박형사',   target: '#수사대',    relationType: 'resides' },
  { source: '#이레나',   target: '#법정',      relationType: 'resides' },
  { source: '#오변호사', target: '#법정',      relationType: 'resides' },
  { source: '#신비서',   target: '#회의실',    relationType: 'resides' },
  { source: '#이증인',   target: '#구치소',    relationType: 'resides' },
  { source: '#하윤',     target: '#커피숍',    relationType: 'resides' },
  { source: '#김판사',   target: '#법정',      relationType: 'resides' },
  // leads (character → event)
  { source: '#수아',     target: '#갈등',      relationType: 'leads' },
  { source: '#수아',     target: '#화해',      relationType: 'leads' },
  { source: '#강민준',   target: '#수사',      relationType: 'leads' },
  { source: '#강민준',   target: '#증거조작',  relationType: 'leads' },
  { source: '#이레나',   target: '#재판',      relationType: 'leads' },
  { source: '#이레나',   target: '#항소',      relationType: 'leads' },
  { source: '#최검사',   target: '#내부고발',  relationType: 'leads' },
  { source: '#박형사',   target: '#체포',      relationType: 'leads' },
  { source: '#오변호사', target: '#기소',      relationType: 'leads' },
  { source: '#신비서',   target: '#증거조작',  relationType: 'leads' },
  { source: '#정형사',   target: '#심문',      relationType: 'leads' },
  // background (event → location)
  { source: '#재판',     target: '#법정',         relationType: 'background' },
  { source: '#수사',     target: '#수사대',        relationType: 'background' },
  { source: '#체포',     target: '#구치소',        relationType: 'background' },
  { source: '#심문',     target: '#검찰청',        relationType: 'background' },
  { source: '#기소',     target: '#법정',          relationType: 'background' },
  { source: '#무죄선고', target: '#법정',          relationType: 'background' },
  { source: '#증거조작', target: '#증거보관실',    relationType: 'background' },
  { source: '#내부고발', target: '#검사실',        relationType: 'background' },
  { source: '#탄원',     target: '#구치소',        relationType: 'background' },
  { source: '#갈등',     target: '#커피숍',        relationType: 'background' },
  { source: '#화해',     target: '#커피숍',        relationType: 'background' },
  { source: '#항소',     target: '#법정',          relationType: 'background' },
  { source: '#심문',     target: '#수사대',        relationType: 'background' },
];

function buildGraph(tags: TagDef[], chapters: ChapterDef[], tagRelations: TagRelation[]): SimState {
  const rand = mkRand(20250502);

  const chapterTagConn: Record<string, number> = {};
  for (const ch of chapters)
    for (const t of ch.tags) chapterTagConn[t] = (chapterTagConn[t] || 0) + 1;

  const totalConn: Record<string, number> = { ...chapterTagConn };
  for (const rel of tagRelations) {
    totalConn[rel.source] = (totalConn[rel.source] || 0) + 0.5;
    totalConn[rel.target] = (totalConn[rel.target] || 0) + 0.5;
  }

  const nodes: SNode[] = [];

  tags.forEach((tag, i) => {
    const a = (i / tags.length) * Math.PI * 2;
    const cr = totalConn[tag.id] || 1;
    nodes.push({
      id: tag.id, kind: 'tag', label: tag.id,
      color: TAG_CFG[tag.type].color,
      r: Math.min(32, 14 + cr * 2.2),
      x: GW / 2 + Math.cos(a) * 210 + (rand() - 0.5) * 80,
      y: GH / 2 + Math.sin(a) * 168 + (rand() - 0.5) * 80,
      vx: 0, vy: 0, tagType: tag.type,
      connections: chapterTagConn[tag.id] || 0,
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
      if (td) edges.push({
        source: ch.id, target: tid,
        color: TAG_CFG[td.type].color, tagType: td.type,
        relationType: 'chapter-tag', directed: false,
      });
    }
  }

  for (const rel of tagRelations) {
    const cfg = EDGE_CFG[rel.relationType];
    edges.push({
      source: rel.source, target: rel.target,
      color: cfg.color,
      relationType: rel.relationType,
      directed: cfg.directed,
      label: cfg.label,
    });
  }

  return { nodes, edges, alpha: 1 };
}

function forceStep(state: SimState) {
  const { nodes, edges, alpha } = state;
  if (alpha < 0.003) return;

  const REP  = 2800 * alpha;
  const SPR  = 0.038 * alpha;
  const GRAV = 0.005 * alpha;
  const DAMP = 0.86;

  const nMap = new Map(nodes.map(n => [n.id, n]));

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy + 1;
      const d  = Math.sqrt(d2);
      const f  = REP / d2;
      const fx = dx / d * f, fy = dy / d * f;
      a.vx -= fx; a.vy -= fy;
      b.vx += fx; b.vy += fy;
    }
  }

  for (const e of edges) {
    const a = nMap.get(e.source), b = nMap.get(e.target);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d  = Math.sqrt(dx * dx + dy * dy) + 0.1;
    const ideal = IDEAL_MAP[e.relationType] ?? 88;
    const f  = SPR * (d - ideal);
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

function shortenEnd(sx: number, sy: number, tx: number, ty: number, r: number): { x2: number; y2: number } {
  const dx = tx - sx, dy = ty - sy;
  const d  = Math.sqrt(dx * dx + dy * dy);
  if (d < r + 10) return { x2: tx, y2: ty };
  const ratio = (d - r - 7) / d;
  return { x2: sx + dx * ratio, y2: sy + dy * ratio };
}

interface Props { onBack?: () => void; }

export function GraphView({ onBack: _onBack }: Props) {
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [hoverId,       setHoverId]       = useState<string | null>(null);
  const [hoverEdgeIdx,  setHoverEdgeIdx]  = useState<number | null>(null);
  const [hiddenTypes,   setHiddenTypes]   = useState<Set<TagType>>(new Set());
  const [hiddenRelTypes, setHiddenRelTypes] = useState<Set<EdgeRelationType>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });
  const [addInput,   setAddInput]   = useState('');
  const [addTagType, setAddTagType] = useState<TagType>('character');
  const [, bump] = useState(0);

  const simRef    = useRef<SimState>({ nodes: [], edges: [], alpha: 0 });
  const rafRef    = useRef<number>(0);
  const frameRef  = useRef(0);
  const isPanning = useRef(false);
  const svgRef    = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const state = buildGraph(INIT_TAGS, INIT_CHAPTERS, TAG_RELATIONS);
    for (let i = 0; i < 250; i++) forceStep(state);
    state.alpha = 0.08;
    simRef.current = state;

    const loop = () => {
      forceStep(simRef.current);
      frameRef.current++;
      if (frameRef.current % 4 === 0) bump(n => n + 1);
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
        relationType: 'chapter-tag', directed: false,
      });
      const n = sim.nodes.find(nd => nd.id === selectedId);
      if (n) n.connections++;
      sim.alpha = Math.max(sim.alpha, 0.35);
    }
    setAddInput('');
    bump(n => n + 1);
  }, [selectedId, addInput, addTagType]);

  const { nodes, edges } = simRef.current;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const visibleIds = new Set(
    nodes
      .filter(n => n.kind === 'chapter' || !hiddenTypes.has(n.tagType as TagType))
      .map(n => n.id)
  );
  const selectedNode = nodeMap.get(selectedId ?? '') ?? null;
  const hoverNode    = nodeMap.get(hoverId ?? '')    ?? null;

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
      {/* 좌측 패널 */}
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
            { k: '총 관계 수', v: edges.length },
          ].map(s => (
            <div key={s.k} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: C.t3, fontSize: 12 }}>{s.k}</span>
              <span style={{ color: C.primary, fontSize: 13, fontWeight: 600 }}>{s.v}</span>
            </div>
          ))}
        </div>

        {/* 태그 유형 필터 */}
        <div style={{ padding: '12px 16px 6px' }}>
          <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            태그 유형
          </div>
          {(Object.entries(TAG_CFG) as [TagType, { color: string; label: string }][]).map(([type, cfg]) => {
            const count  = nodes.filter(n => n.tagType === type).length;
            const hidden = hiddenTypes.has(type);
            return (
              <button key={type} onClick={() => setHiddenTypes(prev => {
                const s = new Set(prev); hidden ? s.delete(type) : s.add(type); return s;
              })} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '5px 0', background: 'none', border: 'none',
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

        {/* 관계 유형 필터 */}
        <div style={{ padding: '12px 16px 8px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            관계 유형
          </div>
          {(Object.entries(EDGE_CFG) as [EdgeRelationType, typeof EDGE_CFG[EdgeRelationType]][])
            .filter(([k]) => k !== 'chapter-tag')
            .map(([rt, cfg]) => {
              const count  = edges.filter(e => e.relationType === rt).length;
              const hidden = hiddenRelTypes.has(rt);
              return (
                <button key={rt} onClick={() => setHiddenRelTypes(prev => {
                  const s = new Set(prev); hidden ? s.delete(rt) : s.add(rt); return s;
                })} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '4px 0', background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                  opacity: hidden ? 0.3 : 1, transition: 'opacity 0.13s',
                }}>
                  <svg width={18} height={8} style={{ flexShrink: 0 }}>
                    <line
                      x1={0} y1={4} x2={18} y2={4}
                      stroke={cfg.color}
                      strokeWidth={Math.min(cfg.strokeWidth, 2)}
                      strokeDasharray={cfg.strokeDasharray}
                    />
                    {cfg.directed && <polygon points="14,1 18,4 14,7" fill={cfg.color} />}
                  </svg>
                  <span style={{ color: C.t2, fontSize: 11, flex: 1, textAlign: 'left' }}>{cfg.label}</span>
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

      {/* 중앙 SVG */}
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
          onMouseLeave={() => { isPanning.current = false; setHoverEdgeIdx(null); }}
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
            {(['colleague', 'resides', 'leads', 'background'] as const).map(rt => (
              <marker key={`arrow-${rt}`} id={`arrow-${rt}`}
                viewBox="0 -4 8 8" refX="6" refY="0"
                markerWidth="4" markerHeight="4" orient="auto">
                <path d="M0,-4L8,0L0,4" fill={EDGE_CFG[rt].color} />
              </marker>
            ))}
          </defs>

          <g transform={transform}>
            {/* 엣지 */}
            <g>
              {edges.map((e, i) => {
                const src = nodeMap.get(e.source);
                const tgt = nodeMap.get(e.target);
                if (!src || !tgt) return null;
                if (!visibleIds.has(e.source) || !visibleIds.has(e.target)) return null;
                if (hiddenRelTypes.has(e.relationType)) return null;

                const linked = highlighted
                  ? (highlighted.has(e.source) && highlighted.has(e.target))
                  : (hoverId === e.source || hoverId === e.target);

                const baseOpacity = e.relationType === 'chapter-tag' ? 0.18 : 0.40;
                const opacity = highlighted
                  ? (linked ? 0.88 : 0.04)
                  : hoverId
                    ? (linked ? 0.80 : 0.06)
                    : baseOpacity;

                const cfg   = EDGE_CFG[e.relationType];
                const color = e.relationType === 'chapter-tag' ? e.color : cfg.color;
                const sw    = linked ? cfg.strokeWidth * 1.8 : cfg.strokeWidth;
                const { x2, y2 } = cfg.directed
                  ? shortenEnd(src.x, src.y, tgt.x, tgt.y, tgt.r)
                  : { x2: tgt.x, y2: tgt.y };

                const isHovEdge = hoverEdgeIdx === i;

                return (
                  <g key={i}>
                    <line
                      x1={src.x} y1={src.y} x2={x2} y2={y2}
                      stroke={color}
                      strokeWidth={sw}
                      strokeOpacity={opacity}
                      strokeDasharray={cfg.strokeDasharray}
                      markerEnd={cfg.directed ? `url(#arrow-${e.relationType})` : undefined}
                      style={{ transition: 'stroke-opacity 0.12s, stroke-width 0.12s' }}
                    />
                    {e.relationType !== 'chapter-tag' && (
                      <line
                        x1={src.x} y1={src.y} x2={x2} y2={y2}
                        stroke="transparent" strokeWidth={9}
                        style={{ cursor: 'crosshair' }}
                        onMouseEnter={() => setHoverEdgeIdx(i)}
                        onMouseLeave={() => setHoverEdgeIdx(null)}
                      />
                    )}
                    {isHovEdge && e.label && opacity > 0.05 && (
                      <text
                        x={(src.x + tgt.x) / 2}
                        y={(src.y + tgt.y) / 2 - 6}
                        textAnchor="middle"
                        fill={color}
                        fontSize={9}
                        fontWeight="700"
                        style={{ fontFamily: 'inherit', pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {e.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>

            {/* 노드 */}
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
                    style={{ cursor: 'pointer', opacity: isDim ? 0.1 : 1, transition: 'opacity 0.13s' }}
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
                        <circle r={node.r} fill={node.color + '28'} stroke={node.color}
                          strokeWidth={isSel ? 2.2 : 1.5} filter={filter} />
                        <text textAnchor="middle" y={node.r > 22 ? 4 : 3.5}
                          fill={node.color}
                          fontSize={Math.min(11, Math.max(7.5, node.r * 0.52))}
                          fontWeight="700"
                          style={{ fontFamily: 'inherit', pointerEvents: 'none', userSelect: 'none' }}>
                          {node.label}
                        </text>
                      </>
                    ) : (
                      <>
                        <circle r={node.r} fill={C.bg} stroke={node.color}
                          strokeWidth={isSel ? 2.5 : node.conflict ? 2 : 1.5} filter={filter} />
                        <text textAnchor="middle" y={4}
                          fill={node.color} fontSize={8.5} fontWeight="600"
                          style={{ fontFamily: 'inherit', pointerEvents: 'none', userSelect: 'none' }}>
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
                : `${hoverNode.tagType ? TAG_CFG[hoverNode.tagType].label : ''} · ${hoverNode.connections}화 등장`}
            </span>
          </div>
        )}

        <div style={{
          position: 'absolute', bottom: 14, left: 14,
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
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

      {/* 우측 패널 */}
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
                    : `${selectedNode.connections}화 등장 · ${connectedEdges.filter(e => {
                        const oid = e.source === selectedId ? e.target : e.source;
                        return nodeMap.get(oid)?.kind === 'tag';
                      }).length}개 직접 관계`}
                </div>
              </div>
            </div>

            <div>
              <div style={{ color: C.t3, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {selectedNode.kind === 'chapter' ? '연결된 태그' : '연결된 노드'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {connectedEdges.map((e, idx) => {
                  const otherId = e.source === selectedId ? e.target : e.source;
                  const other   = nodeMap.get(otherId);
                  if (!other) return null;
                  const relCfg = e.relationType !== 'chapter-tag' ? EDGE_CFG[e.relationType] : null;
                  return (
                    <button key={`${otherId}-${idx}`} onClick={() => setSelectedId(otherId)} style={{
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
                      <span style={{ color: C.t1, fontSize: 12, flex: 1 }}>{other.label}</span>
                      {relCfg && (
                        <span style={{ color: relCfg.color, fontSize: 10, marginLeft: 4, flexShrink: 0 }}>
                          {relCfg.label}
                        </span>
                      )}
                      {other.conflict && <span style={{ color: '#E25C5C', fontSize: 10 }}>⚠</span>}
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
              { dot: '#FF6B9D', text: '관계선 hover — 관계명 표시' },
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
