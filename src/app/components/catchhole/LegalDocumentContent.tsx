import type { ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { LegalDocumentResponse } from '../../api/generated/types.gen';
import './legal-documents.css';

type LegalDocumentContentProps = {
  compact?: boolean;
  document: LegalDocumentResponse;
};

function textFromChildren(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textFromChildren).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    return textFromChildren((children as { props?: { children?: ReactNode } }).props?.children);
  }
  return '';
}

function formatEffectiveDate(value?: string) {
  if (!value) return '시행일 확인 중';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${year}년 ${Number(month)}월 ${Number(day)}일 시행`;
}

const MARKDOWN_COMPONENTS: Components = {
  a: ({ node, ...props }) => {
    void node;
    return <a {...props} target="_blank" rel="noreferrer noopener" />;
  },
  h2: ({ children, node, ...props }) => {
    void node;
    const heading = textFromChildren(children);
    const isExternalAiSection = heading.includes('AI 처리') || heading.includes('외부 AI');
    return (
      <h2
        {...props}
        data-legal-section={isExternalAiSection ? 'external-ai' : undefined}
        tabIndex={isExternalAiSection ? -1 : undefined}
      >
        {children}
      </h2>
    );
  },
  table: ({ node, ...props }) => {
    void node;
    return (
      <div className="legal-document-markdown__table" role="region" aria-label="법률 문서 표" tabIndex={0}>
        <table {...props} />
      </div>
    );
  },
};

export function LegalDocumentContent({ compact = false, document }: LegalDocumentContentProps) {
  return (
    <article className={`legal-document${compact ? ' legal-document--compact' : ''}`}>
      <div className="legal-document__meta" aria-label="법률 문서 게시 정보">
        <span>문서 버전 {document.documentVersion ?? '확인 중'}</span>
        <span>{formatEffectiveDate(document.effectiveDate)}</span>
      </div>
      <div className="legal-document-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
          {document.contentMarkdown ?? ''}
        </ReactMarkdown>
      </div>
    </article>
  );
}
