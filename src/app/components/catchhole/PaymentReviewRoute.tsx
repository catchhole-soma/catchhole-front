import { Navigate, Outlet, useOutletContext } from 'react-router';
import type { PaymentReviewPageResponse } from '../../api/generated/types.gen';
import { usePaymentReviewAccess, usePaymentReviewPage } from '../../hooks/usePaymentReviewAccess';
import { PaymentReviewPage } from './PaymentReviewPage';
import { PaymentReviewLegalPage } from './PaymentReviewLegalPage';

export function PaymentReviewRoute() {
  const access = usePaymentReviewAccess();
  const page = usePaymentReviewPage(access.allowed, access.epoch);
  if (access.pending || (access.allowed && page.isPending)) {
    return <div className="payment-review theme-v2" role="status">페이지를 확인하고 있어요.</div>;
  }
  if (!access.allowed || page.isError || !page.data?.success || !page.data.data) {
    return <Navigate to="/works" replace />;
  }
  return <Outlet key={access.epoch} context={page.data.data} />;
}

export function AuthorizedPaymentReviewPage() {
  const review = useOutletContext<PaymentReviewPageResponse>();
  return <PaymentReviewPage review={review} />;
}

export function AuthorizedPaymentReviewLegalPage({ type }: { type: 'terms' | 'privacy' }) {
  const review = useOutletContext<PaymentReviewPageResponse>();
  return <PaymentReviewLegalPage content={review[type]} returnPath="/billing" />;
}
