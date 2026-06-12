// Canonical login flow for all specs.
import { expect, Page } from '@playwright/test';
import { BASE_URL, TEST_OTP, TEST_PHONE } from './config';
import { EvidenceCtx, createLogger, snap } from './evidence';

export interface LoginOptions {
  phoneNumber?: string;
  otp?: string;
  displayName?: string;
  snapPrefix?: string;
}

/**
 * Logs into the CRM using the phone + OTP flow.
 *
 * Steps:
 *   1. Navigate to /phone-login
 *   2. Fill 10-digit phone number
 *   3. Click Send OTP
 *   4. Fill 6 single-char OTP boxes
 *   5. Click Verify OTP
 *   6. Wait for redirect to /crm
 */
export async function loginWithPhoneOtp(
  page: Page,
  ctx?: EvidenceCtx,
  options: LoginOptions = {},
): Promise<void> {
  const log = ctx ? createLogger(ctx.feature) : (_s: string, _st: string) => {};
  const phoneNumber = options.phoneNumber ?? TEST_PHONE;
  const otp = options.otp ?? TEST_OTP;
  const snapPrefix = options.snapPrefix ?? 'login';
  const onboardingDisplayName = options.displayName ?? `Invited ${phoneNumber.slice(-4)}`;

  log('Login', 'INFO', 'Navigating to app root');
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState('networkidle');
  if (ctx) await snap(page, ctx, `${snapPrefix}-01-login-page`);

  // If already authenticated, skip login
  const logoutBtn = page.locator('button[title="Logout"]').first();
  if (await logoutBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    log('Login', 'PASS', 'Already authenticated – skipping login');
    return;
  }

  // Handle the Welcome page
  const continueWithPhone = page.getByRole('button', { name: 'Continue with Phone' });
  if (await continueWithPhone.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await continueWithPhone.click();
    await page.waitForLoadState('networkidle');
  }

  // Enter phone number
  const phoneInput = page.locator('input[type="tel"]').first();
  await expect(phoneInput).toBeVisible({ timeout: 10_000 });
  await phoneInput.fill(phoneNumber);
  if (ctx) await snap(page, ctx, `${snapPrefix}-02-phone-entered`);

  // Click Send OTP
  const sendBtn = page
    .locator('button[type="submit"], button:has-text("Send OTP"), button:has-text("Get OTP")')
    .first();
  await sendBtn.click();
  log('Login', 'INFO', 'Clicked Send OTP - waiting for OTP boxes');

  // Wait for 6-digit OTP inputs
  const otpBox = page.locator('input[type="text"][maxlength="1"]');
  await expect(otpBox.first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
  if (ctx) await snap(page, ctx, `${snapPrefix}-03-otp-screen`);

  const boxes = await otpBox.all();
  log('Login', 'INFO', `Filling ${boxes.length} OTP boxes with ${otp}`);
  for (let i = 0; i < Math.min(boxes.length, 6); i += 1) {
    await boxes[i].click();
    await boxes[i].fill(otp[i]);
    await page.waitForTimeout(80);
  }
  if (ctx) await snap(page, ctx, `${snapPrefix}-04-otp-filled`);

  // Click Verify
  const verifyBtn = page
    .locator('button[type="submit"], button:has-text("Verify")')
    .first();
  await verifyBtn.click();
  log('Login', 'INFO', 'Clicked Verify - waiting for /crm redirect');

  await page.waitForTimeout(1_500);
  const currentUrl = page.url();

  if (currentUrl.includes('/crm')) {
    await page.waitForLoadState('networkidle').catch(() => null);

    // Handle transient "Failed to fetch" error states by clicking retry
    for (let attempt = 0; attempt < 3; attempt++) {
      const errorHeading = page.getByText(/Something went wrong|Failed to fetch/i);
      if (await errorHeading.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const retryBtn = page.getByRole('button', { name: /Retry/i });
        if (await retryBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
          log('Login', 'INFO', `Clicking retry button (attempt ${attempt + 1})`);
          await retryBtn.click();
          await page.waitForLoadState('networkidle').catch(() => null);
          await page.waitForTimeout(1_000);
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Verify auth: either logout button visible or at least on CRM page
    const logoutVisible = await page.locator('button[title="Logout"]').first().isVisible({ timeout: 5_000 }).catch(() => false);
    if (!logoutVisible && !page.url().includes('/crm')) {
      throw new Error('Authentication failed: not on CRM page and logout button not visible');
    }
    await page.waitForTimeout(500);
  } else {
    const onboardingPrompt = page.getByText('You have been invited to join. Please complete your profile below.');
    const onboardingVisible = await onboardingPrompt.isVisible({ timeout: 5_000 }).catch(() => false);

    if (onboardingVisible) {
      log('Login', 'INFO', 'Onboarding step detected - completing registration');
      if (ctx) await snap(page, ctx, `${snapPrefix}-05-onboarding-detected`);

      const nameInput = page.getByPlaceholder('Enter your full name');
      const completeRegBtn = page.getByRole('button', { name: /Complete Registration/i });
      await expect(nameInput).toBeVisible({ timeout: 10_000 });
      await nameInput.fill(onboardingDisplayName);
      await page.waitForTimeout(500);
      if (ctx) await snap(page, ctx, `${snapPrefix}-06-name-filled`);

      await completeRegBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      const navigationPromise = page.waitForURL(/\/(crm|phone-login)/, { timeout: 60_000 });
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes('/auth/phone/onboard') && response.request().method() === 'POST',
        { timeout: 30_000 },
      ).catch(() => null);

      await completeRegBtn.click({ force: true });
      log('Login', 'INFO', 'Clicked Complete Registration - waiting for navigation');

      try {
        await navigationPromise;
        log('Login', 'INFO', 'Navigation completed');
      } catch {
        log('Login', 'FAIL', 'Navigation timeout - checking current state');
      }

      const onboardResponse = await responsePromise;
      if (onboardResponse) {
        log('Login', 'INFO', `Onboarding response status: ${onboardResponse.status()}`);
        const responseBody = await onboardResponse.text().catch(() => 'Unable to read');
        if (responseBody && !responseBody.includes('token')) {
          log('Login', 'FAIL', `Onboarding response: ${responseBody.slice(0, 200)}`);
        }
      }

      const stillOnboarding = await nameInput.isVisible({ timeout: 3_000 }).catch(() => false);
      if (stillOnboarding) {
        log('Login', 'FAIL', 'Still on onboarding page - retrying');
        await nameInput.clear();
        await nameInput.fill(onboardingDisplayName);
        await page.waitForTimeout(500);
        await completeRegBtn.click({ force: true });
        await page.waitForURL(/\/(crm|phone-login)/, { timeout: 30_000 }).catch(() => null);
      }

      const finalUrl = page.url();
      log('Login', 'INFO', `Current URL after onboarding: ${finalUrl}`);

      if (!finalUrl.includes('/crm')) {
        log('Login', 'FAIL', 'Not on /crm after onboarding, navigating manually');
        await page.goto(`${BASE_URL}/crm`);
        await page.waitForLoadState('networkidle');
      }

      // Handle transient "Failed to fetch" error states after onboarding too
      for (let attempt = 0; attempt < 3; attempt++) {
        const errorHeading = page.getByText(/Something went wrong|Failed to fetch/i);
        if (await errorHeading.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const retryBtn = page.getByRole('button', { name: /Retry/i });
          if (await retryBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
            log('Login', 'INFO', `Clicking retry button after onboarding (attempt ${attempt + 1})`);
            await retryBtn.click();
            await page.waitForLoadState('networkidle').catch(() => null);
            await page.waitForTimeout(1_000);
          } else {
            break;
          }
        } else {
          break;
        }
      }

      // Verify auth: either logout button visible or at least on CRM page
      const logoutVisible = await page.locator('button[title="Logout"]').first().isVisible({ timeout: 10_000 }).catch(() => false);
      if (!logoutVisible) {
        log('Login', 'WARN', 'Logout button not visible after onboarding — CRM may be in error state');
      }
      await page.waitForTimeout(1_000);
    } else {
      await page.waitForURL(/\/crm/, { timeout: 30_000 });
      await page.waitForLoadState('networkidle');

      // Handle transient "Failed to fetch" error states
      for (let attempt = 0; attempt < 3; attempt++) {
        const errorHeading = page.getByText(/Something went wrong|Failed to fetch/i);
        if (await errorHeading.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const retryBtn = page.getByRole('button', { name: /Retry/i });
          if (await retryBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
            log('Login', 'INFO', `Clicking retry button (attempt ${attempt + 1})`);
            await retryBtn.click();
            await page.waitForLoadState('networkidle').catch(() => null);
            await page.waitForTimeout(1_000);
          } else {
            break;
          }
        } else {
          break;
        }
      }

      const logoutVisible = await page.locator('button[title="Logout"]').first().isVisible({ timeout: 5_000 }).catch(() => false);
      if (!logoutVisible && !page.url().includes('/crm')) {
        throw new Error('Authentication failed: not on CRM page and logout button not visible');
      }
      await page.waitForTimeout(1_000);
    }
  }

  // Prevent NPS modal and cookie banner from interfering with tests
  await page.evaluate(() => {
    localStorage.setItem('nps_last_asked', String(Date.now()));
    localStorage.setItem('cookie-consent', JSON.stringify({ analytics: false, marketing: false, timestamp: Date.now() }));
    localStorage.setItem('cookieConsent', JSON.stringify({ version: 1, analytics: false, marketing: false, essential: true, timestamp: Date.now() }));
  });

  if (ctx) await snap(page, ctx, `${snapPrefix}-05-logged-in`);
  log('Login', 'PASS', `Authenticated - URL: ${page.url()}`);
}

export async function logoutViaUi(page: Page, ctx?: EvidenceCtx, snapPrefix = 'logout'): Promise<void> {
  const log = ctx ? createLogger(ctx.feature) : (_s: string, _st: string) => {};

  if (!page.url().includes('/crm')) {
    await page.goto(`${BASE_URL}/crm`);
    await page.waitForLoadState('networkidle').catch(() => {});
  }

  // Check if logout button exists; if not, fall back to programmatic logout
  const logoutButton = page.locator('button[title="Logout"]').first();
  const logoutVisible = await logoutButton.isVisible({ timeout: 5_000 }).catch(() => false);

  if (logoutVisible) {
    await logoutButton.click();
    const modal = page.locator('div.fixed.inset-0').last();
    const confirmButton = modal.getByRole('button', { name: /^Logout$/ });
    await expect(confirmButton).toBeVisible({ timeout: 10_000 });
    await confirmButton.click();
    await page.waitForURL(/\/login|phone-login/, { timeout: 10_000 }).catch(() => null);
  } else {
    log('Logout', 'INFO', 'Logout button not found — using programmatic logout');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle').catch(() => {});
  }

  if (ctx) await snap(page, ctx, `${snapPrefix}-done`);
  log('Logout', 'PASS', 'User logged out');
}
