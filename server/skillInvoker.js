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
import { isValidEntityId } from './agents/followUpResolver.js';
import { TOOL_SCHEMAS, ALLOWED_TOOL_NAMES, getHandler, validateToolDefinitions } from './shared/toolDefinitions.js';

// 0 = log full tool results (default for dev). Set TOOL_LOG_MAX_RESULT_CHARS>0 to cap size in prod.
const TOOL_LOG_MAX_CHARS = parseInt(process.env.TOOL_LOG_MAX_RESULT_CHARS ?? '0', 10);

/**
 * Serialize a value for logs. By default logs the full payload (dev-friendly).
 * Set TOOL_LOG_MAX_RESULT_CHARS to a positive number to truncate large results.
 * @param {*} value
 * @param {number} [maxChars]
 */
export function serializeToolPayloadForLog(value, maxChars = TOOL_LOG_MAX_CHARS) {
  const limit = Number.isFinite(maxChars) && maxChars > 0 ? maxChars : Infinity;
  try {
    const json = JSON.stringify(value);
    if (json.length <= limit) {
      return { payload: value, size: json.length, truncated: false };
    }
    return { preview: json.slice(0, limit), size: json.length, truncated: true };
  } catch (err) {
    const fallback = String(value);
    if (fallback.length <= limit) {
      return { payload: value, size: fallback.length, truncated: false, stringifyError: err.message };
    }
    return {
      preview: fallback.slice(0, limit),
      size: fallback.length,
      truncated: true,
      stringifyError: err.message,
    };
  }
}

function logToolRequest({ tenantId, userId, toolName, handler, input, source }) {
  logger.info('skillInvoker.request', {
    tenantId,
    userId: userId || null,
    toolName,
    handler: handler || null,
    input: input ?? {},
    source: source || null,
  });
}

function logToolResponse({ tenantId, userId, toolName, source, durationMs, result }) {
  const serialized = serializeToolPayloadForLog(result);
  logger.info('skillInvoker.response', {
    tenantId,
    userId: userId || null,
    toolName,
    source: source || null,
    durationMs,
    ok: result?.ok !== false && !result?.error,
    error: result?.error || null,
    resultSize: serialized.size,
    resultTruncated: serialized.truncated,
    result: serialized.payload ?? serialized.preview,
  });
}

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

// ─── Input validation ─────────────────────────────────────────────────────────

/**
 * Required-field check, run against input AS THE CALLER PROVIDED IT --
 * i.e. BEFORE normalizeToolInput() runs. normalizeToolInput renames/removes
 * some fields (e.g. create_meeting/update_meeting's scheduledDate is mapped
 * to meetingDate+meetingTime and then deleted), so checking required-ness
 * after normalization rejected every well-formed call that used the
 * documented field name -- create_meeting failed 100% of the time as a
 * result. See docs/proposals/agent-channel-architecture/phase1-imp/
 * 04-slice4-archive-remaining-entities.md for how this was found.
 */
function validateRequiredFields(toolName, input) {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) return;

  for (const key of schema.required) {
    if (input[key] === undefined || input[key] === null || input[key] === '') {
      throw new Error(`Tool '${toolName}': required parameter '${key}' is missing`);
    }
  }
}

/** Type check, run against input AFTER normalizeToolInput() runs. */
function validateInputTypes(toolName, input) {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) return;

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

/** Extract leadId / propertyId / … from tool input. */
function extractEntityId(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const key = Object.keys(input).find(
    (k) => (k.endsWith('Id') || k === 'id')
      && input[k] != null
      && String(input[k]).trim() !== '',
  );
  return key ? input[key] : null;
}

/** Phone lookup tools — handler signature is (tenantId, phone), not (tenantId, inputObject). */
const PHONE_LOOKUP_TOOLS = new Set([
  'find_contact_by_phone', 'get_owner_by_phone', 'get_tenant_by_phone',
]);

/** Property document tools — handler signature is (tenantId, propertyId, ...), two id fields. */
const PROPERTY_DOCUMENT_TOOLS = new Set([
  // delete_property_document is deliberately absent: it was removed from the
  // registry in Phase 1 Slice 5, so ALLOWED_TOOL_NAMES rejects it before
  // dispatch is ever reached. archive_property_document replaced it.
  'create_property_document', 'archive_property_document',
]);

/** get/delete by id — handler signature is (tenantId, entityId), not (tenantId, inputObject). */
const AGGREGATE_OR_LOOKUP_TOOLS = new Set([
  'get_owners', 'get_contacts', 'get_customers', 'get_leads', 'get_buyers',
  'get_upcoming_meetings', 'get_crm_metrics', 'get_leads_summary', 'get_properties_summary',
  'get_buyers_summary', 'get_pipeline_summary', 'get_followup_summary', 'get_priority_leads',
  'get_recent_activity', 'get_daily_brief', 'get_business_health', 'get_dashboard_snapshot',
  'get_owner_by_phone', 'get_tenant_by_phone', 'get_customer_by_phone', 'find_contact_by_phone',
]);

function isEntityIdLookupTool(toolName, input) {
  if (!extractEntityId(input)) return false;
  if (AGGREGATE_OR_LOOKUP_TOOLS.has(toolName)) return false;
  if (toolName.endsWith('_notes')) return false;
  if (/^search_/.test(toolName)) return false;
  if (/summary/i.test(toolName)) return false;
  // archive_* mirrors delete_*'s dispatch shape exactly: handler(tenantId, entityId).
  // Without this, every archive_* tool fell into the generic
  // handler.length === 2 branch below and got the whole input object
  // instead of just the id -- e.g. archiveLead(tenantId, {leadId:'...'})
  // instead of archiveLead(tenantId, 'lead-id').
  return /^get_/.test(toolName) || /^delete_/.test(toolName) || /^archive_/.test(toolName);
}

// ─── Tool execution ───────────────────────────────────────────────────────────

/**
 * Per-source tool allowlist (Phase 5b).
 *
 * The unattended background flows — the lead qualifier, the router and the
 * follow-up cron — run on a schedule with nobody watching. They need four
 * tools between them. Without a bound here, the only thing standing between
 * those flows and the full 68-tool registry is that they currently happen not
 * to call anything else.
 *
 * A source listed here may call ONLY its listed tools. A source that is absent
 * is unrestricted, which is correct for the interactive surfaces
 * (`agent.pipeline`, `mcp`) where a human is asking for something and the RBAC
 * category is the right control. This is defence in depth for the flows where
 * no human is in the loop, not a replacement for that check.
 *
 * Keep entries minimal. Adding a tool here should be a deliberate decision
 * about what an unsupervised job is allowed to do to a customer's CRM.
 */
export const SOURCE_TOOL_ALLOWLIST = {
  'cron.lead_qualifier': ['get_lead', 'update_lead'],
  'cron.lead_router': ['get_lead', 'update_lead', 'search_leads'],
  'cron.lead_followup': ['search_leads', 'create_lead_note'],
};

/**
 * Invoke a CRM skill action for a tenant (direct DynamoDB path, in-Lambda).
 * Enforces user category-based tool access control.
 *
 * @param {object} [options]
 * @param {string} [options.userId] identity the permission check runs against.
 *   The check is skipped entirely when this is absent — see `fallbackCategory`.
 * @param {string} [options.source] audit label for the caller.
 * @param {string} [options.fallbackCategory] category to apply when `userId`
 *   names a non-human identity with no provisioned row. See
 *   `canUserAccessTool` for when passing this is legitimate.
 */
export async function invokeSkill(tenantId, toolName, rawInput, { userId, source, fallbackCategory } = {}) {
  const startMs = Date.now();
  let requestLogged = false;

  const emitRequest = (input, handler = null) => {
    if (requestLogged) return;
    requestLogged = true;
    logToolRequest({ tenantId, userId, toolName, handler, input, source });
  };

  const finish = (result, input = rawInput ?? {}, handler = null) => {
    emitRequest(input, handler);
    logToolResponse({
      tenantId,
      userId,
      toolName,
      source,
      durationMs: Date.now() - startMs,
      result,
    });
    return result;
  };

  if (!tenantId) {
    return finish({ ok: false, error: 'tenantId required' }, rawInput ?? {});
  }
  if (!ALLOWED_TOOL_NAMES.includes(toolName)) {
    return finish({ ok: false, error: `Tool not allowed: ${toolName}` }, rawInput ?? {});
  }

  // Per-source bound, checked before the category check: an unattended job
  // reaching for a tool outside its allowlist is a bug or an injection, and
  // either way should not depend on the actor's category to be refused.
  const sourceAllowlist = source ? SOURCE_TOOL_ALLOWLIST[source] : null;
  if (sourceAllowlist && !sourceAllowlist.includes(toolName)) {
    logger.warn('skillInvoker.invokeSkill.source_not_allowed', { tenantId, source, toolName });
    return finish(
      { ok: false, error: `Tool not permitted for this caller: ${toolName}` },
      rawInput ?? {},
    );
  }

  // Check user category permissions if userId provided
  // Security: fail-closed by default. Set ALLOW_FAIL_OPEN=true only for emergency debugging.
  if (userId) {
    try {
      const hasAccess = await canUserAccessTool(tenantId, userId, toolName, { fallbackCategory });
      if (!hasAccess) {
        logger.warn('skillInvoker.invokeSkill.access_denied', { tenantId, userId, toolName });
        return finish({ ok: false, error: `User does not have access to tool: ${toolName}` }, rawInput ?? {});
      }
    } catch (err) {
      logger.error('skillInvoker.invokeSkill.permission_check_failed', { tenantId, userId, toolName, error: err.message });
      if (process.env.ALLOW_FAIL_OPEN !== 'true') {
        // Fail-closed: deny access when permission service is unavailable
        return finish({ ok: false, error: `Permission check failed for tool: ${toolName}` }, rawInput ?? {});
      }
      logger.warn('skillInvoker.invokeSkill.fail_open_enabled', { tenantId, userId, toolName });
    }
  }

  let input = sanitizeInput(rawInput || {});

  try {
    validateRequiredFields(toolName, input);
  } catch (err) {
    return finish({ ok: false, error: err.message }, input);
  }

  // Normalize input (money, dates, phone numbers)
  input = normalizeToolInput(toolName, input);

  try {
    validateInputTypes(toolName, input);
  } catch (err) {
    return finish({ ok: false, error: err.message }, input);
  }

  const idLookupTools = {
    get_lead: 'leadId',
    archive_lead: 'leadId',
    get_buyer: 'buyerId',
    archive_buyer: 'buyerId',
    get_owner: 'ownerId',
    archive_owner: 'ownerId',
    get_property: 'propertyId',
    archive_property: 'propertyId',
    get_contact: 'contactId',
    archive_contact: 'contactId',
    get_tenant: 'tenantRecordId',
    archive_tenant: 'tenantRecordId',
    get_meeting: 'meetingId',
    archive_meeting: 'meetingId',
  };
  const idField = idLookupTools[toolName];
  const idValue = idField ? (input[idField] ?? input.customerId) : null;
  if (idField && idValue && !isValidEntityId(String(idValue))) {
    return finish({
      ok: false,
      error: `Invalid ${idField}. Use the exact UUID from search results — do not invent slug ids.`,
    }, input);
  }

  const by = userId || 'agent';

  try {
    let data;

    // Dynamic handler lookup (replaces 200-line switch/case)
    const handlerName = getHandler(toolName);
    if (!handlerName || typeof crmDynamodbService[handlerName] !== 'function') {
      return finish({ ok: false, error: `Handler not found for tool: ${toolName}` }, input, handlerName);
    }

    emitRequest(input, handlerName);

    const handler = crmDynamodbService[handlerName];

    // Special handling for tools that need createdBy/updatedBy
    const isCreateTool = toolName.startsWith('create_');
    const isUpdateTool = toolName.startsWith('update_');
    const isNoteTool = toolName.includes('_note');

    if (toolName === 'update_contact_role') {
      // updateContactRole(tenantId, contactId, role, enabled, profileData) has
      // its own positional shape -- it does NOT fit the generic
      // handler(tenantId, id, {...data}) pattern every other update_* tool
      // uses. Falling into that generic branch passed the whole input object
      // as the 3rd arg (where a `role` string is required), so this tool
      // failed on every real call with "Invalid role. Must be owner, seller,
      // buyer, or tenant".
      data = await handler(tenantId, input.contactId, input.role, input.enabled, input.profileData || null);
    } else if (PROPERTY_DOCUMENT_TOOLS.has(toolName)) {
      // createPropertyDocument/archivePropertyDocument/deletePropertyDocument
      // all take (tenantId, propertyId, ...) -- two id-shaped fields
      // (propertyId AND documentId) in one input object, which the generic
      // dispatch below can't handle: extractEntityId() only ever picks the
      // FIRST *Id field it finds, so documentId was silently dropped and
      // delete_property_document never actually deleted anything (a
      // DynamoDB DeleteCommand on a key with documentId: undefined just
      // silently no-ops instead of erroring).
      if (toolName === 'create_property_document') {
        data = await handler(tenantId, input.propertyId, { ...input, createdBy: by });
      } else {
        data = await handler(tenantId, input.propertyId, input.documentId);
      }
    } else if (PHONE_LOOKUP_TOOLS.has(toolName) && input.phone) {
      // find_contact_by_phone / get_owner_by_phone / get_tenant_by_phone /
      // get_customer_by_phone all take (tenantId, phone) with phone as a
      // plain string. Without this branch they fell through to
      // handler(tenantId, input) -- passing {phone: '...'} where a string
      // was expected, so these tools never matched a real phone number.
      data = await handler(tenantId, input.phone);
    } else if (isCreateTool && !isNoteTool) {
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
      const entityId = extractEntityId(input);

      // Many CRM getters are (tenantId, id) but have .length === 2 — must not pass the full input object as id.
      if (isEntityIdLookupTool(toolName, input)) {
        data = await handler(tenantId, entityId);
      } else if (handler.length === 2) {
        data = await handler(tenantId, input);
      } else if (entityId) {
        data = await handler(tenantId, entityId, input);
      } else {
        // Covers both arity-1 handlers (getCRMMetrics(tenantId) -- the extra
        // arg is harmlessly ignored) and arity-1-by-default-param handlers
        // that DO use a second arg (getLeadsSummary(tenantId, filters={}),
        // getPriorityLeads(tenantId, opts={}), etc.) -- `handler.length`
        // can't tell these apart, so this must keep passing input through;
        // dropping it would silently break every filter/opts-accepting
        // summary tool.
        data = await handler(tenantId, input);
      }
    }

    // Apply AI DTO transformation if feature flags are enabled
    const transformedData = await transformWithAiDto(toolName, data, { tenantId, userId, input });

    return finish({ ok: true, data: transformedData }, input, handlerName);
  } catch (err) {
    logger.error('skillInvoker.failed', { tenantId, toolName, error: err.message });
    return finish({ ok: false, error: err.message }, input, getHandler(toolName));
  }
}
