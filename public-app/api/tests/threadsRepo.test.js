/**
 * Thread dedupe and unread bookkeeping against a scripted DocumentClient.
 *
 * The fake keeps items in a Map keyed on PK|SK and implements just enough of
 * Get/Put/Update/Query/TransactWrite to honour the condition expressions
 * the repository relies on. It is deliberately not a DynamoDB emulator:
 * the point is to prove the repository issues the right commands with the
 * right conditions, and that a lost race is recovered rather than surfaced.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.CRM_INTERNAL_API_DOMAIN_NAME = 'http://localhost:9999';
process.env.CRM_INTERNAL_API_BASE_PATH = '';
process.env.MARKETPLACE_TABLE_NAME = 'test-table';

const { setDocClient } = await import('../services/dynamo.js');
const threads = await import('../services/threadsRepo.js');

/** Minimal DynamoDB stand-in. */
function fakeDynamo() {
  const items = new Map();
  const key = (k) => `${k.PK}|${k.SK}`;
  const log = [];

  function applyUpdate(existing, cmd) {
    const item = existing ? { ...existing } : { ...cmd.Key };
    const names = cmd.ExpressionAttributeNames || {};
    const values = cmd.ExpressionAttributeValues || {};
    const resolve = (n) => names[n] || n;
    const expr = cmd.UpdateExpression;

    const setPart = expr.match(/SET\s+(.*?)(?:\s+ADD\s+|$)/s)?.[1];
    const addPart = expr.match(/ADD\s+(.*)$/s)?.[1];
    if (setPart) {
      for (const clause of setPart.split(',')) {
        const [lhs, rhs] = clause.split('=').map((s) => s.trim());
        const field = resolve(lhs);
        const ifNot = rhs.match(/^if_not_exists\((\w+),\s*(:\w+)\)$/);
        if (ifNot) item[field] = item[resolve(ifNot[1])] !== undefined ? item[resolve(ifNot[1])] : values[ifNot[2]];
        else item[field] = values[rhs];
      }
    }
    if (addPart) {
      for (const clause of addPart.split(',')) {
        const [lhs, rhs] = clause.trim().split(/\s+/);
        const field = resolve(lhs);
        item[field] = (Number(item[field]) || 0) + Number(values[rhs]);
      }
    }
    return item;
  }

  function put(cmd) {
    const k = key(cmd.Item);
    if (cmd.ConditionExpression === 'attribute_not_exists(PK)' && items.has(k)) {
      const err = new Error('The conditional request failed');
      err.name = 'ConditionalCheckFailedException';
      throw err;
    }
    items.set(k, { ...cmd.Item });
  }

  return {
    items,
    log,
    async send(command) {
      const name = command.constructor.name;
      const cmd = command.input;
      log.push(name);
      switch (name) {
        case 'GetCommand':
          return { Item: items.get(key(cmd.Key)) };
        case 'PutCommand':
          put(cmd);
          return {};
        case 'UpdateCommand': {
          const existing = items.get(key(cmd.Key));
          if (cmd.ConditionExpression === 'attribute_exists(PK)' && !existing) {
            const err = new Error('The conditional request failed');
            err.name = 'ConditionalCheckFailedException';
            throw err;
          }
          const updated = applyUpdate(existing, cmd);
          items.set(key(cmd.Key), updated);
          return { Attributes: updated };
        }
        case 'TransactWriteCommand': {
          // All-or-nothing: check every condition before writing anything.
          for (const t of cmd.TransactItems) {
            if (t.Put?.ConditionExpression === 'attribute_not_exists(PK)' && items.has(key(t.Put.Item))) {
              const err = new Error('Transaction cancelled');
              err.name = 'TransactionCanceledException';
              throw err;
            }
          }
          for (const t of cmd.TransactItems) items.set(key(t.Put.Item), { ...t.Put.Item });
          return {};
        }
        case 'QueryCommand': {
          const v = cmd.ExpressionAttributeValues;
          // Real DynamoDB rejects a value that no expression references; the
          // fake must too, or a stray placeholder only fails once deployed.
          const expressions = `${cmd.KeyConditionExpression || ''} ${cmd.FilterExpression || ''}`;
          for (const name of Object.keys(v || {})) {
            if (!new RegExp(`${name}(?![A-Za-z0-9_])`).test(expressions)) {
              const err = new Error(`Value provided in ExpressionAttributeValues unused in expressions: keys: {${name}}`);
              err.name = 'ValidationException';
              throw err;
            }
          }
          let rows = [...items.values()];
          if (cmd.IndexName === 'GSI1') rows = rows.filter((r) => r.GSI1PK === v[':pk']);
          else if (cmd.IndexName === 'GSI2') rows = rows.filter((r) => r.GSI2PK === v[':pk']);
          else {
            rows = rows.filter((r) => r.PK === v[':pk']);
            if (v[':prefix']) rows = rows.filter((r) => r.SK.startsWith(v[':prefix']));
            if (v[':since']) rows = rows.filter((r) => r.SK >= v[':since'] && r.SK <= v[':end']);
          }
          if (cmd.FilterExpression === '#s = :status') rows = rows.filter((r) => r.status === v[':status']);
          if (cmd.FilterExpression === 'senderType = :buyer') rows = rows.filter((r) => r.senderType === 'buyer');
          const sortKey = cmd.IndexName === 'GSI1' ? 'GSI1SK' : cmd.IndexName === 'GSI2' ? 'GSI2SK' : 'SK';
          rows.sort((a, b) => (a[sortKey] < b[sortKey] ? -1 : 1));
          if (cmd.ScanIndexForward === false) rows.reverse();
          return { Items: rows.slice(0, cmd.Limit || rows.length) };
        }
        default:
          throw new Error(`fake dynamo: unhandled ${name}`);
      }
    },
  };
}

const BUYER = { userId: 'u1', name: 'Priya', phone: '+919876543210', email: 'p@example.com' };
const LISTING = {
  propertyId: 'p1', tenantId: 't1', agencySlug: 'sharma-realty', title: '2 BHK Andheri',
  city: 'Mumbai', locality: 'Andheri West', pricing: { mode: 'sale', amount: 7500000 }, imageCount: 3,
  agency: { name: 'Sharma Realty' },
};

let db;
beforeEach(() => {
  db = fakeDynamo();
  setDocClient(db);
});

describe('one thread per buyer + property', () => {
  test('second call returns the existing thread, not a new one', async () => {
    const first = await threads.getOrCreateThread({ buyer: BUYER, listing: LISTING });
    const second = await threads.getOrCreateThread({ buyer: BUYER, listing: LISTING });
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.thread.threadId, first.thread.threadId);
    assert.equal([...db.items.keys()].filter((k) => k.startsWith('THREAD#')).length, 1);
    // The pointer item exists in the buyer's partition.
    assert.ok(db.items.has('USER#u1|THREAD_FOR#p1'));
  });

  test('a lost race on the pointer is recovered by reading the winner', async () => {
    const winner = await threads.getOrCreateThread({ buyer: BUYER, listing: LISTING });
    // Simulate a concurrent creator: hide the pointer from the first read,
    // then let the transaction hit the real conditional failure.
    const realSend = db.send.bind(db);
    let firstGet = true;
    db.send = async (command) => {
      if (command.constructor.name === 'GetCommand' && firstGet) {
        firstGet = false;
        return { Item: undefined };
      }
      return realSend(command);
    };
    const loser = await threads.getOrCreateThread({ buyer: BUYER, listing: LISTING });
    assert.equal(loser.created, false);
    assert.equal(loser.thread.threadId, winner.thread.threadId);
  });

  test('a different property gets its own thread', async () => {
    const a = await threads.getOrCreateThread({ buyer: BUYER, listing: LISTING });
    const b = await threads.getOrCreateThread({ buyer: BUYER, listing: { ...LISTING, propertyId: 'p2' } });
    assert.notEqual(a.thread.threadId, b.thread.threadId);
  });

  test('the thread carries the buyer snapshot and both GSI keys', async () => {
    const { thread } = await threads.getOrCreateThread({ buyer: BUYER, listing: LISTING });
    assert.equal(thread.GSI1PK, 'USER#u1');
    assert.equal(thread.GSI2PK, 'TENANT#t1');
    assert.equal(thread.buyerPhone, BUYER.phone);
    assert.equal(thread.snapshot.agencyName, 'Sharma Realty');
    assert.equal(thread.snapshot.price, 7500000);
  });
});

describe('unread counters', () => {
  test('buyer messages count for the agency, agency replies for the buyer', async () => {
    const { thread } = await threads.getOrCreateThread({ buyer: BUYER, listing: LISTING });
    await threads.appendMessage(thread.threadId, { senderType: 'buyer', senderId: 'u1', senderName: 'Priya', text: 'Hi' });
    await threads.appendMessage(thread.threadId, { senderType: 'system', senderId: 'u1', senderName: 'Priya', text: 'ping', kind: 'ping' });
    let meta = await threads.getThread(thread.threadId);
    assert.equal(meta.unreadAgency, 2);
    assert.equal(meta.unreadBuyer, 0);
    assert.equal(meta.lastPreview, 'Interested in this property');

    const { thread: after } = await threads.appendMessage(thread.threadId, { senderType: 'agency', senderId: 'a1', senderName: 'Rahul', text: 'Sure, when?' });
    assert.equal(after.unreadBuyer, 1);
    assert.equal(after.unreadAgency, 2);
    assert.equal(after.lastPreview, 'Sure, when?');

    await threads.markRead(thread.threadId, 'agency');
    await threads.markRead(thread.threadId, 'buyer');
    meta = await threads.getThread(thread.threadId);
    assert.equal(meta.unreadAgency, 0);
    assert.equal(meta.unreadBuyer, 0);
  });

  test('GSI sort keys move forward with every message', async () => {
    const { thread } = await threads.getOrCreateThread({ buyer: BUYER, listing: LISTING });
    const before = (await threads.getThread(thread.threadId)).GSI1SK;
    await new Promise((r) => setTimeout(r, 5));
    await threads.appendMessage(thread.threadId, { senderType: 'buyer', text: 'later' });
    const meta = await threads.getThread(thread.threadId);
    assert.ok(meta.GSI1SK > before);
    assert.equal(meta.GSI1SK, meta.GSI2SK);
    assert.equal(meta.GSI1SK, `THREAD#${meta.lastMessageAt}`);
  });
});

describe('messages', () => {
  test('come back in order, and `since` returns only newer ones', async () => {
    const { thread } = await threads.getOrCreateThread({ buyer: BUYER, listing: LISTING });
    const m1 = await threads.appendMessage(thread.threadId, { senderType: 'buyer', text: 'one' });
    await new Promise((r) => setTimeout(r, 5));
    await threads.appendMessage(thread.threadId, { senderType: 'agency', text: 'two' });
    await new Promise((r) => setTimeout(r, 5));
    await threads.appendMessage(thread.threadId, { senderType: 'buyer', text: 'three' });

    const all = await threads.listMessages(thread.threadId);
    assert.deepEqual(all.map((m) => m.text), ['one', 'two', 'three']);
    // Serialised shape only — never PK/SK.
    assert.equal(all[0].PK, undefined);
    assert.equal(all[0].messageId, m1.message.messageId);

    const newer = await threads.listMessages(thread.threadId, { since: m1.message.createdAt });
    assert.deepEqual(newer.map((m) => m.text), ['two', 'three']);
  });
});

describe('listing and closing', () => {
  test('tenant inbox is newest-first and filterable by status', async () => {
    const a = await threads.getOrCreateThread({ buyer: BUYER, listing: LISTING });
    await new Promise((r) => setTimeout(r, 5));
    const b = await threads.getOrCreateThread({ buyer: { ...BUYER, userId: 'u2' }, listing: { ...LISTING, propertyId: 'p2' } });
    const page = await threads.listThreadsForTenant('t1');
    assert.deepEqual(page.items.map((t) => t.threadId), [b.thread.threadId, a.thread.threadId]);

    const updated = await threads.closeTenantThreads('t1');
    assert.equal(updated, 2);
    const open = await threads.listThreadsForTenant('t1', { status: 'open' });
    assert.equal(open.items.length, 0);
    assert.equal((await threads.getThread(a.thread.threadId)).status, 'agency_closed');
  });
});

describe('anonymise on account deletion', () => {
  test('strips buyer identity from the thread and their messages, keeps the agency side', async () => {
    const { thread } = await threads.getOrCreateThread({ buyer: BUYER, listing: LISTING });
    await threads.appendMessage(thread.threadId, { senderType: 'buyer', senderId: 'u1', senderName: 'Priya', text: 'Hi' });
    await threads.appendMessage(thread.threadId, { senderType: 'agency', senderId: 'a1', senderName: 'Rahul', text: 'Hello' });

    const out = await threads.anonymiseBuyer('u1', [thread.threadId]);
    assert.deepEqual(out, { threads: 1, messages: 1 });

    const meta = await threads.getThread(thread.threadId);
    assert.equal(threads.toBuyer(meta).name, 'Deleted user');
    assert.equal(threads.toBuyer(meta).phone, null);
    assert.equal(threads.toBuyer(meta).email, null);
    const msgs = await threads.listMessages(thread.threadId);
    assert.equal(msgs[0].senderName, 'Deleted user');
    assert.equal(msgs[1].senderName, 'Rahul');
  });

  test('refuses to anonymise a thread the user does not own', async () => {
    const { thread } = await threads.getOrCreateThread({ buyer: BUYER, listing: LISTING });
    const out = await threads.anonymiseBuyer('someone-else', [thread.threadId]);
    assert.equal(out.threads, 0);
    assert.equal((await threads.getThread(thread.threadId)).buyerName, 'Priya');
  });
});
