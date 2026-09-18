/**
 * Distributed rate limiting for the public and consumer routes.
 *
 * Ported from apps/property-pages-ms/services/abuseGuard.js — read that
 * file's header for why counters live in DynamoDB rather than a per-process
 * Map (Lambda containers cannot see each other's counts) and why the time
 * bucket is part of the key (no read-then-write, so no race at a window
 * boundary).
 *
 * ── what changed for the marketplace ───────────────────────────────────────
 * Counters live in the marketplace's own single table rather than a separate
 * guard table: PK `GUARD#<scope>#<key>`, SK `WINDOW#<bucket>`, TTL attribute
 * `expiresAt`. Same table, own key prefix, so the Lambda role still grants
 * exactly one table.
 *
 * Two controls are new. AI search costs a model call per request, so it has
 * its own hourly limit, tighter for anonymous callers. And "I'm interested"
 * pings are capped at one per buyer per property per day — a ping is a lead
 * alert in an agency's CRM, and a buyer mashing the button must not become
 * twelve notifications.
 *
 * ── what this cannot do ────────────────────────────────────────────────────
 * Per-IP limits are worth real money against a script on one host and worth
 * very little against a botnet. The controls that actually bound the damage
 * are per-user (behind a verified phone) and per-tenant (the booking cap).
 */

import crypto from 'crypto';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { config } from '../config/env.js';
import { getDocClient } from './dynamo.js';
import { logger } from '../logger.js';

/** Slack added to every TTL so a counter never expires mid-window. */
const TTL_SLACK_SECONDS = 120;

/**
 * In-memory counters for local development and tests. Per-process and
 * therefore useless for real rate limiting, so it must never engage in a
 * deployed environment — gated on NODE_ENV exactly as pages does.
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

/** Test hook: forget every counter. */
export function resetMemoryCounters() {
  memoryCounters.clear();
}

/**
 * Atomically increment a counter and report whether it is now over its limit.
 *
 * @param {string} scope   what is being counted, e.g. 'ai-search'
 * @param {string} subject the thing counted against, e.g. an IP or user id
 * @param {number} windowSeconds
 * @param {number} limit
 * @param {'open'|'closed'} failMode behaviour when DynamoDB itself fails
 */
export async function hit(scope, subject, windowSeconds, limit, failMode = 'open') {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const expiresAt = (bucket + 1) * windowSeconds + TTL_SLACK_SECONDS;
  const retryAfter = Math.max(1, (bucket + 1) * windowSeconds - now);

  if (useMemoryStore) {
    const count = memoryHit(`${scope}:${subject}:${bucket}`, expiresAt, 1);
    return { allowed: count <= limit, count, limit, retryAfter };
  }

  try {
    const result = await getDocClient().send(new UpdateCommand({
      TableName: config.guardTableName,
      Key: { PK: `GUARD#${scope}#${subject}`, SK: `WINDOW#${bucket}` },
      UpdateExpression: 'ADD #count :one SET expiresAt = if_not_exists(expiresAt, :exp)',
      ExpressionAttributeNames: { '#count': 'count' },
      ExpressionAttributeValues: { ':one': 1, ':exp': expiresAt },
      ReturnValues: 'UPDATED_NEW',
    }));

    const count = Number(result.Attributes?.count) || 1;
    return { allowed: count <= limit, count, limit, retryAfter };
  } catch (err) {
    logger.error('abuseGuard.counter_failed', { scope, error: err.message, failMode });
    // A read degrading to unlimited is survivable; a write that creates a
    // lead in someone's CRM degrading to unlimited is not.
    if (failMode === 'closed') {
      return { allowed: false, count: 0, limit, retryAfter: 30, degraded: true };
    }
    return { allowed: true, count: 0, limit, retryAfter: 0, degraded: true };
  }
}

/**
 * Client IP behind API Gateway + CloudFront.
 *
 * Only the LEFTMOST X-Forwarded-For entry is used and it must look like an
 * IP. CloudFront and API Gateway append the real source address, so a spoofed
 * value shifts the real one rightward rather than replacing it: an attacker
 * can evade their own limit but cannot forge someone else's IP into a limit
 * and lock a real visitor out. See the pages service for the full reasoning.
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

/** Phone is hashed before it reaches a guard key so no counter row holds a real number. */
export function phoneHash(phone) {
  return crypto.createHash('sha256')
    .update(`${config.sessionSecret || config.crmInternalApiKey}:${phone}`)
    .digest('base64url')
    .slice(0, 24);
}

/** Public read throttle. Fails open — a DynamoDB blip must not take the marketplace offline. */
export async function checkPublicRead(ip) {
  const burst = await hit('pub-burst', ip, config.limits.ipBurstWindowSeconds, config.limits.ipBurst, 'open');
  if (!burst.allowed) return { ...burst, scope: 'burst' };
  const hourly = await hit('pub-hour', ip, 3600, config.limits.ipHourly, 'open');
  if (!hourly.allowed) return { ...hourly, scope: 'hourly' };
  return { allowed: true };
}

/**
 * AI search: one model call per request, so it is metered separately and
 * more tightly. Logged-in buyers get a higher allowance, keyed on the user
 * rather than the IP so a shared office NAT does not starve them.
 */
export async function checkAiSearch({ ip, userId = null }) {
  if (userId) {
    const r = await hit('ai-user', userId, 3600, config.limits.aiSearchUserHourly, 'closed');
    return r.allowed ? { allowed: true } : { ...r, scope: 'ai_user_hourly' };
  }
  const r = await hit('ai-ip', ip, 3600, config.limits.aiSearchAnonHourly, 'closed');
  return r.allowed ? { allowed: true } : { ...r, scope: 'ai_anon_hourly' };
}

/** Buyer-initiated writes (messages, saves, searches). Fails closed. */
export async function checkBuyerWrite(userId) {
  const r = await hit('buyer-write', userId, 3600, config.limits.buyerWritesHourly, 'closed');
  return r.allowed ? { allowed: true } : { ...r, scope: 'buyer_writes_hourly' };
}

/** One "I'm interested" per buyer per property per day. Fails closed. */
export async function checkPing(userId, propertyId) {
  const r = await hit('ping', `${userId}#${propertyId}`, 86400, 1, 'closed');
  return r.allowed ? { allowed: true } : { ...r, scope: 'ping_daily' };
}

/**
 * Throttles on a site-visit booking. Every check fails CLOSED: a booking
 * creates a lead, which can trigger a billable AI qualification call, so
 * "allow it because the counter was unreachable" is the expensive mistake.
 */
export async function checkBookingAttempt({ ip, phoneHash: ph, tenantId }) {
  const ipDaily = await hit('book-ip', ip, 86400, config.limits.ipBookingsDaily, 'closed');
  if (!ipDaily.allowed) return { ...ipDaily, scope: 'ip_daily' };

  const phoneDaily = await hit('book-phone', ph, 86400, config.limits.phoneBookingsDaily, 'closed');
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
