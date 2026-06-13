import React, { createContext, useContext, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { WifiOff, FileQuestion } from 'lucide-react';
import { C } from '../components/catchhole/constants';
import { setNetworkErrorListener } from '../lib/api';
import { setDemoMode } from '../lib/worksApi';

type PromptKind = 'network' | 'no-file';

interface BackendStatusState {
  dismissPrompt: () => void;
  suggestDemoMode: (onConfirm?: () => void) => void;
}

const PROMPT_CONTENT: Record<PromptKind, { icon: React.ReactNode; iconColor: string; title: string; description: string }> = {
  network: {
    icon: <WifiOff size={20} />,
    iconColor: C.warning,
    title: '백엔드 서버에 연결할 수 없습니다',
    description: '서버 응답을 받을 수 없어요. 데모 버전으로 전환하면 로컬 데이터로 모든 기능을 체험할 수 있습니다.',
  },
  'no-file': {
    icon: <FileQuestion size={20} />,
    iconColor: C.primary,
    title: '업로드할 파일이 없으신가요?',
    description: '데모 버전으로 전환하면 실제 파일 없이도 모든 기능을 체험할 수 있습니다.',
  },
};

const BackendStatusContext = createContext<BackendStatusState>(null!);

function ButtonSpinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      style={{ width: 13, height: 13, flexShrink: 0 }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
        <circle
          cx="8" cy="8" r="6"
          fill="none" stroke="#fff" strokeWidth="2"
          strokeDasharray={`${(270 / 360) * 2 * Math.PI * 6} ${2 * Math.PI * 6}`}
          strokeLinecap="round"
          transform="rotate(-90 8 8)"
        />
      </svg>
    </motion.div>
  );
}

export function BackendStatusProvider({ children }: { children: React.ReactNode }) {
  const [promptKind, setPromptKind] = useState<PromptKind | null>(null);
  const [networkDismissed, setNetworkDismissed] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [demoConfirmCallback, setDemoConfirmCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    setNetworkErrorListener(() => {
      if (!networkDismissed) setPromptKind('network');
    });
    return () => setNetworkErrorListener(null);
  }, [networkDismissed]);

  const dismissPrompt = () => {
    if (promptKind === 'network') setNetworkDismissed(true);
    setPromptKind(null);
    setDemoConfirmCallback(null);
  };

  const suggestDemoMode = (onConfirm?: () => void) => {
    setPromptKind('no-file');
    setDemoConfirmCallback(() => onConfirm ?? null);
  };

  const switchToDemo = () => {
    setDemoMode(true);

    if (promptKind === 'no-file') {
      setPromptKind(null);
      demoConfirmCallback?.();
      setDemoConfirmCallback(null);
      return;
    }

    setSwitching(true);
    window.location.href = '/dashboard';
  };

  const content = promptKind ? PROMPT_CONTENT[promptKind] : null;

  return (
    <BackendStatusContext.Provider value={{ dismissPrompt, suggestDemoMode }}>
      {children}
      {content && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 360, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`,
            padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', background: content.iconColor + '1A',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: content.iconColor,
            }}>
              {content.icon}
            </div>
            <div style={{ color: C.t1, fontSize: 15, fontWeight: 700 }}>{content.title}</div>
            <div style={{ color: C.t2, fontSize: 13, lineHeight: 1.6 }}>
              {content.description}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, width: '100%' }}>
              <button onClick={dismissPrompt} disabled={switching} style={{
                flex: 1, height: 38, borderRadius: 6, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.t2, fontSize: 13, fontFamily: 'inherit',
                cursor: switching ? 'default' : 'pointer', opacity: switching ? 0.5 : 1,
              }}>
                닫기
              </button>
              <button onClick={switchToDemo} disabled={switching} style={{
                flex: 1, height: 38, borderRadius: 6, border: 'none',
                background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                cursor: switching ? 'default' : 'pointer', opacity: switching ? 0.85 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                {switching && <ButtonSpinner />}
                {switching ? '전환 중...' : '데모 버전으로 전환'}
              </button>
            </div>
          </div>
        </div>
      )}
    </BackendStatusContext.Provider>
  );
}

export const useBackendStatus = () => useContext(BackendStatusContext);
