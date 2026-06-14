import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for the boilerplate's E2E smoke suite.
 * Strategy: docs/workflows/03-qa-e2e.md — few, fast, critical-journey tests only.
 *
 * Override the target with E2E_BASE_URL. The optional webServer block boots the app
 * for local/CI runs — point `command` at your dev/preview script and remove if you
 * start the app yourself.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests',
  // Independent & idempotent tests → safe to parallelize.
  fullyParallel: true,
  // Fail CI if someone left a `test.only` in the suite.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL,
    // Diagnostics only when something fails — keeps the suite fast.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Add cross-browser only when a journey actually needs it:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari'] } },
  ],

  // Boot the app for the test run. Remove if you run it separately.
  // webServer: {
  //   command: 'npm run dev',
  //   url: baseURL,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
})
