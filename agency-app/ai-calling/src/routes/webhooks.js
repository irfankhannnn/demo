// Webhook Routes for Exotel and ElevenLabs callbacks.
//
// Both routes verify their caller before doing any work. Previously the Exotel
// route called a stub that always returned true and the ElevenLabs route had
// no check at all, which left anyone who knew the URL able to forge call
// outcomes and qualification scores for a guessed session id.

import express from 'express';
import * as callOrchestration from '../handlers/callOrchestration.js';
import * as exotel from '../services/exotelService.js';
import * as elevenlabs from '../services/elevenlabsService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Exotel status webhook
router.post('/exotel/status', async (req, res) => {
  const check = exotel.validateWebhookSource(req);
  if (!check.valid) {
    logger.warn('Rejected Exotel webhook', { reason: check.reason });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await callOrchestration.handleExotelWebhook(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Exotel webhook error', error);
    // 200 so Exotel does not retry a request we've already logged as failed.
    res.json({ success: false, error: error.message });
  }
});

// ElevenLabs post-call webhook
router.post('/elevenlabs/post-call', async (req, res) => {
  const check = elevenlabs.verifyWebhookSignature(
    req.rawBody,
    req.headers['elevenlabs-signature'],
    process.env.ELEVENLABS_WEBHOOK_SECRET
  );

  if (!check.valid) {
    // Log the header's shape, never its value, so a format mismatch on the
    // first real delivery is diagnosable without leaking the signature.
    logger.warn('Rejected ElevenLabs webhook', {
      reason: check.reason,
      signaturePresent: !!req.headers['elevenlabs-signature'],
      signatureShape: req.headers['elevenlabs-signature']
        ? String(req.headers['elevenlabs-signature']).replace(/=[^,]*/g, '=<redacted>')
        : null,
      hasRawBody: req.rawBody !== undefined,
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await callOrchestration.handleElevenLabsPostCall(req.body);
    res.json(result);
  } catch (error) {
    logger.error('ElevenLabs webhook error', error);
    res.json({ success: false, error: error.message });
  }
});

// Health check for webhooks
router.get('/health', (req, res) => {
  res.json({ status: 'ok', webhooks: 'ready' });
});

export default router;
