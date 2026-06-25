import { NODE_ENV } from '../config.js';

/**
 * Return a production-safe error message.
 * @param {Error} err
 * @param {string} fallbackCode
 * @returns {string}
 */
export function safeError(err, fallbackCode) {
  return NODE_ENV === 'production'
    ? fallbackCode
    : (err?.message || fallbackCode);
}
