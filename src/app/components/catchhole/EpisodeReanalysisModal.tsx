import { useEffect } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import type { EpisodeSummaryResponse } from '../../api/generated/types.gen';
import { C } from './constants';
import { ManuscriptProcessingNotice } from './ManuscriptProcessingNotice';

interface Props {
  episode: EpisodeSummaryResponse;
  laterAnalyzedEpisodeCount: number;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function EpisodeReanalysisModal({
  episode,
  laterAnalyzedEpisodeCount,
  submitting,
  error,
  onClose,
  onConfirm,
}: Props) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, submitting]);

  const titleId = `episode-reanalysis-title-${episode.id}`;

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
        position: 'fixed', inset: 0, zIndex: 310, background: 'rgba(4, 4, 8, 0.78)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <motion.div
        className="theme-modal episode-reanalysis-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        style={{
          width: 'min(500px, 100%)', borderRadius: 12, border: `1px solid ${C.border}`,
          background: C.surface, boxShadow: '0 24px 80px rgba(0,0,0,0.62)', overflow: 'hidden',
        }}
      >
        <div className="theme-modal__header" style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: `${C.warning}14`, color: C.warning,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <RefreshCw size={17} />
          </div>
          <div className="theme-modal__title" id={titleId} style={{ color: C.t1, fontSize: 16, fontWeight: 700 }}>
            이 회차를 다시 분석할까요?
          </div>
        </div>

        <div className="theme-modal__body" style={{ padding: 22 }}>
          <p style={{ margin: '0 0 10px', color: C.t2, fontSize: 13, lineHeight: 1.65 }}>
            변경된 원고를 기준으로 {episode.episodeNo}화만 다시 분석합니다.
          </p>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, padding: '11px 12px', borderRadius: 7,
            background: `${C.warning}12`, color: C.warning, fontSize: 12, lineHeight: 1.6,
          }}>
            <AlertTriangle size={15} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>
              이후 회차에서 쌓인 설정이 함께 참고되어, 중복되거나 시간 순서가 맞지 않는 후보가 생길 수 있습니다.
              확정된 설정은 자동으로 변경되지 않습니다.
            </span>
          </div>
          {laterAnalyzedEpisodeCount > 0 && (
            <p style={{ margin: '10px 0 0', color: C.t2, fontSize: 12 }}>
              현재 분석 완료 상태인 후속 회차가 <strong style={{ color: C.t1 }}>{laterAnalyzedEpisodeCount}개</strong> 있습니다.
            </p>
          )}
          <ManuscriptProcessingNotice />
          {error && (
            <div role="alert" style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '9px 11px',
              borderRadius: 6, background: `${C.danger}12`, color: C.danger, fontSize: 12,
            }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="theme-modal__footer" style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 22px',
          borderTop: `1px solid ${C.border}`,
        }}>
          <button type="button" autoFocus disabled={submitting} onClick={onClose} style={{
            height: 36, padding: '0 14px', borderRadius: 6, border: `1px solid ${C.border}`,
            background: 'transparent', color: C.t2, fontFamily: 'inherit', fontSize: 12,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1,
          }}>취소</button>
          <button type="button" disabled={submitting} onClick={onConfirm} style={{
            minWidth: 142, height: 36, padding: '0 14px', borderRadius: 6, border: 0,
            background: C.primary, color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {submitting && <Loader2 size={13} className="spin" />}
            {submitting ? '재분석 요청 중...' : '이해하고 재분석'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
