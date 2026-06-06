import express from 'express';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { getProvisioningByTenant } from '../aiEmployeeProvisioningService.js';

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
    });
  } catch (err) {
    console.error('AI Employee status error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
