// Shared configuration for all test suites.
import * as path from 'path';

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
export const TEST_PHONE = '8291537522';
export const TEST_OTP = '123456';

export const TEST_TIMEOUT_MS = 300_000;

// Path to dummy upload assets used by file-input tests
export const ASSETS_DIR = path.resolve(__dirname, '../../evidences/assets');
