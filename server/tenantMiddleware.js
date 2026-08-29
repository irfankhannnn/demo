import { applyExpressCorsHeaders } from './utils/corsOrigins.js';

/**
 * Middleware to extract and validate tenant_id.
 * Priority: server-derived tenantId from validateToken / apiKeyAuth only.
 * NEVER trust the client-provided x-tenant-id header for authenticated routes.
 */
export function extractTenantId(req, res, next) {
  if (req.tenantId) {
    return next();
  }

  applyExpressCorsHeaders(req, res);
  return res.status(400).json({
    error: 'Tenant ID is required. Authentication middleware must run before tenant extraction.',
  });
}

/**
 * Optional tenant extraction for public endpoints that already resolved tenant
 * via apiKeyAuth (or another trusted middleware). Does NOT accept client
 * x-tenant-id — that header is never a source of truth.
 */
export function extractTenantIdOptional(req, res, next) {
  if (!req.tenantId) {
    req.tenantId = null;
  }
  next();
}
