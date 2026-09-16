import express from 'express';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireAdmin } from '../middleware/requireRole.js';
import { getProvisioningByTenant } from '../aiEmployeeProvisioningService.js';
import { invokeAgent } from '../agents/agentRuntime.js';
import { logger } from '../logger.js';

const router = express.Router();

// GET /api/ai-employee/status — returns provisioning row for current tenant
router.get('/status', validateToken, extractTenantId, async (req, res) => {
  try {
    const row = await getProvisioningByTenant(req.tenantId);
    if (!row) {
      return res.status(404).json({ error: 'not_found', message: 'AI Employee is not active on your plan.' });
    }

    res.json({
      tenantId: row.tenantId,
      status: row.status,
      expectedSLAEnd: row.expectedSLAEnd,
      loomUrl: row.loomUrl || null,
      liveAt: row.liveAt || null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      contactPhone: row.contactPhone ? `****${row.contactPhone.slice(-4)}` : null,
      monthlyCost: 7999,
    });
  } catch (err) {
    logger.error('ai-employee.status.error', { tenantId: req.tenantId, error: err.message });
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/ai-employee/test-message — sends a test prompt to the AI Employee (admin only)
router.post('/test-message', validateToken, extractTenantId, requireAdmin, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const result = await invokeAgent(tenantId, 'whatsapp', 'Hello, this is a test message. Please reply with a short greeting and confirm you are working.', { source: 'test', userId: req.user?.userId });

    if (!result.ok) {
      logger.warn('ai-employee.test_message.failed', { tenantId, error: result.error });
      return res.status(400).json({ ok: false, error: result.error });
    }

    logger.info('ai-employee.test_message.success', { tenantId });
    return res.json({
      ok: true,
      text: result.result?.text || 'AI is working.',
      durationMs: result.result?.durationMs,
    });
  } catch (err) {
    logger.error('ai-employee.test_message.error', { tenantId: req.tenantId, error: err.message });
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
