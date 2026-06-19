import express from 'express';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireAdmin } from '../middleware/requireRole.js';
import { getFullConfig, updateConfig, clearConfigCache } from '../creditConfig.js';
import { logger } from '../logger.js';

const router = express.Router();

router.use(validateToken, extractTenantId, requireAdmin);

// GET /api/credit-config — current config
router.get('/', async (req, res) => {
  try {
    const config = await getFullConfig();
    res.json(config);
  } catch (err) {
    logger.error('creditAdmin.get.error', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

// PUT /api/credit-config/costs
router.put('/costs', async (req, res) => {
  try {
    const costs = req.body;
    if (!costs || typeof costs !== 'object') {
      return res.status(400).json({ error: 'Invalid costs object' });
    }
    for (const [key, val] of Object.entries(costs)) {
      if (typeof val !== 'number' || val < 0) {
        return res.status(400).json({ error: `Invalid cost for ${key}` });
      }
    }
    await updateConfig('COSTS', costs);
    res.json({ success: true, costs });
  } catch (err) {
    logger.error('creditAdmin.costs.error', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

// PUT /api/credit-config/packs
router.put('/packs', async (req, res) => {
  try {
    const packs = req.body;
    if (!packs || typeof packs !== 'object') {
      return res.status(400).json({ error: 'Invalid packs object' });
    }
    await updateConfig('PACKS', packs);
    res.json({ success: true, packs });
  } catch (err) {
    logger.error('creditAdmin.packs.error', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

// PUT /api/credit-config/free-tier
router.put('/free-tier', async (req, res) => {
  try {
    const { monthlyFreeCredits } = req.body;
    if (typeof monthlyFreeCredits !== 'number' || monthlyFreeCredits < 0) {
      return res.status(400).json({ error: 'monthlyFreeCredits must be >= 0' });
    }
    await updateConfig('FREE_TIER', { monthlyFreeCredits });
    res.json({ success: true, freeTier: { monthlyFreeCredits } });
  } catch (err) {
    logger.error('creditAdmin.freeTier.error', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
