import { logger } from '../logger.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,x-tenant-id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
};

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      res.set(CORS_HEADERS);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userRole = req.user.role;
    if (!allowedRoles.includes(userRole)) {
      logger.warn('rbac.denied', {
        userRole,
        requiredRoles: allowedRoles,
        path: req.originalUrl,
        tenantId: req.tenantId,
      });
      res.set(CORS_HEADERS);
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires role: ${allowedRoles.join(' or ')}`,
      });
    }
    next();
  };
}

export const requireAdmin = requireRole('ADMIN', 'FOUNDER', 'OWNER');
export const requireAdminOrManager = requireRole('ADMIN', 'MANAGER');
