import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { WorldSettingDialog } from '../worldsetting/WorldSettingDialog';
import { GUIDE_SCREENS, type GuideMode } from './analysis-guide-screens';
import './analysis-mode-guide.css';

const STEPS = ['반영 방식', '분석 결과', '검토 화면', '확정 후'];
const MODES: GuideMode[] = ['automatic', 'manual'];
const MODE_LABELS = { automatic: 'AI 판단으로 설정 자동 반영', manual: '모든 설정 직접 검토' };
const SCENES = {
  automatic: [
    { title: '명확한 설정은 AI가 먼저 반영해요', description: '분석 전에 자동 반영을 선택한 화면이에요. 확인이 필요한 설정만 나중에 직접 검토해요.', alt: '설정 반영 방식에서 AI 판단으로 설정 자동 반영을 선택한 실제 업로드 화면.' },
    { title: '명확한 2개는 저장되고, 미확인 1개만 남아요', description: '레온의 종족·직업은 이미 반영됐어요. 누구의 치유 능력인지 확인할 1개만 미처리 목록에 보여요.', alt: '실제 검토 목록: 반영됨 2개, 제외됨 0개, 직접 확인 1개. 미처리 목록에는 치유 능력 1개만 표시된다.' },
    { title: '남은 1개만 원문과 대상을 확인해요', description: '원문에서 “그”가 누구인지 확인하고 캐릭터를 연결하는 화면이에요. 이미 저장된 종족·직업은 다시 확정할 필요가 없어요.', alt: '실제 캐릭터 검토 상세: 치유 능력 1개, 원문 근거와 캐릭터 연결 확인, 1개 설정을 함께 확정하는 영역.' },
    { title: '남은 1개까지 확정하면 검토가 끝나요', description: '치유 능력의 대상을 직접 확인해 확정한 뒤의 예시예요. 총 3개가 반영되고 직접 확인할 설정은 0개가 돼요.', alt: '실제 검토 완료 화면: 반영됨 3개, 직접 확인 0개. 모든 설정 후보 검토를 완료했으며 원고 목록으로 이동할 수 있다.' },
  ],
  manual: [
    { title: '모든 설정을 내가 확인한 뒤 반영해요', description: '분석 전에 직접 검토를 선택한 화면이에요. AI 판단이 명확해도 내가 확정하기 전에는 작품에 저장되지 않아요.', alt: '설정 반영 방식에서 모든 설정 직접 검토를 선택한 실제 업로드 화면.' },
    { title: '아직 저장된 설정 없이, 3개 모두 남아요', description: '레온의 종족·직업·치유 능력이 모두 미처리 목록에 있어요. 명확한 설정도 직접 살펴보고 확정해야 해요.', alt: '실제 검토 목록: 반영됨 0개, 제외됨 0개, 직접 확인 3개. 종족, 직업, 치유 능력이 모두 검토 대상이다.' },
    { title: '3개 설정을 모두 살펴보고 확정해요', description: '각 설정의 원문과 AI 비교 결과를 확인해요. 모호한 대상도 연결한 다음, 같은 캐릭터의 설정을 함께 확정할 수 있어요.', alt: '실제 캐릭터 검토 상세: 종족 엘프, 직업 정찰병, 치유 능력의 원문 근거와 판단 결과. 3개 설정을 함께 확정하는 영역.' },
    { title: '모두 직접 확정한 뒤 3개가 저장돼요', description: '3개 설정을 확인하고 확정한 뒤의 예시예요. 자동 반영과 최종 결과는 같지만, 저장 전에 확인하는 범위가 달라요.', alt: '실제 검토 완료 화면: 반영됨 3개, 직접 확인 0개. 모든 설정 후보 검토를 완료했으며 원고 목록으로 이동할 수 있다.' },
  ],
};

function ScreenPreview({ mode, step }: { mode: GuideMode; step: number }) {
  const [failed, setFailed] = useState(false);
  const screen = GUIDE_SCREENS[mode][step];
  return failed ? <p className="analysis-mode-guide__image-error" role="status">예시 화면을 불러오지 못했어요. 위 설명을 확인하거나 다른 단계로 이동해 주세요.</p> : (
    <picture className={`analysis-mode-guide__picture${step === 0 ? ' is-choice' : ''}${step === 2 ? ' is-detail' : ''}`}>
      <source media="(max-width: 600px)" srcSet={screen.mobile} />
      <img src={screen.desktop} alt={SCENES[mode][step].alt} draggable={false} onError={() => setFailed(true)} />
    </picture>
  );
}

export function AnalysisModeGuideDialog({ step, onStepChange, onClose, multiple, mode, onModeChange }: {
  step: number;
  onStepChange: (step: number) => void;
  onClose: () => void;
  multiple: boolean;
  mode: GuideMode;
  onModeChange: (mode: GuideMode) => void;
}) {
  const id = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeMode = multiple ? 'automatic' : mode;
  const scene = SCENES[activeMode][step];
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [activeMode, step]);
  const handleKeys = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      || (event.target instanceof HTMLElement && event.target.closest('[role="tablist"]'))) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      onStepChange(Math.max(0, Math.min(3, step + (event.key === 'ArrowRight' ? 1 : -1))));
    }
  };
  return <WorldSettingDialog title={multiple ? '자동 반영 과정을 살펴볼까요?' : '설정 반영 방식을 비교해 보세요'}
    description="실제 서비스 화면에 예시 데이터를 넣었어요. 이전·다음으로 흐름을 살펴보세요."
    className="analysis-mode-guide" onClose={onClose} onKeyDown={handleKeys}>
    <div className="analysis-mode-guide__layout">
      <nav className="analysis-mode-guide__steps" aria-label="안내 단계">
        {STEPS.map((label, index) => <button type="button" key={label} aria-current={step === index ? 'step' : undefined}
          onClick={() => onStepChange(index)}><span>{index + 1}</span>{label}</button>)}
      </nav>
      {!multiple && <div className="analysis-mode-guide__modes" role="tablist" aria-label="비교할 반영 방식">
        {MODES.map(item => <button type="button" role="tab" id={`${id}-${item}`} aria-selected={activeMode === item}
          aria-controls={`${id}-screen`} tabIndex={activeMode === item ? 0 : -1} key={item}
          onClick={() => onModeChange(item)} onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 'automatic' : event.key === 'End' ? 'manual' : item === 'automatic' ? 'manual' : 'automatic';
            onModeChange(next);
            document.getElementById(`${id}-${next}`)?.focus();
          }}>{MODE_LABELS[item]}</button>)}
      </div>}
      <div ref={scrollRef} className="analysis-mode-guide__scroll" id={`${id}-screen`}
        role={multiple ? 'region' : 'tabpanel'} aria-labelledby={multiple ? undefined : `${id}-${activeMode}`}
        aria-label={multiple ? '자동 반영 예시' : undefined} tabIndex={0}>
        <div className="analysis-mode-guide__intro" aria-live="polite">
          <span className="analysis-mode-guide__eyebrow">{step + 1} / 4 · {STEPS[step]}</span>
          <h3>{scene.title}</h3>
          <p>{scene.description}</p>
          {multiple && <p className="analysis-mode-guide__multiple">여러 회차는 앞 회차의 설정을 자동 저장한 뒤 다음 회차를 분석해요. 확인할 항목은 분석 후 살펴볼 수 있어요.</p>}
        </div>
        <figure className="analysis-mode-guide__screen">
          <figcaption>예시 화면 · 화면 속 버튼을 누르지 않아도 돼요.</figcaption>
          <ScreenPreview key={`${activeMode}-${step}`} mode={activeMode} step={step} />
        </figure>
      </div>
      <div className="analysis-mode-guide__footer">
        <button type="button" className="database-button" disabled={step === 0} onClick={() => onStepChange(step - 1)}><ArrowLeft size={16} aria-hidden="true" /> 이전</button>
        <button type="button" className="analysis-mode-guide__restart" aria-label="예시 처음부터 다시 보기" onClick={() => onStepChange(0)}><RotateCcw size={16} aria-hidden="true" /><span>처음부터</span></button>
        {step < 3 ? <button type="button" className="database-button is-primary" onClick={() => onStepChange(step + 1)}>다음 <ArrowRight size={16} aria-hidden="true" /></button>
          : <button type="button" className="database-button is-primary" onClick={onClose}>알겠어요</button>}
      </div>
    </div>
  </WorldSettingDialog>;
}
