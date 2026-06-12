import { test, expect } from '@playwright/test';
import { BASE_URL } from '../../helpers/config';
import { setupEvidence, snap } from '../../helpers/evidence';
import { generateUniqueName, generateTestPhone, generateTestEmail } from '../../helpers/seedData';

test.describe('Buyer CRUD', () => {
  test('create buyer and verify list', async ({ page }) => {
    const ctx = setupEvidence('buyer-flows');
    await page.setViewportSize({ width: 1280, height: 720 });

    const runStamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
    const nameObj = generateUniqueName(runStamp, 0);
    const buyerName = nameObj.fullName;
    const buyerPhone = generateTestPhone(1, 7_000_000_000 + (Date.now() % 1_000_000));
    const buyerEmail = generateTestEmail(nameObj.firstName.toLowerCase(), 1, 'test.com');

    await page.goto(`${BASE_URL}/crm/buyers/new`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /New Buyer/i })).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder('Full name').fill(buyerName);
    await page.getByPlaceholder('Phone number').fill(buyerPhone);
    await page.getByPlaceholder('Email address').fill(buyerEmail);
    const budgetInput = page.locator('input[placeholder="Budget"], input[placeholder="Budget amount"]').first();
    if (await budgetInput.isVisible({ timeout: 2_000 }).catch(() => false)) await budgetInput.fill('5000000');

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
