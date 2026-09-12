import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  Shield,
  User,
} from 'lucide-react';
import { C, isValidEmail } from './constants';
import { AuthModal } from './AuthModal';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { usePublicModalNavigation } from '../../hooks/usePublicModalNavigation';
import {
  getCurrentLegalDocumentsOptions,
  getSignupPolicyOptions,
} from '../../api/generated/@tanstack/react-query.gen';
import { signup } from '../../api/generated/sdk.gen';
import { useSignupVerification } from '../../hooks/useSignupVerification';
import { saveAuthToken } from '../../lib/auth';
import { NetworkError, toApiError } from '../../lib/api-errors';
import { BrandLogo } from './ui-v2/BrandLogo';
import { trackMetaCompleteRegistration } from '../../lib/meta-pixel';

interface SignupErrors {
  name?: string;
  email?: string;
  phoneNumber?: string;
  verificationCode?: string;
  password?: string;
  passwordConfirm?: string;
  legal?: string;
  age?: string;
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function Input({
  type,
  placeholder,
  value,
  onChange,
  icon,
  right,
  error,
  inputMode,
  maxLength,
  disabled,
}: {
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ReactNode;
  right?: React.ReactNode;
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="auth-field">
      <div className={`auth-field__control${focused ? ' is-focused' : ''}${error ? ' is-error' : ''}`} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: C.bg, border: `1px solid ${error ? C.danger + '88' : focused ? C.primary + '88' : C.border}`,
        borderRadius: 8, padding: '0 14px', height: 44, transition: 'border-color 0.15s',
        opacity: disabled ? 0.72 : 1,
      }}>
        <span className="auth-field__icon" style={{ color: focused ? C.primary : C.t3, flexShrink: 0, transition: 'color 0.15s' }}>{icon}</span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={event => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode={inputMode}
          maxLength={maxLength}
          disabled={disabled}
          className="auth-field__input"
          style={{
            flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
            color: C.t1, fontSize: 14, fontFamily: 'inherit',
          }}
        />
        {right}
      </div>
      {error && (
        <div className="auth-field__error" role="alert" style={{ color: C.danger, fontSize: 12, marginTop: 6, paddingLeft: 2 }}>{error}</div>
      )}
    </div>
  );
}

export default function SSignup() {
  const navigate = useAppNavigate();
  const { openTerms, switchAuth } = usePublicModalNavigation();
  const [name, setName] = useState('');
  const signupPolicy = useQuery({
    ...getSignupPolicyOptions(),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
  const policyMethod = signupPolicy.data?.success ? signupPolicy.data.data?.verificationMethod : undefined;
  const policyReady = signupPolicy.isSuccess && !signupPolicy.isFetching
    && (policyMethod === 'EMAIL' || policyMethod === 'PHONE');
  // Keep the last known method during background refetches; readiness gates actions.
  const verificationMethod = policyMethod === 'EMAIL' || policyMethod === 'PHONE' ? policyMethod : undefined;
  const verification = useSignupVerification(verificationMethod, () => { void signupPolicy.refetch(); });
  const { email, phoneNumber, isVerified, label: verificationLabel } = verification;
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [acceptedLegalDocumentIds, setAcceptedLegalDocumentIds] = useState<{
    termsDocumentId: number;
    privacyPolicyDocumentId: number;
  } | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const legalDocumentsQuery = useQuery({
    ...getCurrentLegalDocumentsOptions({ query: { locale: 'ko-KR' } }),
    retry: 2,
    staleTime: 5 * 60_000,
  });
  const legalDocuments = legalDocumentsQuery.data?.data;
  const termsDocumentId = legalDocuments?.termsOfService?.id;
  const privacyPolicyDocumentId = legalDocuments?.privacyPolicy?.id;
  const legalDocumentsReady = Boolean(
    legalDocumentsQuery.isSuccess
    && !legalDocumentsQuery.isFetching
    && termsDocumentId
    && privacyPolicyDocumentId,
  );
  const agreed = Boolean(
    legalDocumentsReady
    && acceptedLegalDocumentIds?.termsDocumentId === termsDocumentId
    && acceptedLegalDocumentIds?.privacyPolicyDocumentId === privacyPolicyDocumentId,
  );
  const canSubmit = agreed && ageConfirmed && legalDocumentsReady && policyReady && isVerified && !submitting;

  const handleSignup = async () => {
    const nextErrors: SignupErrors = {};
    if (!name.trim()) nextErrors.name = '이름(필명)을 입력해주세요.';
    else if (name.trim().length > 20) nextErrors.name = '이름(필명)은 20자 이하로 입력해주세요.';
    if (!email.trim()) nextErrors.email = '이메일을 입력해주세요.';
    else if (!isValidEmail(email.trim())) nextErrors.email = '이메일 형식이 올바르지 않습니다.';
    if (verificationMethod === 'PHONE') {
      if (!/^010\d{8}$/.test(phoneNumber)) nextErrors.phoneNumber = '휴대폰 번호는 하이픈 없이 010으로 시작하는 11자리 숫자여야 합니다.';
      else if (!isVerified) nextErrors.phoneNumber = '휴대폰 번호 인증을 완료해주세요.';
    } else if (!isVerified) nextErrors.email = '이메일 인증을 완료해주세요.';
    if (!password) nextErrors.password = '비밀번호를 입력해주세요.';
    else if (password.length < 8 || password.length > 64) nextErrors.password = '비밀번호는 8자 이상 64자 이하로 입력해주세요.';
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) nextErrors.password = '비밀번호는 영문과 숫자를 각각 하나 이상 포함해야 합니다.';
    if (!passwordConfirm) nextErrors.passwordConfirm = '비밀번호 확인을 입력해주세요.';
    else if (password !== passwordConfirm) nextErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.';
    if (!agreed) nextErrors.legal = '이용약관에 동의하고 개인정보처리방침을 확인해주세요.';
    if (!ageConfirmed) nextErrors.age = '만 14세 이상임을 확인해주세요.';
    if (!legalDocumentsReady) nextErrors.legal = '법률 문서를 불러온 뒤 가입할 수 있습니다.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !verification.token || !policyReady || submitting) return;
    if (!legalDocumentsReady || !termsDocumentId || !privacyPolicyDocumentId) return;

    try {
      setSubmitting(true);
      const { data: response } = await signup({
        body: {
          email: email.trim(),
          password,
          displayName: name.trim(),
          termsAccepted: agreed,
          privacyPolicyAcknowledged: agreed,
          age14OrOlderConfirmed: ageConfirmed,
          termsDocumentId,
          privacyPolicyDocumentId,
          ...(verificationMethod === 'EMAIL'
            ? { emailVerificationToken: verification.token }
            : { phoneVerificationToken: verification.token }),
        },
      });
      verification.reset();
      saveAuthToken(response);
      trackMetaCompleteRegistration();
      navigate('/works', 'push-right', undefined, { replace: true });
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError) {
        if (apiError.code === 'AUTH_EMAIL_DUPLICATED') {
          setErrors({ email: '이미 가입된 이메일입니다.' });
        } else if (apiError.code === 'AUTH_PHONE_NUMBER_DUPLICATED') {
          verification.reset();
          setErrors({ phoneNumber: '이미 가입된 휴대폰 번호입니다.' });
        } else if (apiError.code === 'AUTH_EMAIL_VERIFICATION_TOKEN_INVALID') {
          verification.reset();
          setErrors({ email: '이메일 인증이 만료되었거나 이미 사용되었습니다. 다시 인증해주세요.' });
        } else if (['AUTH_SIGNUP_VERIFICATION_METHOD_DISABLED', 'AUTH_EMAIL_VERIFICATION_TOKEN_REQUIRED', 'AUTH_PHONE_VERIFICATION_TOKEN_REQUIRED'].includes(apiError.code)) {
          verification.reset();
          await signupPolicy.refetch();
          setErrors({ email: '가입 인증 방식이 변경되었습니다. 다시 인증해주세요.' });
        } else if (apiError.code === 'AUTH_PHONE_VERIFICATION_TOKEN_INVALID') {
          verification.reset();
          setErrors({ phoneNumber: '휴대폰 인증이 만료되었거나 이미 사용되었습니다. 다시 인증해주세요.' });
        } else if (apiError.code === 'LEGAL_DOCUMENT_NOT_CURRENT') {
          setAcceptedLegalDocumentIds(null);
          await legalDocumentsQuery.refetch();
          setErrors({ legal: '가입 중 법률 문서가 변경되었습니다. 최신 내용을 다시 확인해주세요.' });
        } else if (apiError.code === 'LEGAL_DOCUMENTS_UNAVAILABLE') {
          setAcceptedLegalDocumentIds(null);
          setErrors({ legal: '현재 법률 문서를 사용할 수 없습니다. 다시 불러온 뒤 확인해주세요.' });
          await legalDocumentsQuery.refetch();
        } else if (apiError.code === 'REQUEST_VALIDATION_FAILED' && apiError.details.length > 0) {
          const fieldMap: Record<string, keyof SignupErrors> = {
            displayName: 'name', email: 'email', password: 'password', emailVerificationToken: 'email', phoneVerificationToken: 'phoneNumber',
            termsAccepted: 'legal', privacyPolicyAcknowledged: 'legal',
            termsDocumentId: 'legal', privacyPolicyDocumentId: 'legal',
            age14OrOlderConfirmed: 'age',
          };
          const fieldErrors: SignupErrors = {};
          apiError.details.forEach(detail => {
            const key = fieldMap[detail.field];
            if (key) fieldErrors[key] = detail.message;
          });
          setErrors(fieldErrors);
        } else {
          setErrors({ password: '회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
        }
      } else if (error instanceof NetworkError) {
        setErrors({ password: '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.' });
      } else {
        setErrors({ password: '회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const verificationButtonLabel = verification.hasRequested
    ? verification.resendRemaining > 0 ? `${verification.resendRemaining}초 후 재전송` : '인증번호 재전송'
    : '인증번호 받기';

  return (
    <AuthModal ariaLabelledBy="signup-modal-title" variant="signup">
      <div className="auth-modal-brand">
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 200, height: 200, borderRadius: '50%',
          background: C.primary + '15', filter: 'blur(40px)',
        }} />
        <div>
          <BrandLogo alt="CatchHole" className="auth-modal-brand__logo" />
          <div className="auth-modal-brand__headline" style={{ color: C.t1, fontSize: 22, fontWeight: 700, lineHeight: 1.4, letterSpacing: '-0.5px', marginBottom: 16 }}>
            원고 속 설정을<br />체계적으로 정리해보세요.
          </div>
          <div className="auth-modal-brand__description" style={{ color: C.t3, fontSize: 13, lineHeight: 1.7 }}>
            회원가입 후 작품과 원고를 등록하고<br />
            AI 설정 추출을 시작할 수 있습니다.
          </div>
        </div>
        <div className="auth-modal-brand__footer" style={{ color: C.t3, fontSize: 11 }}>© 2026 CatchHole</div>
      </div>

      <form
        className="auth-modal-form"
        noValidate
        onSubmit={event => {
          event.preventDefault();
          void handleSignup();
        }}
      >
        <BrandLogo alt="CatchHole" className="auth-modal-form__logo" />
        <div className="auth-modal-form__title" id="signup-modal-title" style={{ color: C.t1, fontSize: 20, fontWeight: 700, letterSpacing: '-0.4px', marginBottom: 6 }}>회원가입</div>
        <div className="auth-modal-form__intro" style={{ color: C.t3, fontSize: 13, marginBottom: 24 }}>{policyReady ? `${verificationLabel} 인증 후 계정을 만들어 분석을 시작하세요.` : '가입 인증 방식을 확인해주세요.'}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          <Input type="text" placeholder="이름 (필명)" value={name} onChange={setName} icon={<User size={15} />} error={errors.name} />
          {!policyReady && (
            <div className="auth-modal-consents__load-error" role={signupPolicy.isFetching ? 'status' : 'alert'}>
              <span>{signupPolicy.isFetching ? '가입 인증 방식을 불러오는 중입니다.' : '가입 인증 방식을 불러오지 못했습니다.'}</span>
              {!signupPolicy.isFetching && (
                <button type="button" onClick={() => void signupPolicy.refetch()}>인증 방식 다시 불러오기</button>
              )}
            </div>
          )}
          <Input
            type="email" placeholder="이메일" value={email}
            onChange={value => {
              verification.changeEmail(value);
              setErrors(current => ({ ...current, email: undefined }));
            }}
            icon={<Mail size={15} />} maxLength={255} disabled={submitting || !verificationMethod}
            error={verificationMethod === 'EMAIL' ? verification.identityError ?? errors.email : errors.email}
          />
          {verificationMethod === 'PHONE' && (
            <Input
              type="text" placeholder="휴대폰 번호 (예: 01012345678)" value={phoneNumber}
              onChange={value => {
                verification.changePhoneNumber(value);
                setErrors(current => ({ ...current, phoneNumber: undefined }));
              }}
              icon={<Phone size={15} />} inputMode="numeric" maxLength={11} disabled={submitting}
              error={verification.identityError ?? errors.phoneNumber}
            />
          )}
          {policyReady && (
            <button
              className={`auth-verification-send${isVerified ? ' is-verified' : ''}`}
              type="button" onClick={() => { if (policyReady) void verification.requestCode(); }}
              disabled={!policyReady || Boolean(verification.operation) || verification.resendRemaining > 0 || isVerified || submitting}
            >
              {verification.operation === 'send' ? '발송 중...' : isVerified ? '인증 완료' : verificationButtonLabel}
            </button>
          )}
          {verification.verificationId && !isVerified && (
            <Input
              type="text" placeholder="인증번호 6자리" value={verification.code}
              onChange={verification.changeCode} icon={<Shield size={15} />}
              inputMode="numeric" maxLength={6} disabled={Boolean(verification.operation) || submitting}
              error={verification.codeError}
              right={
                <div className="auth-verification-confirm">
                  <span className={`auth-verification-countdown${verification.remaining <= 60 ? ' is-urgent' : ''}`}
                    aria-label={`인증번호 만료까지 ${formatCountdown(verification.remaining)}`}>
                    {formatCountdown(verification.remaining)}
                  </span>
                  <button className="auth-verification-confirm__button" type="button"
                    onClick={() => { if (policyReady) void verification.confirmCode(); }}
                    disabled={!policyReady || Boolean(verification.operation) || verification.code.length !== 6 || verification.remaining === 0 || submitting}>
                    {verification.operation === 'confirm' ? '확인 중' : '인증'}
                  </button>
                </div>
              }
            />
          )}
          {policyReady && (
            <div className={`auth-verification-status${isVerified ? ' is-verified' : ''}`} role="status">
              {isVerified ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
              <span>{verification.message}</span>
            </div>
          )}
          {policyReady && verificationMethod === 'EMAIL' && verification.hasRequested && !isVerified && (
            <p className="auth-verification-mail-help">
              <Mail size={16} aria-hidden="true" />
              <span>인증메일이 도착하지 않았다면 <strong>스팸함</strong>도 확인해주세요.</span>
            </p>
          )}
          {isVerified && (
            <p className="auth-verification-help" aria-label={`가입 인증 만료까지 ${formatCountdown(verification.tokenRemaining)}`}>
              {formatCountdown(verification.tokenRemaining)} 안에 회원가입을 완료해주세요.
            </p>
          )}

          <Input
            type={showPw ? 'text' : 'password'}
            placeholder="비밀번호"
            value={password}
            onChange={setPassword}
            icon={<Lock size={15} />}
            error={errors.password}
            right={
              <button
                type="button"
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 표시'}
                onClick={() => setShowPw(current => !current)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.t3, padding: 0, display: 'flex' }}
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
          />
          <Input
            type={showPwConfirm ? 'text' : 'password'}
            placeholder="비밀번호 확인"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            icon={<Lock size={15} />}
            error={errors.passwordConfirm}
            right={
              <button
                type="button"
                aria-label={showPwConfirm ? '비밀번호 확인 숨기기' : '비밀번호 확인 표시'}
                onClick={() => setShowPwConfirm(current => !current)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.t3, padding: 0, display: 'flex' }}
              >
                {showPwConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            }
          />
        </div>

        <div className="auth-modal-consents">
          {legalDocumentsQuery.isError && (
            <div className="auth-modal-consents__load-error" role="alert">
              <span>법률 문서를 불러오지 못했습니다.</span>
              <button type="button" onClick={() => void legalDocumentsQuery.refetch()} disabled={legalDocumentsQuery.isFetching}>
                {legalDocumentsQuery.isFetching ? '다시 불러오는 중' : '다시 불러오기'}
              </button>
            </div>
          )}
          <div className="auth-modal-consent">
            <button
              type="button"
              aria-label="이용약관 동의 및 개인정보 처리방침 확인"
              aria-pressed={agreed}
              disabled={!legalDocumentsReady}
              onClick={() => {
                if (agreed) {
                  setAcceptedLegalDocumentIds(null);
                } else if (termsDocumentId && privacyPolicyDocumentId) {
                  setAcceptedLegalDocumentIds({ termsDocumentId, privacyPolicyDocumentId });
                }
                setErrors(current => ({ ...current, legal: undefined }));
              }}
              className={`auth-modal-consent__checkbox${agreed ? ' is-checked' : ''}`}
            >
              {agreed && <Check size={13} color="#fff" />}
            </button>
            <span>
              <strong>[필수]</strong>{' '}
              <button type="button" onClick={() => openTerms('terms')}>이용약관</button>
              에 동의하고{' '}
              <button type="button" onClick={() => openTerms('privacy')}>개인정보처리방침</button>
              을 확인했습니다.
              {legalDocumentsReady && (
                <small>현재 문서 {legalDocuments?.termsOfService?.documentVersion}</small>
              )}
              {legalDocumentsQuery.isPending && <small>게시 문서를 불러오는 중입니다.</small>}
            </span>
          </div>
          <div className="auth-modal-consent">
            <button
              type="button"
              aria-label="만 14세 이상 확인"
              aria-pressed={ageConfirmed}
              onClick={() => {
                setAgeConfirmed(current => !current);
                setErrors(current => ({ ...current, age: undefined }));
              }}
              className={`auth-modal-consent__checkbox${ageConfirmed ? ' is-checked' : ''}`}
            >
              {ageConfirmed && <Check size={13} color="#fff" />}
            </button>
            <span><strong>[필수]</strong> 만 14세 이상입니다.</span>
          </div>
          {(errors.legal || errors.age) && (
            <div className="auth-modal-consents__error" role="alert">
              {errors.legal ?? errors.age}
            </div>
          )}
        </div>

        <button
          className="auth-modal-primary"
          type="submit"
          disabled={!canSubmit}
          style={{
            width: '100%', height: 44, borderRadius: 8, border: 'none',
            background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'inherit', marginBottom: 18,
            opacity: canSubmit ? 1 : 0.5, transition: 'background 0.15s, opacity 0.15s',
          }}
        >
          {submitting ? '가입 중...' : !policyReady ? '인증 방식 확인 후 회원가입' : !isVerified ? `${verificationLabel} 인증 후 회원가입` : '회원가입'}
        </button>

        <div className="auth-modal-form__switch" style={{ textAlign: 'center', color: C.t3, fontSize: 13 }}>
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
