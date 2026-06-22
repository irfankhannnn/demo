import axios from 'axios';
import { logger } from '../logger.js';

// In-memory cache for validated tokens (5 second TTL to limit revocation window)
const tokenCache = new Map();
const CACHE_TTL_MS = 5 * 1000; // 5 seconds

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With,x-tenant-id',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
};

/**
 * Middleware to validate Cognito tokens via auth microservice
 * Calls AUTH_SERVICE_URL/auth/me to verify token and get user context
 * Caches results for 60s to reduce latency
 */
async function validateToken(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.set(CORS_HEADERS);
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Missing or invalid Authorization header' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Check cache first
    const cached = tokenCache.get(token);
    if (cached && Date.now() < cached.expiresAt) {
      req.user = cached.user;
      req.tenantId = cached.tenantId;
      return next();
    }

    // Call auth microservice to validate token
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
    const requestId = req.headers['x-request-id'] || req.id;
    const response = await axios.get(`${authServiceUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(requestId && { 'x-request-id': requestId }),
      },
      timeout: 3000 // 3 second timeout
    });

    if (response.status === 200 && response.data) {
      const { user, agency } = response.data;
      
      if (!user || !user.tenantId) {
        res.set(CORS_HEADERS);
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
    res.set(CORS_HEADERS);
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
        res.set(CORS_HEADERS);
        return res.status(status).json({ 
          error: 'Unauthorized', 
          message: 'Invalid or expired token' 
        });
      }
      res.set(CORS_HEADERS);
      return res.status(502).json({ 
        error: 'Bad Gateway', 
        message: 'Auth service error' 
      });
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      // Auth service is down or unreachable
      logger.error('[validateToken] Auth service unreachable', { error: error.message });

      // Graceful fallback: if we have a stale cached entry, use it for up to 5 minutes
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const cached = tokenCache.get(token);
        if (cached) {
          const staleGraceMs = 30 * 1000; // 30 seconds (reduced from 5 minutes for security)
          if (Date.now() < cached.expiresAt + staleGraceMs) {
            logger.warn('[validateToken] Using stale cache fallback for token', { token: token.substring(0, 20) + '...' });
            req.user = cached.user;
            req.agency = cached.agency;
            req.tenantId = cached.tenantId;
            return next();
          }
        }
      }

      res.set(CORS_HEADERS);
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Authentication service is currently unavailable'
      });
    }

    // Unknown error
    logger.error('[validateToken] Unexpected error', { error: error.message });
    res.set(CORS_HEADERS);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to validate token' 
    });
  }
}

// Cleanup expired cache entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, cached] of tokenCache.entries()) {
    if (now >= cached.expiresAt) {
      tokenCache.delete(token);
    }
  }
}, 5 * 60 * 1000);

export default validateToken;
