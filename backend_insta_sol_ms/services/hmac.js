// HMAC request signing, contract section 2b.
//
// Kept free of Express and AWS so both sides of the wire can share the exact
// same construction: the laptop agent signs with signRequest(), the API
// verifies with verifySignature(), and the round-trip is unit-testable without
// a network or a table.

import crypto from 'node:crypto';

export const MAX_SKEW_MS = 5 * 60 * 1000;

export const HEADERS = {
  deviceId: 'x-insta-device-id',
  timestamp: 'x-insta-timestamp',
  nonce: 'x-insta-nonce',
  signature: 'x-insta-signature',
};

export function sha256Hex(buf) {
  const input = Buffer.isBuffer(buf) ? buf : Buffer.from(buf ?? '', 'utf8');
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * stringToSign = METHOD \n PATH \n TIMESTAMP \n NONCE \n sha256hex(rawBody)
 *
 * The body hash rather than the body itself keeps the signing input bounded
 * for a 500-item snapshot upload, and an empty body still contributes the
 * hash of the empty string so a stripped body cannot pass unnoticed.
 */
export function buildStringToSign({ method, path, timestamp, nonce, rawBody }) {
  return [
    String(method || '').toUpperCase(),
    String(path || ''),
    String(timestamp ?? ''),
    String(nonce ?? ''),
    sha256Hex(rawBody),
  ].join('\n');
}

export function signRequest({ secret, method, path, timestamp, nonce, rawBody }) {
  const stringToSign = buildStringToSign({ method, path, timestamp, nonce, rawBody });
  return crypto.createHmac('sha256', String(secret)).update(stringToSign, 'utf8').digest('hex');
}

/**
 * Constant-time comparison. timingSafeEqual throws on a length mismatch, so a
 * wrong-length signature is rejected before it reaches the comparison — that
 * length check leaks nothing an attacker does not already know.
 */
export function verifySignature({ secret, method, path, timestamp, nonce, rawBody, signature }) {
  if (typeof signature !== 'string' || signature.length === 0) return false;

  const expected = signRequest({ secret, method, path, timestamp, nonce, rawBody });
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Skew is checked in both directions: a laptop clock running fast is just as
 * much a replay risk as one running slow, because a future-dated signature
 * stays valid past the nonce TTL.
 */
export function isSkewAcceptable(timestamp, now = Date.now(), maxSkewMs = MAX_SKEW_MS) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(now - ts) <= maxSkewMs;
}

/** 8-char pairing code. Ambiguous glyphs (0/O, 1/I/L) are excluded — the owner
 *  reads this off a screen and types it into a terminal. */
const PAIR_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generatePairingCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += PAIR_ALPHABET[bytes[i] % PAIR_ALPHABET.length];
  }
  return out;
}

/** Device secret: 32 random bytes, hex. Returned to the agent exactly once. */
export function generateDeviceSecret() {
  return crypto.randomBytes(32).toString('hex');
}

export default {
  MAX_SKEW_MS,
  HEADERS,
  sha256Hex,
  buildStringToSign,
  signRequest,
  verifySignature,
  isSkewAcceptable,
  generatePairingCode,
  generateDeviceSecret,
};
