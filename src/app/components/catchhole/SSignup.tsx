import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
  confirmPhoneVerificationMutation,
  getCurrentLegalDocumentsOptions,
  requestPhoneVerificationMutation,
  signupMutation,
} from '../../api/generated/@tanstack/react-query.gen';
import { saveAuthToken } from '../../lib/auth';
import { NetworkError, toApiError } from '../../lib/api-errors';
import { BrandLogo } from './ui-v2/BrandLogo';

const PHONE_VERIFICATION_STORAGE_KEY = 'catchhole_phone_verification';

interface PersistedPhoneVerification {
  verificationId: string | null;
  phoneNumber: string;
  expiresAt: number;
  resendAt: number;
}

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

function readPersistedPhoneVerification(): PersistedPhoneVerification | null {
  try {
    const raw = sessionStorage.getItem(PHONE_VERIFICATION_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PersistedPhoneVerification>;
    if (
      (typeof value.verificationId !== 'string' && value.verificationId !== null)
      || typeof value.phoneNumber !== 'string'
      || typeof value.expiresAt !== 'number'
      || typeof value.resendAt !== 'number'
      || value.expiresAt <= Date.now()
    ) {
      sessionStorage.removeItem(PHONE_VERIFICATION_STORAGE_KEY);
      return null;
    }
    return value as PersistedPhoneVerification;
  } catch {
    sessionStorage.removeItem(PHONE_VERIFICATION_STORAGE_KEY);
    return null;
  }
}

function persistPhoneVerification(value: PersistedPhoneVerification) {
  sessionStorage.setItem(PHONE_VERIFICATION_STORAGE_KEY, JSON.stringify(value));
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
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hasRequestedVerification, setHasRequestedVerification] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneVerificationToken, setPhoneVerificationToken] = useState<string | null>(null);
  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState<string | null>(null);
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<number | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
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
  const [verificationMessage, setVerificationMessage] = useState('가입 전 휴대폰 번호 인증이 필요합니다.');

  const requestVerification = useMutation(requestPhoneVerificationMutation());
  const confirmVerification = useMutation(confirmPhoneVerificationMutation());
  const signupRequest = useMutation(signupMutation());
  const legalDocumentsQuery = useQuery({
    ...getCurrentLegalDocumentsOptions({ query: { locale: 'ko-KR' } }),
    retry: 2,
    staleTime: 5 * 60_000,
  });
  const legalDocuments = legalDocumentsQuery.data?.data;
  const termsDocumentId = legalDocuments?.termsOfService?.id;
  const privacyPolicyDocumentId = legalDocuments?.privacyPolicy?.id;
  const legalDocumentsReady = Boolean(termsDocumentId && privacyPolicyDocumentId);
  const agreed = Boolean(
    legalDocumentsReady
    && acceptedLegalDocumentIds?.termsDocumentId === termsDocumentId
    && acceptedLegalDocumentIds?.privacyPolicyDocumentId === privacyPolicyDocumentId,
  );
  const submitting = signupRequest.isPending;
  const verificationRemaining = verificationExpiresAt
    ? Math.max(0, Math.ceil((verificationExpiresAt - now) / 1_000))
    : 0;
  const resendRemaining = resendAt
    ? Math.max(0, Math.ceil((resendAt - now) / 1_000))
    : 0;
  const isPhoneVerified = Boolean(
    phoneVerificationToken
    && verifiedPhoneNumber === phoneNumber
    && tokenExpiresAt
    && tokenExpiresAt > now,
  );
  const canSubmit = agreed && ageConfirmed && legalDocumentsReady && isPhoneVerified && !submitting;

  useEffect(() => {
    const persisted = readPersistedPhoneVerification();
    if (!persisted) return;
    setPhoneNumber(persisted.phoneNumber);
    setHasRequestedVerification(true);
    setVerificationId(persisted.verificationId);
    setVerificationExpiresAt(persisted.expiresAt);
    setResendAt(persisted.resendAt);
    setVerificationMessage(persisted.verificationId
      ? '발송된 인증번호를 입력해주세요.'
      : '인증번호 입력 횟수를 초과했습니다. 새 인증번호를 받아주세요.');
  }, []);

  useEffect(() => {
    if (!verificationExpiresAt && !phoneVerificationToken) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [phoneVerificationToken, verificationExpiresAt]);

  useEffect(() => {
    if (!verificationExpiresAt || verificationExpiresAt > now || isPhoneVerified) return;
    sessionStorage.removeItem(PHONE_VERIFICATION_STORAGE_KEY);
    setVerificationId(null);
    setVerificationExpiresAt(null);
    setResendAt(null);
    setVerificationCode('');
    setVerificationMessage('인증번호가 만료되었습니다. 새 인증번호를 받아주세요.');
  }, [isPhoneVerified, now, verificationExpiresAt]);

  useEffect(() => {
    if (!phoneVerificationToken || !tokenExpiresAt || tokenExpiresAt > now) return;
    setPhoneVerificationToken(null);
    setVerifiedPhoneNumber(null);
    setTokenExpiresAt(null);
    setVerificationMessage('휴대폰 인증이 만료되었습니다. 다시 인증해주세요.');
  }, [now, phoneVerificationToken, tokenExpiresAt]);

  const resetPhoneVerification = () => {
    sessionStorage.removeItem(PHONE_VERIFICATION_STORAGE_KEY);
    setVerificationId(null);
    setHasRequestedVerification(false);
    setVerificationCode('');
    setPhoneVerificationToken(null);
    setVerifiedPhoneNumber(null);
    setVerificationExpiresAt(null);
    setResendAt(null);
    setTokenExpiresAt(null);
    setVerificationMessage('가입 전 휴대폰 번호 인증이 필요합니다.');
  };

  const handlePhoneNumberChange = (value: string) => {
    const nextPhoneNumber = value.replace(/\D/g, '').slice(0, 11);
    if (nextPhoneNumber !== phoneNumber && (hasRequestedVerification || verificationId || phoneVerificationToken)) {
      resetPhoneVerification();
    }
    setPhoneNumber(nextPhoneNumber);
    setErrors(current => ({ ...current, phoneNumber: undefined, verificationCode: undefined }));
  };

  const handleRequestVerification = async () => {
    if (!/^010\d{8}$/.test(phoneNumber)) {
      setErrors(current => ({
        ...current,
        phoneNumber: '휴대폰 번호는 하이픈 없이 010으로 시작하는 11자리 숫자여야 합니다.',
      }));
      return;
    }

    setErrors(current => ({ ...current, phoneNumber: undefined, verificationCode: undefined }));
    try {
      const response = await requestVerification.mutateAsync({ body: { phoneNumber } });
      const result = response.data;
      if (!response.success || !result?.verificationId || !result.expiresInSeconds || !result.resendAfterSeconds) {
        throw new Error('휴대폰 인증 응답을 확인할 수 없습니다.');
      }
      const requestedAt = Date.now();
      const expiresAt = requestedAt + result.expiresInSeconds * 1_000;
      const nextResendAt = requestedAt + result.resendAfterSeconds * 1_000;
      const persisted = {
        verificationId: result.verificationId,
        phoneNumber,
        expiresAt,
        resendAt: nextResendAt,
      };
      persistPhoneVerification(persisted);
      setNow(requestedAt);
      setVerificationId(result.verificationId);
      setHasRequestedVerification(true);
      setVerificationExpiresAt(expiresAt);
      setResendAt(nextResendAt);
      setVerificationCode('');
      setPhoneVerificationToken(null);
      setVerifiedPhoneNumber(null);
      setTokenExpiresAt(null);
      setVerificationMessage('인증번호를 발송했습니다. 가장 최근 번호만 유효합니다.');
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError?.code === 'AUTH_PHONE_NUMBER_DUPLICATED') {
        setErrors(current => ({ ...current, phoneNumber: '이미 가입된 휴대폰 번호입니다.' }));
      } else if (apiError?.code === 'AUTH_PHONE_VERIFICATION_RATE_LIMITED') {
        setErrors(current => ({ ...current, phoneNumber: '인증번호 발송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' }));
      } else if (apiError?.code === 'AUTH_PHONE_VERIFICATION_UNAVAILABLE') {
        setErrors(current => ({ ...current, phoneNumber: '현재 휴대폰 인증을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.' }));
      } else if (error instanceof NetworkError) {
        setErrors(current => ({ ...current, phoneNumber: '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.' }));
      } else {
        setErrors(current => ({ ...current, phoneNumber: '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' }));
      }
    }
  };

  const handleConfirmVerification = async () => {
    if (!verificationId || !verificationExpiresAt || verificationExpiresAt <= Date.now()) {
      setErrors(current => ({ ...current, verificationCode: '인증번호가 만료되었습니다. 새 인증번호를 받아주세요.' }));
      return;
    }
    if (!/^\d{6}$/.test(verificationCode)) {
      setErrors(current => ({ ...current, verificationCode: '인증번호 6자리를 입력해주세요.' }));
      return;
    }

    setErrors(current => ({ ...current, verificationCode: undefined }));
    try {
      const response = await confirmVerification.mutateAsync({
        path: { verificationId },
        body: { code: verificationCode },
      });
      const result = response.data;
      if (!response.success || !result?.phoneVerificationToken || !result.expiresInSeconds) {
        throw new Error('휴대폰 인증 완료 응답을 확인할 수 없습니다.');
      }
      const confirmedAt = Date.now();
      setNow(confirmedAt);
      setPhoneVerificationToken(result.phoneVerificationToken);
      setVerifiedPhoneNumber(phoneNumber);
      setTokenExpiresAt(confirmedAt + result.expiresInSeconds * 1_000);
      setVerificationMessage('휴대폰 인증이 완료되었습니다.');
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError?.code === 'AUTH_PHONE_VERIFICATION_CODE_INVALID') {
        setErrors(current => ({ ...current, verificationCode: '인증번호가 올바르지 않습니다.' }));
      } else if (apiError?.code === 'AUTH_PHONE_VERIFICATION_EXPIRED') {
        resetPhoneVerification();
        setVerificationMessage('인증번호가 만료되었습니다. 새 인증번호를 받아주세요.');
      } else if (apiError?.code === 'AUTH_PHONE_VERIFICATION_ATTEMPTS_EXCEEDED') {
        persistPhoneVerification({
          verificationId: null,
          phoneNumber,
          expiresAt: verificationExpiresAt,
          resendAt: resendAt ?? Date.now(),
        });
        setVerificationId(null);
        setVerificationCode('');
        setVerificationMessage('인증번호 입력 횟수를 초과했습니다. 새 인증번호를 받아주세요.');
      } else if (apiError?.code === 'AUTH_PHONE_VERIFICATION_RATE_LIMITED') {
        setErrors(current => ({ ...current, verificationCode: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }));
      } else if (apiError?.code === 'AUTH_PHONE_VERIFICATION_UNAVAILABLE') {
        setErrors(current => ({ ...current, verificationCode: '현재 휴대폰 인증을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.' }));
      } else if (error instanceof NetworkError) {
        setErrors(current => ({ ...current, verificationCode: '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.' }));
      } else {
        setErrors(current => ({ ...current, verificationCode: '인증 확인에 실패했습니다. 잠시 후 다시 시도해주세요.' }));
      }
    }
  };

  const handleSignup = async () => {
    const nextErrors: SignupErrors = {};
    if (!name.trim()) nextErrors.name = '이름(필명)을 입력해주세요.';
    else if (name.trim().length > 20) nextErrors.name = '이름(필명)은 20자 이하로 입력해주세요.';
    if (!email.trim()) nextErrors.email = '이메일을 입력해주세요.';
    else if (!isValidEmail(email)) nextErrors.email = '이메일 형식이 올바르지 않습니다.';
    if (!phoneNumber.trim()) nextErrors.phoneNumber = '휴대폰 번호를 입력해주세요.';
    else if (!/^010\d{8}$/.test(phoneNumber)) nextErrors.phoneNumber = '휴대폰 번호는 하이픈 없이 010으로 시작하는 11자리 숫자여야 합니다.';
    else if (!isPhoneVerified) nextErrors.phoneNumber = '휴대폰 번호 인증을 완료해주세요.';
    if (!password) nextErrors.password = '비밀번호를 입력해주세요.';
    else if (password.length < 8 || password.length > 64) nextErrors.password = '비밀번호는 8자 이상 64자 이하로 입력해주세요.';
    else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) nextErrors.password = '비밀번호는 영문과 숫자를 각각 하나 이상 포함해야 합니다.';
    if (!passwordConfirm) nextErrors.passwordConfirm = '비밀번호 확인을 입력해주세요.';
    else if (password !== passwordConfirm) nextErrors.passwordConfirm = '비밀번호가 일치하지 않습니다.';
    if (!agreed) nextErrors.legal = '이용약관에 동의하고 개인정보처리방침을 확인해주세요.';
    if (!ageConfirmed) nextErrors.age = '만 14세 이상임을 확인해주세요.';
    if (!termsDocumentId || !privacyPolicyDocumentId) nextErrors.legal = '법률 문서를 불러온 뒤 가입할 수 있습니다.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !phoneVerificationToken) return;
    if (!termsDocumentId || !privacyPolicyDocumentId) return;

    try {
      const response = await signupRequest.mutateAsync({
        body: {
          email: email.trim(),
          password,
          displayName: name.trim(),
          termsAccepted: agreed,
          privacyPolicyAcknowledged: agreed,
          age14OrOlderConfirmed: ageConfirmed,
          termsDocumentId,
          privacyPolicyDocumentId,
          phoneVerificationToken,
        },
      });
      sessionStorage.removeItem(PHONE_VERIFICATION_STORAGE_KEY);
      saveAuthToken(response);
      navigate('/works', 'push-right', undefined, { replace: true });
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError) {
        if (apiError.code === 'AUTH_EMAIL_DUPLICATED') {
          setErrors({ email: '이미 가입된 이메일입니다.' });
        } else if (apiError.code === 'AUTH_PHONE_NUMBER_DUPLICATED') {
          resetPhoneVerification();
          setErrors({ phoneNumber: '이미 가입된 휴대폰 번호입니다.' });
        } else if (apiError.code === 'AUTH_PHONE_VERIFICATION_TOKEN_INVALID') {
          resetPhoneVerification();
          setErrors({ phoneNumber: '휴대폰 인증이 만료되었거나 이미 사용되었습니다. 다시 인증해주세요.' });
        } else if (apiError.code === 'LEGAL_DOCUMENT_NOT_CURRENT') {
          setAcceptedLegalDocumentIds(null);
          await legalDocumentsQuery.refetch();
          setErrors({ legal: '가입 중 법률 문서가 변경되었습니다. 최신 내용을 다시 확인해주세요.' });
        } else if (apiError.code === 'REQUEST_VALIDATION_FAILED' && apiError.details.length > 0) {
          const fieldMap: Record<string, keyof SignupErrors> = {
            displayName: 'name', email: 'email', password: 'password', phoneVerificationToken: 'phoneNumber',
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
    }
  };

  const verificationButtonLabel = hasRequestedVerification
    ? resendRemaining > 0 ? `${resendRemaining}초 후 재전송` : '인증번호 재전송'
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
        <div className="auth-modal-form__intro" style={{ color: C.t3, fontSize: 13, marginBottom: 24 }}>휴대폰 인증 후 계정을 만들어 분석을 시작하세요.</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          <Input type="text" placeholder="이름 (필명)" value={name} onChange={setName} icon={<User size={15} />} error={errors.name} />
          <Input type="email" placeholder="이메일" value={email} onChange={setEmail} icon={<Mail size={15} />} error={errors.email} />
          <Input
            type="text"
            placeholder="휴대폰 번호 (예: 01012345678)"
            value={phoneNumber}
            onChange={handlePhoneNumberChange}
            icon={<Phone size={15} />}
            inputMode="numeric"
            maxLength={11}
            disabled={requestVerification.isPending || confirmVerification.isPending}
            error={errors.phoneNumber}
            right={
              <button
                type="button"
                onClick={() => void handleRequestVerification()}
                disabled={requestVerification.isPending || confirmVerification.isPending || resendRemaining > 0 || isPhoneVerified}
                style={{
                  minWidth: 104, height: 30, padding: '0 10px', borderRadius: 6,
                  border: `1px solid ${isPhoneVerified ? C.success + '88' : C.primary + '88'}`,
                  background: isPhoneVerified ? C.success + '18' : C.primary + '18',
                  color: isPhoneVerified ? C.success : C.primary,
                  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  cursor: requestVerification.isPending || confirmVerification.isPending || resendRemaining > 0 || isPhoneVerified ? 'not-allowed' : 'pointer',
                  opacity: resendRemaining > 0 ? 0.65 : 1,
                }}
              >
                {requestVerification.isPending ? '발송 중...' : isPhoneVerified ? '인증 완료' : verificationButtonLabel}
              </button>
            }
          />

          {verificationId && !isPhoneVerified && (
            <Input
              type="text"
              placeholder="인증번호 6자리"
              value={verificationCode}
              onChange={value => {
                setVerificationCode(value.replace(/\D/g, '').slice(0, 6));
                setErrors(current => ({ ...current, verificationCode: undefined }));
              }}
              icon={<Shield size={15} />}
              inputMode="numeric"
              maxLength={6}
              disabled={confirmVerification.isPending}
              error={errors.verificationCode}
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span aria-label={`인증번호 만료까지 ${formatCountdown(verificationRemaining)}`} style={{ color: verificationRemaining > 60 ? C.t2 : C.warning, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCountdown(verificationRemaining)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleConfirmVerification()}
                    disabled={confirmVerification.isPending || verificationCode.length !== 6 || verificationRemaining === 0}
                    style={{
                      minWidth: 58, height: 30, padding: '0 10px', border: 'none', borderRadius: 6,
                      background: C.primary, color: '#fff', fontSize: 11, fontWeight: 600,
                      fontFamily: 'inherit', cursor: confirmVerification.isPending || verificationCode.length !== 6 || verificationRemaining === 0 ? 'not-allowed' : 'pointer',
                      opacity: verificationCode.length === 6 && verificationRemaining > 0 ? 1 : 0.5,
                    }}
                  >
                    {confirmVerification.isPending ? '확인 중' : '인증'}
                  </button>
                </div>
              }
            />
          )}

          <div
            role="status"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, minHeight: 18,
              color: isPhoneVerified ? C.success : verificationId ? C.t2 : C.t3,
              fontSize: 11, lineHeight: 1.5,
            }}
          >
            {isPhoneVerified ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
            <span>{verificationMessage}</span>
          </div>

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
          {submitting ? '가입 중...' : !isPhoneVerified ? '휴대폰 인증 후 회원가입' : '회원가입'}
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
