import { useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock3 } from 'lucide-react';
import { C } from './constants';

interface Props {
  feature: string | null;
  onClose: () => void;
}

/** MVP 이후 기능을 목 화면으로 열지 않고 한 가지 안내 방식으로 표시한다. */
export function ComingSoonToast({ feature, onClose }: Props) {
  useEffect(() => {
    if (!feature) return;
    const timeoutId = window.setTimeout(onClose, 2_500);
    return () => window.clearTimeout(timeoutId);
  }, [feature, onClose]);

  if (!feature) return null;

  return (
    <motion.div
      role="status"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', left: '50%', bottom: 28, zIndex: 400,
        transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8,
        padding: '11px 16px', borderRadius: 8, background: C.surface,
        border: `1px solid ${C.primary}55`, boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        color: C.t1, fontSize: 13, fontWeight: 600,
      }}
    >
      <Clock3 size={15} color={C.primary} />
      {feature} 기능은 업데이트 예정입니다.
    </motion.div>
  );
}
