import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '../logger.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const CREDITS_TABLE = process.env.CREDITS_TABLE_NAME || 'cloudberry-real-estate-credits';
const BALANCE_SK = 'BALANCE';

/**
 * Reconcile credit balances for all tenants.
 * For each tenant:
 *   1. Check if BALANCE item exists
 *   2. If missing but LEDGER entries exist, rebuild from latest ledger entry
 *   3. Log warnings for inconsistencies
 */
export async function handler() {
  let checked = 0;
  let rebuilt = 0;
  let missing = 0;
  let failed = 0;

  // Get all unique tenantIds from credits table
  let lastKey;
  const tenantIds = new Set();
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: CREDITS_TABLE,
      ProjectionExpression: 'tenantId',
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));
    for (const item of result.Items || []) {
      if (item.tenantId) tenantIds.add(item.tenantId);
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  for (const tenantId of tenantIds) {
    checked++;
    try {
      // 1. Check if BALANCE item exists
      const balanceResult = await docClient.send(new QueryCommand({
        TableName: CREDITS_TABLE,
        KeyConditionExpression: 'tenantId = :tid AND sk = :sk',
        ExpressionAttributeValues: { ':tid': tenantId, ':sk': BALANCE_SK },
        Limit: 1,
      }));

      if (balanceResult.Items?.length > 0) {
        // Balance exists — OK
        continue;
      }

      // 2. BALANCE missing — check for ledger entries
      const ledgerResult = await docClient.send(new QueryCommand({
        TableName: CREDITS_TABLE,
        KeyConditionExpression: 'tenantId = :tid AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: { ':tid': tenantId, ':prefix': 'LEDGER#' },
        ScanIndexForward: false, // latest first
        Limit: 1,
      }));

      if (!ledgerResult.Items?.length) {
        // No ledger entries either — tenant has no credit history
        continue;
      }

      // 3. Rebuild BALANCE from latest ledger entry
      const latestLedger = ledgerResult.Items[0];
      const rebuiltBalance = latestLedger.balanceAfter ?? 0;

      await docClient.send(new PutCommand({
        TableName: CREDITS_TABLE,
        Item: {
          tenantId,
          sk: BALANCE_SK,
          balance: rebuiltBalance,
          updatedAt: new Date().toISOString(),
          reconciledAt: new Date().toISOString(),
          reconciledFrom: latestLedger.sk,
        },
      }));

      logger.warn('creditBalance.reconciled.rebuilt', {
        tenantId,
        rebuiltBalance,
        fromLedger: latestLedger.sk,
      });
      rebuilt++;
    } catch (err) {
      failed++;
      logger.error('creditBalance.reconcile.failed', { tenantId, error: err.message });
    }
  }

  logger.info('creditBalance.reconcile.completed', { checked, rebuilt, missing, failed });
  return { checked, rebuilt, missing, failed };
}

if (process.argv[1]?.endsWith('credit-balance-reconcile.js')) {
  handler().catch(err => {
    logger.error('creditBalance.reconcile.fatal', { error: err.message });
    process.exit(1);
  });
}
