/**
 * MCP Server — HTTP Transport (StreamableHTTP)
 * 
 * This is the main MCP server that handles HTTP requests from Claude, ChatGPT, and other AI apps.
 * It uses StreamableHTTPServerTransport instead of stdio, making it suitable for AWS Lambda.
 * 
 * Architecture:
 * - Stateless: New server instance per request (MCP protocol designed for this)
 * - Direct invocation: Calls skillInvoker.js directly (not HTTP call to /api/crm/agent/tool)
 * - tenantId: Extracted from x-tenant-id header (set by API Gateway JWT authorizer)
 * - Logging: All requests logged with tenantId, method, latency
 * 
 * Handlers:
 * - initialize: Returns server info and capabilities
 * - tools/list: Returns all 54 CRM tools
 * - tools/call: Invokes a tool via skillInvoker
 * - resources/list: Returns available resources
 * - resources/read: Fetches resource data
 * - prompts/list: Returns available prompts
 * - prompts/get: Generates prompt messages
 */

import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { invokeSkill } from '../skillInvoker.js';
import { TOOLS, ALLOWED_TOOL_NAMES } from './tools.js';
import { RESOURCE_DEFINITIONS, RESOURCE_HANDLERS } from './resources.js';
import { PROMPT_DEFINITIONS, getPrompt } from './prompts.js';
import { logger } from '../logger.js';

const app = express();
app.use(express.json());

/**
 * Middleware: Extract tenantId from x-tenant-id header (set by API Gateway JWT authorizer)
 */
app.use((req, res, next) => {
  req.tenantId = req.headers['x-tenant-id'];
  req.userId = req.headers['x-user-id'] || 'mcp-agent';
  req.clientId = req.headers['x-client-id'] || 'unknown';
  next();
});

/**
 * Middleware: Log all MCP requests
 */
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const latencyMs = Date.now() - startTime;
    logger.info('mcp.request', {
      method: req.method,
      path: req.path,
      tenantId: req.tenantId,
      userId: req.userId,
      clientId: req.clientId,
      statusCode: res.statusCode,
      latencyMs,
    });
  });
  next();
});

/**
 * POST /mcp
 * Main MCP endpoint that handles all MCP protocol messages
 * 
 * Request format: JSON-RPC 2.0 with MCP methods
 * Response format: JSON-RPC 2.0 with MCP results
 */
app.post('/mcp', async (req, res) => {
  try {
    const { tenantId, userId, clientId } = req;

    // Validate tenantId (required for all requests)
    if (!tenantId) {
      logger.warn('mcp.missing_tenant_id');
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Missing x-tenant-id header' },
        id: req.body.id,
      });
    }

    // Create a new MCP server instance for this request (stateless)
    const server = new Server(
      {
        name: 'realtyflow-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    // ─── Tool Handlers ───────────────────────────────────────────────────────

    /**
     * Handle tools/list request
     * Returns all 54 CRM tools
     */
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.info('mcp.tools.list', { tenantId });
      return { tools: TOOLS };
    });

    /**
     * Handle tools/call request
     * Invokes a tool via skillInvoker
     */
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Validate tool name
      if (!ALLOWED_TOOL_NAMES.includes(name)) {
        logger.warn('mcp.tool.not_found', { tenantId, toolName: name });
        throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
      }

      try {
        // Invoke tool directly (not via HTTP call to /api/crm/agent/tool)
        const result = await invokeSkill(tenantId, name, args || {}, { userId, source: 'mcp' });

        logger.info('mcp.tool.success', {
          tenantId,
          toolName: name,
          success: result.ok,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
          isError: !result.ok,
        };
      } catch (err) {
        logger.error('mcp.tool.error', {
          tenantId,
          toolName: name,
          error: err.message,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err.message}`,
            },
          ],
          isError: true,
        };
      }
    });

    // ─── Resource Handlers ───────────────────────────────────────────────────

    /**
     * Handle resources/list request
     * Returns available resources
     */
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logger.info('mcp.resources.list', { tenantId });
      return { resources: RESOURCE_DEFINITIONS };
    });

    /**
     * Handle resources/read request
     * Fetches resource data
     */
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      logger.info('mcp.resources.read', { tenantId, uri });

      const handler = RESOURCE_HANDLERS[uri];
      if (!handler) {
        logger.warn('mcp.resource.not_found', { tenantId, uri });
        throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
      }

      try {
        const resource = await handler(tenantId);
        return { contents: [resource] };
      } catch (err) {
        logger.error('mcp.resource.error', {
          tenantId,
          uri,
          error: err.message,
        });
        throw new McpError(ErrorCode.InternalError, `Error reading resource: ${err.message}`);
      }
    });

    // ─── Prompt Handlers ────────────────────────────────────────────────────

    /**
     * Handle prompts/list request
     * Returns available prompts
     */
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
      logger.info('mcp.prompts.list', { tenantId });
      return { prompts: PROMPT_DEFINITIONS };
    });

    /**
     * Handle prompts/get request
     * Generates prompt messages
     */
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.info('mcp.prompts.get', { tenantId, promptName: name });

      try {
        const messages = await getPrompt(name, tenantId, args || {});
        return { messages };
      } catch (err) {
        logger.error('mcp.prompt.error', {
          tenantId,
          promptName: name,
          error: err.message,
        });
        throw new McpError(ErrorCode.InvalidRequest, `Error generating prompt: ${err.message}`);
      }
    });

    // ─── Connect Transport and Handle Request ────────────────────────────────

    // Create transport from request/response
    const transport = new StreamableHTTPServerTransport(req, res);

    // Connect server to transport
    await server.connect(transport);

    logger.info('mcp.request.completed', { tenantId, clientId });
  } catch (err) {
    logger.error('mcp.request.error', { error: err.message });

    // If headers already sent, can't send error response
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: req.body?.id,
      });
    }
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mcp-server' });
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  logger.error('mcp.error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
