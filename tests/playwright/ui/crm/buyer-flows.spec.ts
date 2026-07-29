import { test, expect } from '@playwright/test';
import { BASE_URL } from '../../helpers/config';
import { setupEvidence, snap } from '../../helpers/evidence';
import { createTestRun, generateUniqueName, generateTestEmail, generateLeadRequirement, phoneForRun } from '../../helpers/seedData';

test.describe('Buyer CRUD', () => {
  test('create buyer with complete details and verify list', async ({ page }) => {
    const ctx = setupEvidence('buyer-flows');
    await page.setViewportSize({ width: 1280, height: 720 });

    const run = createTestRun();
    const nameObj = generateUniqueName(run.runStamp, 0);
    const buyerName = nameObj.fullName;
    const buyerPhone = phoneForRun(run, 1);
    const buyerEmail = generateTestEmail(nameObj.firstName.toLowerCase(), 1, 'test.com', run.runStamp);
    const buyerReq = generateLeadRequirement(run.runStamp, 'buyer', 0);

    await page.goto(`${BASE_URL}/crm/buyers/new`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /New Buyer/i })).toBeVisible({ timeout: 10_000 });
    
    // Fill basic details
    await page.getByPlaceholder('Full name').fill(buyerName);
    await page.getByPlaceholder('Phone number').fill(buyerPhone);
    await page.getByPlaceholder('Email address').fill(buyerEmail);
    
    // Fill budget with realistic amount
    const budgetInput = page.locator('input[placeholder="Budget"], input[placeholder="Budget amount"]').first();
    if (await budgetInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await budgetInput.fill(String(buyerReq.budget));
    }

    // Fill requirement
    const reqTextarea = page.locator('textarea[placeholder*="Requirement"]').first();
    if (await reqTextarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await reqTextarea.fill(buyerReq.requirement || '');
    }

    // Fill preferred area
    const areaInput = page.locator('input[placeholder*="area"], input[placeholder*="location"]').first();
    if (await areaInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await areaInput.fill(buyerReq.preferredArea || '');
    }

    // Fill property type
    const propTypeSelect = page.locator('select').filter({ hasText: /apartment|villa|house/ }).first();
    if (await propTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      const opts = await propTypeSelect.locator('option').allTextContents();
      const valid = opts.find(o => o.toLowerCase() === buyerReq.propertyType) || opts[0];
      if (valid) await propTypeSelect.selectOption(valid);
    }

    // Fill BHK
    const bhkSelect = page.locator('select').filter({ hasText: /BHK|bhk/ }).first();
    if (await bhkSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await bhkSelect.selectOption(String(buyerReq.bhk));
    }

    const saveBtn = page.locator('button').filter({ hasText: /Save|Create|Submit/i }).first();
    await saveBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    await page.goto(`${BASE_URL}/crm/buyers`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').filter({ hasText: 'Buyers' })).toBeVisible({ timeout: 8_000 });
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(buyerName);
    await snap(page, ctx, '01-buyer-created');
  });
});
