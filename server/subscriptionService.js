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
 * Uses the auth microservice member list or a scan of the Subscriptions table's seatsUsed field.
 * For now, returns the stored seatsUsed value (updated on member add/remove by auth service callbacks).
 */
export async function recomputeSeatsUsed(tenantId) {
  const sub = await getSubscription(tenantId);
  return sub?.seatsUsed ?? 0;
}

/**
 * Create a trial subscription row for a new tenant.
 */
export async function createTrialSubscription(tenantId, plan = 'solo') {
  const seatDefaults = { solo: 1, team: 3, teamplus: 5, free: 1 };
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14-day trial

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
