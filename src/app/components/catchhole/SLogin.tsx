import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Shield, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { C, isValidEmail } from './constants';
import { AuthModal } from './AuthModal';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { usePublicModalNavigation } from '../../hooks/usePublicModalNavigation';
import { loginMutation } from '../../api/generated/@tanstack/react-query.gen';
import { saveAuthToken } from '../../lib/auth';
import { NetworkError, toApiError } from '../../lib/api-errors';

function Input({
  type, placeholder, value, onChange, onKeyDown, icon, right, error,
}: {
  type: string; placeholder: string; value: string;
  onChange: (v: string) => void; onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  icon: React.ReactNode; right?: React.ReactNode; error?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: C.bg, border: `1px solid ${error ? C.danger + '88' : focused ? C.primary + '88' : C.border}`,
        borderRadius: 8, padding: '0 14px', height: 44, transition: 'border-color 0.15s',
      }}>
        <span style={{ color: focused ? C.primary : C.t3, flexShrink: 0, transition: 'color 0.15s' }}>{icon}</span>
        <input
          type={type} placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: C.t1, fontSize: 14, fontFamily: 'inherit',
          }}
        />
        {right}
      </div>
      {error && (
        <div style={{ color: C.danger, fontSize: 12, marginTop: 6, paddingLeft: 2 }}>{error}</div>
      )}
    </div>
  );
}

export default function SLogin() {
  const navigate = useAppNavigate();
  const { openTerms, switchAuth } = usePublicModalNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const loginRequest = useMutation(loginMutation());
  const submitting = loginRequest.isPending;

  const handleLogin = async () => {
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = '이메일을 입력해주세요.';
    else if (!isValidEmail(email)) nextErrors.email = '이메일 형식이 올바르지 않습니다.';
    if (!password) nextErrors.password = '비밀번호를 입력해주세요.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const response = await loginRequest.mutateAsync({
        body: { email: email.trim(), password },
      });
      saveAuthToken(response);
      navigate('/works', 'push-right', undefined, { replace: true });
    } catch (err) {
      const apiError = toApiError(err);
      const message = err instanceof NetworkError
        ? '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.'
        : apiError?.code === 'AUTH_INVALID_CREDENTIALS'
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      setErrors({ password: message });
    }
  };

  return (
    <AuthModal ariaLabelledBy="login-modal-title" variant="login">
        {/* 좌측 브랜딩 */}
        <div className="auth-modal-brand">
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
              원고 속 설정을,<br />한곳에서 관리하세요.
            </div>
            <div style={{ color: C.t3, fontSize: 13, lineHeight: 1.7 }}>
              AI가 원고에서 캐릭터 설정을 추출하고<br />
              원문 근거와 함께 정리합니다.
            </div>
          </div>
          <div style={{ color: C.t3, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>© 2026 CatchHole</span>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['terms', 'privacy'] as const).map((t, i) => (
                <React.Fragment key={t}>
                  {i > 0 && <span style={{ opacity: 0.4 }}>·</span>}
                  <button onClick={() => openTerms(t)} style={{
                    background: 'none', border: 'none', color: C.t3, fontSize: 11,
                    cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                    textDecoration: 'underline', textDecorationColor: C.t3 + '66',
                  }}>
                    {t === 'terms' ? '이용약관' : '개인정보 처리방침'}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* 우측 폼 */}
        <form
          className="auth-modal-form"
          noValidate
          onSubmit={event => {
            event.preventDefault();
            void handleLogin();
          }}
        >
          <div id="login-modal-title" style={{ color: C.t1, fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 6 }}>로그인</div>
          <div style={{ color: C.t3, fontSize: 13, marginBottom: 32 }}>계정에 로그인하여 작품 분석을 시작하세요.</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <Input type="email" placeholder="이메일" value={email} onChange={setEmail} icon={<Mail size={15} />} error={errors.email} />
            <Input
              type={showPw ? 'text' : 'password'} placeholder="비밀번호"
              value={password} onChange={setPassword} icon={<Lock size={15} />} error={errors.password}
              onKeyDown={event => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing || submitting) return;
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }}
              right={
                <button
                  type="button"
                  aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}
                  onClick={() => setShowPw(p => !p)}
                  style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: C.t3, padding: 0, display: 'flex',
                  }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
          </div>

          <button type="submit" disabled={submitting} style={{
            width: '100%', height: 44, borderRadius: 8, border: 'none',
            background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: submitting ? 'default' : 'pointer', fontFamily: 'inherit', marginBottom: 20,
            transition: 'background 0.15s', opacity: submitting ? 0.7 : 1,
          }}
            onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#6B4EE8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.primary; }}
          >
            {submitting ? '로그인 중...' : '로그인'}
          </button>

          <div style={{ textAlign: 'center', color: C.t3, fontSize: 13 }}>
            계정이 없으신가요?{' '}
            <button type="button" onClick={() => switchAuth('/signup')} style={{
              background: 'none', border: 'none', color: C.primary, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: 0,
            }}>
              회원가입
            </button>
          </div>
        </form>
    </AuthModal>
  );
}
