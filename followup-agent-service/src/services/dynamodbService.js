// DynamoDB access for follow-up jobs and attempts.
//
// Single table, one partition per job:
//   PK = TENANT#{tenantId}#JOB#{jobId}      SK = JOB           the job
//   PK = TENANT#{tenantId}#JOB#{jobId}      SK = ATTEMPT#{n}   one row per call attempt
//   PK = TENANT#{tenantId}#DEDUPE#{key}     SK = GUARD         "an open job already exists" guard
//
// GSI1 due-index    GSI1PK = DUE#{yyyy-mm-dd} | CALLING | FINAL#{status}
//                   GSI1SK = {dueAtIso}#{jobId} | {claimedAtIso}#{jobId}
//                   The dispatcher reads DUE buckets for what to place next and
//                   the CALLING partition for the stuck-call watchdog.
// GSI2 tenant-index GSI2PK = TENANT#{tenantId}#JOBS   GSI2SK = {createdAt}#{jobId}
// GSI3 call-index   GSI3PK = CALL#{callSessionId}     GSI3SK = JOB
//
// Status transitions are guarded with ConditionExpressions so two dispatcher
// invocations, or a late call event, cannot both act on the same job.

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
import { JOB_STATUS, TERMINAL_JOB_STATUSES, FINISHED_JOB_TTL_DAYS, DEDUPE_TTL_DAYS } from '../config/constants.js';
import { dueBucket, ttlInDays } from '../utils/time.js';
import { logger } from '../utils/logger.js';

let docClient = null;

function getClient() {
  if (!docClient) {
    docClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' }),
      { marshallOptions: { removeUndefinedValues: true } },
    );
  }
  return docClient;
}

/** Test hook: inject a fake document client. */
export function setClient(client) {
  docClient = client;
}

function tableName() {
  const name = process.env.FOLLOWUP_TABLE_NAME;
  if (!name) throw new Error('FOLLOWUP_TABLE_NAME is not configured');
  return name;
}

const jobPk = (tenantId, jobId) => `TENANT#${tenantId}#JOB#${jobId}`;
const dedupePk = (tenantId, key) => `TENANT#${tenantId}#DEDUPE#${key}`;

export class ConditionFailedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConditionFailedError';
  }
}

function isConditionFailure(error) {
  return error?.name === 'ConditionalCheckFailedException';
}

/** Strip table keys before handing a row to callers. */
export function stripKeys(item) {
  if (!item) return item;
  const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, GSI3PK, GSI3SK, ...rest } = item;
  return rest;
}

function dueIndexKeys(dueAtIso, jobId) {
  return {
    GSI1PK: `DUE#${dueBucket(new Date(dueAtIso))}`,
    GSI1SK: `${dueAtIso}#${jobId}`,
  };
}

// ============== Jobs ==============

/**
 * Create a job. When `dedupeKey` is given and an open job already holds the
 * guard, the existing job is returned with `duplicate: true` instead.
 */
export async function createJob(tenantId, data) {
  if (!tenantId) throw new Error('Tenant ID is required');
  const jobId = uuidv4();
  const now = new Date().toISOString();
  const dueAt = data.dueAt || now;

  if (data.dedupeKey) {
    try {
      await getClient().send(new PutCommand({
        TableName: tableName(),
        Item: {
          PK: dedupePk(tenantId, data.dedupeKey),
          SK: 'GUARD',
          EntityType: 'DEDUPE_GUARD',
          tenantId,
          jobId,
          dedupeKey: data.dedupeKey,
          createdAt: now,
          ttl: ttlInDays(DEDUPE_TTL_DAYS),
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      }));
    } catch (error) {
      if (!isConditionFailure(error)) throw error;
      const guard = await getClient().send(new GetCommand({
        TableName: tableName(),
        Key: { PK: dedupePk(tenantId, data.dedupeKey), SK: 'GUARD' },
      }));
      const existing = guard.Item?.jobId ? await getJob(tenantId, guard.Item.jobId) : null;
      if (existing && !TERMINAL_JOB_STATUSES.has(existing.status)) {
        return { job: existing, duplicate: true };
      }
      // Guard points at a finished job (or nothing): take it over.
      await getClient().send(new PutCommand({
        TableName: tableName(),
        Item: {
          PK: dedupePk(tenantId, data.dedupeKey),
          SK: 'GUARD',
          EntityType: 'DEDUPE_GUARD',
          tenantId,
          jobId,
          dedupeKey: data.dedupeKey,
          createdAt: now,
          ttl: ttlInDays(DEDUPE_TTL_DAYS),
        },
      }));
    }
  }

  const job = {
    PK: jobPk(tenantId, jobId),
    SK: 'JOB',
    EntityType: 'FOLLOWUP_JOB',
    tenantId,
    jobId,
    leadId: data.leadId,
    jobType: data.jobType,
    status: JOB_STATUS.SCHEDULED,
    dueAt,
    attemptCount: 0,
    maxAttempts: data.maxAttempts,
    retryGapMinutes: data.retryGapMinutes,
    lastAttemptAt: null,
    lastOutcome: null,
    lastCallSessionId: null,
    claimedAt: null,
    escalatedAt: null,
    escalationReason: null,
    context: data.context || {},
    dedupeKey: data.dedupeKey || null,
    requestedBy: data.requestedBy || 'system',
    source: data.source || 'api',
    createdAt: now,
    updatedAt: now,
    ...dueIndexKeys(dueAt, jobId),
    GSI2PK: `TENANT#${tenantId}#JOBS`,
    GSI2SK: `${now}#${jobId}`,
  };

  await getClient().send(new PutCommand({ TableName: tableName(), Item: job }));
  logger.jobEvent('JOB_CREATED', job, { dueAt, source: job.source });
  return { job: stripKeys(job), duplicate: false };
}

export async function getJob(tenantId, jobId) {
  const result = await getClient().send(new GetCommand({
    TableName: tableName(),
    Key: { PK: jobPk(tenantId, jobId), SK: 'JOB' },
  }));
  return result.Item ? stripKeys(result.Item) : null;
}

/**
 * Generic guarded update. `expectedStatus` (string or array) makes the write
 * conditional on the job's current status, so a stale worker loses cleanly.
 */
export async function updateJob(tenantId, jobId, updates, { expectedStatus } = {}) {
  const names = {};
  const values = {};
  const sets = [];
  let i = 0;
  const data = { ...updates, updatedAt: new Date().toISOString() };

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    const n = `#a${i}`;
    const v = `:v${i}`;
    names[n] = key;
    values[v] = value;
    sets.push(`${n} = ${v}`);
    i += 1;
  }

  const params = {
    TableName: tableName(),
    Key: { PK: jobPk(tenantId, jobId), SK: 'JOB' },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  };

  if (expectedStatus) {
    const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
    names['#status'] = 'status';
    expected.forEach((s, idx) => { values[`:exp${idx}`] = s; });
    params.ConditionExpression = `#status IN (${expected.map((_, idx) => `:exp${idx}`).join(', ')})`;
  }

  try {
    const result = await getClient().send(new UpdateCommand(params));
    return stripKeys(result.Attributes);
  } catch (error) {
    if (isConditionFailure(error)) {
      throw new ConditionFailedError(`Job ${jobId} is not in status ${expectedStatus}`);
    }
    throw error;
  }
}

/** Move a scheduled job to a new due time (retry or reschedule). */
export async function rescheduleJob(tenantId, jobId, dueAtIso, extra = {}) {
  return updateJob(tenantId, jobId, {
    status: JOB_STATUS.SCHEDULED,
    dueAt: dueAtIso,
    claimedAt: null,
    ...dueIndexKeys(dueAtIso, jobId),
    ...extra,
  }, { expectedStatus: [JOB_STATUS.CALLING, JOB_STATUS.SCHEDULED] });
}

/** Claim a due job for dispatch. Throws ConditionFailedError if someone else got it. */
export async function claimJob(tenantId, jobId, claimedAtIso) {
  return updateJob(tenantId, jobId, {
    status: JOB_STATUS.CALLING,
    claimedAt: claimedAtIso,
    GSI1PK: 'CALLING',
    GSI1SK: `${claimedAtIso}#${jobId}`,
  }, { expectedStatus: JOB_STATUS.SCHEDULED });
}

/** Finish a job in a terminal status and start its TTL clock. */
export async function finishJob(tenantId, jobId, status, extra = {}, { expectedStatus } = {}) {
  if (!TERMINAL_JOB_STATUSES.has(status)) throw new Error(`${status} is not a terminal status`);
  return updateJob(tenantId, jobId, {
    status,
    claimedAt: null,
    GSI1PK: `FINAL#${status}`,
    GSI1SK: `${new Date().toISOString()}#${jobId}`,
    ttl: ttlInDays(FINISHED_JOB_TTL_DAYS),
    ...extra,
  }, { expectedStatus });
}

export async function releaseDedupeGuard(tenantId, dedupeKey) {
  if (!dedupeKey) return;
  await getClient().send(new DeleteCommand({
    TableName: tableName(),
    Key: { PK: dedupePk(tenantId, dedupeKey), SK: 'GUARD' },
  })).catch((error) => logger.warn('dedupe guard release failed', { tenantId, dedupeKey, error: error.message }));
}

export async function listJobs(tenantId, { leadId, status, limit = 50 } = {}) {
  const result = await getClient().send(new QueryCommand({
    TableName: tableName(),
    IndexName: 'tenant-index',
    KeyConditionExpression: 'GSI2PK = :pk',
    ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}#JOBS` },
    ScanIndexForward: false,
    Limit: Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200) * (leadId || status ? 4 : 1),
  }));
  let jobs = (result.Items || []).map(stripKeys);
  if (leadId) jobs = jobs.filter((j) => j.leadId === leadId);
  if (status) jobs = jobs.filter((j) => j.status === status);
  return jobs.slice(0, Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200));
}

/** Scheduled jobs in one due bucket whose dueAt <= nowIso. */
export async function queryDueJobs(bucket, nowIso) {
  const result = await getClient().send(new QueryCommand({
    TableName: tableName(),
    IndexName: 'due-index',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK <= :sk',
    FilterExpression: '#status = :scheduled',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':pk': `DUE#${bucket}`,
      // "~" sorts after every uuid character, so this includes all jobs at exactly nowIso.
      ':sk': `${nowIso}#~`,
      ':scheduled': JOB_STATUS.SCHEDULED,
    },
  }));
  return (result.Items || []).map(stripKeys);
}

/** Jobs stuck in CALLING claimed at or before `beforeIso`. */
export async function queryStuckCallingJobs(beforeIso) {
  const result = await getClient().send(new QueryCommand({
    TableName: tableName(),
    IndexName: 'due-index',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK <= :sk',
    ExpressionAttributeValues: { ':pk': 'CALLING', ':sk': `${beforeIso}#~` },
  }));
  return (result.Items || []).map(stripKeys).filter((j) => j.status === JOB_STATUS.CALLING);
}

export async function findJobByCallSession(callSessionId) {
  if (!callSessionId) return null;
  const result = await getClient().send(new QueryCommand({
    TableName: tableName(),
    IndexName: 'call-index',
    KeyConditionExpression: 'GSI3PK = :pk',
    ExpressionAttributeValues: { ':pk': `CALL#${callSessionId}` },
    Limit: 1,
  }));
  const item = result.Items?.[0];
  return item ? stripKeys(item) : null;
}

/** Point the call-index at the session of the attempt in flight. */
export async function linkCallSession(tenantId, jobId, callSessionId) {
  return updateJob(tenantId, jobId, {
    lastCallSessionId: callSessionId,
    GSI3PK: `CALL#${callSessionId}`,
    GSI3SK: 'JOB',
  });
}

// ============== Attempts ==============

export async function putAttempt(tenantId, jobId, attemptNumber, data) {
  const now = new Date().toISOString();
  const item = {
    PK: jobPk(tenantId, jobId),
    SK: `ATTEMPT#${String(attemptNumber).padStart(3, '0')}`,
    EntityType: 'FOLLOWUP_ATTEMPT',
    tenantId,
    jobId,
    attemptNumber,
    startedAt: data.startedAt || now,
    endedAt: data.endedAt || null,
    callSessionId: data.callSessionId || null,
    callStatus: data.callStatus || null,
    outcome: data.outcome || null,
    callOutcome: data.callOutcome || null,
    duration: data.duration ?? null,
    transcriptSummary: data.transcriptSummary || null,
    needsHuman: data.needsHuman || false,
    needsHumanReason: data.needsHumanReason || null,
    feedback: data.feedback || null,
    meeting: data.meeting || null,
    error: data.error || null,
    source: data.source || null,
    createdAt: now,
    updatedAt: now,
  };
  await getClient().send(new PutCommand({ TableName: tableName(), Item: item }));
  return stripKeys(item);
}

export async function updateAttempt(tenantId, jobId, attemptNumber, updates) {
  const names = {};
  const values = {};
  const sets = [];
  let i = 0;
  for (const [key, value] of Object.entries({ ...updates, updatedAt: new Date().toISOString() })) {
    if (value === undefined) continue;
    names[`#a${i}`] = key;
    values[`:v${i}`] = value;
    sets.push(`#a${i} = :v${i}`);
    i += 1;
  }
  const result = await getClient().send(new UpdateCommand({
    TableName: tableName(),
    Key: { PK: jobPk(tenantId, jobId), SK: `ATTEMPT#${String(attemptNumber).padStart(3, '0')}` },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return stripKeys(result.Attributes);
}

export async function listAttempts(tenantId, jobId) {
  const result = await getClient().send(new QueryCommand({
    TableName: tableName(),
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':pk': jobPk(tenantId, jobId), ':sk': 'ATTEMPT#' },
  }));
  return (result.Items || []).map(stripKeys);
}

export default {
  createJob,
  getJob,
  updateJob,
  rescheduleJob,
  claimJob,
  finishJob,
  releaseDedupeGuard,
  listJobs,
  queryDueJobs,
  queryStuckCallingJobs,
  findJobByCallSession,
  linkCallSession,
  putAttempt,
  updateAttempt,
  listAttempts,
  ConditionFailedError,
  setClient,
};
