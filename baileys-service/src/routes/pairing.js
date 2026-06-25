import { Router } from 'express';
import { createSession, getSessionStatus, disconnectSession, listSessions } from '../baileysClient.js';
import { logger } from '../logger.js';
import { safeError } from './utils.js';
import { apiKeyAuth, verifyAdminKey } from '../middleware/apiKeyAuth.js';
import { pairingRateLimit } from '../middleware/pairingRateLimit.js';

const router = Router();

// Apply API key authentication to all pairing routes
router.use(apiKeyAuth);

// Apply rate limiting to POST endpoints (both per-phone+IP and per-phone-global)
router.post('*', ...pairingRateLimit);

router.post('/qr', async (req, res) => {
  try {
    const { phone, forceNew } = req.body || {};
    if (!phone) {
      return res.status(400).json({ error: 'phone is required' });
    }

    // If forceNew is true, disconnect and delete auth state for a clean re-link.
    // This is a destructive operation — require admin API key + audit log.
    if (forceNew === true) {
      if (!verifyAdminKey(req, 'qr.forceNew')) {
        return res.status(403).json({ error: 'Forbidden: Admin API key required for forceNew operation' });
      }

      logger.info(
        { phone, ip: req.ip, action: 'forceNew_disconnect' },
        'pairing.qr.forceNew.audit'
      );
      await disconnectSession(phone, true);
    }

    const result = await createSession(phone);
    return res.json({ enabled: true, ...result });
  } catch (err) {
    logger.error('pairing.qr.error', { error: err.message });
    return res.status(400).json({ error: safeError(err, 'failed_to_get_qr') });
  }
});

router.get('/status/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const status = getSessionStatus(phone);
    return res.json({ phone, ...status });
  } catch (err) {
    logger.error('pairing.status.error', { error: err.message });
    return res.status(400).json({ error: safeError(err, 'failed_to_get_status') });
  }
});

router.get('/sessions', (_req, res) => {
  return res.json({ sessions: listSessions() });
});

router.post('/logout', async (req, res) => {
  try {
    const { phone, deleteAuthState } = req.body || {};
    if (!phone) {
      return res.status(400).json({ error: 'phone is required' });
    }

    // deleteAuthState is a destructive operation — require admin API key + audit log.
    if (deleteAuthState === true) {
      if (!verifyAdminKey(req, 'logout.deleteAuthState')) {
        return res.status(403).json({ error: 'Forbidden: Admin API key required for deleteAuthState operation' });
      }

      logger.info(
        { phone, ip: req.ip, action: 'deleteAuthState' },
        'pairing.logout.deleteAuthState.audit'
      );
    }

    const ok = await disconnectSession(phone, deleteAuthState === true);
    return res.json({ ok, authStateDeleted: deleteAuthState === true });
  } catch (err) {
    logger.error('pairing.logout.error', { error: err.message });
    return res.status(400).json({ error: safeError(err, 'failed_to_logout') });
  }
});

export default router;
