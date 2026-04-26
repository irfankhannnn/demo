// Canonical login flow for all specs.
// Reused from comprehensive-lead-test.spec.ts which is the verified working baseline.
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
 * This follows the working flow from comprehensive-lead-test.spec.ts:
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

  log('Login', 'INFO', 'Navigating to app root and entering phone-login through the client route');
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState('networkidle');
  if (ctx) await snap(page, ctx, `${snapPrefix}-01-login-page`);

  // Handle the Welcome page and move through the client-side phone-login route.
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

  // Existing users go straight to /crm.
  // Invited users may land on the onboarding step first, where we complete registration.
  await page.waitForTimeout(1_500);

  const currentUrl = page.url();

  // Existing users should already be on /crm. Only attempt onboarding completion
  // when we're still on the phone-login flow and the exact profile-completion copy is present.
  if (currentUrl.includes('/crm')) {
    await page.waitForLoadState('networkidle').catch(() => null);
    const logoutControl = page.getByRole('button', { name: /^Logout$/ }).first();
    await expect(logoutControl).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_000);
  } else {
    const onboardingPrompt = page.getByText('You have been invited to join. Please complete your profile below.');
    const onboardingVisible = await onboardingPrompt.isVisible({ timeout: 5_000 }).catch(() => false);

    if (onboardingVisible) {
    log('Login', 'INFO', 'Onboarding step detected - completing registration');
    if (ctx) await snap(page, ctx, `${snapPrefix}-05-onboarding-detected`);

    // Fill the full name input
      const nameInput = page.getByPlaceholder('Enter your full name');
      const completeRegBtn = page.getByRole('button', { name: /Complete Registration/i });
      await expect(nameInput).toBeVisible({ timeout: 10_000 });
      await nameInput.fill(onboardingDisplayName);
    await page.waitForTimeout(500);
    if (ctx) await snap(page, ctx, `${snapPrefix}-06-name-filled`);

    // Click Complete Registration and wait for navigation
    await completeRegBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Set up navigation promise before clicking
    const navigationPromise = page.waitForURL(/\/(crm|phone-login)/, { timeout: 60_000 });
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/auth/phone/onboard') && response.request().method() === 'POST',
      { timeout: 30_000 },
    ).catch(() => null);

    await completeRegBtn.click({ force: true });
    log('Login', 'INFO', 'Clicked Complete Registration - waiting for navigation');

    // Wait for either navigation or response
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

    // If still on onboarding page, retry once
    const stillOnboarding = await nameInput.isVisible({ timeout: 3_000 }).catch(() => false);
    if (stillOnboarding) {
      log('Login', 'FAIL', 'Still on onboarding page - retrying');
      await nameInput.clear();
      await nameInput.fill(onboardingDisplayName);
      await page.waitForTimeout(500);
      await completeRegBtn.click({ force: true });
      await page.waitForURL(/\/(crm|phone-login)/, { timeout: 30_000 }).catch(() => null);
    }

    // Final verification - we should be on /crm with logout visible.
    // Re-read the URL here because `currentUrl` was captured before onboarding.
    const finalUrl = page.url();
    log('Login', 'INFO', `Current URL after onboarding: ${finalUrl}`);

    if (!finalUrl.includes('/crm')) {
      log('Login', 'FAIL', 'Not on /crm after onboarding, navigating manually');
      await page.goto(`${BASE_URL}/crm`);
      await page.waitForLoadState('networkidle');
    }

    const logoutControl = page.getByRole('button', { name: /^Logout$/ }).first();
    await expect(logoutControl).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1_000);
    } else {
      await page.waitForURL(/\/crm/, { timeout: 30_000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1_000);
    }
  }

  if (ctx) await snap(page, ctx, `${snapPrefix}-05-logged-in`);
  log('Login', 'PASS', `Authenticated - URL: ${page.url()}`);
}

export async function logoutViaUi(page: Page, ctx?: EvidenceCtx, snapPrefix = 'logout'): Promise<void> {
  const log = ctx ? createLogger(ctx.feature) : (_s: string, _st: string) => {};

  // Make sure we are on a protected page where the visible logout button exists.
  if (!page.url().includes('/crm')) {
    await page.goto(`${BASE_URL}/crm`);
    await page.waitForLoadState('networkidle').catch(() => {});
  }

  const logoutButton = page.getByRole('button', { name: /^Logout$/ }).first();
  await expect(logoutButton).toBeVisible({ timeout: 10_000 });
  await logoutButton.click();

  const modal = page.locator('div.fixed.inset-0').last();
  const confirmButton = modal.getByRole('button', { name: /^Logout$/ });
  await expect(confirmButton).toBeVisible({ timeout: 10_000 });
  await confirmButton.click();

  // The app clears auth immediately, then redirects to Cognito logout/login.
  // For test stability, we normalize back to the local phone-login screen.
  await page.waitForTimeout(1_500);
  await page.goto(`${BASE_URL}/phone-login`);
  await page.waitForLoadState('networkidle');

  if (ctx) await snap(page, ctx, `${snapPrefix}-complete`);
  log('Logout', 'PASS', 'UI logout completed and login page restored');
}
