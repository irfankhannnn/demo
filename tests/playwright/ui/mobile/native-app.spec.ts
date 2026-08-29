import { test, expect } from '@playwright/test';
import { gotoAndSettle, forceNativeApp } from '../../helpers/mobile';

/**
 * Guards on the mobile-only behaviour that keeps the app store-compliant.
 *
 * These run against the dev server with the native flag forced on, rather than
 * on a device, so they catch regressions in CI long before a build reaches
 * review. They are not a substitute for the on-device pass.
 */
test.describe('native build compliance', () => {
  test.beforeEach(async ({ page }) => {
    await forceNativeApp(page);
  });

  test('no purchase UI is reachable and Razorpay never loads', async ({ page }) => {
    /*
     * App Store guideline 3.1.1 requires in-app purchases of digital goods to
     * go through IAP. The app relies on the 3.1.3(b) multiplatform exception
     * instead, which holds only while no commerce is presented at all — so a
     * single stray upgrade button is a rejection.
     */
    const razorpayRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('razorpay')) razorpayRequests.push(req.url());
    });

    await gotoAndSettle(page, '/crm/settings/billing');

    expect(
      razorpayRequests,
      `Native build requested Razorpay: ${razorpayRequests.join(', ')}`
    ).toEqual([]);

    // Nothing that reads as a purchase affordance.
    const purchaseControls = page.getByRole('button', {
      name: /upgrade|buy|purchase|add seat|top up|change plan/i,
    });
    await expect(purchaseControls).toHaveCount(0);

    // And no link pointing at a web checkout — Apple's anti-steering rules
    // still apply on the India storefront.
    const checkoutLinks = page.locator('a[href*="billing"], a[href*="checkout"], a[href*="upgrade"]');
    await expect(checkoutLinks).toHaveCount(0);
  });

  test('bottom tab bar renders and navigates', async ({ page }) => {
    await gotoAndSettle(page, '/crm');

    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav).toBeVisible();

    // Five destinations, all reachable without going back to the dashboard.
    await expect(nav.getByRole('link')).toHaveCount(5);

    await nav.getByRole('link', { name: /properties/i }).click();
    await expect(page).toHaveURL(/\/crm\/properties/);

    // The point of the tab bar: cross-section navigation in one tap.
    await nav.getByRole('link', { name: /leads/i }).click();
    await expect(page).toHaveURL(/\/crm\/leads/);
  });

  test('tab bar is hidden on unauthenticated and public routes', async ({ page }) => {
    for (const path of ['/login', '/legal/privacy']) {
      await gotoAndSettle(page, path);
      await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    }
  });

  test('account deletion is reachable from the profile', async ({ page }) => {
    // App Store guideline 5.1.1(v): an app offering account creation without
    // in-app deletion is rejected outright.
    await gotoAndSettle(page, '/profile');

    const deleteButton = page.getByRole('button', { name: /delete account/i });
    await expect(deleteButton).toBeVisible();

    await deleteButton.click();

    const dialog = page.getByRole('heading', { name: /delete your account/i });
    await expect(dialog).toBeVisible();

    // Confirmation must be typed; the destructive action stays disabled until
    // then, so a single mis-tap cannot delete an account.
    const confirmButton = page.getByRole('button', { name: /delete permanently/i });
    await expect(confirmButton).toBeDisabled();
  });
});

test.describe('legal routes', () => {
  test('privacy and terms resolve instead of falling through to /crm', async ({ page }) => {
    /*
     * Regression guard: CookieConsentBanner and Grievance both linked to
     * /legal/* routes that were never defined, so they hit the catch-all and
     * redirected to /crm. An unreachable privacy policy is a store rejection.
     */
    for (const path of ['/legal/privacy', '/legal/terms']) {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), `${path} returned ${response?.status()}`).toBeLessThan(400);
      await page.waitForTimeout(300);
      expect(page.url(), `${path} fell through to the catch-all`).not.toMatch(/\/crm$/);
    }
  });
});
