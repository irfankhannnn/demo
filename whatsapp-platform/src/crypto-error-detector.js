/**
 * Crypto Error Detector Module (P1.2)
 * 
 * Classifies and analyzes cryptographic errors:
 * - Detects PreKey errors (invalid ID, exhaustion)
 * - Detects MAC errors (decryption failures)
 * - Detects session errors (no matching sessions)
 * - Provides recovery recommendations
 * - Tracks error patterns for diagnostics
 */

import { logger } from './logger.js';

/**
 * Error classification types
 */
export const ERROR_TYPES = {
  PREKEY_INVALID: 'prekey_invalid',
  PREKEY_EXHAUSTED: 'prekey_exhausted',
  BAD_MAC: 'bad_mac',
  NO_MATCHING_SESSION: 'no_matching_session',
  DECRYPTION_FAILED: 'decryption_failed',
  SIGNATURE_MISMATCH: 'signature_mismatch',
  UNKNOWN: 'unknown',
};

/**
 * Recovery recommendations for each error type
 */
const RECOVERY_RECOMMENDATIONS = {
  [ERROR_TYPES.PREKEY_INVALID]: {
    severity: 'high',
    action: 'request_new_prekeys',
    description: 'Invalid PreKey ID - request new PreKeys from server',
  },
  [ERROR_TYPES.PREKEY_EXHAUSTED]: {
    severity: 'critical',
    action: 'force_relink',
    description: 'PreKey exhaustion - requires full re-link',
  },
  [ERROR_TYPES.BAD_MAC]: {
    severity: 'high',
    action: 'refresh_session',
    description: 'MAC verification failed - session keys out of sync',
  },
  [ERROR_TYPES.NO_MATCHING_SESSION]: {
    severity: 'high',
    action: 'request_new_prekeys',
    description: 'No matching session - request new PreKeys',
  },
  [ERROR_TYPES.DECRYPTION_FAILED]: {
    severity: 'medium',
    action: 'retry_message',
    description: 'Message decryption failed - retry or skip',
  },
  [ERROR_TYPES.SIGNATURE_MISMATCH]: {
    severity: 'high',
    action: 'refresh_session',
    description: 'Signature mismatch - session integrity compromised',
  },
  [ERROR_TYPES.UNKNOWN]: {
    severity: 'low',
    action: 'log_and_monitor',
    description: 'Unknown crypto error - log for analysis',
  },
};

/**
 * Detect error type from error message
 * @param {Error|string} error
 * @returns {string} error type from ERROR_TYPES
 */
export function detectErrorType(error) {
  const message = String(error?.message || error || '').toLowerCase();

  // Check EXHAUSTED before INVALID to handle overlapping messages correctly
  if (message.includes('prekey') && message.includes('exhausted')) return ERROR_TYPES.PREKEY_EXHAUSTED;
  if (message.includes('invalid prekey id')) return ERROR_TYPES.PREKEY_INVALID;
  if (message.includes('bad mac') || message.includes('mac verification')) return ERROR_TYPES.BAD_MAC;
  if (message.includes('no matching session')) return ERROR_TYPES.NO_MATCHING_SESSION;
  if (message.includes('decrypt') && message.includes('fail')) return ERROR_TYPES.DECRYPTION_FAILED;
  if (message.includes('signature') && message.includes('mismatch')) return ERROR_TYPES.SIGNATURE_MISMATCH;

  return ERROR_TYPES.UNKNOWN;
}

/**
 * Get recovery recommendation for an error
 * @param {string} errorType
 * @returns {Object}
 */
export function getRecoveryRecommendation(errorType) {
  return RECOVERY_RECOMMENDATIONS[errorType] || RECOVERY_RECOMMENDATIONS[ERROR_TYPES.UNKNOWN];
}

/**
 * Crypto error detector and analyzer
 */
export class CryptoErrorDetector {
  constructor(phone) {
    this.phone = phone;
    this.errorHistory = [];
    this.MAX_HISTORY = 100;
  }

  /**
   * Analyze an error and log diagnostics
   * @param {Error} error
   * @returns {Object} error analysis
   */
  analyzeError(error) {
    const errorType = detectErrorType(error);
    const recommendation = getRecoveryRecommendation(errorType);
    const analysis = {
      timestamp: new Date().toISOString(),
      phone: this.phone,
      errorType,
      message: error?.message || String(error),
      severity: recommendation.severity,
      action: recommendation.action,
      description: recommendation.description,
    };

    // Track in history
    this.addToHistory(analysis);

    // Log based on severity
    if (recommendation.severity === 'critical') {
      logger.error(analysis, 'crypto_error.critical');
    } else if (recommendation.severity === 'high') {
      logger.warn(analysis, 'crypto_error.high');
    } else {
      logger.info(analysis, 'crypto_error.detected');
    }

    return analysis;
  }

  /**
   * Add error to history (capped at MAX_HISTORY)
   * @param {Object} errorAnalysis
   */
  addToHistory(errorAnalysis) {
    this.errorHistory.push(errorAnalysis);
    if (this.errorHistory.length > this.MAX_HISTORY) {
      this.errorHistory.shift();
    }
  }

  /**
   * Get error pattern analysis
   * @returns {Object}
   */
  getErrorPattern() {
    if (this.errorHistory.length === 0) {
      return { pattern: 'none', count: 0 };
    }

    const typeCounts = {};
    this.errorHistory.forEach(err => {
      typeCounts[err.errorType] = (typeCounts[err.errorType] || 0) + 1;
    });

    const mostCommon = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    const pattern = mostCommon ? mostCommon[0] : 'unknown';
    const count = mostCommon ? mostCommon[1] : 0;

    return {
      pattern,
      count,
      totalErrors: this.errorHistory.length,
      typeCounts,
      lastError: this.errorHistory[this.errorHistory.length - 1],
    };
  }

  /**
   * Check if error pattern indicates critical issue
   * @returns {boolean}
   */
  isCriticalPattern() {
    const pattern = this.getErrorPattern();
    // Critical if: (1) PreKey exhaustion detected, or (2) > 5 errors in last 10 entries
    const recentErrors = this.errorHistory.slice(-10);
    const criticalCount = recentErrors.filter(e => e.severity === 'critical').length;
    return pattern.pattern === ERROR_TYPES.PREKEY_EXHAUSTED || criticalCount > 0;
  }

  /**
   * Reset error history
   */
  reset() {
    this.errorHistory = [];
    logger.debug({ phone: this.phone }, 'crypto_error.history.reset');
  }

  /**
   * Get detailed diagnostics
   * @returns {Object}
   */
  getDiagnostics() {
    return {
      phone: this.phone,
      totalErrors: this.errorHistory.length,
      pattern: this.getErrorPattern(),
      isCritical: this.isCriticalPattern(),
      recentErrors: this.errorHistory.slice(-5),
      allErrors: this.errorHistory,
    };
  }
}

export default CryptoErrorDetector;
