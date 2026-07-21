import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut, FlaskConical } from 'lucide-react';
import { C } from './constants';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { logoutMutation } from '../../api/generated/@tanstack/react-query.gen';
import { clearAuthSession } from '../../lib/auth';
import { isDemoMode, setDemoMode } from '../../lib/worksApi';

export function UserMenu() {
  const navigate = useAppNavigate();
  const queryClient = useQueryClient();
  const logoutRequest = useMutation(logoutMutation());
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoMode, setDemoModeState] = useState(isDemoMode());

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await logoutRequest.mutateAsync({});
    } catch {
      // 서버 세션 폐기 실패 여부와 무관하게 로컬 인증 정보는 제거한다.
    } finally {
      clearAuthSession();
      queryClient.clear();
      navigate('/landing', 'dissolve', undefined, { replace: true });
    }
  };

  const handleToggleDemo = () => {
    const next = !demoMode;
    setDemoMode(next);
    setDemoModeState(next);
    setMenuOpen(false);
    window.location.reload();
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="사용자 메뉴 열기"
        onClick={() => setMenuOpen(o => !o)}
        style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.primary}, #9B7BFD)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          border: 'none', padding: 0, fontFamily: 'inherit',
        }}
      >K</button>
      <AnimatePresence>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 11,
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden', minWidth: 160,
              }}
            >
              <button
                onClick={handleToggleDemo}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                  color: C.t1, fontSize: 13, fontFamily: 'inherit', textAlign: 'left',
                  borderBottom: `1px solid ${C.border}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.border + '55'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FlaskConical size={14} /> 데모 모드
                </span>
                <span style={{
                  width: 28, height: 16, borderRadius: 8, flexShrink: 0,
                  background: demoMode ? C.primary : C.border, position: 'relative', transition: 'background 0.15s',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: demoMode ? 14 : 2, width: 12, height: 12,
                    borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                  }} />
                </span>
              </button>
              <button
                onClick={handleLogout}
                disabled={logoutRequest.isPending}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', background: 'none', border: 'none',
                  color: C.t1, fontSize: 13, fontFamily: 'inherit', textAlign: 'left',
                  cursor: logoutRequest.isPending ? 'default' : 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.border + '55'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <LogOut size={14} /> {logoutRequest.isPending ? '로그아웃 중...' : '로그아웃'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
