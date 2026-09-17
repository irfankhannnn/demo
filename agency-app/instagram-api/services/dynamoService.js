// The only module in this service that talks to DynamoDB.
//
// Two tables: `insta-data` holds connected Instagram accounts (with their
// encrypted tokens), DM threads and messages, enquiries, media, snapshots and
// keyword rules; `insta-audit` holds the audit trail under a TTL.
//
// Tenancy rule, enforced here rather than trusted at the route: every function
// that reads or writes agency data takes tenantId as its first argument and
// builds `pk` from it. No function accepts a caller-supplied pk.
//
// The one exception is the REGISTRY partitions. A webhook from Meta arrives
// with an Instagram account id and no tenant, and the scheduled worker has to
// find every connected account across tenants. The registry rows hold nothing
// but {tenantId, igUserId} pointers, and they are the only cross-tenant reads.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../config/env.js';
import { logger } from '../logger.js';
import { createLocalDocClient } from './localDynamo.js';
import { classifyWindow } from './windowPolicy.js';

const log = logger.child({ module: 'dynamoService' });

// DynamoDB's hard ceiling for BatchWriteItem.
const BATCH_LIMIT = 25;

let docClient = null;

/**
 * Lazy: constructing the client at import time would make the unit tests need
 * AWS credentials just to import a key builder.
 */
export function getDocClient() {
  if (!docClient) {
    const cfg = getConfig();
    if (cfg.store === 'memory') {
      docClient = createLocalDocClient({ file: cfg.memoryStoreFile });
      log.warn('dynamo.using_local_memory_store', { persisted: Boolean(cfg.memoryStoreFile) });
    } else {
      const base = new DynamoDBClient({
        region: cfg.region,
        ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
      });
      docClient = DynamoDBDocumentClient.from(base, {
        marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: true },
      });
    }
  }
  return docClient;
}

/** Test seam — lets the suite inject a fresh client per test. */
export function __setDocClient(client) {
  docClient = client;
}

function dataTable() {
  const cfg = getConfig();
  if (cfg.dataTable) return cfg.dataTable;
  if (cfg.store === 'memory') return 'local-realestateflow-insta-data';
  throw new Error('INSTA_DATA_TABLE_NAME is not set');
}

function auditTable() {
  const cfg = getConfig();
  if (cfg.auditTable) return cfg.auditTable;
  if (cfg.store === 'memory') return 'local-realestateflow-insta-audit';
  throw new Error('INSTA_AUDIT_TABLE_NAME is not set');
}

function requireTenant(tenantId) {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenantId is required for every DynamoDB access');
  }
  return tenantId;
}

// ---------------------------------------------------------------------------
// Key construction — pure, exported, and unit-tested.
// ---------------------------------------------------------------------------

export const keys = {
  tenantPk: (tenantId) => `TENANT#${requireTenant(tenantId)}`,

  account: (igUserId) => `IGACCOUNT#${igUserId}`,
  accountPrefix: () => 'IGACCOUNT#',
  accountSnapshot: (igUserId, dateKey) => `SNAP#ACCOUNT#${igUserId}#${dateKey}`,
  accountSnapshotPrefix: (igUserId) => `SNAP#ACCOUNT#${igUserId}#`,
  media: (mediaId) => `MEDIA#${mediaId}`,
  mediaPrefix: () => 'MEDIA#',
  mediaSnapshot: (mediaId, dateKey) => `SNAP#MEDIA#${mediaId}#${dateKey}`,
  mediaSnapshotPrefix: (mediaId) => `SNAP#MEDIA#${mediaId}#`,
  enquiry: (enquiryId) => `ENQ#${enquiryId}`,
  enquiryPrefix: () => 'ENQ#',
  thread: (threadId) => `THREAD#${threadId}`,
  threadPrefix: () => 'THREAD#',
  // The trailing '#' stops thread "a_1" leaking into thread "a_10".
  message: (threadId, messageId) => `MSG#${threadId}#${messageId}`,
  messagePrefix: (threadId) => `MSG#${threadId}#`,
  comment: (commentId) => `COMMENT#${commentId}`,
  commentPrefix: () => 'COMMENT#',
  rule: (ruleId) => `RULE#${ruleId}`,
  rulePrefix: () => 'RULE#',

  // GSI1 — newest-first enquiry listing without a partition scan.
  gsiEnquiryPk: (tenantId) => `TENANT#${requireTenant(tenantId)}#ENQ`,
  gsiEnquirySk: (createdAt, enquiryId) => `${createdAt}#${enquiryId}`,

  // Registry — pointer rows only, see the header comment.
  registryAccountsPk: () => 'REGISTRY#IGACCOUNTS',
  registryAccount: (tenantId, igUserId) => `ACCT#${requireTenant(tenantId)}#${igUserId}`,
  registryIdsPk: () => 'REGISTRY#IGIDS',
  registryId: (anyIgId) => `IGID#${anyIgId}`,
  registryDeletionsPk: () => 'REGISTRY#DELETIONS',
  deletion: (code) => `DEL#${code}`,

  // Audit table.
  auditEvent: (isoTs, id) => `EVT#${isoTs}#${id}`,
};

// ---------------------------------------------------------------------------
// Cursor encoding for paginated dashboard reads.
// ---------------------------------------------------------------------------

export function encodeCursor(lastEvaluatedKey) {
  if (!lastEvaluatedKey) return null;
  return Buffer.from(JSON.stringify(lastEvaluatedKey), 'utf8').toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    // A malformed cursor restarts the page rather than 500s — the dashboard
    // can send back a stale one after a redeploy.
    return undefined;
  }
}

/** Chunk an array into DynamoDB-sized batches. Exported for the tests. */
export function chunk(items, size = BATCH_LIMIT) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Generic primitives
// ---------------------------------------------------------------------------

async function put(tableName, item) {
  await getDocClient().send(new PutCommand({ TableName: tableName, Item: item }));
  return item;
}

async function getItem(tableName, pk, sk) {
  const res = await getDocClient().send(new GetCommand({ TableName: tableName, Key: { pk, sk } }));
  return res.Item || null;
}

/**
 * BatchWrite in chunks of 25, retrying whatever DynamoDB hands back as
 * UnprocessedItems. Without the retry a throttled partition silently drops
 * rows and the dashboard shows a hole.
 */
async function batchWrite(tableName, requests) {
  if (!requests.length) return 0;
  let written = 0;

  for (const group of chunk(requests)) {
    let pending = group;
    for (let attempt = 0; attempt < 4 && pending.length; attempt += 1) {
      const res = await getDocClient().send(new BatchWriteCommand({ RequestItems: { [tableName]: pending } }));
      const unprocessed = res.UnprocessedItems?.[tableName] || [];
      written += pending.length - unprocessed.length;
      pending = unprocessed;
      if (pending.length) await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
    }
    if (pending.length) log.warn('dynamo.batchWrite.unprocessed', { tableName, dropped: pending.length });
  }
  return written;
}

const batchPut = (tableName, items) => batchWrite(tableName, items.map((Item) => ({ PutRequest: { Item } })));

async function queryAll(params, { limit } = {}) {
  const items = [];
  let ExclusiveStartKey = params.ExclusiveStartKey;
  do {
    const res = await getDocClient().send(new QueryCommand({ ...params, ExclusiveStartKey }));
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
    if (limit && items.length >= limit) return items.slice(0, limit);
  } while (ExclusiveStartKey);
  return items;
}

function queryPrefix(pk, prefix, opts) {
  return queryAll(
    {
      TableName: dataTable(),
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': pk, ':prefix': prefix },
    },
    opts
  );
}

const IMMUTABLE_FIELDS = new Set(['pk', 'sk', 'tenantId', 'type', 'gsi1pk', 'gsi1sk']);

/**
 * SET every provided field, bump updatedAt. The item must already exist, so a
 * typo'd id cannot create a ghost record. Returns the updated item, or null
 * when it does not exist.
 */
async function updateFields(tableName, key, fields) {
  const sets = ['#updatedAt = :updatedAt'];
  const names = { '#updatedAt': 'updatedAt' };
  const values = { ':updatedAt': new Date().toISOString() };

  Object.entries(fields).forEach(([field, value], index) => {
    if (value === undefined || IMMUTABLE_FIELDS.has(field) || field === 'updatedAt') return;
    sets.push(`#f${index} = :v${index}`);
    names[`#f${index}`] = field;
    values[`:v${index}`] = value;
  });

  try {
    const res = await getDocClient().send(
      new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: `SET ${sets.join(', ')}`,
        ConditionExpression: 'attribute_exists(pk)',
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      })
    );
    return res.Attributes || null;
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Instagram accounts + registry
// ---------------------------------------------------------------------------

export async function putAccount(tenantId, account) {
  const now = new Date().toISOString();
  const item = {
    ...account,
    pk: keys.tenantPk(tenantId),
    sk: keys.account(account.igUserId),
    type: 'IG_ACCOUNT',
    tenantId,
    createdAt: account.createdAt || now,
    updatedAt: now,
  };
  return put(dataTable(), item);
}

export function getAccount(tenantId, igUserId) {
  return getItem(dataTable(), keys.tenantPk(tenantId), keys.account(igUserId));
}

export function listAccounts(tenantId) {
  return queryPrefix(keys.tenantPk(tenantId), keys.accountPrefix());
}

export function updateAccount(tenantId, igUserId, fields) {
  return updateFields(dataTable(), { pk: keys.tenantPk(tenantId), sk: keys.account(igUserId) }, fields);
}

/**
 * Pointer rows: one per account for the worker's cross-tenant listing, and one
 * per Instagram id (professional account id and app-scoped id can differ) for
 * webhook routing.
 */
export async function registerAccount(tenantId, igUserId, ids = []) {
  const now = new Date().toISOString();
  const rows = [
    { pk: keys.registryAccountsPk(), sk: keys.registryAccount(tenantId, igUserId), type: 'REGISTRY', tenantId, igUserId, updatedAt: now },
    ...[...new Set([igUserId, ...ids].filter(Boolean).map(String))].map((id) => ({
      pk: keys.registryIdsPk(),
      sk: keys.registryId(id),
      type: 'REGISTRY',
      tenantId,
      igUserId,
      updatedAt: now,
    })),
  ];
  await batchPut(dataTable(), rows);
  return rows.length;
}

/** @returns {Promise<{tenantId: string, igUserId: string}|null>} */
export async function findAccountRefByIgId(anyIgId) {
  if (!anyIgId) return null;
  const row = await getItem(dataTable(), keys.registryIdsPk(), keys.registryId(String(anyIgId)));
  return row ? { tenantId: row.tenantId, igUserId: row.igUserId } : null;
}

export async function listRegisteredAccounts() {
  const rows = await queryAll({
    TableName: dataTable(),
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': keys.registryAccountsPk() },
  });
  return rows.map((r) => ({ tenantId: r.tenantId, igUserId: r.igUserId }));
}

export async function unregisterAccount(tenantId, igUserId, ids = []) {
  const client = getDocClient();
  await client.send(
    new DeleteCommand({ TableName: dataTable(), Key: { pk: keys.registryAccountsPk(), sk: keys.registryAccount(tenantId, igUserId) } })
  );
  for (const id of new Set([igUserId, ...ids].filter(Boolean).map(String))) {
    try {
      // Only remove a pointer this tenant owns: another workspace may have
      // connected the same account since.
      await client.send(
        new DeleteCommand({
          TableName: dataTable(),
          Key: { pk: keys.registryIdsPk(), sk: keys.registryId(id) },
          ConditionExpression: 'attribute_not_exists(pk) OR tenantId = :tenantId',
          ExpressionAttributeValues: { ':tenantId': tenantId },
        })
      );
    } catch (err) {
      if (err?.name !== 'ConditionalCheckFailedException') throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Threads + messages
// ---------------------------------------------------------------------------

export async function putThread(tenantId, thread) {
  const now = new Date().toISOString();
  const item = {
    ...thread,
    pk: keys.tenantPk(tenantId),
    sk: keys.thread(thread.threadId),
    type: 'THREAD',
    tenantId,
    firstSeenAt: thread.firstSeenAt || now,
    updatedAt: now,
  };
  // windowState is derived on read; a stored copy would go stale within a day.
  delete item.windowState;
  delete item.windowExpiresAt;
  return put(dataTable(), item);
}

export function getThread(tenantId, threadId) {
  return getItem(dataTable(), keys.tenantPk(tenantId), keys.thread(threadId));
}

export function updateThread(tenantId, threadId, fields) {
  return updateFields(dataTable(), { pk: keys.tenantPk(tenantId), sk: keys.thread(threadId) }, fields);
}

/** Adds the live Meta messaging window to a stored thread. */
export function withWindow(thread, at = Date.now()) {
  if (!thread) return thread;
  const w = classifyWindow(thread, at);
  return { ...thread, windowState: w.state, windowExpiresAt: w.expiresAt };
}

export async function listThreads(tenantId, { windowState, unanswered, igUserId, limit } = {}) {
  const items = await queryPrefix(keys.tenantPk(tenantId), keys.threadPrefix());
  const now = Date.now();

  // Filtering in memory rather than with a FilterExpression: thread counts per
  // tenant are in the hundreds, and the window state is not stored anyway.
  let out = items.map((t) => withWindow(t, now));
  if (igUserId) out = out.filter((t) => t.igUserId === igUserId);
  if (windowState) out = out.filter((t) => t.windowState === windowState);
  if (unanswered !== undefined) out = out.filter((t) => !!t.unanswered === !!unanswered);
  return limit ? out.slice(0, limit) : out;
}

/**
 * Stores messages that are not already stored. Idempotent on messageId, so a
 * webhook delivery, a poll and our own send can all report the same message.
 *
 * @returns {Promise<object[]>} only the rows that were new
 */
export async function putMessagesIfAbsent(tenantId, messages) {
  const pk = keys.tenantPk(tenantId);
  const inserted = [];
  for (const m of messages) {
    const item = {
      ...m,
      pk,
      sk: keys.message(m.threadId, m.messageId),
      type: 'MESSAGE',
      tenantId,
      storedAt: new Date().toISOString(),
    };
    try {
      await getDocClient().send(
        new PutCommand({ TableName: dataTable(), Item: item, ConditionExpression: 'attribute_not_exists(pk)' })
      );
      inserted.push(item);
    } catch (err) {
      if (err?.name !== 'ConditionalCheckFailedException') throw err;
    }
  }
  return inserted;
}

export async function listMessages(tenantId, threadId) {
  const items = await queryPrefix(keys.tenantPk(tenantId), keys.messagePrefix(threadId));
  return items.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

// ---------------------------------------------------------------------------
// Comments (keyword-rule bookkeeping)
// ---------------------------------------------------------------------------

/** First writer wins: the same comment arriving by webhook and by poll is acted on once. */
export async function claimComment(tenantId, comment) {
  const item = {
    ...comment,
    pk: keys.tenantPk(tenantId),
    sk: keys.comment(comment.commentId),
    type: 'COMMENT',
    tenantId,
    claimedAt: new Date().toISOString(),
  };
  try {
    await getDocClient().send(
      new PutCommand({ TableName: dataTable(), Item: item, ConditionExpression: 'attribute_not_exists(pk)' })
    );
    return true;
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

export function updateComment(tenantId, commentId, fields) {
  return updateFields(dataTable(), { pk: keys.tenantPk(tenantId), sk: keys.comment(commentId) }, fields);
}

export function getComment(tenantId, commentId) {
  return getItem(dataTable(), keys.tenantPk(tenantId), keys.comment(commentId));
}

export function listComments(tenantId, { limit } = {}) {
  return queryPrefix(keys.tenantPk(tenantId), keys.commentPrefix(), { limit });
}

// ---------------------------------------------------------------------------
// Snapshots (account + media) and media
// ---------------------------------------------------------------------------

export async function putAccountSnapshots(tenantId, snapshots) {
  const pk = keys.tenantPk(tenantId);
  const items = snapshots.map((s) => ({
    pk,
    sk: keys.accountSnapshot(s.igUserId, s.date),
    type: 'SNAP_ACCOUNT',
    tenantId,
    igUserId: s.igUserId,
    date: s.date,
    followersCount: s.followersCount ?? null,
    followsCount: s.followsCount ?? null,
    mediaCount: s.mediaCount ?? null,
    reach: s.reach ?? null,
    views: s.views ?? null,
    accountsEngaged: s.accountsEngaged ?? null,
    totalInteractions: s.totalInteractions ?? null,
    profileLinksTaps: s.profileLinksTaps ?? null,
    updatedAt: new Date().toISOString(),
  }));
  return batchPut(dataTable(), items);
}

export async function listAccountSnapshots(tenantId, igUserId, { fromDate, toDate } = {}) {
  if (!fromDate) return queryPrefix(keys.tenantPk(tenantId), keys.accountSnapshotPrefix(igUserId));
  // Dates are lexicographically ordered by construction (YYYY-MM-DD), so a
  // string BETWEEN on the sort key is a real range query, not a filter.
  return queryAll({
    TableName: dataTable(),
    KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':pk': keys.tenantPk(tenantId),
      ':from': keys.accountSnapshot(igUserId, fromDate),
      ':to': keys.accountSnapshot(igUserId, toDate || '9999-12-31'),
    },
  });
}

export async function putMediaItems(tenantId, mediaItems) {
  const pk = keys.tenantPk(tenantId);
  const items = mediaItems.map((m) => ({
    pk,
    sk: keys.media(m.mediaId),
    type: 'MEDIA',
    tenantId,
    mediaId: m.mediaId,
    igUserId: m.igUserId ?? null,
    caption: m.caption ?? null,
    permalink: m.permalink ?? null,
    mediaType: m.mediaType ?? null,
    mediaProductType: m.mediaProductType ?? null,
    publishedAt: m.publishedAt ?? null,
    thumbnailUrl: m.thumbnailUrl ?? null,
    metrics: m.metrics ?? {},
    commentCount: m.commentCount ?? 0,
    metricsUpdatedAt: m.metricsUpdatedAt ?? null,
    updatedAt: new Date().toISOString(),
  }));
  return batchPut(dataTable(), items);
}

export function listMedia(tenantId, { limit } = {}) {
  return queryPrefix(keys.tenantPk(tenantId), keys.mediaPrefix(), { limit });
}

export function getMedia(tenantId, mediaId) {
  return getItem(dataTable(), keys.tenantPk(tenantId), keys.media(mediaId));
}

export async function putMediaSnapshots(tenantId, snapshots) {
  const pk = keys.tenantPk(tenantId);
  const items = snapshots.map((s) => ({
    pk,
    sk: keys.mediaSnapshot(s.mediaId, s.date),
    type: 'SNAP_MEDIA',
    tenantId,
    mediaId: s.mediaId,
    igUserId: s.igUserId ?? null,
    date: s.date,
    views: s.views ?? null,
    reach: s.reach ?? null,
    likes: s.likes ?? null,
    comments: s.comments ?? null,
    saved: s.saved ?? null,
    shares: s.shares ?? null,
    totalInteractions: s.totalInteractions ?? null,
    updatedAt: new Date().toISOString(),
  }));
  return batchPut(dataTable(), items);
}

export function listMediaSnapshots(tenantId, mediaId, { limit } = {}) {
  return queryPrefix(keys.tenantPk(tenantId), keys.mediaSnapshotPrefix(mediaId), { limit });
}

// ---------------------------------------------------------------------------
// Enquiries
// ---------------------------------------------------------------------------

export async function putEnquiry(tenantId, enquiry) {
  const now = new Date().toISOString();
  const createdAt = enquiry.createdAt || now;
  const item = {
    ...enquiry,
    pk: keys.tenantPk(tenantId),
    sk: keys.enquiry(enquiry.enquiryId),
    // GSI1 gives the dashboard a createdAt-ordered listing without a scan.
    gsi1pk: keys.gsiEnquiryPk(tenantId),
    gsi1sk: keys.gsiEnquirySk(createdAt, enquiry.enquiryId),
    type: 'ENQUIRY',
    tenantId,
    status: enquiry.status || 'new',
    createdAt,
    updatedAt: now,
  };
  return put(dataTable(), item);
}

export async function listEnquiries(tenantId, { status, temperature, limit = 50, cursor } = {}) {
  const values = { ':pk': keys.gsiEnquiryPk(tenantId) };
  const filters = [];
  const names = {};

  if (status) {
    filters.push('#status = :status');
    names['#status'] = 'status';
    values[':status'] = status;
  }
  if (temperature) {
    filters.push('#temperature = :temperature');
    names['#temperature'] = 'temperature';
    values[':temperature'] = temperature;
  }

  const res = await getDocClient().send(
    new QueryCommand({
      TableName: dataTable(),
      IndexName: 'gsi1-index',
      KeyConditionExpression: 'gsi1pk = :pk',
      ...(filters.length && { FilterExpression: filters.join(' AND ') }),
      ...(Object.keys(names).length && { ExpressionAttributeNames: names }),
      ExpressionAttributeValues: values,
      // Newest first — the dashboard's default view is "what came in today".
      ScanIndexForward: false,
      Limit: Math.min(Number(limit) || 50, 200),
      ExclusiveStartKey: decodeCursor(cursor),
    })
  );

  return { items: res.Items || [], cursor: encodeCursor(res.LastEvaluatedKey) };
}

export function getEnquiry(tenantId, enquiryId) {
  return getItem(dataTable(), keys.tenantPk(tenantId), keys.enquiry(enquiryId));
}

const ENQUIRY_PATCHABLE = ['status', 'notes', 'crmSync'];

export function updateEnquiry(tenantId, enquiryId, patch) {
  const fields = Object.fromEntries(ENQUIRY_PATCHABLE.filter((k) => patch[k] !== undefined).map((k) => [k, patch[k]]));
  return updateFields(dataTable(), { pk: keys.tenantPk(tenantId), sk: keys.enquiry(enquiryId) }, fields);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export function listRules(tenantId) {
  return queryPrefix(keys.tenantPk(tenantId), keys.rulePrefix());
}

export async function putRule(tenantId, rule) {
  const now = new Date().toISOString();
  const item = {
    pk: keys.tenantPk(tenantId),
    sk: keys.rule(rule.ruleId),
    type: 'RULE',
    tenantId,
    ruleId: rule.ruleId,
    keyword: rule.keyword,
    matchType: rule.matchType || 'contains',
    publicReply: rule.publicReply || null,
    dmMessage: rule.dmMessage || null,
    mediaScope: rule.mediaScope || 'all',
    enabled: rule.enabled !== false,
    createdAt: rule.createdAt || now,
    updatedAt: now,
  };
  return put(dataTable(), item);
}

export async function getRule(tenantId, ruleId) {
  return getItem(dataTable(), keys.tenantPk(tenantId), keys.rule(ruleId));
}

export async function deleteRule(tenantId, ruleId) {
  await getDocClient().send(
    new DeleteCommand({ TableName: dataTable(), Key: { pk: keys.tenantPk(tenantId), sk: keys.rule(ruleId) } })
  );
  return true;
}

// ---------------------------------------------------------------------------
// Meta data deletion
// ---------------------------------------------------------------------------

const ACCOUNT_OWNED_TYPES = new Set(['IG_ACCOUNT', 'THREAD', 'MESSAGE', 'ENQUIRY', 'MEDIA', 'SNAP_MEDIA', 'SNAP_ACCOUNT', 'COMMENT']);

/**
 * Deletes everything this service holds for one Instagram account in one
 * tenant. Leads already created in the CRM are not touched - they belong to
 * the agency's CRM, not to this service.
 */
export async function deleteAccountData(tenantId, igUserId) {
  const items = await queryAll({
    TableName: dataTable(),
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': keys.tenantPk(tenantId) },
  });
  const doomed = items.filter((item) => ACCOUNT_OWNED_TYPES.has(item.type) && String(item.igUserId) === String(igUserId));
  return batchWrite(
    dataTable(),
    doomed.map((item) => ({ DeleteRequest: { Key: { pk: item.pk, sk: item.sk } } }))
  );
}

export async function putDeletionRequest(code, record) {
  return put(dataTable(), {
    ...record,
    pk: keys.registryDeletionsPk(),
    sk: keys.deletion(code),
    type: 'DELETION_REQUEST',
    code,
    createdAt: new Date().toISOString(),
  });
}

export function getDeletionRequest(code) {
  return getItem(dataTable(), keys.registryDeletionsPk(), keys.deletion(code));
}

// ---------------------------------------------------------------------------
// Audit table
// ---------------------------------------------------------------------------

export async function putAuditEvent(tenantId, event) {
  const now = new Date();
  const item = {
    pk: keys.tenantPk(tenantId),
    sk: keys.auditEvent(now.toISOString(), uuidv4()),
    type: 'EVENT',
    tenantId,
    ...event,
    ts: now.toISOString(),
    expiresAt: Math.floor(now.getTime() / 1000) + getConfig().auditTtlDays * 86400,
  };
  return put(auditTable(), item);
}

export default {
  keys,
  chunk,
  encodeCursor,
  decodeCursor,
  getDocClient,
  __setDocClient,
  putAccount,
  getAccount,
  listAccounts,
  updateAccount,
  registerAccount,
  findAccountRefByIgId,
  listRegisteredAccounts,
  unregisterAccount,
  putThread,
  getThread,
  updateThread,
  withWindow,
  listThreads,
  putMessagesIfAbsent,
  listMessages,
  claimComment,
  updateComment,
  getComment,
  listComments,
  putAccountSnapshots,
  listAccountSnapshots,
  putMediaItems,
  listMedia,
  getMedia,
  putMediaSnapshots,
  listMediaSnapshots,
  putEnquiry,
  listEnquiries,
  getEnquiry,
  updateEnquiry,
  listRules,
  putRule,
  getRule,
  deleteRule,
  deleteAccountData,
  putDeletionRequest,
  getDeletionRequest,
  putAuditEvent,
};
