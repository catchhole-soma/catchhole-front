import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Routes, Route, Navigate, useLocation, Outlet } from 'react-router';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import { AppContextProvider } from './context/AppContext';
import { BackendStatusProvider } from './context/BackendStatusContext';
import SLogin from './components/catchhole/SLogin';
import SSignup from './components/catchhole/SSignup';
import SLanding from './components/catchhole/SLanding';
import SInteractiveDemo from './components/catchhole/SInteractiveDemo';
import S0WorkPicker from './components/catchhole/S0WorkPicker';
import S1Dashboard from './components/catchhole/S1Dashboard';
import S2Editor from './components/catchhole/S2Editor';
import SEpisodeUpload from './components/catchhole/SEpisodeUpload';
import SSettingReview from './components/catchhole/SSettingReview';
import { C, TransitionType } from './components/catchhole/constants';
import { getMeOptions } from './api/generated/@tanstack/react-query.gen';
import { clearAuthSession } from './lib/auth';
import { getAccessToken } from './lib/api-config';
import { NetworkError, toApiError } from './lib/api-errors';
import { TermsModal } from './components/catchhole/TermsModal';
import { usePublicModalNavigation } from './hooks/usePublicModalNavigation';
import { AiTokenQuotaModal } from './components/catchhole/AiTokenQuotaModal';
import { LegalDocumentPage } from './components/catchhole/LegalDocumentPage';

type TransitionConfig = {
  initial: HTMLMotionProps<'div'>['initial'];
  animate: HTMLMotionProps<'div'>['animate'];
  duration: number;
};

const TRANSITIONS: Record<TransitionType, TransitionConfig> = {
  'push-right': {
    initial: { x: '100%' },
    animate: { x: 0 },
    duration: 0.3,
  },
  'push-left': {
    initial: { x: '-100%' },
    animate: { x: 0 },
    duration: 0.3,
  },
  'cover-up': {
    initial: { y: '6%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
    duration: 0.25,
  },
  'pop': {
    initial: { x: '-6%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    duration: 0.3,
  },
  'dissolve': {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    duration: 0.35,
  },
};

function PrivateRoute() {
  const hasAccessToken = Boolean(getAccessToken());
  const session = useQuery({
    ...getMeOptions(),
    enabled: hasAccessToken,
    retry: false,
    staleTime: 60_000,
  });
  const isNetworkFailure = session.error instanceof NetworkError;
  const isAuthenticationFailure = session.isError && toApiError(session.error)?.status === 401;

  useEffect(() => {
    if (isAuthenticationFailure) clearAuthSession();
  }, [isAuthenticationFailure]);

  if (!hasAccessToken || isAuthenticationFailure) {
    return <Navigate to="/login" replace />;
  }

  if (session.isPending) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: C.bg, color: C.t2, fontSize: 13,
      }}>
        인증 확인 중...
      </div>
    );
  }

  if (session.isError) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: 12,
        alignItems: 'center', justifyContent: 'center', background: C.bg, color: C.t2, fontSize: 13,
      }}>
        <div style={{ color: C.t1, fontSize: 15, fontWeight: 700 }}>
          {isNetworkFailure ? '인증 서버에 연결할 수 없습니다.' : '인증 정보를 확인하지 못했습니다.'}
        </div>
        <div>잠시 후 다시 시도해 주세요.</div>
        <button
          type="button"
          onClick={() => void session.refetch()}
          disabled={session.isFetching}
          style={{
            height: 36, padding: '0 16px', borderRadius: 6, border: `1px solid ${C.border}`,
            background: C.surface, color: C.t1, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            cursor: session.isFetching ? 'default' : 'pointer', opacity: session.isFetching ? 0.6 : 1,
          }}
        >
          {session.isFetching ? '다시 시도 중...' : '다시 시도'}
        </button>
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

  // 설정 검토는 URL query를 버튼 상태로 사용하고 상세에 sticky/scroll 영역이 많다.
  // 이 화면을 transform 합성 레이어 안에 두면 Safari/WebKit에서 query 변경 뒤 화면이
  // 사라지거나 Chromium에서 hit testing이 잠시 멈추는 경우가 있어 정적 레이어로 렌더링한다.
  if (location.pathname === '/setting-review') {
    return <StaticRouteLayer key={routeKey} location={location} />;
  }

  // 전체 페이지는 이전 화면을 DOM에 남기지 않고 즉시 교체한다. 진입 애니메이션만
  // 유지해, 폴링 중이던 검토 화면이 뒤로가기 후 클릭을 가로채는 여지를 없앤다.
  return <AnimatedRouteLayer key={routeKey} location={location} config={config} />;
}

function StaticRouteLayer({
  location,
}: {
  location: ReturnType<typeof useLocation>;
}) {
  return (
    <div
      className="app-route-layer app-route-layer--static"
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        background: C.bg,
      }}
    >
      <AppRoutes location={location} />
    </div>
  );
}

function AnimatedRouteLayer({
  location,
  config,
}: {
  location: ReturnType<typeof useLocation>;
  config: TransitionConfig;
}) {
  return (
    <motion.div
      className="app-route-layer app-route-layer--animated"
      initial={config.initial}
      animate={config.animate}
      transition={{ duration: config.duration, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
      }}
    >
      <AppRoutes location={location} />
    </motion.div>
  );
}

function AppRoutes({ location }: { location: ReturnType<typeof useLocation> }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<RootRoute />} />
      <Route element={<PublicLayout />}>
        <Route path="/landing" element={null} />
        <Route path="/login" element={<SLogin />} />
        <Route path="/signup" element={<SSignup />} />
      </Route>
      <Route path="/demo" element={<SInteractiveDemo />} />
      <Route path="/terms" element={<LegalDocumentPage type="terms" />} />
      <Route path="/privacy" element={<LegalDocumentPage type="privacy" />} />
      <Route element={<PrivateRoute />}>
        <Route path="/works" element={<S0WorkPicker />} />
        <Route path="/dashboard" element={<S1Dashboard />} />
        <Route path="/editor" element={<S2Editor />} />
        <Route path="/chat" element={<Navigate to="/works" replace />} />
        <Route path="/loading" element={<Navigate to="/works" replace />} />
        <Route path="/report" element={<Navigate to="/works" replace />} />
        <Route path="/episode-upload" element={<SEpisodeUpload />} />
        <Route path="/setting-review" element={<SSettingReview />} />
        <Route path="/episode-validation-report" element={<Navigate to="/works" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/landing" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div
      className="app-root"
      style={{
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, sans-serif",
        background: '#0F0F13',
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        position: 'relative',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      } as React.CSSProperties}
    >
      <AppContextProvider>
        <BackendStatusProvider>
          <AnimatedRoutes />
          <AiTokenQuotaModal />
        </BackendStatusProvider>
      </AppContextProvider>
    </div>
  );
}
