// Every HTTP route over the real stack: Express, the real data layer on the
// in-process DynamoDB stand-in, a fake Instagram, fake auth and a fake CRM.

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { startApp, freshDb, recordingDb, fakeCrm, makeService, connectTestAccount, withEnv, TENANT, OTHER_TENANT } from './support.js';
import { createFakeInstagram, BUSINESS_IG_ID, BUSINESS_USERNAME } from './fakeInstagram.js';
import { buildSignedRequest } from '../services/metaSecurity.js';
import { toDateKey } from '../services/normalise.js';

const BASE = '/api/insta';
const RAHUL = { id: '5551', username: 'rahul.sharma_22' };

async function withBoot(fn, { tenantId = TENANT } = {}) {
  const db = recordingDb(freshDb());
  const ig = createFakeInstagram();
  const crm = fakeCrm();
  const service = makeService({ db, api: ig.api, crm });
  const app = await startApp({ db, service, tenantId });
  try {
    return await fn({ db, ig, crm, service, app });
  } finally {
    await app.close();
  }
}

async function withConversation(ctx, text = 'Hi, 2 BHK rent in Kurla, budget 45k, call me on 98765 43210') {
  await connectTestAccount(ctx.service);
  ctx.ig.receiveMessage(RAHUL, text);
  await ctx.service.syncConversations(await ctx.db.getAccount(TENANT, BUSINESS_IG_ID));
  return `${BUSINESS_IG_ID}_${RAHUL.id}`;
}

const json = (body) => ({ method: 'POST', body: JSON.stringify(body) });

// ---------------------------------------------------------------------------
// basics
// ---------------------------------------------------------------------------

test('GET /health is open, does not touch the tables, and reports whether Instagram is configured', async () => {
  await withBoot(async ({ app, db }) => {
    const res = await app.request(`${BASE}/health`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.instagramConfigured, true);
    assert.equal(db.calls.length, 0);
  });
});

test('an unknown path answers JSON, and malformed JSON gets the repo error shape', async () => {
  await withBoot(async ({ app }) => {
    const missing = await app.request(`${BASE}/nope`);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, 'Not Found');

    const bad = await app.request(`${BASE}/rules`, { method: 'POST', body: '{not json' });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, 'Bad Request');
  });
});

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

test('POST /oauth/start returns the Instagram consent URL; 503 when the app is not configured', async () => {
  await withBoot(async ({ app }) => {
    const res = await app.request(`${BASE}/oauth/start`, { method: 'POST' });
    assert.equal(res.status, 200);
    assert.ok(new URL(res.body.authorizeUrl).searchParams.get('state'));

    await withEnv({ INSTA_TOKEN_ENCRYPTION_KEY: undefined }, async () => {
      const off = await app.request(`${BASE}/oauth/start`, { method: 'POST' });
      assert.equal(off.status, 503);
    });
  });
});

test('the OAuth callback connects the account and sends the browser back to the console', async () => {
  await withBoot(async ({ app, service, db }) => {
    const { authorizeUrl } = service.startConnect({ tenantId: TENANT, userId: 'user-1' });
    const state = new URL(authorizeUrl).searchParams.get('state');

    const res = await app.request(`${BASE}/oauth/callback?code=abc%23_&state=${encodeURIComponent(state)}`);
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), `http://console.test/insta/accounts?connected=${BUSINESS_USERNAME}`);
    assert.equal((await db.getAccount(TENANT, BUSINESS_IG_ID)).status, 'connected');
  });
});

test('a declined consent or a forged state lands on the console with an error, and connects nothing', async () => {
  await withBoot(async ({ app, db }) => {
    const denied = await app.request(`${BASE}/oauth/callback?error=access_denied&error_description=Permissions+error`);
    assert.equal(denied.status, 302);
    assert.equal(new URL(denied.headers.get('location')).searchParams.get('error'), 'Permissions error');

    const forged = await app.request(`${BASE}/oauth/callback?code=abc&state=eyJ0IjoidmljdGltIn0.AAAA`);
    assert.equal(forged.status, 302);
    assert.match(new URL(forged.headers.get('location')).searchParams.get('error'), /State signature/);
    assert.equal(await db.getAccount(TENANT, BUSINESS_IG_ID), null);
  });
});

// ---------------------------------------------------------------------------
// accounts
// ---------------------------------------------------------------------------

test('GET /accounts never returns a token, and only shows the caller\'s tenant', async () => {
  await withBoot(async ({ app, service }) => {
    await connectTestAccount(service);
    const res = await app.request(`${BASE}/accounts`);
    assert.equal(res.status, 200);
    assert.equal(res.body.accounts.length, 1);
    assert.equal(res.body.accounts[0].username, BUSINESS_USERNAME);
    assert.equal(res.body.dryRunSends, false);
    const raw = JSON.stringify(res.body);
    assert.ok(!raw.includes('tokenCiphertext') && !raw.includes('v1:'), 'no token material in the response');
  });

  await withBoot(
    async ({ app, service }) => {
      await connectTestAccount(service, TENANT);
      assert.equal((await app.request(`${BASE}/accounts`)).body.accounts.length, 0);
    },
    { tenantId: OTHER_TENANT }
  );
});

test('POST /accounts/:id/sync pulls DMs now; DELETE disconnects; unknown ids are 404', async () => {
  await withBoot(async ({ app, service, ig, db }) => {
    await connectTestAccount(service);
    ig.receiveMessage(RAHUL, 'Is it available?');

    const sync = await app.request(`${BASE}/accounts/${BUSINESS_IG_ID}/sync`, { method: 'POST' });
    assert.equal(sync.status, 200);
    assert.equal(sync.body.summary.jobs.conversations, 1);
    assert.equal(sync.body.summary.jobs.analysis, 1);
    assert.ok(await db.getThread(TENANT, `${BUSINESS_IG_ID}_${RAHUL.id}`));

    assert.equal((await app.request(`${BASE}/accounts/nope/sync`, { method: 'POST' })).status, 404);

    const del = await app.request(`${BASE}/accounts/${BUSINESS_IG_ID}`, { method: 'DELETE' });
    assert.equal(del.status, 200);
    assert.equal(del.body.account.status, 'disconnected');
    assert.equal((await app.request(`${BASE}/accounts/${BUSINESS_IG_ID}/sync`, { method: 'POST' })).status, 409);
    assert.equal((await app.request(`${BASE}/accounts/nope`, { method: 'DELETE' })).status, 404);
  });
});

// ---------------------------------------------------------------------------
// webhooks + Meta callbacks
// ---------------------------------------------------------------------------

test('the webhook handshake echoes the challenge only for the right verify token', async () => {
  await withBoot(async ({ app }) => {
    const ok = await app.request(`${BASE}/webhooks/instagram?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=1158201444`);
    assert.equal(ok.status, 200);
    assert.equal(String(ok.body), '1158201444');

    const bad = await app.request(`${BASE}/webhooks/instagram?hub.mode=subscribe&hub.verify_token=guess&hub.challenge=1`);
    assert.equal(bad.status, 403);
  });
});

test('a webhook is accepted only with a valid signature over the exact body', async () => {
  await withBoot(async ({ app, service, db }) => {
    await connectTestAccount(service);
    const body = JSON.stringify({
      object: 'instagram',
      entry: [{ id: BUSINESS_IG_ID, time: Date.now(), messaging: [{ sender: { id: '42' }, recipient: { id: BUSINESS_IG_ID }, timestamp: Date.now(), message: { mid: 'mid.w1', text: '1bhk?' } }] }],
    });
    const signature = `sha256=${crypto.createHmac('sha256', 'test-app-secret').update(body).digest('hex')}`;

    const forged = await app.request(`${BASE}/webhooks/instagram`, { method: 'POST', body, headers: { 'x-hub-signature-256': 'sha256=deadbeef' } });
    assert.equal(forged.status, 401);
    assert.equal(await db.getThread(TENANT, `${BUSINESS_IG_ID}_42`), null);

    const res = await app.request(`${BASE}/webhooks/instagram`, { method: 'POST', body, headers: { 'x-hub-signature-256': signature } });
    assert.equal(res.status, 200);
    assert.equal(res.body, 'EVENT_RECEIVED');
    assert.equal((await db.getThread(TENANT, `${BUSINESS_IG_ID}_42`)).messageCount, 1);
  });
});

test('Meta deauthorize and data deletion callbacks accept a signed_request form post', async () => {
  await withBoot(async ({ app, service, db }) => {
    await connectTestAccount(service);
    const form = (payload, secret = 'test-app-secret') => ({
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `signed_request=${encodeURIComponent(buildSignedRequest(payload, secret))}`,
    });

    assert.equal((await app.request(`${BASE}/meta/deauthorize`, form({ user_id: BUSINESS_IG_ID }, 'nope'))).status, 400);
    const deauth = await app.request(`${BASE}/meta/deauthorize`, form({ user_id: BUSINESS_IG_ID }));
    assert.deepEqual(deauth.body, { ok: true, found: true });
    assert.equal((await db.getAccount(TENANT, BUSINESS_IG_ID)).status, 'disconnected');

    const deletion = await app.request(`${BASE}/meta/data-deletion`, form({ user_id: BUSINESS_IG_ID }));
    assert.equal(deletion.status, 200);
    assert.ok(deletion.body.url.endsWith(deletion.body.confirmation_code));

    const status = await app.request(`${BASE}/meta/data-deletion/status?code=${deletion.body.confirmation_code}`);
    assert.equal(status.body.status, 'completed');
    assert.equal((await app.request(`${BASE}/meta/data-deletion/status?code=bad`)).status, 400);
    assert.equal((await app.request(`${BASE}/meta/data-deletion/status?code=${'a'.repeat(24)}`)).status, 404);
  });
});

// ---------------------------------------------------------------------------
// threads
// ---------------------------------------------------------------------------

test('GET /threads lists conversations with their live window, filters and validates', async () => {
  await withBoot(async (ctx) => {
    await withConversation(ctx);
    const res = await ctx.app.request(`${BASE}/threads`);
    assert.equal(res.status, 200);
    assert.equal(res.body.threads.length, 1);
    assert.equal(res.body.threads[0].windowState, 'STANDARD');
    assert.equal(res.body.counts.unanswered, 1);

    assert.equal((await ctx.app.request(`${BASE}/threads?windowState=NOPE`)).status, 400);
    assert.equal((await ctx.app.request(`${BASE}/threads?unanswered=false`)).body.threads.length, 0);
    assert.equal((await ctx.app.request(`${BASE}/threads?windowState=CLOSED`)).body.threads.length, 0);
  });
});

test('a thread opens with its messages, then a reply is sent and the analysis can be re-run', async () => {
  await withBoot(async (ctx) => {
    const threadId = await withConversation(ctx);

    const detail = await ctx.app.request(`${BASE}/threads/${threadId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.messages.length, 1);
    assert.equal(detail.body.canReply.allowed, true);
    assert.equal(detail.body.enquiry, null);
    assert.equal((await ctx.app.request(`${BASE}/threads/nope`)).status, 404);

    assert.equal((await ctx.app.request(`${BASE}/threads/${threadId}/reply`, json({ text: '  ' }))).status, 400);
    const reply = await ctx.app.request(`${BASE}/threads/${threadId}/reply`, json({ text: 'Namaste! Call karte hain.' }));
    assert.equal(reply.status, 201);
    assert.equal(reply.body.status, 'sent');
    assert.equal(ctx.ig.state.sent.length, 1);
    assert.equal((await ctx.app.request(`${BASE}/threads/nope/reply`, json({ text: 'x' }))).status, 404);

    const analysed = await ctx.app.request(`${BASE}/threads/${threadId}/analyse`, { method: 'POST' });
    assert.equal(analysed.status, 200);
    assert.equal(analysed.body.enquiry.phone, '+919876543210');
    assert.equal(analysed.body.thread.analysis.leadScore, 'very_hot');
    assert.equal(ctx.crm.calls.length, 1);
  });
});

// ---------------------------------------------------------------------------
// enquiries
// ---------------------------------------------------------------------------

test('enquiry filters are validated; PATCH validates, updates and audits under the caller\'s tenant', async () => {
  await withBoot(async ({ app, db }) => {
    await db.putEnquiry(TENANT, { enquiryId: 'e1', name: 'Rahul', phone: '+919876543210', intent: 'rent', temperature: 'hot' });

    assert.equal((await app.request(`${BASE}/enquiries?status=bogus`)).status, 400);
    assert.equal((await app.request(`${BASE}/enquiries?temperature=lukewarm`)).status, 400);
    assert.equal((await app.request(`${BASE}/enquiries?temperature=hot`)).body.enquiries.length, 1);

    const patch = (body, id = 'e1') => app.request(`${BASE}/enquiries/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    assert.equal((await patch({})).status, 400);
    assert.equal((await patch({ status: 'bogus' })).status, 400);
    assert.equal((await patch({ notes: 42 })).status, 400);
    assert.equal((await patch({ status: 'nope' }, 'missing')).status, 400);
    assert.equal((await patch({ status: 'contacted' }, 'missing')).status, 404);

    const ok = await patch({ status: 'SITE_VISIT', notes: 'Saturday 11am' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.enquiry.status, 'site_visit');
    const audit = db.calls.find((c) => c.name === 'putAuditEvent');
    assert.equal(audit.args[0], TENANT);
    assert.equal(audit.args[1].notesChanged, true);
    assert.ok(!JSON.stringify(audit.args[1]).includes('Saturday'), 'note text is not written to the audit trail');

    const pushed = await app.request(`${BASE}/enquiries/e1/push-to-crm`, { method: 'POST' });
    assert.equal(pushed.status, 200);
    assert.equal(pushed.body.crmSync.status, 'created');
    assert.equal((await app.request(`${BASE}/enquiries/missing/push-to-crm`, { method: 'POST' })).status, 404);
  });
});

test('an enquiry in another tenant reads as not found', async () => {
  await withBoot(
    async ({ app, db }) => {
      await db.putEnquiry(TENANT, { enquiryId: 'e1', name: 'Rahul' });
      const res = await app.request(`${BASE}/enquiries/e1`, { method: 'PATCH', body: JSON.stringify({ status: 'won' }) });
      assert.equal(res.status, 404);
      assert.equal((await db.getEnquiry(TENANT, 'e1')).status, 'new');
    },
    { tenantId: OTHER_TENANT }
  );
});

// ---------------------------------------------------------------------------
// media, rules, overview, insights
// ---------------------------------------------------------------------------

test('GET /media ranks reels by the enquiries they produced, or by views', async () => {
  await withBoot(async ({ app, db }) => {
    await db.putMediaItems(TENANT, [
      { mediaId: 'm1', igUserId: BUSINESS_IG_ID, metrics: { views: 100 } },
      { mediaId: 'm2', igUserId: BUSINESS_IG_ID, metrics: { views: 5000 } },
    ]);
    await db.putEnquiry(TENANT, { enquiryId: 'e1', sourceMediaId: 'm1', temperature: 'hot' });
    await db.putEnquiry(TENANT, { enquiryId: 'e2', sourceMediaId: 'm1', temperature: 'cold' });

    const byEnquiries = await app.request(`${BASE}/media`);
    assert.deepEqual(byEnquiries.body.media.map((m) => m.mediaId), ['m1', 'm2']);
    assert.equal(byEnquiries.body.media[0].enquiryCount, 2);
    assert.equal(byEnquiries.body.media[0].hotCount, 1);

    const byViews = await app.request(`${BASE}/media?sort=views`);
    assert.deepEqual(byViews.body.media.map((m) => m.mediaId), ['m2', 'm1']);

    assert.equal((await app.request(`${BASE}/media/m1`)).status, 200);
    assert.equal((await app.request(`${BASE}/media/none`)).status, 404);
  });
});

test('POST /rules validates before writing, creates, edits, and ignores a tenantId in the body', async () => {
  await withBoot(async ({ app, db }) => {
    for (const bad of [
      { dmMessage: 'x' },
      { keyword: 'price', matchType: 'fuzzy', dmMessage: 'x' },
      { keyword: 'price' },
      { keyword: '([', matchType: 'regex', dmMessage: 'x' },
    ]) {
      assert.equal((await app.request(`${BASE}/rules`, json(bad))).status, 400, JSON.stringify(bad));
    }

    const created = await app.request(`${BASE}/rules`, json({ keyword: ' PRICE ', dmMessage: 'Details bheje', tenantId: OTHER_TENANT }));
    assert.equal(created.status, 201);
    assert.equal(created.body.rule.keyword, 'PRICE');
    assert.equal((await db.listRules(TENANT)).length, 1);
    assert.equal((await db.listRules(OTHER_TENANT)).length, 0);

    const edited = await app.request(`${BASE}/rules`, json({ ruleId: created.body.rule.ruleId, keyword: 'PRICE', dmMessage: 'Updated', enabled: false }));
    assert.equal(edited.status, 200);
    assert.equal((await app.request(`${BASE}/rules`)).body.rules[0].enabled, false);

    assert.equal((await app.request(`${BASE}/rules/${created.body.rule.ruleId}`, { method: 'DELETE' })).status, 200);
    assert.equal((await db.listRules(TENANT)).length, 0);
  });
});

test('GET /overview counts followers, conversations and enquiries into one series', async () => {
  await withBoot(async (ctx) => {
    await withConversation(ctx);
    await ctx.service.analysePendingThreads(await ctx.db.getAccount(TENANT, BUSINESS_IG_ID));

    const res = await ctx.app.request(`${BASE}/overview`);
    assert.equal(res.status, 200);
    assert.equal(res.body.counters.accounts, 1);
    assert.equal(res.body.counters.followers, 1520);
    assert.equal(res.body.counters.threads, 1);
    assert.equal(res.body.counters.unansweredThreads, 1);
    assert.equal(res.body.counters.enquiries, 1);
    assert.equal(res.body.counters.hotEnquiries, 1);
    const today = res.body.series.find((p) => p.date === toDateKey());
    assert.equal(today.followers, 1520);
    assert.equal(today.enquiries, 1);
    assert.ok(!JSON.stringify(res.body).includes('tokenCiphertext'));
  });
});

test('GET /insights/timeseries maps metric names and validates the account', async () => {
  await withBoot(async ({ app, service }) => {
    await connectTestAccount(service);
    const res = await app.request(`${BASE}/insights/timeseries?metric=followers`);
    assert.deepEqual(res.body.points, [{ date: toDateKey(), value: 1520 }]);
    assert.equal((await app.request(`${BASE}/insights/timeseries?metric=impressions`)).status, 400);
    assert.equal((await app.request(`${BASE}/insights/timeseries?igUserId=someone-else`)).status, 404);
  });
});
