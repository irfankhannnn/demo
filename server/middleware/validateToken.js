import axios from 'axios';

// In-memory cache for validated tokens (60 second TTL)
const tokenCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

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
    const response = await axios.get(`${authServiceUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      timeout: 3000 // 3 second timeout
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

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      // Auth service is down or unreachable
      console.error('[validateToken] Auth service unreachable:', error.message);
      return res.status(503).json({ 
        error: 'Service Unavailable', 
        message: 'Authentication service is currently unavailable' 
      });
    }

    // Unknown error
    console.error('[validateToken] Unexpected error:', error);
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
