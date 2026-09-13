// Agent upload endpoints, contract section 4. Registration is exercised
// without HMAC (the pairing code is the credential); everything else is signed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { signRequest, HEADERS } from '../services/hmac.js';
import { startApp, makeFakeDb, TENANT } from './support.js';

const DEVICE_ID = 'device-1';
const SECRET = 'c'.repeat(64);
const ACTIVE_DEVICE = { deviceId: DEVICE_ID, tenantId: TENANT, deviceSecret: SECRET, status: 'active' };

let nonceCounter = 0;

function signed(path, body, method = 'POST') {
  const timestamp = Date.now();
  const nonce = `nonce-${(nonceCounter += 1)}`;
  return {
    [HEADERS.deviceId]: DEVICE_ID,
    [HEADERS.timestamp]: String(timestamp),
    [HEADERS.nonce]: nonce,
    [HEADERS.signature]: signRequest({
      secret: SECRET,
      method,
      path,
      timestamp,
      nonce,
      rawBody: Buffer.from(body ?? ''),
    }),
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

async function post(app, path, payload) {
  const body = JSON.stringify(payload);
  return app.request(path, { method: 'POST', body, headers: signed(path, body) });
}

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

const REGISTER = '/api/insta/agent/register';

function validCode(overrides = {}) {
  return {
    code: 'ABCD2345',
    tenantId: TENANT,
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    usedAt: null,
    ...overrides,
  };
}

test('register exchanges a pairing code for a device secret, once', async () => {
  const db = makeFakeDb({ getPairingCodeByCode: async () => validCode() });

  await withApp(db, async (app) => {
    const res = await app.request(REGISTER, {
      method: 'POST',
      body: JSON.stringify({ pairingCode: 'ABCD2345', deviceName: 'owner-laptop', platform: 'darwin' }),
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.tenantId, TENANT);
    assert.match(res.body.deviceId, /^[0-9a-f-]{36}$/);
    assert.match(res.body.deviceSecret, /^[0-9a-f]{64}$/);

    // The code must be consumed before the device row is written.
    const order = db.calls.map((c) => c.name);
    assert.ok(order.indexOf('consumePairingCode') < order.indexOf('createDevice'));
  });
});

test('register requires a pairing code', async () => {
  await withApp(makeFakeDb(), async (app) => {
    const res = await app.request(REGISTER, { method: 'POST', body: '{}' });
    assert.equal(res.status, 400);
  });
});

test('an unknown, expired or already-used code is rejected the same way', async () => {
  const cases = [
    ['unknown', null],
    // Expiry is re-checked in code: DynamoDB's TTL sweep can lag by hours.
    ['expired', validCode({ expiresAt: Math.floor(Date.now() / 1000) - 60 })],
    ['used', validCode({ usedAt: new Date().toISOString() })],
  ];

  for (const [label, record] of cases) {
    const db = makeFakeDb({ getPairingCodeByCode: async () => record });
    await withApp(db, async (app) => {
      const res = await app.request(REGISTER, {
        method: 'POST',
        body: JSON.stringify({ pairingCode: 'ABCD2345' }),
      });
      assert.equal(res.status, 401, label);
      assert.equal(db.calls.some((c) => c.name === 'createDevice'), false, label);
    });
  }
});

test('losing the race for a code yields 409, not a second device', async () => {
  const db = makeFakeDb({
    getPairingCodeByCode: async () => validCode(),
    consumePairingCode: async () => null,
  });

  await withApp(db, async (app) => {
    const res = await app.request(REGISTER, {
      method: 'POST',
      body: JSON.stringify({ pairingCode: 'ABCD2345' }),
    });
    assert.equal(res.status, 409);
    assert.equal(db.calls.some((c) => c.name === 'createDevice'), false);
  });
});

// ---------------------------------------------------------------------------
// snapshot / enquiries / threads
// ---------------------------------------------------------------------------

test('snapshot upserts accounts, media and media snapshots under the device tenant', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });

  await withApp(db, async (app) => {
    const res = await post(app, '/api/insta/agent/snapshot', {
      accounts: [{ igUserId: '178414', followersCount: 1200 }],
      media: [{ mediaId: 'm1', caption: 'reel' }, { caption: 'no id' }],
      mediaSnapshots: [{ mediaId: 'm1', views: 900 }],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.accounts, 1);
    // The row with no mediaId is dropped rather than written with a null key.
    assert.equal(res.body.media, 1);
    assert.equal(res.body.mediaSnapshots, 1);

    const accountCall = db.calls.find((c) => c.name === 'putAccountSnapshots');
    assert.equal(accountCall.args[0], TENANT);
    // A missing date defaults to today so the series always has a key.
    assert.match(accountCall.args[1][0].date, /^\d{4}-\d{2}-\d{2}$/);
  });
});

test('snapshot rejects a non-array payload and an oversized batch', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });

  await withApp(db, async (app) => {
    const bad = await post(app, '/api/insta/agent/snapshot', { accounts: 'nope' });
    assert.equal(bad.status, 400);

    const huge = await post(app, '/api/insta/agent/snapshot', {
      media: Array.from({ length: 501 }, (_, i) => ({ mediaId: `m${i}` })),
    });
    assert.equal(huge.status, 400);
    assert.match(huge.body.details, /500-item limit/);
    assert.equal(db.calls.some((c) => c.name === 'putMediaItems'), false);
  });
});

test('enquiries are normalised server-side before they are stored', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });

  await withApp(db, async (app) => {
    const res = await post(app, '/api/insta/agent/enquiries', {
      enquiries: [
        {
          enquiryId: 'e1',
          phone: '09876543210',
          intent: 'BUY',
          temperature: 'blazing',
          status: 'nonsense',
          budget: '2.5cr',
        },
        { name: 'no id' },
      ],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1);
    assert.equal(res.body.rejected.length, 1);
    assert.match(res.body.rejected[0].reason, /enquiryId/);

    const [tenantId, rows] = db.calls.find((c) => c.name === 'putEnquiries').args;
    assert.equal(tenantId, TENANT);
    assert.equal(rows[0].phone, '+919876543210');
    assert.equal(rows[0].intent, 'buy');
    assert.equal(rows[0].temperature, 'cold');
    assert.equal(rows[0].status, 'new');
    assert.equal(rows[0].budgetBracket, '2Cr_5Cr');
  });
});

test('threads coerce an unrecognised window state to CLOSED', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });

  await withApp(db, async (app) => {
    const res = await post(app, '/api/insta/agent/threads', {
      threads: [
        { conversationId: 'c1', windowState: 'human_agent' },
        { conversationId: 'c2', windowState: 'SOMETHING_NEW' },
        { windowState: 'STANDARD' },
      ],
    });

    assert.equal(res.status, 200);
    const rows = db.calls.find((c) => c.name === 'putThreads').args[1];
    assert.equal(rows.length, 2);
    assert.equal(rows[0].windowState, 'HUMAN_AGENT');
    // Unknown means un-sendable, which is the safe direction for Meta's rules.
    assert.equal(rows[1].windowState, 'CLOSED');
  });
});

test('threads and enquiries reject a non-array payload', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });

  await withApp(db, async (app) => {
    assert.equal((await post(app, '/api/insta/agent/threads', { threads: {} })).status, 400);
    assert.equal((await post(app, '/api/insta/agent/enquiries', {})).status, 400);
  });
});

test('heartbeat records lastSeenAt and echoes the kill switch', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });
  process.env.INSTA_KILL_SWITCH = 'true';

  try {
    await withApp(db, async (app) => {
      const res = await post(app, '/api/insta/agent/heartbeat', {
        igUserId: '178414',
        agentVersion: '1.2.0',
        counters: { graphReads: 42 },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.killSwitch, true);

      const fields = db.calls.find((c) => c.name === 'updateDevice').args[2];
      assert.equal(fields.igUserId, '178414');
      assert.equal(fields.agentVersion, '1.2.0');
      assert.ok(Date.parse(fields.lastSeenAt) > 0);
    });
  } finally {
    delete process.env.INSTA_KILL_SWITCH;
  }
});

// ---------------------------------------------------------------------------
// enquiry -> CRM lead promotion
//
// The local write and the promotion are deliberately not atomic: the enquiry is
// stored first so the agent's data is never lost, then handed to the CRM. What
// matters is that a promotion failure is *reported* rather than swallowed, so
// the agent's upload queue retries it — which is safe because every enquiry
// carries its enquiryId as a dedupeKey on the CRM side.
// ---------------------------------------------------------------------------

async function withAppAndCrm(db, crm, fn) {
  const app = await startApp({ db, crm });
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

test('a stored enquiry is forwarded to the CRM and the outcome is reported back', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });
  const forwarded = [];
  const crm = {
    forwardEnquiriesToCrm: async (tenantId, rows) => {
      forwarded.push({ tenantId, rows });
      return { forwarded: true, created: 1, skipped: 0, duplicates: 0, failed: 0 };
    },
  };

  await withAppAndCrm(db, crm, async (app) => {
    const res = await post(app, '/api/insta/agent/enquiries', {
      enquiries: [{ enquiryId: 'e1', name: 'Rahul', phone: '9876543210', intent: 'buy' }],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1);
    assert.equal(res.body.promotion.created, 1);

    // The CRM must receive the *normalised* rows, not the raw upload.
    assert.equal(forwarded.length, 1);
    assert.equal(forwarded[0].tenantId, TENANT);
    assert.equal(forwarded[0].rows[0].phone, '+919876543210');
  });
});

test('a promotion failure returns 502 so the agent retries the batch', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });
  const crm = {
    forwardEnquiriesToCrm: async () => ({
      forwarded: false, created: 0, skipped: 0, duplicates: 0, failed: 0, reason: 'network_error',
    }),
  };

  await withAppAndCrm(db, crm, async (app) => {
    const res = await post(app, '/api/insta/agent/enquiries', {
      enquiries: [{ enquiryId: 'e1', name: 'Rahul', phone: '9876543210' }],
    });

    assert.equal(res.status, 502);
    assert.equal(res.body.promotion.reason, 'network_error');
    // The enquiry is still stored — the retry is about promotion, not storage.
    assert.ok(db.calls.some((c) => c.name === 'putEnquiries'));
  });
});

test('an unconfigured CRM leaves the upload succeeding, feature runs standalone', async () => {
  const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });
  const crm = {
    forwardEnquiriesToCrm: async () => ({
      forwarded: false, created: 0, skipped: 0, duplicates: 0, failed: 0, reason: 'not_configured',
    }),
  };

  await withAppAndCrm(db, crm, async (app) => {
    const res = await post(app, '/api/insta/agent/enquiries', {
      enquiries: [{ enquiryId: 'e1', name: 'Rahul', phone: '9876543210' }],
    });

    // Not a failure: this is exactly the pre-bridge behaviour.
    assert.equal(res.status, 200);
    assert.equal(res.body.written, 1);
  });
});

test('the kill switch stops promotion without affecting storage', async () => {
  process.env.INSTA_PROMOTE_ENQUIRIES_TO_LEADS = 'false';
  try {
    const db = makeFakeDb({ getDeviceById: async () => ACTIVE_DEVICE });
    let called = false;
    const crm = { forwardEnquiriesToCrm: async () => { called = true; return { forwarded: true }; } };

    await withAppAndCrm(db, crm, async (app) => {
      const res = await post(app, '/api/insta/agent/enquiries', {
        enquiries: [{ enquiryId: 'e1', name: 'Rahul', phone: '9876543210' }],
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.written, 1);
      assert.equal(called, false, 'promotion must not run when the kill switch is off');
    });
  } finally {
    delete process.env.INSTA_PROMOTE_ENQUIRIES_TO_LEADS;
  }
});
