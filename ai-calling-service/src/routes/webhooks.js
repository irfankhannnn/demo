// Webhook Routes for Exotel and ElevenLabs callbacks

import express from 'express';
import * as callOrchestration from '../handlers/callOrchestration.js';
import * as exotel from '../services/exotelService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Exotel status webhook
router.post('/exotel/status', async (req, res) => {
  try {
    // Validate webhook (IP whitelist or signature)
    if (!exotel.validateWebhookSignature(req)) {
      logger.warn('Invalid Exotel webhook signature');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await callOrchestration.handleExotelWebhook(req.body);
    
    res.json(result);
  } catch (error) {
    logger.error('Exotel webhook error', error);
    // Always return 200 to Exotel to prevent retries
    res.json({ success: false, error: error.message });
  }
});

// ElevenLabs intent webhook
router.post('/elevenlabs/intent', async (req, res) => {
  try {
    const result = await callOrchestration.handleElevenLabsIntentWebhook(req.body);
    
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
