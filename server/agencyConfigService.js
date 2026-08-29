import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcryptjs';
import { logger } from './logger.js';
import { wrapAwsClient } from './awsClientWrapper.js';
import { normalizeWhatsAppPhone } from './utils/whatsapp.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables from server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const REGION = process.env.AWS_REGION || 'ap-south-1';
const AGENCY_CONFIG_TABLE_NAME = process.env.AGENCY_CONFIG_DYNAMODB_TABLE_NAME;

if (!AGENCY_CONFIG_TABLE_NAME) {
  throw new Error('AGENCY_CONFIG_DYNAMODB_TABLE_NAME is not set. Please configure it in server/.env');
}

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: AGENCY_CONFIG_TABLE_NAME });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Get agency configuration for a given tenant (agency).
 * One item per TenantId in the AgencyConfig table.
 */
export async function getAgencyConfig(tenantId) {
  if (!tenantId) throw new Error('Tenant ID is required');

  const result = await logger.span('ddb.getAgencyConfig', { tableName: AGENCY_CONFIG_TABLE_NAME, tenantId }, async () => {
    return await docClient.send(
      new GetCommand({
        TableName: AGENCY_CONFIG_TABLE_NAME,
        Key: { TenantId: tenantId },
      })
    );
  });

  return result.Item || null;
}

/**
 * Resolve tenantId from a connected WhatsApp phone number (AgencyConfig.connectedWhatsAppPhone).
 * Used by local webhook processing and whatsapp-message-processor.
 *
 * Queries the connectedWhatsAppPhone-index GSI (server/infra/cfn-backend.yaml)
 * instead of scanning the table. IMPORTANT: this GSI must be deployed and
 * report IndexStatus ACTIVE + Backfilling false before this code path is
 * relied on in an environment -- querying a backfilling index can silently
 * return incomplete results. See docs/proposals/agent-channel-architecture/
 * phase1-imp/02-slice2-gsi-tenant-lookup.md for the rollout sequence.
 */
export async function getTenantIdByConnectedWhatsAppPhone(phone) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;

  const result = await logger.span(
    'ddb.getTenantByWhatsAppPhone',
    { tableName: AGENCY_CONFIG_TABLE_NAME, phone: normalized },
    async () => docClient.send(new QueryCommand({
      TableName: AGENCY_CONFIG_TABLE_NAME,
      IndexName: 'connectedWhatsAppPhone-index',
      KeyConditionExpression: 'connectedWhatsAppPhone = :phone',
      ExpressionAttributeValues: { ':phone': normalized },
    }))
  );

  return result.Items?.[0]?.TenantId || null;
}

/**
 * Resolve tenantId from a connected Instagram/ManyChat webhook token
 * (AgencyConfig.instagramWebhookToken). Each tenant that turns on the
 * Instagram lead pipeline gets a unique token embedded in the ManyChat
 * "External Request" URL, e.g. POST /api/webhooks/instagram/:webhookToken.
 * Set/rotate the token via updateAgencyConfig(tenantId, { instagramWebhookToken }).
 */
export async function getTenantIdByInstagramWebhookToken(token) {
  if (!token) return null;

  // Queries instagramWebhookToken-index (server/infra/cfn-backend.yaml)
  // instead of scanning: this runs on every inbound ManyChat lead. Same
  // ACTIVE + Backfilling:false deploy gate as the WhatsApp index — see
  // docs/proposals/agent-channel-architecture/phase1-imp/02-slice2-gsi-tenant-lookup.md.
  const result = await logger.span(
    'ddb.getTenantByInstagramWebhookToken',
    { tableName: AGENCY_CONFIG_TABLE_NAME },
    async () => docClient.send(new QueryCommand({
      TableName: AGENCY_CONFIG_TABLE_NAME,
      IndexName: 'instagramWebhookToken-index',
      KeyConditionExpression: 'instagramWebhookToken = :token',
      ExpressionAttributeValues: { ':token': token },
    }))
  );

  return result.Items?.[0]?.TenantId || null;
}

/**
 * Set or update admin username and password for a given tenant.
 * This will create or overwrite the credentials for that tenant.
 */
export async function setAgencyAdminCredentials(tenantId, username, plainPassword) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!username || !plainPassword) throw new Error('Username and password are required');

  const passwordHash = await bcrypt.hash(plainPassword, 10);
  const now = new Date().toISOString();

  await logger.span('ddb.setAgencyAdminCredentials', { tableName: AGENCY_CONFIG_TABLE_NAME, tenantId, username }, async () => {
    await docClient.send(
      new PutCommand({
        TableName: AGENCY_CONFIG_TABLE_NAME,
        Item: {
          TenantId: tenantId,
          adminUsername: username,
          adminPasswordHash: passwordHash,
          updatedAt: now,
          createdAt: now,
        },
      })
    );
  });
}

/**
 * Update agency configuration fields (e.g., notification settings).
 * This merges new fields with existing config, preserving other fields.
 */
export async function updateAgencyConfig(tenantId, updates) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!updates || Object.keys(updates).length === 0) {
    throw new Error('No updates provided');
  }

  const now = new Date().toISOString();

  // Build update expression dynamically
  const updateExpressions = ['updatedAt = :updatedAt'];
  const expressionAttributeValues = { ':updatedAt': now };
  const expressionAttributeNames = {};

  Object.keys(updates).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = updates[key];
  });

  await logger.span('ddb.updateAgencyConfig', { tableName: AGENCY_CONFIG_TABLE_NAME, tenantId }, async () => {
    await docClient.send(
      new UpdateCommand({
        TableName: AGENCY_CONFIG_TABLE_NAME,
        Key: { TenantId: tenantId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  });

  return await getAgencyConfig(tenantId);
}

/**
 * Change only the admin password for a given tenant, keeping the same username.
 */
export async function changeAgencyAdminPassword(tenantId, newPassword) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!newPassword) throw new Error('New password is required');

  const config = await getAgencyConfig(tenantId);
  if (!config) {
    throw new Error('Agency config not found');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const now = new Date().toISOString();

  await logger.span('ddb.changeAgencyAdminPassword', { tableName: AGENCY_CONFIG_TABLE_NAME, tenantId }, async () => {
    await docClient.send(
      new UpdateCommand({
        TableName: AGENCY_CONFIG_TABLE_NAME,
        Key: { TenantId: tenantId },
        UpdateExpression: 'SET adminPasswordHash = :hash, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':hash': passwordHash,
          ':updatedAt': now,
        },
      })
    );
  });
}

/**
 * Scan all agency configs optionally filtered by a boolean field.
 * Used by lead-followup-cron to iterate tenants with AI Employee enabled.
 * NOTE: This does a full table scan — acceptable for small tenant counts.
 */
export async function scanAgencyConfigs(filter = {}) {
  const params = {
    TableName: AGENCY_CONFIG_TABLE_NAME,
    ProjectionExpression: 'TenantId',
  };

  if (filter.aiEmployeeEnabled !== undefined) {
    params.FilterExpression = 'aiEmployeeEnabled = :enabled';
    params.ExpressionAttributeValues = {
      ':enabled': filter.aiEmployeeEnabled === true,
    };
  }

  const allItems = [];
  let lastKey;

  do {
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const result = await docClient.send(new ScanCommand(params));
    allItems.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return allItems.map(item => item.TenantId).filter(Boolean);
}


