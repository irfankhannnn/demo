import { Router } from 'express';
import { handleMcpRequest } from '../controllers/mcpController';
import { mcpRateLimiter } from '../middleware/rateLimiter';
import { mcpJwtAuth } from '../middleware/jwtAuth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Middleware: Log all MCP requests
 */
router.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const latencyMs = Date.now() - startTime;
    logger.info('mcp.request', {
      method: req.method,
      path: req.path,
      tenantId: (req as any).tenantId,
      userId: (req as any).userId,
      clientId: (req as any).clientId,
      scopes: (req as any).scopes,
      statusCode: res.statusCode,
      latencyMs,
    });
  });
  next();
});

// Rate limiting for MCP endpoint
router.use('/mcp', mcpRateLimiter);

/**
 * GET /mcp — OAuth discovery probe.
 *
 * MCP clients (like mcp-remote) send an unauthenticated GET to the MCP endpoint
 * to discover the authorization server via the WWW-Authenticate header. We must
 * return 401 with the resource metadata pointer, not a generic 403.
 */
router.get('/mcp', (_req, res) => {
  const baseUrl = process.env.OAUTH_BASE_URL || '';
  if (baseUrl) {
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`);
  }
  res.status(401).json({
    jsonrpc: '2.0',
    error: { code: -32600, message: 'Unauthorized: Bearer token required' },
    id: null,
  });
});

/**
 * POST /mcp — Main MCP endpoint.
 *
 * In-lambda auth is required because API Gateway custom authorizers return a
 * generic 403, which breaks MCP OAuth discovery (clients expect 401 + WWW-Authenticate).
 */
router.post('/mcp', mcpJwtAuth, handleMcpRequest);

export default router;
