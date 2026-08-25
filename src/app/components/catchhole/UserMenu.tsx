import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LogOut, UserRoundX } from 'lucide-react';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { getMeOptions, logoutMutation } from '../../api/generated/@tanstack/react-query.gen';
import { clearAuthSession } from '../../lib/auth';
import { MemberWithdrawalModal } from './MemberWithdrawalModal';

export function UserMenu() {
  const navigate = useAppNavigate();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const logoutRequest = useMutation(logoutMutation());
  const profileQuery = useQuery({
    ...getMeOptions(),
    retry: false,
    staleTime: 60_000,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [profileImageFailed, setProfileImageFailed] = useState(false);

  const member = profileQuery.data?.data;
  const displayName = member?.displayName?.trim() || '사용자';
  const email = profileQuery.isPending
    ? '계정 정보를 확인 중입니다.'
    : profileQuery.isError
      ? '계정 정보를 불러오지 못했습니다.'
      : member?.email?.trim() || '이메일 정보 없음';
  const initial = Array.from(displayName)[0]?.toUpperCase() || 'K';
  const profileImageUrl = profileImageFailed ? null : member?.profileImageUrl;

  useEffect(() => {
    setProfileImageFailed(false);
  }, [member?.profileImageUrl]);

  useEffect(() => {
    if (!menuOpen) return;
    const frame = requestAnimationFrame(() => firstMenuItemRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [menuOpen]);

  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

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

  const handleWithdrawalAccepted = () => {
    clearAuthSession();
    queryClient.clear();
    navigate(
      '/landing',
      'dissolve',
      { memberWithdrawalAccepted: true },
      { replace: true },
    );
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === 'Tab') {
      setMenuOpen(false);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
    );
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : event.key === 'ArrowDown'
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return (
    <div className="user-menu">
      <button
        ref={triggerRef}
        type="button"
        aria-label={menuOpen ? '사용자 메뉴 닫기' : '사용자 메뉴 열기'}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(o => !o)}
        className="user-menu__trigger"
      >
        <span className="user-menu__trigger-avatar" aria-hidden="true">
          {profileImageUrl ? (
            <img src={profileImageUrl} alt="" onError={() => setProfileImageFailed(true)} />
          ) : initial}
        </span>
      </button>
      <AnimatePresence>
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="사용자 메뉴 닫기"
              className="user-menu__backdrop"
              tabIndex={-1}
              onClick={() => closeMenu(true)}
            />
            <motion.div
              className="user-menu__popover"
              role="menu"
              aria-label="사용자 메뉴"
              aria-busy={profileQuery.isFetching}
              onKeyDown={handleMenuKeyDown}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: reduceMotion ? 0 : 0.12 }}
            >
              <div className="user-menu__profile" role="presentation">
                <span className="user-menu__avatar" aria-hidden="true">
                  {profileImageUrl ? (
                    <img src={profileImageUrl} alt="" onError={() => setProfileImageFailed(true)} />
                  ) : initial}
                </span>
                <span className="user-menu__profile-copy">
                  <strong title={displayName}>{displayName}</strong>
                  <span title={email}>{email}</span>
                </span>
              </div>
              <div className="user-menu__divider" role="separator" />
              <button
                ref={firstMenuItemRef}
                type="button"
                className="user-menu__item"
                role="menuitem"
                onClick={handleLogout}
                disabled={logoutRequest.isPending}
              >
                <LogOut size={18} /> {logoutRequest.isPending ? '로그아웃 중...' : '로그아웃'}
              </button>
              <div className="user-menu__divider" role="separator" />
              <button
                type="button"
                className="user-menu__item user-menu__item--danger"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setWithdrawalOpen(true);
                }}
              >
                <UserRoundX size={18} /> 회원 탈퇴
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {withdrawalOpen && (
        <MemberWithdrawalModal
          onAccepted={handleWithdrawalAccepted}
          onClose={() => setWithdrawalOpen(false)}
          returnFocusRef={triggerRef}
        />
      )}
    </div>
  );
}
