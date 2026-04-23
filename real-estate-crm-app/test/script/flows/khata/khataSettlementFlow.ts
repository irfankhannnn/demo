import { expect, Page, test } from '@playwright/test';
import { BASE_URL } from '../../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../../helpers/evidence';

export async function runKhataSettlementFlow(page: Page, ctx: EvidenceCtx): Promise<void> {
  const log = createLogger(ctx.feature);

  // ==================================================================
  // STEP 1: Navigate to Settlement Intelligence page
  // Route: /crm/khata/settlement
  // Trigger: "Settlement View" button on KhataBook page
  // ==================================================================
  await test.step('Settlement: navigate from Khata Book', async () => {
    await page.goto(`${BASE_URL}/crm/khata`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    const settlementBtn = page.getByRole('button', { name: /Settlement View/i });
    if (await settlementBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await settlementBtn.click();
    } else {
      await page.goto(`${BASE_URL}/crm/khata/settlement`);
    }

    await page.waitForLoadState('networkidle');
    await page.waitForURL(/\/crm\/khata\/settlement/, { timeout: 10_000 });
    await page.waitForTimeout(2_000); // Let all 4 parallel API calls finish

    await expect(page.getByRole('heading', { name: /Settlement Intelligence/i })).toBeVisible({ timeout: 10_000 });
    await snap(page, ctx, '27-settlement-view');
    log('Settlement', 'PASS', 'Settlement dashboard loaded');
  });

  // ==================================================================
  // STEP 2: Verify the 4 KPI cards
  // From KhataSettlement.tsx: "Avg Pending Age", "Overdue (60+ days)",
  //                          "Settlement Rate", "Settled This Month"
  // ==================================================================
  await test.step('Settlement: verify KPI cards', async () => {
    const cardLabels = [
      /Avg Pending Age/i,
      /Overdue.*60/i,
      /Settlement Rate/i,
      /Settled This Month/i,
    ];
    for (const label of cardLabels) {
      const visible = await page.getByText(label).first().isVisible({ timeout: 3_000 }).catch(() => false);
      log('Settlement', visible ? 'PASS' : 'INFO', `KPI: ${label}`);
    }
    await snap(page, ctx, '28-kpi-cards');
  });

  // ==================================================================
  // STEP 3: Aging Analysis tab (default active) — expand a bucket
  // Bucket labels come from backend: "0-30 days", "31-60 days",
  //                                  "61-90 days", "Over 90 days"
  // ==================================================================
  await test.step('Settlement: Aging Analysis tab — expand bucket', async () => {
    const agingTab = page.getByRole('button', { name: /Aging Analysis/i });
    if (await agingTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await agingTab.click();
      await page.waitForTimeout(800);
    }
    await snap(page, ctx, '29-aging-tab');

    // Try to expand any bucket that has entries (count > 0)
    // Buckets are buttons containing bucket label + entry count
    const bucketButtons = page.locator('button').filter({ hasText: /entries?$/ });
    const bucketCount = await bucketButtons.count();
    log('Settlement', 'INFO', `Aging buckets found: ${bucketCount}`);

    if (bucketCount > 0) {
      // Click the first bucket that shows at least 1 entry
      for (let i = 0; i < bucketCount; i++) {
        const btn = bucketButtons.nth(i);
        const text = (await btn.textContent()) || '';
        if (/\b[1-9]\d*\s+(entry|entries)/i.test(text)) {
          await btn.click();
          await page.waitForTimeout(800);
          await snap(page, ctx, '30-aging-expanded');
          log('Settlement', 'PASS', `Expanded bucket: ${text.slice(0, 40)}`);
          break;
        }
      }
    }
  });

  // ==================================================================
  // STEP 4: Properties tab — search + sort
  // Tab label: "Properties"
  // Search placeholder: "Search properties..." (inferred)
  // ==================================================================
  await test.step('Settlement: Properties tab — search and sort', async () => {
    const propertiesTab = page.getByRole('button', { name: /^Properties/i }).first();
    if (await propertiesTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await propertiesTab.click();
      await page.waitForTimeout(1_000);
      await snap(page, ctx, '31-properties-tab');
    }

    // Property search input — placeholder varies; search by partial match
    const propSearch = page.locator('input[placeholder*="Search" i]').last();
    if (await propSearch.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await propSearch.fill('Andheri');
      await page.waitForTimeout(800);
      await snap(page, ctx, '32-property-search');
      await propSearch.fill('');
      await page.waitForTimeout(400);
    }

    // Sort select — try first select on this tab
    const sortSelect = page.locator('select').first();
    if (await sortSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const options = await sortSelect.locator('option').allTextContents();
      if (options.length > 1) {
        // Pick the 2nd option (first is default)
        await sortSelect.selectOption({ index: 1 });
        await page.waitForTimeout(600);
        await snap(page, ctx, '33-property-sorted');
      }
    }
    log('Settlement', 'PASS', 'Properties tab exercised');
  });

  // ==================================================================
  // STEP 5: Settlement History tab
  // Tab label: "Settlement History"
  // ==================================================================
  await test.step('Settlement: History tab', async () => {
    const historyTab = page.getByRole('button', { name: /Settlement History/i });
    if (await historyTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await historyTab.click();
      await page.waitForTimeout(1_000);
      await snap(page, ctx, '34-history-tab');
      log('Settlement', 'PASS', 'History tab exercised');
    } else {
      log('Settlement', 'INFO', 'History tab not found');
    }
  });

  // ==================================================================
  // STEP 6: Return to Khata Book via header back button — keeps single session
  // ==================================================================
  await test.step('Settlement: return to Khata Book', async () => {
    const backBtn = page.getByRole('button', { name: /Back to Khata Book/i });
    if (await backBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForURL(/\/crm\/khata(\?|$|#)/, { timeout: 10_000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      log('Settlement', 'PASS', 'Returned to Khata Book cleanly');
    }
  });
}
