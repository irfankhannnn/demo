import crypto from 'crypto';
import { BAILEYS_API_KEY, BAILEYS_ADMIN_API_KEY, NODE_ENV } from '../config.js';
import { logger } from '../logger.js';

/**
 * Timing-safe string comparison.
 */
export function safeEqual(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Express middleware — validates API key.
 * Checks Authorization: Bearer <key> or x-api-key header.
 * Also accepts x-internal-api-key for ECS/ALB compatibility.
 */
export function apiKeyAuth(req, res, next) {
  if (!BAILEYS_API_KEY) {
    if (NODE_ENV === 'production') {
      logger.error({ path: req.path }, 'apiKeyAuth.misconfigured');
      return res.status(500).json({ error: 'Server misconfigured: API key not set' });
    }
    logger.warn({ path: req.path }, 'apiKeyAuth.dev_no_key');
    return next();
  }

  const authHeader = req.get('Authorization');
  let provided =
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
    req.get('x-api-key') ||
    req.get('x-internal-api-key') ||
    null;

  if (!provided || !safeEqual(provided, BAILEYS_API_KEY)) {
    logger.warn({ path: req.path, method: req.method, ip: req.ip }, 'apiKeyAuth.unauthorized');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

/**
 * Verify admin API key for destructive operations.
 */
export function verifyAdminKey(req, operation) {
  if (!BAILEYS_ADMIN_API_KEY) {
    logger.error({ path: req.path, operation }, 'verifyAdminKey.misconfigured');
    return false;
  }
  const provided = req.get('x-admin-api-key');
  if (!provided || !safeEqual(provided, BAILEYS_ADMIN_API_KEY)) {
    logger.warn({ path: req.path, ip: req.ip, operation }, 'verifyAdminKey.unauthorized');
    return false;
  }
  return true;
}
