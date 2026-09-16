import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.js';
import { wrapAwsClient } from './awsClientWrapper.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables from apps/crm/server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const REGION = process.env.AWS_REGION || 'ap-south-1';
const GRIEVANCES_TABLE_NAME = process.env.GRIEVANCES_TABLE_NAME || 'Grievances';
// Optional endpoint override (DynamoDB Local for tests)
const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT || undefined;

const clientConfig = { region: REGION };
if (DYNAMODB_ENDPOINT) {
  clientConfig.endpoint = DYNAMODB_ENDPOINT;
}

const client = wrapAwsClient(new DynamoDBClient(clientConfig), 'DynamoDB', {
  tableName: GRIEVANCES_TABLE_NAME,
});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Grievances table (PUBLIC — DPDP Act 2023 grievance channel).
 *
 * Schema (see coding-agent-brief/01-SHARED-CONTRACTS.md §1.1):
 *   PK: grievanceId (string)
 *   GSI: status-createdAt-index (PK=status, SK=createdAt)
 *   GSI: email-createdAt-index  (PK=email,  SK=createdAt)
 *
 * This table is intentionally NOT tenant-scoped: `tenantId` is always null.
 */

export const GRIEVANCE_CATEGORIES = [
  'data_access',
  'data_correction',
  'data_deletion',
  'data_export',
  'account_security',
  'billing',
  'service_complaint',
  'other',
];

export const GRIEVANCE_STATUSES = [
  'new',
  'acknowledged',
  'in_progress',
  'resolved',
  'escalated',
];

/**
 * Build the user-facing tracking id from a grievance id.
 * GR-{first 6 chars of grievanceId, uppercased}
 */
export function buildTrackingId(grievanceId) {
  return 'GR-' + String(grievanceId).replace(/-/g, '').slice(0, 6).toUpperCase();
}

/**
 * Create a new grievance row.
 * @returns {{ grievanceId: string, trackingId: string, createdAt: string }}
 */
export async function createGrievance({ name, email, phone, category, description, ip, userAgent }) {
  if (!name || !email || !category || !description) {
    throw new Error('name, email, category and description are required');
  }

  const grievanceId = uuidv4();
  const trackingId = buildTrackingId(grievanceId);
  const now = new Date().toISOString();

  const item = {
    grievanceId,
    trackingId,
    name,
    email,
    phone: phone || null,
    category,
    description,
    status: 'new',
    assignedTo: null,
    resolvedAt: null,
    resolutionNotes: null,
    internalNotes: null,
    ip: ip || null,
    userAgent: userAgent || null,
    tenantId: null, // deliberately null — public table
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: GRIEVANCES_TABLE_NAME,
    Item: item,
  }));

  logger.info('grievance.created', { grievanceId, trackingId, category });

  return { grievanceId, trackingId, createdAt: now };
}

/**
 * Get a single grievance by its id.
 */
export async function getGrievanceById(grievanceId) {
  if (!grievanceId) {
    throw new Error('grievanceId is required');
  }

  const { Item } = await docClient.send(new GetCommand({
    TableName: GRIEVANCES_TABLE_NAME,
    Key: { grievanceId },
  }));

  return Item || null;
}

/**
 * List grievances for admin triage with optional filters + pagination.
 *
 * When a `status` filter is supplied we Query the status-createdAt-index GSI;
 * otherwise we Scan the table. Additional filters (category / date range) are
 * applied as DynamoDB FilterExpressions.
 *
 * @returns {{ items: object[], lastEvaluatedKey: object | null }}
 */
export async function listGrievances({ status, category, fromDate, toDate, limit = 20, lastEvaluatedKey } = {}) {
  const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const filterExpressions = [];
  const expressionValues = {};
  const expressionNames = {};

  if (category) {
    filterExpressions.push('#category = :category');
    expressionNames['#category'] = 'category';
    expressionValues[':category'] = category;
  }
  if (fromDate) {
    filterExpressions.push('createdAt >= :fromDate');
    expressionValues[':fromDate'] = fromDate;
  }
  if (toDate) {
    filterExpressions.push('createdAt <= :toDate');
    expressionValues[':toDate'] = toDate;
  }

  let result;

  if (status) {
    // Query the GSI by status, newest first.
    expressionNames['#status'] = 'status';
    expressionValues[':status'] = status;

    result = await docClient.send(new QueryCommand({
      TableName: GRIEVANCES_TABLE_NAME,
      IndexName: 'status-createdAt-index',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      FilterExpression: filterExpressions.length ? filterExpressions.join(' AND ') : undefined,
      ScanIndexForward: false, // newest first
      Limit: pageLimit,
      ExclusiveStartKey: lastEvaluatedKey || undefined,
    }));
  } else {
    result = await docClient.send(new ScanCommand({
      TableName: GRIEVANCES_TABLE_NAME,
      ExpressionAttributeNames: Object.keys(expressionNames).length ? expressionNames : undefined,
      ExpressionAttributeValues: Object.keys(expressionValues).length ? expressionValues : undefined,
      FilterExpression: filterExpressions.length ? filterExpressions.join(' AND ') : undefined,
      Limit: pageLimit,
      ExclusiveStartKey: lastEvaluatedKey || undefined,
    }));
  }

  const items = (result.Items || []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return {
    items,
    lastEvaluatedKey: result.LastEvaluatedKey || null,
  };
}

/**
 * Update a grievance (admin). Only whitelisted fields can be changed.
 * Automatically stamps updatedAt, and resolvedAt when status flips to resolved.
 */
export async function updateGrievance(grievanceId, { status, assignedTo, resolutionNotes, internalNotes, resolvedAt } = {}) {
  if (!grievanceId) {
    throw new Error('grievanceId is required');
  }
  if (status && !GRIEVANCE_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const now = new Date().toISOString();
  const sets = ['updatedAt = :updatedAt'];
  const names = {};
  const values = { ':updatedAt': now };

  if (status !== undefined) {
    sets.push('#status = :status');
    names['#status'] = 'status';
    values[':status'] = status;
    // Stamp resolvedAt automatically when moving to resolved (unless caller provided one).
    if (status === 'resolved' && resolvedAt === undefined) {
      sets.push('resolvedAt = :resolvedAt');
      values[':resolvedAt'] = now;
    }
  }
  if (assignedTo !== undefined) {
    sets.push('assignedTo = :assignedTo');
    values[':assignedTo'] = assignedTo;
  }
  if (resolutionNotes !== undefined) {
    sets.push('resolutionNotes = :resolutionNotes');
    values[':resolutionNotes'] = resolutionNotes;
  }
  if (internalNotes !== undefined) {
    sets.push('internalNotes = :internalNotes');
    values[':internalNotes'] = internalNotes;
  }
  if (resolvedAt !== undefined) {
    sets.push('resolvedAt = :resolvedAtExplicit');
    values[':resolvedAtExplicit'] = resolvedAt;
  }

  const { Attributes } = await docClient.send(new UpdateCommand({
    TableName: GRIEVANCES_TABLE_NAME,
    Key: { grievanceId },
    UpdateExpression: 'SET ' + sets.join(', '),
    ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
    ExpressionAttributeValues: values,
    ConditionExpression: 'attribute_exists(grievanceId)',
    ReturnValues: 'ALL_NEW',
  }));

  logger.info('grievance.updated', { grievanceId, status });

  return Attributes;
}
