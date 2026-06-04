import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import * as crmDb from './crmDynamodbService.js';
import { logger } from './logger.js';
import { wrapAwsClient } from './awsClientWrapper.js';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// Load environment variables from server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const REGION = process.env.AWS_REGION || 'ap-south-1';
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

if (!TABLE_NAME) {
  throw new Error('DYNAMODB_TABLE_NAME is not set. Please configure it in server/.env');
}

// Initialize DynamoDB and STS clients
const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: TABLE_NAME });
const docClient = DynamoDBDocumentClient.from(client);
const stsClient = wrapAwsClient(new STSClient({ region: REGION }), 'STS');

// Log AWS context on startup to help debug region/account/table issues
async function logAwsContext() {
  try {
    logger.info('aws.context', { REGION, TABLE_NAME });

    const identity = await stsClient.send(new GetCallerIdentityCommand({}));
    logger.info('aws.identity', {
      Account: identity.Account,
      Arn: identity.Arn,
      UserId: identity.UserId,
    });
  } catch (error) {
    logger.error('aws.context.error', {
      errorMessage: error?.message,
      errorName: error?.name,
      stack: error?.stack,
    });
  }
}

// Fire and forget logging on module load
logAwsContext().catch((err) => {
  logger.error('aws.context.unhandled', {
    errorMessage: err?.message,
    errorName: err?.name,
    stack: err?.stack,
  });
});

/**
 * DynamoDB Single Table Design:
 * 
 * PK Pattern:
 * - ADMIN#{adminId}
 * - AREA#{areaId}
 * - BUILDING#{buildingId}
 * - FLAT#{flatId}
 * - OWNER#{ownerId}
 * - TENANT#{tenantId}
 * 
 * SK Pattern:
 * - PROFILE (for main entity data)
 * - AGREEMENT#{agreementId}
 * - VERIFICATION#{verificationType}
 * - DOCUMENT#{documentType}#{documentId}
 * - METADATA (for additional info)
 * 
 * GSI1: area-index (GSI1PK = AREA#{areaId}, GSI1SK = BUILDING#{buildingId})
 * GSI2: building-index (GSI2PK = BUILDING#{buildingId}, GSI2SK = FLAT#{flatId})
 * GSI3: search-index (GSI3PK = SEARCH, GSI3SK = searchable text)
 */

// ============== Admin Operations ==============

export async function createDefaultAdmin() {
  const adminId = 'admin-default';
  const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
  
  try {
    // Check if admin exists
    const existingAdmin = await getAdminByUsername(username);
    if (existingAdmin) {
      console.log('Default admin already exists');
      return existingAdmin;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = {
      PK: `ADMIN#${adminId}`,
      SK: 'PROFILE',
      EntityType: 'ADMIN',
      adminId,
      username,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: admin,
    }));

    console.log('Default admin created successfully');
    return admin;
  } catch (error) {
    if (error?.name === 'ResourceNotFoundException') {
      logger.warn('admin.default.skip.tableNotFound', {
        tableName: TABLE_NAME,
        region: REGION,
        errorMessage: error?.message,
      });
      return null;
    }
    console.error('Error creating default admin:', error);
    throw error;
  }
}

export async function getAdminByUsername(username) {
  try {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'EntityType = :type AND username = :username',
      ExpressionAttributeValues: {
        ':type': 'ADMIN',
        ':username': username,
      },
    }));
    return result.Items?.[0] || null;
  } catch (error) {
    if (error?.name === 'ResourceNotFoundException') {
      logger.warn('admin.lookup.tableNotFound', {
        tableName: TABLE_NAME,
        region: REGION,
        errorMessage: error?.message,
      });
      return null;
    }
    console.error('Error getting admin:', error);
    throw error;
  }
}

export async function changeAdminPassword(username, newPassword) {
  try {
    const admin = await getAdminByUsername(username);
    if (!admin) throw new Error('Admin not found');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: admin.PK, SK: admin.SK },
      UpdateExpression: 'SET password = :password',
      ExpressionAttributeValues: {
        ':password': hashedPassword,
      },
    }));

    return true;
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
}

// ============== Area Operations ==============

export async function createArea(name) {
  const areaId = uuidv4();
  const area = {
    PK: `AREA#${areaId}`,
    SK: 'PROFILE',
    EntityType: 'AREA',
    areaId,
    name,
    createdAt: new Date().toISOString(),
    GSI3PK: 'SEARCH',
    GSI3SK: `AREA#${name.toLowerCase()}`,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: area,
  }));

  return area;
}

export async function getAreas() {
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'EntityType = :type',
    ExpressionAttributeValues: {
      ':type': 'AREA',
    },
  }));
  return result.Items || [];
}

export async function getArea(areaId) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `AREA#${areaId}`,
      SK: 'PROFILE',
    },
  }));
  return result.Item || null;
}

export async function updateArea(areaId, name) {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `AREA#${areaId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #name = :name, GSI3SK = :searchKey',
    ExpressionAttributeNames: {
      '#name': 'name',
    },
    ExpressionAttributeValues: {
      ':name': name,
      ':searchKey': `AREA#${name.toLowerCase()}`,
    },
  }));
  return await getArea(areaId);
}

export async function deleteArea(areaId) {
  // In a real application, you'd want to handle cascade deletes
  // For now, we'll just delete the area
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `AREA#${areaId}`,
      SK: 'PROFILE',
    },
  }));
  return true;
}

// ============== Building Operations ==============

export async function createBuilding(name, areaId) {
  const buildingId = uuidv4();
  const building = {
    PK: `BUILDING#${buildingId}`,
    SK: 'PROFILE',
    EntityType: 'BUILDING',
    buildingId,
    name,
    areaId,
    createdAt: new Date().toISOString(),
    GSI1PK: `AREA#${areaId}`,
    GSI1SK: `BUILDING#${buildingId}`,
    GSI3PK: 'SEARCH',
    GSI3SK: `BUILDING#${name.toLowerCase()}`,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: building,
  }));

  return building;
}

export async function getBuildings() {
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'EntityType = :type',
    ExpressionAttributeValues: {
      ':type': 'BUILDING',
    },
  }));
  return result.Items || [];
}

export async function getBuildingsByArea(areaId) {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'area-index',
    KeyConditionExpression: 'GSI1PK = :areaKey',
    ExpressionAttributeValues: {
      ':areaKey': `AREA#${areaId}`,
    },
  }));
  return result.Items || [];
}

export async function getBuilding(buildingId) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `BUILDING#${buildingId}`,
      SK: 'PROFILE',
    },
  }));
  return result.Item || null;
}

export async function updateBuilding(buildingId, name, areaId) {
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `BUILDING#${buildingId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #name = :name, areaId = :areaId, GSI1PK = :gsi1pk, GSI3SK = :searchKey',
    ExpressionAttributeNames: {
      '#name': 'name',
    },
    ExpressionAttributeValues: {
      ':name': name,
      ':areaId': areaId,
      ':gsi1pk': `AREA#${areaId}`,
      ':searchKey': `BUILDING#${name.toLowerCase()}`,
    },
  }));
  return await getBuilding(buildingId);
}

export async function deleteBuilding(buildingId) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `BUILDING#${buildingId}`,
      SK: 'PROFILE',
    },
  }));
  return true;
}

export async function searchBuildings(query) {
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'EntityType = :type AND contains(#name, :query)',
    ExpressionAttributeNames: {
      '#name': 'name',
    },
    ExpressionAttributeValues: {
      ':type': 'BUILDING',
      ':query': query.toLowerCase(),
    },
  }));
  return result.Items || [];
}

// Get comprehensive rental list with all details (includes traditional flats AND CRM properties)
export async function getRentalList() {
  try {
    // Get all flats from traditional system
    const flatsResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'EntityType = :type',
      ExpressionAttributeValues: {
        ':type': 'FLAT',
      },
    }));
    
    const flats = flatsResult.Items || [];
    
    // Enrich each flat with related data
    const enrichedFlats = await Promise.all(
      flats.map(async (flat) => {
        const [building, owner, tenant, agreements, verifications] = await Promise.all([
          getBuilding(flat.buildingId),
          getOwner(flat.flatId),
          getTenant(flat.flatId),
          getAgreements(flat.flatId),
          getVerifications(flat.flatId),
        ]);
        
        let area = null;
        if (building) {
          area = await getArea(building.areaId);
        }
        
        // Get latest agreement (most recently created)
        const latestAgreement = agreements.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        
        // Check if police verification is done
        // Our Verification.status values are: 'done' | 'pending' | 'not_done'
        const policeVerificationDone = verifications.some(
          (v) => typeof v.status === 'string' && v.status.toLowerCase() === 'done'
        );
        
        return {
          flatId: flat.flatId,
          flatNumber: flat.flatNumber,
          floorNumber: flat.floorNumber || 0,
          buildingId: flat.buildingId,
          buildingName: building?.name || 'Unknown',
          areaId: building?.areaId || null,
          areaName: area?.name || 'Unknown',
          ownerName: owner?.name || owner?.fullName || 'N/A',
          ownerPhone: owner?.phone || owner?.phoneNumber || 'N/A',
          tenantName: tenant?.name || tenant?.fullName || 'N/A',
          tenantPhone: tenant?.phone || tenant?.phoneNumber || 'N/A',
          agreementDone: !!latestAgreement,
          agreementStartDate: latestAgreement?.startDate || null,
          agreementEndDate: latestAgreement?.endDate || null,
          policeVerificationDone,
          verificationCount: verifications.length,
          createdAt: flat.createdAt,
          source: 'traditional', // Mark source for identification
        };
      })
    );
    
    // Get CRM properties (status: rented or on_hold indicates they are actively managed)
    let crmProperties = [];
    try {
      // Get tenant ID from the first admin or use a default
      // This is a limitation - ideally we'd pass tenantId to this function
      const allTenants = await getAllTenantIds();
      
      for (const tenantId of allTenants) {
        const properties = await crmDb.getProperties(tenantId);
        const rentedProperties = properties.filter(p => 
          p.status === 'rented' || p.status === 'on-hold'
        );
        
        // Convert CRM properties to rental list format
        for (const prop of rentedProperties) {
          let ownerData = { name: 'N/A', phone: 'N/A' };
          try {
            const owner = await crmDb.getOwner(tenantId, prop.ownerId);
            if (owner) {
              ownerData = { name: owner.name || 'N/A', phone: owner.phone || 'N/A' };
            }
          } catch (err) {
            console.error('Error fetching CRM owner:', err);
          }
          
          crmProperties.push({
            flatId: prop.propertyId,
            flatNumber: prop.title || 'N/A',
            floorNumber: 0,
            buildingId: null,
            buildingName: prop.address || 'CRM Property',
            areaId: null,
            areaName: prop.area || 'Unknown',
            ownerName: ownerData.name,
            ownerPhone: ownerData.phone,
            tenantName: 'N/A', // CRM doesn't track tenant details separately
            tenantPhone: 'N/A',
            agreementDone: prop.status === 'rented',
            agreementStartDate: null,
            agreementEndDate: null,
            policeVerificationDone: false,
            verificationCount: 0,
            createdAt: prop.createdAt,
            source: 'crm', // Mark as CRM property
          });
        }
      }
    } catch (crmError) {
      console.error('Error fetching CRM properties for rental list:', crmError);
      // Continue without CRM properties if there's an error
    }
    
    // Merge both traditional flats and CRM properties
    const allRentals = [...enrichedFlats, ...crmProperties];
    
    // Sort by creation date (newest first)
    allRentals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return allRentals;
  } catch (error) {
    console.error('Error getting rental list:', error);
    throw error;
  }
}

// Helper function to get all tenant IDs
async function getAllTenantIds() {
  try {
    const admins = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'EntityType = :type',
      ExpressionAttributeValues: {
        ':type': 'ADMIN',
      },
    }));
    
    // Extract unique tenant IDs from admins
    const tenantIds = new Set();
    (admins.Items || []).forEach(admin => {
      if (admin.tenantId) {
        tenantIds.add(admin.tenantId);
      }
    });
    
    return Array.from(tenantIds);
  } catch (error) {
    console.error('Error getting tenant IDs:', error);
    return [];
  }
}

// ============== Flat Operations ==============

export async function createFlat(buildingId, flatNumber, floorNumber) {
  const flatId = uuidv4();
  const flat = {
    PK: `FLAT#${flatId}`,
    SK: 'PROFILE',
    EntityType: 'FLAT',
    flatId,
    buildingId,
    flatNumber,
    floorNumber,
    createdAt: new Date().toISOString(),
    GSI2PK: `BUILDING#${buildingId}`,
    GSI2SK: `FLAT#${flatId}`,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: flat,
  }));

  return flat;
}

export async function getFlatsByBuilding(buildingId) {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'building-index',
    KeyConditionExpression: 'GSI2PK = :buildingKey',
    ExpressionAttributeValues: {
      ':buildingKey': `BUILDING#${buildingId}`,
    },
  }));
  return result.Items || [];
}

export async function getFlat(flatId) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `FLAT#${flatId}`,
      SK: 'PROFILE',
    },
  }));
  return result.Item || null;
}

export async function updateFlat(flatId, data) {
  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  Object.keys(data).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = data[key];
  });

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `FLAT#${flatId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));

  return await getFlat(flatId);
}

export async function deleteFlat(flatId) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `FLAT#${flatId}`,
      SK: 'PROFILE',
    },
  }));
  return true;
}

// ============== Owner/Tenant Operations ==============

export async function createOwner(flatId, data) {
  const ownerId = uuidv4();
  const owner = {
    PK: `FLAT#${flatId}`,
    SK: `OWNER#${ownerId}`,
    EntityType: 'OWNER',
    ownerId,
    flatId,
    ...data,
    createdAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: owner,
  }));

  return owner;
}

export async function getOwner(flatId) {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `FLAT#${flatId}`,
      ':sk': 'OWNER#',
    },
  }));
  return result.Items?.[0] || null;
}

export async function updateOwner(flatId, ownerId, data) {
  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  Object.keys(data).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = data[key];
  });

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `FLAT#${flatId}`,
      SK: `OWNER#${ownerId}`,
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));

  return await getOwner(flatId);
}

export async function createTenant(flatId, data) {
  const tenantId = uuidv4();
  const tenant = {
    PK: `FLAT#${flatId}`,
    SK: `TENANT#${tenantId}`,
    EntityType: 'TENANT',
    tenantId,
    flatId,
    ...data,
    createdAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: tenant,
  }));

  return tenant;
}

export async function getTenant(flatId) {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `FLAT#${flatId}`,
      ':sk': 'TENANT#',
    },
  }));
  return result.Items?.[0] || null;
}

export async function updateTenant(flatId, tenantId, data) {
  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  Object.keys(data).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = data[key];
  });

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `FLAT#${flatId}`,
      SK: `TENANT#${tenantId}`,
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));

  return await getTenant(flatId);
}

// ============== Agreement Operations ==============

export async function createAgreement(flatId, data) {
  const agreementId = uuidv4();
  const agreement = {
    PK: `FLAT#${flatId}`,
    SK: `AGREEMENT#${agreementId}`,
    EntityType: 'AGREEMENT',
    agreementId,
    flatId,
    ...data,
    createdAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: agreement,
  }));

  return agreement;
}

export async function getAgreements(flatId) {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `FLAT#${flatId}`,
      ':sk': 'AGREEMENT#',
    },
  }));
  return result.Items || [];
}

export async function updateAgreement(flatId, agreementId, data) {
  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  Object.keys(data).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = data[key];
  });

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `FLAT#${flatId}`,
      SK: `AGREEMENT#${agreementId}`,
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));
}

// ============== Police Verification Operations ==============

export async function createVerification(flatId, data) {
  const verificationId = uuidv4();
  const verification = {
    PK: `FLAT#${flatId}`,
    SK: `VERIFICATION#${verificationId}`,
    EntityType: 'VERIFICATION',
    verificationId,
    flatId,
    ...data,
    createdAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: verification,
  }));

  return verification;
}

export async function getVerifications(flatId) {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `FLAT#${flatId}`,
      ':sk': 'VERIFICATION#',
    },
  }));
  return result.Items || [];
}

export async function updateVerification(flatId, verificationId, data) {
  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  Object.keys(data).forEach((key, index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = data[key];
  });

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `FLAT#${flatId}`,
      SK: `VERIFICATION#${verificationId}`,
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));
}

// ============== Document Operations ==============

export async function createDocument(flatId, documentType, data) {
  const documentId = uuidv4();
  const document = {
    PK: `FLAT#${flatId}`,
    SK: `DOCUMENT#${documentType}#${documentId}`,
    EntityType: 'DOCUMENT',
    documentId,
    flatId,
    documentType,
    ...data,
    createdAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: document,
  }));

  return document;
}

export async function getDocuments(flatId, documentType = null) {
  const skPrefix = documentType ? `DOCUMENT#${documentType}#` : 'DOCUMENT#';
  
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `FLAT#${flatId}`,
      ':sk': skPrefix,
    },
  }));
  return result.Items || [];
}

export async function deleteDocument(flatId, documentType, documentId) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `FLAT#${flatId}`,
      SK: `DOCUMENT#${documentType}#${documentId}`,
    },
  }));
  return true;
}

// ============== Dashboard Metrics ==============

export async function getDashboardMetrics() {
  // Get counts for all entity types
  const areas = await getAreas();
  const buildings = await getBuildings();
  
  const flatsResult = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'EntityType = :type',
    ExpressionAttributeValues: {
      ':type': 'FLAT',
    },
  }));
  
  const ownersResult = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'EntityType = :type',
    ExpressionAttributeValues: {
      ':type': 'OWNER',
    },
  }));
  
  const tenantsResult = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'EntityType = :type',
    ExpressionAttributeValues: {
      ':type': 'TENANT',
    },
  }));

  return {
    totalAreas: areas.length,
    totalBuildings: buildings.length,
    totalFlats: flatsResult.Items?.length || 0,
    totalOwners: ownersResult.Items?.length || 0,
    totalTenants: tenantsResult.Items?.length || 0,
    occupiedFlats: tenantsResult.Items?.length || 0,
    vacantFlats: (flatsResult.Items?.length || 0) - (tenantsResult.Items?.length || 0),
  };
}

export default docClient;
