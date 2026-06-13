import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { C, WorkId } from './constants';
import { useAppContext } from '../../context/AppContext';
import { Shield, Send, ArrowRight } from 'lucide-react';
import { UserMenu } from './UserMenu';
import { AppSidebar } from './AppSidebar';

const WORK_INFO: Record<WorkId, { title: string; genre: string }> = {
  detective: { title: '빛나는 검사 로맨스', genre: '로맨스' },
  murim: { title: '무협지존', genre: '무협' },
};

interface Props { selectedWork?: WorkId; }

interface Message {
  id: number;
  role: 'user' | 'ai';
  text: string;
  evidence?: { src: string; lines: string[]; history: string };
}

function getAnswer(q: string): { answer: string; evidence?: Message['evidence'] } {
  const lq = q.toLowerCase();

  if ((lq.includes('눈') || lq.includes('눈 색')) && !lq.includes('강민준') && !lq.includes('이레나') && !lq.includes('하윤')) {
    return {
      answer: '수아의 눈 색깔은 갈색입니다. 23화에서 처음 확정됐으며 이후에도 동일하게 서술됩니다.\n\n⚠ 159화에서 "파란 눈"으로 서술되어 설정 충돌 감지됨.',
      evidence: {
        src: '23화 3문단',
        lines: ['"갈색 눈동자가 형광등 불빛에 반짝였다."', '"당신이 강민준 검사님이십니까?"'],
        history: '설정 등장 이력: 1화 · 23화 · 89화 · ⚠ 159화 충돌',
      },
    };
  }
  if (lq.includes('강민준') && (lq.includes('등장') || lq.includes('처음') || lq.includes('언제'))) {
    return {
      answer: '강민준은 3화에서 처음 등장합니다. 서울 중앙지방검찰청 수석검사로, 10년 경력의 냉담하고 절제된 성격으로 묘사됩니다.',
      evidence: {
        src: '3화 1문단',
        lines: ['"강민준 수석검사가 법정 문을 열고 들어섰다."'],
        history: '설정 등장 이력: 3화 · 5화 · 23화',
      },
    };
  }
  if (lq.includes('강민준') && (lq.includes('성격') || lq.includes('특징') || lq.includes('어떤'))) {
    return {
      answer: '강민준의 성격은 5화에서 확정됩니다. 냉담하고 절제된 스타일로, 감정을 거의 드러내지 않습니다.\n\n⚠ 159화에서 즉각적인 감정 노출로 설정 충돌 감지됨.',
      evidence: {
        src: '5화 전반부',
        lines: ['"그는 감정 하나 내비치지 않았다. 10년이 그를 그렇게 만들었다."'],
        history: '설정 확정: 5화 / ⚠ 충돌 감지: 159화',
      },
    };
  }
  if (lq.includes('세계관') || lq.includes('규칙') || (lq.includes('법정') && !lq.includes('만남'))) {
    return {
      answer: '법정·수사 관련 세계관 규칙은 3가지입니다.\n① 검사는 피의자와 사적으로 접촉 불가\n② 증거 제출 기한은 공판 3일 전\n③ 임용 전 검사는 독립 수사 권한 없음',
      evidence: {
        src: '3화·15화·123화',
        lines: ['"검사는 피의자와 사적으로 접촉할 수 없다."'],
        history: '위반 감지: 123화 (임용 전 단독 수사 서술)',
      },
    };
  }
  if (lq.includes('수아') && (lq.includes('직업') || lq.includes('직위') || lq.includes('검사'))) {
    return {
      answer: '수아의 직업은 검사 지망생(임용 대기 중)이며 나이는 23세입니다. 서울대 법학전문대학원을 수석 졸업했습니다.\n\n⚠ 123화에서 독립 수사 권한 없이 단독 수사 서술 — 규칙 충돌.',
      evidence: {
        src: '1화·123화',
        lines: ['"수아는 아직 임용 대기 중이었다."'],
        history: '설정 확정: 1화 / ⚠ 규칙 위반 감지: 123화',
      },
    };
  }
  if (lq.includes('수아') && (lq.includes('나이') || lq.includes('살') || lq.includes('몇 살'))) {
    return {
      answer: '수아의 나이는 1화 기준 23세입니다. 82화에서 3년 경과 서술이 있어 현재는 26세여야 합니다.\n\n⚠ 159화에서 25세로 서술되어 수치 오류 감지됨.',
      evidence: {
        src: '82화 마지막 문단',
        lines: ['"3년이 흘렀다. 수아는 여전히 그 자리에 있었다."'],
        history: '나이 기준: 23세(1화) + 3년(82화) = 26세 / ⚠ 159화 서술: 25세',
      },
    };
  }
  if (lq.includes('이레나') && (lq.includes('등장') || lq.includes('처음') || lq.includes('직업'))) {
    return {
      answer: '이레나는 12화에서 처음 등장합니다. 변호사로, 수아와 같은 법무법인 출신입니다. 초반엔 라이벌로 적대했으나 142화에서 화해가 완료됩니다.',
      evidence: {
        src: '12화 1문단',
        lines: ['"이레나가 법정에 들어섰다. 두 사람의 눈이 마주쳤다."'],
        history: '첫 등장: 12화 / 적대 시작: 55화 / 화해 완료: 142화',
      },
    };
  }
  if (lq.includes('이레나') && (lq.includes('관계') || lq.includes('화해') || lq.includes('갈등'))) {
    return {
      answer: '이레나와 수아의 관계는 적대에서 화해로 전환됩니다. 142화 마지막 문단에서 화해가 완료됐습니다.\n\n⚠ 159화에서 다시 적대 관계로 묘사되어 충돌 감지됨.',
      evidence: {
        src: '142화 마지막 문단',
        lines: ['"두 사람은 처음으로 같은 방향을 바라보고 있었다."'],
        history: '관계 변화: 적대(12화) → 화해(142화) / ⚠ 충돌: 159화',
      },
    };
  }
  if (lq.includes('하윤')) {
    return {
      answer: '하윤은 2화에서 처음 등장하는 수아의 절친입니다. 나이 23세, 서울대 대학원생이며 수아의 수사를 조력합니다.',
      evidence: {
        src: '2화 초반',
        lines: ['"하윤아, 나 붙었어." 수아는 전화기를 꼭 쥐었다.'],
        history: '첫 등장: 2화 / 조력 장면: 18화 · 89화',
      },
    };
  }
  if (lq.includes('usb') || lq.includes('증거') || lq.includes('아이템') || lq.includes('소지')) {
    return {
      answer: '핵심 USB 증거는 45화 중반부에서 최검사에게 양도됩니다. 이후 수아의 소지품에서 제거됩니다.\n\n⚠ 159화에서 수아가 주머니에서 꺼내는 장면으로 충돌 감지됨.',
      evidence: {
        src: '45화 중반부',
        lines: ['"수아는 USB를 테이블 위에 천천히 내려놓았다."'],
        history: '등장: 38화 / 양도: 45화 / ⚠ 소지 충돌: 159화',
      },
    };
  }
  if ((lq.includes('수아') && lq.includes('강민준')) || lq.includes('로맨스') || (lq.includes('관계') && !lq.includes('이레나'))) {
    return {
      answer: '수아와 강민준은 3화에서 처음 만나 로맨스 관계로 발전합니다. 47화 법정 첫 만남 이후 감정선이 고조되고 있으며, 현재 159화 기준 공식 연인 관계는 미확정입니다.',
      evidence: {
        src: '47화 2문단',
        lines: ['"그의 시선이 머물렀다. 단 1초, 하지만 수아는 느꼈다."'],
        history: '첫 만남: 3화 / 감정선 시작: 47화 / 현재: 159화 진행 중',
      },
    };
  }
  if (lq.includes('최검사') || lq.includes('최 검사')) {
    return {
      answer: '최 검사(검사장)는 5화에서 처음 등장합니다. 45세로, 강민준의 상사이자 이레나와 적대 관계입니다. 101화부터 최종 보스 복선이 시작됩니다.',
      evidence: {
        src: '5화 회의 장면',
        lines: ['"최 검사장이 손을 들어 회의를 종결했다."'],
        history: '첫 등장: 5화 / 보스 복선 시작: 101화',
      },
    };
  }
  if (lq.includes('타임라인') || lq.includes('시간') || lq.includes('흐름') || lq.includes('경과')) {
    return {
      answer: '전체 타임라인 요약:\n1화 — 수아 임용 대기 시작\n3화 — 강민준 등장\n12화 — 이레나 등장\n47화 — 법정 첫 만남\n82화 — 3년 경과 서술 (⚠ 나이 오류)\n142화 — 이레나 화해\n159화 — 현재, 오류 5건 감지',
      evidence: {
        src: '82화 마지막 문단',
        lines: ['"3년이 흘렀다. 수아는 그래도 여전히 임용 대기 중이었다."'],
        history: '⚠ 시간 경과 오류: 3년 후 기준 26세여야 하나 25세 서술 (159화)',
      },
    };
  }
  if (lq.includes('159') || lq.includes('오류') || lq.includes('충돌') || lq.includes('감지')) {
    return {
      answer: '159화에서 감지된 설정 충돌은 총 5건입니다:\n① 수아 눈 색 (갈색 → 파란 눈) — 심각\n② 장면 시간대 불일치 — 주의\n③ 이레나–수아 관계 상태 — 주의\n④ 강민준 감정 흐름 — 주의\n⑤ 핵심 USB 소지 상태 — 주의',
      evidence: {
        src: '159화 분석 리포트',
        lines: ['"가장 최근 분석 회차 · 심각 1건 · 주의 4건"'],
        history: '분석 완료: 오늘 / 전체 오류: 5건',
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
  { q: '핵심 USB 증거는 어디 있어?',   hint: '아이템 소지 이력' },
  { q: '수아와 강민준의 관계는?',      hint: '캐릭터 관계' },
  { q: '159화 감지된 오류 알려줘',     hint: '충돌 리포트 요약' },
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

export default function S3Chat() {
  const { selectedWork } = useAppContext();
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
          <UserMenu />
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <AppSidebar
          activePage="chat"
        />

        {/* 메인 채팅 영역 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 작품 선택 서브헤더 */}
          <div style={{
            height: 52, borderBottom: `1px solid ${C.border}`, background: C.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 28px', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: C.t1, fontSize: 14, fontWeight: 600 }}>{WORK_INFO[selectedWork].title}</span>
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
