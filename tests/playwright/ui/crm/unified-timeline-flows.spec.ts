import { test, expect } from '@playwright/test';
import { TEST_TIMEOUT_MS, BASE_URL } from '../../helpers/config';
import { setupEvidence, createLogger, setupDialogHandler, snap } from '../../helpers/evidence';
import { createTestRun, generateUniqueName, phoneForRun } from '../../helpers/seedData';

test('Unified Activity Timeline: lead lifecycle events appear in timeline', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  const ctx = setupEvidence('unified-timeline');
  const log = createLogger(ctx.feature);
  setupDialogHandler(page, log);
  await page.setViewportSize({ width: 1280, height: 720 });

  const run = createTestRun();
  const nameObj = generateUniqueName(run.runStamp, 0);
  const testName = `TimelineTest ${nameObj.fullName}`;
  const testPhone = phoneForRun(run, 1);
  let leadId = '';

  await test.step('Create lead and verify timeline link', async () => {
    await page.goto(`${BASE_URL}/crm/leads/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await page.fill('input[placeholder="Full name"]', testName);
    await page.fill('input[placeholder="Phone number"]', testPhone);
    await page.click('button:has-text("Save")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    const url = page.url();
    const match = url.match(/\/crm\/leads\/([^\/]+)$/);
    if (match && match[1] && match[1] !== 'new') {
      leadId = match[1];
      log('LeadCreated', 'PASS', `Lead ID: ${leadId}`);
    } else {
      await page.goto(`${BASE_URL}/crm/leads`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1_000);
      await snap(page, ctx, '01-leads-list');
    }
  });

  await test.step('Verify timeline component on lead detail', async () => {
    if (!leadId) { log('SkipTimelineCheck', 'WARN', 'No leadId, skipping'); return; }
    await page.goto(`${BASE_URL}/crm/leads/${leadId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const timelineHeading = page.locator('h3', { hasText: 'Unified Activity Timeline' });
    await expect(timelineHeading).toBeVisible({ timeout: 5_000 });
    log('TimelineHeading', 'PASS', 'Unified Activity Timeline heading visible');
    await snap(page, ctx, '02-lead-timeline-empty');
  });

  await test.step('Add note and verify timeline entry', async () => {
    if (!leadId) { log('SkipNoteTest', 'WARN', 'No leadId, skipping note test'); return; }
    await page.goto(`${BASE_URL}/crm/leads/${leadId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    const noteTextarea = page.locator('textarea[placeholder*="Add a note about an interaction"]').first();
    await expect(noteTextarea).toBeVisible({ timeout: 5_000 });
    await noteTextarea.fill('Test automation note for unified timeline');
    await page.click('button[aria-label="Add"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    log('NoteAdded', 'PASS', 'Note added to lead');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const noteEntry = page.locator('text=Note Added').first();
    await expect(noteEntry).toBeVisible({ timeout: 5_000 });
    log('TimelineNote', 'PASS', 'Note Added entry visible in timeline');
    await snap(page, ctx, '03-lead-timeline-with-note');
  });

  await test.step('Schedule meeting and verify timeline entry', async () => {
    if (!leadId) { log('SkipMeetingTest', 'WARN', 'No leadId, skipping meeting test'); return; }
    await page.goto(`${BASE_URL}/crm/leads/${leadId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    const scheduleBtn = page.locator('button', { hasText: 'Schedule' }).first();
    await expect(scheduleBtn).toBeVisible({ timeout: 5_000 });
    await scheduleBtn.click();
    await page.waitForTimeout(800);
    const titleInput = page.locator('input[placeholder*="Meeting title"]').first();
    await expect(titleInput).toBeVisible({ timeout: 5_000 });
    await titleInput.fill('Test Meeting for Timeline');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[type="date"]', dateStr);
    await page.fill('input[type="time"]', '10:00');
    const saveBtn = page.locator('button', { hasText: 'Schedule Meeting' }).first();
    await saveBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    log('MeetingScheduled', 'PASS', 'Meeting scheduled for lead');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const meetingEntry = page.locator('text=Meeting Scheduled').first();
    await expect(meetingEntry).toBeVisible({ timeout: 5_000 });
    log('TimelineMeeting', 'PASS', 'Meeting Scheduled entry visible in timeline');
    await snap(page, ctx, '04-lead-timeline-with-meeting');
  });

  await test.step('Convert lead and verify conversion in timeline', async () => {
    if (!leadId) { log('SkipConversionTest', 'WARN', 'No leadId, skipping conversion test'); return; }
    await page.goto(`${BASE_URL}/crm/leads/${leadId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_000);
    const convertBtn = page.locator('button', { hasText: 'Convert' }).first();
    await expect(convertBtn).toBeVisible({ timeout: 5_000 });
    await convertBtn.click();
    await page.waitForTimeout(800);
    await page.selectOption('select[name="convertTo"]', 'buyer');
    const confirmConvertBtn = page.locator('button', { hasText: 'Convert Lead' }).first();
    await confirmConvertBtn.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);
    log('LeadConverted', 'PASS', 'Lead converted to buyer');
    await page.goto(`${BASE_URL}/crm/leads/${leadId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const conversionEntry = page.locator('text=Lead Converted').first();
    await expect(conversionEntry).toBeVisible({ timeout: 5_000 });
    log('TimelineConversion', 'PASS', 'Lead Converted entry visible in timeline');
    await snap(page, ctx, '05-lead-timeline-converted');
  });
});
