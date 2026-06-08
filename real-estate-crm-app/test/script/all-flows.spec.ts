// Master suite: runs all feature flows in one browser session after a single login.
// Each feature still lives in its own spec file and can be run independently.
// Run: npx playwright test all-flows.spec.ts --headed
import { test } from '@playwright/test';
import { TEST_TIMEOUT_MS } from './helpers/config';
import { setupEvidence, createLogger } from './helpers/evidence';
import { loginWithPhoneOtp } from './helpers/auth';
import { runLeadFlow } from './flows/leadFlow';
import { runAdminUiFlow } from './flows/adminUiFlow';
import { runCrmOperationsFlow } from './flows/crmOperationsFlow';
import { runDashboardCoreFlow } from './flows/dashboardCoreFlow';
import { buildKhataTestData } from './flows/khata/khataData';
import { createKhataOwnerAndProperty } from './flows/khata/khataSetupFlow';
import { runKhataBookFlow } from './flows/khata/khataBookFlow';
import { runKhataEntryFlow } from './flows/khata/khataEntryFlow';
import { runKhataSettlementFlow } from './flows/khata/khataSettlementFlow';

test('All flows: login + leads + admin + crm ops + khata', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS * 3);

  const allCtx = setupEvidence('all-flows');
  const leadCtx = setupEvidence('lead-flows');
  const adminCtx = setupEvidence('admin-ui');
  const opsCtx = setupEvidence('crm-operations');
  const log = createLogger(allCtx.feature);

  page.on('dialog', async (dialog) => {
    log('Dialog', 'INFO', `${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  await page.setViewportSize({ width: 1280, height: 720 });

  await test.step('Login (shared)', async () => {
    await loginWithPhoneOtp(page, allCtx);
  });

  await test.step('Run lead-flows', async () => {
    await runLeadFlow(page, leadCtx);
  });

  await test.step('Run admin-ui', async () => {
    await runAdminUiFlow(page, adminCtx);
  });

  await test.step('Run crm-operations', async () => {
    await runCrmOperationsFlow(page, opsCtx);
  });

  await test.step('Run dashboard-operations', async () => {
    const dashboardCtx = setupEvidence('dashboard-operations');
    await runDashboardCoreFlow(page, dashboardCtx);
  });

  await test.step('Run khata-flows', async () => {
    const khataCtx = setupEvidence('khata-flows');
    const runStamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
    const phoneBase = 7_000_000_000 + (Date.now() % 1_000_000);
    const data = buildKhataTestData(runStamp, phoneBase);
    await createKhataOwnerAndProperty(page, khataCtx, data.owner, data.property, runStamp);
    await runKhataBookFlow(page, khataCtx);
    await runKhataEntryFlow(page, khataCtx, data.owner.name, data.property.title, data.entry);
    await runKhataSettlementFlow(page, khataCtx);
  });

  log('All flows', 'PASS', 'Completed all feature suites');
});
