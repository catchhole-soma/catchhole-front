import { useEffect } from 'react';
import { ACCESS_TOKEN_KEY, setAuthErrorListener } from '../lib/api';

/** 전역 인증 만료만 처리한다. 네트워크 오류는 각 실제 API 화면에서 재시도할 수 있다. */
export function BackendStatusProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    setAuthErrorListener(() => {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.location.href = '/login';
    });
    return () => setAuthErrorListener(null);
  }, []);

  return children;
}
