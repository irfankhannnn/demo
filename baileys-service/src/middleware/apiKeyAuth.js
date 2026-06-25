import { BAILEYS_API_KEY, BAILEYS_ADMIN_API_KEY, NODE_ENV } from '../config.js';
import { logger } from '../logger.js';
import crypto from 'crypto';

/**
 * Constant-time string comparison to prevent timing attacks on the API key.
 * Returns true if both strings are equal and non-empty.
 * Exported so other modules can reuse the same comparison logic.
 */
export function safeEqual(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Middleware to verify API key authentication.
 * Checks for API key in:
 * 1. Authorization header: "Bearer <key>"
 * 2. x-api-key header
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function apiKeyAuth(req, res, next) {
  // In development, allow requests through with a warning if key is not set
  if (!BAILEYS_API_KEY || BAILEYS_API_KEY === '') {
    if (NODE_ENV === 'production') {
      logger.error(
        { path: req.path, method: req.method },
        'apiKeyAuth.misconfigured'
      );
      return res.status(500).json({ error: 'Server misconfigured: BAILEYS_API_KEY is not set' });
    }
    // Development: log warning and allow through
    logger.warn({ path: req.path, method: req.method }, 'apiKeyAuth.dev_no_key');
    return next();
  }

  // Extract API key from headers
  let providedKey = null;

  // Check Authorization: Bearer <key>
  const authHeader = req.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.slice(7); // Remove "Bearer " prefix
  }

  // Check x-api-key header
  if (!providedKey) {
    providedKey = req.get('x-api-key');
  }

  // Validate API key (timing-safe comparison)
  if (!providedKey || !safeEqual(providedKey, BAILEYS_API_KEY)) {
    logger.warn(
      {
        path: req.path,
        method: req.method,
        ip: req.ip,
        hasApiKey: !!providedKey,
      },
      'apiKeyAuth.unauthorized'
    );
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
  }

  // API key is valid, proceed
  next();
}

/**
 * Verify an admin API key from the x-admin-api-key header.
 * Used by route handlers for destructive operations (forceNew, deleteAuthState).
 * This provides defense-in-depth: even if the regular API key leaks,
 * destructive operations still require this separate key.
 *
 * @param {import('express').Request} req
 * @param {string} operation - name of the operation for logging
 * @returns {boolean} true if the admin key is valid
 */
export function verifyAdminKey(req, operation) {
  if (!BAILEYS_ADMIN_API_KEY || BAILEYS_ADMIN_API_KEY === '') {
    logger.error(
      { path: req.path, method: req.method, operation },
      'verifyAdminKey.misconfigured'
    );
    return false;
  }

  const providedAdminKey = req.get('x-admin-api-key');

  if (!providedAdminKey || !safeEqual(providedAdminKey, BAILEYS_ADMIN_API_KEY)) {
    logger.warn(
      {
        path: req.path,
        method: req.method,
        ip: req.ip,
        hasAdminKey: !!providedAdminKey,
        operation,
      },
      'verifyAdminKey.unauthorized'
    );
    return false;
  }

  return true;
}
