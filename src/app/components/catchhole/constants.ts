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

export type WorkId = string;
export type EditorMode = 'edit' | 'view';
export type NavId = 'settingDB' | 'reports' | 'graph' | 'manuscripts';
export type TransitionType = 'push-right' | 'push-left' | 'cover-up' | 'pop' | 'dissolve';

export type MsStatus = 'analyzed' | 'unanalyzed' | 'analyzing' | 'missing';
export interface ManuscriptRow { chapter: string; title: string; date: string; words: string; errors: number; status: MsStatus; }

export const FALLBACK_MANUSCRIPT: ManuscriptRow = {
  chapter: '159', title: '운명의 실타래', date: '오늘', words: '4,200자', errors: 5, status: 'analyzing',
};
