import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * PR-E / ZEE-003-T7 — Analytics consent gating + CRM PostHog-only enforcement.
 */

const LP_PARTIAL = path.resolve(
  __dirname,
  '../marketing-and-sales/creative/landing-pages/_partials/cookie-banner.html'
);
const LP_ANALYTICS = path.resolve(
  __dirname,
  '../marketing-and-sales/creative/landing-pages/_partials/head-analytics.hbs'
);
const LP_ORIGIN = 'https://analytics-lp.test/';

async function serveLpWithAnalytics(page: Page) {
  const banner = fs.readFileSync(LP_PARTIAL, 'utf-8');
  const analytics = fs.readFileSync(LP_ANALYTICS, 'utf-8')
    .replace(/\{\{POSTHOG_KEY\}\}/g, 'phc_test_key')
    .replace(/\{\{GA4_ID\}\}/g, 'G-TEST123')
    .replace(/\{\{META_PIXEL_ID\}\}/g, '123456789')
    .replace(/\{\{LINKEDIN_PARTNER_ID\}\}/g, '987654')
    .replace(/\{\{HOTJAR_ID\}\}/g, '999999')
    .replace(/\{\{HOTJAR_SV\}\}/g, '6');

  await page.route(`${LP_ORIGIN}**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><meta charset="utf-8">${analytics}</head><body><main><a href="#" data-cta-id="hero-primary">Start trial</a></main>${banner}</body></html>`,
    })
  );
  await page.goto(LP_ORIGIN);
}

test.describe('LP analytics (consent-gated)', () => {
  test('Accept all loads marketing + analytics third-party scripts', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => requests.push(req.url()));

    await serveLpWithAnalytics(page);
    await page.click('#cc-accept');
    await page.waitForTimeout(500);

    const joined = requests.join(' ');
    expect(joined).toMatch(/posthog|eu\.i\.posthog/);
    expect(joined).toMatch(/googletagmanager|gtag/);
    expect(joined).toMatch(/facebook\.net/);
    expect(joined).toMatch(/licdn\.com/);
    expect(joined).toMatch(/hotjar/);
  });

  test('Reject non-essential blocks GA4, Pixel, LinkedIn, Hotjar', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => requests.push(req.url()));

    await serveLpWithAnalytics(page);
    await page.click('#cc-reject');
    await page.waitForTimeout(500);

    const joined = requests.join(' ');
    expect(joined).not.toMatch(/googletagmanager/);
    expect(joined).not.toMatch(/facebook\.net/);
    expect(joined).not.toMatch(/licdn\.com/);
    expect(joined).not.toMatch(/hotjar/);
  });
});

test.describe('CRM analytics (PostHog only)', () => {
  test('CRM page has no GA4/Pixel/LinkedIn/Hotjar network calls', async ({ page }) => {
    const blockedTrackers = ['googletagmanager', 'facebook.net', 'licdn.com', 'hotjar'];
    const requests: string[] = [];
    page.on('request', (req) => requests.push(req.url()));

    try {
      await page.goto('/', { timeout: 5000 });
    } catch {
      test.skip(true, 'CRM dev server not running');
      return;
    }

    await page.waitForTimeout(1000);
    const joined = requests.join(' ');
    for (const tracker of blockedTrackers) {
      expect(joined).not.toMatch(new RegExp(tracker));
    }
  });

  test('Reject CRM cookies disables PostHog session recording flag', async ({ page }) => {
    try {
      await page.goto('/', { timeout: 5000 });
    } catch {
      test.skip(true, 'CRM dev server not running');
      return;
    }

    await page.evaluate(() => {
      localStorage.setItem(
        'cookieConsent',
        JSON.stringify({
          essential: true,
          analytics: false,
          marketing: false,
          functional: false,
          version: 1,
          timestamp: Date.now(),
        })
      );
    });

    await page.reload();
    await page.waitForTimeout(500);

    const posthogConfig = await page.evaluate(() => {
      const ph = (window as any).posthog;
      if (!ph || !ph.config) return null;
      return { disable_session_recording: ph.config.disable_session_recording };
    });

    if (posthogConfig) {
      expect(posthogConfig.disable_session_recording).toBe(true);
    }
  });
});
