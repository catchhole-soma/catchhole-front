import React from 'react';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import { AppContextProvider } from './context/AppContext';
import SLogin from './components/catchhole/SLogin';
import SSignup from './components/catchhole/SSignup';
import S0WorkPicker from './components/catchhole/S0WorkPicker';
import S1Dashboard from './components/catchhole/S1Dashboard';
import S2Editor from './components/catchhole/S2Editor';
import S3Chat from './components/catchhole/S3Chat';
import S4Loading from './components/catchhole/S4Loading';
import S5Report from './components/catchhole/S5Report';
import { TransitionType } from './components/catchhole/constants';

type TransitionConfig = {
  initial: HTMLMotionProps<'div'>['initial'];
  animate: HTMLMotionProps<'div'>['animate'];
  exit: HTMLMotionProps<'div'>['exit'];
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

function PrivateRoute() {
  const token = localStorage.getItem('token');
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

function AnimatedRoutes() {
  const location = useLocation();
  const transition = ((location.state as Record<string, unknown>)?.transition as TransitionType) ?? 'dissolve';
  const config = TRANSITIONS[transition] ?? TRANSITIONS.dissolve;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={config.initial}
        animate={config.animate}
        exit={config.exit}
        transition={{ duration: config.duration, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <Routes location={location}>
          <Route path="/login" element={<SLogin />} />
          <Route path="/signup" element={<SSignup />} />
          <Route element={<PrivateRoute />}>
            <Route path="/" element={<S0WorkPicker />} />
            <Route path="/dashboard" element={<S1Dashboard />} />
            <Route path="/editor" element={<S2Editor />} />
            <Route path="/chat" element={<S3Chat />} />
            <Route path="/loading" element={<S4Loading />} />
            <Route path="/report" element={<S5Report />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
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
      <AppContextProvider>
        <AnimatedRoutes />
      </AppContextProvider>
    </div>
  );
}
