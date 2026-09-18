/**
 * Express wrappers around services/abuseGuard.js.
 *
 * Each middleware maps one guard check onto a 429 with a Retry-After and
 * the standard error shape. Which check fails open and which fails closed
 * is decided in abuseGuard, next to the reasoning; nothing here overrides
 * it.
 */

import { getClientIp, checkPublicRead, checkAiSearch, checkBuyerWrite } from '../services/abuseGuard.js';
import { logger } from '../logger.js';

function reject(res, result) {
  res.set('Retry-After', String(result.retryAfter || 30));
  return res.status(429).json({
    error: 'Too many requests',
    details: result.degraded ? 'guard_unavailable' : (result.scope || 'rate_limited'),
  });
}

/** Anonymous read throttle. Fails open. */
export async function publicReadGuard(req, res, next) {
  try {
    const result = await checkPublicRead(getClientIp(req));
    if (!result.allowed) return reject(res, result);
    return next();
  } catch (err) {
    return next(err);
  }
}

/** AI search: per user when logged in, per IP otherwise. Run after authOptional. */
export async function aiSearchGuard(req, res, next) {
  try {
    const result = await checkAiSearch({ ip: getClientIp(req), userId: req.user?.userId || null });
    if (!result.allowed) {
      logger.info('rateLimit.ai_search', { scope: result.scope, userId: req.user?.userId || null });
      return reject(res, result);
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Buyer-initiated writes. Run after authRequired. Fails closed. */
export async function buyerWriteGuard(req, res, next) {
  try {
    const result = await checkBuyerWrite(req.user.userId);
    if (!result.allowed) {
      logger.info('rateLimit.buyer_write', { scope: result.scope, userId: req.user.userId });
      return reject(res, result);
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

export { reject as rateLimitReject };
