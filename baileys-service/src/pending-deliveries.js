/**
 * Pending Deliveries Queue Module (P2.2)
 * 
 * Queues messages during reconnection and delivers them when connection is restored:
 * - Queue messages when connection is not ready
 * - Drain queue when connection is established
 * - Retry failed deliveries with backoff
 * - Limit queue size to prevent memory bloat
 */

import { logger } from './logger.js';

const DEFAULT_MAX_QUEUE_SIZE = 1000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 5000; // 5 seconds
const DEFAULT_MAX_DRAIN_DURATION = 60000; // 60 seconds max drain time
const DEFAULT_MAX_MESSAGE_AGE = 24 * 60 * 60 * 1000; // 24 hours — discard stale messages

/**
 * Pending delivery item
 */
class PendingDelivery {
  constructor(id, phone, to, text, media = null) {
    this.id = id;
    this.phone = phone;
    this.to = to;
    this.text = text;
    this.media = media;
    this.attempts = 0;
    this.createdAt = Date.now();
    this.lastAttemptAt = null;
  }
}

/**
 * Pending deliveries queue manager
 */
export class PendingDeliveriesQueue {
  constructor(phone, options = {}) {
    this.phone = phone;
    this.maxQueueSize = options.maxQueueSize || DEFAULT_MAX_QUEUE_SIZE;
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.retryDelay = options.retryDelay || DEFAULT_RETRY_DELAY;
    this.maxDrainDuration = options.maxDrainDuration || DEFAULT_MAX_DRAIN_DURATION;
    this.maxMessageAge = options.maxMessageAge || DEFAULT_MAX_MESSAGE_AGE;

    this.queue = [];
    this.isDraining = false;
  }

  /**
   * Add a message to the pending queue
   * @param {string} id - Unique message ID
   * @param {string} phone - Session phone
   * @param {string} to - Recipient
   * @param {string} text - Message text
   * @param {Object} media - Optional media
   * @returns {boolean} true if added, false if queue is full
   */
  enqueue(id, phone, to, text, media = null) {
    if (this.queue.length >= this.maxQueueSize) {
      logger.warn({ phone: this.phone, queueSize: this.queue.length }, 'pending_deliveries.queue_full');
      return false;
    }

    const delivery = new PendingDelivery(id, phone, to, text, media);
    this.queue.push(delivery);
    logger.debug({ phone: this.phone, id, queueSize: this.queue.length }, 'pending_deliveries.enqueued');
    return true;
  }

  /**
   * Drain the queue by attempting to deliver all pending messages
   * @param {Function} sendFn - Function to send message (signature: (phone, to, text, media) => Promise)
   * @returns {Promise<{ success: number, failed: number }>}
   */
  async drain(sendFn) {
    if (this.isDraining || this.queue.length === 0) {
      return { success: 0, failed: 0 };
    }

    this.isDraining = true;
    let success = 0;
    let failed = 0;
    const drainStartTime = Date.now();

    logger.info({ phone: this.phone, queueSize: this.queue.length }, 'pending_deliveries.drain_start');

    try {
      while (this.queue.length > 0) {
        // Check max drain duration to prevent blocking too long
        if (Date.now() - drainStartTime > this.maxDrainDuration) {
          logger.warn(
            { phone: this.phone, remaining: this.queue.length },
            'pending_deliveries.drain_timeout'
          );
          break;
        }

        const delivery = this.queue.shift();

        // Check if message is too old (TTL)
        const messageAge = Date.now() - delivery.createdAt;
        if (messageAge > this.maxMessageAge) {
          failed++;
          logger.warn(
            { phone: this.phone, id: delivery.id, ageMs: messageAge },
            'pending_deliveries.expired'
          );
          continue;
        }

        try {
          await sendFn(delivery.phone, delivery.to, delivery.text, delivery.media);
          success++;
          logger.debug({ phone: this.phone, id: delivery.id }, 'pending_deliveries.delivered');
        } catch (err) {
          delivery.attempts++;
          delivery.lastAttemptAt = Date.now();

          if (delivery.attempts < this.maxRetries) {
            // Re-queue for retry
            this.queue.push(delivery);
            logger.warn({ phone: this.phone, id: delivery.id, attempt: delivery.attempts }, 'pending_deliveries.retry');
            // Only delay if this was the last message (about to retry the same one)
            if (this.queue.length === 1) {
              await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            }
          } else {
            failed++;
            logger.error({ phone: this.phone, id: delivery.id, error: err.message }, 'pending_deliveries.failed');
          }
        }
      }
    } finally {
      this.isDraining = false;
    }

    logger.info({ phone: this.phone, success, failed }, 'pending_deliveries.drain_complete');
    return { success, failed };
  }

  /**
   * Get queue size
   * @returns {number}
   */
  size() {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   * @returns {boolean}
   */
  isEmpty() {
    return this.queue.length === 0;
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue = [];
    logger.info({ phone: this.phone }, 'pending_deliveries.cleared');
  }

  /**
   * Get queue statistics
   * @returns {Object}
   */
  getStats() {
    return {
      phone: this.phone,
      queueSize: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      isDraining: this.isDraining,
      oldestMessageAge: this.queue.length > 0 ? Date.now() - this.queue[0].createdAt : 0,
    };
  }
}

export default PendingDeliveriesQueue;
