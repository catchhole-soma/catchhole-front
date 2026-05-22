import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { C, NavigateFn } from './constants';
import {
  ChevronLeft, OctagonAlert, AlertTriangle, Sparkles,
  ChevronDown, ChevronUp, EyeOff, BookOpen, Clock, Users, Check,
  Activity, Scale,
} from 'lucide-react';

interface Props {
  navigate: NavigateFn;
  mode?: 'single' | 'prePublish';
  onModeReset?: () => void;
}

function BtnG({ label, onClick, icon }: { label: string; onClick?: () => void; icon?: React.ReactNode }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        height: 36, padding: '0 14px', borderRadius: 6,
        border: `1px solid ${h ? '#3A3A4A' : C.border}`,
        background: h ? '#1F1F2A' : 'transparent',
        color: C.t2, fontSize: 13, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 0.15s',
        whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
      }}>
      {icon}{label}
    </button>
  );
}

function BtnP({ label, onClick, icon }: { label: string; onClick?: () => void; icon?: React.ReactNode }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        height: 36, padding: '0 14px', borderRadius: 6,
        border: 'none', background: h ? '#6B4EE8' : C.primary,
        color: '#fff', fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
      }}>
      {icon}{label}
    </button>
  );
}

interface QuoteBlockProps {
  label: string;
  chapter: string;
  text: string;
  highlight?: string;
  highlightColor?: string;
}

function QuoteBlock({ label, chapter, text, highlight, highlightColor }: QuoteBlockProps) {
  const accentColor = highlightColor || C.border;
  const markBg =
    highlightColor === C.danger ? '#3D1515' :
    highlightColor === C.success ? '#0D2E1E' :
    highlightColor === C.warning ? '#3D2808' : '#222';

  const parts = highlight ? text.split(new RegExp(`(${highlight})`)) : [text];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
        <span style={{
          padding: '1px 7px', background: C.bg,
          border: `1px solid ${C.border}`, borderRadius: 3,
          color: C.t3, fontSize: 11,
        }}>
          {chapter}
        </span>
      </div>
      <div style={{
        background: C.bg, borderRadius: '0 6px 6px 0',
        borderLeft: `2px solid ${accentColor}`,
        padding: '10px 14px', fontSize: 13, lineHeight: 1.85, color: C.t2,
        fontStyle: 'italic', letterSpacing: '-0.1px',
      }}>
        <span style={{ color: C.t3, fontSize: 13, fontStyle: 'normal' }}>"</span>
        {parts.map((part, i) =>
          part === highlight ? (
            <mark key={i} style={{
              background: markBg, color: accentColor,
              padding: '1px 3px', borderRadius: 3,
              fontStyle: 'normal', fontWeight: 700,
            }}>{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
        <span style={{ color: C.t3, fontSize: 13, fontStyle: 'normal' }}>"</span>
      </div>
    </div>
  );
}

interface OccurrenceItem { chapter: string; snippet: string; status: 'match' | 'conflict' }

function OccurrenceHistory({ items }: { items: OccurrenceItem[] }) {
  return (
    <div>
      <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        설정 등장 이력 ({items.length}회)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '7px 10px',
            background: C.bg, borderRadius: 5,
            border: `1px solid ${item.status === 'conflict' ? C.danger + '44' : C.border}`,
          }}>
            <span style={{
              flexShrink: 0, padding: '1px 6px', borderRadius: 3,
              background: item.status === 'conflict' ? '#3D1515' : '#0D2E1E',
              color: item.status === 'conflict' ? C.danger : C.success,
              fontSize: 11, fontWeight: 600,
              border: `1px solid ${item.status === 'conflict' ? C.danger + '44' : C.success + '44'}`,
            }}>
              {item.chapter}
            </span>
            <span style={{ color: C.t2, fontSize: 12, lineHeight: 1.5, fontStyle: 'italic' }}>
              {item.snippet}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiSuggestion({ suggestion, applied, onApply }: {
  suggestion: string; applied: boolean; onApply: () => void;
}) {
  return (
    <div style={{
      background: C.primary + '0D',
      border: `1px solid ${C.primary}33`,
      borderRadius: 6, padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Sparkles size={13} color={C.primary} />
        <span style={{ color: C.primary, fontSize: 12, fontWeight: 600 }}>AI 수정 제안</span>
      </div>
      <div style={{
        background: C.bg, borderRadius: 4, padding: '8px 12px',
        fontSize: 13, color: C.t1, lineHeight: 1.7, marginBottom: 10,
        borderLeft: `2px solid ${C.primary}`,
      }}>
        {suggestion}
      </div>
      <button onClick={onApply} style={{
        height: 30, padding: '0 12px', borderRadius: 5,
        background: applied ? C.success + '22' : C.primary + '22',
        border: `1px solid ${applied ? C.success + '44' : C.primary + '44'}`,
        color: applied ? C.success : C.primary,
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        {applied ? <><Check size={12} />적용됨</> : '에디터에 적용'}
      </button>
    </div>
  );
}

interface ErrorCardData {
  id: number;
  severity: 'danger' | 'warning';
  tag: string;
  badge: string;
  icon: React.ReactNode;
  title: string;
  changeArrow: { from: string; to: string };
  sourceQuote: QuoteBlockProps;
  currentQuote: QuoteBlockProps;
  occurrences: OccurrenceItem[];
  aiSuggestion: string;
  onFix?: () => void;
}

function ErrorCard({ data, ignored, onIgnore, onFix }: {
  data: ErrorCardData; ignored: boolean; onIgnore: () => void; onFix: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showOccurrences, setShowOccurrences] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);

  const barColor = data.severity === 'danger' ? C.danger : C.warning;
  const tagBg = data.severity === 'danger' ? '#3D1515' : '#3D2808';

  if (ignored) {
    return (
      <div style={{
        background: C.surface, borderRadius: 8,
        border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.t3}`,
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        opacity: 0.5,
      }}>
        <span style={{ color: C.t3, fontSize: 14 }}>{data.title} — 무시됨</span>
        <button onClick={onIgnore} style={{
          background: 'none', border: 'none', color: C.t3, fontSize: 12,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>되돌리기</button>
      </div>
    );
  }

  return (
    <div style={{
      background: C.surface, borderRadius: 8,
      border: `1px solid ${C.border}`, borderLeft: `3px solid ${barColor}`,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              padding: '3px 8px', borderRadius: 4, background: tagBg,
              color: barColor, fontSize: 12, fontWeight: 500,
              border: `1px solid ${barColor}44`, display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {data.icon}{data.tag}
            </span>
            <span style={{
              padding: '3px 8px', borderRadius: 4,
              border: `1px solid ${barColor}44`,
              color: barColor, fontSize: 12, fontWeight: 500,
            }}>
              {data.badge}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={onIgnore} style={{
              height: 28, padding: '0 10px', borderRadius: 4,
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.t3, fontSize: 12, cursor: 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
              transition: 'all 0.15s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.t2; e.currentTarget.style.borderColor = '#3A3A4A'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.t3; e.currentTarget.style.borderColor = C.border; }}
            >
              <EyeOff size={11} />무시
            </button>
            <button onClick={() => setExpanded(!expanded)} style={{
              height: 28, width: 28, borderRadius: 4,
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.t3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}>
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ color: C.t1, fontSize: 15, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.2px' }}>
            {data.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '3px 10px', borderRadius: 4,
              background: C.success + '1A', border: `1px solid ${C.success}33`,
              color: C.success, fontSize: 13, fontWeight: 600,
            }}>
              {data.changeArrow.from}
            </span>
            <span style={{ color: C.t3, fontSize: 13 }}>→</span>
            <span style={{
              padding: '3px 10px', borderRadius: 4,
              background: C.danger + '1A', border: `1px solid ${C.danger}33`,
              color: C.danger, fontSize: 13, fontWeight: 600,
            }}>
              {data.changeArrow.to}
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <BookOpen size={12} color={C.t3} />
                  <span style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    원문 인용 비교
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <QuoteBlock {...data.sourceQuote} />
                  <QuoteBlock {...data.currentQuote} />
                </div>
              </div>

              <button onClick={() => setShowOccurrences(!showOccurrences)} style={{
                background: 'none', border: `1px solid ${C.border}`, borderRadius: 5,
                padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                color: C.t2, fontSize: 12, transition: 'all 0.15s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1C1C26'; e.currentTarget.style.borderColor = '#3A3A4A'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = C.border; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={12} color={C.t3} />
                  <span>설정 등장 이력 ({data.occurrences.length}회)</span>
                </div>
                {showOccurrences ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              <AnimatePresence>
                {showOccurrences && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <OccurrenceHistory items={data.occurrences} />
                  </motion.div>
                )}
              </AnimatePresence>

              <AiSuggestion
                suggestion={data.aiSuggestion}
                applied={aiApplied}
                onApply={() => setAiApplied(true)}
              />

              <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
                {data.severity === 'danger' && (
                  <BtnP label="에디터에서 수정" onClick={onFix} />
                )}
                <BtnG label="원문 화수로 이동" icon={<BookOpen size={12} />} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ERROR_DATA: ErrorCardData[] = [
  {
    id: 1,
    severity: 'danger',
    tag: '사실 기반 오류',
    badge: '높음',
    icon: <OctagonAlert size={11} />,
    title: '수아의 눈 색 불일치',
    changeArrow: { from: '갈색 눈동자', to: '파란 눈' },
    sourceQuote: {
      label: '기존 설정',
      chapter: '23화 3문단',
      text: '수아가 천천히 고개를 들었다. 그 순간, 그녀의 갈색 눈동자가 형광등 불빛에 반짝였다. "당신이 강민준 검사님이십니까?" 그녀의 목소리는 미세하게 떨렸다.',
      highlight: '갈색 눈동자',
      highlightColor: C.success,
    },
    currentQuote: {
      label: '현재 원고',
      chapter: '159화 9행',
      text: '수아는 천천히 고개를 들었다. 햇살이 창문을 통해 쏟아지며 그녀의 파란 눈을 가득 채웠다. 검찰청 복도는 언제나처럼 차갑고 조용했다.',
      highlight: '파란 눈',
      highlightColor: C.danger,
    },
    occurrences: [
      { chapter: '1화', snippet: '"수아의 갈색 눈이 반짝였다."', status: 'match' },
      { chapter: '23화', snippet: '"갈색 눈동자가 형광등 불빛에 반짝였다."', status: 'match' },
      { chapter: '89화', snippet: '"그 갈색 눈동자에는 슬픔이 가득했다."', status: 'match' },
      { chapter: '159화', snippet: '"그녀의 파란 눈을 가득 채웠다."', status: 'conflict' },
    ],
    aiSuggestion: '"그녀의 파란 눈" → "그녀의 갈색 눈동자" 로 수정하거나, 콘텍스트상 눈 색이 바뀐 설정이라면 23화 설정 DB를 업데이트하세요.',
  },
  {
    id: 2,
    severity: 'warning',
    tag: '타임라인 오류',
    badge: '중간',
    icon: <Clock size={11} />,
    title: '장면 시간대 불일치',
    changeArrow: { from: '사건 5일 후 첫 만남', to: '3일 전 만남으로 서술' },
    sourceQuote: {
      label: '기존 설정',
      chapter: '47화 2문단',
      text: '그것이 처음 만남이었다. 사건이 터지고 닷새가 지난 오후, 그들은 법원 복도에서 처음으로 얼굴을 마주쳤다. 운명이라고 부르기엔 너무도 냉혹한 상황이었다.',
      highlight: '닷새가 지난',
      highlightColor: C.success,
    },
    currentQuote: {
      label: '현재 원고',
      chapter: '159화 13행',
      text: '강민준은 저편에서 그녀를 주시하고 있었다. 3일 전 우연히 마주쳤을 때처럼, 그는 아무 말도 하지 않았다. 마치 처음부터 아무 일도 없었던 것처럼.',
      highlight: '3일 전 우연히 마주쳤을 때',
      highlightColor: C.warning,
    },
    occurrences: [
      { chapter: '47화', snippet: '"닷새가 지난 오후, 법원 복도에서 첫 만남."', status: 'match' },
      { chapter: '52화', snippet: '"처음 만난 그날 이후로..."', status: 'match' },
      { chapter: '159화', snippet: '"3일 전 우연히 마주쳤을 때처럼"', status: 'conflict' },
    ],
    aiSuggestion: '"3일 전 우연히 마주쳤을 때처럼" → "닷새 전 처음 마주쳤을 때처럼" 으로 수정하거나, 별도의 만남이라면 47화 이후 흐름을 재검토하세요.',
  },
  {
    id: 3,
    severity: 'warning',
    tag: '관계 오류',
    badge: '중간',
    icon: <Users size={11} />,
    title: '이레나–수아 관계 상태 불일치',
    changeArrow: { from: '142화에서 화해 완료', to: '적대 관계로 묘사' },
    sourceQuote: {
      label: '기존 설정',
      chapter: '142화 마지막 문단',
      text: '이레나는 수아의 손을 잡았다. 오랜 침묵 끝에 찾아온 화해였다. "미안해, 수아야. 내가 틀렸어." 그 말 한마디로 두 사람 사이의 벽은 무너졌다.',
      highlight: '두 사람 사이의 벽은 무너졌다',
      highlightColor: C.success,
    },
    currentQuote: {
      label: '현재 원고',
      chapter: '159화 전반부',
      text: '이레나는 수아를 노려보았다. 법정에서도, 복도에서도, 그 시선은 적의로 가득했다. 수아는 그 눈빛이 칼날처럼 느껴졌다.',
      highlight: '그 시선은 적의로 가득했다',
      highlightColor: C.warning,
    },
    occurrences: [
      { chapter: '38화', snippet: '"이레나와 수아는 서로 경쟁 관계였다."', status: 'match' },
      { chapter: '101화', snippet: '"둘 사이의 갈등은 점점 깊어졌다."', status: 'match' },
      { chapter: '142화', snippet: '"화해. 두 사람 사이의 벽은 무너졌다."', status: 'match' },
      { chapter: '159화', snippet: '"그 시선은 적의로 가득했다."', status: 'conflict' },
    ],
    aiSuggestion: '142화에서 화해가 이루어졌으므로, 159화의 "적의" 묘사는 화해 이후의 복잡한 감정으로 재서술하거나 화해 철회 사건을 별도로 설정해야 합니다.',
  },
  {
    id: 4,
    severity: 'warning',
    tag: '감정 상태 오류',
    badge: '낮음',
    icon: <Activity size={11} />,
    title: '강민준의 감정 흐름 불일치',
    changeArrow: { from: '냉담·절제된 성격', to: '즉각적 감정 노출' },
    sourceQuote: {
      label: '기존 설정',
      chapter: '5화 전반부',
      text: '강민준은 평생 감정을 드러낸 적이 없었다. 그것이 그를 두려운 검사로 만들었다. 동료들조차 그의 속내를 알 수 없었다.',
      highlight: '감정을 드러낸 적이 없었다',
      highlightColor: C.success,
    },
    currentQuote: {
      label: '현재 원고',
      chapter: '159화 중반부',
      text: '강민준은 그녀를 보는 순간 얼굴이 붉어졌다. 그 감정이 너무 선명해서 법정 안 모두가 눈치챌 정도였다.',
      highlight: '얼굴이 붉어졌다',
      highlightColor: C.warning,
    },
    occurrences: [
      { chapter: '5화', snippet: '"감정을 드러낸 적이 없었다."', status: 'match' },
      { chapter: '78화', snippet: '"그는 감정이 없는 사람 같았다."', status: 'match' },
      { chapter: '159화', snippet: '"얼굴이 붉어졌다. 모두가 눈치챌 정도."', status: 'conflict' },
    ],
    aiSuggestion: '급격한 감정 노출을 위한 전환 서술이 필요합니다. 냉담함이 흔들리기 시작하는 경위를 앞 문단에 짧게 삽입하면 자연스러운 흐름이 됩니다.',
  },
  {
    id: 5,
    severity: 'warning',
    tag: '능력·자격 오류',
    badge: '낮음',
    icon: <Scale size={11} />,
    title: '수아의 법적 자격 불일치',
    changeArrow: { from: '검사 임용 대기 중', to: '단독 증인 소환 서술' },
    sourceQuote: {
      label: '기존 설정',
      chapter: '123화 3문단',
      text: '수아는 아직 임용 대기 중이었다. 정식 검사가 되려면 최종 발령을 기다려야 했고, 그전까지는 보조 역할에 머물 수밖에 없었다.',
      highlight: '아직 임용 대기 중이었다',
      highlightColor: C.success,
    },
    currentQuote: {
      label: '현재 원고',
      chapter: '159화 후반부',
      text: '수아는 직접 증인 소환장에 서명했다. 법정에서의 그녀는 완전한 검사였다.',
      highlight: '직접 증인 소환장에 서명했다',
      highlightColor: C.warning,
    },
    occurrences: [
      { chapter: '123화', snippet: '"아직 임용 대기 중이었다."', status: 'match' },
      { chapter: '140화', snippet: '"발령 통보를 기다리는 수아."', status: 'match' },
      { chapter: '159화', snippet: '"직접 증인 소환장에 서명했다."', status: 'conflict' },
    ],
    aiSuggestion: '123화 이후 정식 임용 발령 시점이 서술되지 않았습니다. 임용 확정 장면을 중간에 삽입하거나, 현재 서술을 상사 검사의 지시 하에 진행하는 것으로 수정하세요.',
  },
];

export default function S5Report({ navigate, mode = 'single', onModeReset }: Props) {
  const [ignoredIds, setIgnoredIds] = useState<number[]>([]);
  const [filter, setFilter] = useState<'all' | 'danger' | 'warning'>('all');
  const isPrePublish = mode === 'prePublish';

  const toggleIgnore = (id: number) =>
    setIgnoredIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const filtered = ERROR_DATA.filter((d) => {
    if (filter === 'danger') return d.severity === 'danger';
    if (filter === 'warning') return d.severity === 'warning';
    return true;
  });

  const activeCount = ERROR_DATA.filter((d) => !ignoredIds.includes(d.id)).length;

  return (
    <div style={{
      background: C.bg, width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <div style={{
        height: 56, background: C.bg, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', flexShrink: 0, zIndex: 10, position: 'relative',
      }}>
        <button onClick={() => { onModeReset?.(); navigate('S1', 'pop'); }} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', color: C.t2, cursor: 'pointer',
          fontSize: 13, padding: '4px 8px', borderRadius: 4,
          fontFamily: 'inherit', transition: 'color 0.15s',
        }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.t1)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.t2)}
        >
          <ChevronLeft size={16} /><span>뒤로</span>
        </button>

        <span style={{
          color: C.t1, fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px',
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        }}>
          {isPrePublish ? '발행 전 전체 검수' : '159화 분석 결과'}
        </span>

        {isPrePublish
          ? <BtnG label="리포트로 돌아가기" onClick={() => { onModeReset?.(); }} />
          : <BtnG label="원고로 돌아가기" onClick={() => navigate('S2', 'push-left')} />
        }
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 48px 48px' }}>
        {isPrePublish && (
          <div style={{
            background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`,
            padding: '14px 20px', marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>검수 범위</div>
              <div style={{ color: C.t1, fontSize: 14, fontWeight: 600 }}>빛나는 검사 로맨스 · 전체 158화</div>
            </div>
            <BtnP label="범위 변경" />
          </div>
        )}

        {isPrePublish && (
          <div style={{
            background: C.primary + '12', border: `1px solid ${C.primary}44`,
            borderRadius: 8, padding: '12px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <OctagonAlert size={14} color={C.primary} style={{ flexShrink: 0 }} />
            <span style={{ color: C.t2, fontSize: 13 }}>
              <strong style={{ color: C.primary }}>발행 전 체크리스트</strong>
              {'  ·  '}캐릭터 설정 일치 · 타임라인 연속성 · 관계 상태 · 세계관 규칙 준수
            </span>
          </div>
        )}

        <div style={{
          background: C.surface, borderRadius: 8,
          border: `1px solid ${C.border}`, padding: '18px 28px',
          display: 'flex', gap: 0, alignItems: 'stretch', marginBottom: 20,
        }}>
          {[
            { label: '탐지 오류', value: `${activeCount}건`, color: C.danger, large: true },
            null,
            { label: '심각', value: '1건', color: C.danger },
            null,
            { label: '주의', value: '2건', color: C.warning },
            null,
            { label: '낮음', value: '2건', color: C.t2 },
          ].map((item, i) =>
            item === null ? (
              <div key={i} style={{ width: 1, background: C.border, margin: '0 24px', alignSelf: 'stretch' }} />
            ) : (
              <div key={i}>
                <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{item.label}</div>
                <div style={{ color: item.color, fontSize: item.large ? 26 : 20, fontWeight: 700, letterSpacing: '-0.5px' }}>{item.value}</div>
              </div>
            )
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <OctagonAlert size={13} color={C.t3} />
            <span style={{ color: C.t3, fontSize: 12 }}>빛나는 검사 로맨스 · 159화</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([
            { key: 'all', label: `전체 ${ERROR_DATA.length}건` },
            { key: 'danger', label: `높음 1건` },
            { key: 'warning', label: `중간 이하 4건` },
          ] as { key: typeof filter; label: string }[]).map((tab) => (
            <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
              height: 32, padding: '0 14px', borderRadius: 5,
              background: filter === tab.key ? C.surface : 'transparent',
              border: `1px solid ${filter === tab.key ? C.border : 'transparent'}`,
              color: filter === tab.key ? C.t1 : C.t3,
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}>
              {tab.label}
            </button>
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <BtnG label="전체 펼치기" />
            <BtnG label="리포트 복사" icon={<BookOpen size={12} />} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 860 }}>
          {filtered.map((data) => (
            <ErrorCard
              key={data.id}
              data={data}
              ignored={ignoredIds.includes(data.id)}
              onIgnore={() => toggleIgnore(data.id)}
              onFix={() => navigate('S2', 'push-left')}
            />
          ))}
        </div>

        <div style={{
          marginTop: 28, padding: '14px 18px',
          background: C.surface, borderRadius: 8,
          border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 10, maxWidth: 860,
        }}>
          <AlertTriangle size={13} color={C.t3} />
          <span style={{ color: C.t3, fontSize: 12, lineHeight: 1.6 }}>
            분석은 기존 158화 설정 DB 기반으로 수행되었습니다.
            의도적 설정 변경은 설정 DB를 직접 업데이트하거나, 에디터에서 "의도적 변경"으로 표시할 수 있습니다.
          </span>
        </div>
      </div>
    </div>
  );
}
