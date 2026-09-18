// Forwards Instagram enquiries into the CRM's lead pipeline.
//
// Why this exists: an enquiry found in an Instagram DM is a lead like any
// other, and every lead — whatever channel it arrived through — has to land in
// the one CRM leads table and get the same treatment there (AI qualification
// call, scoring, closure). This module is the one place that crosses from this
// service into the CRM.
//
// It deliberately goes over the CRM's internal HTTP API rather than writing to
// the CRM's DynamoDB table directly. This Lambda's IAM role is scoped to its own
// two tables, and that narrowness is a security property worth keeping: an
// Instagram-side compromise cannot reach CRM data. Going through the API also
// means there is exactly one implementation of "what happens when a lead is
// created" (notification, lead.created event, idempotency).
//
// Retry safety: every lead carries a dedupeKey of enquiryId + phone, which the
// CRM uses to drop repeats. The phone is part of it on purpose: a thread whose
// number changes is a new hand-off (the CRM's own phone match then decides
// whether that is a new lead or an update), while re-analysing the same thread
// with the same number never creates a second lead.

import { getConfig } from '../config/env.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'services/crmBridge' });

// The CRM caps a batch at 100.
const CRM_MAX_BATCH = 100;

export function dedupeKeyFor(enquiry) {
  const digits = String(enquiry.phone || '').replace(/\D/g, '');
  return `${enquiry.enquiryId}:${digits}`;
}

/** Instagram enquiry -> what the CRM adapter route expects. */
export function toAdapterPayload(enquiry) {
  return {
    name: enquiry.name,
    phone: enquiry.phone,
    intent: enquiry.intent,
    // A parsed rupee figure travels as `budget`. The bracket enum is purchase
    // scale, so sending it for a 45k rent made the CRM record a 24 lakh budget.
    ...(enquiry.budgetRupees ? { budget: enquiry.budgetRupees } : { budgetBracket: enquiry.budgetBracket }),
    preferredArea: enquiry.preferredArea,
    source: 'Instagram',
    sourceAdapter: 'instagram',
    // Channel-native ids travel in one blob so the CRM needs no new column per
    // identifier. sourceMediaId is also mirrored into reelRef because the CRM
    // already renders that for Instagram-sourced leads.
    externalRef: {
      igUsername: enquiry.igUsername || null,
      igSenderId: enquiry.igSenderId || null,
      igAccountId: enquiry.igUserId || null,
      sourceMediaId: enquiry.sourceMediaId || null,
      leadScore: enquiry.leadScore || null,
      summary: enquiry.summary || null,
    },
    reelRef: enquiry.sourceMediaId ? { postId: enquiry.sourceMediaId, permalink: null } : null,
    dedupeKey: dedupeKeyFor(enquiry),
    createdBy: 'Instagram',
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
 * @returns {Promise<{forwarded: boolean, created: number, updated: number,
 *   skipped: number, duplicates: number, failed: number, reason?: string,
 *   results: Array<{enquiryId: string, leadId?: string, created?: boolean,
 *   updated?: boolean, duplicate?: boolean, skipped?: boolean, reason?: string}>}>}
 *   `forwarded: false` means the caller should surface a retryable failure.
 */
export async function forwardEnquiriesToCrm(tenantId, enquiries) {
  const cfg = getConfig();
  const totals = { created: 0, updated: 0, skipped: 0, duplicates: 0, failed: 0 };
  const results = [];

  if (!cfg.crmInternalApiUrl || !cfg.adapterInternalApiKey) {
    // Not configured is a deployment state, not an error: the Instagram feature
    // still works standalone, leads just are not promoted yet.
    log.warn('crmBridge.not_configured', { tenantId });
    return { forwarded: false, ...totals, results, reason: 'not_configured' };
  }

  // A lead an agent cannot call is not a lead; the CRM would skip it anyway.
  const candidates = (enquiries || []).filter((e) => e && e.name && e.phone);
  if (candidates.length === 0) {
    return { forwarded: true, ...totals, results };
  }

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
          'x-adapter': 'instagram',
        },
        body: JSON.stringify({ leads: batch.map(toAdapterPayload) }),
        signal: controller.signal,
      });

      if (!response.ok) {
        log.error('crmBridge.rejected', { tenantId, status: response.status });
        return { forwarded: false, ...totals, results, reason: `crm_status_${response.status}` };
      }

      const body = await response.json();
      (body.results || []).forEach((r, index) => {
        if (r.created) totals.created += 1;
        else if (r.updated) totals.updated += 1;
        else if (r.duplicate) totals.duplicates += 1;
        else if (r.skipped) totals.skipped += 1;
        else totals.failed += 1;
        results.push({ ...r, enquiryId: batch[index]?.enquiryId ?? null });
      });
    } catch (err) {
      const reason = err.name === 'AbortError' ? 'timeout' : 'network_error';
      log.error('crmBridge.failed', { tenantId, reason, error: err.message });
      return { forwarded: false, ...totals, results, reason };
    } finally {
      clearTimeout(timer);
    }
  }

  log.info('crmBridge.forwarded', { tenantId, ...totals });
  return { forwarded: true, ...totals, results };
}

export default { forwardEnquiriesToCrm, toAdapterPayload, dedupeKeyFor };
