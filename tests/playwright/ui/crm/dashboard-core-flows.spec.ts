import { test } from '@playwright/test';
import { TEST_TIMEOUT_MS } from '../../helpers/config';
import { setupEvidence, createLogger, setupDialogHandler } from '../../helpers/evidence';
import { runDashboardCoreFlow } from '../../flows/dashboardCoreFlow';

test('CRM dashboard: core entity operations', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS * 2);
  const ctx = setupEvidence('dashboard-operations');
  const log = createLogger(ctx.feature);
  setupDialogHandler(page, log);
  await page.setViewportSize({ width: 1280, height: 720 });
  try {
    await runDashboardCoreFlow(page, ctx);
  } catch (err: any) {
    if (err?.message?.includes('502')) {
      test.skip(true, 'Backend auth service returning 502 — skipping dashboard test');
    }
    throw err;
  }
});
