/**
 * User Category Service
 * Manages user categories and their tool access permissions
 * Supports role-based access control (RBAC) for AI tools
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './logger.js';

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
  if (USER_CATEGORIES_TABLE) {
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
      logger.error('userCategoryService.resolveCategory.auto_categorize_failed', { phone, tenantId, error: err.message });
    }
  } else {
    logger.warn('userCategoryService.resolveCategory.tableNotConfigured', { phone, tenantId });
  }

  return CATEGORIES.LEAD;
}

/**
 * User categories and their allowed tools
 * Defines what tools each user category can access
 */
export const USER_CATEGORIES = {
  admin: {
    name: 'Administrator',
    description: 'Full access to all tools',
    allowedTools: [
      'create_lead', 'get_lead', 'search_leads', 'update_lead', 'convert_lead', 'create_lead_note',
      'create_contact', 'get_contact', 'search_contacts', 'update_contact',
      'create_property', 'get_property', 'search_properties', 'update_property',
      'create_tenant', 'get_tenant', 'search_tenants', 'update_tenant',
      'create_owner', 'get_owner', 'get_owners',
      'create_buyer', 'get_buyer', 'search_buyers', 'update_buyer',
    ],
    canAssignLeads: true,
    canDeleteLeads: true,
    canViewAnalytics: true,
    canManageUsers: true,
  },
  agent: {
    name: 'Sales Agent',
    description: 'Can create/update leads, search properties, manage contacts',
    allowedTools: [
      'create_lead', 'get_lead', 'search_leads', 'update_lead', 'create_lead_note',
      'create_contact', 'get_contact', 'search_contacts', 'update_contact',
      'get_property', 'search_properties',
      'get_buyer', 'search_buyers',
    ],
    canAssignLeads: false,
    canDeleteLeads: false,
    canViewAnalytics: true,
    canManageUsers: false,
  },
  team_lead: {
    name: 'Team Lead',
    description: 'Can manage team leads, assign, and view analytics',
    allowedTools: [
      'create_lead', 'get_lead', 'search_leads', 'update_lead', 'convert_lead', 'create_lead_note',
      'create_contact', 'get_contact', 'search_contacts', 'update_contact',
      'get_property', 'search_properties',
      'get_buyer', 'search_buyers',
    ],
    canAssignLeads: true,
    canDeleteLeads: false,
    canViewAnalytics: true,
    canManageUsers: false,
  },
  viewer: {
    name: 'Viewer',
    description: 'Read-only access to leads and properties',
    allowedTools: [
      'get_lead', 'search_leads',
      'get_contact', 'search_contacts',
      'get_property', 'search_properties',
      'get_buyer', 'search_buyers',
    ],
    canAssignLeads: false,
    canDeleteLeads: false,
    canViewAnalytics: true,
    canManageUsers: false,
  },
  whatsapp_bot: {
    name: 'WhatsApp Bot',
    description: 'Limited tools for WhatsApp conversations',
    allowedTools: [
      'create_lead', 'get_lead', 'search_leads', 'update_lead', 'create_lead_note',
      'create_contact', 'get_contact', 'search_contacts',
      'get_property', 'search_properties',
      'get_buyer', 'search_buyers',
    ],
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
 * @param {string} tenantId
 * @param {string} userId
 * @param {string} toolName
 * @returns {Promise<boolean>} True if user can access tool
 */
export async function canUserAccessTool(tenantId, userId, toolName) {
  const userCategory = await getUserCategory(tenantId, userId);
  if (!userCategory) {
    logger.warn('userCategoryService.canUserAccessTool.categoryNotFound', { tenantId, userId });
    return false;
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
  const userCategory = await getUserCategory(tenantId, userId);
  if (!userCategory) {
    logger.warn('userCategoryService.filterToolsByUserCategory.categoryNotFound', { tenantId, userId });
    return []; // Deny all if category not found
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
