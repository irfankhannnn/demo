import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './logger.js';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.SUBSCRIPTIONS_TABLE || 'Subscriptions';

/**
 * Get subscription for a tenant.
 * @returns {Promise<Object|null>} subscription row or null
 */
export async function getSubscription(tenantId) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { tenantId },
  }));
  return result.Item || null;
}

/**
 * Increment seatsPaid for a tenant (called by billing webhook on subscription.updated).
 */
export async function incrementSeatsPaid(tenantId, by = 1) {
  const result = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { tenantId },
    UpdateExpression: 'SET seatsPaid = seatsPaid + :inc, updatedAt = :now',
    ConditionExpression: 'attribute_exists(tenantId)',
    ExpressionAttributeValues: {
      ':inc': by,
      ':now': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  }));
  logger.info('subscription.seatsPaid.incremented', { tenantId, by, newValue: result.Attributes?.seatsPaid });
  return result.Attributes;
}

/**
 * Decrement seatsPaid (rare — only on tier downgrade).
 */
export async function decrementSeatsPaid(tenantId, by = 1) {
  const result = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { tenantId },
    UpdateExpression: 'SET seatsPaid = seatsPaid - :dec, updatedAt = :now',
    ConditionExpression: 'seatsPaid >= :dec',
    ExpressionAttributeValues: {
      ':dec': by,
      ':now': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  }));
  logger.info('subscription.seatsPaid.decremented', { tenantId, by, newValue: result.Attributes?.seatsPaid });
  return result.Attributes;
}

/**
 * Recompute seatsUsed by counting active members for a tenant.
 * Attempts to call the auth microservice for an accurate count,
 * falling back to the stored seatsUsed value.
 */
export async function recomputeSeatsUsed(tenantId) {
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3002';
  const internalKey = process.env.INTERNAL_API_KEY || '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(`${authServiceUrl}/internal/users/count?tenantId=${tenantId}`, {
        headers: { 'x-internal-api-key': internalKey },
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        const data = await response.json();
        return data.count ?? 0;
      }
      if (attempt === 1) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
    } catch (err) {
      logger.warn('recomputeSeatsUsed.auth_attempt_failed', { tenantId, attempt, error: err.message });
      if (attempt === 1) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
    }
  }

  const sub = await getSubscription(tenantId);
  return sub?.seatsUsed ?? 0;
}

/**
 * Create a trial subscription row for a new tenant.
 */
export async function createTrialSubscription(tenantId, plan = 'solo', options = {}) {
  const existing = await getSubscription(tenantId);
  if (existing && existing.isPaying) {
    logger.warn('subscription.trial.blocked_paying', { tenantId });
    throw new Error('Cannot create trial for paying customer');
  }

  const seatDefaults = { solo: 1, team: 3, teamplus: 5, free: 1 };
  const trialDays = Number(process.env.TRIAL_DAYS) || 14;
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();

  const item = {
    tenantId,
    plan,
    seatsPaid: seatDefaults[plan] || 1,
    seatsUsed: 1, // the founder counts as 1 seat
    trialEndsAt,
    isPaying: false,
    gracePeriodActive: false,
    paymentStatus: 'trialing',
    razorpaySubscriptionId: null,
    nextBillingDate: null,
    consentSignedAt: options.consentSignedAt || null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
    ConditionExpression: 'attribute_not_exists(tenantId)',
  }));

  logger.info('subscription.trial.created', { tenantId, plan, trialEndsAt });
  return item;
}

/**
 * Record DPDP consent timestamp on an existing or new subscription row.
 */
export async function setConsentSignedAt(tenantId, consentSignedAt = new Date().toISOString()) {
  const existing = await getSubscription(tenantId);
  if (!existing) {
    return createTrialSubscription(tenantId, 'solo', { consentSignedAt });
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { tenantId },
    UpdateExpression: 'SET consentSignedAt = :consent, updatedAt = :now',
    ExpressionAttributeValues: {
      ':consent': consentSignedAt,
      ':now': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  }));

  logger.info('subscription.consent.recorded', { tenantId, consentSignedAt });
  return result.Attributes;
}

/**
 * Update seatsUsed count (called when members are added/removed).
 */
export async function updateSeatsUsed(tenantId, seatsUsed) {
  const result = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { tenantId },
    UpdateExpression: 'SET seatsUsed = :used, updatedAt = :now',
    ExpressionAttributeValues: {
      ':used': seatsUsed,
      ':now': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes;
}
