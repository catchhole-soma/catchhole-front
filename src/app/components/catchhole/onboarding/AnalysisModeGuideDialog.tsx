import { useState, type KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, CircleHelp, FileText, RotateCcw } from 'lucide-react';
import { WorldSettingDialog } from '../worldsetting/WorldSettingDialog';
import './analysis-mode-guide.css';

const STEPS = ['원고', '분석 결과', '직접 확인', '저장 결과'];
type Mode = 'automatic' | 'manual';
const EXAMPLE_SETTINGS = [
  { subject: '레온', name: '종족', value: '엘프' },
  { subject: '은빛숲', name: '위치', value: '왕국 북부' },
  { subject: '대상 미확인', name: '능력', value: '상처 치유' },
];

export function AnalysisModeGuideDialog({ step, onStepChange, onClose, multiple }: {
  step: number; onStepChange: (step: number) => void; onClose: () => void; multiple: boolean;
}) {
  const [mobileMode, setMobileMode] = useState<Mode>('automatic');
  const [confirmed, setConfirmed] = useState<Record<Mode, boolean>>({ automatic: false, manual: false });
  const [targets, setTargets] = useState<Record<Mode, string>>({ automatic: '', manual: '' });
  const modes: Mode[] = multiple ? ['automatic'] : ['automatic', 'manual'];
  const handleKeys = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      || (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [role="tablist"], [contenteditable="true"]'))) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      onStepChange(Math.max(0, Math.min(3, step + (event.key === 'ArrowRight' ? 1 : -1))));
    }
  };
  return <WorldSettingDialog title={multiple ? '자동 반영 과정을 살펴볼까요?' : '설정은 언제 작품에 저장될까요?'}
    description="예시 원고로 확인해 보세요. 실제 작품에는 저장되지 않아요."
    className="analysis-mode-guide" onClose={onClose} onKeyDown={handleKeys}>
    <div className="analysis-mode-guide__layout">
      <nav className="analysis-mode-guide__steps" aria-label="안내 단계">
        {STEPS.map((label, index) => <button type="button" key={label} aria-current={step === index ? 'step' : undefined}
          onClick={() => onStepChange(index)}><span>{index + 1}</span>{label}</button>)}
      </nav>
      <div className="analysis-mode-guide__scroll">
        <div className="analysis-mode-guide__intro" aria-live="polite">
          <span className="analysis-mode-guide__eyebrow">{step + 1} / 4 · {STEPS[step]}</span>
          <h3>{['같은 원고에서 출발해요', '저장되는 시점이 달라요', '확정 버튼을 직접 눌러 보세요', '작품에 남는 내용을 확인해요'][step]}</h3>
          <p>{[
            '캐릭터와 세계관 설정 3개를 발견한 상황을 살펴볼게요.',
            multiple ? '명확한 설정은 자동 저장되고, 확인이 필요한 내용은 남겨 둬요.' : '자동 반영은 명확한 설정부터 저장하고, 직접 검토는 모든 설정을 기다려요.',
            '“그”가 누구인지 원고를 확인한 뒤 대상을 선택해 보세요.',
            '아직 확정하지 않은 설정은 작품에 저장되지 않고 직접 확인할 목록에 남아요.',
          ][step]}</p>
        </div>
        {step === 0 ? <>
          <article className="analysis-mode-guide__manuscript">
            <span><FileText size={16} aria-hidden="true" /> 예시 원고 · 1화</span>
            <p><mark>레온은 엘프였다.</mark><br /><mark>은빛숲은 왕국 북부에 있었다.</mark></p>
            <p>레온과 유나가 동굴에 들어섰다.<br /><mark className="is-unclear">그는 손끝으로 상처를 아물게 했다.</mark></p>
          </article>
          <p className="analysis-mode-guide__hint"><CircleHelp size={17} aria-hidden="true" /> 마지막 문장의 능력을 누구에게 연결할지 확인이 필요한 예시예요.</p>
        </> : <>
          {!multiple && <div className="analysis-mode-guide__mobile-modes" role="tablist" aria-label="비교할 반영 방식">
            {modes.map(mode => <button type="button" role="tab" aria-selected={mobileMode === mode} key={mode}
              onClick={() => setMobileMode(mode)} onKeyDown={event => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                setMobileMode(mode === 'automatic' ? 'manual' : 'automatic');
                const sibling = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[aria-selected="false"]`);
                sibling?.focus();
              }}>{mode === 'automatic' ? '자동 반영' : '직접 검토'}</button>)}
          </div>}
          <div className={`analysis-mode-guide__comparison${multiple ? ' is-single' : ''}`}>
            {modes.map(mode => {
              const saved = step > 1 && confirmed[mode] ? 3 : mode === 'automatic' ? 2 : 0;
              return <section key={mode} aria-label={mode === 'automatic' ? '자동 반영 예시' : '직접 검토 예시'}
                className={`analysis-mode-guide__panel${!multiple && mobileMode !== mode ? ' is-mobile-hidden' : ''}`}>
                <div className="analysis-mode-guide__panel-heading"><strong>{mode === 'automatic' ? 'AI 판단으로 자동 반영' : '모든 설정 직접 검토'}</strong>
                  <small>{mode === 'automatic' ? '명확한 내용은 먼저 저장해요' : '내가 확정한 뒤 저장해요'}</small></div>
                <div className="analysis-mode-guide__counts" aria-live="polite">
                  <span className="is-saved">반영됨 <b>{saved}</b></span><span>직접 확인 <b>{3 - saved}</b></span>
                </div>
                <ul className="analysis-mode-guide__settings">
                  {EXAMPLE_SETTINGS.map((setting, index) => {
                    const isSaved = saved === 3 || mode === 'automatic' && index < 2;
                    return <li key={setting.name}><div><strong>{index === 2 && saved === 3 ? targets[mode] : setting.subject}</strong>
                      <span>{setting.name} · {setting.value}</span></div>
                      <span className={isSaved ? 'analysis-mode-guide__status is-saved' : 'analysis-mode-guide__status'}>
                        {isSaved ? <><CheckCircle2 size={13} aria-hidden="true" /> 저장됨</> : '확인 필요'}</span></li>;
                  })}
                </ul>
                {step === 2 && !confirmed[mode] && <div className="analysis-mode-guide__practice">
                  <label>치유 능력의 대상<select value={targets[mode]} onChange={event => setTargets({ ...targets, [mode]: event.target.value })}>
                    <option value="">대상 선택</option><option value="레온">레온</option><option value="유나">유나</option>
                  </select></label>
                  <button type="button" className="database-button is-primary" disabled={!targets[mode]}
                    onClick={() => setConfirmed({ ...confirmed, [mode]: true })}>
                    {mode === 'automatic' ? '남은 설정 1개 확정해 보기' : '확인한 설정 3개 확정해 보기'}</button>
                </div>}
                {step > 1 && confirmed[mode] && <p className="analysis-mode-guide__saved" role="status"><CheckCircle2 size={16} aria-hidden="true" /> 예시 설정을 모두 확정했어요.</p>}
                {step === 3 && saved < 3 && <button type="button" className="database-button" onClick={() => onStepChange(2)}>남은 설정 확인해 보기</button>}
              </section>;
            })}
          </div>
          {step === 1 && <p className="analysis-mode-guide__hint">다음 단계에서 대상을 선택하고 확정해 볼 수 있어요.</p>}
          {step === 3 && <p className="analysis-mode-guide__hint">이미 반영된 설정은 작품의 캐릭터·세계관 설정 화면에서 확인하고 수정할 수 있어요.</p>}
        </>}
        {multiple && <p className="analysis-mode-guide__hint">여러 회차는 앞 회차의 설정을 자동 저장한 뒤 다음 회차를 분석해요. 직접 확인할 항목은 분석 후 살펴볼 수 있어요.</p>}
      </div>
      <div className="analysis-mode-guide__footer">
        <button type="button" className="database-button" disabled={step === 0} onClick={() => onStepChange(step - 1)}><ArrowLeft size={16} aria-hidden="true" /> 이전</button>
        <button type="button" className="analysis-mode-guide__restart" aria-label="예시 처음부터 다시 보기" onClick={() => {
          setConfirmed({ automatic: false, manual: false }); setTargets({ automatic: '', manual: '' }); onStepChange(0);
        }}><RotateCcw size={16} aria-hidden="true" /><span>처음부터</span></button>
        {step < 3 ? <button type="button" className="database-button is-primary" onClick={() => onStepChange(step + 1)}>다음 <ArrowRight size={16} aria-hidden="true" /></button>
          : <button type="button" className="database-button is-primary" onClick={onClose}>알겠어요</button>}
      </div>
    </div>
  </WorldSettingDialog>;
}
