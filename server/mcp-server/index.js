import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { TOOLS, ALLOWED_TOOL_NAMES } from './tools.js';

const CRM_API_BASE = process.env.CRM_API_BASE || 'http://localhost:4000';
const CRM_TOKEN = process.env.CRM_TOKEN;
const MCP_TENANT_ID = process.env.MCP_TENANT_ID;

if (!CRM_TOKEN) {
  console.error('Missing CRM_TOKEN env var');
  process.exit(1);
}
if (!MCP_TENANT_ID) {
  console.error('Missing MCP_TENANT_ID env var');
  process.exit(1);
}

const crmClient = axios.create({
  baseURL: CRM_API_BASE,
  headers: {
    Authorization: `Bearer ${CRM_TOKEN}`,
    'x-tenant-id': MCP_TENANT_ID,
    'Content-Type': 'application/json',
  },
});

const server = new Server(
  {
    name: 'nabi-crm-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!ALLOWED_TOOL_NAMES.includes(name)) {
    throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
  }

  try {
    const response = await crmClient.post('/api/crm/agent/tool', {
      toolName: name,
      input: args || {},
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  } catch (err) {
    const message = err.response?.data?.error || err.message || 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Nabi CRM MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
