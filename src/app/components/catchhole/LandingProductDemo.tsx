import { useEffect, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Pause, Play } from 'lucide-react';
import { LANDING_DEMO_STEPS } from './LandingDemoScenes';
import { BrandLogo } from './ui-v2/BrandLogo';

const DEMO_STEP_DURATION = 3000;

export function LandingProductDemo() {
  const reduceMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const isAutoPaused = manuallyPaused || hovered || focusWithin || Boolean(reduceMotion);

  useEffect(() => {
    if (isAutoPaused) return undefined;

    const timer = window.setTimeout(() => {
      setActiveStep(current => (current + 1) % LANDING_DEMO_STEPS.length);
    }, DEMO_STEP_DURATION);

    return () => window.clearTimeout(timer);
  }, [activeStep, isAutoPaused]);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setFocusWithin(false);
    }
  };

  const focusStep = (index: number) => {
    setActiveStep(index);
    window.requestAnimationFrame(() => {
      document.getElementById(`landing-demo-tab-${index}`)?.focus();
    });
  };

  const handleStepKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % LANDING_DEMO_STEPS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + LANDING_DEMO_STEPS.length) % LANDING_DEMO_STEPS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = LANDING_DEMO_STEPS.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      focusStep(nextIndex);
    }
  };

  return (
    <div
      className="landing-demo-accordion"
      aria-label="CatchHole 실제 서비스 화면으로 보는 작품 설정 관리 흐름"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={handleBlur}
    >
      <div className="landing-demo-accordion__track" role="tablist" aria-label="데모 단계 선택">
        {LANDING_DEMO_STEPS.map((step, index) => {
          const isActive = activeStep === index;
          return (
            <section
              className={`landing-demo-panel${isActive ? ' is-active' : ''}`}
              key={step.label}
              onMouseEnter={() => setActiveStep(index)}
            >
              <button
                type="button"
                role="tab"
                id={`landing-demo-tab-${index}`}
                aria-controls={`landing-demo-panel-${index}`}
                aria-selected={isActive}
                aria-label={`${index + 1}단계 ${step.label}`}
                className="landing-demo-panel__trigger"
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveStep(index)}
                onFocus={() => setActiveStep(index)}
                onKeyDown={event => handleStepKeyDown(event, index)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{step.shortLabel}</strong>
              </button>

              <div
                className="landing-demo-panel__content"
                id={`landing-demo-panel-${index}`}
                role="tabpanel"
                aria-hidden={!isActive}
                aria-labelledby={`landing-demo-tab-${index}`}
              >
                <div className="landing-demo__topbar">
                  <div className="landing-demo__current">
                    <BrandLogo alt="CatchHole" />
                    <i />
                    <strong>{step.label}</strong>
                  </div>
                  <div className="landing-demo__controls">
                    <span>{index + 1} / {LANDING_DEMO_STEPS.length}</span>
                    {isActive && (
                      <button
                        type="button"
                        className="landing-demo__play"
                        aria-label={manuallyPaused ? '자동 재생 시작' : '자동 재생 일시정지'}
                        onClick={() => setManuallyPaused(current => !current)}
                        disabled={Boolean(reduceMotion)}
                      >
                        {manuallyPaused ? <Play size={13} /> : <Pause size={13} />}
                      </button>
                    )}
                    <b aria-hidden="true">K</b>
                  </div>
                </div>

                <div className="landing-demo__viewport">
                  {isActive && (
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.figure
                        className="landing-demo__native-stage"
                        key={activeStep}
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.4, 0, 0.2, 1] }}
                      >
                        {step.scene}
                      </motion.figure>
                    </AnimatePresence>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
