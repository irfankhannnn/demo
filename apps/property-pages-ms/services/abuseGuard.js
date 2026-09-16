/**
 * Distributed rate limiting and abuse detection for the public booking flow.
 *
 * ── why not the CRM's existing limiter ─────────────────────────────────────
 * `apps/crm/server/middleware/rateLimiter.js` keeps its counters in a per-process Map.
 * Under Lambda that means one counter per warm container, and a burst from a
 * single IP fans out across containers that cannot see each other's counts —
 * so the limit that reads as "40 per hour" is really "40 per hour per
 * container", and the more traffic arrives the more containers exist to
 * absorb it. That is the wrong shape for the control the feature actually
 * needs, which is specifically "many sessions from one IP within a second".
 *
 * Counters therefore live in DynamoDB, incremented atomically with ADD, and
 * expire on their own via TTL so nothing has to be swept.
 *
 * ── why the time bucket is in the key ──────────────────────────────────────
 * Each key embeds the window it belongs to (`…:b:<bucket>`), so a window rolls
 * over simply by writing to a different item. There is no read-then-write and
 * therefore no race between two concurrent requests both deciding they are
 * first in a new window.
 *
 * These are fixed windows, not sliding ones: a burst straddling a boundary can
 * briefly see up to 2x the limit. That is a known and accepted property — the
 * burst limit is set low enough that 2x is still harmless, and the cost of a
 * true sliding window (multiple reads per request) is not worth paying here.
 *
 * ── what this cannot do ────────────────────────────────────────────────────
 * Per-IP limits are worth real money against a script on one host and worth
 * very little against a botnet or a rotating proxy pool. The control that
 * actually bounds the damage is the per-tenant daily cap, because every
 * booking-created lead can trigger a billable AI qualification call — see
 * `checkTenantBookingCap`.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { config } from '../config/env.js';
import { logger } from '../logger.js';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }));

/** Slack added to every TTL so a counter never expires mid-window. */
const TTL_SLACK_SECONDS = 120;

/**
 * In-memory counters for local development and tests.
 *
 * Without this the service is unrunnable off AWS: the booking path fails
 * CLOSED by design, so with no reachable DynamoDB table every booking attempt
 * is rejected and the flow cannot be exercised at all. Same fallback pattern
 * as apps/crm/server/webhookLogService.js, and gated the same way — it is per-process
 * and therefore useless for real rate limiting, so it must never engage in a
 * deployed environment.
 */
const useMemoryStore = ['test', 'development'].includes(config.nodeEnv)
  || process.env.GUARD_STORE === 'memory';

const memoryCounters = new Map();

if (useMemoryStore) {
  logger.warn('abuseGuard.memory_store', {
    nodeEnv: config.nodeEnv,
    detail: 'Counters are per-process and NOT shared. Local/test only.',
  });
}

function memoryHit(key, expiresAt, increment) {
  const now = Math.floor(Date.now() / 1000);
  const existing = memoryCounters.get(key);
  if (!existing || existing.expiresAt <= now) {
    const fresh = { count: increment, expiresAt };
    memoryCounters.set(key, fresh);
    return fresh.count;
  }
  existing.count += increment;
  return existing.count;
}

/**
 * Atomically increment a counter and report whether it is now over its limit.
 *
 * @param {string} scope   what is being counted, e.g. 'ip-burst'
 * @param {string} subject the thing counted against, e.g. an IP or phone hash
 * @param {number} windowSeconds
 * @param {number} limit
 * @param {'open'|'closed'} failMode behaviour when DynamoDB itself fails
 */
async function hit(scope, subject, windowSeconds, limit, failMode = 'open') {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const key = `${scope}:${subject}:b:${bucket}`;
  const expiresAt = (bucket + 1) * windowSeconds + TTL_SLACK_SECONDS;

  if (useMemoryStore) {
    const count = memoryHit(key, expiresAt, 1);
    return {
      allowed: count <= limit,
      count,
      limit,
      retryAfter: Math.max(1, (bucket + 1) * windowSeconds - now),
    };
  }

  try {
    const result = await docClient.send(new UpdateCommand({
      TableName: config.guardTableName,
      Key: { guardKey: key },
      UpdateExpression: 'ADD #count :one SET expiresAt = if_not_exists(expiresAt, :exp)',
      ExpressionAttributeNames: { '#count': 'count' },
      ExpressionAttributeValues: { ':one': 1, ':exp': expiresAt },
      ReturnValues: 'UPDATED_NEW',
    }));

    const count = Number(result.Attributes?.count) || 1;
    return {
      allowed: count <= limit,
      count,
      limit,
      retryAfter: Math.max(1, (bucket + 1) * windowSeconds - now),
    };
  } catch (err) {
    logger.error('abuseGuard.counter_failed', { scope, error: err.message, failMode });
    // A page view degrading to unlimited is survivable; a booking write
    // degrading to unlimited is not, because each one can cost real money.
    if (failMode === 'closed') {
      return { allowed: false, count: 0, limit, retryAfter: 30, degraded: true };
    }
    return { allowed: true, count: 0, limit, retryAfter: 0, degraded: true };
  }
}

/**
 * Client IP behind API Gateway + CloudFront.
 *
 * `req.ip` is not trustworthy here — `trust proxy` is not set, and
 * serverless-http synthesises the socket address from the event. The CRM's own
 * limiter deliberately parses the header itself for the same reason, and this
 * mirrors it.
 *
 * Only the LEFTMOST entry is used and it must look like an IP. A client can
 * put anything in X-Forwarded-For, but CloudFront and API Gateway append the
 * real source address, so a spoofed value shifts the real one rightward rather
 * than replacing it. Taking the leftmost entry means an attacker can forge a
 * different bucket for themselves — they can evade their own limit, but cannot
 * forge someone else's IP into a limit and lock a real visitor out. Given the
 * choice between an evadable limit and a weaponisable one, this is the right
 * trade; the per-tenant cap is what remains effective against evasion.
 */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const first = forwarded.split(',')[0].trim();
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(first) || /^[0-9a-f:]{3,45}$/i.test(first)) {
      return first;
    }
  }
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Page-view throttle. Fails open — a DynamoDB blip must not take a tenant's
 * public listings offline.
 */
export async function checkPageView(ip) {
  const burst = await hit('pv-burst', ip, config.limits.ipBurstWindowSeconds, config.limits.ipBurst * 4, 'open');
  if (!burst.allowed) return burst;
  return hit('pv-hour', ip, 3600, config.limits.ipHourly * 10, 'open');
}

/**
 * Throttle on minting a booking session.
 *
 * This is the "multiple sessions from one IP within one second" control the
 * feature specifically calls for: a session is required to book, so capping
 * session creation caps booking attempts upstream of any write.
 */
export async function checkSessionMint(ip, { skipBurst = false } = {}) {
  // `skipBurst` is used only when re-rendering the form after a rejected
  // submission. That path mints a fresh token, but the visitor's original
  // intent was already counted when they first opened the form — charging the
  // burst window again means someone who mistypes their phone number three
  // times gets "please slow down" instead of "check your number", which reads
  // as the site being broken.
  //
  // The hourly limit still applies, so a script looping bad submissions to
  // harvest tokens is still bounded; and every rejection separately feeds the
  // failure counter that turns the captcha on.
  if (!skipBurst) {
    const burst = await hit('sess-burst', ip, config.limits.ipBurstWindowSeconds, config.limits.ipBurst, 'closed');
    if (!burst.allowed) return { ...burst, scope: 'burst' };
  }

  const hourly = await hit('sess-hour', ip, 3600, config.limits.ipHourly, 'closed');
  if (!hourly.allowed) return { ...hourly, scope: 'hourly' };

  return { allowed: true };
}

/**
 * Throttles on the booking write itself. Every check fails CLOSED: a booking
 * creates a lead, which can trigger a billable AI qualification call, so
 * "allow it because the counter was unreachable" is the expensive mistake.
 */
export async function checkBookingAttempt({ ip, phoneHash, tenantId }) {
  const ipDaily = await hit('book-ip', ip, 86400, config.limits.ipBookingsDaily, 'closed');
  if (!ipDaily.allowed) return { ...ipDaily, scope: 'ip_daily' };

  const phoneDaily = await hit('book-phone', phoneHash, 86400, config.limits.phoneBookingsDaily, 'closed');
  if (!phoneDaily.allowed) return { ...phoneDaily, scope: 'phone_daily' };

  const tenantDaily = await hit('book-tenant', tenantId, 86400, config.limits.tenantBookingsDaily, 'closed');
  if (!tenantDaily.allowed) {
    // Distinct from the visitor-facing limits: this one means a tenant is
    // under sustained attack, and a human should look at it.
    logger.error('abuseGuard.tenant_cap_reached', { tenantId, count: tenantDaily.count });
    return { ...tenantDaily, scope: 'tenant_daily' };
  }

  return { allowed: true };
}

/**
 * Failure counter driving the adaptive captcha. Incremented on every rejected
 * booking attempt from an IP; once it crosses the threshold that IP must solve
 * a captcha until the hour rolls over.
 */
export async function recordFailure(ip) {
  return hit('fail', ip, 3600, Number.MAX_SAFE_INTEGER, 'open');
}

export async function captchaRequiredFor(ip) {
  if (!config.hcaptchaSiteKey) return false;
  // Read the current count without incrementing it, by adding zero.
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / 3600);

  if (useMemoryStore) {
    const count = memoryHit(`fail:${ip}:b:${bucket}`, (bucket + 1) * 3600 + TTL_SLACK_SECONDS, 0);
    return count >= config.limits.captchaTriggerFailures;
  }

  try {
    const result = await docClient.send(new UpdateCommand({
      TableName: config.guardTableName,
      Key: { guardKey: `fail:${ip}:b:${bucket}` },
      UpdateExpression: 'ADD #count :zero SET expiresAt = if_not_exists(expiresAt, :exp)',
      ExpressionAttributeNames: { '#count': 'count' },
      ExpressionAttributeValues: { ':zero': 0, ':exp': (bucket + 1) * 3600 + TTL_SLACK_SECONDS },
      ReturnValues: 'UPDATED_NEW',
    }));
    return (Number(result.Attributes?.count) || 0) >= config.limits.captchaTriggerFailures;
  } catch (err) {
    logger.warn('abuseGuard.captcha_check_failed', { error: err.message });
    // Unreachable counter means an unknown history, so demand the captcha.
    return true;
  }
}
