import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { RefreshCw, X } from 'lucide-react';
import { getCurrentLegalDocumentsOptions } from '../../api/generated/@tanstack/react-query.gen';
import type { LegalDocumentResponse } from '../../api/generated/types.gen';
import { C } from './constants';
import { LegalDocumentContent } from './LegalDocumentContent';

type TabId = 'terms' | 'privacy';
type LegalSectionId = 'external-ai';

interface Props {
  onClose: () => void;
  initialTab?: TabId;
  initialSection?: LegalSectionId;
  zIndex?: number;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'terms', label: '이용약관' },
  { id: 'privacy', label: '개인정보 처리방침' },
];

export function TermsModal({ onClose, initialTab = 'terms', initialSection, zIndex = 300 }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<TabId>(initialTab);
  const legalDocumentsQuery = useQuery({
    ...getCurrentLegalDocumentsOptions({ query: { locale: 'ko-KR' } }),
    retry: 2,
    staleTime: 5 * 60_000,
  });
  const bundle = legalDocumentsQuery.data?.data;
  const currentDocument: LegalDocumentResponse | undefined = tab === 'terms'
    ? bundle?.termsOfService
    : bundle?.privacyPolicy;

  useEffect(() => {
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [initialSection, onClose]);

  useEffect(() => {
    if (!initialSection || tab !== 'privacy' || !currentDocument) return;
    const section = dialogRef.current?.querySelector<HTMLElement>(
      `[data-legal-section="${initialSection}"]`,
    );
    section?.scrollIntoView({ block: 'start' });
    section?.focus({ preventScroll: true });
  }, [currentDocument, initialSection, tab]);

  return (
    <motion.div
      className="terms-modal-backdrop theme-v2 theme-modal-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
        zIndex, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onClose}
    >
      <motion.div
        className="terms-modal theme-modal"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        initial={{ y: 28, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 14, opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(600px, calc(100vw - 32px))', background: C.surface, borderRadius: 14,
          border: `1px solid ${C.border}`,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', maxHeight: 'min(80vh, calc(100dvh - 32px))', overflow: 'hidden', outline: 'none',
        }}
      >
        {/* 헤더 */}
        <div className="terms-modal__header theme-modal__header" style={{ padding: '20px 24px 0', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span id="terms-modal-title" style={{ color: C.t1, fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px' }}>법적 고지</span>
            <button type="button" aria-label="법적 고지 닫기" onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: C.t3,
              display: 'flex', padding: 4, borderRadius: 4,
            }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(t => (
              <button className={`terms-modal__tab${tab === t.id ? ' is-active' : ''}`} type="button" key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '8px 16px', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? C.primary : C.t3,
                borderBottom: `2px solid ${tab === t.id ? C.primary : 'transparent'}`,
                transition: 'all 0.15s', marginBottom: -1,
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="terms-modal__body theme-modal__body" style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {legalDocumentsQuery.isPending && (
            <div className="legal-document-state" role="status">
              <RefreshCw className="spin" size={20} />
              <strong>법률 문서를 불러오고 있어요</strong>
            </div>
          )}
          {legalDocumentsQuery.isError && (
            <div className="legal-document-state" role="alert">
              <strong>법률 문서를 불러오지 못했습니다</strong>
              <span>문서를 확인한 뒤 가입을 계속할 수 있습니다.</span>
              <button
                type="button"
                onClick={() => void legalDocumentsQuery.refetch()}
                disabled={legalDocumentsQuery.isFetching}
              >
                {legalDocumentsQuery.isFetching ? '다시 불러오는 중...' : '다시 불러오기'}
              </button>
            </div>
          )}
          {!legalDocumentsQuery.isPending && !legalDocumentsQuery.isError && !currentDocument && (
            <div className="legal-document-state" role="alert">
              <strong>현재 게시된 문서가 없습니다</strong>
              <span>잠시 후 다시 확인해 주세요.</span>
            </div>
          )}
          {currentDocument && <LegalDocumentContent compact document={currentDocument} />}
        </div>

        {/* 하단 */}
        <div className="terms-modal__footer theme-modal__footer" style={{
          padding: '16px 24px', borderTop: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'flex-end', flexShrink: 0,
        }}>
          <button type="button" onClick={onClose} style={{
            height: 36, padding: '0 20px', borderRadius: 6, border: 'none',
            background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            확인
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
