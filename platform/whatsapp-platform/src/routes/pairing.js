import { Router } from 'express';
import { createSession, getSessionStatus, disconnectSession, listSessions } from '../baileysClient.js';
import { logger } from '../logger.js';
import { safeError } from './utils.js';
import { verifyAdminKey } from '../middleware/apiKeyAuth.js';
import { pairingRateLimit } from '../middleware/pairingRateLimit.js';

const router = Router();

router.post('*', ...pairingRateLimit);

// POST /v1/pairing/qr  — start pairing (returns QR code)
// Body: { phone, forceNew? }
router.post('/qr', async (req, res) => {
  try {
    const { phone, forceNew } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    if (forceNew === true) {
      if (!verifyAdminKey(req, 'qr.forceNew')) {
        return res.status(403).json({ error: 'Admin API key required for forceNew' });
      }
      logger.info({ phone, ip: req.ip }, 'pairing.qr.forceNew.audit');
      await disconnectSession(phone, true);
    }

    const result = await createSession(phone);
    return res.json({ enabled: true, ...result });
  } catch (err) {
    logger.error({ error: err.message }, 'pairing.qr.error');
    return res.status(400).json({ error: safeError(err, 'failed_to_get_qr') });
  }
});

// GET /v1/pairing/status/:phone  — session status
router.get('/status/:phone', (req, res) => {
  try {
    const status = getSessionStatus(req.params.phone);
    return res.json({ phone: req.params.phone, ...status });
  } catch (err) {
    return res.status(400).json({ error: safeError(err, 'failed_to_get_status') });
  }
});

// GET /v1/sessions/:tenantId  — ECS API alias
router.get('/sessions/:tenantId', (req, res) => {
  const status = getSessionStatus(req.params.tenantId);
  return res.json({ tenantId: req.params.tenantId, ...status });
});

// GET /v1/pairing/sessions  — list all sessions
router.get('/sessions', (_req, res) => {
  return res.json({ sessions: listSessions() });
});

// POST /v1/pairing/logout
// Body: { phone, deleteAuthState? }
router.post('/logout', async (req, res) => {
  try {
    const { phone, deleteAuthState } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    if (deleteAuthState === true) {
      if (!verifyAdminKey(req, 'logout.deleteAuthState')) {
        return res.status(403).json({ error: 'Admin API key required for deleteAuthState' });
      }
      logger.info({ phone, ip: req.ip }, 'pairing.logout.deleteAuthState.audit');
    }

    const ok = await disconnectSession(phone, deleteAuthState === true);
    return res.json({ ok, authStateDeleted: deleteAuthState === true });
  } catch (err) {
    logger.error({ error: err.message }, 'pairing.logout.error');
    return res.status(400).json({ error: safeError(err, 'failed_to_logout') });
  }
});

// DELETE /v1/sessions/:tenantId  — ECS API alias
router.delete('/sessions/:tenantId', async (req, res) => {
  try {
    const ok = await disconnectSession(req.params.tenantId, false);
    return res.json({ ok });
  } catch (err) {
    return res.status(400).json({ error: safeError(err, 'failed_to_disconnect') });
  }
});

export default router;
