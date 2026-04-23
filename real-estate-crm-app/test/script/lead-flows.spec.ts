// Independent lead-management E2E spec.
// Can be run directly: npx playwright test lead-flows.spec.ts --headed
import { test } from '@playwright/test';
import { TEST_TIMEOUT_MS } from './helpers/config';
import { setupEvidence, createLogger } from './helpers/evidence';
import { loginWithPhoneOtp } from './helpers/auth';
import { runLeadFlow } from './flows/leadFlow';

test('Leads: login + full lead management E2E', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  const ctx = setupEvidence('lead-flows');
  const log = createLogger(ctx.feature);

  page.on('dialog', async (dialog) => {
    log('Dialog', 'INFO', `${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  await page.setViewportSize({ width: 1280, height: 720 });

  await test.step('Login', async () => {
    await loginWithPhoneOtp(page, ctx);
  });

  await runLeadFlow(page, ctx);
});
