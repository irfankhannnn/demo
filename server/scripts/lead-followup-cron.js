/**
 * Lead Followup Cron — runs daily at 04:00 IST via EventBridge.
 * Scans CRM for leads with no activity in 3+ days and sends nudge notifications.
 * AGENTS_ENABLED=false: placeholder run only (no agent invocation).
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { sendEmail } from '../emailService.js';
import { logger } from '../logger.js';
import { shutdownPostHog } from '../lib/posthog.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);

const CRM_TABLE = process.env.CRM_DYNAMODB_TABLE_NAME;
const STALE_DAYS = 3;

/**
 * Find leads with no activity in the last STALE_DAYS days.
 */
async function findStaleLeads(tenantId) {
  if (!CRM_TABLE) return [];
  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const result = await docClient.send(new ScanCommand({
    TableName: CRM_TABLE,
    FilterExpression:
      'tenantId = :tid AND EntityType = :et AND (attribute_not_exists(lastActivityAt) OR lastActivityAt < :cutoff) AND #st <> :converted',
    ExpressionAttributeNames: { '#st': 'status' },
    ExpressionAttributeValues: {
      ':tid': tenantId,
      ':et': 'LEAD',
      ':cutoff': cutoff,
      ':converted': 'converted',
    },
    ProjectionExpression: 'leadId, tenantId, #st, assignedTo, leadType, lastActivityAt, name',
  }));
  return result.Items || [];
}

async function runFollowup() {
  if (process.env.AGENTS_ENABLED !== 'true') {
    logger.info('lead-followup-cron: AGENTS_ENABLED=false — placeholder run, no follow-ups sent');
    return { processed: 0, skipped: 0, reason: 'agents_disabled' };
  }

  logger.info('lead-followup-cron: starting');

  // NOTE: When agents are enabled, tenant iteration follows the same pattern
  // as expiring-agreements-cron.js (scan Subscriptions, iterate per tenant).
  // For now this is a no-op since AGENTS_ENABLED=false for launch.
  return { processed: 0, skipped: 0, reason: 'not_yet_implemented' };
}

export async function handler(event) {
  try {
    const result = await runFollowup();
    logger.info('lead-followup-cron: done', result);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    logger.error('lead-followup-cron: failed', { error: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    try {
      await shutdownPostHog();
    } catch (_) {}
  }
}

// Direct execution (for local testing only)
if (process.argv[1] && process.argv[1].includes('lead-followup-cron')) {
  runFollowup()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
