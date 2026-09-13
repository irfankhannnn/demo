import express from 'express';
import crypto from 'crypto';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { verifyBaileySignature, isBaileyEnabled } from '../bailey.js';
import { logEventIfNotProcessed } from '../webhookLogService.js';
import { logger } from '../logger.js';
import { getAuthServiceBaseUrl } from '../config/serviceUrls.js';
import { webhookRateLimit } from '../middleware/rateLimiter.js';
import { normalizeWhatsAppPhone } from '../utils/whatsapp.js';
import { getTenantIdByInstagramWebhookToken } from '../agencyConfigService.js';
import { ingestLead, intentToLeadType, parseBudgetBracket } from '../leadIngestion.js';

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
  let authServiceUrl;
  try {
    authServiceUrl = getAuthServiceBaseUrl();
  } catch (configError) {
    logger.warn('webhooks.whatsapp.auth_service_url_not_configured', { toNumber, normalized, error: configError.message });
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

    // The router is mounted with express.raw({ type: 'application/json' })
    // (see server.js), so req.body arrives as a Buffer here, same as the
    // /whatsapp route above — it must be parsed explicitly.
    let body;
    try {
      const rawBody = req.body;
      body = rawBody && rawBody.length ? JSON.parse(rawBody.toString()) : {};
    } catch {
      logger.warn('webhooks.instagram.invalid_json');
      return res.status(200).json({ ok: true, skipped: true, reason: 'invalid_json' });
    }

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

    // ManyChat's requirement vocabulary maps to a CRM leadType. Anything the
    // flow doesn't recognise falls back to 'buy' (a buyer lead), which is what
    // this route has always done for unlabelled ManyChat traffic.
    const requirementRaw = String(body.requirement || '').toLowerCase();
    const requirementLabel = ['rent', 'heavy_deposit_ok', 'sell', 'buy'].includes(requirementRaw)
      ? requirementRaw
      : 'buy';

    const result = await ingestLead(
      tenantId,
      {
        name: body.name,
        phone: body.phone,
        leadType: intentToLeadType(requirementLabel),
        requirement: {
          requirement: requirementLabel,
          budget: parseBudgetBracket(body.budgetBracket || body.budget) ?? undefined,
          preferredArea: body.preferredArea || body.area || undefined,
        },
        source: 'Instagram',
        sourceAdapter: 'manychat',
        reelRef: (body.postId || body.permalink)
          ? { postId: body.postId || null, permalink: body.permalink || null }
          : null,
        createdBy: 'ManyChat (Instagram)',
      },
      // Idempotency was already established above on the ManyChat subscriber id,
      // so no second dedupeKey is needed here.
    );

    if (result.skipped) {
      logger.warn('webhooks.instagram.skipped', { tenantId, reason: result.reason });
      return res.status(200).json({ ok: true, skipped: true, reason: result.reason });
    }

    logger.info('webhooks.instagram.lead_created', { tenantId, leadId: result.lead.leadId });
    return res.status(200).json({ ok: true, leadId: result.lead.leadId });
  } catch (err) {
    logger.error('webhooks.instagram.error', { error: err.message, stack: err.stack });
    // 200 even on failure — same policy as the WhatsApp webhook — so ManyChat
    // doesn't hammer retries; failures are visible in logs instead.
    return res.status(200).json({ ok: true, error: 'processing_failed' });
  }
});

export default router;
