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

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export type WorkId = 'detective' | 'murim';
export type EditorMode = 'edit' | 'view';
export type NavId = 'settingDB' | 'reports' | 'graph' | 'manuscripts';
export type TransitionType = 'push-right' | 'push-left' | 'cover-up' | 'pop' | 'dissolve';
