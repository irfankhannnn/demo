import { test } from '@playwright/test';
import { TEST_TIMEOUT_MS } from '../../helpers/config';
import { setupEvidence, createLogger, setupDialogHandler } from '../../helpers/evidence';
import {
  runLeadFlow,
  runSingleLeadCreation,
  buildBuyerLeadFixture,
  buildSellerLeadFixture,
  buildTenantLeadFixture,
  buildOwnerLeadFixture,
  createTestRun,
} from '../../flows/leadFlow';

test.describe('Leads: comprehensive field coverage', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS);
    setupDialogHandler(page, createLogger('lead-flows'));
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('full E2E — all four lead subtypes with every UI field populated', async ({ page }) => {
    const ctx = setupEvidence('lead-flows-all');
    await runLeadFlow(page, ctx);
  });

  test('buyer lead — all Buyer Requirements + shared fields', async ({ page }) => {
    const ctx = setupEvidence('lead-flows-buyer');
    const run = createTestRun();
    await runSingleLeadCreation(page, ctx, buildBuyerLeadFixture(run, 1));
  });

  test('seller lead — all Property for Sale + shared fields', async ({ page }) => {
    const ctx = setupEvidence('lead-flows-seller');
    const run = createTestRun();
    await runSingleLeadCreation(page, ctx, buildSellerLeadFixture(run, 11));
  });

  test('tenant lead — all Rental Requirements + lost reason + shared fields', async ({ page }) => {
    const ctx = setupEvidence('lead-flows-tenant');
    const run = createTestRun();
    await runSingleLeadCreation(page, ctx, buildTenantLeadFixture(run, 21));
  });

  test('owner lead — all Property for Rent + shared fields', async ({ page }) => {
    const ctx = setupEvidence('lead-flows-owner');
    const run = createTestRun();
    await runSingleLeadCreation(page, ctx, buildOwnerLeadFixture(run, 31));
  });
});
