/**
 * Booking session tokens.
 *
 * Rendering the visit form mints a token; submitting the form must present it
 * back. That turns a booking from one blind POST into a two-step exchange the
 * server controls both ends of, which buys three things:
 *
 *   1. A script cannot POST bookings without first fetching a form, so session
 *      minting becomes the natural, cheap place to rate limit (see
 *      abuseGuard.checkSessionMint) — before any CRM write is attempted.
 *   2. The token carries the issue time, so the server can tell that a form
 *      was "filled" in 200ms and reject it as automated.
 *   3. The token binds the booking to one tenant and one property, so a token
 *        minted on a cheap listing cannot be replayed against another tenant.
 *
 * ── stateless signature, stateful single-use ───────────────────────────────
 * The token itself is a self-contained HMAC — no storage needed to verify it.
 * Single-use enforcement does need state, and lives in the same TTL'd guard
 * table as the rate counters (`consumeNonce`), so a replayed token is rejected
 * even though the signature is still perfectly valid.
 *
 * The secret is this service's own (`VISIT_SESSION_SECRET`), deliberately not
 * the CRM's `JWT_SECRET`: these tokens are handed to anonymous visitors, and a
 * signing key that reaches the public internet must never be one that also
 * signs authenticated user sessions.
 */

import crypto from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { config } from '../config/env.js';
import { logger } from '../logger.js';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }));

// Same local/test fallback as abuseGuard, and for the same reason: nonce
// burning fails CLOSED, so without a reachable table no booking can complete
// and the flow is untestable off AWS. Per-process, so it is only a real
// single-use guarantee when backed by DynamoDB.
const useMemoryStore = ['test', 'development'].includes(config.nodeEnv)
  || process.env.GUARD_STORE === 'memory';
const memoryNonces = new Set();

function sign(payloadB64) {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update(payloadB64)
    .digest('base64url');
}

/**
 * @param {{tenantId: string, propertyId: string|null}} binding
 * @returns {{token: string, issuedAt: number}}
 */
export function issueSession({ tenantId, propertyId }) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    t: tenantId,
    p: propertyId || null,
    i: issuedAt,
    n: crypto.randomBytes(12).toString('base64url'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${payloadB64}.${sign(payloadB64)}`, issuedAt };
}

/**
 * Verify signature, expiry and binding.
 *
 * Returns a reason rather than throwing, because every failure here is a
 * normal thing that happens to real visitors — a form left open over lunch
 * expires, a back-button resubmit replays — and the caller renders a friendly
 * "please try again" for all of them.
 */
export function verifySession(token, { tenantId, propertyId }) {
  if (typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, reason: 'malformed' };
  }

  const [payloadB64, providedSig] = token.split('.', 2);
  const expectedSig = sign(payloadB64);

  // Compare digests so the lengths always match and timingSafeEqual cannot
  // throw on a truncated signature.
  const a = crypto.createHash('sha256').update(String(providedSig)).digest();
  const b = crypto.createHash('sha256').update(expectedSig).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'bad_signature' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  const now = Math.floor(Date.now() / 1000);
  const age = now - Number(payload.i || 0);

  if (age > config.sessionTtlSeconds) return { valid: false, reason: 'expired' };
  // A negative age means the token claims to be from the future — a clock
  // problem or a forged payload. Either way it is not usable.
  if (age < 0) return { valid: false, reason: 'not_yet_valid' };
  if (age < config.minFillSeconds) return { valid: false, reason: 'too_fast' };

  if (payload.t !== tenantId) return { valid: false, reason: 'wrong_tenant' };
  if ((payload.p || null) !== (propertyId || null)) return { valid: false, reason: 'wrong_property' };

  return { valid: true, nonce: payload.n, issuedAt: payload.i };
}

/**
 * Burn a nonce so a token works exactly once.
 *
 * The conditional put is what makes this atomic: two concurrent submits of the
 * same token race on the same item and exactly one wins, so a double-clicked
 * form produces one booking rather than two.
 *
 * Fails CLOSED. If the store is unreachable we cannot prove the token is
 * unused, and allowing an unverifiable replay on a path that creates billable
 * leads is the worse outcome.
 */
export async function consumeNonce(nonce) {
  const expiresAt = Math.floor(Date.now() / 1000) + config.sessionTtlSeconds + 300;

  if (useMemoryStore) {
    if (memoryNonces.has(nonce)) return { ok: false, reason: 'already_used' };
    memoryNonces.add(nonce);
    return { ok: true };
  }

  try {
    await docClient.send(new PutCommand({
      TableName: config.guardTableName,
      Item: { guardKey: `nonce:${nonce}`, usedAt: new Date().toISOString(), expiresAt },
      ConditionExpression: 'attribute_not_exists(guardKey)',
    }));
    return { ok: true };
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return { ok: false, reason: 'already_used' };
    }
    logger.error('sessionToken.nonce_store_failed', { error: err.message });
    return { ok: false, reason: 'store_unavailable' };
  }
}
