import { test } from '@playwright/test';
import { TEST_TIMEOUT_MS } from '../../helpers/config';
import { setupEvidence, createLogger } from '../../helpers/evidence';
import { runAdminUiFlow } from '../../flows/adminUiFlow';

test('Admin UI: login + invite/member flows', async ({ page }) => {
  test.setTimeout(TEST_TIMEOUT_MS * 2);
  const ctx = setupEvidence('admin-ui');
  const log = createLogger(ctx.feature);
  page.on('dialog', async (dialog) => {
    log('Dialog', 'INFO', `${dialog.type()}: ${dialog.message()}`);
    await dialog.accept();
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await runAdminUiFlow(page, ctx);
});
