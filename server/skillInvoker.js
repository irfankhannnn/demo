/**
 * Skill Invoker — in-Lambda CRM tool execution for the agent runtime.
 *
 * All 22 planned tools are implemented here:
 * - lead ops: create_lead, get_lead, search_leads, update_lead, convert_lead
 * - contact ops: create_contact, get_contact, search_contacts, update_contact
 * - property ops: create_property, get_property, search_properties, update_property
 * - tenant ops: create_tenant, get_tenant, search_tenants, update_tenant
 * - owner ops: create_owner, get_owner, get_owners
 * - buyer ops: create_buyer, get_buyer, search_buyers, update_buyer
 *
 * Input validation:
 * - Required parameters are checked before calling DynamoDB
 * - String parameters are trimmed
 * - Unknown tools return { ok: false, error: 'Tool not allowed: ...' }
 */
import {
  createLead, getLead, getLeads, updateLead, convertLead, createLeadNote,
  createContact, getContact, getContacts, updateContact,
  createOwner, getOwner, getOwners,
  createProperty, getProperty, getProperties, updateProperty,
  createCustomer, getCustomer, getCustomers, updateCustomer,
  createBuyer, getBuyer, getBuyers, updateBuyer, searchBuyers,
  searchLeads,
} from './crmDynamodbService.js';
import { logger } from './logger.js';
import { canUserAccessTool } from './userCategoryService.js';

// ─── Context enrichment functions ─────────────────────────────────────────────

/**
 * Enrich context with lead information for agent
 * @param {string} tenantId
 * @param {string} leadId
 * @returns {Promise<Object>} Lead context with key fields
 */
export async function enrichContextWithLead(tenantId, leadId) {
  if (!leadId) return {};

  try {
    const lead = await getLead(tenantId, leadId);
    if (!lead) return {};

    return {
      leadId,
      leadName: lead.name,
      leadPhone: lead.phone,
      leadEmail: lead.email,
      leadType: lead.leadType,
      leadScore: lead.score,
      leadSource: lead.source,
      leadStatus: lead.status,
      lastInteraction: lead.lastInteractionAt,
      notes: Array.isArray(lead.notes)
        ? lead.notes.slice(0, 3) // Last 3 notes (array form)
        : (lead.notes ? [String(lead.notes)] : []), // Handle string or undefined
    };
  } catch (err) {
    logger.warn('skillInvoker.enrichContextWithLead.failed', { tenantId, leadId, error: err.message });
    return {}; // Graceful fallback
  }
}

// ─── Tool schema registry ─────────────────────────────────────────────────────

export const TOOL_SCHEMAS = {
  // ── Lead ops ──────────────────────────────────────────────────────────────
  create_lead: {
    required: ['name', 'leadType'],
    types: { name: 'string', leadType: 'string', phone: 'string', email: 'string' },
  },
  get_lead: {
    required: ['leadId'],
    types: { leadId: 'string' },
  },
  search_leads: {
    required: [],
    types: { query: 'string', status: 'string', leadType: 'string' },
    description: 'Search leads by name, phone, email, area, address, property type, or requirement. Example queries: "Raj", "Kurla", "2BHK", "buyer"',
  },
  update_lead: {
    required: ['leadId'],
    types: { leadId: 'string', status: 'string', score: 'string', assignedTo: 'string' },
  },
  convert_lead: {
    required: ['leadId'],
    types: { leadId: 'string' },
  },
  create_lead_note: {
    required: ['leadId', 'content'],
    types: { leadId: 'string', content: 'string', createdBy: 'string' },
  },
  // ── Contact ops ───────────────────────────────────────────────────────────
  create_contact: {
    required: ['name'],
    types: { name: 'string', phone: 'string', email: 'string', role: 'string' },
  },
  get_contact: {
    required: ['contactId'],
    types: { contactId: 'string' },
  },
  search_contacts: {
    required: [],
    types: { role: 'string', status: 'string' },
  },
  update_contact: {
    required: ['contactId'],
    types: { contactId: 'string' },
  },
  // ── Property ops ──────────────────────────────────────────────────────────
  create_property: {
    required: ['title', 'propertyType'],
    types: { title: 'string', propertyType: 'string', city: 'string', area: 'string' },
  },
  get_property: {
    required: ['propertyId'],
    types: { propertyId: 'string' },
  },
  search_properties: {
    required: [],
    types: { status: 'string', city: 'string', propertyType: 'string' },
  },
  update_property: {
    required: ['propertyId'],
    types: { propertyId: 'string' },
  },
  // ── Tenant (customer) ops ─────────────────────────────────────────────────
  create_tenant: {
    required: ['name'],
    types: { name: 'string', phone: 'string', email: 'string' },
  },
  get_tenant: {
    required: ['tenantRecordId'],
    types: { tenantRecordId: 'string' },
  },
  search_tenants: {
    required: [],
    types: { status: 'string' },
  },
  update_tenant: {
    required: ['tenantRecordId'],
    types: { tenantRecordId: 'string' },
  },
  // ── Owner ops ─────────────────────────────────────────────────────────────
  create_owner: {
    required: ['name'],
    types: { name: 'string', phone: 'string', email: 'string' },
  },
  get_owner: {
    required: ['ownerId'],
    types: { ownerId: 'string' },
  },
  get_owners: {
    required: [],
    types: { status: 'string' },
  },
  // ── Buyer ops ─────────────────────────────────────────────────────────────
  create_buyer: {
    required: ['name'],
    types: { name: 'string', phone: 'string', email: 'string' },
  },
  get_buyer: {
    required: ['buyerId'],
    types: { buyerId: 'string' },
  },
  search_buyers: {
    required: [],
    types: { query: 'string', status: 'string' },
  },
  update_buyer: {
    required: ['buyerId'],
    types: { buyerId: 'string' },
  },
};

export const ALLOWED_TOOLS = Object.keys(TOOL_SCHEMAS);

// ─── Input validation ─────────────────────────────────────────────────────────

function validateInput(toolName, input) {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) return;

  for (const key of schema.required) {
    if (input[key] === undefined || input[key] === null || input[key] === '') {
      throw new Error(`Tool '${toolName}': required parameter '${key}' is missing`);
    }
  }

  for (const [key, expectedType] of Object.entries(schema.types)) {
    if (input[key] === undefined) continue;
    const actual = Array.isArray(input[key]) ? 'array' : typeof input[key];
    if (actual !== expectedType) {
      throw new Error(`Tool '${toolName}': parameter '${key}' must be ${expectedType}, got ${actual}`);
    }
  }
}

function sanitizeInput(input) {
  if (!input || typeof input !== 'object') return input;
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

// ─── Tool execution ───────────────────────────────────────────────────────────

/**
 * Invoke a CRM skill action for a tenant (direct DynamoDB path, in-Lambda).
 * Enforces user category-based tool access control.
 */
export async function invokeSkill(tenantId, toolName, rawInput, { userId } = {}) {
  if (!tenantId) return { ok: false, error: 'tenantId required' };
  if (!ALLOWED_TOOLS.includes(toolName)) {
    return { ok: false, error: `Tool not allowed: ${toolName}` };
  }

  // Check user category permissions if userId provided
  // Security: fail-closed by default. Set ALLOW_FAIL_OPEN=true only for emergency debugging.
  if (userId) {
    try {
      const hasAccess = await canUserAccessTool(tenantId, userId, toolName);
      if (!hasAccess) {
        logger.warn('skillInvoker.invokeSkill.access_denied', { tenantId, userId, toolName });
        return { ok: false, error: `User does not have access to tool: ${toolName}` };
      }
    } catch (err) {
      logger.error('skillInvoker.invokeSkill.permission_check_failed', { tenantId, userId, toolName, error: err.message });
      if (process.env.ALLOW_FAIL_OPEN !== 'true') {
        // Fail-closed: deny access when permission service is unavailable
        return { ok: false, error: `Permission check failed for tool: ${toolName}` };
      }
      logger.warn('skillInvoker.invokeSkill.fail_open_enabled', { tenantId, userId, toolName });
    }
  }

  const input = sanitizeInput(rawInput || {});

  try {
    validateInput(toolName, input);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  const by = userId || 'agent';

  try {
    let data;

    switch (toolName) {
      // ── Lead ops ──────────────────────────────────────────────────────────
      case 'create_lead':
        data = await createLead(tenantId, { ...input, createdBy: by });
        break;
      case 'get_lead':
        data = await getLead(tenantId, input.leadId || input.id);
        break;
      case 'search_leads':
        data = input.query
          ? await searchLeads(tenantId, input.query)
          : await getLeads(tenantId, input);
        break;
      case 'update_lead':
        data = await updateLead(tenantId, input.leadId || input.id, { ...input, updatedBy: by });
        break;
      case 'convert_lead':
        data = await convertLead(tenantId, input.leadId || input.id, { convertedBy: by });
        break;
      case 'create_lead_note':
        data = await createLeadNote(tenantId, input.leadId || input.id, {
          content: input.content,
          createdBy: by,
        });
        break;

      // ── Contact ops ───────────────────────────────────────────────────────
      case 'create_contact':
        data = await createContact(tenantId, { ...input, createdBy: by });
        break;
      case 'get_contact':
        data = await getContact(tenantId, input.contactId || input.id);
        break;
      case 'search_contacts':
        data = await getContacts(tenantId, input);
        break;
      case 'update_contact':
        data = await updateContact(tenantId, input.contactId || input.id, { ...input, updatedBy: by });
        break;

      // ── Property ops ──────────────────────────────────────────────────────
      case 'create_property':
        data = await createProperty(tenantId, { ...input, createdBy: by });
        break;
      case 'get_property':
        data = await getProperty(tenantId, input.propertyId || input.id);
        break;
      case 'search_properties':
        data = await getProperties(tenantId, input);
        break;
      case 'update_property':
        data = await updateProperty(tenantId, input.propertyId || input.id, { ...input, updatedBy: by });
        break;

      // ── Tenant (customer) ops ─────────────────────────────────────────────
      case 'create_tenant':
        data = await createCustomer(tenantId, { ...input, createdBy: by });
        break;
      case 'get_tenant':
        data = await getCustomer(tenantId, input.tenantRecordId || input.id);
        break;
      case 'search_tenants':
        data = await getCustomers(tenantId, input);
        break;
      case 'update_tenant':
        data = await updateCustomer(tenantId, input.tenantRecordId || input.id, { ...input, updatedBy: by });
        break;

      // ── Owner ops ─────────────────────────────────────────────────────────
      case 'create_owner':
        data = await createOwner(tenantId, { ...input, createdBy: by });
        break;
      case 'get_owner':
        data = await getOwner(tenantId, input.ownerId || input.id);
        break;
      case 'get_owners':
        data = await getOwners(tenantId, input);
        break;

      // ── Buyer ops ─────────────────────────────────────────────────────────
      case 'create_buyer':
        data = await createBuyer(tenantId, { ...input, createdBy: by });
        break;
      case 'get_buyer':
        data = await getBuyer(tenantId, input.buyerId || input.id);
        break;
      case 'search_buyers':
        data = input.query
          ? await searchBuyers(tenantId, input.query)
          : await getBuyers(tenantId, input);
        break;
      case 'update_buyer':
        data = await updateBuyer(tenantId, input.buyerId || input.id, { ...input, updatedBy: by });
        break;

      default:
        return { ok: false, error: `Tool not implemented: ${toolName}` };
    }

    logger.info('skillInvoker.success', { tenantId, toolName });
    return { ok: true, data };
  } catch (err) {
    logger.error('skillInvoker.failed', { tenantId, toolName, error: err.message });
    return { ok: false, error: err.message };
  }
}
