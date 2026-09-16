// AI Calling DynamoDB Service - Single Table Design

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { CALL_STATUS, CALL_STATUS_RANK, DOCUMENT_STATUS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const TABLE_NAME = process.env.AI_CALLING_TABLE_NAME || 'ai-calling-data';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * AI Calling DynamoDB Single Table Design:
 * 
 * PK Patterns:
 * - TENANT#{tenantId}#CALL#{callSessionId}
 * - TENANT#{tenantId}#KNOWLEDGE#{documentId}
 * - TENANT#{tenantId}#INTENT_CONFIG
 * - TENANT#{tenantId}#AGENT_CONFIG
 * 
 * SK Patterns:
 * - SESSION (call session data)
 * - TRANSCRIPT#{timestamp} (transcript entries)
 * - INTENT#{intentId} (detected intents)
 * - DOCUMENT (knowledge document)
 * - CONFIG (configuration data)
 * 
 * GSI1: tenant-status-index (GSI1PK = TENANT#{tenantId}#STATUS#{status}, GSI1SK = timestamp)
 * GSI2: tenant-date-index (GSI2PK = TENANT#{tenantId}#CALLS, GSI2SK = createdAt)
 */

// ============== Call Session Operations ==============

export async function createCallSession(tenantId, data) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const callSessionId = uuidv4();
  const timestamp = new Date().toISOString();
  
  const session = {
    PK: `TENANT#${tenantId}#CALL#${callSessionId}`,
    SK: 'SESSION',
    EntityType: 'CALL_SESSION',
    tenantId,
    callSessionId,
    leadId: data.leadId,
    leadName: data.leadName,
    leadPhone: data.leadPhone,
    callPurpose: data.callPurpose,
    status: CALL_STATUS.INITIATED,
    // Monotonic rank of `status`, stored so an out-of-order carrier webhook
    // can be rejected by a ConditionExpression instead of silently
    // overwriting a later state. See updateCallSession().
    statusRank: CALL_STATUS_RANK[CALL_STATUS.INITIATED],
    exotelCallSid: null,
    elevenLabsConversationId: null,
    qualificationStatus: data.callPurpose === 'lead_qualification'
      ? 'pending'
      : 'not_applicable',
    qualificationTemperature: null,
    qualificationReasons: null,
    startedAt: null,
    endedAt: null,
    duration: 0,
    transcriptSummary: null,
    intentsDetected: [],
    actionsPerformed: [],
    outcome: null,
    recordingUrl: null,
    // Follow-up agent correlation (CONTRACTS.md 2.1). followupJobId is what
    // the consumer of call.ended keys its idempotency on, so it is lifted to
    // a top-level attribute rather than left buried inside metadata.
    followupJobId: data.followupJobId ?? data.metadata?.followupJobId ?? null,
    metadata: data.metadata ?? null,
    context: data.context ?? null,
    // Set by the agent's tools during the call; null until then.
    needsHuman: false,
    needsHumanReason: null,
    visitFeedback: null,
    meeting: null,
    // Click-to-call only: who the team member dialled and who pressed the button.
    entityType: data.entityType ?? null,
    entityId: data.entityId ?? null,
    initiatedByUserId: data.initiatedByUserId ?? null,
    initiatedByName: data.initiatedByName ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    // GSI keys
    GSI1PK: `TENANT#${tenantId}#STATUS#${CALL_STATUS.INITIATED}`,
    GSI1SK: timestamp,
    GSI2PK: `TENANT#${tenantId}#CALLS`,
    GSI2SK: timestamp,
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: session,
  }));
  
  logger.callEvent('CALL_SESSION_CREATED', callSessionId, tenantId, {
    leadId: data.leadId,
    callPurpose: data.callPurpose,
  });
  
  return session;
}

export async function getCallSession(tenantId, callSessionId) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CALL#${callSessionId}`,
      SK: 'SESSION',
    },
  }));
  
  return result.Item || null;
}

/**
 * Update a call session.
 *
 * Telephony webhooks are not delivered in order, so a status update is
 * applied under a ConditionExpression on the stored statusRank: a status that
 * ranks at or below the one already recorded is rejected rather than allowed
 * to stomp a later state (e.g. a retried `ringing` arriving after
 * `in-progress`, or after `completed`). Non-status updates are unconditional.
 *
 * A rejected status update is not an error — it means a newer state already
 * won the race — so it resolves to the current session rather than throwing.
 *
 * @param {string} tenantId
 * @param {string} callSessionId
 * @param {object} updates
 * @returns {Promise<object|null>} the session after the write
 */
export async function updateCallSession(tenantId, callSessionId, updates) {
  if (!tenantId) throw new Error('Tenant ID is required');

  const timestamp = new Date().toISOString();
  const updateData = { ...updates, updatedAt: timestamp };

  // Build update expression
  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  Object.keys(updateData).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = updateData[key];
  });

  let conditionExpression;

  // Update GSI1 and the ordering guard if status changed
  if (updates.status) {
    updateExpressions.push('#gsi1pk = :gsi1pk');
    attributeNames['#gsi1pk'] = 'GSI1PK';
    attributeValues[':gsi1pk'] = `TENANT#${tenantId}#STATUS#${updates.status}`;

    const newRank = CALL_STATUS_RANK[updates.status] ?? 0;
    updateExpressions.push('#statusRank = :newRank');
    attributeNames['#statusRank'] = 'statusRank';
    attributeValues[':newRank'] = newRank;

    // Sessions written before statusRank existed have no attribute — let
    // those through rather than blocking every update on legacy rows.
    conditionExpression = 'attribute_not_exists(#statusRank) OR #statusRank < :newRank';
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#CALL#${callSessionId}`,
        SK: 'SESSION',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues,
      ...(conditionExpression && { ConditionExpression: conditionExpression }),
    }));
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      logger.info('Skipped out-of-order call session status update', {
        tenantId,
        callSessionId,
        attemptedStatus: updates.status,
      });
      return getCallSession(tenantId, callSessionId);
    }
    throw error;
  }

  return getCallSession(tenantId, callSessionId);
}

export async function getCallsByStatus(tenantId, status, limit = 50) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'tenant-status-index',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#STATUS#${status}`,
    },
    ScanIndexForward: false,
    Limit: limit,
  }));
  
  return result.Items || [];
}

export async function getRecentCalls(tenantId, limit = 50) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'tenant-date-index',
    KeyConditionExpression: 'GSI2PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#CALLS`,
    },
    ScanIndexForward: false,
    Limit: limit,
  }));
  
  return result.Items || [];
}

// ============== Transcript Operations ==============

export async function addTranscriptEntry(tenantId, callSessionId, entry) {
  if (!tenantId || !callSessionId) throw new Error('Tenant ID and Call Session ID required');
  
  const timestamp = new Date().toISOString();
  const entryId = uuidv4();
  
  const transcriptEntry = {
    PK: `TENANT#${tenantId}#CALL#${callSessionId}`,
    SK: `TRANSCRIPT#${timestamp}#${entryId}`,
    EntityType: 'TRANSCRIPT_ENTRY',
    tenantId,
    callSessionId,
    entryId,
    speaker: entry.speaker, // 'customer' | 'ai' | 'system'
    text: entry.text,
    intent: entry.intent || null,
    dataSource: entry.dataSource || null,
    confidence: entry.confidence || null,
    timestamp,
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: transcriptEntry,
  }));
  
  return transcriptEntry;
}

export async function getTranscript(tenantId, callSessionId) {
  if (!tenantId || !callSessionId) throw new Error('Tenant ID and Call Session ID required');
  
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#CALL#${callSessionId}`,
      ':sk': 'TRANSCRIPT#',
    },
    ScanIndexForward: true,
  }));
  
  return result.Items || [];
}

// ============== Knowledge Document Operations ==============

export async function createKnowledgeDocument(tenantId, data) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const documentId = uuidv4();
  const timestamp = new Date().toISOString();
  
  const document = {
    PK: `TENANT#${tenantId}#KNOWLEDGE#${documentId}`,
    SK: 'DOCUMENT',
    EntityType: 'KNOWLEDGE_DOCUMENT',
    tenantId,
    documentId,
    name: data.name,
    category: data.category,
    s3Key: data.s3Key,
    fileType: data.fileType,
    fileSize: data.fileSize,
    status: DOCUMENT_STATUS.PROCESSING,
    chunksCreated: 0,
    error: null,
    uploadedBy: data.uploadedBy || 'system',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: document,
  }));
  
  logger.info('Knowledge document created', { documentId, tenantId, category: data.category });
  
  return document;
}

export async function getKnowledgeDocument(tenantId, documentId) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#KNOWLEDGE#${documentId}`,
      SK: 'DOCUMENT',
    },
  }));
  
  return result.Item || null;
}

export async function updateKnowledgeDocument(tenantId, documentId, updates) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const timestamp = new Date().toISOString();
  const updateData = { ...updates, updatedAt: timestamp };
  
  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};
  
  Object.keys(updateData).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = updateData[key];
  });
  
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#KNOWLEDGE#${documentId}`,
      SK: 'DOCUMENT',
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));
  
  return getKnowledgeDocument(tenantId, documentId);
}

export async function getKnowledgeDocuments(tenantId, category = null) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: category
      ? 'EntityType = :type AND tenantId = :tenantId AND category = :category'
      : 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'KNOWLEDGE_DOCUMENT',
      ':tenantId': tenantId,
      ...(category && { ':category': category }),
    },
  }));
  
  return result.Items || [];
}

export async function deleteKnowledgeDocument(tenantId, documentId) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#KNOWLEDGE#${documentId}`,
      SK: 'DOCUMENT',
    },
  }));
  
  return true;
}

// ============== Intent Configuration Operations ==============

export async function saveIntentConfig(tenantId, intentConfigs) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const timestamp = new Date().toISOString();
  
  const config = {
    PK: `TENANT#${tenantId}#INTENT_CONFIG`,
    SK: 'CONFIG',
    EntityType: 'INTENT_CONFIG',
    tenantId,
    intents: intentConfigs,
    updatedAt: timestamp,
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: config,
  }));
  
  return config;
}

export async function getIntentConfig(tenantId) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#INTENT_CONFIG`,
      SK: 'CONFIG',
    },
  }));
  
  return result.Item?.intents || null;
}

// ============== Agent Configuration Operations ==============

export async function saveAgentConfig(tenantId, agentConfig) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const timestamp = new Date().toISOString();
  
  const config = {
    PK: `TENANT#${tenantId}#AGENT_CONFIG`,
    SK: 'CONFIG',
    EntityType: 'AGENT_CONFIG',
    tenantId,
    agencyName: agentConfig.agencyName,
    // Optional per-tenant overrides. Left null, calls use the shared
    // ELEVENLABS_AGENT_ID / ELEVENLABS_AGENT_PHONE_NUMBER_ID — one agent
    // serves every tenant, personalized via dynamic variables.
    agentId: agentConfig.agentId || null,
    agentPhoneNumberId: agentConfig.agentPhoneNumberId || null,
    agentVoice: agentConfig.agentVoice || 'default',
    agentPersonality: agentConfig.agentPersonality || 'professional',
    greeting: agentConfig.greeting,
    fallbackMessage: agentConfig.fallbackMessage,
    exotelNumber: agentConfig.exotelNumber,
    maxCallDuration: agentConfig.maxCallDuration || 600,
    enableRecording: agentConfig.enableRecording !== false,
    escalationPhone: agentConfig.escalationPhone,
    updatedAt: timestamp,
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: config,
  }));
  
  return config;
}

export async function getAgentConfig(tenantId) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#AGENT_CONFIG`,
      SK: 'CONFIG',
    },
  }));
  
  return result.Item || null;
}

// ============== Metrics Operations ==============

export async function getCallMetrics(tenantId, startDate, endDate) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const calls = await getRecentCalls(tenantId, 1000);
  
  const filtered = calls.filter(call => {
    const callDate = call.createdAt;
    return (!startDate || callDate >= startDate) && (!endDate || callDate <= endDate);
  });
  
  const metrics = {
    totalCalls: filtered.length,
    completedCalls: 0,
    failedCalls: 0,
    noAnswerCalls: 0,
    avgDuration: 0,
    totalDuration: 0,
    byStatus: {},
    byPurpose: {},
    byOutcome: {},
  };
  
  filtered.forEach(call => {
    // Count by status
    metrics.byStatus[call.status] = (metrics.byStatus[call.status] || 0) + 1;
    
    if (call.status === CALL_STATUS.COMPLETED) {
      metrics.completedCalls++;
      metrics.totalDuration += call.duration || 0;
    } else if (call.status === CALL_STATUS.FAILED) {
      metrics.failedCalls++;
    } else if (call.status === CALL_STATUS.NO_ANSWER) {
      metrics.noAnswerCalls++;
    }
    
    // Count by purpose
    if (call.callPurpose) {
      metrics.byPurpose[call.callPurpose] = (metrics.byPurpose[call.callPurpose] || 0) + 1;
    }
    
    // Count by outcome
    if (call.outcome) {
      metrics.byOutcome[call.outcome] = (metrics.byOutcome[call.outcome] || 0) + 1;
    }
  });
  
  if (metrics.completedCalls > 0) {
    metrics.avgDuration = Math.round(metrics.totalDuration / metrics.completedCalls);
  }
  
  return metrics;
}

export default {
  createCallSession,
  getCallSession,
  updateCallSession,
  getCallsByStatus,
  getRecentCalls,
  addTranscriptEntry,
  getTranscript,
  createKnowledgeDocument,
  getKnowledgeDocument,
  updateKnowledgeDocument,
  getKnowledgeDocuments,
  deleteKnowledgeDocument,
  saveIntentConfig,
  getIntentConfig,
  saveAgentConfig,
  getAgentConfig,
  getCallMetrics,
};
