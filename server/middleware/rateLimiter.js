/**
 * Simple in-memory rate limiter middleware.
 * Tracks requests per IP address within a time window.
 */

const requestMap = new Map();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100; // max requests per window per IP

function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const key = typeof ip === 'string' ? ip.split(',')[0].trim() : ip;
  const now = Date.now();

  const record = requestMap.get(key);
  if (!record) {
    requestMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + WINDOW_MS;
    return next();
  }

  record.count += 1;
  if (record.count > MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    });
  }

  return next();
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestMap.entries()) {
    if (now > record.resetAt + WINDOW_MS) {
      requestMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export default rateLimit;
