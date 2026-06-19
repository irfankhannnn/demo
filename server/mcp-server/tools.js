import { invokeSkill, ALLOWED_TOOLS } from '../skillInvoker.js';

export const TOOL_DEFINITIONS = ALLOWED_TOOLS.map((name) => ({
  name,
  description: `CRM action: ${name.replace(/_/g, ' ')}`,
  inputSchema: { type: 'object', properties: {}, additionalProperties: true },
}));

export async function handleToolCall(tenantId, toolName, input) {
  return invokeSkill(tenantId, toolName, input, { userId: 'mcp' });
}
