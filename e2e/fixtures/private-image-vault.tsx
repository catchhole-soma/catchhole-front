import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivateImageVaultGate } from '../../src/app/components/catchhole/worldsetting/PrivateImageVaultGate';

export function mountVaultGate() {
  document.getElementById('root')?.remove();
  const target = document.createElement('div');
  document.body.append(target);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  createRoot(target).render(<QueryClientProvider client={client}>
    <PrivateImageVaultGate onBusy={() => {}} pending={false}>{() => <p>보관함 열림</p>}</PrivateImageVaultGate>
  </QueryClientProvider>);
}
