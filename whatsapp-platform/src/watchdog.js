/**
 * Watchdog Module (P1.3)
 * 
 * Detects and handles stale connections:
 * - Monitors connection inactivity
 * - Detects hung sockets
 * - Triggers reconnection on stale detection
 * - Tracks connection health metrics
 */

import { logger } from './logger.js';

const DEFAULT_INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes (per plan)
const DEFAULT_HEARTBEAT_INTERVAL = 60 * 1000; // 60 seconds (per plan)
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Connection watchdog for detecting stale connections
 */
export class ConnectionWatchdog {
  constructor(phone, options = {}) {
    this.phone = phone;
    this.inactivityTimeout = options.inactivityTimeout || DEFAULT_INACTIVITY_TIMEOUT;
    this.heartbeatInterval = options.heartbeatInterval || DEFAULT_HEARTBEAT_INTERVAL;
    this.maxConsecutiveFailures = options.maxConsecutiveFailures || DEFAULT_MAX_CONSECUTIVE_FAILURES;

    this.lastActivityTime = Date.now();
    this.heartbeatTimer = null;
    this.inactivityTimer = null;
    this.consecutiveFailures = 0;
    this.isHealthy = true;
    this.onStaleDetected = null;
    this.staleDetectedAt = null; // Debounce: prevent double-calling onStaleDetected
    this.metrics = {
      totalHeartbeats: 0,
      failedHeartbeats: 0,
      lastHeartbeatTime: null,
      inactivityDetections: 0,
    };
  }

  /**
   * Record activity (message sent/received)
   */
  recordActivity() {
    this.lastActivityTime = Date.now();
    this.consecutiveFailures = 0;
    this.staleDetectedAt = null; // Reset debounce on activity
    if (!this.isHealthy) {
      logger.info({ phone: this.phone }, 'watchdog.connection.recovered');
      this.isHealthy = true;
    }
    // Reset the inactivity timer so it counts from this activity
    this.resetInactivityTimer();
  }

  /**
   * Start monitoring connection health
   * @param {Function} onStaleDetected - callback when stale connection detected
   */
  start(onStaleDetected) {
    // Clear any existing timers first to prevent leaks from multiple start() calls
    this.stop();
    this.onStaleDetected = onStaleDetected;
    this.lastActivityTime = Date.now();
    this.staleDetectedAt = null;
    this.startHeartbeat();
    this.startInactivityTimer();
    logger.debug({ phone: this.phone }, 'watchdog.started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    this.onStaleDetected = null;
    logger.debug({ phone: this.phone }, 'watchdog.stopped');
  }

  /**
   * Start periodic heartbeat checks
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.heartbeatInterval);
  }

  /**
   * Perform a heartbeat check
   */
  performHeartbeat() {
    this.metrics.totalHeartbeats++;
    const timeSinceLastActivity = Date.now() - this.lastActivityTime;

    // If no activity for longer than inactivity timeout, mark as stale
    if (timeSinceLastActivity > this.inactivityTimeout) {
      this.consecutiveFailures++;
      this.metrics.failedHeartbeats++;

      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        this.isHealthy = false;
        this.metrics.inactivityDetections++;
        logger.warn(
          {
            phone: this.phone,
            inactivityMs: timeSinceLastActivity,
            consecutiveFailures: this.consecutiveFailures,
          },
          'watchdog.stale_connection.detected'
        );
        this.triggerStaleDetection();
      }
    } else {
      this.consecutiveFailures = 0;
    }

    this.metrics.lastHeartbeatTime = new Date().toISOString();
  }

  /**
   * Trigger stale detection with debounce to prevent double-calling
   */
  triggerStaleDetection() {
    // Debounce: only call once until activity resets it
    if (this.staleDetectedAt) return;
    this.staleDetectedAt = Date.now();
    if (this.onStaleDetected) {
      this.onStaleDetected();
    }
  }

  /**
   * Start inactivity timer (resets on activity)
   */
  startInactivityTimer() {
    const resetTimer = () => {
      if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
      this.inactivityTimer = setTimeout(() => {
        const timeSinceLastActivity = Date.now() - this.lastActivityTime;
        if (timeSinceLastActivity > this.inactivityTimeout) {
          logger.warn(
            { phone: this.phone, inactivityMs: timeSinceLastActivity },
            'watchdog.inactivity_timeout'
          );
          this.triggerStaleDetection();
        }
        resetTimer();
      }, this.inactivityTimeout);
    };
    resetTimer();
  }

  /**
   * Reset the inactivity timer (called on activity)
   */
  resetInactivityTimer() {
    if (this.inactivityTimer) {
      this.startInactivityTimer();
    }
  }

  /**
   * Get current health status
   * @returns {Object}
   */
  getStatus() {
    return {
      phone: this.phone,
      isHealthy: this.isHealthy,
      timeSinceLastActivity: Date.now() - this.lastActivityTime,
      consecutiveFailures: this.consecutiveFailures,
      metrics: this.metrics,
    };
  }

  /**
   * Get detailed diagnostics
   * @returns {Object}
   */
  getDiagnostics() {
    const status = this.getStatus();
    return {
      ...status,
      thresholds: {
        inactivityTimeout: this.inactivityTimeout,
        heartbeatInterval: this.heartbeatInterval,
        maxConsecutiveFailures: this.maxConsecutiveFailures,
      },
      healthScore: this.calculateHealthScore(),
    };
  }

  /**
   * Calculate a health score (0-100)
   * @returns {number}
   */
  calculateHealthScore() {
    if (!this.isHealthy) return 0;
    if (this.metrics.totalHeartbeats === 0) return 100;

    const successRate = (this.metrics.totalHeartbeats - this.metrics.failedHeartbeats) / this.metrics.totalHeartbeats;
    const baseScore = successRate * 100;
    const failureAdjustment = this.consecutiveFailures * 10;
    return Math.max(0, Math.min(100, baseScore - failureAdjustment));
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalHeartbeats: 0,
      failedHeartbeats: 0,
      lastHeartbeatTime: null,
      inactivityDetections: 0,
    };
    this.consecutiveFailures = 0;
    this.isHealthy = true;
    logger.debug({ phone: this.phone }, 'watchdog.metrics.reset');
  }
}

export default ConnectionWatchdog;
