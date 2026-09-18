/**
 * Consumer profiles, saved listings and saved searches.
 *
 * Everything a buyer owns hangs off one partition, `USER#<userId>`, so
 * "delete this user" is one Query and one batch of deletes, and "show me my
 * saved homes" never fans out. Sort-key prefixes separate the item kinds:
 *
 *   PROFILE                 the buyer's own record
 *   SAVED#<propertyId>      a bookmarked listing + display snapshot
 *   SEARCH#<searchId>       a saved query
 *   THREAD_FOR#<propertyId> pointer to the one thread for that listing
 *                           (written by threadsRepo, deleted here)
 *
 * ── identity comes from the token ──────────────────────────────────────────
 * The userId is the Cognito `sub`; the phone is the verified login identity.
 * Neither is ever taken from a request body. A profile is created lazily the
 * first time an authenticated buyer touches something that needs one, from
 * the JWT claims, so there is no separate "sign-up" write to get wrong.
 *
 * ── nothing raw leaves this module ─────────────────────────────────────────
 * Every export returns a serialised shape (`toUser`, `toSaved`, `toSearch`).
 * PK/SK and the GSI attributes never reach a route handler, let alone a
 * browser.
 */

import {
  GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { config } from '../config/env.js';
import { getDocClient } from './dynamo.js';
import { searchId as newSearchId } from './ids.js';
import { logger } from '../logger.js';

const table = () => config.tableName;
const userPk = (userId) => `USER#${userId}`;

// ── serialisers ────────────────────────────────────────────────────────────

export function toUser(item) {
  if (!item) return null;
  return {
    userId: item.userId,
    name: item.name || null,
    phone: item.phone || null,
    email: item.email || null,
    preferredCities: Array.isArray(item.preferredCities) ? item.preferredCities : [],
    createdAt: item.createdAt || null,
  };
}

export function toSaved(item) {
  return {
    propertyId: item.propertyId,
    tenantId: item.tenantId,
    agencySlug: item.agencySlug,
    savedAt: item.savedAt,
    snapshot: item.snapshot || null,
  };
}

export function toSearch(item) {
  return {
    searchId: item.searchId,
    query: item.query,
    city: item.city || null,
    filters: item.filters || {},
    createdAt: item.createdAt,
  };
}

/** The display snapshot stored on a saved item — enough to render a card after the listing is gone. */
export function listingSnapshot(listing) {
  return {
    title: listing.title || null,
    price: listing.pricing?.amount ?? null,
    mode: listing.pricing?.mode || null,
    locality: listing.locality || null,
    city: listing.city || null,
    imageCount: Number(listing.imageCount) || 0,
  };
}

// ── profile ────────────────────────────────────────────────────────────────

export async function getProfile(userId) {
  const result = await getDocClient().send(new GetCommand({
    TableName: table(),
    Key: { PK: userPk(userId), SK: 'PROFILE' },
  }));
  return toUser(result.Item);
}

/**
 * Fetch the profile, creating it from the token claims on first contact.
 *
 * The conditional put means two concurrent first requests (a SPA firing
 * /me and /me/saved together) produce one profile, not a race where the
 * second overwrites what the first wrote. A profile that predates the phone
 * claim (it can be missing on an access token) is backfilled from the token
 * without touching anything the buyer edited.
 */
export async function getOrCreateProfile(user) {
  const existing = await getProfile(user.userId);
  if (existing) {
    const fills = {};
    if (!existing.phone && user.phone) fills.phone = user.phone;
    if (!existing.email && user.email) fills.email = user.email;
    if (!existing.name && user.name) fills.name = user.name;
    if (Object.keys(fills).length === 0) return existing;
    return updateProfile(user.userId, fills);
  }

  const now = new Date().toISOString();
  const item = {
    PK: userPk(user.userId),
    SK: 'PROFILE',
    entity: 'Profile',
    userId: user.userId,
    name: user.name || null,
    phone: user.phone || null,
    email: user.email || null,
    preferredCities: [],
    createdAt: now,
    updatedAt: now,
  };
  try {
    await getDocClient().send(new PutCommand({
      TableName: table(),
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
    logger.info('users.profile_created', { userId: user.userId });
    return toUser(item);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return getProfile(user.userId);
    throw err;
  }
}

/** PUT /me — only the editable fields; phone is identity and never changes here. */
export async function updateProfile(userId, { name, email, preferredCities } = {}) {
  const sets = ['updatedAt = :now'];
  const values = { ':now': new Date().toISOString() };
  const names = {};
  if (name !== undefined) { sets.push('#name = :name'); names['#name'] = 'name'; values[':name'] = name; }
  if (email !== undefined) { sets.push('email = :email'); values[':email'] = email; }
  if (preferredCities !== undefined) { sets.push('preferredCities = :pc'); values[':pc'] = preferredCities; }

  const params = {
    TableName: table(),
    Key: { PK: userPk(userId), SK: 'PROFILE' },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeValues: values,
    ConditionExpression: 'attribute_exists(PK)',
    ReturnValues: 'ALL_NEW',
  };
  if (Object.keys(names).length) params.ExpressionAttributeNames = names;

  const result = await getDocClient().send(new UpdateCommand(params));
  return toUser(result.Attributes);
}

// ── saved listings ─────────────────────────────────────────────────────────

export async function listSaved(userId) {
  const result = await getDocClient().send(new QueryCommand({
    TableName: table(),
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': userPk(userId), ':prefix': 'SAVED#' },
    ScanIndexForward: false,
    Limit: 200,
  }));
  return (result.Items || [])
    .map(toSaved)
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export async function isSaved(userId, propertyId) {
  const result = await getDocClient().send(new GetCommand({
    TableName: table(),
    Key: { PK: userPk(userId), SK: `SAVED#${propertyId}` },
    ProjectionExpression: 'SK',
  }));
  return Boolean(result.Item);
}

/** Idempotent: saving twice refreshes the snapshot and keeps the first savedAt. */
export async function saveListing(userId, { propertyId, tenantId, agencySlug, snapshot }) {
  const now = new Date().toISOString();
  await getDocClient().send(new UpdateCommand({
    TableName: table(),
    Key: { PK: userPk(userId), SK: `SAVED#${propertyId}` },
    UpdateExpression: 'SET entity = :e, propertyId = :p, tenantId = :t, agencySlug = :s, snapshot = :snap, savedAt = if_not_exists(savedAt, :now)',
    ExpressionAttributeValues: {
      ':e': 'Saved', ':p': propertyId, ':t': tenantId, ':s': agencySlug, ':snap': snapshot, ':now': now,
    },
  }));
}

export async function unsaveListing(userId, propertyId) {
  await getDocClient().send(new DeleteCommand({
    TableName: table(),
    Key: { PK: userPk(userId), SK: `SAVED#${propertyId}` },
  }));
}

// ── saved searches ─────────────────────────────────────────────────────────

export async function listSearches(userId) {
  const result = await getDocClient().send(new QueryCommand({
    TableName: table(),
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: { ':pk': userPk(userId), ':prefix': 'SEARCH#' },
    ScanIndexForward: false,
    Limit: 100,
  }));
  return (result.Items || []).map(toSearch);
}

export async function createSearch(userId, { query, city, filters }) {
  const id = newSearchId();
  const item = {
    PK: userPk(userId),
    SK: `SEARCH#${id}`,
    entity: 'Search',
    searchId: id,
    query,
    city: city || null,
    filters: filters || {},
    createdAt: new Date().toISOString(),
  };
  await getDocClient().send(new PutCommand({ TableName: table(), Item: item }));
  return toSearch(item);
}

export async function deleteSearch(userId, searchId) {
  await getDocClient().send(new DeleteCommand({
    TableName: table(),
    Key: { PK: userPk(userId), SK: `SEARCH#${searchId}` },
  }));
}

// ── account deletion ───────────────────────────────────────────────────────

/**
 * Remove every item in the buyer's partition. Returns the thread ids found
 * in THREAD_FOR pointers so the caller can anonymise those threads — the
 * threads themselves live in their own partitions and are kept, because the
 * agency's side of the conversation is the agency's record.
 */
export async function deleteUserData(userId) {
  const client = getDocClient();
  const keys = [];
  const threadIds = [];
  let ExclusiveStartKey;

  do {
    // eslint-disable-next-line no-await-in-loop
    const page = await client.send(new QueryCommand({
      TableName: table(),
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': userPk(userId) },
      ProjectionExpression: 'PK, SK, threadId',
      ExclusiveStartKey,
    }));
    for (const item of page.Items || []) {
      keys.push({ PK: item.PK, SK: item.SK });
      if (item.SK.startsWith('THREAD_FOR#') && item.threadId) threadIds.push(item.threadId);
    }
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  // BatchWrite takes 25 at a time and may return unprocessed keys under
  // load; loop until every one is gone rather than trusting a single call.
  for (let i = 0; i < keys.length; i += 25) {
    let requests = keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } }));
    let attempts = 0;
    while (requests.length && attempts < 5) {
      // eslint-disable-next-line no-await-in-loop
      const out = await client.send(new BatchWriteCommand({ RequestItems: { [table()]: requests } }));
      requests = out.UnprocessedItems?.[table()] || [];
      attempts += 1;
    }
    if (requests.length) throw new Error('deleteUserData: unprocessed deletes remain');
  }

  logger.info('users.deleted', { userId, items: keys.length, threads: threadIds.length });
  return { deleted: keys.length, threadIds };
}
