/**
 * Shared CORS origin resolution — single source of truth for Express, Lambda,
 * error handlers, and tenant middleware.
 */

const DEFAULT_ALLOWED_HEADERS = 'Content-Type,Authorization,X-Requested-With,x-tenant-id';
const DEFAULT_ALLOWED_METHODS = 'GET,POST,PUT,DELETE,OPTIONS,PATCH';

/**
 * Origins the Capacitor WebView sends. These are platform constants, not
 * deployment config:
 *   - iOS WKWebView serves the bundle from capacitor://localhost
 *   - Android serves from https://localhost, per `server.androidScheme: 'https'`
 *     in apps/crm/real-estate-crm-app/capacitor.config.ts
 *
 * They are always allowed rather than left to ALLOWED_ORIGINS because the
 * failure mode is total: a missed env update in one environment means every
 * API call from the mobile app is blocked, including the preflight, with no
 * partial degradation to hint at the cause.
 *
 * Keep this list minimal. Do not add ionic://localhost or http://localhost —
 * the app does not produce those origins.
 */
export const NATIVE_APP_ORIGINS = Object.freeze([
  'capacitor://localhost',
  'https://localhost',
]);

export function getAllowedOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return [...new Set([...configured, ...NATIVE_APP_ORIGINS])];
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
