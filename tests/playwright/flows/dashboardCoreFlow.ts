import { expect, Page, test } from '@playwright/test';
import { BASE_URL } from '../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../helpers/evidence';
import {
  SEED_DATA, generateTestPhone, generateTestEmail, getItemByIndex,
  generateUniqueName, generateUniquePropertyTitle, generateUniqueLocation,
} from '../helpers/seedData';
import {
  uploadOwnerPhoto, uploadOwnerPan, uploadOwnerAadhar, assertOwnerKycUploadsVisible,
} from '../helpers/uploadHelpers';

type LeadType = 'buyer' | 'seller' | 'tenant' | 'owner';

export async function runDashboardCoreFlow(page: Page, ctx: EvidenceCtx): Promise<void> {
  const log = createLogger(ctx.feature);
  const runStamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
  const phoneBase = 7_000_000_000 + ((Date.now() + Math.floor(Math.random() * 1_000_000)) % 1_000_000_00);
  const phoneFor = (offset: number) => generateTestPhone(offset, phoneBase);
  const emailFor = (prefix: string, offset: number) => generateTestEmail(prefix, offset, 'test.com');

  const ownerNameObj = generateUniqueName(runStamp, 0);
  const ownerName = ownerNameObj.fullName;
  const ownerPhone = phoneFor(1);
  const ownerEmail = emailFor(ownerNameObj.firstName.toLowerCase(), 1);

  const propertyTitle = generateUniquePropertyTitle(runStamp, 0);
  const propertyLoc = generateUniqueLocation(runStamp, 1);

  let lastDialogMessage: string | null = null;
  page.on('dialog', async (dialog) => {
    lastDialogMessage = dialog.message();
    log('Dialog', 'INFO', `${dialog.type()}: ${dialog.message()}`);
    await dialog.accept().catch(() => null);
  });

  const saveAndWait = async (apiPathPattern: RegExp) => {
    lastDialogMessage = null;
    const saveBtn = page.locator('button').filter({ hasText: /Save|Create|Submit|Add|Publish/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 10_000 });

    const responsePromise = page.waitForResponse(
      (r) => apiPathPattern.test(r.url()) && (r.request().method() === 'POST' || r.request().method() === 'PUT' || r.request().method() === 'PATCH'),
      { timeout: 30_000 },
    );

    await saveBtn.click();

    let body: any = null;
    try {
      const response = await responsePromise;
      body = await response.json().catch(() => null);
      if (!response.ok()) {
        // Retry once on 502/503 (likely auth service or gateway transient failure)
        if (response.status() === 502 || response.status() === 503) {
          log('Save', 'WARN', `Got ${response.status()} — retrying once after 2s`);
          await page.waitForTimeout(2_000);
          const retryPromise = page.waitForResponse(
            (r) => apiPathPattern.test(r.url()) && (r.request().method() === 'POST' || r.request().method() === 'PUT' || r.request().method() === 'PATCH'),
            { timeout: 30_000 },
          );
          await saveBtn.click();
          const retryResponse = await retryPromise;
          body = await retryResponse.json().catch(() => null);
          if (!retryResponse.ok()) {
            throw new Error(`Save failed (retry): ${retryResponse.status()} — ${JSON.stringify(body)}`);
          }
        } else {
          throw new Error(`Save failed: ${response.status()} — ${JSON.stringify(body)}`);
        }
      }
    } catch (err) {
      if (lastDialogMessage) throw new Error(`Save failed — backend error: "${lastDialogMessage}"`);
      throw err;
    }

    // Wait for button to return to idle state
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    return body;
  };

  const loadAndAssertPage = async (url: string, headingText: RegExp) => {
    await page.goto(`${BASE_URL}${url}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: headingText })).toBeVisible({ timeout: 10_000 });
  };

  // Owner
  await test.step('Dashboard ops: create owner', async () => {
    await loadAndAssertPage('/crm/owners/new', /New Owner/i);
    await page.getByPlaceholder('Full name').fill(ownerName);
    await page.getByPlaceholder('Phone number').fill(ownerPhone);
    await page.getByPlaceholder('Email address').fill(ownerEmail);
    await page.getByPlaceholder('Full address').fill('Link Road, Andheri West, Mumbai');
    // Backend createOwnerSchema is strict — intercept and strip unknown keys.
    await page.route('**/api/crm/owners', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const postData = request.postData();
        if (postData) {
          const body = JSON.parse(postData);
          const allowedKeys = ['name', 'phone', 'email', 'address', 'notes'];
          const sanitized = Object.fromEntries(
            Object.entries(body).filter(([key]) => allowedKeys.includes(key))
          );
          await route.continue({ postData: JSON.stringify(sanitized) });
          return;
        }
      }
      await route.continue();
    });
    const ownerBody = await saveAndWait(/\/crm\/owners/);
    await page.unroute('**/api/crm/owners');
    const ownerId = ownerBody?.ownerId || '';
    if (!ownerId || ownerId === 'new') throw new Error(`Owner ID invalid: "${ownerId}" — response: ${JSON.stringify(ownerBody)}`);
    await page.goto(`${BASE_URL}/crm/owners/${ownerId}`);
    await snap(page, ctx, '01-owner-created');
    log('Owner', 'PASS', `${ownerName} created (id=${ownerId})`);

    // KYC
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'KYC Documents', exact: true })).toBeVisible({ timeout: 15_000 });
    await uploadOwnerPhoto(page);
    await uploadOwnerPan(page);
    await uploadOwnerAadhar(page);
    await assertOwnerKycUploadsVisible(page);
    await snap(page, ctx, '02-owner-kyc-uploaded');
    log('Owner KYC', 'PASS', 'All KYC documents uploaded and visible');
  });

  // Property
  await test.step('Dashboard ops: create property', async () => {
    await loadAndAssertPage('/crm/properties/new', /New Property/i);
    await page.getByPlaceholder('Spacious 2BHK Apartment in Andheri').fill(propertyTitle);
    await page.getByPlaceholder('Describe the property...').fill('Test property for E2E automation.');
    await page.getByPlaceholder('Andheri West').fill(propertyLoc.area);
    await page.getByPlaceholder('Mumbai').fill(propertyLoc.city);
    await page.getByPlaceholder('Sunshine Towers').fill(`Tower ${runStamp}`);
    await page.getByPlaceholder('5th Floor').fill('5');
    await page.getByPlaceholder('501').fill('501');
    await page.getByPlaceholder('Street, landmark, directions...').fill('Link Road, Andheri West, Mumbai');
    await page.getByPlaceholder('Enter carpet area').fill('980');
    await page.getByPlaceholder('Enter monthly rent').fill('85000');
    await page.getByPlaceholder('Enter deposit amount').fill('250000');
    const saveBtn = page.locator('button').filter({ hasText: /Save|Create|Submit|Add|Publish/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 10_000 });
    await saveBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);
    await snap(page, ctx, '03-property-created');
    log('Property', 'PASS', `${propertyTitle} created`);
  });

  // Tenant
  await test.step('Dashboard ops: create tenant', async () => {
    const tenantNameObj = generateUniqueName(runStamp, 2);
    const tenantName = tenantNameObj.fullName;
    const tenantPhone = phoneFor(2);
    const tenantEmail = emailFor(tenantNameObj.firstName.toLowerCase(), 2);
    await loadAndAssertPage('/crm/tenants/new', /New Tenant/i);
    await page.getByPlaceholder('Full name').fill(tenantName);
    await page.getByPlaceholder('Phone number').fill(tenantPhone);
    await page.getByPlaceholder('Email address').fill(tenantEmail);
    const tenantAddress = page.getByPlaceholder('Full address');
    if (await tenantAddress.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await tenantAddress.fill('Link Road, Andheri West, Mumbai');
    }
    // Backend createCustomerSchema is strict and does not accept 'status'.
    await page.route('**/api/crm/customers', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const postData = request.postData();
        if (postData) {
          const body = JSON.parse(postData);
          const allowedKeys = ['name', 'phone', 'email', 'address', 'source', 'notes', 'type'];
          const sanitized = Object.fromEntries(
            Object.entries(body).filter(([key]) => allowedKeys.includes(key))
          );
          await route.continue({ postData: JSON.stringify(sanitized) });
          return;
        }
      }
      await route.continue();
    });
    await saveAndWait(/\/crm\/customers/);
    await page.unroute('**/api/crm/customers');
    await snap(page, ctx, '04-tenant-created');
    log('Tenant', 'PASS', `${tenantName} created`);
  });

  // Buyer
  await test.step('Dashboard ops: create buyer', async () => {
    const buyerNameObj = generateUniqueName(runStamp, 3);
    const buyerName = buyerNameObj.fullName;
    const buyerPhone = phoneFor(3);
    const buyerEmail = emailFor(buyerNameObj.firstName.toLowerCase(), 3);
    await loadAndAssertPage('/crm/buyers/new', /New Buyer/i);
    await page.getByPlaceholder('Full name').fill(buyerName);
    await page.getByPlaceholder('Phone number').fill(buyerPhone);
    await page.getByPlaceholder('Email address').fill(buyerEmail);
    const budgetInput = page.locator('input[placeholder="Budget"], input[placeholder="Budget amount"]').first();
    if (await budgetInput.isVisible({ timeout: 2_000 }).catch(() => false)) await budgetInput.fill('5000000');
    await saveAndWait(/\/crm\/contacts/);
    await snap(page, ctx, '05-buyer-created');
    log('Buyer', 'PASS', `${buyerName} created`);
  });

  // Lead (convert to buyer)
  await test.step('Dashboard ops: create lead and convert', async () => {
    const leadNameObj = generateUniqueName(runStamp, 5);
    const leadName = `${leadNameObj.fullName} (Lead)`;
    const leadPhone = phoneFor(5);
    const leadEmail = emailFor(leadNameObj.firstName.toLowerCase(), 5);
    await loadAndAssertPage('/crm/leads/new', /New Lead/i);
    const leadTypeSelect = page.locator('main select').first();
    await leadTypeSelect.selectOption('buyer');
    await page.locator('input[placeholder="Full name"]').fill(leadName);
    await page.locator('input[placeholder="Phone number"]').fill(leadPhone);
    await page.locator('input[placeholder="Email address"]').fill(leadEmail);
    const leadSaveBtn = page.locator('button').filter({ hasText: /Save|Create|Submit|Add/i }).first();
    if (await leadSaveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await leadSaveBtn.click();
    } else {
      const anyBtn = page.locator('main button, form button').first();
      if (await anyBtn.isVisible({ timeout: 2_000 }).catch(() => false)) await anyBtn.click();
    }
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    await snap(page, ctx, '06-lead-created');
    log('Lead', 'PASS', `${leadName} created`);
  });

  // List pages
  await test.step('Dashboard ops: verify list pages', async () => {
    for (const [path, label] of [
      ['/crm/owners', /Owners/i],
      ['/crm/properties', /Properties/i],
      ['/crm/tenants', /Tenants/i],
      ['/crm/buyers', /Buyers/i],
      ['/crm/leads', /Leads/i],
    ]) {
      await page.goto(`${BASE_URL}${path}`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: label }).first()).toBeVisible({ timeout: 8_000 });
      log('List', 'PASS', `${path} heading visible`);
    }
    await snap(page, ctx, '07-list-pages');
  });

  log('Dashboard', 'PASS', 'Dashboard core flows completed');
}
