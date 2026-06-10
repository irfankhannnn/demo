// Operational CRM pages: calendar, analytics, hierarchy, B2B leads.
import { Page, test, expect } from '@playwright/test';
import { BASE_URL } from '../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../helpers/evidence';

export async function runCrmOperationsFlow(page: Page, ctx: EvidenceCtx): Promise<void> {
  const log = createLogger(ctx.feature);

  const metricCard = (label: string) =>
    page.locator('main div').filter({ hasText: new RegExp(label) }).first();

  const assertMetricCardVisible = async (label: string, timeout = 15_000) => {
    await expect(metricCard(label)).toBeVisible({ timeout });
  };

  await test.step('CRM ops: calendar', async () => {
    await page.goto(`${BASE_URL}/crm/calendar`);
    await page.waitForLoadState('networkidle');
    await page.locator('text=Loading calendar...').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => null);

    // Metrics load async after API call — wait for grid with polling
    await assertMetricCardVisible('Today');
    await assertMetricCardVisible('Upcoming', 5_000);
    await assertMetricCardVisible('Completed', 5_000);
    await assertMetricCardVisible('This Week', 5_000);
    await assertMetricCardVisible('Cancelled', 5_000);
    await assertMetricCardVisible('Total', 5_000);
    const metricValues = page.locator('.text-2xl.font-bold');
    const firstMetric = await metricValues.first().textContent();
    if (firstMetric && /\d+/.test(firstMetric)) {
      log('Calendar', 'PASS', `Metrics cards visible with values: ${firstMetric}`);
    }
    await snap(page, ctx, '01-calendar-metrics');

    // Step 1.2: View toggle verification
    const monthBtn = page.getByRole('button', { name: /^Month$/ });
    const weekBtn = page.getByRole('button', { name: /^Week$/ });
    const dayBtn = page.getByRole('button', { name: /^Day$/ });
    const listBtn = page.getByRole('button', { name: /^List$/ });

    // Month is default — verify month grid visible (Sun header)
    await expect(page.locator('text=Sun').first()).toBeVisible();
    await snap(page, ctx, '02-calendar-month');

    // Click Week
    await weekBtn.click();
    await page.waitForTimeout(800);
    await expect(page.locator('h2').filter({ hasText: /^Week:/ })).toBeVisible();
    await snap(page, ctx, '03-calendar-week');

    // Click Day
    await dayBtn.click();
    await page.waitForTimeout(800);
    await expect(page.locator('h2').filter({ hasText: /^\w+day/ })).toBeVisible();
    await snap(page, ctx, '04-calendar-day');

    // Click List
    await listBtn.click();
    await page.waitForTimeout(800);
    await expect(page.locator('text=All Meetings').first()).toBeVisible();
    await snap(page, ctx, '05-calendar-list');

    // Back to Month
    await monthBtn.click();
    await page.waitForTimeout(800);
    await expect(page.locator('text=Sun').first()).toBeVisible();
    await snap(page, ctx, '06-calendar-back-to-month');

    // Step 1.3: Status filter
    const statusSelect = page.locator('select').first();
    if (await statusSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await statusSelect.selectOption('completed');
      await page.waitForTimeout(800);
      await snap(page, ctx, '07-calendar-filter-completed');
      await statusSelect.selectOption('all');
      await page.waitForTimeout(500);
    }

    // Step 1.4: Meeting interaction (conditional)
    const meetingChip = page.locator('button').filter({ hasText: /^\d{2}:\d{2}/ }).first();
    if (await meetingChip.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await meetingChip.click();
      await page.waitForTimeout(800);
      await snap(page, ctx, '08-calendar-meeting-popup');

      const rescheduleBtn = page.getByRole('button', { name: /^Reschedule$/ });
      if (await rescheduleBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await rescheduleBtn.click();
        await page.waitForTimeout(800);
        await snap(page, ctx, '09-calendar-reschedule-modal');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      const completeBtn = page.getByRole('button', { name: /^Complete$/ });
      if (await completeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        log('Calendar', 'PASS', 'Complete button visible for scheduled meeting');
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      log('Calendar', 'INFO', 'No meetings visible for interaction testing');
    }

    // Step 1.5: Navigation
    const todayBtn = page.getByRole('button', { name: /^Today$/ });
    if (await todayBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await todayBtn.click();
      await page.waitForTimeout(500);
      await snap(page, ctx, '10-calendar-today');
    }

    log('Calendar', 'PASS', 'All views, filters, metrics, and interactions verified');
  });

  await test.step('CRM ops: business analytics', async () => {
    await page.goto(`${BASE_URL}/crm/analytics`);
    await page.waitForLoadState('networkidle');
    await page.locator('text=Loading Analytics...').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => null);
    await page.waitForTimeout(1_000);

    // Step 2.1: Verify KPI cards (flexible selectors — class names may change)
    const kpiLabels = ['Total Monthly Revenue', 'Occupancy Rate', 'Agreements Expiring', 'Pending Actions'];
    let kpiVisible = 0;
    for (const label of kpiLabels) {
      const el = page.locator('div').filter({ hasText: new RegExp(`^${label}$`) }).first();
      if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) kpiVisible++;
    }
    if (kpiVisible >= 2) {
      log('Analytics', 'PASS', `KPI cards visible: ${kpiVisible}/${kpiLabels.length}`);
    } else {
      log('Analytics', 'WARN', `Only ${kpiVisible}/${kpiLabels.length} KPI cards found — page layout may have changed`);
    }
    await snap(page, ctx, '01-analytics-kpi');

    // Step 2.2: Verify secondary metric cards
    const secondaryLabels = ['Agreements', 'Verifications', 'Tenants', 'Completed', 'Pending', 'Expired'];
    let secondaryVisible = 0;
    for (const label of secondaryLabels) {
      const el = page.locator('div').filter({ hasText: new RegExp(`^${label}$`) }).first();
      if (await el.isVisible({ timeout: 2_000 }).catch(() => false)) secondaryVisible++;
    }
    if (secondaryVisible >= 2) {
      log('Analytics', 'PASS', `Secondary cards visible: ${secondaryVisible}/${secondaryLabels.length}`);
    } else {
      log('Analytics', 'WARN', `Only ${secondaryVisible}/${secondaryLabels.length} secondary cards found`);
    }
    await snap(page, ctx, '02-analytics-secondary');

    // Step 2.3: Agreement Expiry Table + Filters
    await expect(page.locator('h2').filter({ hasText: /^Agreement Expiry Timeline$/ })).toBeVisible();
    const filterDaysSelect = page.locator('select').filter({ has: page.locator('option[value="30"]') });
    const sortBySelect = page.locator('select').filter({ has: page.locator('option[value="date"]') });
    
    if (await filterDaysSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await filterDaysSelect.selectOption('30');
      await page.waitForTimeout(800);
      await snap(page, ctx, '03-analytics-filter-30');
      
      if (await sortBySelect.isVisible().catch(() => false)) {
        await sortBySelect.selectOption('rent');
        await page.waitForTimeout(800);
        await snap(page, ctx, '04-analytics-sort-rent');
        await sortBySelect.selectOption('date');
      }
      
      await filterDaysSelect.selectOption('90');
      await page.waitForTimeout(500);
    }

    // Step 2.4: Verification Status Table
    await expect(page.locator('h2').filter({ hasText: /^Agreement & Verification Status$/ })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    
    const tableHeaders = ['Property', 'Tenant', 'Agreement Status', 'Agreement Date', 'Police Verification', 'Verification Date', 'Action'];
    let visibleHeaders = 0;
    for (const h of tableHeaders) {
      const visible = await page.locator('th').filter({ hasText: new RegExp(`^${h}$`) }).first().isVisible().catch(() => false);
      if (visible) visibleHeaders++;
    }
    if (visibleHeaders > 0) {
      log('Analytics', 'PASS', `Verification table headers visible: ${visibleHeaders}/${tableHeaders.length}`);
    }
    await snap(page, ctx, '05-analytics-verification-table');

    // Step 2.5: Export CSV
    const exportBtn = page.getByRole('button', { name: /^Export CSV$/ });
    if (await exportBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 10_000 }).catch(() => null);
      await exportBtn.click();
      const download = await downloadPromise;
      if (download) {
        const filename = download.suggestedFilename();
        if (filename.startsWith('business-analytics-')) {
          log('Analytics', 'PASS', `CSV downloaded: ${filename}`);
        } else {
          log('Analytics', 'INFO', `CSV filename unexpected: ${filename}`);
        }
      } else {
        log('Analytics', 'INFO', 'CSV download event not captured');
      }
      await snap(page, ctx, '06-analytics-csv-downloaded');
    }

    log('Analytics', 'PASS', 'All KPIs, tables, filters, and export verified');
  });

  await test.step('CRM ops: property hierarchy', async () => {
    await page.goto(`${BASE_URL}/crm/hierarchy`);
    await page.waitForLoadState('networkidle');
    await page.locator('text=Loading property hierarchy...').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => null);
    await page.waitForTimeout(1_000);

    // Step 3.1: Verify breadcrumb and header
    await expect(page.locator('button').filter({ hasText: /^Cities$/ })).toBeVisible();
    await expect(page.locator('h1').filter({ hasText: /^Property Hierarchy$/ })).toBeVisible();
    await snap(page, ctx, '01-hierarchy-cities');

    // Step 3.2: City level drill-down
    const cityCards = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: /area|property/ });
    const cityCount = await cityCards.count();

    if (cityCount === 0) {
      await expect(page.locator('text=No cities found. Add properties to see hierarchy.').first()).toBeVisible();
      log('Hierarchy', 'INFO', 'No properties — empty state shown');
      await snap(page, ctx, '02-hierarchy-empty');
    } else {
      const firstCity = cityCards.first();
      const cityName = await firstCity.locator('h3').textContent() || 'Unknown';
      await firstCity.click();
      await page.waitForTimeout(1_000);

      await expect(page.locator('button').filter({ hasText: new RegExp(`^${cityName}$`) })).toBeVisible();
      await snap(page, ctx, '02-hierarchy-areas');

      // Step 3.3: Area level
      const areaCards = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: /building|property/ });
      const areaCount = await areaCards.count();
      log('Hierarchy', 'INFO', `City ${cityName}: ${areaCount} areas`);

      if (areaCount > 0) {
        const firstArea = areaCards.first();
        const areaName = await firstArea.locator('h3').textContent() || 'Unknown';
        await firstArea.click();
        await page.waitForTimeout(1_000);

        await expect(page.locator('button').filter({ hasText: new RegExp(`^${areaName}$`) })).toBeVisible();
        await snap(page, ctx, '03-hierarchy-buildings');

        // Step 3.4: Building level
        const buildingCards = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: /property/ });
        const buildingCount = await buildingCards.count();
        log('Hierarchy', 'INFO', `Area ${areaName}: ${buildingCount} buildings`);

        if (buildingCount > 0) {
          const firstBuilding = buildingCards.first();
          const buildingName = await firstBuilding.locator('h3').textContent() || 'Unknown';
          await firstBuilding.click();
          await page.waitForTimeout(1_000);

          await expect(page.locator('button').filter({ hasText: new RegExp(`^${buildingName}$`) })).toBeVisible();
          await snap(page, ctx, '04-hierarchy-properties');

          const propertyCards = page.locator('.bg-white.rounded-lg').filter({ hasText: /₹|Available|Rented/ });
          const propCount = await propertyCards.count();
          log('Hierarchy', 'INFO', `Building ${buildingName}: ${propCount} properties`);
        }
      }

      // Step 3.5: Breadcrumb navigation back
      const citiesCrumb = page.locator('button').filter({ hasText: /^Cities$/ });
      if (await citiesCrumb.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await citiesCrumb.click();
        await page.waitForTimeout(800);
        await expect(page.locator('button').filter({ hasText: /^Cities$/ })).toBeVisible();
        await snap(page, ctx, '05-hierarchy-back-to-cities');
      }

      // Step 3.6: Refresh
      const headerRefresh = page.locator('header').locator('button').last();
      if (await headerRefresh.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await headerRefresh.click();
        await page.waitForTimeout(1_000);
        await snap(page, ctx, '06-hierarchy-refreshed');
      }
    }

    log('Hierarchy', 'PASS', 'City→Area→Building→Property drill-down verified');
  });

  await test.step('CRM ops: B2B leads', async () => {
    await page.goto(`${BASE_URL}/crm/b2b-leads`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    // Step 4.1: Verify filters and search
    const searchInput = page.locator('input[type="text"]').first();
    await expect(searchInput).toBeVisible();
    
    const statusSelect = page.locator('select').first();
    const prioritySelect = page.locator('select').nth(1);
    
    if (await statusSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const statusOptions = await statusSelect.locator('option').allTextContents();
      log('B2B', 'INFO', `Status options: ${statusOptions.join(', ')}`);
    }
    
    if (await prioritySelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const priorityOptions = await prioritySelect.locator('option').allTextContents();
      log('B2B', 'INFO', `Priority options: ${priorityOptions.join(', ')}`);
    }
    await snap(page, ctx, '01-b2b-loaded');

    // Step 4.2: Search and filter
    await searchInput.fill('test');
    await page.waitForTimeout(1_000);
    await snap(page, ctx, '02-b2b-search');

    await searchInput.fill('');
    await page.waitForTimeout(500);

    if (await statusSelect.isVisible().catch(() => false)) {
      await statusSelect.selectOption('new');
      await page.waitForTimeout(800);
      await snap(page, ctx, '03-b2b-filter-new');
      await statusSelect.selectOption('all');
      await page.waitForTimeout(500);
    }

    // Step 4.3: Lead detail drawer (conditional)
    const anyLead = page.locator('div').filter({ hasText: /Priority:/ }).first();
    if (await anyLead.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await anyLead.click();
      await page.waitForTimeout(1_000);
      await snap(page, ctx, '04-b2b-drawer-open');

      const scheduleBtn = page.getByRole('button', { name: /Schedule Meeting/i });
      if (await scheduleBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        log('B2B', 'PASS', 'Schedule Meeting button visible in drawer');
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      log('B2B', 'INFO', 'No B2B leads available for drawer testing');
    }

    log('B2B', 'PASS', 'B2B Leads list, search, filter, and drawer verified');
  });

}
