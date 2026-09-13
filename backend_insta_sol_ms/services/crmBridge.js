// Forwards captured Instagram enquiries into the CRM's lead pipeline.
//
// Why this exists: an enquiry the laptop agent extracts is a lead like any
// other, and the product goal is that every lead — whatever channel it arrived
// through — lands in the one CRM leads table and gets the same treatment there
// (AI qualification call, scoring, closure). This module is the one place that
// crosses from this service into the CRM.
//
// It deliberately goes over the CRM's internal HTTP API rather than writing to
// the CRM's DynamoDB table directly. This Lambda's IAM role is scoped to its own
// two tables, and that narrowness is a security property worth keeping: an
// Instagram-side compromise cannot reach CRM data. Going through the API also
// means there is exactly one implementation of "what happens when a lead is
// created" (notification, lead.created event, idempotency), instead of a second
// one here that could drift.
//
// Failure policy: a forwarding failure is reported to the caller so the agent's
// upload queue retries. Retries are safe because every enquiry carries its
// enquiryId as a dedupeKey, which the CRM uses to drop repeats.

import { getConfig } from '../config/env.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'services/crmBridge' });

// The CRM caps a batch at 100; chunk to stay under it regardless of how many
// enquiries a single agent upload carried.
const CRM_MAX_BATCH = 100;

/** Instagram Solution intent vocabulary → what the CRM adapter route expects. */
function toAdapterPayload(enquiry) {
  return {
    name: enquiry.name,
    phone: enquiry.phone,
    intent: enquiry.intent,
    budgetBracket: enquiry.budgetBracket,
    preferredArea: enquiry.preferredArea,
    source: 'Instagram',
    sourceAdapter: 'insta-agent',
    // Channel-native ids travel in one blob so the CRM needs no new column per
    // identifier. sourceMediaId is also mirrored into reelRef below because the
    // CRM already renders that for Instagram-sourced leads.
    externalRef: {
      igUsername: enquiry.igUsername || null,
      igSenderId: enquiry.igSenderId || null,
      sourceMediaId: enquiry.sourceMediaId || null,
    },
    reelRef: enquiry.sourceMediaId ? { postId: enquiry.sourceMediaId, permalink: null } : null,
    dedupeKey: enquiry.enquiryId,
    createdBy: 'Instagram Agent',
  };
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Forward enquiries to the CRM as leads.
 *
 * @returns {Promise<{forwarded: boolean, created: number, skipped: number,
 *   duplicates: number, failed: number, reason?: string}>}
 *   `forwarded: false` means the caller should surface a retryable failure.
 */
export async function forwardEnquiriesToCrm(tenantId, enquiries) {
  const cfg = getConfig();

  if (!cfg.crmInternalApiUrl || !cfg.adapterInternalApiKey) {
    // Not configured is a deployment state, not an error: the Instagram feature
    // still works standalone, leads just are not promoted yet.
    log.warn('crmBridge.not_configured', { tenantId });
    return { forwarded: false, created: 0, skipped: 0, duplicates: 0, failed: 0, reason: 'not_configured' };
  }

  const candidates = (enquiries || []).filter((e) => e && e.name && e.phone);
  if (candidates.length === 0) {
    return { forwarded: true, created: 0, skipped: 0, duplicates: 0, failed: 0 };
  }

  // `updated` means the CRM already had a lead for that phone number and
  // enriched it instead of creating a second one — a success, not a no-op.
  const totals = { created: 0, updated: 0, skipped: 0, duplicates: 0, failed: 0 };

  for (const batch of chunk(candidates, CRM_MAX_BATCH)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.crmTimeoutMs);

    try {
      const response = await fetch(`${cfg.crmInternalApiUrl}/api/internal/adapters/leads`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.adapterInternalApiKey,
          'x-tenant-id': tenantId,
          'x-adapter': 'insta-agent',
        },
        body: JSON.stringify({ leads: batch.map(toAdapterPayload) }),
        signal: controller.signal,
      });

      if (!response.ok) {
        log.error('crmBridge.rejected', { tenantId, status: response.status });
        return { forwarded: false, ...totals, reason: `crm_status_${response.status}` };
      }

      const body = await response.json();
      for (const r of body.results || []) {
        if (r.created) totals.created += 1;
        else if (r.updated) totals.updated += 1;
        else if (r.duplicate) totals.duplicates += 1;
        else if (r.skipped) totals.skipped += 1;
        else totals.failed += 1;
      }
    } catch (err) {
      const reason = err.name === 'AbortError' ? 'timeout' : 'network_error';
      log.error('crmBridge.failed', { tenantId, reason, message: err.message });
      return { forwarded: false, ...totals, reason };
    } finally {
      clearTimeout(timer);
    }
  }

  log.info('crmBridge.forwarded', { tenantId, ...totals });
  return { forwarded: true, ...totals };
}

export default { forwardEnquiriesToCrm };
