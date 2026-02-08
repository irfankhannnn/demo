/**
 * Middleware to extract and validate tenant_id from request headers
 */
export function extractTenantId(req, res, next) {
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
 */
export function extractTenantIdOptional(req, res, next) {
  const tenantId = req.headers['x-tenant-id'];
  req.tenantId = tenantId || null;
  next();
}
