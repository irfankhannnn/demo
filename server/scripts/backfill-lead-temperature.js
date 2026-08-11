/**
 * Backfill Lead Temperature — one-time migration script.
 *
 * Part of the Lead Temperature migration: `priority` (low/medium/high) is
 * retired on the Lead entity in favor of `score` (HOT/WARM/COLD). Existing
 * leads created before this migration still have their old `priority`
 * attribute sitting in DynamoDB (createLead()/updateLead() simply stopped
 * writing it — nothing deletes it from old records), so this script maps
 * that old value to an initial `score` for every lead that doesn't have one
 * yet, without touching leads that are already qualified.
 *
 * Mapping is deliberately conservative — `priority` was a manual field never
 * calibrated against "has the customer already named an area/building",
 * which is what actually distinguishes HOT from WARM in the new rubric
 * (see server/utils/leadRubric.js). Nothing gets auto-labeled HOT here.
 *   high   -> WARM
 *   medium -> WARM
 *   low    -> COLD
 *   (missing/unknown priority) -> left unscored (null), for a human or the
 *   qualifier to score properly rather than guessing from nothing.
 *
 * scoreSource is set to 'migrated' so these are visibly distinguishable from
 * a real qualification (ai_call / llm_text / manual) later.
 *
 * Usage:
 *   node scripts/backfill-lead-temperature.js            # dry run (default)
 *   node scripts/backfill-lead-temperature.js --apply     # actually writes
 *   node scripts/backfill-lead-temperature.js --apply --tenant=<tenantId>  # single tenant
 */
import { getLeads, updateLead, unwrapLeadsList } from '../crmDynamodbService.js';
import { scanAgencyConfigs } from '../agencyConfigService.js';
import { logger } from '../logger.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const PRIORITY_TO_TEMPERATURE = {
  high: 'WARM',
  medium: 'WARM',
  low: 'COLD',
};

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const tenantArg = argv.find((a) => a.startsWith('--tenant='));
  const tenantId = tenantArg ? tenantArg.split('=')[1] : null;
  return { apply, tenantId };
}

async function backfillTenant(tenantId, { apply }) {
  const leads = unwrapLeadsList(await getLeads(tenantId, {}));
  let migrated = 0;
  let leftUnscored = 0;
  let skippedAlreadyScored = 0;

  for (const lead of leads) {
    if (lead.score) {
      skippedAlreadyScored++;
      continue;
    }

    const oldPriority = String(lead.priority || '').toLowerCase();
    const mapped = PRIORITY_TO_TEMPERATURE[oldPriority] || null;

    if (!mapped) {
      leftUnscored++;
      continue;
    }

    migrated++;
    logger.info('backfillLeadTemperature.mapping', {
      tenantId, leadId: lead.leadId, oldPriority, newScore: mapped, apply,
    });

    if (apply) {
      await updateLead(tenantId, lead.leadId, {
        score: mapped,
        scoreValue: null,
        scoreReasons: `Migrated from priority="${oldPriority}" — not a real qualification, re-qualify when possible.`,
        scoredAt: new Date().toISOString(),
        scoreSource: 'migrated',
      });
    }
  }

  return { tenantId, total: leads.length, migrated, leftUnscored, skippedAlreadyScored };
}

async function main() {
  const { apply, tenantId } = parseArgs(process.argv.slice(2));
  logger.info('backfillLeadTemperature.start', { apply, tenantId: tenantId || 'ALL' });

  const tenantIds = tenantId ? [tenantId] : await scanAgencyConfigs({});

  const summary = [];
  for (const id of tenantIds) {
    try {
      summary.push(await backfillTenant(id, { apply }));
    } catch (err) {
      logger.error('backfillLeadTemperature.tenant_failed', { tenantId: id, error: err.message });
      summary.push({ tenantId: id, error: err.message });
    }
  }

  const totals = summary.reduce(
    (acc, s) => ({
      migrated: acc.migrated + (s.migrated || 0),
      leftUnscored: acc.leftUnscored + (s.leftUnscored || 0),
      skippedAlreadyScored: acc.skippedAlreadyScored + (s.skippedAlreadyScored || 0),
    }),
    { migrated: 0, leftUnscored: 0, skippedAlreadyScored: 0 }
  );

  logger.info('backfillLeadTemperature.done', { apply, tenantsProcessed: tenantIds.length, ...totals });
  console.log(JSON.stringify({ apply, tenantsProcessed: tenantIds.length, totals, perTenant: summary }, null, 2));

  if (!apply) {
    console.log('\nDry run only — no writes made. Re-run with --apply to persist.');
  }
}

main().catch((err) => {
  logger.error('backfillLeadTemperature.fatal', { error: err.message, stack: err.stack });
  console.error(err);
  process.exit(1);
});
