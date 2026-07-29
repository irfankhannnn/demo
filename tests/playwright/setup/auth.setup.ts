import { test as setup } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { loginWithPhoneOtp } from '../helpers/auth';
import { writeApiAuthCache } from '../helpers/apiAuth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '..', '.auth', 'user.json');

setup('authenticate', async ({ page }) => {
  await loginWithPhoneOtp(page);

  const auth = await page.evaluate(() => {
    const token = localStorage.getItem('auth_id_token')
      || localStorage.getItem('auth_access_token')
      || '';
    let tenantId: string | null = null;
    try {
      const profile = JSON.parse(localStorage.getItem('auth_user_profile') || '{}');
      tenantId = profile.tenantId || null;
    } catch {
      tenantId = null;
    }
    let exp: number | null = null;
    try {
      if (token.includes('.')) {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        exp = payload.exp || null;
        if (!tenantId) tenantId = payload.tenantId || payload['custom:tenantId'] || null;
      }
    } catch {
      exp = null;
    }
    return { token, tenantId, exp };
  });

  if (auth.token) {
    writeApiAuthCache(auth);
  }

  await page.context().storageState({ path: authFile });
});
