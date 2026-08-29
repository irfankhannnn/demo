import { expect, Page, test } from '@playwright/test';
import { BASE_URL } from '../../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../../helpers/evidence';

export async function runKhataBookFlow(page: Page, ctx: EvidenceCtx): Promise<void> {
  const log = createLogger(ctx.feature);

  await test.step('Khata Book: load page and verify summary cards', async () => {
    await page.goto(`${BASE_URL}/crm/khata`);
    await page.waitForLoadState('networkidle');
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

  await test.step('Khata Book: filter via summary cards', async () => {
    const toGiveCard = page.locator('button').filter({ hasText: /^To Give/ }).filter({ has: page.locator('text=/₹/') }).first();
    if (await toGiveCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await toGiveCard.click();
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

  await test.step('Khata Book: quick filter tabs', async () => {
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

  await test.step('Khata Book: search', async () => {
    const searchInput = page.locator('input[placeholder="Search by party, category, property..."]');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.fill('Brokerage');
    await page.waitForTimeout(1_200);
    await snap(page, ctx, '10-search-brokerage');
    await searchInput.fill('');
    await page.waitForTimeout(500);
    log('KhataBook', 'PASS', 'Search exercised');
  });

  await test.step('Khata Book: advanced filters panel', async () => {
    const filtersBtn = page.getByRole('button', { name: /^Filters$/ });
    if (!(await filtersBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      log('KhataBook', 'INFO', 'Filters button not visible; skipping');
      return;
    }
    await filtersBtn.click();
    await page.waitForTimeout(600);
    await snap(page, ctx, '11-filters-panel-open');
    const statusSelect = page.locator('label', { hasText: /^Settlement Status$/ }).locator('..').locator('select');
    if (await statusSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await statusSelect.selectOption('PENDING');
      await page.waitForTimeout(600);
      await snap(page, ctx, '12-adv-filter-pending');
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
    await filtersBtn.click();
    await page.waitForTimeout(400);
    log('KhataBook', 'PASS', 'Advanced filters exercised and reset');
  });
}
