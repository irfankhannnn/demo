/**
 * Tests for phone normalization and webhook source validation.
 *
 * toE164India is the fail-fast guard the audit asked for: the previous
 * implementation returned whatever digits it found, so a malformed number
 * reached the telephony provider and failed late and opaquely.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toE164India,
  parseWebhookPayload,
  validateWebhookSource,
  connectCall,
  setClient,
  resetClient,
} from './exotelService.js';

test('toE164India accepts the formats Indian numbers actually arrive in', () => {
  const expected = '+919876543210';
  for (const input of [
    '9876543210',
    '919876543210',
    '+91 98765 43210',
    '09876543210',
    '0091 9876543210',
    '98765-43210',
  ]) {
    const result = toE164India(input);
    assert.equal(result.valid, true, `${input} should be valid`);
    assert.equal(result.e164, expected, `${input} should normalize to ${expected}`);
  }
});

test('toE164India rejects malformed numbers instead of passing them through', () => {
  for (const input of ['', null, undefined, '12345', '1234567890', '98765432101', 'abcdefghij']) {
    const result = toE164India(input);
    assert.equal(result.valid, false, `${input} should be rejected`);
    assert.equal(result.e164, null);
    assert.ok(result.reason, 'a rejection must explain itself');
  }
});

test('toE164India rejects landline-style leading digits', () => {
  // Indian mobile numbers start 6-9; 1-5 are not valid mobile prefixes.
  assert.equal(toE164India('5876543210').valid, false);
  assert.equal(toE164India('1234509876').valid, false);
});

test('parseWebhookPayload survives malformed CustomField', () => {
  const parsed = parseWebhookPayload({
    CallSid: 'sid_1',
    Status: 'completed',
    CustomField: 'not json{{{',
  });
  assert.equal(parsed.callSid, 'sid_1');
  assert.equal(parsed.tenantId, undefined);
  assert.equal(parsed.callSessionId, undefined);
});

test('parseWebhookPayload extracts correlation ids from valid CustomField', () => {
  const parsed = parseWebhookPayload({
    CallSid: 'sid_1',
    Status: 'completed',
    Duration: '42',
    CustomField: JSON.stringify({ tenantId: 't1', callSessionId: 'c1' }),
  });
  assert.equal(parsed.tenantId, 't1');
  assert.equal(parsed.callSessionId, 'c1');
  assert.equal(parsed.duration, 42);
});

test('validateWebhookSource fails closed in prod when no allowlist is configured', () => {
  const prevEnv = process.env.ENVIRONMENT;
  const prevIps = process.env.EXOTEL_WEBHOOK_IPS;
  delete process.env.EXOTEL_WEBHOOK_IPS;
  process.env.ENVIRONMENT = 'prod';

  const result = validateWebhookSource({ headers: {}, ip: '1.2.3.4' });
  assert.equal(result.valid, false);

  process.env.ENVIRONMENT = prevEnv;
  if (prevIps !== undefined) process.env.EXOTEL_WEBHOOK_IPS = prevIps;
});

test('validateWebhookSource honours the allowlist', () => {
  const prevIps = process.env.EXOTEL_WEBHOOK_IPS;
  process.env.EXOTEL_WEBHOOK_IPS = '1.2.3.4, 5.6.7.8';

  assert.equal(validateWebhookSource({ headers: {}, ip: '1.2.3.4' }).valid, true);
  assert.equal(
    validateWebhookSource({ headers: { 'x-forwarded-for': '5.6.7.8, 10.0.0.1' } }).valid,
    true
  );
  assert.equal(validateWebhookSource({ headers: {}, ip: '9.9.9.9' }).valid, false);

  if (prevIps === undefined) delete process.env.EXOTEL_WEBHOOK_IPS;
  else process.env.EXOTEL_WEBHOOK_IPS = prevIps;
});

/** A fake axios-like client that records what connectCall posts. */
function fakeExotelClient({ reject = false } = {}) {
  const posts = [];
  return {
    posts,
    async post(url, body) {
      posts.push({ url, body });
      if (reject) {
        const error = new Error('Request failed with status code 400');
        error.response = { status: 400, data: { RestException: { Message: 'Invalid CallerId' } } };
        throw error;
      }
      return { data: { Call: { Sid: 'sid_connect_1', Status: 'in-progress' } } };
    },
  };
}

test.afterEach(() => resetClient());

test('connectCall posts form-encoded fields to Calls/connect.json', async () => {
  // Exotel rejects JSON bodies on this endpoint, so the encoding is the
  // contract: URLSearchParams, the exact field names, and terminal-only
  // status callbacks. CustomField carries our ids back on the webhook.
  const client = fakeExotelClient();
  setClient(client);

  const result = await connectCall({
    from: '+919800000000',
    to: '+919812345678',
    callerId: '+912212345678',
    statusCallbackUrl: 'https://calls.example.com/webhooks/exotel/status',
    customField: { tenantId: 't1', callSessionId: 'c1' },
  });

  assert.equal(result.callSid, 'sid_connect_1');
  assert.equal(result.status, 'in-progress');
  assert.equal(client.posts.length, 1);

  const { url, body } = client.posts[0];
  assert.equal(url, '/Calls/connect.json');
  assert.ok(body instanceof URLSearchParams, 'body must be form-encoded, not JSON');
  assert.equal(body.get('From'), '+919800000000');
  assert.equal(body.get('To'), '+919812345678');
  assert.equal(body.get('CallerId'), '+912212345678');
  assert.equal(body.get('StatusCallback'), 'https://calls.example.com/webhooks/exotel/status');
  assert.equal(body.get('StatusCallbackEvents[0]'), 'terminal');
  assert.deepEqual(JSON.parse(body.get('CustomField')), { tenantId: 't1', callSessionId: 'c1' });

  // The serialised form is what actually goes over the wire.
  const wire = body.toString();
  assert.match(wire, /^From=%2B919800000000&To=%2B919812345678&CallerId=%2B912212345678&/);
});

test('connectCall omits the callback fields when no webhook URL is configured', async () => {
  const client = fakeExotelClient();
  setClient(client);

  await connectCall({ from: '+919800000000', to: '+919812345678', callerId: '+912212345678' });

  const { body } = client.posts[0];
  assert.equal(body.has('StatusCallback'), false);
  assert.equal(body.has('StatusCallbackEvents[0]'), false);
  assert.equal(body.has('CustomField'), false);
});

test('connectCall fails fast on missing parties and surfaces the Exotel reason', async () => {
  setClient(fakeExotelClient());
  await assert.rejects(
    () => connectCall({ to: '+919812345678', callerId: '+912212345678' }),
    /from is required/
  );
  await assert.rejects(
    () => connectCall({ from: '+919800000000', to: '+919812345678' }),
    /callerId is required/
  );

  setClient(fakeExotelClient({ reject: true }));
  await assert.rejects(
    () => connectCall({ from: '+919800000000', to: '+919812345678', callerId: '+912212345678' }),
    /Invalid CallerId/
  );
});
