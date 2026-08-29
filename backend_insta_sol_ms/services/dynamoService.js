// The only module in this service that talks to DynamoDB.
//
// Two tables, contract section 3: `insta-data` holds the durable projection of
// what the laptop agent collected, `insta-audit` holds the API trail and the
// HMAC replay nonces under a TTL.
//
// Tenancy rule, enforced here rather than trusted at the route: every function
// below takes tenantId as its first argument and builds `pk` from it. No
// function accepts a caller-supplied pk, and nothing scans across tenants
// except the two GSI1 lookups that structurally cannot be tenant-scoped
// (device-by-id and pairing-code-by-code — the caller has not been identified
// yet at that point, which is precisely what those lookups establish).

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

const log = logger.child({ module: 'dynamoService' });

// DynamoDB's hard ceiling for BatchWriteItem. Agent uploads arrive in batches
// of up to 500, so every write path chunks.
const BATCH_LIMIT = 25;

let docClient = null;

/**
 * Lazy: constructing the client at import time would make the unit tests need
 * AWS credentials just to import a key builder.
 */
export function getDocClient() {
  if (!docClient) {
    const base = new DynamoDBClient({ region: getConfig().region });
    docClient = DynamoDBDocumentClient.from(base, {
      marshallOptions: { removeUndefinedValues: true, convertClassInstanceToMap: true },
    });
  }
  return docClient;
}

/** Test seam — lets the integration-shaped tests inject a fake client. */
export function __setDocClient(client) {
  docClient = client;
}

function dataTable() {
  const t = getConfig().dataTable;
  if (!t) throw new Error('INSTA_DATA_TABLE_NAME is not set');
  return t;
}

function auditTable() {
  const t = getConfig().auditTable;
  if (!t) throw new Error('INSTA_AUDIT_TABLE_NAME is not set');
  return t;
}

function requireTenant(tenantId) {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('tenantId is required for every DynamoDB access');
  }
  return tenantId;
}

// ---------------------------------------------------------------------------
// Key construction — pure, exported, and unit-tested. Every sort key in the
// contract is built here so a typo shows up in one place rather than nine.
// ---------------------------------------------------------------------------

export const keys = {
  tenantPk: (tenantId) => `TENANT#${requireTenant(tenantId)}`,

  device: (deviceId) => `DEVICE#${deviceId}`,
  pairingCode: (code) => `PAIRCODE#${String(code).toUpperCase()}`,
  accountSnapshot: (igUserId, dateKey) => `SNAP#ACCOUNT#${igUserId}#${dateKey}`,
  accountSnapshotPrefix: (igUserId) => `SNAP#ACCOUNT#${igUserId}#`,
  media: (mediaId) => `MEDIA#${mediaId}`,
  mediaPrefix: () => 'MEDIA#',
  mediaSnapshot: (mediaId, dateKey) => `SNAP#MEDIA#${mediaId}#${dateKey}`,
  mediaSnapshotPrefix: (mediaId) => `SNAP#MEDIA#${mediaId}#`,
  enquiry: (enquiryId) => `ENQ#${enquiryId}`,
  enquiryPrefix: () => 'ENQ#',
  thread: (conversationId) => `THREAD#${conversationId}`,
  threadPrefix: () => 'THREAD#',
  rule: (ruleId) => `RULE#${ruleId}`,
  rulePrefix: () => 'RULE#',

  // GSI1 — sparse, only on the items that need a non-tenant-scoped lookup or a
  // time-ordered listing.
  gsiDevice: (deviceId) => `DEVICE#${deviceId}`,
  gsiPairingCode: (code) => `PAIRCODE#${String(code).toUpperCase()}`,
  gsiEnquiryPk: (tenantId) => `TENANT#${requireTenant(tenantId)}#ENQ`,
  gsiEnquirySk: (createdAt, enquiryId) => `${createdAt}#${enquiryId}`,

  // Audit table.
  auditEvent: (isoTs, id) => `EVT#${isoTs}#${id}`,
  nonce: (deviceId, nonce) => `NONCE#${deviceId}#${nonce}`,
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
  const res = await getDocClient().send(
    new GetCommand({ TableName: tableName, Key: { pk, sk } })
  );
  return res.Item || null;
}

/**
 * BatchWrite in chunks of 25, retrying whatever DynamoDB hands back as
 * UnprocessedItems. Without the retry a throttled partition silently drops
 * rows from a snapshot upload and the dashboard shows a hole in the series.
 */
async function batchPut(tableName, items) {
  if (!items.length) return 0;
  let written = 0;

  for (const group of chunk(items)) {
    let requests = group.map((Item) => ({ PutRequest: { Item } }));

    for (let attempt = 0; attempt < 4 && requests.length; attempt += 1) {
      const res = await getDocClient().send(
        new BatchWriteCommand({ RequestItems: { [tableName]: requests } })
      );
      const unprocessed = res.UnprocessedItems?.[tableName] || [];
      written += requests.length - unprocessed.length;
      requests = unprocessed;
      if (requests.length) {
        await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
      }
    }

    if (requests.length) {
      log.warn('dynamo.batchPut.unprocessed', { tableName, dropped: requests.length });
    }
  }

  return written;
}

async function queryAll(params, { limit } = {}) {
  const items = [];
  let ExclusiveStartKey = params.ExclusiveStartKey;

  do {
    const res = await getDocClient().send(
      new QueryCommand({ ...params, ExclusiveStartKey })
    );
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
    if (limit && items.length >= limit) return items.slice(0, limit);
  } while (ExclusiveStartKey);

  return items;
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export async function createDevice(tenantId, device) {
  const pk = keys.tenantPk(tenantId);
  const now = new Date().toISOString();
  const item = {
    pk,
    sk: keys.device(device.deviceId),
    gsi1pk: keys.gsiDevice(device.deviceId),
    gsi1sk: pk,
    type: 'DEVICE',
    tenantId,
    deviceId: device.deviceId,
    deviceName: device.deviceName || 'unnamed-laptop',
    deviceSecret: device.deviceSecret,
    platform: device.platform || 'unknown',
    agentVersion: device.agentVersion || null,
    status: 'active',
    igUserId: device.igUserId || null,
    igUsername: device.igUsername || null,
    tokenExpiresAt: device.tokenExpiresAt || null,
    lastSeenAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return put(dataTable(), item);
}

export async function getDevice(tenantId, deviceId) {
  return getItem(dataTable(), keys.tenantPk(tenantId), keys.device(deviceId));
}

/**
 * Device lookup by id alone, via GSI1. Used by deviceAuth before the tenant is
 * known — the device record is what establishes it. Everything the middleware
 * does afterwards is scoped by the tenantId found here.
 */
export async function getDeviceById(deviceId) {
  const items = await queryAll({
    TableName: dataTable(),
    IndexName: 'gsi1-index',
    KeyConditionExpression: 'gsi1pk = :pk',
    ExpressionAttributeValues: { ':pk': keys.gsiDevice(deviceId) },
  }, { limit: 1 });
  return items[0] || null;
}

export async function listDevices(tenantId) {
  return queryAll({
    TableName: dataTable(),
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: {
      ':pk': keys.tenantPk(tenantId),
      ':sk': 'DEVICE#',
    },
  });
}

export async function updateDevice(tenantId, deviceId, fields) {
  const allowed = [
    'deviceName',
    'status',
    'igUserId',
    'igUsername',
    'agentVersion',
    'lastSeenAt',
    'tokenExpiresAt',
    'revokedAt',
    'counters',
  ];
  const sets = ['#updatedAt = :updatedAt'];
  const names = { '#updatedAt': 'updatedAt' };
  const values = { ':updatedAt': new Date().toISOString() };

  for (const key of allowed) {
    if (fields[key] === undefined) continue;
    sets.push(`#${key} = :${key}`);
    names[`#${key}`] = key;
    values[`:${key}`] = fields[key];
  }

  const res = await getDocClient().send(
    new UpdateCommand({
      TableName: dataTable(),
      Key: { pk: keys.tenantPk(tenantId), sk: keys.device(deviceId) },
      UpdateExpression: `SET ${sets.join(', ')}`,
      // Guards against an update resurrecting a device that was deleted, and
      // against a typo'd deviceId silently creating a ghost record.
      ConditionExpression: 'attribute_exists(pk)',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    })
  );
  return res.Attributes || null;
}

export async function revokeDevice(tenantId, deviceId) {
  const now = new Date().toISOString();
  return updateDevice(tenantId, deviceId, { status: 'revoked', revokedAt: now });
}

// ---------------------------------------------------------------------------
// Pairing codes
// ---------------------------------------------------------------------------

export async function createPairingCode(tenantId, { code, ttlMinutes, createdBy }) {
  const pk = keys.tenantPk(tenantId);
  const expiresAtMs = Date.now() + ttlMinutes * 60 * 1000;
  const item = {
    pk,
    sk: keys.pairingCode(code),
    gsi1pk: keys.gsiPairingCode(code),
    gsi1sk: pk,
    type: 'PAIRCODE',
    tenantId,
    code: String(code).toUpperCase(),
    // Epoch seconds: the table's TTL attribute. DynamoDB deletes lazily, so
    // every read still checks expiry itself rather than trusting the sweep.
    expiresAt: Math.floor(expiresAtMs / 1000),
    expiresAtIso: new Date(expiresAtMs).toISOString(),
    usedAt: null,
    createdBy: createdBy || null,
    createdAt: new Date().toISOString(),
  };
  await put(dataTable(), item);
  return item;
}

/** Pairing-code lookup by code alone, via GSI1 — the agent has no tenant yet. */
export async function getPairingCodeByCode(code) {
  const items = await queryAll({
    TableName: dataTable(),
    IndexName: 'gsi1-index',
    KeyConditionExpression: 'gsi1pk = :pk',
    ExpressionAttributeValues: { ':pk': keys.gsiPairingCode(code) },
  }, { limit: 1 });
  return items[0] || null;
}

/**
 * Single-use enforcement. The conditional update is the whole point: two
 * agents racing the same code must not both end up paired, so the loser gets
 * a ConditionalCheckFailedException and we return null.
 */
export async function consumePairingCode(tenantId, code) {
  try {
    const res = await getDocClient().send(
      new UpdateCommand({
        TableName: dataTable(),
        Key: { pk: keys.tenantPk(tenantId), sk: keys.pairingCode(code) },
        UpdateExpression: 'SET usedAt = :now',
        ConditionExpression: 'attribute_exists(pk) AND (attribute_not_exists(usedAt) OR usedAt = :null)',
        ExpressionAttributeValues: { ':now': new Date().toISOString(), ':null': null },
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
// Snapshots (account + media), media, enquiries, threads, rules
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
    demographics: s.demographics ?? null,
    updatedAt: new Date().toISOString(),
  }));
  return batchPut(dataTable(), items);
}

export async function listAccountSnapshots(tenantId, igUserId, { fromDate, toDate } = {}) {
  const values = {
    ':pk': keys.tenantPk(tenantId),
    ':prefix': keys.accountSnapshotPrefix(igUserId),
  };
  let cond = 'pk = :pk AND begins_with(sk, :prefix)';
  if (fromDate) {
    // Dates are lexicographically ordered by construction (YYYY-MM-DD), so a
    // string BETWEEN on the sort key is a real range query, not a filter.
    cond = 'pk = :pk AND sk BETWEEN :from AND :to';
    values[':from'] = keys.accountSnapshot(igUserId, fromDate);
    values[':to'] = keys.accountSnapshot(igUserId, toDate || '9999-12-31');
    delete values[':prefix'];
  }
  return queryAll({
    TableName: dataTable(),
    KeyConditionExpression: cond,
    ExpressionAttributeValues: values,
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
    dmCount: m.dmCount ?? 0,
    enquiryCount: m.enquiryCount ?? 0,
    updatedAt: new Date().toISOString(),
  }));
  return batchPut(dataTable(), items);
}

export async function listMedia(tenantId, { limit } = {}) {
  return queryAll({
    TableName: dataTable(),
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': keys.tenantPk(tenantId),
      ':prefix': keys.mediaPrefix(),
    },
  }, { limit });
}

export async function getMedia(tenantId, mediaId) {
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
    date: s.date,
    views: s.views ?? null,
    reach: s.reach ?? null,
    likes: s.likes ?? null,
    comments: s.comments ?? null,
    saved: s.saved ?? null,
    shares: s.shares ?? null,
    totalInteractions: s.totalInteractions ?? null,
    avgWatchTimeMs: s.avgWatchTimeMs ?? null,
    updatedAt: new Date().toISOString(),
  }));
  return batchPut(dataTable(), items);
}

export async function listMediaSnapshots(tenantId, mediaId, { limit } = {}) {
  return queryAll({
    TableName: dataTable(),
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': keys.tenantPk(tenantId),
      ':prefix': keys.mediaSnapshotPrefix(mediaId),
    },
  }, { limit });
}

export async function putEnquiries(tenantId, enquiries) {
  const pk = keys.tenantPk(tenantId);
  const now = new Date().toISOString();
  const items = enquiries.map((e) => {
    const createdAt = e.createdAt || now;
    return {
      pk,
      sk: keys.enquiry(e.enquiryId),
      // GSI1 gives the dashboard a createdAt-ordered listing without a scan.
      gsi1pk: keys.gsiEnquiryPk(tenantId),
      gsi1sk: keys.gsiEnquirySk(createdAt, e.enquiryId),
      type: 'ENQUIRY',
      tenantId,
      enquiryId: e.enquiryId,
      name: e.name ?? null,
      phone: e.phone ?? null,
      intent: e.intent,
      budgetBracket: e.budgetBracket,
      preferredArea: e.preferredArea ?? null,
      temperature: e.temperature,
      sourceMediaId: e.sourceMediaId ?? null,
      igSenderId: e.igSenderId ?? null,
      igUsername: e.igUsername ?? null,
      status: e.status || 'new',
      notes: e.notes ?? null,
      createdAt,
      updatedAt: now,
    };
  });
  return batchPut(dataTable(), items);
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

  return {
    items: res.Items || [],
    cursor: encodeCursor(res.LastEvaluatedKey),
  };
}

export async function getEnquiry(tenantId, enquiryId) {
  return getItem(dataTable(), keys.tenantPk(tenantId), keys.enquiry(enquiryId));
}

export async function updateEnquiry(tenantId, enquiryId, { status, notes }) {
  const sets = ['#updatedAt = :updatedAt'];
  const names = { '#updatedAt': 'updatedAt' };
  const values = { ':updatedAt': new Date().toISOString() };

  if (status !== undefined) {
    sets.push('#status = :status');
    names['#status'] = 'status';
    values[':status'] = status;
  }
  if (notes !== undefined) {
    sets.push('#notes = :notes');
    names['#notes'] = 'notes';
    values[':notes'] = notes;
  }

  try {
    const res = await getDocClient().send(
      new UpdateCommand({
        TableName: dataTable(),
        Key: { pk: keys.tenantPk(tenantId), sk: keys.enquiry(enquiryId) },
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

export async function putThreads(tenantId, threads) {
  const pk = keys.tenantPk(tenantId);
  const now = new Date().toISOString();
  const items = threads.map((t) => ({
    pk,
    sk: keys.thread(t.conversationId),
    type: 'THREAD',
    tenantId,
    conversationId: t.conversationId,
    participantId: t.participantId ?? null,
    participantUsername: t.participantUsername ?? null,
    messageCount: t.messageCount ?? 0,
    lastInboundAt: t.lastInboundAt ?? null,
    lastOutboundAt: t.lastOutboundAt ?? null,
    windowState: t.windowState,
    unanswered: !!t.unanswered,
    firstSeenAt: t.firstSeenAt ?? now,
    updatedAt: now,
  }));
  return batchPut(dataTable(), items);
}

export async function listThreads(tenantId, { windowState, unanswered, limit } = {}) {
  const items = await queryAll({
    TableName: dataTable(),
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': keys.tenantPk(tenantId),
      ':prefix': keys.threadPrefix(),
    },
  });

  // Filtering in memory rather than with a FilterExpression: thread counts per
  // tenant are in the hundreds, and a FilterExpression would still read every
  // row while making the page size unpredictable.
  let out = items;
  if (windowState) out = out.filter((t) => t.windowState === windowState);
  if (unanswered !== undefined) out = out.filter((t) => !!t.unanswered === !!unanswered);
  return limit ? out.slice(0, limit) : out;
}

export async function listRules(tenantId) {
  return queryAll({
    TableName: dataTable(),
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': keys.tenantPk(tenantId),
      ':prefix': keys.rulePrefix(),
    },
  });
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
    publicReply: rule.publicReply ?? null,
    dmMessage: rule.dmMessage ?? null,
    mediaScope: rule.mediaScope || 'all',
    enabled: rule.enabled !== false,
    createdAt: rule.createdAt || now,
    updatedAt: now,
  };
  return put(dataTable(), item);
}

export async function deleteRule(tenantId, ruleId) {
  await getDocClient().send(
    new DeleteCommand({
      TableName: dataTable(),
      Key: { pk: keys.tenantPk(tenantId), sk: keys.rule(ruleId) },
    })
  );
  return true;
}

// ---------------------------------------------------------------------------
// Audit table — events and HMAC replay nonces
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

/**
 * Claims a nonce for a device, returning false if it was already used.
 *
 * This is the replay defence and it has to be a conditional write, not a
 * read-then-write: two concurrent replays of the same signed request would
 * both pass a read check. TTL is short (minutes) because a nonce only has to
 * outlive the signature's own skew window.
 */
export async function claimNonce(tenantId, deviceId, nonce, ttlSeconds) {
  const item = {
    pk: keys.tenantPk(tenantId),
    sk: keys.nonce(deviceId, nonce),
    type: 'NONCE',
    tenantId,
    deviceId,
    ts: new Date().toISOString(),
    expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  try {
    await getDocClient().send(
      new PutCommand({
        TableName: auditTable(),
        Item: item,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      })
    );
    return true;
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}

export default {
  keys,
  chunk,
  encodeCursor,
  decodeCursor,
  getDocClient,
  __setDocClient,
  createDevice,
  getDevice,
  getDeviceById,
  listDevices,
  updateDevice,
  revokeDevice,
  createPairingCode,
  getPairingCodeByCode,
  consumePairingCode,
  putAccountSnapshots,
  listAccountSnapshots,
  putMediaItems,
  listMedia,
  getMedia,
  putMediaSnapshots,
  listMediaSnapshots,
  putEnquiries,
  listEnquiries,
  getEnquiry,
  updateEnquiry,
  putThreads,
  listThreads,
  listRules,
  putRule,
  deleteRule,
  putAuditEvent,
  claimNonce,
};
