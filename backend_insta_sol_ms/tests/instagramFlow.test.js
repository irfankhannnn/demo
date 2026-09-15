// The whole Instagram flow at the service level, against a fake Instagram and
// the real data layer: connect -> DMs -> analysis -> CRM lead -> reply,
// webhooks, keyword rules, token lifecycle, the worker, and Meta's callbacks.

import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, fakeCrm, makeService, connectTestAccount, withEnv, TENANT, OTHER_TENANT } from './support.js';
import { createFakeInstagram, BUSINESS_IG_ID, BUSINESS_APP_SCOPED_ID, BUSINESS_USERNAME } from './fakeInstagram.js';
import { runScheduledJobs } from '../services/worker.js';
import { buildSignedRequest } from '../services/metaSecurity.js';

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const RAHUL = { id: '5551', username: 'rahul.sharma_22' };

function setup({ crm = fakeCrm() } = {}) {
  let t = Date.now();
  const clock = () => t;
  const db = freshDb();
  const ig = createFakeInstagram({ now: clock });
  const service = makeService({ db, api: ig.api, crm, clock });
  return { db, ig, crm, service, clock, advance: (ms) => (t += ms) };
}

async function connected(ctx) {
  await connectTestAccount(ctx.service);
  return ctx.db.getAccount(TENANT, BUSINESS_IG_ID);
}

test('connecting stores an encrypted token, routes both Instagram ids, and subscribes webhooks', async () => {
  const ctx = setup();
  const { account } = await connectTestAccount(ctx.service);

  const stored = await ctx.db.getAccount(TENANT, BUSINESS_IG_ID);
  assert.equal(stored.status, 'connected');
  assert.equal(stored.username, BUSINESS_USERNAME);
  assert.ok(stored.tokenCiphertext.startsWith('v1:'));
  assert.ok(!JSON.stringify(stored).includes('long-token'), 'no plain token anywhere on the row');
  assert.ok(Date.parse(stored.tokenExpiresAt) > Date.now() + 59 * DAY);
  assert.equal(account.webhookSubscribed, true);
  assert.deepEqual(ctx.ig.state.subscriptions, [['messages', 'comments']]);

  assert.deepEqual(await ctx.db.findAccountRefByIgId(BUSINESS_IG_ID), { tenantId: TENANT, igUserId: BUSINESS_IG_ID });
  assert.deepEqual(await ctx.db.findAccountRefByIgId(BUSINESS_APP_SCOPED_ID), { tenantId: TENANT, igUserId: BUSINESS_IG_ID });
});

test('when comment webhooks need Advanced Access, messages are still subscribed and the gap is recorded', async () => {
  const ctx = setup();
  ctx.ig.state.failSubscribe = ['comments'];
  const { account } = await connectTestAccount(ctx.service);
  assert.equal(account.webhookSubscribed, true);
  assert.match(account.webhookError, /Comment webhooks unavailable/);
  assert.deepEqual(ctx.ig.state.subscriptions, [['messages']]);
});

test('an Instagram account already connected to another workspace cannot be taken over', async () => {
  const ctx = setup();
  await connectTestAccount(ctx.service, OTHER_TENANT);
  await assert.rejects(() => connectTestAccount(ctx.service, TENANT), (err) => err.status === 409 && /another RealtyFlow workspace/.test(err.details));
});

test('a DM becomes a scored enquiry and exactly one CRM lead', async () => {
  const ctx = setup();
  const account = await connected(ctx);
  ctx.ig.receiveMessage(RAHUL, 'Hi, looking for 2 BHK on rent in Kurla, budget 45k. Call me on 98765 43210');

  const sync = await ctx.service.syncConversations(account);
  assert.deepEqual(sync, { conversations: 1, messages: 1 });

  const threadId = `${BUSINESS_IG_ID}_${RAHUL.id}`;
  const thread = await ctx.db.getThread(TENANT, threadId);
  assert.equal(thread.participantUsername, 'rahul.sharma_22');
  assert.equal(thread.unanswered, true);
  assert.equal(thread.needsAnalysis, true);

  const analysed = await ctx.service.analysePendingThreads(account);
  assert.deepEqual(analysed, { analysed: 1, enquiries: 1 });

  const enquiry = await ctx.db.getEnquiry(TENANT, `ig_${threadId}`);
  assert.equal(enquiry.phone, '+919876543210');
  assert.equal(enquiry.intent, 'rent');
  assert.equal(enquiry.leadScore, 'very_hot');
  assert.equal(enquiry.status, 'new');
  assert.equal(enquiry.crmSync.status, 'created');
  assert.equal(enquiry.crmSync.leadId, `lead-ig_${threadId}`);
  assert.equal(ctx.crm.calls.length, 1);
  assert.equal(ctx.crm.calls[0].tenantId, TENANT);

  // Nothing new: the worker does not re-analyse, and a forced re-analysis
  // with the same number does not hand the lead over twice.
  assert.deepEqual(await ctx.service.analysePendingThreads(account), { analysed: 0, enquiries: 0 });
  await ctx.db.updateEnquiry(TENANT, enquiry.enquiryId, { status: 'contacted', notes: 'called once' });
  await ctx.service.analyseThread(account, await ctx.db.getThread(TENANT, threadId));
  assert.equal(ctx.crm.calls.length, 1);
  const after = await ctx.db.getEnquiry(TENANT, enquiry.enquiryId);
  assert.equal(after.status, 'contacted', 'a human status survives re-analysis');
  assert.equal(after.notes, 'called once');
});

test('an enquiry with no phone waits instead of creating an uncallable CRM lead', async () => {
  const ctx = setup();
  const account = await connected(ctx);
  ctx.ig.receiveMessage(RAHUL, '2 bhk rent in Kurla, budget 45k?');
  await ctx.service.syncConversations(account);
  await ctx.service.analysePendingThreads(account);
  const enquiry = await ctx.db.getEnquiry(TENANT, `ig_${BUSINESS_IG_ID}_${RAHUL.id}`);
  assert.equal(enquiry.crmSync.status, 'waiting_for_phone');
  assert.equal(ctx.crm.calls.length, 0);

  // The number arrives later: the next analysis hands it over.
  ctx.advance(60 * 1000);
  ctx.ig.receiveMessage(RAHUL, 'my number 9876543210', ctx.clock());
  await ctx.service.syncConversations(account);
  await ctx.service.analysePendingThreads(account);
  assert.equal((await ctx.db.getEnquiry(TENANT, enquiry.enquiryId)).crmSync.status, 'created');
  assert.equal(ctx.crm.calls.length, 1);
});

test('a reply inside 24 hours is sent; after 24 hours it is refused and nothing reaches Instagram', async () => {
  const ctx = setup();
  const account = await connected(ctx);
  ctx.ig.receiveMessage(RAHUL, 'Is the 2bhk available?', ctx.clock());
  await ctx.service.syncConversations(account);
  const threadId = `${BUSINESS_IG_ID}_${RAHUL.id}`;

  const sent = await ctx.service.sendReply({ tenantId: TENANT, userId: 'user-1', threadId, text: 'Haan ji, available hai!' });
  assert.equal(sent.status, 'sent');
  assert.equal(ctx.ig.state.sent.length, 1);
  assert.deepEqual(ctx.ig.state.sent[0], { recipientId: RAHUL.id, commentId: undefined, text: 'Haan ji, available hai!', messageId: 'm_sent_2' });
  assert.equal(sent.thread.unanswered, false);
  const messages = await ctx.db.listMessages(TENANT, threadId);
  assert.deepEqual(messages.map((m) => m.direction), ['in', 'out']);

  ctx.advance(25 * HOUR);
  await assert.rejects(
    () => ctx.service.sendReply({ tenantId: TENANT, threadId, text: 'Follow up' }),
    (err) => err.status === 409 && /24-hour window is closed/.test(err.details)
  );
  assert.equal(ctx.ig.state.sent.length, 1);
});

test('a window error from Instagram closes the thread and is never retried', async () => {
  const ctx = setup();
  const account = await connected(ctx);
  ctx.ig.receiveMessage(RAHUL, 'hello', ctx.clock());
  await ctx.service.syncConversations(account);
  const threadId = `${BUSINESS_IG_ID}_${RAHUL.id}`;

  ctx.ig.state.windowBlocked = true;
  await assert.rejects(() => ctx.service.sendReply({ tenantId: TENANT, threadId, text: 'hi' }), (err) => err.status === 409);
  const [thread] = await ctx.db.listThreads(TENANT, {});
  assert.equal(thread.windowState, 'CLOSED');
  await assert.rejects(() => ctx.service.sendReply({ tenantId: TENANT, threadId, text: 'hi again' }), /closed/);
  assert.equal(ctx.ig.state.sent.length, 0);
});

test('dry run records the reply without sending it; the kill switch refuses outright', async () => {
  const ctx = setup();
  const account = await connected(ctx);
  ctx.ig.receiveMessage(RAHUL, 'hello', ctx.clock());
  await ctx.service.syncConversations(account);
  const threadId = `${BUSINESS_IG_ID}_${RAHUL.id}`;

  await withEnv({ INSTA_DRY_RUN_SENDS: 'true' }, async () => {
    const res = await ctx.service.sendReply({ tenantId: TENANT, threadId, text: 'test' });
    assert.equal(res.status, 'dry_run');
  });
  assert.equal(ctx.ig.state.sent.length, 0);

  await withEnv({ INSTA_KILL_SWITCH: 'true' }, async () => {
    await assert.rejects(() => ctx.service.sendReply({ tenantId: TENANT, threadId, text: 'test' }), (err) => err.status === 423);
  });
});

test('webhook messages are stored once, echoes are outbound, and unknown accounts are ignored', async () => {
  const ctx = setup();
  await connected(ctx);
  const event = (mid, fields = {}) => ({
    object: 'instagram',
    entry: [
      {
        id: BUSINESS_IG_ID,
        time: ctx.clock(),
        messaging: [{ sender: { id: '777' }, recipient: { id: BUSINESS_IG_ID }, timestamp: ctx.clock(), message: { mid, text: 'Rent 1bhk Andheri?' }, ...fields }],
      },
    ],
  });

  assert.equal((await ctx.service.ingestWebhook(event('wh.1'))).messages, 1);
  assert.equal((await ctx.service.ingestWebhook(event('wh.1'))).messages, 0, 'Meta redelivery is a no-op');
  await ctx.service.ingestWebhook({
    object: 'instagram',
    entry: [{ id: BUSINESS_IG_ID, messaging: [{ sender: { id: BUSINESS_IG_ID }, recipient: { id: '777' }, timestamp: ctx.clock(), message: { mid: 'wh.2', text: 'Yes!', is_echo: true } }] }],
  });

  const thread = await ctx.db.getThread(TENANT, `${BUSINESS_IG_ID}_777`);
  assert.equal(thread.messageCount, 2);
  assert.equal(thread.lastMessageDirection, 'out');
  assert.equal(thread.unanswered, false);
  assert.equal(thread.needsAnalysis, true);
  assert.ok((await ctx.db.getAccount(TENANT, BUSINESS_IG_ID)).lastWebhookAt);

  const unknown = await ctx.service.ingestWebhook({ object: 'instagram', entry: [{ id: '000', messaging: [] }] });
  assert.equal(unknown.ignored, 1);
});

async function withReel(ctx, account) {
  ctx.ig.addMedia({ id: 'media_1', caption: '2BHK Kurla', media_type: 'VIDEO', media_product_type: 'REELS', permalink: 'https://instagram.com/reel/x', timestamp: new Date(ctx.clock() - DAY).toISOString().replace('Z', '+0000'), comments_count: 1, like_count: 5 });
  await ctx.service.syncMedia(account);
  await ctx.db.putRule(TENANT, { ruleId: 'r1', keyword: 'price', dmMessage: 'Hi! Details DM me bheje hain', publicReply: 'DM check karo' });
}

test('a matching comment gets one public reply and one private reply, however often it is seen', async () => {
  const ctx = setup();
  const account = await connected(ctx);
  await withReel(ctx, account);
  const iso = (ms) => new Date(ms).toISOString().replace('Z', '+0000');
  ctx.ig.addComment('media_1', { id: 'c1', text: 'Price please?', timestamp: iso(ctx.clock()), from: { id: '888', username: 'buyer.one' } });
  ctx.ig.addComment('media_1', { id: 'c2', text: 'price', timestamp: iso(ctx.clock() - 8 * DAY), from: { id: '889', username: 'late' } });
  ctx.ig.addComment('media_1', { id: 'c3', text: 'price', timestamp: iso(ctx.clock()), from: { id: BUSINESS_IG_ID, username: BUSINESS_USERNAME } });
  ctx.ig.addComment('media_1', { id: 'c4', text: 'nice view', timestamp: iso(ctx.clock()), from: { id: '890', username: 'fan' } });

  const first = await ctx.service.syncComments(account);
  assert.deepEqual(first, { media: 1, seen: 3, acted: 1 });
  assert.deepEqual(ctx.ig.state.sent.map((s) => s.commentId), ['c1']);
  assert.deepEqual(ctx.ig.state.publicReplies, [{ commentId: 'c1', text: 'DM check karo' }]);

  // The private reply opened a thread attributed to the reel.
  const thread = await ctx.db.getThread(TENANT, `${BUSINESS_IG_ID}_888`);
  assert.equal(thread.sourceMediaId, 'media_1');
  assert.equal(thread.messageCount, 1);

  // Same comments again, and the same comment by webhook: nothing more is sent.
  await ctx.service.syncComments(account);
  await ctx.service.ingestWebhook({
    object: 'instagram',
    entry: [{ id: BUSINESS_IG_ID, time: Math.floor(ctx.clock() / 1000), changes: [{ field: 'comments', value: { id: 'c1', text: 'Price please?', from: { id: '888' }, media: { id: 'media_1' } } }] }],
  });
  assert.equal(ctx.ig.state.sent.length, 1);
  assert.equal(ctx.ig.state.publicReplies.length, 1);
});

test('automatic replies are capped per hour', async () => {
  const ctx = setup();
  const account = await connected(ctx);
  await withReel(ctx, account);
  const iso = (ms) => new Date(ms).toISOString().replace('Z', '+0000');
  ctx.ig.addComment('media_1', { id: 'c1', text: 'price', timestamp: iso(ctx.clock()), from: { id: '1', username: 'a' } });
  ctx.ig.addComment('media_1', { id: 'c2', text: 'price', timestamp: iso(ctx.clock()), from: { id: '2', username: 'b' } });

  await withEnv({ INSTA_MAX_AUTO_REPLIES_PER_HOUR: '1' }, () => ctx.service.syncComments(account));
  assert.equal(ctx.ig.state.sent.length, 1);
  assert.equal((await ctx.db.getComment(TENANT, 'c2')).status, 'rate_capped');
});

test('a revoked token marks the account for reconnection and the worker stops calling Instagram for it', async () => {
  const ctx = setup();
  await connected(ctx);
  ctx.ig.revokeAllTokens();
  const summary = await runScheduledJobs({ db: ctx.db, service: ctx.service, clock: ctx.clock });
  assert.equal(summary.errors.length, 1);
  const account = await ctx.db.getAccount(TENANT, BUSINESS_IG_ID);
  assert.equal(account.status, 'reconnect_required');
  assert.match(account.lastError, /Reconnect/);

  const next = await runScheduledJobs({ db: ctx.db, service: ctx.service, clock: ctx.clock });
  assert.equal(next.accounts, 0, 'an account needing reconnection is skipped');
});

test('tokens are refreshed in their last ten days, not before', async () => {
  const ctx = setup();
  const account = await connected(ctx);
  assert.equal((await ctx.service.refreshTokenIfDue(account)).refreshed, false);

  ctx.advance(51 * DAY);
  const before = (await ctx.db.getAccount(TENANT, BUSINESS_IG_ID)).tokenCiphertext;
  assert.equal((await ctx.service.refreshTokenIfDue(account)).refreshed, true);
  const after = await ctx.db.getAccount(TENANT, BUSINESS_IG_ID);
  assert.notEqual(after.tokenCiphertext, before);
  assert.ok(Date.parse(after.tokenExpiresAt) > ctx.clock() + 59 * DAY);
});

test('the worker runs each job on its own cadence', async () => {
  const ctx = setup();
  await connected(ctx);
  ctx.ig.receiveMessage(RAHUL, '2bhk rent kurla 9876543210', ctx.clock());

  const first = await runScheduledJobs({ db: ctx.db, service: ctx.service, clock: ctx.clock });
  assert.deepEqual(first.jobs, { refresh: 1, profile: 1, conversations: 1, analysis: 1, media: 1, comments: 1 });
  assert.deepEqual(first.errors, []);
  assert.equal(ctx.crm.calls.length, 1, 'polled, analysed and handed to the CRM in one run');

  const immediately = await runScheduledJobs({ db: ctx.db, service: ctx.service, clock: ctx.clock });
  assert.deepEqual(immediately.jobs, { analysis: 1 });

  ctx.advance(6 * 60 * 1000);
  const later = await runScheduledJobs({ db: ctx.db, service: ctx.service, clock: ctx.clock });
  assert.deepEqual(later.jobs, { conversations: 1, analysis: 1, comments: 1 });
});

test('Meta deauthorize disconnects the account and stops routing its webhooks', async () => {
  const ctx = setup();
  await connected(ctx);
  const result = await ctx.service.deauthorize(buildSignedRequest({ user_id: BUSINESS_IG_ID }, 'test-app-secret'));
  assert.deepEqual(result, { found: true });
  const account = await ctx.db.getAccount(TENANT, BUSINESS_IG_ID);
  assert.equal(account.status, 'disconnected');
  assert.equal(account.tokenCiphertext, null);
  assert.equal(await ctx.db.findAccountRefByIgId(BUSINESS_IG_ID), null);

  await assert.rejects(() => ctx.service.deauthorize(buildSignedRequest({ user_id: BUSINESS_IG_ID }, 'wrong-secret')), (err) => err.status === 400);
});

test('a Meta data deletion request removes the account\'s data and returns a status URL', async () => {
  const ctx = setup();
  const account = await connected(ctx);
  ctx.ig.receiveMessage(RAHUL, '2bhk rent kurla 9876543210');
  await ctx.service.syncConversations(account);
  await ctx.service.analysePendingThreads(account);

  const res = await ctx.service.requestDataDeletion(buildSignedRequest({ user_id: BUSINESS_APP_SCOPED_ID }, 'test-app-secret'));
  assert.match(res.confirmation_code, /^[a-f0-9]{24}$/);
  assert.equal(res.url, `http://insta.test/api/insta/meta/data-deletion/status?code=${res.confirmation_code}`);
  assert.equal(await ctx.db.getAccount(TENANT, BUSINESS_IG_ID), null);
  assert.equal((await ctx.db.listThreads(TENANT, {})).length, 0);
  assert.equal((await ctx.db.getDeletionRequest(res.confirmation_code)).status, 'completed');
});

test('disconnecting keeps history and removes the token', async () => {
  const ctx = setup();
  const account = await connected(ctx);
  ctx.ig.receiveMessage(RAHUL, 'hi');
  await ctx.service.syncConversations(account);
  await ctx.service.disconnect({ tenantId: TENANT, igUserId: BUSINESS_IG_ID, userId: 'user-1' });

  const after = await ctx.db.getAccount(TENANT, BUSINESS_IG_ID);
  assert.equal(after.status, 'disconnected');
  assert.equal(after.tokenCiphertext, null);
  assert.equal((await ctx.db.listThreads(TENANT, {})).length, 1);
  await assert.rejects(() => ctx.service.syncConversations(after), (err) => err.status === 409);
});

test('a webhook-only DM gets the sender\'s handle and reaches the CRM with a name', async () => {
  const ctx = setup();
  const account = await connected(ctx);
  await ctx.service.ingestWebhook({
    object: 'instagram',
    entry: [{ id: BUSINESS_IG_ID, messaging: [{ sender: { id: '9001' }, recipient: { id: BUSINESS_IG_ID }, timestamp: ctx.clock(), message: { mid: 'wh.9001', text: '3 BHK buy in Powai, budget 2.5 cr. my number 9123456789' } }] }],
  });
  assert.equal((await ctx.db.getThread(TENANT, `${BUSINESS_IG_ID}_9001`)).participantUsername, 'user_9001');

  await ctx.service.analysePendingThreads(account);
  const enquiry = await ctx.db.getEnquiry(TENANT, `ig_${BUSINESS_IG_ID}_9001`);
  assert.equal(enquiry.name, 'User');
  assert.equal(enquiry.crmSync.status, 'created');
  assert.equal(enquiry.budgetRupees, 25_000_000);
});

test('a lead with a number but no name is still handed over, and an empty CRM answer reads as skipped', async () => {
  const ctx = setup();
  await ctx.db.putEnquiry(TENANT, { enquiryId: 'e9', phone: '+919123456789', intent: 'buy' });
  const sync = await ctx.service.promoteEnquiry(TENANT, await ctx.db.getEnquiry(TENANT, 'e9'));
  assert.equal(sync.status, 'created');
  assert.equal(ctx.crm.calls[0].enquiries[0].name, 'Instagram lead');

  const silent = setup({ crm: { forwardEnquiriesToCrm: async () => ({ forwarded: true, results: [] }) } });
  await silent.db.putEnquiry(TENANT, { enquiryId: 'e10', name: 'A', phone: '+919123456789', intent: 'buy' });
  assert.equal((await silent.service.promoteEnquiry(TENANT, await silent.db.getEnquiry(TENANT, 'e10'))).status, 'skipped');
});
