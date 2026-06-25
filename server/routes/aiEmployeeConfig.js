/**
 * AI Employee Configuration Routes
 * GET  /api/crm/config/ai-employee  — fetch tenant AI Employee settings
 * PATCH /api/crm/config/ai-employee — update tenant AI Employee settings
 */
import express from 'express';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireAdmin } from '../middleware/requireRole.js';
import { getAgencyConfig, updateAgencyConfig } from '../agencyConfigService.js';
import { logger } from '../logger.js';

const router = express.Router();

const ALLOWED_MODES = ['draft', 'autosend'];
const ALLOWED_CHANNELS = ['whatsapp', 'email'];
const ALLOWED_PERSONALITIES = ['professional', 'friendly', 'direct'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const VALID_TIMEZONES = Intl.supportedValuesOf?.('timeZone') || ['Asia/Kolkata', 'UTC'];

// GET /api/crm/config/ai-employee
router.get('/ai-employee', validateToken, extractTenantId, requireAdmin, async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const config = await getAgencyConfig(tenantId);
    return res.json({
      aiEmployeeEnabled: config?.aiEmployeeEnabled || false,
      followupAgentMode: config?.followupAgentMode || 'draft',
      followupAgentAutoSendChannels: config?.followupAgentAutoSendChannels || ['whatsapp'],
      aiPersonality: config?.aiPersonality || 'professional',
      autoReply: config?.autoReply !== false,
      businessHoursStart: config?.businessHoursStart || '09:00',
      businessHoursEnd: config?.businessHoursEnd || '18:00',
      timezone: config?.timezone || 'Asia/Kolkata',
      connectedWhatsAppPhone: config?.connectedWhatsAppPhone || null,
      whitelistedPhones: config?.whitelistedPhones || [],
      blacklistedPhones: config?.blacklistedPhones || [],
    });
  } catch (err) {
    logger.error('config.ai-employee.get.failed', { tenantId, error: err.message });
    return res.status(500).json({ error: 'Failed to fetch AI Employee config' });
  }
});

// PATCH /api/crm/config/ai-employee
router.patch('/ai-employee', validateToken, extractTenantId, requireAdmin, async (req, res) => {
  const tenantId = req.tenantId;
  const {
    aiEmployeeEnabled,
    followupAgentMode,
    followupAgentAutoSendChannels,
    aiPersonality,
    autoReply,
    businessHoursStart,
    businessHoursEnd,
    timezone,
    connectedWhatsAppPhone,
    whitelistedPhones,
    blacklistedPhones,
  } = req.body || {};

  const update = {};

  if (aiEmployeeEnabled !== undefined) {
    update.aiEmployeeEnabled = !!aiEmployeeEnabled;
  }

  if (followupAgentMode !== undefined) {
    if (!ALLOWED_MODES.includes(followupAgentMode)) {
      return res.status(400).json({ error: `Invalid followupAgentMode — must be one of: ${ALLOWED_MODES.join(', ')}` });
    }
    update.followupAgentMode = followupAgentMode;
  }

  if (followupAgentAutoSendChannels !== undefined) {
    if (!Array.isArray(followupAgentAutoSendChannels)) {
      return res.status(400).json({ error: 'followupAgentAutoSendChannels must be an array' });
    }
    const invalid = followupAgentAutoSendChannels.filter(c => !ALLOWED_CHANNELS.includes(c));
    if (invalid.length) {
      return res.status(400).json({ error: `Invalid channels: ${invalid.join(', ')}. Allowed: ${ALLOWED_CHANNELS.join(', ')}` });
    }
    update.followupAgentAutoSendChannels = followupAgentAutoSendChannels;
  }

  if (aiPersonality !== undefined) {
    if (!ALLOWED_PERSONALITIES.includes(aiPersonality)) {
      return res.status(400).json({ error: `Invalid aiPersonality — must be one of: ${ALLOWED_PERSONALITIES.join(', ')}` });
    }
    update.aiPersonality = aiPersonality;
  }

  if (autoReply !== undefined) {
    update.autoReply = !!autoReply;
  }

  if (businessHoursStart !== undefined) {
    if (businessHoursStart && !TIME_REGEX.test(businessHoursStart)) {
      return res.status(400).json({ error: 'businessHoursStart must be HH:MM (24-hour format)' });
    }
    update.businessHoursStart = businessHoursStart || null;
  }

  if (businessHoursEnd !== undefined) {
    if (businessHoursEnd && !TIME_REGEX.test(businessHoursEnd)) {
      return res.status(400).json({ error: 'businessHoursEnd must be HH:MM (24-hour format)' });
    }
    update.businessHoursEnd = businessHoursEnd || null;
  }

  if (update.businessHoursStart && update.businessHoursEnd) {
    const [startHour, startMin] = update.businessHoursStart.split(':').map(Number);
    const [endHour, endMin] = update.businessHoursEnd.split(':').map(Number);
    if (startHour * 60 + startMin >= endHour * 60 + endMin) {
      return res.status(400).json({ error: 'businessHoursStart must be before businessHoursEnd' });
    }
  }

  if (timezone !== undefined) {
    if (timezone && !VALID_TIMEZONES.includes(timezone)) {
      return res.status(400).json({ error: 'Invalid timezone' });
    }
    update.timezone = timezone || 'Asia/Kolkata';
  }

  if (connectedWhatsAppPhone !== undefined) {
    // Normalize: strip all non-digit characters except leading +
    let normalized = null;
    if (connectedWhatsAppPhone) {
      const raw = String(connectedWhatsAppPhone);
      // Remove all non-digit characters except leading +
      const withoutFormatting = raw.replace(/[^\d+]/g, '');
      // Remove leading + to get digits only
      const digitsOnly = withoutFormatting.replace(/^\+/, '');
      
      // Length check first to avoid regex backtracking on very long inputs
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        return res.status(400).json({ error: 'Invalid connectedWhatsAppPhone format — must be 10-15 digits' });
      }
      // Validate: digits only
      if (!/^\d+$/.test(digitsOnly)) {
        return res.status(400).json({ error: 'Invalid connectedWhatsAppPhone format — must contain only digits' });
      }
      
      // Store normalized number (digits only, no +)
      normalized = digitsOnly;
    }
    update.connectedWhatsAppPhone = normalized || null;
  }

  if (whitelistedPhones !== undefined) {
    if (!Array.isArray(whitelistedPhones)) {
      return res.status(400).json({ error: 'whitelistedPhones must be an array' });
    }
    // Normalize each phone to digits only
    update.whitelistedPhones = whitelistedPhones
      .map(p => String(p || '').replace(/\D/g, ''))
      .filter(p => p.length >= 10 && p.length <= 15);
  }

  if (blacklistedPhones !== undefined) {
    if (!Array.isArray(blacklistedPhones)) {
      return res.status(400).json({ error: 'blacklistedPhones must be an array' });
    }
    // Normalize each phone to digits only
    update.blacklistedPhones = blacklistedPhones
      .map(p => String(p || '').replace(/\D/g, ''))
      .filter(p => p.length >= 10 && p.length <= 15);
  }

  if (!Object.keys(update).length) {
    return res.status(400).json({ error: 'No valid fields provided to update' });
  }

  try {
    await updateAgencyConfig(tenantId, update);
    logger.info('config.ai-employee.updated', { tenantId, update });
    return res.json({ ok: true, updated: update });
  } catch (err) {
    logger.error('config.ai-employee.patch.failed', { tenantId, error: err.message });
    return res.status(500).json({ error: 'Failed to update AI Employee config' });
  }
});

export default router;
