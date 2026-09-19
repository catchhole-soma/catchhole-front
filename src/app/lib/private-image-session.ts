import { useSyncExternalStore } from 'react';

// In-flight uploads and cached private content must not cross account sessions.
let epoch = 0;
const listeners = new Set<() => void>();
export const privateImageSessionEpoch = () => epoch;
export function invalidatePrivateImageSession() {
  epoch += 1;
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function usePrivateImageSession() {
  return useSyncExternalStore(subscribe, privateImageSessionEpoch);
}
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === null || (event.key === 'accessToken' &&
    (!tokenOwner(event.newValue) || tokenOwner(event.newValue) !== tokenOwner(event.oldValue)))) invalidatePrivateImageSession();
});

// This only detects an account change; JWT authenticity is still checked by the server.
function tokenOwner(token: string | null): string | undefined {
  try {
    const encoded = token?.split('.')[1];
    if (!encoded) return undefined;
    const payload = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : undefined;
  } catch { return undefined; }
}
