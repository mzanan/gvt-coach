import { defineConfig, devices } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { E2E_DATABASE_URL } from './e2e/database';

loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3120',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `DATABASE_URL='${E2E_DATABASE_URL}' npx next dev --turbopack -p 3120`,
    url: 'http://localhost:3120',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
