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
    window.gtag?.('event', 'page_view', { page_location: getSafePageLocation() });
  } catch {
    // Analytics must never interrupt the product flow when GA4 is unavailable.
  }
}
