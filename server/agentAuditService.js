import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './logger.js';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME || 'cloudberry-real-estate-crm';

export async function logAgentAction(tenantId, agentId, action, input, output, credits = 0) {
  const ts = new Date().toISOString();
  const id = `${ts}#${Math.random().toString(36).slice(2, 8)}`;

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `TENANT#${tenantId}#AGENTLOG#${id}`,
      SK: 'LOG',
      entityType: 'AGENT_LOG',
      tenantId,
      agentId,
      action,
      inputSummary: JSON.stringify(input).slice(0, 500),
      outputSummary: JSON.stringify(output).slice(0, 500),
      creditsCharged: credits,
      createdAt: ts,
    },
  }));

  logger.info('agent.audit.logged', { tenantId, agentId, action, credits });
}

export async function getAgentActivity(tenantId, { limit = 50 } = {}) {
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND entityType = :type',
    ExpressionAttributeValues: {
      ':pkPrefix': `TENANT#${tenantId}#AGENTLOG#`,
      ':type': 'AGENT_LOG',
    },
    Limit: limit,
  }));

  return (result.Items || []).map((item) => ({
    id: item.PK,
    agentId: item.agentId,
    action: item.action,
    creditsCharged: item.creditsCharged,
    createdAt: item.createdAt,
    inputSummary: item.inputSummary,
    outputSummary: item.outputSummary,
  }));
}
