/**
 * The service-caller key check, end to end through Express.
 *
 * Boots the real app with both caller keys set and proves: either key opens
 * /internal, anything else is a 401 with the standard shape, and the
 * tenant-scoping helpers behave. Also covers the pure matcher so the
 * constant-time comparison is exercised on odd lengths and non-strings.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.CRM_INTERNAL_API_DOMAIN_NAME = 'http://localhost:9999';
process.env.CRM_INTERNAL_API_BASE_PATH = '';
process.env.MARKETPLACE_INTERNAL_API_KEY = 'to-crm';
process.env.CRM_CALLER_API_KEY = 'crm-caller-key-0123456789abcdef';
process.env.AUTH_CALLER_API_KEY = 'auth-caller-key-fedcba9876543210';
process.env.COGNITO_USER_POOL_ID = 'ap-south-1_TEST';
process.env.MARKETPLACE_TABLE_NAME = 'test-table';

const { matchCaller, safeKeyEquals } = await import('../middleware/internalAuth.js');
const { setDocClient } = await import('../services/dynamo.js');

// A DocumentClient that owns no threads: every lookup misses, so the routes
// past the key check answer 404 — enough to tell "authorised" from "not".
setDocClient({ async send() { return { Item: undefined, Items: [] }; } });

const { createApp } = await import('../server.js');

let server;
let base;
before(async () => {
  await new Promise((resolve) => {
    server = createApp().listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});
after(() => server?.close());

const call = (path, headers = {}, method = 'GET') => fetch(`${base}${path}`, { method, headers });

describe('matchCaller', () => {
  const keys = { crm: 'aaaa', auth: 'bbbbbbbb' };
  test('identifies each caller', () => {
    assert.equal(matchCaller('aaaa', keys), 'crm');
    assert.equal(matchCaller('bbbbbbbb', keys), 'auth');
  });
  test('rejects wrong, truncated, empty and non-string keys without throwing', () => {
    for (const bad of ['aaab', 'aaa', 'aaaaa', '', null, undefined, 42, ['aaaa']]) {
      assert.equal(matchCaller(bad, keys), null, `should reject ${String(bad)}`);
    }
  });
  test('an unconfigured key never matches an empty header', () => {
    assert.equal(safeKeyEquals('', ''), false);
    assert.equal(matchCaller('', { crm: '', auth: 'x' }), null);
  });
});

describe('/internal over HTTP', () => {
  test('no key → 401 with the standard error shape', async () => {
    const res = await call('/internal/tenants/t1/threads');
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: 'Unauthorized' });
  });

  test('wrong key → 401', async () => {
    const res = await call('/internal/tenants/t1/threads', { 'x-api-key': 'nope' });
    assert.equal(res.status, 401);
  });

  test('CRM key is accepted', async () => {
    const res = await call('/internal/tenants/t1/threads', { 'x-api-key': process.env.CRM_CALLER_API_KEY });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { items: [], nextCursor: null });
  });

  test('auth-service key is accepted too', async () => {
    const res = await call('/internal/users/u1', { 'x-api-key': process.env.AUTH_CALLER_API_KEY }, 'DELETE');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  test('thread routes demand x-tenant-id', async () => {
    const res = await call('/internal/threads/th_1', { 'x-api-key': process.env.CRM_CALLER_API_KEY });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /x-tenant-id/);
  });

  test('a header tenant that disagrees with the path tenant is a 404, not a leak', async () => {
    const res = await call('/internal/tenants/t1/threads', {
      'x-api-key': process.env.CRM_CALLER_API_KEY, 'x-tenant-id': 't2',
    });
    assert.equal(res.status, 404);
  });

  test('consumer routes are not opened by a caller key', async () => {
    const res = await call('/me', { 'x-api-key': process.env.CRM_CALLER_API_KEY });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, 'Authentication required');
  });

  test('a garbage bearer token is rejected, not treated as anonymous', async () => {
    const res = await call('/me/saved', { authorization: 'Bearer not.a.jwt' });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).details, 'malformed');
  });
});

describe('cross-cutting', () => {
  test('health answers without any auth and carries the security headers', async () => {
    const res = await call('/health');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, 'marketplace-api');
    assert.ok(body.version);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('content-security-policy') || '', /frame-ancestors 'none'/);
  });

  test('CORS reflects the origin outside production when no web origin is set', async () => {
    const res = await fetch(`${base}/cities`, { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.match(res.headers.get('access-control-allow-headers') || '', /Authorization/);
  });

  test('unknown routes are JSON 404s', async () => {
    const res = await call('/nope');
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Not found' });
  });
});
