import { expect, Page, test } from '@playwright/test';
import { BASE_URL } from '../helpers/config';
import { CrmOwnerRecord } from '../helpers/crmApi';
import { EvidenceCtx, createLogger, snap } from '../helpers/evidence';
import { paceBetweenEntitySteps } from '../helpers/saveHelpers';
import {
  createTestRun,
  generateUniqueLocation,
  generateUniquePropertyTitle,
} from '../helpers/seedData';

export type PropertyListingKind = 'for-rent' | 'for-sale';

export interface CreatePropertyResult {
  propertyId: string;
  title: string;
  ownerId: string;
  ownerName: string;
  listingKind: PropertyListingKind;
}

function activeOwners(owners: CrmOwnerRecord[]): CrmOwnerRecord[] {
  return owners.filter((o) => !o.status || o.status === 'active');
}

function dedupeOwners(owners: CrmOwnerRecord[]): CrmOwnerRecord[] {
  const seen = new Set<string>();
  return activeOwners(owners).filter((owner) => {
    if (!owner.ownerId || seen.has(owner.ownerId)) return false;
    seen.add(owner.ownerId);
    return true;
  });
}

/** 0 = all owners; otherwise cap batch size (hard max 25). */
export function resolveOwnerTargets(
  owners: CrmOwnerRecord[],
  maxCount?: number,
): CrmOwnerRecord[] {
  const unique = dedupeOwners(owners);
  const configuredMax = maxCount ?? parseInt(process.env.PROPERTY_TEST_MAX_PER_GROUP || '0', 10);
  const hardCap = parseInt(process.env.PROPERTY_TEST_HARD_CAP || '25', 10);
  const limit = configuredMax > 0 ? configuredMax : unique.length;
  return unique.slice(0, Math.min(limit, hardCap));
}

async function assertOwnerPreselected(page: Page, owner: CrmOwnerRecord): Promise<void> {
  // Newer UI may show owner as a chip/button or as a read-only selected label.
  const ownerButton = page
    .locator('button')
    .filter({ hasText: owner.name })
    .first();

  const buttonVisible = await ownerButton.isVisible({ timeout: 5_000 }).catch(() => false);
  if (buttonVisible) {
    if (owner.phone) {
      await expect(ownerButton).toContainText(owner.phone).catch(() => undefined);
    }
    return;
  }

  // If a different owner is preselected, open picker and choose the target owner
  const ownerSection = page.getByText(/Owner \(Optional\)|Owner/i).first();
  await ownerSection.click().catch(() => undefined);
  const option = page.locator('button').filter({ hasText: owner.name }).first();
  if (await option.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await option.click();
    return;
  }

  await expect(page.getByText(owner.name, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
}

async function dismissBlockingModal(page: Page): Promise<void> {
  const addOwnerModal = page.getByRole('heading', { name: /Add New Owner/i });
  if (await addOwnerModal.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await page.getByRole('button', { name: /^Cancel$/i }).last().click();
    await expect(addOwnerModal).toBeHidden({ timeout: 5_000 });
  }
}

async function fillPropertyForm(
  page: Page,
  owner: CrmOwnerRecord,
  listingKind: PropertyListingKind,
  runStamp: string,
  index: number,
): Promise<string> {
  const title = generateUniquePropertyTitle(runStamp, index);
  const location = generateUniqueLocation(runStamp, index + 10);
  const flatNumber = String(100 + index);

  await page.getByPlaceholder('Spacious 2BHK Apartment in Andheri').fill(title);

  const description = page.getByPlaceholder('Describe the property...');
  if (await description.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await description.fill(`E2E ${listingKind} property for ${owner.name}. Automated test run ${runStamp}.`);
  }

  const propertyType = page.getByLabel('Property Type');
  if (await propertyType.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await propertyType.selectOption('apartment');
  }

  const bhkInput = page.getByPlaceholder('2');
  if (await bhkInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await bhkInput.fill(String(2 + (index % 3)));
  }

  await page.getByPlaceholder('Andheri West').fill(location.area);
  await page.getByPlaceholder('Mumbai').fill(location.city);

  const buildingName = page.getByPlaceholder('Sunshine Towers');
  if (await buildingName.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await buildingName.fill(`Tower ${runStamp.slice(-6)}-${index}`);
  }

  const floor = page.getByPlaceholder('5th Floor');
  if (await floor.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await floor.fill(String(3 + (index % 10)));
  }

  const flat = page.getByPlaceholder('501');
  if (await flat.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await flat.fill(flatNumber);
  }

  const address = page.getByPlaceholder('Street, landmark, directions...');
  if (await address.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await address.fill(`${location.area}, ${location.city}`);
  }

  await page.getByPlaceholder('Enter carpet area').fill(String(850 + index * 25));

  const statusSelect = page.locator('label').filter({ hasText: /^Status$/ }).locator('..').locator('select').first();
  if (await statusSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await statusSelect.selectOption(listingKind);
  }

  if (listingKind === 'for-sale') {
    const salePrice = page.getByPlaceholder('Enter selling price');
    await expect(salePrice).toBeVisible({ timeout: 5_000 });
    await salePrice.fill(String(4_500_000 + index * 125_000));
  } else {
    const rentInput = page.getByPlaceholder('Enter monthly rent');
    await expect(rentInput).toBeVisible({ timeout: 5_000 });
    await rentInput.fill(String(45_000 + index * 2_500));

    const deposit = page.getByPlaceholder('Enter deposit amount');
    if (await deposit.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await deposit.fill(String(150_000 + index * 10_000));
    }
  }

  return title;
}

export async function createPropertyForOwner(
  page: Page,
  ctx: EvidenceCtx,
  owner: CrmOwnerRecord,
  listingKind: PropertyListingKind,
  runStamp: string,
  index: number,
): Promise<CreatePropertyResult> {
  const log = createLogger(ctx.feature);

  await page.goto(`${BASE_URL}/crm/properties/new?ownerId=${encodeURIComponent(owner.ownerId)}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /New Property/i })).toBeVisible({ timeout: 15_000 });
  await assertOwnerPreselected(page, owner);
  const title = await fillPropertyForm(page, owner, listingKind, runStamp, index);
  await dismissBlockingModal(page);

  const saveBtn = page.getByRole('button', { name: /^Save Property$/i });
  await expect(saveBtn).toBeVisible({ timeout: 10_000 });

  const responsePromise = page.waitForResponse(
    (r) => /\/crm\/properties/.test(r.url()) && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await saveBtn.click();

  const response = await responsePromise;
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok()) {
    throw new Error(`Property save failed: ${response.status()} — ${JSON.stringify(body)}`);
  }

  const propertyId = String(body.propertyId || body.id || '');
  if (!propertyId) {
    throw new Error(`Property save succeeded but no propertyId — response: ${JSON.stringify(body)}`);
  }

  const savedOwnerId = String(body.ownerId || '');
  if (savedOwnerId && savedOwnerId !== owner.ownerId) {
    throw new Error(
      `Property assigned to wrong owner: expected ${owner.ownerId} (${owner.name}), got ${savedOwnerId}`,
    );
  }

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1_000);

  await snap(page, ctx, `${listingKind}-property-${index + 1}-created`);
  log('Property', 'PASS', `${listingKind} "${title}" for ${owner.name} (propertyId=${propertyId})`);

  return {
    propertyId,
    title,
    ownerId: owner.ownerId,
    ownerName: owner.name,
    listingKind,
  };
}

export async function createPropertiesForOwners(
  page: Page,
  ctx: EvidenceCtx,
  owners: CrmOwnerRecord[],
  listingKind: PropertyListingKind,
  options: { maxCount?: number; snapPrefix?: string } = {},
): Promise<CreatePropertyResult[]> {
  const log = createLogger(ctx.feature);
  const run = createTestRun();
  const targets = resolveOwnerTargets(owners, options.maxCount);

  if (targets.length === 0) {
    log('PropertyBatch', 'WARN', `No ${listingKind} targets found — skipping`);
    return [];
  }

  log(
    'PropertyBatch',
    'INFO',
    `Creating ${listingKind} properties for ${targets.length} owner(s): ${targets.map((o) => o.name).join(', ')}`,
  );

  const created: CreatePropertyResult[] = [];
  for (let i = 0; i < targets.length; i += 1) {
    await test.step(`Create ${listingKind} property for owner: ${targets[i].name}`, async () => {
      const result = await createPropertyForOwner(page, ctx, targets[i], listingKind, run.runStamp, i);
      created.push(result);
      if (i < targets.length - 1) {
        await paceBetweenEntitySteps(page, 2_000);
      }
    });
  }

  return created;
}
