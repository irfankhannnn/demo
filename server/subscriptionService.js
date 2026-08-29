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
    gracePeriodEndsAt: null,
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

/**
 * Store the billing anniversary day (UTC day of month, 1-31) extracted from
 * Razorpay subscription.start_at. Used by the credit-reset cron for accurate
 * monthly credit resets on paid subscribers.
 */
export async function setBillingAnniversaryDay(tenantId, day) {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { tenantId },
    UpdateExpression: 'SET billingAnniversaryDay = :day, isPaying = :paying, updatedAt = :now',
    ExpressionAttributeValues: {
      ':day': day,
      ':paying': true,
      ':now': new Date().toISOString(),
    },
  }));
  logger.info('subscription.billingAnniversaryDay.set', { tenantId, day });
}

/**
 * Update subscription status fields (paymentStatus, isPaying, cancelledAt, etc.)
 * Used by billing webhook on subscription.cancelled / subscription.halted.
 */
export async function updateSubscriptionStatus(tenantId, updates) {
  const now = new Date().toISOString();
  const setExpressions = ['updatedAt = :now'];
  const values = { ':now': now };

  for (const [field, value] of Object.entries(updates)) {
    if (value === null) {
      // Skip null values to avoid overwriting with null unintentionally
      continue;
    }
    setExpressions.push(`${field} = :${field}`);
    values[`:${field}`] = value;
  }

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { tenantId },
    UpdateExpression: `SET ${setExpressions.join(', ')}`,
    ExpressionAttributeValues: values,
    ConditionExpression: 'attribute_exists(tenantId)',
  }));

  logger.info('subscription.status.updated', { tenantId, updates: Object.keys(updates) });
  return getSubscription(tenantId);
}

/**
 * Validate subscription state consistency.
 * Returns array of issues found (empty = valid).
 */
export function validateSubscriptionState(sub) {
  const issues = [];

  if (!sub) return ['Subscription not found'];

  // isPaying should match paymentStatus
  if (sub.isPaying && sub.paymentStatus === 'trialing') {
    issues.push('isPaying=true but paymentStatus=trialing');
  }
  if (!sub.isPaying && sub.paymentStatus === 'active') {
    issues.push('isPaying=false but paymentStatus=active');
  }

  // gracePeriodActive requires gracePeriodEndsAt
  if (sub.gracePeriodActive && !sub.gracePeriodEndsAt) {
    issues.push('gracePeriodActive=true but gracePeriodEndsAt is null');
  }

  // seatsUsed should not exceed seatsPaid
  if (sub.seatsUsed > sub.seatsPaid) {
    issues.push(`seatsUsed (${sub.seatsUsed}) > seatsPaid (${sub.seatsPaid})`);
  }

  // trialEndsAt should be in future if trialing
  if (sub.paymentStatus === 'trialing' && sub.trialEndsAt) {
    if (new Date(sub.trialEndsAt) < new Date()) {
      issues.push('paymentStatus=trialing but trialEndsAt is in the past');
    }
  }

  return issues;
}
