// CORS preflight handling.
//
// What these tests protect: a browser preflight must never reach the JWT
// middleware. When it did, a disallowed origin's OPTIONS came back 401 with no
// CORS headers (the dev dashboard at app.realestateflow.in failed exactly this
// way), and an allowed origin must still get its Access-Control-Allow-* headers.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';
import './support.js';

const ALLOWED = 'https://app.realestateflow.in';
const DISALLOWED = 'https://evil.example.test';

async function boot() {
  process.env.ALLOWED_ORIGINS = `${ALLOWED},http://localhost:5173`;
  let authCalls = 0;
  const app = createApp({
    authMiddleware: (_req, res) => {
      authCalls += 1;
      res.status(401).json({ error: 'Unauthorized' });
    },
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    preflight: (path, requestOrigin) =>
      fetch(`${origin}${path}`, {
        method: 'OPTIONS',
        headers: {
          Origin: requestOrigin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization',
        },
      }),
    get: (path, requestOrigin) => fetch(`${origin}${path}`, { headers: { Origin: requestOrigin } }),
    authCalls: () => authCalls,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('OPTIONS from an allowed origin returns 204 with CORS headers and skips auth', async () => {
  const app = await boot();
  try {
    const res = await app.preflight('/api/insta/accounts', ALLOWED);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED);
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
    assert.match(res.headers.get('access-control-allow-headers') || '', /Authorization/i);
    assert.equal(app.authCalls(), 0);
  } finally {
    await app.close();
  }
});

test('OPTIONS from a disallowed origin is not a 401 and never reaches auth', async () => {
  const app = await boot();
  try {
    const res = await app.preflight('/api/insta/accounts', DISALLOWED);
    assert.notEqual(res.status, 401);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
    assert.equal(app.authCalls(), 0);
  } finally {
    await app.close();
  }
});

test('a non-preflight request from an allowed origin still goes through auth', async () => {
  const app = await boot();
  try {
    const res = await app.get('/api/insta/accounts', ALLOWED);
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED);
    assert.equal(app.authCalls(), 1);
  } finally {
    await app.close();
  }
});
