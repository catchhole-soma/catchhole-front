import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  deleteWorkMutation,
  getMyWorksQueryKey,
  getWorkPurgeRequestByWorkOptions,
  retryWorkPurgeRequestMutation,
} from '../../api/generated/@tanstack/react-query.gen';
import type { WorkPurgeResponse } from '../../api/generated/types.gen';
import { NetworkError, toApiError } from '../../lib/api-errors';
import type { Work } from '../../lib/worksApi';
import { C } from './constants';

const PURGE_CONFIRMATION = '영구 삭제';

interface Props {
  work: Work;
  onClose: () => void;
  onPurgeStarted: (workId: string) => void;
  onCompleted: (workId: string) => void;
}

const STATUS_TEXT: Record<WorkPurgeResponse['status'], string> = {
  REQUESTED: '영구 삭제 요청을 접수했습니다.',
  PROCESSING: '원본과 분석 데이터를 영구 삭제하고 있습니다.',
  COMPLETED: '작품과 원본·파생 데이터를 영구 삭제했습니다.',
  PARTIAL_FAILED: '일부 저장소의 삭제를 완료하지 못했습니다.',
  FAILED: '영구 삭제를 완료하지 못했습니다.',
};

export function WorkDeleteModal({ work, onClose, onPurgeStarted, onCompleted }: Props) {
  const queryClient = useQueryClient();
  const deleteRequest = useMutation(deleteWorkMutation());
  const retryRequest = useMutation(retryWorkPurgeRequestMutation());
  const [confirmation, setConfirmation] = useState('');
  const [acceptedPurge, setAcceptedPurge] = useState<WorkPurgeResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const purgeQuery = useQuery({
    ...getWorkPurgeRequestByWorkOptions({ path: { workId: work.id } }),
    enabled: work.lifecycleStatus === 'PURGING' || acceptedPurge !== null,
    retry: false,
    refetchInterval: query => {
      const status = query.state.data?.data?.status;
      return status === 'COMPLETED' || status === 'FAILED' || status === 'PARTIAL_FAILED'
        ? false
        : 3_000;
    },
  });
  const purge = purgeQuery.data?.data ?? acceptedPurge;
  const inProgress = purge?.status === 'REQUESTED' || purge?.status === 'PROCESSING';
  const submitting = deleteRequest.isPending || retryRequest.isPending;
  const hasStarted = Boolean(purge) || work.lifecycleStatus === 'PURGING';

  useEffect(() => {
    if (purge?.status !== 'COMPLETED') return;
    void queryClient.invalidateQueries({ queryKey: getMyWorksQueryKey() });
    onCompleted(work.id);
  }, [onCompleted, purge?.status, queryClient, work.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, submitting]);

  const errorMessage = (error: unknown) => {
    const apiError = toApiError(error);
    if (apiError?.code === 'WORK_NOT_FOUND') {
      return '이미 삭제됐거나 찾을 수 없는 작품입니다. 목록을 새로고침해 주세요.';
    }
    if (error instanceof NetworkError) {
      return '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.';
    }
    return '영구 삭제 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';
  };

  const handleDelete = async () => {
    if (submitting || confirmation !== PURGE_CONFIRMATION) return;
    setSubmitError(null);
    try {
      const response = await deleteRequest.mutateAsync({
        path: { workId: work.id },
        body: { confirmation },
      });
      if (!response.data) throw new Error('영구 삭제 요청 응답이 없습니다.');
      setAcceptedPurge(response.data);
      onPurgeStarted(work.id);
      await queryClient.invalidateQueries({ queryKey: getMyWorksQueryKey() });
    } catch (error) {
      setSubmitError(errorMessage(error));
    }
  };

  const handleRetry = async () => {
    if (!purge?.requestId || submitting) return;
    setSubmitError(null);
    try {
      const response = await retryRequest.mutateAsync({ path: { requestId: purge.requestId } });
      if (response.data) setAcceptedPurge(response.data);
      await purgeQuery.refetch();
    } catch (error) {
      setSubmitError(errorMessage(error));
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
        position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(4, 4, 8, 0.78)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
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
          width: 'min(540px, 100%)', borderRadius: 14, background: C.surface,
          border: `1px solid ${C.border}`, boxShadow: '0 24px 80px rgba(0,0,0,0.62)',
          padding: 30, boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: `${C.danger}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {purge?.status === 'COMPLETED'
              ? <CheckCircle2 size={20} color={C.success} />
              : <TriangleAlert size={20} color={C.danger} />}
          </div>
          <div style={{ flex: 1 }}>
            <div id="work-delete-title" style={{ color: C.t1, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              {hasStarted ? '작품 영구 삭제 상태' : '작품을 영구 삭제할까요?'}
            </div>
            <div style={{ color: C.t2, fontSize: 13, lineHeight: 1.65 }}>
              <strong style={{ color: C.t1 }}>{work.title}</strong>
            </div>
          </div>
          <button type="button" aria-label="작품 삭제 닫기" onClick={onClose} disabled={submitting} style={{
            border: 'none', background: 'transparent', color: C.t3, padding: 4,
            cursor: submitting ? 'default' : 'pointer', display: 'flex',
          }}><X size={20} /></button>
        </div>

        {purge ? (
          <div style={{ marginTop: 22 }}>
            <div role="status" style={{
              display: 'flex', gap: 9, alignItems: 'center', padding: '14px 16px', borderRadius: 9,
              background: purge.status === 'COMPLETED' ? `${C.success}12` : `${C.primary}0D`,
              border: `1px solid ${purge.status === 'COMPLETED' ? `${C.success}44` : C.border}`,
              color: C.t2, fontSize: 13, lineHeight: 1.6,
            }}>
              {inProgress && <Loader2 size={16} className="spin" color={C.primary} />}
              <span>{STATUS_TEXT[purge.status]}</span>
            </div>
            {(purge.objectStorage || purge.database) && (
              <div style={{ marginTop: 12, color: C.t3, fontSize: 12, lineHeight: 1.65 }}>
                {purge.objectStorage && <div>원본 저장소: {purge.objectStorage.deletedCount ?? 0}건 삭제 / {purge.objectStorage.failedCount ?? 0}건 실패</div>}
                {purge.database && <div>서비스 데이터: {purge.database.deletedCount ?? 0}건 삭제 / {purge.database.failedCount ?? 0}건 실패</div>}
              </div>
            )}
            {purge.slaBreached && (
              <div role="alert" style={{ marginTop: 12, color: C.warning, fontSize: 12 }}>
                24시간 처리 목표를 초과했습니다. 재시도해도 완료되지 않으면 문의해주세요.
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{
              marginTop: 22, padding: '14px 16px', borderRadius: 9, background: `${C.danger}0D`,
              border: `1px solid ${C.danger}33`, color: C.t2, fontSize: 13, lineHeight: 1.65,
            }}>
              이 작품의 원본 파일, 회차, 분석 결과를 모두 삭제합니다. 삭제한 자료는 복구할 수 없습니다.
            </div>
            <label htmlFor="work-purge-confirmation" style={{ display: 'block', marginTop: 18, color: C.t2, fontSize: 12, lineHeight: 1.6 }}>
              계속하려면 <strong style={{ color: C.t1 }}>{PURGE_CONFIRMATION}</strong>를 정확히 입력해주세요.
            </label>
            <input
              id="work-purge-confirmation"
              aria-label="영구 삭제 확인 문구"
              value={confirmation}
              onChange={event => setConfirmation(event.target.value)}
              autoComplete="off"
              disabled={submitting}
              placeholder={PURGE_CONFIRMATION}
              style={{
                width: '100%', height: 42, marginTop: 8, boxSizing: 'border-box', padding: '0 12px',
                borderRadius: 7, border: `1px solid ${confirmation && confirmation !== PURGE_CONFIRMATION ? C.danger : C.border}`,
                background: C.bg, color: C.t1, fontFamily: 'inherit', outline: 'none',
              }}
            />
          </>
        )}

        {(submitError || purgeQuery.isError) && (
          <div role="alert" style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '11px 13px',
            borderRadius: 7, background: `${C.danger}14`, border: `1px solid ${C.danger}44`,
            color: C.danger, fontSize: 12,
          }}>
            <AlertCircle size={15} /> {submitError ?? '삭제 상태를 불러오지 못했습니다.'}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 26 }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{
            height: 42, padding: '0 22px', borderRadius: 7, border: `1px solid ${C.border}`,
            background: 'transparent', color: C.t2, fontSize: 13, fontFamily: 'inherit',
            cursor: submitting ? 'default' : 'pointer',
          }}>{hasStarted ? '닫기' : '취소'}</button>
          {!hasStarted && (
            <button type="button" onClick={handleDelete} disabled={submitting || confirmation !== PURGE_CONFIRMATION} style={{
              minWidth: 128, height: 42, padding: '0 20px', borderRadius: 7, border: 'none',
              background: C.danger, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              cursor: submitting || confirmation !== PURGE_CONFIRMATION ? 'not-allowed' : 'pointer',
              opacity: submitting || confirmation !== PURGE_CONFIRMATION ? 0.45 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              {submitting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
              {submitting ? '요청 중...' : '영구 삭제 요청'}
            </button>
          )}
          {purge?.retryable && (
            <button type="button" onClick={handleRetry} disabled={submitting} style={{
              minWidth: 112, height: 42, padding: '0 20px', borderRadius: 7, border: 'none',
              background: C.primary, color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
              cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.55 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              {submitting ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
              삭제 재시도
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
