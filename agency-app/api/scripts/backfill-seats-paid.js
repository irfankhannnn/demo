/**
 * Backfill Subscriptions table — idempotent one-off script.
 * For existing tenants, ensures seatsPaid is set based on plan:
 *   solo → 1, team → 3, teamplus → 5
 * If no Subscriptions row exists, creates a trial subscription.
 *
 * Usage:
 *   node agency-app/api/scripts/backfill-seats-paid.js [--dry-run]
 *
 * Environment:
 *   DYNAMODB_ENDPOINT (optional, for local DDB)
 *   AWS_REGION (default: ap-south-1)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createTrialSubscription, getSubscription } from '../subscriptionService.js';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
});
const docClient = DynamoDBDocumentClient.from(client);

const SEAT_DEFAULTS = { solo: 1, team: 3, teamplus: 5, free: 1 };
const IS_DRY_RUN = process.argv.includes('--dry-run');

async function getAllTenantIds() {
  // Scan a known CRM table to find all distinct tenantIds
  const CRM_TABLE = process.env.CRM_TABLE || 'RealEstateCRM';
  const tenantIds = new Set();
  let lastKey;
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: CRM_TABLE,
      ProjectionExpression: 'PK',
      ExclusiveStartKey: lastKey,
    }));
    for (const item of result.Items || []) {
      const pk = item.PK;
      if (pk && pk.startsWith('TENANT#')) {
        tenantIds.add(pk.replace('TENANT#', ''));
      }
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return [...tenantIds];
}

async function backfill() {
  console.log(`[backfill-seats-paid] Starting... ${IS_DRY_RUN ? '(DRY RUN — no writes)' : ''}`);
  const tenantIds = await getAllTenantIds();
  console.log(`[backfill-seats-paid] Found ${tenantIds.length} tenants`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const tenantId of tenantIds) {
    const existing = await getSubscription(tenantId);

    if (!existing) {
      if (IS_DRY_RUN) {
        console.log(`  [DRY-RUN] Would CREATE ${tenantId} → solo trial`);
      } else {
        await createTrialSubscription(tenantId, 'solo');
        console.log(`  [CREATE] ${tenantId} → solo trial`);
      }
      created++;
      continue;
    }

    const plan = existing.plan || 'solo';
    const expected = SEAT_DEFAULTS[plan] || 1;

    if (existing.seatsPaid === expected) {
      skipped++;
      continue;
    }

    if (IS_DRY_RUN) {
      console.log(`  [DRY-RUN] Would UPDATE ${tenantId} → seatsPaid=${expected} (plan=${plan})`);
    } else {
      await docClient.send(new UpdateCommand({
        TableName: process.env.SUBSCRIPTIONS_TABLE || 'Subscriptions',
        Key: { tenantId },
        UpdateExpression: 'SET seatsPaid = :seats, updatedAt = :now',
        ExpressionAttributeValues: {
          ':seats': expected,
          ':now': new Date().toISOString(),
        },
      }));
      console.log(`  [UPDATE] ${tenantId} → seatsPaid=${expected} (plan=${plan})`);
    }
    updated++;
  }

  console.log(`[backfill-seats-paid] Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
}

backfill().catch(err => {
  console.error('[backfill-seats-paid] FATAL:', err);
  process.exit(1);
});
