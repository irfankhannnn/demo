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

  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(__dirname, 'reports', 'html'), open: 'never' }],
    ['json', { outputFile: path.join(__dirname, 'reports', 'json', 'results.json') }],
    ['junit', { outputFile: path.join(__dirname, 'reports', 'junit', 'results.xml') }],
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
  ],

  webServer: {
    command: 'cd ../../real-estate-crm-app && npm run dev',
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !IS_CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
