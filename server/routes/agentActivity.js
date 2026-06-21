/**
 * Agent Activity Route — GET /api/crm/agents/activity
 * Mounted at /api/crm/agents  (see server.js)
 * Exposes agent audit log to authenticated CRM users (admin or member).
 */
import express from 'express';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { getAgentActivity } from '../agents/agentAuditService.js';
import { logger } from '../logger.js';

const router = express.Router();

router.use(validateToken, extractTenantId);

// GET /api/crm/agents/activity?limit=20&agentId=qualifier
router.get('/activity', async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const agentId = req.query.agentId || undefined;
    const items = await getAgentActivity(tenantId, { limit, agentId });
    return res.json({ activities: items });
  } catch (err) {
    logger.error('agents.activity.get.failed', { tenantId, error: err.message });
    return res.status(500).json({ error: 'Failed to fetch agent activity' });
  }
});

export default router;
