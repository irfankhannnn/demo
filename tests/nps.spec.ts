/**
 * nps.spec.ts — Playwright tests for NPS Modal + Feedback Backend
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';

test.describe('NPS Modal', () => {
  test('modal renders when user is >14 days old and no previous NPS', async ({ page }) => {
    // Set a user profile with createdAt 15 days ago
    const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString();
    await page.addInitScript((createdAt) => {
      localStorage.setItem('userProfile', JSON.stringify({ createdAt }));
      localStorage.removeItem('nps_last_asked');
      localStorage.removeItem('nps_dismissed_at');
    }, fifteenDaysAgo);

    await page.goto(`${BASE_URL}/crm`);
    // Wait for 3s delay + render
    await page.waitForTimeout(4000);
    const question = page.locator('text=How likely are you to recommend');
    await expect(question).toBeVisible();
  });

  test('modal NOT shown when user is <14 days old', async ({ page }) => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    await page.addInitScript((createdAt) => {
      localStorage.setItem('userProfile', JSON.stringify({ createdAt }));
      localStorage.removeItem('nps_last_asked');
    }, tenDaysAgo);

    await page.goto(`${BASE_URL}/crm`);
    await page.waitForTimeout(4000);
    const question = page.locator('text=How likely are you to recommend');
    await expect(question).not.toBeVisible();
  });

  test('modal NOT shown when nps_last_asked is within 90 days', async ({ page }) => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString();
    const eightyDaysAgo = String(Date.now() - 80 * 86400000);
    await page.addInitScript(({ createdAt, lastAsked }) => {
      localStorage.setItem('userProfile', JSON.stringify({ createdAt }));
      localStorage.setItem('nps_last_asked', lastAsked);
    }, { createdAt: fifteenDaysAgo, lastAsked: eightyDaysAgo });

    await page.goto(`${BASE_URL}/crm`);
    await page.waitForTimeout(4000);
    const question = page.locator('text=How likely are you to recommend');
    await expect(question).not.toBeVisible();
  });

  test('score 5 makes free-text field required', async ({ page }) => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString();
    await page.addInitScript((createdAt) => {
      localStorage.setItem('userProfile', JSON.stringify({ createdAt }));
      localStorage.removeItem('nps_last_asked');
      localStorage.removeItem('nps_dismissed_at');
    }, fifteenDaysAgo);

    await page.goto(`${BASE_URL}/crm`);
    await page.waitForTimeout(4000);

    // Click score 5
    const scoreBtn = page.locator('button:has-text("5")').first();
    await scoreBtn.click();

    // Should show required text
    const requiredText = page.locator('text=Required — min 20 characters');
    await expect(requiredText).toBeVisible();
  });

  test('score 9 shows testimonial checkbox', async ({ page }) => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString();
    await page.addInitScript((createdAt) => {
      localStorage.setItem('userProfile', JSON.stringify({ createdAt }));
      localStorage.removeItem('nps_last_asked');
      localStorage.removeItem('nps_dismissed_at');
    }, fifteenDaysAgo);

    await page.goto(`${BASE_URL}/crm`);
    await page.waitForTimeout(4000);

    // Click score 9
    const scoreBtn = page.locator('button:has-text("9")').first();
    await scoreBtn.click();

    // Should show testimonial checkbox
    const testimonialCheckbox = page.locator('text=May we share your testimonial?');
    await expect(testimonialCheckbox).toBeVisible();
  });

  test('submit valid form stores nps_last_asked in localStorage', async ({ page }) => {
    const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000).toISOString();
    await page.addInitScript((createdAt) => {
      localStorage.setItem('userProfile', JSON.stringify({ createdAt }));
      localStorage.removeItem('nps_last_asked');
      localStorage.removeItem('nps_dismissed_at');
    }, fifteenDaysAgo);

    // Mock the API endpoint
    await page.route('**/api/feedback/nps', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.goto(`${BASE_URL}/crm`);
    await page.waitForTimeout(4000);

    // Click score 8 (optional free text)
    const scoreBtn = page.locator('button:has-text("8")').first();
    await scoreBtn.click();

    // Submit
    const submitBtn = page.locator('button:has-text("Submit feedback")');
    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Verify localStorage
    const lastAsked = await page.evaluate(() => localStorage.getItem('nps_last_asked'));
    expect(lastAsked).toBeTruthy();

    // Success message
    const thankYou = page.locator('text=Thank you!');
    await expect(thankYou).toBeVisible();
  });
});
