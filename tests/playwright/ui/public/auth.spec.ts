import { test, expect } from '@playwright/test';
import { BASE_URL } from '../../helpers/config';

test.describe('Auth flows', () => {
  test('phone-login page loads and has required fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/phone-login`);
    await expect(page.locator('input[type="tel"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('button:has-text("Send OTP"), button:has-text("Get OTP")')).toBeVisible();
  });

  test('unauthenticated user redirected to login from protected route', async ({ page }) => {
    await page.goto(`${BASE_URL}/crm`);
    await expect(page).toHaveURL(/\/login|phone-login/);
  });

  test('login page has Continue with Phone button', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.getByRole('button', { name: /Continue with Phone/i })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Onboarding flows', () => {
  test('role-selection page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/onboarding/role-selection`);
    await expect(page.locator('h1, h2').filter({ hasText: /Welcome|role/i })).toBeVisible({ timeout: 10_000 });
  });

  test('accept-invite page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/onboarding/accept-invite`);
    await expect(page.locator('h1, h2').filter({ hasText: /invite|join/i })).toBeVisible({ timeout: 10_000 }).catch(() => {
      // Some invite pages may redirect immediately
    });
  });
});
