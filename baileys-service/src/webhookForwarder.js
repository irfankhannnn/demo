import crypto from 'crypto';
import axios from 'axios';
import { logger } from './logger.js';

/**
 * Generate HMAC-SHA256 signature for webhook payload.
 * @param {string} rawBody - Raw JSON string of the payload.
 * @param {string} secret - Shared secret for signing.
 * @param {string} timestamp - Unix timestamp as a string.
 * @returns {string} Signature in the format "sha256=<hex>".
 */
export function signWebhook(rawBody, secret, timestamp) {
  if (!secret) return '';
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return `sha256=${expected}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err) {
  if (!err) return false;
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') return true;
  if (err.response && err.response.status >= 500) return true;
  return false;
}

/**
 * Forward a webhook payload to the CRM endpoint.
 * Webhook failures are logged but not re-thrown to avoid blocking
 * incoming message processing.
 * @param {string} url - CRM webhook URL.
 * @param {object} payload - Webhook payload to forward.
 * @param {string} secret - Shared secret for signing the payload.
 * @param {number} maxRetries - Maximum retry attempts (default 3).
 * @returns {Promise<void>}
 */
export async function forwardWebhook(url, payload, secret, maxRetries = 3) {
  const rawBody = JSON.stringify(payload);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signWebhook(rawBody, secret, timestamp);
    try {
      await axios.post(url, rawBody, {
        headers: {
          'Content-Type': 'application/json',
          'x-bailey-signature': signature,
          'x-bailey-timestamp': timestamp,
        },
        timeout: 10000,
      });
      logger.info('webhook.forward.success', { url, messageId: payload.messageId, attempt });
      return;
    } catch (err) {
      const isRetryable = isRetryableError(err);
      const isLastAttempt = attempt === maxRetries;
      if (isRetryable && !isLastAttempt) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        logger.warn('webhook.forward.retry', {
          url,
          messageId: payload.messageId,
          attempt,
          maxRetries,
          delay,
          error: err.message,
          status: err.response?.status,
        });
        await sleep(delay);
      } else {
        logger.error('webhook.forward.failed', {
          url,
          messageId: payload.messageId,
          attempt,
          maxRetries,
          error: err.message,
          status: err.response?.status,
          isRetryable,
        });
        return;
      }
    }
  }
}
