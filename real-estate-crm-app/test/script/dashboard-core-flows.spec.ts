// Independent CRM dashboard operations spec.
// Run: npx playwright test dashboard-core-flows.spec.ts --headed
import { test } from '@playwright/test';
import { TEST_TIMEOUT_MS } from './helpers/config';
import { setupEvidence, createLogger } from './helpers/evidence';
import { loginWithPhoneOtp } from './helpers/auth';
import { runDashboardCoreFlow } from './flows/dashboardCoreFlow';

test('CRM dashboard: core entity operations', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS * 2);
  const ctx = setupEvidence('dashboard-operations');
  const log = createLogger(ctx.feature);

  page.on('dialog', async (dialog) => {
    log('Dialog', 'INFO', `${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  await page.setViewportSize({ width: 1280, height: 720 });

  await test.step('Login', async () => {
    await loginWithPhoneOtp(page, ctx);
  });

  await runDashboardCoreFlow(page, ctx);
});
