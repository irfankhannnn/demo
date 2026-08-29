/**
 * Conversation State Service
 * Manages multi-turn conversation state for WhatsApp interactions
 * Tracks conversation flow, context, and user intent across messages
 *
 * Keyed by `principal` (e.g. `wa:<phone>`) rather than a raw phone number,
 * so a future channel (e.g. `web:<userId>`) can share this same store --
 * see docs/proposals/agent-channel-architecture/phase2-imp/01-slice2a-session-principal-rekey.md
 * for why and how this migrated from the old phone-only key.
 *
 * getConversationState() falls back to the legacy phone-only key on a miss,
 * so an in-flight conversation isn't dropped at deploy time. Every write
 * always uses the new principal key; legacy rows are never backfilled and
 * simply expire on their own TTL (see TTL_SECONDS below).
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './logger.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME;
const TTL_SECONDS = parseInt(process.env.CONVERSATION_STATE_TTL_SECONDS || '86400', 10); // 24 hours

/**
 * Build partition key for conversation state from a principal
 * (e.g. `wa:919876543210`).
 */
function buildPk(tenantId, principal) {
  return `TENANT#${tenantId}#WHATSAPP#STATE#${principal}`;
}

/**
 * Build the legacy (pre-principal) partition key from a raw phone number --
 * only used as a one-time read fallback during the migration window.
 */
function buildLegacyPk(tenantId, phone) {
  return `TENANT#${tenantId}#WHATSAPP#STATE#${phone}`;
}

/** Extract the raw phone from a `wa:<phone>` principal, for the legacy-key fallback. */
function phoneFromWhatsAppPrincipal(principal) {
  return typeof principal === 'string' && principal.startsWith('wa:') ? principal.slice(3) : principal;
}

/**
 * Initialize conversation state for a new conversation
 * @param {string} tenantId
 * @param {string} principal - e.g. `wa:<phone>`
 * @param {object} initialContext - Initial context (leadId, userId, etc.)
 * @returns {Promise<Object>} Created state
 */
export async function initializeConversationState(tenantId, principal, initialContext = {}) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  const now = new Date().toISOString();
  const state = {
    PK: buildPk(tenantId, principal),
    SK: 'STATE#CURRENT',
    tenantId,
    principal,
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
    logger.info('conversationStateService.initialize.success', { tenantId, principal });
    return state;
  } catch (err) {
    logger.error('conversationStateService.initialize.failed', { tenantId, principal, error: err.message });
    throw err;
  }
}

/**
 * Get current conversation state. Falls back once to the legacy phone-only
 * key on a miss (WhatsApp principals only), so a conversation that started
 * before the principal re-key isn't dropped. Subsequent writes for this
 * principal always go under the new key.
 * @param {string} tenantId
 * @param {string} principal - e.g. `wa:<phone>`
 * @returns {Promise<Object|null>} Current state or null if not found
 */
export async function getConversationState(tenantId, principal) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildPk(tenantId, principal),
        SK: 'STATE#CURRENT',
      },
    }));
    if (result.Item) return result.Item;
  } catch (err) {
    logger.error('conversationStateService.get.failed', { tenantId, principal, error: err.message });
    return null;
  }

  // Dual-read fallback: try the legacy phone-only key for WhatsApp principals.
  if (typeof principal === 'string' && principal.startsWith('wa:')) {
    const legacyPhone = phoneFromWhatsAppPrincipal(principal);
    try {
      const legacyResult = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: buildLegacyPk(tenantId, legacyPhone),
          SK: 'STATE#CURRENT',
        },
      }));
      if (legacyResult.Item) {
        logger.info('conversationStateService.get.legacy_key_hit', { tenantId, principal });
        return legacyResult.Item;
      }
    } catch (err) {
      logger.error('conversationStateService.get.legacy_lookup_failed', { tenantId, principal, error: err.message });
    }
  }

  return null;
}

/**
 * Update conversation state
 * @param {string} tenantId
 * @param {string} principal - e.g. `wa:<phone>`
 * @param {object} updates - Fields to update
 * @returns {Promise<Object>} Updated state
 */
export async function updateConversationState(tenantId, principal, updates) {
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
        PK: buildPk(tenantId, principal),
        SK: 'STATE#CURRENT',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    }));

    logger.info('conversationStateService.update.success', { tenantId, principal, updates: Object.keys(updates) });
    return result.Attributes;
  } catch (err) {
    logger.error('conversationStateService.update.failed', { tenantId, principal, error: err.message });
    throw err;
  }
}

/**
 * Update intent for conversation
 * @param {string} tenantId
 * @param {string} principal
 * @param {string} intent - User's intent (inquiry, complaint, booking, etc.)
 * @returns {Promise<Object>} Updated state
 */
export async function updateConversationIntent(tenantId, principal, intent) {
  return updateConversationState(tenantId, principal, { intent });
}

/**
 * Update topic for conversation
 * @param {string} tenantId
 * @param {string} principal
 * @param {string} topic - Current topic being discussed
 * @returns {Promise<Object>} Updated state
 */
export async function updateConversationTopic(tenantId, principal, topic) {
  return updateConversationState(tenantId, principal, { topic });
}

/**
 * Increment message count and update last message time
 * @param {string} tenantId
 * @param {string} principal
 * @returns {Promise<Object>} Updated state
 */
export async function recordMessageInConversation(tenantId, principal) {
  const state = await getConversationState(tenantId, principal);
  const messageCount = (state?.messageCount || 0) + 1;
  return updateConversationState(tenantId, principal, {
    messageCount,
    lastMessageAt: new Date().toISOString(),
  });
}

/**
 * Reset conversation state if the last message is older than the given gap.
 * This prevents old intent/topic/entities from leaking into a new conversation.
 * @param {string} tenantId
 * @param {string} principal
 * @param {number} maxGapHours - Maximum allowed gap in hours before resetting
 * @param {object} initialContext - Context to use when re-initializing
 * @returns {Promise<Object|null>} Reset state or null if no reset needed
 */
export async function resetConversationStateIfStale(tenantId, principal, maxGapHours = 2, initialContext = {}) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  const state = await getConversationState(tenantId, principal);
  if (!state) return null;

  const lastMessageAt = state.lastMessageAt;
  if (lastMessageAt) {
    const lastTime = new Date(lastMessageAt).getTime();
    const now = Date.now();
    const gapMs = maxGapHours * 60 * 60 * 1000;
    if (now - lastTime > gapMs) {
      await deleteConversationState(tenantId, principal);
      logger.info('conversationStateService.reset_stale', { tenantId, principal, lastMessageAt, maxGapHours });
      return initializeConversationState(tenantId, principal, initialContext);
    }
  }
  return null;
}

/**
 * Close conversation
 * @param {string} tenantId
 * @param {string} principal
 * @param {string} resolution - How conversation was resolved
 * @returns {Promise<Object>} Updated state
 */
export async function closeConversation(tenantId, principal, resolution = 'completed') {
  return updateConversationState(tenantId, principal, {
    status: 'resolved',
    resolution,
    resolvedAt: new Date().toISOString(),
  });
}

/**
 * Pause conversation (can be resumed later)
 * @param {string} tenantId
 * @param {string} principal
 * @param {string} reason - Reason for pause
 * @returns {Promise<Object>} Updated state
 */
export async function pauseConversation(tenantId, principal, reason = 'awaiting_user_response') {
  return updateConversationState(tenantId, principal, {
    status: 'paused',
    pausedAt: new Date().toISOString(),
    pauseReason: reason,
  });
}

/**
 * Resume paused conversation
 * @param {string} tenantId
 * @param {string} principal
 * @returns {Promise<Object>} Updated state
 */
export async function resumeConversation(tenantId, principal) {
  return updateConversationState(tenantId, principal, {
    status: 'active',
    resumedAt: new Date().toISOString(),
  });
}

/**
 * Add context to conversation (merge with existing)
 * @param {string} tenantId
 * @param {string} principal
 * @param {object} contextUpdate - Context fields to add/update
 * @returns {Promise<Object>} Updated state
 */
export async function addContextToConversation(tenantId, principal, contextUpdate) {
  const state = await getConversationState(tenantId, principal);
  const mergedContext = { ...state?.context, ...contextUpdate };
  return updateConversationState(tenantId, principal, { context: mergedContext });
}

function unwrapToolPayload(data) {
  if (!data || typeof data !== 'object') return data;
  // AI DTO envelope { metadata, data }
  if (data.metadata && typeof data.metadata === 'object' && 'data' in data) {
    return data.data;
  }
  return data;
}

function entityIdFromItem(item) {
  return item.id || item.leadId || item.propertyId || item.buyerId
    || item.customerId || item.tenantRecordId || item.ownerId || item.contactId
    || item.meetingId || null;
}

function entityTypeFromTool(toolName) {
  const t = String(toolName || '');
  if (t.includes('lead')) return 'lead';
  if (t.includes('buyer')) return 'buyer';
  if (t.includes('owner')) return 'owner';
  if (t.includes('tenant') || t.includes('customer')) return 'tenant';
  if (t.includes('property')) return 'property';
  if (t.includes('contact')) return 'contact';
  if (t.includes('meeting')) return 'meeting';
  return 'record';
}

function listItemsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.leads)) return payload.leads;
  if (Array.isArray(payload.buyers)) return payload.buyers;
  if (Array.isArray(payload.owners)) return payload.owners;
  if (Array.isArray(payload.customers)) return payload.customers;
  if (Array.isArray(payload.properties)) return payload.properties;
  if (Array.isArray(payload.contacts)) return payload.contacts;
  if (Array.isArray(payload.meetings)) return payload.meetings;
  return null;
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
    const data = unwrapToolPayload(result.data);
    if (!data || typeof data !== 'object') continue;

    const MAX_ENTITY_NAME_LEN = 100;
    const MAX_ENTITY_ID_LEN = 50;
    const MAX_ENTITY_PHONE_LEN = 20;
    const type = entityTypeFromTool(tc.tool);

    const items = listItemsFromPayload(data);
    if (Array.isArray(items)) {
      for (const item of items.slice(0, 5)) {
        if (!item || typeof item !== 'object') continue;
        const name = item.name || item.leadName || item.propertyTitle || item.title;
        if (!name) continue;
        const id = entityIdFromItem(item);
        entities.push({
          type,
          name: String(name).slice(0, MAX_ENTITY_NAME_LEN),
          id: id ? String(id).slice(0, MAX_ENTITY_ID_LEN) : null,
          phone: (item.phone || item.contactPhone || null)
            ? String(item.phone || item.contactPhone).slice(0, MAX_ENTITY_PHONE_LEN) : null,
          source: String(tc.tool || 'unknown').slice(0, MAX_ENTITY_NAME_LEN),
        });
      }
    } else {
      const name = data.name || data.leadName || data.propertyTitle || data.title;
      if (name) {
        const id = entityIdFromItem(data);
        entities.push({
          type,
          name: String(name).slice(0, MAX_ENTITY_NAME_LEN),
          id: id ? String(id).slice(0, MAX_ENTITY_ID_LEN) : null,
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
 * Build indexed lastListResults + currentEntity from tool results (Interaction Design memory).
 */
export function extractListAndFocusFromToolResults(toolResults) {
  let lastListResults = null;
  let currentEntity = null;
  if (!Array.isArray(toolResults)) return { lastListResults, currentEntity };

  for (const tc of toolResults) {
    if (!tc?.result?.ok) continue;
    const payload = unwrapToolPayload(tc.result.data);
    if (!payload || typeof payload !== 'object') continue;
    const type = entityTypeFromTool(tc.tool);
    const items = listItemsFromPayload(payload);
    if (Array.isArray(items) && items.length > 0) {
      lastListResults = items.slice(0, 10).map((item, idx) => ({
        index: idx + 1,
        type,
        id: entityIdFromItem(item) || null,
        name: item.name || item.title || null,
      }));
      if (items.length === 1) {
        const only = items[0];
        currentEntity = {
          type,
          id: entityIdFromItem(only) || null,
          name: only.name || only.title || null,
        };
      }
    } else if (entityIdFromItem(payload) || payload.name || payload.title) {
      currentEntity = {
        type,
        id: entityIdFromItem(payload) || null,
        name: payload.name || payload.title || null,
      };
    }
  }
  return { lastListResults, currentEntity };
}

/**
 * Update the most recently discussed entities in conversation state
 * @param {string} tenantId
 * @param {string} principal
 * @param {Array} entities - Entities extracted from tool results
 * @param {string} topic - Optional topic override
 * @param {object} [extra] - Optional { lastListResults, currentEntity }
 * @returns {Promise<Object>} Updated state
 */
export async function updateLastDiscussedEntities(tenantId, principal, entities, topic, extra = {}) {
  if ((!Array.isArray(entities) || entities.length === 0)
    && !extra.lastListResults && !extra.currentEntity) {
    return null;
  }
  const state = await getConversationState(tenantId, principal);
  const existing = state?.context?.lastDiscussedEntities || [];
  const byId = new Map();
  const byName = new Map();
  for (const e of [...(entities || []), ...existing]) {
    if (!e || typeof e !== 'object') continue;
    if (e.id) {
      if (!byId.has(e.id)) byId.set(e.id, e);
    } else if (e.name) {
      if (!byName.has(e.name)) byName.set(e.name, e);
    }
  }
  const merged = [...byId.values(), ...byName.values()].slice(0, 5);
  const context = {
    ...state?.context,
    lastDiscussedEntities: merged,
  };
  if (extra.lastListResults) context.lastListResults = extra.lastListResults;
  if (extra.currentEntity) context.currentEntity = extra.currentEntity;
  const updates = { context };
  if (topic) updates.topic = topic;
  return updateConversationState(tenantId, principal, updates);
}

/**
 * Delete conversation state (cleanup)
 * @param {string} tenantId
 * @param {string} principal
 * @returns {Promise<void>}
 */
export async function deleteConversationState(tenantId, principal) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  try {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildPk(tenantId, principal),
        SK: 'STATE#CURRENT',
      },
    }));
    logger.info('conversationStateService.delete.success', { tenantId, principal });
  } catch (err) {
    logger.error('conversationStateService.delete.failed', { tenantId, principal, error: err.message });
    throw err;
  }
}

/**
 * Get conversation summary for display
 * @param {string} tenantId
 * @param {string} principal
 * @returns {Promise<Object>} Summary of conversation state
 */
export async function getConversationSummary(tenantId, principal) {
  const state = await getConversationState(tenantId, principal);
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
