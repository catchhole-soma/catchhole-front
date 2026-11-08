import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';

interface Props {
  /** 카드 제목과 같은 회차 범위(예: `101화`, `96~100화`). */
  label: string;
  submitting: boolean;
  errorMessage: string | null;
  /** 닫은 뒤 초점을 돌려줄 `기록 삭제` 버튼. 삭제로 카드가 사라졌으면 Radix 기본 동작을 따른다. */
  returnFocusTo: HTMLElement | null;
  onClose: () => void;
  onDelete: () => void;
}

/**
 * 분석 목록 기록 삭제 확인. 서버는 목록에서만 숨기고 분석 결과·확정 설정은 지우지 않는다.
 * Radix Dialog가 초점 가두기·배경 비활성·닫은 뒤 초점 복귀를 맡는다.
 */
export function AnalysisHistoryDeleteModal({ label, submitting, errorMessage, returnFocusTo, onClose, onDelete }: Props) {
  return (
    <Dialog.Root open onOpenChange={open => { if (!open && !submitting) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="analysis-history-delete-backdrop" />
        <Dialog.Content role="alertdialog" className="theme-v2 analysis-history-delete"
          onCloseAutoFocus={event => {
            if (!returnFocusTo?.isConnected) return;
            event.preventDefault();
            returnFocusTo.focus();
          }}>
          <div className="analysis-history-delete__header">
            <span className="analysis-history-delete__icon" aria-hidden="true"><Trash2 size={17} /></span>
            <Dialog.Title className="analysis-history-delete__title">{label} 분석 기록을 삭제할까요?</Dialog.Title>
          </div>
          <Dialog.Description asChild>
            <div className="analysis-history-delete__body">
              <p>분석 목록에서 이 기록이 사라지고 원고 목록 위의 분석 알림도 함께 사라집니다. 분석 결과와 확정한 설정은 그대로 남습니다.</p>
              <p>같은 회차를 다시 분석하면 목록에 다시 나타납니다.</p>
            </div>
          </Dialog.Description>
          {errorMessage && (
            <div className="analysis-history-delete__error" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}
          <div className="analysis-history-delete__actions">
            <button type="button" className="analysis-history-delete__cancel" disabled={submitting} onClick={onClose}>
              취소
            </button>
            <button type="button" className="analysis-history-delete__confirm" disabled={submitting} onClick={onDelete}>
              {submitting && <Loader2 size={13} className="spin" aria-hidden="true" />}
              {submitting ? '삭제 중...' : errorMessage ? '다시 시도' : '삭제하기'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
