import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { wrapAwsClient } from './awsClientWrapper.js';
import { logger } from './logger.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const REGION = process.env.AWS_REGION || 'ap-south-1';
const TABLE_NAME = process.env.AI_EMPLOYEE_PROVISIONING_TABLE || 'AIEmployeeProvisioning';

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: TABLE_NAME });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * AIEmployeeProvisioning DDB service.
 * Schema: PK=tenantId, SK=createdAt (ISO), GSI: status-createdAt-index
 */

export async function createProvisioningRow({ tenantId, agencyOwnerId, agencyName, contactPhone, contactEmail, paidAt, planId, razorpaySubscriptionId }) {
  const now = new Date().toISOString();
  const expectedSLAEnd = new Date(new Date(paidAt).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const row = {
    tenantId,
    createdAt: now,
    agencyOwnerId,
    agencyName,
    contactPhone,
    contactEmail,
    paidAt,
    status: 'pending',
    expectedSLAEnd,
    planId,
    razorpaySubscriptionId,
    internalNotes: '',
    loomUrl: '',
    liveAt: '',
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: row,
    ConditionExpression: 'attribute_not_exists(tenantId)',
  })).catch(err => {
    if (err.name === 'ConditionalCheckFailedException') {
      throw new Error('Provisioning row already exists for this tenant');
    }
    throw err;
  });

  return row;
}

export async function getProvisioningByTenant(tenantId) {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'tenantId = :tid',
    ExpressionAttributeValues: { ':tid': tenantId },
    ScanIndexForward: false,
    Limit: 1,
  }));
  return result.Items?.[0] || null;
}

export async function updateProvisioning(tenantId, updates) {
  const existing = await getProvisioningByTenant(tenantId);
  if (!existing) throw new Error('Provisioning row not found');

  const now = new Date().toISOString();
  const expressions = [];
  const names = {};
  const values = { ':updatedAt': now };

  const allowedFields = ['status', 'internalNotes', 'loomUrl', 'liveAt'];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      expressions.push(`#${field} = :${field}`);
      names[`#${field}`] = field;
      values[`:${field}`] = updates[field];
    }
  }
  expressions.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { tenantId, createdAt: existing.createdAt },
    UpdateExpression: `SET ${expressions.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));

  return { ...existing, ...updates, updatedAt: now };
}

export async function listPendingProvisioning() {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'status-createdAt-index',
    KeyConditionExpression: '#s = :status',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':status': 'pending' },
  }));
  return result.Items || [];
}

// ─── Additional provisioning helpers (AI Employee feature) ────────────────────

/**
 * Upsert a provisioning record for a tenant (creates or fully replaces).
 */
export async function upsertProvisioning(tenantId, data) {
  const now = new Date().toISOString();
  const item = {
    tenantId,
    ...data,
    updatedAt: now,
  };
  if (!item.createdAt) item.createdAt = now;

  try {
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    logger.info('provisioning.upserted', { tenantId, status: data.status });
    return item;
  } catch (err) {
    logger.error('provisioning.upsert.failed', { tenantId, error: err.message });
    throw err;
  }
}

/**
 * Activate provisioning for a tenant (called from billing webhook on purchase).
 * Attempts an UpdateCommand first; falls back to upsert if the item doesn't exist.
 */
export async function activateProvisioning(tenantId, subscriptionId, orderId) {
  const now = new Date().toISOString();

  // Fetch existing row to get the SK (createdAt) — composite key table
  const existing = await getProvisioningByTenant(tenantId);

  if (existing && existing.createdAt) {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { tenantId, createdAt: existing.createdAt },
      UpdateExpression:
        'SET #status = :live, subscriptionId = :subId, orderId = :orderId, activatedAt = :now, updatedAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':live': 'live',
        ':subId': subscriptionId || null,
        ':orderId': orderId || null,
        ':now': now,
      },
    }));
    logger.info('provisioning.activated', { tenantId, subscriptionId, orderId });
  } else {
    // No row exists yet — create a live row via upsert
    await upsertProvisioning(tenantId, {
      status: 'live',
      subscriptionId: subscriptionId || null,
      orderId: orderId || null,
      activatedAt: now,
      createdAt: now,
    });
  }
}

/**
 * Suspend provisioning (e.g. on subscription failure / chargeback).
 */
export async function suspendProvisioning(tenantId, reason) {
  const now = new Date().toISOString();
  await upsertProvisioning(tenantId, {
    status: 'suspended',
    suspendedAt: now,
    suspendReason: reason || 'payment_failure',
    updatedAt: now,
  });
  logger.warn('provisioning.suspended', { tenantId, reason });
}
