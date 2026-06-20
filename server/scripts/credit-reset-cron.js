import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getSubscription } from '../subscriptionService.js';
import { resetMonthlyCredits } from '../creditService.js';
import { getFreeTier, getPacks } from '../creditConfig.js';
import { logger } from '../logger.js';
import { metrics } from '../observability/cloudwatch.js';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});
const docClient = DynamoDBDocumentClient.from(client);

const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE || process.env.SUBSCRIPTIONS_TABLE_NAME || 'Subscriptions';

function isAnniversaryToday(isoDate) {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  const today = new Date();
  return d.getUTCDate() === today.getUTCDate() && d.getUTCMonth() === today.getUTCMonth();
}

function isDueForReset(sub, todayStr) {
  if (sub.lastCreditResetAt === todayStr) return false; // already reset today

  if (sub.isPaying) {
    // Paid: use exact billing anniversary day stored by Razorpay webhook
    if (sub.billingAnniversaryDay) {
      return new Date().getUTCDate() === sub.billingAnniversaryDay;
    }
    // Fallback: approximate from nextBillingDate if available
    if (sub.nextBillingDate) return isAnniversaryToday(sub.nextBillingDate);
    return false; // paid but no anniversary info yet — skip, cron will fix next month
  }

  // Trial/free: use createdAt or trialEndsAt anniversary
  return (
    isAnniversaryToday(sub.trialEndsAt) ||
    isAnniversaryToday(sub.lastCreditResetAt) ||
    isAnniversaryToday(sub.createdAt)
  );
}

async function listAllSubscriptions() {
  const items = [];
  let lastKey;
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: SUBSCRIPTIONS_TABLE,
      ...(lastKey && { ExclusiveStartKey: lastKey }),
    }));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

function getMonthlyAllotment(subscription, freeTier, packs) {
  if (subscription.isPaying) {
    const plan = subscription.plan || 'solo';
    if (plan.includes('teamplus') || plan === 'teamplus') {
      return packs.professional?.monthlyCredits || 15000;
    }
    if (plan.includes('team') || plan === 'team') {
      return packs.starter?.monthlyCredits || 5000;
    }
  }
  return freeTier.monthlyFreeCredits || 1000;
}

export async function handler() {
  const today = new Date().toISOString().slice(0, 10);
  const [freeTier, packs] = await Promise.all([getFreeTier(), getPacks()]);
  const subscriptions = await listAllSubscriptions();

  let reset = 0;
  let skipped = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const tenantId = sub.tenantId;
    if (!tenantId) continue;

    try {
      if (!isDueForReset(sub, today)) {
        skipped++;
        continue;
      }

      const allotment = getMonthlyAllotment(sub, freeTier, packs);
      await resetMonthlyCredits(tenantId, allotment, 'monthly_reset');

      await docClient.send(new UpdateCommand({
        TableName: SUBSCRIPTIONS_TABLE,
        Key: { tenantId },
        UpdateExpression: 'SET lastCreditResetAt = :today, updatedAt = :now',
        ExpressionAttributeValues: {
          ':today': today,
          ':now': new Date().toISOString(),
        },
      }));

      await metrics.creditReset(tenantId);
      reset++;
    } catch (err) {
      failed++;
      logger.error('creditReset.tenant.failed', { tenantId, error: err.message, stack: err.stack?.split('\n')[1] });
    }
  }

  logger.info('creditReset.completed', { reset, skipped, failed, total: subscriptions.length });
  return { reset, skipped, failed };
}
