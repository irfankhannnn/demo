// Authentication for the service's management API (/api/ai-calling/calls,
// /config, /knowledge).
//
// TRUST BOUNDARY — read before changing anything here.
//
// The browser never calls this service directly; see server/DISABLED_FEATURES.md.
// Every request on these routes originates from the CRM backend, server-to-server.
// So what we authenticate here is *the CRM backend as a service*, using a shared
// secret, not an end user.
//
// That means `x-tenant-id` is trusted ONLY because the caller proved it holds
// CRM_CALLER_API_KEY. The CRM backend is responsible for deriving that header
// from its own validated session (validateToken + extractTenantId +
// requireCrmMemberOrAbove) and never from anything the browser supplies. An
// unauthenticated caller cannot reach these handlers at all, so it cannot
// choose a tenant.
//
// Consequence: CRM_CALLER_API_KEY is a tenant-crossing credential. Anything
// holding it can act for any tenant. It belongs only in the CRM backend's
// server-side config — never in a browser bundle, a mobile app, or a webhook
// registration.
//
// Deliberately a different secret from CRM_INTERNAL_API_KEY (which this service
// presents when calling *into* the CRM). Same reasoning the CRM template gives
// for keeping AiCallingInternalApiKey and the lead-adapter key separate: one
// service's compromise must not grant the other direction's access.

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
 * Build an API-key middleware that reads its expected value at request time.
 *
 * Read at request time, not module load, because secretsBootstrap hydrates
 * process.env from Secrets Manager during the Lambda cold start — a value
 * captured at import would always be undefined.
 *
 * Fails closed: with no secret configured every request is rejected rather
 * than served unauthenticated.
 */
export function requireApiKey(envVar, label) {
  return function authenticate(req, res, next) {
    const expected = process.env[envVar];
    if (!expected) {
      logger.error(`${envVar} is not configured — rejecting request`, null, {
        path: req.path,
        label,
      });
      return res.status(503).json({ error: 'Service not configured' });
    }

    if (!safeEqual(req.headers['x-api-key'], expected)) {
      logger.warn('Rejected request with invalid API key', {
        path: req.path,
        method: req.method,
        label,
      });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
  };
}

/**
 * Establish tenant scope from the header.
 *
 * Only ever mounted behind requireApiKey — see the trust boundary note above.
 */
export function extractTenantId(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }
  req.tenantId = tenantId;
  next();
}

/**
 * Authenticate the CRM backend, then scope the request to its tenant.
 * Mount on every management route.
 */
export const authenticateCrmCaller = [
  requireApiKey('CRM_CALLER_API_KEY', 'crm-caller'),
  extractTenantId,
];
