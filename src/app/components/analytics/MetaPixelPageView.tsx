import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { trackMetaPageView } from '../../lib/meta-pixel';

const REDIRECT_ONLY_PATHS = new Set([
  '/',
  '/chat',
  '/episode-validation-report',
  '/loading',
  '/report',
]);

export function MetaPixelPageView() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (REDIRECT_ONLY_PATHS.has(pathname)) return;
    trackMetaPageView(pathname);
  }, [pathname]);

  return null;
}
