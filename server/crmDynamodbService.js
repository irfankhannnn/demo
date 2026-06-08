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
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getOrCreateArea, incrementAreaPropertyCount } from './areasDynamodbService.js';
import { logger } from './logger.js';
import { scheduleMeetingReminder, cancelMeetingReminder } from './notificationDynamodbService.js';
import { wrapAwsClient } from './awsClientWrapper.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables from server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const REGION = process.env.AWS_REGION || 'ap-south-1';
const CRM_TABLE_NAME = process.env.CRM_DYNAMODB_TABLE_NAME;

if (!CRM_TABLE_NAME) {
  throw new Error('CRM_DYNAMODB_TABLE_NAME is not set. Please configure it in server/.env');
}

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: CRM_TABLE_NAME });
const docClient = DynamoDBDocumentClient.from(client);

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
    
    // Timestamps
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy || 'System',
    
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

export async function getCustomers(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const result = await docClient.send(new ScanCommand({
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'CUSTOMER',
      ':tenantId': tenantId,
    },
  }));
  return result.Items || [];
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

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));

  return await getCustomer(tenantId, customerId);
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
    createdBy: data.createdBy || 'system',
    createdAt: data.createdAt || new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: note,
  }));

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
        createdBy: 'System',
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
    createdBy: data.createdBy || 'system',
    createdAt: data.createdAt || new Date().toISOString(),
  };
  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: note,
  }));
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
        createdBy: 'System',
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
  if (!phone) {
    return null;
  }
  
  // Normalize phone number (remove spaces, dashes)
  const normalizedPhone = phone.replace(/[\s-]/g, '');
  
  const owners = await getOwners(tenantId);
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
  if (!phone) {
    return null;
  }
  
  // Normalize phone number (remove spaces, dashes)
  const normalizedPhone = phone.replace(/[\s-]/g, '');
  
  const customers = await getCustomers(tenantId);
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

export async function getOwners(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const result = await docClient.send(new ScanCommand({
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'OWNER',
      ':tenantId': tenantId,
    },
  }));
  return result.Items || [];
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

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#OWNER#${ownerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));

  return await getOwner(tenantId, ownerId);
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

export async function createProperty(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const propertyId = uuidv4();
  // Owner is now optional - can be null/undefined for unassigned properties
  const ownerId = data.ownerId || null;
  
  const property = {
    PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
    SK: 'PROFILE',
    EntityType: 'PROPERTY',
    tenantId,
    propertyId,
    
    // Ownership
    ownerId: ownerId, // Links to OWNER entity
    ownerName: data.ownerName || null, // Denormalized for display
    ownerPhone: data.ownerPhone || null,
    
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
    status: data.status || 'vacant', 
    // Enum: 'owner-occupied' | 'vacant' | 'for-rent' | 'rented' | 'for-sale' | 'sold' | 'under-construction'
    
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
    
    // Sale Information (if status = for-sale or sold)
    saleInfo: data.saleInfo || {
      listedPrice: null,
      soldPrice: null,
      soldDate: null,
      soldToBuyerId: null, // Links to BUYER entity
    },
    
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
    
    // GSI1 - Owner index
    GSI1PK: ownerId ? `TENANT#${tenantId}#OWNER#${ownerId}` : `TENANT#${tenantId}#OWNER#UNASSIGNED`,
    GSI1SK: `PROPERTY#${propertyId}`,
    
    // GSI2 - Status index
    GSI2PK: `TENANT#${tenantId}#PROPERTY_STATUS#${data.status || 'vacant'}`,
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

  return property;
}

export async function getProperties(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  
  const result = await docClient.send(new ScanCommand({
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'PROPERTY',
      ':tenantId': tenantId,
    },
  }));
  return result.Items || [];
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
  
  const result = await docClient.send(new QueryCommand({
    TableName: CRM_TABLE_NAME,
    IndexName: 'owner-property-index',
    KeyConditionExpression: 'GSI1PK = :ownerKey',
    ExpressionAttributeValues: {
      ':ownerKey': `TENANT#${tenantId}#OWNER#${ownerId}`,
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
  
  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  // Add updatedAt
  data.updatedAt = new Date().toISOString();

  // Handle status change for GSI2
  const currentProperty = await getProperty(tenantId, propertyId);
  if (data.status && currentProperty && data.status !== currentProperty.status) {
    data.GSI2PK = `TENANT#${tenantId}#PROPERTY_STATUS#${data.status}`;
  }

  // Handle owner change for GSI1 (supports null/unassigned owner)
  if ('ownerId' in data && currentProperty) {
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

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));

  // Auto-create or update area when property is updated with new area/city
  const updatedProperty = await getProperty(tenantId, propertyId);
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

  return updatedProperty;
}

export async function deleteProperty(tenantId, propertyId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
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
  
  const [customers, owners, properties] = await Promise.all([
    getCustomers(tenantId),
    getOwners(tenantId),
    getProperties(tenantId),
  ]);

  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const activeOwners = owners.filter(o => o.status === 'active').length;
  const availableProperties = properties.filter(p => p.status === 'available').length;
  const onHoldProperties = properties.filter(p => p.status === 'on_hold').length;
  const rentedProperties = properties.filter(p => p.status === 'rented').length;

  const agreementsDone = properties.filter(p => p.agreementStatus === 'done').length;
  const agreementsPending = properties.filter(p => p.agreementStatus === 'pending').length;
  const verificationsDone = properties.filter(p => p.verificationStatus === 'done').length;
  const verificationsPending = properties.filter(p => p.verificationStatus === 'pending').length;

  return {
    totalCustomers: customers.length,
    activeCustomers,
    totalOwners: owners.length,
    activeOwners,
    totalProperties: properties.length,
    availableProperties,
    onHoldProperties,
    rentedProperties,
    agreementsDone,
    agreementsPending,
    verificationsDone,
    verificationsPending,
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
  return result.Items || [];
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
  
  const properties = await getProperties(tenantId);
  const owners = await getOwners(tenantId);
  const customers = await getCustomers(tenantId);
  
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
    createdBy: data.createdBy || 'system',
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
    createdBy: meeting.createdBy || 'system',
  });

  // Schedule meeting reminder (15 minutes before)
  try {
    await scheduleMeetingReminder(tenantId, meeting);
  } catch (reminderError) {
    logger.error('meeting.reminder.schedule.error', { meetingId, error: reminderError.message });
    // Don't fail meeting creation if reminder scheduling fails
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
    createdBy: data.createdBy || 'system',
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

  const result = await docClient.send(new ScanCommand(params));
  
  // Sort by date and time
  const meetings = result.Items || [];
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

  const before = await getMeeting(tenantId, meetingId);

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
      createdBy: typeof data.updatedBy === 'string' ? data.updatedBy : (after.updatedBy || after.createdBy || 'system'),
    });
  }

  // Handle meeting reminder updates
  try {
    const statusChanged = typeof data.status === 'string' && data.status !== before?.status;
    const dateTimeChanged = (typeof data.meetingDate === 'string' && data.meetingDate !== before?.meetingDate) ||
                            (typeof data.meetingTime === 'string' && data.meetingTime !== before?.meetingTime);

    if (statusChanged && (data.status === 'cancelled' || data.status === 'completed')) {
      // Cancel reminder if meeting is cancelled or completed
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
  return phone.replace(/[\s\-\(\)]/g, '').slice(-10);
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
    ownerProfile: data.ownerProfile || null,
    sellerProfile: data.sellerProfile || null,
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
    // Meta
    source: data.source || '',
    tags: data.tags || [],
    notes: data.notes || '',
    status: data.status || 'active',
    // Migration references (link to old Owner/Customer if migrated)
    linkedOwnerId: data.linkedOwnerId || null,
    linkedCustomerId: data.linkedCustomerId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // GSI for search
    GSI3PK: `TENANT#${tenantId}#SEARCH`,
    GSI3SK: `CONTACT#${(data.name || '').toLowerCase()}#${normalizedPhone}`,
  };

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

  const result = await docClient.send(new ScanCommand({
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'CONTACT',
      ':tenantId': tenantId,
    },
  }));

  let contacts = result.Items || [];

  // Apply role filters if provided
  if (filters.role) {
    contacts = contacts.filter(c => c.roles && c.roles[filters.role] === true);
  }
  if (filters.status) {
    contacts = contacts.filter(c => c.status === filters.status);
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
  return result.Item || null;
}

/**
 * Find contact by phone number (for deduplication)
 */
export async function findContactByPhone(tenantId, phone) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
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

    // Merge base fields conservatively (avoid overwriting existing human-entered data)
    const updateData = {
      ...data,
      name: existingContact.name || data.name,
      email: existingContact.email || data.email,
      address: existingContact.address || data.address,
      notes: existingContact.notes || data.notes,
      status: existingContact.status || data.status,
      roles: mergedRoles,
      ownerProfile: data.ownerProfile || existingContact.ownerProfile,
      sellerProfile: data.sellerProfile || existingContact.sellerProfile,
      buyerProfile: data.buyerProfile || existingContact.buyerProfile,
      tenantProfile: data.tenantProfile || existingContact.tenantProfile,
    };

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

  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  data.updatedAt = new Date().toISOString();

  // Update normalizedPhone if phone changes
  if (data.phone) {
    data.normalizedPhone = normalizePhone(data.phone);
  }

  // Never update DynamoDB key attributes or system fields
  const protectedKeys = ['PK', 'SK', 'EntityType', 'tenantId', 'createdAt', 'GSI3PK', 'GSI3SK', 'contactId'];
  const updateData = {};
  Object.keys(data).forEach(key => {
    if (!protectedKeys.includes(key) && !key.startsWith('GSI')) {
      updateData[key] = data[key];
    }
  });

  Object.keys(updateData).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = updateData[key];
  });

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CONTACT#${contactId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));

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
  }

  return await updateContact(tenantId, contactId, updateData);
}

/**
 * Delete a contact
 */
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
    createdBy: data.createdBy || 'system',
    createdAt: data.createdAt || new Date().toISOString(),
  };
  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: note,
  }));
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
        createdBy: 'System',
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

  const leadId = uuidv4();
  const normalizedPhone = data.phone ? normalizePhone(data.phone) : '';

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
    priority: data.priority || 'medium', // low, medium, high
    assignedTo: data.assignedTo || null,
    // Type-specific data
    // For buyer leads
    buyerRequirement: data.buyerRequirement || null, // { budget, preferredArea, bhk, propertyType, etc. }
    // For seller leads
    sellerProperty: data.sellerProperty || null, // { propertyType, area, expectedPrice, etc. }
    // For tenant leads
    tenantRequirement: data.tenantRequirement || null,
    // For owner leads (someone looking to list property for rent)
    ownerProperty: data.ownerProperty || null,
    // Conversion tracking
    convertedAt: null,
    convertedTo: null, // { entityType: 'contact', contactId, role }
    // Notes and history
    notes: data.notes || '',
    history: [{
      timestamp: new Date().toISOString(),
      action: 'Lead Created',
      details: `New ${data.leadType} lead created`,
      updatedBy: data.createdBy || 'System',
    }],
    createdBy: data.createdBy || 'System',
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

  return lead;
}

/**
 * Get all leads for a tenant
 */
export async function getLeads(tenantId, filters = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const result = await docClient.send(new ScanCommand({
    TableName: CRM_TABLE_NAME,
    FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
    ExpressionAttributeValues: {
      ':type': 'LEAD',
      ':tenantId': tenantId,
    },
  }));

  let leads = result.Items || [];

  // Apply filters
  if (filters.leadType) {
    leads = leads.filter(l => l.leadType === filters.leadType);
  }
  if (filters.status) {
    leads = leads.filter(l => l.status === filters.status);
  }
  if (filters.priority) {
    leads = leads.filter(l => l.priority === filters.priority);
  }
  if (filters.excludeConverted) {
    leads = leads.filter(l => !l.convertedAt);
  }

  // Sort by createdAt desc
  leads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return leads;
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
 * Update a lead
 */
export async function updateLead(tenantId, leadId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const existingLead = await getLead(tenantId, leadId);
  if (!existingLead) {
    throw new Error('Lead not found');
  }

  // Prevent updating converted leads (except notes)
  if (existingLead.convertedAt && Object.keys(data).some(k => !['notes'].includes(k))) {
    throw new Error('Cannot update a converted lead');
  }

  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  data.updatedAt = new Date().toISOString();

  // Add history entry for status changes
  if (data.status && data.status !== existingLead.status) {
    const history = existingLead.history || [];
    history.push({
      timestamp: new Date().toISOString(),
      action: 'Status Changed',
      details: `Status changed from ${existingLead.status} to ${data.status}`,
      updatedBy: data.updatedBy || 'System',
    });
    data.history = history;
  }

  const immutableKeys = new Set(['PK', 'SK', 'EntityType', 'tenantId', 'leadId', 'createdAt', 'createdBy']);
  Object.keys(data).forEach((key, index) => {
    if (key === 'updatedBy') return; // Skip helper field
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

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#LEAD#${leadId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));

  return await getLead(tenantId, leadId);
}

/**
 * Convert a lead to the appropriate entity type (BUYER, OWNER, CUSTOMER/TENANT)
 * 
 * IMPORTANT: 
 * - Buyer conversion requires purchase transaction details (options.purchaseDetails)
 * - Tenant conversion requires lease agreement details (options.leaseDetails)
 * - Seller-type leads convert to OWNER with property listed for sale
 */
export async function convertLead(tenantId, leadId, options = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const lead = await getLead(tenantId, leadId);
  if (!lead) {
    throw new Error('Lead not found');
  }
  if (lead.convertedAt) {
    throw new Error('Lead has already been converted');
  }

  const leadNotes = await getLeadNotes(tenantId, leadId);

  // Lead conversions dedupe/merge strictly by phone number into CONTACT.
  if (!lead.phone) {
    throw new Error('Phone number is required to convert a lead');
  }

  const role = lead.leadType;
  if (!['buyer', 'seller', 'tenant', 'owner'].includes(role)) {
    throw new Error(`Unknown lead type: ${lead.leadType}`);
  }

  const contactPayload = {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    address: lead.address || '',
    source: `lead:${lead.leadId}`,
    notes: lead.notes,
    status: 'active',
    roles: {
      owner: role === 'owner',
      seller: role === 'seller',
      buyer: role === 'buyer',
      tenant: role === 'tenant',
    },
    ownerProfile: role === 'owner' ? (lead.ownerProperty || {}) : undefined,
    sellerProfile: role === 'seller' ? (lead.sellerProperty || {}) : undefined,
    buyerProfile: role === 'buyer' ? (lead.buyerRequirement || {}) : undefined,
    tenantProfile: role === 'tenant' ? (lead.tenantRequirement || {}) : undefined,
    createdBy: options.convertedBy || 'System',
  };

  let createdEntity;
  if (options.existingContactId) {
    const existing = await getContact(tenantId, options.existingContactId);
    if (!existing) {
      throw new Error('Specified contact not found');
    }

    const leadPhone = String(lead.phone || '').replace(/[^0-9]/g, '').slice(-10);
    const existingPhone = String(existing.phone || '').replace(/[^0-9]/g, '').slice(-10);
    if (!leadPhone || !existingPhone || leadPhone !== existingPhone) {
      throw new Error('Specified contact does not match lead phone number');
    }

    createdEntity = await createOrUpdateContactByPhone(tenantId, { ...contactPayload, phone: existing.phone });
  } else {
    createdEntity = await createOrUpdateContactByPhone(tenantId, contactPayload);
  }

  let entityType = 'contact';
  let entityId = createdEntity.contactId;
  let entity = createdEntity;

  // Ensure owner conversions show up in the legacy OWNER list UI.
  // OwnerList (/crm/owners) queries EntityType='OWNER', not CONTACT.
  if (role === 'owner' || role === 'seller') {
    const owner = await createOrUpdateOwnerByPhone(tenantId, {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      address: lead.address || '',
      status: 'active',
      source: `lead:${lead.leadId}`,
      notes: lead.notes,
      createdBy: options.convertedBy || 'System',
    });

    entityType = 'owner';
    entityId = owner.ownerId;
    entity = owner;

    // Seller-type leads should create a PROPERTY listing for sale by default.
    // This is what the UI expects when it treats "Sellers" as owners who have for-sale listings.
    if (role === 'seller' && options.createPropertyListing !== false) {
      const sp = lead.sellerProperty || {};
      const propertyType = sp.propertyType || 'apartment';
      const area = sp.area || '';
      const city = sp.city || lead.city || 'Mumbai';
      const listedPrice = typeof sp.expectedPrice === 'number' ? sp.expectedPrice : null;

      await createProperty(tenantId, {
        ownerId: owner.ownerId,
        ownerName: owner.name,
        ownerPhone: owner.phone,
        title: sp.title || `${propertyType} for Sale${area ? ` - ${area}` : ''}`,
        description: sp.description || lead.notes || '',
        propertyType,
        area,
        city,
        address: sp.address || lead.address || '',
        status: 'for-sale',
        listingStatus: 'active',
        saleInfo: {
          listedPrice,
          soldPrice: null,
          soldDate: null,
          soldToBuyerId: null,
        },
        createdBy: options.convertedBy || 'System',
      });
    }
  }

  if (leadNotes.length) {
    if (entityType === 'owner') {
      await Promise.all(leadNotes.map(note => createOwnerNote(tenantId, entityId, {
        content: note.content,
        createdBy: note.createdBy,
        createdAt: note.createdAt,
      })));
    } else {
      await Promise.all(leadNotes.map(note => createContactNote(tenantId, entityId, {
        content: note.content,
        createdBy: note.createdBy,
        createdAt: note.createdAt,
      })));
    }
  }

  // Update lead as converted
  const history = lead.history || [];
  history.push({
    timestamp: new Date().toISOString(),
    action: 'Lead Converted',
    details: `Converted to ${entityType} (ID: ${entityId})`,
    updatedBy: options.convertedBy || 'System',
  });

  await updateLead(tenantId, leadId, {
    status: 'converted',
    convertedAt: new Date().toISOString(),
    convertedTo: {
      entityType: entityType,
      entityId: entityId,
      role,
    },
    history,
  });

  return {
    lead: await getLead(tenantId, leadId),
    entity: entity,
    entityType: entityType,
  };
}

/**
 * Delete a lead
 */
export async function deleteLead(tenantId, leadId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
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
    createdBy: data.createdBy || 'system',
    createdAt: data.createdAt || new Date().toISOString(),
  };
  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: note,
  }));
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
  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#LEAD#${leadId}`,
      SK: `NOTE#${noteId}`,
    },
    UpdateExpression: 'SET #content = :content, #updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#content': 'content',
      '#updatedAt': 'updatedAt',
    },
    ExpressionAttributeValues: {
      ':content': data.content,
      ':updatedAt': new Date().toISOString(),
    },
  }));
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
    status: owner.status,
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
    status: customer.status === 'closed' ? 'inactive' : 'active',
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

  // Try new contact references first
  if (property.ownerContactId) {
    result.ownerContact = await getContact(tenantId, property.ownerContactId);
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
    
    // Status & Metadata
    status: data.status || 'active', // active, inactive
    notes: data.notes || '',
    tags: data.tags || [],
    
    // Timestamps
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy || 'System',
    
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

export async function getBuyers(tenantId, filters = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  // Fetch both legacy BUYER entities and unified CONTACT entities with buyer role
  const [legacyBuyersResult, buyerContactsResult] = await Promise.all([
    docClient.send(new ScanCommand({
      TableName: CRM_TABLE_NAME,
      FilterExpression: 'EntityType = :type AND tenantId = :tenantId',
      ExpressionAttributeValues: {
        ':type': 'BUYER',
        ':tenantId': tenantId,
      },
    })),
    docClient.send(new ScanCommand({
      TableName: CRM_TABLE_NAME,
      FilterExpression: 'EntityType = :type AND tenantId = :tenantId AND #roles.#buyer = :isBuyer',
      ExpressionAttributeNames: {
        '#roles': 'roles',
        '#buyer': 'buyer',
      },
      ExpressionAttributeValues: {
        ':type': 'CONTACT',
        ':tenantId': tenantId,
        ':isBuyer': true,
      },
    })),
  ]);
  
  let buyers = legacyBuyersResult.Items || [];
  const buyerContacts = buyerContactsResult.Items || [];
  
  // Convert CONTACT format to BUYER-like format for unified display
  const contactsAsBuyers = buyerContacts.map(contact => ({
    ...contact,
    buyerId: contact.contactId,
    // Extract buyer-specific profile if available
    budget: contact.buyerProfile?.budget || null,
    propertyType: contact.buyerProfile?.propertyType || null,
    preferredArea: contact.buyerProfile?.preferredArea || null,
    requirement: contact.buyerProfile?.requirement || null,
    isFromContact: true,
  }));
  
  // Merge and dedupe by phone number
  const phoneMap = new Map();
  [...buyers, ...contactsAsBuyers].forEach(buyer => {
    const phone = normalizePhone(buyer.phone);
    if (phone && !phoneMap.has(phone)) {
      phoneMap.set(phone, buyer);
    } else if (!phone) {
      // If no phone, use ID as key
      phoneMap.set(buyer.buyerId || buyer.contactId, buyer);
    }
  });
  
  buyers = Array.from(phoneMap.values());
  
  // Apply filters
  if (filters.status) {
    buyers = buyers.filter(b => b.status === filters.status);
  }
  if (filters.priority) {
    buyers = buyers.filter(b => b.priority === filters.priority);
  }
  if (filters.propertyType) {
    buyers = buyers.filter(b => b.propertyType === filters.propertyType);
  }
  
  return buyers;
}

export async function getBuyer(tenantId, buyerId) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
  }));
  return result.Item || null;
}

export async function updateBuyer(tenantId, buyerId, data) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const updateExpression = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  const updateableFields = [
    'name', 'email', 'phone', 'address',
    'panNumber', 'panDocS3Key', 'panDocUrl',
    'aadharNumber', 'aadharDocS3Key', 'aadharDocUrl',
    'photoS3Key', 'photoUrl',
    'purchases', 'status', 'notes', 'tags', 'source'
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

// ============== SELLER Entity REMOVED ==============
// Seller functionality has been replaced by OWNER + PROPERTY listing for sale
// Use createOwner() + createProperty() with status='for-sale' instead

// ============== Cross-Role Phone Lookup ==============

export async function findPersonByPhone(tenantId, phone) {
  if (!tenantId || !phone) return { found: false, roles: [] };
  
  const cleanPhone = phone.replace(/\D/g, '');
  const roles = [];
  
  // Check in BUYER
  const buyers = await getBuyers(tenantId);
  const buyer = buyers.find(b => b.phone && b.phone.replace(/\D/g, '') === cleanPhone);
  if (buyer) roles.push({ role: 'buyer', id: buyer.buyerId, data: buyer });
  
  // Check in OWNER
  const owners = await getOwners(tenantId);
  const owner = owners.find(o => o.phone && o.phone.replace(/\D/g, '') === cleanPhone);
  if (owner) roles.push({ role: 'owner', id: owner.ownerId, data: owner });
  
  // Check in CUSTOMER (Tenant)
  const customers = await getCustomers(tenantId);
  const customer = customers.find(c => c.phone && c.phone.replace(/\D/g, '') === cleanPhone);
  if (customer) roles.push({ role: 'tenant', id: customer.customerId, data: customer });
  
  return {
    found: roles.length > 0,
    roles,
    phone: cleanPhone,
  };
}

// ============== Notes for Buyers and Sellers ==============

export async function createBuyerNote(tenantId, buyerId, data) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const noteId = uuidv4();
  const note = {
    PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
    SK: `NOTE#${noteId}`,
    EntityType: 'NOTE',
    tenantId,
    buyerId,
    noteId,
    content: data.content,
    createdBy: data.createdBy || 'Admin',
    createdAt: data.createdAt || new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: CRM_TABLE_NAME,
    Item: note,
  }));

  return note;
}

export async function getBuyerNotes(tenantId, buyerId) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const result = await docClient.send(new QueryCommand({
    TableName: CRM_TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#BUYER#${buyerId}`,
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
  if (!query || query.trim().length < 2) return [];
  
  const normalizedQuery = query.toLowerCase().trim();
  const owners = await getOwners(tenantId);
  
  return owners.filter(owner => {
    const nameMatch = owner.name?.toLowerCase().includes(normalizedQuery);
    const phoneMatch = owner.phone?.replace(/[\s-]/g, '').includes(normalizedQuery.replace(/[\s-]/g, ''));
    return nameMatch || phoneMatch;
  }).slice(0, 20); // Limit results
}

/**
 * Search customers/tenants by name or phone
 */
export async function searchCustomers(tenantId, query) {
  if (!tenantId) throw new Error('Tenant ID is required');
  if (!query || query.trim().length < 2) return [];
  
  const normalizedQuery = query.toLowerCase().trim();
  const customers = await getCustomers(tenantId);
  
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
  
  const leads = await getLeads(tenantId);
  let filtered = [...leads];
  
  // Apply text search if query provided
  if (query && query.trim().length >= 2) {
    const normalizedQuery = query.toLowerCase().trim();
    filtered = filtered.filter(lead => {
      const nameMatch = lead.name?.toLowerCase().includes(normalizedQuery);
      const phoneMatch = lead.phone?.replace(/[\s-]/g, '').includes(normalizedQuery.replace(/[\s-]/g, ''));
      return nameMatch || phoneMatch;
    });
  }
  
  // Apply filters
  if (filters.leadType && filters.leadType !== 'all') {
    filtered = filtered.filter(l => l.leadType === filters.leadType);
  }
  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(l => l.status === filters.status);
  }
  if (filters.priority && filters.priority !== 'all') {
    filtered = filtered.filter(l => l.priority === filters.priority);
  }
  
  return filtered.slice(0, 50);
}

/**
 * Search properties by area, name, phone, or owner name with filters
 */
export async function searchProperties(tenantId, query, filters = {}) {
  if (!tenantId) throw new Error('Tenant ID is required');
  
  const properties = await getPropertiesWithDetails(tenantId);
  let filtered = [...properties];
  
  // Apply text search if query provided
  if (query && query.trim().length >= 2) {
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
  
  // Apply filters
  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(p => p.status === filters.status);
  }
  if (filters.propertyType && filters.propertyType !== 'all') {
    filtered = filtered.filter(p => p.propertyType === filters.propertyType);
  }
  if (filters.bhk && filters.bhk !== 'all') {
    filtered = filtered.filter(p => p.bhk === parseInt(filters.bhk));
  }
  if (filters.furnishing && filters.furnishing !== 'all') {
    filtered = filtered.filter(p => p.furnishing === filters.furnishing);
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
  
  const buyers = await getBuyers(tenantId);
  let filtered = [...buyers];
  
  if (query && query.trim().length >= 2) {
    const normalizedQuery = query.toLowerCase().trim();
    filtered = filtered.filter(buyer => {
      const nameMatch = buyer.name?.toLowerCase().includes(normalizedQuery);
      const phoneMatch = buyer.phone?.replace(/[\s-]/g, '').includes(normalizedQuery.replace(/[\s-]/g, ''));
      return nameMatch || phoneMatch;
    });
  }
  
  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(b => b.status === filters.status);
  }
  if (filters.priority && filters.priority !== 'all') {
    filtered = filtered.filter(b => b.priority === filters.priority);
  }
  
  return filtered.slice(0, 50);
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

  const allBuyers = await getBuyers(tenantId);
  
  return allBuyers.filter(buyer => {
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

export { docClient, CRM_TABLE_NAME };

export default docClient;
