import * as Dialog from '@radix-ui/react-dialog';
import type { EpisodeSummaryResponse } from '../../api/generated/types.gen';

type Props = {
  episodes: EpisodeSummaryResponse[];
  loading: boolean;
  loadFailed: boolean;
  submitting: boolean;
  error: string | null;
  onReload: () => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function OrderedAnalysisRestartDialog({ episodes, loading, loadFailed, submitting, error, onReload, onClose, onConfirm }: Props) {
  return (
    <Dialog.Root open onOpenChange={open => { if (!open && !submitting) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="ordered-analysis-restart-backdrop" />
        <Dialog.Content className="theme-v2 ordered-analysis-restart">
          <Dialog.Title>이 업로드 묶음을 새로 분석할까요?</Dialog.Title>
          <Dialog.Description asChild>
            <div>
              <p>이 묶음에서 현재 보관 중인 회차 전체를 처음부터 순서대로 분석합니다. 이전 분석 기록은 유지되며 AI 사용량이 다시 차감됩니다.</p>
              {!loading && !loadFailed && episodes.length > 0 && (
                <p><strong>대상 {episodes.length}개 회차:</strong> {episodes.map(episode => `${episode.episodeNo}화`).join(', ')}</p>
              )}
              <p>회차 순서대로 분석하며 판단이 명확한 설정은 작품에 자동 반영합니다. 확인이 필요한 설정만 검토 대상으로 남습니다. 대상 회차의 내용을 이미 확정한 경우에는 과거 상태로 되돌릴 수 없어 새 분석이 제한될 수 있습니다.</p>
            </div>
          </Dialog.Description>
          {loading && <p role="status">현재 회차 범위를 확인하고 있습니다.</p>}
          {loadFailed && <p role="alert">대상 회차를 확인하지 못했습니다. <button onClick={onReload}>다시 확인</button></p>}
          {!loading && !loadFailed && episodes.length === 0 && <p role="alert">현재 보관 중인 대상 회차가 없습니다.</p>}
          {error && <p className="ordered-analysis-restart__error" role="alert">{error}</p>}
          <div className="ordered-analysis-restart__actions">
            <button type="button" disabled={submitting} onClick={onClose}>취소</button>
            <button type="button" className="ordered-analysis-restart__confirm"
              disabled={submitting || loading || loadFailed || episodes.length === 0} onClick={onConfirm}>
              {submitting ? '새 분석 요청 중...' : '새 순차 분석 시작'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
