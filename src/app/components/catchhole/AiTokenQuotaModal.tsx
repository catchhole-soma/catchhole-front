import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Mail, X } from 'lucide-react';
import { getMyAiTokenUsageOptions } from '../../api/generated/@tanstack/react-query.gen';
import { subscribeAiTokenQuotaExhausted } from '../../lib/ai-token-quota';
import { C } from './constants';

export function AiTokenQuotaModal() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const usageQuery = useQuery({
    ...getMyAiTokenUsageOptions(),
    enabled: open,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const usage = usageQuery.data?.data;

  useEffect(() => subscribeAiTokenQuotaExhausted(() => setOpen(true)), []);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  if (!open) return null;

  const contactEmail = usage?.contactEmail;

  return (
    <div
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, padding: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(4, 4, 8, 0.8)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-token-quota-title"
        tabIndex={-1}
        style={{
          width: 'min(500px, 100%)', overflow: 'hidden', outline: 'none',
          borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface,
          boxShadow: '0 24px 80px rgba(0,0,0,0.68)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '19px 22px', borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{
            width: 38, height: 38, flexShrink: 0, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: C.warning + '16', color: C.warning,
          }}>
            <AlertTriangle size={19} />
          </div>
          <div id="ai-token-quota-title" style={{ flex: 1, color: C.t1, fontSize: 16, fontWeight: 700 }}>
            기본 사용량을 모두 소진했습니다
          </div>
          <button
            type="button"
            aria-label="사용량 안내 닫기"
            onClick={() => setOpen(false)}
            style={{ padding: 4, border: 0, background: 'transparent', color: C.t3, cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '22px', color: C.t2, fontSize: 13, lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 14px' }}>
            서비스를 적극 이용해 주셔서 감사합니다. 간단한 피드백과 함께 연락해 주시면
            추가 사용량 제공을 도와드리겠습니다.
          </p>

          <div style={{
            minHeight: 42, padding: '11px 13px', boxSizing: 'border-box', borderRadius: 7,
            display: 'flex', alignItems: 'center', gap: 9,
            background: '#22222C', border: `1px solid ${C.border}`,
          }}>
            <Mail size={15} color={C.primary} />
            {usageQuery.isPending ? (
              <span>문의 채널을 확인하고 있습니다...</span>
            ) : usageQuery.isError ? (
              <button
                type="button"
                onClick={() => void usageQuery.refetch()}
                style={{ border: 0, padding: 0, color: C.warning, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                문의 정보를 불러오지 못했습니다. 다시 시도
              </button>
            ) : contactEmail ? (
              <a href={`mailto:${contactEmail}`} style={{ color: C.t1, fontWeight: 600, textDecoration: 'none' }}>
                {contactEmail}
              </a>
            ) : (
              <span>문의 채널은 서비스 공지를 확인해 주세요.</span>
            )}
          </div>

        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end',
          padding: '15px 22px', borderTop: `1px solid ${C.border}`,
        }}>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              height: 36, padding: '0 20px', borderRadius: 6, border: 0,
              background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
