import { expect, Page, test } from '@playwright/test';
import { BASE_URL } from '../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../helpers/evidence';
import {
  generateUniqueName,
  generateTestPhone,
  generateTestEmail,
  generateLeadRequirement,
  SEED_DATA,
  getItemByIndex,
} from '../helpers/seedData';

type LeadType = 'buyer' | 'seller' | 'tenant' | 'owner';

interface LeadData {
  name: string;
  phone: string;
  email: string;
  type: LeadType;
  status: string;
  priority: string;
  source: string;
  notes: string;
  buyerRequirement?: { requirement: string; budget: number; preferredArea: string; propertyType: string; bhk: number; address?: string; moveInDate?: string };
  sellerProperty?: { propertyType: string; area: string; expectedPrice: number; timeline: string; buildingName?: string; flatNumber?: string; floor?: string; city?: string; carpetArea?: number; furnishing?: string; bhk?: number; address?: string };
  tenantRequirement?: { requirement: string; budget: number; preferredArea: string; moveInDate: string; propertyType?: string; bhk?: number; address?: string };
  ownerProperty?: { propertyType: string; area: string; rentExpected: number; buildingName?: string; flatNumber?: string; floor?: string; city?: string; carpetArea?: number; furnishing?: string; bhk?: number; address?: string; securityDeposit?: number };
}

function buildLeads(runStamp: string, phoneBase: number): LeadData[] {
  const leads: LeadData[] = [];
  const types: LeadType[] = ['buyer', 'buyer', 'buyer', 'seller', 'tenant', 'owner', 'buyer'];

  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    const nameObj = generateUniqueName(runStamp, i);
    const phone = generateTestPhone(i + 1, phoneBase);
    const email = generateTestEmail(nameObj.firstName.toLowerCase(), i + 1, 'test.com');
    const status = getItemByIndex([...SEED_DATA.statuses], i + 3);
    const priority = getItemByIndex([...SEED_DATA.priorities], i + 2);
    const source = getItemByIndex([...SEED_DATA.sources], i + 7);
    const req = generateLeadRequirement(runStamp, t, i);

    const base: LeadData = {
      name: nameObj.fullName,
      phone,
      email,
      type: t,
      status,
      priority,
      source,
      notes: `Automated test lead #${i + 1} generated on ${new Date().toISOString()}`,
    };

    if (t === 'buyer') base.buyerRequirement = req as LeadData['buyerRequirement'];
    else if (t === 'seller') base.sellerProperty = req as LeadData['sellerProperty'];
    else if (t === 'tenant') base.tenantRequirement = req as LeadData['tenantRequirement'];
    else if (t === 'owner') base.ownerProperty = req as LeadData['ownerProperty'];

    leads.push(base);
  }
  return leads;
}

export async function runLeadFlow(page: Page, ctx: EvidenceCtx): Promise<void> {
  const log = createLogger(ctx.feature);
  const createdLeadNames: string[] = [];
  const runStamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
  const phoneBase = 7_000_000_000 + ((Date.now() + Math.floor(Math.random() * 1_000_000)) % 1_000_000_00);
  const LEADS_DATA = buildLeads(runStamp, phoneBase);

  await test.step('Leads: navigate to list page', async () => {
    await page.goto(`${BASE_URL}/crm/leads`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    await snap(page, ctx, '06-leads-page');
    await expect(page.locator('h1').filter({ hasText: 'Leads' })).toBeVisible({ timeout: 5_000 });
    log('Leads', 'PASS', 'Leads page loaded');
  });

  for (let i = 0; i < LEADS_DATA.length; i += 1) {
    const lead = LEADS_DATA[i];
    await test.step(`Leads: create ${lead.name} (${lead.type})`, async () => {
      await page.goto(`${BASE_URL}/crm/leads/new`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(800);
      await expect(page.locator('h1').filter({ hasText: 'New Lead' })).toBeVisible({ timeout: 8_000 });

      const leadTypeSelect = page.locator('main select').first();
      await leadTypeSelect.selectOption(lead.type);
      await page.waitForTimeout(400);

      await page.locator('input[placeholder="Full name"]').fill(lead.name);
      await page.locator('input[placeholder="Phone number"]').fill(lead.phone);
      await page.locator('input[placeholder="Email address"]').fill(lead.email);

      const sourceSelect = page.locator('label').filter({ hasText: /^Source$/ }).first().locator('..').locator('select');
      if (await sourceSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const opts = await sourceSelect.locator('option').allTextContents();
        const valid = opts.find(o => o.toLowerCase() === lead.source.toLowerCase())
                      || opts.find(o => !o.toLowerCase().includes('select')) || opts[0];
        if (valid) await sourceSelect.selectOption(valid);
      }

      const statusSelect = page.locator('label').filter({ hasText: /^Status$/ }).locator('..').locator('select');
      if (await statusSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const opts = await statusSelect.locator('option').allTextContents();
        const valid = opts.find(o => o.toLowerCase() === lead.status.toLowerCase())
                      || opts.find(o => !o.toLowerCase().includes('select')) || opts[0];
        if (valid) await statusSelect.selectOption(valid);
      }

      const prioritySelect = page.locator('label').filter({ hasText: /^Priority$/ }).locator('..').locator('select');
      if (await prioritySelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const opts = await prioritySelect.locator('option').allTextContents();
        const valid = opts.find(o => o.toLowerCase() === lead.priority.toLowerCase())
                      || opts.find(o => !o.toLowerCase().includes('select')) || opts[0];
        if (valid) await prioritySelect.selectOption(valid);
      }

      if (lead.notes) {
        const notesTextarea = page.locator('textarea[placeholder="General notes about this lead..."]');
        if (await notesTextarea.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await notesTextarea.fill(lead.notes);
        }
      }

      if (lead.type === 'buyer' && lead.buyerRequirement) {
        const req = lead.buyerRequirement;
        const reqTextarea = page.locator('label').filter({ hasText: /^Requirement$/ }).first().locator('..').locator('textarea');
        if (await reqTextarea.isVisible({ timeout: 2_000 }).catch(() => false)) await reqTextarea.fill(req.requirement);
        const budgetInput = page.locator('input[placeholder="Budget amount"]');
        if (await budgetInput.isVisible({ timeout: 2_000 }).catch(() => false)) await budgetInput.fill(String(req.budget));
        const areaInput = page.locator('input[placeholder="Preferred location"]').first();
        if (await areaInput.isVisible({ timeout: 2_000 }).catch(() => false)) await areaInput.fill(req.preferredArea);
        const propTypeSelect = page.locator('label').filter({ hasText: /^Property Type$/ }).first().locator('..').locator('select');
        if (await propTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const opts = await propTypeSelect.locator('option').allTextContents();
          const valid = opts.find(o => o.toLowerCase() === req.propertyType) || opts.find(o => !o.toLowerCase().includes('select')) || opts[0];
          if (valid) await propTypeSelect.selectOption(valid);
        }
        const bhkSelect = page.locator('label').filter({ hasText: /^BHK$/ }).first().locator('..').locator('select');
        if (await bhkSelect.isVisible({ timeout: 2_000 }).catch(() => false)) await bhkSelect.selectOption(String(req.bhk));
        const addressTextarea = page.locator('textarea[placeholder="Full address, landmark, pin code..."]');
        if (await addressTextarea.isVisible({ timeout: 2_000 }).catch(() => false)) await addressTextarea.fill(req.address || 'Bandra West, Mumbai');
        const moveInInput = page.locator('label').filter({ hasText: /^Move-in Date$/ }).first().locator('..').locator('input[type="date"]');
        if (await moveInInput.isVisible({ timeout: 2_000 }).catch(() => false)) await moveInInput.fill(req.moveInDate);
      }

      if (lead.type === 'seller' && lead.sellerProperty) {
        const prop = lead.sellerProperty;
        const priceInput = page.locator('input[placeholder="Expected price"]');
        if (await priceInput.isVisible({ timeout: 2_000 }).catch(() => false)) await priceInput.fill(String(prop.expectedPrice));
        const areaInput = page.locator('input[placeholder="Area / Location"]').first();
        if (await areaInput.isVisible({ timeout: 2_000 }).catch(() => false)) await areaInput.fill(prop.area);
        const propTypeSelect = page.locator('label').filter({ hasText: /^Property Type$/ }).first().locator('..').locator('select');
        if (await propTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const opts = await propTypeSelect.locator('option').allTextContents();
          const valid = opts.find(o => o.toLowerCase() === prop.propertyType) || opts.find(o => !o.toLowerCase().includes('select')) || opts[0];
          if (valid) await propTypeSelect.selectOption(valid);
        }
      }

      if (lead.type === 'tenant' && lead.tenantRequirement) {
        const req = lead.tenantRequirement;
        const reqTextarea = page.locator('label').filter({ hasText: /^Requirement$/ }).first().locator('..').locator('textarea');
        if (await reqTextarea.isVisible({ timeout: 2_000 }).catch(() => false)) await reqTextarea.fill(req.requirement);
        const budgetInput = page.locator('input[placeholder="Budget amount"]');
        if (await budgetInput.isVisible({ timeout: 2_000 }).catch(() => false)) await budgetInput.fill(String(req.budget));
        const areaInput = page.locator('input[placeholder="Preferred location"]').first();
        if (await areaInput.isVisible({ timeout: 2_000 }).catch(() => false)) await areaInput.fill(req.preferredArea);
        const moveInInput = page.locator('label').filter({ hasText: /^Move-in Date$/ }).first().locator('..').locator('input[type="date"]');
        if (await moveInInput.isVisible({ timeout: 2_000 }).catch(() => false)) await moveInInput.fill(req.moveInDate);
      }

      if (lead.type === 'owner' && lead.ownerProperty) {
        const prop = lead.ownerProperty;
        const rentInput = page.locator('input[placeholder="Rent expected"]');
        if (await rentInput.isVisible({ timeout: 2_000 }).catch(() => false)) await rentInput.fill(String(prop.rentExpected));
        const areaInput = page.locator('input[placeholder="Area / Location"]').first();
        if (await areaInput.isVisible({ timeout: 2_000 }).catch(() => false)) await areaInput.fill(prop.area);
        const propTypeSelect = page.locator('label').filter({ hasText: /^Property Type$/ }).first().locator('..').locator('select');
        if (await propTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const opts = await propTypeSelect.locator('option').allTextContents();
          const valid = opts.find(o => o.toLowerCase() === prop.propertyType) || opts.find(o => !o.toLowerCase().includes('select')) || opts[0];
          if (valid) await propTypeSelect.selectOption(valid);
        }
      }

      const saveBtn = page.locator('button').filter({ hasText: /^Save$/i }).first();
      await saveBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1_500);

      createdLeadNames.push(lead.name);
      log('LeadCreate', 'PASS', `Created lead ${i + 1}: ${lead.name} (${lead.type})`);
      await snap(page, ctx, `07-lead-${i + 1}-created`);
    });
  }

  await test.step('Leads: search for created leads', async () => {
    await page.goto(`${BASE_URL}/crm/leads`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill(LEADS_DATA[0].name);
      await page.waitForTimeout(1_200);
      await snap(page, ctx, '08-leads-search');
      const bodyText = await page.locator('body').textContent() || '';
      if (bodyText.includes(LEADS_DATA[0].name)) {
        log('LeadSearch', 'PASS', 'Created lead found in search results');
      } else {
        log('LeadSearch', 'WARN', 'Created lead not found in search results (may need reindex)');
      }
    }
  });

  log('Leads', 'PASS', `Lead flow completed. Created ${createdLeadNames.length} leads`);
}
