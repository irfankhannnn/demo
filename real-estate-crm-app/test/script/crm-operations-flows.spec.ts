// Independent CRM operations spec (calendar, analytics, khata, ai-calling).
// Run: npx playwright test crm-operations-flows.spec.ts --headed
import { test } from '@playwright/test';
import { TEST_TIMEOUT_MS } from './helpers/config';
import { setupEvidence, createLogger } from './helpers/evidence';
import { loginWithPhoneOtp } from './helpers/auth';
import { runCrmOperationsFlow } from './flows/crmOperationsFlow';

test('CRM Operations: login + calendar/analytics/khata/ai-calling', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  const ctx = setupEvidence('crm-operations');
  const log = createLogger(ctx.feature);

  page.on('dialog', async (dialog) => {
    log('Dialog', 'INFO', `${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  await page.setViewportSize({ width: 1280, height: 720 });

  await test.step('Login', async () => {
    await loginWithPhoneOtp(page, ctx);
  });

  await runCrmOperationsFlow(page, ctx);
});
