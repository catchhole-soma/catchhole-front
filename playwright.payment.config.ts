import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const port = 3442;
export default defineConfig(base, {
  testMatch: ['payment-review.spec.ts', 'payment-review-access.spec.ts'],
  testIgnore: [],
  use: { ...base.use, baseURL: `http://localhost:${port}` },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    env: {
      // Exercise the production default without a Vercel environment override.
      VITE_PAYMENT_REVIEW_ENABLED: '',
      VITE_PORTONE_TEST_STORE_ID: 'store-e2e',
      VITE_PORTONE_TEST_CHANNEL_KEY: 'channel-key-e2e',
    },
  },
});
