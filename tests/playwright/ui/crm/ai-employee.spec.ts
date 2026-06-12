import { test, expect } from '@playwright/test';
import { BASE_URL } from '../../helpers/config';
import { setupEvidence, snap } from '../../helpers/evidence';

test.describe('AI Employee status page', () => {
  test('AI Employee page loads for authenticated user', async ({ page }) => {
    const ctx = setupEvidence('ai-employee');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/integrations/ai-employee`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1, h2').filter({ hasText: /AI Employee|AI Agent/i }).first()).toBeVisible({ timeout: 10_000 });
    await snap(page, ctx, '01-ai-employee-page');
  });
});
