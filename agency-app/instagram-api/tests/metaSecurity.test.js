// Token encryption, OAuth state, webhook signatures, signed_request.

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { withEnv } from './support.js';
import {
  encryptSecret,
  decryptSecret,
  signOAuthState,
  verifyOAuthState,
  OAuthStateError,
  verifyWebhookSignature,
  parseSignedRequest,
  buildSignedRequest,
} from '../services/metaSecurity.js';

test('tokens round-trip and the ciphertext does not contain the token', () => {
  const blob = encryptSecret('IGAAT-secret-token');
  assert.match(blob, /^v1:/);
  assert.ok(!blob.includes('IGAAT'));
  assert.equal(decryptSecret(blob), 'IGAAT-secret-token');
  assert.notEqual(encryptSecret('same'), encryptSecret('same'), 'a fresh IV every time');
});

test('a tampered or foreign ciphertext does not decrypt', async () => {
  const blob = encryptSecret('token');
  const parts = blob.split(':');
  parts[3] = Buffer.from('tampered').toString('base64url');
  assert.throws(() => decryptSecret(parts.join(':')));
  assert.throws(() => decryptSecret('plain-token'), /recognised format/);

  await withEnv({ INSTA_TOKEN_ENCRYPTION_KEY: 'f'.repeat(64) }, () => {
    assert.throws(() => decryptSecret(blob), 'a different key must not decrypt');
  });
});

test('OAuth state carries the tenant and rejects tampering and expiry', () => {
  const now = Date.now();
  const state = signOAuthState({ tenantId: 't1', userId: 'u1' }, { now });
  assert.deepEqual(verifyOAuthState(state, { now }), { tenantId: 't1', userId: 'u1' });

  const [payload, sig] = state.split('.');
  const forged = Buffer.from(JSON.stringify({ t: 'victim', u: null, n: 'x', exp: now + 1e6 })).toString('base64url');
  assert.throws(() => verifyOAuthState(`${forged}.${sig}`, { now }), OAuthStateError);
  assert.throws(() => verifyOAuthState(`${payload}.AAAA`, { now }), OAuthStateError);
  assert.throws(() => verifyOAuthState('', { now }), OAuthStateError);
  assert.throws(() => verifyOAuthState(state, { now: now + 16 * 60 * 1000 }), /expired/);
});

test('webhook signatures are checked over the raw bytes', () => {
  const body = Buffer.from('{"object":"instagram","entry":[]}');
  const good = `sha256=${crypto.createHmac('sha256', 'app-secret').update(body).digest('hex')}`;
  assert.equal(verifyWebhookSignature(body, good, 'app-secret'), true);
  assert.equal(verifyWebhookSignature(Buffer.from('{"object":"instagram","entry": []}'), good, 'app-secret'), false);
  assert.equal(verifyWebhookSignature(body, good, 'other-secret'), false);
  assert.equal(verifyWebhookSignature(body, good.replace('sha256=', ''), 'app-secret'), false);
  assert.equal(verifyWebhookSignature(body, undefined, 'app-secret'), false);
  assert.equal(verifyWebhookSignature(body, good, ''), false, 'no secret configured means nothing verifies');
});

test('signed_request verifies with the app secret only', () => {
  const sr = buildSignedRequest({ user_id: '1784', issued_at: 1 }, 'app-secret');
  assert.equal(parseSignedRequest(sr, 'app-secret').user_id, '1784');
  assert.equal(parseSignedRequest(sr, 'wrong'), null);
  assert.equal(parseSignedRequest('garbage', 'app-secret'), null);
  assert.equal(parseSignedRequest(undefined, 'app-secret'), null);
});
