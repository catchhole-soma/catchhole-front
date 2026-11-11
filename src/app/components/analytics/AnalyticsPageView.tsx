import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { trackGaPageView } from '../../lib/ga4';
import { trackMetaPageView } from '../../lib/meta-pixel';

const REDIRECT_ONLY_PATHS = new Set([
  '/',
  '/chat',
  '/episode-validation-report',
  '/loading',
  '/report',
]);

export function AnalyticsPageView() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (REDIRECT_ONLY_PATHS.has(pathname)) return;
    trackMetaPageView(pathname);
    trackGaPageView(pathname);
  }, [pathname]);

  return null;
}
