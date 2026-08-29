import { Router, Request, Response, NextFunction } from 'express';
import { getAuthorize, postAuthorize, postToken, postRevoke, postRegister } from '../controllers/oauthController';
import { logger } from '../utils/logger';

const router = Router();

function isRateLimitDisabled(): boolean {
  if (process.env.RATE_LIMIT_DISABLED === 'true') return true;
  if (process.env.RATE_LIMIT_DISABLED === 'false') return false;
  const env = (process.env.NODE_ENV || 'development').toLowerCase();
  return env === 'development' || env === 'dev';
}

/**
 * Rate limiter for the /oauth/token endpoint.
 * Limits to 30 requests per 15 minutes per IP to prevent brute-force
 * attacks on authorization codes and client secrets.
 *
 * IMPORTANT: Uses an in-memory Map. Each Lambda container has its own
 * counter, so this only provides per-container protection. For production
 * at scale, replace with API Gateway throttling or a shared store
 * (DynamoDB/Redis) so the limit is applied across all containers.
 */
const tokenRequestCounts = new Map<string, { count: number; resetTime: number }>();
const TOKEN_RATE_WINDOW = 15 * 60 * 1000; // 15 minutes
const TOKEN_RATE_MAX = 30;
const RATE_LIMIT_CLEANUP_THRESHOLD = 1000; // max entries before forced cleanup

function tokenRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (isRateLimitDisabled()) {
    next();
    return;
  }

  const ip = (req.ip || req.socket.remoteAddress || 'unknown').toString();
  const now = Date.now();

  // Periodic cleanup of expired entries to prevent unbounded memory growth
  if (tokenRequestCounts.size > RATE_LIMIT_CLEANUP_THRESHOLD) {
    for (const [key, value] of tokenRequestCounts) {
      if (now > value.resetTime) tokenRequestCounts.delete(key);
    }
  }

  let entry = tokenRequestCounts.get(ip);
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + TOKEN_RATE_WINDOW };
    tokenRequestCounts.set(ip, entry);
  }

  entry.count += 1;

  if (entry.count > TOKEN_RATE_MAX) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    logger.warn('oauth.token.rate_limited', { ip, retryAfter });
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'too_many_requests',
      error_description: 'Too many token requests. Please retry later.',
    });
    return;
  }

  next();
}

/**
 * Rate limiter for the /oauth/register endpoint.
 * Limits to 5 requests per hour per IP to prevent DynamoDB flooding
 * with bogus dynamic client registrations.
 *
 * IMPORTANT: Same per-container limitation as tokenRateLimiter.
 * For production at scale, replace with API Gateway throttling or a
 * shared store so the limit is applied across all Lambda containers.
 */
const registerRequestCounts = new Map<string, { count: number; resetTime: number }>();
const REGISTER_RATE_WINDOW = 60 * 60 * 1000; // 1 hour
const REGISTER_RATE_MAX = 5;

function registerRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (isRateLimitDisabled()) {
    next();
    return;
  }

  const ip = (req.ip || req.socket.remoteAddress || 'unknown').toString();
  const now = Date.now();

  // Periodic cleanup of expired entries to prevent unbounded memory growth
  if (registerRequestCounts.size > RATE_LIMIT_CLEANUP_THRESHOLD) {
    for (const [key, value] of registerRequestCounts) {
      if (now > value.resetTime) registerRequestCounts.delete(key);
    }
  }

  let entry = registerRequestCounts.get(ip);
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + REGISTER_RATE_WINDOW };
    registerRequestCounts.set(ip, entry);
  }

  entry.count += 1;

  if (entry.count > REGISTER_RATE_MAX) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    logger.warn('oauth.register.rate_limited', { ip, retryAfter });
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'too_many_requests',
      error_description: 'Too many registration requests. Please retry later.',
    });
    return;
  }

  next();
}

// GET /oauth/authorize — Authorization page
router.get('/authorize', getAuthorize);

// POST /oauth/authorize — Process approval/denial
router.post('/authorize', postAuthorize);

// POST /oauth/token — Token exchange (authorization code → access token)
router.post('/token', tokenRateLimiter, postToken);

// POST /oauth/revoke — Revoke an access token
router.post('/revoke', postRevoke);

// POST /oauth/register — Dynamic Client Registration (RFC 7591)
// No auth required — clients self-register, then authenticate via PKCE
router.post('/register', registerRateLimiter, postRegister);

export default router;
