import { useEffect } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import type { SettingBookSummaryResponse } from '../../api/generated/types.gen';
import { C } from './constants';

interface Props {
  settingBook: SettingBookSummaryResponse;
  submitting: boolean;
  failed: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function SettingBookDeleteModal({
  settingBook,
  submitting,
  failed,
  onClose,
  onDelete,
}: Props) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, submitting]);

  const titleId = `setting-book-delete-title-${settingBook.id}`;

  return (
    <motion.div
      className="theme-v2 setting-book-modal-backdrop theme-modal-backdrop"
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
        className="setting-book-delete-modal theme-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        style={{
          width: 'min(480px, 100%)',
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
          <div id={titleId} style={{ color: C.t1, fontSize: 16, fontWeight: 700 }}>
            이 설정집을 삭제할까요?
          </div>
        </div>

        <div className="theme-modal__body" style={{ padding: '22px' }}>
          <div style={{ color: C.t2, fontSize: 13, marginBottom: 14 }}>
            삭제한 설정집은 설정집 파일 목록에서 사라집니다.
          </div>

          <div className="setting-book-delete-modal__file" style={{
            padding: '12px 14px',
            borderRadius: 7,
            background: '#22222C',
            marginBottom: 12,
          }}>
            <div style={{
              color: C.t1,
              fontSize: 13,
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {settingBook.originalFilename || '원본 파일명 없음'}
            </div>
          </div>

          {failed ? (
            <div role="alert" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 34,
              padding: '8px 11px',
              borderRadius: 6,
              background: C.danger + '12',
              color: C.danger,
              fontSize: 12,
              boxSizing: 'border-box',
            }}>
              <AlertCircle size={14} />
              삭제에 실패했습니다. 설정집은 목록에 그대로 유지됩니다.
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 34,
              padding: '8px 11px',
              borderRadius: 6,
              background: C.warning + '12',
              color: C.warning,
              fontSize: 12,
              boxSizing: 'border-box',
            }}>
              <AlertTriangle size={14} />
              현재 서비스에서는 직접 복구할 수 없습니다.
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
              height: 36,
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
              minWidth: failed ? 76 : 58,
              height: 36,
              padding: '0 14px',
              borderRadius: 6,
              border: 0,
              background: C.danger,
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {submitting && <Loader2 size={13} className="spin" />}
            {submitting ? '삭제 중...' : failed ? '다시 시도' : '삭제'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
