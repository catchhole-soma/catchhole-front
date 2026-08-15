import { useEffect, useState } from 'react';
import type { FocusEvent } from 'react';
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
  const activeScene = LANDING_DEMO_STEPS[activeStep];

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

  return (
    <div
      className="landing-chart landing-demo-shell"
      aria-label="CatchHole 실제 서비스 화면으로 보는 작품 설정 관리 흐름"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={handleBlur}
    >
      <div className="landing-demo">
        <div className="landing-demo__topbar">
          <div className="landing-demo__current">
            <BrandLogo alt="CatchHole" />
            <i />
            <strong>{activeScene.label}</strong>
          </div>
          <div className="landing-demo__controls">
            <span>{activeStep + 1} / {LANDING_DEMO_STEPS.length}</span>
            <button
              type="button"
              className="landing-demo__play"
              aria-label={manuallyPaused ? '자동 재생 시작' : '자동 재생 일시정지'}
              onClick={() => setManuallyPaused(current => !current)}
              disabled={Boolean(reduceMotion)}
            >
              {manuallyPaused ? <Play size={13} /> : <Pause size={13} />}
            </button>
            <b aria-hidden="true">K</b>
          </div>
        </div>

        <div className="landing-demo__viewport">
          <AnimatePresence mode="wait" initial={false}>
            <motion.figure
              className="landing-demo__native-stage"
              key={activeStep}
              initial={reduceMotion ? false : { opacity: 0, scale: 1.012 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.994 }}
              transition={{ duration: reduceMotion ? 0 : 0.42, ease: 'easeOut' }}
            >
              {activeScene.scene}
            </motion.figure>
          </AnimatePresence>
        </div>

        <div className="landing-demo__steps" role="tablist" aria-label="데모 단계 선택">
          {LANDING_DEMO_STEPS.map((step, index) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeStep === index}
              aria-label={`${index + 1}단계 ${step.label}`}
              className={activeStep === index ? 'is-active' : ''}
              key={step.label}
              onClick={() => setActiveStep(index)}
            >
              <span>{index + 1}</span>
              {step.shortLabel}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
