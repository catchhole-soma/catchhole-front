import { useSyncExternalStore } from 'react';
import { privateImageKeySnapshot, subscribePrivateImageKeys } from './private-image-keys';

export function usePrivateImageKey(vaultId?: string | null) {
  const keys = useSyncExternalStore(subscribePrivateImageKeys, privateImageKeySnapshot);
  return vaultId ? keys.get(vaultId) : undefined;
}
