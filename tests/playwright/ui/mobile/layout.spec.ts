import { test, expect } from '@playwright/test';
import { PRIORITY_ROUTES, gotoAndSettle } from '../../helpers/mobile';

/**
 * Layout regressions that only show up at phone width.
 *
 * The rest of the suite runs at 1280x720, so nothing here was ever covered:
 * the app shipped a 1100px-wide calendar grid and tables with no mobile
 * fallback without a single failing test.
 */
test.describe('mobile layout', () => {
  for (const route of PRIORITY_ROUTES) {
    test(`${route.name} does not scroll horizontally`, async ({ page }) => {
      await gotoAndSettle(page, route.path);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          // Identify the widest offender so a failure is actionable rather
          // than just "something is too wide".
          widest: Array.from(document.querySelectorAll<HTMLElement>('body *'))
            .map((el) => ({
              tag: el.tagName.toLowerCase(),
              cls: (el.className || '').toString().slice(0, 80),
              right: Math.round(el.getBoundingClientRect().right),
            }))
            .filter((e) => e.right > doc.clientWidth + 1)
            .sort((a, b) => b.right - a.right)
            .slice(0, 3),
        };
      });

      expect(
        overflow.scrollWidth,
        `Page is ${overflow.scrollWidth}px wide in a ${overflow.clientWidth}px viewport. ` +
          `Widest offenders: ${JSON.stringify(overflow.widest)}`
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }
});

test.describe('mobile touch targets', () => {
  for (const route of PRIORITY_ROUTES.slice(0, 5)) {
    test(`${route.name} has no undersized tap targets`, async ({ page }) => {
      await gotoAndSettle(page, route.path);

      /*
       * Apple HIG asks for 44pt and Material for 48dp. The codebase had zero
       * enforcement: min-h-[44px] and touch-manipulation had no matches at all
       * before this work, while the prevailing padding convention produced
       * roughly 30px controls on a phone.
       */
      const undersized = await page.evaluate(() => {
        const MIN = 44;
        const selector = 'button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], select';
        return Array.from(document.querySelectorAll<HTMLElement>(selector))
          .filter((el) => {
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            if (el.hasAttribute('disabled')) return false;
            const r = el.getBoundingClientRect();
            // Skip elements that are not rendered at all.
            if (r.width === 0 || r.height === 0) return false;
            return r.height < MIN || r.width < MIN;
          })
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              tag: el.tagName.toLowerCase(),
              text: (el.textContent || '').trim().slice(0, 30),
              cls: (el.className || '').toString().slice(0, 60),
              size: `${Math.round(r.width)}x${Math.round(r.height)}`,
            };
          });
      });

      expect(
        undersized,
        `${undersized.length} control(s) below 44x44px:\n${JSON.stringify(undersized, null, 2)}`
      ).toEqual([]);
    });
  }
});
