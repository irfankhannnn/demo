/**
 * Shared CORS origin resolution — single source of truth for Express, Lambda,
 * error handlers, and tenant middleware.
 */

const DEFAULT_ALLOWED_HEADERS = 'Content-Type,Authorization,X-Requested-With,x-tenant-id';
const DEFAULT_ALLOWED_METHODS = 'GET,POST,PUT,DELETE,OPTIONS,PATCH';

export function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Resolve Access-Control-Allow-Origin for a request Origin.
 * Never returns '*' when credentials are used — echoes an allowlisted origin
 * or omits the header when the origin is not allowed.
 *
 * @param {string|undefined|null} requestOrigin
 * @returns {{ origin: string|null, credentials: boolean }}
 */
export function resolveCorsOrigin(requestOrigin) {
  const allowed = getAllowedOrigins();
  const origin = typeof requestOrigin === 'string' ? requestOrigin.trim() : '';

  if (!origin) {
    // Non-browser / same-origin — no ACAO needed for credentialed browser cases
    return { origin: null, credentials: false };
  }

  if (allowed.includes(origin)) {
    return { origin, credentials: true };
  }

  return { origin: null, credentials: false };
}

/**
 * Build CORS response headers for Express res.set() or Lambda responses.
 * @param {string|undefined|null} requestOrigin
 * @returns {Record<string, string>}
 */
export function buildCorsHeaders(requestOrigin) {
  const { origin, credentials } = resolveCorsOrigin(requestOrigin);
  const headers = {
    'Access-Control-Allow-Headers':
      process.env.CORS_ALLOW_HEADERS || DEFAULT_ALLOWED_HEADERS,
    'Access-Control-Allow-Methods':
      process.env.CORS_ALLOW_METHODS || DEFAULT_ALLOWED_METHODS,
    'Access-Control-Max-Age': process.env.CORS_MAX_AGE_SECONDS || '86400',
  };

  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    if (credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  }

  return headers;
}

/**
 * Apply CORS headers onto an Express response from the incoming request.
 */
export function applyExpressCorsHeaders(req, res) {
  const origin = req?.headers?.origin || req?.get?.('origin');
  const headers = buildCorsHeaders(origin);
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}
