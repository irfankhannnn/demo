import { logger } from '../logger.js';

/**
 * Restricts access to platform operators (not tenant admins).
 *
 * Authorization (any one match):
 * 1. req.user.role === 'PLATFORM_OPERATOR' (or 'SUPER_ADMIN')
 * 2. userId / email in PLATFORM_OPERATOR_USER_IDS / PLATFORM_OPERATOR_EMAILS
 *
 * Env (comma-separated):
 *   PLATFORM_OPERATOR_USER_IDS
 *   PLATFORM_OPERATOR_EMAILS
 */
function parseList(envValue) {
  return (envValue || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function requirePlatformOperator(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const role = String(req.user.role || '').toUpperCase();
  if (role === 'PLATFORM_OPERATOR' || role === 'SUPER_ADMIN') {
    return next();
  }

  const allowedIds = new Set(parseList(process.env.PLATFORM_OPERATOR_USER_IDS));
  const allowedEmails = new Set(parseList(process.env.PLATFORM_OPERATOR_EMAILS));

  const userId = String(req.user.userId || req.user.sub || '').toLowerCase();
  const email = String(req.user.email || '').toLowerCase();

  if ((userId && allowedIds.has(userId)) || (email && allowedEmails.has(email))) {
    return next();
  }

  logger.warn('rbac.platform_operator.denied', {
    userId: req.user.userId,
    email: req.user.email,
    role: req.user.role,
    path: req.originalUrl,
  });

  return res.status(403).json({
    error: 'Forbidden',
    message: 'Requires platform operator access',
  });
}
