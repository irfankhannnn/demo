import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOL_DEFINITIONS, handleToolCall } from './tools.js';

const server = new Server(
  { name: 'nabi-crm', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tenantId = process.env.MCP_TENANT_ID;
  if (!tenantId) {
    return { content: [{ type: 'text', text: 'MCP_TENANT_ID env required' }], isError: true };
  }
  const result = await handleToolCall(tenantId, name, args || {});
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    isError: !result.ok,
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
