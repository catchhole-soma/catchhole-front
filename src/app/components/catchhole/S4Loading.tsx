import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CircleCheckBig } from 'lucide-react';
import { C, NavigateFn } from './constants';

interface Props {
  navigate: NavigateFn;
}

function SpinningRing() {
  const size = 72;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (270 / 360) * circumference;

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} style={{ display: 'block' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={C.border} strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={C.primary} strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    </motion.div>
  );
}

function SmallSpinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      style={{ width: 16, height: 16, flexShrink: 0 }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="6" fill="none" stroke={C.border} strokeWidth="2" />
        <circle
          cx="8" cy="8" r="6"
          fill="none" stroke={C.primary} strokeWidth="2"
          strokeDasharray={`${(270 / 360) * 2 * Math.PI * 6} ${2 * Math.PI * 6}`}
          strokeLinecap="round"
          transform="rotate(-90 8 8)"
        />
      </svg>
    </motion.div>
  );
}

const steps = [
  { label: '캐릭터 158개 설정 확인 완료', delay: 0.6 },
  { label: '타임라인 검증 완료', delay: 1.4 },
  { label: '관계·능력 오류 탐지 중', delay: 2.2, inProgress: true },
];

export default function S4Loading({ navigate }: Props) {
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    steps.forEach((step, i) => {
      timers.push(
        setTimeout(() => setVisibleSteps((prev) => Math.max(prev, i + 1)), step.delay * 1000)
      );
    });

    timers.push(
      setTimeout(() => {
        navigate('S5', 'dissolve');
      }, 3200)
    );

    return () => timers.forEach(clearTimeout);
  }, [navigate]);

  return (
    <div
      style={{
        background: C.bg,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
      }}
    >
      <SpinningRing />

      <div style={{
        color: C.t1,
        fontSize: 20,
        fontWeight: 700,
        marginTop: 28,
        letterSpacing: '-0.4px',
        textAlign: 'center',
      }}>
        설정 DB와 대조 중
      </div>

      <div style={{
        width: 360,
        marginTop: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        <AnimatePresence>
          {steps.slice(0, visibleSteps).map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{ display: 'flex', alignItems: 'center', gap: 12 }}
            >
              {step.inProgress ? (
                <SmallSpinner />
              ) : (
                <CircleCheckBig size={16} color={C.success} />
              )}
              <span style={{
                color: step.inProgress ? C.t2 : C.t1,
                fontSize: 14,
              }}>
                {step.label}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div style={{ color: C.t3, fontSize: 13, marginTop: 24, textAlign: 'center' }}>
        보통 3초 이내 완료
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
            style={{
              width: 5, height: 5,
              borderRadius: '50%',
              background: C.primary,
            }}
          />
        ))}
      </div>
    </div>
  );
}
