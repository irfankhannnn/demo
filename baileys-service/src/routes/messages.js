import { Router } from 'express';
import { sendMessage } from '../baileysClient.js';
import { logger } from '../logger.js';
import { safeError } from './utils.js';

const router = Router();

router.post('/send', async (req, res) => {
  try {
    const { from, to, text, media } = req.body || {};
    if (!to || !text) {
      return res.status(400).json({ error: 'to and text are required' });
    }

    if (from && !/^\d{10,15}$/.test(from.replace(/\D/g, ''))) {
      return res.status(400).json({ error: 'invalid_from_format' });
    }

    const result = await sendMessage(from, to, text, media);
    // Distinguish between queued (connection not ready) and actually sent.
    if (result?.queued) {
      logger.warn('message.send.queued', { from, to, messageId: result.messageId });
      return res.status(202).json({
        enabled: true,
        sent: false,
        queued: true,
        messageId: result.messageId || null,
      });
    }
    logger.info('message.send.success', { from, to, messageId: result?.key?.id });
    return res.json({
      enabled: true,
      sent: true,
      queued: false,
      messageId: result?.key?.id || null,
    });
  } catch (err) {
    logger.error('message.send.error', { error: err.message, to: req.body?.to });
    return res.status(400).json({ error: safeError(err, 'failed_to_send') });
  }
});

export default router;
