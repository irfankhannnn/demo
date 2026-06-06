import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { wrapAwsClient } from './awsClientWrapper.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const REGION = process.env.AWS_REGION || 'ap-south-1';
const TABLE_NAME = process.env.WEBHOOK_LOG_TABLE || 'WebhookLog';

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: TABLE_NAME });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * WebhookLog — idempotency log for Razorpay webhooks.
 * PK: webhookEventId, TTL: 30 days after processedAt.
 */

export async function isEventProcessed(webhookEventId) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { webhookEventId },
  }));
  return !!result.Item;
}

export async function logEvent(webhookEventId, eventType, tenantId) {
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      webhookEventId,
      processedAt: now,
      eventType,
      tenantId: tenantId || null,
      ttl,
    },
  }));
}
