import { createLogger } from '../logger.js';

export function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || req.headers['X-Request-Id'] || undefined;

  const base = {
    requestId,
    method: req.method,
    path: req.originalUrl,
    tenantId: req.headers['x-tenant-id'],
  };

  req.requestId = requestId;
  req.log = createLogger(base);

  const start = Date.now();
  req.log.info('request.start');

  res.on('finish', () => {
    req.log.info('request.end', {
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}
