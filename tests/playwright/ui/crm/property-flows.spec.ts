import { test, expect } from '@playwright/test';
import { TEST_TIMEOUT_MS, BASE_URL } from '../../helpers/config';
import { fetchOwnersFromApi, fetchOwnersFromListPage, fetchSellersFromApi } from '../../helpers/crmApi';
import { setupEvidence, createLogger, setupDialogHandler, snap } from '../../helpers/evidence';
import { createPropertiesForOwners, resolveOwnerTargets } from '../../flows/propertyFlow';

const MAX_PER_GROUP = parseInt(process.env.PROPERTY_TEST_MAX_PER_GROUP || '0', 10);

test.describe('Property flows: create from live owner/seller lists', () => {
  test('Owners list → create for-rent property per owner', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS * Math.max(3, MAX_PER_GROUP + 1));
    const ctx = setupEvidence('property-flows-owners');
    const log = createLogger(ctx.feature);
    setupDialogHandler(page, log);
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto(`${BASE_URL}/crm`);
    await page.waitForLoadState('networkidle');

    const owners = await test.step('Fetch owners from Owners list', async () => {
      const list = await fetchOwnersFromListPage(page, false);
      const targets = resolveOwnerTargets(list, MAX_PER_GROUP);
      log('OwnersFetch', 'PASS', `Loaded ${list.length} owner(s); will create for ${targets.length}`);
      await snap(page, ctx, '01-owners-list');
      expect(targets.length).toBeGreaterThan(0);
      return list;
    });

    const created = await createPropertiesForOwners(page, ctx, owners, 'for-rent', {
      maxCount: MAX_PER_GROUP > 0 ? MAX_PER_GROUP : undefined,
    });

    expect(created.length).toBeGreaterThan(0);
    const uniqueOwners = new Set(created.map((p) => p.ownerId));
    expect(uniqueOwners.size).toBe(created.length);
    log('OwnersProperties', 'PASS', `Created ${created.length} for-rent propert(ies) across ${uniqueOwners.size} owner(s)`);
  });

  test('Sellers list → create for-sale property per seller', async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT_MS * Math.max(3, MAX_PER_GROUP + 1));
    const ctx = setupEvidence('property-flows-sellers');
    const log = createLogger(ctx.feature);
    setupDialogHandler(page, log);
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto(`${BASE_URL}/crm`);
    await page.waitForLoadState('networkidle');

    await test.step('Sellers list loads from Contact seller profiles', async () => {
      await page.goto(`${BASE_URL}/crm/owners?sellers=1`);
      await page.waitForLoadState('networkidle');
      await page.getByRole('heading', { name: /Sellers/i }).first().waitFor({ state: 'visible', timeout: 15_000 });
      await snap(page, ctx, '01-sellers-list');
      const fromApi = await fetchSellersFromApi(page);
      log('SellersFetch', 'INFO', `Found ${fromApi.length} seller(s) from Sellers list`);
    });

    // Property create UI binds to OWNER entity ids. Always create from owners list
    // after verifying the sellers page loads (Contact-based sellers list is Phase 5).
    const ownersForCreate = await fetchOwnersFromApi(page, { limit: 200 });
    if (ownersForCreate.length === 0) {
      test.skip(true, 'No owners in CRM — create an owner first');
    }

    const created = await createPropertiesForOwners(page, ctx, ownersForCreate, 'for-sale', {
      maxCount: MAX_PER_GROUP > 0 ? MAX_PER_GROUP : undefined,
    });

    expect(created.length).toBeGreaterThan(0);
    const uniqueOwners = new Set(created.map((p) => p.ownerId));
    expect(uniqueOwners.size).toBe(created.length);
    log('SellerProperties', 'PASS', `Created ${created.length} for-sale propert(ies) across ${uniqueOwners.size} owner(s)`);
  });
});
