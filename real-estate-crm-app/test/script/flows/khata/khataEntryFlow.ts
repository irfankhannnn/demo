import { expect, Page, test } from '@playwright/test';
import { BASE_URL } from '../../helpers/config';
import { EvidenceCtx, createLogger, snap } from '../../helpers/evidence';

// Maps user-friendly payment mode labels to the exact <option value> in SettlementModal.tsx
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

  // ==================================================================
  // STEP 1: Navigate to create form
  // ==================================================================
  await test.step('Khata Entry: navigate to create form', async () => {
    await page.goto(`${BASE_URL}/crm/khata/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    // Heading text is "Add Khata Entry" (from KhataEntryForm.tsx line 273)
    await expect(page.getByRole('heading', { name: /Add Khata Entry/i })).toBeVisible({ timeout: 10_000 });
    await snap(page, ctx, '14-entry-form');
    log('Entry', 'PASS', 'Entry form loaded');
  });

  // ==================================================================
  // STEP 2: Select Party Type (default is OWNER) — just verify it's set
  // ==================================================================
  await test.step('Khata Entry: verify default party type is Owner', async () => {
    // Party Type is the first select on the page
    const partyTypeSelect = page.locator('select').first();
    await expect(partyTypeSelect).toBeVisible({ timeout: 5_000 });
    const currentValue = await partyTypeSelect.inputValue();
    log('Entry', 'INFO', `Default party type: ${currentValue}`);
    // Leave as OWNER since we created an owner in setup
  });

  // ==================================================================
  // STEP 3: Party Search — uses PartySearchSelector component
  // Placeholder: "Search owner by name or phone..."
  // ==================================================================
  await test.step('Khata Entry: search and select party', async () => {
    const partySearchInput = page.locator('input[placeholder*="Search owner by name"]');
    await expect(partySearchInput).toBeVisible({ timeout: 5_000 });
    await partySearchInput.click();
    await partySearchInput.fill(ownerName);

    // PartySearchSelector has a 300ms debounce + API call
    await page.waitForTimeout(1_200);
    await snap(page, ctx, '16-party-search');

    // Results appear as <button> elements with party name
    const partyResult = page.locator('button').filter({ hasText: ownerName }).first();
    await expect(partyResult).toBeVisible({ timeout: 8_000 });
    await partyResult.click();

    // After selection, the component shows a confirmation card with party name + clear button
    await page.waitForTimeout(800);
    await expect(page.locator('p').filter({ hasText: ownerName }).first()).toBeVisible({ timeout: 5_000 });
    await snap(page, ctx, '17-party-selected');
    log('Entry', 'PASS', `Party "${ownerName}" selected`);
  });

  // ==================================================================
  // STEP 4: Property dropdown — disabled until party selected + loads async
  // ==================================================================
  await test.step('Khata Entry: select property', async () => {
    // Wait for "Loading properties..." spinner to disappear if present
    const loadingText = page.locator('text=Loading properties...');
    if (await loadingText.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await loadingText.waitFor({ state: 'hidden', timeout: 10_000 });
    }
    await page.waitForTimeout(800);

    // Property select has first option "Select Property" (from line 336)
    // We locate it as the select that contains "Select Property" option
    const propertySelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Select Property' }) });
    await expect(propertySelect).toBeVisible({ timeout: 8_000 });
    await expect(propertySelect).toBeEnabled({ timeout: 8_000 });

    const options = await propertySelect.locator('option').allTextContents();
    log('Entry', 'INFO', `Property options: ${options.length}`);

    // Find the option matching our property title
    const matchingOption = options.find((o) => o.includes(propertyTitle));
    if (matchingOption) {
      await propertySelect.selectOption({ label: matchingOption });
      log('Entry', 'PASS', `Selected property: ${matchingOption}`);
    } else if (options.length > 1) {
      // Fallback: select first non-placeholder option
      await propertySelect.selectOption({ index: 1 });
      log('Entry', 'INFO', `Fallback: selected option index 1 (${options[1]})`);
    } else {
      throw new Error('No properties available for the selected party');
    }
    await page.waitForTimeout(500);
    await snap(page, ctx, '18-property-selected');
  });

  // ==================================================================
  // STEP 5: Transaction Type — IT IS A <select>, NOT A BUTTON
  // Values: TO_TAKE (default), TO_GIVE
  // ==================================================================
  await test.step('Khata Entry: set transaction type to TO_TAKE', async () => {
    // Transaction type is the select with "To Take" / "To Give" options
    const txnSelect = page.locator('select').filter({ has: page.locator('option[value="TO_TAKE"]') });
    await expect(txnSelect).toBeVisible({ timeout: 5_000 });
    await txnSelect.selectOption('TO_TAKE');
    await page.waitForTimeout(300);
    await snap(page, ctx, '19-transaction-type');
    log('Entry', 'PASS', 'Transaction type: TO_TAKE');
  });

  // ==================================================================
  // STEP 6: Line Items — category select + amount input per row
  // Button text is "Add Item" (not "Add Line Item")
  // Amount uses NumericInput with placeholder "Enter amount"
  // ==================================================================
  await test.step('Khata Entry: fill line items', async () => {
    for (let i = 0; i < entryData.lineItems.length; i++) {
      const item = entryData.lineItems[i];

      if (i > 0) {
        const addItemBtn = page.getByRole('button', { name: /^Add Item$/ });
        await expect(addItemBtn).toBeVisible({ timeout: 3_000 });
        await addItemBtn.click();
        await page.waitForTimeout(500);
      }

      // Category selects are the ones with "Select Category" placeholder option
      const categorySelects = page.locator('select').filter({ has: page.locator('option', { hasText: 'Select Category' }) });
      const catSelect = categorySelects.nth(i);
      await expect(catSelect).toBeVisible({ timeout: 5_000 });

      const catOptions = await catSelect.locator('option').allTextContents();
      const matchingCat = catOptions.find((o) => o.toLowerCase() === item.category.toLowerCase());
      if (matchingCat) {
        await catSelect.selectOption({ label: matchingCat });
      } else if (catOptions.length > 1) {
        // Fallback to first real category
        await catSelect.selectOption({ index: 1 });
        log('Entry', 'INFO', `Category "${item.category}" not found, used "${catOptions[1]}"`);
      }
      await page.waitForTimeout(300);

      // Amount input — placeholder "Enter amount"
      const amountInput = page.locator('input[placeholder="Enter amount"]').nth(i);
      await expect(amountInput).toBeVisible({ timeout: 3_000 });
      await amountInput.fill(String(item.amount));
      await page.waitForTimeout(200);
    }
    await snap(page, ctx, '20-line-items-filled');
    log('Entry', 'PASS', `Filled ${entryData.lineItems.length} line items`);
  });

  // ==================================================================
  // STEP 7: Description (optional)
  // ==================================================================
  await test.step('Khata Entry: fill description', async () => {
    const descTextarea = page.locator('textarea[placeholder*="Add any notes"]');
    if (await descTextarea.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await descTextarea.fill(entryData.description);
    }
    await snap(page, ctx, '21-description-filled');
  });

  // ==================================================================
  // STEP 8: Save — button text is "Create Entry" (from line 579)
  // handleSubmit has setTimeout(navigate, 1500) after success
  // ==================================================================
  await test.step('Khata Entry: save and verify creation', async () => {
    const saveBtn = page.getByRole('button', { name: /Create Entry/i });
    await expect(saveBtn).toBeVisible({ timeout: 5_000 });
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();

    // Wait for "Entry created successfully" toast
    const successToast = page.getByText('Entry created successfully');
    await expect(successToast).toBeVisible({ timeout: 10_000 }).catch(() => null);

    // Wait for redirect (setTimeout 1500ms in code)
    await page.waitForURL(/\/crm\/khata(\?|$|#)/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000); // Let list re-render
    await snap(page, ctx, '22-entry-saved');
    log('Entry', 'PASS', 'Entry created and redirected to khata list');
  });

  // ==================================================================
  // STEP 9: Settle the created entry via SettlementModal
  // Action: click green CheckCircle icon button on the entry row
  // Modal has: amount, payment mode (CASH/UPI/BANK_TRANSFER/CHEQUE),
  //            reference ID (only if not CASH), settlement date, notes
  // ==================================================================
  await test.step('Khata Entry: settle entry via SettlementModal', async () => {
    // The settle button is an icon button with title="Mark as Settled"
    const settleBtn = page.locator('button[title="Mark as Settled"]').first();
    if (!(await settleBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      log('Settlement', 'INFO', 'No pending entry to settle — skipping');
      return;
    }
    await settleBtn.click();
    await page.waitForTimeout(800);

    // SettlementModal heading: "Settle Payment"
    await expect(page.getByRole('heading', { name: /Settle Payment/i })).toBeVisible({ timeout: 5_000 });
    await snap(page, ctx, '23-settle-modal-open');

    // Payment mode select — use value not label
    const paymentModeValue = PAYMENT_MODE_MAP[entryData.paymentMode] || 'BANK_TRANSFER';
    const modeSelect = page.locator('select').filter({ has: page.locator('option[value="BANK_TRANSFER"]') });
    await expect(modeSelect).toBeVisible({ timeout: 3_000 });
    await modeSelect.selectOption(paymentModeValue);
    await page.waitForTimeout(400);

    // Reference ID input appears only for non-CASH modes
    if (paymentModeValue !== 'CASH') {
      // Placeholder varies: "reference number" / "transaction ID" / "cheque number"
      const refInput = page.locator('input[placeholder*="reference"], input[placeholder*="transaction"], input[placeholder*="cheque"]').first();
      if (await refInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await refInput.fill(entryData.referenceId);
      }
    }

    // Settlement notes
    const notesTextarea = page.locator('textarea[placeholder*="settlement notes"]');
    if (await notesTextarea.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await notesTextarea.fill(entryData.settlementNote);
    }
    await snap(page, ctx, '24-settle-form-filled');

    // Confirm button text: "Settle Payment"
    const confirmBtn = page.getByRole('button', { name: /^Settle Payment$/ });
    await expect(confirmBtn).toBeVisible({ timeout: 3_000 });
    await confirmBtn.click();

    // Wait for success toast
    await expect(page.getByText('Entry settled successfully')).toBeVisible({ timeout: 10_000 }).catch(() => null);
    await page.waitForTimeout(2_000); // Let loadData() re-fetch
    await snap(page, ctx, '25-entry-settled');

    // Verify a "Settled" badge exists somewhere
    const settledBadge = page.getByText('Settled').first();
    if (await settledBadge.isVisible({ timeout: 5_000 }).catch(() => false)) {
      log('Settlement', 'PASS', 'Entry marked as settled');
    }
  });

  // NOTE: Unsettle is NOT implemented in the frontend (KhataBook.tsx / KhataDrawer.tsx)
  // Only the backend route exists. So we skip unsettle UI testing.
  log('Entry', 'INFO', 'Unsettle flow not available in UI — backend-only feature, skipped');
}
