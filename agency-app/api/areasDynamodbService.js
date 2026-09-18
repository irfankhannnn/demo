import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.js';
import { wrapAwsClient } from './awsClientWrapper.js';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB');
const docClient = DynamoDBDocumentClient.from(client);

const AREAS_TABLE_NAME = process.env.AREAS_DYNAMODB_TABLE_NAME || 'real-estate-areas';

// Log the table name on startup
logger.info('areas.table', { AREAS_TABLE_NAME });

/**
 * Create a new area
 * @param {string} tenantId 
 * @param {object} data 
 * @returns {Promise<object>}
 */
export async function createArea(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const areaId = uuidv4();
  const areaName = data.areaName || '';
  const city = data.city || 'Mumbai';

  const area = {
    PK: `TENANT#${tenantId}#AREA#${areaId}`,
    SK: 'PROFILE',
    EntityType: 'AREA',
    tenantId,
    areaId,
    areaName,
    city,
    description: data.description || '',
    bannerS3Key: data.bannerS3Key || null,
    propertyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // GSI1 - Tenant-City index for querying areas by tenant and city
    GSI1PK: `TENANT#${tenantId}#CITY#${city}`,
    GSI1SK: `AREA#${areaName.toLowerCase()}`,
  };

  await docClient.send(
    new PutCommand({
      TableName: AREAS_TABLE_NAME,
      Item: area,
    })
  );

  return area;
}

/**
 * Get an area by ID
 * @param {string} tenantId 
 * @param {string} areaId 
 * @returns {Promise<object|null>}
 */
export async function getArea(tenantId, areaId) {
  if (!tenantId || !areaId) {
    throw new Error('Tenant ID and Area ID are required');
  }

  const result = await docClient.send(
    new GetCommand({
      TableName: AREAS_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#AREA#${areaId}`,
        SK: 'PROFILE',
      },
    })
  );

  return result.Item || null;
}

/**
 * Get all areas for a tenant
 * @param {string} tenantId 
 * @returns {Promise<array>}
 */
export async function getAreas(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const items = [];
  let lastEvaluatedKey;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: AREAS_TABLE_NAME,
        FilterExpression: 'tenantId = :tenantId AND EntityType = :type AND SK = :sk',
        ExpressionAttributeValues: {
          ':tenantId': tenantId,
          ':type': 'AREA',
          ':sk': 'PROFILE',
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (result.Items && result.Items.length > 0) {
      items.push(...result.Items);
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

/**
 * Get areas by city for a tenant
 * @param {string} tenantId 
 * @param {string} city 
 * @returns {Promise<array>}
 */
export async function getAreasByCity(tenantId, city) {
  if (!tenantId || !city) {
    throw new Error('Tenant ID and City are required');
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: AREAS_TABLE_NAME,
      IndexName: 'tenant-city-index',
      KeyConditionExpression: 'GSI1PK = :gsi1pk',
      ExpressionAttributeValues: {
        ':gsi1pk': `TENANT#${tenantId}#CITY#${city}`,
      },
    })
  );

  return result.Items || [];
}

/**
 * Update an area
 * @param {string} tenantId 
 * @param {string} areaId 
 * @param {object} updates 
 * @returns {Promise<object>}
 */
export async function updateArea(tenantId, areaId, updates) {
  if (!tenantId || !areaId) {
    throw new Error('Tenant ID and Area ID are required');
  }

  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  if (updates.areaName !== undefined) {
    updateExpressions.push('#areaName = :areaName');
    expressionAttributeNames['#areaName'] = 'areaName';
    expressionAttributeValues[':areaName'] = updates.areaName;
  }

  if (updates.city !== undefined) {
    updateExpressions.push('#city = :city');
    expressionAttributeNames['#city'] = 'city';
    expressionAttributeValues[':city'] = updates.city;
    
    // Update GSI1PK and GSI1SK for city changes
    updateExpressions.push('GSI1PK = :gsi1pk');
    expressionAttributeValues[':gsi1pk'] = `TENANT#${tenantId}#CITY#${updates.city}`;
    
    if (updates.areaName) {
      updateExpressions.push('GSI1SK = :gsi1sk');
      expressionAttributeValues[':gsi1sk'] = `AREA#${updates.areaName.toLowerCase()}`;
    }
  }

  if (updates.description !== undefined) {
    updateExpressions.push('#description = :description');
    expressionAttributeNames['#description'] = 'description';
    expressionAttributeValues[':description'] = updates.description;
  }

  if (updates.bannerS3Key !== undefined) {
    updateExpressions.push('bannerS3Key = :bannerS3Key');
    expressionAttributeValues[':bannerS3Key'] = updates.bannerS3Key;
  }

  if (updates.propertyCount !== undefined) {
    updateExpressions.push('propertyCount = :propertyCount');
    expressionAttributeValues[':propertyCount'] = updates.propertyCount;
  }

  updateExpressions.push('updatedAt = :updatedAt');
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  if (updateExpressions.length === 0) {
    throw new Error('No valid updates provided');
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: AREAS_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#AREA#${areaId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return result.Attributes;
}

/**
 * Check if an area exists by name and city
 * @param {string} tenantId 
 * @param {string} areaName 
 * @param {string} city 
 * @returns {Promise<object|null>}
 */
export async function getAreaByName(tenantId, areaName, city) {
  if (!tenantId || !areaName || !city) {
    return null;
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: AREAS_TABLE_NAME,
      IndexName: 'tenant-city-index',
      KeyConditionExpression: 'GSI1PK = :gsi1pk AND GSI1SK = :gsi1sk',
      ExpressionAttributeValues: {
        ':gsi1pk': `TENANT#${tenantId}#CITY#${city}`,
        ':gsi1sk': `AREA#${areaName.toLowerCase()}`,
      },
      Limit: 1,
    })
  );

  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
}

/**
 * Get or create an area (used when adding properties)
 * @param {string} tenantId 
 * @param {string} areaName 
 * @param {string} city 
 * @returns {Promise<object>}
 */
export async function getOrCreateArea(tenantId, areaName, city) {
  if (!tenantId || !areaName || !city) {
    console.error('❌ getOrCreateArea called with missing params:', { tenantId, areaName, city });
    throw new Error('Tenant ID, Area Name, and City are required');
  }

  console.log(`🔍 Checking for existing area: ${areaName}, ${city} (tenant: ${tenantId})`);
  
  // Check if area exists
  const existing = await getAreaByName(tenantId, areaName, city);
  if (existing) {
    console.log(`✅ Found existing area:`, existing.areaId);
    return existing;
  }

  // Create new area
  console.log(`➕ Creating new area: ${areaName}, ${city}`);
  const newArea = await createArea(tenantId, {
    areaName,
    city,
    description: `${areaName}, ${city}`,
  });
  console.log(`✅ Created new area:`, newArea.areaId);
  return newArea;
}

/**
 * Increment property count for an area
 * @param {string} tenantId 
 * @param {string} areaId 
 * @returns {Promise<void>}
 */
export async function incrementAreaPropertyCount(tenantId, areaId) {
  if (!tenantId || !areaId) {
    console.warn('⚠️ incrementAreaPropertyCount called with missing params:', { tenantId, areaId });
    return;
  }

  console.log(`➕ Incrementing property count for area ${areaId}`);
  
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: AREAS_TABLE_NAME,
        Key: {
          PK: `TENANT#${tenantId}#AREA#${areaId}`,
          SK: 'PROFILE',
        },
        UpdateExpression: 'ADD propertyCount :inc SET updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':inc': 1,
          ':updatedAt': new Date().toISOString(),
        },
      })
    );
    console.log(`✅ Successfully incremented property count for area ${areaId}`);
  } catch (error) {
    console.error(`❌ Failed to increment property count for area ${areaId}:`, error);
    throw error;
  }
}
