/**
 * The single entry point every lead source funnels through.
 *
 * Whatever the channel — a ManyChat flow, the self-hosted Instagram laptop
 * agent, a website form, WhatsApp later — an adapter's only job is to turn its
 * native payload into the canonical `LeadInput` below and hand it to
 * `ingestLead()`. Everything after that is identical for every source: the same
 * idempotency guard, the same `createLead()` write into the one CRM table, the
 * same notification, and the same `lead.created` event that the AI
 * qualification pipeline listens on.
 *
 * That last part is why this file is thin and boring on purpose. The downstream
 * pipeline (EventBridge rule → lead-qualifier-handler → AI call → scoring) is
 * already fully source-agnostic — it only ever reads {tenantId, leadId}. So
 * "one flow for every adapter" does not need a new engine; it needs every
 * adapter to arrive here, in one shape, with one quality bar.
 *
 * ── canonical LeadInput ────────────────────────────────────────────────────
 *   name            required
 *   phone           required
 *   leadType        'buyer' | 'tenant' | 'seller'  (see intentToLeadType)
 *   requirement     { requirement?, budget?, preferredArea? }
 *   source          coarse channel shown in the UI, e.g. 'Instagram'
 *   sourceAdapter   fine-grained provenance, e.g. 'manychat' | 'insta-agent'
 *   reelRef         { postId, permalink } | null
 *   externalRef     { igUsername, igSenderId, sourceMediaId, conversationRef }
 *   createdBy        human-readable origin label
 */

import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import {
  createLead,
  updateLead,
  findLeadByPhone,
  normalizePhone as normalizePhoneForIndex,
} from './crmDynamodbService.js';
import { notifyNewLead } from './leadNotifications.js';
import { logEventIfNotProcessed } from './webhookLogService.js';
import { logger } from './logger.js';

const eventBridge = new EventBridgeClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

/**
 * Maps a bucketed budget reply (e.g. "80L-1Cr", "<50L", "1Cr+", "under_25L") to
 * a representative rupee value, since the requirement blobs store a single
 * number. Uses the bracket's lower bound — conservative, and stable regardless
 * of how wide a bracket the adapter offers.
 *
 * Lives here rather than in any one adapter because both the ManyChat webhook
 * and the Instagram agent bridge need identical behaviour; they used to have
 * separate near-duplicate implementations that could drift apart.
 */
export function parseBudgetBracket(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') return raw;

  const s = String(raw).trim().toLowerCase();
  const lakh = 100000;
  const crore = 10000000;

  // Instagram Solution's enum form: under_25L, 25L_50L, above_5Cr …
  const enumMatch = s.match(/^(under|above)_([\d.]+)(l|cr)$/);
  if (enumMatch) {
    const value = parseFloat(enumMatch[2]);
    if (!isNaN(value)) {
      const rupees = enumMatch[3] === 'cr' ? value * crore : value * lakh;
      // "under_25L" has no floor of its own; one bracket-width below is the
      // same conservative choice the "<50L" form makes.
      return enumMatch[1] === 'under' ? Math.max(0, rupees - lakh) : rupees;
    }
  }
  const enumRange = s.match(/^([\d.]+)(l|cr)_([\d.]+)(l|cr)$/);
  if (enumRange) {
    const low = parseFloat(enumRange[1]);
    if (!isNaN(low)) return enumRange[2] === 'cr' ? low * crore : low * lakh;
  }

  if (s.startsWith('<')) {
    const n = parseFloat(s.slice(1));
    return isNaN(n) ? null : Math.max(0, n * lakh - lakh);
  }
  if (s.endsWith('+')) {
    const n = parseFloat(s);
    if (!isNaN(n)) return s.includes('cr') ? n * crore : n * lakh;
  }

  const rangeMatch = s.match(/([\d.]+)\s*(l|cr)?\s*-\s*([\d.]+)\s*(l|cr)?/);
  if (rangeMatch) {
    const lowValue = parseFloat(rangeMatch[1]);
    const lowUnit = rangeMatch[2] || rangeMatch[4] || 'l';
    if (!isNaN(lowValue)) {
      return lowUnit === 'cr' ? lowValue * crore : lowValue * lakh;
    }
  }

  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Channel intent vocabulary → CRM leadType.
 *
 * A rental enquiry is a TENANT lead, not a buyer lead — someone who picked
 * "rent" (or "heavy deposit", which is a rental arrangement) belongs in tenant
 * lead lists with their budget in tenantRequirement.
 *
 * Returns null for 'unknown': an unclassifiable enquiry has no correct
 * leadType, and guessing puts a miscategorised lead in front of an agent. The
 * caller holds it back until a human classifies it.
 */
export function intentToLeadType(intent) {
  switch (String(intent || '').toLowerCase()) {
    case 'rent':
    case 'heavy_deposit_ok':
      return 'tenant';
    case 'sell':
      return 'seller';
    case 'buy':
      return 'buyer';
    default:
      return null;
  }
}

/**
 * Places the requirement values in the blob the lead's type expects. A seller's
 * "budget" is the price they expect to get, not a spend ceiling, so it maps to
 * sellerProperty.expectedPrice rather than a requirement budget.
 */
function buildTypeSpecificFields(leadType, requirement = {}) {
  const { requirement: requirementLabel, budget, preferredArea } = requirement;

  if (leadType === 'seller') {
    return {
      sellerProperty: {
        ...(budget != null ? { expectedPrice: budget } : {}),
        ...(preferredArea ? { area: preferredArea } : {}),
      },
    };
  }

  const blob = {
    ...(requirementLabel ? { requirement: requirementLabel } : {}),
    ...(budget != null ? { budget } : {}),
    ...(preferredArea ? { preferredArea } : {}),
  };
  return leadType === 'tenant' ? { tenantRequirement: blob } : { buyerRequirement: blob };
}

/** Which blob a lead type keeps its requirement values in. */
const REQUIREMENT_FIELD_BY_TYPE = {
  buyer: 'buyerRequirement',
  tenant: 'tenantRequirement',
  seller: 'sellerProperty',
  owner: 'ownerProperty',
};

/**
 * Build the patch applied when a lead for this phone number already exists.
 *
 * The governing rule is **enrich, never overwrite**. The existing row may carry
 * a human's edits and the AI's qualification result; a returning enquiry is new
 * information about that person, not a reason to reset what we already know. So
 * this never touches status, score, assignment, leadType or the original
 * attribution — only fills genuine blanks, merges channel ids, and records that
 * the person came back.
 *
 * Requirement values are merged only when the incoming lead type matches the
 * existing one. A buyer who later DMs about renting is a real situation, but
 * forcing rental values into a buyer's blob would both fail updateLead's
 * type validation and corrupt the record; the note records it instead.
 */
function buildMergePatch(existing, input, requirement) {
  const patch = {};
  const now = new Date().toISOString();
  // Tracks whether this touch actually told us anything we did not already know.
  // A repeat-contact channel (WhatsApp especially) delivers the same person over
  // and over; writing on every one of those would append a note line and a
  // history entry each time, growing one item toward DynamoDB's 400KB cap and
  // burying the useful notes in noise. So a touch that adds nothing writes
  // nothing at all.
  let substantive = false;

  if (!existing.email && input.email) {
    patch.email = input.email;
    substantive = true;
  }

  const sameType = existing.leadType === input.leadType;
  const blobField = REQUIREMENT_FIELD_BY_TYPE[existing.leadType];

  if (sameType && blobField && existing.leadType !== 'owner') {
    // updateLead's mergeRequirementObjects keeps any field we don't send, so a
    // partial patch here cannot wipe an existing budget or area.
    const incoming = existing.leadType === 'seller'
      ? {
          ...(requirement.budget != null ? { expectedPrice: requirement.budget } : {}),
          ...(requirement.preferredArea ? { area: requirement.preferredArea } : {}),
        }
      : {
          ...(requirement.requirement ? { requirement: requirement.requirement } : {}),
          ...(requirement.budget != null ? { budget: requirement.budget } : {}),
          ...(requirement.preferredArea ? { preferredArea: requirement.preferredArea } : {}),
        };

    // Only send values the existing blob is actually missing — a fresh enquiry
    // must not silently revise a budget an agent already recorded.
    const current = existing[blobField] || {};
    const isBlank = (v) => v === undefined || v === null || v === '';
    const additions = Object.fromEntries(
      Object.entries(incoming).filter(([key]) => isBlank(current[key]))
    );
    if (Object.keys(additions).length > 0) {
      patch[blobField] = additions;
      substantive = true;
    }
  }

  if (input.externalRef) {
    const merged = { ...(existing.externalRef || {}), ...input.externalRef };
    // Only a genuinely new identifier counts; re-sending the same ids does not.
    const changed = Object.keys(merged).some((k) => (existing.externalRef || {})[k] !== merged[k]);
    if (changed) {
      patch.externalRef = merged;
      substantive = true;
    }
  }
  if (!existing.reelRef && input.reelRef) {
    patch.reelRef = input.reelRef;
    substantive = true;
  }

  // A different intent from the same person is worth recording even when it
  // carries no new field values — it is the one case where "nothing was added"
  // still means something changed.
  if (!sameType) substantive = true;

  if (!substantive) return null;

  const via = input.sourceAdapter || input.source || 'an adapter';
  const detail = sameType
    ? `Repeat enquiry via ${via}.`
    : `Repeat enquiry via ${via}, this time about "${input.requirement?.requirement || input.leadType}" (lead stays a ${existing.leadType} lead).`;
  patch.notes = `${existing.notes || ''}\n[${now}] ${detail}`.trim();
  patch.lastContactDate = now;

  return patch;
}

/**
 * Ingest one lead from any adapter.
 *
 * If the tenant already has an unconverted lead with the same phone number, that
 * lead is **updated** rather than a second one created — one person is one lead,
 * however many channels they arrive through.
 *
 * @param {string} tenantId
 * @param {object} input canonical LeadInput (see file header)
 * @param {object} [options]
 * @param {string} [options.dedupeKey] stable per-source id; repeated deliveries
 *   with the same key are dropped rather than creating duplicate leads.
 * @param {Map<string,object>} [options.phoneIndex] pre-built phone→lead map, so a
 *   batch does one lookup instead of one per item. Built by
 *   crmDynamodbService.buildLeadPhoneIndex(). Mutated as leads are created, so
 *   two items in one batch sharing a phone still collapse into one lead.
 * @returns {Promise<{ok: boolean, lead?: object, created?: boolean, updated?: boolean, duplicate?: boolean, skipped?: boolean, reason?: string}>}
 */
export async function ingestLead(tenantId, input = {}, options = {}) {
  if (!tenantId) {
    return { ok: false, skipped: true, reason: 'missing_tenant' };
  }

  const name = String(input.name || '').trim();
  const phone = String(input.phone || '').trim();

  // The same minimum bar for every adapter: a lead an agent cannot call is not
  // a lead. Sources that can't meet it hold the record on their side until a
  // human fills the gap, rather than creating an uncontactable CRM row.
  if (!name || !phone) {
    return { ok: true, skipped: true, reason: 'missing_name_or_phone' };
  }

  const leadType = input.leadType;
  if (!['buyer', 'tenant', 'seller'].includes(leadType)) {
    return { ok: true, skipped: true, reason: 'unresolved_lead_type' };
  }

  const { dedupeKey } = options;
  if (dedupeKey) {
    const idempotency = await logEventIfNotProcessed(dedupeKey, 'lead.ingest', null);
    if (idempotency.isDuplicate) {
      return { ok: true, duplicate: true, reason: 'already_ingested' };
    }
  }

  // One person is one lead. If this phone already has an unconverted lead, the
  // enquiry enriches it instead of creating a second row for the same human.
  const requirement = input.requirement || {};
  const { phoneIndex } = options;
  let existing = null;
  try {
    existing = phoneIndex
      ? (phoneIndex.get(normalizePhoneForIndex(phone)) || null)
      : await findLeadByPhone(tenantId, phone);
  } catch (lookupErr) {
    // A lookup failure must not drop the lead. Falling through creates one,
    // which is recoverable by merging later; losing it is not.
    logger.warn('leadIngestion.phone_lookup_failed', { tenantId, error: lookupErr.message });
  }

  if (existing) {
    const patch = buildMergePatch(existing, { ...input, name, phone, leadType }, requirement);

    // Nothing new — don't write. This is the common case on a repeat-contact
    // channel and the reason a chatty WhatsApp thread cannot bloat a lead.
    if (!patch) {
      return { ok: true, lead: existing, unchanged: true, reason: 'no_new_information' };
    }

    try {
      const updated = await updateLead(tenantId, existing.leadId, patch, { source: 'lead_ingestion' });
      logger.info('leadIngestion.updated', {
        tenantId, leadId: existing.leadId, sourceAdapter: input.sourceAdapter || null,
      });
      // Deliberately no notifyNewLead and no lead.created here: this is not a new
      // lead, and re-firing either would re-notify the agent and re-run AI
      // qualification on someone already in the pipeline.
      return { ok: true, lead: updated || existing, updated: true };
    } catch (updateErr) {
      logger.warn('leadIngestion.update_failed', {
        tenantId, leadId: existing.leadId, error: updateErr.message,
      });
      return { ok: false, skipped: true, reason: 'update_failed' };
    }
  }

  const leadData = {
    name,
    phone,
    leadType,
    source: input.source || '',
    sourceAdapter: input.sourceAdapter || null,
    externalRef: input.externalRef || null,
    dedupeKey: dedupeKey || null,
    reelRef: input.reelRef || null,
    createdBy: input.createdBy || 'Adapter',
    ...buildTypeSpecificFields(leadType, requirement),
  };

  const lead = await createLead(tenantId, leadData);
  logger.info('leadIngestion.created', {
    tenantId, leadId: lead.leadId, leadType, sourceAdapter: leadData.sourceAdapter,
  });

  // Keep a batch's index current so two enquiries from the same person in one
  // upload collapse onto this lead rather than creating a second.
  if (phoneIndex) {
    const key = normalizePhoneForIndex(phone);
    if (key) phoneIndex.set(key, lead);
  }

  // A notification failure must not cost us the lead — it is already written.
  try {
    await notifyNewLead(tenantId, lead);
  } catch (err) {
    logger.warn('leadIngestion.notify_failed', { tenantId, leadId: lead.leadId, error: err.message });
  }

  if (process.env.AGENTS_ENABLED === 'true') {
    try {
      await eventBridge.send(new PutEventsCommand({
        Entries: [{
          Source: 'crm.leads',
          DetailType: 'lead.created',
          Detail: JSON.stringify({
            tenantId,
            leadId: lead.leadId,
            leadType: lead.leadType,
            name: lead.name,
            phone: lead.phone,
            createdAt: lead.createdAt,
          }),
        }],
      }));
      logger.info('lead.created.event.published', {
        tenantId, leadId: lead.leadId, source: leadData.sourceAdapter || leadData.source,
      });
    } catch (ebErr) {
      logger.warn('lead.created.event.publish.failed', { tenantId, leadId: lead.leadId, error: ebErr.message });
    }
  }

  return { ok: true, lead, created: true };
}
