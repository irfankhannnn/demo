/**
 * The laptop-to-cloud contract.
 *
 * The important test here is the cross-component one: the agent's signer and
 * the backend's verifier are separate codebases that must agree byte-for-byte.
 * Importing the real backend module rather than a copied fixture means a change
 * to either side breaks this test, which is exactly what should happen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStringToSign, signRequest, sha256Hex } from '../src/uplink/client.js';
import * as backendHmac from '../../backend_insta_sol_ms/services/hmac.js';

const VECTOR = {
  secret: 'a'.repeat(64),
  method: 'POST',
  path: '/api/insta/agent/snapshot',
  timestamp: 1756400000000,
  nonce: '11111111-2222-3333-4444-555555555555',
  rawBody: '{"accounts":[]}',
};

test('agent and backend build the identical string to sign', () => {
  assert.equal(
    buildStringToSign(VECTOR),
    backendHmac.buildStringToSign(VECTOR),
  );
});

test('agent and backend produce the identical signature', () => {
  assert.equal(signRequest(VECTOR), backendHmac.signRequest(VECTOR));
});

test('the backend verifies a signature the agent produced', () => {
  const signature = signRequest(VECTOR);
  assert.equal(backendHmac.verifySignature({ ...VECTOR, signature }), true);
});

test('the string to sign has the documented five-line shape', () => {
  const lines = buildStringToSign(VECTOR).split('\n');
  assert.equal(lines.length, 5);
  assert.deepEqual(lines.slice(0, 4), [
    'POST', '/api/insta/agent/snapshot', '1756400000000',
    '11111111-2222-3333-4444-555555555555',
  ]);
  assert.equal(lines[4], sha256Hex(VECTOR.rawBody));
});

test('tampering with any signed component changes the signature', async (t) => {
  const base = signRequest(VECTOR);
  const mutations = {
    method: 'GET',
    path: '/api/insta/agent/enquiries',
    timestamp: VECTOR.timestamp + 1,
    nonce: 'ffffffff-2222-3333-4444-555555555555',
    rawBody: '{"accounts":[{"igUserId":"evil"}]}',
  };
  for (const [field, value] of Object.entries(mutations)) {
    await t.test(`changing ${field}`, () => {
      assert.notEqual(signRequest({ ...VECTOR, [field]: value }), base);
    });
  }
});

test('an empty body still contributes the hash of the empty string', () => {
  // Otherwise a stripped body would pass unnoticed against a signature computed
  // over a real one.
  const s = buildStringToSign({ ...VECTOR, rawBody: '' });
  assert.equal(s.split('\n')[4], sha256Hex(''));
  assert.notEqual(signRequest({ ...VECTOR, rawBody: '' }), signRequest(VECTOR));
});

test('the backend rejects a signature signed with a different secret', () => {
  const signature = signRequest({ ...VECTOR, secret: 'b'.repeat(64) });
  assert.equal(backendHmac.verifySignature({ ...VECTOR, signature }), false);
});

test('clock skew is bounded in both directions', () => {
  const now = VECTOR.timestamp;
  assert.equal(backendHmac.isSkewAcceptable(now, now), true);
  assert.equal(backendHmac.isSkewAcceptable(now - 4 * 60_000, now), true);
  assert.equal(backendHmac.isSkewAcceptable(now - 6 * 60_000, now), false);
  // A laptop clock running fast is just as much a replay risk as one running slow.
  assert.equal(backendHmac.isSkewAcceptable(now + 6 * 60_000, now), false);
});
