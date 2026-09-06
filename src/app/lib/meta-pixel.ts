type MetaPixelFunction = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: MetaPixelFunction;
  }
}

let lastPagePath: string | null = null;

function trackMetaEvent(eventName: string): void {
  try {
    window.fbq?.('track', eventName);
  } catch {
    // Analytics must never interrupt the product flow when Meta is unavailable.
  }
}

export function trackMetaPageView(pathname: string): void {
  if (pathname === '/' || pathname === lastPagePath) return;
  lastPagePath = pathname;
  trackMetaEvent('PageView');
}

export function trackMetaCompleteRegistration(): void {
  trackMetaEvent('CompleteRegistration');
}
