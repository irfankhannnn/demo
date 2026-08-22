/**
 * User Category Service
 * Manages user categories and their tool access permissions
 * Supports role-based access control (RBAC) for AI tools
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './logger.js';
import { ALLOWED_TOOL_NAMES, toolDefinitions } from './shared/toolDefinitions.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME;
const USER_CATEGORIES_TABLE = process.env.USER_CATEGORIES_TABLE_NAME;

/**
 * WhatsApp user categories (for messaging access control)
 * These are distinct from the RBAC USER_CATEGORIES below.
 */
export const CATEGORIES = {
  LEAD: 'lead',
  CUSTOMER: 'customer',
  SPAM: 'spam',
  BLOCKED: 'blocked',
  UNKNOWN: 'unknown',
};

function isMissingDynamoTableError(err) {
  const msg = err?.message || '';
  const name = err?.name || '';
  return name === 'ResourceNotFoundException' || msg.includes('Requested resource not found');
}

let userCategoriesTableMissing = false;

/**
 * Get a WhatsApp user's category by phone number and tenant.
 * Looks up the UserCategories table; falls back to UNKNOWN if not found.
 * @param {string} phone - Normalized phone number (digits only)
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<string>} Category string (one of CATEGORIES values)
 */
export async function getCategory(phone, tenantId) {
  if (!USER_CATEGORIES_TABLE) {
    logger.warn('userCategoryService.getCategory.tableNotConfigured', { phone, tenantId });
    return CATEGORIES.UNKNOWN;
  }
  if (userCategoriesTableMissing) {
    return CATEGORIES.UNKNOWN;
  }

  try {
    const result = await docClient.send(new GetCommand({
      TableName: USER_CATEGORIES_TABLE,
      Key: {
        phone,
        tenantId,
      },
    }));

    if (!result.Item) {
      return CATEGORIES.UNKNOWN;
    }

    return result.Item.category || CATEGORIES.UNKNOWN;
  } catch (err) {
    if (isMissingDynamoTableError(err)) {
      userCategoriesTableMissing = true;
      logger.warn('userCategoryService.getCategory.tableMissing', {
        phone,
        tenantId,
        table: USER_CATEGORIES_TABLE,
      });
      return CATEGORIES.UNKNOWN;
    }
    logger.error('userCategoryService.getCategory.failed', { phone, tenantId, error: err.message });
    return CATEGORIES.UNKNOWN;
  }
}

/**
 * Resolve a WhatsApp user's category, auto-categorizing unknown users as LEAD.
 * If the user has no category record, creates one with category=lead.
 * @param {string} phone - Normalized phone number (digits only)
 * @param {string} tenantId - Tenant ID
 * @param {Object} context - Optional context for categorization { messageCount, lastInteractionAt, hasLeadCreated }
 * @returns {Promise<string>} Category string (one of CATEGORIES values)
 */
export async function resolveCategory(phone, tenantId, context = {}) {
  const existing = await getCategory(phone, tenantId);

  // If we got a real category back (not UNKNOWN), return it
  if (existing !== CATEGORIES.UNKNOWN) {
    return existing;
  }

  // Auto-categorize as LEAD for new/unknown users
  // (In production, more sophisticated logic could use context.messageCount, etc.)
  if (USER_CATEGORIES_TABLE && !userCategoriesTableMissing) {
    try {
      const now = new Date().toISOString();
      await docClient.send(new PutCommand({
        TableName: USER_CATEGORIES_TABLE,
        Item: {
          phone,
          tenantId,
          category: CATEGORIES.LEAD,
          categorizedAt: now,
          messageCount: context.messageCount || 1,
          lastInteractionAt: context.lastInteractionAt || now,
          hasLeadCreated: context.hasLeadCreated || false,
        },
      }));
      logger.info('userCategoryService.resolveCategory.auto_categorized', { phone, tenantId, category: CATEGORIES.LEAD });
    } catch (err) {
      if (isMissingDynamoTableError(err)) {
        userCategoriesTableMissing = true;
        logger.warn('userCategoryService.resolveCategory.tableMissing', { phone, tenantId, table: USER_CATEGORIES_TABLE });
      } else {
        logger.error('userCategoryService.resolveCategory.auto_categorize_failed', { phone, tenantId, error: err.message });
      }
    }
  } else if (!USER_CATEGORIES_TABLE) {
    logger.warn('userCategoryService.resolveCategory.tableNotConfigured', { phone, tenantId });
  }

  return CATEGORIES.LEAD;
}

/**
 * Every read-only tool in the registry, derived rather than hand-listed.
 *
 * Used to grant the analytics/briefing surface to the categories that already
 * carry `canViewAnalytics: true`. Deriving it means a new read-only tool is
 * covered the day it is added, instead of silently 403-ing until someone
 * notices a list here is short.
 */
const READ_ONLY_TOOL_NAMES = toolDefinitions.filter((t) => t.readOnly).map((t) => t.name);

/** Flatten + dedupe, so a category can list a tool explicitly and still spread a group that contains it. */
const union = (...lists) => [...new Set(lists.flat())];

/**
 * CRM JWT role → RBAC category.
 *
 * `setUserCategory` is not called anywhere in this codebase, so **no user has
 * a `CATEGORY#USER` row**. A named identity therefore always misses the lookup
 * and, because the check is fail-closed, would be denied every tool. The JWT
 * role is the identity model that is actually populated, so the web channel
 * maps from it.
 *
 * Roles come from middleware/requireRole.js. An unrecognised role falls to
 * `viewer` (read-only) rather than to a write-capable default: a role this map
 * does not know about is a role whose privileges nobody has decided yet.
 */
const CATEGORY_BY_CRM_ROLE = {
  FOUNDER: 'admin',
  OWNER: 'admin',
  ADMIN: 'admin',
  MANAGER: 'team_lead',
  MEMBER: 'agent',
};

/**
 * @param {string} role CRM role from the verified JWT
 * @returns {string} category key, never undefined
 */
export function categoryForCrmRole(role) {
  return CATEGORY_BY_CRM_ROLE[String(role || '').toUpperCase()] || 'viewer';
}

/**
 * User categories and their allowed tools
 * Defines what tools each user category can access
 *
 * IMPORTANT: these lists are checked against the live registry by
 * `userCategoryService.categories.test.js`. Hand-maintained copies of the tool
 * list drifted badly before that test existed — `admin`, whose own description
 * is "full access to all tools", was missing 13 live tools (every briefing and
 * summary tool, plus contact notes) while still listing 13 that no longer
 * exist. Because the permission check is fail-closed, that drift was not
 * cosmetic: an admin calling `get_daily_brief` through the MCP endpoint was
 * denied.
 */
export const USER_CATEGORIES = {
  admin: {
    name: 'Administrator',
    description: 'Full access to all tools',
    // Derived from the registry — "full access" should mean exactly that, and
    // a hand-copied list cannot stay true as tools are added and removed.
    allowedTools: [...ALLOWED_TOOL_NAMES],
    canAssignLeads: true,
    canDeleteLeads: true,
    canViewAnalytics: true,
    canManageUsers: true,
  },
  agent: {
    name: 'Sales Agent',
    description: 'Can create/update leads, owners, tenants, properties, contacts, buyers, and meetings',
    allowedTools: union([
      'create_lead', 'get_lead', 'search_leads', 'update_lead', 'create_lead_note', 'get_lead_notes',
      'create_owner', 'get_owner', 'get_owners', 'update_owner', 'create_owner_note', 'get_owner_notes', 'get_owner_by_phone',
      'create_tenant', 'get_tenant', 'search_tenants', 'update_tenant', 'create_tenant_note', 'get_tenant_notes', 'get_tenant_by_phone',
      'create_contact', 'get_contact', 'search_contacts', 'update_contact', 'update_contact_role', 'find_contact_by_phone', 'find_person',
      'create_contact_note', 'get_contact_notes',
      'get_property', 'search_properties',
      'get_buyer', 'search_buyers',
      'create_meeting', 'get_meeting', 'get_upcoming_meetings', 'update_meeting',
      // canViewAnalytics is true for this category, so the briefing/summary
      // surface belongs to it. All read-only.
    ], READ_ONLY_TOOL_NAMES),
    canAssignLeads: false,
    canDeleteLeads: false,
    canViewAnalytics: true,
    canManageUsers: false,
  },
  team_lead: {
    name: 'Team Lead',
    description: 'Can manage team leads, owners, tenants, properties, contacts, buyers, and meetings',
    allowedTools: union([
      'create_lead', 'get_lead', 'search_leads', 'update_lead', 'convert_lead', 'create_lead_note', 'get_lead_notes',
      'create_owner', 'get_owner', 'get_owners', 'update_owner', 'create_owner_note', 'get_owner_notes', 'get_owner_by_phone',
      'create_tenant', 'get_tenant', 'search_tenants', 'update_tenant', 'create_tenant_note', 'get_tenant_notes', 'get_tenant_by_phone',
      'create_contact', 'get_contact', 'search_contacts', 'update_contact', 'update_contact_role', 'find_contact_by_phone', 'find_person',
      'create_contact_note', 'get_contact_notes',
      'get_property', 'search_properties',
      'get_buyer', 'search_buyers',
      'create_meeting', 'get_meeting', 'get_upcoming_meetings', 'update_meeting',
    ], READ_ONLY_TOOL_NAMES),
    canAssignLeads: true,
    canDeleteLeads: false,
    canViewAnalytics: true,
    canManageUsers: false,
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only access to leads, owners, tenants, properties, contacts, buyers, and meetings',
    // Derived: "read-only access" is exactly the registry's read-only set, and
    // maintaining a partial copy of it by hand only produces drift.
    allowedTools: [...READ_ONLY_TOOL_NAMES],
    canAssignLeads: false,
    canDeleteLeads: false,
    canViewAnalytics: true,
    canManageUsers: false,
  },
  /**
   * A deliberately restricted WhatsApp identity.
   *
   * NOTE this is **not** the category the current WhatsApp-first product uses.
   * The launch requirement is that a broker can do everything from WhatsApp,
   * including creating and updating properties — which this category does not
   * permit. It exists for an agency that wants a genuinely limited bot on a
   * shared number, and the omissions below are the point of it: no property or
   * buyer writes, no lead conversion, no document handling.
   */
  whatsapp_bot: {
    name: 'WhatsApp Bot',
    description: 'Limited tools for WhatsApp conversations including leads, owners, tenants, properties, contacts, buyers, and meetings',
    allowedTools: union([
      'create_lead', 'get_lead', 'search_leads', 'update_lead', 'archive_lead', 'create_lead_note', 'get_lead_notes',
      'get_owner', 'get_owners', 'create_owner', 'update_owner', 'archive_owner', 'create_owner_note', 'get_owner_notes', 'get_owner_by_phone',
      'get_tenant', 'search_tenants', 'create_tenant', 'update_tenant', 'archive_tenant', 'create_tenant_note', 'get_tenant_notes', 'get_tenant_by_phone',
      'create_contact', 'get_contact', 'search_contacts', 'update_contact', 'archive_contact', 'update_contact_role', 'find_contact_by_phone', 'find_person',
      'create_contact_note', 'get_contact_notes',
      'get_property', 'search_properties', 'archive_property',
      'get_buyer', 'search_buyers', 'archive_buyer',
      'create_meeting', 'get_meeting', 'get_upcoming_meetings', 'update_meeting', 'archive_meeting',
      // Reads only. Khata money is mutated in the CRM UI, never by the bot.
    ], READ_ONLY_TOOL_NAMES),
    canAssignLeads: false,
    canDeleteLeads: false,
    canViewAnalytics: false,
    canManageUsers: false,
  },
};

/**
 * Build partition key for user category
 */
function buildPk(tenantId, userId) {
  return `TENANT#${tenantId}#USER#${userId}`;
}

/**
 * Get user category
 * @param {string} tenantId
 * @param {string} userId
 * @returns {Promise<Object|null>} User category or null if not found
 */
export async function getUserCategory(tenantId, userId) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildPk(tenantId, userId),
        SK: 'CATEGORY#USER',
      },
    }));

    return result.Item || null;
  } catch (err) {
    logger.error('userCategoryService.getUserCategory.failed', { tenantId, userId, error: err.message });
    return null;
  }
}

/**
 * Set user category
 * @param {string} tenantId
 * @param {string} userId
 * @param {string} category - Category key (admin, agent, team_lead, viewer, whatsapp_bot)
 * @returns {Promise<Object>} User category record
 */
export async function setUserCategory(tenantId, userId, category) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');
  if (!USER_CATEGORIES[category]) {
    throw new Error(`Invalid category: ${category}`);
  }

  const categoryDef = USER_CATEGORIES[category];
  const now = new Date().toISOString();

  try {
    const item = {
      PK: buildPk(tenantId, userId),
      SK: 'CATEGORY#USER',
      tenantId,
      userId,
      category,
      categoryName: categoryDef.name,
      categoryDescription: categoryDef.description,
      allowedTools: categoryDef.allowedTools,
      permissions: {
        canAssignLeads: categoryDef.canAssignLeads,
        canDeleteLeads: categoryDef.canDeleteLeads,
        canViewAnalytics: categoryDef.canViewAnalytics,
        canManageUsers: categoryDef.canManageUsers,
      },
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    }));

    logger.info('userCategoryService.setUserCategory.success', { tenantId, userId, category });
    return item;
  } catch (err) {
    logger.error('userCategoryService.setUserCategory.failed', { tenantId, userId, category, error: err.message });
    throw err;
  }
}

/**
 * Check if user can access a tool
 *
 * @param {string} tenantId
 * @param {string} userId
 * @param {string} toolName
 * @param {object} [options]
 * @param {string} [options.fallbackCategory]
 *   Category to apply when this identity has no provisioned row. This is for
 *   **non-human identities that the caller has already authorised by other
 *   means** — a signed, tenant-scoped service token, or a channel whose
 *   transport already proves the actor. Passing it is an explicit decision at
 *   the call site and is logged on every use.
 *
 *   It exists because fail-closed plus an unprovisioned identity is not a
 *   security posture, it is an outage: the MCP endpoint always sends a userId
 *   (`'mcp-agent'` when the token names no human), no such row is ever
 *   created, and `ALLOW_USER_CATEGORY_DEFAULT_FALLBACK` defaults to 'false' in
 *   CFN — so in production **every MCP tool call was denied**.
 *
 *   A *named* human identity still fails closed with no fallback: asserting a
 *   specific person is a claim their provisioned category is meant to answer.
 * @returns {Promise<boolean>} True if user can access tool
 */
export async function canUserAccessTool(tenantId, userId, toolName, { fallbackCategory } = {}) {
  let userCategory = await getUserCategory(tenantId, userId);
  if (!userCategory) {
    if (fallbackCategory && USER_CATEGORIES[fallbackCategory]) {
      userCategory = USER_CATEGORIES[fallbackCategory];
      logger.info('userCategoryService.canUserAccessTool.usingFallback', {
        tenantId, userId, toolName, category: fallbackCategory,
      });
    } else if (process.env.ALLOW_USER_CATEGORY_DEFAULT_FALLBACK === 'true') {
      // SECURITY: Only fall back to the default category in local dev. In production,
      // unknown users MUST be explicitly provisioned; otherwise they should be denied.
      const defaultCategory = getDefaultUserCategory();
      userCategory = USER_CATEGORIES[defaultCategory];
      logger.warn('userCategoryService.canUserAccessTool.usingDefault', { tenantId, userId, category: defaultCategory });
    } else {
      if (fallbackCategory) {
        logger.error('userCategoryService.canUserAccessTool.unknownFallbackCategory', {
          tenantId, userId, fallbackCategory,
        });
      }
      logger.warn('userCategoryService.canUserAccessTool.categoryNotFound', { tenantId, userId });
      return false;
    }
  }

  const hasAccess = userCategory.allowedTools.includes(toolName);
  if (!hasAccess) {
    logger.warn('userCategoryService.canUserAccessTool.denied', { tenantId, userId, toolName, category: userCategory.category });
  }

  return hasAccess;
}

/**
 * Filter tools based on user category
 * @param {string} tenantId
 * @param {string} userId
 * @param {Array<string>} tools - List of tool names to filter
 * @returns {Promise<Array<string>>} Filtered list of allowed tools
 */
export async function filterToolsByUserCategory(tenantId, userId, tools) {
  let userCategory = await getUserCategory(tenantId, userId);
  if (!userCategory) {
    // SECURITY: Only fall back to the default category in local dev. In production,
    // unknown users MUST be explicitly provisioned; otherwise they should be denied.
    if (process.env.ALLOW_USER_CATEGORY_DEFAULT_FALLBACK === 'true') {
      const defaultCategory = getDefaultUserCategory();
      userCategory = USER_CATEGORIES[defaultCategory];
      logger.warn('userCategoryService.filterToolsByUserCategory.usingDefault', { tenantId, userId, category: defaultCategory });
    } else {
      logger.warn('userCategoryService.filterToolsByUserCategory.categoryNotFound', { tenantId, userId });
      return [];
    }
  }

  const filtered = tools.filter(tool => userCategory.allowedTools.includes(tool));
  logger.info('userCategoryService.filterToolsByUserCategory.success', {
    tenantId,
    userId,
    category: userCategory.category,
    requestedTools: tools.length,
    allowedTools: filtered.length,
  });

  return filtered;
}

/**
 * Get user permissions
 * @param {string} tenantId
 * @param {string} userId
 * @returns {Promise<Object|null>} User permissions or null
 */
export async function getUserPermissions(tenantId, userId) {
  const userCategory = await getUserCategory(tenantId, userId);
  if (!userCategory) return null;

  return {
    category: userCategory.category,
    categoryName: userCategory.categoryName,
    allowedTools: userCategory.allowedTools,
    permissions: userCategory.permissions,
  };
}

/**
 * Check if user has specific permission
 * @param {string} tenantId
 * @param {string} userId
 * @param {string} permission - Permission key (canAssignLeads, canDeleteLeads, etc.)
 * @returns {Promise<boolean>} True if user has permission
 */
export async function hasUserPermission(tenantId, userId, permission) {
  const userCategory = await getUserCategory(tenantId, userId);
  if (!userCategory) return false;

  return userCategory.permissions?.[permission] === true;
}

/**
 * Get default category for new users
 * @returns {string} Default category key
 */
export function getDefaultUserCategory() {
  return 'agent'; // Default to sales agent
}

/**
 * Get all available categories
 * @returns {Object} All user categories with metadata
 */
export function getAllUserCategories() {
  return USER_CATEGORIES;
}

/**
 * Get category definition
 * @param {string} category - Category key
 * @returns {Object|null} Category definition or null
 */
export function getCategoryDefinition(category) {
  return USER_CATEGORIES[category] || null;
}
