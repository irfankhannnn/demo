/**
 * DynamoDB persistence for call recordings.
 *
 * Stored in the existing multi-tenant CRM table (single-table design):
 *   PK     = TENANT#{tenantId}#CALL_RECORDING#{recordingId}
 *   SK     = PROFILE
 *   GSI1PK = TENANT#{tenantId}#CALL_RECORDINGS      (chronological list)
 *   GSI1SK = {createdAt}#{recordingId}
 *
 * Bulk payloads (full transcript, raw analysis JSON) live in S3; only the
 * summary-sized fields are kept on the item.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../logger.js';
import { wrapAwsClient } from '../../awsClientWrapper.js';
import { RECORDING_STATUS, ACTION_STATUS, ENTITY_TYPE } from './constants.js';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME;
const LIST_INDEX = 'owner-property-index'; // GSI1PK / GSI1SK

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: TABLE_NAME });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const ENTITY_TYPE_ATTRIBUTE = 'CALL_RECORDING';

function recordingKey(tenantId, recordingId) {
  return {
    PK: `TENANT#${tenantId}#CALL_RECORDING#${recordingId}`,
    SK: 'PROFILE',
  };
}

function listPartition(tenantId) {
  return `TENANT#${tenantId}#CALL_RECORDINGS`;
}

/** Create the recording row before the file is uploaded to S3. */
export async function createRecording(tenantId, data) {
  if (!tenantId) throw new Error('Tenant ID is required');

  const recordingId = data.recordingId || uuidv4();
  const now = new Date().toISOString();

  const item = {
    ...recordingKey(tenantId, recordingId),
    EntityType: ENTITY_TYPE_ATTRIBUTE,
    tenantId,
    recordingId,

    filename: data.filename || '',
    contentType: data.contentType || '',
    sizeBytes: data.sizeBytes ?? null,
    s3Key: data.s3Key,
    transcriptS3Key: null,
    analysisS3Key: null,

    phone: data.phone || null,
    phoneE164: data.phoneE164 || null,
    phoneConfidence: data.phoneConfidence || null,
    phoneCandidates: data.phoneCandidates || [],

    matchedEntityType: data.matchedEntityType || ENTITY_TYPE.UNMATCHED,
    matchedEntityId: data.matchedEntityId || null,
    matchedEntityName: data.matchedEntityName || '',
    matchCandidates: data.matchCandidates || [],
    matchSource: data.matchSource || 'filename',

    status: RECORDING_STATUS.PENDING_UPLOAD,
    failureStage: null,
    failureReason: null,
    possibleDuplicateOf: data.possibleDuplicateOf || null,

    asrProvider: null,
    asrLanguage: null,
    asrJobName: null,
    asrPollAttempts: 0,
    audioDurationSeconds: null,

    transcriptPreview: '',
    summary: '',
    keyPoints: [],
    topics: [],
    extracted: null,
    proposedActions: [],

    analysisModel: null,
    analysisPromptVersion: null,
    stageAttempts: {},

    uploadedBy: data.uploadedBy || '',
    createdAt: now,
    updatedAt: now,

    GSI1PK: listPartition(tenantId),
    GSI1SK: `${now}#${recordingId}`,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
    ConditionExpression: 'attribute_not_exists(PK)',
  }));

  return item;
}

export async function getRecording(tenantId, recordingId) {
  if (!tenantId || !recordingId) return null;
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: recordingKey(tenantId, recordingId),
  }));
  return result.Item || null;
}

/**
 * List recordings newest-first.
 * @param {object} options { limit, cursor, status, search }
 */
export async function listRecordings(tenantId, options = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');

  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 25, 1), 100);
  const params = {
    TableName: TABLE_NAME,
    IndexName: LIST_INDEX,
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': listPartition(tenantId) },
    ScanIndexForward: false,
    Limit: limit,
  };

  if (options.status) {
    params.FilterExpression = '#status = :status';
    params.ExpressionAttributeNames = { '#status': 'status' };
    params.ExpressionAttributeValues[':status'] = options.status;
    // Filters apply after the Limit, so read more pages to fill a page.
    params.Limit = limit * 4;
  }

  if (options.cursor) {
    try {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(options.cursor, 'base64').toString('utf8'));
    } catch (_) {
      // Ignore an unreadable cursor and start from the beginning.
    }
  }

  const result = await docClient.send(new QueryCommand(params));
  const items = (result.Items || []).slice(0, limit);

  return {
    items,
    nextCursor: result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : null,
  };
}

/** Generic attribute update; always refreshes updatedAt. */
export async function updateRecording(tenantId, recordingId, updates = {}) {
  if (!tenantId || !recordingId) throw new Error('tenantId and recordingId are required');

  const names = { '#updatedAt': 'updatedAt' };
  const values = { ':updatedAt': new Date().toISOString() };
  const sets = ['#updatedAt = :updatedAt'];

  Object.entries(updates).forEach(([key, value], index) => {
    if (value === undefined) return;
    const nameKey = `#f${index}`;
    const valueKey = `:v${index}`;
    names[nameKey] = key;
    values[valueKey] = value;
    sets.push(`${nameKey} = ${valueKey}`);
  });

  const result = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: recordingKey(tenantId, recordingId),
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ConditionExpression: 'attribute_exists(PK)',
    ReturnValues: 'ALL_NEW',
  }));

  return result.Attributes;
}

/**
 * Move a recording to a new status only when it is currently in one of
 * `allowedFrom`. Returns null when the guard fails, which is how duplicate SQS
 * deliveries are made harmless.
 */
export async function transitionStatus(tenantId, recordingId, nextStatus, allowedFrom = [], extraUpdates = {}) {
  const names = { '#status': 'status', '#updatedAt': 'updatedAt' };
  const values = { ':next': nextStatus, ':updatedAt': new Date().toISOString() };
  const sets = ['#status = :next', '#updatedAt = :updatedAt'];

  Object.entries(extraUpdates).forEach(([key, value], index) => {
    if (value === undefined) return;
    names[`#e${index}`] = key;
    values[`:e${index}`] = value;
    sets.push(`#e${index} = :e${index}`);
  });

  let condition = 'attribute_exists(PK)';
  if (allowedFrom.length > 0) {
    const placeholders = allowedFrom.map((status, index) => {
      values[`:from${index}`] = status;
      return `:from${index}`;
    });
    condition += ` AND #status IN (${placeholders.join(', ')})`;
  }

  try {
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: recordingKey(tenantId, recordingId),
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: condition,
      ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      logger.info('callIntelligence.transition.skipped', { tenantId, recordingId, nextStatus, allowedFrom });
      return null;
    }
    throw err;
  }
}

/** Record a stage failure without losing the previously computed data. */
export async function markFailed(tenantId, recordingId, stage, reason) {
  return updateRecording(tenantId, recordingId, {
    status: RECORDING_STATUS.FAILED,
    failureStage: stage,
    failureReason: String(reason || '').slice(0, 1000),
  });
}

/** Increment the per-stage attempt counter used to cap retries. */
export async function incrementStageAttempt(tenantId, recordingId, stage) {
  const result = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: recordingKey(tenantId, recordingId),
    UpdateExpression: 'SET #attempts.#stage = if_not_exists(#attempts.#stage, :zero) + :one, #updatedAt = :now',
    ExpressionAttributeNames: {
      '#attempts': 'stageAttempts',
      '#stage': stage,
      '#updatedAt': 'updatedAt',
    },
    ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':now': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes?.stageAttempts?.[stage] ?? 1;
}

/**
 * Update one proposed action in place.
 *
 * The condition pins both the array index and the action id, so a concurrent
 * approve/reject from a second browser tab fails instead of double-executing.
 */
export async function updateActionStatus(tenantId, recordingId, actionId, patch, expectedStatuses = []) {
  const recording = await getRecording(tenantId, recordingId);
  if (!recording) return { ok: false, error: 'recording_not_found' };

  const index = (recording.proposedActions || []).findIndex((action) => action.actionId === actionId);
  if (index === -1) return { ok: false, error: 'action_not_found' };

  const current = recording.proposedActions[index];
  if (expectedStatuses.length > 0 && !expectedStatuses.includes(current.status)) {
    return { ok: false, error: 'action_not_in_expected_state', currentStatus: current.status };
  }

  const names = {
    '#actions': 'proposedActions',
    '#updatedAt': 'updatedAt',
    '#actionId': 'actionId',
    '#actionStatus': 'status',
  };
  const values = {
    ':updatedAt': new Date().toISOString(),
    ':actionId': actionId,
  };
  const sets = ['#updatedAt = :updatedAt'];

  Object.entries(patch).forEach(([key, value], patchIndex) => {
    if (value === undefined) return;
    const nameKey = key === 'status' ? '#actionStatus' : `#p${patchIndex}`;
    if (key !== 'status') names[nameKey] = key;
    const valueKey = `:p${patchIndex}`;
    values[valueKey] = value;
    sets.push(`#actions[${index}].${nameKey} = ${valueKey}`);
  });

  let condition = `#actions[${index}].#actionId = :actionId`;
  if (expectedStatuses.length > 0) {
    const placeholders = expectedStatuses.map((status, statusIndex) => {
      values[`:exp${statusIndex}`] = status;
      return `:exp${statusIndex}`;
    });
    condition += ` AND #actions[${index}].#actionStatus IN (${placeholders.join(', ')})`;
  }

  try {
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: recordingKey(tenantId, recordingId),
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: condition,
      ReturnValues: 'ALL_NEW',
    }));
    return { ok: true, recording: result.Attributes };
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return { ok: false, error: 'action_already_processed' };
    }
    throw err;
  }
}

/**
 * Recompute the recording status from its action list.
 * COMPLETED when nothing is pending, AWAITING_APPROVAL otherwise.
 */
export async function refreshCompletionStatus(tenantId, recordingId) {
  const recording = await getRecording(tenantId, recordingId);
  if (!recording) return null;

  const actions = recording.proposedActions || [];
  const hasPending = actions.some((action) => action.status === ACTION_STATUS.PENDING);
  const nextStatus = hasPending ? RECORDING_STATUS.AWAITING_APPROVAL : RECORDING_STATUS.COMPLETED;

  if (recording.status === nextStatus) return recording;
  if (recording.status === RECORDING_STATUS.FAILED) return recording;

  return updateRecording(tenantId, recordingId, { status: nextStatus });
}

/** Remove a recording row (S3 objects are deleted by the caller). */
export async function deleteRecording(tenantId, recordingId) {
  if (!tenantId || !recordingId) throw new Error('tenantId and recordingId are required');
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: recordingKey(tenantId, recordingId),
  }));
  return true;
}

/**
 * Best-effort duplicate detection: same file name and size uploaded recently.
 * Never blocks an upload — the UI only surfaces a warning.
 */
export async function findPossibleDuplicate(tenantId, { filename, sizeBytes }, withinHours = 24) {
  if (!filename) return null;
  try {
    const { items } = await listRecordings(tenantId, { limit: 50 });
    const cutoff = Date.now() - withinHours * 60 * 60 * 1000;
    const match = items.find((item) => (
      item.filename === filename
      && (sizeBytes == null || item.sizeBytes == null || item.sizeBytes === sizeBytes)
      && new Date(item.createdAt).getTime() >= cutoff
    ));
    return match ? match.recordingId : null;
  } catch (err) {
    logger.warn('callIntelligence.duplicateCheck.failed', { tenantId, error: err.message });
    return null;
  }
}
