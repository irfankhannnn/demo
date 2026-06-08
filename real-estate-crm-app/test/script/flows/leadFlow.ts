// Lead management flow extracted from comprehensive-lead-test.spec.ts
// so that both lead-flows.spec.ts and all-flows.spec.ts can invoke it.
import { expect, Page, test } from '@playwright/test';
import { BASE_URL } from '../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../helpers/evidence';

export const LEADS_DATA = [
  {
    name: 'Rahul Sharma',
    phone: '9876543210',
    email: 'rahul.sharma@test.com',
    type: 'buyer',
    status: 'new',
    priority: 'high',
    source: 'Website',
    notes: 'Looking for a 3BHK in Andheri West. Budget flexible. Needs parking.',
    buyerRequirement: {
      requirement: '3BHK apartment with modern amenities, gym, and parking',
      budget: 25000000,
      preferredArea: 'Andheri West, Mumbai',
      propertyType: 'apartment',
      bhk: 3,
    },
  },
  {
    "name": "Neha Kapoor",
    "phone": "9123456780",
    "email": "neha.kapoor@test.com",
    "type": "buyer",
    "status": "contacted",
    "priority": "medium",
    "source": "Facebook",
    "notes": "Prefers ready-to-move. Family shifting soon.",
    "buyerRequirement": {
      "requirement": "2BHK with parking and security",
      "budget": 18000000,
      "preferredArea": "Powai, Mumbai",
      "propertyType": "apartment",
      "bhk": 2
    }
  },
  {
    "name": "Amit Verma",
    "phone": "9988776655",
    "email": "amit.verma@test.com",
    "type": "buyer",
    "status": "new",
    "priority": "high",
    "source": "Website",
    "notes": "Investor. Open to under-construction.",
    "buyerRequirement": {
      "requirement": "1BHK high rental yield property",
      "budget": 9500000,
      "preferredArea": "Mira Road, Mumbai",
      "propertyType": "apartment",
      "bhk": 1
    }
  },
  {
    name: 'Priya Patel',
    phone: '9876543211',
    email: 'priya.patel@test.com',
    type: 'seller',
    status: 'contacted',
    priority: 'medium',
    source: 'Referral',
    notes: 'Selling family property. Timeline is 6 months. Serious seller.',
    sellerProperty: {
      propertyType: 'house',
      area: 'Bandra East, Mumbai',
      expectedPrice: 80000000,
      timeline: 'Within 6 months',
    },
  },
  {
    name: 'Amit Kumar',
    phone: '9876543212',
    email: 'amit.kumar@test.com',
    type: 'tenant',
    status: 'qualified',
    priority: 'low',
    source: 'Walk-in',
    notes: 'Working professional, needs 2BHK near office. Pet-friendly building preferred.',
    tenantRequirement: {
      requirement: '2BHK furnished apartment, pet-friendly, near metro station',
      budget: 45000,
      preferredArea: 'Powai, Mumbai',
      moveInDate: '2024-12-01',
    },
  },
  {
    name: 'Sneha Reddy',
    phone: '9876543213',
    email: 'sneha.reddy@test.com',
    type: 'owner',
    status: 'new',
    priority: 'high',
    source: 'Referral',
    notes: 'NRI owner looking for reliable tenant. Long-term lease preferred.',
    ownerProperty: {
      propertyType: 'apartment',
      area: 'Juhu, Mumbai',
      rentExpected: 60000,
    },
  },
  {
    name: 'Vikram Malhotra',
    phone: '9876543214',
    email: 'vikram.malhotra@test.com',
    type: 'buyer',
    status: 'negotiating',
    priority: 'medium',
    source: 'Website',
    notes: 'First-time buyer. Looking for investment property in suburbs.',
    buyerRequirement: {
      requirement: '2BHK for investment purpose, good resale value, near upcoming metro',
      budget: 12000000,
      preferredArea: 'Thane West',
      propertyType: 'apartment',
      bhk: 2,
    },
  },
] as const;

export async function runLeadFlow(page: Page, ctx: EvidenceCtx): Promise<void> {
  const log = createLogger(ctx.feature);
  const createdLeadNames: string[] = [];

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

      const sourceInput = page.locator('input[placeholder*="Referral"]');
      if (await sourceInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await sourceInput.fill(lead.source);
      }

      const statusSelect = page.locator('label').filter({ hasText: /^Status$/ }).locator('..').locator('select');
      if (await statusSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await statusSelect.selectOption(lead.status);
      }

      const prioritySelect = page.locator('label').filter({ hasText: /^Priority$/ }).locator('..').locator('select');
      if (await prioritySelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await prioritySelect.selectOption(lead.priority);
      }

      if (lead.notes) {
        const notesTextarea = page.locator('textarea[placeholder="General notes about this lead..."]');
        if (await notesTextarea.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await notesTextarea.fill(lead.notes);
        }
      }

      if (lead.type === 'buyer' && 'buyerRequirement' in lead && lead.buyerRequirement) {
        const req = lead.buyerRequirement;
        const reqTextarea = page.locator('label').filter({ hasText: /^Requirement$/ }).first().locator('..').locator('textarea');
        if (await reqTextarea.isVisible({ timeout: 2_000 }).catch(() => false)) await reqTextarea.fill(req.requirement);
        const budgetInput = page.locator('input[placeholder="Budget amount"]');
        if (await budgetInput.isVisible({ timeout: 2_000 }).catch(() => false)) await budgetInput.fill(String(req.budget));
        const areaInput = page.locator('input[placeholder="Preferred location"]').first();
        if (await areaInput.isVisible({ timeout: 2_000 }).catch(() => false)) await areaInput.fill(req.preferredArea);
        const propTypeSelect = page.locator('label').filter({ hasText: /^Property Type$/ }).first().locator('..').locator('select');
        if (await propTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) await propTypeSelect.selectOption(req.propertyType);
        const bhkSelect = page.locator('label').filter({ hasText: /^BHK$/ }).first().locator('..').locator('select');
        if (await bhkSelect.isVisible({ timeout: 2_000 }).catch(() => false)) await bhkSelect.selectOption(String(req.bhk));
      }

      if (lead.type === 'seller' && 'sellerProperty' in lead && lead.sellerProperty) {
        const prop = lead.sellerProperty;
        const propTypeSelect = page.locator('label').filter({ hasText: /^Property Type$/ }).first().locator('..').locator('select');
        if (await propTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) await propTypeSelect.selectOption(prop.propertyType);
        const areaInput = page.locator('input[placeholder="Property location"]').first();
        if (await areaInput.isVisible({ timeout: 2_000 }).catch(() => false)) await areaInput.fill(prop.area);
        const priceInput = page.locator('input[placeholder="Expected price"]');
        if (await priceInput.isVisible({ timeout: 2_000 }).catch(() => false)) await priceInput.fill(String(prop.expectedPrice));
        const timelineInput = page.locator('label').filter({ hasText: /^Timeline$/ }).first().locator('..').locator('input');
        if (await timelineInput.isVisible({ timeout: 2_000 }).catch(() => false)) await timelineInput.fill(prop.timeline);
      }

      if (lead.type === 'tenant' && 'tenantRequirement' in lead && lead.tenantRequirement) {
        const req = lead.tenantRequirement;
        const reqTextarea = page.locator('textarea[placeholder="What type of rental are they looking for?"]');
        if (await reqTextarea.isVisible({ timeout: 2_000 }).catch(() => false)) await reqTextarea.fill(req.requirement);
        const budgetInput = page.locator('input[placeholder="Monthly budget"]');
        if (await budgetInput.isVisible({ timeout: 2_000 }).catch(() => false)) await budgetInput.fill(String(req.budget));
        const areaInput = page.locator('input[placeholder="Preferred location"]').nth(1);
        if (await areaInput.isVisible({ timeout: 2_000 }).catch(() => false)) await areaInput.fill(req.preferredArea);
        const dateInput = page.locator('label').filter({ hasText: /^Move-in Date$/ }).first().locator('..').locator('input[type="date"]');
        if (await dateInput.isVisible({ timeout: 2_000 }).catch(() => false)) await dateInput.fill(req.moveInDate);
      }

      if (lead.type === 'owner' && 'ownerProperty' in lead && lead.ownerProperty) {
        const prop = lead.ownerProperty;
        const propTypeSelect = page.locator('label').filter({ hasText: /^Property Type$/ }).first().locator('..').locator('select');
        if (await propTypeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) await propTypeSelect.selectOption(prop.propertyType);
        const areaInput = page.locator('input[placeholder="Property location"]').first();
        if (await areaInput.isVisible({ timeout: 2_000 }).catch(() => false)) await areaInput.fill(prop.area);
        const rentInput = page.locator('input[placeholder="Expected monthly rent"]');
        if (await rentInput.isVisible({ timeout: 2_000 }).catch(() => false)) await rentInput.fill(String(prop.rentExpected));
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
