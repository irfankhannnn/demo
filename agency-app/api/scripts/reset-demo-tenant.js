/**
 * reset-demo-tenant.js — thin wrapper around seed-demo-tenant.js
 * ==============================================================
 *
 * Runs the demo seeder with `--reset`, i.e. it purges all demo-tenant rows and
 * re-seeds a clean dataset. This is the entry point invoked by the daily reset
 * cron (see cron/reset-demo.yaml) so the demo always starts fresh at 2:00 AM IST.
 *
 * SAFETY: Only allowed demo tenant IDs can be reset. Production tenants are
 * explicitly blocked even if a --tenant flag is provided.
 *
 * USAGE
 * -----
 *   node agency-app/api/scripts/reset-demo-tenant.js [--tenant=DEMO_REALESTATEFLOW]
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

const ALLOWED_DEMO_TENANTS = ['DEMO_REALESTATEFLOW', 'DEMO_TEST'];

function isAllowedTenant(tenantId) {
  return ALLOWED_DEMO_TENANTS.includes(tenantId);
}

/**
 * Run the seeder with --reset. Resolves on success, rejects on non-zero exit.
 * @param {string[]} extraArgs additional CLI args to forward (e.g. ['--tenant=X'])
 */
export function resetDemo(extraArgs = []) {
  const tenantArg = extraArgs.find((a) => a.startsWith('--tenant='));
  const tenantId = tenantArg ? tenantArg.slice('--tenant='.length) : process.env.DEMO_TENANT_ID || 'DEMO_REALESTATEFLOW';

  if (!isAllowedTenant(tenantId)) {
    return Promise.reject(new Error(`Refusing to reset non-demo tenant: ${tenantId}`));
  }

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
 * NOTE: In Lambda, we do NOT spawn a child process because the Lambda runtime
 * does not have `node` in PATH and /tmp is read-only.
 */
export async function handler() {
  const tenantId = process.env.DEMO_TENANT_ID || 'DEMO_REALESTATEFLOW';
  if (!isAllowedTenant(tenantId)) {
    throw new Error(`Refusing to reset non-demo tenant in Lambda: ${tenantId}`);
  }

  // Import and call the seeder directly (no spawn)
  const { seedDemoTenant } = await import('./seed-demo-tenant.js');
  await seedDemoTenant({ reset: true, tenant: tenantId });
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
