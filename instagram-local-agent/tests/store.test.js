/**
 * The local store. SQLite is the source of truth for this agent, so a migration
 * that does not run cleanly on an empty database is a total failure, not a bug.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCtx, seedConversation } from './support.js';

test('migrations run clean on an empty database and are idempotent', async () => {
  const ctx = await makeCtx();
  try {
    const health = ctx.repos.storeHealth(ctx.db);
    assert.notEqual(health.ok, false, `schema problem: ${JSON.stringify(health)}`);

    const { migrate } = await import('../src/store/migrations.js');
    // Running again must be a no-op, because it happens on every process start.
    assert.doesNotThrow(() => migrate(ctx.db));
    assert.notEqual(ctx.repos.storeHealth(ctx.db).ok, false);
  } finally {
    ctx.close();
  }
});

test('every table named in the architecture contract exists', async () => {
  const ctx = await makeCtx();
  try {
    const rows = ctx.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
    const names = rows.map((r) => r.name);
    for (const t of [
      'accounts', 'tokens', 'media', 'media_metrics', 'account_metrics',
      'conversations', 'messages', 'comments', 'enquiries', 'drafts',
      'outbox', 'rules', 'sync_state', 'audit_log', 'upload_queue',
    ]) {
      assert.ok(names.includes(t), `missing table from the contract: ${t}`);
    }
  } finally {
    ctx.close();
  }
});

test('message insertion is idempotent so a re-sync cannot duplicate', async () => {
  const ctx = await makeCtx();
  try {
    seedConversation(ctx, { conversationId: 'c1' });
    const msg = {
      messageId: 'm1', conversationId: 'c1', igUserId: 'ig_1', direction: 'in',
      senderId: 'them_1', text: 'hello', createdAt: Date.now(),
    };
    ctx.repos.insertMessage(msg, ctx.db);
    ctx.repos.insertMessage(msg, ctx.db);

    // The backfill deliberately overlaps its cursor, so this has to hold.
    assert.equal(ctx.repos.listMessages('c1', 50, ctx.db).length, 1);
  } finally {
    ctx.close();
  }
});

test('enquiries survive a re-extract without duplicating', async () => {
  const ctx = await makeCtx();
  try {
    seedConversation(ctx, { conversationId: 'c2' });
    const base = {
      enquiryId: 'enq_c2', igUserId: 'ig_1', conversationId: 'c2',
      name: 'Rahul', phone: '+919812345678', intent: 'buy', temperature: 'warm', score: 50,
    };
    ctx.repos.upsertEnquiry(base, ctx.db);
    ctx.repos.upsertEnquiry({ ...base, score: 80, temperature: 'hot' }, ctx.db);

    const rows = ctx.repos.listEnquiries({ limit: 10 }, ctx.db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].temperature, 'hot', 'a re-extract should update, not insert');
  } finally {
    ctx.close();
  }
});

test('the audit log records what the agent did', async () => {
  const ctx = await makeCtx();
  try {
    ctx.repos.audit({ scope: 'test', action: 'thing', outcome: 'ok', detail: 'detail' }, ctx.db);
    const rows = ctx.repos.listAudit({ limit: 10 }, ctx.db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].scope, 'test');
  } finally {
    ctx.close();
  }
});

test('the upload queue retries and eventually gives up', async () => {
  const ctx = await makeCtx();
  try {
    // enqueueUpload returns { inserted, idempotencyKey } - the row id comes
    // from reading the queue back, which is how flush() gets it too.
    ctx.repos.enqueueUpload({ endpoint: '/agent/snapshot', payload: { a: 1 } }, ctx.db);
    const row = ctx.repos.listDueUploads(10, Date.now(), ctx.db)[0];
    // uploadQueueDepth groups by status rather than returning a single number.
    const depth = ctx.repos.uploadQueueDepth(ctx.db);
    assert.equal(depth.find((d) => d.status === 'pending')?.n, 1);

    ctx.repos.failUpload(row.id, { error: 'boom', statusCode: 500, nextAttemptAt: Date.now() - 1 }, ctx.db);
    assert.equal(ctx.repos.listDueUploads(10, Date.now(), ctx.db).length, 1, 'a retryable failure stays due');

    ctx.repos.failUpload(row.id, { error: 'fatal', statusCode: 400, dead: true }, ctx.db);
    assert.equal(ctx.repos.listDueUploads(10, Date.now(), ctx.db).length, 0, 'a dead row must stop being retried');
  } finally {
    ctx.close();
  }
});

test('the drafter produces Hinglish for Hinglish and English for English', async () => {
  const { templateDrafter, detectLanguage, categorise } = await import('../src/engine/drafter.js');

  assert.equal(detectLanguage('price kitna hai bhai'), 'hinglish');
  assert.equal(detectLanguage('what is the price'), 'en');
  assert.equal(detectLanguage('कीमत क्या है'), 'hi');

  const hin = templateDrafter({ text: 'price kitna hai', facts: { price: '1.4 Cr' } });
  assert.equal(hin.category, 'price');
  assert.equal(hin.language, 'hinglish');
  assert.match(hin.body, /1\.4 Cr/);

  const en = templateDrafter({ text: 'what is the price?', facts: {} });
  assert.equal(en.language, 'en');
  // An unfilled placeholder must never reach a customer.
  assert.ok(!en.body.includes('{'), `unfilled placeholder in: ${en.body}`);
});

test('only safe categories are auto-send eligible', async () => {
  const { categorise } = await import('../src/engine/drafter.js');
  assert.equal(categorise('price kitna').autoSendEligible, true);
  // Loan and negotiation answers commit the broker to something, so a human
  // must see them first.
  assert.equal(categorise('home loan milega').autoSendEligible, false);
  assert.equal(categorise('last price kya hai').autoSendEligible, false);
});

test('conversation message rows get the right direction', async () => {
  const { toMessageRow } = await import('../src/collectors/conversations.js');

  const inbound = toMessageRow(
    { id: 'm1', from: { id: 'them' }, message: 'hi', created_time: '2026-08-29T10:00:00+0000' },
    { conversationId: 'c1', igUserId: 'me', selfIgId: 'me' },
  );
  assert.equal(inbound.direction, 'in');

  const outbound = toMessageRow(
    { id: 'm2', from: { id: 'me' }, message: 'hello', created_time: '2026-08-29T10:01:00+0000' },
    { conversationId: 'c1', igUserId: 'me', selfIgId: 'me' },
  );
  assert.equal(outbound.direction, 'out');
});
