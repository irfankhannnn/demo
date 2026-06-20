import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../logger.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);
const CRM_TABLE = process.env.CRM_TABLE_NAME || 'cloudberry-real-estate-crm';

export async function logAgentAction(tenantId, agentId, action, input, output, creditsCharged) {
  const now = new Date().toISOString();
  const suffix = Math.random().toString(36).slice(2, 8);
  const id = `${now}#${suffix}`;
  const item = {
    PK: `TENANT#${tenantId}`,
    SK: `AGENTLOG#${id}`,
    entityType: 'AGENTLOG',
    id,
    tenantId,
    agentId,
    action,
    input: input ? JSON.stringify(input).slice(0, 512) : null,
    output: output ? JSON.stringify(output).slice(0, 1024) : null,
    creditsCharged: creditsCharged || 0,
    createdAt: now,
  };
  try {
    await docClient.send(new PutCommand({ TableName: CRM_TABLE, Item: item }));
  } catch (err) {
    // Non-throwing — audit failures must not block agent responses
    logger.error('agentAuditService.log.failed', { tenantId, action, error: err.message });
  }
}

export async function getAgentActivity(tenantId, { limit = 20 } = {}) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: CRM_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}`,
        ':prefix': 'AGENTLOG#',
      },
      ScanIndexForward: false,
      Limit: Math.min(limit, 100),
    }));
    return (result.Items || []).map(item => ({
      id: item.id,
      agentId: item.agentId,
      action: item.action,
      creditsCharged: item.creditsCharged,
      createdAt: item.createdAt,
    }));
  } catch (err) {
    logger.error('agentAuditService.getActivity.failed', { tenantId, error: err.message });
    return [];
  }
}
