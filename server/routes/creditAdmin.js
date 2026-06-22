import express from 'express';
import validateToken from '../middleware/validateToken.js';
import { extractTenantId } from '../tenantMiddleware.js';
import { requireAdmin } from '../middleware/requireRole.js';
import { getFullConfig, updateConfig, clearConfigCache, DEFAULTS } from '../creditConfig.js';
import { logger } from '../logger.js';

const router = express.Router();

router.use(validateToken, extractTenantId, requireAdmin);

const VALID_COST_KEYS = Object.keys(DEFAULTS.COSTS);
const MAX_COST_VALUE = 1000; // No single action should cost more than 1000 credits
const MIN_COST_VALUE = 0;
const CRITICAL_COST_KEYS = ['lead_add', 'contact_add', 'property_add', 'owner_add', 'tenant_add']; // These must be > 0

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
      if (!VALID_COST_KEYS.includes(key)) {
        return res.status(400).json({
          error: `Invalid action type: ${key}`,
          validKeys: VALID_COST_KEYS,
        });
      }
      if (typeof val !== 'number' || val < MIN_COST_VALUE) {
        return res.status(400).json({ error: `Invalid cost for ${key}: must be non-negative number` });
      }
      if (val > MAX_COST_VALUE) {
        return res.status(400).json({
          error: `Cost for ${key} exceeds maximum (${MAX_COST_VALUE})`,
          max: MAX_COST_VALUE,
        });
      }
      if (CRITICAL_COST_KEYS.includes(key) && val === 0) {
        return res.status(400).json({
          error: `${key} cannot be 0 (critical action)`,
        });
      }
    }

    // Log the config change for audit trail
    logger.info('creditConfig.costs.updated', {
      updatedBy: req.user?.userId || 'unknown',
      changes: costs,
      timestamp: new Date().toISOString(),
    });

    await updateConfig('COSTS', costs, req.user?.userId || 'unknown');
    await clearConfigCache();
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

    // Log the config change for audit trail
    logger.info('creditConfig.packs.updated', {
      updatedBy: req.user?.userId || 'unknown',
      changes: Object.keys(packs),
      timestamp: new Date().toISOString(),
    });

    await updateConfig('PACKS', packs, req.user?.userId || 'unknown');
    await clearConfigCache();
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

    // Log the config change for audit trail
    logger.info('creditConfig.freeTier.updated', {
      updatedBy: req.user?.userId || 'unknown',
      monthlyFreeCredits,
      timestamp: new Date().toISOString(),
    });

    await updateConfig('FREE_TIER', { monthlyFreeCredits }, req.user?.userId || 'unknown');
    await clearConfigCache();
    res.json({ success: true, freeTier: { monthlyFreeCredits } });
  } catch (err) {
    logger.error('creditAdmin.freeTier.error', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
