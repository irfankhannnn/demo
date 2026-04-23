// Evidence (screenshots + logs) helpers.
// Each functionality has its own evidence folder at: test/evidences/<feature>/
import * as fs from 'fs';
import * as path from 'path';
import { Page } from '@playwright/test';

export type LogStatus = 'PASS' | 'FAIL' | 'INFO';

export interface EvidenceCtx {
  feature: string;
  evidenceDir: string;
}

export function setupEvidence(feature: string): EvidenceCtx {
  const evidenceDir = path.join(__dirname, '..', '..', 'evidences', feature);
  if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });
  return { feature, evidenceDir };
}

export function createLogger(feature: string) {
  return function log(step: string, status: LogStatus, details?: string) {
    const icon = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[INFO]';
    // eslint-disable-next-line no-console
    console.log(`${icon} [${new Date().toISOString()}] [${feature}] ${step}${details ? ' - ' + details : ''}`);
  };
}

export async function snap(page: Page, ctx: EvidenceCtx, name: string): Promise<void> {
  const filePath = path.join(ctx.evidenceDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  // eslint-disable-next-line no-console
  console.log(`[snap] ${ctx.feature}/${name}.png`);
}
