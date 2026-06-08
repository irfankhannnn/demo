// Standalone Khata Book test suite.
// Single session: login once, create owner + property via UI, exercise
// the entire Khata Book surface (list, filters, entry creation, settlement,
// analytics dashboard), then cleanly return to the ledger page.
// Run: npm run test:khata
import { test } from '@playwright/test';
import { TEST_TIMEOUT_MS } from './helpers/config';
import { setupEvidence, createLogger } from './helpers/evidence';
import { loginWithPhoneOtp } from './helpers/auth';
import { buildKhataTestData } from './flows/khata/khataData';
import { createKhataOwnerAndProperty } from './flows/khata/khataSetupFlow';
import { runKhataBookFlow } from './flows/khata/khataBookFlow';
import { runKhataEntryFlow } from './flows/khata/khataEntryFlow';
import { runKhataSettlementFlow } from './flows/khata/khataSettlementFlow';

test('Khata Book: full workflow — setup, entries, settlement, analytics', async ({ page }) => {
  // Generous timeout: setup + 5 phases in a single session
  test.setTimeout(TEST_TIMEOUT_MS * 2);

  const ctx = setupEvidence('khata-flows');
  const log = createLogger(ctx.feature);

  // Auto-accept any native dialogs (avoids hangs on confirm/alert prompts)
  page.on('dialog', async (dialog) => {
    log('Dialog', 'INFO', `${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  await page.setViewportSize({ width: 1280, height: 720 });

  // Unique test data per run — avoids collisions with prior runs
  const runStamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
  const phoneBase = 7_000_000_000 + (Date.now() % 1_000_000);
  const data = buildKhataTestData(runStamp, phoneBase);

  log('Khata', 'INFO', `runStamp=${runStamp}, owner="${data.owner.name}", property="${data.property.title}"`);

  // Phase 1: Login (single session — used for the rest of the test)
  await test.step('Phase 1: Login', async () => {
    await loginWithPhoneOtp(page, ctx);
  });

  // Phase 2: UI setup — create a real owner and property
  await test.step('Phase 2: Setup — create owner and property', async () => {
    const { ownerId, propertyId } = await createKhataOwnerAndProperty(
      page,
      ctx,
      data.owner,
      data.property,
      runStamp,
    );
    log('Setup', 'INFO', `ownerId=${ownerId}, propertyId=${propertyId}`);
  });

  // Phase 3: Khata Book page — summary, filters, search
  await test.step('Phase 3: Khata Book page', async () => {
    await runKhataBookFlow(page, ctx);
  });

  // Phase 4: Create an entry and settle it via SettlementModal
  await test.step('Phase 4: Entry creation + settlement', async () => {
    await runKhataEntryFlow(page, ctx, data.owner.name, data.property.title, data.entry);
  });

  // Phase 5: Settlement Intelligence dashboard (aging, properties, history)
  await test.step('Phase 5: Settlement analytics dashboard', async () => {
    await runKhataSettlementFlow(page, ctx);
  });

  log('Khata', 'PASS', 'All Khata Book flows completed in a single session');
});
