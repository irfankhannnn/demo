/**
 * reset-demo-tenant.js — thin wrapper around seed-demo-tenant.js
 * ==============================================================
 *
 * Runs the demo seeder with `--reset`, i.e. it purges all demo-tenant rows and
 * re-seeds a clean dataset. This is the entry point invoked by the daily reset
 * cron (see cron/reset-demo.yaml) so the demo always starts fresh at 2:00 AM IST.
 *
 * Source task: ZEE-001  (PR-A — coding-agent-brief/prompts/PR-A-demo-environment.md)
 *
 * USAGE
 * -----
 *   node server/scripts/reset-demo-tenant.js [--tenant=DEMO_REALESTATEFLOW]
 *
 * The tenant flag (if any) is forwarded to the seeder. `--reset` is always
 * forced on. As a Lambda handler, `handler()` is also exported.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_SCRIPT = path.join(__dirname, 'seed-demo-tenant.js');

/**
 * Run the seeder with --reset. Resolves on success, rejects on non-zero exit.
 * @param {string[]} extraArgs additional CLI args to forward (e.g. ['--tenant=X'])
 */
export function resetDemo(extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [SEED_SCRIPT, '--reset', ...extraArgs], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`seed-demo-tenant.js exited with code ${code}`));
    });
  });
}

/**
 * AWS Lambda handler. Wire an EventBridge schedule to this (see cron/reset-demo.yaml).
 */
export async function handler() {
  await resetDemo();
  return { statusCode: 200, body: 'demo tenant reset complete' };
}

// Allow direct CLI invocation: `node reset-demo-tenant.js [--tenant=...]`
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  const forwarded = process.argv.slice(2).filter((a) => a.startsWith('--tenant='));
  resetDemo(forwarded).catch((err) => {
    console.error('[reset-demo] FAILED:', err);
    process.exit(1);
  });
}
