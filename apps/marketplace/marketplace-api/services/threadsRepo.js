/**
 * Buyer ↔ agency conversations: threads and messages.
 *
 * ── one thread per buyer + property ────────────────────────────────────────
 * A buyer who enquires, pings and books a visit on the same listing has one
 * conversation, not three. That invariant is enforced with a pointer item,
 * `USER#<userId>` / `THREAD_FOR#<propertyId>`, written in the same
 * transaction as the thread itself with a "must not exist" condition. Two
 * concurrent first messages race on that pointer and exactly one wins; the
 * loser reads the pointer back and appends to the winner's thread. No scan,
 * no read-then-write window.
 *
 * ── layout ─────────────────────────────────────────────────────────────────
 *   THREAD#<threadId>  META                 the thread; also on
 *                                            GSI1 USER#<buyer>  / THREAD#<lastMessageAt>
 *                                            GSI2 TENANT#<tid>  / THREAD#<lastMessageAt>
 *   THREAD#<threadId>  MSG#<ISO>#<ulid>     one item per message, sortable
 *
 * The GSI sort keys embed lastMessageAt so "my enquiries" and an agency's
 * inbox both come back newest-first straight off the index; every append
 * rewrites both keys. `since` on a message list is a plain range condition
 * on the ISO-prefixed sort key.
 *
 * ── the buyer's details live on the thread ─────────────────────────────────
 * Name, phone and email are copied onto the thread when it is created so the
 * agency inbox needs no profile lookup per row, and so that deleting the
 * buyer's account can anonymise in place: the thread stays (the agency's
 * side of the conversation is the agency's record) while the identifying
 * fields go. Nothing raw leaves this module — `toThread`, `toBuyer` and
 * `toMessage` are the only shapes a route ever sees.
 */

import {
  GetCommand, PutCommand, UpdateCommand, QueryCommand, TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { config } from '../config/env.js';
import { getDocClient } from './dynamo.js';
import { ulid, threadId as newThreadId } from './ids.js';
import { logger } from '../logger.js';

const table = () => config.tableName;
const threadPk = (id) => `THREAD#${id}`;

export const THREAD_STATUSES = ['open', 'listing_removed', 'agency_closed'];

// ── serialisers ────────────────────────────────────────────────────────────

export function toThread(item) {
  if (!item) return null;
  return {
    threadId: item.threadId,
    buyerUserId: item.buyerUserId,
    tenantId: item.tenantId,
    agencySlug: item.agencySlug,
    propertyId: item.propertyId,
    leadId: item.leadId || null,
    status: item.status || 'open',
    snapshot: item.snapshot || null,
    lastMessageAt: item.lastMessageAt || item.createdAt,
    lastPreview: item.lastPreview || null,
    unreadBuyer: Number(item.unreadBuyer) || 0,
    unreadAgency: Number(item.unreadAgency) || 0,
    createdAt: item.createdAt,
  };
}

/** Internal (agency-facing) only. Never sent to a browser session. */
export function toBuyer(item) {
  if (!item) return null;
  return {
    name: item.buyerName || null,
    phone: item.buyerPhone || null,
    email: item.buyerEmail || null,
  };
}

export function toMessage(item) {
  if (!item) return null;
  const out = {
    messageId: item.messageId,
    threadId: item.threadId,
    senderType: item.senderType,
    senderId: item.senderId || null,
    senderName: item.senderName || null,
    text: item.text || '',
    kind: item.kind || 'text',
    createdAt: item.createdAt,
  };
  if (item.meta) out.meta = item.meta;
  return out;
}

/** The display snapshot stored on a thread. */
export function threadSnapshot(listing) {
  return {
    title: listing.title || null,
    agencyName: listing.agency?.name || null,
    city: listing.city || null,
    locality: listing.locality || null,
    price: listing.pricing?.amount ?? null,
    mode: listing.pricing?.mode || null,
    imageCount: Number(listing.imageCount) || 0,
  };
}

/** Short, single-line preview for list rows. */
function preview(text, kind) {
  if (kind === 'ping') return 'Interested in this property';
  if (kind === 'visit_request') return 'Site visit requested';
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

// ── cursors ────────────────────────────────────────────────────────────────

function encodeCursor(key) {
  return key ? Buffer.from(JSON.stringify(key)).toString('base64url') : null;
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

// ── threads ────────────────────────────────────────────────────────────────

export async function getThread(threadId) {
  const result = await getDocClient().send(new GetCommand({
    TableName: table(),
    Key: { PK: threadPk(threadId), SK: 'META' },
  }));
  return result.Item || null;
}

/**
 * Find the buyer's thread for a property, or create it.
 *
 * Returns the raw META item plus `created` so the caller knows whether to
 * fire the CRM enquiry (first contact) or a plain message alert. Callers
 * serialise with toThread() before responding.
 */
export async function getOrCreateThread({ buyer, listing }) {
  const client = getDocClient();
  const lookupKey = { PK: `USER#${buyer.userId}`, SK: `THREAD_FOR#${listing.propertyId}` };

  const existing = await client.send(new GetCommand({ TableName: table(), Key: lookupKey }));
  if (existing.Item?.threadId) {
    const thread = await getThread(existing.Item.threadId);
    if (thread) return { thread, created: false };
  }

  const id = newThreadId();
  const now = new Date().toISOString();
  const item = {
    PK: threadPk(id),
    SK: 'META',
    entity: 'Thread',
    threadId: id,
    buyerUserId: buyer.userId,
    buyerName: buyer.name || null,
    buyerPhone: buyer.phone || null,
    buyerEmail: buyer.email || null,
    tenantId: listing.tenantId,
    agencySlug: listing.agencySlug,
    propertyId: listing.propertyId,
    leadId: null,
    status: 'open',
    snapshot: threadSnapshot(listing),
    lastMessageAt: now,
    lastPreview: null,
    unreadBuyer: 0,
    unreadAgency: 0,
    createdAt: now,
    updatedAt: now,
    GSI1PK: `USER#${buyer.userId}`,
    GSI1SK: `THREAD#${now}`,
    GSI2PK: `TENANT#${listing.tenantId}`,
    GSI2SK: `THREAD#${now}`,
  };

  try {
    await client.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: table(),
            Item: { ...lookupKey, entity: 'ThreadLookup', threadId: id, propertyId: listing.propertyId, createdAt: now },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
        { Put: { TableName: table(), Item: item, ConditionExpression: 'attribute_not_exists(PK)' } },
      ],
    }));
    logger.info('threads.created', { threadId: id, tenantId: listing.tenantId, propertyId: listing.propertyId });
    return { thread: item, created: true };
  } catch (err) {
    if (err.name !== 'TransactionCanceledException') throw err;
    // Lost the race: the other writer's pointer is now there. Read it.
    const again = await client.send(new GetCommand({ TableName: table(), Key: lookupKey }));
    const thread = again.Item?.threadId ? await getThread(again.Item.threadId) : null;
    if (!thread) throw err;
    return { thread, created: false };
  }
}

/**
 * Append a message and roll the thread's summary forward.
 *
 * Two writes, message first: if the second fails the message still exists
 * and shows in the list; only the row summary lags. The reverse order could
 * advertise a preview for a message that was never stored.
 *
 * `senderType` decides whose unread counter grows: anything the buyer does
 * (text, ping, visit request) is unread for the agency, and vice versa.
 */
export async function appendMessage(threadId, {
  senderType, senderId = null, senderName = null, text = '', kind = 'text', meta = null,
}) {
  const client = getDocClient();
  const now = new Date().toISOString();
  const messageId = ulid();
  const item = {
    PK: threadPk(threadId),
    SK: `MSG#${now}#${messageId}`,
    entity: 'Message',
    messageId,
    threadId,
    senderType,
    senderId,
    senderName,
    text,
    kind,
    createdAt: now,
  };
  if (meta) item.meta = meta;

  await client.send(new PutCommand({ TableName: table(), Item: item }));

  const unreadField = senderType === 'agency' ? 'unreadBuyer' : 'unreadAgency';
  const result = await client.send(new UpdateCommand({
    TableName: table(),
    Key: { PK: threadPk(threadId), SK: 'META' },
    UpdateExpression: 'SET lastMessageAt = :now, lastPreview = :prev, updatedAt = :now, GSI1SK = :gsk, GSI2SK = :gsk ADD #unread :one',
    ExpressionAttributeNames: { '#unread': unreadField },
    ExpressionAttributeValues: {
      ':now': now, ':prev': preview(text, kind), ':gsk': `THREAD#${now}`, ':one': 1,
    },
    ConditionExpression: 'attribute_exists(PK)',
    ReturnValues: 'ALL_NEW',
  }));

  return { message: item, thread: result.Attributes };
}

/** Messages in creation order; `since` (ISO) returns only those written after it. */
export async function listMessages(threadId, { since = null, limit = 200 } = {}) {
  const values = { ':pk': threadPk(threadId), ':prefix': 'MSG#' };
  let keyCondition = 'PK = :pk AND begins_with(SK, :prefix)';
  if (since) {
    // MSG#<iso>#<ulid> sorts by ISO first. The client passes the createdAt
    // of the last message it has, so the bound must sit ABOVE every ulid in
    // that millisecond: '~' (0x7E) is greater than any Crockford base32
    // character, so `MSG#<since>#~` excludes the whole `since` millisecond
    // and admits everything stamped later.
    values[':since'] = `MSG#${since}#~`;
    keyCondition = 'PK = :pk AND SK > :since';
  }
  const result = await getDocClient().send(new QueryCommand({
    TableName: table(),
    KeyConditionExpression: keyCondition,
    ExpressionAttributeValues: values,
    ScanIndexForward: true,
    Limit: Math.min(Math.max(Number(limit) || 200, 1), 500),
  }));
  return (result.Items || []).filter((i) => i.SK.startsWith('MSG#')).map(toMessage);
}

/** Zero one side's unread counter. */
export async function markRead(threadId, side) {
  const field = side === 'agency' ? 'unreadAgency' : 'unreadBuyer';
  await getDocClient().send(new UpdateCommand({
    TableName: table(),
    Key: { PK: threadPk(threadId), SK: 'META' },
    UpdateExpression: 'SET #f = :zero, updatedAt = :now',
    ExpressionAttributeNames: { '#f': field },
    ExpressionAttributeValues: { ':zero': 0, ':now': new Date().toISOString() },
    ConditionExpression: 'attribute_exists(PK)',
  }));
}

export async function setLeadId(threadId, leadId) {
  if (!leadId) return;
  await getDocClient().send(new UpdateCommand({
    TableName: table(),
    Key: { PK: threadPk(threadId), SK: 'META' },
    UpdateExpression: 'SET leadId = if_not_exists(leadId, :lead), updatedAt = :now',
    ExpressionAttributeValues: { ':lead': leadId, ':now': new Date().toISOString() },
    ConditionExpression: 'attribute_exists(PK)',
  }));
}

export async function setStatus(threadId, status) {
  if (!THREAD_STATUSES.includes(status)) throw new Error(`invalid thread status: ${status}`);
  await getDocClient().send(new UpdateCommand({
    TableName: table(),
    Key: { PK: threadPk(threadId), SK: 'META' },
    UpdateExpression: 'SET #s = :s, updatedAt = :now',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':s': status, ':now': new Date().toISOString() },
    ConditionExpression: 'attribute_exists(PK)',
  }));
}

// ── listings of threads ────────────────────────────────────────────────────

async function queryIndex(index, pkName, pkValue, { cursor, limit, status } = {}) {
  const params = {
    TableName: table(),
    IndexName: index,
    KeyConditionExpression: `${pkName} = :pk`,
    ExpressionAttributeValues: { ':pk': pkValue },
    ScanIndexForward: false,
    Limit: Math.min(Math.max(Number(limit) || 25, 1), 100),
    ExclusiveStartKey: decodeCursor(cursor),
  };
  if (status) {
    params.FilterExpression = '#s = :status';
    params.ExpressionAttributeNames = { '#s': 'status' };
    params.ExpressionAttributeValues[':status'] = status;
  }
  const result = await getDocClient().send(new QueryCommand(params));
  return { items: result.Items || [], nextCursor: encodeCursor(result.LastEvaluatedKey) };
}

/** Newest-first threads for a buyer. Raw items; callers serialise. */
export async function listThreadsForUser(userId, opts = {}) {
  return queryIndex('GSI1', 'GSI1PK', `USER#${userId}`, opts);
}

/** Newest-first threads for an agency, optionally filtered by status. */
export async function listThreadsForTenant(tenantId, opts = {}) {
  return queryIndex('GSI2', 'GSI2PK', `TENANT#${tenantId}`, opts);
}

/** Every open thread of a tenant → agency_closed. Returns how many changed. */
export async function closeTenantThreads(tenantId) {
  let updated = 0;
  let cursor = null;
  do {
    // eslint-disable-next-line no-await-in-loop
    const page = await listThreadsForTenant(tenantId, { cursor, limit: 100, status: 'open' });
    for (const item of page.items) {
      // eslint-disable-next-line no-await-in-loop
      await setStatus(item.threadId, 'agency_closed');
      updated += 1;
    }
    cursor = page.nextCursor;
  } while (cursor);
  logger.info('threads.tenant_closed', { tenantId, updated });
  return updated;
}

// ── account deletion ───────────────────────────────────────────────────────

/**
 * Strip the buyer's identity from their threads. Threads and messages stay:
 * the agency's side of the conversation is the agency's record. Buyer-sent
 * messages keep their text but lose the sender name; the thread loses name,
 * phone and email and is marked so the inbox can show "Deleted user".
 */
export async function anonymiseBuyer(userId, threadIds = []) {
  const client = getDocClient();
  const now = new Date().toISOString();
  let threads = 0;
  let messages = 0;

  for (const threadId of threadIds) {
    // eslint-disable-next-line no-await-in-loop
    const thread = await getThread(threadId);
    if (!thread || thread.buyerUserId !== userId) continue;

    // eslint-disable-next-line no-await-in-loop
    await client.send(new UpdateCommand({
      TableName: table(),
      Key: { PK: threadPk(threadId), SK: 'META' },
      UpdateExpression: 'SET buyerName = :n, buyerPhone = :null, buyerEmail = :null, buyerDeleted = :t, updatedAt = :now',
      ExpressionAttributeValues: { ':n': 'Deleted user', ':null': null, ':t': true, ':now': now },
    }));
    threads += 1;

    let ExclusiveStartKey;
    do {
      // eslint-disable-next-line no-await-in-loop
      const page = await client.send(new QueryCommand({
        TableName: table(),
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: 'senderType = :buyer',
        ExpressionAttributeValues: { ':pk': threadPk(threadId), ':prefix': 'MSG#', ':buyer': 'buyer' },
        ProjectionExpression: 'PK, SK',
        ExclusiveStartKey,
      }));
      for (const msg of page.Items || []) {
        // eslint-disable-next-line no-await-in-loop
        await client.send(new UpdateCommand({
          TableName: table(),
          Key: { PK: msg.PK, SK: msg.SK },
          UpdateExpression: 'SET senderName = :n',
          ExpressionAttributeValues: { ':n': 'Deleted user' },
        }));
        messages += 1;
      }
      ExclusiveStartKey = page.LastEvaluatedKey;
    } while (ExclusiveStartKey);
  }

  logger.info('threads.buyer_anonymised', { userId, threads, messages });
  return { threads, messages };
}
