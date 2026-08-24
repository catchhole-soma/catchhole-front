import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router';
import { getCurrentLegalDocumentsOptions } from '../../api/generated/@tanstack/react-query.gen';
import type { LegalDocumentResponse } from '../../api/generated/types.gen';
import { LegalDocumentContent } from './LegalDocumentContent';
import { ProductBrand } from './ui-v2/ProductBrand';
import './legal-documents.css';

type LegalDocumentPageProps = {
  type: 'privacy' | 'terms';
};

export function LegalDocumentPage({ type }: LegalDocumentPageProps) {
  const navigate = useNavigate();
  const query = useQuery({
    ...getCurrentLegalDocumentsOptions({ query: { locale: 'ko-KR' } }),
    retry: 2,
    staleTime: 5 * 60_000,
  });
  const bundle = query.data?.data;
  const document: LegalDocumentResponse | undefined = type === 'terms'
    ? bundle?.termsOfService
    : bundle?.privacyPolicy;

  return (
    <div className="legal-page theme-v2">
      <header className="legal-page__header">
        <ProductBrand compact />
        <button type="button" className="legal-page__back" onClick={() => navigate('/landing')}>
          <ArrowLeft size={17} />
          랜딩으로 돌아가기
        </button>
      </header>
      <main className="legal-page__main">
        {query.isPending && (
          <div className="legal-document-state" role="status">
            <RefreshCw className="spin" size={22} />
            <strong>법률 문서를 불러오고 있어요</strong>
            <span>게시된 원문과 버전을 확인하는 중입니다.</span>
          </div>
        )}
        {query.isError && (
          <div className="legal-document-state" role="alert">
            <strong>법률 문서를 불러오지 못했습니다</strong>
            <span>가입이나 확인을 계속하기 전에 문서를 다시 불러와 주세요.</span>
            <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>
              {query.isFetching ? '다시 불러오는 중...' : '다시 불러오기'}
            </button>
          </div>
        )}
        {!query.isPending && !query.isError && !document && (
          <div className="legal-document-state" role="alert">
            <strong>현재 게시된 문서가 없습니다</strong>
            <span>잠시 후 다시 확인해 주세요.</span>
          </div>
        )}
        {document && <LegalDocumentContent document={document} />}
      </main>
    </div>
  );
}
