// The HMAC middleware end to end, over a real HTTP request, against a fake
// dynamoService. This is the test that proves rawBody capture actually works —
// a unit test of verifySignature alone would pass even if express.json's verify
// hook were misconfigured.

import test from 'node:test';
import assert from 'node:assert/strict';
import { signRequest, HEADERS } from '../services/hmac.js';
import { startApp, makeFakeDb, TENANT } from './support.js';

const DEVICE_ID = 'device-1';
const SECRET = 'f'.repeat(64);

const ACTIVE_DEVICE = {
  deviceId: DEVICE_ID,
  tenantId: TENANT,
  deviceSecret: SECRET,
  status: 'active',
  deviceName: 'owner-laptop',
};

function signedHeaders({ method = 'POST', path, body, timestamp = Date.now(), nonce = 'nonce-1', secret = SECRET }) {
  const rawBody = Buffer.from(body ?? '');
  return {
    [HEADERS.deviceId]: DEVICE_ID,
    [HEADERS.timestamp]: String(timestamp),
    [HEADERS.nonce]: nonce,
    [HEADERS.signature]: signRequest({ secret, method, path, timestamp, nonce, rawBody }),
  };
}

async function withApp(db, fn) {
  const app = await startApp({ db });
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

const HEARTBEAT = '/api/insta/agent/heartbeat';

test('a correctly signed request is accepted and the tenant comes from the device', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });

  await withApp(db, async (app) => {
    const body = JSON.stringify({ igUserId: '178414', agentVersion: '1.0.0' });
    const res = await app.request(HEARTBEAT, {
      method: 'POST',
      body,
      headers: signedHeaders({ path: HEARTBEAT, body }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.serverTime, 'string');
    assert.equal(res.body.killSwitch, false);

    const update = db.calls.find((c) => c.name === 'updateDevice');
    assert.equal(update.args[0], TENANT, 'tenantId must come from the device record');
  });
});

test('a replayed nonce is rejected even though the signature is still valid', async () => {
  let claimed = false;
  const db = makeFakeDb({
    getDeviceById: async () => ACTIVE_DEVICE,
    claimNonce: async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    },
  });

  await withApp(db, async (app) => {
    const body = JSON.stringify({ igUserId: '178414' });
    const headers = signedHeaders({ path: HEARTBEAT, body });

    const first = await app.request(HEARTBEAT, { method: 'POST', body, headers });
    assert.equal(first.status, 200);

    // Byte-identical replay of the same signed request.
    const second = await app.request(HEARTBEAT, { method: 'POST', body, headers });
    assert.equal(second.status, 401);
    assert.equal(second.body.error, 'Unauthorized');
    assert.equal(second.body.details, 'Nonce already used');
  });
});

test('a stale timestamp is rejected before the device is even read', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });

  await withApp(db, async (app) => {
    const body = JSON.stringify({});
    const res = await app.request(HEARTBEAT, {
      method: 'POST',
      body,
      headers: signedHeaders({ path: HEARTBEAT, body, timestamp: Date.now() - 6 * 60 * 1000 }),
    });

    assert.equal(res.status, 401);
    assert.match(res.body.details, /timestamp/i);
    // Cheap checks run first, so nothing was read and no nonce was burned.
    assert.equal(db.calls.some((c) => c.name === 'getDeviceById'), false);
    assert.equal(db.calls.some((c) => c.name === 'claimNonce'), false);
  });
});

test('a future-dated timestamp is rejected too', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });

  await withApp(db, async (app) => {
    const body = JSON.stringify({});
    const res = await app.request(HEARTBEAT, {
      method: 'POST',
      body,
      headers: signedHeaders({ path: HEARTBEAT, body, timestamp: Date.now() + 6 * 60 * 1000 }),
    });
    assert.equal(res.status, 401);
  });
});

test('a tampered body is rejected — the signature covers the bytes on the wire', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });

  await withApp(db, async (app) => {
    const signedBody = JSON.stringify({ igUserId: '178414' });
    const headers = signedHeaders({ path: HEARTBEAT, body: signedBody });

    const res = await app.request(HEARTBEAT, {
      method: 'POST',
      body: JSON.stringify({ igUserId: 'attacker' }),
      headers,
    });

    assert.equal(res.status, 401);
    assert.match(res.body.details, /Signature/i);
    // A failed signature must not consume the nonce, or an attacker could burn
    // a legitimate agent's nonces by replaying garbage.
    assert.equal(db.calls.some((c) => c.name === 'claimNonce'), false);
  });
});

test('a revoked device is rejected', async () => {
  const db = makeFakeDb({
    getDeviceById: async () => ({ ...ACTIVE_DEVICE, status: 'revoked' }),
  });

  await withApp(db, async (app) => {
    const body = JSON.stringify({});
    const res = await app.request(HEARTBEAT, {
      method: 'POST',
      body,
      headers: signedHeaders({ path: HEARTBEAT, body }),
    });
    assert.equal(res.status, 401);
    assert.match(res.body.details, /revoked/i);
  });
});

test('an unknown device is rejected', async () => {
  const db = makeFakeDb({ getDeviceById: async () => null });

  await withApp(db, async (app) => {
    const body = JSON.stringify({});
    const res = await app.request(HEARTBEAT, {
      method: 'POST',
      body,
      headers: signedHeaders({ path: HEARTBEAT, body }),
    });
    assert.equal(res.status, 401);
  });
});

test('missing HMAC headers are rejected', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });

  await withApp(db, async (app) => {
    const res = await app.request(HEARTBEAT, { method: 'POST', body: '{}' });
    assert.equal(res.status, 401);
    assert.match(res.body.details, /Missing device authentication headers/);
  });
});

test('a signature for a different path does not work on this one', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });

  await withApp(db, async (app) => {
    const body = JSON.stringify({ threads: [] });
    const res = await app.request('/api/insta/agent/threads', {
      method: 'POST',
      body,
      headers: signedHeaders({ path: HEARTBEAT, body }),
    });
    assert.equal(res.status, 401);
  });
});

test('a GET with no body signs over the empty-string hash', async () => {
  const db = makeFakeDb({
    getDeviceById: async () => ACTIVE_DEVICE,
    listRules: async () => [{ ruleId: 'r1', keyword: 'price', updatedAt: '2026-03-04T00:00:00.000Z' }],
  });

  await withApp(db, async (app) => {
    const path = '/api/insta/agent/rules';
    const res = await app.request(path, {
      method: 'GET',
      headers: signedHeaders({ method: 'GET', path }),
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.rules.length, 1);
    assert.equal(res.body.updatedAt, '2026-03-04T00:00:00.000Z');
  });
});
