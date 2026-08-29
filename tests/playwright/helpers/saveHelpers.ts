import { expect, Page } from '@playwright/test';

type LogFn = (step: string, status: string, message: string) => void;

export interface SaveAndWaitOptions {
  log?: LogFn;
  getLastDialogMessage?: () => string | null;
  maxAttempts?: number;
}

function retryDelayMs(status: number, body: Record<string, unknown> | null): number {
  if (status === 429) {
    const retryAfter = typeof body?.retryAfter === 'number' ? body.retryAfter : 12;
    return Math.max(retryAfter * 1000 + 500, 3_000);
  }
  return 2_000;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503;
}

/**
 * Clicks the primary save button and waits for a matching API response.
 * Retries on 429 (rate limit), 502, and 503 using retryAfter when present.
 */
export async function saveAndWaitForApi(
  page: Page,
  apiPathPattern: RegExp,
  options: SaveAndWaitOptions = {},
): Promise<Record<string, unknown>> {
  const log: LogFn = options.log ?? (() => {});
  const maxAttempts = options.maxAttempts ?? 5;

  const resolveSaveButton = async () => {
    for (const label of ['Save Property', 'Save']) {
      const btn = page.getByRole('button', { name: label, exact: true });
      if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
        return btn;
      }
    }
    return page.getByRole('button').filter({
      hasText: /^Save$|^Create$|^Submit$|^Publish$/i,
    }).first();
  };

  const saveBtn = await resolveSaveButton();
  await expect(saveBtn).toBeVisible({ timeout: 10_000 });

  const matchesApi = (url: string, method: string) =>
    apiPathPattern.test(url) && ['POST', 'PUT', 'PATCH'].includes(method);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const responsePromise = page.waitForResponse(
      (r) => matchesApi(r.url(), r.request().method()),
      { timeout: 30_000 },
    );
    await saveBtn.click();

    try {
      const response = await responsePromise;
      const body = await response.json().catch(() => null) as Record<string, unknown> | null;

      if (response.ok()) {
        // Form closes after save — wait for navigation/list refresh, not the Save button
        await page.waitForLoadState('networkidle').catch(() => null);
        await page.waitForTimeout(1_000);
        return body ?? {};
      }

      const status = response.status();
      if (isRetryableStatus(status) && attempt < maxAttempts) {
        const waitMs = retryDelayMs(status, body);
        log(
          'Save',
          'WARN',
          `Got ${status} — retry ${attempt}/${maxAttempts - 1} after ${Math.round(waitMs / 1000)}s`,
        );
        await page.waitForTimeout(waitMs);
        continue;
      }

      throw new Error(`Save failed: ${status} — ${JSON.stringify(body)}`);
    } catch (err) {
      const dialogMsg = options.getLastDialogMessage?.();
      if (dialogMsg) throw new Error(`Save failed — backend error: "${dialogMsg}"`);
      throw err;
    }
  }

  throw new Error('Save failed after max retries');
}

/** Brief pause between entity-creation steps to reduce API burst rate. */
export async function paceBetweenEntitySteps(page: Page, ms = 1_500): Promise<void> {
  await page.waitForTimeout(ms);
}
