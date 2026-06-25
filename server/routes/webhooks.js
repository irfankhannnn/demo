import express from 'express';
import crypto from 'crypto';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { verifyBaileySignature, isBaileyEnabled } from '../bailey.js';
import { logEventIfNotProcessed } from '../webhookLogService.js';
import { logger } from '../logger.js';
import { webhookRateLimit } from '../middleware/rateLimiter.js';
import { normalizeWhatsAppPhone } from '../utils/whatsapp.js';

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
    // Fallback only in development. Never fall back to hardcoded values in production.
    return IS_LOCAL_DEV ? { '918291537522': 'acme-corporation-edc6e9feb8' } : {};
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

// Temporary hardcoded tenant mapping for local dev testing.
// Key: normalized WhatsApp number without + or @s.whatsapp.net suffix.
// Set via DEV_TENANT_MAPPING env var; falls back to the hardcoded value only in development.
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
 * First checks hardcoded mapping (local dev), then falls back to auth service lookup.
 */
async function resolveTenantByWhatsAppNumber(toNumber) {
  const normalized = normalizeWhatsAppPhone(toNumber);

  // 1. Hardcoded local dev mapping (only in development)
  if (IS_LOCAL_DEV && HARDCODED_TENANT_BY_PHONE[normalized]) {
    logger.info('webhooks.whatsapp.tenant.hardcoded', { phone: normalized, tenantId: HARDCODED_TENANT_BY_PHONE[normalized] });
    return HARDCODED_TENANT_BY_PHONE[normalized];
  }

  // 2. Auth service lookup
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
  const internalKey = process.env.INTERNAL_API_KEY || '';

  try {
    const response = await fetch(
      `${authServiceUrl}/internal/users/by-whatsapp?phone=${encodeURIComponent(normalized)}`,
      {
        headers: { 'x-internal-api-key': internalKey },
        signal: AbortSignal.timeout(3000),
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
        return res.status(200).json({ ok: true, processed: false, error: err.message });
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

export default router;
