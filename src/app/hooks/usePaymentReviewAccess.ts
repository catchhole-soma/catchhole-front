import { useQuery } from '@tanstack/react-query';
import { getPaymentReviewAccessOptions, getPaymentReviewPageOptions } from '../api/generated/@tanstack/react-query.gen';
import { getAccessToken } from '../lib/api-config';
import { PAYMENT_REVIEW_ENABLED } from '../lib/payment-review';
import { usePrivateImageSession } from '../lib/private-image-session';

// The existing session epoch changes on logout, login and cross-tab account changes.
// It isolates cached permissions and late responses; it never grants permission itself.
export function usePaymentReviewAccess() {
  const epoch = usePrivateImageSession();
  const enabled = PAYMENT_REVIEW_ENABLED && Boolean(getAccessToken());
  const options = getPaymentReviewAccessOptions();
  const query = useQuery({
    ...options,
    queryKey: [{ ...options.queryKey[0], tags: [`payment-review-session:${epoch}`] }],
    enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  return {
    allowed: enabled && query.isSuccess && !query.isFetching
      && query.data?.success === true && query.data.data?.allowed === true,
    pending: enabled && query.isFetching,
    epoch,
  };
}

export function usePaymentReviewPage(allowed: boolean, epoch: number) {
  const options = getPaymentReviewPageOptions();
  return useQuery({
    ...options,
    queryKey: [{ ...options.queryKey[0], tags: [`payment-review-session:${epoch}`] }],
    enabled: allowed,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
}
