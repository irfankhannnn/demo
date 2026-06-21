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

// GET /api/crm/config/ai-employee
router.get('/ai-employee', validateToken, extractTenantId, requireAdmin, async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const config = await getAgencyConfig(tenantId);
    return res.json({
      aiEmployeeEnabled: config?.aiEmployeeEnabled || false,
      followupAgentMode: config?.followupAgentMode || 'draft',
      followupAgentAutoSendChannels: config?.followupAgentAutoSendChannels || ['whatsapp'],
    });
  } catch (err) {
    logger.error('config.ai-employee.get.failed', { tenantId, error: err.message });
    return res.status(500).json({ error: 'Failed to fetch AI Employee config' });
  }
});

// PATCH /api/crm/config/ai-employee
router.patch('/ai-employee', validateToken, extractTenantId, requireAdmin, async (req, res) => {
  const tenantId = req.tenantId;
  const { aiEmployeeEnabled, followupAgentMode, followupAgentAutoSendChannels } = req.body || {};

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
