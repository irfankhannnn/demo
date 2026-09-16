import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.js';
import { wrapAwsClient } from './awsClientWrapper.js';
import { SERVICE_ACCOUNT_USER } from './utils/serviceAccount.js';
import { collectAllPages } from './utils/dynamoPagination.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables from apps/crm/server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const REGION = process.env.AWS_REGION || 'ap-south-1';
const TABLE_NAME = process.env.ENQUIRIES_DYNAMODB_TABLE_NAME;

if (!TABLE_NAME) {
  console.warn('ENQUIRIES_DYNAMODB_TABLE_NAME is not set. Enquiries feature will not work.');
}

// Initialize DynamoDB client
const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: TABLE_NAME });
const docClient = DynamoDBDocumentClient.from(client);

// ============== Enquiry Operations ==============

/**
 * Create a new enquiry (contact form or consultation request)
 * @param {string} tenantId - Tenant ID
 * @param {object} enquiryData - Enquiry data
 * @returns {object} Created enquiry
 */
export async function createEnquiry(tenantId, enquiryData) {
  if (!TABLE_NAME) throw new Error('Enquiries table not configured');

  const enquiryId = uuidv4();
  const timestamp = new Date().toISOString();

  const enquiry = {
    PK: `TENANT#${tenantId}`,
    SK: `ENQUIRY#${enquiryId}`,
    GSI1PK: `TENANT#${tenantId}#STATUS#${enquiryData.status || 'new'}`,
    GSI1SK: timestamp,
    EntityType: 'ENQUIRY',
    enquiryId,
    tenantId,
    // Form type: 'contact' for contact page, 'consultation' for homepage consultation form
    formType: enquiryData.formType || 'contact',
    // Common fields
    name: enquiryData.name,
    email: enquiryData.email || null,
    phone: enquiryData.phone || enquiryData.mobile,
    message: enquiryData.message || enquiryData.requirement || null,
    // Contact form specific
    userType: enquiryData.userType || null, // owner, tenant, agent
    propertyType: enquiryData.propertyType || null,
    wantPropertyManagement: enquiryData.wantPropertyManagement || false,
    // Status tracking
    status: enquiryData.status || 'new', // new, contacted, meeting_scheduled, converted, closed
    notes: enquiryData.notes || null,
    assignedTo: enquiryData.assignedTo || null,
    // Metadata
    source: enquiryData.source || 'website',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await logger.span('ddb.createEnquiry', { tableName: TABLE_NAME, tenantId, enquiryId }, async () => {
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: enquiry,
    }));
  });

  return enquiry;
}

/**
 * Get all enquiries for a tenant
 * @param {string} tenantId - Tenant ID
 * @returns {array} List of enquiries
 */
export async function getEnquiries(tenantId) {
  if (!TABLE_NAME) throw new Error('Enquiries table not configured');

  const items = await logger.span('ddb.getEnquiries', { tableName: TABLE_NAME, tenantId }, async () => {
    return await collectAllPages(docClient, QueryCommand, {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      // IMPORTANT: Notes are stored with SK like ENQUIRY#{enquiryId}#NOTE#{noteId}.
      // Without a filter, they would be returned alongside enquiry PROFILE items and appear as blank enquiries in UI.
      FilterExpression: 'EntityType = :entityType',
      ExpressionAttributeValues: {
        ':pk': `TENANT#${tenantId}`,
        ':sk': 'ENQUIRY#',
        ':entityType': 'ENQUIRY',
      },
      ScanIndexForward: false, // Most recent first
    }, { maxPages: 100 });
  });

  return items;
}

/**
 * Get enquiries by status
 * @param {string} tenantId - Tenant ID
 * @param {string} status - Status to filter by
 * @returns {array} List of enquiries
 */
export async function getEnquiriesByStatus(tenantId, status) {
  if (!TABLE_NAME) throw new Error('Enquiries table not configured');

  const result = await logger.span('ddb.getEnquiriesByStatus', { tableName: TABLE_NAME, tenantId, status }, async () => {
    return await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'tenant-status-index',
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      ExpressionAttributeValues: {
        ':gsi1pk': `TENANT#${tenantId}#STATUS#${status}`,
      },
      ScanIndexForward: false,
    }));
  });

  return result.Items || [];
}

/**
 * Get a single enquiry
 * @param {string} tenantId - Tenant ID
 * @param {string} enquiryId - Enquiry ID
 * @returns {object|null} Enquiry or null
 */
export async function getEnquiry(tenantId, enquiryId) {
  if (!TABLE_NAME) throw new Error('Enquiries table not configured');

  const result = await logger.span('ddb.getEnquiry', { tableName: TABLE_NAME, tenantId, enquiryId }, async () => {
    return await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}`,
        SK: `ENQUIRY#${enquiryId}`,
      },
    }));
  });

  return result.Item || null;
}

/**
 * Update an enquiry
 * @param {string} tenantId - Tenant ID
 * @param {string} enquiryId - Enquiry ID
 * @param {object} updates - Fields to update
 * @returns {object} Updated enquiry
 */
export async function updateEnquiry(tenantId, enquiryId, updates) {
  if (!TABLE_NAME) throw new Error('Enquiries table not configured');

  const timestamp = new Date().toISOString();
  
  // Build update expression
  const updateExpressions = ['updatedAt = :updatedAt'];
  const expressionAttributeValues = { ':updatedAt': timestamp };
  const expressionAttributeNames = {};

  // Handle status change (need to update GSI1PK)
  if (updates.status) {
    updateExpressions.push('GSI1PK = :gsi1pk');
    updateExpressions.push('#status = :status');
    expressionAttributeValues[':gsi1pk'] = `TENANT#${tenantId}#STATUS#${updates.status}`;
    expressionAttributeValues[':status'] = updates.status;
    expressionAttributeNames['#status'] = 'status';
  }

  // Handle other fields
  // NOTE: 'message' field is intentionally excluded from updates to preserve original enquiry message
  const allowedFields = [
    'notes',
    'assignedTo',
    'name',
    'email',
    'phone',
    // Conversion / closing metadata
    'convertedTo',
    'convertedId',
    'convertedAt',
    'closedAt',
    'closeReason',
  ];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateExpressions.push(`${field} = :${field}`);
      expressionAttributeValues[`:${field}`] = updates[field];
    }
  }

  const params = {
    TableName: TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}`,
      SK: `ENQUIRY#${enquiryId}`,
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ConditionExpression: 'attribute_exists(PK)',
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  };

  if (Object.keys(expressionAttributeNames).length > 0) {
    params.ExpressionAttributeNames = expressionAttributeNames;
  }

  try {
    const result = await logger.span('ddb.updateEnquiry', { tableName: TABLE_NAME, tenantId, enquiryId }, async () => {
      return await docClient.send(new UpdateCommand(params));
    });
    return result.Attributes;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      throw new Error('Enquiry not found');
    }
    throw err;
  }
}

// ============== Enquiry Notes Operations ==============

export async function createEnquiryNote(tenantId, enquiryId, data) {
  if (!TABLE_NAME) throw new Error('Enquiries table not configured');

  const noteId = uuidv4();
  const timestamp = new Date().toISOString();

  const note = {
    PK: `TENANT#${tenantId}`,
    SK: `ENQUIRY#${enquiryId}#NOTE#${noteId}`,
    EntityType: 'ENQUIRY_NOTE',
    tenantId,
    enquiryId,
    noteId,
    content: data.content,
    createdBy: data.createdBy || SERVICE_ACCOUNT_USER,
    createdAt: timestamp,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: note,
  }));

  return note;
}

export async function getEnquiryNotes(tenantId, enquiryId) {
  if (!TABLE_NAME) throw new Error('Enquiries table not configured');

  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}`,
      ':sk': `ENQUIRY#${enquiryId}#NOTE#`,
    },
  }));

  let notes = result.Items || [];

  // Fallback to synthetic note from the enquiry PROFILE notes if timeline empty
  if (!notes.length) {
    const enquiry = await getEnquiry(tenantId, enquiryId);
    if (enquiry && enquiry.notes) {
      notes = [{
        PK: `TENANT#${tenantId}`,
        SK: `ENQUIRY#${enquiryId}#NOTE#PROFILE_NOTES`,
        EntityType: 'ENQUIRY_NOTE',
        tenantId,
        enquiryId,
        noteId: 'PROFILE_NOTES',
        content: enquiry.notes,
        createdBy: SERVICE_ACCOUNT_USER,
        createdAt: enquiry.createdAt || new Date().toISOString(),
      }];
    }
  }

  return notes;
}

export async function updateEnquiryNote(tenantId, enquiryId, noteId, data) {
  if (!TABLE_NAME) throw new Error('Enquiries table not configured');
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!enquiryId) throw new Error('Enquiry ID is required');
  if (!noteId) throw new Error('Note ID is required');
  if (noteId === 'PROFILE_NOTES') {
    throw new Error('PROFILE_NOTES cannot be edited');
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}`,
      SK: `ENQUIRY#${enquiryId}#NOTE#${noteId}`,
    },
    UpdateExpression: 'SET content = :content, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':content': data.content,
      ':updatedAt': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  }));

  return result.Attributes;
}

export async function deleteEnquiryNote(tenantId, enquiryId, noteId) {
  if (!TABLE_NAME) throw new Error('Enquiries table not configured');
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!enquiryId) throw new Error('Enquiry ID is required');
  if (!noteId) throw new Error('Note ID is required');
  if (noteId === 'PROFILE_NOTES') {
    throw new Error('PROFILE_NOTES cannot be deleted');
  }

  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}`,
      SK: `ENQUIRY#${enquiryId}#NOTE#${noteId}`,
    },
  }));

  return true;
}

/**
 * Get enquiry metrics for a tenant
 * @param {string} tenantId - Tenant ID
 * @returns {object} Metrics
 */
export async function getEnquiryMetrics(tenantId) {
  if (!TABLE_NAME) throw new Error('Enquiries table not configured');

  const enquiries = await getEnquiries(tenantId);
  
  const metrics = {
    total: enquiries.length,
    new: 0,
    contacted: 0,
    meeting_scheduled: 0,
    converted: 0,
    closed: 0,
    byFormType: {
      contact: 0,
      consultation: 0,
    },
    byUserType: {
      owner: 0,
      tenant: 0,
      agent: 0,
      unknown: 0,
    },
    recentEnquiries: enquiries.slice(0, 5),
  };

  for (const enquiry of enquiries) {
    // Count by status
    if (enquiry.status) {
      metrics[enquiry.status] = (metrics[enquiry.status] || 0) + 1;
    }
    
    // Count by form type
    if (enquiry.formType && metrics.byFormType[enquiry.formType] !== undefined) {
      metrics.byFormType[enquiry.formType]++;
    }
    
    // Count by user type
    const userType = enquiry.userType || 'unknown';
    if (metrics.byUserType[userType] !== undefined) {
      metrics.byUserType[userType]++;
    }
  }

  return metrics;
}

export default docClient;
