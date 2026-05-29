import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Shield, Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import { C, NavigateFn } from './constants';
import { TermsModal } from './TermsModal';

interface Props { navigate: NavigateFn; }

function Input({
  type, placeholder, value, onChange, icon, right,
}: {
  type: string; placeholder: string; value: string;
  onChange: (v: string) => void; icon: React.ReactNode; right?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: C.bg, border: `1px solid ${focused ? C.primary + '88' : C.border}`,
      borderRadius: 8, padding: '0 14px', height: 44, transition: 'border-color 0.15s',
    }}>
      <span style={{ color: focused ? C.primary : C.t3, flexShrink: 0, transition: 'color 0.15s' }}>{icon}</span>
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          flex: 1, background: 'none', border: 'none', outline: 'none',
          color: C.t1, fontSize: 14, fontFamily: 'inherit',
        }}
      />
      {right}
    </div>
  );
}

export default function SSignup({ navigate }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [termsTab, setTermsTab] = useState<'terms' | 'privacy' | null>(null);

  return (
    <div style={{
      background: C.bg, width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <AnimatePresence>
        {termsTab && <TermsModal onClose={() => setTermsTab(null)} initialTab={termsTab} />}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        style={{
          display: 'flex', width: 840, minHeight: 540,
          borderRadius: 16, overflow: 'hidden', border: `1px solid ${C.border}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* 좌측 브랜딩 */}
        <div style={{
          width: 340, background: `linear-gradient(145deg, #1a1030 0%, ${C.primary}33 60%, #0f0f13 100%)`,
          padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          borderRight: `1px solid ${C.border}`, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -60, right: -60,
            width: 200, height: 200, borderRadius: '50%',
            background: C.primary + '15', filter: 'blur(40px)',
          }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `linear-gradient(135deg, ${C.primary}, #B48BFF)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Shield size={18} color="#fff" />
              </div>
              <span style={{ color: C.t1, fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px' }}>CatchHole</span>
            </div>
            <div style={{ color: C.t1, fontSize: 22, fontWeight: 700, lineHeight: 1.4, letterSpacing: '-0.5px', marginBottom: 16 }}>
              지금 시작하면<br />첫 분석이 무료입니다.
            </div>
            <div style={{ color: C.t3, fontSize: 13, lineHeight: 1.7 }}>
              회원가입 후 바로 작품을 등록하고<br />
              AI 설정 충돌 분석을 체험해보세요.
            </div>
          </div>
          <div style={{ color: C.t3, fontSize: 11 }}>© 2026 CatchHole</div>
        </div>

        {/* 우측 폼 */}
        <div style={{
          flex: 1, background: C.surface, padding: '48px 44px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div style={{ color: C.t1, fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 6 }}>회원가입</div>
          <div style={{ color: C.t3, fontSize: 13, marginBottom: 28 }}>계정을 만들어 작품 분석을 시작하세요.</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <Input type="text" placeholder="이름 (필명)" value={name} onChange={setName} icon={<User size={15} />} />
            <Input type="email" placeholder="이메일" value={email} onChange={setEmail} icon={<Mail size={15} />} />
            <Input
              type={showPw ? 'text' : 'password'} placeholder="비밀번호"
              value={password} onChange={setPassword} icon={<Lock size={15} />}
              right={
                <button onClick={() => setShowPw(p => !p)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: C.t3, padding: 0, display: 'flex',
                }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
            <Input
              type={showPwConfirm ? 'text' : 'password'} placeholder="비밀번호 확인"
              value={passwordConfirm} onChange={setPasswordConfirm} icon={<Lock size={15} />}
              right={
                <button onClick={() => setShowPwConfirm(p => !p)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: C.t3, padding: 0, display: 'flex',
                }}>
                  {showPwConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
          </div>

          <div style={{ color: C.t3, fontSize: 12, textAlign: 'center', marginBottom: 12, lineHeight: 1.6 }}>
            가입하면{' '}
            <button onClick={() => setTermsTab('terms')} style={{
              background: 'none', border: 'none', color: C.t2, fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline',
            }}>이용약관</button>
            {' '}및{' '}
            <button onClick={() => setTermsTab('privacy')} style={{
              background: 'none', border: 'none', color: C.t2, fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline',
            }}>개인정보 처리방침</button>
            에 동의합니다.
          </div>

          <button onClick={() => navigate('S0', 'push-right')} style={{
            width: '100%', height: 44, borderRadius: 8, border: 'none',
            background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 20, transition: 'background 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#6B4EE8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.primary; }}
          >
            회원가입
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: C.border }} />
            <span style={{ color: C.t3, fontSize: 12 }}>또는</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            <button onClick={() => navigate('S0', 'push-right')} style={{
              width: '100%', height: 44, borderRadius: 8, border: 'none',
              background: '#FEE500', color: '#191919', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5C4.86 1.5 1.5 4.19 1.5 7.5c0 2.09 1.24 3.93 3.13 5.01L3.9 15.3a.3.3 0 0 0 .43.34l3.62-2.4c.34.05.69.07 1.05.07 4.14 0 7.5-2.69 7.5-6S13.14 1.5 9 1.5z" fill="#191919" />
              </svg>
              카카오로 계속하기
            </button>
            <button onClick={() => navigate('S0', 'push-right')} style={{
              width: '100%', height: 44, borderRadius: 8,
              border: `1px solid ${C.border}`, background: 'transparent',
              color: C.t1, fontSize: 14, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.t3; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google로 계속하기
            </button>
          </div>

          <div style={{ textAlign: 'center', color: C.t3, fontSize: 13 }}>
            이미 계정이 있으신가요?{' '}
            <button onClick={() => navigate('Slogin', 'push-left')} style={{
              background: 'none', border: 'none', color: C.primary, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: 0,
            }}>
              로그인
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
