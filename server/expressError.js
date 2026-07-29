import { logger } from './logger.js';
import { applyExpressCorsHeaders } from './utils/corsOrigins.js';

export function errorHandler(err, req, res, next) {
  const log = req?.log || logger.child({
    method: req?.method,
    path: req?.originalUrl,
    requestId: req?.headers?.['x-request-id'],
  });

  const isProd = process.env.NODE_ENV === 'production' || process.env.ENV === 'prod';

  log.error('request.error', {
    statusCode: err?.status || 500,
    errorMessage: err?.message,
    errorName: err?.name,
    ...(isProd ? {} : { stack: err?.stack }),
  });

  applyExpressCorsHeaders(req, res);
  res.status(err?.status || 500).json({
    error: err?.message || 'Internal server error',
  });
}
