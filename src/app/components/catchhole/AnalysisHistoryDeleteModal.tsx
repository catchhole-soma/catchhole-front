import { useEffect } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { C } from './constants';

interface Props {
  /** 카드 제목과 같은 회차 범위(예: `101화`, `96~100화`). */
  label: string;
  submitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onDelete: () => void;
}

/** 분석 목록 기록 삭제 확인. 서버는 목록에서만 숨기고 분석 결과·확정 설정은 지우지 않는다. */
export function AnalysisHistoryDeleteModal({ label, submitting, errorMessage, onClose, onDelete }: Props) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, submitting]);

  return (
    <motion.div
      className="theme-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={event => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 310,
        background: 'rgba(4, 4, 8, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        className="theme-modal analysis-history-delete-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="analysis-history-delete-title"
        aria-describedby="analysis-history-delete-description"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        style={{
          width: 'min(440px, 100%)',
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: C.surface,
          boxShadow: '0 24px 80px rgba(0,0,0,0.62)',
          overflow: 'hidden',
        }}
      >
        <div className="theme-modal__header" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '18px 22px',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: C.danger + '14',
            color: C.danger,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Trash2 size={17} />
          </div>
          <div className="theme-modal__title" id="analysis-history-delete-title"
            style={{ color: C.t1, fontSize: 16, fontWeight: 700 }}>
            {label} 분석 기록을 삭제할까요?
          </div>
        </div>

        <div className="theme-modal__body" style={{ padding: '22px' }}>
          <p id="analysis-history-delete-description" className="theme-modal__description"
            style={{ margin: 0, color: C.t2, fontSize: 13, lineHeight: 1.6 }}>
            분석 목록에서 이 기록이 사라지고 원고 목록 위의 분석 알림도 함께 사라집니다.
            분석 결과와 확정한 설정은 그대로 남습니다.
          </p>
          <p className="theme-modal__description" style={{ margin: '10px 0 0', color: C.t2, fontSize: 12, lineHeight: 1.6 }}>
            같은 회차를 다시 분석하면 목록에 다시 나타납니다.
          </p>
          {errorMessage && (
            <div role="alert" style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              marginTop: 14,
              padding: '8px 11px',
              borderRadius: 6,
              background: C.danger + '12',
              color: 'var(--ch-danger-ink, #B42336)',
              fontSize: 12,
              lineHeight: 1.5,
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              {errorMessage}
            </div>
          )}
        </div>

        <div className="theme-modal__footer" style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '16px 22px',
          borderTop: `1px solid ${C.border}`,
        }}>
          <button
            type="button"
            autoFocus
            disabled={submitting}
            onClick={onClose}
            style={{
              minHeight: 36,
              padding: '0 14px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.t2,
              fontFamily: 'inherit',
              fontSize: 12,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            취소
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onDelete}
            style={{
              minHeight: 36,
              padding: '0 14px',
              borderRadius: 6,
              border: 0,
              background: C.danger,
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.45 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {submitting && <Loader2 size={13} className="spin" />}
            {submitting ? '삭제 중...' : errorMessage ? '다시 시도' : '삭제하기'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
