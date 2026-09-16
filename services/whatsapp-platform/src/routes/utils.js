import { NODE_ENV } from '../config.js';

/**
 * Return a safe error message.
 * In production, returns the fallback to avoid leaking internals.
 */
export function safeError(err, fallback = 'internal_error') {
  if (NODE_ENV === 'production') return fallback;
  return err?.message || fallback;
}
