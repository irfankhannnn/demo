import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { countUsersByTenant } from '../models/usersModel';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Internal service-to-service endpoints.
 * Protected by x-internal-api-key header (no Cognito auth).
 */

function requireInternalApiKey(req: Request, res: Response, next: Function) {
  const provided = req.headers['x-internal-api-key'];
  const expected = process.env.INTERNAL_API_KEY || '';

  if (!expected) {
    res.status(500).json({ error: 'INTERNAL_API_KEY not configured' });
    return;
  }

  // HIGH-6 fix: Use timing-safe comparison to prevent timing attacks
  try {
    const providedBuffer = Buffer.from(String(provided || ''));
    const expectedBuffer = Buffer.from(expected);
    
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid internal API key' });
      return;
    }
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid internal API key' });
    return;
  }

  next();
}

/**
 * GET /internal/users/count?tenantId=xxx
 * Returns active user count for a tenant (used by CRM for seat cap enforcement).
 */
router.get('/users/count', requireInternalApiKey, async (req: Request, res: Response) => {
  try {
    const tenantId = req.query.tenantId as string;
    if (!tenantId) {
      res.status(400).json({ error: 'Missing tenantId query parameter' });
      return;
    }

    const count = await countUsersByTenant(tenantId);
    res.json({ count });
  } catch (err) {
    logger.error('internal/users/count error', { error: err });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

