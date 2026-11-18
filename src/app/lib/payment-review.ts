import type { PaymentRequest } from '@portone/browser-sdk/v2';

// This is a checkout preview, not an entitlement or server-authoritative price list.
// Episode ranges are product estimates, not measured bounds or guaranteed analysis counts.
export const TOP_UP_PRODUCTS = [
  { id: 'basic', name: '기본 충전권', amount: 2900, quantity: '400만 캐치홀 토큰', estimatedEpisodes: '15~30', multiplier: 1 },
  { id: 'double', name: '더블 충전권', amount: 4900, quantity: '800만 캐치홀 토큰', estimatedEpisodes: '30~60', multiplier: 2 },
] as const;
export type TopUpProduct = typeof TOP_UP_PRODUCTS[number];
export const PAYMENT_REVIEW_ENABLED = import.meta.env.VITE_PAYMENT_REVIEW_ENABLED === 'true';
export const PAYMENT_REVIEW_PREVIEW_PATH = '/dev/payment-review';

export function getLocalPaymentReviewConfig() {
  if (!import.meta.env.DEV) throw new Error('Local payment preview is disabled');
  const storeId = import.meta.env.VITE_PORTONE_TEST_STORE_ID?.trim() ?? '';
  const channelKey = import.meta.env.VITE_PORTONE_TEST_CHANNEL_KEY?.trim() ?? '';
  return { storeId, channelKey, ready: storeId.startsWith('store-') && channelKey.startsWith('channel-key-') };
}

export function createReviewPaymentRequest(
  product: TopUpProduct,
  customer: { fullName: string; phoneNumber: string; email: string },
  returnPath: string,
  config: { storeId: string; channelKey: string; ready?: boolean },
): PaymentRequest {
  const { storeId, channelKey, ready } = config;
  if (!ready) throw new Error('Test channel is not configured');
  return {
    storeId,
    channelKey,
    // Inicis oid accepts at most 40 ASCII characters (7 + 32 = 39).
    paymentId: `review-${crypto.randomUUID().replace(/-/g, '')}`,
    orderName: `캐치홀 ${product.name} (${product.quantity})`,
    totalAmount: product.amount,
    currency: 'KRW',
    payMethod: 'CARD',
    customer,
    redirectUrl: new URL(returnPath, window.location.origin).href,
    forceRedirect: true,
    productType: 'DIGITAL',
    offerPeriod: { interval: '12m' },
    bypass: { inicis_v2: { acceptmethod: ['noeasypay'], P_RESERVED: ['noeasypay=Y'] } },
  };
}

// Browser return values are untrusted. None of these states means paid or credited.
export function reviewResultMessage(code: string | null | undefined, message?: string | null) {
  // Inicis V2 reports closing its test window as a PG failure, not a separate cancel code.
  if (code === 'FAILURE_TYPE_CANCEL' || (code === 'FAILURE_TYPE_PG' && message === '사용자가 결제를 취소하였습니다')) {
    return '결제창을 닫았어요. 사용량은 충전되지 않았어요.';
  }
  if (code === 'FAILURE_TYPE_PG' || code === 'FAILURE_TYPE_PG_PROVIDER') {
    return '결제창에서 요청을 마치지 못했어요. 다시 열거나 잠시 후 시도해 주세요.';
  }
  if (code) return '결제창을 열거나 진행하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.';
  return '결제 결과를 확인할 수 없어요. 고객센터로 문의해 주세요.';
}
