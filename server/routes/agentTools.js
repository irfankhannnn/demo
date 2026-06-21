/**
 * Agent Tools Endpoint — POST /api/crm/agent/tool
 * Called by the MCP server to invoke CRM skills on behalf of the AI agent.
 * Requires JWT auth (not the normal user JWT — a service JWT signed with JWT_SECRET).
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { invokeSkill, ALLOWED_TOOLS } from '../skillInvoker.js';
import { logger } from '../logger.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const MCP_AGENT_ROLE = 'mcp-agent';

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
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== MCP_AGENT_ROLE) {
      return res.status(403).json({ error: 'Insufficient role' });
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
  const tenantId = req.agentTenantId || req.headers['x-tenant-id'];

  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenantId (must be in JWT or x-tenant-id header)' });
  }

  if (!toolName || typeof toolName !== 'string') {
    return res.status(400).json({ error: 'Missing toolName' });
  }

  if (!ALLOWED_TOOLS.includes(toolName)) {
    return res.status(400).json({ error: `Tool '${toolName}' not allowed`, allowedTools: ALLOWED_TOOLS });
  }

  try {
    const result = await invokeSkill(tenantId, toolName, input || {}, { userId: 'mcp-agent', source: 'mcp' });
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
  return res.json({ tools: ALLOWED_TOOLS });
});

export default router;
