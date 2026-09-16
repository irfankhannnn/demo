// Comments API: what instagram_business_manage_comments is used for in the
// console - reading comments on the account's posts and answering them.

import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, freshDb, recordingDb, fakeCrm, makeService, connectTestAccount, TENANT } from './support.js';
import { createFakeInstagram, BUSINESS_IG_ID } from './fakeInstagram.js';

const BASE = '/api/insta';
const HOUR = 3600e3;
const DAY = 24 * HOUR;
const iso = (ms) => new Date(ms).toISOString().replace('Z', '+0000');
const json = (body) => ({ method: 'POST', body: JSON.stringify(body) });

async function withComments(fn) {
  const db = recordingDb(freshDb());
  const ig = createFakeInstagram();
  const service = makeService({ db, api: ig.api, crm: fakeCrm() });
  const app = await startApp({ db, service, tenantId: TENANT });
  try {
    await connectTestAccount(service);
    const account = await db.getAccount(TENANT, BUSINESS_IG_ID);
    ig.addMedia({ id: 'media_1', caption: '2BHK Kurla', media_type: 'VIDEO', media_product_type: 'REELS', permalink: 'https://instagram.com/reel/x', timestamp: iso(Date.now() - DAY), comments_count: 2, like_count: 5 });
    ig.addComment('media_1', { id: 'c_fresh', text: 'Price?', timestamp: iso(Date.now() - HOUR), from: { id: '901', username: 'asker' } });
    ig.addComment('media_1', { id: 'c_old', text: 'Nice flat', timestamp: iso(Date.now() - 10 * DAY), from: { id: '902', username: 'old.fan' } });
    await service.syncMedia(account);
    await service.syncComments(account);
    return await fn({ app, db, ig });
  } finally {
    await app.close();
  }
}

test('GET /comments lists synced comments newest first, with the post and whether a private reply is still possible', async () => {
  await withComments(async ({ app }) => {
    const res = await app.request(`${BASE}/comments`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.comments.map((c) => c.commentId), ['c_fresh', 'c_old']);

    const [fresh, old] = res.body.comments;
    assert.equal(fresh.fromUsername, 'asker');
    assert.equal(fresh.media.caption, '2BHK Kurla');
    assert.equal(fresh.privateReplyAllowed, true);
    assert.equal(old.privateReplyAllowed, false);
    assert.match(old.privateReplyReason, /older than 7 days/);

    assert.equal((await app.request(`${BASE}/comments?mediaId=other`)).body.comments.length, 0);
  });
});

test('POST /comments/:id/reply answers publicly, or with the one private reply Instagram allows', async () => {
  await withComments(async ({ app, db, ig }) => {
    const pub = await app.request(`${BASE}/comments/c_fresh/reply`, json({ text: 'DM check karo', mode: 'public' }));
    assert.equal(pub.status, 201);
    assert.equal(pub.body.status, 'sent');
    assert.deepEqual(ig.state.publicReplies, [{ commentId: 'c_fresh', text: 'DM check karo' }]);
    assert.equal(pub.body.comment.lastReply.mode, 'public');

    const dm = await app.request(`${BASE}/comments/c_fresh/reply`, json({ text: 'Hi! 2BHK details bhej rahe hain', mode: 'private' }));
    assert.equal(dm.status, 201);
    assert.deepEqual(ig.state.sent.map((s) => s.commentId), ['c_fresh']);
    assert.equal(dm.body.comment.privateReplyAllowed, false);

    // The private reply opened a conversation, attributed to the reel.
    const thread = await db.getThread(TENANT, `${BUSINESS_IG_ID}_901`);
    assert.equal(thread.messageCount, 1);
    assert.equal(thread.sourceMediaId, 'media_1');

    assert.equal((await app.request(`${BASE}/comments/c_fresh/reply`, json({ text: 'again', mode: 'private' }))).status, 409);
    assert.equal((await app.request(`${BASE}/comments/c_old/reply`, json({ text: 'late', mode: 'private' }))).status, 409);
    assert.equal((await app.request(`${BASE}/comments/c_fresh/reply`, json({ text: '   ' }))).status, 400);
    assert.equal((await app.request(`${BASE}/comments/c_fresh/reply`, json({ text: 'x', mode: 'shout' }))).status, 400);
    assert.equal((await app.request(`${BASE}/comments/nope/reply`, json({ text: 'x' }))).status, 404);
    assert.equal(ig.state.sent.length, 1, 'nothing else reached Instagram');
  });
});
