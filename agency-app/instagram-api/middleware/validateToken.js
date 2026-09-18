// Browser-to-API auth, contract section 2a.
//
// This is a deliberate duplicate of agency-app/api/middleware/validateToken.js, not an
// import: this service is a separate deployable and must not create a build
// dependency on the CRM's source tree. The behaviour must stay identical —
// same /auth/me call, same 60s cache, same stale-grace on an auth outage — so
// that a token which works against the CRM works here.

import axios from 'axios';
import { getConfig } from '../config/env.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'validateToken' });

const tokenCache = new Map();

const AUTH_NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ECONNABORTED',
  'ENOTFOUND',
  'ERR_NETWORK',
  'EAI_AGAIN',
]);

function cleanupExpiredTokenCache(now = Date.now()) {
  const graceMs = getConfig().authStaleGraceMs;
  for (const [token, cached] of tokenCache.entries()) {
    // Entries are kept past expiry for the length of the stale-grace window;
    // evicting at expiresAt would delete exactly the entries the outage
    // fallback needs.
    if (now >= cached.expiresAt + graceMs) tokenCache.delete(token);
  }
}

/** Decode only — signature verification is the auth service's job. Used solely
 *  to skip a pointless round trip for a token we can already see is expired. */
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function bearer(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.substring(7);
}

export async function validateToken(req, res, next) {
  const token = bearer(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized', details: 'Missing or invalid Authorization header' });
  }

  try {
    cleanupExpiredTokenCache();

    const decoded = decodeJWT(token);
    if (decoded?.exp && Date.now() > decoded.exp * 1000) {
      tokenCache.delete(token);
      return res.status(401).json({ error: 'Unauthorized', details: 'Token expired' });
    }

    const cached = tokenCache.get(token);
    if (cached && Date.now() < cached.expiresAt) {
      req.user = cached.user;
      req.agency = cached.agency;
      req.tenantId = cached.tenantId;
      return next();
    }

    const cfg = getConfig();
    if (!cfg.authServiceUrl) {
      return res.status(500).json({ error: 'Internal Server Error', details: 'AUTH_SERVICE_DOMAIN_NAME not configured' });
    }

    const requestId = req.headers['x-request-id'];
    const response = await axios.get(`${cfg.authServiceUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(requestId && { 'x-request-id': requestId }),
      },
      timeout: cfg.authTimeoutMs,
    });

    if (response.status === 200 && response.data) {
      const { user, agency } = response.data;
      if (!user || !user.tenantId) {
        return res.status(401).json({ error: 'Unauthorized', details: 'Invalid user data from auth service' });
      }

      tokenCache.set(token, {
        user,
        agency,
        tenantId: user.tenantId,
        expiresAt: Date.now() + cfg.authCacheTtlMs,
      });

      // Server-derived and therefore un-spoofable. Nothing downstream may read
      // a tenantId from the body or the query string.
      req.user = user;
      req.agency = agency;
      req.tenantId = user.tenantId;
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized', details: 'Invalid token' });
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      log.error('auth_service_error', { status, statusText: error.response.statusText });
      if (status === 401 || status === 403) {
        tokenCache.delete(token);
        return res.status(status).json({ error: 'Unauthorized', details: 'Invalid or expired token' });
      }
      return res.status(502).json({ error: 'Bad Gateway', details: 'Auth service error' });
    }

    if (AUTH_NETWORK_ERROR_CODES.has(error.code)) {
      log.error('auth_service_unreachable', { code: error.code });

      // Stale-grace: an auth outage should degrade the dashboard, not black it
      // out. The entry is only honoured while the outage is the reason we could
      // not revalidate — a 401 above deletes it instead.
      const stale = tokenCache.get(token);
      if (stale && Date.now() < stale.expiresAt + getConfig().authStaleGraceMs) {
        log.warn('auth_stale_cache_fallback', { tenantId: stale.tenantId });
        req.user = stale.user;
        req.agency = stale.agency;
        req.tenantId = stale.tenantId;
        return next();
      }

      return res.status(503).json({ error: 'Service Unavailable', details: 'Authentication service is currently unavailable' });
    }

    log.error('auth_unexpected_error', { message: error.message });
    return res.status(500).json({ error: 'Internal Server Error', details: 'Failed to validate token' });
  }
}

/** Test seam: the cache is module-level state that would otherwise leak
 *  between test cases. */
export function __clearTokenCache() {
  tokenCache.clear();
}

export default validateToken;
