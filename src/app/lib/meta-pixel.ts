type MetaPixelFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    fbq?: MetaPixelFunction;
  }
}

let lastPagePath: string | null = null;

const META_PIXEL_READY_EVENT = 'meta-pixel-ready';
const ALLOWED_QUERY_PARAMETERS = new Set([
  'fbclid',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
]);

function getSafeAnalyticsPath(): string {
  const safeSearchParams = new URLSearchParams();
  new URLSearchParams(window.location.search).forEach((value, key) => {
    if (ALLOWED_QUERY_PARAMETERS.has(key)) safeSearchParams.append(key, value);
  });

  const safeSearch = safeSearchParams.toString();
  return `${window.location.pathname}${safeSearch ? `?${safeSearch}` : ''}`;
}

function runWithSafeAnalyticsUrl(callback: () => void): void {
  const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const safeUrl = getSafeAnalyticsPath();

  try {
    if (originalUrl !== safeUrl) window.history.replaceState(window.history.state, '', safeUrl);
    callback();
  } finally {
    if (originalUrl !== safeUrl) window.history.replaceState(window.history.state, '', originalUrl);
  }
}

function trackMetaEvent(eventName: string): void {
  const sendEvent = () => {
    try {
      if (!window.fbq?.callMethod) return;
      runWithSafeAnalyticsUrl(() => window.fbq?.('track', eventName));
    } catch {
      // Analytics must never interrupt the product flow when Meta is unavailable.
    }
  };

  if (window.fbq?.callMethod) sendEvent();
  else window.addEventListener(META_PIXEL_READY_EVENT, sendEvent, { once: true });
}

export function trackMetaPageView(pathname: string): void {
  if (pathname === '/' || pathname === lastPagePath) return;
  lastPagePath = pathname;
  trackMetaEvent('PageView');
}

export function trackMetaCompleteRegistration(): void {
  trackMetaEvent('CompleteRegistration');
}
