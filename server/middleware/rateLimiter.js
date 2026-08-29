const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10);

const noopRateLimit = (_req, _res, next) => next();

function isRateLimitDisabled() {
  if (process.env.RATE_LIMIT_DISABLED === 'true') return true;
  if (process.env.RATE_LIMIT_DISABLED === 'false') return false;
  const env = (process.env.NODE_ENV || 'development').toLowerCase();
  return env === 'development' || env === 'dev';
}

function getClientIp(req) {
  // In production behind API Gateway, trust the API Gateway source IP
  if (process.env.NODE_ENV === 'production') {
    // API Gateway sets x-forwarded-for with the real client IP as first entry
    // But we should only trust this if the request came through API Gateway
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      const ips = forwarded.split(',').map(s => s.trim());
      // Take the leftmost (client) IP, but validate it's a valid IP
      const clientIp = ips[0];
      if (clientIp && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(clientIp)) {
        return clientIp;
      }
    }
    return req.socket.remoteAddress || 'unknown';
  }
  // In dev, use direct connection IP
  return req.socket.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}

function createRateLimit(windowMs = WINDOW_MS, maxRequests = MAX_REQUESTS) {
  if (isRateLimitDisabled()) return noopRateLimit;

  const map = new Map();

  function cleanupExpired(now) {
    for (const [key, record] of map.entries()) {
      if (now > record.resetAt + windowMs) map.delete(key);
    }
  }

  return function rateLimit(req, res, next) {
    const ip = getClientIp(req);
    const key = typeof ip === 'string' ? ip : String(ip);
    const now = Date.now();
    cleanupExpired(now);

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

export const webhookRateLimit = createRateLimit(
  parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS || '60000', 10),
  parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX_REQUESTS || '20', 10)
);
export const authRateLimit = createRateLimit(
  parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '60000', 10),
  parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '10', 10)
);
export const strictRateLimit = createRateLimit(
  parseInt(process.env.STRICT_RATE_LIMIT_WINDOW_MS || '60000', 10),
  parseInt(process.env.STRICT_RATE_LIMIT_MAX_REQUESTS || '30', 10)
);

/**
 * Per-tenant rate limiter. Uses tenantId from req.tenantId (set by extractTenantId middleware).
 * Must be mounted AFTER extractTenantId.
 */
function createTenantRateLimit(windowMs = WINDOW_MS, maxRequests = 200) {
  if (isRateLimitDisabled()) return noopRateLimit;

  const map = new Map();

  function cleanupExpired(now) {
    for (const [key, record] of map.entries()) {
      if (now > record.resetAt + windowMs) map.delete(key);
    }
  }

  return function tenantRateLimit(req, res, next) {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) return next(); // Skip if no tenant context

    const key = `tenant:${tenantId}`;
    const now = Date.now();
    cleanupExpired(now);

    let record = map.get(key);
    if (!record || now > record.resetAt) {
      map.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    record.count += 1;
    if (record.count > maxRequests) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: 'Tenant rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
    }
    return next();
  };
}

export const tenantRateLimit = createTenantRateLimit(
  parseInt(process.env.TENANT_RATE_LIMIT_WINDOW_MS || '60000', 10),
  parseInt(process.env.TENANT_RATE_LIMIT_MAX_REQUESTS || '200', 10)
);
export const creditActionRateLimit = createTenantRateLimit(
  parseInt(process.env.CREDIT_ACTION_RATE_LIMIT_WINDOW_MS || '60000', 10),
  parseInt(process.env.CREDIT_ACTION_RATE_LIMIT_MAX_REQUESTS || '30', 10)
); // credit-charging actions per minute

const rateLimit = createRateLimit();
export default rateLimit;
