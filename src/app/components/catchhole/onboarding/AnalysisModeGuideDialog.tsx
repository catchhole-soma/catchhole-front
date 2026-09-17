import { useEffect, useRef, type KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { WorldSettingDialog } from '../worldsetting/WorldSettingDialog';
import { AnalysisGuidePreview } from './AnalysisGuidePreview';
import './analysis-mode-guide.css';

const STEPS = ['반영 방식', '모든 설정 직접 검토', 'AI 자동 반영', '자동 반영 후 직접 검토', '검토 완료'];
const SCENES = [
  { title: '설정을 반영하는 두 가지 방식이 있어요', description: '자동 반영이 기본이에요. 모든 설정을 먼저 확인하고 싶다면 직접 검토를 선택할 수 있어요.' },
  { title: '모든 설정을 직접 보고 확정해요', description: '직접 검토를 선택하면 3개 모두 확인해야 해요. 원문과 AI 판단을 살펴보고 확정하기 전에는 작품에 저장되지 않아요.' },
  { title: '명확한 설정은 AI가 바로 반영해요', description: '레온의 종족·직업 2개가 작품 설정에 자동으로 들어갔어요. 이 설정들은 따로 확정할 필요가 없어요.' },
  { title: '자동 반영에서도 불분명한 설정은 직접 확인해요', description: '“그”가 누구인지 불분명한 치유 능력 1개만 남았어요. 원문과 대상을 확인해 확정하면 돼요.' },
  { title: '남은 설정을 확정하면 검토가 끝나요', description: '직접 확인이 필요한 설정까지 확정한 뒤의 예시예요. 총 3개가 반영되고, 직접 확인할 설정은 0개가 됐어요.' },
];

export function AnalysisModeGuideDialog({ step, onStepChange, onClose, multiple }: {
  step: number;
  onStepChange: (step: number) => void;
  onClose: () => void;
  multiple: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    // 한 줄 단계 바 안에서만 활성 단계를 드러내고 문서의 스크롤은 움직이지 않는다.
    const bar = stepsRef.current;
    const item = bar?.querySelector<HTMLElement>('[aria-current="step"]');
    if (bar && item) bar.scrollTo({ left: Math.max(0, item.offsetLeft - (bar.clientWidth - item.clientWidth) / 2) });
  }, [step]);
  const handleKeys = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      onStepChange(Math.max(0, Math.min(4, step + (event.key === 'ArrowRight' ? 1 : -1))));
    }
  };
  return <WorldSettingDialog title="설정이 반영되는 과정을 살펴보세요"
    description="실제 화면에 예시 데이터를 넣었어요. 이전·다음으로 흐름을 살펴보세요."
    className="analysis-mode-guide" onClose={onClose} onKeyDown={handleKeys}>
    <div className="analysis-mode-guide__layout">
      <nav ref={stepsRef} className="analysis-mode-guide__steps" aria-label="안내 단계">
        {STEPS.map((label, index) => <button type="button" key={label} aria-current={step === index ? 'step' : undefined}
          onClick={() => onStepChange(index)}><span>{index + 1}</span>{label}</button>)}
      </nav>
      <div ref={scrollRef} className="analysis-mode-guide__scroll" role="region" aria-label="단계별 예시" tabIndex={0}>
        <div className="analysis-mode-guide__intro" aria-live="polite">
          <span className="analysis-mode-guide__eyebrow">{step + 1} / 5 · {STEPS[step]}</span>
          <h3>{SCENES[step].title}</h3>
          <p>{SCENES[step].description}</p>
          {multiple && step < 2 && <p className="analysis-mode-guide__multiple">직접 검토 선택은 단일 회차에서 제공돼요. 지금 선택한 다회차 업로드는 자동 반영으로 진행돼요.</p>}
        </div>
        <div className="analysis-mode-guide__example-label">예시 화면 · 버튼을 누르지 않고 흐름만 살펴보세요.</div>
        <AnalysisGuidePreview step={step} />
      </div>
      <div className="analysis-mode-guide__footer">
        <button type="button" className="database-button" disabled={step === 0} onClick={() => onStepChange(step - 1)}><ArrowLeft size={16} aria-hidden="true" /> 이전</button>
        <button type="button" className="analysis-mode-guide__restart" aria-label="예시 처음부터 다시 보기" onClick={() => onStepChange(0)}><RotateCcw size={16} aria-hidden="true" /><span>처음부터</span></button>
        {step < 4 ? <button type="button" className="database-button is-primary" onClick={() => onStepChange(step + 1)}>다음 <ArrowRight size={16} aria-hidden="true" /></button>
          : <button type="button" className="database-button is-primary" onClick={onClose}>알겠어요</button>}
      </div>
    </div>
  </WorldSettingDialog>;
}
