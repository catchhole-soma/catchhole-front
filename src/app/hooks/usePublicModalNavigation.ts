import { useLocation, useNavigate } from 'react-router';

type AuthRoute = '/login' | '/signup';
type TermsTab = 'terms' | 'privacy';

type PublicModalState = {
  transition?: string;
  authModalFrom?: string;
  termsModalFrom?: string;
  [key: string]: unknown;
};

function readState(value: unknown): PublicModalState {
  return value && typeof value === 'object' ? value as PublicModalState : {};
}

function currentUrl(pathname: string, search: string, hash: string) {
  return `${pathname}${search}${hash}`;
}

export function usePublicModalNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = readState(location.state);
  const searchParams = new URLSearchParams(location.search);
  const termsParam = searchParams.get('terms');
  const termsTab: TermsTab | null = termsParam === 'terms' || termsParam === 'privacy'
    ? termsParam
    : null;

  const openAuth = (route: AuthRoute) => {
    navigate(route, {
      state: {
        ...state,
        transition: 'dissolve',
        authModalFrom: currentUrl(location.pathname, location.search, location.hash),
      },
    });
  };

  const switchAuth = (route: AuthRoute) => {
    const nextState = { ...state, transition: 'dissolve' };
    delete nextState.termsModalFrom;
    navigate(route, { replace: true, state: nextState });
  };

  const closeAuth = () => {
    if (typeof state.authModalFrom === 'string') {
      navigate(-1);
      return;
    }

    navigate('/landing', {
      replace: true,
      state: { transition: 'dissolve' },
    });
  };

  const openTerms = (tab: TermsTab) => {
    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.set('terms', tab);
    navigate({
      pathname: location.pathname,
      search: `?${nextSearchParams.toString()}`,
      hash: location.hash,
    }, {
      state: {
        ...state,
        transition: 'dissolve',
        termsModalFrom: currentUrl(location.pathname, location.search, location.hash),
      },
    });
  };

  const closeTerms = () => {
    if (typeof state.termsModalFrom === 'string') {
      navigate(-1);
      return;
    }

    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.delete('terms');
    const nextState = { ...state, transition: 'dissolve' };
    delete nextState.termsModalFrom;
    navigate({
      pathname: location.pathname,
      search: nextSearchParams.size > 0 ? `?${nextSearchParams.toString()}` : '',
      hash: location.hash,
    }, {
      replace: true,
      state: nextState,
    });
  };

  return {
    closeAuth,
    closeTerms,
    openAuth,
    openTerms,
    switchAuth,
    termsTab,
  };
}
