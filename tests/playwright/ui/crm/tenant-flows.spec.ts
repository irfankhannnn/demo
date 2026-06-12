import { test, expect } from '@playwright/test';
import { BASE_URL } from '../../helpers/config';
import { setupEvidence, snap } from '../../helpers/evidence';
import { generateUniqueName, generateTestPhone, generateTestEmail } from '../../helpers/seedData';

test.describe('Tenant CRUD', () => {
  test('create tenant and verify list', async ({ page }) => {
    const ctx = setupEvidence('tenant-flows');
    await page.setViewportSize({ width: 1280, height: 720 });

    const runStamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
    const nameObj = generateUniqueName(runStamp, 0);
    const tenantName = nameObj.fullName;
    const tenantPhone = generateTestPhone(1, 7_000_000_000 + (Date.now() % 1_000_000));
    const tenantEmail = generateTestEmail(nameObj.firstName.toLowerCase(), 1, 'test.com');

    await page.goto(`${BASE_URL}/crm/tenants/new`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /New Tenant/i })).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder('Full name').fill(tenantName);
    await page.getByPlaceholder('Phone number').fill(tenantPhone);
    await page.getByPlaceholder('Email address').fill(tenantEmail);
    await page.getByPlaceholder('Full address').fill('Link Road, Andheri West, Mumbai');

    const saveBtn = page.locator('button').filter({ hasText: /Save|Create|Submit/i }).first();
    await saveBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    await page.goto(`${BASE_URL}/crm/tenants`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1').filter({ hasText: 'Tenants' })).toBeVisible({ timeout: 8_000 });
    const bodyText = await page.locator('body').textContent() || '';
    expect(bodyText).toContain(tenantName);
    await snap(page, ctx, '01-tenant-created');
  });
});
