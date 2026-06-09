import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * Technician E2E test config.
 *
 * Two engines on purpose:
 *  - chromium-mobile: primary path. Background Sync API supported.
 *  - webkit-mobile: iOS Safari surrogate. Verifies online-event fallback path.
 *
 * The dev server is reused if already running so multiple test runs avoid
 * cold starts.
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalTeardown: './tests/e2e/qa/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : Number(process.env.PLAYWRIGHT_WORKERS ?? 10),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 375, height: 812 },
        permissions: ['geolocation'],
        geolocation: { latitude: -6.2088, longitude: 106.8456 }, // Jakarta default
      },
    },
    {
      name: 'webkit-mobile',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 375, height: 812 },
        permissions: ['geolocation'],
        geolocation: { latitude: -6.2088, longitude: 106.8456 },
      },
    },
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      // Dedicated project for the QA E2E suite. Runs against chromium with a
      // wider mobile viewport so admin/finance dashboard pages render in their
      // intended layout while still keeping the technician PWA testable.
      name: 'qa',
      testDir: './tests/e2e',
      testMatch: ['qa/**/*.spec.ts', 'auth-smoke.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        permissions: ['geolocation'],
        geolocation: { latitude: -6.2088, longitude: 106.8456 },
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'bun run dev',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
