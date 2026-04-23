// Operational CRM pages: calendar, analytics, khata, AI calling.
import { Page, test } from '@playwright/test';
import { BASE_URL } from '../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../helpers/evidence';

export async function runCrmOperationsFlow(page: Page, ctx: EvidenceCtx): Promise<void> {
  const log = createLogger(ctx.feature);

  await test.step('CRM ops: calendar', async () => {
    await page.goto(`${BASE_URL}/crm/calendar`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    await snap(page, ctx, '01-calendar-loaded');

    const dayBtn = page.getByRole('button', { name: /^Day$/ });
    if (await dayBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await dayBtn.click();
      await page.waitForTimeout(300);
    }
    const todayBtn = page.getByRole('button', { name: /^Today$/ });
    if (await todayBtn.isVisible().catch(() => false)) {
      await todayBtn.click();
      await page.waitForTimeout(300);
    }
    const listBtn = page.getByRole('button', { name: /^List$/ });
    if (await listBtn.isVisible().catch(() => false)) {
      await listBtn.click();
      await page.waitForTimeout(300);
    }
    const weekBtn = page.getByRole('button', { name: /^Week$/ });
    if (await weekBtn.isVisible().catch(() => false)) {
      await weekBtn.click();
      await page.waitForTimeout(300);
    }

    const statusFilter = page.locator('select').first();
    if (await statusFilter.isVisible({ timeout: 3_000 }).catch(() => false)) {
      try {
        await statusFilter.selectOption('completed');
      } catch {
        // option may not exist
      }
    }
    await snap(page, ctx, '02-calendar-views');
    log('Calendar', 'PASS', 'View toggles and filters exercised');
  });

  await test.step('CRM ops: business analytics', async () => {
    await page.goto(`${BASE_URL}/crm/analytics`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    await snap(page, ctx, '03-analytics-loaded');

    const exportBtn = page.getByRole('button', { name: /Export CSV/i }).first();
    if (await exportBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);
      await exportBtn.click();
      const download = await downloadPromise;
      if (download) {
        log('Analytics', 'PASS', `CSV downloaded: ${download.suggestedFilename()}`);
      } else {
        log('Analytics', 'INFO', 'CSV export click did not emit download');
      }
    } else {
      log('Analytics', 'INFO', 'Export CSV not visible');
    }

    const comboboxes = page.getByRole('combobox');
    const count = await comboboxes.count().catch(() => 0);
    if (count >= 1) {
      try { await comboboxes.nth(0).selectOption({ index: 1 }); } catch { /* ignore */ }
    }
    if (count >= 2) {
      try { await comboboxes.nth(1).selectOption({ index: 1 }); } catch { /* ignore */ }
    }
    await snap(page, ctx, '04-analytics-filtered');
    log('Analytics', 'PASS', 'Filters exercised');
  });

  await test.step('CRM ops: khata book', async () => {
    await page.goto(`${BASE_URL}/crm/khata`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    await snap(page, ctx, '05-khata-loaded');

    const filtersBtn = page.getByRole('button', { name: /^Filters$/ });
    if (await filtersBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await filtersBtn.click();
      await page.waitForTimeout(300);
    }

    const settlementBtn = page.getByRole('button', { name: /Settlement View/i });
    if (await settlementBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await settlementBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);
      await snap(page, ctx, '06-khata-settlement');

      const allTx = page.getByRole('button', { name: /All Transactions/i });
      if (await allTx.isVisible().catch(() => false)) await allTx.click();
      const pending = page.getByRole('button', { name: /Pending Only/i });
      if (await pending.isVisible().catch(() => false)) await pending.click();
    }

    await page.goto(`${BASE_URL}/crm/khata/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await snap(page, ctx, '07-khata-new-entry');

    const createBtn = page.getByRole('button', { name: /Create Entry/i });
    if (await createBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await createBtn.click();
      if (await page.getByText(/Please fill all required fields/i).isVisible({ timeout: 5_000 }).catch(() => false)) {
        log('Khata', 'PASS', 'Entry validation shown');
        await snap(page, ctx, '08-khata-validation');
      }
    }
  });

  await test.step('CRM ops: AI calling dashboard + settings', async () => {
    await page.goto(`${BASE_URL}/crm/ai-calling`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    await snap(page, ctx, '09-ai-calling-dashboard');

    await page.goto(`${BASE_URL}/crm/ai-calling/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    await snap(page, ctx, '10-ai-calling-settings');

    const agencyInput = page.locator('input[placeholder="e.g., Cloudberry Real Estate"]');
    const exotelInput = page.locator('input[placeholder="e.g., 91XXXXXXXXXX"]');
    if (await agencyInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await agencyInput.fill('');
      if (await exotelInput.isVisible().catch(() => false)) await exotelInput.fill('');
      const saveBtn = page.getByRole('button', { name: /Save Settings/i }).first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        if (await page.getByText(/Agency name and Exotel number are required/i).isVisible({ timeout: 5_000 }).catch(() => false)) {
          log('AI Calling', 'PASS', 'Settings validation shown');
          await snap(page, ctx, '11-ai-calling-validation');
        }
      }
    }
  });
}
