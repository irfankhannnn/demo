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
const IS_LOCAL_DEV = process.env.NODE_ENV === 'development';

// In-memory fallback for local dev when DynamoDB table doesn't exist
const inMemoryLog = new Set();

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

/**
 * Atomic idempotency check + log. Returns { isDuplicate: true } if already processed.
 * Uses DynamoDB ConditionExpression to prevent race conditions.
 * Falls back to in-memory Set in local dev if DynamoDB table doesn't exist.
 */
export async function logEventIfNotProcessed(webhookEventId, eventType, tenantId) {
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  // In-memory fallback for local dev
  if (IS_LOCAL_DEV) {
    if (inMemoryLog.has(webhookEventId)) {
      return { processed: false, isDuplicate: true };
    }
    inMemoryLog.add(webhookEventId);
    return { processed: true, isDuplicate: false };
  }

  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        webhookEventId,
        processedAt: now,
        eventType,
        tenantId: tenantId || null,
        ttl,
      },
      ConditionExpression: 'attribute_not_exists(webhookEventId)',
    }));
    return { processed: true, isDuplicate: false };
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return { processed: false, isDuplicate: true };
    }
    // If table doesn't exist in local dev, fall back to in-memory
    if (IS_LOCAL_DEV && err.name === 'ResourceNotFoundException') {
      if (inMemoryLog.has(webhookEventId)) {
        return { processed: false, isDuplicate: true };
      }
      inMemoryLog.add(webhookEventId);
      return { processed: true, isDuplicate: false };
    }
    throw err;
  }
}
