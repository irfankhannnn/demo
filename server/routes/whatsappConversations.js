/**
 * WhatsApp Conversation Routes
 * Mounted at /api/whatsapp
 * Exposes WhatsApp conversation history to authenticated CRM users (admin or manager).
 */
import crypto from 'crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireAdminOrManager } from '../middleware/requireRole.js';
import { listConversations, getConversation, getConversationSummary, markConversationRead, logMessage } from '../whatsappConversationService.js';
import { sendWhatsAppMessage, isBaileyEnabled } from '../bailey.js';
import { getAgencyConfig } from '../agencyConfigService.js';
import { canSendWhatsApp } from '../whatsappAccessControl.js';
import { normalizeWhatsAppPhone } from '../utils/whatsapp.js';
import { logger } from '../logger.js';

const router = express.Router();

router.use(validateToken, extractTenantId, requireAdminOrManager);

// Rate limit for message sending: max 30 messages per minute per user
const sendMessageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `send:${req.user?.sub || req.ip}`,
  handler: (req, res) => {
    logger.warn('whatsappConversations.rate_limited', { tenantId: req.tenantId, ip: req.ip });
    res.status(429).json({ error: 'Too many messages. Please slow down.' });
  },
});

function parseLimit(query) {
  return Math.min(parseInt(query.limit, 10) || 20, 100);
}

// GET /api/whatsapp/conversations?limit=20&startKey=...
router.get('/conversations', async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const limit = parseLimit(req.query);
    const startKey = req.query.startKey || undefined;
    const result = await listConversations(tenantId, { limit, startKey });
    return res.json(result);
  } catch (err) {
    logger.error('whatsappConversations.list.failed', { tenantId, error: err.message });
    return res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// GET /api/whatsapp/conversations/:phone/summary
router.get('/conversations/:phone/summary', async (req, res) => {
  const tenantId = req.tenantId;
  const phone = req.params.phone;
  try {
    const result = await getConversationSummary(tenantId, phone);
    return res.json(result);
  } catch (err) {
    logger.error('whatsappConversations.summary.failed', { tenantId, phone, error: err.message });
    return res.status(500).json({ error: 'Failed to fetch conversation summary' });
  }
});

// GET /api/whatsapp/conversations/:phone?limit=20&startKey=...
router.get('/conversations/:phone', async (req, res) => {
  const tenantId = req.tenantId;
  const phone = req.params.phone;
  try {
    const limit = parseLimit(req.query);
    const startKey = req.query.startKey || undefined;
    const result = await getConversation(tenantId, phone, { limit, startKey });
    return res.json(result);
  } catch (err) {
    logger.error('whatsappConversations.get.failed', { tenantId, phone, error: err.message });
    return res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// PATCH /api/whatsapp/conversations/:phone/read
router.patch('/conversations/:phone/read', async (req, res) => {
  const tenantId = req.tenantId;
  const phone = req.params.phone;
  try {
    const result = await markConversationRead(tenantId, phone);
    return res.json(result);
  } catch (err) {
    logger.error('whatsappConversations.markRead.failed', { tenantId, phone, error: err.message });
    return res.status(500).json({ error: 'Failed to mark conversation as read' });
  }
});

// POST /api/whatsapp/conversations/:phone/messages
router.post('/conversations/:phone/messages', sendMessageRateLimit, async (req, res) => {
  const tenantId = req.tenantId;
  const phone = req.params.phone;
  const { text } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  if (!isBaileyEnabled()) {
    return res.status(400).json({ error: 'WhatsApp messaging is not enabled' });
  }

  try {
    const config = await getAgencyConfig(tenantId);
    const fromPhone = config?.connectedWhatsAppPhone;
    if (!fromPhone) {
      return res.status(400).json({ error: 'No connected WhatsApp number found' });
    }

    const cleanText = text.trim();
    const cleanPhone = normalizeWhatsAppPhone(phone);

    // Access control check: verify the recipient can receive messages
    const aiEmployeeConfig = config?.aiEmployee || {};
    const accessCheck = await canSendWhatsApp(cleanPhone, tenantId, aiEmployeeConfig);
    if (!accessCheck.allowed) {
      logger.info('whatsappConversations.send.access_denied', { tenantId, phone: cleanPhone, reason: accessCheck.reason });
      return res.status(403).json({ error: 'Access denied', reason: accessCheck.reason });
    }

    const messageId = crypto.randomUUID();
    const result = await sendWhatsAppMessage(cleanPhone, cleanText, null, fromPhone);

    // Handle queued status properly
    const status = result.queued ? 'queued' : (result.sent !== false ? 'sent' : 'failed');

    await logMessage(tenantId, cleanPhone, {
      messageId,
      direction: 'outbound',
      from: fromPhone,
      to: cleanPhone,
      text: cleanText,
      fromMe: true,
      aiGenerated: false,
      status,
      createdAt: new Date().toISOString(),
    });

    return res.json({ success: true, sent: !result.queued, queued: !!result.queued, messageId });
  } catch (err) {
    logger.error('whatsappConversations.send.failed', { tenantId, phone, error: err.message });
    return res.status(500).json({ error: 'Failed to send message', details: err.message });
  }
});

export default router;
