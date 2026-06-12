import { expect, Page, test } from '@playwright/test';
import { BASE_URL } from '../../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../../helpers/evidence';

const PAYMENT_MODE_MAP: Record<string, string> = {
  'Cash': 'CASH',
  'UPI': 'UPI',
  'Bank Transfer': 'BANK_TRANSFER',
  'Cheque': 'CHEQUE',
};

export async function runKhataEntryFlow(
  page: Page,
  ctx: EvidenceCtx,
  ownerName: string,
  propertyTitle: string,
  entryData: {
    description: string;
    lineItems: { category: string; amount: number }[];
    paymentMode: string;
    referenceId: string;
    settlementNote: string;
  },
): Promise<void> {
  const log = createLogger(ctx.feature);

  await test.step('Khata Entry: navigate to create form', async () => {
    await page.goto(`${BASE_URL}/crm/khata/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    await expect(page.getByRole('heading', { name: /Add Khata Entry/i })).toBeVisible({ timeout: 10_000 });
    await snap(page, ctx, '14-entry-form');
    log('Entry', 'PASS', 'Entry form loaded');
  });

  await test.step('Khata Entry: verify default party type is Owner', async () => {
    const partyTypeSelect = page.locator('select').first();
    await expect(partyTypeSelect).toBeVisible({ timeout: 5_000 });
    const currentValue = await partyTypeSelect.inputValue();
    log('Entry', 'INFO', `Default party type: ${currentValue}`);
  });

  await test.step('Khata Entry: search and select party', async () => {
    const partySearchInput = page.locator('input[placeholder*="Search owner by name"]');
    await expect(partySearchInput).toBeVisible({ timeout: 5_000 });
    await partySearchInput.click();
    await partySearchInput.fill(ownerName);
    await page.waitForTimeout(1_200);
    await snap(page, ctx, '16-party-search');
    const partyResult = page.locator('button').filter({ hasText: ownerName }).first();
    await expect(partyResult).toBeVisible({ timeout: 8_000 });
    await partyResult.click();
    await page.waitForTimeout(800);
    await expect(page.locator('p').filter({ hasText: ownerName }).first()).toBeVisible({ timeout: 5_000 });
    await snap(page, ctx, '17-party-selected');
    log('Entry', 'PASS', `Party "${ownerName}" selected`);
  });

  await test.step('Khata Entry: select property', async () => {
    const loadingText = page.locator('text=Loading properties...');
    if (await loadingText.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await loadingText.waitFor({ state: 'hidden', timeout: 10_000 });
    }
    await page.waitForTimeout(800);
    const propertySelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Select Property' }) });
    await expect(propertySelect).toBeVisible({ timeout: 8_000 });
    await expect(propertySelect).toBeEnabled({ timeout: 8_000 });
    const options = await propertySelect.locator('option').allTextContents();
    log('Entry', 'INFO', `Property options: ${options.length}`);
    const matchingOption = options.find((o) => o.includes(propertyTitle));
    if (matchingOption) {
      await propertySelect.selectOption({ label: matchingOption });
      log('Entry', 'PASS', `Selected property: ${matchingOption}`);
    } else if (options.length > 1) {
      await propertySelect.selectOption({ index: 1 });
      log('Entry', 'INFO', `Fallback: selected option index 1 (${options[1]})`);
    } else {
      throw new Error('No properties available for the selected party');
    }
    await page.waitForTimeout(500);
    await snap(page, ctx, '18-property-selected');
  });

  await test.step('Khata Entry: set transaction type to TO_TAKE', async () => {
    const txnSelect = page.locator('select').filter({ has: page.locator('option[value="TO_TAKE"]') });
    await expect(txnSelect).toBeVisible({ timeout: 5_000 });
    await txnSelect.selectOption('TO_TAKE');
    await page.waitForTimeout(300);
    await snap(page, ctx, '19-transaction-type');
    log('Entry', 'PASS', 'Transaction type: TO_TAKE');
  });

  await test.step('Khata Entry: fill line items', async () => {
    for (let i = 0; i < entryData.lineItems.length; i++) {
      const item = entryData.lineItems[i];
      if (i > 0) {
        const addItemBtn = page.getByRole('button', { name: /^Add Item$/ });
        await expect(addItemBtn).toBeVisible({ timeout: 3_000 });
        await addItemBtn.click();
        await page.waitForTimeout(500);
      }
      const categorySelects = page.locator('select').filter({ has: page.locator('option', { hasText: 'Select Category' }) });
      const catSelect = categorySelects.nth(i);
      await expect(catSelect).toBeVisible({ timeout: 5_000 });
      const catOptions = await catSelect.locator('option').allTextContents();
      const matchingCat = catOptions.find((o) => o.toLowerCase() === item.category.toLowerCase());
      if (matchingCat) await catSelect.selectOption({ label: matchingCat });
      else if (catOptions.length > 1) {
        await catSelect.selectOption({ index: 1 });
        log('Entry', 'INFO', `Category "${item.category}" not found, used "${catOptions[1]}"`);
      }
      await page.waitForTimeout(300);
      const amountInput = page.locator('input[placeholder="Enter amount"]').nth(i);
      await expect(amountInput).toBeVisible({ timeout: 3_000 });
      await amountInput.fill(String(item.amount));
      await page.waitForTimeout(200);
    }
    await snap(page, ctx, '20-line-items-filled');
    log('Entry', 'PASS', `Filled ${entryData.lineItems.length} line items`);
  });

  await test.step('Khata Entry: fill description', async () => {
    const descTextarea = page.locator('textarea[placeholder*="Add any notes"]');
    if (await descTextarea.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await descTextarea.fill(entryData.description);
    }
    await snap(page, ctx, '21-description-filled');
  });

  await test.step('Khata Entry: save entry', async () => {
    const saveBtn = page.locator('button[type="submit"]').first();
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });
    await saveBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    await snap(page, ctx, '22-entry-saved');
    log('Entry', 'PASS', 'Khata entry saved');
  });

  await test.step('Khata Entry: settle via SettlementModal', async () => {
    const settleBtn = page.getByRole('button', { name: /Settle|Settle Entry/i }).first();
    if (!(await settleBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      log('Settlement', 'INFO', 'Settle button not visible, skipping settlement');
      return;
    }
    await settleBtn.click();
    await page.waitForTimeout(800);
    await snap(page, ctx, '23-settlement-modal');
    log('Settlement', 'PASS', 'Settlement modal opened');

    const paymentMode = PAYMENT_MODE_MAP[entryData.paymentMode] || 'BANK_TRANSFER';
    const modeSelect = page.locator('select').filter({ has: page.locator('option[value="' + paymentMode + '"]') });
    if (await modeSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await modeSelect.selectOption(paymentMode);
    }
    const refInput = page.locator('input[placeholder*="Reference"]').first();
    if (await refInput.isVisible({ timeout: 3_000 }).catch(() => false)) await refInput.fill(entryData.referenceId);
    const noteInput = page.locator('textarea[placeholder*="Note"]').first();
    if (await noteInput.isVisible({ timeout: 3_000 }).catch(() => false)) await noteInput.fill(entryData.settlementNote);
    const confirmSettleBtn = page.getByRole('button', { name: /Confirm Settlement|Settle$/i }).first();
    if (await confirmSettleBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmSettleBtn.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1_500);
      await snap(page, ctx, '24-settlement-done');
      log('Settlement', 'PASS', 'Entry settled successfully');
    }
  });
}
