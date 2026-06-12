import { Request, Response, NextFunction } from 'express';
import { extractClaims } from '../utils/cognito';

/**
 * Global authentication middleware.
 * Requires valid Cognito claims in the request context.
 * Should be applied to all protected routes.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    extractClaims(req);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized', message: 'Valid Cognito token required' });
  }
}
