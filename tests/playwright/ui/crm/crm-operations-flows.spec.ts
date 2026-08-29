import { test } from '@playwright/test';
import { TEST_TIMEOUT_MS } from '../../helpers/config';
import { setupEvidence, createLogger, setupDialogHandler } from '../../helpers/evidence';
import { runCrmOperationsFlow } from '../../flows/crmOperationsFlow';

test('CRM Operations: calendar/analytics/hierarchy/b2b-leads', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  const ctx = setupEvidence('crm-operations');
  const log = createLogger(ctx.feature);
  setupDialogHandler(page, log);
  await page.setViewportSize({ width: 1280, height: 720 });
  await runCrmOperationsFlow(page, ctx);
});
