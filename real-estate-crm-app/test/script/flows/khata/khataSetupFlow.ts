import { expect, Page, test } from '@playwright/test';
import { BASE_URL } from '../../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../../helpers/evidence';
import { loginWithPhoneOtp } from '../../helpers/auth';

export async function createKhataOwnerAndProperty(
  page: Page,
  ctx: EvidenceCtx,
  owner: { name: string; phone: string; email: string },
  property: { title: string; area: string; city: string; flatNumber: string },
  runStamp: string,
): Promise<{ ownerId: string; propertyId: string }> {
  const log = createLogger(ctx.feature);

  // Guard: if hard navigation bounced us back to login, re-authenticate
  const ensureAuthenticated = async () => {
    const loginHeading = page.locator('h1, h2').filter({ hasText: /Welcome|Sign in|Sign In/i });
    if (await loginHeading.isVisible({ timeout: 3_000 }).catch(() => false)) {
      log('Auth', 'INFO', 'Session lost after navigation, re-authenticating');
      await loginWithPhoneOtp(page, ctx);
      await page.waitForLoadState('networkidle');
    }
  };

  // Resilient page-load assertion — checks any heading tag, not strict role
  const assertPageLoaded = async (textPattern: RegExp) => {
    const header = page.locator('h1, h2, [role="heading"]').filter({ hasText: textPattern }).first();
    await expect(header).toBeVisible({ timeout: 10_000 });
  };

  const saveHeaderForm = async (expectedUrl: RegExp) => {
    const saveBtn = page.locator('button').filter({ hasText: /Save|Save Property|Create|Submit/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 10_000 });
    await saveBtn.click();
    await page.waitForURL(expectedUrl, { timeout: 20_000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600); // buffer for async post-save dialogs / alerts
  };

  let ownerId = '';

  await test.step('Khata Setup: create owner', async () => {
    await page.goto(`${BASE_URL}/crm/owners/new`);
    await page.waitForLoadState('networkidle');
    await ensureAuthenticated();
    await assertPageLoaded(/New Owner|Add Owner|Create Owner/i);

    await page.getByPlaceholder('Full name').fill(owner.name);
    await page.getByPlaceholder('Phone number').fill(owner.phone);
    await page.getByPlaceholder('Email address').fill(owner.email);

    const address = page.getByPlaceholder('Full address');
    if (await address.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await address.fill('Link Road, Andheri West, Mumbai');
    }

    await saveHeaderForm(/\/crm\/owners\/[^\/?#]+$/);
    ownerId = page.url().match(/\/crm\/owners\/([^\/?#]+)/)?.[1] || '';
    if (!ownerId) {
      throw new Error('Owner creation failed: no ownerId extracted from URL');
    }
    await snap(page, ctx, '01-khata-owner-created');
    log('Setup', 'PASS', `${owner.name} created (id=${ownerId})`);
  });

  let propertyId = '';

  await test.step('Khata Setup: create property', async () => {
    await page.goto(`${BASE_URL}/crm/properties/new`);
    await page.waitForLoadState('networkidle');
    await ensureAuthenticated();

    // Skip heading assertion — directly wait for first known form field
    const titleInput = page.getByPlaceholder('Spacious 2BHK Apartment in Andheri');
    await expect(titleInput).toBeVisible({ timeout: 15_000 });

    const ownerDropdown = page.locator('button').filter({ hasText: 'Unassigned / No Owner' }).first();
    await expect(ownerDropdown).toBeVisible({ timeout: 10_000 });
    await ownerDropdown.click();

    const ownerSearch = page.getByPlaceholder('Search by name or phone...');
    await expect(ownerSearch).toBeVisible({ timeout: 10_000 });
    await ownerSearch.fill(owner.name);
    await page.waitForTimeout(500);

    const ownerOption = page.locator('button').filter({ hasText: owner.name }).last();
    await expect(ownerOption).toBeVisible({ timeout: 10_000 });
    await ownerOption.click();

    await page.getByPlaceholder('Spacious 2BHK Apartment in Andheri').fill(property.title);

    const description = page.getByPlaceholder('Describe the property...');
    if (await description.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await description.fill('Property created for Khata Book testing.');
    }

    const propertyType = page.getByLabel('Property Type');
    if (await propertyType.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await propertyType.selectOption('apartment');
    }

    const bhkInput = page.getByPlaceholder('2');
    if (await bhkInput.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await bhkInput.fill('3');
    }

    await page.getByPlaceholder('Andheri West').fill(property.area);
    await page.getByPlaceholder('Mumbai').fill(property.city);

    const buildingName = page.getByPlaceholder('Sunshine Towers');
    if (await buildingName.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await buildingName.fill(`Tower ${runStamp}`);
    }

    const floor = page.getByPlaceholder('5th Floor');
    if (await floor.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await floor.fill('5');
    }

    const flatNumber = page.getByPlaceholder('501');
    if (await flatNumber.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await flatNumber.fill(property.flatNumber);
    }

    const address = page.getByPlaceholder('Street, landmark, directions...');
    if (await address.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await address.fill('Link Road, Andheri West, Mumbai');
    }

    await page.getByPlaceholder('Enter carpet area').fill('980');
    await page.getByPlaceholder('Enter monthly rent').fill('85000');

    const deposit = page.getByPlaceholder('Enter deposit amount');
    if (await deposit.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await deposit.fill('250000');
    }

    await saveHeaderForm(/\/crm\/properties\/[^/?#]+$/);
    propertyId = page.url().match(/\/crm\/properties\/([^/?#]+)/)?.[1] || '';
    await snap(page, ctx, '02-khata-property-created');
    log('Setup', 'PASS', `${property.title} created`);
  });

  return { ownerId, propertyId };
}
