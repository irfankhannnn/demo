// Instagram webhooks (open, verified by signature).
//
//   GET  /webhooks/instagram   Meta's one-time subscription handshake
//   POST /webhooks/instagram   DMs, echoes of our own sends, comments
//
// Meta only delivers webhooks once the app is Live, so in Development Mode the
// scheduled worker's polling does this job instead. Both paths write through
// the same idempotent ingest, so a message seen by both is stored once.
//
// Processing here is deliberately small - store the message, mark the thread
// for analysis, answer 200 - because Meta retries slow or failing deliveries.
// The analysis and CRM hand-off happen in the next worker run.

import crypto from 'node:crypto';
import express from 'express';
import { getConfig } from '../config/env.js';
import { logger } from '../logger.js';
import { verifyWebhookSignature } from '../services/metaSecurity.js';

const log = logger.child({ module: 'routes/webhooks' });

function tokensMatch(provided, expected) {
  if (!expected || typeof provided !== 'string') return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function createWebhooksRouter({ service }) {
  const router = express.Router();

  router.get('/instagram', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && tokensMatch(token, getConfig().meta.webhookVerifyToken) && challenge) {
      log.info('webhooks.verified');
      return res.status(200).type('text/plain').send(String(challenge));
    }
    log.warn('webhooks.verification_rejected', { mode });
    return res.status(403).json({ error: 'Forbidden', details: 'Webhook verification failed' });
  });

  router.post('/instagram', async (req, res) => {
    const { appSecret } = getConfig().meta;
    if (!verifyWebhookSignature(req.rawBody, req.headers['x-hub-signature-256'], appSecret)) {
      log.warn('webhooks.bad_signature');
      return res.status(401).json({ error: 'Unauthorized', details: 'Invalid webhook signature' });
    }

    try {
      const summary = await service.ingestWebhook(req.body);
      log.info('webhooks.received', summary);
      return res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
      // A 500 makes Meta redeliver, which is safe: ingest is idempotent.
      log.error('webhooks.ingest_failed', { error: err.message });
      return res.status(500).json({ error: 'Internal Server Error', details: 'Webhook processing failed' });
    }
  });

  return router;
}

export default createWebhooksRouter;
