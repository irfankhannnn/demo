// Independent admin UI spec (invites + members).
// Run: npx playwright test admin-ui-flows.spec.ts --headed
import { test } from '@playwright/test';
import { TEST_TIMEOUT_MS } from './helpers/config';
import { setupEvidence, createLogger } from './helpers/evidence';
import { loginWithPhoneOtp } from './helpers/auth';
import { runAdminUiFlow } from './flows/adminUiFlow';

test('Admin UI: login + invite/member flows', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  const ctx = setupEvidence('admin-ui');
  const log = createLogger(ctx.feature);

  page.on('dialog', async (dialog) => {
    log('Dialog', 'INFO', `${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  await page.setViewportSize({ width: 1280, height: 720 });

  await test.step('Login', async () => {
    await loginWithPhoneOtp(page, ctx);
  });

  await runAdminUiFlow(page, ctx);
});
