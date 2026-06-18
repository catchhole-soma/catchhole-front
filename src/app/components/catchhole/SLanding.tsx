import React from 'react';
import { Sparkles, Zap, ShieldCheck, FileText, Lock } from 'lucide-react';
import { C } from './constants';
import { useAppNavigate } from '../../hooks/useAppNavigate';

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div style={{
      flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
      padding: 24, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 999, background: C.primary + '24',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ color: C.t1, fontSize: 16, fontWeight: 700 }}>{title}</div>
      <div style={{ color: C.t2, fontSize: 13, lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}

const FEATURES = [
  {
    icon: <Zap size={20} color={C.primary} />,
    title: '초고속 AI 대조 분석',
    description: '수만 자의 방대한 원고도 단 몇 초 만에 사전 등록된 설정집과 완벽하게 대조합니다. 오류 탐지 시간을 95% 단축하세요.',
  },
  {
    icon: <ShieldCheck size={20} color={C.primary} />,
    title: '일관성 체크',
    description: '실시간으로 캐릭터의 설정과 세계관 충돌을 감지합니다.',
  },
  {
    icon: <FileText size={20} color={C.primary} />,
    title: '직관적인 리포트',
    description: '수정이 필요한 부분을 하이라이트와 함께 상세 리포트로 제공합니다.',
  },
];

const TRUST_ITEMS = [
  { icon: <Zap size={14} color={C.t3} />, label: '실시간 AI 분석' },
  { icon: <Lock size={14} color={C.t3} />, label: '안전한 데이터 보관' },
];

export default function SLanding() {
  const navigate = useAppNavigate();

  return (
    <div style={{
      background: C.bg, width: '100%', height: '100%', overflow: 'auto',
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 64px', height: 64, borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{ color: C.primary, fontSize: 20, fontWeight: 800, letterSpacing: '-0.4px' }}>CatchHole</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/login', 'push-right')} style={{
            height: 36, padding: '0 16px', borderRadius: 6, border: `1px solid ${C.border}`,
            background: C.surface, color: C.t2, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            로그인
          </button>
          <button onClick={() => navigate('/signup', 'push-right')} style={{
            height: 36, padding: '0 16px', borderRadius: 6, border: 'none',
            background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            회원가입
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 48, padding: '64px 64px', background: C.surface,
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            padding: '4px 10px', borderRadius: 999, background: '#22222C', border: `1px solid ${C.border}`,
          }}>
            <Sparkles size={13} color={C.primary} />
            <span style={{ color: C.t2, fontSize: 11, fontWeight: 600 }}>New: AI Analysis v2.0</span>
          </div>
          <div style={{ color: C.t1, fontSize: 36, fontWeight: 800, lineHeight: 1.3 }}>
            당신의 이야기가 완벽해지는 순간, CatchHole
          </div>
          <div style={{ color: C.t2, fontSize: 15, lineHeight: 1.5 }}>
            AI 기반 정밀 대조 분석으로 설정 오류부터 개연성까지 한눈에 확인하세요.
            창작의 즐거움에만 집중할 수 있도록 CatchHole이 돕습니다.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/signup', 'push-right')} style={{
              height: 44, padding: '0 20px', borderRadius: 6, border: 'none',
              background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              지금 무료로 시작하기
            </button>
            <button onClick={() => navigate('/login', 'push-right')} style={{
              height: 44, padding: '0 20px', borderRadius: 6, border: `1px solid ${C.border}`,
              background: C.surface, color: C.t2, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              로그인
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {TRUST_ITEMS.map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {item.icon}
                <span style={{ color: C.t3, fontSize: 12 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{
          width: 440, height: 340, borderRadius: 10, background: '#22222C', border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'flex-end', gap: 8, padding: 24,
        }}>
          {[40, 70, 45, 90, 60, 80, 50].map((h, i) => (
            <div key={i} style={{
              flex: 1, height: `${h}%`, borderRadius: 4,
              background: `linear-gradient(180deg, ${C.primary}, ${C.primary}55)`,
            }} />
          ))}
        </div>
      </div>

      {/* Features */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: '64px 64px',
      }}>
        <div style={{ color: C.t1, fontSize: 26, fontWeight: 800, textAlign: 'center' }}>
          전문 작가들을 위한 고밀도 기능
        </div>
        <div style={{ color: C.t2, fontSize: 14, textAlign: 'center' }}>
          복잡한 설정과 수많은 인물들, 이제 AI가 당신의 가장 든든한 조력자가 되어드립니다.
        </div>
        <div style={{ display: 'flex', gap: 20, width: '100%' }}>
          {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        padding: '56px 64px', background: '#22222C',
      }}>
        <div style={{ color: C.t1, fontSize: 24, fontWeight: 800, textAlign: 'center' }}>
          지금, 당신의 이야기를 CatchHole로 가져오세요.
        </div>
        <div style={{ color: C.t2, fontSize: 14, textAlign: 'center' }}>
          더 이상 설정 오류에 시간을 낭비하지 마세요. AI가 완벽도를 책임지고, 작가님은 오직 창작의 즐거움에만 몰두하세요.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/signup', 'push-right')} style={{
            height: 44, padding: '0 20px', borderRadius: 6, border: 'none',
            background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            무료로 시작하기
          </button>
          <button style={{
            height: 44, padding: '0 20px', borderRadius: 6, border: `1px solid ${C.border}`,
            background: C.surface, color: C.t2, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            서비스 안내 더보기
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '24px 64px', borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ color: C.t1, fontSize: 15, fontWeight: 700 }}>CatchHole</span>
          <span style={{ color: C.t3, fontSize: 12 }}>The future of creative storytelling.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ color: C.t3, fontSize: 12 }}>Privacy Policy</span>
          <span style={{ color: C.t3, fontSize: 12 }}>Terms of Service</span>
          <span style={{ color: C.t3, fontSize: 12 }}>Contact</span>
        </div>
      </div>
    </div>
  );
}
