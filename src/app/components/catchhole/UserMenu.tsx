import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut } from 'lucide-react';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { logoutMutation } from '../../api/generated/@tanstack/react-query.gen';
import { clearAuthSession } from '../../lib/auth';

export function UserMenu() {
  const navigate = useAppNavigate();
  const queryClient = useQueryClient();
  const logoutRequest = useMutation(logoutMutation());
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    clearAuthSession();
    queryClient.clear();
    try {
      await logoutRequest.mutateAsync({});
    } catch {
      // 서버 세션 폐기 실패 여부와 무관하게 로컬 인증 정보는 제거한다.
    } finally {
      navigate('/landing', 'dissolve', undefined, { replace: true });
    }
  };

  return (
    <div className="user-menu">
      <button
        type="button"
        aria-label="사용자 메뉴 열기"
        onClick={() => setMenuOpen(o => !o)}
        className="user-menu__trigger"
      >K</button>
      <AnimatePresence>
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="사용자 메뉴 닫기"
              className="user-menu__backdrop"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              className="user-menu__popover"
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
            >
              <button
                type="button"
                className="user-menu__item"
                onClick={handleLogout}
                disabled={logoutRequest.isPending}
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
