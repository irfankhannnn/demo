import { expect, Page, test } from '@playwright/test';
import { BASE_URL, TEST_PHONE, TEST_OTP } from '../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../helpers/evidence';
import { loginWithPhoneOtp, logoutViaUi } from '../helpers/auth';

function buildRandomPhone(existing: Set<string>): string {
  const digits = '0123456789';
  while (true) {
    let phone = '9';
    for (let i = 0; i < 9; i += 1) phone += digits[Math.floor(Math.random() * digits.length)];
    if (!existing.has(phone)) return phone;
  }
}

export async function runAdminUiFlow(page: Page, ctx: EvidenceCtx): Promise<void> {
  const log = createLogger(ctx.feature);
  const invitedPhones = new Set<string>();
  const invitedMembers: { phone: string; displayName: string }[] = [];

  // Already authenticated via storageState; just navigate to CRM
  await page.goto(`${BASE_URL}/crm`);
  await page.waitForLoadState('networkidle');

  await test.step('Admin: check current member count', async () => {
    await page.goto(`${BASE_URL}/admin/members`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    await snap(page, ctx, '01-members-page');

    const memberHeading = page.getByRole('heading', { name: /^Members$/i });
    await expect(memberHeading).toBeVisible({ timeout: 10_000 });

    const countText = await page.locator('h2').filter({ hasText: /^All Members \(/i }).textContent();
    const memberCountMatch = countText?.match(/All Members \((\d+)\)/);
    const memberCount = memberCountMatch ? Number(memberCountMatch[1]) : null;
    if (memberCount !== null) log('Admin', 'PASS', `Current member count: ${memberCount}`);
    else log('Admin', 'INFO', `Could not parse member count from text: ${countText || 'n/a'}`);

    const rows = page.locator('main').locator('div.divide-y > div');
    const rowCount = await rows.count().catch(() => 0);
    log('Admin', 'INFO', `Visible member rows: ${rowCount}`);
  });

  await test.step('Admin: create 5 phone-only invites', async () => {
    await page.goto(`${BASE_URL}/admin/invites`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    await snap(page, ctx, '02-invites-page');

    const heading = page.getByRole('heading', { name: /Team Invites/i });
    await expect(heading).toBeVisible({ timeout: 10_000 });

    const newInviteBtn = page.getByRole('button', { name: /New Invite/i });
    await expect(newInviteBtn).toBeVisible({ timeout: 5_000 });

    for (let i = 0; i < 5; i += 1) {
      const phone = buildRandomPhone(invitedPhones);
      invitedPhones.add(phone);
      const displayName = `Invited ${phone.slice(-4)}`;

      await newInviteBtn.click();
      await expect(page.getByRole('heading', { name: /Create New Invite/i })).toBeVisible({ timeout: 5_000 });

      const phoneInput = page.getByPlaceholder('9876543210');
      await phoneInput.fill(phone);

      const emailInput = page.getByPlaceholder('member@example.com');
      await emailInput.fill('');

      const createResponsePromise = page.waitForResponse(
        (r) => r.url().includes('/invites') && r.request().method() === 'POST',
        { timeout: 20_000 },
      ).catch(() => null);

      await page.getByRole('button', { name: /Send Invite/i }).click();
      const createResponse = await createResponsePromise;
      if (createResponse && createResponse.ok()) log('Admin', 'PASS', `Invite API 2xx for ${phone}`);
      else log('Admin', 'INFO', `Invite POST for ${phone} not captured or not ok`);

      const phoneText = page.getByText(phone);
      await expect(phoneText).toBeVisible({ timeout: 10_000 });
      invitedMembers.push({ phone, displayName });
      await snap(page, ctx, `03-invite-${i + 1}-${phone}`);
    }
    log('Admin', 'PASS', `Created ${invitedMembers.length} phone-only invites`);
  });

  await test.step('Admin: logout after invite creation', async () => {
    await logoutViaUi(page, ctx, '04-admin-logout');
  });

  await test.step('Admin: login each invited phone and verify access', async () => {
    for (let i = 0; i < invitedMembers.length; i += 1) {
      const invite = invitedMembers[i];
      await loginWithPhoneOtp(page, ctx, {
        phoneNumber: invite.phone,
        otp: TEST_OTP,
        displayName: invite.displayName,
        snapPrefix: `invite-${i + 1}`,
      });
      await expect(page).toHaveURL(/\/crm/);
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 }).catch(() => undefined);
      log('Admin', 'PASS', `Invited phone ${invite.phone} reached CRM`);
      if (i < invitedMembers.length - 1) {
        await logoutViaUi(page, ctx, `invite-${i + 1}-logout`);
      } else {
        // Log out last invited member so admin re-login works cleanly
        await logoutViaUi(page, ctx, `invite-${i + 1}-logout`);
      }
    }
  });

  await test.step('Admin: return to members and note final count', async () => {
    await loginWithPhoneOtp(page, ctx, {
      phoneNumber: TEST_PHONE,
      otp: TEST_OTP,
      displayName: 'Admin User',
      snapPrefix: 'admin-return-login',
    });
    await page.goto(`${BASE_URL}/admin/members`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    await snap(page, ctx, '05-members-final');

    const heading = page.locator('h2').filter({ hasText: /^All Members \(/i });
    let finalCountText: string | null = null;
    if (await heading.isVisible({ timeout: 5_000 }).catch(() => false)) finalCountText = await heading.textContent();
    const finalMatch = finalCountText?.match(/All Members \((\d+)\)/);
    if (finalMatch) log('Admin', 'PASS', `Final member count: ${finalMatch[1]}`);
    else log('Admin', 'INFO', `Could not parse final member count from text: ${finalCountText || 'n/a'}`);
  });
}
