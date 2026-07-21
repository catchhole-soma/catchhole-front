import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import { AppContextProvider } from './context/AppContext';
import { BackendStatusProvider } from './context/BackendStatusContext';
import SLogin from './components/catchhole/SLogin';
import SSignup from './components/catchhole/SSignup';
import SLanding from './components/catchhole/SLanding';
import S0WorkPicker from './components/catchhole/S0WorkPicker';
import S1Dashboard from './components/catchhole/S1Dashboard';
import S2Editor from './components/catchhole/S2Editor';
import S3Chat from './components/catchhole/S3Chat';
import S4Loading from './components/catchhole/S4Loading';
import S5Report from './components/catchhole/S5Report';
import SEpisodeUpload from './components/catchhole/SEpisodeUpload';
import SSettingReview from './components/catchhole/SSettingReview';
import SEpisodeValidationReport from './components/catchhole/SEpisodeValidationReport';
import { TransitionType } from './components/catchhole/constants';
import { getMeOptions } from './api/generated/@tanstack/react-query.gen';
import { clearAuthSession } from './lib/auth';
import { getAccessToken } from './lib/api-config';
import { NetworkError } from './lib/api-errors';
import { isDemoMode } from './lib/worksApi';
import { TermsModal } from './components/catchhole/TermsModal';
import { usePublicModalNavigation } from './hooks/usePublicModalNavigation';

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
  const demoMode = isDemoMode();
  const hasAccessToken = Boolean(getAccessToken());
  const session = useQuery({
    ...getMeOptions(),
    enabled: hasAccessToken && !demoMode,
    retry: false,
    staleTime: 60_000,
  });
  const isNetworkFailure = session.error instanceof NetworkError;

  useEffect(() => {
    if (session.isError && !isNetworkFailure && !demoMode) clearAuthSession();
  }, [demoMode, isNetworkFailure, session.isError]);

  if (demoMode) {
    return <Outlet />;
  }

  if (!hasAccessToken || (session.isError && !isNetworkFailure)) {
    return <Navigate to="/login" replace />;
  }

  if (session.isPending || isNetworkFailure) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0F0F13', color: '#A0A0AD', fontSize: 13,
      }}>
        {isNetworkFailure ? '인증 서버에 연결할 수 없습니다.' : '인증 확인 중...'}
      </div>
    );
  }

  return <Outlet />;
}

function RootRoute() {
  const token = getAccessToken();
  return <Navigate to={token ? '/works' : '/landing'} replace />;
}

function PublicLayout() {
  const location = useLocation();
  const backgroundRef = useRef<HTMLDivElement>(null);
  const { closeTerms, termsTab } = usePublicModalNavigation();
  const authModalOpen = location.pathname === '/login' || location.pathname === '/signup';
  const backgroundInactive = authModalOpen || Boolean(termsTab);

  useEffect(() => {
    if (backgroundInactive) backgroundRef.current?.setAttribute('inert', '');
    else backgroundRef.current?.removeAttribute('inert');
  }, [backgroundInactive]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={backgroundRef}
        aria-hidden={backgroundInactive ? true : undefined}
        style={{ width: '100%', height: '100%' }}
      >
        <SLanding />
      </div>
      <Outlet />
      <AnimatePresence>
        {termsTab && <TermsModal onClose={closeTerms} initialTab={termsTab} />}
      </AnimatePresence>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const transition = ((location.state as Record<string, unknown>)?.transition as TransitionType) ?? 'dissolve';
  const config = TRANSITIONS[transition] ?? TRANSITIONS.dissolve;
  const routeKey = ['/landing', '/login', '/signup'].includes(location.pathname)
    ? 'public-auth'
    : location.pathname;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        initial={config.initial}
        animate={config.animate}
        exit={config.exit}
        transition={{ duration: config.duration, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <Routes location={location}>
          <Route path="/" element={<RootRoute />} />
          <Route element={<PublicLayout />}>
            <Route path="/landing" element={null} />
            <Route path="/login" element={<SLogin />} />
            <Route path="/signup" element={<SSignup />} />
          </Route>
          <Route element={<PrivateRoute />}>
            <Route path="/works" element={<S0WorkPicker />} />
            <Route path="/dashboard" element={<S1Dashboard />} />
            <Route path="/editor" element={<S2Editor />} />
            <Route path="/chat" element={<S3Chat />} />
            <Route path="/loading" element={<S4Loading />} />
            <Route path="/report" element={<S5Report />} />
            <Route path="/episode-upload" element={<SEpisodeUpload />} />
            <Route path="/setting-review" element={<SSettingReview />} />
            <Route path="/episode-validation-report" element={<SEpisodeValidationReport />} />
          </Route>
          <Route path="*" element={<Navigate to="/landing" replace />} />
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
        <BackendStatusProvider>
          <AnimatedRoutes />
        </BackendStatusProvider>
      </AppContextProvider>
    </div>
  );
}
