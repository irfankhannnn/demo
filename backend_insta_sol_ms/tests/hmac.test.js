// Contract section 2b — the signing scheme itself.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStringToSign,
  signRequest,
  verifySignature,
  isSkewAcceptable,
  sha256Hex,
  generatePairingCode,
  generateDeviceSecret,
  MAX_SKEW_MS,
} from '../services/hmac.js';

const SECRET = 'a'.repeat(64);

function sample(overrides = {}) {
  return {
    secret: SECRET,
    method: 'POST',
    path: '/api/insta/agent/heartbeat',
    timestamp: 1_700_000_000_000,
    nonce: '11111111-2222-3333-4444-555555555555',
    rawBody: Buffer.from(JSON.stringify({ igUserId: '178414' })),
    ...overrides,
  };
}

test('stringToSign matches the five-line contract layout', () => {
  const s = buildStringToSign(sample());
  const lines = s.split('\n');
  assert.equal(lines.length, 5);
  assert.equal(lines[0], 'POST');
  assert.equal(lines[1], '/api/insta/agent/heartbeat');
  assert.equal(lines[2], '1700000000000');
  assert.equal(lines[3], '11111111-2222-3333-4444-555555555555');
  assert.equal(lines[4], sha256Hex(sample().rawBody));
});

test('an empty body still contributes the hash of the empty string', () => {
  const s = buildStringToSign(sample({ rawBody: undefined }));
  assert.equal(
    s.split('\n')[4],
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
});

test('sign then verify round-trips', () => {
  const req = sample();
  const signature = signRequest(req);
  assert.equal(signature.length, 64);
  assert.equal(verifySignature({ ...req, signature }), true);
});

test('the method is bound into the signature', () => {
  const signature = signRequest(sample());
  assert.equal(verifySignature({ ...sample({ method: 'GET' }), signature }), false);
});

test('the path is bound into the signature', () => {
  const signature = signRequest(sample());
  assert.equal(
    verifySignature({ ...sample({ path: '/api/insta/agent/enquiries' }), signature }),
    false
  );
});

test('a tampered body invalidates the signature', () => {
  const signature = signRequest(sample());
  const tampered = sample({ rawBody: Buffer.from(JSON.stringify({ igUserId: '999' })) });
  assert.equal(verifySignature({ ...tampered, signature }), false);
});

test('the nonce is bound into the signature, so a replay cannot be re-nonced', () => {
  const signature = signRequest(sample());
  assert.equal(verifySignature({ ...sample({ nonce: 'different-nonce' }), signature }), false);
});

test('a different secret does not verify', () => {
  const signature = signRequest(sample());
  assert.equal(verifySignature({ ...sample({ secret: 'b'.repeat(64) }), signature }), false);
});

test('a wrong-length signature is rejected instead of throwing', () => {
  assert.equal(verifySignature({ ...sample(), signature: 'deadbeef' }), false);
  assert.equal(verifySignature({ ...sample(), signature: '' }), false);
  assert.equal(verifySignature({ ...sample(), signature: undefined }), false);
});

test('clock skew is rejected in both directions beyond 5 minutes', () => {
  const now = 1_700_000_000_000;
  assert.equal(isSkewAcceptable(now, now), true);
  assert.equal(isSkewAcceptable(now - MAX_SKEW_MS + 1000, now), true);
  assert.equal(isSkewAcceptable(now + MAX_SKEW_MS - 1000, now), true);

  // A laptop running slow.
  assert.equal(isSkewAcceptable(now - MAX_SKEW_MS - 1000, now), false);
  // A laptop running fast is just as dangerous: a future-dated signature would
  // outlive the nonce record that protects it.
  assert.equal(isSkewAcceptable(now + MAX_SKEW_MS + 1000, now), false);
});

test('a non-numeric timestamp is rejected', () => {
  assert.equal(isSkewAcceptable('not-a-number', Date.now()), false);
  assert.equal(isSkewAcceptable(undefined, Date.now()), false);
});

test('pairing codes are 8 chars from an unambiguous alphabet', () => {
  for (let i = 0; i < 200; i += 1) {
    const code = generatePairingCode();
    assert.equal(code.length, 8);
    assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
  }
});

test('device secrets are 256 bits of hex and do not repeat', () => {
  const seen = new Set();
  for (let i = 0; i < 50; i += 1) {
    const s = generateDeviceSecret();
    assert.match(s, /^[0-9a-f]{64}$/);
    assert.equal(seen.has(s), false);
    seen.add(s);
  }
});
