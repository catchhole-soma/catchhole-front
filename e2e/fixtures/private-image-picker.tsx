import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivateWorldImagePicker } from '../../src/app/components/catchhole/worldsetting/PrivateWorldImagePicker';

export function mountPrivatePicker() {
function PickerHarness() {
  const [busy, setBusy] = useState(false);
  return <><output aria-label="상위 처리 상태">{busy ? '처리 중' : '준비'}</output>
    <PrivateWorldImagePicker workId="fixture" pending={busy} onBusy={setBusy} onSelect={() => {}} /></>;
}

  document.getElementById('root')?.remove();
  const target = document.createElement('div'); document.body.append(target);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  createRoot(target).render(<QueryClientProvider client={client}>
    <PickerHarness />
  </QueryClientProvider>);
}
