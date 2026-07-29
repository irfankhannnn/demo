import { logger } from '../logger.js';

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
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
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires role: ${allowedRoles.join(' or ')}`,
      });
    }
    next();
  };
}

export const requireAdmin = requireRole('ADMIN', 'FOUNDER', 'OWNER');
export const requireAdminOrManager = requireRole('ADMIN', 'MANAGER', 'FOUNDER', 'OWNER');
/** Any authenticated CRM user (members can create/read/update leads). */
export const requireCrmMemberOrAbove = requireRole('ADMIN', 'MANAGER', 'FOUNDER', 'OWNER', 'MEMBER');
