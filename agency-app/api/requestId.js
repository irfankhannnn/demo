import { randomUUID } from 'crypto';

export function ensureRequestId(req, res, next) {
  const existing = req.headers['x-request-id'] || req.headers['X-Request-Id'];
  const requestId = existing || randomUUID();

  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);

  next();
}
