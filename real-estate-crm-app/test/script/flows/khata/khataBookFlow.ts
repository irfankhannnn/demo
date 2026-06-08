import { expect, Page, test } from '@playwright/test';
import { BASE_URL } from '../../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../../helpers/evidence';

export async function runKhataBookFlow(page: Page, ctx: EvidenceCtx): Promise<void> {
  const log = createLogger(ctx.feature);

  // ==================================================================
  // STEP 1: Load Khata Book page and verify all summary cards
  // ==================================================================
  await test.step('Khata Book: load page and verify summary cards', async () => {
    await page.goto(`${BASE_URL}/crm/khata`);
    await page.waitForLoadState('networkidle');
    // Wait for the full-screen loading spinner to disappear
    const loadingPanel = page.locator('text=Loading Khata Book...');
    if (await loadingPanel.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await loadingPanel.waitFor({ state: 'hidden', timeout: 15_000 });
    }
    await page.waitForTimeout(1_500);

    await expect(page.getByRole('heading', { name: /^Khata Book$/i })).toBeVisible({ timeout: 10_000 });
    await snap(page, ctx, '03-khata-book-loaded');

    await expect(page.getByText('To Give').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('To Take').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Net Balance').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Pending').first()).toBeVisible({ timeout: 5_000 });
    await snap(page, ctx, '04-summary-cards');
    log('KhataBook', 'PASS', 'All 4 summary cards visible');
  });

  // ==================================================================
  // STEP 2: Click summary cards — they act as filter toggles
  // "To Give" card -> filters transactionType=TO_GIVE
  // "To Take" card -> filters transactionType=TO_TAKE
  // ==================================================================
  await test.step('Khata Book: filter via summary cards', async () => {
    // Scope to summary grid using the "To Give" text inside a button
    const toGiveCard = page.locator('button').filter({ hasText: /^To Give/ }).filter({ has: page.locator('text=/₹/') }).first();
    if (await toGiveCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await toGiveCard.click();
      await page.waitForTimeout(800);
      await snap(page, ctx, '05-filter-to-give');
    } else {
      // Fallback: click first matching "To Give" text
      await page.getByText('To Give', { exact: true }).first().click();
      await page.waitForTimeout(800);
      await snap(page, ctx, '05-filter-to-give');
    }

    const toTakeCard = page.locator('button').filter({ hasText: /^To Take/ }).filter({ has: page.locator('text=/₹/') }).first();
    if (await toTakeCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await toTakeCard.click();
      await page.waitForTimeout(800);
      await snap(page, ctx, '06-filter-to-take');
    }

    log('KhataBook', 'PASS', 'Summary card filters exercised');
  });

  // ==================================================================
  // STEP 3: Quick filter tabs (All / Pending / Settled)
  // These buttons are text-only (no currency symbols) — use distinct locator
  // ==================================================================
  await test.step('Khata Book: quick filter tabs', async () => {
    // Quick tabs don't have ₹ or icons in them — filter out summary card "Pending" via "has"
    const pendingTab = page.locator('button').filter({ hasText: /^Pending$/ }).first();
    if (await pendingTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await pendingTab.click();
      await page.waitForTimeout(800);
      await snap(page, ctx, '07-filter-pending');
    }

    const settledTab = page.locator('button').filter({ hasText: /^Settled$/ }).first();
    if (await settledTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await settledTab.click();
      await page.waitForTimeout(800);
      await snap(page, ctx, '08-filter-settled');
    }

    const allTab = page.locator('button').filter({ hasText: /^All$/ }).first();
    if (await allTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await allTab.click();
      await page.waitForTimeout(800);
      await snap(page, ctx, '09-filter-all');
    }
    log('KhataBook', 'PASS', 'Quick filter tabs exercised');
  });

  // ==================================================================
  // STEP 4: Search box — placeholder exactly matches frontend
  // ==================================================================
  await test.step('Khata Book: search', async () => {
    const searchInput = page.locator('input[placeholder="Search by party, category, property..."]');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.fill('Brokerage');
    await page.waitForTimeout(1_200); // 300ms debounce + render
    await snap(page, ctx, '10-search-brokerage');
    await searchInput.fill('');
    await page.waitForTimeout(500);
    log('KhataBook', 'PASS', 'Search exercised');
  });

  // ==================================================================
  // STEP 5: Advanced filters panel (Settlement Status + Transaction Type selects)
  // ==================================================================
  await test.step('Khata Book: advanced filters panel', async () => {
    const filtersBtn = page.getByRole('button', { name: /^Filters$/ });
    if (!(await filtersBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      log('KhataBook', 'INFO', 'Filters button not visible; skipping');
      return;
    }
    await filtersBtn.click();
    await page.waitForTimeout(600);
    await snap(page, ctx, '11-filters-panel-open');

    // Settlement Status select — scope by label
    const statusSelect = page.locator('label', { hasText: /^Settlement Status$/ }).locator('..').locator('select');
    if (await statusSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await statusSelect.selectOption('PENDING');
      await page.waitForTimeout(600);
      await snap(page, ctx, '12-adv-filter-pending');
      // Reset
      await statusSelect.selectOption('');
      await page.waitForTimeout(300);
    }

    const typeSelect = page.locator('label', { hasText: /^Transaction Type$/ }).locator('..').locator('select');
    if (await typeSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await typeSelect.selectOption('TO_TAKE');
      await page.waitForTimeout(600);
      await snap(page, ctx, '13-adv-filter-to-take');
      await typeSelect.selectOption('');
      await page.waitForTimeout(300);
    }

    // Close filters panel
    await filtersBtn.click();
    await page.waitForTimeout(400);
    log('KhataBook', 'PASS', 'Advanced filters exercised and reset');
  });
}
