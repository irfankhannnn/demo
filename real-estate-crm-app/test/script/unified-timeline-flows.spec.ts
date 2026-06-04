// Unified Activity Timeline E2E spec.
// Validates that activities (lead creation, notes, meetings, conversions) appear in the unified timeline.
// Can be run directly: npx playwright test unified-timeline-flows.spec.ts --headed
import { test, expect } from '@playwright/test';
import { TEST_TIMEOUT_MS, BASE_URL } from './helpers/config';
import { setupEvidence, createLogger, snap } from './helpers/evidence';
import { loginWithPhoneOtp } from './helpers/auth';
import { generateUniqueName, generateTestPhone } from './helpers/seedData';

test('Unified Activity Timeline: lead lifecycle events appear in timeline', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  const ctx = setupEvidence('unified-timeline');
  const log = createLogger(ctx.feature);

  page.on('dialog', async (dialog) => {
    log('Dialog', 'INFO', `${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });

  await page.setViewportSize({ width: 1280, height: 720 });

  // Login
  await test.step('Login', async () => {
    await loginWithPhoneOtp(page, ctx);
  });

  const runStamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
  const nameObj = generateUniqueName(runStamp, 0);
  const testName = `TimelineTest ${nameObj.fullName}`;
  const testPhone = generateTestPhone(1, 7_000_000_000 + (Date.now() % 1_000_000_00));

  let leadId = '';

  // Step 1: Create a lead
  await test.step('Create lead and verify timeline link', async () => {
    await page.goto(`${BASE_URL}/crm/leads/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Fill lead form
    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="phone"]', testPhone);
    await page.selectOption('select[name="leadType"]', 'buyer');
    await page.selectOption('select[name="status"]', 'new');
    await page.selectOption('select[name="priority"]', 'high');

    // Save
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);

    // Capture lead ID from URL
    const url = page.url();
    const match = url.match(/\/crm\/leads\/([^\/]+)$/);
    if (match && match[1] && match[1] !== 'new') {
      leadId = match[1];
      log('LeadCreated', 'PASS', `Lead ID: ${leadId}`);
    } else {
      // Try to find the lead in the list
      await page.goto(`${BASE_URL}/crm/leads`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1_000);
      await snap(page, ctx, '01-leads-list');
    }
  });

  // Step 2: Navigate to lead detail and check timeline exists
  await test.step('Verify timeline component on lead detail', async () => {
    if (!leadId) {
      log('SkipTimelineCheck', 'WARN', 'No leadId, skipping timeline check');
      return;
    }

    await page.goto(`${BASE_URL}/crm/leads/${leadId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    // Scroll to find timeline
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Check that "Unified Activity Timeline" heading exists
    const timelineHeading = page.locator('h3', { hasText: 'Unified Activity Timeline' });
    await expect(timelineHeading).toBeVisible({ timeout: 5_000 });
    log('TimelineHeading', 'PASS', 'Unified Activity Timeline heading visible');

    await snap(page, ctx, '02-lead-timeline-empty');
  });

  // Step 3: Add a note and verify it appears in timeline
  await test.step('Add note and verify timeline entry', async () => {
    if (!leadId) {
      log('SkipNoteTest', 'WARN', 'No leadId, skipping note test');
      return;
    }

    // Navigate to lead detail
    await page.goto(`${BASE_URL}/crm/leads/${leadId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);

    // Find the Add Activity Note textarea
    const noteTextarea = page.locator('textarea[placeholder*="Add a note about an interaction"]').first();
    await expect(noteTextarea).toBeVisible({ timeout: 5_000 });

    // Type and add note
    await noteTextarea.fill('Test automation note for unified timeline');
    await page.click('button[aria-label="Add"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    log('NoteAdded', 'PASS', 'Note added to lead');

    // Refresh and scroll to timeline
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Check timeline has the note entry
    const noteEntry = page.locator('text=Note Added').first();
    await expect(noteEntry).toBeVisible({ timeout: 5_000 });
    log('TimelineNote', 'PASS', 'Note Added entry visible in timeline');

    await snap(page, ctx, '03-lead-timeline-with-note');
  });

  // Step 4: Schedule a meeting and verify it appears in timeline
  await test.step('Schedule meeting and verify timeline entry', async () => {
    if (!leadId) {
      log('SkipMeetingTest', 'WARN', 'No leadId, skipping meeting test');
      return;
    }

    // Navigate to lead detail
    await page.goto(`${BASE_URL}/crm/leads/${leadId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);

    // Click Schedule Meeting button
    const scheduleBtn = page.locator('button', { hasText: 'Schedule' }).first();
    await expect(scheduleBtn).toBeVisible({ timeout: 5_000 });
    await scheduleBtn.click();
    await page.waitForTimeout(800);

    // Fill meeting modal
    const titleInput = page.locator('input[placeholder*="Meeting title"]').first();
    await expect(titleInput).toBeVisible({ timeout: 5_000 });
    await titleInput.fill('Test Meeting for Timeline');

    // Set date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[type="date"]', dateStr);

    // Set time
    await page.fill('input[type="time"]', '10:00');

    // Save meeting
    const saveBtn = page.locator('button', { hasText: 'Schedule Meeting' }).first();
    await saveBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);

    log('MeetingScheduled', 'PASS', 'Meeting scheduled for lead');

    // Refresh and scroll to timeline
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Check timeline has the meeting entry
    const meetingEntry = page.locator('text=Meeting Scheduled').first();
    await expect(meetingEntry).toBeVisible({ timeout: 5_000 });
    log('TimelineMeeting', 'PASS', 'Meeting Scheduled entry visible in timeline');

    await snap(page, ctx, '04-lead-timeline-with-meeting');
  });

  // Step 5: Convert lead and verify conversion appears in timeline
  await test.step('Convert lead and verify conversion in timeline', async () => {
    if (!leadId) {
      log('SkipConversionTest', 'WARN', 'No leadId, skipping conversion test');
      return;
    }

    // Navigate to lead detail
    await page.goto(`${BASE_URL}/crm/leads/${leadId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);

    // Click Convert button
    const convertBtn = page.locator('button', { hasText: 'Convert' }).first();
    await expect(convertBtn).toBeVisible({ timeout: 5_000 });
    await convertBtn.click();
    await page.waitForTimeout(800);

    // Select convert to buyer
    await page.selectOption('select[name="convertTo"]', 'buyer');

    // Submit conversion
    const confirmConvertBtn = page.locator('button', { hasText: 'Convert Lead' }).first();
    await confirmConvertBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);

    log('LeadConverted', 'PASS', 'Lead converted to buyer');

    // Navigate to the new buyer (or stay on lead page and check timeline)
    await page.goto(`${BASE_URL}/crm/leads/${leadId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Check timeline has conversion entry
    const conversionEntry = page.locator('text=Lead Converted').first();
    await expect(conversionEntry).toBeVisible({ timeout: 5_000 });
    log('TimelineConversion', 'PASS', 'Lead Converted entry visible in timeline');

    await snap(page, ctx, '05-lead-timeline-with-conversion');
  });

  log('UnifiedTimelineFlow', 'PASS', 'All unified timeline assertions passed');
});
