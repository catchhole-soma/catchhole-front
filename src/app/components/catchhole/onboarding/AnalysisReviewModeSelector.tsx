import { useId } from 'react';

/** 실제 업로드와 읽기 전용 안내가 같은 반영 방식 UI를 사용한다. */
export function AnalysisReviewModeSelector({ value, onChange, disabled = false }: {
  value: 'AUTOMATIC' | 'MANUAL';
  onChange: (value: 'AUTOMATIC' | 'MANUAL') => void;
  disabled?: boolean;
}) {
  const name = useId();
  return <fieldset className="episode-analysis-mode" disabled={disabled}>
    <legend>설정 반영 방식</legend>
    <label>
      <input type="radio" name={name} value="AUTOMATIC" checked={value === 'AUTOMATIC'} onChange={() => onChange('AUTOMATIC')} />
      <span><strong>AI 판단으로 설정 자동 반영</strong>
        <small>판단이 명확한 설정은 작품에 자동 저장하고, 인물이나 내용이 불분명한 설정만 검토합니다. 기본 방식입니다.</small></span>
    </label>
    <label>
      <input type="radio" name={name} value="MANUAL" checked={value === 'MANUAL'} onChange={() => onChange('MANUAL')} />
      <span><strong>모든 설정 직접 검토</strong>
        <small>분석 결과를 직접 확인하고 확정한 설정만 작품에 저장합니다.</small></span>
    </label>
  </fieldset>;
}
