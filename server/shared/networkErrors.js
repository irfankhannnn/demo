/**
 * Shared network error detection constants and helpers.
 *
 * Used by bailey.js (Bailey service client) and routes/auth.js (HTTP error
 * responses) so both layers classify network errors consistently.
 */

// Common Node.js / axios network error codes.
export const NETWORK_ERROR_CODES = [
  'ECONNABORTED',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EAI_AGAIN',
];

// Message heuristic for errors that may not carry a `code` field
// (e.g. wrapped errors, fetch failures, third-party SDKs).
const NETWORK_ERROR_MESSAGE_RE = /network|timeout|connection|socket|dns|resolve/i;

/**
 * Determine whether an error represents a network-level failure
 * (as opposed to an API/auth/logic error).
 *
 * Checks both `err.code` against the known network error codes and
 * `err.message` against a heuristic regex, so errors without a code
 * are still classified correctly.
 *
 * @param {Error & {code?: string}} err
 * @returns {boolean}
 */
export function isNetworkError(err) {
  if (!err) return false;
  if (err.code && NETWORK_ERROR_CODES.includes(err.code)) return true;
  if (err.message && NETWORK_ERROR_MESSAGE_RE.test(err.message)) return true;
  return false;
}
