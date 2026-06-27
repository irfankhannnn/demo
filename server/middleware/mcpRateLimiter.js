/**
 * MCP Rate Limiter Middleware
 * 
 * Limits MCP requests to 60 per minute per tenant
 * Uses in-memory store (suitable for single-instance deployment)
 * For distributed deployments, use Redis
 */

import { logger } from '../logger.js';

// In-memory store: { tenantId: { count, resetTime } }
const requestCounts = new Map();

// Configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute

/**
 * Reset old entries to prevent memory leak
 */
function cleanupOldEntries() {
  const now = Date.now();
  for (const [tenantId, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(tenantId);
    }
  }
}

/**
 * Check if request is within rate limit
 * @param {string} tenantId - Tenant ID
 * @returns {Object} { allowed: boolean, remaining: number, resetTime: number }
 */
function checkRateLimit(tenantId) {
  const now = Date.now();

  // Cleanup old entries periodically
  if (Math.random() < 0.01) {
    cleanupOldEntries();
  }

  // Get or create entry
  let entry = requestCounts.get(tenantId);
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW,
    };
    requestCounts.set(tenantId, entry);
  }

  // Increment count
  entry.count += 1;

  // Check limit
  const allowed = entry.count <= RATE_LIMIT_MAX;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  const resetTime = entry.resetTime;

  return {
    allowed,
    remaining,
    resetTime,
    retryAfter: allowed ? null : Math.ceil((resetTime - now) / 1000),
  };
}

/**
 * MCP Rate Limiter Middleware
 */
export function mcpRateLimiter(req, res, next) {
  const tenantId = req.headers['x-tenant-id'] || 'anonymous';

  const { allowed, remaining, retryAfter } = checkRateLimit(tenantId);

  // Set rate limit headers
  res.set('X-RateLimit-Limit', RATE_LIMIT_MAX.toString());
  res.set('X-RateLimit-Remaining', remaining.toString());

  if (!allowed) {
    logger.warn('mcp.rate_limit.exceeded', {
      tenantId,
      retryAfter,
    });

    res.set('Retry-After', retryAfter.toString());
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please retry after ${retryAfter} seconds.`,
      retryAfter,
    });
  }

  next();
}

/**
 * Reset rate limit for a tenant (admin only)
 * @param {string} tenantId - Tenant ID
 */
export function resetRateLimit(tenantId) {
  requestCounts.delete(tenantId);
  logger.info('mcp.rate_limit.reset', { tenantId });
}

/**
 * Get rate limit status for a tenant
 * @param {string} tenantId - Tenant ID
 * @returns {Object} Rate limit status
 */
export function getRateLimitStatus(tenantId) {
  const entry = requestCounts.get(tenantId);
  if (!entry) {
    return {
      count: 0,
      remaining: RATE_LIMIT_MAX,
      resetTime: Date.now() + RATE_LIMIT_WINDOW,
    };
  }

  const now = Date.now();
  if (now > entry.resetTime) {
    requestCounts.delete(tenantId);
    return {
      count: 0,
      remaining: RATE_LIMIT_MAX,
      resetTime: now + RATE_LIMIT_WINDOW,
    };
  }

  return {
    count: entry.count,
    remaining: Math.max(0, RATE_LIMIT_MAX - entry.count),
    resetTime: entry.resetTime,
  };
}
