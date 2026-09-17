/**
 * MCP Controller — Handles the MCP protocol (StreamableHTTP transport)
 *
 * Architecture:
 * - Stateless: New server instance per request (MCP protocol designed for this)
 * - Tool execution: Via HTTP call to CRM backend (not direct DynamoDB)
 * - tenantId: Extracted from x-tenant-id header (set by API Gateway JWT authorizer)
 *
 * Handlers:
 * - initialize: Returns server info and capabilities
 * - tools/list: Returns all CRM tools from the shared registry (72 today)
 * - tools/call: Invokes a tool via CRM backend HTTP API
 * - resources/list: Returns available resources
 * - resources/read: Fetches resource data via CRM backend
 * - prompts/list: Returns available prompts
 * - prompts/get: Generates prompt messages
 */

import { Request, Response } from 'express';
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
import type { CallToolRequest, ReadResourceRequest, GetPromptRequest } from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, ALLOWED_TOOL_NAMES, TOOL_SCOPES } from '../services/toolDefinitions';
import { invokeTool } from '../services/crmClient';
import { RESOURCE_DEFINITIONS, readResource, isValidResourceUri } from '../services/resourceService';
import { PROMPT_DEFINITIONS, getPrompt, isValidPromptName } from '../services/promptService';
import { logger } from '../utils/logger';

/**
 * Handle POST /mcp
 */
export async function handleMcpRequest(req: Request, res: Response): Promise<void> {
  const reqAny = req as any;
  const tenantId = reqAny.tenantId || (req.headers['x-tenant-id'] as string);
  const userId = reqAny.userId || (req.headers['x-user-id'] as string) || 'mcp-agent';
  const scopesHeader = reqAny.scopes?.join(',') || (req.headers['x-scopes'] as string) || '';
  const tokenScopes = scopesHeader ? scopesHeader.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

  if (!tenantId) {
    logger.warn('mcp.missing_tenant_id');
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Unauthorized: tenant not resolved' },
      id: req.body?.id,
    });
    return;
  }

  // Create a new MCP server instance for this request (stateless)
  const server = new Server(
    { name: 'realtyflow-mcp-server', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  // ─── Tool Handlers ───────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.info('mcp.tools.list', { tenantId });
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    if (!ALLOWED_TOOL_NAMES.includes(name)) {
      logger.warn('mcp.tool.not_found', { tenantId, toolName: name });
      throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
    }

    // Scope validation: if the caller has scopes (OAuth token), enforce them.
    // Internal service calls (mcp-agent) have no scopes and are allowed.
    if (tokenScopes.length > 0) {
      // Every tool now has a scope — `inferScope` falls back to the wildcard
      // rather than to null. The `requiredScope &&` guard that used to sit
      // here meant an unscoped tool was checked against nothing at all, so the
      // twelve tools that fell through the old name-matching (the khata reads
      // among them) were callable by any authenticated client.
      const requiredScope = TOOL_SCOPES[name];
      const permitted = tokenScopes.includes(requiredScope) || tokenScopes.includes('crm');
      if (!permitted) {
        logger.warn('mcp.tool.insufficient_scope', { tenantId, toolName: name, requiredScope, tokenScopes });
        throw new McpError(ErrorCode.InvalidRequest, `Insufficient scope for tool: ${name}. Required: ${requiredScope}`);
      }
    }

    try {
      const result = await invokeTool(tenantId, name, args || {}, { userId, source: 'mcp' });

      logger.info('mcp.tool.success', { tenantId, toolName: name, success: result.ok });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: !result.ok,
      };
    } catch (err: any) {
      logger.error('mcp.tool.error', { tenantId, toolName: name, error: err.message });

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

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    logger.info('mcp.resources.list', { tenantId });
    return { resources: RESOURCE_DEFINITIONS };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    const { uri } = request.params;
    logger.info('mcp.resources.read', { tenantId, uri });

    if (!isValidResourceUri(uri)) {
      logger.warn('mcp.resource.not_found', { tenantId, uri });
      throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
    }

    try {
      const resource = await readResource(uri, tenantId);
      return { contents: [resource] };
    } catch (err: any) {
      logger.error('mcp.resource.error', { tenantId, uri, error: err.message });
      throw new McpError(ErrorCode.InternalError, `Error reading resource: ${err.message}`);
    }
  });

  // ─── Prompt Handlers ────────────────────────────────────────────────────

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    logger.info('mcp.prompts.list', { tenantId });
    return { prompts: PROMPT_DEFINITIONS };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request: GetPromptRequest) => {
    const { name, arguments: args } = request.params;
    logger.info('mcp.prompts.get', { tenantId, promptName: name });

    if (!isValidPromptName(name)) {
      throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
    }

    try {
      const messages = await getPrompt(name, tenantId, args || {});
      return { messages };
    } catch (err: any) {
      logger.error('mcp.prompt.error', { tenantId, promptName: name, error: err.message });
      throw new McpError(ErrorCode.InvalidRequest, `Error generating prompt: ${err.message}`);
    }
  });

  // ─── Connect Transport and Handle Request ────────────────────────────────

  try {
    // Stateless mode — no session ID (new server instance per request)
    // Use JSON responses instead of SSE streaming because API Gateway + Lambda
    // does not reliably handle streaming/SSE responses from serverless-express.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    // Connect server to transport
    await server.connect(transport);

    // Handle the HTTP request
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    logger.error('mcp.transport.error', { tenantId, error: err.message });

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error' },
        id: req.body?.id,
      });
    }
  }
}
