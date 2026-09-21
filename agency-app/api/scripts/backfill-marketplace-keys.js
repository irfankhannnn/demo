#!/usr/bin/env node
/**
 * Backfill / reconcile marketplace index keys.
 *
 * Properties published before the marketplace existed carry no GSI4 /
 * mktCityKey attributes and are invisible to the consumer portal until this
 * runs. Also repairs drift: a property whose keys a failed bookkeeping write
 * left stale is re-evaluated against the rule in marketplaceIndexing.js.
 *
 * Idempotent. Items whose keys already match are skipped without a write, so
 * a no-op run costs one Query per tenant and nothing else.
 *
 * Usage:
 *   node scripts/backfill-marketplace-keys.js --dry-run
 *   node scripts/backfill-marketplace-keys.js --tenant <tenantId>
 *   node scripts/backfill-marketplace-keys.js            # every tenant with an AgencyConfig
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TENANT = args.includes('--tenant') ? args[args.indexOf('--tenant') + 1] : null;

const { syncTenantMarketplaceKeys } = await import('../marketplaceIndexing.js');
const { scanAgencyConfigs } = await import('../agencyConfigService.js');

async function run() {
  let tenantIds;
  if (TENANT) {
    tenantIds = [TENANT];
  } else {
    const configs = await scanAgencyConfigs();
    tenantIds = (configs || []).map((c) => c.TenantId).filter(Boolean);
  }

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Reconciling marketplace keys for ${tenantIds.length} tenant(s)`);
  const totals = { scanned: 0, listed: 0, removed: 0, unchanged: 0 };

  for (const tenantId of tenantIds) {
    try {
      const stats = await syncTenantMarketplaceKeys(tenantId, { dryRun: DRY_RUN });
      for (const k of Object.keys(totals)) totals[k] += stats[k] || 0;
      console.log(`  ${tenantId}: scanned ${stats.scanned}, listed ${stats.listed}, removed ${stats.removed}, unchanged ${stats.unchanged}`);
    } catch (err) {
      console.error(`  ${tenantId}: FAILED — ${err.message}`);
    }
  }

  console.log(`Done. scanned ${totals.scanned}, listed ${totals.listed}, removed ${totals.removed}, unchanged ${totals.unchanged}`);
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
