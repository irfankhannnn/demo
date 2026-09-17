import test from 'node:test';
import assert from 'node:assert/strict';

import { safeEqual, requireApiKey, extractTenantId } from './internalAuth.js';

/** Minimal express-ish req/res doubles. */
function mockReq(headers = {}) {
  return { headers, path: '/calls/start', method: 'POST' };
}

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
}

function run(middleware, req) {
  const res = mockRes();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

const SECRET = 'a'.repeat(48);
const ENV_VAR = 'TEST_CALLER_API_KEY';

function withSecret(value, fn) {
  const previous = process.env[ENV_VAR];
  if (value === undefined) delete process.env[ENV_VAR];
  else process.env[ENV_VAR] = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env[ENV_VAR];
    else process.env[ENV_VAR] = previous;
  }
}

test('safeEqual matches identical strings and rejects everything else', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  // Unequal lengths must not throw — timingSafeEqual does on mismatched buffers.
  assert.doesNotThrow(() => safeEqual('short', 'much-longer-value'));
  assert.equal(safeEqual('short', 'much-longer-value'), false);
  // Empty is never a match, so an unset header can't equal an unset secret.
  assert.equal(safeEqual('', ''), false);
  assert.equal(safeEqual(undefined, undefined), false);
  assert.equal(safeEqual(null, ''), false);
});

test('requireApiKey accepts the correct key', () => {
  withSecret(SECRET, () => {
    const { res, nextCalled } = run(
      requireApiKey(ENV_VAR, 'test'),
      mockReq({ 'x-api-key': SECRET })
    );
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
  });
});

test('requireApiKey rejects a wrong key with 401', () => {
  withSecret(SECRET, () => {
    const { res, nextCalled } = run(
      requireApiKey(ENV_VAR, 'test'),
      mockReq({ 'x-api-key': 'b'.repeat(48) })
    );
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'Unauthorized');
  });
});

test('requireApiKey rejects a missing key with 401', () => {
  withSecret(SECRET, () => {
    const { res, nextCalled } = run(requireApiKey(ENV_VAR, 'test'), mockReq({}));
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });
});

test('requireApiKey FAILS CLOSED when the secret is unset', () => {
  withSecret(undefined, () => {
    // Even presenting a key must not get through when nothing is configured —
    // otherwise a misconfigured deploy silently serves the API unauthenticated.
    const { res, nextCalled } = run(
      requireApiKey(ENV_VAR, 'test'),
      mockReq({ 'x-api-key': SECRET })
    );
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 503);
  });
});

test('requireApiKey fails closed when the secret is empty string', () => {
  withSecret('', () => {
    const { res, nextCalled } = run(requireApiKey(ENV_VAR, 'test'), mockReq({ 'x-api-key': '' }));
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 503);
  });
});

test('requireApiKey reads the secret per request, not at import', () => {
  const middleware = requireApiKey(ENV_VAR, 'test');
  // Built while unset; a later-hydrated secret (Secrets Manager on cold start)
  // must still be picked up.
  withSecret(SECRET, () => {
    const { nextCalled } = run(middleware, mockReq({ 'x-api-key': SECRET }));
    assert.equal(nextCalled, true);
  });
});

test('extractTenantId sets req.tenantId and rejects when absent', () => {
  const req = mockReq({ 'x-tenant-id': 'tenant-123' });
  const ok = run(extractTenantId, req);
  assert.equal(ok.nextCalled, true);
  assert.equal(req.tenantId, 'tenant-123');

  const bad = run(extractTenantId, mockReq({}));
  assert.equal(bad.nextCalled, false);
  assert.equal(bad.res.statusCode, 400);
});
