import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import S1Dashboard from './components/catchhole/S1Dashboard';
import S2Editor from './components/catchhole/S2Editor';
import S4Loading from './components/catchhole/S4Loading';
import S5Report from './components/catchhole/S5Report';
import { ScreenId, TransitionType, NavigateFn } from './components/catchhole/constants';

type TransitionConfig = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initial: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  animate: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exit: any;
  duration: number;
};

const TRANSITIONS: Record<TransitionType, TransitionConfig> = {
  'push-right': {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '-8%', opacity: 0 },
    duration: 0.3,
  },
  'push-left': {
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '8%', opacity: 0 },
    duration: 0.3,
  },
  'cover-up': {
    initial: { y: '6%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { opacity: 0 },
    duration: 0.25,
  },
  'pop': {
    initial: { x: '-6%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '100%' },
    duration: 0.3,
  },
  'dissolve': {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    duration: 0.35,
  },
};

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('S1');
  const [transitionType, setTransitionType] = useState<TransitionType>('push-right');
  const [reportMode, setReportMode] = useState<'single' | 'prePublish'>('single');

  const navigate: NavigateFn = useCallback((to: ScreenId, transition: TransitionType) => {
    setTransitionType(transition);
    setScreen(to);
  }, []);

  const navigateToPrePublish = useCallback(() => {
    setReportMode('prePublish');
    setTransitionType('push-right');
    setScreen('S5');
  }, []);

  const config = TRANSITIONS[transitionType];

  return (
    <div
      style={{
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, sans-serif",
        background: '#0F0F13',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      } as React.CSSProperties}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={config.initial}
          animate={config.animate}
          exit={config.exit}
          transition={{ duration: config.duration, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {screen === 'S1' && <S1Dashboard navigate={navigate} onPrePublish={navigateToPrePublish} />}
          {screen === 'S2' && <S2Editor navigate={navigate} />}
          {screen === 'S4' && <S4Loading navigate={navigate} />}
          {screen === 'S5' && <S5Report navigate={navigate} mode={reportMode} onModeReset={() => setReportMode('single')} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
