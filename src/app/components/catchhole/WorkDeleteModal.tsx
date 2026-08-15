import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { AlertCircle, Loader2, Trash2, TriangleAlert, X } from 'lucide-react';
import {
  deleteWorkMutation,
  getMyWorksQueryKey,
} from '../../api/generated/@tanstack/react-query.gen';
import { NetworkError, toApiError } from '../../lib/api-errors';
import {
  type Work,
} from '../../lib/worksApi';
import { C } from './constants';

interface Props {
  work: Work;
  onClose: () => void;
  onDeleted: (workId: string) => void;
}

export function WorkDeleteModal({ work, onClose, onDeleted }: Props) {
  const queryClient = useQueryClient();
  const deleteRequest = useMutation(deleteWorkMutation());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitting = deleteRequest.isPending;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, submitting]);

  const handleDelete = async () => {
    if (submitting) return;
    setSubmitError(null);

    try {
      await deleteRequest.mutateAsync({ path: { workId: work.id } });
      await queryClient.invalidateQueries({ queryKey: getMyWorksQueryKey() });
      onDeleted(work.id);
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError?.code === 'WORK_NOT_FOUND') {
        setSubmitError('이미 삭제됐거나 찾을 수 없는 작품입니다. 목록을 새로고침해 주세요.');
      } else if (error instanceof NetworkError) {
        setSubmitError('서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.');
      } else {
        setSubmitError('작품을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
  };

  return (
    <motion.div
      className="work-delete-backdrop theme-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={event => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 210,
        background: 'rgba(4, 4, 8, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <motion.div
        className="work-delete-modal theme-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-delete-title"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        style={{
          width: 'min(520px, 100%)',
          borderRadius: 14,
          background: C.surface,
          border: `1px solid ${C.border}`,
          boxShadow: '0 24px 80px rgba(0,0,0,0.62)',
          padding: 30,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: C.danger + '18',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <TriangleAlert size={20} color={C.danger} />
          </div>
          <div style={{ flex: 1 }}>
            <div id="work-delete-title" style={{ color: C.t1, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              작품을 삭제하시겠습니까?
            </div>
            <div style={{ color: C.t2, fontSize: 13, lineHeight: 1.65 }}>
              <strong style={{ color: C.t1 }}>{work.title}</strong> 작품을 삭제합니다.
            </div>
          </div>
          <button
            type="button"
            aria-label="작품 삭제 닫기"
            onClick={onClose}
            disabled={submitting}
            style={{
              border: 'none',
              background: 'transparent',
              color: C.t3,
              padding: 4,
              cursor: submitting ? 'default' : 'pointer',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{
          marginTop: 22,
          padding: '14px 16px',
          borderRadius: 9,
          background: C.danger + '0D',
          border: `1px solid ${C.danger}33`,
          color: C.t2,
          fontSize: 13,
          lineHeight: 1.65,
        }}>
          현재 작품 삭제는 보관이 아닌 영구 삭제이며, 삭제한 작품은 복구할 수 없습니다.
        </div>

        {submitError && (
          <div role="alert" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 14,
            padding: '11px 13px',
            borderRadius: 7,
            background: C.danger + '14',
            border: `1px solid ${C.danger}44`,
            color: C.danger,
            fontSize: 12,
          }}>
            <AlertCircle size={15} /> {submitError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 26 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              height: 42,
              padding: '0 22px',
              borderRadius: 7,
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.t2,
              fontSize: 13,
              fontFamily: 'inherit',
              cursor: submitting ? 'default' : 'pointer',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            style={{
              minWidth: 112,
              height: 42,
              padding: '0 20px',
              borderRadius: 7,
              border: 'none',
              background: C.danger,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: submitting ? 'default' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
            }}
          >
            {submitting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
            {submitting ? '삭제 중...' : '영구 삭제'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
