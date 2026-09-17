import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LP_PARTIAL = path.resolve(__dirname, '..', '..', '..', '..', 'agency-app', 'landing-pages', '_partials', 'cookie-banner.html');
const LP_ORIGIN = 'https://lp.test/';

async function serveLpBanner(page: Page) {
  const partial = fs.readFileSync(LP_PARTIAL, 'utf-8');
  await page.route(`${LP_ORIGIN}**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><meta charset="utf-8"></head><body><main>LP</main>${partial}</body></html>`,
    })
  );
  await page.goto(LP_ORIGIN);
}

test.describe('LP cookie banner (vanilla JS)', () => {
  test('first visit shows banner; Accept all hides it on reload', async ({ page }) => {
    await serveLpBanner(page);
    await expect(page.locator('#cc-banner')).toBeVisible();
    await page.click('#cc-accept');
    await expect(page.locator('#cc-banner')).toBeHidden();
    await page.reload();
    await expect(page.locator('#cc-banner')).toBeHidden();
  });

  test('Accept all fires cookie-consent-done and sets analytics=true', async ({ page }) => {
    await serveLpBanner(page);
    const eventDetail = page.evaluate(
      () => new Promise<any>((resolve) => {
        window.addEventListener('cookie-consent-done', (e: any) => resolve(e.detail), { once: true });
      })
    );
    await page.click('#cc-accept');
    const detail = await eventDetail;
    expect(detail.analytics).toBe(true);
    expect(detail.marketing).toBe(true);
    expect(detail.functional).toBe(true);
    expect(detail.essential).toBe(true);
    expect(detail.version).toBe(1);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cookieConsent') || 'null'));
    expect(stored.analytics).toBe(true);
  });

  test('Reject non-essential sets analytics=false and marketing=false', async ({ page }) => {
    await serveLpBanner(page);
    await page.click('#cc-reject');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cookieConsent') || 'null'));
    expect(stored.essential).toBe(true);
    expect(stored.analytics).toBe(false);
    expect(stored.marketing).toBe(false);
    expect(stored.functional).toBe(false);
  });

  test('Customize: 4 toggles; analytics off + marketing on persists correctly', async ({ page }) => {
    await serveLpBanner(page);
    await page.click('#cc-customize');
    await expect(page.locator('#cc-modal')).toBeVisible();
    await expect(page.locator('#cc-modal input[type="checkbox"]')).toHaveCount(3);
    await expect(page.locator('#cc-functional')).toBeVisible();
    await expect(page.locator('#cc-analytics')).toBeVisible();
    await expect(page.locator('#cc-marketing')).toBeVisible();
    await page.locator('#cc-analytics').uncheck();
    await page.locator('#cc-marketing').check();
    await page.click('#cc-modal-save');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cookieConsent') || 'null'));
    expect(stored.analytics).toBe(false);
    expect(stored.marketing).toBe(true);
    expect(stored.version).toBe(1);
  });
});

test.describe('CRM cookie banner (React)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    let reachable = false;
    try {
      const res = await page.request.get(baseURL || 'http://localhost:3000', { timeout: 4000 });
      reachable = res.ok() || res.status() < 500;
    } catch { reachable = false; }
    test.skip(!reachable, 'CRM dev server not reachable on baseURL');
  });

  test('first visit shows banner; Accept all hides on reload', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByRole('dialog', { name: 'Cookie consent' });
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: 'Accept all' }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Cookie consent' })).toBeHidden();
  });

  test('Reject sets analytics=false', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByRole('dialog', { name: 'Cookie consent' });
    await banner.getByRole('button', { name: 'Reject non-essential' }).click();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('cookieConsent') || 'null'));
    expect(stored.analytics).toBe(false);
  });

  test('Customize modal has NO Marketing toggle (CRM is PostHog-only)', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByRole('dialog', { name: 'Cookie consent' });
    await banner.getByRole('button', { name: 'Customize' }).click();
    await expect(page.getByText('Marketing', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: 'Analytics' })).toBeVisible();
  });
});
