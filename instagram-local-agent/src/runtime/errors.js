/**
 * A13 - structured error taxonomy for Meta Graph responses.
 *
 * Every Graph failure is classified into exactly one `kind`, and the caller
 * reacts to the kind, never to a raw code. Four codes get special treatment
 * because ARCHITECTURE section 7 names them:
 *
 *   4        application request limit reached
 *   613      calls to this api have exceeded the rate limit
 *   80007    Instagram API rate limit
 *   2018001  messaging rate/eligibility limit
 *
 * Any of those halts its bucket until the next window. That is a hard rule, not
 * a heuristic: continuing to hammer a rate-limited endpoint is the pattern that
 * gets accounts flagged.
 *
 * Window errors are the other load-bearing kind. On a window error the sender
 * DOWNGRADES the thread's state; it never retries. Retrying a blocked send is
 * exactly what we promise the customer we do not do.
 */

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

/** The four codes from ARCHITECTURE section 7 that halt a bucket. */
export const BUCKET_HALTING_CODES = new Set([4, 613, 80007, 2018001]);

/** Outside the 24h / 7d messaging window. Downgrade, never retry. */
export const WINDOW_ERROR_CODES = new Set([551, 2018278, 2534022]);
export const WINDOW_ERROR_SUBCODES = new Set([2534022, 2018278, 1545041]);

/** Token is gone or invalid - the account needs reconnecting. */
export const AUTH_ERROR_CODES = new Set([102, 190, 463, 467, 2500]);

/** Scope or capability missing. */
export const PERMISSION_ERROR_CODES = new Set([3, 10, 200, 803]);

/** Meta's own "try again" codes. */
export const TRANSIENT_ERROR_CODES = new Set([1, 2, 341, 368]);

export class MetaError extends Error {
  constructor(message, fields = {}) {
    super(message);
    this.name = 'MetaError';
    Object.assign(this, fields);
  }
}

/**
 * Classify a Graph error payload.
 * @param {object} payload - the `error` object Meta returns
 * @param {number} httpStatus
 */
export function classify(payload = {}, httpStatus = 0) {
  const code = Number(payload.code ?? payload.error_code ?? 0);
  const subcode = Number(payload.error_subcode ?? 0);
  const message = payload.message || payload.error_user_msg || 'Instagram Graph error';
  const type = payload.type || null;

  let kind = ERROR_KIND.UNKNOWN;
  let retryable = false;
  let haltsBucket = false;

  if (BUCKET_HALTING_CODES.has(code)) {
    kind = ERROR_KIND.RATE_LIMIT;
    haltsBucket = true;
  } else if (WINDOW_ERROR_CODES.has(code) || WINDOW_ERROR_SUBCODES.has(subcode)) {
    kind = ERROR_KIND.WINDOW_BLOCKED;
  } else if (AUTH_ERROR_CODES.has(code)) {
    kind = ERROR_KIND.AUTH;
  } else if (httpStatus === 429) {
    kind = ERROR_KIND.RATE_LIMIT;
    haltsBucket = true;
  } else if (PERMISSION_ERROR_CODES.has(code)) {
    kind = ERROR_KIND.PERMISSION;
  } else if (TRANSIENT_ERROR_CODES.has(code) || httpStatus >= 500) {
    kind = ERROR_KIND.TRANSIENT;
    retryable = true;
  } else if (code === 100) {
    // The catch-all "invalid parameter". A removed metric arrives here - see
    // isMetricUnavailable below, which the collectors use to degrade instead of fail.
    kind = isMetricUnavailable(message) ? ERROR_KIND.METRIC_UNAVAILABLE : ERROR_KIND.VALIDATION;
  } else if (httpStatus === 404) {
    kind = ERROR_KIND.NOT_FOUND;
  } else if (httpStatus >= 400 && httpStatus < 500) {
    kind = ERROR_KIND.VALIDATION;
  }

  return new MetaError(message, {
    kind, code, subcode, type, httpStatus, retryable, haltsBucket,
    fbtrace_id: payload.fbtrace_id ?? null,
  });
}

/**
 * True when the message reads as "this metric does not exist any more".
 * Meta removed `impressions`, `plays` and `profile_views` in April 2025 and
 * reports them as ordinary parameter errors, so string matching is the only
 * signal available. The collectors drop the named metric and re-request the rest.
 */
export function isMetricUnavailable(message = '') {
  const m = String(message).toLowerCase();
  return (
    m.includes('does not support the metric') ||
    m.includes('is not supported for this') ||
    m.includes('metric[0] must be one of') ||
    m.includes('unsupported get request') && m.includes('metric') ||
    (m.includes('invalid') && m.includes('metric')) ||
    m.includes('deprecated')
  );
}

/**
 * Pull the metric names Meta complained about out of an error message so the
 * collector can retry without them.
 */
export function extractBadMetrics(message = '', requested = []) {
  const m = String(message).toLowerCase();
  return requested.filter((metric) => m.includes(metric.toLowerCase()));
}

/** Backoff for retryable failures: exponential with full jitter, capped. */
export function backoffMs(attempt, baseMs = 1000, capMs = 15 * 60 * 1000) {
  const exp = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.round(exp / 2 + Math.random() * (exp / 2));
}
