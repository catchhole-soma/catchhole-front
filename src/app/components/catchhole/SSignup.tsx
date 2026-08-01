import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Shield, Mail, Lock, Eye, EyeOff, User, Phone, Check } from 'lucide-react';
import { C, isValidEmail } from './constants';
import { AuthModal } from './AuthModal';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { usePublicModalNavigation } from '../../hooks/usePublicModalNavigation';
import { signupMutation } from '../../api/generated/@tanstack/react-query.gen';
import { saveAuthToken } from '../../lib/auth';
import { NetworkError, toApiError } from '../../lib/api-errors';

function Input({
  type, placeholder, value, onChange, icon, right, error,
}: {
  type: string; placeholder: string; value: string;
  onChange: (v: string) => void; icon: React.ReactNode; right?: React.ReactNode; error?: string;
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

export default function SSignup() {
  const navigate = useAppNavigate();
  const { openTerms, switchAuth } = usePublicModalNavigation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; phoneNumber?: string; password?: string; passwordConfirm?: string }>({});
  const signupRequest = useMutation(signupMutation());
  const submitting = signupRequest.isPending;

  const handleSignup = async () => {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = '이름(필명)을 입력해주세요.';
    else if (name.trim().length > 20) nextErrors.name = '이름(필명)은 20자 이하로 입력해주세요.';
    if (!email.trim()) nextErrors.email = '이메일을 입력해주세요.';
    else if (!isValidEmail(email)) nextErrors.email = '이메일 형식이 올바르지 않습니다.';
    if (!phoneNumber.trim()) nextErrors.phoneNumber = '휴대폰 번호를 입력해주세요.';
    else if (!/^010\d{8}$/.test(phoneNumber)) nextErrors.phoneNumber = '휴대폰 번호는 하이픈 없이 010으로 시작하는 11자리 숫자여야 합니다.';
    if (!password) nextErrors.password = '비밀번호를 입력해주세요.';
    else if (password.length < 8 || password.length > 64) nextErrors.password = '비밀번호는 8자 이상 64자 이하로 입력해주세요.';
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) nextErrors.password = '비밀번호는 영문과 숫자를 각각 하나 이상 포함해야 합니다.';
    if (!passwordConfirm) nextErrors.passwordConfirm = '비밀번호 확인을 입력해주세요.';
    else if (password !== passwordConfirm) nextErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !agreed) return;

    try {
      const response = await signupRequest.mutateAsync({
        body: {
          email: email.trim(),
          password,
          phoneNumber,
          displayName: name.trim(),
        },
      });
      saveAuthToken(response);
      navigate('/works', 'push-right', undefined, { replace: true });
    } catch (err) {
      const apiError = toApiError(err);
      if (apiError) {
        if (apiError.code === 'AUTH_EMAIL_DUPLICATED') {
          setErrors({ email: '이미 가입된 이메일입니다.' });
        } else if (apiError.code === 'AUTH_PHONE_NUMBER_DUPLICATED') {
          setErrors({ phoneNumber: '이미 가입된 휴대폰 번호입니다.' });
        } else if (apiError.code === 'REQUEST_VALIDATION_FAILED' && apiError.details.length > 0) {
          const fieldMap: Record<string, keyof typeof errors> = {
            displayName: 'name', email: 'email', phoneNumber: 'phoneNumber', password: 'password',
          };
          const fieldErrors: typeof errors = {};
          apiError.details.forEach(detail => {
            const key = fieldMap[detail.field];
            if (key) fieldErrors[key] = detail.message;
          });
          setErrors(fieldErrors);
        } else {
          setErrors({ password: '회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
        }
      } else if (err instanceof NetworkError) {
        setErrors({ password: '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.' });
      } else {
        setErrors({ password: '회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
      }
    }
  };

  return (
    <AuthModal ariaLabelledBy="signup-modal-title" variant="signup">
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
              원고 속 설정을<br />체계적으로 정리해보세요.
            </div>
            <div style={{ color: C.t3, fontSize: 13, lineHeight: 1.7 }}>
              회원가입 후 작품과 원고를 등록하고<br />
              AI 설정 추출을 시작할 수 있습니다.
            </div>
          </div>
          <div style={{ color: C.t3, fontSize: 11 }}>© 2026 CatchHole</div>
        </div>

        {/* 우측 폼 */}
        <form
          className="auth-modal-form"
          noValidate
          onSubmit={event => {
            event.preventDefault();
            void handleSignup();
          }}
        >
          <div id="signup-modal-title" style={{ color: C.t1, fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 6 }}>회원가입</div>
          <div style={{ color: C.t3, fontSize: 13, marginBottom: 28 }}>계정을 만들어 작품 분석을 시작하세요.</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <Input type="text" placeholder="이름 (필명)" value={name} onChange={setName} icon={<User size={15} />} error={errors.name} />
            <Input type="email" placeholder="이메일" value={email} onChange={setEmail} icon={<Mail size={15} />} error={errors.email} />
            <Input type="text" placeholder="휴대폰 번호 (예: 01012345678)" value={phoneNumber} onChange={setPhoneNumber} icon={<Phone size={15} />} error={errors.phoneNumber} />
            <Input
              type={showPw ? 'text' : 'password'} placeholder="비밀번호"
              value={password} onChange={setPassword} icon={<Lock size={15} />} error={errors.password}
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
            <Input
              type={showPwConfirm ? 'text' : 'password'} placeholder="비밀번호 확인"
              value={passwordConfirm} onChange={setPasswordConfirm} icon={<Lock size={15} />} error={errors.passwordConfirm}
              right={
                <button
                  type="button"
                  aria-label={showPwConfirm ? '비밀번호 확인 숨기기' : '비밀번호 확인 표시'}
                  onClick={() => setShowPwConfirm(p => !p)}
                  style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: C.t3, padding: 0, display: 'flex',
                  }}
                >
                  {showPwConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', marginBottom: 20,
          }}>
            <button
              type="button"
              aria-label="필수 약관에 동의"
              aria-pressed={agreed}
              onClick={() => setAgreed(a => !a)}
              style={{
              width: 18, height: 18, borderRadius: 4, flexShrink: 0,
              border: `1px solid ${agreed ? C.primary : C.border}`,
              background: agreed ? C.primary : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s, border-color 0.15s',
                cursor: 'pointer', padding: 0,
              }}
            >
              {agreed && <Check size={13} color="#fff" />}
            </button>
            <span style={{ color: C.t3, fontSize: 12, lineHeight: 1.6 }}>
              가입하면{' '}
              <button type="button" onClick={() => openTerms('terms')} style={{
                color: C.t2, textDecoration: 'underline', cursor: 'pointer', background: 'none',
                border: 'none', padding: 0, font: 'inherit',
              }}>이용약관</button>
              {' '}및{' '}
              <button type="button" onClick={() => openTerms('privacy')} style={{
                color: C.t2, textDecoration: 'underline', cursor: 'pointer', background: 'none',
                border: 'none', padding: 0, font: 'inherit',
              }}>개인정보 처리방침</button>
              에 동의합니다.
            </span>
          </div>

          <button type="submit" disabled={!agreed || submitting} style={{
            width: '100%', height: 44, borderRadius: 8, border: 'none',
            background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: agreed && !submitting ? 'pointer' : 'not-allowed', fontFamily: 'inherit', marginBottom: 20,
            opacity: agreed && !submitting ? 1 : 0.5, transition: 'background 0.15s, opacity 0.15s',
          }}
            onMouseEnter={e => { if (agreed && !submitting) e.currentTarget.style.background = '#6B4EE8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.primary; }}
          >
            {submitting ? '가입 중...' : '회원가입'}
          </button>

          <div style={{ textAlign: 'center', color: C.t3, fontSize: 13 }}>
            이미 계정이 있으신가요?{' '}
            <button type="button" onClick={() => switchAuth('/login')} style={{
              background: 'none', border: 'none', color: C.primary, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: 0,
            }}>
              로그인
            </button>
          </div>
        </form>
    </AuthModal>
  );
}
