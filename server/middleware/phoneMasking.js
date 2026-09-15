/**
 * Phone-number masking for CRM JSON responses.
 *
 * Contract: followup-agent-service/docs/CONTRACTS.md section 7.
 *
 *  - Roles that see full numbers: ADMIN, FOUNDER, OWNER. Everyone else gets
 *    masked values on every `/api/crm/*` JSON response.
 *  - Masked keys (case-sensitive, any depth) are listed in PHONE_KEYS.
 *  - Format keeps the country code (if present) and the last 4 digits:
 *      +919812345678 -> "+91 ******5678"
 *      9812345678    -> "******5678"
 *  - Every object that had at least one key masked gets `phoneMasked: true`.
 *  - `/api/internal/*` is never masked (service-to-service traffic).
 *
 * How it is wired (see docs/PHONE-MASKING-AND-CLICK-TO-CALL.md):
 *
 *   app.use('/api/crm', phoneMaskingMiddleware());   // BEFORE any /api/crm router
 *
 * The middleware runs before the per-route `validateToken`, so `req.user` does
 * not exist yet when it executes. It therefore only *wraps* `res.json` and
 * defers the role decision until the moment the route calls `res.json(...)`,
 * by which time the route's own auth chain has populated `req.user`. When no
 * user was attached (public listing routes, API-key routes, error responses
 * emitted before auth) the wrapper is a pass-through.
 *
 * `maskPhonesDeep` is pure and non-mutating: it returns the original reference
 * for any subtree it did not change, so an unmasked payload costs one walk and
 * zero allocations.
 */

/** Keys whose string values are masked, at any depth. Case-sensitive. */
export const PHONE_KEYS = new Set([
  'phone',
  'mobile',
  'mobileNumber',
  'alternatePhone',
  'normalizedPhone',
  'contactNumber',
  'ownerPhone',
  'attendeePhone',
  'relatedEntityPhone',
  'whatsapp',
  'whatsappNumber',
  'phoneNumber',
  'tenantPhone',
  'buyerPhone',
  'sellerPhone',
]);

/** Roles that receive unmasked numbers. */
export const FULL_PHONE_ROLES = ['ADMIN', 'FOUNDER', 'OWNER'];

export const PHONE_MASKED_HEADER = 'X-Phone-Masked';

/** Minimum digit count for a string to be treated as a phone number at all. */
const MIN_PHONE_DIGITS = 7;
/** Longest national subscriber number we expect; extra leading digits are the country code. */
const MAX_SUBSCRIBER_DIGITS = 10;
const VISIBLE_TAIL = 4;

// Digits, optional leading "+", and the usual separators only. Anything with
// letters (emails, "N/A", "not provided") is left untouched.
const PHONE_LIKE = /^\s*\+?[\d\s\-().]+\s*$/;

/**
 * True when the user may see unmasked phone numbers.
 * Role comparison is case-insensitive because some callers set lower-case roles.
 */
export function canViewFullPhone(user) {
  if (!user || typeof user !== 'object') return false;
  const role = String(user.role ?? '').toUpperCase();
  return FULL_PHONE_ROLES.includes(role);
}

/**
 * Mask a single phone value.
 *
 * Strings and finite numbers that look like a phone number (>= 7 digits, no
 * letters) are masked; every other value is returned unchanged, including
 * booleans, objects, null/undefined, empty strings and short codes. A numeric
 * value is masked as its decimal string, so the caller always gets a string
 * back for a masked number.
 *
 * @param {unknown} value
 * @returns {unknown} masked string, or the original value when not applicable
 */
export function maskPhone(value) {
  // Inspect a string form, but always hand back the ORIGINAL value (number or
  // string) when nothing is masked, so callers never see a type change for
  // values that were left alone.
  const text = typeof value === 'number' && Number.isInteger(value) ? String(value) : value;
  if (typeof text !== 'string') return value;
  if (!PHONE_LIKE.test(text)) return value;

  const digits = text.replace(/\D/g, '');
  if (digits.length < MIN_PHONE_DIGITS) return value;

  let countryCode = '';
  let subscriber = digits;
  if (digits.length > MAX_SUBSCRIBER_DIGITS) {
    // Leading digits beyond the national number are the country code. Trunk
    // zeros (0091..., 0981...) are not part of it.
    countryCode = digits.slice(0, digits.length - MAX_SUBSCRIBER_DIGITS).replace(/^0+/, '');
    subscriber = digits.slice(-MAX_SUBSCRIBER_DIGITS);
  }

  const tail = subscriber.slice(-VISIBLE_TAIL);
  const stars = '*'.repeat(Math.max(subscriber.length - VISIBLE_TAIL, 0));
  const masked = `${stars}${tail}`;

  return countryCode ? `+${countryCode} ${masked}` : masked;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively mask phone keys in a payload without mutating it.
 *
 * Returns the *same reference* when nothing inside changed, otherwise a copy
 * in which only the changed branches are new objects. Objects that had at
 * least one key masked gain `phoneMasked: true`.
 *
 * @param {unknown} payload
 * @param {Set<string>} [keys=PHONE_KEYS]
 * @returns {unknown}
 */
export function maskPhonesDeep(payload, keys = PHONE_KEYS) {
  if (payload === null || payload === undefined) return payload;

  if (Array.isArray(payload)) {
    let copy = null;
    for (let i = 0; i < payload.length; i += 1) {
      const next = maskPhonesDeep(payload[i], keys);
      if (next !== payload[i]) {
        if (!copy) copy = payload.slice();
        copy[i] = next;
      }
    }
    return copy || payload;
  }

  if (!isPlainObject(payload)) return payload;

  let copy = null;
  let maskedHere = false;
  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (value === null || value === undefined) continue;

    let next = value;
    if (keys.has(key) && (typeof value === 'string' || typeof value === 'number')) {
      next = maskPhone(value);
      if (next !== value) maskedHere = true;
    } else if (typeof value === 'object') {
      next = maskPhonesDeep(value, keys);
    }

    if (next !== value) {
      if (!copy) copy = { ...payload };
      copy[key] = next;
    }
  }

  if (maskedHere) {
    if (!copy) copy = { ...payload };
    copy.phoneMasked = true;
  }
  return copy || payload;
}

/**
 * Mask a payload for a given user: pass-through when the user may see full
 * numbers, or when there is no user at all (nothing to gate on).
 */
export function maskPhonesForUser(user, payload) {
  if (!user || canViewFullPhone(user)) return payload;
  return maskPhonesDeep(payload);
}

function isInternalPath(req) {
  const url = req.originalUrl || req.url || '';
  return url.startsWith('/api/internal');
}

function isCrmPath(req) {
  // Mounted at '/api/crm' this is always true; the check keeps the wrapper
  // inert if someone mounts it more broadly by mistake.
  const url = req.originalUrl || req.url || '';
  return url === '/api/crm' || url.startsWith('/api/crm/') || url.startsWith('/api/crm?');
}

/**
 * Express middleware factory. Wraps `res.json` so the payload is masked for
 * non-privileged users. The role check happens at `res.json` time, not at
 * middleware time, so it works even though `validateToken` runs later in each
 * route's own chain.
 */
export default function phoneMaskingMiddleware() {
  return function phoneMasking(req, res, next) {
    if (isInternalPath(req) || !isCrmPath(req)) return next();

    const originalJson = res.json;
    res.json = function maskedJson(payload) {
      // Cheap short-circuit: primitives and missing users never need a walk.
      if (payload && typeof payload === 'object' && req.user && !canViewFullPhone(req.user)) {
        const masked = maskPhonesDeep(payload);
        if (masked !== payload) {
          if (!res.headersSent && typeof res.setHeader === 'function') {
            res.setHeader(PHONE_MASKED_HEADER, 'true');
          }
          return originalJson.call(this, masked);
        }
      }
      return originalJson.call(this, payload);
    };

    next();
  };
}
