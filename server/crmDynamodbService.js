// TODO(MED-1): Replace ScanCommand + FilterExpression with QueryCommand on a
// 'tenant-index' GSI (PK=tenantId, SK=EntityType) once the GSI is added via CFN.
// This applies to all list/getAll functions below that currently scan the full table.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  BatchWriteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getOrCreateArea, incrementAreaPropertyCount } from './areasDynamodbService.js';
import { logger } from './logger.js';
import { scheduleMeetingReminder, cancelMeetingReminder } from './notificationDynamodbService.js';
import { wrapAwsClient } from './awsClientWrapper.js';
import { SERVICE_ACCOUNT_USER } from './utils/serviceAccount.js';
import { collectAllPages } from './utils/dynamoPagination.js';
import {
  validateConvertLeadOptions,
  buildTargetEntity,
  buildForSalePropertyItem,
  buildForRentPropertyItem,
  buildConversionSnapshotItem,
  buildNoteMigrationActions,
  buildMeetingRelinkUpdates,
  buildConvertLeadResult,
  estimateTransactItemCount,
  assertTransactSizeOk,
  phonesMatch,
  CONVERSION_SYSTEM_KEYS,
  deepClone,
} from './services/leadConversionService.js';
import { normalizeOwnerProperty, normalizeSellerProperty } from './normalizers/leadPropertyNormalizer.js';
import { normalizeLeadTextFields } from './normalizers/leadTextNormalizer.js';
import { ALLOWED_LEAD_BHK } from './constants/leadBhkOptions.js';
import {
  propertyIsCurrentlyOwnedBy,
  isValidPropertyStatusTransition,
  normalizePropertyMarketStatus,
  buildOwnerProfile,
} from './domain/crmDomainModel.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables from server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

/** Map tool `query` param to CRM service `search` field. */
function aliasQueryToSearch(filters = {}) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return filters;
  if (filters.query && !filters.search) {
    const { query, ...rest } = filters;
    return { ...rest, search: query };
  }
  return filters;
}

/** Case-insensitive enum equality for filter fields. */
function matchesFilterEnum(fieldValue, filterValue) {
  if (filterValue == null || filterValue === '' || filterValue === 'all') return true;
  return String(fieldValue || '').toLowerCase() === String(filterValue).toLowerCase();
}

/** Normalize getLeads() result — supports legacy array or paginated envelope. */
export function unwrapLeadsList(result) {
  if (Array.isArray(result)) return result;
  return result?.leads ?? [];
}

function applyLeadAssignmentFilter(leads, filters = {}) {
  if (filters.unassigned === true || filters.unassigned === 'true') {
    return leads.filter((l) => !l.assignedTo);
  }
  if (filters.assignedTo) {
    const target = String(filters.assignedTo);
    return leads.filter((l) => l.assignedTo === target);
  }
  return leads;
}

const REGION = process.env.AWS_REGION || 'ap-south-1';
const CRM_TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME;

if (!CRM_TABLE_NAME) {
  throw new Error('CRM_DYNAMODB_TABLE_NAME is not set. Please configure it in server/.env');
}

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: CRM_TABLE_NAME });
const docClient = DynamoDBDocumentClient.from(client);

// Keys that must never be modified by an update request (defense against mass assignment)
const FORBIDDEN_UPDATE_KEYS = new Set(['PK', 'SK', 'tenantId', 'EntityType', 'createdAt', 'createdBy']);

function rejectForbiddenKeys(data) {
  const forbidden = Object.keys(data).filter(k => FORBIDDEN_UPDATE_KEYS.has(k));
  if (forbidden.length > 0) {
    throw new Error(`Forbidden keys in update payload: ${forbidden.join(', ')}`);
  }
}

/**
 * Build a DynamoDB SET update expression, skipping undefined values.
 * Undefined values must not appear in ExpressionAttributeValues — the AWS
 * document client omits them but leaves the placeholder in UpdateExpression,
 * which causes "attribute value :valN is not defined" errors.
 */
function buildSetUpdateExpression(data, extraProtectedKeys = []) {
  const protectedKeys = new Set([
    'PK', 'SK', 'EntityType', 'tenantId', 'createdAt', 'GSI3PK', 'GSI3SK',
    ...extraProtectedKeys,
  ]);

  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  for (const [key, value] of Object.entries(data)) {
    if (protectedKeys.has(key) || key.startsWith('GSI') || value === undefined) {
      continue;
    }
    const index = updateExpressions.length;
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = value;
  }

  return { updateExpressions, attributeNames, attributeValues };
}

/**
 * CRM DynamoDB Single Table Design (Multi-Tenant):
 * 
 * PK Pattern:
 * - TENANT#{tenantId}#CUSTOMER#{customerId}
 * - TENANT#{tenantId}#OWNER#{ownerId}
 * - TENANT#{tenantId}#PROPERTY#{propertyId}
 * 
 * SK Pattern:
 * - PROFILE (for main entity data)
 * - NOTE#{noteId} (for discussion notes)
 * - INTERACTION#{interactionId} (for interaction history)
 * 
 * GSI1: owner-property-index (GSI1PK = TENANT#{tenantId}#OWNER#{ownerId}, GSI1SK = PROPERTY#{propertyId})
 * GSI2: status-index (GSI2PK = TENANT#{tenantId}#PROPERTY_STATUS#{status}, GSI2SK = PROPERTY#{propertyId})
 * GSI3: search-index (GSI3PK = TENANT#{tenantId}#SEARCH, GSI3SK = searchable text)
 */

// ============== Customer Operations ==============

export async function createCustomer(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!data.name || !data.phone) {
    throw new Error('Name and phone are required');
  }

  const customerId = uuidv4();
  const now = new Date().toISOString();
  
  const customer = {
    PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
    SK: 'PROFILE',
    EntityType: 'CUSTOMER',
    tenantId,
    customerId,
    
    // Identity
    name: data.name,
    email: data.email || null,
    phone: data.phone,
    address: data.address || '',
    
    // Source & Conversion Tracking
    source: data.source || '', // 'lead:leadId' or 'direct'
    createdFrom: data.createdFrom || null, // 'lead:leadId' if converted from lead
    
    // KYC Documents (required for lease agreement)
    aadharNumber: data.aadharNumber || null,
    aadharDocS3Key: data.aadharDocS3Key || null,
    aadharDocUrl: data.aadharDocUrl || null,
    photoS3Key: data.photoS3Key || null,
    photoUrl: data.photoUrl || null,
    policeVerificationS3Key: data.policeVerificationS3Key || null,
    policeVerificationUrl: data.policeVerificationUrl || null,
    
    // Current Rental (active lease)
    currentRental: data.currentRental || null,
    // Structure: {
    //   propertyId, leaseStartDate, leaseEndDate, monthlyRent, securityDeposit,
    //   leaseAgreementS3Key, leaseAgreementUrl, depositReceiptS3Key, depositReceiptUrl,
    //   policeVerificationS3Key, policeVerificationUrl, notes
    // }
    
    // Rental History (past leases)
    rentalHistory: data.rentalHistory || [],
    // Same structure as currentRental
    
    // Status & Metadata
    status: data.status || 'active', // active, inactive
    notes: data.notes || '',
    tags: data.tags || [],
    assignedTo: data.assignedTo || null,
    
    // Timestamps
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy || SERVICE_ACCOUNT_USER,
    
    // Search index
    GSI3PK: `TENANT#${tenantId}#SEARCH`,
    GSI3SK: `CUSTOMER#${data.name.toLowerCase()}#${data.phone}`,
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: customer,
  }));

  return customer;
}

export async function getCustomers(tenantId, filters = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  filters = aliasQueryToSearch(filters);

  const items = await collectAllPages(docClient, ScanCommand, {
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'CUSTOMER',
      ':tenantId': tenantId,
    },
  }, { maxPages: 100 });
  let customers = items;

  // --- Search filter (name, phone, address) ---
  if (filters.search && filters.search.trim().length >= 2) {
    const q = filters.search.toLowerCase().trim();
    customers = customers.filter(c => {
      const nameMatch = c.name?.toLowerCase().includes(q);
      const phoneMatch = c.phone?.replace(/[\s-]/g, '').includes(q.replace(/[\s-]/g, ''));
      const addressMatch = c.address?.toLowerCase().includes(q);
      return nameMatch || phoneMatch || addressMatch;
    });
  }

  // --- Exact-match filters ---
  if (filters.status && filters.status !== 'all') {
    customers = customers.filter((c) => matchesFilterEnum(c.status, filters.status));
  }
  if (filters.source) {
    const sourceQ = filters.source.toLowerCase();
    customers = customers.filter(c => c.source?.toLowerCase() === sourceQ);
  }
  if (filters.tag) {
    const tagQ = filters.tag.toLowerCase();
    customers = customers.filter(c => Array.isArray(c.tags) && c.tags.some(t => t.toLowerCase() === tagQ));
  }

  // --- Substring filters ---
  if (filters.area) {
    const areaQ = filters.area.toLowerCase();
    customers = customers.filter(c => c.address && c.address.toLowerCase().includes(areaQ));
  }

  // --- Tenant-specific filters ---
  if (filters.hasCurrentRental === 'true' || filters.hasCurrentRental === true) {
    customers = customers.filter(c => !!c.currentRental);
  }
  if (filters.hasCurrentRental === 'false' || filters.hasCurrentRental === false) {
    customers = customers.filter(c => !c.currentRental);
  }
  if (filters.hasRentalHistory === 'true' || filters.hasRentalHistory === true) {
    customers = customers.filter(c => Array.isArray(c.rentalHistory) && c.rentalHistory.length > 0);
  }
  if (filters.hasRentalHistory === 'false' || filters.hasRentalHistory === false) {
    customers = customers.filter(c => !Array.isArray(c.rentalHistory) || c.rentalHistory.length === 0);
  }
  if (filters.propertyId) {
    customers = customers.filter(c => c.currentRental?.propertyId === filters.propertyId);
  }
  if (filters.monthlyRentMin) {
    const min = Number(filters.monthlyRentMin);
    customers = customers.filter(c => (c.currentRental?.monthlyRent || 0) >= min);
  }
  if (filters.monthlyRentMax) {
    const max = Number(filters.monthlyRentMax);
    customers = customers.filter(c => (c.currentRental?.monthlyRent || 0) <= max);
  }
  if (filters.leaseEndingWithinDays) {
    const days = Number(filters.leaseEndingWithinDays);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const cutoffTime = cutoff.getTime();
    customers = customers.filter(c => {
      if (!c.currentRental?.leaseEndDate) return false;
      return new Date(c.currentRental.leaseEndDate).getTime() <= cutoffTime;
    });
  }

  // --- Date range filters ---
  if (filters.createdFrom) {
    const fromTime = new Date(filters.createdFrom).getTime();
    customers = customers.filter(c => new Date(c.createdAt).getTime() >= fromTime);
  }
  if (filters.createdTo) {
    const toTime = new Date(filters.createdTo).getTime();
    customers = customers.filter(c => new Date(c.createdAt).getTime() <= toTime);
  }

  // --- Sorting ---
  const sortBy = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
  const sortMap = {
    name: (c) => (c.name || '').toLowerCase(),
    status: (c) => (c.status || '').toLowerCase(),
    createdAt: (c) => new Date(c.createdAt).getTime(),
    updatedAt: (c) => new Date(c.updatedAt || c.createdAt).getTime(),
    monthlyRent: (c) => c.currentRental?.monthlyRent || 0,
    leaseEndDate: (c) => c.currentRental?.leaseEndDate ? new Date(c.currentRental.leaseEndDate).getTime() : 0,
  };
  const getter = sortMap[sortBy] || sortMap.createdAt;
  customers.sort((a, b) => {
    const av = getter(a);
    const bv = getter(b);
    if (av < bv) return -1 * sortOrder;
    if (av > bv) return 1 * sortOrder;
    return 0;
  });

  // --- Pagination ---
  const total = customers.length;
  const limit = Math.min(Number(filters.limit) || 50, 200);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  const paginated = customers.slice(offset, offset + limit);

  return { customers: paginated, total, limit, offset };
}

export async function getCustomer(tenantId, customerId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE',
    },
  }));
  return result.Item || null;
}

export async function updateCustomer(tenantId, customerId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  rejectForbiddenKeys(data);

  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  // Add updatedAt
  data.updatedAt = new Date().toISOString();

  Object.keys(data).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = data[key];
  });

  try {
    await docClient.send(new UpdateCommand({
      TableName: CRM_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ConditionExpression: 'attribute_exists(PK)',
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues,
    }));
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      throw new Error('Customer not found');
    }
    throw err;
  }

  return await getCustomer(tenantId, customerId);
}

/**
 * Archive a tenant/customer (reversible soft-remove) instead of deleting it.
 * Reuses the existing 'inactive' status rather than adding a new enum value:
 * unlike lead's 'lost' (a distinct outcome), tenant status has no meaning
 * that 'archived' would need to be distinguished from.
 */
export async function archiveCustomer(tenantId, customerId) {
  return updateCustomer(tenantId, customerId, { status: 'inactive' });
}

export async function deleteCustomer(tenantId, customerId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  await docClient.send(new DeleteCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE',
    },
  }));
  return true;
}

// ============== Customer Notes Operations ==============

export async function createCustomerNote(tenantId, customerId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const noteId = uuidv4();
  const note = {
    PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
    SK: `NOTE#${noteId}`,
    EntityType: 'NOTE',
    tenantId,
    noteId,
    customerId,
    content: data.content,
    createdBy: data.createdBy || SERVICE_ACCOUNT_USER,
    createdAt: data.createdAt || new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: note,
  }));

  try {
    await logContactActivity(tenantId, {
      activityType: 'note_added',
      subjectEntityType: 'customer',
      subjectEntityId: customerId,
      title: 'Note Added (Customer)',
      description: data.content,
      performedBy: data.createdBy,
      payload: { noteId, content: data.content },
    });
  } catch (err) {
    logger.error('createCustomerNote.logContactActivity.error', { customerId, error: err.message });
  }

  return note;
}

export async function getCustomerNotes(tenantId, customerId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const result = await docClient.send(new QueryCommand({
    TableName: CRM_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      ':sk': 'NOTE#',
    },
  }));
  let notes = result.Items || [];

  // Fallback: if there are no NOTE items but the customer PROFILE has "notes",
  // expose that as a synthetic first note so history is still visible
  if (!notes.length) {
    const customerProfile = await getCustomer(tenantId, customerId);
    if (customerProfile && customerProfile.notes) {
      notes = [{
        PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
        SK: 'NOTE#PROFILE_NOTES',
        EntityType: 'NOTE',
        tenantId,
        customerId,
        noteId: 'PROFILE_NOTES',
        content: customerProfile.notes,
        createdBy: SERVICE_ACCOUNT_USER,
        createdAt: customerProfile.createdAt || new Date().toISOString(),
      }];
    }
  }

  return notes;
}

// ============== Owner Notes Operations ==============

export async function createOwnerNote(tenantId, ownerId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  const noteId = uuidv4();
  const note = {
    PK: `TENANT#${tenantId}#OWNER#${ownerId}`,
    SK: `NOTE#${noteId}`,
    EntityType: 'NOTE',
    tenantId,
    noteId,
    ownerId,
    content: data.content,
    createdBy: data.createdBy || SERVICE_ACCOUNT_USER,
    createdAt: data.createdAt || new Date().toISOString(),
  };
  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: note,
  }));

  try {
    await logContactActivity(tenantId, {
      activityType: 'note_added',
      subjectEntityType: 'owner',
      subjectEntityId: ownerId,
      title: 'Note Added (Owner)',
      description: data.content,
      performedBy: data.createdBy,
      payload: { noteId, content: data.content },
    });
  } catch (err) {
    logger.error('createOwnerNote.logContactActivity.error', { ownerId, error: err.message });
  }

  return note;
}

export async function getOwnerNotes(tenantId, ownerId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  const result = await docClient.send(new QueryCommand({
    TableName: CRM_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#OWNER#${ownerId}`,
      ':sk': 'NOTE#',
    },
  }));
  let notes = result.Items || [];
  if (!notes.length) {
    const ownerProfile = await getOwner(tenantId, ownerId);
    if (ownerProfile && ownerProfile.notes) {
      notes = [{
        PK: `TENANT#${tenantId}#OWNER#${ownerId}`,
        SK: 'NOTE#PROFILE_NOTES',
        EntityType: 'NOTE',
        tenantId,
        ownerId,
        noteId: 'PROFILE_NOTES',
        content: ownerProfile.notes,
        createdBy: SERVICE_ACCOUNT_USER,
        createdAt: ownerProfile.createdAt || new Date().toISOString(),
      }];
    }
  }
  return notes;
}

export async function updateCustomerNote(tenantId, customerId, noteId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!customerId) {
    throw new Error('Customer ID is required');
  }
  if (!noteId) {
    throw new Error('Note ID is required');
  }
  if (noteId === 'PROFILE_NOTES') {
    throw new Error('PROFILE_NOTES cannot be edited');
  }
  rejectForbiddenKeys(data);

  const result = await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: `NOTE#${noteId}`,
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

export async function deleteCustomerNote(tenantId, customerId, noteId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!customerId) {
    throw new Error('Customer ID is required');
  }
  if (!noteId) {
    throw new Error('Note ID is required');
  }
  if (noteId === 'PROFILE_NOTES') {
    throw new Error('PROFILE_NOTES cannot be deleted');
  }

  await docClient.send(new DeleteCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: `NOTE#${noteId}`,
    },
  }));

  return true;
}

export async function updateOwnerNote(tenantId, ownerId, noteId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!ownerId) {
    throw new Error('Owner ID is required');
  }
  if (!noteId) {
    throw new Error('Note ID is required');
  }
  if (noteId === 'PROFILE_NOTES') {
    throw new Error('PROFILE_NOTES cannot be edited');
  }
  rejectForbiddenKeys(data);

  const result = await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#OWNER#${ownerId}`,
      SK: `NOTE#${noteId}`,
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

export async function deleteOwnerNote(tenantId, ownerId, noteId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!ownerId) {
    throw new Error('Owner ID is required');
  }
  if (!noteId) {
    throw new Error('Note ID is required');
  }
  if (noteId === 'PROFILE_NOTES') {
    throw new Error('PROFILE_NOTES cannot be deleted');
  }

  await docClient.send(new DeleteCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#OWNER#${ownerId}`,
      SK: `NOTE#${noteId}`,
    },
  }));

  return true;
}

// ============== Lookup by Phone Operations ==============

export async function getOwnerByPhone(tenantId, phone) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  // Normalize: if phone is an object (from skillInvoker dynamic dispatch), extract 'phone' field
  if (phone && typeof phone === 'object' && !Array.isArray(phone)) {
    phone = phone.phone;
  }
  if (phone !== undefined && phone !== null && typeof phone !== 'string') {
    phone = String(phone);
  }
  if (!phone) {
    return null;
  }

  // Normalize phone number (remove spaces, dashes)
  const normalizedPhone = phone.replace(/[\s-]/g, '');
  
  const { owners } = await getOwners(tenantId);
  return owners.find(o => {
    const ownerPhone = (o.phone || '').replace(/[\s-]/g, '');
    return ownerPhone === normalizedPhone || 
           ownerPhone.endsWith(normalizedPhone.slice(-10)) || 
           normalizedPhone.endsWith(ownerPhone.slice(-10));
  }) || null;
}

export async function getCustomerByPhone(tenantId, phone) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  // Normalize: if phone is an object (from skillInvoker dynamic dispatch), extract 'phone' field
  if (phone && typeof phone === 'object' && !Array.isArray(phone)) {
    phone = phone.phone;
  }
  if (phone !== undefined && phone !== null && typeof phone !== 'string') {
    phone = String(phone);
  }
  if (!phone) {
    return null;
  }

  // Normalize phone number (remove spaces, dashes)
  const normalizedPhone = phone.replace(/[\s-]/g, '');
  
  const { customers } = await getCustomers(tenantId);
  return customers.find(c => {
    const customerPhone = (c.phone || '').replace(/[\s-]/g, '');
    return customerPhone === normalizedPhone || 
           customerPhone.endsWith(normalizedPhone.slice(-10)) || 
           normalizedPhone.endsWith(customerPhone.slice(-10));
  }) || null;
}

// ============== Property Owner Operations ==============

export async function createOwner(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const ownerId = uuidv4();
  const owner = {
    PK: `TENANT#${tenantId}#OWNER#${ownerId}`,
    SK: 'PROFILE',
    EntityType: 'OWNER',
    tenantId,
    ownerId,
    name: data.name,
    email: data.email || null,
    phone: data.phone,
    address: data.address || '',
    panNumber: data.panNumber || null,
    aadharNumber: data.aadharNumber || null,
    panDocS3Key: data.panDocS3Key || null,      // S3 key for PAN document
    aadharDocS3Key: data.aadharDocS3Key || null, // S3 key for Aadhar document
    photoS3Key: data.photoS3Key || null,         // S3 key for owner photo
    bankDetails: data.bankDetails || null,
    bankName: data.bankName || null,
    accountNumber: data.accountNumber || null,
    ifscCode: data.ifscCode || null,
    notes: data.notes || '',
    tags: data.tags || [], // Tags for categorization
    source: data.source || '', // How they came (e.g., enquiry_contact)
    status: data.status || 'active', // active, inactive
    assignedTo: data.assignedTo || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    GSI3PK: `TENANT#${tenantId}#SEARCH`,
    GSI3SK: `OWNER#${data.name.toLowerCase()}#${data.phone}`,
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: owner,
  }));

  return owner;
}

export async function getOwners(tenantId, filters = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  filters = aliasQueryToSearch(filters);

  const items = await collectAllPages(docClient, ScanCommand, {
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'OWNER',
      ':tenantId': tenantId,
    },
  }, { maxPages: 100 });
  let owners = items;

  if (filters.status && filters.status !== 'all') {
    owners = owners.filter((o) => matchesFilterEnum(o.status, filters.status));
  }
  if (filters.source) {
    owners = owners.filter(o => o.source === filters.source);
  }
  if (filters.area) {
    const areaQuery = filters.area.toLowerCase();
    owners = owners.filter(o => o.address && o.address.toLowerCase().includes(areaQuery));
  }
  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    owners = owners.filter(o =>
      o.name?.toLowerCase().includes(q) ||
      o.phone?.replace(/[\s-]/g, '').includes(q.replace(/[\s-]/g, ''))
    );
  }
  if (filters.createdFrom) {
    owners = owners.filter(o => o.createdAt >= filters.createdFrom);
  }
  if (filters.createdTo) {
    owners = owners.filter(o => o.createdAt <= filters.createdTo);
  }
  if (filters.tag) {
    const tagQuery = filters.tag.toLowerCase();
    owners = owners.filter(o =>
      Array.isArray(o.tags) && o.tags.some(t => t.toLowerCase() === tagQuery)
    );
  }

  // Sort
  const sortBy = filters.sortBy || 'createdAt';
  const sortMult = filters.sortOrder === 'asc' ? 1 : -1;
  owners.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return sortMult * (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
      case 'status':
        return sortMult * (a.status || '').localeCompare(b.status || '');
      case 'source':
        return sortMult * (a.source || '').localeCompare(b.source || '');
      case 'updatedAt':
        return sortMult * (a.updatedAt || '').localeCompare(b.updatedAt || '');
      case 'createdAt':
      default:
        return sortMult * (a.createdAt || '').localeCompare(b.createdAt || '');
    }
  });

  const total = owners.length;
  const limit = parseInt(filters.limit) || 0;
  const offset = parseInt(filters.offset) || 0;

  if (limit > 0 || offset > 0) {
    const paginated = owners.slice(offset, offset + limit);
    return { owners: paginated, total, limit, offset };
  }

  return { owners, total, limit: 0, offset: 0 };
}

export async function getOwner(tenantId, ownerId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#OWNER#${ownerId}`,
      SK: 'PROFILE',
    },
  }));
  return result.Item || null;
}

export async function updateOwner(tenantId, ownerId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  rejectForbiddenKeys(data);

  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  // Add updatedAt
  data.updatedAt = new Date().toISOString();

  Object.keys(data).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = data[key];
  });

  try {
    await docClient.send(new UpdateCommand({
      TableName: CRM_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#OWNER#${ownerId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ConditionExpression: 'attribute_exists(PK)',
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues,
    }));
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      throw new Error('Owner not found');
    }
    throw err;
  }

  return await getOwner(tenantId, ownerId);
}

/**
 * Archive an owner (reversible soft-remove) instead of deleting it.
 * Reuses the existing 'inactive' status, same reasoning as archiveCustomer.
 */
export async function archiveOwner(tenantId, ownerId) {
  return updateOwner(tenantId, ownerId, { status: 'inactive' });
}

export async function deleteOwner(tenantId, ownerId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  await docClient.send(new DeleteCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#OWNER#${ownerId}`,
      SK: 'PROFILE',
    },
  }));
  return true;
}

// ============== CRM Property Operations ==============

const LISTING_MARKET_STATUSES = new Set(['for-sale', 'for-rent']);

function isListingMarketStatus(status) {
  return LISTING_MARKET_STATUSES.has(String(status || '').toLowerCase());
}

/** Resolve the canonical Contact linked to a property's owner. */
async function resolveContactForProperty(tenantId, property) {
  if (!property) return null;

  const fromProperty = property.currentOwnerContactId || property.ownerContactId;
  if (fromProperty) {
    const contact = await getContact(tenantId, fromProperty);
    if (contact) return contact;
  }

  if (property.ownerId) {
    const owner = await getOwner(tenantId, property.ownerId);
    if (owner?.contactId) {
      const contact = await getContact(tenantId, owner.contactId);
      if (contact) return contact;
    }
    if (owner?.phone) {
      const byPhone = await findContactByPhone(tenantId, owner.phone);
      if (byPhone) return byPhone;
    }
  }

  return null;
}

async function appendPropertyToContactOwnerProfile(tenantId, contact, propertyId) {
  if (!contact?.contactId || !propertyId) return;

  const existing = contact.ownerProfile || {};
  const ownedIds = Array.isArray(existing.ownedPropertyIds) ? [...existing.ownedPropertyIds] : [];
  if (ownedIds.includes(propertyId)) return;

  ownedIds.push(propertyId);
  await updateContact(tenantId, contact.contactId, {
    ownerProfile: buildOwnerProfile({
      ...existing,
      ownedPropertyIds: ownedIds,
    }),
    roles: {
      ...(contact.roles || {}),
      owner: true,
    },
  });
}

async function recordPropertyTimelineActivity(tenantId, contactId, {
  activityType,
  property,
  description = '',
  performedBy = SERVICE_ACCOUNT_USER,
  payload = {},
}) {
  if (!contactId || !property) return;

  const isRent = property.status === 'for-rent';
  const titleByType = {
    property_added: property.title ? `Added ${property.title}` : 'Added a property',
    property_listed: property.title
      ? `Listed ${property.title} for ${isRent ? 'rent' : 'sale'}`
      : `Listed for ${isRent ? 'rent' : 'sale'}`,
  };

  await createContactActivity(tenantId, contactId, {
    activityType,
    subjectEntityType: 'contact',
    subjectEntityId: contactId,
    title: titleByType[activityType] || `Property Updated: ${property.title || 'Property'}`,
    description,
    performedBy,
    payload: {
      propertyId: property.propertyId,
      propertyTitle: property.title || null,
      propertyStatus: property.status || null,
      area: property.area || null,
      ...payload,
    },
  });
}

async function syncPropertyContactTimeline(tenantId, property, {
  isNew = false,
  previousStatus = null,
  performedBy = SERVICE_ACCOUNT_USER,
} = {}) {
  if (!property?.propertyId) return;

  try {
    const contact = await resolveContactForProperty(tenantId, property);
    if (!contact?.contactId) return;

    await appendPropertyToContactOwnerProfile(tenantId, contact, property.propertyId);

    const normalizedStatus = normalizePropertyMarketStatus(property.status);
    const normalizedPrevious = normalizePropertyMarketStatus(previousStatus);

    if (isNew) {
      const areaLabel = [property.area, property.city].filter(Boolean).join(', ');
      await recordPropertyTimelineActivity(tenantId, contact.contactId, {
        activityType: 'property_added',
        property,
        description: areaLabel
          ? `New property registered in ${areaLabel}.`
          : 'New property registered for this owner.',
        performedBy,
      });
    }

    if (isListingMarketStatus(normalizedStatus)
      && (isNew || !isListingMarketStatus(normalizedPrevious))) {
      const price = property.saleInfo?.listedPrice ?? property.rentalInfo?.expectedRent ?? null;
      await recordPropertyTimelineActivity(tenantId, contact.contactId, {
        activityType: 'property_listed',
        property,
        description: normalizedStatus === 'for-rent'
          ? `Listed for rent${price != null ? ` at INR ${Number(price).toLocaleString()}/mo` : ''}.`
          : `Listed for sale${price != null ? ` at INR ${Number(price).toLocaleString()}` : ''}.`,
        performedBy,
        payload: {
          listingType: normalizedStatus === 'for-rent' ? 'rent' : 'sale',
          listedPrice: property.saleInfo?.listedPrice ?? null,
          expectedRent: property.rentalInfo?.expectedRent ?? null,
        },
      });
    }
  } catch (err) {
    logger.error('syncPropertyContactTimeline.error', {
      tenantId,
      propertyId: property?.propertyId,
      error: err.message,
    });
  }
}

export async function createProperty(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const propertyId = uuidv4();
  // Owner is now optional - can be null/undefined for unassigned properties
  const ownerId = data.ownerId || null;
  // Canonical current owner is a Contact id (Phase 0/1 domain model)
  let currentOwnerContactId = data.currentOwnerContactId || data.ownerContactId || null;
  if (!currentOwnerContactId && ownerId) {
    const owner = await getOwner(tenantId, ownerId);
    currentOwnerContactId = owner?.contactId || null;
  }
  
  const property = {
    PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
    SK: 'PROFILE',
    EntityType: 'PROPERTY',
    tenantId,
    propertyId,
    
    // Ownership — currentOwnerContactId is canonical; ownerId is legacy bridge
    ownerId: ownerId, // Links to OWNER entity (legacy)
    currentOwnerContactId,
    ownerContactId: currentOwnerContactId, // alias used by khata / getPropertyContacts
    previousOwnerContactId: data.previousOwnerContactId || null,
    previousOwnerId: data.previousOwnerId || null,
    ownerName: data.ownerName || null, // Denormalized for display (legacy)
    ownerPhone: data.ownerPhone ? normalizePhoneE164(data.ownerPhone) : null, // Legacy + normalized
    ownerSnapshot: data.ownerSnapshot || (data.ownerName || data.ownerPhone ? {
      name: data.ownerName || null,
      phone: data.ownerPhone ? normalizePhoneE164(data.ownerPhone) : null,
      contactId: currentOwnerContactId || null,
    } : null),
    convertedFromLeadId: data.convertedFromLeadId || null,
    latestSaleTransactionId: data.latestSaleTransactionId || null,
    
    // Basic Details
    title: data.title,
    description: data.description || '',
    propertyType: data.propertyType || 'apartment', // apartment, house, villa, office
    bhk: data.bhk || 1,
    area: data.area || '', // Location/Area
    city: data.city || 'Mumbai',
    address: data.address || '',
    flatNumber: data.flatNumber || '',
    floor: data.floor || '',
    buildingName: data.buildingName || '',
    carpetArea: data.carpetArea || 0,
    builtUpArea: data.builtUpArea || 0,
    furnishing: data.furnishing || 'unfurnished', // furnished, semi-furnished, unfurnished
    facing: data.facing || null, // north, south, east, west
    amenities: data.amenities || [],
    
    // Property Lifecycle Status
    status: data.status || 'available',
    // Enum: 'available' | 'for-sale' | 'for-rent' | 'rented' | 'sold' | 'on-hold' | 'out-of-stock'
    
    listingStatus: data.listingStatus || 'inactive', // 'active' | 'inactive' (for marketing)
    
    // Rental Information (if status = for-rent or rented)
    rentalInfo: data.rentalInfo || {
      expectedRent: data.rentAmount || 0,
      currentRent: null,
      currentTenantId: null, // Links to CUSTOMER entity
      leaseStartDate: null,
      leaseEndDate: null,
      securityDeposit: data.depositAmount || 0,
    },
    
    // Brokerage expectation
    expectedBrokerage: data.expectedBrokerage || null,
    
    // Sale Information (if status = for-sale or sold)
    saleInfo: data.saleInfo || {
      listedPrice: null,
      soldPrice: null,
      soldDate: null,
      soldToBuyerId: null, // Links to BUYER entity
    },
    
    ownershipHistory: data.ownershipHistory || [],
    
    // Rental History (past rentals on this property)
    rentalHistory: data.rentalHistory || [],
    // [{ tenantId, tenantName, leaseStartDate, leaseEndDate, monthlyRent, securityDeposit }]
    
    // Property Documents
    titleDeedS3Key: data.titleDeedS3Key || null,
    titleDeedUrl: data.titleDeedUrl || null,
    occupancyCertificateS3Key: data.occupancyCertificateS3Key || null,
    occupancyCertificateUrl: data.occupancyCertificateUrl || null,
    propertyTaxReceiptS3Key: data.propertyTaxReceiptS3Key || null,
    propertyTaxReceiptUrl: data.propertyTaxReceiptUrl || null,
    
    // Media
    images: data.images || [], // Array of {s3Key, url, description}
    videos: data.videos || [],
    
    // Geolocation
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    
    // Legacy fields (for backward compatibility during migration)
    tenantCustomerId: data.tenantCustomerId || null,
    tenantMoveInDate: data.tenantMoveInDate || null,
    tenureMonths: data.tenureMonths || null,
    agreementStatus: data.agreementStatus || 'pending',
    verificationStatus: data.verificationStatus || 'pending',
    
    // Metadata
    featured: data.featured || false,
    verified: data.verified || false,
    views: data.views || 0,
    availableFrom: data.availableFrom || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    
    // GSI1 - Owner index (prefer Contact; fall back to legacy OWNER#)
    GSI1PK: currentOwnerContactId
      ? `TENANT#${tenantId}#CONTACT#${currentOwnerContactId}`
      : (ownerId ? `TENANT#${tenantId}#OWNER#${ownerId}` : `TENANT#${tenantId}#OWNER#UNASSIGNED`),
    GSI1SK: `PROPERTY#${propertyId}`,
    
    // GSI2 - Status index
    GSI2PK: `TENANT#${tenantId}#PROPERTY_STATUS#${data.status || 'available'}`,
    GSI2SK: `PROPERTY#${propertyId}`,
    
    // GSI3 - Search index
    GSI3PK: `TENANT#${tenantId}#SEARCH`,
    GSI3SK: `PROPERTY#${(data.title || '').toLowerCase()}#${(data.area || '').toLowerCase()}#${(data.buildingName || '').toLowerCase()}`,
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: property,
  }));

  // Auto-create or update area when property is created
  if (property.area && property.city) {
    try {
      logger.info('crm.property.area.autoCreate.start', {
        tenantId,
        area: property.area,
        city: property.city,
      });

      const area = await getOrCreateArea(tenantId, property.area, property.city);

      logger.info('crm.property.area.autoCreate.found', {
        tenantId,
        areaId: area?.areaId,
        area: property.area,
        city: property.city,
      });
      if (area && area.areaId) {
        await incrementAreaPropertyCount(tenantId, area.areaId);
        logger.info('crm.property.area.autoCreate.incremented', {
          tenantId,
          areaId: area.areaId,
        });
      }
    } catch (error) {
      logger.error('crm.property.area.autoCreate.error', {
        tenantId,
        area: property.area,
        city: property.city,
        errorMessage: error?.message,
        errorName: error?.name,
        stack: error?.stack,
      });
      // Don't fail property creation if area update fails
    }
  } else {
    logger.warn('crm.property.area.autoCreate.skipped', {
      tenantId,
      area: property.area,
      city: property.city,
    });
  }

  await syncPropertyContactTimeline(tenantId, property, {
    isNew: true,
    performedBy: data.createdBy || data.performedBy || SERVICE_ACCOUNT_USER,
  });

  return property;
}

export async function getProperties(tenantId, filters = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const items = await collectAllPages(docClient, ScanCommand, {
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'PROPERTY',
      ':tenantId': tenantId,
    },
  }, { maxPages: 100 });
  let properties = items;

  if (filters.status) {
    if (filters.status === 'available') {
      properties = properties.filter(p =>
        ['for-sale', 'for-rent'].includes(p.status),
      );
    } else if (filters.status === 'not-listed') {
      properties = properties.filter(p =>
        ['not-listed', 'inactive', 'available', 'on-hold'].includes(p.status),
      );
    } else {
      properties = properties.filter(p => p.status === filters.status);
    }
  }
  if (filters.propertyType) {
    properties = properties.filter(p => p.propertyType === filters.propertyType);
  }
  if (filters.bhk) {
    properties = properties.filter(p => String(p.bhk) === String(filters.bhk));
  }
  if (filters.furnishing) {
    properties = properties.filter(p => p.furnishing === filters.furnishing);
  }
  if (filters.area) {
    const areaQuery = filters.area.toLowerCase();
    properties = properties.filter(p =>
      p.area?.toLowerCase().includes(areaQuery) ||
      p.buildingName?.toLowerCase().includes(areaQuery) ||
      p.address?.toLowerCase().includes(areaQuery)
    );
  }
  if (filters.city) {
    const cityQuery = filters.city.toLowerCase();
    properties = properties.filter(p => p.city?.toLowerCase().includes(cityQuery));
  }
  if (filters.ownerId) {
    properties = properties.filter(p => p.ownerId === filters.ownerId);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    properties = properties.filter(p =>
      p.title?.toLowerCase().includes(q) ||
      p.area?.toLowerCase().includes(q) ||
      p.buildingName?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q)
    );
  }
  if (filters.minRent) {
    const min = Number(filters.minRent);
    properties = properties.filter(p => (p.rentAmount || p.rentalInfo?.expectedRent || 0) >= min);
  }
  if (filters.maxRent) {
    const max = Number(filters.maxRent);
    properties = properties.filter(p => (p.rentAmount || p.rentalInfo?.expectedRent || 0) <= max);
  }
  if (filters.minSalePrice) {
    const min = Number(filters.minSalePrice);
    properties = properties.filter(p => (p.saleInfo?.listedPrice || p.salePrice || 0) >= min);
  }
  if (filters.maxSalePrice) {
    const max = Number(filters.maxSalePrice);
    properties = properties.filter(p => (p.saleInfo?.listedPrice || p.salePrice || 0) <= max);
  }
  if (filters.createdFrom) {
    properties = properties.filter(p => p.createdAt >= filters.createdFrom);
  }
  if (filters.createdTo) {
    properties = properties.filter(p => p.createdAt <= filters.createdTo);
  }
  if (filters.tag) {
    const tagQuery = filters.tag.toLowerCase();
    properties = properties.filter(p =>
      Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase() === tagQuery)
    );
  }

  // Sort
  const sortBy = filters.sortBy || 'createdAt';
  const sortMult = filters.sortOrder === 'asc' ? 1 : -1;
  properties.sort((a, b) => {
    switch (sortBy) {
      case 'name':
      case 'title':
        return sortMult * (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
      case 'area':
        return sortMult * (a.area || '').toLowerCase().localeCompare((b.area || '').toLowerCase());
      case 'city':
        return sortMult * (a.city || '').toLowerCase().localeCompare((b.city || '').toLowerCase());
      case 'status':
        return sortMult * (a.status || '').localeCompare(b.status || '');
      case 'propertyType':
        return sortMult * (a.propertyType || '').localeCompare(b.propertyType || '');
      case 'rent':
        return sortMult * ((a.rentAmount || a.rentalInfo?.expectedRent || 0) - (b.rentAmount || b.rentalInfo?.expectedRent || 0));
      case 'salePrice':
        return sortMult * ((a.saleInfo?.listedPrice || a.salePrice || 0) - (b.saleInfo?.listedPrice || b.salePrice || 0));
      case 'updatedAt':
        return sortMult * (a.updatedAt || '').localeCompare(b.updatedAt || '');
      case 'createdAt':
      default:
        return sortMult * (a.createdAt || '').localeCompare(b.createdAt || '');
    }
  });

  const total = properties.length;
  const limit = parseInt(filters.limit) || 0;
  const offset = parseInt(filters.offset) || 0;

  if (limit > 0 || offset > 0) {
    const paginated = properties.slice(offset, offset + limit);
    return { properties: paginated, total, limit, offset };
  }

  return { properties, total, limit: 0, offset: 0 };
}

export async function getPropertiesByStatus(tenantId, status) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const result = await docClient.send(new QueryCommand({
    TableName: CRM_TABLE_NAME,
    IndexName: 'status-index',
    KeyConditionExpression: 'GSI2PK = :statusKey',
    ExpressionAttributeValues: {
      ':statusKey': `TENANT#${tenantId}#PROPERTY_STATUS#${status}`,
    },
  }));
  return result.Items || [];
}

export async function getPropertiesByOwner(tenantId, ownerId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!ownerId) return [];

  // Dual-read: CONTACT# (canonical) + OWNER# (legacy bridge)
  const [byContact, byOwner] = await Promise.all([
    docClient.send(new QueryCommand({
      TableName: CRM_TABLE_NAME,
      IndexName: 'owner-property-index',
      KeyConditionExpression: 'GSI1PK = :ownerKey',
      ExpressionAttributeValues: {
        ':ownerKey': `TENANT#${tenantId}#CONTACT#${ownerId}`,
      },
    })),
    docClient.send(new QueryCommand({
      TableName: CRM_TABLE_NAME,
      IndexName: 'owner-property-index',
      KeyConditionExpression: 'GSI1PK = :ownerKey',
      ExpressionAttributeValues: {
        ':ownerKey': `TENANT#${tenantId}#OWNER#${ownerId}`,
      },
    })),
  ]);

  const merged = new Map();
  for (const item of [...(byContact.Items || []), ...(byOwner.Items || [])]) {
    if (item?.propertyId) merged.set(item.propertyId, item);
  }

  // Resolve linked Contact for this OWNER id (or treat ownerId as contactId)
  let contactId = null;
  try {
    const owner = await getOwner(tenantId, ownerId);
    if (owner?.phone) {
      const contact = await findContactByPhone(tenantId, owner.phone);
      if (contact?.contactId) contactId = contact.contactId;
    }
  } catch {
    // ignore — fall through
  }
  if (!contactId) {
    const asContact = await getContact(tenantId, ownerId).catch(() => null);
    if (asContact?.contactId) contactId = asContact.contactId;
  }

  if (contactId && contactId !== ownerId) {
    const byLinkedContact = await docClient.send(new QueryCommand({
      TableName: CRM_TABLE_NAME,
      IndexName: 'owner-property-index',
      KeyConditionExpression: 'GSI1PK = :ownerKey',
      ExpressionAttributeValues: {
        ':ownerKey': `TENANT#${tenantId}#CONTACT#${contactId}`,
      },
    }));
    for (const item of byLinkedContact.Items || []) {
      if (item?.propertyId) merged.set(item.propertyId, item);
    }
  }

  // Scan fallback: ownerId / currentOwnerContactId match (covers post-sale GSI skew)
  try {
    const { properties } = await getProperties(tenantId);
    for (const p of properties || []) {
      if (!p?.propertyId || merged.has(p.propertyId)) continue;
      if (p.ownerId === ownerId) {
        merged.set(p.propertyId, p);
        continue;
      }
      if (contactId && (p.currentOwnerContactId === contactId || p.ownerContactId === contactId)) {
        merged.set(p.propertyId, p);
      }
    }
  } catch {
    // ignore scan fallback failures
  }

  return Array.from(merged.values());
}

/**
 * Check if a property already exists for a given lead conversion.
 * Used to prevent duplicate property listings when a lead is converted multiple times.
 */
export async function getPropertiesByLeadId(tenantId, leadId) {
  if (!tenantId || !leadId) return [];

  const result = await docClient.send(new ScanCommand({
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId AND convertedFromLeadId = :leadId',
    ExpressionAttributeValues: {
      ':type': 'PROPERTY',
      ':tenantId': tenantId,
      ':leadId': leadId,
    },
  }));
  return result.Items || [];
}

export async function getProperty(tenantId, propertyId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
  }));
  return result.Item || null;
}

export async function updateProperty(tenantId, propertyId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  rejectForbiddenKeys(data);

  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  // Add updatedAt
  data.updatedAt = new Date().toISOString();

  // Handle status change for GSI2
  const currentProperty = await getProperty(tenantId, propertyId);
  const previousStatus = currentProperty?.status || null;
  if (data.status && currentProperty) {
    data.status = normalizePropertyMarketStatus(data.status);
    if (data.status !== currentProperty.status) {
      if (!isValidPropertyStatusTransition(currentProperty.status, data.status)) {
        throw new Error(`Invalid property status transition: cannot change from '${currentProperty.status}' to '${data.status}'`);
      }
      data.GSI2PK = `TENANT#${tenantId}#PROPERTY_STATUS#${data.status}`;
    }
  }

  // Handle owner change for GSI1 (supports null/unassigned owner)
  // Prefer CONTACT# when currentOwnerContactId is set
  if ('currentOwnerContactId' in data && currentProperty) {
    const contactId = data.currentOwnerContactId || null;
    data.GSI1PK = contactId
      ? `TENANT#${tenantId}#CONTACT#${contactId}`
      : (data.ownerId || currentProperty.ownerId)
        ? `TENANT#${tenantId}#OWNER#${data.ownerId || currentProperty.ownerId}`
        : `TENANT#${tenantId}#OWNER#UNASSIGNED`;
  } else if ('ownerId' in data && currentProperty) {
    const newOwnerId = data.ownerId || null;
    data.GSI1PK = newOwnerId 
      ? `TENANT#${tenantId}#OWNER#${newOwnerId}` 
      : `TENANT#${tenantId}#OWNER#UNASSIGNED`;
  }

  // Update GSI3 if buildingName changes
  if (data.buildingName !== undefined && currentProperty) {
    const title = data.title || currentProperty.title || '';
    const area = data.area || currentProperty.area || '';
    const buildingName = data.buildingName || '';
    data.GSI3SK = `PROPERTY#${title.toLowerCase()}#${area.toLowerCase()}#${buildingName.toLowerCase()}`;
  }

  Object.keys(data).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = data[key];
  });

  try {
    await docClient.send(new UpdateCommand({
      TableName: CRM_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ConditionExpression: 'attribute_exists(PK)',
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues,
    }));
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      throw new Error('Property not found');
    }
    throw err;
  }

  // Ensure rental history is recorded for rented properties with an active tenant
  const updatedProperty = await getProperty(tenantId, propertyId);
  if (updatedProperty && updatedProperty.status === 'rented' && updatedProperty.tenantCustomerId) {
    const rentalHistory = updatedProperty.rentalHistory || [];
    const lastEntry = rentalHistory[rentalHistory.length - 1];
    const hasActiveEntry = lastEntry && !lastEntry.leaseEndDate && lastEntry.tenantId === updatedProperty.tenantCustomerId;

    if (!hasActiveEntry) {
      const customerResult = await docClient.send(new GetCommand({
        TableName: CRM_TABLE_NAME,
        Key: {
          PK: `TENANT#${tenantId}#CUSTOMER#${updatedProperty.tenantCustomerId}`,
          SK: 'PROFILE',
        },
      }));
      const tenantName = customerResult.Item?.name || 'Unknown Tenant';

      const newRentalEntry = {
        tenantId: updatedProperty.tenantCustomerId,
        tenantName,
        leaseStartDate: updatedProperty.tenantMoveInDate || new Date().toISOString(),
        leaseEndDate: null,
        monthlyRent: updatedProperty.rentAmount || 0,
        securityDeposit: updatedProperty.depositAmount || 0,
        brokeragePaid: updatedProperty.brokerageAmount || 0,
      };

      await docClient.send(new UpdateCommand({
        TableName: CRM_TABLE_NAME,
        Key: {
          PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
          SK: 'PROFILE',
        },
        UpdateExpression: 'SET rentalHistory = list_append(if_not_exists(rentalHistory, :emptyList), :newEntry)',
        ExpressionAttributeValues: {
          ':emptyList': [],
          ':newEntry': [newRentalEntry],
        },
      }));
    }

    // Sync brokeragePaid on active rental history entry when brokerageAmount changes
    if ('brokerageAmount' in data) {
      const freshProperty = await getProperty(tenantId, propertyId);
      const rentalHistory = freshProperty?.rentalHistory || [];
      const activeIdx = rentalHistory.findIndex(entry => !entry.leaseEndDate);
      if (activeIdx !== -1) {
        const activeEntry = rentalHistory[activeIdx];
        const newBrokerage = data.brokerageAmount ?? 0;
        if (activeEntry.brokeragePaid !== newBrokerage) {
          const updatedHistory = [...rentalHistory];
          updatedHistory[activeIdx] = {
            ...activeEntry,
            brokeragePaid: newBrokerage,
          };
          await docClient.send(new UpdateCommand({
            TableName: CRM_TABLE_NAME,
            Key: {
              PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
              SK: 'PROFILE',
            },
            UpdateExpression: 'SET rentalHistory = :rh',
            ExpressionAttributeValues: {
              ':rh': updatedHistory,
            },
          }));
        }
      }
    }
  }

  // Auto-create or update area when property is updated with new area/city
  if (updatedProperty && updatedProperty.area && updatedProperty.city) {
    try {
      logger.info('crm.property.area.autoUpdate.start', {
        tenantId,
        propertyId,
        area: updatedProperty.area,
        city: updatedProperty.city,
      });

      const area = await getOrCreateArea(tenantId, updatedProperty.area, updatedProperty.city);

      logger.info('crm.property.area.autoUpdate.found', {
        tenantId,
        propertyId,
        areaId: area?.areaId,
        area: updatedProperty.area,
        city: updatedProperty.city,
      });
      if (area && area.areaId) {
        // Only increment if this is a new area assignment (area or city changed)
        if (currentProperty && (currentProperty.area !== updatedProperty.area || currentProperty.city !== updatedProperty.city)) {
          await incrementAreaPropertyCount(tenantId, area.areaId);
          logger.info('crm.property.area.autoUpdate.incremented', {
            tenantId,
            propertyId,
            areaId: area.areaId,
          });
        }
      }
    } catch (error) {
      logger.error('crm.property.area.autoUpdate.error', {
        tenantId,
        propertyId,
        area: updatedProperty.area,
        city: updatedProperty.city,
        errorMessage: error?.message,
        errorName: error?.name,
        stack: error?.stack,
      });
      // Don't fail property update if area update fails
    }
  }

  await syncPropertyContactTimeline(tenantId, updatedProperty, {
    isNew: false,
    previousStatus,
    performedBy: data.updatedBy || data.performedBy || SERVICE_ACCOUNT_USER,
  });

  return updatedProperty;
}

/**
 * Archive a property (reversible soft-remove) instead of deleting it.
 * Delegates to updateProperty so archiving goes through the exact same
 * status-transition validation, GSI2 bookkeeping, and area/timeline sync
 * a normal status change already does -- no separate code path to drift.
 */
export async function archiveProperty(tenantId, propertyId) {
  return updateProperty(tenantId, propertyId, { status: 'archived' });
}

export async function deleteProperty(tenantId, propertyId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const property = await getProperty(tenantId, propertyId);
  if (!property) {
    throw new Error('Property not found');
  }

  // Prevent deletion of properties with active tenants
  if (property.tenantCustomerId || (property.rentalInfo && property.rentalInfo.currentTenantId)) {
    throw new Error('Cannot delete a property with an active tenant. Please vacate the property first.');
  }

  // Prevent deletion of sold properties
  if (property.status === 'sold') {
    throw new Error('Cannot delete a sold property');
  }

  await docClient.send(new DeleteCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
  }));
  return true;
}

export async function incrementPropertyViews(tenantId, propertyId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #views = if_not_exists(#views, :zero) + :inc',
    ExpressionAttributeNames: {
      '#views': 'views',
    },
    ExpressionAttributeValues: {
      ':zero': 0,
      ':inc': 1,
    },
  }));
}

// ============== Dashboard Metrics ==============

export async function getCRMMetrics(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const [
    customersResult,
    ownersResult,
    propertiesResult,
    leadsResult,
    buyersResult,
    sellerContactsResult,
    ownerContactsResult,
    contactsCountResult,
  ] = await Promise.all([
    docClient.send(new ScanCommand({
      TableName: CRM_TABLE_NAME,
      FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
      ExpressionAttributeValues: { ':type': 'CUSTOMER', ':tenantId': tenantId },
      ProjectionExpression: '#s',
      ExpressionAttributeNames: { '#s': 'status' },
    })),
    docClient.send(new ScanCommand({
      TableName: CRM_TABLE_NAME,
      FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
      ExpressionAttributeValues: { ':type': 'OWNER', ':tenantId': tenantId },
      ProjectionExpression: 'ownerId, contactId, #s',
      ExpressionAttributeNames: { '#s': 'status' },
    })),
    docClient.send(new ScanCommand({
      TableName: CRM_TABLE_NAME,
      FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
      ExpressionAttributeValues: { ':type': 'PROPERTY', ':tenantId': tenantId },
      ProjectionExpression: '#s, agreementStatus, verificationStatus, ownerId, listingType, listingStatus',
      ExpressionAttributeNames: { '#s': 'status' },
    })),
    docClient.send(new ScanCommand({
      TableName: CRM_TABLE_NAME,
      FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
      ExpressionAttributeValues: { ':type': 'LEAD', ':tenantId': tenantId },
      Select: 'COUNT',
    })),
    Promise.all([
      docClient.send(new ScanCommand({
        TableName: CRM_TABLE_NAME,
        FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
        ExpressionAttributeValues: { ':type': 'BUYER', ':tenantId': tenantId },
        ProjectionExpression: 'phone, buyerId',
      })),
    ]),
    docClient.send(new ScanCommand({
      TableName: CRM_TABLE_NAME,
      FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
      ExpressionAttributeValues: { ':type': 'CONTACT', ':tenantId': tenantId },
      ProjectionExpression: 'contactId, #roles, sellerProfile',
      ExpressionAttributeNames: { '#roles': 'roles' },
    })),
    docClient.send(new ScanCommand({
      TableName: CRM_TABLE_NAME,
      FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
      ExpressionAttributeValues: { ':type': 'CONTACT', ':tenantId': tenantId },
      ProjectionExpression: 'contactId, #roles, ownerProfile',
      ExpressionAttributeNames: { '#roles': 'roles' },
    })),
    docClient.send(new ScanCommand({
      TableName: CRM_TABLE_NAME,
      FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
      ExpressionAttributeValues: { ':type': 'CONTACT', ':tenantId': tenantId },
      Select: 'COUNT',
    })),
  ]);
  const customers = customersResult.Items || [];
  const owners = ownersResult.Items || [];
  const properties = propertiesResult.Items || [];
  const leadsCount = leadsResult.Count || 0;

  const legacyBuyers = buyersResult[0].Items || [];
  const phoneMap = new Map();
  for (const b of legacyBuyers) {
    const phone = normalizePhone(b.phone);
    if (phone && !phoneMap.has(phone)) {
      phoneMap.set(phone, b);
    } else if (!phone) {
      phoneMap.set(b.buyerId, b);
    }
  }
  const buyersCount = phoneMap.size;

  const contactByPhone = new Map();
  for (const c of [
    ...(sellerContactsResult.Items || []),
    ...(ownerContactsResult.Items || []),
  ]) {
    const phone = normalizePhone(c.phone);
    if (phone) contactByPhone.set(phone, c);
  }

  const ownersWithProperties = owners.filter((owner) => {
    const contact = contactByPhone.get(normalizePhone(owner.phone));
    const contactId = contact?.contactId || owner.contactId || null;
    return properties.some((p) => propertyIsCurrentlyOwnedBy(p, {
      ownerId: owner.ownerId,
      contactId,
    }));
  });

  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const activeOwners = ownersWithProperties.filter(o => o.status === 'active').length;
  const availableProperties = properties.filter(p =>
    p.status === 'for-sale' || p.status === 'for-rent',
  ).length;
  const inactiveProperties = properties.filter(p =>
    p.status === 'not-listed' || p.status === 'inactive' || p.status === 'available',
  ).length;
  const onHoldProperties = properties.filter(p => p.status === 'on-hold').length;
  const rentedProperties = properties.filter(p => p.status === 'rented').length;
  const soldProperties = properties.filter(p => p.status === 'sold').length;

  const agreementsDone = properties.filter(p => p.agreementStatus === 'done').length;
  const agreementsPending = properties.filter(p => p.agreementStatus === 'pending').length;
  const verificationsDone = properties.filter(p => p.verificationStatus === 'done').length;
  const verificationsPending = properties.filter(p => p.verificationStatus === 'pending').length;

  // Seller count: Contact.roles.seller (preferred) with active lifecycle, else legacy for-sale join
  const sellerContacts = (sellerContactsResult.Items || []).filter((c) =>
    c.roles?.seller === true
    && (c.sellerProfile?.lifecycleStatus || 'active') === 'active'
  );
  const legacySellersCount = owners.filter(owner =>
    properties.some(p =>
      p.ownerId === (owner.ownerId || owner.contactId)
      && p.status === 'for-sale'
      && p.listingStatus !== 'inactive'
    )
  ).length;
  const sellersCount = sellerContacts.length > 0 ? sellerContacts.length : legacySellersCount;

  const ownerContactsCount = (ownerContactsResult.Items || []).filter((c) => c.roles?.owner === true).length;
  const contactsCount = contactsCountResult.Count || 0;
  void ownerContactsCount; // retained for future owner-contact rollups

  return {
    totalCustomers: customers.length,
    activeCustomers,
    totalOwners: ownersWithProperties.length,
    activeOwners,
    totalProperties: properties.length,
    availableProperties,
    inactiveProperties,
    onHoldProperties,
    rentedProperties,
    soldProperties,
    agreementsDone,
    agreementsPending,
    verificationsDone,
    verificationsPending,
    leadsCount,
    buyersCount,
    sellersCount,
    tenantsCount: customers.length,
    contactsCount,
  };
}

// ============== Property Agreement Operations ==============

export async function createPropertyAgreement(tenantId, propertyId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const agreementId = uuidv4();
  const agreement = {
    PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
    SK: `AGREEMENT#${agreementId}`,
    EntityType: 'PROPERTY_AGREEMENT',
    tenantId,
    propertyId,
    agreementId,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    monthlyRent: data.monthlyRent || 0,
    securityDeposit: data.securityDeposit || 0,
    status: data.status || 'pending', // pending, done
    documentS3Key: data.documentS3Key || null,
    documentName: data.documentName || null,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: agreement,
  }));

  // Update property agreement status
  await updateProperty(tenantId, propertyId, { agreementStatus: data.status || 'pending' });

  return agreement;
}

export async function getPropertyAgreements(tenantId, propertyId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const result = await docClient.send(new QueryCommand({
    TableName: CRM_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      ':sk': 'AGREEMENT#',
    },
  }));
  return result.Items || [];
}

export async function updatePropertyAgreement(tenantId, propertyId, agreementId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  rejectForbiddenKeys(data);

  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  data.updatedAt = new Date().toISOString();

  Object.keys(data).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = data[key];
  });

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: `AGREEMENT#${agreementId}`,
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));

  // Update property agreement status if status changed
  if (data.status) {
    await updateProperty(tenantId, propertyId, { agreementStatus: data.status });
  }

  return { success: true };
}

// ============== Property Verification Operations ==============

export async function createPropertyVerification(tenantId, propertyId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const verificationId = uuidv4();
  const verification = {
    PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
    SK: `VERIFICATION#${verificationId}`,
    EntityType: 'PROPERTY_VERIFICATION',
    tenantId,
    propertyId,
    verificationId,
    verificationType: data.verificationType || 'police', // police, background, other
    status: data.status || 'pending', // pending, done, not_done
    verificationDate: data.verificationDate || null,
    expiryDate: data.expiryDate || null,
    documentS3Key: data.documentS3Key || null,
    documentName: data.documentName || null,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: verification,
  }));

  // Update property verification status
  await updateProperty(tenantId, propertyId, { verificationStatus: data.status || 'pending' });

  return verification;
}

export async function getPropertyVerifications(tenantId, propertyId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const result = await docClient.send(new QueryCommand({
    TableName: CRM_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      ':sk': 'VERIFICATION#',
    },
  }));
  return result.Items || [];
}

export async function updatePropertyVerification(tenantId, propertyId, verificationId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  rejectForbiddenKeys(data);

  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  data.updatedAt = new Date().toISOString();

  Object.keys(data).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = data[key];
  });

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: `VERIFICATION#${verificationId}`,
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));

  // Update property verification status if status changed
  if (data.status) {
    await updateProperty(tenantId, propertyId, { verificationStatus: data.status });
  }

  return { success: true };
}

// ============== Property Document Operations ==============

export async function createPropertyDocument(tenantId, propertyId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const documentId = uuidv4();
  const document = {
    PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
    SK: `DOCUMENT#${documentId}`,
    EntityType: 'PROPERTY_DOCUMENT',
    tenantId,
    propertyId,
    documentId,
    documentType: data.documentType || 'OTHER', // PHOTO, VIDEO, AGREEMENT, VERIFICATION, OTHER
    fileName: data.fileName || '',
    fileSize: data.fileSize || 0,
    mimeType: data.mimeType || '',
    s3Key: data.s3Key || null,
    description: data.description || '',
    createdAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: document,
  }));

  return document;
}

export async function getPropertyDocuments(tenantId, propertyId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const result = await docClient.send(new QueryCommand({
    TableName: CRM_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      ':sk': 'DOCUMENT#',
    },
  }));
  return (result.Items || []).filter((doc) => !doc.archivedAt);
}

/**
 * Update a property document. Minimal by design -- only what
 * archivePropertyDocument needs (setting archivedAt), not a general-purpose
 * document editor. No updatePropertyDocument existed before this; documents
 * were create-then-delete only.
 */
export async function updatePropertyDocument(tenantId, propertyId, documentId, updates) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const { updateExpressions, attributeNames, attributeValues } = buildSetUpdateExpression(
    updates,
    ['propertyId', 'documentId'],
  );

  if (updateExpressions.length === 0) {
    return null;
  }

  try {
    const result = await docClient.send(new UpdateCommand({
      TableName: CRM_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
        SK: `DOCUMENT#${documentId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ConditionExpression: 'attribute_exists(PK)',
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues,
      ReturnValues: 'ALL_NEW',
    }));
    return result.Attributes;
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      throw new Error('Property document not found');
    }
    throw err;
  }
}

/**
 * Archive a property document (reversible soft-remove) instead of deleting
 * it. Documents have no stored status field (they're create-then-delete
 * only today), so this adds archivedAt the same way archiveContact does.
 */
export async function archivePropertyDocument(tenantId, propertyId, documentId) {
  return updatePropertyDocument(tenantId, propertyId, documentId, { archivedAt: new Date().toISOString() });
}

export async function deletePropertyDocument(tenantId, propertyId, documentId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  await docClient.send(new DeleteCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: `DOCUMENT#${documentId}`,
    },
  }));
  return true;
}

// ============== Comprehensive Property List with All Details ==============

export async function getPropertiesWithDetails(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const { properties } = await getProperties(tenantId);
  const { owners } = await getOwners(tenantId);
  const { customers } = await getCustomers(tenantId);
  
  // Create lookup maps
  const ownerMap = new Map(owners.map(o => [o.ownerId, o]));
  const customerMap = new Map(customers.map(c => [c.customerId, c]));
  
  // Enrich properties with owner and tenant details
  return properties.map(property => ({
    ...property,
    owner: ownerMap.get(property.ownerId) || null,
    tenant: property.tenantCustomerId ? customerMap.get(property.tenantCustomerId) : null,
  }));
}

// ============== Create or Update by Phone (Upsert) ==============

export async function createOrUpdateOwnerByPhone(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!data.phone) {
    throw new Error('Phone number is required');
  }
  
  // Check if owner with this phone already exists
  const existingOwner = await getOwnerByPhone(tenantId, data.phone);
  
  if (existingOwner) {
    // Update existing owner, merging data (don't overwrite existing non-null values with null/empty)
    const updateData = {};
    Object.keys(data).forEach(key => {
      // Skip system keys that must never be updated
      if (FORBIDDEN_UPDATE_KEYS.has(key)) return;
      // Only update if new value is provided and not empty
      if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
        updateData[key] = data[key];
      }
    });
    
    const updated = await updateOwner(tenantId, existingOwner.ownerId, updateData);
    return { ...updated, wasExisting: true };
  } else {
    // Create new owner
    const created = await createOwner(tenantId, data);
    return { ...created, wasExisting: false };
  }
}

export async function createOrUpdateCustomerByPhone(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!data.phone) {
    throw new Error('Phone number is required');
  }
  
  // Check if customer with this phone already exists
  const existingCustomer = await getCustomerByPhone(tenantId, data.phone);
  
  if (existingCustomer) {
    // Update existing customer, merging data
    const updateData = {};
    Object.keys(data).forEach(key => {
      // Skip system keys that must never be updated
      if (FORBIDDEN_UPDATE_KEYS.has(key)) return;
      if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
        updateData[key] = data[key];
      }
    });
    
    const updated = await updateCustomer(tenantId, existingCustomer.customerId, updateData);
    return { ...updated, wasExisting: true };
  } else {
    // Create new customer
    const created = await createCustomer(tenantId, data);
    return { ...created, wasExisting: false };
  }
}

// ============== Meeting/Calendar Operations ==============

/**
 * Create a new meeting
 * @param {string} tenantId
 * @param {object} data - Meeting data
 * @returns {Promise<object>}
 */
export async function createMeeting(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!data.meetingDate || !data.meetingTime) {
    throw new Error('Meeting date and time are required');
  }
  if (!data.relatedEntityType || !data.relatedEntityId) {
    throw new Error('Related entity type and ID are required');
  }

  const meetingId = uuidv4();
  const meeting = {
    PK: `TENANT#${tenantId}#MEETING#${meetingId}`,
    SK: 'PROFILE',
    EntityType: 'MEETING',
    tenantId,
    meetingId,
    title: data.title || 'Meeting',
    description: data.description || '',
    meetingDate: data.meetingDate,
    meetingTime: data.meetingTime,
    duration: data.duration || 30, // Default 30 minutes
    location: data.location || '',
    status: data.status || 'scheduled',
    // Related entity
    relatedEntityType: data.relatedEntityType,
    relatedEntityId: data.relatedEntityId,
    relatedEntityName: data.relatedEntityName || '',
    relatedEntityPhone: data.relatedEntityPhone || '',
    // Attendee info
    attendeeName: data.attendeeName || data.relatedEntityName || '',
    attendeePhone: data.attendeePhone || data.relatedEntityPhone || '',
    attendeeEmail: data.attendeeEmail || '',
    // Meeting outcome
    outcome: data.outcome || '',
    notes: data.notes || '',
    // Metadata
    createdBy: data.createdBy || SERVICE_ACCOUNT_USER,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // GSI for querying by date (TENANT#tenantId#DATE#YYYY-MM-DD)
    GSI1PK: `TENANT#${tenantId}#MEETING_DATE#${data.meetingDate}`,
    GSI1SK: `TIME#${data.meetingTime}#${meetingId}`,
    // GSI for querying by related entity
    GSI2PK: `TENANT#${tenantId}#${data.relatedEntityType.toUpperCase()}#${data.relatedEntityId}`,
    GSI2SK: `MEETING#${data.meetingDate}#${data.meetingTime}`,
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: meeting,
  }));

  await createMeetingEvent(tenantId, meetingId, {
    action: 'created',
    fromStatus: null,
    toStatus: meeting.status,
    fromMeetingDate: null,
    toMeetingDate: meeting.meetingDate,
    fromMeetingTime: null,
    toMeetingTime: meeting.meetingTime,
    note: meeting.notes || '',
    createdBy: meeting.createdBy || SERVICE_ACCOUNT_USER,
  });

  // Schedule meeting reminder (15 minutes before)
  try {
    await scheduleMeetingReminder(tenantId, meeting);
  } catch (reminderError) {
    logger.error('meeting.reminder.schedule.error', { meetingId, error: reminderError.message });
    // Don't fail meeting creation if reminder scheduling fails
  }

  // Log contact activity
  try {
    await logContactActivity(tenantId, {
      activityType: 'meeting_scheduled',
      subjectEntityType: meeting.relatedEntityType,
      subjectEntityId: meeting.relatedEntityId,
      subjectEntityName: meeting.relatedEntityName,
      title: `Meeting Scheduled: ${meeting.title}`,
      description: `${meeting.meetingDate} at ${meeting.meetingTime} • ${meeting.location || 'No location Specified'}. ${meeting.description || ''}`,
      performedBy: meeting.createdBy,
      payload: { meetingId, title: meeting.title, meetingDate: meeting.meetingDate, meetingTime: meeting.meetingTime, location: meeting.location },
    });
  } catch (logErr) {
    logger.error('meeting.create.logContactActivity.error', { meetingId, error: logErr.message });
  }

  logger.info('meeting.created', { meetingId, tenantId, relatedEntityType: data.relatedEntityType });
  return meeting;
}

export async function createMeetingEvent(tenantId, meetingId, data) {
  if (!tenantId || !meetingId) {
    throw new Error('Tenant ID and Meeting ID are required');
  }

  const eventId = uuidv4();
  const createdAt = new Date().toISOString();

  const event = {
    PK: `TENANT#${tenantId}#MEETING#${meetingId}`,
    SK: `EVENT#${createdAt}#${eventId}`,
    EntityType: 'MEETING_EVENT',
    tenantId,
    meetingId,
    eventId,
    action: data.action,
    fromStatus: data.fromStatus ?? null,
    toStatus: data.toStatus ?? null,
    fromMeetingDate: data.fromMeetingDate ?? null,
    toMeetingDate: data.toMeetingDate ?? null,
    fromMeetingTime: data.fromMeetingTime ?? null,
    toMeetingTime: data.toMeetingTime ?? null,
    note: data.note ?? '',
    createdBy: data.createdBy || SERVICE_ACCOUNT_USER,
    createdAt,
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: event,
  }));

  return event;
}

export async function getMeetingHistory(tenantId, meetingId) {
  if (!tenantId || !meetingId) {
    throw new Error('Tenant ID and Meeting ID are required');
  }

  const result = await docClient.send(new QueryCommand({
    TableName: CRM_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#MEETING#${meetingId}`,
      ':sk': 'EVENT#',
    },
    ScanIndexForward: false,
  }));

  return result.Items || [];
}

/**
 * Get all meetings for a tenant
 * @param {string} tenantId
 * @param {object} filters - Optional filters (startDate, endDate, status)
 * @returns {Promise<array>}
 */
export async function getMeetings(tenantId, filters = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  let filterExpression = 'EntityType = :type AND tenantId = :tenantId';
  const expressionAttributeValues = {
    ':type': 'MEETING',
    ':tenantId': tenantId,
  };

  // Add date filters if provided
  if (filters.startDate) {
    filterExpression += ' AND meetingDate >= :startDate';
    expressionAttributeValues[':startDate'] = filters.startDate;
  }
  if (filters.endDate) {
    filterExpression += ' AND meetingDate <= :endDate';
    expressionAttributeValues[':endDate'] = filters.endDate;
  }
  if (filters.status) {
    filterExpression += ' AND #status = :status';
    expressionAttributeValues[':status'] = filters.status;
  }

  const params = {
    TableName: CRM_TABLE_NAME,
    FilterExpression: filterExpression,
    ExpressionAttributeValues: expressionAttributeValues,
  };

  if (filters.status) {
    params.ExpressionAttributeNames = { '#status': 'status' };
  }

  const items = await collectAllPages(docClient, ScanCommand, params, { maxPages: 100 });
  
  // Sort by date and time
  const meetings = items;
  meetings.sort((a, b) => {
    const dateCompare = a.meetingDate.localeCompare(b.meetingDate);
    if (dateCompare !== 0) return dateCompare;
    return a.meetingTime.localeCompare(b.meetingTime);
  });

  return meetings;
}

/**
 * Get meetings by date range
 * @param {string} tenantId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<array>}
 */
export async function getMeetingsByDateRange(tenantId, startDate, endDate) {
  return getMeetings(tenantId, { startDate, endDate });
}

/**
 * Get meetings for a specific entity (customer, owner, enquiry, etc.)
 * @param {string} tenantId
 * @param {string} entityType
 * @param {string} entityId
 * @returns {Promise<array>}
 */
export async function getMeetingsByEntity(tenantId, entityType, entityId) {
  if (!tenantId || !entityType || !entityId) {
    throw new Error('Tenant ID, entity type, and entity ID are required');
  }

  const result = await docClient.send(new QueryCommand({
    TableName: CRM_TABLE_NAME,
    IndexName: 'status-index',
    KeyConditionExpression: 'GSI2PK = :gsi2pk',
    ExpressionAttributeValues: {
      ':gsi2pk': `TENANT#${tenantId}#${entityType.toUpperCase()}#${entityId}`,
    },
    ScanIndexForward: false,
  }));

  return result.Items || [];
}

/**
 * Get a single meeting
 * @param {string} tenantId
 * @param {string} meetingId
 * @returns {Promise<object|null>}
 */
export async function getMeeting(tenantId, meetingId) {
  if (!tenantId || !meetingId) {
    throw new Error('Tenant ID and Meeting ID are required');
  }

  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#MEETING#${meetingId}`,
      SK: 'PROFILE',
    },
  }));

  return result.Item || null;
}

/**
 * Update a meeting
 * @param {string} tenantId
 * @param {string} meetingId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function updateMeeting(tenantId, meetingId, data) {
  if (!tenantId || !meetingId) {
    throw new Error('Tenant ID and Meeting ID are required');
  }
  rejectForbiddenKeys(data);

  const before = await getMeeting(tenantId, meetingId);

  if (!before) {
    throw new Error('Meeting not found');
  }

  // Validate state transitions
  if (data.status && data.status !== before.status) {
    const validTransitions = {
      scheduled: ['completed', 'cancelled', 'rescheduled', 'archived'],
      rescheduled: ['completed', 'cancelled', 'scheduled', 'archived'],
      completed: ['archived'],
      cancelled: ['archived'],
      // Archiving is a reversible soft-remove (see archiveMeeting below); the
      // only way out is an explicit reactivation back to scheduled.
      archived: ['scheduled'],
    };
    const allowed = validTransitions[before.status] || [];
    if (!allowed.includes(data.status)) {
      throw new Error(`Invalid meeting status transition: cannot change from '${before.status}' to '${data.status}'`);
    }
  }

  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  // Add updatedAt
  data.updatedAt = new Date().toISOString();

  // Handle status as reserved word
  Object.keys(data).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = data[key];
  });

  // Update GSI keys if date/time changed
  if (data.meetingDate || data.meetingTime) {
    const meeting = await getMeeting(tenantId, meetingId);
    if (meeting) {
      const newDate = data.meetingDate || meeting.meetingDate;
      const newTime = data.meetingTime || meeting.meetingTime;
      
      updateExpressions.push('GSI1PK = :gsi1pk');
      attributeValues[':gsi1pk'] = `TENANT#${tenantId}#MEETING_DATE#${newDate}`;
      
      updateExpressions.push('GSI1SK = :gsi1sk');
      attributeValues[':gsi1sk'] = `TIME#${newTime}#${meetingId}`;
    }
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#MEETING#${meetingId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
    ReturnValues: 'ALL_NEW',
  }));

  const after = result.Attributes;

  if (before && after) {
    const statusChanged = typeof data.status === 'string' && data.status !== before.status;
    const dateChanged = typeof data.meetingDate === 'string' && data.meetingDate !== before.meetingDate;
    const timeChanged = typeof data.meetingTime === 'string' && data.meetingTime !== before.meetingTime;

    let action = 'updated';
    if (statusChanged) {
      action = data.status;
    } else if (dateChanged || timeChanged) {
      action = 'rescheduled';
    }

    await createMeetingEvent(tenantId, meetingId, {
      action,
      fromStatus: before.status ?? null,
      toStatus: after.status ?? null,
      fromMeetingDate: before.meetingDate ?? null,
      toMeetingDate: after.meetingDate ?? null,
      fromMeetingTime: before.meetingTime ?? null,
      toMeetingTime: after.meetingTime ?? null,
      note: typeof data.notes === 'string' ? data.notes : (after.notes || ''),
      createdBy: typeof data.updatedBy === 'string' ? data.updatedBy : (after.updatedBy || after.createdBy || SERVICE_ACCOUNT_USER),
    });

    // Log contact activity
    try {
      let activityType = 'meeting_rescheduled';
      let title = `Meeting Rescheduled: ${after.title}`;
      let description = `Rescheduled to ${after.meetingDate} at ${after.meetingTime}.`;

      if (statusChanged) {
        if (data.status === 'completed') {
          activityType = 'meeting_completed';
          title = `Meeting Completed: ${after.title}`;
          description = after.outcome || after.notes || 'Meeting completed successfully.';
        } else if (data.status === 'cancelled') {
          activityType = 'meeting_cancelled';
          title = `Meeting Cancelled: ${after.title}`;
          description = data.notes || 'Meeting was cancelled.';
        } else if (data.status === 'archived') {
          activityType = 'meeting_archived';
          title = `Meeting Archived: ${after.title}`;
          description = 'Meeting was archived.';
        }
      }

      await logContactActivity(tenantId, {
        activityType,
        subjectEntityType: after.relatedEntityType,
        subjectEntityId: after.relatedEntityId,
        subjectEntityName: after.relatedEntityName,
        title,
        description,
        performedBy: typeof data.updatedBy === 'string' ? data.updatedBy : (after.updatedBy || SERVICE_ACCOUNT_USER),
        payload: { meetingId, before, after },
      });
    } catch (logErr) {
      logger.error('meeting.update.logContactActivity.error', { meetingId, error: logErr.message });
    }
  }

  // Handle meeting reminder updates
  try {
    const statusChanged = typeof data.status === 'string' && data.status !== before?.status;
    const dateTimeChanged = (typeof data.meetingDate === 'string' && data.meetingDate !== before?.meetingDate) ||
                            (typeof data.meetingTime === 'string' && data.meetingTime !== before?.meetingTime);

    if (statusChanged && (data.status === 'cancelled' || data.status === 'completed' || data.status === 'archived')) {
      // Cancel any pending reminder -- a scheduled meeting archived directly
      // (without first being cancelled/completed) must not still fire one.
      await cancelMeetingReminder(tenantId, meetingId);
    } else if (dateTimeChanged && result.Attributes?.status === 'scheduled') {
      // Reschedule reminder if date/time changed and meeting is still scheduled
      await scheduleMeetingReminder(tenantId, result.Attributes);
    }
  } catch (reminderError) {
    logger.error('meeting.reminder.update.error', { meetingId, error: reminderError.message });
    // Don't fail meeting update if reminder update fails
  }

  logger.info('meeting.updated', { meetingId, tenantId });
  return result.Attributes;
}

/**
 * Archive a meeting (reversible soft-remove) instead of deleting it.
 * Delegates to updateMeeting so archiving goes through the same status
 * transition validation, reminder cancellation, and activity logging a
 * normal status change already does. Reversible via update_meeting
 * (status: 'scheduled').
 */
export async function archiveMeeting(tenantId, meetingId) {
  return updateMeeting(tenantId, meetingId, { status: 'archived' });
}

/**
 * Delete a meeting
 * @param {string} tenantId
 * @param {string} meetingId
 * @returns {Promise<boolean>}
 */
export async function deleteMeeting(tenantId, meetingId) {
  if (!tenantId || !meetingId) {
    throw new Error('Tenant ID and Meeting ID are required');
  }

  await docClient.send(new DeleteCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#MEETING#${meetingId}`,
      SK: 'PROFILE',
    },
  }));

  logger.info('meeting.deleted', { meetingId, tenantId });
  return true;
}

/**
 * Get upcoming meetings (today and future)
 * @param {string} tenantId
 * @param {number} days - Number of days to look ahead (default 7)
 * @returns {Promise<array>}
 */
export async function getUpcomingMeetings(tenantId, days = 7) {
  // Normalize: if days is an object (from skillInvoker dynamic dispatch), extract 'days' field
  if (days && typeof days === 'object' && !Array.isArray(days)) {
    days = days.days;
  }
  if (days === undefined || days === null || typeof days !== 'number') {
    days = 7;
  }

  const today = new Date();
  const startDate = today.toISOString().split('T')[0];

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);
  const endDateStr = endDate.toISOString().split('T')[0];

  return getMeetings(tenantId, { startDate, endDate: endDateStr, status: 'scheduled' });
}

/**
 * Get meeting analytics/metrics
 * @param {string} tenantId
 * @returns {Promise<object>}
 */
export async function getMeetingMetrics(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const allMeetings = await getMeetings(tenantId);
  
  const today = new Date().toISOString().split('T')[0];
  
  const metrics = {
    total: allMeetings.length,
    scheduled: 0,
    completed: 0,
    cancelled: 0,
    rescheduled: 0,
    upcoming: 0,
    today: 0,
    thisWeek: 0,
    byEntityType: {
      customer: 0,
      owner: 0,
      enquiry: 0,
      b2b_lead: 0,
      property: 0,
      lead: 0,
    },
  };

  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const weekFromNowStr = weekFromNow.toISOString().split('T')[0];

  allMeetings.forEach(meeting => {
    // Count by status
    if (meeting.status) {
      metrics[meeting.status] = (metrics[meeting.status] || 0) + 1;
    }

    // Count by entity type
    if (meeting.relatedEntityType && metrics.byEntityType[meeting.relatedEntityType] !== undefined) {
      metrics.byEntityType[meeting.relatedEntityType]++;
    }

    // Count upcoming (scheduled + future date)
    if (meeting.status === 'scheduled' && meeting.meetingDate >= today) {
      metrics.upcoming++;
    }

    // Count today's meetings
    if (meeting.meetingDate === today) {
      metrics.today++;
    }

    // Count this week's meetings
    if (meeting.meetingDate >= today && meeting.meetingDate <= weekFromNowStr) {
      metrics.thisWeek++;
    }
  });

  return metrics;
}

// ============== Unified CONTACT Operations ==============
// A Contact represents a single person who can have multiple roles: owner, seller, buyer, tenant

/**
 * Normalize phone number for consistent matching
 */
function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  const withoutPrefix = digits.startsWith('91') && digits.length === 12
    ? digits.slice(2)
    : digits.startsWith('910') && digits.length === 13
      ? digits.slice(3)
      : digits;
  if (/^[6-9]\d{9}$/.test(withoutPrefix)) {
    return withoutPrefix;
  }
  return '';
}

const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || '';

/**
 * Normalize phone to E.164 format for new writes.
 * Defaults to DEFAULT_COUNTRY_CODE if no country code is present.
 * e.g. "98563 00000" -> "+919856300000"  (when DEFAULT_COUNTRY_CODE=+91)
 *      "+919856300000" -> "+919856300000"
 */
function normalizePhoneE164(phone) {
  if (!phone) return phone;
  const digits = String(phone).replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) return digits;
  const bare = digits.replace(/^0+/, '');
  if (/^[6-9]\d{9}$/.test(bare)) return `${DEFAULT_COUNTRY_CODE}${bare}`;
  if (/^91[6-9]\d{9}$/.test(bare)) return `+${bare}`;
  return digits;
}

function hasCurrentLease(rental) {
  if (!rental) return false;
  if (!rental.leaseEndDate) return true;
  const leaseEnd = new Date(rental.leaseEndDate);
  return !Number.isNaN(leaseEnd.getTime()) && leaseEnd >= new Date();
}

/**
 * Contact activity is derived from live CRM relationships, never supplied by a user.
 */
export function deriveContactStatus(contact, {
  properties = [],
  listings = [],
  buyers = [],
  customers = [],
} = {}) {
  if (!contact) return 'inactive';
  // An explicit archive decision overrides derived activity signals -- a
  // human/agent said "stop tracking this," which should hold even if the
  // contact still technically owns a property or has a role flag set.
  if (contact.archivedAt) return 'archived';

  const ownsProperty = properties.some((property) =>
    propertyIsCurrentlyOwnedBy(property, {
      contactId: contact.contactId,
      ownerId: contact.linkedOwnerId,
    }),
  );
  if (ownsProperty) return 'active';

  const hasActiveListing = listings.some((listing) =>
    listing.status === 'active'
    && (
      listing.listedByContactId === contact.contactId
      || (contact.linkedOwnerId && listing.listedByOwnerId === contact.linkedOwnerId)
    ),
  );
  if (hasActiveListing) return 'active';

  const contactPhone = normalizePhone(contact.phone);
  const activeBuyer = contact.roles?.buyer === true && (
    contact.buyerProfile?.status !== 'inactive'
    && !buyers.some((buyer) =>
      normalizePhone(buyer.phone) === contactPhone && buyer.status === 'inactive',
    )
  );
  if (activeBuyer) return 'active';

  const activeTenant = customers.some((customer) =>
    (customer.customerId === contact.linkedCustomerId || normalizePhone(customer.phone) === contactPhone)
    && customer.status === 'active'
    && hasCurrentLease(customer.currentRental),
  ) || (contact.roles?.tenant === true && hasCurrentLease(contact.tenantProfile?.currentRental));
  return activeTenant ? 'active' : 'inactive';
}

async function getContactActivityEntities(tenantId) {
  const scanByType = (type) => collectAllPages(docClient, ScanCommand, {
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: { ':type': type, ':tenantId': tenantId },
  }, { maxPages: 100 });

  const [properties, listings, buyers, customers] = await Promise.all([
    scanByType('PROPERTY'),
    scanByType('LISTING'),
    scanByType('BUYER'),
    scanByType('CUSTOMER'),
  ]);
  return { properties, listings, buyers, customers };
}

async function withDerivedContactStatuses(tenantId, contacts) {
  if (!contacts.length) return contacts;
  const activityEntities = await getContactActivityEntities(tenantId);
  return contacts.map((contact) => ({
    ...contact,
    status: deriveContactStatus(contact, activityEntities),
  }));
}

/**
 * Create a new Contact
 */
export async function createContact(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!data.phone) {
    throw new Error('Phone number is required');
  }

  const contactId = uuidv4();
  const normalizedPhone = normalizePhone(data.phone);
  
  // Initialize roles object
  const roles = {
    owner: data.roles?.owner || false,
    seller: data.roles?.seller || false,
    buyer: data.roles?.buyer || false,
    tenant: data.roles?.tenant || false,
  };

  const normalizeSellerProfile = (profile) => {
    if (!profile && !roles.seller) return null;
    const base = profile || {};
    return {
      lifecycleStatus: base.lifecycleStatus || 'active',
      listingPreferences: base.listingPreferences || null,
      notes: base.notes || null,
      soldPropertyIds: Array.isArray(base.soldPropertyIds) ? base.soldPropertyIds : [],
      activeListingIds: Array.isArray(base.activeListingIds) ? base.activeListingIds : [],
      ...base,
      lifecycleStatus: base.lifecycleStatus || 'active',
    };
  };

  const normalizeOwnerProfile = (profile) => {
    if (!profile && !roles.owner) return null;
    const base = profile || {};
    return {
      lifecycleStatus: base.lifecycleStatus || 'active',
      ownedPropertyIds: Array.isArray(base.ownedPropertyIds) ? base.ownedPropertyIds : [],
      notes: base.notes || null,
      ...base,
      lifecycleStatus: base.lifecycleStatus || 'active',
    };
  };

  const contact = {
    PK: `TENANT#${tenantId}#CONTACT#${contactId}`,
    SK: 'PROFILE',
    EntityType: 'CONTACT',
    tenantId,
    contactId,
    name: data.name,
    email: data.email || null,
    phone: data.phone,
    normalizedPhone,
    address: data.address || '',
    // Roles
    roles,
    // Owner/Seller specific fields
    ownerProfile: normalizeOwnerProfile(data.ownerProfile),
    sellerProfile: normalizeSellerProfile(data.sellerProfile),
    // Buyer specific fields
    buyerProfile: data.buyerProfile || null,
    // Tenant specific fields
    tenantProfile: data.tenantProfile || null,
    // Documents (shared across roles)
    panNumber: data.panNumber || null,
    aadharNumber: data.aadharNumber || null,
    panDocS3Key: data.panDocS3Key || null,
    aadharDocS3Key: data.aadharDocS3Key || null,
    photoS3Key: data.photoS3Key || null,
    // Bank details
    bankName: data.bankName || null,
    accountNumber: data.accountNumber || null,
    ifscCode: data.ifscCode || null,
    // Purchase history (for buyers)
    purchaseHistory: data.purchaseHistory || [],
    // Meta
    source: data.source || '',
    tags: data.tags || [],
    notes: data.notes || '',
    status: 'inactive',
    assignedTo: data.assignedTo || null,
    // Migration references (link to old Owner/Customer if migrated)
    linkedOwnerId: data.linkedOwnerId || null,
    linkedCustomerId: data.linkedCustomerId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // GSI for search
    GSI3PK: `TENANT#${tenantId}#SEARCH`,
    GSI3SK: `CONTACT#${(data.name || '').toLowerCase()}#${normalizedPhone}`,
  };

  contact.status = deriveContactStatus(contact);

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: contact,
  }));

  return contact;
}

/**
 * Get all contacts for a tenant
 */
export async function getContacts(tenantId, filters = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  filters = aliasQueryToSearch(filters);

  const items = await collectAllPages(docClient, ScanCommand, {
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'CONTACT',
      ':tenantId': tenantId,
    },
  }, { maxPages: 100 });

  let contacts = await withDerivedContactStatuses(tenantId, items);

  // Apply role filters if provided
  if (filters.role) {
    contacts = contacts.filter(c => c.roles && c.roles[filters.role] === true);
  }
  if (filters.sellerLifecycle) {
    contacts = contacts.filter((c) =>
      c.roles?.seller === true
      && (c.sellerProfile?.lifecycleStatus || 'active') === filters.sellerLifecycle
    );
  }
  if (filters.ownerLifecycle) {
    contacts = contacts.filter((c) =>
      c.roles?.owner === true
      && (c.ownerProfile?.lifecycleStatus || 'active') === filters.ownerLifecycle
    );
  }
  if (filters.status) {
    contacts = contacts.filter((c) => matchesFilterEnum(c.status, filters.status));
  } else {
    // Archived contacts are excluded from the default (unfiltered) list --
    // an agent must explicitly ask for status: 'archived' to see them.
    contacts = contacts.filter((c) => c.status !== 'archived');
  }
  if (filters.search && filters.search.trim().length >= 2) {
    const q = filters.search.toLowerCase().trim();
    contacts = contacts.filter((c) => {
      const nameMatch = c.name?.toLowerCase().includes(q);
      const phoneMatch = c.phone?.replace(/[\s-]/g, '').includes(q.replace(/[\s-]/g, ''));
      const emailMatch = c.email?.toLowerCase().includes(q);
      return nameMatch || phoneMatch || emailMatch;
    });
  }
  if (filters.area) {
    const areaQuery = filters.area.toLowerCase();
    contacts = contacts.filter(c => c.address && c.address.toLowerCase().includes(areaQuery));
  }

  return contacts;
}

/**
 * Get a single contact by ID
 */
export async function getContact(tenantId, contactId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CONTACT#${contactId}`,
      SK: 'PROFILE',
    },
  }));
  if (!result.Item) return null;
  const [contact] = await withDerivedContactStatuses(tenantId, [result.Item]);
  return contact;
}

/**
 * Find contact by phone number (for deduplication)
 */
export async function findContactByPhone(tenantId, phone) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  // Normalize: if phone is an object (from skillInvoker dynamic dispatch), extract 'phone' field
  if (phone && typeof phone === 'object' && !Array.isArray(phone)) {
    phone = phone.phone;
  }
  if (phone !== undefined && phone !== null && typeof phone !== 'string') {
    phone = String(phone);
  }
  if (!phone) return null;

  const normalizedPhone = normalizePhone(phone);
  const contacts = await getContacts(tenantId);

  return contacts.find(c => {
    const contactPhone = normalizePhone(c.phone);
    return contactPhone === normalizedPhone ||
           contactPhone.endsWith(normalizedPhone.slice(-10)) ||
           normalizedPhone.endsWith(contactPhone.slice(-10));
  }) || null;
}

/**
 * Create or update contact by phone (dedupe rule)
 * If contact with same phone exists, update it; otherwise create new
 */
export async function createOrUpdateContactByPhone(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!data.phone) {
    throw new Error('Phone number is required');
  }

  const existingContact = await findContactByPhone(tenantId, data.phone);

  if (existingContact) {
    // Merge roles - never remove existing roles, only add
    const mergedRoles = {
      owner: existingContact.roles?.owner || data.roles?.owner || false,
      seller: existingContact.roles?.seller || data.roles?.seller || false,
      buyer: existingContact.roles?.buyer || data.roles?.buyer || false,
      tenant: existingContact.roles?.tenant || data.roles?.tenant || false,
    };

    const mergeProfile = (existing, incoming) => {
      if (!existing && !incoming) return undefined;
      return { ...(existing || {}), ...(incoming || {}) };
    };

    // Merge base fields conservatively (avoid overwriting existing human-entered data)
    const updateData = {
      ...data,
      name: existingContact.name || data.name,
      email: existingContact.email || data.email,
      address: existingContact.address || data.address,
      notes: existingContact.notes || data.notes,
      assignedTo: existingContact.assignedTo || data.assignedTo || null,
      roles: mergedRoles,
      ownerProfile: mergeProfile(existingContact.ownerProfile, data.ownerProfile),
      sellerProfile: mergeProfile(existingContact.sellerProfile, data.sellerProfile),
      buyerProfile: mergeProfile(existingContact.buyerProfile, data.buyerProfile),
      tenantProfile: mergeProfile(existingContact.tenantProfile, data.tenantProfile),
    };

    // Drop undefined profile keys so updateContact does not wipe fields
    for (const key of ['ownerProfile', 'sellerProfile', 'buyerProfile', 'tenantProfile']) {
      if (updateData[key] === undefined) delete updateData[key];
    }

    const updated = await updateContact(tenantId, existingContact.contactId, updateData);
    return { ...updated, wasExisting: true };
  } else {
    const created = await createContact(tenantId, data);
    return { ...created, wasExisting: false };
  }
}

/**
 * Update a contact
 */
export async function updateContact(tenantId, contactId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  data = { ...data };
  delete data.status;
  data.updatedAt = new Date().toISOString();

  // Update normalizedPhone if phone changes
  if (data.phone) {
    data.normalizedPhone = normalizePhone(data.phone);
  }

  const { updateExpressions, attributeNames, attributeValues } = buildSetUpdateExpression(
    data,
    ['contactId'],
  );

  if (updateExpressions.length === 0) {
    return await getContact(tenantId, contactId);
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: CRM_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#CONTACT#${contactId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ConditionExpression: 'attribute_exists(PK)',
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues,
    }));
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      throw new Error('Contact not found');
    }
    throw err;
  }

  return await getContact(tenantId, contactId);
}

/**
 * Add or update a role for a contact
 */
export async function updateContactRole(tenantId, contactId, role, enabled, profileData = null) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!['owner', 'seller', 'buyer', 'tenant'].includes(role)) {
    throw new Error('Invalid role. Must be owner, seller, buyer, or tenant');
  }

  const contact = await getContact(tenantId, contactId);
  if (!contact) {
    throw new Error('Contact not found');
  }

  const updatedRoles = {
    ...contact.roles,
    [role]: enabled,
  };

  const updateData = {
    roles: updatedRoles,
  };

  // Update role-specific profile if provided
  if (profileData) {
    const profileKey = `${role}Profile`;
    updateData[profileKey] = {
      ...(contact[profileKey] || {}),
      ...profileData,
    };
  } else if (enabled && !contact[`${role}Profile`]) {
    // Seed minimal profile shells when enabling a role
    if (role === 'seller') {
      updateData.sellerProfile = {
        lifecycleStatus: 'active',
        soldPropertyIds: [],
        activeListingIds: [],
      };
    } else if (role === 'owner') {
      updateData.ownerProfile = {
        lifecycleStatus: 'active',
        ownedPropertyIds: [],
      };
    } else if (role === 'buyer') {
      updateData.buyerProfile = contact.buyerProfile || {};
    } else if (role === 'tenant') {
      updateData.tenantProfile = contact.tenantProfile || {};
    }
  }

  return await updateContact(tenantId, contactId, updateData);
}

/**
 * Delete a contact
 */
/**
 * Archive a contact (reversible soft-remove) instead of deleting it.
 * Unlike other entities, contacts have no stored status field at all --
 * deriveContactStatus() computes 'active'/'inactive' from role/activity on
 * every read. archivedAt is a new, durable field specifically for this,
 * since "stop tracking" can't be represented by a derived value.
 */
export async function archiveContact(tenantId, contactId) {
  return updateContact(tenantId, contactId, { archivedAt: new Date().toISOString() });
}

export async function deleteContact(tenantId, contactId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  await docClient.send(new DeleteCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CONTACT#${contactId}`,
      SK: 'PROFILE',
    },
  }));
  return true;
}

// ============== Contact Notes Operations ==============

export async function createContactNote(tenantId, contactId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  const noteId = uuidv4();
  const note = {
    PK: `TENANT#${tenantId}#CONTACT#${contactId}`,
    SK: `NOTE#${noteId}`,
    EntityType: 'NOTE',
    tenantId,
    noteId,
    contactId,
    content: data.content,
    createdBy: data.createdBy || SERVICE_ACCOUNT_USER,
    createdAt: data.createdAt || new Date().toISOString(),
  };
  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: note,
  }));

  try {
    await logContactActivity(tenantId, {
      activityType: 'note_added',
      subjectEntityType: 'contact',
      subjectEntityId: contactId,
      title: 'Note Added',
      description: data.content,
      performedBy: data.createdBy,
      payload: { noteId, content: data.content },
    });
  } catch (err) {
    logger.error('createContactNote.logContactActivity.error', { contactId, error: err.message });
  }

  return note;
}

export async function getContactNotes(tenantId, contactId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  const result = await docClient.send(new QueryCommand({
    TableName: CRM_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#CONTACT#${contactId}`,
      ':sk': 'NOTE#',
    },
  }));
  let notes = result.Items || [];
  if (!notes.length) {
    const contactProfile = await getContact(tenantId, contactId);
    if (contactProfile && contactProfile.notes) {
      notes = [{
        PK: `TENANT#${tenantId}#CONTACT#${contactId}`,
        SK: 'NOTE#PROFILE_NOTES',
        EntityType: 'NOTE',
        tenantId,
        contactId,
        noteId: 'PROFILE_NOTES',
        content: contactProfile.notes,
        createdBy: SERVICE_ACCOUNT_USER,
        createdAt: contactProfile.createdAt || new Date().toISOString(),
      }];
    }
  }
  return notes;
}

export async function updateContactNote(tenantId, contactId, noteId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  const result = await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CONTACT#${contactId}`,
      SK: `NOTE#${noteId}`,
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

export async function deleteContactNote(tenantId, contactId, noteId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  await docClient.send(new DeleteCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CONTACT#${contactId}`,
      SK: `NOTE#${noteId}`,
    },
  }));
  return true;
}

// ============== CRM LEAD Operations ==============
// Leads are pipeline items that can be converted to Contacts with specific roles

const ALLOWED_LEAD_CITIES = new Set(['Mumbai', 'Pune', 'Thane', 'Navi Mumbai']);

function validateLeadCity(city) {
  if (city !== undefined && !ALLOWED_LEAD_CITIES.has(city)) {
    throw new Error('City must be Mumbai, Pune, Thane, or Navi Mumbai');
  }
}

function applyLeadCityDefault(data) {
  const fieldByLeadType = {
    buyer: 'buyerRequirement',
    seller: 'sellerProperty',
    tenant: 'tenantRequirement',
    owner: 'ownerProperty',
  };
  const field = fieldByLeadType[data.leadType];
  const value = data[field] || {};
  validateLeadCity(value.city);
  data[field] = { ...value, city: value.city || 'Mumbai' };
}

function validateLeadCityUpdate(data, existingLead) {
  const fieldByLeadType = {
    buyer: 'buyerRequirement',
    seller: 'sellerProperty',
    tenant: 'tenantRequirement',
    owner: 'ownerProperty',
  };
  const field = fieldByLeadType[existingLead.leadType];
  const value = data[field];
  const existingCity = existingLead[field]?.city;
  if (value && Object.prototype.hasOwnProperty.call(value, 'city') && value.city !== existingCity) {
    validateLeadCity(value.city);
  }
}

function validateLeadBhk(bhk) {
  if (bhk !== undefined && bhk !== null && bhk !== '' && !ALLOWED_LEAD_BHK.has(bhk)) {
    throw new Error('BHK must be Studio, 1 RK, 1 BHK, 1.5 BHK, 2 BHK, 2.5 BHK, 3 BHK, 3.5 BHK, 4 BHK, 4.5 BHK, 5 BHK, or 5+ BHK');
  }
}

function validateLeadBhkInBlob(blob) {
  if (!blob || typeof blob !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(blob, 'bhk')) {
    validateLeadBhk(blob.bhk);
  }
}

function validateLeadBhkForCreate(data) {
  if (data.leadType === 'buyer') validateLeadBhkInBlob(data.buyerRequirement);
  if (data.leadType === 'seller') validateLeadBhkInBlob(data.sellerProperty);
  if (data.leadType === 'owner') validateLeadBhkInBlob(data.ownerProperty);
}

function validateLeadBhkUpdate(data, existingLead) {
  const fieldByLeadType = {
    buyer: 'buyerRequirement',
    seller: 'sellerProperty',
    owner: 'ownerProperty',
  };
  const field = fieldByLeadType[existingLead.leadType];
  if (!field) return;
  const value = data[field];
  const existingBhk = existingLead[field]?.bhk;
  if (value && Object.prototype.hasOwnProperty.call(value, 'bhk') && value.bhk !== existingBhk) {
    validateLeadBhk(value.bhk);
  }
}

/**
 * Create a new Lead
 */
export async function createLead(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!data.leadType || !['buyer', 'seller', 'tenant', 'owner'].includes(data.leadType)) {
    throw new Error('Lead type must be buyer, seller, tenant, or owner');
  }

  applyLeadCityDefault(data);
  validateLeadBhkForCreate(data);
  normalizeLeadTextFields(data);

  const leadId = uuidv4();
  const normalizedPhone = data.phone ? normalizePhone(data.phone) : '';

  // Normalize seller property timeline data for consistent UI rendering
  let normalizedSellerProperty = data.leadType === 'seller'
    ? normalizeSellerProperty(data.sellerProperty)
    : null;
  if (data.leadType === 'seller' && normalizedSellerProperty) {
    const sp = normalizedSellerProperty;
    const existingValue = sp.timelineValue;
    const existingUnit = sp.timelineUnit || 'months';
    const existingTimeline = sp.timeline;

    if (existingValue !== undefined && existingValue !== null && existingValue !== '') {
      normalizedSellerProperty = {
        ...sp,
        timelineValue: Number(existingValue),
        timelineUnit: existingUnit,
        timeline: `${existingValue} ${existingUnit}`,
      };
    } else if (existingTimeline) {
      const parts = String(existingTimeline).trim().split(/\s+/);
      const parsedValue = Number(parts[0]);
      const parsedUnit = parts[1] || 'months';
      if (!isNaN(parsedValue)) {
        normalizedSellerProperty = {
          ...sp,
          timelineValue: parsedValue,
          timelineUnit: parsedUnit,
          timeline: existingTimeline,
        };
      }
    }
  }

  const lead = {
    PK: `TENANT#${tenantId}#LEAD#${leadId}`,
    SK: 'PROFILE',
    EntityType: 'LEAD',
    tenantId,
    leadId,
    // Lead type determines conversion target
    leadType: data.leadType, // buyer, seller, tenant, owner
    // Basic info
    name: data.name,
    email: data.email || null,
    phone: data.phone || null,
    normalizedPhone,
    // Lead details
    source: data.source || '', // referral, website, walk-in, etc.
    status: data.status || 'new', // new, contacted, qualified, negotiating, converted, lost
    // Temperature (Hot/Warm/Cold) replaces the old manual `priority` field.
    // Set by an AI qualification call, the LLM fallback, or a human override —
    // never by createLead() itself. null until the lead is actually qualified.
    score: null,
    scoreValue: null,
    scoreReasons: null,
    scoredAt: null,
    scoreSource: null,
    // Instagram-sourced leads carry a reference to the triggering post so a
    // human can see which reel/listing prompted the DM.
    reelRef: data.reelRef || null,
    assignedTo: data.assignedTo || null,
    lostReason: data.status === 'lost' ? (data.lostReason || null) : null,
    lostAt: data.status === 'lost' ? (data.lostAt || new Date().toISOString()) : null,
    // Type-specific data
    // For buyer leads
    buyerRequirement: data.buyerRequirement || null, // { budget, preferredArea, bhk, propertyType, etc. }
    // For seller leads
    sellerProperty: normalizedSellerProperty,
    // For tenant leads
    tenantRequirement: data.tenantRequirement || null,
    // For owner leads (someone looking to list property for rent)
    ownerProperty: data.leadType === 'owner'
      ? normalizeOwnerProperty(data.ownerProperty)
      : null,
    // Conversion tracking — omit convertedAt/convertedTo until conversion completes
    // (DynamoDB NULL breaks attribute_not_exists checks in atomic convertLead delete)
    // Notes and history
    notes: data.notes || '',
    history: [{
      timestamp: new Date().toISOString(),
      action: 'Lead Created',
      details: `New ${data.leadType} lead created`,
      updatedBy: data.createdBy || SERVICE_ACCOUNT_USER,
      ...(data.createdByUserId ? { updatedByUserId: data.createdByUserId } : {}),
    }],
    createdBy: data.createdBy || SERVICE_ACCOUNT_USER,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // GSI for search
    GSI3PK: `TENANT#${tenantId}#SEARCH`,
    GSI3SK: `LEAD#${data.leadType}#${(data.name || '').toLowerCase()}#${normalizedPhone}`,
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: lead,
  }));

  try {
    await logContactActivity(tenantId, {
      activityType: 'lead_created',
      subjectEntityType: 'lead',
      subjectEntityId: leadId,
      subjectEntityName: lead.name,
      title: 'Lead Created',
      description: `New ${lead.leadType} lead created via ${lead.source || 'Direct'}.`,
      performedBy: lead.createdBy,
      payload: { leadId, leadType: lead.leadType, status: lead.status },
    });
  } catch (err) {
    logger.error('createLead.logContactActivity.error', { leadId, error: err.message });
  }

  return lead;
}

/**
 * True when conversion destination metadata is present.
 * Kept for backward-compatible list filters on residual legacy records.
 */
export function hasLeadConversionTarget(lead) {
  const convertedTo = lead?.convertedTo;
  return !!(convertedTo && (convertedTo.entityId || convertedTo.contactId));
}

/**
 * @deprecated Conversion locks are removed. Always returns false.
 */
export function isLeadConversionInProgress(_lead) {
  return false;
}

/**
 * True when a lead has successfully left the active pipeline.
 * After the atomic redesign, successfully converted leads are deleted;
 * this helper only covers residual legacy rows that still carry convertedTo.
 */
export function isLeadConverted(lead) {
  if (!lead) return false;
  return hasLeadConversionTarget(lead);
}

/** Numeric budget/price on a lead for filtering (rupees). */
export function leadBudgetRupee(lead) {
  const raw =
    lead?.buyerRequirement?.budget
    ?? lead?.tenantRequirement?.budget
    ?? lead?.sellerProperty?.expectedPrice
    ?? lead?.ownerProperty?.rentExpected
    ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function applyLeadBudgetRangeFilter(leads, filters = {}) {
  let out = Array.isArray(leads) ? leads : [];
  if (filters.minBudget != null && filters.minBudget !== '') {
    const min = Number(filters.minBudget);
    if (!Number.isNaN(min)) {
      out = out.filter((l) => leadBudgetRupee(l) >= min);
    }
  }
  if (filters.maxBudget != null && filters.maxBudget !== '') {
    const max = Number(filters.maxBudget);
    if (!Number.isNaN(max)) {
      out = out.filter((l) => leadBudgetRupee(l) <= max);
    }
  }
  return out;
}

/**
 * Get all leads for a tenant
 */
export async function getLeads(tenantId, filters = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const items = await collectAllPages(docClient, ScanCommand, {
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'LEAD',
      ':tenantId': tenantId,
    },
  }, { maxPages: 100 });

  let leads = items;

  // Apply filters
  if (filters.leadType) {
    leads = leads.filter((l) => matchesFilterEnum(l.leadType, filters.leadType));
  }
  if (filters.status) {
    leads = leads.filter((l) => matchesFilterEnum(l.status, filters.status));
  }
  leads = applyLeadAssignmentFilter(leads, filters);
  if (filters.temperature && filters.temperature !== 'all') {
    if (filters.temperature === 'unscored') {
      leads = leads.filter((l) => !l.score);
    } else {
      leads = leads.filter((l) => matchesFilterEnum(l.score, filters.temperature));
    }
  }
  if (filters.excludeConverted) {
    leads = leads.filter((l) => !isLeadConverted(l));
  }
  if (filters.fromDate) {
    leads = leads.filter(l => l.createdAt >= filters.fromDate);
  }
  if (filters.toDate) {
    leads = leads.filter(l => l.createdAt <= filters.toDate);
  }
  leads = applyLeadBudgetRangeFilter(leads, filters);
  if (filters.area) {
    const areaQuery = filters.area.toLowerCase();
    leads = leads.filter(l => {
      const locations = [
        l.buyerRequirement?.preferredArea,
        l.tenantRequirement?.preferredArea,
        l.sellerProperty?.area,
        l.ownerProperty?.area,
        l.sellerProperty?.city,
        l.ownerProperty?.city,
      ].filter(Boolean);
      return locations.some(loc => loc.toLowerCase().includes(areaQuery));
    });
  }
  if (filters.search) {
    const query = filters.search.toLowerCase();
    leads = leads.filter(l => {
      const nameMatch = l.name?.toLowerCase().includes(query);
      const phoneMatch = l.phone?.replace(/[\s-]/g, '').includes(query.replace(/[\s-]/g, ''));
      return nameMatch || phoneMatch;
    });
  }
  if (filters.source) {
    leads = leads.filter(l => l.source?.toLowerCase() === filters.source.toLowerCase());
  }
  if (filters.city) {
    const cityQuery = filters.city.toLowerCase();
    leads = leads.filter(l => {
      const cities = [
        l.sellerProperty?.city,
        l.ownerProperty?.city,
      ].filter(Boolean);
      return cities.some(c => c.toLowerCase().includes(cityQuery));
    });
  }
  if (filters.propertyType) {
    leads = leads.filter(l => {
      const types = [
        l.buyerRequirement?.propertyType,
        l.tenantRequirement?.propertyType,
        l.sellerProperty?.propertyType,
        l.ownerProperty?.propertyType,
      ].filter(Boolean);
      return types.some(t => t.toLowerCase() === filters.propertyType.toLowerCase());
    });
  }
  if (filters.propertySubType) {
    leads = leads.filter(l => {
      const subTypes = [
        l.buyerRequirement?.propertySubType,
        l.tenantRequirement?.propertySubType,
        l.sellerProperty?.propertySubType,
        l.ownerProperty?.propertySubType,
      ].filter(Boolean);
      return subTypes.some(st => st?.toLowerCase() === filters.propertySubType.toLowerCase());
    });
  }
  if (filters.createdBy) {
    leads = leads.filter(l => l.createdBy === filters.createdBy);
  }
  if (filters.updatedBy) {
    leads = leads.filter(l => l.updatedBy === filters.updatedBy);
  }
  if (filters.converted) {
    leads = leads.filter((l) => isLeadConverted(l));
  }

  // Sort
  const sortBy = filters.sortBy || 'createdAt';
  const sortMult = filters.sortOrder === 'asc' ? 1 : -1;

  leads.sort((a, b) => {
    let aVal, bVal;
    switch (sortBy) {
      case 'temperature':
        // scoreValue (0-100) already ranks Hot > Warm > Cold; unscored leads sort last.
        aVal = typeof a.scoreValue === 'number' ? a.scoreValue : -1;
        bVal = typeof b.scoreValue === 'number' ? b.scoreValue : -1;
        break;
      case 'budget':
        aVal = a.buyerRequirement?.budget || a.tenantRequirement?.budget || a.sellerProperty?.expectedPrice || a.ownerProperty?.rentExpected || 0;
        bVal = b.buyerRequirement?.budget || b.tenantRequirement?.budget || b.sellerProperty?.expectedPrice || b.ownerProperty?.rentExpected || 0;
        break;
      case 'name':
        return sortMult * (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
      case 'status':
        return sortMult * (a.status || '').localeCompare(b.status || '');
      case 'updatedAt':
        return sortMult * (a.updatedAt || '').localeCompare(b.updatedAt || '');
      case 'createdAt':
      default:
        return sortMult * (a.createdAt || '').localeCompare(b.createdAt || '');
    }
    if (aVal < bVal) return -sortMult;
    if (aVal > bVal) return sortMult;
    return 0;
  });

  // Pagination — omit limit/offset in filters to fetch all (metrics, summaries)
  const total = leads.length;
  const hasPaging = (filters.limit != null && filters.limit !== '')
    || (filters.offset != null && filters.offset !== '');
  if (hasPaging) {
    const limit = Math.min(parseInt(filters.limit, 10) || parseInt(process.env.DEFAULT_PAGE_LIMIT || '50', 10), 200);
    const offset = Math.max(parseInt(filters.offset, 10) || 0, 0);
    return { leads: leads.slice(offset, offset + limit), total, limit, offset };
  }
  return { leads, total, limit: total, offset: 0 };
}

/**
 * Get a single lead by ID
 */
export async function getLead(tenantId, leadId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#LEAD#${leadId}`,
      SK: 'PROFILE',
    },
  }));
  return result.Item || null;
}

/**
 * Mapping of lead type → the structured requirement/property field that holds
 * the type-specific data. Used to validate that agents update the correct
 * field for the lead type.
 */
export const LEAD_TYPE_REQUIREMENT_FIELD = {
  buyer: 'buyerRequirement',
  seller: 'sellerProperty',
  tenant: 'tenantRequirement',
  owner: 'ownerProperty',
};

/**
 * All structured requirement/property fields on a lead.
 */
export const REQUIREMENT_FIELDS = Object.values(LEAD_TYPE_REQUIREMENT_FIELD);

/**
 * Validate that the requirement/property fields in an update payload are
 * compatible with the lead's type. Throws with a clear, agent-friendly
 * message if a mismatched field is being updated.
 *
 * @param {object} existingLead - The current lead from DynamoDB
 * @param {object} data - The update payload
 * @throws {Error} if a requirement field does not match the lead type
 */
export function validateRequirementFields(existingLead, data) {
  const leadType = existingLead.leadType;
  if (!leadType) return; // Cannot validate without a lead type

  const expectedField = LEAD_TYPE_REQUIREMENT_FIELD[leadType];
  if (!expectedField) return; // Unknown lead type, skip validation

  for (const field of REQUIREMENT_FIELDS) {
    if (isEmptyRequirementPayload(data[field])) {
      delete data[field];
      continue;
    }
    if (field === expectedField) continue;
    throw new Error(
      `Lead '${existingLead.name || existingLead.leadId}' is a '${leadType}' lead. ` +
      `Use '${expectedField}' to update its ${leadType} data, not '${field}'.`
    );
  }
}

function isEmptyRequirementPayload(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).length === 0;
  }
  return false;
}

/**
 * Merge incoming requirement/property objects with existing ones so that
 * partial updates (e.g., only budget) do not wipe out other fields like
 * preferredArea, bhk, or propertyType.
 *
 * - Skips null/undefined/non-object values (preserves existing data).
 * - Mutates and returns `data` in place for convenience.
 *
 * @param {object} existingLead - The current lead from DynamoDB
 * @param {object} data - The update payload (mutated)
 * @returns {object} The mutated data object
 */
export function mergeRequirementObjects(existingLead, data) {
  for (const key of REQUIREMENT_FIELDS) {
    if (data[key] === undefined || data[key] === null) {
      // Skip — do not wipe existing data on null/undefined
      delete data[key];
      continue;
    }
    if (typeof data[key] !== 'object' || Array.isArray(data[key])) {
      // Not an object — skip merge, let downstream validation handle it
      continue;
    }
    // Shallow-merge: existing fields preserved unless overridden by new data
    data[key] = { ...(existingLead[key] || {}), ...data[key] };
  }
  return data;
}

function formatLeadHistoryValue(value) {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function leadValuesEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }
  return String(a) === String(b);
}

const LEAD_SCALAR_HISTORY_FIELDS = [
  { key: 'name', label: 'Name', action: 'Name Changed' },
  { key: 'email', label: 'Email', action: 'Email Changed' },
  { key: 'phone', label: 'Phone', action: 'Phone Changed' },
  { key: 'source', label: 'Source', action: 'Source Changed' },
  { key: 'status', label: 'Status', action: 'Status Changed' },
  { key: 'score', label: 'Temperature', action: 'Temperature Changed' },
  { key: 'notes', label: 'Notes', action: 'Notes Updated' },
  { key: 'lostReason', label: 'Lost reason', action: 'Lost Reason Changed' },
];

const LEAD_NESTED_HISTORY_FIELDS = [
  { key: 'buyerRequirement', label: 'Buyer requirement', action: 'Buyer Requirement Updated' },
  { key: 'sellerProperty', label: 'Seller property', action: 'Seller Property Updated' },
  { key: 'tenantRequirement', label: 'Tenant requirement', action: 'Tenant Requirement Updated' },
  { key: 'ownerProperty', label: 'Owner property', action: 'Owner Property Updated' },
];

export function buildLeadUpdateHistoryEntries(existingLead, data, updatedBy, options = {}) {
  const entries = [];
  const timestamp = new Date().toISOString();
  const actor = updatedBy || SERVICE_ACCOUNT_USER;
  const actorUserId = data.updatedByUserId || options.actorUserId || null;
  const assigneeLabelMap = options.assigneeLabelMap || {};
  const resolveAssigneeLabel = (id) => {
    if (!id) return 'Unassigned';
    return assigneeLabelMap[id] || assigneeLabelMap[String(id)] || 'Team member';
  };

  for (const { key, label, action } of LEAD_SCALAR_HISTORY_FIELDS) {
    if (data[key] === undefined) continue;
    if (leadValuesEqual(data[key], existingLead[key])) continue;

    if (key === 'assignedTo') continue;

    entries.push({
      timestamp,
      action,
      details: `${label} changed from ${formatLeadHistoryValue(existingLead[key])} to ${formatLeadHistoryValue(data[key])}`,
      updatedBy: actor,
      updatedByUserId: actorUserId,
    });
  }

  if (data.assignedTo !== undefined && !leadValuesEqual(data.assignedTo, existingLead.assignedTo)) {
    const fromName = resolveAssigneeLabel(existingLead.assignedTo);
    const toName = resolveAssigneeLabel(data.assignedTo);
    entries.push({
      timestamp,
      action: 'Assignment Changed',
      details: `Lead assigned from ${fromName} to ${toName}`,
      updatedBy: actor,
      updatedByUserId: actorUserId,
    });
  }

  for (const { key, label, action } of LEAD_NESTED_HISTORY_FIELDS) {
    if (data[key] === undefined) continue;
    if (leadValuesEqual(data[key], existingLead[key])) continue;
    entries.push({
      timestamp,
      action,
      details: `${label} updated`,
      updatedBy: actor,
      updatedByUserId: actorUserId,
    });
  }

  return entries;
}

async function appendLeadHistory(tenantId, leadId, entry) {
  const lead = await getLead(tenantId, leadId);
  if (!lead) return;

  const history = [
    ...(lead.history || []),
    {
      timestamp: entry.timestamp || new Date().toISOString(),
      action: entry.action,
      details: entry.details,
      updatedBy: entry.updatedBy || SERVICE_ACCOUNT_USER,
      ...(entry.updatedByUserId ? { updatedByUserId: entry.updatedByUserId } : {}),
    },
  ];

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#LEAD#${leadId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #history = :history, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#history': 'history' },
    ExpressionAttributeValues: {
      ':history': history,
      ':updatedAt': new Date().toISOString(),
    },
  }));
}

/**
 * Update a lead
 */
export async function updateLead(tenantId, leadId, data, options = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // Reject conversion/system mass-assignment
  for (const key of CONVERSION_SYSTEM_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      throw new Error(`Forbidden keys in update payload: ${key}`);
    }
  }
  rejectForbiddenKeys(data);

  const existingLead = await getLead(tenantId, leadId);
  if (!existingLead) {
    throw new Error('Lead not found');
  }

  if (data.status && String(data.status).toLowerCase() === 'converted') {
    throw new Error('Use convert lead to mark a lead as converted');
  }

  // Prevent updating converted residual legacy leads (except notes)
  if (isLeadConverted(existingLead) && Object.keys(data).some(k => !['notes'].includes(k))) {
    throw new Error('Cannot update a converted lead');
  }

  validateLeadCityUpdate(data, existingLead);
  validateLeadBhkUpdate(data, existingLead);
  normalizeLeadTextFields(data);

  // Normalize seller property timeline data for consistent UI rendering
  if (existingLead.leadType === 'seller' && data.sellerProperty) {
    data.sellerProperty = normalizeSellerProperty(data.sellerProperty) || data.sellerProperty;
    const sp = data.sellerProperty;
    const existingValue = sp.timelineValue;
    const existingUnit = sp.timelineUnit || 'months';
    const existingTimeline = sp.timeline;

    if (existingValue !== undefined && existingValue !== null && existingValue !== '') {
      data.sellerProperty = {
        ...sp,
        timelineValue: Number(existingValue),
        timelineUnit: existingUnit,
        timeline: `${existingValue} ${existingUnit}`,
      };
    } else if (existingTimeline) {
      const parts = String(existingTimeline).trim().split(/\s+/);
      const parsedValue = Number(parts[0]);
      const parsedUnit = parts[1] || 'months';
      if (!isNaN(parsedValue)) {
        data.sellerProperty = {
          ...sp,
          timelineValue: parsedValue,
          timelineUnit: parsedUnit,
          timeline: existingTimeline,
        };
      }
    }
  }

  if (existingLead.leadType === 'owner' && data.ownerProperty) {
    data.ownerProperty = normalizeOwnerProperty(data.ownerProperty) || data.ownerProperty;
  }

  // Validate that requirement/property fields match the lead type
  validateRequirementFields(existingLead, data);

  // Merge requirement objects so partial updates (e.g., only budget) do not
  // wipe out existing fields like preferredArea, bhk, or propertyType.
  // Also strips null/undefined requirement fields to prevent data loss.
  mergeRequirementObjects(existingLead, data);

  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  data.updatedAt = new Date().toISOString();

  const historyEntries = buildLeadUpdateHistoryEntries(existingLead, data, data.updatedBy, options);
  if (historyEntries.length > 0) {
    data.history = [...(existingLead.history || []), ...historyEntries];
  }

  const immutableKeys = new Set(['PK', 'SK', 'EntityType', 'tenantId', 'leadId', 'createdAt', 'createdBy', 'updatedByUserId', 'createdByUserId']);
  Object.keys(data).forEach((key, index) => {
    if (key === 'updatedBy') return; // Skip helper field
    if (key === 'updatedByUserId' || key === 'createdByUserId') return;
    if (immutableKeys.has(key)) return;
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = data[key];
  });

  if (!updateExpressions.length) {
    return existingLead;
  }

  const conditionParts = ['attribute_exists(PK)'];
  if (data.convertedAt) {
    conditionParts.push('attribute_not_exists(convertedAt)');
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: CRM_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#LEAD#${leadId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ConditionExpression: conditionParts.join(' AND '),
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues,
    }));
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      if (data.convertedAt) {
        throw new Error('Lead already converted');
      }
      throw new Error('Lead not found');
    }
    throw err;
  }

  // Log contact activity for status change
  if (data.status && data.status !== existingLead.status) {
    try {
      await logContactActivity(tenantId, {
        activityType: 'lead_status_changed',
        subjectEntityType: 'lead',
        subjectEntityId: leadId,
        subjectEntityName: existingLead.name,
        title: `Lead Status: ${data.status.toUpperCase()}`,
        description: `Status changed from ${existingLead.status} to ${data.status}.`,
        performedBy: data.updatedBy || SERVICE_ACCOUNT_USER,
        payload: { leadId, fromStatus: existingLead.status, toStatus: data.status },
      });
    } catch (err) {
      logger.error('updateLead.logContactActivity.error', { leadId, error: err.message });
    }
  }

  // Log contact activity for assignment change
  if (data.assignedTo !== undefined && data.assignedTo !== existingLead.assignedTo) {
    try {
      const assigneeLabelMap = options.assigneeLabelMap || {};
      const resolveAssigneeLabel = (id) => {
        if (!id) return 'Unassigned';
        return assigneeLabelMap[id] || assigneeLabelMap[String(id)] || 'Team member';
      };
      const fromName = resolveAssigneeLabel(existingLead.assignedTo);
      const toName = resolveAssigneeLabel(data.assignedTo);
      await logContactActivity(tenantId, {
        activityType: 'lead_assigned',
        subjectEntityType: 'lead',
        subjectEntityId: leadId,
        subjectEntityName: existingLead.name,
        title: `Lead Assigned to ${toName}`,
        description: `Lead assigned from ${fromName} to ${toName}.`,
        performedBy: data.updatedBy || SERVICE_ACCOUNT_USER,
        payload: { leadId, fromAssignee: existingLead.assignedTo, toAssignee: data.assignedTo },
      });
    } catch (err) {
      logger.error('updateLead.logContactActivity.assignment.error', { leadId, error: err.message });
    }
  }

  return await getLead(tenantId, leadId);
}

/**
 * Convert a lead into its canonical module entity in a single DynamoDB transaction.
 *
 * Lifecycle:
 * 1. Preflight reads (lead, notes, meetings, same-module phone match, optional property)
 * 2. Build all Put/Update/Delete actions
 * 3. TransactWriteItems — all succeed or none do
 * 4. Active lead PROFILE + NOTE# children are deleted; immutable LEAD_CONVERSION snapshot retained
 *
 * No convertingLockAt / conversion-in-progress / soft-rollback saga.
 */
export async function convertLead(tenantId, leadId, options = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const validated = validateConvertLeadOptions(options);

  // Idempotency: prior successful conversion leaves a snapshot keyed by sourceLeadId
  const priorSnapshots = await getLeadConversionSnapshotsByLeadId(tenantId, leadId);
  if (priorSnapshots.length > 0) {
    const snap = priorSnapshots[0];
    const err = new Error('Lead already converted');
    err.code = 'ALREADY_CONVERTED';
    err.conversionSnapshotId = snap.conversionSnapshotId;
    err.convertedTo = {
      entityType: snap.entityType,
      entityId: snap.entityId,
      role: snap.role,
    };
    throw err;
  }

  const lead = await getLead(tenantId, leadId);
  if (!lead) {
    throw new Error('Lead not found');
  }

  // Residual legacy converted rows (pre-redesign)
  if (hasLeadConversionTarget(lead)) {
    const err = new Error('Lead already converted');
    err.code = 'ALREADY_CONVERTED';
    err.convertedTo = lead.convertedTo;
    throw err;
  }

  if (!lead.phone) {
    throw new Error('Phone number is required to convert a lead');
  }

  const role = lead.leadType;
  if (!['buyer', 'seller', 'tenant', 'owner'].includes(role)) {
    throw new Error(`Unknown lead type: ${lead.leadType}`);
  }

  if (role === 'buyer' && !validated.purchaseDetails) {
    // purchaseDetails remain optional at API level (UI may require them)
  }
  if (role === 'tenant' && !validated.leaseDetails) {
    // leaseDetails remain optional at API level
  }

  const [leadNotes, leadMeetings] = await Promise.all([
    getLeadNotes(tenantId, leadId),
    getMeetingsByEntity(tenantId, 'lead', leadId),
  ]);

  // Same-module merge lookup
  let existingByPhone = null;
  if (role === 'buyer') {
    existingByPhone = await findBuyerByPhone(tenantId, lead.phone);
  } else if (role === 'seller' || role === 'owner') {
    existingByPhone = await getOwnerByPhone(tenantId, lead.phone);
  } else if (role === 'tenant') {
    existingByPhone = await getCustomerByPhone(tenantId, lead.phone);
  }

  const target = buildTargetEntity(lead, validated, existingByPhone);
  const convertedAt = new Date().toISOString();
  const conversionSnapshotId = uuidv4();

  // Finalize entity item keys / search index
  const entityItem = { ...target.item };
  delete entityItem.wasExisting;
  delete entityItem.PK;
  delete entityItem.SK;
  delete entityItem.EntityType;
  delete entityItem.tenantId;
  delete entityItem.GSI3PK;
  delete entityItem.GSI3SK;

  if (target.storageType === 'BUYER') {
    Object.assign(entityItem, {
      PK: `TENANT#${tenantId}#BUYER#${target.entityId}`,
      SK: 'PROFILE',
      EntityType: 'BUYER',
      tenantId,
      buyerId: target.entityId,
      // Seeking = active; purchase at convert = purchased (stays in Buyers module)
      status: validated.purchaseDetails?.propertyId ? 'purchased' : 'active',
      conversionSnapshotId,
      convertedAt,
      convertedFromLeadId: lead.leadId,
      sourceLeadSnapshot: deepClone(buildConversionSnapshotItem(tenantId, {
        conversionSnapshotId,
        lead,
        notes: leadNotes,
        meetings: leadMeetings,
        entityType: target.entityType,
        entityId: target.entityId,
        role,
        options: validated,
        convertedAt,
      }).sourceLeadSnapshot),
      GSI3PK: `TENANT#${tenantId}#SEARCH`,
      GSI3SK: `BUYER#${String(entityItem.name || '').toLowerCase()}#${entityItem.phone}`,
    });
  } else if (target.storageType === 'OWNER') {
    Object.assign(entityItem, {
      PK: `TENANT#${tenantId}#OWNER#${target.entityId}`,
      SK: 'PROFILE',
      EntityType: 'OWNER',
      tenantId,
      ownerId: target.entityId,
      conversionSnapshotId,
      convertedAt,
      convertedFromLeadId: lead.leadId,
      sourceLeadSnapshot: deepClone(buildConversionSnapshotItem(tenantId, {
        conversionSnapshotId,
        lead,
        notes: leadNotes,
        meetings: leadMeetings,
        entityType: target.entityType,
        entityId: target.entityId,
        role,
        options: validated,
        convertedAt,
      }).sourceLeadSnapshot),
      GSI3PK: `TENANT#${tenantId}#SEARCH`,
      GSI3SK: `OWNER#${String(entityItem.name || '').toLowerCase()}#${entityItem.phone}`,
    });
  } else if (target.storageType === 'CUSTOMER') {
    Object.assign(entityItem, {
      PK: `TENANT#${tenantId}#CUSTOMER#${target.entityId}`,
      SK: 'PROFILE',
      EntityType: 'CUSTOMER',
      tenantId,
      customerId: target.entityId,
      conversionSnapshotId,
      convertedAt,
      convertedFromLeadId: lead.leadId,
      sourceLeadSnapshot: deepClone(buildConversionSnapshotItem(tenantId, {
        conversionSnapshotId,
        lead,
        notes: leadNotes,
        meetings: leadMeetings,
        entityType: target.entityType,
        entityId: target.entityId,
        role,
        options: validated,
        convertedAt,
      }).sourceLeadSnapshot),
      GSI3PK: `TENANT#${tenantId}#SEARCH`,
      GSI3SK: `CUSTOMER#${String(entityItem.name || '').toLowerCase()}#${entityItem.phone}`,
    });
  }

  // Optional listing property (seller/owner)
  let propertyPut = null;
  if (role === 'seller' && validated.createPropertyListing !== false) {
    const existingProps = await getPropertiesByLeadId(tenantId, leadId);
    if (existingProps.length === 0) {
      propertyPut = buildForSalePropertyItem(tenantId, lead, entityItem, validated);
    }
  } else if (role === 'owner') {
    const existingProps = await getPropertiesByLeadId(tenantId, leadId);
    if (existingProps.length === 0) {
      propertyPut = buildForRentPropertyItem(tenantId, lead, entityItem, validated);
    }
  }

  // Optional purchase / lease property updates (built as absolute Put of updated profile)
  let propertyUpdatePut = null;
  // Buyer purchase ownership transfer is completed after the conversion
  // transaction via transferOwnership() — keeps SaleTransaction + seller
  // lifecycle on the shared path. Purchase rows still land on the buyer entity
  // inside this transaction.
  if (role === 'buyer' && validated.purchaseDetails?.propertyId) {
    const prop = await getProperty(tenantId, validated.purchaseDetails.propertyId);
    if (!prop) throw new Error('Property not found for purchaseDetails');
    const now = convertedAt;
    const saleAmount = Number(validated.purchaseDetails.saleAmount) || 0;
    const purchases = [...(entityItem.purchases || []), {
      propertyId: validated.purchaseDetails.propertyId,
      purchaseDate: validated.purchaseDetails.purchaseDate || now,
      saleAmount,
      registrationDate: validated.purchaseDetails.registrationDate || null,
      registrationNumber: validated.purchaseDetails.registrationNumber || null,
      stampDutyPaid: validated.purchaseDetails.stampDutyPaid || 0,
      registrationCharges: validated.purchaseDetails.registrationCharges || 0,
      brokeragePaid: validated.purchaseDetails.brokeragePaid || 0,
      notes: validated.purchaseDetails.notes || '',
    }];
    entityItem.purchases = purchases;
  }

  if (role === 'tenant' && validated.leaseDetails?.propertyId) {
    const prop = await getProperty(tenantId, validated.leaseDetails.propertyId);
    if (!prop) throw new Error('Property not found for leaseDetails');
    const lease = validated.leaseDetails;
    const rentalEntry = {
      propertyId: lease.propertyId,
      propertyName: prop.title || null,
      area: prop.area || null,
      leaseStartDate: lease.leaseStartDate,
      leaseEndDate: lease.leaseEndDate || null,
      monthlyRent: lease.monthlyRent || 0,
      securityDeposit: lease.securityDeposit || 0,
      brokeragePaid: lease.brokeragePaid || 0,
      notes: lease.notes || '',
    };
    entityItem.currentRental = rentalEntry;
    entityItem.rentalHistory = [...(entityItem.rentalHistory || []), rentalEntry];

    propertyUpdatePut = {
      ...prop,
      status: 'rented',
      listingStatus: 'inactive',
      rentAmount: null,
      tenantCustomerId: target.entityId,
      saleInfo: {
        ...(prop.saleInfo || {}),
        listedPrice: null,
      },
      rentalInfo: {
        ...(prop.rentalInfo || {}),
        currentRent: lease.monthlyRent || 0,
        currentTenantId: target.entityId,
        leaseStartDate: lease.leaseStartDate || null,
        leaseEndDate: lease.leaseEndDate || null,
        securityDeposit: lease.securityDeposit || 0,
        expectedRent: null,
      },
      rentalHistory: [...(prop.rentalHistory || []), {
        ...rentalEntry,
        tenantId: target.entityId,
        tenantName: entityItem.name,
      }],
      GSI2PK: `TENANT#${tenantId}#PROPERTY_STATUS#rented`,
      updatedAt: convertedAt,
    };
  }

  const includeProperty = !!propertyPut;
  const includePropertyUpdate = !!propertyUpdatePut;
  const estimated = estimateTransactItemCount({
    noteCount: leadNotes.length,
    meetingCount: leadMeetings.length,
    includeProperty,
    includePropertyUpdate,
    includeContact: false,
  });
  assertTransactSizeOk(estimated);

  const snapshotItem = buildConversionSnapshotItem(tenantId, {
    conversionSnapshotId,
    lead,
    notes: leadNotes,
    meetings: leadMeetings,
    entityType: target.entityType,
    entityId: target.entityId,
    role,
    options: validated,
    convertedAt,
  });

  const transactItems = [];

  // Snapshot first
  transactItems.push({
    Put: {
      Item: snapshotItem,
      ConditionExpression: 'attribute_not_exists(PK)',
    },
  });

  // Target entity create or replace (merge path still Put full item)
  if (target.wasExisting) {
    transactItems.push({
      Put: {
        Item: entityItem,
        ConditionExpression: 'attribute_exists(PK)',
      },
    });
  } else {
    transactItems.push({
      Put: {
        Item: entityItem,
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    });
  }

  if (propertyPut) {
    transactItems.push({
      Put: {
        Item: propertyPut.item,
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    });
  }

  if (propertyUpdatePut) {
    transactItems.push({
      Put: {
        Item: propertyUpdatePut,
        ConditionExpression: 'attribute_exists(PK)',
      },
    });
  }

  // Notes migration
  for (const action of buildNoteMigrationActions(tenantId, leadId, leadNotes, target)) {
    if (action.Put) {
      transactItems.push({ Put: { Item: action.Put.Item } });
    } else if (action.Delete) {
      transactItems.push({ Delete: { Key: action.Delete.Key } });
    }
  }

  // Meeting re-links
  for (const action of buildMeetingRelinkUpdates(
    tenantId,
    leadMeetings,
    target.entityType,
    target.entityId,
    entityItem.name,
    entityItem.phone,
  )) {
    transactItems.push({
      Update: {
        Key: action.Update.Key,
        UpdateExpression: action.Update.UpdateExpression,
        ExpressionAttributeValues: action.Update.ExpressionAttributeValues,
        ConditionExpression: action.Update.ConditionExpression,
      },
    });
  }

  // Delete active lead profile — conversion removes it from the Lead module
  transactItems.push({
    Delete: {
      Key: {
        PK: `TENANT#${tenantId}#LEAD#${leadId}`,
        SK: 'PROFILE',
      },
      // Allow legacy rows that stored convertedTo: null at creation time
      ConditionExpression: 'attribute_exists(PK) AND (attribute_not_exists(convertedTo) OR convertedTo = :null)',
      ExpressionAttributeValues: {
        ':null': null,
      },
    },
  });

  assertTransactSizeOk(transactItems.length);

  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: transactItems.map((item) => {
        if (item.Put) return { Put: { TableName: CRM_TABLE_NAME, ...item.Put } };
        if (item.Delete) return { Delete: { TableName: CRM_TABLE_NAME, ...item.Delete } };
        if (item.Update) return { Update: { TableName: CRM_TABLE_NAME, ...item.Update } };
        return item;
      }),
    }));
  } catch (err) {
    if (err.name === 'TransactionCanceledException' || err.CancellationReasons) {
      const reasons = err.CancellationReasons || [];
      const already = reasons.some((r) => r?.Code === 'ConditionalCheckFailed');
      // Re-check snapshot for concurrent winner
      const snaps = await getLeadConversionSnapshotsByLeadId(tenantId, leadId);
      if (snaps.length > 0) {
        const snap = snaps[0];
        const alreadyErr = new Error('Lead already converted');
        alreadyErr.code = 'ALREADY_CONVERTED';
        alreadyErr.conversionSnapshotId = snap.conversionSnapshotId;
        alreadyErr.convertedTo = {
          entityType: snap.entityType,
          entityId: snap.entityId,
          role: snap.role,
        };
        throw alreadyErr;
      }
      logger.error('convertLead.transaction.canceled', {
        tenantId,
        leadId,
        reasons: reasons.map((r, i) => ({ index: i, code: r?.Code, message: r?.Message })),
        message: err.message,
      });
      const leadDeleteFailed = reasons.some(
        (r, i) => r?.Code === 'ConditionalCheckFailed'
          && transactItems[i]?.Delete?.Key?.SK === 'PROFILE',
      );
      const txErr = new Error(
        leadDeleteFailed
          ? 'Lead is already marked as converted and cannot be converted again'
          : already
            ? 'Lead conversion conflict — please retry'
            : (err.message || 'Lead conversion transaction failed'),
      );
      txErr.code = 'CONVERSION_FAILED';
      throw txErr;
    }
    logger.error('convertLead.transaction.failed', { tenantId, leadId, error: err.message });
    throw err;
  }

  // Strip internal Dynamo keys from response entity
  const {
    PK, SK, GSI1PK, GSI2PK, GSI3PK, GSI3SK, ...publicEntity
  } = entityItem;

  logger.info('convertLead.success', {
    tenantId,
    leadId,
    entityType: target.entityType,
    entityId: target.entityId,
    conversionSnapshotId,
  });

  // Phase 4: upsert canonical Contact + profiles (legacy OWNER/BUYER/CUSTOMER remain for compat)
  let contact = null;
  try {
    const roles = {
      owner: role === 'owner' || role === 'seller',
      seller: role === 'seller',
      buyer: role === 'buyer',
      tenant: role === 'tenant',
    };
    const contactPayload = {
      name: entityItem.name,
      phone: entityItem.phone,
      email: entityItem.email || null,
      address: entityItem.address || '',
      roles,
      source: `lead_conversion:${leadId}`,
      panNumber: entityItem.panNumber || null,
      aadharNumber: entityItem.aadharNumber || null,
    };
    if (role === 'seller') {
      contactPayload.sellerProfile = {
        lifecycleStatus: 'active',
        soldPropertyIds: [],
        activeListingIds: [],
        notes: lead.notes || null,
      };
      contactPayload.ownerProfile = {
        lifecycleStatus: 'active',
        ownedPropertyIds: propertyPut?.propertyId ? [propertyPut.propertyId] : [],
      };
      contactPayload.linkedOwnerId = target.entityId;
    } else if (role === 'owner') {
      contactPayload.ownerProfile = {
        lifecycleStatus: 'active',
        ownedPropertyIds: propertyPut?.propertyId ? [propertyPut.propertyId] : [],
      };
      contactPayload.linkedOwnerId = target.entityId;
    } else     if (role === 'buyer') {
      contactPayload.buyerProfile = {
        budget: entityItem.budget ?? lead.buyerRequirement?.budget ?? null,
        preferredArea: entityItem.preferredArea || lead.buyerRequirement?.preferredArea || null,
        propertyType: entityItem.propertyType || lead.buyerRequirement?.propertyType || null,
        bhk: entityItem.bhk ?? lead.buyerRequirement?.bhk ?? null,
        requirement: entityItem.requirement || lead.buyerRequirement?.requirement || null,
      };
    } else if (role === 'tenant') {
      contactPayload.tenantProfile = {
        requirement: entityItem.tenantRequirement || lead.tenantRequirement || null,
        budget: entityItem.budget ?? null,
        preferredArea: entityItem.preferredArea || null,
        originalCustomerId: target.entityId,
      };
      contactPayload.linkedCustomerId = target.entityId;
    }
    if (validated.existingContactId) {
      contact = await getContact(tenantId, validated.existingContactId);
      if (contact) {
        contact = await updateContact(tenantId, contact.contactId, {
          ...contactPayload,
          roles: {
            ...(contact.roles || {}),
            ...roles,
          },
        });
      }
    }
    if (!contact) {
      contact = await createOrUpdateContactByPhone(tenantId, contactPayload);
    }
  } catch (err) {
    logger.error('convertLead.contactUpsert.failed', {
      tenantId,
      leadId,
      error: err.message,
    });
  }

  // Create Listing for seller/owner property listings created in conversion
  if (contact && propertyPut?.propertyId) {
    try {
      const { createListing } = await import('./services/listingService.js');
      const listingType = role === 'seller' ? 'sale' : 'rent';
      // Attach contact ownership pointer before listing so resolve uses it
      await updateProperty(tenantId, propertyPut.propertyId, {
        currentOwnerContactId: contact.contactId,
        ownerContactId: contact.contactId,
      });
      const listing = await createListing(tenantId, {
        propertyId: propertyPut.propertyId,
        listingType,
        listedPrice: propertyPut.item?.saleInfo?.listedPrice ?? null,
        expectedRent: propertyPut.item?.rentalInfo?.expectedRent ?? null,
        securityDeposit: propertyPut.item?.rentalInfo?.securityDeposit ?? 0,
        source: `lead_conversion:${leadId}`,
        // Property already has for-sale/for-rent status from conversion txn
        skipPropertySync: true,
      });
      // Track real listingId on Contact (not propertyId) so seller→past works after sale
      const existingSeller = contact.sellerProfile || {};
      const existingOwner = contact.ownerProfile || {};
      const activeListingIds = Array.isArray(existingSeller.activeListingIds)
        ? [...existingSeller.activeListingIds]
        : [];
      const trackId = listing?.listingId || propertyPut.propertyId;
      if (trackId && !activeListingIds.includes(trackId)) {
        activeListingIds.push(trackId);
      }
      const ownedPropertyIds = Array.isArray(existingOwner.ownedPropertyIds)
        ? [...existingOwner.ownedPropertyIds]
        : [];
      if (!ownedPropertyIds.includes(propertyPut.propertyId)) {
        ownedPropertyIds.push(propertyPut.propertyId);
      }
      contact = await updateContact(tenantId, contact.contactId, {
        sellerProfile: {
          ...existingSeller,
          lifecycleStatus: 'active',
          activeListingIds,
        },
        ownerProfile: {
          ...existingOwner,
          lifecycleStatus: 'active',
          ownedPropertyIds,
        },
        linkedOwnerId: contact.linkedOwnerId || target.entityId,
      });
    } catch (err) {
      logger.error('convertLead.listing.failed', {
        tenantId,
        leadId,
        propertyId: propertyPut.propertyId,
        error: err.message,
      });
    }
  }

  // Complete ownership transfer for buyer purchase via shared service
  // (SaleTransaction, currentOwnerContactId, seller→past, owner shell).
  if (role === 'buyer' && validated.purchaseDetails?.propertyId) {
    try {
      const { transferOwnership } = await import('./services/transferOwnership.js');
      await transferOwnership(tenantId, {
        propertyId: validated.purchaseDetails.propertyId,
        soldPrice: Number(validated.purchaseDetails.saleAmount) || 0,
        buyerId: target.entityId,
        saleType: 'direct',
        notes: validated.purchaseDetails.notes || null,
        brokerageAmount: validated.purchaseDetails.brokeragePaid || null,
        source: `lead_conversion:${leadId}`,
        skipBuyerPurchase: true,
      });
    } catch (err) {
      logger.error('convertLead.transferOwnership.failed', {
        tenantId,
        leadId,
        propertyId: validated.purchaseDetails.propertyId,
        error: err.message,
      });
    }
  }

  // Close active rent listings + Khata brokerage after tenant lease conversion (mirrors markPropertyRented).
  if (role === 'tenant' && validated.leaseDetails?.propertyId) {
    const leasePropertyId = validated.leaseDetails.propertyId;
    try {
      const { closeActiveRentListingsForProperty } = await import('./services/listingService.js');
      await closeActiveRentListingsForProperty(tenantId, leasePropertyId);
    } catch (err) {
      logger.error('convertLead.closeRentListings.failed', {
        tenantId,
        leadId,
        propertyId: leasePropertyId,
        error: err.message,
      });
    }

    const brokeragePaid = Number(validated.leaseDetails.brokeragePaid) || 0;
    if (brokeragePaid > 0) {
      try {
        const { createBrokerageKhataEntry } = await import('./crmHelpers.js');
        const rentalProperty = propertyUpdatePut || await getProperty(tenantId, leasePropertyId);
        await createBrokerageKhataEntry(tenantId, {
          propertyId: leasePropertyId,
          partyId: rentalProperty?.ownerId || 'UNASSIGNED',
          partyType: 'OWNER',
          partyName: rentalProperty?.ownerSnapshot?.name || rentalProperty?.ownerName || 'Owner',
          amount: brokeragePaid,
          transactionType: 'TO_TAKE',
          sourceRef: `lead_conversion:${leadId}:rental`,
          description: `Brokerage for renting property: ${rentalProperty?.title || ''}`,
        });
      } catch (err) {
        logger.error('convertLead.brokerageKhata.failed', {
          tenantId,
          leadId,
          propertyId: leasePropertyId,
          error: err.message,
        });
      }
    }
  }

  // Contact timeline: lead converted
  if (contact?.contactId) {
    try {
      await logContactActivity(tenantId, {
        activityType: 'lead_converted',
        subjectEntityType: 'contact',
        subjectEntityId: contact.contactId,
        subjectEntityName: contact.name || lead.name,
        title: `Became a ${role}`,
        description: `Converted from lead ${leadId.length > 8 ? `${leadId.slice(0, 8)}…` : leadId} as ${role}. Original lead is locked for reference.`,
        performedBy: validated.convertedBy || validated.performedBy || SERVICE_ACCOUNT_USER,
        payload: {
          leadId,
          role,
          entityType: target.entityType,
          entityId: target.entityId,
          conversionSnapshotId,
        },
      });
    } catch (err) {
      logger.error('convertLead.activity.failed', { leadId, error: err.message });
    }
  }

  return buildConvertLeadResult({
    entity: publicEntity,
    entityType: target.entityType,
    conversionSnapshotId,
    convertedAt,
    leadId,
    role,
    contactId: contact?.contactId || null,
    contact,
  });
}

/** Look up conversion snapshots by original leadId (post-delete audit). */
export async function getLeadConversionSnapshotsByLeadId(tenantId, leadId) {
  if (!tenantId || !leadId) return [];
  const items = await collectAllPages(docClient, ScanCommand, {
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId AND sourceLeadId = :leadId',
    ExpressionAttributeValues: {
      ':type': 'LEAD_CONVERSION',
      ':tenantId': tenantId,
      ':leadId': leadId,
    },
  }, { maxPages: 20 });
  return items || [];
}

/** List conversion snapshots for a tenant (converted history). */
export async function getLeadConversionSnapshots(tenantId, filters = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  let items = await collectAllPages(docClient, ScanCommand, {
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'LEAD_CONVERSION',
      ':tenantId': tenantId,
    },
  }, { maxPages: 100 });

  if (filters.leadType) {
    items = items.filter((s) => String(s.leadType || '').toLowerCase() === String(filters.leadType).toLowerCase());
  }
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    items = items.filter((s) => {
      const name = s.sourceLeadSnapshot?.lead?.name || '';
      const phone = s.sourceLeadSnapshot?.lead?.phone || '';
      return name.toLowerCase().includes(q) || phone.includes(q);
    });
  }

  items.sort((a, b) => String(b.convertedAt || '').localeCompare(String(a.convertedAt || '')));
  return items;
}

export async function findBuyerByPhone(tenantId, phone) {
  if (!tenantId || !phone) return null;
  const buyers = await collectAllPages(docClient, ScanCommand, {
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'BUYER',
      ':tenantId': tenantId,
    },
  }, { maxPages: 100 });
  return (buyers || []).find((b) => phonesMatch(b.phone, phone)) || null;
}

/**
 * Archive a lead (reversible soft-remove) instead of deleting it.
 * Delegates to updateLead, so it inherits the same guards -- notably,
 * a converted lead cannot be archived either (updateLead blocks all
 * field changes except notes on converted leads; the buyer/seller/tenant/
 * owner record is the live entity at that point, not the legacy lead).
 */
export async function archiveLead(tenantId, leadId) {
  return updateLead(tenantId, leadId, { status: 'archived' });
}

/**
 * Delete a lead
 */
export async function deleteLead(tenantId, leadId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const lead = await getLead(tenantId, leadId);
  if (!lead) {
    throw new Error('Lead not found');
  }
  if (isLeadConverted(lead)) {
    throw new Error('Cannot delete a converted lead');
  }

  await docClient.send(new DeleteCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#LEAD#${leadId}`,
      SK: 'PROFILE',
    },
  }));
  return true;
}

// ============== Lead Notes Operations ==============

export async function createLeadNote(tenantId, leadId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  const noteId = uuidv4();
  const note = {
    PK: `TENANT#${tenantId}#LEAD#${leadId}`,
    SK: `NOTE#${noteId}`,
    EntityType: 'NOTE',
    tenantId,
    noteId,
    leadId,
    content: data.content,
    createdBy: data.createdBy || SERVICE_ACCOUNT_USER,
    createdAt: data.createdAt || new Date().toISOString(),
  };
  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: note,
  }));

  const actor = data.createdBy || SERVICE_ACCOUNT_USER;
  const actorUserId = data.createdByUserId || null;
  const preview = String(data.content || '').trim();
  try {
    await appendLeadHistory(tenantId, leadId, {
      action: 'Note Added',
      details: preview ? `Note added: ${preview.length > 120 ? `${preview.slice(0, 120)}...` : preview}` : 'Note added',
      updatedBy: actor,
      updatedByUserId: actorUserId,
    });
  } catch (err) {
    logger.error('createLeadNote.appendHistory.error', { leadId, error: err.message });
  }

  try {
    const lead = await getLead(tenantId, leadId);
    await logContactActivity(tenantId, {
      activityType: 'note_added',
      subjectEntityType: 'lead',
      subjectEntityId: leadId,
      subjectEntityName: lead?.name || '',
      title: 'Note Added (Lead)',
      description: data.content,
      performedBy: data.createdBy,
      payload: { noteId, content: data.content },
    });
  } catch (err) {
    logger.error('createLeadNote.logContactActivity.error', { leadId, error: err.message });
  }

  return note;
}

export async function getLeadNotes(tenantId, leadId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  const result = await docClient.send(new QueryCommand({
    TableName: CRM_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#LEAD#${leadId}`,
      ':sk': 'NOTE#',
    },
  }));
  return result.Items || [];
}

export async function updateLeadNote(tenantId, leadId, noteId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const existingNotes = await getLeadNotes(tenantId, leadId);
  const existingNote = existingNotes.find((n) => n.noteId === noteId);
  if (!existingNote) {
    throw new Error('Note not found');
  }

  const actor = data.updatedBy || data.createdBy || SERVICE_ACCOUNT_USER;
  const actorUserId = data.updatedByUserId || data.createdByUserId || null;
  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#LEAD#${leadId}`,
      SK: `NOTE#${noteId}`,
    },
    UpdateExpression: 'SET #content = :content, #updatedAt = :updatedAt, #updatedBy = :updatedBy',
    ExpressionAttributeNames: {
      '#content': 'content',
      '#updatedAt': 'updatedAt',
      '#updatedBy': 'updatedBy',
    },
    ExpressionAttributeValues: {
      ':content': data.content,
      ':updatedAt': new Date().toISOString(),
      ':updatedBy': actor,
    },
  }));

  const preview = String(data.content || '').trim();
  try {
    await appendLeadHistory(tenantId, leadId, {
      action: 'Note Updated',
      details: preview ? `Note updated: ${preview.length > 120 ? `${preview.slice(0, 120)}...` : preview}` : 'Note updated',
      updatedBy: actor,
      updatedByUserId: actorUserId,
    });
  } catch (err) {
    logger.error('updateLeadNote.appendHistory.error', { leadId, noteId, error: err.message });
  }

  const notes = await getLeadNotes(tenantId, leadId);
  return notes.find(n => n.noteId === noteId) || null;
}

export async function deleteLeadNote(tenantId, leadId, noteId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  await docClient.send(new DeleteCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#LEAD#${leadId}`,
      SK: `NOTE#${noteId}`,
    },
  }));
  return true;
}

// ============== Migration Helpers ==============

/**
 * Migrate an existing Owner to a Contact
 */
export async function migrateOwnerToContact(tenantId, ownerId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const owner = await getOwner(tenantId, ownerId);
  if (!owner) {
    throw new Error('Owner not found');
  }

  // Check if already migrated
  const existingContact = await findContactByPhone(tenantId, owner.phone);
  if (existingContact && existingContact.linkedOwnerId === ownerId) {
    return existingContact;
  }

  const contactData = {
    name: owner.name,
    email: owner.email,
    phone: owner.phone,
    address: owner.address,
    panNumber: owner.panNumber,
    aadharNumber: owner.aadharNumber,
    panDocS3Key: owner.panDocS3Key,
    aadharDocS3Key: owner.aadharDocS3Key,
    photoS3Key: owner.photoS3Key,
    bankName: owner.bankName,
    accountNumber: owner.accountNumber,
    ifscCode: owner.ifscCode,
    notes: owner.notes,
    tags: owner.tags,
    source: owner.source || 'migrated:owner',
    linkedOwnerId: ownerId,
    roles: {
      owner: true,
      seller: false,
      buyer: false,
      tenant: false,
    },
    ownerProfile: {
      migratedFrom: 'OWNER',
      originalOwnerId: ownerId,
    },
  };

  return await createOrUpdateContactByPhone(tenantId, contactData);
}

/**
 * Migrate an existing Customer to a Contact
 */
export async function migrateCustomerToContact(tenantId, customerId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const customer = await getCustomer(tenantId, customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }

  // Check if already migrated
  const existingContact = await findContactByPhone(tenantId, customer.phone);
  if (existingContact && existingContact.linkedCustomerId === customerId) {
    return existingContact;
  }

  // Determine if customer was being used as tenant or buyer
  // Based on fields like requirement, budget, preferredArea
  const isBuyer = !!(customer.requirement || customer.budget || customer.preferredArea);
  const isTenant = true; // Customers in old system were primarily tenants

  const contactData = {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    notes: customer.notes,
    tags: customer.tags,
    source: customer.source || 'migrated:customer',
    linkedCustomerId: customerId,
    roles: {
      owner: false,
      seller: false,
      buyer: isBuyer,
      tenant: isTenant,
    },
    buyerProfile: isBuyer ? {
      requirement: customer.requirement,
      budget: customer.budget,
      preferredArea: customer.preferredArea,
      migratedFrom: 'CUSTOMER',
      originalCustomerId: customerId,
    } : null,
    tenantProfile: {
      assignedTo: customer.assignedTo,
      priority: customer.priority,
      migratedFrom: 'CUSTOMER',
      originalCustomerId: customerId,
    },
  };

  return await createOrUpdateContactByPhone(tenantId, contactData);
}

/**
 * Get contact for a property (resolves owner or tenant)
 * Supports both old (ownerId/tenantCustomerId) and new (ownerContactId/tenantContactId) references
 */
export async function getPropertyContacts(tenantId, property) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const result = {
    ownerContact: null,
    tenantContact: null,
  };

  // Try new contact references first (canonical currentOwnerContactId)
  if (property.currentOwnerContactId || property.ownerContactId) {
    result.ownerContact = await getContact(
      tenantId,
      property.currentOwnerContactId || property.ownerContactId,
    );
  } else if (property.ownerId) {
    // Fall back to legacy owner
    const owner = await getOwner(tenantId, property.ownerId);
    if (owner) {
      // Try to find migrated contact
      const contact = await findContactByPhone(tenantId, owner.phone);
      result.ownerContact = contact || {
        ...owner,
        contactId: null,
        roles: { owner: true },
        isLegacyOwner: true,
      };
    }
  }

  if (property.tenantContactId) {
    result.tenantContact = await getContact(tenantId, property.tenantContactId);
  } else if (property.tenantCustomerId) {
    // Fall back to legacy customer
    const customer = await getCustomer(tenantId, property.tenantCustomerId);
    if (customer) {
      // Try to find migrated contact
      const contact = await findContactByPhone(tenantId, customer.phone);
      result.tenantContact = contact || {
        ...customer,
        contactId: null,
        roles: { tenant: true },
        isLegacyCustomer: true,
      };
    }
  }

  return result;
}

// ============== BUYER Operations ==============

export async function createBuyer(tenantId, data) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!data.name || !data.phone) throw new Error('Name and phone are required');
  
  const buyerId = uuidv4();
  const now = new Date().toISOString();
  
  const buyer = {
    PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
    SK: 'PROFILE',
    EntityType: 'BUYER',
    tenantId,
    buyerId,
    
    // Identity
    name: data.name,
    email: data.email || null,
    phone: data.phone,
    address: data.address || '',
    
    // Source & Conversion Tracking
    source: data.source || '', // 'lead:leadId' or 'direct'
    createdFrom: data.createdFrom || null, // 'lead:leadId' if converted from lead
    
    // KYC Documents (MANDATORY for property purchase)
    panNumber: data.panNumber || null,
    panDocS3Key: data.panDocS3Key || null,
    panDocUrl: data.panDocUrl || null,
    aadharNumber: data.aadharNumber || null,
    aadharDocS3Key: data.aadharDocS3Key || null,
    aadharDocUrl: data.aadharDocUrl || null,
    photoS3Key: data.photoS3Key || null,
    photoUrl: data.photoUrl || null,
    
    // Purchase Records (one buyer can purchase multiple properties)
    purchases: data.purchases || [],
    // Each purchase: {
    //   propertyId, purchaseDate, saleAmount, registrationDate, registrationNumber,
    //   saleDeedS3Key, saleDeedUrl, registrationDocS3Key, registrationDocUrl,
    //   stampDutyPaid, registrationCharges, brokeragePaid,
    //   loanDetails: { bankName, loanAmount, loanAccountNumber, sanctionLetterS3Key },
    //   notes
    // }

    // Buyer Requirements
    budget: data.budget || null,
    propertyType: data.propertyType || null,
    preferredArea: data.preferredArea || null,
    requirement: data.requirement || null,
    bhk: data.bhk || null,
    furnishing: data.furnishing || null,
    priority: data.priority || 'medium', // low | medium | high

    // Status & Metadata
    status: data.status || 'active', // active, inactive
    notes: data.notes || '',
    tags: data.tags || [],
    assignedTo: data.assignedTo || null,

    // Timestamps
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy || SERVICE_ACCOUNT_USER,

    // Search index
    GSI3PK: `TENANT#${tenantId}#SEARCH`,
    GSI3SK: `BUYER#${data.name.toLowerCase()}#${data.phone}`,
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: buyer,
  }));

  return buyer;
}

export async function createOrUpdateBuyerByPhone(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!data.phone) {
    throw new Error('Phone number is required');
  }
  
  // Find buyer by phone
  const cleanPhone = data.phone.replace(/\D/g, '');
  const buyersResult = await docClient.send(new ScanCommand({
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'BUYER',
      ':tenantId': tenantId,
    },
  }));
  const buyers = buyersResult.Items || [];
  const existingBuyer = buyers.find(b => {
    const bPhone = (b.phone || '').replace(/\D/g, '');
    return bPhone && bPhone.slice(-10) === cleanPhone.slice(-10);
  }) || null;
  
  if (existingBuyer) {
    const updateData = {};
    Object.keys(data).forEach(key => {
      // Skip system keys that must never be updated
      if (FORBIDDEN_UPDATE_KEYS.has(key)) return;
      if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
        updateData[key] = data[key];
      }
    });
    const updated = await updateBuyer(tenantId, existingBuyer.buyerId, updateData);
    return { ...updated, wasExisting: true };
  } else {
    const created = await createBuyer(tenantId, data);
    return { ...created, wasExisting: false };
  }
}

export async function getBuyers(tenantId, filters = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');

  // Buyers module lists only canonical BUYER entities.
  // Unconverted leads and buyer-role CONTACTs must never appear here.
  let buyers = await collectAllPages(docClient, ScanCommand, {
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'BUYER',
      ':tenantId': tenantId,
    },
  }, { maxPages: 100 });

  // --- Search filter ---
  if (filters.search && filters.search.trim().length >= 2) {
    const q = filters.search.toLowerCase().trim();
    buyers = buyers.filter(b => {
      const nameMatch = b.name?.toLowerCase().includes(q);
      const phoneMatch = b.phone?.replace(/[\s-]/g, '').includes(q.replace(/[\s-]/g, ''));
      const areaMatch = b.preferredArea?.toLowerCase().includes(q);
      const reqMatch = b.requirement?.toLowerCase().includes(q);
      return nameMatch || phoneMatch || areaMatch || reqMatch;
    });
  }

  // --- Exact-match filters ---
  if (filters.status && filters.status !== 'all') {
    buyers = buyers.filter((b) => matchesFilterEnum(b.status, filters.status));
  }
  if (filters.priority && filters.priority !== 'all') {
    buyers = buyers.filter((b) => matchesFilterEnum(b.priority, filters.priority));
  }
  if (filters.propertyType && filters.propertyType !== 'all') {
    buyers = buyers.filter((b) => matchesFilterEnum(b.propertyType, filters.propertyType));
  }
  if (filters.source) {
    buyers = buyers.filter(b => b.source === filters.source);
  }
  if (filters.bhk) {
    buyers = buyers.filter(b => b.bhk === Number(filters.bhk));
  }
  if (filters.furnishing) {
    buyers = buyers.filter(b => b.furnishing === filters.furnishing);
  }
  if (filters.tag) {
    buyers = buyers.filter(b => b.tags?.includes(filters.tag));
  }

  // --- Substring / range filters ---
  if (filters.area) {
    const areaQ = filters.area.toLowerCase();
    buyers = buyers.filter(b => b.preferredArea?.toLowerCase().includes(areaQ));
  }
  if (filters.minBudget) {
    buyers = buyers.filter(b => (b.budget || 0) >= Number(filters.minBudget));
  }
  if (filters.maxBudget) {
    buyers = buyers.filter(b => (b.budget || 0) <= Number(filters.maxBudget));
  }
  if (filters.createdFrom) {
    const from = new Date(filters.createdFrom).getTime();
    buyers = buyers.filter(b => new Date(b.createdAt).getTime() >= from);
  }
  if (filters.createdTo) {
    const to = new Date(filters.createdTo).getTime();
    buyers = buyers.filter(b => new Date(b.createdAt).getTime() <= to);
  }

  // --- Sorting ---
  const sortBy = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
  const sortMap = {
    name: (b) => (b.name || '').toLowerCase(),
    priority: (b) => ({ high: 3, medium: 2, low: 1 }[b.priority] || 0),
    budget: (b) => b.budget || 0,
    propertyType: (b) => (b.propertyType || '').toLowerCase(),
    preferredArea: (b) => (b.preferredArea || '').toLowerCase(),
    status: (b) => (b.status || '').toLowerCase(),
    createdAt: (b) => new Date(b.createdAt).getTime(),
    updatedAt: (b) => new Date(b.updatedAt || b.createdAt).getTime(),
  };
  const getter = sortMap[sortBy] || sortMap.createdAt;
  buyers.sort((a, b) => {
    const av = getter(a);
    const bv = getter(b);
    if (av < bv) return -1 * sortOrder;
    if (av > bv) return 1 * sortOrder;
    return 0;
  });

  // --- Pagination ---
  const total = buyers.length;
  const limit = Math.min(Number(filters.limit) || 50, 200);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  const paginated = buyers.slice(offset, offset + limit);

  return { buyers: paginated, total, limit, offset };
}

export async function getBuyer(tenantId, buyerId) {
  if (!tenantId) throw new Error('Tenant ID is required');

  // 1. Try legacy BUYER entity first
  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
  }));
  if (result.Item) return result.Item;

  // 2. Fallback: check if this ID belongs to a CONTACT with buyer role
  const contactResult = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CONTACT#${buyerId}`,
      SK: 'PROFILE',
    },
  }));
  const contact = contactResult.Item;
  if (contact && contact.roles?.buyer) {
    // Normalize to BUYER-like shape so callers (e.g. markPropertySold) work unchanged
    return {
      ...contact,
      buyerId: contact.contactId,
      budget: contact.buyerProfile?.budget || null,
      propertyType: contact.buyerProfile?.propertyType || null,
      preferredArea: contact.buyerProfile?.preferredArea || null,
      requirement: contact.buyerProfile?.requirement || null,
      priority: contact.buyerProfile?.priority || contact.priority || 'medium',
      bhk: contact.buyerProfile?.bhk || null,
      furnishing: contact.buyerProfile?.furnishing || null,
      isFromContact: true,
    };
  }

  return null;
}

export async function updateBuyer(tenantId, buyerId, data) {
  if (!tenantId) throw new Error('Tenant ID is required');
  rejectForbiddenKeys(data);

  // Detect if this buyerId is a CONTACT-as-buyer or legacy BUYER
  const existing = await getBuyer(tenantId, buyerId);
  if (!existing) throw new Error('Buyer not found');

  // If CONTACT-as-buyer, delegate to updateContact
  if (existing.isFromContact && existing.contactId) {
    const contactData = { ...data };
    // Map legacy buyer fields to contact fields where needed
    if (data.budget !== undefined || data.propertyType !== undefined || data.preferredArea !== undefined || data.requirement !== undefined || data.priority !== undefined) {
      contactData.buyerProfile = {
        ...(existing.buyerProfile || {}),
        ...(data.budget !== undefined && { budget: data.budget }),
        ...(data.propertyType !== undefined && { propertyType: data.propertyType }),
        ...(data.preferredArea !== undefined && { preferredArea: data.preferredArea }),
        ...(data.requirement !== undefined && { requirement: data.requirement }),
        ...(data.priority !== undefined && { priority: data.priority }),
      };
      // Remove top-level keys that belong inside buyerProfile
      delete contactData.budget;
      delete contactData.propertyType;
      delete contactData.preferredArea;
      delete contactData.requirement;
      delete contactData.priority;
    }
    await updateContact(tenantId, existing.contactId, contactData);
    return await getBuyer(tenantId, buyerId);
  }

  // Legacy BUYER entity update
  const updateExpression = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  const updateableFields = [
    'name', 'email', 'phone', 'address',
    'panNumber', 'panDocS3Key', 'panDocUrl',
    'aadharNumber', 'aadharDocS3Key', 'aadharDocUrl',
    'photoS3Key', 'photoUrl',
    'purchases', 'status', 'notes', 'tags', 'source', 'priority',
    'budget', 'propertyType', 'preferredArea', 'requirement'
  ];

  updateableFields.forEach(field => {
    if (data[field] !== undefined) {
      updateExpression.push(`#${field} = :${field}`);
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = data[field];
    }
  });

  if (updateExpression.length === 0) {
    return await getBuyer(tenantId, buyerId);
  }

  updateExpression.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  if (data.updatedBy) {
    updateExpression.push('#updatedBy = :updatedBy');
    expressionAttributeNames['#updatedBy'] = 'updatedBy';
    expressionAttributeValues[':updatedBy'] = data.updatedBy;
  }

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET ${updateExpression.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  }));

  return await getBuyer(tenantId, buyerId);
}

/**
 * Delete a buyer
 * - Legacy BUYER entity: delete the row
 * - CONTACT-as-buyer: remove the buyer role from the contact
 */
/**
 * Archive a buyer (reversible soft-remove) instead of deleting it.
 * Mirrors deleteBuyer's dual-path branching rather than delegating to
 * updateBuyer directly: for a contact-derived buyer, updateBuyer forwards
 * to updateContact, which strips `status` entirely (contacts have no
 * stored status field -- see deriveContactStatus/archiveContact above), so
 * `{status:'inactive'}` would silently no-op there. Turning the buyer role
 * off is the correct, reversible equivalent for that case.
 */
export async function archiveBuyer(tenantId, buyerId) {
  const existing = await getBuyer(tenantId, buyerId);
  if (!existing) {
    throw new Error('Buyer not found');
  }

  if (existing.isFromContact && existing.contactId) {
    await updateContactRole(tenantId, existing.contactId, 'buyer', false);
    return await getBuyer(tenantId, buyerId);
  }

  return updateBuyer(tenantId, buyerId, { status: 'inactive' });
}

export async function deleteBuyer(tenantId, buyerId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const existing = await getBuyer(tenantId, buyerId);
  if (!existing) {
    throw new Error('Buyer not found');
  }

  if (existing.isFromContact && existing.contactId) {
    // Remove the buyer role from the unified contact; do not delete the whole contact
    await updateContactRole(tenantId, existing.contactId, 'buyer', false);
    return true;
  }

  // Legacy BUYER entity
  await docClient.send(new DeleteCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
  }));
  return true;
}

// ============== SELLER Entity REMOVED ==============
// Seller functionality has been replaced by OWNER + PROPERTY listing for sale
// Use createOwner() + createProperty() with status='for-sale' instead

// ============== Cross-Role Phone Lookup ==============

export async function findPersonByPhone(tenantId, phone) {
  if (!tenantId || !phone) return { found: false, roles: [] };
  
  const cleanPhone = phone.replace(/\D/g, '');
  const roles = [];
  
  // Check in BUYER
  const { buyers } = await getBuyers(tenantId);
  const buyer = buyers.find(b => b.phone && b.phone.replace(/\D/g, '') === cleanPhone);
  if (buyer) roles.push({ role: 'buyer', id: buyer.buyerId, data: buyer });
  
  // Check in OWNER
  const { owners } = await getOwners(tenantId);
  const owner = owners.find(o => o.phone && o.phone.replace(/\D/g, '') === cleanPhone);
  if (owner) roles.push({ role: 'owner', id: owner.ownerId, data: owner });
  
  // Check in CUSTOMER (Tenant)
  const { customers } = await getCustomers(tenantId);
  const customer = customers.find(c => c.phone && c.phone.replace(/\D/g, '') === cleanPhone);
  if (customer) roles.push({ role: 'tenant', id: customer.customerId, data: customer });
  
  return {
    found: roles.length > 0,
    roles,
    phone: cleanPhone,
  };
}

/**
 * Resolve "who is this person?" across BOTH the pipeline (leads) and the
 * converted CRM records (buyer / owner / tenant / contact), by name or phone.
 *
 * Why this exists (Phase 3 Slice 3d): every person-shaped entity has two
 * possible forms -- a lead that hasn't converted yet, and a converted record
 * in a different table. The planner used to guess between them from prose
 * rules in its system prompt. This lets it ask instead.
 *
 * Note the difference from findPersonByPhone() above, which this does NOT
 * replace: that one is phone-only and, critically, never looks at leads --
 * so it cannot answer the ambiguous case at all. Left in place because it has
 * its own callers and a different (narrower) contract.
 *
 * Cost note: this fans out across several full-table scans, same as every
 * other search path in this file today (see the TODO(MED-1) at the top). It
 * is a resolver the agent calls occasionally to disambiguate one person, not
 * a list endpoint, so the cost is bounded by how often that ambiguity comes
 * up rather than by traffic.
 *
 * @param {string} tenantId
 * @param {object} filters
 * @param {string} filters.query - a name (partial ok) or a phone number
 * @returns {Promise<{found: boolean, query: string, matchCount: number, matches: Array<object>}>}
 */
export async function findPerson(tenantId, filters = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  const query = String(filters.query ?? '').trim();
  if (!query) return { found: false, query: '', matchCount: 0, matches: [] };

  const digits = query.replace(/\D/g, '');
  // 7+ digits is a phone; shorter runs of digits are far more likely part of
  // a name or a house number than a number someone means to look up.
  const isPhone = digits.length >= 7;
  const nameNeedle = query.toLowerCase();

  const matches = (person, name, phone) => {
    if (isPhone) return String(phone || '').replace(/\D/g, '').includes(digits);
    return String(name || '').toLowerCase().includes(nameNeedle);
  };

  const found = [];
  const push = (recordType, id, name, phone, extra = {}) => {
    found.push({ recordType, id, name: name || null, phone: phone || null, ...extra });
  };

  // Settled so one failing scan cannot take down the whole lookup.
  const [leadsRes, buyersRes, ownersRes, customersRes, contactsRes] = await Promise.allSettled([
    getLeads(tenantId),
    getBuyers(tenantId),
    getOwners(tenantId),
    getCustomers(tenantId),
    getContacts(tenantId),
  ]);

  if (leadsRes.status === 'fulfilled') {
    for (const lead of unwrapLeadsList(leadsRes.value) || []) {
      if (!matches(lead, lead.name, lead.phone)) continue;
      push('lead', lead.leadId, lead.name, lead.phone, {
        leadType: lead.leadType || null,
        status: lead.status || null,
        converted: isLeadConverted(lead),
      });
    }
  }
  if (buyersRes.status === 'fulfilled') {
    for (const b of (buyersRes.value?.buyers || [])) {
      if (matches(b, b.name, b.phone)) push('buyer', b.buyerId, b.name, b.phone, { status: b.status || null });
    }
  }
  if (ownersRes.status === 'fulfilled') {
    for (const o of (ownersRes.value?.owners || [])) {
      if (matches(o, o.name, o.phone)) push('owner', o.ownerId, o.name, o.phone, { status: o.status || null });
    }
  }
  if (customersRes.status === 'fulfilled') {
    for (const c of (customersRes.value?.customers || [])) {
      if (matches(c, c.name, c.phone)) push('tenant', c.customerId, c.name, c.phone, { status: c.status || null });
    }
  }
  if (contactsRes.status === 'fulfilled') {
    const contacts = Array.isArray(contactsRes.value) ? contactsRes.value : (contactsRes.value?.contacts || []);
    for (const ct of contacts) {
      if (matches(ct, ct.name, ct.phone)) push('contact', ct.contactId, ct.name, ct.phone, { roles: ct.roles || null });
    }
  }

  return {
    found: found.length > 0,
    query,
    matchedBy: isPhone ? 'phone' : 'name',
    matchCount: found.length,
    matches: found.slice(0, 10),
  };
}

// ============== Khata (ledger) — read-only agent access ==============
// Re-exported here, not reimplemented: skillInvoker dispatches tools via
// `crmDynamodbService[handlerName]`, so a handler must be reachable as a
// property of this module. The logic lives in khataDynamodbService.js
// (different table, different concern). Read-only by design — see that
// file's header for why no write tool is exposed.
export { searchKhataEntries, getKhataSummary } from './khataDynamodbService.js';

// ============== Notes for Buyers and Sellers ==============

export async function createBuyerNote(tenantId, buyerId, data) {
  if (!tenantId) throw new Error('Tenant ID is required');

  // Detect entity type to use correct PK
  const buyer = await getBuyer(tenantId, buyerId);
  if (!buyer) throw new Error('Buyer not found');

  const isContact = buyer.isFromContact && buyer.contactId;
  const pkId = isContact ? buyer.contactId : buyerId;
  const pkPrefix = isContact ? 'CONTACT' : 'BUYER';

  const noteId = uuidv4();
  const note = {
    PK: `TENANT#${tenantId}#${pkPrefix}#${pkId}`,
    SK: `NOTE#${noteId}`,
    EntityType: 'NOTE',
    tenantId,
    buyerId,
    noteId,
    content: data.content,
    createdBy: data.createdBy || SERVICE_ACCOUNT_USER,
    createdAt: data.createdAt || new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: note,
  }));

  try {
    await logContactActivity(tenantId, {
      activityType: 'note_added',
      subjectEntityType: 'buyer',
      subjectEntityId: buyerId,
      title: 'Note Added (Buyer)',
      description: data.content,
      performedBy: data.createdBy,
      payload: { noteId, content: data.content },
    });
  } catch (err) {
    logger.error('createBuyerNote.logContactActivity.error', { buyerId, error: err.message });
  }

  return note;
}

export async function getBuyerNotes(tenantId, buyerId) {
  if (!tenantId) throw new Error('Tenant ID is required');

  // Detect entity type to query correct PK
  const buyer = await getBuyer(tenantId, buyerId);
  if (!buyer) return [];

  const isContact = buyer.isFromContact && buyer.contactId;
  const pkId = isContact ? buyer.contactId : buyerId;
  const pkPrefix = isContact ? 'CONTACT' : 'BUYER';

  const result = await docClient.send(new QueryCommand({
    TableName: CRM_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#${pkPrefix}#${pkId}`,
      ':sk': 'NOTE#',
    },
  }));

  return (result.Items || []).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// SELLER note functions removed - use OWNER notes instead

// ============== Search Operations ==============

/**
 * Search owners by name or phone
 */
export async function searchOwners(tenantId, query) {
  if (!tenantId) throw new Error('Tenant ID is required');
  // Normalize: if query is an object (from skillInvoker dynamic dispatch), extract 'query' field
  if (query && typeof query === 'object' && !Array.isArray(query)) {
    query = query.query;
  }
  if (query !== undefined && query !== null && typeof query !== 'string') {
    query = String(query);
  }
  if (!query || typeof query !== 'string' || query.trim().length < 2) return [];

  const { owners } = await getOwners(tenantId, { search: query, limit: 20 });
  return owners;
}

/**
 * Search customers/tenants by name or phone
 */
export async function searchCustomers(tenantId, query) {
  if (!tenantId) throw new Error('Tenant ID is required');
  // Normalize: if query is an object (from skillInvoker dynamic dispatch), extract 'query' field
  if (query && typeof query === 'object' && !Array.isArray(query)) {
    query = query.query;
  }
  if (query !== undefined && query !== null && typeof query !== 'string') {
    query = String(query);
  }
  if (!query || typeof query !== 'string' || query.trim().length < 2) return [];
  
  const normalizedQuery = query.toLowerCase().trim();
  const { customers } = await getCustomers(tenantId);
  
  return customers.filter(customer => {
    const nameMatch = customer.name?.toLowerCase().includes(normalizedQuery);
    const phoneMatch = customer.phone?.replace(/[\s-]/g, '').includes(normalizedQuery.replace(/[\s-]/g, ''));
    return nameMatch || phoneMatch;
  }).slice(0, 20);
}

/**
 * Search leads by name or phone
 */
export async function searchLeads(tenantId, query, filters = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');

  // Normalize query: if query is an object (from skillInvoker dynamic dispatch),
  // extract the 'query' field and merge the rest into filters
  if (query && typeof query === 'object' && !Array.isArray(query)) {
    filters = { ...query, ...filters };
    query = query.query;
  }
  // Ensure query is a string or null
  if (query !== undefined && query !== null && typeof query !== 'string') {
    query = String(query);
  }

  const leads = unwrapLeadsList(await getLeads(tenantId));
  let filtered = [...leads];

  // Apply text search if query provided
  if (query && typeof query === 'string' && query.trim().length >= 2) {
    const normalizedQuery = query.toLowerCase().trim();
    const normalizedQueryPhone = normalizedQuery.replace(/[\s-]/g, '');
    filtered = filtered.filter(lead => {
      const nameMatch = lead.name?.toLowerCase().includes(normalizedQuery);
      const phoneMatch = lead.phone?.replace(/[\s-]/g, '').includes(normalizedQueryPhone);
      const emailMatch = lead.email?.toLowerCase().includes(normalizedQuery);
      const notesMatch = lead.notes?.toLowerCase().includes(normalizedQuery);

      // Seller property fields
      const sellerAreaMatch = lead.sellerProperty?.area?.toLowerCase().includes(normalizedQuery);
      const sellerAddressMatch = lead.sellerProperty?.address?.toLowerCase().includes(normalizedQuery);
      const sellerBuildingMatch = lead.sellerProperty?.buildingName?.toLowerCase().includes(normalizedQuery);
      const sellerCityMatch = lead.sellerProperty?.city?.toLowerCase().includes(normalizedQuery);
      const sellerFlatMatch = lead.sellerProperty?.flatNumber?.toLowerCase().includes(normalizedQuery);

      // Buyer requirement fields
      const buyerPreferredAreaMatch = lead.buyerRequirement?.preferredArea?.toLowerCase().includes(normalizedQuery);
      const buyerRequirementMatch = lead.buyerRequirement?.requirement?.toLowerCase().includes(normalizedQuery);
      const buyerPropertyTypeMatch = lead.buyerRequirement?.propertyType?.toLowerCase().includes(normalizedQuery);

      // Owner property fields
      const ownerAreaMatch = lead.ownerProperty?.area?.toLowerCase().includes(normalizedQuery);
      const ownerAddressMatch = lead.ownerProperty?.address?.toLowerCase().includes(normalizedQuery);
      const ownerBuildingMatch = lead.ownerProperty?.buildingName?.toLowerCase().includes(normalizedQuery);
      const ownerCityMatch = lead.ownerProperty?.city?.toLowerCase().includes(normalizedQuery);

      // Tenant requirement fields
      const tenantPreferredAreaMatch = lead.tenantRequirement?.preferredArea?.toLowerCase().includes(normalizedQuery);
      const tenantRequirementMatch = lead.tenantRequirement?.requirement?.toLowerCase().includes(normalizedQuery);

      return nameMatch || phoneMatch || emailMatch || notesMatch ||
        sellerAreaMatch || sellerAddressMatch || sellerBuildingMatch || sellerCityMatch || sellerFlatMatch ||
        buyerPreferredAreaMatch || buyerRequirementMatch || buyerPropertyTypeMatch ||
        ownerAreaMatch || ownerAddressMatch || ownerBuildingMatch || ownerCityMatch ||
        tenantPreferredAreaMatch || tenantRequirementMatch;
    });
  }
  
  // Apply filters (case-insensitive — LLM/UI often send "Qualified"/"Buyer")
  if (filters.leadType && filters.leadType !== 'all') {
    const leadType = String(filters.leadType).toLowerCase();
    filtered = filtered.filter((l) => String(l.leadType || '').toLowerCase() === leadType);
  }
  if (filters.status && filters.status !== 'all') {
    const status = String(filters.status).toLowerCase();
    if (status === 'converted') {
      filtered = filtered.filter((l) => isLeadConverted(l));
    } else {
      filtered = filtered.filter((l) => String(l.status || '').toLowerCase() === status);
      filtered = filtered.filter((l) => !isLeadConverted(l));
    }
  } else {
    filtered = filtered.filter((l) => !isLeadConverted(l));
  }
  if (filters.assignedTo) {
    const assignedTo = String(filters.assignedTo);
    filtered = filtered.filter((l) => l.assignedTo === assignedTo);
  }
  if (filters.temperature && filters.temperature !== 'all') {
    if (filters.temperature === 'unscored') {
      filtered = filtered.filter((l) => !l.score);
    } else {
      const temperature = String(filters.temperature).toLowerCase();
      filtered = filtered.filter((l) => String(l.score || '').toLowerCase() === temperature);
    }
  }

  filtered = applyLeadBudgetRangeFilter(filtered, filters);

  if (filters.area) {
    const areaQuery = String(filters.area).toLowerCase();
    filtered = filtered.filter((l) => {
      const locations = [
        l.buyerRequirement?.preferredArea,
        l.tenantRequirement?.preferredArea,
        l.sellerProperty?.area,
        l.ownerProperty?.area,
        l.sellerProperty?.city,
        l.ownerProperty?.city,
      ].filter(Boolean);
      return locations.some((loc) => loc.toLowerCase().includes(areaQuery));
    });
  }

  const pageLimit = Number(filters.limit);
  const cap = Number.isFinite(pageLimit) && pageLimit > 0 ? pageLimit : 50;
  return filtered.slice(0, cap);
}

/**
 * Search properties by area, name, phone, or owner name with filters
 */
export async function searchProperties(tenantId, query, filters = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');

  // Normalize: if query is an object (from skillInvoker dynamic dispatch), extract 'query' field
  if (query && typeof query === 'object' && !Array.isArray(query)) {
    filters = { ...query, ...filters };
    query = query.query;
  }
  if (query !== undefined && query !== null && typeof query !== 'string') {
    query = String(query);
  }

  const properties = await getPropertiesWithDetails(tenantId);
  let filtered = [...properties];

  // Apply text search if query provided
  if (query && typeof query === 'string' && query.trim().length >= 2) {
    const normalizedQuery = query.toLowerCase().trim();
    filtered = filtered.filter(property => {
      const titleMatch = property.title?.toLowerCase().includes(normalizedQuery);
      const areaMatch = property.area?.toLowerCase().includes(normalizedQuery);
      const buildingMatch = property.buildingName?.toLowerCase().includes(normalizedQuery);
      const addressMatch = property.address?.toLowerCase().includes(normalizedQuery);
      const ownerNameMatch = property.owner?.name?.toLowerCase().includes(normalizedQuery);
      const ownerPhoneMatch = property.owner?.phone?.replace(/[\s-]/g, '').includes(normalizedQuery.replace(/[\s-]/g, ''));
      const tenantNameMatch = property.tenant?.name?.toLowerCase().includes(normalizedQuery);
      return titleMatch || areaMatch || buildingMatch || addressMatch || ownerNameMatch || ownerPhoneMatch || tenantNameMatch;
    });
  }
  
  // Apply filters (case-insensitive — LLM/UI often send Title Case)
  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter((p) => matchesFilterEnum(p.status, filters.status));
  }
  if (filters.propertyType && filters.propertyType !== 'all') {
    filtered = filtered.filter((p) => matchesFilterEnum(p.propertyType, filters.propertyType));
  }
  if (filters.bhk && filters.bhk !== 'all') {
    filtered = filtered.filter((p) => p.bhk === parseInt(filters.bhk, 10));
  }
  if (filters.furnishing && filters.furnishing !== 'all') {
    filtered = filtered.filter((p) => matchesFilterEnum(p.furnishing, filters.furnishing));
  }
  if (filters.minRent) {
    filtered = filtered.filter(p => p.rentAmount >= parseInt(filters.minRent));
  }
  if (filters.maxRent) {
    filtered = filtered.filter(p => p.rentAmount <= parseInt(filters.maxRent));
  }
  
  return filtered.slice(0, 100);
}

/**
 * Search buyers by name or phone
 */
export async function searchBuyers(tenantId, query, filters = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');

  // Normalize: if query is an object (from skillInvoker dynamic dispatch), extract 'query' field
  if (query && typeof query === 'object' && !Array.isArray(query)) {
    filters = { ...query, ...filters };
    query = query.query;
  }
  if (query !== undefined && query !== null && typeof query !== 'string') {
    query = String(query);
  }

  const { buyers } = await getBuyers(tenantId, { ...filters, search: query, limit: 50 });
  return buyers;
}

// searchSellers removed - sellers are now managed as OWNERS with properties listed for sale

// ============== Project Interest for Buyers ==============

export async function addBuyerProjectInterest(tenantId, buyerId, projectInterest) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!buyerId) throw new Error('Buyer ID is required');
  if (!projectInterest.projectId) throw new Error('Project ID is required');

  const buyer = await getBuyer(tenantId, buyerId);
  if (!buyer) throw new Error('Buyer not found');

  const now = new Date().toISOString();
  const interestId = uuidv4();

  const newInterest = {
    interestId,
    projectId: projectInterest.projectId,
    projectName: projectInterest.projectName || '',
    projectSlug: projectInterest.projectSlug || '',
    developerId: projectInterest.developerId || '',
    developerName: projectInterest.developerName || '',
    areaId: projectInterest.areaId || '',
    areaName: projectInterest.areaName || '',
    interestedAt: now,
    preferredUnitType: projectInterest.preferredUnitType || null,
    preferredFloor: projectInterest.preferredFloor || null, // low, mid, high
    budget: projectInterest.budget || null,
    budgetCurrency: projectInterest.budgetCurrency || 'INR',
    notes: projectInterest.notes || '',
    status: projectInterest.status || 'interested', // interested, site-visit-scheduled, site-visit-done, negotiating, booked, dropped
    followUpDate: projectInterest.followUpDate || null,
    lastContactedAt: projectInterest.lastContactedAt || now,
    assignedAgent: projectInterest.assignedAgent || null,
    source: projectInterest.source || 'crm', // crm, website, walk-in, referral
  };

  const interestedProjects = buyer.interestedProjects || [];
  
  // Check if already interested in this project
  const existingIndex = interestedProjects.findIndex(p => p.projectId === projectInterest.projectId);
  if (existingIndex !== -1) {
    // Update existing interest
    interestedProjects[existingIndex] = { ...interestedProjects[existingIndex], ...newInterest, interestId: interestedProjects[existingIndex].interestId };
  } else {
    interestedProjects.push(newInterest);
  }

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET interestedProjects = :projects, updatedAt = :now',
    ExpressionAttributeValues: {
      ':projects': interestedProjects,
      ':now': now,
    },
  }));

  return { ...buyer, interestedProjects };
}

export async function updateBuyerProjectInterest(tenantId, buyerId, projectId, updates) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!buyerId) throw new Error('Buyer ID is required');
  if (!projectId) throw new Error('Project ID is required');
  rejectForbiddenKeys(updates);

  const buyer = await getBuyer(tenantId, buyerId);
  if (!buyer) throw new Error('Buyer not found');

  const interestedProjects = buyer.interestedProjects || [];
  const projectIndex = interestedProjects.findIndex(p => p.projectId === projectId);

  if (projectIndex === -1) {
    throw new Error('Project interest not found for this buyer');
  }

  const now = new Date().toISOString();
  interestedProjects[projectIndex] = {
    ...interestedProjects[projectIndex],
    ...updates,
    lastContactedAt: now,
  };

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET interestedProjects = :projects, updatedAt = :now',
    ExpressionAttributeValues: {
      ':projects': interestedProjects,
      ':now': now,
    },
  }));

  return { ...buyer, interestedProjects };
}

export async function removeBuyerProjectInterest(tenantId, buyerId, projectId) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!buyerId) throw new Error('Buyer ID is required');
  if (!projectId) throw new Error('Project ID is required');

  const buyer = await getBuyer(tenantId, buyerId);
  if (!buyer) throw new Error('Buyer not found');

  const interestedProjects = (buyer.interestedProjects || []).filter(p => p.projectId !== projectId);
  const now = new Date().toISOString();

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET interestedProjects = :projects, updatedAt = :now',
    ExpressionAttributeValues: {
      ':projects': interestedProjects,
      ':now': now,
    },
  }));

  return { ...buyer, interestedProjects };
}

export async function getBuyersByProject(tenantId, projectId) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!projectId) throw new Error('Project ID is required');

  const { buyers } = await getBuyers(tenantId);

  return buyers.filter(buyer => {
    const interestedProjects = buyer.interestedProjects || [];
    return interestedProjects.some(p => p.projectId === projectId);
  });
}

// ============== Property-Project Link ==============

export async function linkPropertyToProject(tenantId, propertyId, projectData) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!propertyId) throw new Error('Property ID is required');
  if (!projectData.projectId) throw new Error('Project ID is required');

  const now = new Date().toISOString();

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET 
      projectId = :projectId,
      projectName = :projectName,
      projectSlug = :projectSlug,
      developerId = :developerId,
      developerName = :developerName,
      unitNumber = :unitNumber,
      tower = :tower,
      floor = :floor,
      marketType = :marketType,
      updatedAt = :now`,
    ExpressionAttributeValues: {
      ':projectId': projectData.projectId,
      ':projectName': projectData.projectName || '',
      ':projectSlug': projectData.projectSlug || '',
      ':developerId': projectData.developerId || '',
      ':developerName': projectData.developerName || '',
      ':unitNumber': projectData.unitNumber || null,
      ':tower': projectData.tower || null,
      ':floor': projectData.floor || null,
      ':marketType': projectData.marketType || 'primary', // primary (off-plan/new), secondary (resale)
      ':now': now,
    },
  }));

  return await getProperty(tenantId, propertyId);
}

export async function unlinkPropertyFromProject(tenantId, propertyId) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!propertyId) throw new Error('Property ID is required');

  const now = new Date().toISOString();

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `REMOVE projectId, projectName, projectSlug, developerId, developerName, unitNumber, tower, floor, marketType SET updatedAt = :now`,
    ExpressionAttributeValues: {
      ':now': now,
    },
  }));

  return await getProperty(tenantId, propertyId);
}

export async function getPropertiesByProject(tenantId, projectId) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!projectId) throw new Error('Project ID is required');

  const result = await docClient.send(new ScanCommand({
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId AND projectId = :projectId',
    ExpressionAttributeValues: {
      ':type': 'PROPERTY',
      ':tenantId': tenantId,
      ':projectId': projectId,
    },
  }));

  return result.Items || [];
}

// ============== UNIFIED CONTACT ACTIVITY TIMELINE ==============

/**
 * Resolve contact ID for any entity (LEAD, OWNER, CUSTOMER/TENANT, BUYER)
 * This ensures that we have a stable contact ID for any entity being acted on.
 */
export async function getContactIdForEntity(tenantId, entityType, entityId) {
  if (!tenantId || !entityType || !entityId) return null;

  const type = entityType.toUpperCase();
  if (type === 'CONTACT') return entityId;

  let phone = null;
  let name = null;
  let email = null;
  let leadType = null;

  try {
    if (type === 'LEAD') {
      // Leads must NOT create or resolve Contacts. Contact/entity creation
      // happens only during successful atomic conversion.
      return null;
    } else if (type === 'OWNER') {
      const owner = await getOwner(tenantId, entityId);
      if (owner?.contactId) {
        const linked = await getContact(tenantId, owner.contactId);
        if (linked) return owner.contactId;
      }
      if (owner) {
        phone = owner.phone;
        name = owner.name;
        email = owner.email;
      }
    } else if (type === 'CUSTOMER' || type === 'TENANT') {
      const customer = await getCustomer(tenantId, entityId);
      if (customer) {
        phone = customer.phone;
        name = customer.name;
        email = customer.email;
      }
    } else if (type === 'BUYER') {
      const buyer = await getBuyer(tenantId, entityId);
      if (buyer) {
        phone = buyer.phone;
        name = buyer.name;
        email = buyer.email;
      }
    }

    if (phone) {
      // Find or create the contact to link all histories
      const contact = await createOrUpdateContactByPhone(tenantId, {
        name: name || 'Unnamed Entity',
        phone,
        email,
        roles: {
          owner: type === 'OWNER' || (type === 'LEAD' && leadType === 'owner'),
          seller: type === 'SELLER' || (type === 'LEAD' && leadType === 'seller'),
          buyer: type === 'BUYER' || (type === 'LEAD' && leadType === 'buyer'),
          tenant: type === 'CUSTOMER' || type === 'TENANT' || (type === 'LEAD' && leadType === 'tenant'),
        },
      });
      return contact?.contactId || null;
    }
  } catch (err) {
    logger.warn('getContactIdForEntity.error', { tenantId, entityType, entityId, error: err.message });
  }

  return null;
}

/**
 * Log a direct activity to a contact's timeline
 */
export async function createContactActivity(tenantId, contactId, data) {
  if (!tenantId || !contactId) {
    throw new Error('Tenant ID and Contact ID are required to log contact activity');
  }

  const activityId = uuidv4();
  const occurredAt = data.occurredAt || new Date().toISOString();
  
  const activity = {
    PK: `TENANT#${tenantId}#CONTACT#${contactId}`,
    SK: `ACTIVITY#${occurredAt}#${activityId}`,
    EntityType: 'CONTACT_ACTIVITY',
    tenantId,
    contactId,
    activityId,
    occurredAt,
    activityType: data.activityType,
    performedBy: data.performedBy || SERVICE_ACCOUNT_USER,
    subjectEntityType: data.subjectEntityType,
    subjectEntityId: data.subjectEntityId,
    subjectEntityName: data.subjectEntityName || '',
    title: data.title,
    description: data.description || '',
    payload: data.payload || {},
    relatedEntityType: data.relatedEntityType || null,
    relatedEntityId: data.relatedEntityId || null,
    relatedEntityName: data.relatedEntityName || null,
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: activity,
  }));

  // Denormalize latest activity onto contact profile for list cards / sorting
  try {
    await docClient.send(new UpdateCommand({
      TableName: CRM_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#CONTACT#${contactId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: 'SET lastActivityAt = :at, lastActivityTitle = :title, lastActivityType = :type, updatedAt = :at',
      ExpressionAttributeValues: {
        ':at': occurredAt,
        ':title': data.title || '',
        ':type': data.activityType || '',
      },
      ConditionExpression: 'attribute_exists(PK)',
    }));
  } catch (err) {
    logger.warn('createContactActivity.profileUpdate.error', { tenantId, contactId, error: err.message });
  }

  return activity;
}

/**
 * Batch-fetch recent activity previews for contact list cards.
 */
export async function getContactActivityPreviews(tenantId, contactIds, limitPerContact = 3) {
  if (!tenantId || !Array.isArray(contactIds) || contactIds.length === 0) {
    return {};
  }

  const uniqueIds = [...new Set(contactIds.filter(Boolean))].slice(0, 100);
  const limit = Math.min(Math.max(Number(limitPerContact) || 3, 1), 10);

  const entries = await Promise.all(uniqueIds.map(async (contactId) => {
    try {
      const result = await docClient.send(new QueryCommand({
        TableName: CRM_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `TENANT#${tenantId}#CONTACT#${contactId}`,
          ':sk': 'ACTIVITY#',
        },
        ScanIndexForward: false,
        Limit: limit,
      }));
      return [contactId, result.Items || []];
    } catch (err) {
      logger.warn('getContactActivityPreviews.error', { tenantId, contactId, error: err.message });
      return [contactId, []];
    }
  }));

  return Object.fromEntries(entries);
}

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function toIsoDateTime(dateStr, endOfDay = false) {
  if (!dateStr) return new Date().toISOString();
  if (String(dateStr).includes('T')) return dateStr;
  return endOfDay ? `${dateStr}T23:59:59.000Z` : `${dateStr}T12:00:00.000Z`;
}

function dedupeTimelineActivities(activities) {
  const semanticWinner = new Map();

  for (const activity of activities) {
    const dateKey = (activity.occurredAt || '').slice(0, 10);
    const propertyId = activity.payload?.propertyId
      || (activity.relatedEntityType === 'property' ? activity.relatedEntityId : '');
    const semanticKey = `${activity.activityType}:${propertyId}:${dateKey}`;
    const isSynthetic = String(activity.activityId || '').startsWith('synthetic-');
    const existing = semanticWinner.get(semanticKey);

    if (!existing) {
      semanticWinner.set(semanticKey, activity);
      continue;
    }

    const existingSynthetic = String(existing.activityId || '').startsWith('synthetic-');
    if (existingSynthetic && !isSynthetic) {
      semanticWinner.set(semanticKey, activity);
    }
  }

  const seen = new Set();
  const result = [];
  for (const activity of activities) {
    const dateKey = (activity.occurredAt || '').slice(0, 10);
    const propertyId = activity.payload?.propertyId
      || (activity.relatedEntityType === 'property' ? activity.relatedEntityId : '');
    const semanticKey = `${activity.activityType}:${propertyId}:${dateKey}`;
    if (semanticWinner.get(semanticKey) !== activity) continue;

    const key = activity.activityId || semanticKey;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(activity);
  }

  return result;
}

function buildRentalTimelineActivities(customer, contactId, tenantId, entityId) {
  const activities = [];
  const rentals = [...(customer.rentalHistory || [])];

  if (customer.currentRental) {
    const alreadyTracked = rentals.some((rental) =>
      rental.propertyId === customer.currentRental.propertyId
      && rental.leaseStartDate === customer.currentRental.leaseStartDate
    );
    if (!alreadyTracked) rentals.push(customer.currentRental);
  }

  rentals.forEach((rental, index) => {
    const propertyId = rental.propertyId;
    if (!propertyId) return;
    const suffix = `${propertyId}-${rental.leaseStartDate || index}`;
    const propertyTitle = rental.propertyTitle || rental.propertyName || null;
    const isActive = !rental.leaseEndDate
      && customer.currentRental?.propertyId === propertyId
      && customer.currentRental?.leaseStartDate === rental.leaseStartDate;

    if (rental.leaseStartDate) {
      activities.push({
        activityId: `synthetic-rental-start-${entityId}-${suffix}`,
        contactId,
        tenantId,
        occurredAt: toIsoDateTime(rental.leaseStartDate),
        activityType: 'rental_started',
        performedBy: rental.recordedBy || SERVICE_ACCOUNT_USER,
        subjectEntityType: 'CUSTOMER',
        subjectEntityId: entityId,
        subjectEntityName: customer.name || '',
        title: propertyTitle ? `Lease started: ${propertyTitle}` : 'Lease started',
        description: rental.monthlyRent
          ? `Monthly rent ₹${Number(rental.monthlyRent).toLocaleString('en-IN')}`
          : 'Tenant moved into property',
        payload: {
          propertyId,
          propertyTitle,
          rent: rental.monthlyRent,
          monthlyRent: rental.monthlyRent,
          deposit: rental.securityDeposit,
          securityDeposit: rental.securityDeposit,
          leaseStartDate: rental.leaseStartDate,
          leaseEndDate: rental.leaseEndDate || null,
          tenantId: entityId,
          active: isActive,
        },
        relatedEntityType: 'property',
        relatedEntityId: propertyId,
        relatedEntityName: propertyTitle,
      });
    }

    if (rental.leaseEndDate) {
      activities.push({
        activityId: `synthetic-rental-end-${entityId}-${suffix}`,
        contactId,
        tenantId,
        occurredAt: toIsoDateTime(rental.leaseEndDate, true),
        activityType: 'rental_ended',
        performedBy: rental.recordedBy || SERVICE_ACCOUNT_USER,
        subjectEntityType: 'CUSTOMER',
        subjectEntityId: entityId,
        subjectEntityName: customer.name || '',
        title: propertyTitle ? `Lease ended: ${propertyTitle}` : 'Lease ended',
        description: 'Tenant vacated the property',
        payload: {
          propertyId,
          propertyTitle,
          rent: rental.monthlyRent,
          monthlyRent: rental.monthlyRent,
          deposit: rental.securityDeposit,
          leaseStartDate: rental.leaseStartDate,
          leaseEndDate: rental.leaseEndDate,
          tenantId: entityId,
        },
        relatedEntityType: 'property',
        relatedEntityId: propertyId,
        relatedEntityName: propertyTitle,
      });
    }
  });

  return activities;
}

function buildPurchaseTimelineActivities(purchases, contactId, tenantId, entityId, entityType, entityName) {
  const activities = [];
  (purchases || []).forEach((purchase, index) => {
    const propertyId = purchase.propertyId;
    if (!propertyId) return;
    const propertyTitle = purchase.propertyTitle || purchase.propertyName || purchase.title || null;
    const saleAmount = purchase.saleAmount ?? purchase.soldPrice ?? purchase.purchasePrice ?? null;
    const occurredAt = purchase.purchaseDate || purchase.saleDate || purchase.recordedAt || new Date().toISOString();
    const sellerName = purchase.sellerName || purchase.fromOwnerName || purchase.seller || null;
    const amountText = saleAmount != null
      ? `₹${Number(saleAmount).toLocaleString('en-IN')}`
      : null;

    activities.push({
      activityId: `synthetic-purchase-${entityId}-${propertyId}-${occurredAt}-${index}`,
      contactId,
      tenantId,
      occurredAt: toIsoDateTime(occurredAt),
      activityType: 'purchase_recorded',
      performedBy: purchase.recordedBy || SERVICE_ACCOUNT_USER,
      subjectEntityType: entityType,
      subjectEntityId: entityId,
      subjectEntityName: entityName || '',
      title: propertyTitle ? `Purchased ${propertyTitle}` : 'Purchased a property',
      description: [
        amountText ? `at ${amountText}` : null,
        sellerName ? `from ${sellerName}` : null,
      ].filter(Boolean).join(' · ') || 'Purchase recorded',
      payload: {
        propertyId,
        propertyTitle,
        soldPrice: saleAmount,
        saleAmount,
        purchaseDate: occurredAt,
        buyerId: entityType === 'BUYER' ? entityId : purchase.buyerId || null,
        buyerName: entityName || null,
        sellerName,
        fromOwnerName: sellerName,
        saleTransactionId: purchase.saleTransactionId || null,
      },
      relatedEntityType: 'property',
      relatedEntityId: propertyId,
      relatedEntityName: propertyTitle,
    });
  });
  return activities;
}

async function enrichTimelinePropertyTitles(tenantId, activities) {
  const propertyIds = new Set();
  for (const activity of activities) {
    const propertyId = activity.payload?.propertyId
      || (activity.relatedEntityType === 'property' ? activity.relatedEntityId : null);
    if (!propertyId) continue;
    const needsTitle = !activity.payload?.propertyTitle && !activity.relatedEntityName;
    const needsSaleParties = ['property_sold', 'purchase_recorded', 'ownership_changed'].includes(activity.activityType)
      && (!activity.payload?.buyerName || !activity.payload?.sellerName || activity.payload?.soldPrice == null);
    if (needsTitle || needsSaleParties) {
      propertyIds.add(propertyId);
    }
  }

  if (propertyIds.size === 0) return activities;

  const propertyById = {};
  await Promise.all([...propertyIds].map(async (propertyId) => {
    try {
      const property = await getProperty(tenantId, propertyId);
      if (property) propertyById[propertyId] = property;
    } catch (err) {
      logger.warn('enrichTimelinePropertyTitles.error', { tenantId, propertyId, error: err.message });
    }
  }));

  return activities.map((activity) => {
    const propertyId = activity.payload?.propertyId
      || (activity.relatedEntityType === 'property' ? activity.relatedEntityId : null);
    const property = propertyId ? propertyById[propertyId] : null;
    if (!property) return activity;

    const history = Array.isArray(property.ownershipHistory) ? property.ownershipHistory : [];
    const saleTxnId = activity.payload?.saleTransactionId;
    let historyEntry = null;
    if (saleTxnId) {
      historyEntry = history.find((entry) => entry.saleTransactionId === saleTxnId) || null;
    }
    if (!historyEntry && history.length > 0) {
      // Prefer entry matching activity date (same day), else latest
      const activityDay = String(activity.occurredAt || '').slice(0, 10);
      historyEntry = history.find((entry) => String(entry.saleDate || '').slice(0, 10) === activityDay)
        || history[history.length - 1];
    }

    const propertyTitle = activity.payload?.propertyTitle || property.title || null;
    const soldPrice = activity.payload?.soldPrice
      ?? activity.payload?.saleAmount
      ?? historyEntry?.salePrice
      ?? property.saleInfo?.soldPrice
      ?? null;
    const sellerName = activity.payload?.sellerName
      || activity.payload?.fromOwnerName
      || historyEntry?.fromOwnerName
      || null;
    const buyerName = activity.payload?.buyerName
      || activity.payload?.toOwnerName
      || historyEntry?.toOwnerName
      || null;

    return {
      ...activity,
      relatedEntityName: activity.relatedEntityName || propertyTitle,
      payload: {
        ...(activity.payload || {}),
        propertyTitle,
        soldPrice: soldPrice != null ? soldPrice : activity.payload?.soldPrice,
        saleAmount: soldPrice != null ? soldPrice : activity.payload?.saleAmount,
        sellerName: sellerName || activity.payload?.sellerName || null,
        buyerName: buyerName || activity.payload?.buyerName || null,
        fromOwnerName: sellerName || activity.payload?.fromOwnerName || null,
        toOwnerName: buyerName || activity.payload?.toOwnerName || null,
        sellerContactId: activity.payload?.sellerContactId || historyEntry?.sellerContactId || historyEntry?.fromContactId || null,
        buyerContactId: activity.payload?.buyerContactId || historyEntry?.buyerContactId || historyEntry?.toContactId || null,
        buyerId: activity.payload?.buyerId || historyEntry?.buyerId || null,
      },
    };
  });
}

async function mergeContactProfileTimeline(tenantId, contactId, activities) {
  let merged = [...activities];
  try {
    const contact = await getContact(tenantId, contactId);
    if (!contact) return merged;

    if (Array.isArray(contact.purchaseHistory) && contact.purchaseHistory.length > 0) {
      merged.push(...buildPurchaseTimelineActivities(
        contact.purchaseHistory,
        contactId,
        tenantId,
        contactId,
        'CONTACT',
        contact.name
      ));
    }

    if (contact.phone) {
      const phoneDigits = normalizePhoneDigits(contact.phone);
      const customers = await getCustomers(tenantId);
      const matchingCustomers = customers.filter((customer) =>
        normalizePhoneDigits(customer.phone) === phoneDigits
      );
      for (const customer of matchingCustomers) {
        merged.push(...buildRentalTimelineActivities(customer, contactId, tenantId, customer.customerId));
      }
    }
  } catch (err) {
    logger.warn('mergeContactProfileTimeline.error', { tenantId, contactId, error: err.message });
  }
  return merged;
}

async function mergeEntityTimeline(tenantId, contactId, entityType, entityId, activities) {
  const type = String(entityType).toUpperCase();
  let merged = [...activities];

  try {
    if (type === 'CUSTOMER' || type === 'TENANT') {
      const customer = await getCustomer(tenantId, entityId);
      if (customer) {
        merged.push(...buildRentalTimelineActivities(customer, contactId, tenantId, entityId));
      }
    } else if (type === 'BUYER') {
      const buyer = await getBuyer(tenantId, entityId);
      if (buyer) {
        const purchases = buyer.purchases || buyer.purchaseHistory || [];
        merged.push(...buildPurchaseTimelineActivities(
          purchases,
          contactId,
          tenantId,
          entityId,
          type,
          buyer.name
        ));
      }
    } else if (type === 'CONTACT') {
      merged = await mergeContactProfileTimeline(tenantId, entityId, merged);
    } else if (type === 'OWNER') {
      const owner = await getOwner(tenantId, entityId);
      if (owner?.contactId && owner.contactId !== contactId) {
        // Owner timeline already uses contact activities; no extra merge needed.
      }
    }
  } catch (err) {
    logger.warn('mergeEntityTimeline.error', { tenantId, entityType, entityId, error: err.message });
  }

  return merged;
}

/**
 * Get all timeline activity for a given contact (sorted newest first).
 * Optionally merges in notes and meetings for the source entity so the
 * Unified Activity Timeline is always useful even when explicit activity
 * logging did not run.
 */
export async function getContactActivityTimeline(tenantId, contactId, entityType = null, entityId = null) {
  if (!tenantId || !contactId) {
    throw new Error('Tenant ID and Contact ID are required');
  }

  const result = await docClient.send(new QueryCommand({
    TableName: CRM_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#CONTACT#${contactId}`,
      ':sk': 'ACTIVITY#',
    },
    ScanIndexForward: false, // newest first
  }));

  const activities = result.Items || [];

  let combined = [...activities];

  if (!entityType || !entityId) {
    combined = await mergeContactProfileTimeline(tenantId, contactId, combined);
  } else {
    const type = String(entityType).toUpperCase();
    let notes = [];
    try {
      if (type === 'CONTACT') {
        notes = await getContactNotes(tenantId, entityId);
      } else if (type === 'OWNER') {
        notes = await getOwnerNotes(tenantId, entityId);
      } else if (type === 'BUYER') {
        notes = await getBuyerNotes(tenantId, entityId);
      } else if (type === 'CUSTOMER' || type === 'TENANT') {
        notes = await getCustomerNotes(tenantId, entityId);
      } else if (type === 'LEAD') {
        notes = await getLeadNotes(tenantId, entityId);
      }
    } catch (err) {
      logger.warn('getContactActivityTimeline.notes.error', { tenantId, entityType, entityId, error: err.message });
    }

    let meetings = [];
    try {
      meetings = await getMeetingsByEntity(tenantId, entityType, entityId);
    } catch (err) {
      logger.warn('getContactActivityTimeline.meetings.error', { tenantId, entityType, entityId, error: err.message });
    }

    const noteActivities = notes.map(note => ({
      activityId: `note-${note.noteId}`,
      contactId,
      tenantId,
      occurredAt: note.createdAt || note.updatedAt || new Date().toISOString(),
      activityType: 'note_added',
      performedBy: note.createdBy || SERVICE_ACCOUNT_USER,
      subjectEntityType: type,
      subjectEntityId: entityId,
      subjectEntityName: '',
      title: 'Note Added',
      description: note.content,
      payload: { noteId: note.noteId },
      relatedEntityType: null,
      relatedEntityId: null,
      relatedEntityName: null,
    }));

    const meetingActivities = meetings.map(meeting => {
      const isCompleted = meeting.status === 'completed';
      const isCancelled = meeting.status === 'cancelled';
      return {
        activityId: `meeting-${meeting.meetingId}`,
        contactId,
        tenantId,
        occurredAt: meeting.createdAt || meeting.updatedAt || new Date().toISOString(),
        activityType: isCompleted ? 'meeting_completed' : isCancelled ? 'meeting_cancelled' : 'meeting_scheduled',
        performedBy: meeting.createdBy || SERVICE_ACCOUNT_USER,
        subjectEntityType: type,
        subjectEntityId: entityId,
        subjectEntityName: meeting.relatedEntityName || '',
        title: `${meeting.title} (${meeting.status || 'scheduled'})`,
        description: `Location: ${meeting.location || 'N/A'}${meeting.notes ? `\nNotes: ${meeting.notes}` : ''}`,
        payload: { meetingId: meeting.meetingId, meetingDate: meeting.meetingDate, meetingTime: meeting.meetingTime },
        relatedEntityType: meeting.relatedEntityType || null,
        relatedEntityId: meeting.relatedEntityId || null,
        relatedEntityName: meeting.relatedEntityName || null,
      };
    });

    combined = [...combined, ...noteActivities, ...meetingActivities];
    combined = await mergeEntityTimeline(tenantId, contactId, entityType, entityId, combined);
  }

  combined = dedupeTimelineActivities(combined);
  combined.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  combined = await enrichTimelinePropertyTitles(tenantId, combined);

  return combined;
}

/**
 * Log activity for any entity type. The contact is dynamically resolved.
 */
export async function logContactActivity(tenantId, data) {
  try {
    const contactId = await getContactIdForEntity(tenantId, data.subjectEntityType, data.subjectEntityId);
    if (contactId) {
      return await createContactActivity(tenantId, contactId, data);
    } else {
      logger.warn('logContactActivity.no_contact_resolved', { tenantId, subjectEntityType: data.subjectEntityType, subjectEntityId: data.subjectEntityId });
    }
  } catch (error) {
    logger.error('logContactActivity.error', { tenantId, subjectEntityId: data.subjectEntityId, error: error.message });
  }
  return null;
}

// ════════════════════════════════════════════════════════════════════════════════
// BUSINESS INSIGHT & SUMMARY TOOLS (Layer 2 + Layer 3)
//
// These sit on top of the CRUD tools. They return small, intent-focused
// aggregates so the LLM can *curate* a 3-layer WhatsApp reply
// (answer → context → next action) instead of dumping raw rows.
// Each returns a plain object; skillInvoker wraps it as { ok, data }.
// ════════════════════════════════════════════════════════════════════════════════

const LEAD_ACTIVE_STATUSES = ['new', 'contacted', 'qualified', 'negotiating'];
const LEAD_CLOSED_STATUSES = ['converted', 'lost'];

function _leadBudget(lead) {
  return Number(
    lead.buyerRequirement?.budget ||
    lead.tenantRequirement?.budget ||
    lead.sellerProperty?.expectedPrice ||
    lead.ownerProperty?.rentExpected ||
    0
  ) || 0;
}

function _leadArea(lead) {
  return (
    lead.buyerRequirement?.preferredArea ||
    lead.tenantRequirement?.preferredArea ||
    lead.sellerProperty?.area ||
    lead.ownerProperty?.area ||
    lead.sellerProperty?.city ||
    lead.ownerProperty?.city ||
    null
  );
}

function _leadLastTouch(lead) {
  return lead.lastActivityAt || lead.lastInteractionAt || lead.updatedAt || lead.createdAt || null;
}

function _daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return Infinity;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function _isActiveLead(lead) {
  if (isLeadConverted(lead)) return false;
  const s = (lead.status || 'new').toLowerCase();
  // Incomplete conversion ghosts should still be actionable
  if (s === 'converted' && !hasLeadConversionTarget(lead)) return true;
  return !LEAD_CLOSED_STATUSES.includes(s);
}

function _countBy(items, keyFn) {
  const out = {};
  for (const it of items) {
    const k = keyFn(it);
    if (k === undefined || k === null || k === '') continue;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/**
 * Layer 2 — Lead counts by type/status/temperature. Answers "how many leads",
 * "leads breakdown", "kitni leads hain".
 */
export async function getLeadsSummary(tenantId, filters = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  const leads = unwrapLeadsList(await getLeads(tenantId, filters || {}));

  const byType = { buyer: 0, seller: 0, tenant: 0, owner: 0 };
  const byStatus = { new: 0, contacted: 0, qualified: 0, negotiating: 0, converted: 0, lost: 0 };
  const byTemperature = { hot: 0, warm: 0, cold: 0, unscored: 0 };
  let unassigned = 0;

  for (const l of leads) {
    const type = (l.leadType || '').toLowerCase();
    if (byType[type] !== undefined) byType[type] += 1;
    const status = (l.status || 'new').toLowerCase();
    if (byStatus[status] !== undefined) byStatus[status] += 1;
    const temperature = l.score ? String(l.score).toLowerCase() : 'unscored';
    if (byTemperature[temperature] !== undefined) byTemperature[temperature] += 1;
    if (!l.assignedTo) unassigned += 1;
  }

  const active = leads.filter(_isActiveLead).length;

  return {
    total: leads.length,
    active,
    byType,
    byStatus,
    byTemperature,
    unassigned,
  };
}

/**
 * Layer 2 — Property inventory snapshot. Answers "how many properties",
 * "inventory status", "kitni properties available hain".
 */
export async function getPropertiesSummary(tenantId, filters = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  const { properties } = await getProperties(tenantId, filters || {});

  const isAvailable = (p) => ['for-sale', 'for-rent'].includes((p.status || '').toLowerCase());

  return {
    total: properties.length,
    available: properties.filter(isAvailable).length,
    onHold: properties.filter(p => p.status === 'on-hold').length,
    rented: properties.filter(p => p.status === 'rented').length,
    sold: properties.filter(p => p.status === 'sold').length,
    agreementsPending: properties.filter(p => p.agreementStatus === 'pending').length,
    verificationsPending: properties.filter(p => p.verificationStatus === 'pending').length,
    byType: _countBy(properties, p => (p.propertyType || '').toLowerCase() || null),
  };
}

/**
 * Layer 2 — Buyer demand snapshot.
 */
export async function getBuyersSummary(tenantId, filters = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  const { buyers } = await getBuyers(tenantId, { ...(filters || {}), limit: 1000 });

  const budgets = buyers.map(b => Number(b.budget || b.buyerRequirement?.budget || 0)).filter(v => v > 0);
  const avgBudget = budgets.length ? Math.round(budgets.reduce((a, b) => a + b, 0) / budgets.length) : 0;

  return {
    total: buyers.length,
    active: buyers.filter(b => (b.status || 'active') === 'active').length,
    highPriority: buyers.filter(b => (b.priority || '').toLowerCase() === 'high').length,
    avgBudget,
    byPriority: _countBy(buyers, b => (b.priority || 'medium').toLowerCase()),
  };
}

/**
 * Layer 3 — What needs follow-up. Combines stale active leads (overdue) with
 * scheduled meetings for today/tomorrow. Answers "follow-ups", "kise call karna hai".
 */
export async function getFollowupSummary(tenantId, opts = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  const staleDays = Number(opts?.staleDays) > 0 ? Number(opts.staleDays) : 5;

  const [leadsResult, meetings] = await Promise.all([
    getLeads(tenantId, {}),
    getUpcomingMeetings(tenantId, 2).catch(() => []),
  ]);
  const leads = unwrapLeadsList(leadsResult);

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const overdueLeads = leads
    .filter(_isActiveLead)
    .map(l => ({ lead: l, days: _daysSince(_leadLastTouch(l)) }))
    .filter(x => x.days >= staleDays)
    .sort((a, b) => b.days - a.days || _leadBudget(b.lead) - _leadBudget(a.lead));

  const meetingsToday = (meetings || []).filter(m => (m.meetingDate || '').startsWith(todayStr));
  const meetingsTomorrow = (meetings || []).filter(m => (m.meetingDate || '').startsWith(tomorrowStr));

  return {
    staleDays,
    overdueCount: overdueLeads.length,
    meetingsTodayCount: meetingsToday.length,
    meetingsTomorrowCount: meetingsTomorrow.length,
    overdueLeads: overdueLeads.slice(0, 5).map(x => ({
      leadId: x.lead.leadId,
      name: x.lead.name,
      phone: x.lead.phone,
      leadType: x.lead.leadType,
      status: x.lead.status,
      daysSinceContact: x.days === Infinity ? null : x.days,
      budget: _leadBudget(x.lead) || null,
      area: _leadArea(x.lead),
    })),
    meetingsToday: meetingsToday.slice(0, 5).map(m => ({ meetingId: m.meetingId, title: m.title, meetingDate: m.meetingDate })),
  };
}

/**
 * Layer 2 — Sales pipeline funnel. Answers "pipeline", "funnel", "conversion rate".
 */
export async function getPipelineSummary(tenantId) {
  if (!tenantId) throw new Error('Tenant ID is required');
  const leads = unwrapLeadsList(await getLeads(tenantId, {}));

  const stage = { new: 0, contacted: 0, qualified: 0, negotiating: 0, converted: 0, lost: 0 };
  for (const l of leads) {
    const s = (l.status || 'new').toLowerCase();
    if (stage[s] !== undefined) stage[s] += 1;
  }

  const closed = stage.converted + stage.lost;
  const conversionRate = closed > 0 ? Math.round((stage.converted / closed) * 100) : 0;

  return {
    total: leads.length,
    stages: stage,
    activeInPipeline: stage.new + stage.contacted + stage.qualified + stage.negotiating,
    conversionRate,
  };
}

/**
 * Layer 3 — Ranked leads to act on now, each with a human reason.
 * Answers "who should I call", "priority leads", "hot leads", "aaj kise call karu".
 */
export async function getPriorityLeads(tenantId, opts = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  const limit = Number(opts?.limit) > 0 ? Number(opts.limit) : 5;
  const leads = unwrapLeadsList(await getLeads(tenantId, {})).filter(_isActiveLead);

  const scored = leads.map(l => {
    const budget = _leadBudget(l);
    const days = _daysSince(_leadLastTouch(l));
    const temperature = (l.score || '').toLowerCase(); // 'hot' | 'warm' | 'cold' | '' (unscored)
    const status = (l.status || 'new').toLowerCase();

    let rankScore = 0;
    if (budget >= 20000000) rankScore += 40; else if (budget >= 10000000) rankScore += 30; else if (budget >= 5000000) rankScore += 20; else if (budget > 0) rankScore += 10;
    if (temperature === 'hot') rankScore += 30; else if (temperature === 'warm') rankScore += 12;
    if (status === 'negotiating') rankScore += 20; else if (status === 'qualified') rankScore += 15; else if (status === 'contacted') rankScore += 5;
    if (days >= 7) rankScore += 20; else if (days >= 5) rankScore += 12; else if (days >= 3) rankScore += 6;

    const reasonParts = [];
    if (budget >= 10000000) reasonParts.push('high budget');
    if (temperature === 'hot') reasonParts.push('qualified HOT');
    if (status === 'negotiating' || status === 'qualified') reasonParts.push(`in ${status}`);
    if (days >= 5) reasonParts.push(`no contact in ${days === Infinity ? '15+' : days} days`);
    const reason = reasonParts.length ? reasonParts.join(', ') : 'needs first touch';

    return {
      leadId: l.leadId,
      name: l.name,
      phone: l.phone,
      leadType: l.leadType,
      status: l.status,
      temperature: l.score || null,
      scoreValue: typeof l.scoreValue === 'number' ? l.scoreValue : null,
      budget: budget || null,
      area: _leadArea(l),
      daysSinceContact: days === Infinity ? null : days,
      score: rankScore,
      reason,
    };
  });

  scored.sort((a, b) => b.score - a.score || (b.budget || 0) - (a.budget || 0));
  return { total: scored.length, items: scored.slice(0, limit) };
}

/**
 * Layer 3 — What happened recently. Answers "recent activity", "kya naya hua",
 * "yesterday's activity".
 */
export async function getRecentActivity(tenantId, opts = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  const days = Number(opts?.days) > 0 ? Number(opts.days) : 7;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffTs = cutoff.getTime();

  const within = (d) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    return !Number.isNaN(t) && t >= cutoffTs;
  };

  const [leadsResult, properties, meetings] = await Promise.all([
    getLeads(tenantId, {}),
    getProperties(tenantId, {}),
    getMeetings(tenantId, {}).catch(() => []),
  ]);
  const leads = unwrapLeadsList(leadsResult);
  const propertyList = properties?.properties ?? (Array.isArray(properties) ? properties : []);

  const newLeads = leads.filter(l => within(l.createdAt));
  const newProperties = propertyList.filter(p => within(p.createdAt));
  const meetingsCompleted = (meetings || []).filter(m => m.status === 'completed' && within(m.updatedAt || m.meetingDate));
  const convertedLeads = leads.filter((l) => isLeadConverted(l) && within(l.convertedAt || l.updatedAt));

  return {
    periodDays: days,
    newLeads: newLeads.length,
    newProperties: newProperties.length,
    meetingsCompleted: meetingsCompleted.length,
    conversions: convertedLeads.length,
    recentLeads: newLeads
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(l => ({ leadId: l.leadId, name: l.name, leadType: l.leadType, createdAt: l.createdAt })),
  };
}

/**
 * Layer 3 — Morning brief. Answers "good morning", "daily brief", "aaj ka plan".
 */
export async function getDailyBrief(tenantId) {
  if (!tenantId) throw new Error('Tenant ID is required');

  const [leadsResult, meetings, propsSummary, priority] = await Promise.all([
    getLeads(tenantId, {}),
    getUpcomingMeetings(tenantId, 2).catch(() => []),
    getPropertiesSummary(tenantId).catch(() => ({ agreementsPending: 0, verificationsPending: 0 })),
    getPriorityLeads(tenantId, { limit: 3 }).catch(() => ({ items: [] })),
  ]);
  const leads = unwrapLeadsList(leadsResult);

  const todayStr = new Date().toISOString().split('T')[0];
  const newLeadsToday = leads.filter(l => (l.createdAt || '').startsWith(todayStr)).length;
  const meetingsToday = (meetings || []).filter(m => (m.meetingDate || '').startsWith(todayStr));

  const overdue = leads
    .filter(_isActiveLead)
    .filter(l => _daysSince(_leadLastTouch(l)) >= 5).length;

  return {
    newLeadsToday,
    meetingsTodayCount: meetingsToday.length,
    overdueFollowups: overdue,
    pendingAgreements: propsSummary.agreementsPending || 0,
    pendingVerifications: propsSummary.verificationsPending || 0,
    hotLeads: (priority.items || []).map(p => ({ leadId: p.leadId, name: p.name, budget: p.budget, reason: p.reason })),
    meetingsToday: meetingsToday.slice(0, 5).map(m => ({ meetingId: m.meetingId, title: m.title, meetingDate: m.meetingDate })),
  };
}

/**
 * Layer 3 — Concrete next actions the agent should take now, prioritised.
 * Answers "what should I do today", "next actions", "kya karu aaj".
 */
export async function suggestNextActions(tenantId, opts = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  const limit = Number(opts?.limit) > 0 ? Number(opts.limit) : 5;

  const [priority, followup, props] = await Promise.all([
    getPriorityLeads(tenantId, { limit: 5 }).catch(() => ({ items: [] })),
    getFollowupSummary(tenantId, {}).catch(() => ({ meetingsToday: [] })),
    getPropertiesSummary(tenantId).catch(() => ({ agreementsPending: 0, verificationsPending: 0 })),
  ]);

  const actions = [];

  for (const m of (followup.meetingsToday || [])) {
    actions.push({ action: `Attend meeting: ${m.title || 'Untitled'}`, entityType: 'meeting', entityId: m.meetingId, reason: 'Scheduled today', priority: 'high' });
  }
  for (const l of (priority.items || [])) {
    actions.push({ action: `Call ${l.name}`, entityType: 'lead', entityId: l.leadId, reason: l.reason, priority: l.score >= 50 ? 'high' : 'medium' });
  }
  if (props.agreementsPending > 0) {
    actions.push({ action: `Progress ${props.agreementsPending} pending agreement(s)`, entityType: 'property', entityId: null, reason: 'Agreements awaiting completion', priority: 'medium' });
  }
  if (props.verificationsPending > 0) {
    actions.push({ action: `Complete ${props.verificationsPending} pending verification(s)`, entityType: 'property', entityId: null, reason: 'Verifications pending', priority: 'low' });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  actions.sort((a, b) => rank[a.priority] - rank[b.priority]);

  return { total: actions.length, actions: actions.slice(0, limit) };
}

/**
 * Layer 3 — Business health with simple 7d-over-7d trends. Answers
 * "business health", "how are we doing", "business kaisa chal raha hai".
 */
export async function getBusinessHealth(tenantId) {
  if (!tenantId) throw new Error('Tenant ID is required');
  const leads = unwrapLeadsList(await getLeads(tenantId, {}));

  const now = Date.now();
  const day = 1000 * 60 * 60 * 24;
  const inRange = (d, startAgo, endAgo) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) return false;
    return t >= now - startAgo * day && t < now - endAgo * day;
  };

  const inflow7d = leads.filter(l => inRange(l.createdAt, 7, 0)).length;
  const inflowPrev7d = leads.filter(l => inRange(l.createdAt, 14, 7)).length;
  const conversions30d = leads.filter(l => inRange(l.convertedAt, 30, 0)).length;
  const pendingFollowups = leads.filter(_isActiveLead).filter(l => _daysSince(_leadLastTouch(l)) >= 5).length;

  const trend = (cur, prev) => (cur > prev ? 'up' : cur < prev ? 'down' : 'flat');

  const alerts = [];
  if (pendingFollowups > 0) alerts.push(`${pendingFollowups} follow-ups overdue`);
  if (inflow7d < inflowPrev7d) alerts.push('Lead inflow is down vs last week');

  return {
    leadInflow7d: inflow7d,
    leadInflowPrev7d: inflowPrev7d,
    inflowTrend: trend(inflow7d, inflowPrev7d),
    conversions30d,
    pendingFollowups,
    alerts,
  };
}

/**
 * Layer 3 — Full one-shot overview combining the key summaries. Answers
 * "dashboard", "overview", "full summary", "sab kuch dikhao".
 */
export async function getDashboardSnapshot(tenantId) {
  if (!tenantId) throw new Error('Tenant ID is required');

  const [leadsSummary, propertiesSummary, pipeline, followup, priority] = await Promise.all([
    getLeadsSummary(tenantId).catch(() => null),
    getPropertiesSummary(tenantId).catch(() => null),
    getPipelineSummary(tenantId).catch(() => null),
    getFollowupSummary(tenantId, {}).catch(() => null),
    getPriorityLeads(tenantId, { limit: 3 }).catch(() => ({ items: [] })),
  ]);

  return {
    leads: leadsSummary,
    properties: propertiesSummary,
    pipeline,
    followups: followup ? {
      overdue: followup.overdueCount,
      meetingsToday: followup.meetingsTodayCount,
      meetingsTomorrow: followup.meetingsTomorrowCount,
    } : null,
    topPriority: (priority.items || []).map(p => ({ name: p.name, budget: p.budget, reason: p.reason })),
  };
}

export { docClient, CRM_TABLE_NAME };

export default docClient;
