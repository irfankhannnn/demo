import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './logger.js';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(process.env.DYNAMODB_ENDPOINT && { endpoint: process.env.DYNAMODB_ENDPOINT }),
});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME || 'cloudberry-real-estate-crm';

/**
 * Log inbound/outbound WhatsApp message for audit.
 */
export async function logMessage(tenantId, messageId, data) {
  const now = new Date().toISOString();
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `TENANT#${tenantId}#WHATSAPP#${messageId}`,
      SK: 'MESSAGE',
      entityType: 'WHATSAPP_MESSAGE',
      messageId,
      tenantId,
      direction: data.direction || 'inbound',
      from: data.from,
      to: data.to,
      text: data.text,
      status: data.status || 'received',
      createdAt: now,
      updatedAt: now,
    },
  }));
  logger.info('whatsapp.message.logged', { tenantId, messageId, direction: data.direction });
}

/**
 * Log processing outcome for a WhatsApp message.
 */
export async function logOutcome(tenantId, messageId, outcome) {
  const now = new Date().toISOString();
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `TENANT#${tenantId}#WHATSAPP#${messageId}`,
      SK: 'OUTCOME',
      entityType: 'WHATSAPP_OUTCOME',
      messageId,
      tenantId,
      success: outcome.success,
      action: outcome.action,
      result: outcome.result,
      error: outcome.error,
      creditsCharged: outcome.creditsCharged || 0,
      createdAt: now,
    },
  }));
  logger.info('whatsapp.outcome.logged', { tenantId, messageId, success: outcome.success, action: outcome.action });
}
