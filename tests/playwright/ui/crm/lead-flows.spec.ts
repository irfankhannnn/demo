import { test } from '@playwright/test';
import { TEST_TIMEOUT_MS } from '../../helpers/config';
import { setupEvidence, createLogger, setupDialogHandler } from '../../helpers/evidence';
import { runLeadFlow } from '../../flows/leadFlow';

test('Leads: full lead management E2E', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  const ctx = setupEvidence('lead-flows');
  const log = createLogger(ctx.feature);
  setupDialogHandler(page, log);
  await page.setViewportSize({ width: 1280, height: 720 });
  await runLeadFlow(page, ctx);
});
