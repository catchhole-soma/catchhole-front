import { useNavigate } from 'react-router';
import { TransitionType } from '../components/catchhole/constants';

export function useAppNavigate() {
  const nav = useNavigate();
  return (to: string, transition: TransitionType) => {
    nav(to, { state: { transition } });
  };
}
