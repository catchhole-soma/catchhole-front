import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ShieldCheck } from 'lucide-react';
import { C } from './constants';
import { TermsModal } from './TermsModal';

interface Props {
  appearance?: 'dark' | 'light';
}

export function ManuscriptProcessingNotice({ appearance = 'dark' }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isLight = appearance === 'light';

  return (
    <>
      <section
        aria-label="AI 원고 처리 안내"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 9,
          marginTop: isLight ? 12 : 14,
          padding: isLight ? '0 4px' : '11px 12px',
          borderRadius: isLight ? 0 : 7,
          border: isLight ? 'none' : `1px solid ${C.primary}33`,
          background: isLight ? 'transparent' : `${C.primary}0D`,
          color: isLight ? '#4B5563' : C.t2,
          fontSize: isLight ? 13 : 12,
          lineHeight: 1.6,
        }}
      >
        <ShieldCheck size={15} color={C.primary} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ color: isLight ? '#111827' : C.t1 }}>AI 분석을 실행하면 원고의 필요한 구간이 OpenAI API로 처리됩니다.</div>
          <div>
            API 입력·출력은 기본적으로 모델 학습에 사용되지 않습니다.{' '}
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              style={{
                border: 0,
                padding: 0,
                background: 'transparent',
                color: C.primary,
                font: 'inherit',
                fontWeight: 600,
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              자세히 보기
            </button>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {detailsOpen && (
          <TermsModal
            initialTab="privacy"
            zIndex={400}
            onClose={() => setDetailsOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
