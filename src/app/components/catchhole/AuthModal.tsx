import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { usePublicModalNavigation } from '../../hooks/usePublicModalNavigation';
import './auth-modal.css';

type AuthModalProps = {
  ariaLabelledBy: string;
  children: ReactNode;
  variant: 'login' | 'signup';
};

export function AuthModal({ ariaLabelledBy, children, variant }: AuthModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { closeAuth, termsTab } = usePublicModalNavigation();

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    if (termsTab) dialogRef.current?.setAttribute('inert', '');
    else dialogRef.current?.removeAttribute('inert');
  }, [termsTab]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || termsTab) return;
      event.preventDefault();
      closeAuth();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeAuth, termsTab]);

  return (
    <motion.div
      className="auth-modal-backdrop theme-v2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={event => {
        if (event.target === event.currentTarget) closeAuth();
      }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-hidden={termsTab ? true : undefined}
        className={`auth-modal-dialog auth-modal-dialog--${variant}`}
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0, scale: 0.99 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        onMouseDown={event => event.stopPropagation()}
      >
        <button
          type="button"
          className="auth-modal-close"
          aria-label={`${variant === 'login' ? '로그인' : '회원가입'} 닫기`}
          onClick={closeAuth}
        >
          <X size={18} />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}
