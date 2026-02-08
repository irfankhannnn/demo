import { logger } from './logger.js';

export function errorHandler(err, req, res, next) {
  const log = req?.log || logger.child({
    method: req?.method,
    path: req?.originalUrl,
    requestId: req?.headers?.['x-request-id'],
    tenantId: req?.headers?.['x-tenant-id'],
  });

  log.error('request.error', {
    statusCode: err?.status || 500,
    errorMessage: err?.message,
    errorName: err?.name,
    stack: err?.stack,
  });

  res.status(err?.status || 500).json({
    error: err?.message || 'Internal server error',
  });
}
