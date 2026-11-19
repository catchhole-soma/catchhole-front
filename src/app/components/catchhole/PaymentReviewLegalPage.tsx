import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { LegalDocumentMarkdown } from './LegalDocumentContent';
import { ProductBrand } from './ui-v2/ProductBrand';

// Review documents do not replace published documents or signup consent.
export function PaymentReviewLegalPage({ content, returnPath }: { content: string; returnPath: string }) {
  return (
    <div className="legal-page theme-v2">
      <header className="legal-page__header">
        <ProductBrand compact />
        <Link className="legal-page__back" to={returnPath}>
          <ArrowLeft size={17} />사용량 충전으로 돌아가기
        </Link>
      </header>
      <main className="legal-page__main">
        <article className="legal-document">
          <LegalDocumentMarkdown content={content} />
        </article>
      </main>
    </div>
  );
}
