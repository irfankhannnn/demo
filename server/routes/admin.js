import express from 'express';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireAdmin } from '../middleware/requireRole.js';
import { getTeamAnalytics } from '../teamAnalyticsService.js';
import { buildTeamAnalyticsWorkbook } from '../utils/excel.js';
import { getAgentActivity } from '../agentAuditService.js';
import { logger } from '../logger.js';

const router = express.Router();

router.use(validateToken, extractTenantId, requireAdmin);

// GET /api/admin/team-analytics
router.get('/team-analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const result = await getTeamAnalytics(req.tenantId, {
      startDate,
      endDate,
      authHeader: req.headers.authorization,
    });
    res.json(result);
  } catch (err) {
    logger.error('admin.teamAnalytics.error', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/admin/team-analytics/export
router.get('/team-analytics/export', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { items } = await getTeamAnalytics(req.tenantId, {
      startDate,
      endDate,
      authHeader: req.headers.authorization,
    });
    const buffer = buildTeamAnalyticsWorkbook(items);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="team-analytics-${date}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    logger.error('admin.teamAnalytics.export.error', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/admin/agent-activity
router.get('/agent-activity', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const items = await getAgentActivity(req.tenantId, { limit });
    res.json({ items });
  } catch (err) {
    logger.error('admin.agentActivity.error', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
