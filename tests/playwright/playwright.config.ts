import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { BASE_URL } from './helpers/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_CI = !!process.env.CI;

const sharedUse = {
  baseURL: BASE_URL,
  headless: !process.env.PW_HEADED,
  trace: IS_CI ? 'retain-on-failure' : 'on-first-retry',
  screenshot: 'only-on-failure',
  video: IS_CI ? 'retain-on-failure' : 'off',
  actionTimeout: 15_000,
  navigationTimeout: 20_000,
  viewport: { width: 1280, height: 720 },
  ignoreHTTPSErrors: true,
} as const;

export default defineConfig({
  name: 'cloudberry-crm-e2e',
  testDir: __dirname,
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 1,
  workers: IS_CI ? 4 : 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },

  reporter: IS_CI ? [
    ['list'],
    ['html', { outputFolder: path.join(__dirname, 'reports', 'html'), open: 'never' }],
    ['json', { outputFile: path.join(__dirname, 'reports', 'json', 'results.json') }],
    ['junit', { outputFile: path.join(__dirname, 'reports', 'junit', 'results.xml') }],
  ] : [
    ['line'],
    ['html', { outputFolder: path.join(__dirname, 'reports', 'html'), open: 'never' }],
  ],

  outputDir: path.join(__dirname, 'reports', 'artifacts'),

  projects: [
    {
      name: 'setup',
      testMatch: /setup\/auth\.setup\.ts/,
    },
    {
      name: 'chromium-public',
      use: { ...devices['Desktop Chrome'], ...sharedUse },
      testMatch: [/ui\/public\/.*\.spec\.ts/],
    },
    {
      name: 'chromium-api',
      use: { ...devices['Desktop Chrome'], ...sharedUse },
      testMatch: [/api\/.*\.spec\.ts/],
    },
    {
      name: 'chromium-crm',
      use: {
        ...devices['Desktop Chrome'],
        ...sharedUse,
        storageState: path.join(__dirname, '.auth', 'user.json'),
      },
      dependencies: ['setup'],
      testMatch: [/ui\/crm\/.*\.spec\.ts/],
    },
    ...(IS_CI ? [{
      name: 'firefox-crm',
      use: {
        ...devices['Desktop Firefox'],
        ...sharedUse,
        storageState: path.join(__dirname, '.auth', 'user.json'),
      },
      dependencies: ['setup'],
      testMatch: [/ui\/crm\/.*\.spec\.ts/],
    }] : []),

    /*
     * Mobile projects. Every project above pins viewport 1280x720, so the
     * entire suite only ever exercised desktop layouts — the app shipped 32+
     * pages its own tracker flagged as not mobile-ready without a single test
     * that would have noticed.
     *
     * These deliberately do NOT spread sharedUse: it would override the device
     * descriptor's viewport, deviceScaleFactor, isMobile and hasTouch and turn
     * them straight back into desktop runs.
     */
    {
      name: 'mobile-android',
      use: {
        ...devices['Pixel 7'],
        baseURL: BASE_URL,
        headless: !process.env.PW_HEADED,
        trace: IS_CI ? 'retain-on-failure' : 'on-first-retry',
        screenshot: 'only-on-failure',
        actionTimeout: 15_000,
        navigationTimeout: 20_000,
        ignoreHTTPSErrors: true,
        storageState: path.join(__dirname, '.auth', 'user.json'),
      },
      dependencies: ['setup'],
      testMatch: [/ui\/mobile\/.*\.spec\.ts/],
    },
    {
      name: 'mobile-ios',
      use: {
        ...devices['iPhone 14 Pro'],
        baseURL: BASE_URL,
        headless: !process.env.PW_HEADED,
        trace: IS_CI ? 'retain-on-failure' : 'on-first-retry',
        screenshot: 'only-on-failure',
        actionTimeout: 15_000,
        navigationTimeout: 20_000,
        ignoreHTTPSErrors: true,
        storageState: path.join(__dirname, '.auth', 'user.json'),
      },
      dependencies: ['setup'],
      testMatch: [/ui\/mobile\/.*\.spec\.ts/],
    },
  ],

  webServer: {
    command: 'cd ../../apps/crm/real-estate-crm-app && npm run dev',
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !IS_CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      VITE_RAZORPAY_KEY_ID: process.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_playwright',
    },
  },
});
