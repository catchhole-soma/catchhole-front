import terms from '../../../../docs/legal/terms-of-service.paid.draft.ko.md?raw';
import privacy from '../../../../docs/legal/privacy-policy.paid.draft.ko.md?raw';
import purchaseConditions from '../../../../docs/legal/paid-usage-conditions.draft.ko.md?raw';
import { getLocalPaymentReviewConfig, PAYMENT_REVIEW_PREVIEW_PATH } from '../../lib/payment-review';
import { PaymentReviewPage } from './PaymentReviewPage';
import { PaymentReviewLegalPage } from './PaymentReviewLegalPage';

// This module is dynamically imported only in Vite DEV and is absent from production builds.
export default function LocalPaymentReviewPreview({ type }: { type?: 'terms' | 'privacy' }) {
  if (type) return <PaymentReviewLegalPage content={type === 'terms' ? terms : privacy} returnPath={PAYMENT_REVIEW_PREVIEW_PATH} />;
  return <PaymentReviewPage localPreview review={{ ...getLocalPaymentReviewConfig(), purchaseConditions, terms, privacy }} />;
}
