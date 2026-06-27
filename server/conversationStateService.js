/**
 * Conversation State Service
 * Manages multi-turn conversation state for WhatsApp interactions
 * Tracks conversation flow, context, and user intent across messages
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './logger.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME;
const TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Build partition key for conversation state
 */
function buildPk(tenantId, contactPhone) {
  return `TENANT#${tenantId}#WHATSAPP#STATE#${contactPhone}`;
}

/**
 * Initialize conversation state for a new conversation
 * @param {string} tenantId
 * @param {string} contactPhone
 * @param {object} initialContext - Initial context (leadId, userId, etc.)
 * @returns {Promise<Object>} Created state
 */
export async function initializeConversationState(tenantId, contactPhone, initialContext = {}) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  const now = new Date().toISOString();
  const state = {
    PK: buildPk(tenantId, contactPhone),
    SK: 'STATE#CURRENT',
    tenantId,
    contactPhone,
    status: 'active', // active, paused, resolved
    intent: null, // user's primary intent (e.g., 'inquiry', 'complaint', 'booking')
    topic: null, // current topic being discussed
    messageCount: 0,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
    expiresAt: Math.floor(Date.now() / 1000) + TTL_SECONDS,
    context: initialContext,
    metadata: {
      platform: 'whatsapp',
      version: 1,
    },
  };

  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: state,
    }));
    logger.info('conversationStateService.initialize.success', { tenantId, contactPhone });
    return state;
  } catch (err) {
    logger.error('conversationStateService.initialize.failed', { tenantId, contactPhone, error: err.message });
    throw err;
  }
}

/**
 * Get current conversation state
 * @param {string} tenantId
 * @param {string} contactPhone
 * @returns {Promise<Object|null>} Current state or null if not found
 */
export async function getConversationState(tenantId, contactPhone) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildPk(tenantId, contactPhone),
        SK: 'STATE#CURRENT',
      },
    }));
    return result.Item || null;
  } catch (err) {
    logger.error('conversationStateService.get.failed', { tenantId, contactPhone, error: err.message });
    return null;
  }
}

/**
 * Update conversation state
 * @param {string} tenantId
 * @param {string} contactPhone
 * @param {object} updates - Fields to update
 * @returns {Promise<Object>} Updated state
 */
export async function updateConversationState(tenantId, contactPhone, updates) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  const now = new Date().toISOString();
  const updateExpressions = ['updatedAt = :updatedAt', 'expiresAt = :expiresAt'];
  const expressionAttributeValues = {
    ':updatedAt': now,
    ':expiresAt': Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const expressionAttributeNames = {};

  // Build dynamic update expression
  Object.keys(updates).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrValue] = updates[key];
  });

  try {
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildPk(tenantId, contactPhone),
        SK: 'STATE#CURRENT',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    }));

    logger.info('conversationStateService.update.success', { tenantId, contactPhone, updates: Object.keys(updates) });
    return result.Attributes;
  } catch (err) {
    logger.error('conversationStateService.update.failed', { tenantId, contactPhone, error: err.message });
    throw err;
  }
}

/**
 * Update intent for conversation
 * @param {string} tenantId
 * @param {string} contactPhone
 * @param {string} intent - User's intent (inquiry, complaint, booking, etc.)
 * @returns {Promise<Object>} Updated state
 */
export async function updateConversationIntent(tenantId, contactPhone, intent) {
  return updateConversationState(tenantId, contactPhone, { intent });
}

/**
 * Update topic for conversation
 * @param {string} tenantId
 * @param {string} contactPhone
 * @param {string} topic - Current topic being discussed
 * @returns {Promise<Object>} Updated state
 */
export async function updateConversationTopic(tenantId, contactPhone, topic) {
  return updateConversationState(tenantId, contactPhone, { topic });
}

/**
 * Increment message count and update last message time
 * @param {string} tenantId
 * @param {string} contactPhone
 * @returns {Promise<Object>} Updated state
 */
export async function recordMessageInConversation(tenantId, contactPhone) {
  const state = await getConversationState(tenantId, contactPhone);
  const messageCount = (state?.messageCount || 0) + 1;
  return updateConversationState(tenantId, contactPhone, {
    messageCount,
    lastMessageAt: new Date().toISOString(),
  });
}

/**
 * Reset conversation state if the last message is older than the given gap.
 * This prevents old intent/topic/entities from leaking into a new conversation.
 * @param {string} tenantId
 * @param {string} contactPhone
 * @param {number} maxGapHours - Maximum allowed gap in hours before resetting
 * @param {object} initialContext - Context to use when re-initializing
 * @returns {Promise<Object|null>} Reset state or null if no reset needed
 */
export async function resetConversationStateIfStale(tenantId, contactPhone, maxGapHours = 2, initialContext = {}) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  const state = await getConversationState(tenantId, contactPhone);
  if (!state) return null;

  const lastMessageAt = state.lastMessageAt;
  if (lastMessageAt) {
    const lastTime = new Date(lastMessageAt).getTime();
    const now = Date.now();
    const gapMs = maxGapHours * 60 * 60 * 1000;
    if (now - lastTime > gapMs) {
      await deleteConversationState(tenantId, contactPhone);
      logger.info('conversationStateService.reset_stale', { tenantId, contactPhone, lastMessageAt, maxGapHours });
      return initializeConversationState(tenantId, contactPhone, initialContext);
    }
  }
  return null;
}

/**
 * Close conversation
 * @param {string} tenantId
 * @param {string} contactPhone
 * @param {string} resolution - How conversation was resolved
 * @returns {Promise<Object>} Updated state
 */
export async function closeConversation(tenantId, contactPhone, resolution = 'completed') {
  return updateConversationState(tenantId, contactPhone, {
    status: 'resolved',
    resolution,
    resolvedAt: new Date().toISOString(),
  });
}

/**
 * Pause conversation (can be resumed later)
 * @param {string} tenantId
 * @param {string} contactPhone
 * @param {string} reason - Reason for pause
 * @returns {Promise<Object>} Updated state
 */
export async function pauseConversation(tenantId, contactPhone, reason = 'awaiting_user_response') {
  return updateConversationState(tenantId, contactPhone, {
    status: 'paused',
    pausedAt: new Date().toISOString(),
    pauseReason: reason,
  });
}

/**
 * Resume paused conversation
 * @param {string} tenantId
 * @param {string} contactPhone
 * @returns {Promise<Object>} Updated state
 */
export async function resumeConversation(tenantId, contactPhone) {
  return updateConversationState(tenantId, contactPhone, {
    status: 'active',
    resumedAt: new Date().toISOString(),
  });
}

/**
 * Add context to conversation (merge with existing)
 * @param {string} tenantId
 * @param {string} contactPhone
 * @param {object} contextUpdate - Context fields to add/update
 * @returns {Promise<Object>} Updated state
 */
export async function addContextToConversation(tenantId, contactPhone, contextUpdate) {
  const state = await getConversationState(tenantId, contactPhone);
  const mergedContext = { ...state?.context, ...contextUpdate };
  return updateConversationState(tenantId, contactPhone, { context: mergedContext });
}

/**
 * Extract entities from tool results for context tracking
 * @param {Array} toolResults - Array of { tool, result } objects
 * @returns {Array} Extracted entities with type, name, id, and metadata
 */
export function extractEntitiesFromToolResults(toolResults) {
  const entities = [];
  if (!Array.isArray(toolResults)) return entities;

  for (const tc of toolResults) {
    if (!tc || typeof tc !== 'object') continue;
    const result = tc.result;
    if (!result || !result.ok) continue;
    const data = result.data;
    if (!data || typeof data !== 'object') continue;

    const MAX_ENTITY_NAME_LEN = 100;
    const MAX_ENTITY_ID_LEN = 50;
    const MAX_ENTITY_PHONE_LEN = 20;

    // Array results (search_*)
    const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : null);
    if (Array.isArray(items)) {
      for (const item of items.slice(0, 3)) {
        if (!item || typeof item !== 'object') continue;
        const name = item.name || item.leadName || item.propertyTitle || item.title;
        if (!name) continue;
        entities.push({
          type: String(tc.tool || 'unknown').replace(/^(search_|get_|create_)/, '').replace(/s$/, '').slice(0, MAX_ENTITY_NAME_LEN),
          name: String(name).slice(0, MAX_ENTITY_NAME_LEN),
          id: (item.id || item.leadId || item.propertyId || item.buyerId || item.tenantId || item.ownerId || null)
            ? String(item.id || item.leadId || item.propertyId || item.buyerId || item.tenantId || item.ownerId).slice(0, MAX_ENTITY_ID_LEN) : null,
          phone: (item.phone || item.contactPhone || null)
            ? String(item.phone || item.contactPhone).slice(0, MAX_ENTITY_PHONE_LEN) : null,
          source: String(tc.tool || 'unknown').slice(0, MAX_ENTITY_NAME_LEN),
        });
      }
    } else {
      // Single result (get_*)
      const name = data.name || data.leadName || data.propertyTitle || data.title;
      if (name) {
        entities.push({
          type: String(tc.tool || 'unknown').replace(/^(search_|get_|create_)/, '').replace(/s$/, '').slice(0, MAX_ENTITY_NAME_LEN),
          name: String(name).slice(0, MAX_ENTITY_NAME_LEN),
          id: (data.id || data.leadId || data.propertyId || data.buyerId || data.tenantId || data.ownerId || null)
            ? String(data.id || data.leadId || data.propertyId || data.buyerId || data.tenantId || data.ownerId).slice(0, MAX_ENTITY_ID_LEN) : null,
          phone: (data.phone || data.contactPhone || null)
            ? String(data.phone || data.contactPhone).slice(0, MAX_ENTITY_PHONE_LEN) : null,
          source: String(tc.tool || 'unknown').slice(0, MAX_ENTITY_NAME_LEN),
        });
      }
    }
  }

  return entities;
}

/**
 * Update the most recently discussed entities in conversation state
 * @param {string} tenantId
 * @param {string} contactPhone
 * @param {Array} entities - Entities extracted from tool results
 * @param {string} topic - Optional topic override
 * @returns {Promise<Object>} Updated state
 */
export async function updateLastDiscussedEntities(tenantId, contactPhone, entities, topic) {
  if (!Array.isArray(entities) || entities.length === 0) return null;
  const state = await getConversationState(tenantId, contactPhone);
  const existing = state?.context?.lastDiscussedEntities || [];
  // Keep the most recent entities at the top, deduplicate by id (or name for id-less entities)
  const byId = new Map();
  const byName = new Map();
  for (const e of [...entities, ...existing]) {
    if (!e || typeof e !== 'object') continue;
    if (e.id) {
      if (!byId.has(e.id)) byId.set(e.id, e);
    } else if (e.name) {
      if (!byName.has(e.name)) byName.set(e.name, e);
    }
  }
  const merged = [...byId.values(), ...byName.values()].slice(0, 5);
  const updates = { context: { ...state?.context, lastDiscussedEntities: merged } };
  if (topic) updates.topic = topic;
  return updateConversationState(tenantId, contactPhone, updates);
}

/**
 * Delete conversation state (cleanup)
 * @param {string} tenantId
 * @param {string} contactPhone
 * @returns {Promise<void>}
 */
export async function deleteConversationState(tenantId, contactPhone) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  try {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildPk(tenantId, contactPhone),
        SK: 'STATE#CURRENT',
      },
    }));
    logger.info('conversationStateService.delete.success', { tenantId, contactPhone });
  } catch (err) {
    logger.error('conversationStateService.delete.failed', { tenantId, contactPhone, error: err.message });
    throw err;
  }
}

/**
 * Get conversation summary for display
 * @param {string} tenantId
 * @param {string} contactPhone
 * @returns {Promise<Object>} Summary of conversation state
 */
export async function getConversationSummary(tenantId, contactPhone) {
  const state = await getConversationState(tenantId, contactPhone);
  if (!state) return null;

  return {
    status: state.status,
    intent: state.intent,
    topic: state.topic,
    messageCount: state.messageCount,
    lastMessageAt: state.lastMessageAt,
    createdAt: state.createdAt,
    context: state.context,
  };
}
