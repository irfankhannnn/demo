import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { suspendProvisioning } from '../aiEmployeeProvisioningService.js';
import { updateAgencyConfig } from '../agencyConfigService.js';
import { logger } from '../logger.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE || 'Subscriptions';

export async function handler() {
  const now = new Date().toISOString();
  let expired = 0;
  let skipped = 0;
  let failed = 0;

  // Scan for subscriptions with active grace period that has ended
  let lastKey;
  const expiredSubs = [];
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      FilterExpression: 'gracePeriodActive = :true AND attribute_exists(gracePeriodEndsAt) AND gracePeriodEndsAt < :now',
      ExpressionAttributeValues: { ':true': true, ':now': now },
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));
    expiredSubs.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  for (const sub of expiredSubs) {
    const tenantId = sub.tenantId;
    if (!tenantId) continue;

    try {
      // 1. Mark grace period as expired and suspend subscription
      await docClient.send(new UpdateCommand({
        TableName: SUBSCRIPTIONS_TABLE,
        Key: { tenantId },
        UpdateExpression: 'SET gracePeriodActive = :false, isPaying = :false, paymentStatus = :status, gracePeriodExpiredAt = :now, updatedAt = :now',
        ExpressionAttributeValues: {
          ':false': false,
          ':status': 'grace_period_expired',
          ':now': now,
        },
      }));

      // 2. Suspend AI Employee
      try {
        await suspendProvisioning(tenantId, 'grace_period_expired');
        await updateAgencyConfig(tenantId, { aiEmployeeEnabled: false });
      } catch (suspendErr) {
        logger.error('grace_period.suspend.failed', { tenantId, error: suspendErr.message });
      }

      logger.info('grace_period.expired', { tenantId });
      expired++;
    } catch (err) {
      failed++;
      logger.error('grace_period.expiry.failed', { tenantId, error: err.message });
    }
  }

  logger.info('grace_period.expiry_cron.completed', { expired, failed, total: expiredSubs.length });
  return { expired, failed, total: expiredSubs.length };
}

// CLI runner
if (process.argv[1]?.endsWith('grace-period-expiry-cron.js')) {
  handler().catch(err => {
    logger.error('grace_period.expiry_cron.fatal', { error: err.message });
    process.exit(1);
  });
}
