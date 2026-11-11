type GtagFunction = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFunction;
  }
}

let lastPagePath: string | null = null;

// 개인정보처리방침이 공개한 측정 범위만 보낸다. 검색어나 원고 일부가 실릴 수 있는
// 나머지 query는 GA4로 보내지 않는다.
const ALLOWED_QUERY_PARAMETERS = new Set([
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
]);

function getSafePageLocation(): string {
  const safeSearchParams = new URLSearchParams();
  new URLSearchParams(window.location.search).forEach((value, key) => {
    if (ALLOWED_QUERY_PARAMETERS.has(key)) safeSearchParams.append(key, value);
  });

  const safeSearch = safeSearchParams.toString();
  return `${window.location.origin}${window.location.pathname}${safeSearch ? `?${safeSearch}` : ''}`;
}

// gtag는 운영 빌드에서 index.html 스니펫이 먼저 정의하므로 gtag.js 로딩 전에 보낸
// 이벤트도 dataLayer에 쌓였다가 처리된다. 운영이 아니면 gtag가 없어 아무것도 하지 않는다.
export function trackGaPageView(pathname: string): void {
  if (pathname === lastPagePath) return;
  lastPagePath = pathname;

  try {
    const pageLocation = getSafePageLocation();
    // GA4가 스스로 보내는 user_engagement 같은 자동 이벤트는 지정하지 않으면 query가 남은
    // 실제 주소를 쓸 수 있다. 전역값으로 정제한 주소를 먼저 지정해 모든 이벤트가 같은 주소를 쓰게 한다.
    window.gtag?.('set', { page_location: pageLocation });
    window.gtag?.('event', 'page_view', { page_location: pageLocation });
  } catch {
    // Analytics must never interrupt the product flow when GA4 is unavailable.
  }
}

// 개인정보처리방침이 허용한 전환 이벤트만 보낸다(docs/legal/README.md). 매개변수는 붙이지 않으며
// 주소는 마지막 page_view 때 전역으로 지정한 정제 주소를 그대로 쓴다.
type GaConversionEvent = 'sign_up' | 'demo_complete';

function trackGaConversion(eventName: GaConversionEvent): void {
  try {
    window.gtag?.('event', eventName);
  } catch {
    // Analytics must never interrupt the product flow when GA4 is unavailable.
  }
}

export function trackGaSignUp(): void {
  trackGaConversion('sign_up');
}

export function trackGaDemoComplete(): void {
  trackGaConversion('demo_complete');
}
