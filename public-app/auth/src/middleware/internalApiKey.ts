import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { getConfig } from '../config/config';
import { unauthorized, internalError } from '../utils/http';

/**
 * Service-to-service guard for /internal/*: `x-internal-api-key` must equal
 * INTERNAL_API_KEY. Constant-time comparison so response timing leaks
 * nothing about how much of a guessed key matched.
 */
export function requireInternalApiKey(req: Request, res: Response, next: NextFunction): void {
  const expected = getConfig().INTERNAL_API_KEY;
  if (!expected) {
    internalError(res, 'INTERNAL_API_KEY not configured', 'misconfigured');
    return;
  }

  const raw = req.headers['x-internal-api-key'];
  const provided = Array.isArray(raw) ? raw[0] : raw;
  const providedBuf = Buffer.from(String(provided ?? ''), 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    unauthorized(res, 'Invalid internal API key');
    return;
  }
  next();
}
