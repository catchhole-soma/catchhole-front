import * as Dialog from '@radix-ui/react-dialog';
import type { AnalysisStartCheckResponse } from '../../api/generated/types.gen';

type Props = {
  summary: AnalysisStartCheckResponse;
  changed: boolean;
  onCancel: () => void;
  onContinue: () => void;
  onReview: () => void;
};

export function AnalysisStartGateDialog({ summary, changed, onCancel, onContinue, onReview }: Props) {
  const manual = summary.manualReviewCount > 0;
  const active = summary.activeEarlierAnalysisCount > 0;
  const hasSettingCandidates = summary.ambiguousCharacterCount + summary.ambiguousWorldCount > 0;
  if (!active && !manual && !hasSettingCandidates) return null;
  return <Dialog.Root open onOpenChange={open => { if (!open) onCancel(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="ordered-analysis-restart-backdrop" />
      <Dialog.Content className="theme-v2 ordered-analysis-restart">
        <Dialog.Title>{active ? '이전 회차 분석이 진행 중입니다' : manual ? '이전 회차의 직접 검토를 마쳐 주세요' : '미확정 설정 후보를 종료하고 계속할까요?'}</Dialog.Title>
        <Dialog.Description asChild>
          <div>
            {changed && <p>이전 회차의 검토 상태가 바뀌었습니다. 현재 내용을 다시 확인해 주세요.</p>}
            {active ? <>
              <p>이전 회차 분석 {summary.activeEarlierAnalysisCount}건이 진행 중입니다. 완료 후 설정 검토를 마치고 다음 회차를 분석해 주세요.</p>
              <p>아직 처리 중인 후보를 종료하거나 건너뛰지 않습니다.</p>
            </> : manual ? <>
              <p>이전 회차에 직접 검토가 필요한 <strong>{summary.manualReviewCount}개 후보</strong>가 남아 있습니다.</p>
              <p>각 후보를 반영하거나 제외해 검토를 마친 뒤 다음 회차를 분석할 수 있습니다. 남은 직접 검토 후보는 자동으로 종료하지 않습니다.</p>
            </> : <>
              <p><strong>확정되지 않은 후보가 있습니다. 확인하지 않고 다음 회차를 분석하면 정확도가 낮아질 수 있습니다.</strong></p>
              <p>캐릭터 {summary.ambiguousCharacterCount}개 · 세계관 {summary.ambiguousWorldCount}개</p>
              <p>계속하면 이 설정 후보만 종료되어 검토 목록과 이후 분석의 참고에서 제외됩니다. 원래 근거와 처리 기록은 보존되며, 이미 확정한 설정은 유지됩니다.</p>
              {summary.ambiguousRelationshipCount > 0 && <p>보류된 관계 {summary.ambiguousRelationshipCount}건은 관계도에 표시되지 않으며, 종료하지 않고 다음 회차 분석에 참고합니다.</p>}
            </>}
          </div>
        </Dialog.Description>
        <div className="ordered-analysis-restart__actions">
          <button type="button" onClick={onCancel}>취소</button>
          <button type="button" onClick={() => { onCancel(); onReview(); }}>이전 분석 결과 확인</button>
          {!active && !manual && <button type="button" className="ordered-analysis-restart__confirm" onClick={onContinue}>설정 후보 종료 후 계속 분석</button>}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
