/**
 * RealtyFlow MCP — Tool Definitions
 *
 * The tool DATA is generated from the canonical registry
 * (`server/shared/toolDefinitions.js`) into `./generatedToolDefinitions.ts` by
 * `server/scripts/generate-mcp-tools.mjs`, which runs on `prebuild`. This file
 * keeps only what is genuinely MCP-specific and must not be machine-written:
 * the interfaces, the MCP inputSchema conversion, and the OAuth scope mapping.
 *
 * That split is deliberate. `inferScope` decides whether a tool needs a read
 * or a write scope; a generator that rewrote it would be one bad template away
 * from handing a read-scoped client a write tool. Security logic stays here,
 * under review, and data comes from one source so the two registries cannot
 * drift apart again.
 *
 * Verify with `npm run check:mcp-drift` (also runs in CI).
 */

import { generatedToolDefinitions } from './generatedToolDefinitions';

export interface ToolParameterSpec {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  enum?: string[];
  default?: any;
  /** Shape of an object-typed parameter, e.g. `buyerRequirement`. */
  properties?: Record<string, ToolParameterSpec>;
}

export interface ToolDefinition {
  name: string;
  category: string;
  readOnly: boolean;
  descriptions: { internal: string; mcp: string };
  handler: string;
  parameters: ToolParameter[];
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

const toolDefinitions: ToolDefinition[] = generatedToolDefinitions;

// ════════════════════════════════════════════════════════════════════════════════
// CONVERTER FUNCTION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * One parameter as a JSON Schema property.
 *
 * Mirrors `toMcpProperty` in the canonical registry. The nested-object branch
 * matters: without it an object parameter such as `buyerRequirement` reaches
 * the client as a bare `{type: 'object'}` with no fields, so the model has to
 * guess `budget` / `bhk` / `preferredArea` and the call fails validation.
 */
function toMcpProperty(param: ToolParameter): Record<string, any> {
  const prop: Record<string, any> = {
    type: param.type,
    description: param.description,
    ...(param.enum && { enum: param.enum }),
    ...(param.default !== undefined && { default: param.default }),
  };
  if (param.type === 'object' && param.properties) {
    prop.properties = Object.fromEntries(
      Object.entries(param.properties).map(([key, spec]) => [
        key,
        { type: spec.type, description: spec.description, ...(spec.enum && { enum: spec.enum }) },
      ])
    );
  }
  return prop;
}

/**
 * Convert neutral tool definitions to MCP inputSchema format
 */
function convertToMcpTools(toolDefs: ToolDefinition[]): McpTool[] {
  return toolDefs.map(tool => ({
    name: tool.name,
    description: tool.descriptions.mcp,
    inputSchema: {
      type: 'object' as const,
      properties: Object.fromEntries(
        tool.parameters.map(p => [p.name, toMcpProperty(p)])
      ),
      required: tool.parameters.filter(p => p.required).map(p => p.name),
    },
  }));
}

// ════════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════════

/** MCP tools array (auto-generated from toolDefinitions) */
export const TOOLS: McpTool[] = convertToMcpTools(toolDefinitions);

/** List of allowed tool names */
export const ALLOWED_TOOL_NAMES: string[] = toolDefinitions.map(t => t.name);

// ════════════════════════════════════════════════════════════════════════════════
// TOOL → SCOPE MAPPING
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Map a tool to the OAuth scope required to invoke it.
 *
 * Driven off the tool's own `category` and `readOnly` fields, which come from
 * the canonical registry, NOT off substrings in the tool name. The name-based
 * version this replaces had three defects, all of which the generation half of
 * Phase 6 would have shipped live:
 *
 *  1. `toolName.includes('property')` does not match `search_properties`.
 *     The single most-used property tool fell through to `null`.
 *  2. `null` is not "requires the wildcard scope", as the old comment claimed.
 *     `mcpController` reads it as `if (requiredScope && ...)` — so `null`
 *     means NO CHECK AT ALL. Twelve tools, including `search_khata_entries`
 *     and `get_khata_summary`, were readable by a client holding only, say,
 *     `read_meetings`. That is the tenant's financial ledger.
 *  3. It emitted `read_contacts` / `write_contacts` / `read_metrics`, none of
 *     which existed in `OAUTH_SCOPES`. No client could ever hold them, so
 *     every contact tool and every metrics tool was permanently 403 over
 *     OAuth. Those scopes are now in the catalogue.
 *
 * `archive_*` is a write. Archiving mutates a record (it flips a status field
 * / sets archivedAt); it is only "soft" in that it is reversible. The
 * `readOnly` flag in the registry already encodes this correctly, which is a
 * further reason to trust it over a name prefix. See
 * docs/proposals/agent-channel-architecture/phase1-imp/07-bugs-found.md.
 */
const SCOPE_NOUN_BY_CATEGORY: Record<string, string> = {
  lead: 'leads',
  contact: 'contacts',
  property: 'properties',
  tenant: 'tenants',
  owner: 'owners',
  buyer: 'buyers',
  meeting: 'meetings',
  khata: 'khata',
  metrics: 'metrics',
};

/**
 * Required scope for a tool. Never returns null: an unmapped category falls
 * back to the wildcard `crm` scope rather than to "unrestricted", so a tool
 * added to the canonical registry under a new category cannot silently become
 * callable by every OAuth client.
 */
function inferScope(tool: ToolDefinition): string {
  const noun = SCOPE_NOUN_BY_CATEGORY[tool.category];
  if (!noun) return 'crm';
  return tool.readOnly ? `read_${noun}` : `write_${noun}`;
}

/** Map of tool name → required OAuth scope. Every tool has one. */
export const TOOL_SCOPES: Record<string, string> = Object.fromEntries(
  toolDefinitions.map(t => [t.name, inferScope(t)])
);
