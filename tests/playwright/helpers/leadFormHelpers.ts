import { expect, Page } from '@playwright/test';
import { saveAndWaitForApi } from './saveHelpers';
import { fetchLeadFromApi, fetchLeadNotesFromApi } from './crmApi';
import type { CompleteLeadFixture } from './leadFixtures';
import { getPropertyFieldLabels, getPropertyFieldVisibility } from './leadPropertyVisibility';

type LogFn = (step: string, status: string, message: string) => void;

function controlByLabel(page: Page, label: string | RegExp) {
  return page.locator('label').filter({ hasText: label }).first().locator('xpath=..').locator('input, select, textarea').first();
}

async function selectByLabel(page: Page, label: string | RegExp, value: string) {
  const select = page.locator('label').filter({ hasText: label }).first().locator('xpath=..').locator('select');
  await expect(select).toBeVisible({ timeout: 5_000 });
  await select.selectOption({ value });
}

function sectionRoot(page: Page, heading: string | RegExp) {
  return page.locator('h3').filter({ hasText: heading }).first().locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
}

async function fillInputInSection(section: ReturnType<typeof sectionRoot>, placeholder: string | RegExp, value: string) {
  const locator = section.getByPlaceholder(placeholder).first();
  await expect(locator).toBeVisible({ timeout: 8_000 });
  await locator.fill(value);
}

async function selectInSection(section: ReturnType<typeof sectionRoot>, label: string | RegExp, value: string) {
  const select = section.locator('label').filter({ hasText: label }).first().locator('xpath=..').locator('select');
  await expect(select).toBeVisible({ timeout: 8_000 });
  await select.selectOption({ value });
}

async function fillByPlaceholder(page: Page, placeholder: string | RegExp, value: string) {
  const locator = page.getByPlaceholder(placeholder).first();
  await expect(locator).toBeVisible({ timeout: 8_000 });
  await locator.fill(value);
}

export async function openNewLeadForm(page: Page, leadType: CompleteLeadFixture['leadType']) {
  await page.goto('/crm/leads/new');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1').filter({ hasText: 'New Lead' })).toBeVisible({ timeout: 10_000 });

  const leadTypeSelect = page.locator('h3').filter({ hasText: 'Lead Type' }).locator('xpath=..').locator('select');
  await leadTypeSelect.selectOption(leadType);
  await page.waitForTimeout(500);
}

export async function fillLeadBasicFields(page: Page, lead: CompleteLeadFixture) {
  await fillByPlaceholder(page, 'Full name', lead.name);
  await fillByPlaceholder(page, 'Phone number', lead.phone);
  await fillByPlaceholder(page, 'Email address', lead.email);

  if (lead.source === 'Other') {
    await selectByLabel(page, /^Source$/, 'Other');
    await fillByPlaceholder(page, 'Enter custom source', 'Partner Agency Referral');
  } else {
    await selectByLabel(page, /^Source$/, lead.source);
  }

  await selectByLabel(page, /^Status$/, lead.status);

  if (lead.status === 'lost') {
    const reason = lead.lostReason || 'Found another property';
    const preset = ['Price too high', 'Found another property', 'Not interested anymore', "Couldn't reach"];
    if (preset.includes(reason)) {
      await selectByLabel(page, /^Reason for Loss$/, reason);
    } else {
      await selectByLabel(page, /^Reason for Loss$/, 'Other');
      await fillByPlaceholder(page, 'Enter custom reason', reason);
    }
  }

  await selectByLabel(page, /^Priority$/, lead.priority);

  const notesTextarea = page.locator('textarea[placeholder="General notes about this lead..."]');
  await expect(notesTextarea).toBeVisible({ timeout: 3_000 });
  await notesTextarea.fill(lead.notes);

  if (lead.activityNote) {
    const activityNote = page.locator('textarea[placeholder="Add a note (will be saved after creating lead)..."]');
    if (await activityNote.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await activityNote.fill(lead.activityNote);
    }
  }
}

export async function fillBuyerRequirementFields(page: Page, req: NonNullable<CompleteLeadFixture['buyerRequirement']>) {
  const section = sectionRoot(page, 'Buyer Requirements');
  await expect(section).toBeVisible({ timeout: 8_000 });
  await section.locator('label').filter({ hasText: /^Requirement$/ }).first().locator('xpath=..').locator('textarea').fill(req.requirement);
  await fillInputInSection(section, 'Budget amount', String(req.budget));
  await fillInputInSection(section, 'Preferred location', req.preferredArea);
  await selectInSection(section, /^Property Type$/, req.propertyType);
  await selectInSection(section, /^BHK$/, String(req.bhk));
}

async function fillLabeledInputInSection(section: ReturnType<typeof sectionRoot>, label: string | RegExp, value: string) {
  const input = section.locator('label').filter({ hasText: label }).first().locator('xpath=..').locator('input, textarea').first();
  await expect(input).toBeVisible({ timeout: 8_000 });
  await input.fill(value);
}

async function fillSellerOrOwnerPropertySection(
  page: Page,
  heading: 'Property for Sale' | 'Property for Rent',
  prop: {
    propertyType: string;
    bhk?: number;
    buildingName?: string;
    flatNumber?: string;
    floor?: string;
    furnishing?: string;
    carpetArea?: number;
    area?: string;
    city?: string;
    address?: string;
    expectedPrice?: number;
    timeline?: string;
    rentExpected?: number;
    securityDeposit?: number;
  },
  variant: 'seller' | 'owner',
) {
  const section = sectionRoot(page, heading);
  await expect(section).toBeVisible({ timeout: 8_000 });
  await selectInSection(section, /^Property Type$/, prop.propertyType);
  await page.waitForTimeout(300);

  const visibility = getPropertyFieldVisibility(prop.propertyType);
  const labels = getPropertyFieldLabels(prop.propertyType);

  if (visibility.bhk && prop.bhk != null) {
    await selectInSection(section, new RegExp(`^${labels.bhk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), String(prop.bhk));
  }
  if (visibility.buildingName && prop.buildingName) {
    await fillLabeledInputInSection(section, new RegExp(`^${labels.buildingName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), prop.buildingName);
  }
  if (visibility.flatNumber && prop.flatNumber) {
    await fillLabeledInputInSection(section, new RegExp(`^${labels.flatNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), prop.flatNumber);
  }
  if (visibility.floor && prop.floor) {
    await fillLabeledInputInSection(section, /^Floor$/, prop.floor);
  }
  if (visibility.furnishing && prop.furnishing) {
    await selectInSection(section, /^Furnishing$/, prop.furnishing);
  }
  if (visibility.carpetArea && prop.carpetArea != null) {
    await fillLabeledInputInSection(section, new RegExp(`^${labels.carpetArea.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), String(prop.carpetArea));
  }
  if (prop.area) await fillInputInSection(section, 'Property location', prop.area);
  if (prop.city) await fillInputInSection(section, 'e.g. Mumbai', prop.city);

  if (variant === 'seller' && prop.expectedPrice != null) {
    await fillInputInSection(section, 'Expected price', String(prop.expectedPrice));
    if (prop.timeline) {
      await fillInputInSection(section, 'e.g., Within 3 months', prop.timeline);
    }
  }

  if (variant === 'owner') {
    if (prop.rentExpected != null) await fillInputInSection(section, 'Expected monthly rent', String(prop.rentExpected));
    if (prop.securityDeposit != null) await fillInputInSection(section, 'Security deposit', String(prop.securityDeposit));
  }

  if (prop.address) {
    await section.locator('textarea[placeholder="Street address, landmark, pin code..."]').fill(prop.address);
  }
}

export async function fillSellerPropertyFields(page: Page, prop: NonNullable<CompleteLeadFixture['sellerProperty']>) {
  await fillSellerOrOwnerPropertySection(page, 'Property for Sale', prop, 'seller');
}

export async function fillTenantRequirementFields(page: Page, req: NonNullable<CompleteLeadFixture['tenantRequirement']>) {
  const section = sectionRoot(page, 'Rental Requirements');
  await expect(section).toBeVisible({ timeout: 8_000 });
  await section.locator('label').filter({ hasText: /^Requirement$/ }).first().locator('xpath=..').locator('textarea').fill(req.requirement);
  await fillInputInSection(section, 'Monthly budget', String(req.budget));
  await fillInputInSection(section, 'Preferred location', req.preferredArea);
  await section.locator('label').filter({ hasText: /^Move-in Date$/ }).first().locator('xpath=..').locator('input[type="date"]').fill(req.moveInDate);
}

export async function fillOwnerPropertyFields(page: Page, prop: NonNullable<CompleteLeadFixture['ownerProperty']>) {
  await fillSellerOrOwnerPropertySection(page, 'Property for Rent', prop, 'owner');
}

export async function fillLeadTypeSpecificFields(page: Page, lead: CompleteLeadFixture) {
  if (lead.leadType === 'buyer' && lead.buyerRequirement) {
    await fillBuyerRequirementFields(page, lead.buyerRequirement);
  } else if (lead.leadType === 'seller' && lead.sellerProperty) {
    await fillSellerPropertyFields(page, lead.sellerProperty);
  } else if (lead.leadType === 'tenant' && lead.tenantRequirement) {
    await fillTenantRequirementFields(page, lead.tenantRequirement);
  } else if (lead.leadType === 'owner' && lead.ownerProperty) {
    await fillOwnerPropertyFields(page, lead.ownerProperty);
  }
}

export async function createLeadViaUi(
  page: Page,
  lead: CompleteLeadFixture,
  log?: LogFn,
): Promise<{ leadId: string }> {
  await openNewLeadForm(page, lead.leadType);
  await fillLeadBasicFields(page, lead);
  await fillLeadTypeSpecificFields(page, lead);

  const body = await saveAndWaitForApi(page, /\/crm\/leads$/, { log });
  const leadId = String((body as { leadId?: string }).leadId || '');
  expect(leadId).toBeTruthy();
  return { leadId };
}

function normalizePhone(phone: string | undefined | null): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

export async function assertLeadPersisted(page: Page, leadId: string, expected: CompleteLeadFixture) {
  const saved = await fetchLeadFromApi(page, leadId);

  expect(saved.leadType).toBe(expected.leadType);
  expect(saved.name).toBe(expected.name);
  expect(normalizePhone(saved.phone)).toBe(normalizePhone(expected.phone));
  expect(saved.email).toBe(expected.email);
  expect(saved.source).toBe(expected.source);
  expect(saved.status).toBe(expected.status);
  expect(saved.priority).toBe(expected.priority);
  expect(saved.notes).toBe(expected.notes);

  if (expected.status === 'lost') {
    expect(saved.lostReason).toBe(expected.lostReason);
    expect(saved.lostAt).toBeTruthy();
  }

  if (expected.leadType === 'buyer' && expected.buyerRequirement) {
    const req = saved.buyerRequirement || {};
    const exp = expected.buyerRequirement;
    expect(req.requirement).toBe(exp.requirement);
    expect(Number(req.budget)).toBe(exp.budget);
    expect(req.preferredArea).toBe(exp.preferredArea);
    expect(req.propertyType).toBe(exp.propertyType);
    expect(Number(req.bhk)).toBe(exp.bhk);
  }

  if (expected.leadType === 'seller' && expected.sellerProperty) {
    const prop = saved.sellerProperty || {};
    const exp = expected.sellerProperty;
    expect(prop.propertyType).toBe(exp.propertyType);
    expect(Number(prop.bhk)).toBe(exp.bhk);
    expect(prop.buildingName).toBe(exp.buildingName);
    expect(prop.flatNumber).toBe(exp.flatNumber);
    expect(prop.floor).toBe(exp.floor);
    expect(prop.furnishing).toBe(exp.furnishing);
    expect(Number(prop.carpetArea)).toBe(exp.carpetArea);
    expect(prop.area).toBe(exp.area);
    expect(prop.city).toBe(exp.city);
    expect(Number(prop.expectedPrice)).toBe(exp.expectedPrice);
    expect(String(prop.timeline || '')).toBe(exp.timeline);
    expect(prop.address).toBe(exp.address);
  }

  if (expected.leadType === 'tenant' && expected.tenantRequirement) {
    const req = saved.tenantRequirement || {};
    const exp = expected.tenantRequirement;
    expect(req.requirement).toBe(exp.requirement);
    expect(Number(req.budget)).toBe(exp.budget);
    expect(req.preferredArea).toBe(exp.preferredArea);
    expect(String(req.moveInDate || '').slice(0, 10)).toBe(exp.moveInDate);
  }

  if (expected.leadType === 'owner' && expected.ownerProperty) {
    const prop = saved.ownerProperty || {};
    const exp = expected.ownerProperty;
    expect(prop.propertyType).toBe(exp.propertyType);
    expect(Number(prop.bhk)).toBe(exp.bhk);
    expect(prop.buildingName).toBe(exp.buildingName);
    expect(prop.flatNumber).toBe(exp.flatNumber);
    expect(prop.floor).toBe(exp.floor);
    expect(prop.furnishing).toBe(exp.furnishing);
    expect(Number(prop.carpetArea)).toBe(exp.carpetArea);
    expect(prop.area).toBe(exp.area);
    expect(prop.city).toBe(exp.city);
    expect(Number(prop.rentExpected)).toBe(exp.rentExpected);
    expect(Number(prop.securityDeposit)).toBe(exp.securityDeposit);
    expect(prop.address).toBe(exp.address);
  }

  if (expected.activityNote) {
    const notes = await fetchLeadNotesFromApi(page, leadId);
    const match = notes.some((n) => String(n.content || '').includes(expected.activityNote.slice(0, 40)));
    expect(match, 'activity note should be persisted after create').toBe(true);
  }
}
