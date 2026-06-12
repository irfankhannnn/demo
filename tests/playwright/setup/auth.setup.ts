import { test as setup } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { loginWithPhoneOtp } from '../helpers/auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '..', '.auth', 'user.json');

setup('authenticate', async ({ page }) => {
  await loginWithPhoneOtp(page);
  await page.context().storageState({ path: authFile });
});
