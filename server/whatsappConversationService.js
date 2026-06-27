import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand, UpdateCommand, DeleteCommand, BatchGetCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from './logger.js';
import { getAgencyConfig } from './agencyConfigService.js';
import { normalizeWhatsAppPhone, classifyWhatsAppId } from './utils/whatsapp.js';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME;

const META_READ_SK = 'META#read';
const TTL_SECONDS = 90 * 24 * 60 * 60;
// Only include messages from the last N hours when building LLM conversation context.
// This prevents old, unrelated conversations from leaking into the current reply.
const CONTEXT_TIME_WINDOW_HOURS = 2;
// Group chats can accumulate many messages quickly; cap context for groups to avoid
// bloating the LLM prompt and keep replies focused on the recent conversation.
const MAX_GROUP_CONTEXT_MESSAGES = 20;

const WHITELISTED_NUMBERS = (process.env.AI_ADMIN_WHATSAPP_NUMBERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map(normalizeWhatsAppPhone);

function isAllowedConversation(contactPhone, connectedPhone) {
  if (!contactPhone) return false;
  const { type } = classifyWhatsAppId(contactPhone);
  if (type === 'group' || type === 'lid') return false;

  const normalizedContact = normalizeWhatsAppPhone(contactPhone);
  if (!normalizedContact) return false;

  const normalizedConnected = normalizeWhatsAppPhone(connectedPhone);
  if (normalizedConnected && normalizedContact === normalizedConnected) return true;

  return WHITELISTED_NUMBERS.includes(normalizedContact);
}

function buildPk(tenantId, contactPhone) {
  return `TENANT#${tenantId}#WHATSAPP#${contactPhone}`;
}

function buildSk(timestamp, messageId) {
  return `MESSAGE#${timestamp}#${messageId}`;
}

function buildGsi3Pk(tenantId) {
  return `TENANT#${tenantId}#WHATSAPP`;
}

function buildGsi3Sk(timestamp, contactPhone) {
  return `MESSAGE#${timestamp}#CONTACT#${contactPhone}`;
}

function encodeStartKey(key) {
  return Buffer.from(JSON.stringify(key)).toString('base64');
}

function decodeStartKey(key) {
  return JSON.parse(Buffer.from(key, 'base64').toString());
}

function formatMessage(item) {
  if (!item) return null;
  return {
    messageId: item.messageId,
    direction: item.direction,
    from: item.from,
    to: item.to,
    text: item.text,
    fromMe: item.fromMe,
    aiGenerated: item.aiGenerated,
    toolCalls: item.toolCalls || [],
    creditsCharged: item.creditsCharged || 0,
    status: item.status,
    createdAt: item.createdAt,
    isGroup: item.isGroup ?? false,
  };
}

async function getReadMeta(tenantId, contactPhone) {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: buildPk(tenantId, contactPhone), SK: META_READ_SK },
    }));
    return result.Item || null;
  } catch (err) {
    logger.error('whatsappConversationService.getReadMeta.failed', { tenantId, contactPhone, error: err.message });
    return null;
  }
}

/**
 * Batch fetch read meta for multiple contacts (reduces N+1 queries)
 * @param {string} tenantId
 * @param {Array<string>} contactPhones
 * @returns {Promise<Map<string, Object|null>>} Map of contactPhone -> meta
 */
async function batchGetReadMeta(tenantId, contactPhones) {
  const result = new Map();
  if (!contactPhones.length) return result;

  // BatchGetItem supports max 100 items per request
  const chunks = [];
  for (let i = 0; i < contactPhones.length; i += 100) {
    chunks.push(contactPhones.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const response = await docClient.send(new BatchGetCommand({
        RequestItems: {
          [TABLE_NAME]: {
            Keys: chunk.map(phone => ({
              PK: buildPk(tenantId, phone),
              SK: META_READ_SK,
            })),
          },
        },
      }));
      const items = response.Responses?.[TABLE_NAME] || [];
      for (const item of items) {
        result.set(item.contactPhone, item);
      }
      // Mark missing phones as null
      for (const phone of chunk) {
        if (!result.has(phone)) result.set(phone, null);
      }
    } catch (err) {
      logger.error('whatsappConversationService.batchGetReadMeta.failed', { tenantId, error: err.message });
      // Fall back to null for all
      for (const phone of chunk) {
        if (!result.has(phone)) result.set(phone, null);
      }
    }
  }
  return result;
}

async function countUnread(tenantId, contactPhone, lastReadAt) {
  if (!lastReadAt) return 0;
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK > :lastReadSk',
      FilterExpression: 'direction = :inbound',
      ExpressionAttributeValues: {
        ':pk': buildPk(tenantId, contactPhone),
        ':lastReadSk': buildSk(lastReadAt, ''),
        ':inbound': 'inbound',
      },
      Select: 'COUNT',
    }));
    return result.Count || 0;
  } catch (err) {
    logger.error('whatsappConversationService.countUnread.failed', { tenantId, contactPhone, error: err.message });
    return 0;
  }
}

export async function logMessage(tenantId, contactPhone, message) {
  if (!TABLE_NAME) {
    throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');
  }

  const now = new Date().toISOString();
  const timestamp = (() => {
    if (!message.createdAt) return now;
    const d = new Date(message.createdAt);
    return isNaN(d.getTime()) ? now : d.toISOString();
  })();
  const item = {
    PK: buildPk(tenantId, contactPhone),
    SK: buildSk(timestamp, message.messageId),
    GSI3PK: buildGsi3Pk(tenantId),
    GSI3SK: buildGsi3Sk(timestamp, contactPhone),
    tenantId,
    contactPhone,
    messageId: message.messageId,
    direction: message.direction || 'inbound',
    from: message.from,
    to: message.to,
    text: message.text,
    fromMe: message.fromMe ?? false,
    aiGenerated: message.aiGenerated ?? false,
    toolCalls: message.toolCalls || [],
    creditsCharged: message.creditsCharged || 0,
    status: message.status || (message.direction === 'outbound' ? 'sent' : 'received'),
    createdAt: timestamp,
    expiresAt: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  if (message.replyPending !== undefined) {
    item.replyPending = message.replyPending;
  }
  if (message.isGroup !== undefined) {
    item.isGroup = message.isGroup;
  }

  try {
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    logger.info('whatsappConversationService.logMessage.success', { tenantId, contactPhone, messageId: message.messageId });
  } catch (err) {
    logger.error('whatsappConversationService.logMessage.failed', { tenantId, contactPhone, messageId: message.messageId, error: err.message });
    throw err;
  }
}

export async function getConversation(tenantId, contactPhone, { limit = 20, startKey } = {}) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  const decodedStartKey = startKey ? decodeStartKey(startKey) : undefined;
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': buildPk(tenantId, contactPhone),
      ':prefix': 'MESSAGE#',
    },
    ScanIndexForward: false,
    Limit: Math.min(Number(limit), 100),
    ...(decodedStartKey && { ExclusiveStartKey: decodedStartKey }),
  }));

  const messages = (result.Items || []).map(formatMessage);
  return {
    contactPhone,
    messages,
    nextKey: result.LastEvaluatedKey ? encodeStartKey(result.LastEvaluatedKey) : undefined,
  };
}

export async function getConversationSummary(tenantId, contactPhone) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  const [latest, meta] = await Promise.all([
    getConversation(tenantId, contactPhone, { limit: 1 }),
    getReadMeta(tenantId, contactPhone),
  ]);
  const unreadCount = await countUnread(tenantId, contactPhone, meta?.lastReadAt);
  const lastMsg = latest.messages[0];

  return {
    contactPhone,
    lastMessage: lastMsg?.text || '',
    lastMessageAt: lastMsg?.createdAt,
    unreadCount,
    lastReadAt: meta?.lastReadAt || null,
  };
}

/**
 * Check if a message with the given messageId already exists for a contact.
 * Used by the WhatsApp processor to deduplicate retries/offline messages.
 * @param {string} tenantId
 * @param {string} contactPhone
 * @param {string} messageId
 * @returns {Promise<boolean>} true if the message was already processed
 */
export async function hasMessage(tenantId, contactPhone, messageId) {
  if (!TABLE_NAME || !messageId) return false;

  const normalizedPhone = normalizeWhatsAppPhone(contactPhone);
  if (!normalizedPhone) return false;

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: 'messageId = :messageId',
      ExpressionAttributeValues: {
        ':pk': buildPk(tenantId, normalizedPhone),
        ':prefix': 'MESSAGE#',
        ':messageId': messageId,
      },
      ScanIndexForward: false,
      Limit: 200,
    }));
    return (result.Items || []).length > 0;
  } catch (err) {
    logger.error('whatsappConversationService.hasMessage.failed', { tenantId, contactPhone, messageId, error: err.message });
    return false; // Allow processing if check fails
  }
}

/**
 * Retrieve a message by its messageId for a contact.
 * Returns the raw item or null if not found.
 */
export async function getMessageById(tenantId, contactPhone, messageId) {
  if (!TABLE_NAME || !messageId) return null;

  const normalizedPhone = normalizeWhatsAppPhone(contactPhone);
  if (!normalizedPhone) return null;

  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: 'messageId = :messageId',
      ExpressionAttributeValues: {
        ':pk': buildPk(tenantId, normalizedPhone),
        ':prefix': 'MESSAGE#',
        ':messageId': messageId,
      },
      ScanIndexForward: false,
      Limit: 200,
    }));
    return result.Items?.[0] || null;
  } catch (err) {
    logger.error('whatsappConversationService.getMessageById.failed', { tenantId, contactPhone, messageId, error: err.message });
    return null;
  }
}

/**
 * Mark the replyPending flag on the inbound message with the given messageId.
 * Used by the processor to ensure one inbound message yields exactly one reply.
 */
export async function updateMessageReplyPending(tenantId, contactPhone, messageId, replyPending) {
  if (!TABLE_NAME || !messageId) return;

  const normalizedPhone = normalizeWhatsAppPhone(contactPhone);
  if (!normalizedPhone) return;

  const message = await getMessageById(tenantId, normalizedPhone, messageId);
  if (!message) return;

  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: message.PK, SK: message.SK },
      UpdateExpression: 'SET replyPending = :replyPending',
      ExpressionAttributeValues: { ':replyPending': replyPending },
    }));
  } catch (err) {
    logger.error('whatsappConversationService.updateMessageReplyPending.failed', { tenantId, contactPhone, messageId, error: err.message });
    throw err;
  }
}

const DEDUP_TTL_SECONDS = 5 * 60; // 5 minutes

/**
 * Build the sort key for a message processing dedup claim.
 */
function buildDedupSk(messageId) {
  return `DEDUP#${messageId}`;
}

async function getDedupClaim(tenantId, contactPhone, messageId) {
  if (!TABLE_NAME || !messageId) return null;

  const normalizedPhone = normalizeWhatsAppPhone(contactPhone);
  if (!normalizedPhone) return null;

  try {
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: buildPk(tenantId, normalizedPhone), SK: buildDedupSk(messageId) },
    }));
    return result.Item || null;
  } catch (err) {
    logger.error('whatsappConversationService.getDedupClaim.failed', { tenantId, contactPhone, messageId, error: err.message });
    return null;
  }
}

/**
 * Atomically claim the right to process a message.
 * Uses a DynamoDB conditional Put to ensure only one Lambda invocation
 * processes the message. If an existing claim is stuck in 'processing' for
 * longer than the stale threshold, it is stolen by the new invocation.
 * @returns {Promise<{ claimed: boolean, reason?: string, stolen?: boolean }>}
 */
export async function claimMessageProcessing(tenantId, contactPhone, messageId) {
  if (!TABLE_NAME || !messageId) return { claimed: false, reason: 'invalid_input' };

  const normalizedPhone = normalizeWhatsAppPhone(contactPhone);
  if (!normalizedPhone) return { claimed: false, reason: 'invalid_phone' };

  const pk = buildPk(tenantId, normalizedPhone);
  const sk = buildDedupSk(messageId);
  const now = Date.now();
  const claimedAt = new Date(now).toISOString();

  try {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: pk,
        SK: sk,
        tenantId,
        contactPhone: normalizedPhone,
        messageId,
        status: 'processing',
        claimedAt,
        expiresAt: Math.floor(now / 1000) + DEDUP_TTL_SECONDS,
      },
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    }));
    return { claimed: true };
  } catch (err) {
    if (err.name !== 'ConditionalCheckFailedException') {
      logger.error('whatsappConversationService.claimMessageProcessing.failed', { tenantId, contactPhone, messageId, error: err.message });
      return { claimed: false, reason: 'error' };
    }

    const existing = await getDedupClaim(tenantId, normalizedPhone, messageId);
    if (!existing) return { claimed: false, reason: 'claim_missing' };
    if (existing.status === 'completed') return { claimed: false, reason: 'already_completed' };

    const claimedTime = new Date(existing.claimedAt).getTime();
    const staleThreshold = now - DEDUP_TTL_SECONDS * 1000;
    if (claimedTime < staleThreshold) {
      try {
        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { PK: pk, SK: sk },
          UpdateExpression: 'SET #status = :status, claimedAt = :claimedAt, expiresAt = :expiresAt',
          ConditionExpression: '#status = :processing AND claimedAt < :threshold',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'processing',
            ':processing': 'processing',
            ':claimedAt': claimedAt,
            ':expiresAt': Math.floor(now / 1000) + DEDUP_TTL_SECONDS,
            ':threshold': new Date(staleThreshold).toISOString(),
          },
        }));
        return { claimed: true, stolen: true };
      } catch (stealErr) {
        // The steal may have failed because the stale claim was deleted by TTL
        // cleanup between our read and the update. Try a fresh conditional put in
        // that case. If the row now exists (e.g., another Lambda claimed it), this
        // will safely fail with ConditionalCheckFailedException.
        if (stealErr.name === 'ConditionalCheckFailedException') {
          try {
            await docClient.send(new PutCommand({
              TableName: TABLE_NAME,
              Item: {
                PK: pk,
                SK: sk,
                tenantId,
                contactPhone: normalizedPhone,
                messageId,
                status: 'processing',
                claimedAt,
                expiresAt: Math.floor(now / 1000) + DEDUP_TTL_SECONDS,
              },
              ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
            }));
            return { claimed: true, stolen: true };
          } catch (retryErr) {
            // Another writer won the race; fall through to processing.
          }
        }
        return { claimed: false, reason: 'processing' };
      }
    }
    return { claimed: false, reason: 'processing' };
  }
}

/**
 * Mark a message processing claim as completed.
 */
export async function markMessageProcessingComplete(tenantId, contactPhone, messageId) {
  if (!TABLE_NAME || !messageId) return;

  const normalizedPhone = normalizeWhatsAppPhone(contactPhone);
  if (!normalizedPhone) return;

  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: buildPk(tenantId, normalizedPhone), SK: buildDedupSk(messageId) },
      UpdateExpression: 'SET #status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'completed' },
    }));
  } catch (err) {
    logger.error('whatsappConversationService.markMessageProcessingComplete.failed', { tenantId, contactPhone, messageId, error: err.message });
  }
}

/**
 * Mark a message processing claim as failed so a Lambda/EventBridge retry can
 * reclaim it immediately. This is used when the WhatsApp reply could not be
 * delivered (e.g., Baileys connection queued but never sent).
 */
export async function markMessageProcessingFailed(tenantId, contactPhone, messageId) {
  if (!TABLE_NAME || !messageId) return;

  const normalizedPhone = normalizeWhatsAppPhone(contactPhone);
  if (!normalizedPhone) return;

  try {
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: buildPk(tenantId, normalizedPhone), SK: buildDedupSk(messageId) },
    }));
    logger.warn('whatsappConversationService.markMessageProcessingFailed', { tenantId, contactPhone, messageId, reason: 'reply_delivery_failed' });
  } catch (err) {
    logger.error('whatsappConversationService.markMessageProcessingFailed.error', { tenantId, contactPhone, messageId, error: err.message });
  }
}

export async function listConversations(tenantId, { limit = 20, startKey } = {}) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  const targetLimit = Math.min(Number(limit), 100);
  const pageSize = Math.max(targetLimit, 50);
  const maxScanned = targetLimit * 20; // safety cap to avoid runaway scans
  let exclusiveStartKey = startKey ? decodeStartKey(startKey) : undefined;
  const byPhone = new Map();
  const allowedPhones = new Set();
  let totalScanned = 0;
  let lastEvaluatedKey = undefined;

  let agencyConfig;
  try {
    agencyConfig = await getAgencyConfig(tenantId);
  } catch (err) {
    logger.error('whatsappConversationService.listConversations.getAgencyConfig.failed', { tenantId, error: err.message });
    agencyConfig = {};
  }
  const connectedPhone = agencyConfig?.connectedWhatsAppPhone || '';
  const isFiltering = WHITELISTED_NUMBERS.length > 0 || !!connectedPhone;

  while (totalScanned < maxScanned) {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'search-index',
      KeyConditionExpression: 'GSI3PK = :pk',
      ExpressionAttributeValues: { ':pk': buildGsi3Pk(tenantId) },
      ScanIndexForward: false,
      Limit: pageSize,
      ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
    }));

    const items = result.Items || [];
    totalScanned += items.length;
    lastEvaluatedKey = result.LastEvaluatedKey;

    for (const item of items) {
      if (!byPhone.has(item.contactPhone)) {
        byPhone.set(item.contactPhone, item);
        if (isFiltering && isAllowedConversation(item.contactPhone, connectedPhone)) {
          allowedPhones.add(item.contactPhone);
        }
      }
    }

    const currentAllowed = isFiltering ? allowedPhones.size : byPhone.size;
    if (currentAllowed >= targetLimit || !lastEvaluatedKey) break;
    exclusiveStartKey = lastEvaluatedKey;
  }

  const latestItems = Array.from(byPhone.values())
    .filter((item) => !isFiltering || isAllowedConversation(item.contactPhone, connectedPhone))
    .slice(0, targetLimit);

  // Batch fetch read meta for all conversations (reduces N+1 to 1 query)
  const metaMap = await batchGetReadMeta(tenantId, latestItems.map(item => item.contactPhone));

  const conversations = await Promise.all(latestItems.map(async (item) => {
    const meta = metaMap.get(item.contactPhone) || null;
    const unreadCount = await countUnread(tenantId, item.contactPhone, meta?.lastReadAt);
    const formatted = formatMessage(item);
    return {
      contactPhone: item.contactPhone,
      lastMessage: formatted?.text || '',
      lastMessageAt: formatted?.createdAt || item.createdAt,
      unreadCount,
      lastReadAt: meta?.lastReadAt || null,
    };
  }));

  // When filtering is active, pagination is unreliable because nextKey is based
  // on the unfiltered DynamoDB position. Return all results in a single page.
  const nextKey = (!isFiltering && lastEvaluatedKey) ? encodeStartKey(lastEvaluatedKey) : undefined;

  return {
    conversations,
    nextKey,
  };
}

export async function markConversationRead(tenantId, contactPhone) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  const now = new Date().toISOString();
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: buildPk(tenantId, contactPhone), SK: META_READ_SK },
      UpdateExpression: 'SET lastReadAt = :now, expiresAt = :expires, tenantId = :tenantId, contactPhone = :contactPhone',
      ExpressionAttributeValues: {
        ':now': now,
        ':expires': Math.floor(Date.now() / 1000) + TTL_SECONDS,
        ':tenantId': tenantId,
        ':contactPhone': contactPhone,
      },
    }));
    return { success: true, lastReadAt: now };
  } catch (err) {
    logger.error('whatsappConversationService.markRead.failed', { tenantId, contactPhone, error: err.message });
    throw err;
  }
}

/**
 * Delete all messages for a contact (useful for resetting a polluted conversation)
 * @param {string} tenantId
 * @param {string} contactPhone
 * @returns {Promise<{deleted: number}>}
 */
export async function clearMessages(tenantId, contactPhone) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  const normalizedPhone = normalizeWhatsAppPhone(contactPhone);
  if (!normalizedPhone) {
    throw new Error('Invalid contact phone');
  }

  let deleted = 0;
  let lastEvaluatedKey = undefined;
  do {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': buildPk(tenantId, normalizedPhone),
        ':prefix': 'MESSAGE#',
      },
      ScanIndexForward: false,
      Limit: 25,
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
    }));

    const items = result.Items || [];
    const deleteRequests = [];
    for (const item of items) {
      deleteRequests.push({
        DeleteRequest: {
          Key: { PK: item.PK, SK: item.SK },
        },
      });
    }

    if (deleteRequests.length > 0) {
      let unprocessed = deleteRequests;
      let retryCount = 0;
      const MAX_RETRIES = 3;

      while (unprocessed.length > 0 && retryCount < MAX_RETRIES) {
        const response = await docClient.send(new BatchWriteCommand({
          RequestItems: { [TABLE_NAME]: unprocessed },
        }));
        const remaining = response.UnprocessedItems?.[TABLE_NAME] || [];
        deleted += unprocessed.length - remaining.length;
        unprocessed = remaining;
        retryCount += 1;

        if (unprocessed.length > 0 && retryCount < MAX_RETRIES) {
          // Exponential backoff before retrying
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 100));
        }
      }

      if (unprocessed.length > 0) {
        logger.error('whatsappConversationService.clearMessages.unprocessed_after_retries', {
          tenantId,
          contactPhone,
          remainingCount: unprocessed.length,
        });
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  logger.info('whatsappConversationService.clearMessages.success', { tenantId, contactPhone, deleted });
  return { deleted };
}

/**
 * Get conversation context for AI agent (last N messages)
 * Used to provide conversation history to LLM for multi-turn conversations
 * @param {string} tenantId
 * @param {string} contactPhone
 * @param {number} limit - Number of messages to retrieve (default: 10)
 * @returns {Promise<Array>} Array of formatted messages with role and content
 */
export async function getConversationContext(tenantId, contactPhone, limit = 10) {
  if (!TABLE_NAME) throw new Error('CRM_DYNAMODB_TABLE_NAME is not set');

  // Validate phone number format
  const normalizedPhone = normalizeWhatsAppPhone(contactPhone);
  if (!normalizedPhone) {
    logger.warn('whatsappConversationService.getConversationContext.invalid_phone', { tenantId, contactPhone });
    return [];
  }

  try {
    // Filter out messages older than the context window so a new conversation
    // doesn't inherit stale context from hours or days ago.
    const timeCutoff = new Date(Date.now() - CONTEXT_TIME_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const skCutoff = `MESSAGE#${timeCutoff}`;
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK >= :skCutoff',
      ExpressionAttributeValues: {
        ':pk': buildPk(tenantId, normalizedPhone),
        ':skCutoff': skCutoff,
      },
      ScanIndexForward: false, // Newest first
      Limit: Math.min(limit, 100), // Cap at 100 to prevent excessive reads
    }));

    // Format messages for LLM (oldest first)
    let items = result.Items || [];
    items.reverse();

    // Group chats can generate many messages; keep only the most recent N for
    // context. We classify the conversation by the LATEST message's isGroup
    // flag so a single historical group message doesn't shrink an otherwise
    // 1:1 conversation's context window.
    const latestIsGroup = items.length > 0 && items[items.length - 1].isGroup === true;
    if (latestIsGroup && items.length > MAX_GROUP_CONTEXT_MESSAGES) {
      items = items.slice(items.length - MAX_GROUP_CONTEXT_MESSAGES);
      logger.debug('whatsappConversationService.getConversationContext.group_limit_applied', { tenantId, contactPhone, originalCount: (result.Items || []).length, limitedCount: items.length });
    }

    const messages = items.map(msg => {
        let content = msg.text || '';
        // Append tool call summaries so the LLM remembers what data was retrieved
        if (msg.fromMe && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
          const MAX_TOOL_CALLS_IN_CONTEXT = 5;
          const toolSummary = msg.toolCalls
            .slice(0, MAX_TOOL_CALLS_IN_CONTEXT)
            .map(tc => {
              if (!tc || typeof tc !== 'object') return '[tool: malformed]';
              const result = tc.result;
              if (!result || typeof result !== 'object') {
                return `[tool: ${String(tc.name || 'unknown').replace(/[\n\r\t]/g, '').slice(0, 50)} error=no_result]`;
              }
              const ok = result.ok;
              let count = null;
              if (result.data && typeof result.data === 'object') {
                count = Array.isArray(result.data.items) ? result.data.items.length : (Array.isArray(result.data) ? result.data.length : null);
              }
              const sanitizedName = String(tc.name || 'unknown').replace(/[\n\r\t]/g, '').slice(0, 50);
              return `[tool: ${sanitizedName}${ok !== undefined ? ` ok=${ok}` : ''}${count !== null ? ` count=${count}` : ''}]`;
            })
            .join(', ');
          content += `\n[tools used: ${toolSummary}]`;
        }
        return {
          role: msg.fromMe ? 'assistant' : 'user',
          content,
          timestamp: msg.createdAt,
        };
      });

    return messages;
  } catch (err) {
    logger.error('whatsappConversationService.getConversationContext.failed', { tenantId, contactPhone, error: err.message });
    return []; // Graceful fallback - return empty context on error
  }
}
