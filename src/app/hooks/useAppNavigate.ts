import { useNavigate } from 'react-router';
import { TransitionType } from '../components/catchhole/constants';

type AppNavigateOptions = {
  replace?: boolean;
};

export function useAppNavigate() {
  const nav = useNavigate();
  return (
    to: string,
    transition: TransitionType,
    extraState?: Record<string, unknown>,
    options?: AppNavigateOptions,
  ) => {
    nav(to, { replace: options?.replace, state: { transition, ...extraState } });
  };
}
