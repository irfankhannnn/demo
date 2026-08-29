/**
 * Feature Toggle Service (P3.3)
 * 
 * Manages feature toggles for different user categories:
 * - Defines available features
 * - Configures feature availability per category
 * - Provides tenant-level overrides
 * - Checks if a feature is enabled for a category
 */

import { logger } from './logger.js';
import { CATEGORIES } from './userCategoryService.js';

/**
 * Available features
 */
export const FEATURES = {
  AUTO_REPLY: 'auto_reply',
  AI_QUALIFICATION: 'ai_qualification',
  AI_ROUTING: 'ai_routing',
  AI_FOLLOWUP: 'ai_followup',
  WHATSAPP_SEND: 'whatsapp_send',
  EMAIL_SEND: 'email_send',
  CALL_AUTO_DIAL: 'call_auto_dial',
};

/**
 * Default feature availability per category
 */
const DEFAULT_FEATURE_MATRIX = {
  [FEATURES.AUTO_REPLY]: {
    [CATEGORIES.LEAD]: true,
    [CATEGORIES.CUSTOMER]: true,
    [CATEGORIES.SPAM]: false,
    [CATEGORIES.BLOCKED]: false,
    [CATEGORIES.UNKNOWN]: true, // Allow basic auto-reply for unknown users
  },
  [FEATURES.AI_QUALIFICATION]: {
    [CATEGORIES.LEAD]: true,
    [CATEGORIES.CUSTOMER]: false,
    [CATEGORIES.SPAM]: false,
    [CATEGORIES.BLOCKED]: false,
    [CATEGORIES.UNKNOWN]: false, // Restrict AI qualification to known leads only
  },
  [FEATURES.AI_ROUTING]: {
    [CATEGORIES.LEAD]: true,
    [CATEGORIES.CUSTOMER]: false,
    [CATEGORIES.SPAM]: false,
    [CATEGORIES.BLOCKED]: false,
    [CATEGORIES.UNKNOWN]: false, // Restrict AI routing to known leads only
  },
  [FEATURES.AI_FOLLOWUP]: {
    [CATEGORIES.LEAD]: true,
    [CATEGORIES.CUSTOMER]: true,
    [CATEGORIES.SPAM]: false,
    [CATEGORIES.BLOCKED]: false,
    [CATEGORIES.UNKNOWN]: false,
  },
  [FEATURES.WHATSAPP_SEND]: {
    [CATEGORIES.LEAD]: true,
    [CATEGORIES.CUSTOMER]: true,
    [CATEGORIES.SPAM]: false,
    [CATEGORIES.BLOCKED]: false,
    [CATEGORIES.UNKNOWN]: true, // Allow WhatsApp send for unknown users (manual)
  },
  [FEATURES.EMAIL_SEND]: {
    [CATEGORIES.LEAD]: true,
    [CATEGORIES.CUSTOMER]: true,
    [CATEGORIES.SPAM]: false,
    [CATEGORIES.BLOCKED]: false,
    [CATEGORIES.UNKNOWN]: false, // Restrict email send to known users only
  },
  [FEATURES.CALL_AUTO_DIAL]: {
    [CATEGORIES.LEAD]: true,
    [CATEGORIES.CUSTOMER]: false,
    [CATEGORIES.SPAM]: false,
    [CATEGORIES.BLOCKED]: false,
    [CATEGORIES.UNKNOWN]: false,
  },
};

/**
 * Feature Toggle Service
 */
class FeatureToggleService {
  constructor() {
    this.tenantOverrides = new Map(); // tenantId -> { feature -> boolean }
    this.customMatrix = new Map(); // tenantId -> { feature -> { category -> boolean } }
  }

  /**
   * Set tenant-level override for a feature
   * @param {string} tenantId
   * @param {string} feature
   * @param {boolean} enabled
   */
  setTenantOverride(tenantId, feature, enabled) {
    if (!Object.values(FEATURES).includes(feature)) {
      throw new Error(`Invalid feature: ${feature}`);
    }

    if (!this.tenantOverrides.has(tenantId)) {
      this.tenantOverrides.set(tenantId, {});
    }
    this.tenantOverrides.get(tenantId)[feature] = enabled;
    logger.info('featureToggle.setTenantOverride', { tenantId, feature, enabled });
  }

  /**
   * Set custom feature matrix for a tenant
   * @param {string} tenantId
   * @param {Object} matrix - { feature -> { category -> boolean } }
   */
  setCustomMatrix(tenantId, matrix) {
    this.customMatrix.set(tenantId, matrix);
    logger.info('featureToggle.setCustomMatrix', { tenantId });
  }

  /**
   * Check if a feature is enabled for a category
   * @param {string} feature
   * @param {string} category
   * @param {string} tenantId
   * @returns {boolean}
   */
  isFeatureEnabled(feature, category, tenantId) {
    // Check tenant override first (highest priority)
    const overrides = this.tenantOverrides.get(tenantId);
    if (overrides && feature in overrides) {
      return overrides[feature];
    }

    // Check custom matrix (medium priority)
    const customMatrix = this.customMatrix.get(tenantId);
    if (customMatrix && feature in customMatrix) {
      const categoryConfig = customMatrix[feature];
      if (categoryConfig && category in categoryConfig) {
        return categoryConfig[category];
      }
    }

    // Check default matrix (lowest priority)
    const defaultConfig = DEFAULT_FEATURE_MATRIX[feature];
    if (defaultConfig && category in defaultConfig) {
      return defaultConfig[category];
    }

    // Default to false if not configured
    return false;
  }

  /**
   * Get all enabled features for a category
   * @param {string} category
   * @param {string} tenantId
   * @returns {Array<string>} Array of enabled feature names
   */
  getEnabledFeatures(category, tenantId) {
    return Object.values(FEATURES).filter(feature =>
      this.isFeatureEnabled(feature, category, tenantId)
    );
  }

  /**
   * Get feature configuration for a tenant
   * @param {string} tenantId
   * @returns {Object} Feature configuration
   */
  getTenantConfig(tenantId) {
    return {
      tenantId,
      overrides: this.tenantOverrides.get(tenantId) || {},
      customMatrix: this.customMatrix.get(tenantId) || {},
      defaultMatrix: DEFAULT_FEATURE_MATRIX,
    };
  }

  /**
   * Reset tenant configuration to defaults
   * @param {string} tenantId
   */
  resetTenantConfig(tenantId) {
    this.tenantOverrides.delete(tenantId);
    this.customMatrix.delete(tenantId);
    logger.info('featureToggle.resetTenantConfig', { tenantId });
  }
}

// Singleton instance
const service = new FeatureToggleService();

export default service;
export { DEFAULT_FEATURE_MATRIX };
