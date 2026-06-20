const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;

function createRateLimit(windowMs = WINDOW_MS, maxRequests = MAX_REQUESTS) {
  const map = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of map.entries()) {
      if (now > record.resetAt + windowMs) map.delete(key);
    }
  }, Math.min(windowMs * 5, 10 * 60 * 1000)).unref?.();

  return function rateLimit(req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = typeof ip === 'string' ? ip.split(',')[0].trim() : String(ip);
    const now = Date.now();

    let record = map.get(key);
    if (!record || now > record.resetAt) {
      map.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    record.count += 1;
    if (record.count > maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
    }
    return next();
  };
}

export const webhookRateLimit = createRateLimit(60 * 1000, 20);
export const authRateLimit = createRateLimit(60 * 1000, 10);
export const strictRateLimit = createRateLimit(60 * 1000, 30);

const rateLimit = createRateLimit();
export default rateLimit;
