import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut } from 'lucide-react';
import { C } from './constants';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { logout } from '../../lib/auth';

export function UserMenu() {
  const navigate = useAppNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login', 'push-left');
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setMenuOpen(o => !o)}
        style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `linear-gradient(135deg, ${C.primary}, #9B7BFD)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}
      >K</div>
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
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden', minWidth: 120,
              }}
            >
              <button
                onClick={handleLogout}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                  color: C.t1, fontSize: 13, fontFamily: 'inherit', textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.border + '55'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <LogOut size={14} /> 로그아웃
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
