// Structured error taxonomy for Instagram Graph responses.
//
// Every Graph failure is classified into exactly one `kind`, and callers react
// to the kind, never to a raw code. Ported from the laptop agent's
// runtime/errors.js so the hosted service keeps the same rules:
//
//   - a rate-limit code (4 / 613 / 80007 / 2018001) stops that job until the
//     next run; it is never retried in a loop
//   - a messaging-window error downgrades the thread to CLOSED; the send is
//     never retried, because retrying a blocked send is what gets accounts flagged
//   - an auth error marks the account as needing reconnection

export const ERROR_KIND = {
  RATE_LIMIT: 'RATE_LIMIT',
  WINDOW_BLOCKED: 'WINDOW_BLOCKED',
  AUTH: 'AUTH',
  PERMISSION: 'PERMISSION',
  NOT_FOUND: 'NOT_FOUND',
  METRIC_UNAVAILABLE: 'METRIC_UNAVAILABLE',
  TRANSIENT: 'TRANSIENT',
  VALIDATION: 'VALIDATION',
  UNKNOWN: 'UNKNOWN',
};

export const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80007, 2018001]);

/** Outside the 24h / 7d messaging window. Downgrade, never retry. */
export const WINDOW_ERROR_CODES = new Set([551, 2018278, 2534022]);
export const WINDOW_ERROR_SUBCODES = new Set([2534022, 2018278, 1545041]);

/** Token is gone or invalid - the account needs reconnecting. */
export const AUTH_ERROR_CODES = new Set([102, 190, 463, 467, 2500]);

/** Scope or capability missing. */
export const PERMISSION_ERROR_CODES = new Set([3, 10, 200, 803]);

/** Meta's own "try again" codes. */
export const TRANSIENT_ERROR_CODES = new Set([1, 2, 341, 368]);

export class MetaApiError extends Error {
  constructor(message, fields = {}) {
    super(message);
    this.name = 'MetaApiError';
    Object.assign(this, fields);
  }
}

/**
 * True when the message reads as "this metric does not exist any more". Meta
 * reports removed metrics as ordinary parameter errors, so string matching is
 * the only signal available.
 */
export function isMetricUnavailable(message = '') {
  const m = String(message).toLowerCase();
  return (
    m.includes('does not support the metric') ||
    m.includes('is not supported for this') ||
    m.includes('metric[0] must be one of') ||
    (m.includes('invalid') && m.includes('metric')) ||
    m.includes('deprecated')
  );
}

/** The metric names Meta complained about, so a caller can retry without them. */
export function extractBadMetrics(message = '', requested = []) {
  const m = String(message).toLowerCase();
  return requested.filter((metric) => m.includes(metric.toLowerCase()));
}

/**
 * @param {object} payload - the `error` object Meta returns (or the OAuth
 *   endpoint's flat { error_type, code, error_message })
 * @param {number} httpStatus
 */
export function classifyMetaError(payload = {}, httpStatus = 0) {
  const code = Number(payload.code ?? payload.error_code ?? 0);
  const subcode = Number(payload.error_subcode ?? 0);
  const message =
    payload.message || payload.error_message || payload.error_user_msg || payload.error_description || 'Instagram API error';

  let kind = ERROR_KIND.UNKNOWN;
  if (RATE_LIMIT_CODES.has(code) || httpStatus === 429) {
    kind = ERROR_KIND.RATE_LIMIT;
  } else if (WINDOW_ERROR_CODES.has(code) || WINDOW_ERROR_SUBCODES.has(subcode)) {
    kind = ERROR_KIND.WINDOW_BLOCKED;
  } else if (AUTH_ERROR_CODES.has(code)) {
    kind = ERROR_KIND.AUTH;
  } else if (PERMISSION_ERROR_CODES.has(code)) {
    kind = ERROR_KIND.PERMISSION;
  } else if (TRANSIENT_ERROR_CODES.has(code) || httpStatus >= 500) {
    kind = ERROR_KIND.TRANSIENT;
  } else if (code === 100) {
    kind = isMetricUnavailable(message) ? ERROR_KIND.METRIC_UNAVAILABLE : ERROR_KIND.VALIDATION;
  } else if (httpStatus === 404) {
    kind = ERROR_KIND.NOT_FOUND;
  } else if (httpStatus === 401) {
    kind = ERROR_KIND.AUTH;
  } else if (httpStatus >= 400 && httpStatus < 500) {
    kind = ERROR_KIND.VALIDATION;
  }

  return new MetaApiError(message, {
    kind,
    code,
    subcode,
    httpStatus,
    fbtraceId: payload.fbtrace_id ?? null,
  });
}

export default { ERROR_KIND, MetaApiError, classifyMetaError, isMetricUnavailable, extractBadMetrics };
