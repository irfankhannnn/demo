// Everything that proves a request really came from Meta, or really came back
// from our own OAuth redirect. Pure crypto, no Express, no AWS.
//
//   - token encryption: Instagram access tokens are stored AES-256-GCM encrypted
//     under INSTA_TOKEN_ENCRYPTION_KEY, never in plain text
//   - OAuth state: signed and time-limited, carries the tenant through the
//     Instagram consent screen so the callback knows which agency connected
//   - webhook signatures: X-Hub-Signature-256 over the raw request body
//   - signed_request: the deauthorize and data-deletion callbacks

import crypto from 'node:crypto';
import { getConfig, isValidEncryptionKey } from '../config/env.js';

const TOKEN_FORMAT = 'v1';
const STATE_TTL_MS = 15 * 60 * 1000;

function encryptionKey() {
  const hex = getConfig().tokenEncryptionKey;
  if (!isValidEncryptionKey(hex)) {
    throw new Error('INSTA_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/** A separate key per purpose, so the state signer can never decrypt a token. */
function derivedKey(label) {
  return crypto.createHmac('sha256', encryptionKey()).update(label).digest();
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a ?? ''));
  const right = Buffer.from(String(b ?? ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

// ---------------------------------------------------------------------------
// Token encryption
// ---------------------------------------------------------------------------

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [TOKEN_FORMAT, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
}

export function decryptSecret(blob) {
  const [version, iv, tag, ciphertext] = String(blob ?? '').split(':');
  if (version !== TOKEN_FORMAT || !iv || !tag || !ciphertext) {
    throw new Error('Stored token is not in a recognised format');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

// ---------------------------------------------------------------------------
// OAuth state
// ---------------------------------------------------------------------------

export class OAuthStateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OAuthStateError';
  }
}

/** @param {{tenantId: string, userId?: string|null}} payload */
export function signOAuthState(payload, { now = Date.now(), ttlMs = STATE_TTL_MS } = {}) {
  const body = {
    t: payload.tenantId,
    u: payload.userId ?? null,
    n: crypto.randomBytes(12).toString('base64url'),
    exp: now + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', derivedKey('oauth-state')).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

/** @returns {{tenantId: string, userId: string|null}} */
export function verifyOAuthState(state, { now = Date.now() } = {}) {
  const [encoded, signature] = String(state ?? '').split('.');
  if (!encoded || !signature) throw new OAuthStateError('Missing or malformed state');

  const expected = crypto.createHmac('sha256', derivedKey('oauth-state')).update(encoded).digest('base64url');
  if (!safeEqual(signature, expected)) throw new OAuthStateError('State signature does not match');

  let body;
  try {
    body = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new OAuthStateError('State payload is unreadable');
  }
  if (!body?.t || typeof body.exp !== 'number') throw new OAuthStateError('State payload is incomplete');
  if (now > body.exp) throw new OAuthStateError('The connection link expired, start again');

  return { tenantId: body.t, userId: body.u ?? null };
}

// ---------------------------------------------------------------------------
// Webhooks and signed_request
// ---------------------------------------------------------------------------

/**
 * X-Hub-Signature-256: sha256=<hex HMAC of the raw body under the app secret>.
 * The raw bytes matter: re-serialising req.body changes key order and escaping.
 */
export function verifyWebhookSignature(rawBody, header, appSecret) {
  if (!appSecret || typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody ?? '', 'utf8');
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(body).digest('hex')}`;
  return safeEqual(header, expected);
}

/**
 * Meta's signed_request: base64url(signature).base64url(payload), where the
 * signature is HMAC-SHA256 of the encoded payload under the app secret.
 * Returns the payload, or null when it does not verify.
 */
export function parseSignedRequest(signedRequest, appSecret) {
  if (!appSecret || typeof signedRequest !== 'string') return null;
  const [encodedSig, encodedPayload] = signedRequest.split('.', 2);
  if (!encodedSig || !encodedPayload) return null;

  const expected = crypto.createHmac('sha256', appSecret).update(encodedPayload).digest('base64url');
  // Meta pads inconsistently; compare without padding.
  if (!safeEqual(encodedSig.replace(/=+$/, ''), expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (payload.algorithm && String(payload.algorithm).toUpperCase() !== 'HMAC-SHA256') return null;
    return payload;
  } catch {
    return null;
  }
}

/** Test helper and local tooling: build a signed_request the way Meta does. */
export function buildSignedRequest(payload, appSecret) {
  const encodedPayload = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', ...payload })).toString('base64url');
  const signature = crypto.createHmac('sha256', appSecret).update(encodedPayload).digest('base64url');
  return `${signature}.${encodedPayload}`;
}

export default {
  encryptSecret,
  decryptSecret,
  signOAuthState,
  verifyOAuthState,
  OAuthStateError,
  verifyWebhookSignature,
  parseSignedRequest,
  buildSignedRequest,
};
