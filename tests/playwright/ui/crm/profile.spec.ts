import { test, expect } from '@playwright/test';
import { BASE_URL } from '../../helpers/config';
import { setupEvidence, snap } from '../../helpers/evidence';

test.describe('Profile page', () => {
  test('profile page loads with user info', async ({ page }) => {
    const ctx = setupEvidence('profile');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').filter({ hasText: /Profile|Account/i }).first()).toBeVisible({ timeout: 10_000 });
    await snap(page, ctx, '01-profile-page');
  });

  test('profile shows logout option', async ({ page }) => {
    const ctx = setupEvidence('profile');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');
    const logoutBtn = page.getByRole('button', { name: /Logout/i }).first();
    await expect(logoutBtn).toBeVisible({ timeout: 10_000 });
  });
});
