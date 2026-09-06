import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { trackMetaPageView } from '../../lib/meta-pixel';

export function MetaPixelPageView() {
  const { pathname } = useLocation();

  useEffect(() => {
    trackMetaPageView(pathname);
  }, [pathname]);

  return null;
}
