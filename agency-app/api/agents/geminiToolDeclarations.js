/**
 * Gemini / Anthropic tool declaration builders (shared by agent runtime and LLM planner).
 */
import { ALLOWED_TOOL_NAMES as ALLOWED_TOOLS, TOOL_SCHEMAS } from '../shared/toolDefinitions.js';

const TOOL_TRIGGER_HINTS = {
  search_leads: 'Use this when the user asks to list, search, show, find, or get leads (e.g., "leads dikhao", "show leads", "lead list").',
  get_lead: 'Use this when the user asks for a specific lead by ID or refers to a specific lead.',
  get_owners: 'Use this when the user asks to list, search, show, find, or get owners (e.g., "owners dikhao", "show owners", "owner list").',
  get_owner: 'Use this when the user asks for a specific owner by ID.',
  get_owner_by_phone: 'Use this when the user asks to find an owner by phone number.',
  search_tenants: 'Use this when the user asks to list, search, show, find, or get tenants/customers (e.g., "customers dikhao", "tenant list", "show tenants").',
  get_tenant: 'Use this when the user asks for a specific tenant by ID.',
  get_tenant_by_phone: 'Use this when the user asks to find a tenant by phone number.',
  search_properties: 'Use this when the user asks to list, search, show, find, or get properties (e.g., "properties dikhao", "show properties", "property list").',
  get_property: 'Use this when the user asks for a specific property by ID.',
  get_upcoming_meetings: 'Use this when the user asks to list, search, show, or find meetings (e.g., "meetings dikhao", "upcoming meetings", "calendar").',
  search_contacts: 'Use this when the user asks to list, search, show, or find contacts (e.g., "contacts dikhao", "show contacts", "contact list").',
  find_contact_by_phone: 'Use this when the user asks to find a contact by phone number.',
  search_buyers: 'Use this when the user asks to list, search, show, or find buyers (e.g., "buyers dikhao", "buyer list").',
  get_buyer: 'Use this when the user asks for a specific buyer by ID.',
};

function buildToolProperties(schema) {
  const properties = {};
  if (!schema) return properties;
  const paramDescs = schema.paramDescriptions || {};
  const enums = schema.enums || {};
  for (const [key, typeDef] of Object.entries(schema.types)) {
    const type = typeof typeDef === 'string' ? typeDef : typeDef.type;
    const prop = { type, description: paramDescs[key] || `Parameter: ${key}` };
    if (Array.isArray(enums[key]) && enums[key].length > 0) {
      prop.enum = enums[key];
    }
    if (type === 'object' && schema.nestedSchemas && schema.nestedSchemas[key]) {
      const nested = schema.nestedSchemas[key];
      prop.properties = {};
      for (const [nestedKey, nestedType] of Object.entries(nested)) {
        prop.properties[nestedKey] = { type: nestedType, description: paramDescs[`${key}.${nestedKey}`] || `Parameter: ${key}.${nestedKey}` };
      }
    }
    if (type === 'array') {
      if (typeof typeDef === 'object' && typeDef.items) {
        prop.items = typeDef.items;
      } else if (schema.items && schema.items[key]) {
        prop.items = schema.items[key];
      }
    }
    properties[key] = prop;
  }
  return properties;
}

function buildToolDescription(tool, schema) {
  const parts = [];
  if (schema?.description) parts.push(schema.description);
  const hint = TOOL_TRIGGER_HINTS[tool];
  if (hint && (!schema?.description || !schema.description.toLowerCase().includes('use this when'))) {
    parts.push(hint);
  }
  if (parts.length === 0) {
    return schema
      ? `CRM tool: ${tool.replace(/_/g, ' ')}. Required: ${schema.required.join(', ') || 'none'}.`
      : `Execute CRM operation: ${tool.replace(/_/g, ' ')}`;
  }
  return parts.join(' ');
}

export function normalizeGeminiToolName(name) {
  if (!name || typeof name !== 'string') return name;
  return name.replace(/^default\./, '');
}

/**
 * Resolve which tool names to declare. Pass an array/Set of names to scope the
 * declarations (e.g. to a single routed domain); omit to declare every tool.
 * @param {string[]|Set<string>} [toolNames]
 * @returns {string[]}
 */
function resolveToolNames(toolNames) {
  if (!toolNames) return ALLOWED_TOOLS;
  const requested = toolNames instanceof Set ? [...toolNames] : toolNames;
  const allowed = new Set(ALLOWED_TOOLS);
  const scoped = requested.filter((name) => allowed.has(name));
  return scoped.length > 0 ? scoped : ALLOWED_TOOLS;
}

export function buildAnthropicToolDefinitions(toolNames) {
  return resolveToolNames(toolNames).map((tool) => {
    const schema = TOOL_SCHEMAS[tool];
    return {
      name: tool,
      description: buildToolDescription(tool, schema),
      input_schema: {
        type: 'object',
        properties: buildToolProperties(schema),
        required: schema?.required || [],
      },
    };
  });
}

export function buildGeminiToolDefinitions(toolNames) {
  return resolveToolNames(toolNames).map((tool) => {
    const schema = TOOL_SCHEMAS[tool];
    return {
      name: tool,
      description: buildToolDescription(tool, schema),
      parameters: {
        type: 'object',
        properties: buildToolProperties(schema),
        required: schema?.required || [],
      },
    };
  });
}
