import { useEffect, useRef, useState } from 'react';
import {
  confirmEmailVerification,
  confirmPhoneVerification,
  requestEmailVerification,
  requestPhoneVerification,
} from '../api/generated/sdk.gen';
import { isValidEmail } from '../components/catchhole/constants';
import { NetworkError, toApiError } from '../lib/api-errors';

export type SignupVerificationMethod = 'EMAIL' | 'PHONE';

interface VerificationFlow {
  verificationId: string | null;
  identity: string;
  expiresAt: number;
  resendAt: number;
}

const storageKey = (method: SignupVerificationMethod) => `catchhole_${method.toLowerCase()}_verification`;
const identityKey = (method: SignupVerificationMethod) => method === 'EMAIL' ? 'email' : 'phoneNumber';

function removePersisted(method: SignupVerificationMethod | undefined) {
  if (!method) return;
  try { sessionStorage.removeItem(storageKey(method)); } catch { /* Storage is optional. */ }
}

function persistFlow(method: SignupVerificationMethod, flow: VerificationFlow) {
  try {
    sessionStorage.setItem(storageKey(method), JSON.stringify({
      verificationId: flow.verificationId,
      [identityKey(method)]: flow.identity,
      expiresAt: flow.expiresAt,
      resendAt: flow.resendAt,
    }));
  } catch { /* Verification still works when storage is unavailable. */ }
}

function restoreFlow(method: SignupVerificationMethod): VerificationFlow | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey(method)) ?? 'null');
    if (!value) return null;
    const identity = value[identityKey(method)];
    if ((typeof value.verificationId !== 'string' && value.verificationId !== null)
      || typeof identity !== 'string'
      || !Number.isFinite(value.expiresAt) || !Number.isFinite(value.resendAt)
      || Math.max(value.expiresAt, value.resendAt) <= Date.now()) {
      removePersisted(method);
      return null;
    }
    return { ...value, identity };
  } catch {
    removePersisted(method);
    return null;
  }
}

export function useSignupVerification(method: SignupVerificationMethod | undefined, onPolicyChanged: () => void) {
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [flow, setFlow] = useState<VerificationFlow | null>(null);
  const [code, setCode] = useState('');
  const [token, setToken] = useState<{ value: string; identity: string; expiresAt: number } | null>(null);
  const [operation, setOperation] = useState<'send' | 'confirm' | null>(null);
  const [identityError, setIdentityError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now);
  const epoch = useRef(0);
  const pending = useRef(false);
  const identity = method === 'EMAIL' ? email.trim() : phoneNumber;
  const label = method === 'EMAIL' ? '이메일' : '휴대폰';
  const initialMessage = method === 'EMAIL' ? '가입 전 이메일 인증이 필요합니다.' : '가입 전 휴대폰 번호 인증이 필요합니다.';
  const remaining = flow ? Math.max(0, Math.ceil((flow.expiresAt - now) / 1_000)) : 0;
  const resendRemaining = flow ? Math.max(0, Math.ceil((flow.resendAt - now) / 1_000)) : 0;
  const tokenRemaining = token ? Math.max(0, Math.ceil((token.expiresAt - now) / 1_000)) : 0;
  const isVerified = Boolean(method && token && token.identity === identity && token.expiresAt > now);

  useEffect(() => {
    epoch.current += 1;
    pending.current = false;
    setOperation(null);
    setToken(null);
    setCode('');
    setIdentityError(undefined);
    setCodeError(undefined);
    const restored = method ? restoreFlow(method) : null;
    setFlow(restored);
    if (restored && method === 'EMAIL') setEmail(restored.identity);
    if (restored && method === 'PHONE') setPhoneNumber(restored.identity);
    setMessage(restored
      ? restored.verificationId ? '발송된 인증번호를 입력해주세요.' : '인증번호 입력 횟수를 초과했습니다. 새 인증번호를 받아주세요.'
      : '');
    return () => { epoch.current += 1; };
  }, [method]);

  useEffect(() => {
    if (!flow && !token) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [flow, token]);

  useEffect(() => {
    // Expiry while a confirmation is in flight is resolved by the server response.
    if (!flow || flow.expiresAt > now || token || operation) return;
    if (flow.verificationId) {
      const expired = { ...flow, verificationId: null };
      setFlow(expired);
      setCode('');
      setCodeError(undefined);
      setMessage('인증번호가 만료되었습니다. 새 인증번호를 받아주세요.');
      if (method) persistFlow(method, expired);
    }
    if (flow.resendAt <= now) removePersisted(method);
  }, [flow, method, now, operation, token]);

  useEffect(() => {
    if (!token || token.expiresAt > now) return;
    epoch.current += 1;
    setToken(null);
    setFlow(null);
    setCode('');
    removePersisted(method);
    setMessage(`${label} 인증이 만료되었습니다. 다시 인증해주세요.`);
  }, [label, method, now, token]);

  function reset() {
    epoch.current += 1;
    pending.current = false;
    setOperation(null);
    setFlow(null);
    setToken(null);
    setCode('');
    setMessage('');
    setIdentityError(undefined);
    setCodeError(undefined);
    removePersisted(method);
  }

  function changeEmail(value: string) {
    if (method === 'EMAIL' && value.trim() !== email.trim()) reset();
    setEmail(value);
  }

  function changePhoneNumber(value: string) {
    const next = value.replace(/\D/g, '').slice(0, 11);
    if (method === 'PHONE' && next !== phoneNumber) reset();
    setPhoneNumber(next);
  }

  function unavailable(error: unknown, fallback: string) {
    const apiError = toApiError(error);
    if (apiError?.code.endsWith('_VERIFICATION_UNAVAILABLE')) return `현재 ${label} 인증을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.`;
    if (error instanceof NetworkError) return '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.';
    return fallback;
  }

  async function requestCode() {
    if (!method || pending.current || isVerified || (flow && flow.resendAt > Date.now())) return;
    if (method === 'EMAIL' ? !isValidEmail(identity) : !/^010\d{8}$/.test(identity)) {
      setIdentityError(method === 'EMAIL' ? '올바른 이메일을 입력해주세요.' : '휴대폰 번호는 하이픈 없이 010으로 시작하는 11자리 숫자여야 합니다.');
      return;
    }
    const version = ++epoch.current;
    pending.current = true;
    setOperation('send');
    setIdentityError(undefined);
    setCodeError(undefined);
    try {
      // Codes and signup tokens must stay out of the shared mutation cache.
      const { data: response } = method === 'EMAIL'
        ? await requestEmailVerification({ body: { email: identity } })
        : await requestPhoneVerification({ body: { phoneNumber: identity } });
      if (epoch.current !== version) return;
      const result = response.data;
      if (!response.success || !result?.verificationId || !result.expiresInSeconds
        || typeof result.resendAfterSeconds !== 'number' || result.resendAfterSeconds < 0) throw new Error('Invalid verification response');
      const requestedAt = Date.now();
      const nextFlow = {
        verificationId: result.verificationId, identity,
        expiresAt: requestedAt + result.expiresInSeconds * 1_000,
        resendAt: requestedAt + result.resendAfterSeconds * 1_000,
      };
      persistFlow(method, nextFlow);
      setNow(requestedAt);
      setFlow(nextFlow);
      setToken(null);
      setCode('');
      setMessage('인증번호를 발송했습니다. 가장 최근 번호만 유효합니다.');
    } catch (error) {
      if (epoch.current !== version) return;
      const apiError = toApiError(error);
      if (apiError?.code === 'AUTH_SIGNUP_VERIFICATION_METHOD_DISABLED') { reset(); onPolicyChanged(); return; }
      setIdentityError(apiError?.code === 'AUTH_EMAIL_DUPLICATED' ? '이미 가입된 이메일입니다.'
        : apiError?.code === 'AUTH_PHONE_NUMBER_DUPLICATED' ? '이미 가입된 휴대폰 번호입니다.'
          : apiError?.code.endsWith('_VERIFICATION_RATE_LIMITED') ? '인증번호 발송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
            : unavailable(error, '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      if (epoch.current === version) { pending.current = false; setOperation(null); }
    }
  }

  async function confirmCode() {
    if (!method || pending.current || !flow?.verificationId || flow.identity !== identity) return;
    if (flow.expiresAt <= Date.now()) {
      setCodeError('인증번호가 만료되었습니다. 새 인증번호를 받아주세요.');
      return;
    }
    if (!/^\d{6}$/.test(code)) { setCodeError('인증번호 6자리를 입력해주세요.'); return; }
    const version = ++epoch.current;
    pending.current = true;
    setOperation('confirm');
    setCodeError(undefined);
    try {
      const options = { path: { verificationId: flow.verificationId }, body: { code } };
      const response = method === 'EMAIL'
        ? (await confirmEmailVerification(options)).data
        : (await confirmPhoneVerification(options)).data;
      if (epoch.current !== version) return;
      const result = response.data;
      const value = result && ('emailVerificationToken' in result ? result.emailVerificationToken : 'phoneVerificationToken' in result ? result.phoneVerificationToken : undefined);
      if (!response.success || !value || !result?.expiresInSeconds) throw new Error('Invalid confirmation response');
      const confirmedAt = Date.now();
      setNow(confirmedAt);
      setToken({ value, identity, expiresAt: confirmedAt + result.expiresInSeconds * 1_000 });
      setCode('');
      removePersisted(method);
      setMessage(`${label} 인증이 완료되었습니다.`);
    } catch (error) {
      if (epoch.current !== version) return;
      const apiError = toApiError(error);
      if (apiError?.code === 'AUTH_SIGNUP_VERIFICATION_METHOD_DISABLED') { reset(); onPolicyChanged(); return; }
      if (apiError?.code.endsWith('_VERIFICATION_CODE_INVALID')) setCodeError('인증번호가 올바르지 않습니다.');
      else if (apiError?.code.endsWith('_VERIFICATION_EXPIRED')) {
        reset();
        setMessage('인증번호가 만료되었습니다. 새 인증번호를 받아주세요.');
      } else if (apiError?.code.endsWith('_VERIFICATION_ATTEMPTS_EXCEEDED')) {
        const lockedFlow = { ...flow, verificationId: null };
        persistFlow(method, lockedFlow);
        setFlow(lockedFlow);
        setCode('');
        setMessage('인증번호 입력 횟수를 초과했습니다. 새 인증번호를 받아주세요.');
      } else setCodeError(apiError?.code.endsWith('_VERIFICATION_RATE_LIMITED')
        ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
        : unavailable(error, '인증 확인에 실패했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      if (epoch.current === version) { pending.current = false; setOperation(null); }
    }
  }

  return {
    email, phoneNumber, changeEmail, changePhoneNumber, reset, requestCode, confirmCode,
    code, changeCode(value: string) { setCode(value.replace(/\D/g, '').slice(0, 6)); setCodeError(undefined); },
    verificationId: flow?.verificationId, hasRequested: Boolean(flow), remaining, resendRemaining,
    token: isVerified ? token?.value : undefined, tokenRemaining, isVerified, operation,
    identityError, codeError, message: message || initialMessage, label,
  };
}
