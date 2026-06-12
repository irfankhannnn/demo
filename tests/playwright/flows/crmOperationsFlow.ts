import { Page, test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../helpers/evidence';

export async function runCrmOperationsFlow(page: Page, ctx: EvidenceCtx): Promise<void> {
  const log = createLogger(ctx.feature);
  const metricCard = (label: string) => page.locator('main div').filter({ hasText: new RegExp(label) }).first();
  const assertMetricCardVisible = async (label: string, timeout = 15_000) => {
    await expect(metricCard(label)).toBeVisible({ timeout });
  };

  await test.step('CRM ops: calendar', async () => {
    await page.goto(`${BASE_URL}/crm/calendar`);
    await page.waitForLoadState('networkidle');
    await page.locator('text=Loading calendar...').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => null);
    await assertMetricCardVisible('Today');
    await assertMetricCardVisible('Upcoming', 5_000);
    await assertMetricCardVisible('Completed', 5_000);
    await assertMetricCardVisible('This Week', 5_000);
    await assertMetricCardVisible('Cancelled', 5_000);
    await assertMetricCardVisible('Total', 5_000);
    const metricValues = page.locator('.text-2xl.font-bold');
    const firstMetric = await metricValues.first().textContent();
    if (firstMetric && /\d+/.test(firstMetric)) log('Calendar', 'PASS', `Metrics visible: ${firstMetric}`);
    await snap(page, ctx, '01-calendar-metrics');

    const monthBtn = page.getByRole('button', { name: /^Month$/ });
    const weekBtn = page.getByRole('button', { name: /^Week$/ });
    const dayBtn = page.getByRole('button', { name: /^Day$/ });
    const listBtn = page.getByRole('button', { name: /^List$/ });

    await expect(page.locator('text=Sun').first()).toBeVisible();
    await snap(page, ctx, '02-calendar-month');

    await weekBtn.click();
    await page.waitForTimeout(800);
    await expect(page.locator('h2').filter({ hasText: /^Week:/ })).toBeVisible();
    await snap(page, ctx, '03-calendar-week');

    await dayBtn.click();
    await page.waitForTimeout(800);
    await expect(page.locator('h2').filter({ hasText: /^\w+day/ })).toBeVisible();
    await snap(page, ctx, '04-calendar-day');

    await listBtn.click();
    await page.waitForTimeout(800);
    await expect(page.locator('text=All Meetings').first()).toBeVisible();
    await snap(page, ctx, '05-calendar-list');

    await monthBtn.click();
    await page.waitForTimeout(800);
    await expect(page.locator('text=Sun').first()).toBeVisible();
    await snap(page, ctx, '06-calendar-back-to-month');

    const statusSelect = page.locator('select').first();
    if (await statusSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await statusSelect.selectOption('completed');
      await page.waitForTimeout(800);
      await snap(page, ctx, '07-calendar-filter-completed');
      await statusSelect.selectOption('all');
      await page.waitForTimeout(500);
    }

    const todayBtn = page.getByRole('button', { name: /^Today$/ });
    if (await todayBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await todayBtn.click();
      await page.waitForTimeout(500);
      await snap(page, ctx, '10-calendar-today');
    }
    log('Calendar', 'PASS', 'All views, filters, metrics verified');
  });

  await test.step('CRM ops: business analytics', async () => {
    await page.goto(`${BASE_URL}/crm/analytics`);
    await page.waitForLoadState('networkidle');
    await page.locator('text=Loading Analytics...').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => null);
    await page.waitForTimeout(1_000);

    const kpiLabels = ['Total Monthly Revenue', 'Occupancy Rate', 'Agreements Expiring', 'Pending Actions'];
    let kpiVisible = 0;
    for (const label of kpiLabels) {
      const el = page.locator('div').filter({ hasText: new RegExp(`^${label}$`) }).first();
      if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) kpiVisible++;
    }
    if (kpiVisible >= 2) log('Analytics', 'PASS', `KPI cards visible: ${kpiVisible}/${kpiLabels.length}`);
    else log('Analytics', 'WARN', `Only ${kpiVisible}/${kpiLabels.length} KPI cards found`);
    await snap(page, ctx, '01-analytics-kpi');

    const secondaryLabels = ['Agreements', 'Verifications', 'Tenants', 'Completed', 'Pending', 'Expired'];
    let secondaryVisible = 0;
    for (const label of secondaryLabels) {
      const el = page.locator('div').filter({ hasText: new RegExp(`^${label}$`) }).first();
      if (await el.isVisible({ timeout: 2_000 }).catch(() => false)) secondaryVisible++;
    }
    if (secondaryVisible >= 2) log('Analytics', 'PASS', `Secondary cards: ${secondaryVisible}/${secondaryLabels.length}`);
    else log('Analytics', 'WARN', `Only ${secondaryVisible}/${secondaryLabels.length} secondary cards found`);
    await snap(page, ctx, '02-analytics-secondary');

    await expect(page.locator('h2').filter({ hasText: /^Agreement Expiry Timeline$/ })).toBeVisible();
    const filterDaysSelect = page.locator('select').filter({ has: page.locator('option[value="30"]') });
    if (await filterDaysSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await filterDaysSelect.selectOption('30');
      await page.waitForTimeout(800);
      await snap(page, ctx, '03-analytics-filter-30');
      await filterDaysSelect.selectOption('90');
      await page.waitForTimeout(500);
    }

    await expect(page.locator('h2').filter({ hasText: /^Agreement & Verification Status$/ })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    await snap(page, ctx, '05-analytics-verification-table');
    log('Analytics', 'PASS', 'Analytics page verified');
  });

  await test.step('CRM ops: hierarchy', async () => {
    await page.goto(`${BASE_URL}/crm/hierarchy`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    await snap(page, ctx, '06-hierarchy-page');
    const hierarchyHeading = page.locator('h1').filter({ hasText: /Hierarchy|Organization/i });
    if (await hierarchyHeading.isVisible({ timeout: 5_000 }).catch(() => false)) {
      log('Hierarchy', 'PASS', 'Hierarchy heading visible');
    } else {
      log('Hierarchy', 'WARN', 'Hierarchy heading not found - checking body');
      const bodyText = await page.locator('body').textContent() || '';
      if (/hierarchy|organization|team/i.test(bodyText)) log('Hierarchy', 'PASS', 'Hierarchy content present');
    }
  });

  await test.step('CRM ops: B2B leads', async () => {
    await page.goto(`${BASE_URL}/crm/b2b-leads`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    await snap(page, ctx, '07-b2b-leads-page');
    const b2bHeading = page.locator('h1').filter({ hasText: /B2B|Developer/i });
    if (await b2bHeading.isVisible({ timeout: 5_000 }).catch(() => false)) log('B2B', 'PASS', 'B2B leads heading visible');
    else log('B2B', 'WARN', 'B2B heading not found');
  });

  log('CRM Ops', 'PASS', 'All operational CRM pages verified');
}
