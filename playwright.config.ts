import { defineConfig } from '@playwright/test';

const port = Number(process.env.CATCHHOLE_E2E_PORT ?? 3000);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI && !process.env.CATCHHOLE_E2E_PORT,
    timeout: 30_000,
  },
});
