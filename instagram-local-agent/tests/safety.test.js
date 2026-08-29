/**
 * The safety guarantees. If any of these fail, the product's central promise -
 * "this will not get your Instagram account restricted" - is no longer true, so
 * they are deliberately blunt and specific.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCtx, seedConversation } from './support.js';
import {
  classifyWindow, canSend, isDowngrade, WINDOW,
  STANDARD_WINDOW_MS, COMMENT_REPLY_WINDOW_MS,
} from '../src/engine/windowClassifier.js';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

test('window classifier truth table', async (t) => {
  const at = 1_700_000_000_000;

  await t.test('inbound within 24h is STANDARD and auto-sendable', () => {
    const w = classifyWindow({ lastInboundAt: at - 2 * HOUR }, at);
    assert.equal(w.state, WINDOW.STANDARD);
    assert.equal(w.autoSendAllowed, true);
  });

  await t.test('inbound at exactly 24h has lapsed', () => {
    const w = classifyWindow({ lastInboundAt: at - STANDARD_WINDOW_MS }, at);
    assert.equal(w.state, WINDOW.CLOSED);
  });

  await t.test('comment within 7 days is COMMENT_REPLY', () => {
    const w = classifyWindow({ lastCommentAt: at - 3 * DAY }, at);
    assert.equal(w.state, WINDOW.COMMENT_REPLY);
  });

  await t.test('comment at exactly 7 days has lapsed', () => {
    const w = classifyWindow({ lastCommentAt: at - COMMENT_REPLY_WINDOW_MS }, at);
    assert.equal(w.state, WINDOW.CLOSED);
  });

  await t.test('a fresh inbound outranks an older comment', () => {
    const w = classifyWindow({ lastInboundAt: at - HOUR, lastCommentAt: at - 3 * DAY }, at);
    assert.equal(w.state, WINDOW.STANDARD);
  });

  await t.test('HUMAN_AGENT is never auto-sendable', () => {
    const w = classifyWindow({ humanAgentUntil: at + 2 * DAY }, at);
    assert.equal(w.state, WINDOW.HUMAN_AGENT);
    assert.equal(w.autoSendAllowed, false, 'HUMAN_AGENT must never grant automated permission');
  });

  await t.test('a 60-day-old thread is CLOSED', () => {
    const w = classifyWindow({ lastInboundAt: at - 60 * DAY, lastCommentAt: at - 60 * DAY }, at);
    assert.equal(w.state, WINDOW.CLOSED);
  });

  await t.test('snake_case rows off SQLite classify the same as camelCase', () => {
    assert.equal(classifyWindow({ last_inbound_at: at - HOUR }, at).state,
      classifyWindow({ lastInboundAt: at - HOUR }, at).state);
  });
});

test('canSend gates by kind as well as window', async (t) => {
  const at = 1_700_000_000_000;

  await t.test('CLOSED refuses every message kind', () => {
    const conv = { lastInboundAt: at - 60 * DAY };
    for (const kind of ['dm', 'private_reply']) {
      assert.equal(canSend({ conversation: conv, kind }, at).allowed, false, `${kind} must be refused`);
    }
  });

  await t.test('COMMENT_REPLY allows a private reply but not a free-form DM', () => {
    const conv = { lastCommentAt: at - DAY };
    assert.equal(canSend({ conversation: conv, kind: 'private_reply' }, at).allowed, true);
    assert.equal(canSend({ conversation: conv, kind: 'dm' }, at).allowed, false);
  });

  await t.test('HUMAN_AGENT needs an explicit human approval', () => {
    const conv = { humanAgentUntil: at + DAY };
    assert.equal(canSend({ conversation: conv, kind: 'dm', humanApproved: false }, at).allowed, false);
    assert.equal(canSend({ conversation: conv, kind: 'dm', humanApproved: true }, at).allowed, true);
  });

  await t.test('a public comment reply is not window-bound', () => {
    const conv = { lastInboundAt: at - 60 * DAY };
    assert.equal(canSend({ conversation: conv, kind: 'comment_reply' }, at).allowed, true);
  });
});

test('isDowngrade ranks the states correctly', () => {
  assert.equal(isDowngrade(WINDOW.STANDARD, WINDOW.CLOSED), true);
  assert.equal(isDowngrade(WINDOW.CLOSED, WINDOW.STANDARD), false);
  assert.equal(isDowngrade(WINDOW.COMMENT_REPLY, WINDOW.HUMAN_AGENT), true);
});

test('the sender refuses to queue a DM to a CLOSED thread', async () => {
  const ctx = await makeCtx();
  try {
    const { queueDirectMessage } = await import('../src/engine/sender.js');
    seedConversation(ctx, { conversationId: 'conv_closed', lastInboundAt: Date.now() - 60 * DAY });

    const row = queueDirectMessage(ctx, {
      conversationId: 'conv_closed',
      igUserId: 'ig_1',
      recipientId: 'them_1',
      body: 'this must never be sent',
    });

    assert.equal(row.status, 'blocked');
    // It is recorded rather than dropped: the owner has to be able to see that
    // the reply they expected did not go out, and why.
    const stored = ctx.repos.getOutbox(row.outbox_id, ctx.db);
    assert.equal(stored.status, 'blocked');
    assert.match(stored.last_error ?? '', /CLOSED/i);
  } finally {
    ctx.close();
  }
});

test('the sender queues normally inside the standard window', async () => {
  const ctx = await makeCtx();
  try {
    const { queueDirectMessage } = await import('../src/engine/sender.js');
    seedConversation(ctx, { conversationId: 'conv_open', lastInboundAt: Date.now() - HOUR });

    const row = queueDirectMessage(ctx, {
      conversationId: 'conv_open', igUserId: 'ig_1', recipientId: 'them_1', body: 'hello',
    });
    assert.equal(row.status, 'queued');
    assert.equal(row.window_state_at_queue, WINDOW.STANDARD);
  } finally {
    ctx.close();
  }
});

test('buildRequest produces the documented Meta payloads', async () => {
  const { buildRequest } = await import('../src/engine/sender.js');

  const priv = buildRequest({ kind: 'private_reply', comment_id: 'c_1', body: 'hi' });
  assert.equal(priv.path, '/me/messages');
  // comment_id in `recipient` is what makes this a private reply and buys the
  // 7-day allowance. A plain `id` here would be an ordinary DM and illegal.
  assert.deepEqual(priv.body.recipient, { comment_id: 'c_1' });

  const dm = buildRequest({ kind: 'dm', recipient_id: 'u_1', body: 'hi' });
  assert.deepEqual(dm.body.recipient, { id: 'u_1' });

  const cr = buildRequest({ kind: 'comment_reply', comment_id: 'c_2', body: 'thanks' });
  assert.equal(cr.path, '/c_2/replies');
});

test('a window error downgrades the thread and does not retry', async () => {
  const ctx = await makeCtx();
  try {
    const { queueDirectMessage, processOutbox } = await import('../src/engine/sender.js');
    const { ERROR_KIND } = await import('../src/runtime/errors.js');

    seedConversation(ctx, { conversationId: 'conv_race', lastInboundAt: Date.now() - HOUR });
    const row = queueDirectMessage(ctx, {
      conversationId: 'conv_race', igUserId: 'ig_1', recipientId: 'them_1', body: 'hi',
    });
    assert.equal(row.status, 'queued');

    // Meta rejects it: the window closed between queue and send.
    const err = new Error('outside the allowed window');
    err.kind = ERROR_KIND.WINDOW_BLOCKED;
    err.code = 551;
    ctx.graph.push(err);

    const res = await processOutbox(ctx);
    assert.equal(res.results[0].status, 'blocked');

    const after = ctx.repos.getOutbox(row.outbox_id, ctx.db);
    assert.equal(after.status, 'blocked');
    assert.equal(after.attempts, 1, 'a window-blocked send must be attempted once, never retried');
    assert.equal(ctx.repos.getConversation('conv_race', ctx.db).window_state, WINDOW.CLOSED);
  } finally {
    ctx.close();
  }
});

test('the kill switch stops the outbox', async () => {
  const ctx = await makeCtx();
  try {
    const { queueDirectMessage, processOutbox } = await import('../src/engine/sender.js');
    const killSwitch = await import('../src/runtime/killSwitch.js');

    seedConversation(ctx, { conversationId: 'conv_kill', lastInboundAt: Date.now() - HOUR });
    queueDirectMessage(ctx, {
      conversationId: 'conv_kill', igUserId: 'ig_1', recipientId: 'them_1', body: 'hi',
    });

    killSwitch.engage('test', 'human');
    const res = await processOutbox(ctx);

    assert.equal(res.results[0].status, 'queued', 'items stay queued, they are not failed');
    assert.equal(ctx.graph.calls.length, 0, 'nothing may reach the network with the kill switch on');
    killSwitch.disengage('human');
  } finally {
    ctx.close();
  }
});

test('dry run builds the request but sends nothing', async () => {
  const ctx = await makeCtx();
  try {
    const { queueDirectMessage, processOutbox } = await import('../src/engine/sender.js');
    const killSwitch = await import('../src/runtime/killSwitch.js');

    seedConversation(ctx, { conversationId: 'conv_dry', lastInboundAt: Date.now() - HOUR });
    queueDirectMessage(ctx, {
      conversationId: 'conv_dry', igUserId: 'ig_1', recipientId: 'them_1', body: 'hi',
    });

    killSwitch.setDryRun(true, 'human');
    const res = await processOutbox(ctx);

    assert.equal(res.results[0].status, 'dry_run');
    assert.equal(ctx.graph.calls.length, 0);
    killSwitch.setDryRun(false, 'human');
  } finally {
    ctx.close();
  }
});

test('the rate governor refuses once a bucket is spent', async () => {
  const { RateGovernor, RateLimitError } = await import('../src/runtime/governor.js');
  const g = new RateGovernor({ limits: { dm_send: { capacity: 2, windowMs: 3600_000 } }, audit: false });

  g.spend('dm_send');
  g.spend('dm_send');
  assert.equal(g.canSpend('dm_send'), false, 'a spent bucket must refuse');
  assert.throws(() => g.spend('dm_send'), RateLimitError);
});

test('our caps sit below Meta ceilings', async () => {
  const { BUCKETS } = await import('../src/runtime/governor.js');
  // 750/hour is Meta's documented private-reply ceiling.
  assert.ok(BUCKETS.private_reply.capacity < 750);
  // 50/24h is Meta's publishing cap.
  assert.ok(BUCKETS.publish.capacity < 50);
});

test('the console binds to loopback only', async () => {
  const ctx = await makeCtx();
  try {
    const { startConsole } = await import('../src/console/server.js');
    const { server, host } = await startConsole(ctx, { port: 0 });
    // Binding 0.0.0.0 would expose send-capable controls, with no auth, to the
    // whole network. This must never regress.
    assert.equal(host, '127.0.0.1');
    assert.equal(server.address().address, '127.0.0.1');
    await new Promise((r) => server.close(r));
  } finally {
    ctx.close();
  }
});

test('Phase 4 actions are stubs that refuse, and the importer is not schedulable', async () => {
  const actions = await import('../src/actions/index.js');
  assert.throws(() => actions.hideComment(), /not implemented/i);
  assert.throws(() => actions.publishMedia(), /not implemented/i);

  const importer = await import('../src/importers/dmExport.js');
  assert.equal(importer.SCHEDULABLE, false, 'the browser importer must never be schedulable');
  assert.throws(() => importer.importDmExport(), /not implemented/i);
});

test('no banned Instagram action exists anywhere in the source', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');

  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

  const files = walk(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const banned = [/\/follows\b/, /\/unfollow/, /\/likes['"`]/, /followers\/list/];

  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const re of banned) {
      assert.equal(re.test(src), false, `${f} references a banned endpoint (${re})`);
    }
  }
});
