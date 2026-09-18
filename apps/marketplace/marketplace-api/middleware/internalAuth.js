/**
 * Service-to-service auth for /internal/*.
 *
 * Two callers, two keys: the CRM (agency inbox proxies, tenant close-out)
 * presents CRM_CALLER_API_KEY; marketplace-authentication (account deletion)
 * presents AUTH_CALLER_API_KEY. Either is accepted on every internal route,
 * so revoking one caller is a single env change with no route surgery.
 *
 * Same constant-time digest comparison as apps/crm/server/middleware/
 * internalApiKey.js: hashing both sides first means unequal lengths cannot
 * throw and response timing cannot leak the key byte by byte. `req.caller`
 * records which key matched, for logs only — routes never branch on it.
 */

import crypto from 'crypto';
import { config } from '../config/env.js';
import { logger } from '../logger.js';

export function safeKeyEquals(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !expected) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Which configured caller presented this key, or null. Always checks both keys — no short-circuit. */
export function matchCaller(provided, keys = config.callerKeys) {
  const crm = safeKeyEquals(provided, keys.crm);
  const auth = safeKeyEquals(provided, keys.auth);
  if (crm) return 'crm';
  if (auth) return 'auth';
  return null;
}

export function internalAuth(req, res, next) {
  if (!config.callerKeys.crm && !config.callerKeys.auth) {
    logger.error('internalAuth.not_configured', {});
    return res.status(500).json({ error: 'Internal API not configured' });
  }
  const caller = matchCaller(req.headers['x-api-key']);
  if (!caller) {
    logger.warn('internalAuth.unauthorized', { path: req.path });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.caller = caller;
  return next();
}

/** Tenant comes from the header on routes that act on one agency's threads. */
export function requireTenantHeader(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId || typeof tenantId !== 'string') {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }
  req.tenantId = tenantId;
  return next();
}
