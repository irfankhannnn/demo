/**
 * Middleware to extract and validate tenant_id
 * Priority: server-derived tenantId from validateToken > x-tenant-id header
 * This prevents client header spoofing when validateToken is used.
 */
export function extractTenantId(req, res, next) {
  // If validateToken already set tenantId (server-derived from /auth/me), use it
  if (req.tenantId) {
    return next();
  }
  
  // Otherwise fall back to header (for backwards compatibility or non-auth endpoints)
  const tenantId = req.headers['x-tenant-id'];
  
  if (!tenantId) {
    return res.status(400).json({ 
      error: 'Tenant ID is required. Please include x-tenant-id header.' 
    });
  }
  
  // Store tenant_id in request object
  req.tenantId = tenantId;
  next();
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
