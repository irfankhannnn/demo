// The real dynamoService over the in-process DynamoDB stand-in.
//
// What these tests protect: idempotent message storage (a webhook, a poll and
// our own send can all report one message), acting on a comment once, tenant
// isolation of the registry pointers, and Meta data deletion removing exactly
// one account's data.

import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, TENANT, OTHER_TENANT } from './support.js';

test('an update to a record that does not exist returns null instead of creating it', async () => {
  const db = freshDb();
  assert.equal(await db.updateAccount(TENANT, 'nope', { status: 'connected' }), null);
  assert.equal(await db.getAccount(TENANT, 'nope'), null);
});

test('messages are stored once per message id', async () => {
  const db = freshDb();
  const msg = { threadId: 'a_1', messageId: 'mid.1', direction: 'in', text: 'hi', createdAt: '2026-09-15T10:00:00.000Z' };
  assert.equal((await db.putMessagesIfAbsent(TENANT, [msg])).length, 1);
  assert.equal((await db.putMessagesIfAbsent(TENANT, [msg, { ...msg, messageId: 'mid.2', createdAt: '2026-09-15T09:00:00.000Z' }])).length, 1);

  const stored = await db.listMessages(TENANT, 'a_1');
  assert.deepEqual(stored.map((m) => m.messageId), ['mid.2', 'mid.1'], 'ordered by time, not by id');
  assert.equal((await db.listMessages(OTHER_TENANT, 'a_1')).length, 0);
});

test('a comment can be claimed exactly once', async () => {
  const db = freshDb();
  assert.equal(await db.claimComment(TENANT, { commentId: 'c1', igUserId: '1' }), true);
  assert.equal(await db.claimComment(TENANT, { commentId: 'c1', igUserId: '1' }), false);
  // Another tenant's partition is a different record.
  assert.equal(await db.claimComment(OTHER_TENANT, { commentId: 'c1', igUserId: '1' }), true);
});

test('threads come back with the live Meta window', async () => {
  const db = freshDb();
  await db.putThread(TENANT, { threadId: 'a_1', igUserId: 'a', lastInboundAt: new Date().toISOString(), messageCount: 1 });
  await db.putThread(TENANT, { threadId: 'a_2', igUserId: 'a', lastInboundAt: new Date(Date.now() - 30 * 3600e3).toISOString(), messageCount: 1 });
  const threads = await db.listThreads(TENANT, {});
  const byId = Object.fromEntries(threads.map((t) => [t.threadId, t.windowState]));
  assert.deepEqual(byId, { a_1: 'STANDARD', a_2: 'CLOSED' });
  assert.equal((await db.listThreads(TENANT, { windowState: 'CLOSED' })).length, 1);
});

test('enquiries list newest first, filter, and page with a cursor', async () => {
  const db = freshDb();
  for (const [id, createdAt, temperature] of [
    ['e1', '2026-09-10T00:00:00.000Z', 'hot'],
    ['e2', '2026-09-11T00:00:00.000Z', 'cold'],
    ['e3', '2026-09-12T00:00:00.000Z', 'hot'],
  ]) {
    await db.putEnquiry(TENANT, { enquiryId: id, createdAt, temperature });
  }

  const first = await db.listEnquiries(TENANT, { limit: 2 });
  assert.deepEqual(first.items.map((e) => e.enquiryId), ['e3', 'e2']);
  assert.ok(first.cursor);
  const second = await db.listEnquiries(TENANT, { limit: 2, cursor: first.cursor });
  assert.deepEqual(second.items.map((e) => e.enquiryId), ['e1']);

  const hot = await db.listEnquiries(TENANT, { temperature: 'hot' });
  assert.deepEqual(hot.items.map((e) => e.enquiryId), ['e3', 'e1']);
  assert.equal((await db.listEnquiries(OTHER_TENANT, {})).items.length, 0);
});

test('only whitelisted enquiry fields can be patched', async () => {
  const db = freshDb();
  await db.putEnquiry(TENANT, { enquiryId: 'e1', phone: '+919876543210' });
  const updated = await db.updateEnquiry(TENANT, 'e1', { status: 'contacted', phone: '+910000000000', tenantId: OTHER_TENANT });
  assert.equal(updated.status, 'contacted');
  assert.equal(updated.phone, '+919876543210');
  assert.equal(updated.tenantId, TENANT);
});

test('registry pointers route an Instagram id to its tenant, and unregistering never removes another tenant\'s pointer', async () => {
  const db = freshDb();
  await db.registerAccount(TENANT, 'ig1', ['scoped1']);
  assert.deepEqual(await db.findAccountRefByIgId('scoped1'), { tenantId: TENANT, igUserId: 'ig1' });
  assert.deepEqual(await db.listRegisteredAccounts(), [{ tenantId: TENANT, igUserId: 'ig1' }]);

  // Another workspace takes the account over later.
  await db.registerAccount(OTHER_TENANT, 'ig1', ['scoped1']);
  await db.unregisterAccount(TENANT, 'ig1', ['scoped1']);
  assert.deepEqual(await db.findAccountRefByIgId('scoped1'), { tenantId: OTHER_TENANT, igUserId: 'ig1' });
  assert.deepEqual(await db.listRegisteredAccounts(), [{ tenantId: OTHER_TENANT, igUserId: 'ig1' }]);
});

test('data deletion removes one account\'s data and nothing else', async () => {
  const db = freshDb();
  await db.putAccount(TENANT, { igUserId: 'ig1', status: 'connected' });
  await db.putAccount(TENANT, { igUserId: 'ig2', status: 'connected' });
  await db.putThread(TENANT, { threadId: 'ig1_p', igUserId: 'ig1' });
  await db.putThread(TENANT, { threadId: 'ig2_p', igUserId: 'ig2' });
  await db.putMessagesIfAbsent(TENANT, [{ threadId: 'ig1_p', messageId: 'm', igUserId: 'ig1', createdAt: 'x' }]);
  await db.putEnquiry(TENANT, { enquiryId: 'ig_ig1_p', igUserId: 'ig1' });
  await db.putRule(TENANT, { ruleId: 'r1', keyword: 'price', dmMessage: 'hi' });
  await db.putAccount(OTHER_TENANT, { igUserId: 'ig1', status: 'connected' });

  const deleted = await db.deleteAccountData(TENANT, 'ig1');
  assert.equal(deleted, 4);
  assert.equal(await db.getAccount(TENANT, 'ig1'), null);
  assert.equal(await db.getThread(TENANT, 'ig1_p'), null);
  assert.equal((await db.listMessages(TENANT, 'ig1_p')).length, 0);
  assert.ok(await db.getAccount(TENANT, 'ig2'));
  assert.ok(await db.getThread(TENANT, 'ig2_p'));
  assert.equal((await db.listRules(TENANT)).length, 1, 'tenant-level rules are not account data');
  assert.ok(await db.getAccount(OTHER_TENANT, 'ig1'), 'another tenant is untouched');
});
