/**
 * WhatsApp Access Control Service (P3.4)
 * 
 * Manages access control for WhatsApp messaging:
 * - Checks if messages should be processed (whitelist/blacklist)
 * - Checks if AI can send to a user (category-based rules)
 * - Respects AiEmployeeSettings whitelist/blacklist
 * - Integrates with user category and feature toggle services
 */

import { logger } from './logger.js';
import { getCategory, CATEGORIES } from './userCategoryService.js';
import featureToggleService, { FEATURES } from './featureToggleService.js';

/**
 * Normalize phone arrays from config to digits-only for consistent comparison
 * @param {Array<string>} phones
 * @returns {Array<string>}
 */
function normalizePhoneArray(phones) {
  if (!Array.isArray(phones)) return [];
  return phones.map(p => String(p || '').replace(/\D/g, '')).filter(Boolean);
}

/**
 * Access control result
 */
class AccessControlResult {
  constructor(allowed, reason = '', category = null) {
    this.allowed = allowed;
    this.reason = reason;
    this.category = category;
  }
}

/**
 * Check if a phone number can receive messages
 * @param {string} phone - Phone number (normalized, digits only)
 * @param {string} tenantId - Tenant ID
 * @param {Object} config - AiEmployeeSettings config (whitelistedPhones, blacklistedPhones)
 * @returns {Promise<AccessControlResult>}
 */
export async function canReceiveMessage(phone, tenantId, config = {}) {
  const whitelistedPhones = normalizePhoneArray(config.whitelistedPhones);
  const blacklistedPhones = normalizePhoneArray(config.blacklistedPhones);

  // Check blacklist first (highest priority)
  if (blacklistedPhones.length > 0 && blacklistedPhones.includes(phone)) {
    logger.info('whatsappAccessControl.blocked.blacklist', { phone, tenantId });
    return new AccessControlResult(false, 'Phone number is blacklisted');
  }

  // Check whitelist (if configured, only allow whitelisted numbers)
  if (whitelistedPhones.length > 0 && !whitelistedPhones.includes(phone)) {
    logger.info('whatsappAccessControl.blocked.not_whitelisted', { phone, tenantId });
    return new AccessControlResult(false, 'Phone number is not whitelisted');
  }

  // Check category-based rules
  const category = await getCategory(phone, tenantId);
  if (category === CATEGORIES.BLOCKED) {
    logger.info('whatsappAccessControl.blocked.category', { phone, tenantId, category });
    return new AccessControlResult(false, 'User category is blocked', category);
  }

  if (category === CATEGORIES.SPAM) {
    logger.info('whatsappAccessControl.blocked.spam', { phone, tenantId, category });
    return new AccessControlResult(false, 'User category is spam', category);
  }

  // Allowed
  logger.debug('whatsappAccessControl.allowed', { phone, tenantId, category });
  return new AccessControlResult(true, '', category);
}

/**
 * Check if AI can send a message to a phone number
 * @param {string} phone - Phone number (normalized, digits only)
 * @param {string} tenantId - Tenant ID
 * @param {string} feature - Feature to check (e.g., FEATURES.AUTO_REPLY)
 * @param {Object} config - AiEmployeeSettings config (whitelistedPhones, blacklistedPhones)
 * @returns {Promise<AccessControlResult>}
 */
export async function canAiSendMessage(phone, tenantId, feature, config = {}) {
  // First check if message can be received at all (also resolves category)
  const receiveCheck = await canReceiveMessage(phone, tenantId, config);
  if (!receiveCheck.allowed) {
    return receiveCheck;
  }

  // Reuse the category from receiveCheck to avoid redundant getCategory call
  const category = receiveCheck.category;
  const featureEnabled = featureToggleService.isFeatureEnabled(feature, category, tenantId);

  if (!featureEnabled) {
    logger.info('whatsappAccessControl.blocked.feature_disabled', { phone, tenantId, category, feature });
    return new AccessControlResult(false, `Feature ${feature} is disabled for category ${category}`, category);
  }

  // Allowed
  logger.debug('whatsappAccessControl.ai_allowed', { phone, tenantId, category, feature });
  return new AccessControlResult(true, '', category);
}

/**
 * Check if WhatsApp sending is enabled for a user
 * @param {string} phone - Phone number (normalized, digits only)
 * @param {string} tenantId - Tenant ID
 * @param {Object} config - AiEmployeeSettings config
 * @returns {Promise<AccessControlResult>}
 */
export async function canSendWhatsApp(phone, tenantId, config = {}) {
  return await canAiSendMessage(phone, tenantId, FEATURES.WHATSAPP_SEND, config);
}

/**
 * Check if auto-reply is enabled for a user
 * @param {string} phone - Phone number (normalized, digits only)
 * @param {string} tenantId - Tenant ID
 * @param {Object} config - AiEmployeeSettings config
 * @returns {Promise<AccessControlResult>}
 */
export async function canAutoReply(phone, tenantId, config = {}) {
  return await canAiSendMessage(phone, tenantId, FEATURES.AUTO_REPLY, config);
}

/**
 * Check if AI qualification is enabled for a user
 * @param {string} phone - Phone number (normalized, digits only)
 * @param {string} tenantId - Tenant ID
 * @param {Object} config - AiEmployeeSettings config
 * @returns {Promise<AccessControlResult>}
 */
export async function canAiQualify(phone, tenantId, config = {}) {
  return await canAiSendMessage(phone, tenantId, FEATURES.AI_QUALIFICATION, config);
}

/**
 * Check if AI routing is enabled for a user
 * @param {string} phone - Phone number (normalized, digits only)
 * @param {string} tenantId - Tenant ID
 * @param {Object} config - AiEmployeeSettings config
 * @returns {Promise<AccessControlResult>}
 */
export async function canAiRoute(phone, tenantId, config = {}) {
  return await canAiSendMessage(phone, tenantId, FEATURES.AI_ROUTING, config);
}

/**
 * Check if AI follow-up is enabled for a user
 * @param {string} phone - Phone number (normalized, digits only)
 * @param {string} tenantId - Tenant ID
 * @param {Object} config - AiEmployeeSettings config
 * @returns {Promise<AccessControlResult>}
 */
export async function canAiFollowup(phone, tenantId, config = {}) {
  return await canAiSendMessage(phone, tenantId, FEATURES.AI_FOLLOWUP, config);
}

/**
 * Get access control summary for a phone number
 * @param {string} phone - Phone number (normalized, digits only)
 * @param {string} tenantId - Tenant ID
 * @param {Object} config - AiEmployeeSettings config
 * @returns {Promise<Object>} Access control summary
 */
export async function getAccessControlSummary(phone, tenantId, config = {}) {
  // Get category once and reuse for all feature checks
  const category = await getCategory(phone, tenantId);
  const whitelistedPhones = normalizePhoneArray(config.whitelistedPhones);
  const blacklistedPhones = normalizePhoneArray(config.blacklistedPhones);

  // Check blacklist/whitelist
  const isBlacklisted = blacklistedPhones.length > 0 && blacklistedPhones.includes(phone);
  const isNotWhitelisted = whitelistedPhones.length > 0 && !whitelistedPhones.includes(phone);
  const canReceive = !isBlacklisted && !isNotWhitelisted && category !== CATEGORIES.BLOCKED && category !== CATEGORIES.SPAM;

  // Check all features using the single category lookup
  const features = [FEATURES.WHATSAPP_SEND, FEATURES.AUTO_REPLY, FEATURES.AI_QUALIFICATION, FEATURES.AI_ROUTING, FEATURES.AI_FOLLOWUP];
  const featureResults = {};
  for (const feature of features) {
    const enabled = canReceive && featureToggleService.isFeatureEnabled(feature, category, tenantId);
    featureResults[feature] = enabled;
  }

  return {
    phone,
    tenantId,
    category,
    canReceive,
    canReceiveReason: isBlacklisted ? 'blacklisted' : isNotWhitelisted ? 'not_whitelisted' : category === CATEGORIES.BLOCKED ? 'blocked_category' : category === CATEGORIES.SPAM ? 'spam_category' : '',
    canSend: featureResults[FEATURES.WHATSAPP_SEND],
    canAutoReply: featureResults[FEATURES.AUTO_REPLY],
    canQualify: featureResults[FEATURES.AI_QUALIFICATION],
    canRoute: featureResults[FEATURES.AI_ROUTING],
    canFollowup: featureResults[FEATURES.AI_FOLLOWUP],
  };
}

export default {
  canReceiveMessage,
  canAiSendMessage,
  canSendWhatsApp,
  canAutoReply,
  canAiQualify,
  canAiRoute,
  canAiFollowup,
  getAccessControlSummary,
  AccessControlResult,
};
