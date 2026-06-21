import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry'
  },
  testDir: './e2e',
  timeout: 30_000,
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 4173',
    reuseExistingServer: !process.env.CI,
    url: 'http://127.0.0.1:4173'
  },
  workers: 1
});
