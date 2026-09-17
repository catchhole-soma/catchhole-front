/** Keys live only in this tab's memory. Never persist them in browser storage or API data. */
let keys: ReadonlyMap<string, CryptoKey> = new Map();
let epoch = 0;
const listeners = new Set<() => void>();

export const privateImageKeySnapshot = () => keys;
export const privateImageSessionEpoch = () => epoch;
export function subscribePrivateImageKeys(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function unlockPrivateImageKey(id: string, key: CryptoKey, expectedEpoch: number) {
  if (epoch !== expectedEpoch) throw new Error('로그인 상태가 바뀌었어요. 다시 시도해 주세요.');
  keys = new Map(keys).set(id, key);
  listeners.forEach(listener => listener());
}
export function clearPrivateImageKeys() {
  epoch += 1;
  keys = new Map();
  listeners.forEach(listener => listener());
}
// Logging out or signing in as another account in a different tab also locks this tab.
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === null || (event.key === 'accessToken' &&
    (!tokenOwner(event.newValue) || tokenOwner(event.newValue) !== tokenOwner(event.oldValue)))) clearPrivateImageKeys();
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
