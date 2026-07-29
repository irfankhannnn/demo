import { test } from '@playwright/test';
import { TEST_TIMEOUT_MS } from '../../helpers/config';
import { setupEvidence, createLogger, setupDialogHandler } from '../../helpers/evidence';
import { createTestRun } from '../../helpers/seedData';
import { buildKhataTestData } from '../../flows/khata/khataData';
import { createKhataOwnerAndProperty } from '../../flows/khata/khataSetupFlow';
import { runKhataBookFlow } from '../../flows/khata/khataBookFlow';
import { runKhataEntryFlow } from '../../flows/khata/khataEntryFlow';
import { runKhataSettlementFlow } from '../../flows/khata/khataSettlementFlow';

test('Khata Book: full workflow — setup, entries, settlement, analytics', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS * 2);
  const ctx = setupEvidence('khata-flows');
  const log = createLogger(ctx.feature);
  setupDialogHandler(page, log);
  await page.setViewportSize({ width: 1280, height: 720 });

  const run = createTestRun();
  const data = buildKhataTestData(run);

  log('Khata', 'INFO', `runId=${run.runId}, owner="${data.owner.name}", property="${data.property.title}"`);

  try {
    await test.step('Phase 1: Setup — create owner and property', async () => {
      const { ownerId, propertyId } = await createKhataOwnerAndProperty(page, ctx, data.owner, data.property, run.runStamp);
      log('Setup', 'INFO', `ownerId=${ownerId}, propertyId=${propertyId}`);
    });
  } catch (err: any) {
    if (err?.message?.includes('502')) {
      test.skip(true, 'Backend auth service returning 502 — skipping khata test');
    }
    throw err;
  }

  await test.step('Phase 2: Khata Book page', async () => {
    await runKhataBookFlow(page, ctx);
  });
  await test.step('Phase 3: Entry creation + settlement', async () => {
    await runKhataEntryFlow(page, ctx, data.owner.name, data.property.title, data.entry);
  });
  await test.step('Phase 4: Settlement analytics dashboard', async () => {
    await runKhataSettlementFlow(page, ctx);
  });

  log('Khata', 'PASS', 'All Khata Book flows completed in a single session');
});
