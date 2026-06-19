import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4300';

/**
 * Playwright configuration for the AI healthcare automation suite.
 * When BASE_URL is the bundled mock app, Playwright boots it automatically
 * via `webServer`, so `npx playwright test` works with zero setup.
 */
export default defineConfig({
  testDir: './playwright/tests',
  snapshotDir: './playwright/__snapshots__',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 7_000,
    // Tolerate sub-pixel rendering noise in visual AI checks.
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' },
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    testIdAttribute: 'data-testid',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],
  // Only auto-start the mock app when targeting it. Pointing BASE_URL elsewhere skips this.
  webServer: BASE_URL.includes('127.0.0.1:4300')
    ? {
        command: 'node mock-app/server.mjs',
        url: 'http://127.0.0.1:4300/health',
        reuseExistingServer: !process.env.CI,
        timeout: 20_000,
      }
    : undefined,
});
