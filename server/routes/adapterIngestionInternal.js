/**
 * Internal lead-adapter intake.
 *
 * Service-to-service entry point for lead sources that run outside this Lambda —
 * today the Instagram Solution microservice (backend_insta_sol_ms) forwarding
 * enquiries captured by the agency's laptop agent and the Instagram Excel
 * pipeline's push script; later the website form and any other adapter.
 *
 * Auth follows the pattern already established for ai-calling-service → CRM
 * (routes/aiCallingInternal.js): a shared internal API key plus an explicit
 * tenant header, never a user JWT, because the caller is another service rather
 * than a logged-in person. It uses its own key, not the AI-calling one, so a
 * compromise of one service does not hand over the other's access.
 *
 * Everything this route does after authenticating is delegated to
 * `ingestLead()`, so an adapter arriving here gets byte-for-byte the same
 * treatment as the ManyChat webhook: same table, same idempotency, same
 * notification, same lead.created event feeding AI qualification.
 *
 * The one addition on top of ingestion is the optional `followUp` hint
 * (CONTRACTS.md 1.1): an adapter that knows the person asked for a call or
 * agreed a meeting says so, and this route hands the follow-up service a
 * site-visit confirmation job for the resolved lead — created or matched by
 * phone — so the source needs nothing but the adapter key.
 *
 * Dependency injection: `createAdapterIngestionRouter(deps)` builds a router
 * with explicit collaborators so it can be unit-tested with fakes under any
 * runner; the default export is the production router. The data layer is
 * loaded lazily on first use so importing this module stays cheap.
 */

import express from 'express';
import crypto from 'crypto';
import { logger } from '../logger.js';
import { normalizeFollowUpHint, buildFollowupJobPayload } from '../services/followupService.js';

// A batch bigger than this is a caller bug, not a legitimate upload; the
// Instagram agent already chunks its own uploads well below it.
const MAX_BATCH = 100;

/**
 * Constant-time API key comparison. A plain `!==` leaks key material through
 * response timing, one byte at a time, to anyone who can call this endpoint.
 */
export function safeKeyEquals(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so compare a digest instead —
  // equal-length inputs regardless of the raw key lengths.
  const ah = crypto.createHash('sha256').update(a).digest();
  const bh = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ah, bh);
}

async function loadIngestion() {
  return import('../leadIngestion.js');
}

async function loadCrm() {
  return import('../crmDynamodbService.js');
}

async function loadFollowup() {
  return import('../services/followupService.js');
}

export function createAdapterIngestionRouter(deps = {}) {
  const ingestion = deps.ingestion || loadIngestion;
  const crm = deps.crm || loadCrm;
  const followup = deps.followup || loadFollowup;
  const log = deps.log || logger;
  const env = deps.env || process.env;

  const router = express.Router();

  const validateAdapterApiKey = (req, res, next) => {
    const expectedKey = env.ADAPTER_INTERNAL_API_KEY;

    if (!expectedKey) {
      log.error('adapterIngestion.not_configured', {});
      return res.status(500).json({ error: 'Adapter intake not configured' });
    }
    if (!safeKeyEquals(req.headers['x-api-key'], expectedKey)) {
      log.warn('adapterIngestion.unauthorized', { adapter: req.headers['x-adapter'] || null });
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  const extractTenantId = (req, res, next) => {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'x-tenant-id header is required' });
    }
    req.tenantId = tenantId;
    next();
  };

  router.use(validateAdapterApiKey);
  router.use(extractTenantId);

  /**
   * POST /api/internal/adapters/leads
   *
   * Body: { leads: [ { name, phone, intent|leadType, budgetBracket|budget,
   *                    preferredArea, source, sourceAdapter, externalRef,
   *                    reelRef, dedupeKey, createdBy,
   *                    followUp?: { type?, meetingSchedule?, propertyHint?, note? } } ] }
   *
   * Responds 200 with a per-item outcome array. Individual items that are skipped
   * (unclassifiable intent, no phone) are not errors — they are a normal outcome
   * the caller records so it can retry once a human fills the gap. When an item
   * carried a `followUp` hint, `followupJob` reports whether the follow-up
   * service accepted it; a failure there never fails the item, because the
   * lead is already stored and the call can be scheduled by hand.
   */
  router.post('/leads', async (req, res) => {
    try {
      const leads = req.body?.leads;
      if (!Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ error: 'leads must be a non-empty array' });
      }
      if (leads.length > MAX_BATCH) {
        return res.status(400).json({ error: `leads exceeds max batch size of ${MAX_BATCH}` });
      }

      const { ingestLead, intentToLeadType, parseBudgetBracket } = await ingestion();

      // One phone lookup for the whole batch rather than one per item. ingestLead
      // keeps this map current as it creates leads, so two enquiries from the same
      // person in a single upload collapse onto one lead.
      let phoneIndex;
      try {
        const { buildLeadPhoneIndex } = await crm();
        phoneIndex = await buildLeadPhoneIndex(req.tenantId);
      } catch (indexErr) {
        // Fall back to per-item lookups rather than failing the batch.
        log.warn('adapterIngestion.phone_index_failed', {
          tenantId: req.tenantId, error: indexErr.message,
        });
        phoneIndex = undefined;
      }

      const adapterLabel = req.headers['x-adapter'] || null;
      const results = [];
      for (const raw of leads) {
        const dedupeKey = raw.dedupeKey ? `adapter:${req.tenantId}:${raw.dedupeKey}` : undefined;

        // An adapter may send either an already-resolved leadType or its own
        // intent vocabulary; resolving here keeps that mapping in one place.
        const leadType = raw.leadType || intentToLeadType(raw.intent);
        const followUp = normalizeFollowUpHint(raw.followUp);

        try {
          const result = await ingestLead(
            req.tenantId,
            {
              name: raw.name,
              phone: raw.phone,
              leadType,
              requirement: {
                requirement: raw.intent || raw.requirement || undefined,
                budget: parseBudgetBracket(raw.budgetBracket ?? raw.budget) ?? undefined,
                preferredArea: raw.preferredArea || undefined,
              },
              source: raw.source || '',
              sourceAdapter: raw.sourceAdapter || null,
              externalRef: raw.externalRef || null,
              reelRef: raw.reelRef || null,
              createdBy: raw.createdBy || 'Adapter',
              followUp,
            },
            { dedupeKey, phoneIndex }
          );

          const leadId = result.lead?.leadId || null;
          const item = {
            dedupeKey: raw.dedupeKey || null,
            leadId,
            created: Boolean(result.created),
            updated: Boolean(result.updated),
            duplicate: Boolean(result.duplicate),
            skipped: Boolean(result.skipped),
            reason: result.reason || null,
          };

          // Forward the hint for any resolved lead — new or matched by phone.
          // A returning enquirer who now asks for a call deserves one just as
          // much as a first-timer, and the service dedupes open jobs per lead.
          if (leadId && followUp) {
            const { forwardFollowupJob } = await followup();
            item.followupJob = await forwardFollowupJob(
              req.tenantId,
              buildFollowupJobPayload(leadId, followUp, {
                requestedBy: raw.sourceAdapter || adapterLabel || 'crm-adapter',
                source: 'crm-adapter',
              })
            );
          }

          results.push(item);
        } catch (itemErr) {
          // One bad item must not lose the rest of the batch. The caller retries
          // just this one; ingestLead's dedupeKey makes that safe.
          log.error('adapterIngestion.item_failed', {
            tenantId: req.tenantId, dedupeKey: raw.dedupeKey || null, error: itemErr.message,
          });
          results.push({
            dedupeKey: raw.dedupeKey || null,
            leadId: null, created: false, duplicate: false, skipped: false,
            reason: 'error',
          });
        }
      }

      const created = results.filter((r) => r.created).length;
      log.info('adapterIngestion.batch_complete', {
        tenantId: req.tenantId,
        adapter: adapterLabel,
        received: leads.length,
        created,
        updated: results.filter((r) => r.updated).length,
        skipped: results.filter((r) => r.skipped).length,
        duplicates: results.filter((r) => r.duplicate).length,
        failed: results.filter((r) => r.reason === 'error').length,
        followupsForwarded: results.filter((r) => r.followupJob?.ok).length,
      });

      return res.json({ ok: true, results });
    } catch (error) {
      log.error('adapterIngestion.error', { tenantId: req.tenantId, error: error.message });
      return res.status(500).json({ error: 'Failed to ingest leads' });
    }
  });

  return router;
}

export default createAdapterIngestionRouter();
