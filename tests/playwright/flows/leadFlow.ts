import { expect, Page, test } from '@playwright/test';
import { BASE_URL } from '../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../helpers/evidence';
import { createTestRun } from '../helpers/seedData';
import {
  buildCompleteLeadFixtures,
  buildBuyerLeadFixture,
  buildSellerLeadFixture,
  buildTenantLeadFixture,
  buildOwnerLeadFixture,
  type CompleteLeadFixture,
} from '../helpers/leadFixtures';
import {
  createLeadViaUi,
  assertLeadPersisted,
} from '../helpers/leadFormHelpers';

export async function runLeadFlow(page: Page, ctx: EvidenceCtx): Promise<void> {
  const log = createLogger(ctx.feature);
  const run = createTestRun();
  const fixtures = buildCompleteLeadFixtures(run);
  const createdLeadIds: string[] = [];

  await test.step('Leads: navigate to list page', async () => {
    await page.goto(`${BASE_URL}/crm/leads`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').filter({ hasText: 'Leads' })).toBeVisible({ timeout: 8_000 });
    await snap(page, ctx, '06-leads-page');
    log('Leads', 'PASS', 'Leads page loaded');
  });

  for (let i = 0; i < fixtures.length; i += 1) {
    const lead = fixtures[i];
    await test.step(`Leads: create ${lead.leadType} lead with all fields — ${lead.name}`, async () => {
      const { leadId } = await createLeadViaUi(page, lead, log);
      createdLeadIds.push(leadId);
      await assertLeadPersisted(page, leadId, lead);
      log('LeadCreate', 'PASS', `Created & verified ${lead.leadType} lead: ${lead.name} (${leadId})`);
      await snap(page, ctx, `07-lead-${lead.leadType}-${i + 1}-verified`);
    });
  }

  await test.step('Leads: search finds first created lead', async () => {
    await page.goto(`${BASE_URL}/crm/leads`);
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill(fixtures[0].name);
      await page.waitForTimeout(1_200);
      await snap(page, ctx, '08-leads-search');
      await expect(page.locator('body')).toContainText(fixtures[0].name);
      log('LeadSearch', 'PASS', 'Created lead found in search results');
    }
  });

  log(
    'Leads',
    'PASS',
    `Lead flow completed — ${createdLeadIds.length} leads created with full field coverage (buyer, seller, tenant, owner)`,
  );
}

/** Create and verify a single lead subtype (used by focused spec tests). */
export async function runSingleLeadCreation(
  page: Page,
  ctx: EvidenceCtx,
  fixture: CompleteLeadFixture,
): Promise<string> {
  const log = createLogger(ctx.feature);
  const { leadId } = await createLeadViaUi(page, fixture, log);
  await assertLeadPersisted(page, leadId, fixture);
  await snap(page, ctx, `lead-${fixture.leadType}-verified`);
  return leadId;
}

export {
  buildBuyerLeadFixture,
  buildSellerLeadFixture,
  buildTenantLeadFixture,
  buildOwnerLeadFixture,
  buildCompleteLeadFixtures,
  createTestRun,
};
