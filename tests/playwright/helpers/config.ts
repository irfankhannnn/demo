import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function env(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${key}\n` +
      `Create tests/playwright/.env from .env.example and fill in values.`
    );
  }
  return value;
}

export const BASE_URL = env('PLAYWRIGHT_BASE_URL');
export const API_URL = env('PLAYWRIGHT_API_URL');
export const TEST_PHONE = env('TEST_PHONE');
export const TEST_OTP = env('TEST_OTP');

export const TEST_TIMEOUT_MS = 120_000;

export const ASSETS_DIR = path.resolve(__dirname, '..', 'fixtures', 'assets');
