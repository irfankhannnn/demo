import express from 'express';
import crypto from 'crypto';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { verifyBaileySignature, isBaileyEnabled } from '../bailey.js';
import { logEventIfNotProcessed } from '../webhookLogService.js';
import { logger } from '../logger.js';

const router = express.Router();

const eventBridge = new EventBridgeClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

/**
 * Resolve tenant by destination WhatsApp number via auth service internal lookup.
 */
async function resolveTenantByWhatsAppNumber(toNumber) {
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
  const internalKey = process.env.INTERNAL_API_KEY || '';

  try {
    const normalized = toNumber.replace(/\s/g, '');
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
    logger.warn('webhooks.whatsapp.tenantLookup.failed', { error: err.message, toNumber });
  }
  return null;
}

// POST /whatsapp — Bailey inbound webhook (mounted at /api/webhooks)
router.post('/whatsapp', async (req, res) => {
  try {
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
    const { from, to, text, media } = body;

    const idempotency = await logEventIfNotProcessed(`bailey:${messageId}`, 'whatsapp.incoming', null);
    if (idempotency.isDuplicate) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    const tenantId = await resolveTenantByWhatsAppNumber(to);
    if (!tenantId) {
      logger.info('webhooks.whatsapp.unknown_number', { to });
      return res.status(200).json({ ok: true, skipped: true, reason: 'unknown_number' });
    }

    await eventBridge.send(new PutEventsCommand({
      Entries: [{
        Source: 'whatsapp.incoming',
        DetailType: 'message.received',
        Detail: JSON.stringify({
          messageId,
          from,
          to,
          text: text || '',
          media: media || null,
          tenantId,
          receivedAt: new Date().toISOString(),
        }),
      }],
    }));

    logger.info('webhooks.whatsapp.event_published', { messageId, tenantId });
    return res.status(200).json({ ok: true });
  } catch (err) {
    logger.error('webhooks.whatsapp.error', { error: err.message });
    return res.status(200).json({ ok: true, error: 'processing_failed' });
  }
});

export default router;
