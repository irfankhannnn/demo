import express from 'express';
import crypto from 'crypto';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { verifyBaileySignature, isBaileyEnabled } from '../bailey.js';
import { logEventIfNotProcessed } from '../webhookLogService.js';
import { logger } from '../logger.js';
import { webhookRateLimit } from '../middleware/rateLimiter.js';
import { normalizeWhatsAppPhone } from '../utils/whatsapp.js';
import { createLead } from '../crmDynamodbService.js';
import { getTenantIdByInstagramWebhookToken } from '../agencyConfigService.js';
import { notifyNewLead } from '../leadNotifications.js';

const router = express.Router();

const eventBridge = new EventBridgeClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const IS_LOCAL_DEV = process.env.NODE_ENV === 'development';

// DEV-ONLY: The tenant mapping and admin sender whitelist below are local development
// conveniences and should NOT be deployed to production. In production, tenant
// resolution is always performed via the auth service lookup.
function parseDevTenantMapping() {
  const raw = process.env.DEV_TENANT_MAPPING;
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Not JSON — try comma-separated key=value format
    const map = {};
    for (const pair of raw.split(',')) {
      const [phone, tenantId] = pair.split('=').map(s => s.trim());
      if (phone && tenantId) map[phone] = tenantId;
    }
    if (Object.keys(map).length) return map;
  }
  return {};
}

// DEV-ONLY tenant mapping. Must be explicitly set via DEV_TENANT_MAPPING env var.
// Never falls back to hardcoded values.
const HARDCODED_TENANT_BY_PHONE = parseDevTenantMapping();

// Temporary hardcoded admin whitelist for local dev testing.
// Only these senders (JIDs or normalized phone numbers) can trigger the AI.
// Only populated when IS_LOCAL_DEV is true; empty in production.
const HARDCODED_ADMIN_SENDERS = IS_LOCAL_DEV
  ? new Set(
      (process.env.AI_ADMIN_WHATSAPP_NUMBERS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    )
  : new Set();

/**
 * Resolve tenant by destination WhatsApp number.
 * Local dev: DEV_TENANT_MAPPING, then AgencyConfig.connectedWhatsAppPhone, then auth service.
 * Production: auth service lookup.
 */
async function resolveTenantByWhatsAppNumber(toNumber) {
  const normalized = normalizeWhatsAppPhone(toNumber);

  // 1. Hardcoded local dev mapping (only in development)
  if (IS_LOCAL_DEV && HARDCODED_TENANT_BY_PHONE[normalized]) {
    logger.info('webhooks.whatsapp.tenant.hardcoded', { phone: normalized, tenantId: HARDCODED_TENANT_BY_PHONE[normalized] });
    return HARDCODED_TENANT_BY_PHONE[normalized];
  }

  // 2. Local dev: AgencyConfig table (same source as CRM WhatsApp connect + message processor)
  if (IS_LOCAL_DEV) {
    try {
      const { getTenantIdByConnectedWhatsAppPhone } = await import('../agencyConfigService.js');
      const tenantId = await getTenantIdByConnectedWhatsAppPhone(normalized);
      if (tenantId) {
        logger.info('webhooks.whatsapp.tenant.agency_config', { phone: normalized, tenantId });
        return tenantId;
      }
    } catch (err) {
      logger.warn('webhooks.whatsapp.tenant.agency_config_failed', { error: err.message, phone: normalized });
    }
  }

  // 3. Auth service lookup
  const authServiceUrl = process.env.AUTH_SERVICE_URL;
  if (!authServiceUrl) {
    logger.warn('webhooks.whatsapp.auth_service_url_not_configured', { toNumber, normalized });
    return null;
  }
  const internalKey = process.env.INTERNAL_API_KEY || '';

  try {
    const response = await fetch(
      `${authServiceUrl}/internal/users/by-whatsapp?phone=${encodeURIComponent(normalized)}`,
      {
        headers: { 'x-internal-api-key': internalKey },
        signal: AbortSignal.timeout(parseInt(process.env.AUTH_SERVICE_TIMEOUT_MS || '3000', 10)),
      }
    );
    if (response.ok) {
      const data = await response.json();
      return data.tenantId || null;
    }
  } catch (err) {
    logger.warn('webhooks.whatsapp.tenantLookup.failed', { error: err.message, toNumber, normalized });
  }
  return null;
}

// POST /whatsapp — Bailey inbound webhook (mounted at /api/webhooks)
router.post('/whatsapp', webhookRateLimit, async (req, res) => {
  try {
    logger.info('webhooks.whatsapp.received', { headers: req.headers });

    if (!isBaileyEnabled()) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'bailey_disabled' });
    }

    const rawBody = req.body;
    const signature = req.headers['x-bailey-signature'];
    const timestamp = req.headers['x-bailey-timestamp'];

    if (!verifyBaileySignature(rawBody, signature, timestamp)) {
      logger.warn('webhooks.whatsapp.invalid_signature');
      return res.status(401).json({ error: 'invalid_signature' });
    }

    let body;
    try {
      body = JSON.parse(rawBody.toString());
    } catch {
      return res.status(400).json({ error: 'invalid_json' });
    }

    const messageId = body.messageId || body.id || crypto.randomUUID();
    const { from, to, text, media, fromJid } = body;

    logger.info('webhooks.whatsapp.parsed', { messageId, from, to, text });

    const idempotency = await logEventIfNotProcessed(`bailey:${messageId}`, 'whatsapp.incoming', null);
    if (idempotency.isDuplicate) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    const tenantId = await resolveTenantByWhatsAppNumber(to);
    if (!tenantId) {
      logger.info('webhooks.whatsapp.unknown_number', { to });
      return res.status(200).json({ ok: true, skipped: true, reason: 'unknown_number' });
    }

    logger.info('webhooks.whatsapp.tenant_resolved', { messageId, tenantId });

    // Only allow self-chat or whitelisted admin senders to trigger the AI.
    // In local dev, also allow any fromMe message (Baileys sets body.isSelfChat
    // but LID formats can cause false negatives, so we trust fromMe in dev).
    const normalizedFrom = normalizeWhatsAppPhone(from);
    const normalizedTo = normalizeWhatsAppPhone(to);
    const isFromMe = body.fromMe === true || body.isSelfChat === true;
    const isSelfChatByPhone = normalizedFrom && normalizedTo && normalizedFrom === normalizedTo;
    const isAdminSender =
      isFromMe ||
      isSelfChatByPhone ||
      (IS_LOCAL_DEV && HARDCODED_ADMIN_SENDERS.has(normalizedFrom)) ||
      (IS_LOCAL_DEV && HARDCODED_ADMIN_SENDERS.has(from));
    if (!isAdminSender) {
      logger.info('webhooks.whatsapp.unauthorized_sender', { messageId, from, normalizedFrom, to, normalizedTo, tenantId });
      return res.status(200).json({ ok: true, skipped: true, reason: 'unauthorized_sender' });
    }

    logger.info('webhooks.whatsapp.authorized_sender', { messageId, from, tenantId });

    const eventDetail = {
      messageId,
      from,
      to,
      text: text || '',
      media: media || null,
      tenantId,
      fromJid: fromJid || null,  // original JID (e.g. 10076144300114@lid) for replies
      receivedAt: new Date().toISOString(),
    };

    if (IS_LOCAL_DEV) {
      // In local dev, process the WhatsApp message directly instead of publishing to EventBridge.
      logger.info('webhooks.whatsapp.local_process', { messageId, tenantId });
      try {
        const { handler } = await import('../scripts/whatsapp-message-processor.js');
        await handler({ Records: [{ detail: eventDetail }] });
        logger.info('webhooks.whatsapp.local_process.done', { messageId, tenantId });
        return res.status(200).json({ ok: true, processed: true });
      } catch (err) {
        logger.error('webhooks.whatsapp.local_process.failed', { messageId, tenantId, error: err.message, stack: err.stack });
        // Return 503 so the whatsapp-platform webhook forwarder retries the
        // webhook and the message can be re-processed once the connection is
        // healthy. In production Lambda mode the thrown error triggers the
        // Lambda retry path directly.
        return res.status(503).json({ ok: false, processed: false, error: err.message });
      }
    }

    await eventBridge.send(new PutEventsCommand({
      Entries: [{
        Source: 'whatsapp.incoming',
        DetailType: 'message.received',
        Detail: JSON.stringify(eventDetail),
      }],
    }));

    logger.info('webhooks.whatsapp.event_published', { messageId, tenantId });
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error('webhooks.whatsapp.error', { error: err.message, stack: err.stack });
    return res.status(200).json({ ok: true, error: 'processing_failed' });
  }
});

// POST /instagram/:webhookToken — ManyChat "External Request" outbound webhook.
// Each tenant that turns on the Instagram lead pipeline gets a unique token
// (AgencyConfig.instagramWebhookToken) embedded in the ManyChat flow's request
// URL — that token both identifies the tenant and authenticates the request,
// since ManyChat doesn't support HMAC signature verification like Meta does.
//
// Expected ManyChat payload shape (configured on the flow's External Request
// action — field names are whatever you map them to in ManyChat, this route
// accepts either the exact names below or ManyChat's default {{...}} variables
// mapped to these keys):
// {
//   "subscriberId": "12345",           // ManyChat subscriber id — used for idempotency
//   "name": "Rahul Sharma",
//   "phone": "+919812345678",
//   "requirement": "buy",              // "buy" | "rent" | "heavy_deposit_ok"
//   "budgetBracket": "80L-1Cr",
//   "preferredArea": "Andheri West",
//   "postId": "17912345678901234",     // triggering reel/post id
//   "permalink": "https://instagram.com/p/..."
// }
router.post('/instagram/:webhookToken', webhookRateLimit, async (req, res) => {
  try {
    const { webhookToken } = req.params;
    const body = req.body || {};

    logger.info('webhooks.instagram.received', { hasBody: !!body });

    const tenantId = await getTenantIdByInstagramWebhookToken(webhookToken);
    if (!tenantId) {
      logger.warn('webhooks.instagram.unknown_token');
      // 200, not 401/404 — ManyChat retries aggressively on non-2xx and a bad
      // token is a config problem, not something a retry will fix.
      return res.status(200).json({ ok: true, skipped: true, reason: 'unknown_webhook_token' });
    }

    const subscriberId = body.subscriberId || body.subscriber_id || body.contactId;
    const idempotencyKey = subscriberId
      ? `manychat:${tenantId}:${subscriberId}:${body.postId || 'no-post'}`
      : `manychat:${tenantId}:${crypto.randomUUID()}`;
    const idempotency = await logEventIfNotProcessed(idempotencyKey, 'instagram.incoming', null);
    if (idempotency.isDuplicate) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    const name = (body.name || '').trim();
    const phone = (body.phone || '').trim();
    if (!name || !phone) {
      logger.warn('webhooks.instagram.missing_fields', { tenantId, hasName: !!name, hasPhone: !!phone });
      return res.status(200).json({ ok: true, skipped: true, reason: 'missing_name_or_phone' });
    }

    const requirementRaw = String(body.requirement || '').toLowerCase();
    const requirementLabel = requirementRaw === 'rent'
      ? 'rent'
      : requirementRaw === 'heavy_deposit_ok'
        ? 'heavy_deposit_ok'
        : 'buy';

    const budget = parseBudgetBracket(body.budgetBracket || body.budget);

    // A rental enquiry is a TENANT lead, not a buyer lead. This used to
    // hardcode leadType 'buyer' for every Instagram lead, so someone who
    // picked "rent" (or "heavy deposit", which is a rental arrangement) was
    // filed as a buyer: they showed up in buyer-lead lists, never in
    // "tenant leads dikhao", and their budget landed in buyerRequirement
    // instead of tenantRequirement. The requirement value already told us
    // which one it was; it just wasn't used.
    const isRental = requirementLabel === 'rent' || requirementLabel === 'heavy_deposit_ok';
    const requirementPayload = {
      requirement: requirementLabel,
      budget: budget ?? undefined,
      preferredArea: body.preferredArea || body.area || undefined,
    };

    const leadData = {
      name,
      phone,
      leadType: isRental ? 'tenant' : 'buyer',
      source: 'Instagram',
      ...(isRental
        ? { tenantRequirement: requirementPayload }
        : { buyerRequirement: requirementPayload }),
      reelRef: (body.postId || body.permalink)
        ? { postId: body.postId || null, permalink: body.permalink || null }
        : null,
      createdBy: 'ManyChat (Instagram)',
    };

    const lead = await createLead(tenantId, leadData);
    logger.info('webhooks.instagram.lead_created', { tenantId, leadId: lead.leadId });

    await notifyNewLead(tenantId, lead);

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
        logger.info('lead.created.event.published', { tenantId, leadId: lead.leadId, source: 'instagram' });
      } catch (ebErr) {
        logger.warn('lead.created.event.publish.failed', { tenantId, leadId: lead.leadId, error: ebErr.message });
      }
    }

    return res.status(200).json({ ok: true, leadId: lead.leadId });
  } catch (err) {
    logger.error('webhooks.instagram.error', { error: err.message, stack: err.stack });
    // 200 even on failure — same policy as the WhatsApp webhook — so ManyChat
    // doesn't hammer retries; failures are visible in logs instead.
    return res.status(200).json({ ok: true, error: 'processing_failed' });
  }
});

// Maps a bucketed budget reply (e.g. "80L-1Cr", "<50L", "1Cr+") to a
// representative numeric value in rupees, since buyerRequirement.budget is a
// single number. Uses the bracket's lower bound — conservative, and stable
// regardless of how wide a bracket the ManyChat flow offers.
function parseBudgetBracket(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') return raw;

  const s = String(raw).trim().toLowerCase();
  const lakh = 100000;
  const crore = 10000000;

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

export default router;
