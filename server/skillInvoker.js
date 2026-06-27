/**
 * Skill Invoker — in-Lambda CRM tool execution for the agent runtime.
 *
 * Implements the full set of chat-accessible CRM tools:
 * - lead ops: create, get, search, update, delete, convert, notes
 * - contact ops: create, get, search, update, delete, role, notes, lookup
 * - property ops: create, get, search, update, delete, documents
 * - tenant (customer) ops: create, get, search, update, delete, notes, lookup
 * - owner ops: create, get, search, update, delete, notes, lookup
 * - buyer ops: create, get, search, update, delete, notes
 * - meeting ops: create, get, list, update, delete
 * - lookup: by phone for contacts, owners, tenants
 * - metrics: get_crm_metrics
 *
 * Input validation:
 * - Required parameters are checked before calling DynamoDB
 * - String parameters are trimmed
 * - Unknown tools return { ok: false, error: 'Tool not allowed: ...' }
 */
import * as crmDynamodbService from './crmDynamodbService.js';
import { logger } from './logger.js';
import { canUserAccessTool } from './userCategoryService.js';
import { transformWithAiDto } from './aiDtoMiddleware.js';
import { normalizeToolInput } from './agents/inputNormalizer.js';
import { TOOL_SCHEMAS, ALLOWED_TOOL_NAMES, getHandler, validateToolDefinitions } from './shared/toolDefinitions.js';

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
// TOOL_SCHEMAS is imported from server/shared/toolDefinitions.js (single source of truth)

// Placeholder - actual TOOL_SCHEMAS definition removed (see server/shared/toolDefinitions.js)
const _TOOL_SCHEMAS_REMOVED = {
  // ── Lead ops ──────────────────────────────────────────────────────────────
  create_lead: {
    required: ['name', 'leadType'],
    types: { name: 'string', leadType: 'string', phone: 'string', email: 'string' },
    description: 'Use this when the user asks to create a new lead. Triggers: "create lead", "add lead", "new buyer lead", "seller lead Raj", "tenant lead Sarah", "owner lead Imran". Required: name, leadType (buyer|seller|tenant|owner). Optional: phone, email.',
    paramDescriptions: {
      name: 'Full name of the lead (e.g., "Raj Sharma", "Faizan Khan").',
      leadType: 'Type of lead: "buyer", "seller", "tenant", or "owner".',
      phone: 'Phone number (10 digits, e.g., "9876543210"). Optional.',
      email: 'Email address (e.g., "raj@example.com"). Optional.',
    },
  },
  get_lead: {
    required: ['leadId'],
    types: { leadId: 'string' },
    paramDescriptions: {
      leadId: 'The unique ID of the lead (e.g., "lead-abc123").',
    },
  },
  search_leads: {
    required: [],
    types: { query: 'string', status: 'string', leadType: 'string', priority: 'string', assignedTo: 'string', minBudget: 'number', maxBudget: 'number', limit: 'number', responseMode: 'string' },
    description: 'Use this when the user asks to list, search, show, or find leads. Triggers: "leads dikhao", "show leads", "Kurla ke leads", "buyer leads", "hot leads", "new leads", "leads assigned to Aman", "high priority leads above 1 crore", "sari leads", "all leads". Pass empty parameters {} to list all leads. Extract parameters: query (name/phone/area), leadType (buyer|seller|tenant|owner), status (new|contacted|qualified|negotiating|lost), priority (low|medium|high), assignedTo (agent name), minBudget/maxBudget (in rupees: 80L=8000000, 1Cr=10000000), limit (max results), responseMode (summary|compact|details|full).',
    paramDescriptions: {
      query: 'Search by lead name, phone number, or area (e.g., "Kurla", "Faizan", "9876543210"). Leave empty to list all leads.',
      status: 'Filter by lead status: "new", "contacted", "qualified", "negotiating", or "lost". Leave empty for all statuses.',
      leadType: 'Filter by lead type: "buyer", "seller", "tenant", or "owner". Leave empty for all types.',
      priority: 'Filter by priority: "low", "medium", or "high". Leave empty for all priorities.',
      assignedTo: 'Filter by agent name (e.g., "Aman"). Leave empty for all agents.',
      minBudget: 'Minimum budget in rupees (e.g., 8000000 for 80L, 10000000 for 1Cr). Leave empty for no minimum.',
      maxBudget: 'Maximum budget in rupees (e.g., 10000000 for 1Cr, 20000000 for 2Cr). Leave empty for no maximum.',
      limit: 'Maximum number of leads to return (e.g., 10, 20). Leave empty for default.',
      responseMode: 'Response detail level: "summary" (names only), "compact" (key fields), "details" (all fields), "full" (everything). Default: summary.',
    },
  },
  update_lead: {
    required: ['leadId'],
    types: {
      leadId: 'string',
      status: 'string',
      score: 'string',
      assignedTo: 'string',
      notes: 'string',
      buyerRequirement: 'object',
      sellerProperty: 'object',
      ownerProperty: 'object',
      tenantRequirement: 'object',
    },
    description: 'Use this when the user asks to update a lead. Triggers: "update lead", "change status", "mark as contacted", "update budget", "assign to Aman", "mark lost". Required: leadId. For structured updates (budget, BHK, area), use buyerRequirement/sellerProperty/ownerProperty/tenantRequirement objects instead of notes. Example: user says "update budget to 1 crore" → update buyerRequirement.budget, not create a note.',
    paramDescriptions: {
      leadId: 'The unique ID of the lead to update (e.g., "lead-abc123").',
      status: 'New status: "new", "contacted", "qualified", "negotiating", or "lost".',
      score: 'Lead score (e.g., "85", "high").',
      assignedTo: 'Agent name to assign the lead to (e.g., "Aman").',
      notes: 'Free-text notes to add to the lead. Use for unstructured updates only.',
    },
    nestedSchemas: {
      buyerRequirement: {
        budget: 'number',
        preferredArea: 'string',
        bhk: 'string',
        propertyType: 'string',
        propertySubType: 'string',
        furnishing: 'string',
        requirement: 'string',
      },
      sellerProperty: {
        expectedPrice: 'number',
        area: 'string',
        city: 'string',
        propertyType: 'string',
        propertySubType: 'string',
        bhk: 'string',
        furnishing: 'string',
        buildingName: 'string',
        flatNumber: 'string',
        floor: 'string',
        carpetArea: 'number',
        address: 'string',
        timelineValue: 'number',
        timelineUnit: 'string',
      },
      ownerProperty: {
        rentExpected: 'number',
        securityDeposit: 'number',
        area: 'string',
        city: 'string',
        propertyType: 'string',
        propertySubType: 'string',
        bhk: 'string',
        furnishing: 'string',
        buildingName: 'string',
        flatNumber: 'string',
        floor: 'string',
        carpetArea: 'number',
        address: 'string',
      },
      tenantRequirement: {
        budget: 'number',
        preferredArea: 'string',
        bhk: 'string',
        propertyType: 'string',
        propertySubType: 'string',
        furnishing: 'string',
        requirement: 'string',
      },
    },
  },
  delete_lead: {
    required: ['leadId'],
    types: { leadId: 'string' },
    description: 'Use this when the user asks to delete a lead. Triggers: "delete lead", "remove lead", "delete lead L123". IMPORTANT: Always ask for confirmation before calling this tool. Example: User says "delete Faizan" → ask "Are you sure you want to delete Faizan\'s lead? This cannot be undone."',
  },
  convert_lead: {
    required: ['leadId'],
    types: { leadId: 'string' },
  },
  create_lead_note: {
    required: ['leadId', 'content'],
    types: { leadId: 'string', content: 'string', createdBy: 'string' },
  },
  get_lead_notes: {
    required: ['leadId'],
    types: { leadId: 'string' },
  },
  // ── Contact ops ───────────────────────────────────────────────────────────
  create_contact: {
    required: ['name'],
    types: { name: 'string', phone: 'string', email: 'string', role: 'string' },
    description: 'Use this when the user asks to create a new contact. Triggers: "create contact", "add contact", "new contact Faizan", "contact Raj with phone 9876543210". Required: name. Optional: phone, email, role (owner|buyer|seller|tenant).',
  },
  get_contact: {
    required: ['contactId'],
    types: { contactId: 'string' },
  },
  search_contacts: {
    required: [],
    types: { role: 'string', status: 'string', query: 'string', limit: 'number', responseMode: 'string' },
    description: 'Use this when the user asks to list, search, or show contacts. Triggers: "contacts dikhao", "show contacts", "contacts batao", "contacts with role owner", "find contact Faizan", "active contacts". Extract parameters: query (name/phone), role (owner|buyer|seller|tenant), status (active|inactive), limit (max results), responseMode (summary|compact|details|full).',
  },
  update_contact: {
    required: ['contactId'],
    types: { contactId: 'string', name: 'string', phone: 'string', email: 'string', status: 'string' },
  },
  delete_contact: {
    required: ['contactId'],
    types: { contactId: 'string' },
    description: 'Use this when the user asks to delete a contact. Triggers: "delete contact", "remove contact". IMPORTANT: Always ask for confirmation before calling this tool.',
  },
  update_contact_role: {
    required: ['contactId', 'role', 'enabled'],
    types: { contactId: 'string', role: 'string', enabled: 'boolean', profileData: 'object' },
    description: 'Add or remove a role (owner|buyer|seller|tenant) on a unified contact. enabled=true to add, enabled=false to remove. Optionally pass profileData to update role-specific fields.',
  },
  create_contact_note: {
    required: ['contactId', 'content'],
    types: { contactId: 'string', content: 'string', createdBy: 'string' },
  },
  get_contact_notes: {
    required: ['contactId'],
    types: { contactId: 'string' },
  },
  // ── Property ops ──────────────────────────────────────────────────────────
  create_property: {
    required: ['title', 'propertyType'],
    types: { title: 'string', propertyType: 'string', city: 'string', area: 'string', ownerId: 'string' },
    description: 'Use this when the user asks to create a new property. Triggers: "create property", "add property", "new apartment in Bandra", "property 3BHK in Andheri". Required: title, propertyType (apartment|house|villa|office|land). Optional: city, area, ownerId.',
  },
  get_property: {
    required: ['propertyId'],
    types: { propertyId: 'string' },
  },
  search_properties: {
    required: [],
    types: { status: 'string', city: 'string', propertyType: 'string', query: 'string', ownerId: 'string', bhk: 'string', furnishing: 'string', minPrice: 'number', maxPrice: 'number', limit: 'number', responseMode: 'string' },
    description: 'Use this when the user asks to list, search, or show properties. Triggers: "properties dikhao", "show properties", "properties in Bandra", "3BHK apartments", "furnished properties", "properties above 1 crore", "properties owned by Raj". Extract parameters: query (title/area), propertyType (apartment|house|villa|office|land), city, bhk (1-5), furnishing (furnished|semi-furnished|unfurnished), status (active|inactive|sold), minPrice/maxPrice (in rupees), limit (max results), responseMode (summary|compact|details|full).',
  },
  update_property: {
    required: ['propertyId'],
    types: { propertyId: 'string', title: 'string', status: 'string', monthlyRent: 'number', salePrice: 'number' },
  },
  delete_property: {
    required: ['propertyId'],
    types: { propertyId: 'string' },
    description: 'Use this when the user asks to delete a property. Triggers: "delete property", "remove property". IMPORTANT: Always ask for confirmation before calling this tool.',
  },
  get_property_documents: {
    required: ['propertyId'],
    types: { propertyId: 'string' },
  },
  create_property_document: {
    required: ['propertyId', 'title', 'url'],
    types: { propertyId: 'string', title: 'string', url: 'string', documentType: 'string' },
  },
  delete_property_document: {
    required: ['propertyId', 'documentId'],
    types: { propertyId: 'string', documentId: 'string' },
    description: 'Delete a property document. Confirm with the user before executing.',
  },
  // ── Tenant (customer) ops ─────────────────────────────────────────────────
  create_tenant: {
    required: ['name'],
    types: { name: 'string', phone: 'string', email: 'string' },
    description: 'Use this when the user asks to create a new tenant/customer. Triggers: "create tenant", "add tenant", "new tenant Sarah", "customer Priya with phone 9876543210". Required: name. Optional: phone, email.',
  },
  get_tenant: {
    required: ['tenantRecordId'],
    types: { tenantRecordId: 'string' },
  },
  search_tenants: {
    required: [],
    types: { status: 'string', query: 'string', minBudget: 'number', maxBudget: 'number', limit: 'number', responseMode: 'string' },
    description: 'Use this when the user asks to list, search, or show tenants/customers. Triggers: "tenants dikhao", "show tenants", "customers batao", "tenants with budget under 50k", "find tenant Sarah", "tenant in Powai". Extract parameters: query (name/phone), status (active|inactive), minBudget/maxBudget (monthly rent in rupees), limit (max results), responseMode (summary|compact|details|full).',
  },
  update_tenant: {
    required: ['tenantRecordId'],
    types: { tenantRecordId: 'string', name: 'string', phone: 'string', status: 'string' },
  },
  delete_tenant: {
    required: ['tenantRecordId'],
    types: { tenantRecordId: 'string' },
    description: 'Use this when the user asks to delete a tenant. Triggers: "delete tenant", "remove tenant". IMPORTANT: Always ask for confirmation before calling this tool.',
  },
  create_tenant_note: {
    required: ['tenantRecordId', 'content'],
    types: { tenantRecordId: 'string', content: 'string', createdBy: 'string' },
  },
  get_tenant_notes: {
    required: ['tenantRecordId'],
    types: { tenantRecordId: 'string' },
  },
  // ── Owner ops ─────────────────────────────────────────────────────────────
  create_owner: {
    required: ['name'],
    types: { name: 'string', phone: 'string', email: 'string' },
    description: 'Use this when the user asks to create a new owner. Triggers: "create owner", "add owner", "new owner Raj", "owner Imran with phone 9876543210". Required: name. Optional: phone, email.',
  },
  get_owner: {
    required: ['ownerId'],
    types: { ownerId: 'string' },
  },
  get_owners: {
    required: [],
    types: { status: 'string', query: 'string', limit: 'number', responseMode: 'string' },
    description: 'Use this when the user asks to list, search, or show owners. Triggers: "owners dikhao", "show owners", "list all owners", "owners batao", "find owner Raj", "owner with phone 9876543210". Extract parameters: query (name/phone), status (active|inactive), limit (max results), responseMode (summary|compact|details|full).',
  },
  update_owner: {
    required: ['ownerId'],
    types: { ownerId: 'string', name: 'string', phone: 'string', status: 'string' },
  },
  delete_owner: {
    required: ['ownerId'],
    types: { ownerId: 'string' },
    description: 'Use this when the user asks to delete an owner. Triggers: "delete owner", "remove owner". IMPORTANT: Always ask for confirmation before calling this tool.',
  },
  create_owner_note: {
    required: ['ownerId', 'content'],
    types: { ownerId: 'string', content: 'string', createdBy: 'string' },
  },
  get_owner_notes: {
    required: ['ownerId'],
    types: { ownerId: 'string' },
  },
  // ── Buyer ops ─────────────────────────────────────────────────────────────
  create_buyer: {
    required: ['name'],
    types: { name: 'string', phone: 'string', email: 'string' },
    description: 'Use this when the user asks to create a new buyer. Triggers: "create buyer", "add buyer", "new buyer Ahmed", "buyer Faizan with phone 9876543210". Required: name. Optional: phone, email.',
  },
  get_buyer: {
    required: ['buyerId'],
    types: { buyerId: 'string' },
  },
  search_buyers: {
    required: [],
    types: { query: 'string', status: 'string', minBudget: 'number', maxBudget: 'number', limit: 'number', responseMode: 'string' },
    description: 'Use this when the user asks to list, search, or show buyers. Triggers: "buyers dikhao", "show buyers", "buyers batao", "buyers with budget above 1 crore", "find buyer Ahmed", "active buyers". Extract parameters: query (name/phone), status (active|inactive|converted), minBudget/maxBudget (in rupees), limit (max results), responseMode (summary|compact|details|full).',
  },
  update_buyer: {
    required: ['buyerId'],
    types: { buyerId: 'string', name: 'string', phone: 'string', budget: 'number', status: 'string' },
  },
  delete_buyer: {
    required: ['buyerId'],
    types: { buyerId: 'string' },
    description: 'Use this when the user asks to delete a buyer. Triggers: "delete buyer", "remove buyer". IMPORTANT: Always ask for confirmation before calling this tool.',
  },
  create_buyer_note: {
    required: ['buyerId', 'content'],
    types: { buyerId: 'string', content: 'string', createdBy: 'string' },
  },
  get_buyer_notes: {
    required: ['buyerId'],
    types: { buyerId: 'string' },
  },
  // ── Phone / lookup ops ────────────────────────────────────────────────────
  find_contact_by_phone: {
    required: ['phone'],
    types: { phone: 'string' },
    description: 'Find a unified contact by phone number.',
  },
  get_owner_by_phone: {
    required: ['phone'],
    types: { phone: 'string' },
    description: 'Find an owner by phone number.',
  },
  get_tenant_by_phone: {
    required: ['phone'],
    types: { phone: 'string' },
    description: 'Find a tenant by phone number.',
  },
  // ── Meeting ops ───────────────────────────────────────────────────────────
  create_meeting: {
    required: ['title', 'scheduledDate', 'relatedEntityType', 'relatedEntityId'],
    types: {
      title: 'string',
      scheduledDate: 'string',
      relatedEntityType: 'string',
      relatedEntityId: 'string',
      description: 'string',
      location: 'string',
      attendees: {
        type: 'array',
        items: { type: 'string', description: 'Attendee name or contact identifier' },
      },
    },
    description: 'Use this when the user asks to schedule or create a meeting. Triggers: "schedule meeting", "create meeting", "meeting with Faizan tomorrow at 3pm", "meeting on property P123 next week". Required: title, scheduledDate (YYYY-MM-DD or relative like "tomorrow", "next Monday"), relatedEntityType (lead|contact|owner|tenant|buyer|property), relatedEntityId. Optional: description, location, attendees.',
  },
  get_meeting: {
    required: ['meetingId'],
    types: { meetingId: 'string' },
  },
  get_upcoming_meetings: {
    required: [],
    types: { days: 'number', relatedEntityType: 'string', relatedEntityId: 'string' },
    description: 'List upcoming meetings for the next N days (default 7). Optionally filter by related entity.',
  },
  update_meeting: {
    required: ['meetingId'],
    types: { meetingId: 'string', title: 'string', scheduledDate: 'string', status: 'string' },
  },
  delete_meeting: {
    required: ['meetingId'],
    types: { meetingId: 'string' },
    description: 'Use this when the user asks to delete or cancel a meeting. Triggers: "delete meeting", "cancel meeting". IMPORTANT: Always ask for confirmation before calling this tool.',
  },
  // ── CRM metrics ───────────────────────────────────────────────────────────
  get_crm_metrics: {
    required: [],
    types: {},
    description: 'Use this when the user asks for CRM metrics, statistics, or dashboard data. Triggers: "show metrics", "CRM stats", "how many leads", "metrics batao", "dashboard", "summary". No parameters required.',
  },
};
// NOTE: The above placeholder object is not used. See server/shared/toolDefinitions.js for the actual definitions.

// ─── Input validation ─────────────────────────────────────────────────────────

function validateInput(toolName, input) {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) return;

  for (const key of schema.required) {
    if (input[key] === undefined || input[key] === null || input[key] === '') {
      throw new Error(`Tool '${toolName}': required parameter '${key}' is missing`);
    }
  }

  for (const [key, typeDef] of Object.entries(schema.types)) {
    if (input[key] === undefined) continue;
    const expectedType = typeof typeDef === 'string' ? typeDef : typeDef.type;
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
  if (!ALLOWED_TOOL_NAMES.includes(toolName)) {
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

  let input = sanitizeInput(rawInput || {});

  // Normalize input (money, dates, phone numbers)
  input = normalizeToolInput(toolName, input);

  try {
    validateInput(toolName, input);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  const by = userId || 'agent';

  try {
    let data;

    // Dynamic handler lookup (replaces 200-line switch/case)
    const handlerName = getHandler(toolName);
    if (!handlerName || typeof crmDynamodbService[handlerName] !== 'function') {
      return { ok: false, error: `Handler not found for tool: ${toolName}` };
    }

    const handler = crmDynamodbService[handlerName];

    // Special handling for tools that need createdBy/updatedBy
    const isCreateTool = toolName.startsWith('create_');
    const isUpdateTool = toolName.startsWith('update_');
    const isNoteTool = toolName.includes('_note');

    if (isCreateTool && !isNoteTool) {
      data = await handler(tenantId, { ...input, createdBy: by });
    } else if (isUpdateTool && !isNoteTool) {
      // Extract ID field (leadId, contactId, propertyId, etc.)
      const idField = Object.keys(input).find(k => k.endsWith('Id') || k === 'id');
      const id = input[idField] || input.id;
      data = await handler(tenantId, id, { ...input, updatedBy: by });
    } else if (isNoteTool && isCreateTool) {
      // create_*_note tools
      const idField = Object.keys(input).find(k => k.endsWith('Id') || k === 'id');
      const id = input[idField] || input.id;
      data = await handler(tenantId, id, {
        content: input.content,
        createdBy: by,
      });
    } else if (isNoteTool && !isCreateTool) {
      // get_*_notes tools
      const idField = Object.keys(input).find(k => k.endsWith('Id') || k === 'id');
      const id = input[idField] || input.id;
      data = await handler(tenantId, id);
    } else {
      // All other tools (search, get, delete, etc.)
      // Check if handler expects 2 or 3 arguments
      if (handler.length === 2) {
        // 2-arg handler: tenantId, input
        data = await handler(tenantId, input);
      } else {
        // 3-arg handler: tenantId, id, input (for get/delete operations)
        const idField = Object.keys(input).find(k => k.endsWith('Id') || k === 'id');
        const id = input[idField] || input.id;
        if (id) {
          data = await handler(tenantId, id, input);
        } else {
          data = await handler(tenantId, input);
        }
      }
    }

    // Apply AI DTO transformation if feature flags are enabled
    const transformedData = await transformWithAiDto(toolName, data, { tenantId, userId, input });

    logger.info('skillInvoker.success', { tenantId, toolName });
    return { ok: true, data: transformedData };
  } catch (err) {
    logger.error('skillInvoker.failed', { tenantId, toolName, error: err.message });
    return { ok: false, error: err.message };
  }
}
