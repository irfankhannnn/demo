import axios from 'axios';
import { logger } from '../logger.js';

// In-memory cache for validated tokens (reduces auth-service load; tune via env)
const tokenCache = new Map();
const CACHE_TTL_MS = parseInt(process.env.AUTH_TOKEN_CACHE_TTL_MS || '60000', 10);
const STALE_CACHE_GRACE_MS = parseInt(process.env.AUTH_TOKEN_STALE_GRACE_MS || '300000', 10);
const AUTH_NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ECONNABORTED',
  'ENOTFOUND',
  'ERR_NETWORK',
  'EAI_AGAIN',
]);

function cleanupExpiredTokenCache(now = Date.now()) {
  for (const [token, cached] of tokenCache.entries()) {
    if (now >= cached.expiresAt) {
      tokenCache.delete(token);
    }
  }
}

// Simple JWT decoder (no verification, just for expiration check)
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Middleware to validate Cognito tokens via auth microservice
 * Calls AUTH_SERVICE_URL/auth/me to verify token and get user context
 * Caches results (default 60s) to reduce latency.
 *
 * Note: CORS is handled centrally by the cors middleware in server.js.
 * Do not set wildcard CORS headers here.
 */
async function validateToken(req, res, next) {
  try {
    cleanupExpiredTokenCache();

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Missing or invalid Authorization header' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Check JWT expiration before cache check
    const decoded = decodeJWT(token);
    if (decoded && decoded.exp && Date.now() > decoded.exp * 1000) {
      // Token is expired, remove from cache if present
      tokenCache.delete(token);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired'
      });
    }

    // Check cache first
    const cached = tokenCache.get(token);
    if (cached && Date.now() < cached.expiresAt) {
      req.user = cached.user;
      req.tenantId = cached.tenantId;
      return next();
    }

    // Call auth microservice to validate token
    const authServiceUrl = process.env.AUTH_SERVICE_URL;
    if (!authServiceUrl) {
      return res.status(500).json({ error: 'AUTH_SERVICE_URL not configured' });
    }
    const requestId = req.headers['x-request-id'] || req.id;
    const response = await axios.get(`${authServiceUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(requestId && { 'x-request-id': requestId }),
      },
      timeout: parseInt(process.env.AUTH_SERVICE_TIMEOUT_MS || '3000', 10)
    });

    if (response.status === 200 && response.data) {
      const { user, agency } = response.data;

      if (!user || !user.tenantId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid user data from auth service'
        });
      }

      // Cache the validated token
      tokenCache.set(token, {
        user,
        agency,
        tenantId: user.tenantId,
        expiresAt: Date.now() + CACHE_TTL_MS
      });

      // Attach user context to request (server-derived, cannot be spoofed)
      req.user = user;
      req.agency = agency;
      req.tenantId = user.tenantId;

      return next();
    }

    // Invalid response from auth service
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });

  } catch (error) {
    // Clear cache entry on error
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      tokenCache.delete(token);
    }

    // Handle specific error cases
    if (error.response) {
      // Auth service returned an error response
      const status = error.response.status;
      logger.error('[validateToken] Auth service error', {
        status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url
      });
      if (status === 401 || status === 403) {
        return res.status(status).json({
          error: 'Unauthorized',
          message: 'Invalid or expired token'
        });
      }
      return res.status(502).json({
        error: 'Bad Gateway',
        message: 'Auth service error'
      });
    }

    if (AUTH_NETWORK_ERROR_CODES.has(error.code)) {
      // Auth service is down, slow, or unreachable
      logger.error('[validateToken] Auth service unreachable', { error: error.message, code: error.code });

      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const cached = tokenCache.get(token);
        if (cached && Date.now() < cached.expiresAt + STALE_CACHE_GRACE_MS) {
          logger.warn('[validateToken] Using stale cache fallback for token', { token: token.substring(0, 20) + '...' });
          req.user = cached.user;
          req.agency = cached.agency;
          req.tenantId = cached.tenantId;
          return next();
        }
      }

      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Authentication service is currently unavailable'
      });
    }

    // Unknown error
    logger.error('[validateToken] Unexpected error', { error: error.message });
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate token'
    });
  }
}

export default validateToken;
