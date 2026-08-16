import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Mail, X } from 'lucide-react';
import { getMyAiTokenUsageOptions } from '../../api/generated/@tanstack/react-query.gen';
import {
  subscribeAiTokenQuotaExhausted,
  type AiTokenQuotaNotice,
} from '../../lib/ai-token-quota';

export function AiTokenQuotaModal() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<AiTokenQuotaNotice>({ kind: 'request-blocked' });
  const dialogRef = useRef<HTMLDivElement>(null);
  const usageQuery = useQuery({
    ...getMyAiTokenUsageOptions(),
    enabled: open,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const usage = usageQuery.data?.data;

  useEffect(() => subscribeAiTokenQuotaExhausted(nextNotice => {
    setNotice(nextNotice);
    setOpen(true);
  }), []);

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
  const interruptedCount = notice.interruptedComparisonCount ?? 0;
  const failedEpisodeCount = notice.failedEpisodeCount ?? 0;
  const totalEpisodeCount = notice.totalEpisodeCount ?? 0;
  const analysisFailed = notice.kind === 'analysis-failed';
  const analysisInterrupted = notice.kind === 'analysis-interrupted';
  const title = analysisInterrupted
    ? '설정 비교가 일부 중단되었습니다'
    : analysisFailed
      ? totalEpisodeCount > 1 && failedEpisodeCount >= totalEpisodeCount
        ? '전체 회차 분석이 중단되었습니다'
        : totalEpisodeCount > 1
          ? '일부 회차 분석이 중단되었습니다'
          : '회차 분석이 중단되었습니다'
      : '기본 사용량을 모두 소진했습니다';
  const description = analysisInterrupted
    ? `${interruptedCount > 0 ? `${interruptedCount}개 ` : ''}세계관 설정 비교가 사용량 부족으로 중단됐습니다. 이미 완료된 추출과 비교 결과는 유지되며, 추가 사용량을 받은 뒤 검토 화면에서 남은 비교만 재개할 수 있습니다.`
    : analysisFailed
      ? `${failedEpisodeCount > 0 ? `${failedEpisodeCount}개 ` : ''}회차 분석이 사용량 부족으로 중단됐습니다. 추가 사용량을 받은 뒤 실패한 회차만 다시 시도해 주세요.`
      : '서비스를 적극 이용해 주셔서 감사합니다. 간단한 피드백과 함께 연락해 주시면 추가 사용량 제공을 도와드리겠습니다.';

  return (
    <div
      className="theme-v2 theme-modal-backdrop"
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
        className="theme-modal ai-token-quota-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-token-quota-title"
        tabIndex={-1}
        style={{
          width: 'min(500px, 100%)', overflow: 'hidden', outline: 'none',
          borderRadius: 12, border: '1px solid var(--ch-border)', background: 'var(--ch-surface)',
          boxShadow: 'var(--ch-shadow-float)',
        }}
      >
        <div className="theme-modal__header" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '19px 22px', borderBottom: '1px solid var(--ch-border)',
        }}>
          <div style={{
            width: 38, height: 38, flexShrink: 0, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgb(217 131 36 / 10%)', color: 'var(--ch-warning)',
          }}>
            <AlertTriangle size={19} />
          </div>
          <div className="theme-modal__title" id="ai-token-quota-title" style={{ flex: 1, fontSize: 16, fontWeight: 700 }}>
            {title}
          </div>
          <button
            type="button"
            aria-label="사용량 안내 닫기"
            onClick={() => setOpen(false)}
            style={{ padding: 4, border: 0, background: 'transparent', color: 'var(--ch-text-muted)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="theme-modal__body" style={{ padding: '22px', fontSize: 13, lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 14px' }}>
            {description}
          </p>

          <div className="theme-modal__summary" style={{
            minHeight: 42, padding: '11px 13px', boxSizing: 'border-box', borderRadius: 7,
            display: 'flex', alignItems: 'center', gap: 9,
            background: 'var(--ch-canvas)', border: '1px solid var(--ch-border)',
          }}>
            <Mail size={15} color="var(--ch-primary)" />
            {usageQuery.isPending ? (
              <span>문의 채널을 확인하고 있습니다...</span>
            ) : usageQuery.isError ? (
              <button
                type="button"
                onClick={() => void usageQuery.refetch()}
                style={{ border: 0, padding: 0, color: 'var(--ch-warning)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                문의 정보를 불러오지 못했습니다. 다시 시도
              </button>
            ) : contactEmail ? (
              <a
                className="ai-token-quota-modal__contact"
                href={`mailto:${contactEmail}`}
                style={{ fontWeight: 600 }}
              >
                {contactEmail}
              </a>
            ) : (
              <span>문의 채널은 서비스 공지를 확인해 주세요.</span>
            )}
          </div>

        </div>

        <div className="theme-modal__footer" style={{
          display: 'flex', justifyContent: 'flex-end',
          padding: '15px 22px', borderTop: '1px solid var(--ch-border)',
        }}>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              height: 36, padding: '0 20px', borderRadius: 6, border: 0,
              background: 'var(--ch-primary)', color: 'var(--ch-primary-contrast)', fontSize: 13, fontWeight: 600,
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
