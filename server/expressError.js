import { logger } from './logger.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
};

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

  res.set(CORS_HEADERS);
  res.status(err?.status || 500).json({
    error: err?.message || 'Internal server error',
  });
}
