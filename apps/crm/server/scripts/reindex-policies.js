#!/usr/bin/env node
/**
 * Re-index agency policy documents into the knowledge vector index.
 *
 * Two jobs, same code path:
 *  - Backfill: policies written before the knowledge index existed have no
 *    chunks, so answer_policy_question finds nothing and the agent falls back
 *    to offering a human on every question.
 *  - Reconcile: a policy edited while indexing was failing leaves stale chunks.
 *    Stale is worse than missing — the agent quotes a rule the agency has
 *    already changed, on a recorded call. documentHash makes that detectable.
 *
 * Safe to re-run. Documents whose hash still matches are skipped without a
 * Bedrock call, so a no-op run costs one Scan of the agency table and nothing
 * else.
 *
 * Usage:
 *   node scripts/reindex-policies.js --dry-run
 *   node scripts/reindex-policies.js --tenant <tenantId>
 *   node scripts/reindex-policies.js
 *
 * Flags:
 *   --dry-run   report what would change, write nothing
 *   --tenant    restrict to one tenant (recommended for a first run)
 *   --env FILE  load a specific env file (default: apps/crm/server/.env)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

dotenv.config({ path: path.resolve(__dirname, '..', value('env') || '.env') });

// Imported after dotenv so module-scope config reads a populated process.env.
const { scanAgencyConfigs, getAgencyConfig } = await import('../agencyConfigService.js');
const { reindexTenantPolicies } = await import('../services/knowledge/policyIngestionService.js');
const { chunkPolicyContent } = await import('../services/knowledge/policyChunker.js');

const DRY_RUN = flag('dry-run');
const ONLY_TENANT = value('tenant');

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`ERROR: ${name} is not set. Pass --env .env.prod, or export it.`);
    process.exit(1);
  }
}

requireEnv('AGENCY_CONFIG_DYNAMODB_TABLE_NAME');
requireEnv('KNOWLEDGE_CHUNKS_DYNAMODB_TABLE_NAME');

async function loadTenants() {
  if (ONLY_TENANT) {
    const config = await getAgencyConfig(ONLY_TENANT);
    if (!config) {
      console.error(`ERROR: no agency record for tenant '${ONLY_TENANT}'.`);
      process.exit(1);
    }
    return [config];
  }
  return (await scanAgencyConfigs()) || [];
}

async function main() {
  console.log(`Agency table:   ${process.env.AGENCY_CONFIG_DYNAMODB_TABLE_NAME}`);
  console.log(`Knowledge table:${process.env.KNOWLEDGE_CHUNKS_DYNAMODB_TABLE_NAME}`);
  console.log(`Mode:           ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  if (ONLY_TENANT) console.log(`Tenant:         ${ONLY_TENANT}`);
  console.log('');

  const tenants = await loadTenants();
  const withPolicies = tenants.filter((t) => Array.isArray(t?.policies) && t.policies.length);

  console.log(`${tenants.length} agencies, ${withPolicies.length} with policy documents.`);
  if (!withPolicies.length) {
    console.log('\nNothing to index. Agencies add policies in CRM settings -> Agency Policies.');
    return;
  }

  let indexed = 0;
  let unchanged = 0;
  let chunks = 0;
  const failures = [];

  for (const agency of withPolicies) {
    const tenantId = agency.TenantId;
    const policies = agency.policies;

    if (DRY_RUN) {
      const estimate = policies.reduce((n, p) => n + chunkPolicyContent(p.content).length, 0);
      console.log(`  ${tenantId}: ${policies.length} documents -> ~${estimate} chunks`);
      chunks += estimate;
      continue;
    }

    try {
      const result = await reindexTenantPolicies(
        tenantId,
        policies,
        policies.map((p) => p.policyId)
      );
      indexed += result.indexed;
      unchanged += result.unchanged;
      chunks += result.totalChunks;
      console.log(
        `  ${tenantId}: ${result.indexed} indexed, ${result.unchanged} unchanged, ${result.totalChunks} chunks`
      );
    } catch (error) {
      // One tenant's failure must not abandon the rest; a partial index is
      // still better than none, and the summary names who needs a retry.
      failures.push({ tenantId, error: error.message });
      console.error(`  ${tenantId}: FAILED — ${error.message}`);
    }
  }

  console.log('');
  if (DRY_RUN) {
    console.log(`Would index ~${chunks} chunks across ${withPolicies.length} agencies.`);
  } else {
    console.log(`Indexed ${indexed} documents (${unchanged} already current), ${chunks} chunks total.`);
  }

  if (failures.length) {
    console.log(`\n${failures.length} agencies failed:`);
    failures.forEach((f) => console.log(`  ${f.tenantId}: ${f.error}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
