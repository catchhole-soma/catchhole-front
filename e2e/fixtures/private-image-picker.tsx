import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivateWorldImagePicker } from '../../src/app/components/catchhole/worldsetting/PrivateWorldImagePicker';

export function mountPrivatePicker() {
  document.getElementById('root')?.remove();
  const target = document.createElement('div'); document.body.append(target);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  createRoot(target).render(<QueryClientProvider client={client}>
    <PrivateWorldImagePicker workId="fixture" pending={false} onBusy={() => {}} onSelect={() => {}} />
  </QueryClientProvider>);
}
