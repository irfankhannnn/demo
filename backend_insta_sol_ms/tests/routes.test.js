// Route handlers over real HTTP with a mocked dynamoService.

import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, makeFakeDb, TENANT, OTHER_TENANT } from './support.js';

async function withApp(db, fn, opts = {}) {
  const app = await startApp({ db, ...opts });
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

const BASE = '/api/insta';

// ---------------------------------------------------------------------------
// health + 404
// ---------------------------------------------------------------------------

test('GET /health is open and does not touch the tables', async () => {
  const db = makeFakeDb();
  await withApp(db, async (app) => {
    const res = await app.request(`${BASE}/health`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'insta-sol-ms');
    assert.equal(db.calls.length, 0);
  });
});

test('an unknown path answers JSON, never HTML', async () => {
  await withApp(makeFakeDb(), async (app) => {
    const res = await app.request(`${BASE}/nope`);
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Not Found');
  });
});

test('malformed JSON produces the repo error shape', async () => {
  await withApp(makeFakeDb(), async (app) => {
    const res = await app.request(`${BASE}/rules`, { method: 'POST', body: '{not json' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Bad Request');
    assert.equal(typeof res.body.details, 'string');
  });
});

// ---------------------------------------------------------------------------
// devices + accounts
// ---------------------------------------------------------------------------

test('POST /devices/pair issues a code scoped to the authenticated tenant', async () => {
  const db = makeFakeDb();
  await withApp(db, async (app) => {
    const res = await app.request(`${BASE}/devices/pair`, { method: 'POST', body: '{}' });
    assert.equal(res.status, 201);
    assert.match(res.body.pairingCode, /^[A-Z2-9]{8}$/);
    assert.ok(Date.parse(res.body.expiresAt) > Date.now());

    const call = db.calls.find((c) => c.name === 'createPairingCode');
    assert.equal(call.args[0], TENANT);
  });
});

test('a tenantId in the body is ignored — tenancy comes from the auth context', async () => {
  const db = makeFakeDb();
  await withApp(db, async (app) => {
    await app.request(`${BASE}/devices/pair`, {
      method: 'POST',
      body: JSON.stringify({ tenantId: OTHER_TENANT }),
    });
    const call = db.calls.find((c) => c.name === 'createPairingCode');
    assert.equal(call.args[0], TENANT);
  });
});

test('GET /devices never returns a device secret', async () => {
  const db = makeFakeDb({
    listDevices: async () => [
      {
        deviceId: 'd1',
        deviceName: 'owner-laptop',
        deviceSecret: 'THIS-MUST-NOT-LEAK',
        status: 'active',
        lastSeenAt: new Date().toISOString(),
        igUserId: '178414',
      },
    ],
  });

  await withApp(db, async (app) => {
    const res = await app.request(`${BASE}/devices`);
    assert.equal(res.status, 200);
    assert.equal(res.body.devices.length, 1);
    assert.equal(res.body.devices[0].deviceSecret, undefined);
    assert.ok(!JSON.stringify(res.body).includes('THIS-MUST-NOT-LEAK'));
    assert.equal(res.body.devices[0].health, 'online');
  });
});

test('device health degrades to stale after the heartbeat window', async () => {
  const db = makeFakeDb({
    listDevices: async () => [
      { deviceId: 'd1', status: 'active', lastSeenAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
      { deviceId: 'd2', status: 'active', lastSeenAt: null },
      { deviceId: 'd3', status: 'revoked', lastSeenAt: new Date().toISOString() },
    ],
  });

  await withApp(db, async (app) => {
    const res = await app.request(`${BASE}/devices`);
    assert.deepEqual(res.body.devices.map((d) => d.health), ['stale', 'never_seen', 'revoked']);
  });
});

test('DELETE /devices/:id revokes and audits', async () => {
  const db = makeFakeDb();
  await withApp(db, async (app) => {
    const res = await app.request(`${BASE}/devices/d1`, { method: 'DELETE' });
    assert.equal(res.status, 200);
    assert.equal(res.body.device.status, 'revoked');

    const revoke = db.calls.find((c) => c.name === 'revokeDevice');
    assert.deepEqual(revoke.args, [TENANT, 'd1']);
    assert.ok(db.calls.some((c) => c.name === 'putAuditEvent'));
  });
});

test('DELETE on a missing device is a 404, not a 500', async () => {
  const db = makeFakeDb({ revokeDevice: async () => null });
  await withApp(db, async (app) => {
    const res = await app.request(`${BASE}/devices/ghost`, { method: 'DELETE' });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Not Found');
  });
});

test('GET /accounts derives accounts from devices holding an IG token', async () => {
  const db = makeFakeDb({
    listDevices: async () => [
      {
        deviceId: 'd1',
        status: 'active',
        igUserId: '178414',
        igUsername: 'agency',
        lastSeenAt: new Date().toISOString(),
        tokenExpiresAt: new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
      },
      { deviceId: 'd2', status: 'active', igUserId: null },
    ],
  });

  await withApp(db, async (app) => {
    const res = await app.request(`${BASE}/accounts`);
    assert.equal(res.status, 200);
    assert.equal(res.body.accounts.length, 1);
    assert.equal(res.body.deviceCount, 2);
    assert.equal(res.body.accounts[0].tokenExpiringSoon, true);
  });
});

// ---------------------------------------------------------------------------
// enquiries
// ---------------------------------------------------------------------------

test('GET /enquiries passes filters and cursor through to the data layer', async () => {
  const db = makeFakeDb({
    listEnquiries: async () => ({ items: [{ enquiryId: 'e1' }], cursor: 'next-page' }),
  });

  await withApp(db, async (app) => {
    const res = await app.request(`${BASE}/enquiries?status=new&temperature=hot&limit=10&cursor=abc`);
    assert.equal(res.status, 200);
    assert.equal(res.body.enquiries.length, 1);
    assert.equal(res.body.cursor, 'next-page');

    const call = db.calls.find((c) => c.name === 'listEnquiries');
    assert.equal(call.args[0], TENANT);
    assert.equal(call.args[1].status, 'new');
    assert.equal(call.args[1].temperature, 'hot');
    assert.equal(call.args[1].cursor, 'abc');
  });
});

test('an unknown filter value is a 400, not an empty list', async () => {
  await withApp(makeFakeDb(), async (app) => {
    const bad = await app.request(`${BASE}/enquiries?status=archived`);
    assert.equal(bad.status, 400);

    const badTemp = await app.request(`${BASE}/enquiries?temperature=tepid`);
    assert.equal(badTemp.status, 400);
  });
});

test('PATCH /enquiries validates, updates and audits', async () => {
  const db = makeFakeDb({
    updateEnquiry: async (t, id, patch) => ({ enquiryId: id, ...patch }),
  });

  await withApp(db, async (app) => {
    const empty = await app.request(`${BASE}/enquiries/e1`, { method: 'PATCH', body: '{}' });
    assert.equal(empty.status, 400);

    const bad = await app.request(`${BASE}/enquiries/e1`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'archived' }),
    });
    assert.equal(bad.status, 400);

    const ok = await app.request(`${BASE}/enquiries/e1`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'qualified', notes: 'called, wants 2BHK' }),
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.enquiry.status, 'qualified');

    const update = db.calls.find((c) => c.name === 'updateEnquiry');
    assert.equal(update.args[0], TENANT);

    // The status transition is audited; the note body is not.
    const audit = db.calls.find((c) => c.name === 'putAuditEvent');
    assert.equal(audit.args[1].status, 'qualified');
    assert.equal(audit.args[1].notesChanged, true);
    assert.equal(audit.args[1].notes, undefined);
  });
});

test('PATCH on an enquiry outside the tenant reads as 404', async () => {
  const db = makeFakeDb({ updateEnquiry: async () => null });
  await withApp(db, async (app) => {
    const res = await app.request(`${BASE}/enquiries/e-other`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'won' }),
    });
    assert.equal(res.status, 404);
  });
});

// ---------------------------------------------------------------------------
// media
// ---------------------------------------------------------------------------

test('GET /media ranks by enquiries by default and by views on request', async () => {
  const db = makeFakeDb({
    listMedia: async () => [
      { mediaId: 'a', enquiryCount: 1, metrics: { views: 900 } },
      { mediaId: 'b', enquiryCount: 7, metrics: { views: 100 } },
      { mediaId: 'c', enquiryCount: 3, metrics: { views: 500 } },
    ],
  });

  await withApp(db, async (app) => {
    const byEnquiries = await app.request(`${BASE}/media`);
    assert.deepEqual(byEnquiries.body.media.map((m) => m.mediaId), ['b', 'c', 'a']);
    assert.equal(byEnquiries.body.sort, 'enquiries');

    const byViews = await app.request(`${BASE}/media?sort=views`);
    assert.deepEqual(byViews.body.media.map((m) => m.mediaId), ['a', 'c', 'b']);

    const limited = await app.request(`${BASE}/media?limit=2`);
    assert.equal(limited.body.media.length, 2);
    assert.equal(limited.body.total, 3);

    // An unknown sort falls back rather than erroring — the leaderboard is a
    // read-only view and a bad query string should not blank the page.
    const bogus = await app.request(`${BASE}/media?sort=vibes`);
    assert.equal(bogus.body.sort, 'enquiries');
  });
});

test('GET /media/:id returns the item plus a date-ordered series, 404 when absent', async () => {
  const db = makeFakeDb({
    getMedia: async (t, id) => (id === 'm1' ? { mediaId: 'm1' } : null),
    listMediaSnapshots: async () => [
      { date: '2026-03-04', views: 20 },
      { date: '2026-03-01', views: 10 },
    ],
  });

  await withApp(db, async (app) => {
    const ok = await app.request(`${BASE}/media/m1`);
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.snapshots.map((s) => s.date), ['2026-03-01', '2026-03-04']);

    const missing = await app.request(`${BASE}/media/nope`);
    assert.equal(missing.status, 404);
  });
});

// ---------------------------------------------------------------------------
// threads
// ---------------------------------------------------------------------------

test('GET /threads filters, counts and validates windowState', async () => {
  const db = makeFakeDb({
    listThreads: async () => [
      { conversationId: 'c1', unanswered: true, lastInboundAt: '2026-03-01T00:00:00.000Z' },
      { conversationId: 'c2', unanswered: false, lastInboundAt: '2026-03-04T00:00:00.000Z' },
    ],
  });

  await withApp(db, async (app) => {
    const res = await app.request(`${BASE}/threads?unanswered=true`);
    assert.equal(res.status, 200);
    // Newest inbound first.
    assert.deepEqual(res.body.threads.map((t) => t.conversationId), ['c2', 'c1']);
    assert.equal(res.body.counts.total, 2);
    assert.equal(res.body.counts.unanswered, 1);

    const call = db.calls.find((c) => c.name === 'listThreads');
    assert.equal(call.args[0], TENANT);
    assert.equal(call.args[1].unanswered, true);

    const bad = await app.request(`${BASE}/threads?windowState=OPEN`);
    assert.equal(bad.status, 400);
  });
});

test('an absent unanswered param means no filter at all', async () => {
  const db = makeFakeDb();
  await withApp(db, async (app) => {
    await app.request(`${BASE}/threads`);
    const call = db.calls.find((c) => c.name === 'listThreads');
    assert.equal(call.args[1].unanswered, undefined);
  });
});

// ---------------------------------------------------------------------------
// rules
// ---------------------------------------------------------------------------

test('POST /rules validates before writing', async () => {
  const db = makeFakeDb();
  await withApp(db, async (app) => {
    const noKeyword = await app.request(`${BASE}/rules`, { method: 'POST', body: JSON.stringify({ dmMessage: 'hi' }) });
    assert.equal(noKeyword.status, 400);

    const noAction = await app.request(`${BASE}/rules`, { method: 'POST', body: JSON.stringify({ keyword: 'price' }) });
    assert.equal(noAction.status, 400);

    const badMatch = await app.request(`${BASE}/rules`, {
      method: 'POST',
      body: JSON.stringify({ keyword: 'price', matchType: 'fuzzy', dmMessage: 'hi' }),
    });
    assert.equal(badMatch.status, 400);

    const badRegex = await app.request(`${BASE}/rules`, {
      method: 'POST',
      body: JSON.stringify({ keyword: '([', matchType: 'regex', dmMessage: 'hi' }),
    });
    assert.equal(badRegex.status, 400);

    assert.equal(db.calls.some((c) => c.name === 'putRule'), false);
  });
});

test('POST /rules creates with a generated id, and 200s on edit', async () => {
  const db = makeFakeDb();
  await withApp(db, async (app) => {
    const created = await app.request(`${BASE}/rules`, {
      method: 'POST',
      body: JSON.stringify({ keyword: '  price  ', dmMessage: 'Sending details' }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.rule.keyword, 'price');
    assert.match(created.body.rule.ruleId, /^[0-9a-f-]{36}$/);

    const edited = await app.request(`${BASE}/rules`, {
      method: 'POST',
      body: JSON.stringify({ ruleId: 'r1', keyword: 'price', publicReply: 'DM sent' }),
    });
    assert.equal(edited.status, 200);

    const put = db.calls.filter((c) => c.name === 'putRule');
    assert.equal(put.length, 2);
    assert.ok(put.every((c) => c.args[0] === TENANT));
  });
});

test('DELETE /rules/:id removes and audits', async () => {
  const db = makeFakeDb();
  await withApp(db, async (app) => {
    const res = await app.request(`${BASE}/rules/r1`, { method: 'DELETE' });
    assert.equal(res.status, 200);
    assert.deepEqual(db.calls.find((c) => c.name === 'deleteRule').args, [TENANT, 'r1']);
  });
});

// ---------------------------------------------------------------------------
// overview + insights
// ---------------------------------------------------------------------------

test('GET /overview assembles counters and merges the account series', async () => {
  const today = new Date().toISOString();
  const db = makeFakeDb({
    listDevices: async () => [
      { deviceId: 'd1', status: 'active', igUserId: '1' },
      { deviceId: 'd2', status: 'revoked', igUserId: '2' },
    ],
    listEnquiries: async () => ({
      items: [
        { enquiryId: 'e1', createdAt: today, temperature: 'hot', status: 'new' },
        { enquiryId: 'e2', createdAt: today, temperature: 'cold', status: 'contacted' },
        { enquiryId: 'e3', createdAt: '2020-01-01T00:00:00.000Z', temperature: 'hot', status: 'new' },
      ],
      cursor: null,
    }),
    listThreads: async () => [{ unanswered: true }, { unanswered: false }],
    listMedia: async () => [{ mediaId: 'm1' }],
    listAccountSnapshots: async (t, igUserId) => [
      { date: '2026-03-04', followersCount: igUserId === '1' ? 100 : 50, reach: 10 },
    ],
  });

  await withApp(db, async (app) => {
    const res = await app.request(`${BASE}/overview`);
    assert.equal(res.status, 200);
    assert.equal(res.body.counters.devices, 2);
    assert.equal(res.body.counters.activeDevices, 1);
    assert.equal(res.body.counters.accounts, 2);
    assert.equal(res.body.counters.media, 1);
    // The 2020 enquiry falls outside the 30-day window.
    assert.equal(res.body.counters.enquiries, 2);
    assert.equal(res.body.counters.hotEnquiries, 1);
    assert.equal(res.body.counters.threads, 2);
    assert.equal(res.body.counters.unansweredThreads, 1);

    // Two accounts on the same date collapse into one summed row.
    assert.equal(res.body.series.length, 1);
    assert.equal(res.body.series[0].followersCount, 150);
    assert.equal(res.body.series[0].reach, 20);

    assert.ok(db.calls.every((c) => c.args[0] === TENANT));
  });
});

test('GET /insights/timeseries maps metric names and rejects unknown ones', async () => {
  const db = makeFakeDb({
    listDevices: async () => [{ deviceId: 'd1', status: 'active', igUserId: '1' }],
    listAccountSnapshots: async () => [
      { date: '2026-03-02', followersCount: 120, reach: 5 },
      { date: '2026-03-01', followersCount: 100, reach: 3 },
      { date: '2026-03-03', followersCount: null, reach: 7 },
    ],
  });

  await withApp(db, async (app) => {
    const followers = await app.request(`${BASE}/insights/timeseries?metric=followers&days=7`);
    assert.equal(followers.status, 200);
    // Null-valued days are dropped, not charted as zero.
    assert.deepEqual(followers.body.points, [
      { date: '2026-03-01', value: 100 },
      { date: '2026-03-02', value: 120 },
    ]);

    const reach = await app.request(`${BASE}/insights/timeseries?metric=reach`);
    assert.equal(reach.body.points.length, 3);

    const bogus = await app.request(`${BASE}/insights/timeseries?metric=impressions`);
    assert.equal(bogus.status, 400);
    assert.match(bogus.body.details, /Unknown metric/);
  });
});

test('an igUserId that is not one of the tenant\'s accounts is a 404', async () => {
  const db = makeFakeDb({
    listDevices: async () => [{ deviceId: 'd1', status: 'active', igUserId: '1' }],
  });

  await withApp(db, async (app) => {
    const res = await app.request(`${BASE}/insights/timeseries?metric=reach&igUserId=999`);
    assert.equal(res.status, 404);
    // The caller-supplied id never reached the table.
    assert.equal(db.calls.some((c) => c.name === 'listAccountSnapshots'), false);
  });
});
