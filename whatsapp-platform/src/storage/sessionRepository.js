/**
 * Session metadata repository.
 *
 * LOCAL_STORAGE=true  → in-memory Map (zero AWS dependency for local dev)
 * LOCAL_STORAGE=false → DynamoDB (whatsapp-platform ECS style)
 *
 * Stores session status, task assignment, connection timestamps, etc.
 * The auth credentials themselves are handled by authState.js, not here.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import {
  LOCAL_STORAGE,
  AWS_REGION,
  SESSION_TABLE_NAME,
  ECS_TASK_ID,
  ECS_TASK_ARN,
} from '../config.js';
import { logger } from '../logger.js';

// ─── In-memory store (LOCAL_STORAGE=true) ─────────────────────────────────────
/** @type {Map<string, object>} */
const memStore = new Map();

// ─── DynamoDB helpers ─────────────────────────────────────────────────────────
let ddbClient = null;
function getDdb() {
  if (!ddbClient) {
    ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
  }
  return ddbClient;
}

function pk(phone) { return `TENANT#${phone}`; }
const SK = 'SESSION#CURRENT';

// ─── Public API ───────────────────────────────────────────────────────────────

export async function upsertSession(phone, data) {
  const now = new Date().toISOString();
  if (LOCAL_STORAGE) {
    const existing = memStore.get(phone) || {};
    const item = {
      sessionId: existing.sessionId || uuidv4(),
      ...existing,
      ...data,
      phone,
      taskId: ECS_TASK_ID,
      updatedAt: now,
      createdAt: existing.createdAt || now,
    };
    memStore.set(phone, item);
    return item;
  }

  const existing = await getSession(phone);
  const item = {
    PK: pk(phone),
    SK,
    entityType: 'WHATSAPP_SESSION',
    phone,
    sessionId: data.sessionId || existing?.sessionId || uuidv4(),
    status: data.status,
    taskId: data.taskId || ECS_TASK_ID,
    taskArn: data.taskArn || ECS_TASK_ARN || null,
    connectedAt: data.connectedAt || existing?.connectedAt || null,
    disconnectedAt: data.disconnectedAt || null,
    lastSeenAt: now,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    version: (existing?.version || 0) + 1,
    GSI1PK: `STATUS#${data.status}`,
    GSI1SK: pk(phone),
  };
  await getDdb().send(new PutCommand({ TableName: SESSION_TABLE_NAME, Item: item }));
  return item;
}

export async function getSession(phone) {
  if (LOCAL_STORAGE) return memStore.get(phone) || null;
  const res = await getDdb().send(new GetCommand({
    TableName: SESSION_TABLE_NAME,
    Key: { PK: pk(phone), SK },
  }));
  return res.Item || null;
}

export async function deleteSession(phone) {
  if (LOCAL_STORAGE) { memStore.delete(phone); return; }
  await getDdb().send(new DeleteCommand({
    TableName: SESSION_TABLE_NAME,
    Key: { PK: pk(phone), SK },
  }));
}

export async function listConnectedSessions(limit = 200) {
  if (LOCAL_STORAGE) {
    return Array.from(memStore.values()).filter(s => s.status === 'CONNECTED');
  }
  const res = await getDdb().send(new QueryCommand({
    TableName: SESSION_TABLE_NAME,
    IndexName: 'status-tenant-index',
    KeyConditionExpression: 'GSI1PK = :status',
    ExpressionAttributeValues: { ':status': 'STATUS#CONNECTED' },
    Limit: limit,
  }));
  return res.Items || [];
}

export async function listSessionsForTask(taskId, limit = 200) {
  if (LOCAL_STORAGE) {
    return Array.from(memStore.values()).filter(s => s.taskId === taskId);
  }
  const res = await getDdb().send(new ScanCommand({
    TableName: SESSION_TABLE_NAME,
    FilterExpression: 'taskId = :taskId AND #status = :connected',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':taskId': taskId, ':connected': 'CONNECTED' },
    Limit: limit,
  }));
  return res.Items || [];
}

export function getMemStore() { return memStore; }
