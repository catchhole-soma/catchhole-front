import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { C, NavigateFn } from './constants';
import {
  Shield, Settings, BookMarked, BookOpen, BarChart3, Network,
  MessageSquare, ChevronLeft, Send, ArrowRight,
} from 'lucide-react';

interface Props { navigate: NavigateFn; }

interface Message {
  id: number;
  role: 'user' | 'ai';
  text: string;
  evidence?: { src: string; lines: string[]; history: string };
}

const MOCK_ANSWERS: Record<string, Message['evidence'] & { answer: string }> = {
  default: {
    answer: '설정 DB를 검색했지만 정확히 일치하는 설정을 찾지 못했습니다. 더 구체적으로 질문해 주세요.',
    src: '',
    lines: [],
    history: '',
  },
};

function getAnswer(q: string): { answer: string; evidence?: Message['evidence'] } {
  const lq = q.toLowerCase();
  if (lq.includes('눈') || lq.includes('눈 색')) {
    return {
      answer: '수아의 눈 색깔은 갈색입니다. 23화에서 처음 확정됐으며 이후에도 동일하게 서술됩니다.',
      evidence: {
        src: '23화 3문단',
        lines: ['"갈색 눈동자가 형광등 불빛에 반짝였다."', '"당신이 강민준 검사님이십니까?"'],
        history: '설정 등장 이력: 1화 · 23화 · 89화',
      },
    };
  }
  if (lq.includes('강민준') && (lq.includes('등장') || lq.includes('처음'))) {
    return {
      answer: '강민준은 3화에서 처음 등장합니다. 수석검사로 서울 중앙지검 소속입니다.',
      evidence: {
        src: '3화 1문단',
        lines: ['"강민준 수석검사가 법정 문을 열고 들어섰다."'],
        history: '설정 등장 이력: 3화 · 5화 · 23화',
      },
    };
  }
  if (lq.includes('세계관') || lq.includes('규칙') || lq.includes('법정')) {
    return {
      answer: '법정·수사 관련 세계관 규칙은 3가지입니다.\n① 검사는 피의자와 사적으로 접촉 불가\n② 증거 제출 기한은 공판 3일 전\n③ 임용 전 검사는 독립 수사 권한 없음',
      evidence: {
        src: '3화·15화·123화',
        lines: ['"검사는 피의자와 사적으로 접촉할 수 없다."'],
        history: '위반 감지: 123화 (임용 전 단독 수사 서술)',
      },
    };
  }
  if (lq.includes('수아') && (lq.includes('직업') || lq.includes('나이') || lq.includes('직위'))) {
    return {
      answer: '수아의 직업은 검사 지망생(임용 대기 중)이며 나이는 23세입니다. 서울대 법학전문대학원을 수석 졸업했습니다.',
      evidence: {
        src: '1화·123화',
        lines: ['"수아는 아직 임용 대기 중이었다."'],
        history: '설정 확정: 1화 / 최근 언급: 123화',
      },
    };
  }
  return {
    answer: '설정 DB를 검색했지만 정확히 일치하는 설정을 찾지 못했습니다. 더 구체적으로 질문해 주세요.',
  };
}

const EXAMPLES = [
  { q: '수아의 눈 색깔은 뭐야?',       hint: '캐릭터 외모 설정' },
  { q: '강민준이 처음 등장한 화는?',   hint: '타임라인 이벤트' },
  { q: '법정 관련 세계관 규칙 알려줘', hint: '세계관 규칙' },
];

function NavItem({ icon, label, active, badge, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; badge?: string; onClick?: () => void;
}) {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '9px 16px 9px 20px', cursor: 'pointer',
        color: active ? C.primary : h ? C.t1 : C.t2,
        fontSize: 13, fontWeight: active ? 600 : 400,
        transition: 'color 0.13s', position: 'relative', userSelect: 'none',
        background: active ? C.primary + '0D' : 'transparent',
      }}>
      {active && <div style={{
        position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
        width: 3, height: 18, background: C.primary, borderRadius: '0 2px 2px 0',
      }} />}
      <span style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          padding: '1px 6px', borderRadius: 8, background: C.danger + '22',
          color: C.danger, fontSize: 11, fontWeight: 600, border: `1px solid ${C.danger}33`,
        }}>{badge}</span>
      )}
    </div>
  );
}

export default function S3Chat({ navigate }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  let msgId = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: ++msgId.current, role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    setTimeout(() => {
      const { answer, evidence } = getAnswer(text);
      const aiMsg: Message = { id: ++msgId.current, role: 'ai', text: answer, evidence };
      setMessages(prev => [...prev, aiMsg]);
      setLoading(false);
    }, 900);
  };

  return (
    <div style={{
      background: C.bg, width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      {/* 헤더 */}
      <div style={{
        height: 56, background: C.bg, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: `linear-gradient(135deg, ${C.primary}, #B48BFF)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={14} color="#fff" />
          </div>
          <span style={{ color: C.t1, fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>CatchHole</span>
          <span style={{
            padding: '2px 7px', borderRadius: 3, background: C.primary + '18',
            color: C.primary, fontSize: 10, fontWeight: 600, border: `1px solid ${C.primary}33`, marginLeft: 2,
          }}>BETA</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: C.t3, fontSize: 12 }}>구독제 · 이번 달 14/20회 사용</span>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.primary}, #9B7BFD)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>K</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 사이드바 */}
        <div style={{
          width: 220, background: C.bg, borderRight: `1px solid ${C.border}`,
          padding: '16px 0', display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          <div style={{ padding: '0 20px 10px', color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>워크스페이스</div>
          <NavItem icon={<BookMarked size={14} />} label="내 작품" badge="2" onClick={() => navigate('S1', 'pop')} />
          <NavItem icon={<BookOpen size={14} />} label="설정 DB" onClick={() => navigate('S1', 'pop')} />
          <NavItem icon={<BarChart3 size={14} />} label="분석 리포트" badge="3" onClick={() => navigate('S1', 'pop')} />
          <NavItem icon={<Network size={14} />} label="그래프 뷰" onClick={() => navigate('S1', 'pop')} />
          <NavItem icon={<MessageSquare size={14} />} label="챗봇" active />
          <div style={{ margin: '12px 16px', borderTop: `1px solid ${C.border}` }} />
          <div style={{ padding: '0 20px 10px', color: C.t3, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>계정</div>
          <NavItem icon={<Settings size={14} />} label="설정" />

          <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: `1px solid ${C.border}` }}>
            <div style={{ color: C.t3, fontSize: 11, marginBottom: 6 }}>이번 달 분석</div>
            <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: '70%', height: '100%', background: C.primary, borderRadius: 2 }} />
            </div>
            <div style={{ color: C.t3, fontSize: 11 }}>14 / 20회</div>
          </div>
        </div>

        {/* 메인 채팅 영역 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 작품 선택 서브헤더 */}
          <div style={{
            height: 52, borderBottom: `1px solid ${C.border}`, background: C.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 28px', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: C.t1, fontSize: 14, fontWeight: 600 }}>빛나는 검사 로맨스</span>
              <span style={{ color: C.t3, fontSize: 13 }}>▾</span>
            </div>
            <span style={{ color: C.t3, fontSize: 12 }}>설정 DB 기반 · 158화 로드됨</span>
          </div>

          {/* 메시지 목록 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 빈 상태 */}
            {messages.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32 }}>
                <div style={{ color: C.t1, fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.4px' }}>
                  설정에 대해 무엇이든 물어보세요
                </div>
                <div style={{ color: C.t3, fontSize: 13, marginBottom: 32 }}>
                  원고 속 설정을 자연어로 검색하면 원문 근거와 함께 답변합니다
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 860 }}>
                  {EXAMPLES.map((ex) => (
                    <button key={ex.q} onClick={() => send(ex.q)} style={{
                      width: 260, padding: '16px 18px', borderRadius: 8, cursor: 'pointer',
                      background: C.surface, border: `1px solid ${C.border}`,
                      textAlign: 'left', fontFamily: 'inherit', transition: 'border-color 0.15s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#3A3A4A')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                    >
                      <div style={{ color: C.t1, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{ex.q}</div>
                      <div style={{ color: C.t3, fontSize: 11, marginBottom: 8 }}>{ex.hint}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.primary, fontSize: 11 }}>
                        <ArrowRight size={11} /> 예시 질문
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 메시지들 */}
            <AnimatePresence initial={false}>
              {messages.map(msg => (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 10, alignItems: 'flex-start' }}
                >
                  {/* AI 아이콘 */}
                  {msg.role === 'ai' && (
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: `linear-gradient(135deg, ${C.primary}, #B48BFF)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 10, fontWeight: 700,
                    }}>AI</div>
                  )}

                  <div style={{ maxWidth: 600 }}>
                    {/* 말풍선 */}
                    <div style={{
                      padding: '12px 16px',
                      background: msg.role === 'user' ? C.primary : C.surface,
                      border: msg.role === 'user' ? 'none' : `1px solid ${C.border}`,
                      borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '4px 12px 12px 12px',
                      color: msg.role === 'user' ? '#fff' : C.t1,
                      fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-line',
                    }}>
                      {msg.text}
                    </div>

                    {/* 근거 카드 */}
                    {msg.evidence && msg.evidence.src && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                        style={{
                          marginTop: 8, padding: '10px 14px',
                          background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                        }}>
                        <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
                          📎 원문 근거 · {msg.evidence.src}
                        </div>
                        <div style={{ borderLeft: `2px solid ${C.primary}`, paddingLeft: 10, marginBottom: 6 }}>
                          {msg.evidence.lines.map((l, i) => (
                            <div key={i} style={{ color: C.t2, fontSize: 12, lineHeight: 1.6, fontStyle: 'italic' }}>{l}</div>
                          ))}
                        </div>
                        <div style={{ color: C.t3, fontSize: 11 }}>{msg.evidence.history}</div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* 로딩 */}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${C.primary}, #B48BFF)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 10, fontWeight: 700,
                }}>AI</div>
                <div style={{
                  padding: '14px 18px', background: C.surface,
                  border: `1px solid ${C.border}`, borderRadius: '4px 12px 12px 12px',
                  display: 'flex', gap: 5, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <motion.div key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      style={{ width: 6, height: 6, borderRadius: '50%', background: C.t3 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div style={{
            borderTop: `1px solid ${C.border}`, background: C.surface,
            padding: '14px 20px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0,
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
              placeholder="설정에 대해 질문하세요  (예: 수아의 직업은?)"
              style={{
                flex: 1, height: 46, borderRadius: 8,
                background: C.bg, border: `1px solid ${C.border}`,
                color: C.t1, fontSize: 14, padding: '0 16px',
                fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = C.primary)}
              onBlur={e => (e.target.style.borderColor = C.border)}
            />
            <button onClick={() => send(input)} disabled={!input.trim() || loading}
              style={{
                width: 46, height: 46, borderRadius: 8, border: 'none',
                background: input.trim() && !loading ? C.primary : C.border,
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', flexShrink: 0,
              }}>
              <Send size={18} color={input.trim() && !loading ? '#fff' : C.t3} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
