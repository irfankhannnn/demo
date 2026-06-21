import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../logger.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);
const AUDIT_TABLE = process.env.AGENT_AUDIT_TABLE_NAME || 'cloudberry-real-estate-agent-audit';

/**
 * Log an agent action to the dedicated AgentAudit table.
 * Non-throwing — audit failures must not block agent responses.
 */
export async function logAgentAction(tenantId, agentId, action, input, output, creditsCharged) {
  const now = new Date().toISOString();
  const suffix = Math.random().toString(36).slice(2, 8);
  const sk = `${now}#${suffix}`;

  const item = {
    tenantId,
    sk,
    agentId,
    action,
    input: input ? JSON.stringify(input).slice(0, 512) : null,
    output: output ? JSON.stringify(output).slice(0, 1024) : null,
    creditsCharged: creditsCharged || 0,
    status: output?.error ? 'error' : 'success',
    errorMessage: output?.error || null,
    createdAt: now,
    GSI1PK: tenantId,
    GSI1SK: `${agentId}#${now}`,
    expiresAt: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90-day TTL
  };

  try {
    await docClient.send(new PutCommand({ TableName: AUDIT_TABLE, Item: item }));
  } catch (err) {
    logger.error('agentAuditService.log.failed', { tenantId, agentId, action, error: err.message });
  }
}

/**
 * Retrieve recent agent activity for a tenant.
 */
export async function getAgentActivity(tenantId, { limit = 20, agentId } = {}) {
  try {
    const params = {
      TableName: AUDIT_TABLE,
      KeyConditionExpression: 'tenantId = :pk',
      ExpressionAttributeValues: { ':pk': tenantId },
      ScanIndexForward: false,
      Limit: Math.min(Number(limit), 100),
    };

    if (agentId) {
      params.IndexName = 'GSI1';
      params.KeyConditionExpression = 'GSI1PK = :pk AND begins_with(GSI1SK, :agentPrefix)';
      params.ExpressionAttributeValues = {
        ':pk': tenantId,
        ':agentPrefix': `${agentId}#`,
      };
    }

    const result = await docClient.send(new QueryCommand(params));
    return (result.Items || []).map(item => ({
      id: item.sk,
      agentId: item.agentId,
      action: item.action,
      status: item.status,
      creditsCharged: item.creditsCharged,
      createdAt: item.createdAt,
      errorMessage: item.errorMessage || undefined,
    }));
  } catch (err) {
    logger.error('agentAuditService.getActivity.failed', { tenantId, error: err.message });
    return [];
  }
}
