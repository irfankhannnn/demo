/**
 * Reconnect Policy Module (P1.4)
 * 
 * Implements exponential backoff with jitter for reconnection:
 * - Calculates backoff delay based on attempt count
 * - Adds jitter to prevent thundering herd
 * - Detects non-retryable errors
 * - Tracks reconnection metrics
 */

import { logger } from './logger.js';

const DEFAULT_BASE_DELAY = 2000; // 2 seconds (per plan)
const DEFAULT_MAX_DELAY = 30000; // 30 seconds (per plan)
const DEFAULT_MULTIPLIER = 1.8; // per plan
const DEFAULT_JITTER_FACTOR = 0.25; // 25% jitter (per plan)
const DEFAULT_MAX_ATTEMPTS = 12; // per plan

// Extended backoff for rate-limit (429) errors: min 60s, max 300s
const RATE_LIMIT_MIN_DELAY = 60000;
const RATE_LIMIT_MAX_DELAY = 300000;

// Extended backoff for network errors: max 60s
const NETWORK_ERROR_MAX_DELAY = 60000;

const NETWORK_ERROR_CODES = new Set(['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH']);

/**
 * Non-retryable error codes (from Baileys/WhatsApp)
 * 429 is NOT here — it uses extended backoff instead.
 */
const NON_RETRYABLE_ERRORS = {
  401: 'unauthorized', // Invalid credentials / logged out
  403: 'forbidden', // Account locked
  405: 'method_not_allowed',
  440: 'conflict', // Session conflict — stop immediately
  loggedOut: 'logged_out', // User logged out
  invalidSession: 'invalid_session',
  deviceRemoved: 'device_removed',
};

/**
 * Check if an error is a rate-limit error (429)
 * @param {Error|number} error
 * @returns {boolean}
 */
export function isRateLimitError(error) {
  if (!error) return false;
  const statusCode = error?.output?.statusCode || error?.statusCode;
  return statusCode === 429;
}

/**
 * Check if an error is a network partition error
 * @param {Error|number} error
 * @returns {boolean}
 */
export function isNetworkError(error) {
  if (!error) return false;
  const code = error?.code || error?.errno;
  return NETWORK_ERROR_CODES.has(code);
}

/**
 * Determine if an error is retryable
 * @param {Error|number} error
 * @returns {boolean}
 */
export function isRetryableError(error) {
  if (!error) return true;

  const statusCode = error?.output?.statusCode || error?.statusCode;
  const message = String(error?.message || error || '').toLowerCase();

  // Check status codes (429 is retryable with extended backoff)
  if (statusCode && NON_RETRYABLE_ERRORS[statusCode]) {
    return false;
  }

  // Check error messages
  if (message.includes('logged out') || message.includes('invalid session')) {
    return false;
  }

  return true;
}

/**
 * Reconnection policy with exponential backoff and jitter
 */
export class ReconnectPolicy {
  constructor(options = {}) {
    this.baseDelay = options.baseDelay || DEFAULT_BASE_DELAY;
    this.maxDelay = options.maxDelay || DEFAULT_MAX_DELAY;
    this.multiplier = options.multiplier || DEFAULT_MULTIPLIER;
    this.jitterFactor = options.jitterFactor || DEFAULT_JITTER_FACTOR;

    this.attemptCount = 0;
    this.lastAttemptTime = null;
    this.lastError = null;
    this.metrics = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      totalBackoffTime: 0,
    };
  }

  /**
   * Calculate next backoff delay with exponential backoff and jitter
   * @param {number} attemptNumber - 0-based attempt number
   * @returns {number} delay in milliseconds
   */
  calculateDelay(attemptNumber = this.attemptCount) {
    // Exponential backoff: baseDelay * multiplier^attemptNumber
    const exponentialDelay = this.baseDelay * Math.pow(this.multiplier, attemptNumber);
    let maxDelay = this.maxDelay;

    // Use extended backoff for rate-limit and network errors
    if (this.lastError && isRateLimitError(this.lastError)) {
      maxDelay = RATE_LIMIT_MAX_DELAY;
    } else if (this.lastError && isNetworkError(this.lastError)) {
      maxDelay = NETWORK_ERROR_MAX_DELAY;
    }

    const cappedDelay = Math.min(exponentialDelay, maxDelay);

    // Add jitter: ±jitterFactor% of the delay
    const jitterAmount = cappedDelay * this.jitterFactor;
    const jitter = (Math.random() - 0.5) * 2 * jitterAmount;
    const finalDelay = Math.max(0, cappedDelay + jitter);

    return Math.round(finalDelay);
  }

  /**
   * Peek at the next delay WITHOUT side effects (for logging/diagnostics)
   * @returns {number} delay in milliseconds
   */
  peekNextDelay() {
    return this.calculateDelay(this.attemptCount);
  }

  /**
   * Get delay for next reconnection attempt (increments metrics)
   * @returns {number} delay in milliseconds
   */
  getNextDelay() {
    const delay = this.calculateDelay(this.attemptCount);
    this.metrics.totalBackoffTime += delay;
    return delay;
  }

  /**
   * Record a reconnection attempt
   * @param {boolean} success
   * @param {Error} error
   */
  recordAttempt(success, error = null) {
    this.metrics.totalAttempts++;
    if (success) {
      this.metrics.successfulAttempts++;
      this.lastError = null;
      this.reset();
    } else {
      this.metrics.failedAttempts++;
      this.lastError = error;
      this.attemptCount++;
      this.lastAttemptTime = Date.now();

      const isRetryable = isRetryableError(error);
      logger.warn(
        {
          attemptNumber: this.attemptCount,
          isRetryable,
          isRateLimit: isRateLimitError(error),
          isNetworkError: isNetworkError(error),
          error: error?.message,
          nextDelay: this.peekNextDelay(),
        },
        'reconnect_policy.attempt_failed'
      );
    }
  }

  /**
   * Check if should continue retrying
   * @param {number} maxAttempts
   * @returns {boolean}
   */
  shouldRetry(maxAttempts = DEFAULT_MAX_ATTEMPTS) {
    return this.attemptCount < maxAttempts;
  }

  /**
   * Reset policy (called on successful connection)
   */
  reset() {
    logger.debug({ previousAttempts: this.attemptCount }, 'reconnect_policy.reset');
    this.attemptCount = 0;
    this.lastAttemptTime = null;
  }

  /**
   * Get current policy state
   * @returns {Object}
   */
  getState() {
    return {
      attemptCount: this.attemptCount,
      lastAttemptTime: this.lastAttemptTime,
      nextDelay: this.peekNextDelay(),
      metrics: this.metrics,
    };
  }

  /**
   * Get detailed diagnostics
   * @returns {Object}
   */
  getDiagnostics() {
    const state = this.getState();
    const successRate = this.metrics.totalAttempts > 0
      ? (this.metrics.successfulAttempts / this.metrics.totalAttempts) * 100
      : 0;

    return {
      ...state,
      config: {
        baseDelay: this.baseDelay,
        maxDelay: this.maxDelay,
        multiplier: this.multiplier,
        jitterFactor: this.jitterFactor,
      },
      successRate: successRate.toFixed(2) + '%',
      averageBackoffTime: this.metrics.totalAttempts > 0
        ? Math.round(this.metrics.totalBackoffTime / this.metrics.totalAttempts)
        : 0,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      totalBackoffTime: 0,
    };
    logger.debug({}, 'reconnect_policy.metrics.reset');
  }
}

export default ReconnectPolicy;
