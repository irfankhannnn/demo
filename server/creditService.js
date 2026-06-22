import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomBytes } from 'crypto';
import { logger } from './logger.js';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.CREDITS_TABLE_NAME || 'cloudberry-real-estate-credits';
const BALANCE_SK = 'BALANCE';

export class InsufficientCreditsError extends Error {
  constructor(balance, required) {
    super(`Insufficient credits: have ${balance}, need ${required}`);
    this.name = 'InsufficientCreditsError';
    this.balance = balance;
    this.required = required;
    this.status = 402;
  }
}

function ledgerSk() {
  const ts = new Date().toISOString();
  const rand = randomBytes(4).toString('hex');
  return `LEDGER#${ts}#${rand}`;
}

function ttlMonths(months = 12) {
  return Math.floor(Date.now() / 1000) + months * 30 * 24 * 60 * 60;
}

/**
 * Get current credit balance for a tenant.
 */
export async function getBalance(tenantId) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { tenantId, sk: BALANCE_SK },
  }));
  return result.Item?.balance ?? 0;
}

/**
 * Grant credits atomically with ledger entry.
 */
export async function grantCredits(tenantId, amount, reason, meta = {}) {
  if (!tenantId) throw new Error('tenantId required');
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('amount must be a positive integer');

  const now = new Date().toISOString();
  const sk = ledgerSk();
  const balanceBefore = await getBalance(tenantId);

  await docClient.send(new TransactWriteCommand({
    TransactItems: [
      {
        Update: {
          TableName: TABLE_NAME,
          Key: { tenantId, sk: BALANCE_SK },
          UpdateExpression: 'SET balance = if_not_exists(balance, :zero) + :amt, updatedAt = :now',
          ExpressionAttributeValues: { ':amt': amt, ':zero': 0, ':now': now },
        },
      },
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            tenantId,
            sk,
            actionType: reason,
            amount: amt,
            balanceBefore,
            balanceAfter: balanceBefore + amt,
            meta,
            createdAt: now,
            GSI1PK: tenantId,
            GSI1SK: `${reason}#${now}`,
            expiresAt: ttlMonths(),
          },
        },
      },
    ],
  }));

  logger.info('credits.granted', { tenantId, amount: amt, reason });
  return { ledgerId: sk, balance: balanceBefore + amt };
}

/**
 * Deduct credits atomically with conditional balance check.
 */
export async function deductCredits(tenantId, amount, actionType, meta = {}) {
  if (!tenantId) throw new Error('tenantId required');
  const cost = Math.floor(Number(amount));
  if (!Number.isFinite(cost) || cost <= 0) throw new Error('amount must be a positive integer');

  const now = new Date().toISOString();
  const sk = ledgerSk();

  // Get current balance for ledger entry (not for validation - transaction handles that atomically)
  const balanceItem = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { tenantId, sk: BALANCE_SK },
  }));
  const balanceBefore = balanceItem.Item?.balance ?? 0;

  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TABLE_NAME,
            Key: { tenantId, sk: BALANCE_SK },
            UpdateExpression: 'SET balance = balance - :cost, updatedAt = :now',
            ConditionExpression: 'attribute_exists(balance) AND balance >= :cost',
            ExpressionAttributeValues: { ':cost': cost, ':now': now },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              tenantId,
              sk,
              actionType,
              amount: -cost,
              balanceBefore,
              balanceAfter: balanceBefore - cost,
              meta,
              createdAt: now,
              GSI1PK: tenantId,
              GSI1SK: `${actionType}#${now}`,
              expiresAt: ttlMonths(),
            },
          },
        },
      ],
    }));
  } catch (err) {
    if (err.name === 'TransactionCanceledException') {
      const current = await getBalance(tenantId);
      throw new InsufficientCreditsError(current, cost);
    }
    throw err;
  }

  logger.info('credits.deducted', { tenantId, cost, actionType });
  return { ledgerId: sk, balance: balanceBefore - cost };
}

/**
 * Paginated ledger read.
 */
export async function getLedger(tenantId, { limit = 50, startKey } = {}) {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'tenantId = :tid AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':tid': tenantId,
      ':prefix': 'LEDGER#',
    },
    ScanIndexForward: false,
    Limit: limit,
    ...(startKey && { ExclusiveStartKey: startKey }),
  }));

  return {
    items: result.Items || [],
    nextKey: result.LastEvaluatedKey || null,
  };
}

/**
 * Reset monthly credits to plan allotment (set-to, no carry-over).
 */
export async function resetMonthlyCredits(tenantId, allotment, reason = 'monthly_reset') {
  const amt = Math.floor(Number(allotment));
  if (!Number.isFinite(amt) || amt < 0) throw new Error('allotment must be non-negative');

  const now = new Date().toISOString();
  const sk = ledgerSk();
  const balanceBefore = await getBalance(tenantId);

  await docClient.send(new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            tenantId,
            sk: BALANCE_SK,
            balance: amt,
            updatedAt: now,
          },
        },
      },
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            tenantId,
            sk,
            actionType: reason,
            amount: amt - balanceBefore,
            balanceBefore,
            balanceAfter: amt,
            meta: { resetType: 'set-to' },
            createdAt: now,
            GSI1PK: tenantId,
            GSI1SK: `${reason}#${now}`,
            expiresAt: ttlMonths(),
          },
        },
      },
    ],
  }));

  logger.info('credits.reset', { tenantId, allotment });
  return { balance: amt, ledgerId: sk };
}

/**
 * Initialize balance for new tenant with free tier credits.
 */
export async function initializeTenantCredits(tenantId, amount) {
  const existing = await getBalance(tenantId);
  if (existing > 0) return { balance: existing, alreadyInitialized: true };
  return grantCredits(tenantId, amount, 'initial_grant', { source: 'trial' });
}

/**
 * Refund credits after a handler failure.
 * Adds the credits back atomically with a REFUND ledger entry.
 * Use this when chargeCreditsForAction succeeded but the subsequent
 * handler action failed — so the user is not left without credits.
 *
 * @param {string} tenantId
 * @param {number} amount       - Amount to refund (positive integer)
 * @param {string} actionType   - Original action type that was charged
 * @param {string} [ledgerId]   - Optional: original ledger entry ID for reference
 * @param {string} [reason]     - Human-readable reason for refund
 */
export async function refundCredits(tenantId, amount, actionType, { ledgerId, reason = 'handler_failure' } = {}) {
  if (!tenantId) throw new Error('tenantId required');
  const refundReason = `refund.${actionType}`;
  return grantCredits(tenantId, amount, refundReason, {
    refundFor: actionType,
    originalLedgerId: ledgerId || null,
    reason,
  });
}
