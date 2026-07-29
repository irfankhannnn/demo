import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { sendMessage } from '../baileysClient.js';
import { logger } from '../logger.js';
import { safeError } from './utils.js';
import { NODE_ENV } from '../config.js';

const router = Router();

// Rate limit for message sending to prevent storms
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: NODE_ENV === 'production' ? 100 : 1000, // 100/min in prod, 1000/min in dev
  message: { error: 'too_many_messages' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /v1/messages/send
// Body: { from?, to, text, media?, idempotencyKey? }
router.post('/send', messageLimiter, async (req, res) => {
  try {
    const { from, to, text, media, idempotencyKey } = req.body || {};
    if (!to || !text) {
      return res.status(400).json({ error: 'to and text are required' });
    }
    if (from && !/^\d{7,15}$/.test(from.replace(/\D/g, ''))) {
      return res.status(400).json({ error: 'invalid_from_format' });
    }
    if (idempotencyKey && !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      return res.status(400).json({ error: 'invalid_idempotency_key' });
    }
    const result = await sendMessage(from, to, text, media, idempotencyKey || null);
    if (result?.queued) {
      logger.warn({ from, to, messageId: result.messageId }, 'message.send.queued');
      return res.status(202).json({ enabled: true, sent: false, queued: true, messageId: result.messageId || null });
    }
    logger.info({ from, to, messageId: result?.key?.id }, 'message.send.success');
    return res.json({ enabled: true, sent: true, queued: false, messageId: result?.key?.id || null });
  } catch (err) {
    logger.error({ error: err.message, to: req.body?.to }, 'message.send.error');
    return res.status(400).json({ error: safeError(err, 'failed_to_send') });
  }
});

export default router;
