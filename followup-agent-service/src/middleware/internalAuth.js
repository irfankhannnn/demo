// Authentication for the management API (/api/followup/*).
//
// TRUST BOUNDARY — same model as ai-calling-service/src/middleware/internalAuth.js.
//
// The browser never calls this service. Every request originates from the CRM
// backend, server-to-server, so what is authenticated here is *the CRM backend
// as a service* with a shared secret, not an end user. `x-tenant-id` is trusted
// only because the caller proved it holds CRM_CALLER_API_KEY; the CRM derives
// that header from its own validated session, never from the browser.
//
// Consequence: CRM_CALLER_API_KEY is a tenant-crossing credential. It belongs
// only in the CRM backend's server-side config.

import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';

/** Constant-time compare that tolerates unequal lengths. */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Build an API-key middleware that reads its expected value at request time
 * (Secrets Manager hydration runs after module load). Fails closed when the
 * secret is not configured.
 */
export function requireApiKey(envVar, label) {
  return function authenticate(req, res, next) {
    const expected = process.env[envVar];
    if (!expected) {
      logger.error(`${envVar} is not configured — rejecting request`, null, { path: req.path, label });
      return res.status(503).json({ error: 'Service not configured' });
    }
    if (!safeEqual(req.headers['x-api-key'], expected)) {
      logger.warn('Rejected request with invalid API key', { path: req.path, method: req.method, label });
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };
}

export function extractTenantId(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }
  req.tenantId = String(tenantId);
  next();
}

export const authenticateCrmCaller = [
  requireApiKey('CRM_CALLER_API_KEY', 'crm-caller'),
  extractTenantId,
];
