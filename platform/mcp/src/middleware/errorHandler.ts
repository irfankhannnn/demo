/**
 * Error Handler Middleware
 *
 * Centralized error handling for the MCP microservice.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error('unhandled_error', { error: err.message, stack: err.stack });

  const isProd = process.env.NODE_ENV === 'production' || process.env.ENV === 'prod';
  res.status(500).json({
    error: 'Internal Server Error',
    message: isProd ? 'An unexpected error occurred' : err.message,
  });
}
