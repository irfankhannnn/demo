/**
 * Service-to-service auth for /api/internal/* routers.
 *
 * Lifted from routes/publicPagesInternal.js so every internal router shares
 * one implementation of the constant-time key check and the tenant header
 * rule. Each router still has its OWN key (env var name passed in): a
 * compromise of one edge service must not grant another's access.
 */

import crypto from 'crypto';
import { logger } from '../logger.js';

/**
 * Constant-time comparison over digests, so unequal-length keys don't throw
 * and response timing doesn't leak key material byte by byte.
 */
export function safeKeyEquals(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const ah = crypto.createHash('sha256').update(provided).digest();
  const bh = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(ah, bh);
}

/**
 * Router-level guard. `envVar` names the env var holding the expected key;
 * `label` is used in log events.
 */
export function requireInternalApiKey(envVar, label = 'internal') {
  return (req, res, next) => {
    const expectedKey = process.env[envVar];
    if (!expectedKey) {
      logger.error(`${label}.not_configured`, { envVar });
      return res.status(500).json({ error: 'Internal API not configured' });
    }
    if (!safeKeyEquals(req.headers['x-api-key'], expectedKey)) {
      logger.warn(`${label}.unauthorized`, { path: req.path });
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  };
}

/** Tenant comes from the header on routes that act on one tenant's data. */
export function requireTenant(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId || typeof tenantId !== 'string') {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }
  req.tenantId = tenantId;
  return next();
}
