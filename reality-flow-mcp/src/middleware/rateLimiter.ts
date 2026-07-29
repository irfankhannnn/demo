/**
 * MCP Rate Limiter Middleware
 *
 * Limits MCP requests to 60 per minute per tenant.
 *
 * Note: Uses in-memory Map. In AWS Lambda / multi-instance deployments,
 * each invocation/container has its own isolated Map. Replace with a
 * shared store (Redis, DynamoDB) before productionizing at scale.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 60;

function isRateLimitDisabled(): boolean {
  if (process.env.RATE_LIMIT_DISABLED === 'true') return true;
  if (process.env.RATE_LIMIT_DISABLED === 'false') return false;
  const env = (process.env.NODE_ENV || 'development').toLowerCase();
  return env === 'development' || env === 'dev';
}

function cleanupOldEntries(): void {
  const now = Date.now();
  for (const [tenantId, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(tenantId);
    }
  }
}

function checkRateLimit(tenantId: string) {
  const now = Date.now();

  if (Math.random() < 0.01) {
    cleanupOldEntries();
  }

  let entry = requestCounts.get(tenantId);
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    requestCounts.set(tenantId, entry);
  }

  entry.count += 1;

  const allowed = entry.count <= RATE_LIMIT_MAX;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  const retryAfter = allowed ? null : Math.ceil((entry.resetTime - now) / 1000);

  return { allowed, remaining, resetTime: entry.resetTime, retryAfter };
}

export function mcpRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (isRateLimitDisabled()) {
    next();
    return;
  }

  const tenantId = (req.headers['x-tenant-id'] as string) || 'anonymous';
  const { allowed, remaining, retryAfter } = checkRateLimit(tenantId);

  res.set('X-RateLimit-Limit', RATE_LIMIT_MAX.toString());
  res.set('X-RateLimit-Remaining', remaining.toString());

  if (!allowed) {
    logger.warn('rateLimiter.exceeded', { tenantId, retryAfter });
    res.set('Retry-After', (retryAfter || 60).toString());
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please retry after ${retryAfter} seconds.`,
      retryAfter,
    });
    return;
  }

  next();
}
