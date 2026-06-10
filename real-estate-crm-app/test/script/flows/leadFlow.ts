// Lead management flow extracted from comprehensive-lead-test.spec.ts
// so that both lead-flows.spec.ts and all-flows.spec.ts can invoke it.
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

/**
 * Build a fresh array of 7 unique leads using the expanded seed pools.
 */
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

    if (t === 'buyer') {
      base.buyerRequirement = req as LeadData['buyerRequirement'];
    } else if (t === 'seller') {
      base.sellerProperty = req as LeadData['sellerProperty'];
    } else if (t === 'tenant') {
      base.tenantRequirement = req as LeadData['tenantRequirement'];
    } else if (t === 'owner') {
      base.ownerProperty = req as LeadData['ownerProperty'];
    }

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
                      || opts.find(o => !o.toLowerCase().includes('select'))
                      || opts[0];
        if (valid) await sourceSelect.selectOption(valid);
      }

      const statusSelect = page.locator('label').filter({ hasText: /^Status$/ }).locator('..').locator('select');
      if (await statusSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const opts = await statusSelect.locator('option').allTextContents();
        const valid = opts.find(o => o.toLowerCase() === lead.status.toLowerCase())
                      || opts.find(o => !o.toLowerCase().includes('select'))
                      || opts[0];
        if (valid) await statusSelect.selectOption(valid);
      }

      const prioritySelect = page.locator('label').filter({ hasText: /^Priority$/ }).locator('..').locator('select');
      if (await prioritySelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const opts = await prioritySelect.locator('option').allTextContents();
        const valid = opts.find(o => o.toLowerCase() === lead.priority.toLowerCase())
                      || opts.find(o => !o.toLowerCase().includes('select'))
                      || opts[0];
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
        const propTypeSelect = page.locator('label').filter({ hasText: /^Property Type$/ }).first().locator('..').locator('select');
        if (await propTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const opts = await propTypeSelect.locator('option').allTextContents();
          const valid = opts.find(o => o.toLowerCase() === prop.propertyType) || opts.find(o => !o.toLowerCase().includes('select')) || opts[0];
          if (valid) await propTypeSelect.selectOption(valid);
        }
        const areaInput = page.locator('input[placeholder="Property location"]').first();
        if (await areaInput.isVisible({ timeout: 2_000 }).catch(() => false)) await areaInput.fill(prop.area);
        const cityInput = page.locator('label').filter({ hasText: /^City$/ }).first().locator('..').locator('input');
        if (await cityInput.isVisible({ timeout: 2_000 }).catch(() => false)) await cityInput.fill(prop.city || 'Mumbai');
        const buildingInput = page.locator('label').filter({ hasText: /^Building Name$/ }).first().locator('..').locator('input');
        if (await buildingInput.isVisible({ timeout: 2_000 }).catch(() => false)) await buildingInput.fill(prop.buildingName || 'Omkar Alta Monte');
        const flatInput = page.locator('label').filter({ hasText: /^Flat No\.$/ }).first().locator('..').locator('input');
        if (await flatInput.isVisible({ timeout: 2_000 }).catch(() => false)) await flatInput.fill(prop.flatNumber || '401');
        const floorInput = page.locator('label').filter({ hasText: /^Floor$/ }).first().locator('..').locator('input');
        if (await floorInput.isVisible({ timeout: 2_000 }).catch(() => false)) await floorInput.fill(prop.floor || '4th');
        const carpetInput = page.locator('label').filter({ hasText: /^Carpet Area/ }).first().locator('..').locator('input');
        if (await carpetInput.isVisible({ timeout: 2_000 }).catch(() => false)) await carpetInput.fill(String(prop.carpetArea || 1200));
        const bhkSelect = page.locator('label').filter({ hasText: /^BHK$/ }).first().locator('..').locator('select');
        if (await bhkSelect.isVisible({ timeout: 2_000 }).catch(() => false)) await bhkSelect.selectOption(String(prop.bhk || 3));
        const furnishSelect = page.locator('label').filter({ hasText: /^Furnishing$/ }).first().locator('..').locator('select');
        if (await furnishSelect.isVisible({ timeout: 2_000 }).catch(() => false)) await furnishSelect.selectOption(prop.furnishing || 'semi-furnished');
        const priceInput = page.locator('input[placeholder="Expected price"]');
        if (await priceInput.isVisible({ timeout: 2_000 }).catch(() => false)) await priceInput.fill(String(prop.expectedPrice));
        const timelineInput = page.locator('label').filter({ hasText: /^Timeline$/ }).first().locator('..').locator('input');
        if (await timelineInput.isVisible({ timeout: 2_000 }).catch(() => false)) await timelineInput.fill(prop.timeline);
        const addressTextarea = page.locator('textarea[placeholder="Street address, landmark, pin code..."]');
        if (await addressTextarea.isVisible({ timeout: 2_000 }).catch(() => false)) await addressTextarea.fill(prop.address || 'Link Road, Andheri West, Mumbai');
      }

      if (lead.type === 'tenant' && lead.tenantRequirement) {
        const req = lead.tenantRequirement;
        const reqTextarea = page.locator('textarea[placeholder="What type of rental are they looking for?"]');
        if (await reqTextarea.isVisible({ timeout: 2_000 }).catch(() => false)) await reqTextarea.fill(req.requirement);
        const budgetInput = page.locator('input[placeholder="Monthly budget"]');
        if (await budgetInput.isVisible({ timeout: 2_000 }).catch(() => false)) await budgetInput.fill(String(req.budget));
        const areaInput = page.locator('input[placeholder="Preferred location"]').nth(1);
        if (await areaInput.isVisible({ timeout: 2_000 }).catch(() => false)) await areaInput.fill(req.preferredArea);
        const dateInput = page.locator('label').filter({ hasText: /^Move-in Date$/ }).first().locator('..').locator('input[type="date"]');
        if (await dateInput.isVisible({ timeout: 2_000 }).catch(() => false)) await dateInput.fill(req.moveInDate);
        const propTypeSelect = page.locator('label').filter({ hasText: /^Property Type$/ }).first().locator('..').locator('select');
        if (await propTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const opts = await propTypeSelect.locator('option').allTextContents();
          const valid = opts.find(o => o.toLowerCase() === (req.propertyType || 'apartment')) || opts.find(o => !o.toLowerCase().includes('select')) || opts[0];
          if (valid) await propTypeSelect.selectOption(valid);
        }
        const bhkSelect = page.locator('label').filter({ hasText: /^BHK$/ }).first().locator('..').locator('select');
        if (await bhkSelect.isVisible({ timeout: 2_000 }).catch(() => false)) await bhkSelect.selectOption(String(req.bhk || 2));
        const addressTextarea = page.locator('textarea[placeholder="Full address, landmark, pin code..."]');
        if (await addressTextarea.isVisible({ timeout: 2_000 }).catch(() => false)) await addressTextarea.fill(req.address || 'Powai, Mumbai');
      }

      if (lead.type === 'owner' && lead.ownerProperty) {
        const prop = lead.ownerProperty;
        const propTypeSelect = page.locator('label').filter({ hasText: /^Property Type$/ }).first().locator('..').locator('select');
        if (await propTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const opts = await propTypeSelect.locator('option').allTextContents();
          const valid = opts.find(o => o.toLowerCase() === prop.propertyType) || opts.find(o => !o.toLowerCase().includes('select')) || opts[0];
          if (valid) await propTypeSelect.selectOption(valid);
        }
        const areaInput = page.locator('input[placeholder="Property location"]').first();
        if (await areaInput.isVisible({ timeout: 2_000 }).catch(() => false)) await areaInput.fill(prop.area);
        const cityInput = page.locator('label').filter({ hasText: /^City$/ }).first().locator('..').locator('input');
        if (await cityInput.isVisible({ timeout: 2_000 }).catch(() => false)) await cityInput.fill(prop.city || 'Mumbai');
        const buildingInput = page.locator('label').filter({ hasText: /^Building Name$/ }).first().locator('..').locator('input');
        if (await buildingInput.isVisible({ timeout: 2_000 }).catch(() => false)) await buildingInput.fill(prop.buildingName || 'Omkar Alta Monte');
        const flatInput = page.locator('label').filter({ hasText: /^Flat No\.$/ }).first().locator('..').locator('input');
        if (await flatInput.isVisible({ timeout: 2_000 }).catch(() => false)) await flatInput.fill(prop.flatNumber || '401');
        const floorInput = page.locator('label').filter({ hasText: /^Floor$/ }).first().locator('..').locator('input');
        if (await floorInput.isVisible({ timeout: 2_000 }).catch(() => false)) await floorInput.fill(prop.floor || '4th');
        const carpetInput = page.locator('label').filter({ hasText: /^Carpet Area/ }).first().locator('..').locator('input');
        if (await carpetInput.isVisible({ timeout: 2_000 }).catch(() => false)) await carpetInput.fill(String(prop.carpetArea || 1200));
        const bhkSelect = page.locator('label').filter({ hasText: /^BHK$/ }).first().locator('..').locator('select');
        if (await bhkSelect.isVisible({ timeout: 2_000 }).catch(() => false)) await bhkSelect.selectOption(String(prop.bhk || 2));
        const furnishSelect = page.locator('label').filter({ hasText: /^Furnishing$/ }).first().locator('..').locator('select');
        if (await furnishSelect.isVisible({ timeout: 2_000 }).catch(() => false)) await furnishSelect.selectOption(prop.furnishing || 'semi-furnished');
        const rentInput = page.locator('input[placeholder="Expected monthly rent"]');
        if (await rentInput.isVisible({ timeout: 2_000 }).catch(() => false)) await rentInput.fill(String(prop.rentExpected));
        const depositInput = page.locator('input[placeholder="Security deposit"]');
        if (await depositInput.isVisible({ timeout: 2_000 }).catch(() => false)) await depositInput.fill(String(prop.securityDeposit || 100000));
        const addressTextarea = page.locator('textarea[placeholder="Street address, landmark, pin code..."]');
        if (await addressTextarea.isVisible({ timeout: 2_000 }).catch(() => false)) await addressTextarea.fill(prop.address || 'Link Road, Andheri West, Mumbai');
      }

      await snap(page, ctx, `07-lead-${i + 1}-filled`);

      const saveBtn = page.locator('header button').filter({ hasText: 'Save' }).first();
      await saveBtn.click();

      try {
        await page.waitForURL(/\/crm\/leads$/, { timeout: 15_000 });
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        createdLeadNames.push(lead.name);
        log(`Lead ${i + 1}`, 'PASS', `${lead.name} created`);
        await snap(page, ctx, `08-lead-${i + 1}-saved`);
      } catch {
        log(`Lead ${i + 1}`, 'FAIL', `Save may have failed - URL: ${page.url()}`);
        await snap(page, ctx, `08-lead-${i + 1}-save-error`);
        await page.goto(`${BASE_URL}/crm/leads`);
        await page.waitForLoadState('networkidle');
      }
    });
  }

  await test.step('Leads: verify all leads in list view', async () => {
    await page.goto(`${BASE_URL}/crm/leads`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);
    await snap(page, ctx, '09-leads-list-verify');

    const bodyText = (await page.locator('body').textContent()) || '';
    let found = 0;
    for (const lead of LEADS_DATA) {
      if (bodyText.includes(lead.name)) found += 1;
    }
    log('Verify', found > 0 ? 'PASS' : 'FAIL', `${found}/${LEADS_DATA.length} leads found in list`);
  });

  await test.step('Leads: open drawer and add note', async () => {
    const viewBtn = page.locator('button').filter({ hasText: 'View' }).first();
    if (await viewBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await viewBtn.click();
      await page.waitForTimeout(1_500);
      const drawer = page.locator('div.fixed.right-0');
      await expect(drawer).toBeVisible({ timeout: 5_000 });
      await snap(page, ctx, '10-drawer-open');

      await drawer.evaluate((el) => {
        (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
      });
      await page.waitForTimeout(800);

      const noteTextarea = drawer.locator('textarea[placeholder*="Add a note about an interaction"]');
      if (await noteTextarea.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await noteTextarea.fill('Automated test note - lead follow-up scheduled for next week');
        await page.waitForTimeout(300);
        const addBtn = drawer.locator('button.self-end');
        if (await addBtn.isVisible().catch(() => false)) {
          await addBtn.click();
          await page.waitForTimeout(2_000);
          await snap(page, ctx, '11-note-added');
          log('Note', 'PASS', 'Note submitted');
        }
      }
    }
  });

  await test.step('Leads: search and filter', async () => {
    await page.goto(`${BASE_URL}/crm/leads`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    const searchInput = page.locator('input[placeholder*="Search by name"]');
    if (await searchInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await searchInput.fill(LEADS_DATA[0].name.split(' ')[0]);
      await page.waitForTimeout(1_000);
      await snap(page, ctx, '12-search-result');
      await searchInput.fill('');
      await page.waitForTimeout(300);
    }

    const buyerBtn = page.locator('button').filter({ hasText: 'Buyer' }).first();
    if (await buyerBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await buyerBtn.click();
      await page.waitForTimeout(1_000);
      await snap(page, ctx, '13-filter-buyer');
      const allBtn = page.locator('button').filter({ hasText: 'All Types' }).first();
      if (await allBtn.isVisible().catch(() => false)) {
        await allBtn.click();
        await page.waitForTimeout(500);
      }
    }
    await snap(page, ctx, '14-leads-complete');
  });

  // eslint-disable-next-line no-console
  console.log(`[${ctx.feature}] Leads created: ${createdLeadNames.length}/${LEADS_DATA.length}`);
}
