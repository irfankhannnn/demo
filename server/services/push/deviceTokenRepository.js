/**
 * Device push-token registry for the Capacitor mobile builds.
 *
 * NotificationCenter.tsx polls /api/notifications every 60s. That works in a
 * browser tab but not on a phone: iOS and Android suspend JS timers for a
 * backgrounded app, so a broker with the phone in their pocket receives
 * nothing until they reopen the app. Delivering through FCM/APNs instead needs
 * somewhere to keep the per-device tokens, which is this table.
 *
 * Own table rather than the shared CRM table: tokens rotate on their own
 * schedule, carry a TTL, and are rewritten on every app launch, so keeping that
 * write volume off the CRM table's partitions is worth one small table.
 *
 * Single-table layout, tenant-prefixed like every other table here:
 *   PK     = TENANT#{tenantId}#DEVICES
 *   SK     = USER#{userId}#DEVICE#{token}
 *   GSI1PK = TOKEN#{token}                (token-index)
 *   GSI1SK = TENANT#{tenantId}#USER#{userId}
 *
 * PK holds the whole tenant so the send path can address either one user
 * (begins_with on SK) or every device in the agency (PK alone) without a Scan.
 * The GSI exists for one reason: a phone is a shared device. If user A never
 * logged out cleanly and user B signs in on the same handset, FCM hands us the
 * same token, and without evicting the old row we would keep pushing A's leads
 * to a device B is now holding. registerDeviceToken() resolves that.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '../../logger.js';
import { wrapAwsClient } from '../../awsClientWrapper.js';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const PUSH_TOKENS_TABLE = process.env.PUSH_TOKENS_TABLE || 'cloudberry-real-estate-push-tokens';
const TOKEN_INDEX = 'token-index';

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: PUSH_TOKENS_TABLE });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const PUSH_PLATFORMS = ['ios', 'android'];

/**
 * Google expires an FCM token after roughly 270 days without use. Expiring our
 * copy slightly sooner means the registry self-prunes for users who uninstall
 * without ever reaching the unregister endpoint, instead of accumulating rows
 * that can only ever fail.
 */
const TOKEN_TTL_DAYS = 240;

function devicePartition(tenantId) {
  return `TENANT#${tenantId}#DEVICES`;
}

function deviceSortKey(userId, token) {
  return `USER#${userId}#DEVICE#${token}`;
}

function ttlEpochSeconds(fromMs = Date.now()) {
  return Math.floor((fromMs + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000) / 1000);
}

function normalizeDevice(item) {
  return {
    tenantId: item.tenantId ?? null,
    userId: item.userId ?? null,
    token: item.token ?? null,
    platform: item.platform ?? null,
    deviceId: item.deviceId ?? null,
    createdAt: item.createdAt ?? null,
    lastSeenAt: item.lastSeenAt ?? null,
  };
}

/**
 * Register (or refresh) a device token. Idempotent by design.
 *
 * The app calls this on every launch and FCM usually returns the same token
 * each time, so the common case has to be a cheap rewrite rather than a
 * duplicate row. Keying the UpdateCommand on the token itself gives that:
 * if_not_exists(createdAt, ...) preserves the original registration date while
 * lastSeenAt and the TTL move forward.
 */
export async function registerDeviceToken(tenantId, userId, data = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!userId) throw new Error('User ID is required');

  const token = String(data.token || '').trim();
  if (!token) throw new Error('Push token is required');

  const platform = String(data.platform || '').toLowerCase();
  if (!PUSH_PLATFORMS.includes(platform)) {
    throw new Error(`Unsupported push platform: ${data.platform}`);
  }

  await evictOtherOwners(tenantId, userId, token);

  const now = new Date().toISOString();
  const result = await docClient.send(new UpdateCommand({
    TableName: PUSH_TOKENS_TABLE,
    Key: { PK: devicePartition(tenantId), SK: deviceSortKey(userId, token) },
    UpdateExpression: [
      'SET EntityType = :entityType',
      'tenantId = :tenantId',
      'userId = :userId',
      '#token = :token',
      'platform = :platform',
      'deviceId = :deviceId',
      'createdAt = if_not_exists(createdAt, :now)',
      'lastSeenAt = :now',
      'expiresAt = :ttl',
      'GSI1PK = :gsi1pk',
      'GSI1SK = :gsi1sk',
    ].join(', '),
    // `token` is a DynamoDB reserved word.
    ExpressionAttributeNames: { '#token': 'token' },
    ExpressionAttributeValues: {
      ':entityType': 'PUSH_DEVICE',
      ':tenantId': tenantId,
      ':userId': userId,
      ':token': token,
      ':platform': platform,
      ':deviceId': data.deviceId || null,
      ':now': now,
      ':ttl': ttlEpochSeconds(),
      ':gsi1pk': `TOKEN#${token}`,
      ':gsi1sk': `TENANT#${tenantId}#USER#${userId}`,
    },
    ReturnValues: 'ALL_NEW',
  }));

  logger.info('push.device.registered', { tenantId, userId, platform });
  return normalizeDevice(result.Attributes || {});
}

/** Remove a single device token. Safe to call for a token that is already gone. */
export async function unregisterDeviceToken(tenantId, userId, token) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!userId) throw new Error('User ID is required');
  if (!token) throw new Error('Push token is required');

  await docClient.send(new DeleteCommand({
    TableName: PUSH_TOKENS_TABLE,
    Key: { PK: devicePartition(tenantId), SK: deviceSortKey(userId, token) },
  }));

  logger.info('push.device.unregistered', { tenantId, userId });
  return { deleted: true };
}

/** Every device registered to one user in one tenant. */
export async function listUserDeviceTokens(tenantId, userId) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!userId) throw new Error('User ID is required');

  const result = await docClient.send(new QueryCommand({
    TableName: PUSH_TOKENS_TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': devicePartition(tenantId),
      ':sk': `USER#${userId}#DEVICE#`,
    },
  }));

  return (result.Items || []).map(normalizeDevice);
}

/**
 * Every device in a tenant.
 *
 * Notifications here are tenant-scoped, not per-user: notificationDynamodbService.js
 * writes the whole agency into one TENANT#{id}#NOTIFICATIONS partition with no
 * per-user fan-out. So a notification with no explicit target genuinely belongs
 * to the whole agency, and this is the correct audience rather than a shortcut.
 */
export async function listTenantDeviceTokens(tenantId) {
  if (!tenantId) throw new Error('Tenant ID is required');

  const result = await docClient.send(new QueryCommand({
    TableName: PUSH_TOKENS_TABLE,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': devicePartition(tenantId) },
  }));

  return (result.Items || []).map(normalizeDevice);
}

/**
 * Drop rows for tokens FCM has rejected as unregistered or malformed.
 *
 * Called from the send path. A dead token is not an error worth surfacing, but
 * left in place it turns every future send into a guaranteed partial failure,
 * so pruning is how the registry stays honest about who can be reached.
 *
 * @param {string} tenantId
 * @param {Array<{userId: string, token: string}>} tokens
 */
export async function pruneDeviceTokens(tenantId, tokens = []) {
  if (!tenantId || tokens.length === 0) return 0;

  let pruned = 0;
  for (const { userId, token } of tokens) {
    if (!userId || !token) continue;
    try {
      await docClient.send(new DeleteCommand({
        TableName: PUSH_TOKENS_TABLE,
        Key: { PK: devicePartition(tenantId), SK: deviceSortKey(userId, token) },
      }));
      pruned += 1;
    } catch (err) {
      logger.warn('push.device.prune.failed', { tenantId, userId, error: err.message });
    }
  }

  if (pruned > 0) logger.info('push.device.pruned', { tenantId, pruned });
  return pruned;
}

/**
 * Delete any registration of this token that belongs to a different user or
 * tenant. See the module header: FCM identifies the install, not the person
 * signed into it, so the same handset re-used by a colleague yields the same
 * token and would otherwise keep delivering the previous owner's leads.
 */
async function evictOtherOwners(tenantId, userId, token) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: PUSH_TOKENS_TABLE,
      IndexName: TOKEN_INDEX,
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `TOKEN#${token}` },
    }));

    const stale = (result.Items || []).filter(
      (item) => item.tenantId !== tenantId || item.userId !== userId,
    );

    for (const item of stale) {
      await docClient.send(new DeleteCommand({
        TableName: PUSH_TOKENS_TABLE,
        Key: { PK: item.PK, SK: item.SK },
      }));
      logger.info('push.device.reassigned', { fromTenantId: item.tenantId, toTenantId: tenantId });
    }
  } catch (err) {
    // A failed eviction must not block the user from registering. Worst case is
    // a duplicate row that the next successful register cleans up.
    logger.warn('push.device.evict.failed', { tenantId, error: err.message });
  }
}
