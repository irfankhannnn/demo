import type { Page } from '@playwright/test';

/**
 * The screens a broker actually uses daily. These are the ones worth gating
 * mobile regressions on; the full route list is far larger.
 */
export const PRIORITY_ROUTES: { path: string; name: string }[] = [
  { path: '/crm', name: 'CRM dashboard' },
  { path: '/crm/leads', name: 'Leads list' },
  { path: '/crm/properties', name: 'Properties list' },
  { path: '/crm/contacts', name: 'Contacts list' },
  { path: '/crm/tenants', name: 'Tenants list' },
  { path: '/crm/owners', name: 'Owners list' },
  { path: '/crm/calendar', name: 'Calendar' },
  { path: '/crm/khata', name: 'Khata book' },
  { path: '/crm/analytics', name: 'Business analytics' },
  { path: '/crm/settings/billing', name: 'Billing settings' },
  { path: '/profile', name: 'Profile' },
];

/** Public routes reachable without a session. */
export const PUBLIC_ROUTES: { path: string; name: string }[] = [
  { path: '/legal/privacy', name: 'Privacy policy' },
  { path: '/legal/terms', name: 'Terms of service' },
];

/**
 * Wait for a route to settle enough to measure layout.
 *
 * networkidle is deliberately avoided: the CRM polls notifications on a 60s
 * interval, so the network never actually goes idle and the wait always times
 * out. Waiting for the DOM plus a short settle is both sufficient and stable.
 */
export async function gotoAndSettle(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(750);
}

/** Marks the run as a native build so the mobile-only UI branches render. */
export async function forceNativeApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__FORCE_NATIVE_APP__ = true;
  });
}
