const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,x-tenant-id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
};

/**
 * Middleware to extract and validate tenant_id
 * Priority: server-derived tenantId from validateToken > x-tenant-id header
 * This prevents client header spoofing when validateToken is used.
 */
export function extractTenantId(req, res, next) {
  // Only accept server-derived tenantId set by validateToken middleware.
  // NEVER trust the client-provided x-tenant-id header.
  if (req.tenantId) {
    return next();
  }

  res.set(CORS_HEADERS);
  return res.status(400).json({
    error: 'Tenant ID is required. Authentication middleware must run before tenant extraction.',
  });
}

/**
 * Optional tenant extraction (for public endpoints)
 * Priority: server-derived tenantId from validateToken > x-tenant-id header
 */
export function extractTenantIdOptional(req, res, next) {
  // If validateToken already set tenantId, use it
  if (!req.tenantId) {
    const tenantId = req.headers['x-tenant-id'];
    req.tenantId = tenantId || null;
  }
  next();
}
