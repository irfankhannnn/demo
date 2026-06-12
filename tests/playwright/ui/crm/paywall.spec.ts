import { test, expect } from '@playwright/test';
import { BASE_URL } from '../../helpers/config';

function mockTrialStatus(page: any, overrides: Record<string, any>) {
  return page.route('**/api/subscriptions/trial-status', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        plan: 'solo',
        trialDaysLeft: 14,
        trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString(),
        isPaying: false,
        isTrialing: true,
        isTrialExpired: false,
        gracePeriodActive: false,
        paymentStatus: 'trialing',
        ...overrides,
      }),
    });
  });
}

test.describe('Trial Countdown Banner', () => {
  test('banner NOT shown when trialDaysLeft > 7', async ({ page }) => {
    await mockTrialStatus(page, { trialDaysLeft: 8, isTrialing: true });
    await page.goto(`${BASE_URL}/crm`);
    await page.waitForTimeout(1000);
    const banner = page.locator('text=Your trial ends in');
    await expect(banner).not.toBeVisible();
  });

  test('yellow banner shown when trialDaysLeft = 7', async ({ page }) => {
    await mockTrialStatus(page, { trialDaysLeft: 7, isTrialing: true });
    await page.goto(`${BASE_URL}/crm`);
    const banner = page.locator('text=Your trial ends in 7 days');
    await expect(banner).toBeVisible();
  });

  test('red banner shown when trialDaysLeft = 3', async ({ page }) => {
    await mockTrialStatus(page, { trialDaysLeft: 3, isTrialing: true });
    await page.goto(`${BASE_URL}/crm`);
    const banner = page.locator('text=3 days left');
    await expect(banner).toBeVisible();
  });
});

test.describe('Paywall Modal', () => {
  test('blocks CRM when trial expired and not paying', async ({ page }) => {
    await mockTrialStatus(page, { trialDaysLeft: 0, isTrialing: false, isTrialExpired: true, isPaying: false, gracePeriodActive: false });
    await page.goto(`${BASE_URL}/crm`);
    const modal = page.locator('text=Your trial has ended — pick a plan to continue');
    await expect(modal).toBeVisible();
  });

  test('/billing route still accessible when trial expired', async ({ page }) => {
    await mockTrialStatus(page, { trialDaysLeft: 0, isTrialing: false, isTrialExpired: true, isPaying: false, gracePeriodActive: false });
    await page.goto(`${BASE_URL}/billing`);
    const modal = page.locator('text=Your trial has ended — pick a plan to continue');
    await expect(modal).not.toBeVisible();
  });

  test('Razorpay checkout opens on tier selection', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).Razorpay = class {
        options: any;
        constructor(options: any) { this.options = options; }
        open() { document.body.setAttribute('data-rzp-opened', 'true'); }
        on() {}
      };
    });
    await mockTrialStatus(page, { trialDaysLeft: 0, isTrialing: false, isTrialExpired: true, isPaying: false, gracePeriodActive: false });
    await page.goto(`${BASE_URL}/crm`);
    const modal = page.locator('text=Your trial has ended — pick a plan to continue');
    await expect(modal).toBeVisible();
    const startSoloBtn = page.locator('button:has-text("Start Solo")');
    await startSoloBtn.click();
    await page.waitForTimeout(500);
    const rzpOpened = await page.getAttribute('body', 'data-rzp-opened');
    expect(rzpOpened).toBe('true');
  });
});
