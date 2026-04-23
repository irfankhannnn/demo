import { expect, Page, test } from '@playwright/test';
import { BASE_URL } from '../../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../../helpers/evidence';

export async function createKhataOwnerAndProperty(
  page: Page,
  ctx: EvidenceCtx,
  owner: { name: string; phone: string; email: string },
  property: { title: string; area: string; city: string; flatNumber: string },
  runStamp: string,
): Promise<{ ownerId: string; propertyId: string }> {
  const log = createLogger(ctx.feature);

  const saveHeaderForm = async (expectedUrl: RegExp) => {
    const saveBtn = page.locator('button').filter({ hasText: /Save|Save Property|Create|Submit/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 10_000 });
    await saveBtn.click();
    await page.waitForURL(expectedUrl, { timeout: 20_000 });
    await page.waitForLoadState('networkidle');
  };

  let ownerId = '';

  await test.step('Khata Setup: create owner', async () => {
    await page.goto(`${BASE_URL}/crm/owners/new`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /New Owner/i })).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder('Full name').fill(owner.name);
    await page.getByPlaceholder('Phone number').fill(owner.phone);
    await page.getByPlaceholder('Email address').fill(owner.email);

    const address = page.getByPlaceholder('Full address');
    if (await address.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await address.fill('Link Road, Andheri West, Mumbai');
    }

    await saveHeaderForm(/\/crm\/owners\/[^/?#]+$/);
    ownerId = page.url().match(/\/crm\/owners\/([^/?#]+)/)?.[1] || '';
    await snap(page, ctx, '01-khata-owner-created');
    log('Setup', 'PASS', `${owner.name} created`);
  });

  let propertyId = '';

  await test.step('Khata Setup: create property', async () => {
    await page.goto(`${BASE_URL}/crm/properties/new`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /New Property/i })).toBeVisible({ timeout: 10_000 });

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
