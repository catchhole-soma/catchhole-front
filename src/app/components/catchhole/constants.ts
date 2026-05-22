export const C = {
  bg: '#0F0F13',
  surface: '#1A1A22',
  border: '#2A2A36',
  primary: '#7C5CFC',
  danger: '#FF4D4D',
  warning: '#F4A261',
  success: '#00C896',
  t1: '#F0F0F5',
  t2: '#9090A8',
  t3: '#55556A',
} as const;

export type ScreenId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
export type TransitionType = 'push-right' | 'push-left' | 'cover-up' | 'pop' | 'dissolve';
export type NavigateFn = (to: ScreenId, transition: TransitionType) => void;
