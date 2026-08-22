/**
 * Agent Tools Endpoint — POST /api/crm/agent/tool
 * Called by the MCP server to invoke CRM skills on behalf of the AI agent.
 * Requires JWT auth (not the normal user JWT — a service JWT signed with JWT_SECRET).
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { invokeSkill } from '../skillInvoker.js';
import { ALLOWED_TOOL_NAMES } from '../shared/toolDefinitions.js';
import { logger } from '../logger.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const MCP_AGENT_ROLE = 'mcp-agent';
/** Identity used when the MCP token names no human user. Must match reality-flow-mcp's jwtAuth default. */
const MCP_SERVICE_IDENTITY = 'mcp-agent';

/**
 * Middleware: verify service JWT (not user JWT).
 */
function verifyMcpToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = authHeader.slice(7);
  if (!JWT_SECRET) {
    logger.error('agentTools: JWT_SECRET not configured');
    return res.status(503).json({ error: 'Service misconfigured' });
  }
  try {
    // Pin the algorithm. JWT_SECRET is symmetric, so without this the
    // verifier would accept whatever `alg` the token declares.
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.role !== MCP_AGENT_ROLE) {
      return res.status(403).json({ error: 'Insufficient role' });
    }
    // The tenant MUST come from the signed token. Reject a service token
    // without a tenantId claim rather than letting the handler fall back to
    // a client-supplied header (see the tenant note on the /tool route).
    if (!payload.tenantId) {
      logger.warn('agentTools: token missing tenantId claim');
      return res.status(403).json({ error: 'Token missing tenantId' });
    }
    req.jwtPayload = payload;
    req.agentTenantId = payload.tenantId;
    next();
  } catch (err) {
    logger.warn('agentTools: invalid token', { error: err.message });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * POST /api/crm/agent/tool
 * Body: { toolName: string, input: object }
 */
router.post('/tool', verifyMcpToken, async (req, res) => {
  const { toolName, input } = req.body || {};
  // Tenant comes ONLY from the verified JWT. This previously fell back to
  // `req.headers['x-tenant-id']`, which meant a caller holding any valid
  // mcp-agent token whose payload lacked a tenantId claim could name ANY
  // tenant in a header and drive the CRM tools against it — cross-tenant
  // read and write. That also contradicted the rule stated in
  // tenantMiddleware.js: "NEVER trust the client-provided x-tenant-id
  // header." verifyMcpToken now rejects a token with no tenantId claim, so
  // reaching here without one is impossible.
  const tenantId = req.agentTenantId;

  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenantId' });
  }

  if (!toolName || typeof toolName !== 'string') {
    return res.status(400).json({ error: 'Missing toolName' });
  }

  if (!ALLOWED_TOOL_NAMES.includes(toolName)) {
    return res.status(400).json({ error: `Tool '${toolName}' not allowed`, allowedTools: ALLOWED_TOOL_NAMES });
  }

  try {
    const userId = req.headers['x-user-id'] || MCP_SERVICE_IDENTITY;
    // The permission check is fail-closed and no `CATEGORY#USER` row is ever
    // created for the anonymous service identity, so in production every call
    // arriving without an `x-user-id` was denied. The authorisation for that
    // case is the token itself — signed, tenant-scoped, and role-checked in
    // verifyMcpToken — so the service identity resolves to `admin`.
    //
    // A *named* user keeps failing closed: naming a specific person is a claim
    // their provisioned category exists to answer, and quietly upgrading an
    // unprovisioned human to admin would be the actual bypass.
    const result = await invokeSkill(tenantId, toolName, input || {}, {
      userId,
      source: 'mcp',
      ...(userId === MCP_SERVICE_IDENTITY ? { fallbackCategory: 'admin' } : {}),
    });
    return res.json(result);
  } catch (err) {
    logger.error('agentTools.invoke.failed', { tenantId, toolName, error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/crm/agent/tools — list allowed tools
 */
router.get('/tools', verifyMcpToken, (req, res) => {
  return res.json({ tools: ALLOWED_TOOL_NAMES });
});

export default router;
