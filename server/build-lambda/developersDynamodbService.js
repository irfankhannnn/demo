import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { wrapAwsClient } from './awsClientWrapper.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const REGION = process.env.AWS_REGION || 'ap-south-1';
const DEVELOPERS_TABLE_NAME = process.env.DEVELOPERS_TABLE_NAME;

if (!DEVELOPERS_TABLE_NAME) {
  console.warn('DEVELOPERS_TABLE_NAME is not set. Developers module will not work.');
}

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: DEVELOPERS_TABLE_NAME });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Generate URL-friendly slug from text
 */
function generateSlug(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Developers DynamoDB Schema:
 * 
 * PK: TENANT#{tenantId}#DEVELOPER#{developerId}
 * SK: PROFILE
 * 
 * GSI1 (search-index): GSI1PK = TENANT#{tenantId}#SEARCH, GSI1SK = DEVELOPER#{name.toLowerCase()}#{slug}
 * GSI2 (slug-index): GSI2PK = TENANT#{tenantId}#DEVELOPER_SLUG, GSI2SK = {slug}
 */

// ============== Developer CRUD Operations ==============

export async function createDeveloper(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!data.name) {
    throw new Error('Developer name is required');
  }

  const developerId = uuidv4();
  const slug = data.slug || generateSlug(data.name);
  const now = new Date().toISOString();

  // Check if slug already exists
  const existingDeveloper = await getDeveloperBySlug(tenantId, slug);
  if (existingDeveloper) {
    throw new Error(`Developer with slug "${slug}" already exists`);
  }

  const developer = {
    PK: `TENANT#${tenantId}#DEVELOPER#${developerId}`,
    SK: 'PROFILE',
    EntityType: 'DEVELOPER',
    tenantId,
    developerId,
    
    // Core Identity
    name: data.name,
    slug,
    
    // Company Information
    description: data.description || '',
    aboutText: data.aboutText || '',
    logoUrl: data.logoUrl || null,
    logoS3Key: data.logoS3Key || null,
    
    // Company Details
    headquarters: data.headquarters || '',
    establishedYear: data.establishedYear || null,
    companyType: data.companyType || 'Private', // Private, Public, Government
    website: data.website || null,
    email: data.email || null,
    phone: data.phone || null,
    
    // Legal/Registration (India & Dubai)
    reraRegistrationNumber: data.reraRegistrationNumber || null, // India RERA
    reraState: data.reraState || null, // Maharashtra, Karnataka, etc.
    dedLicenseNumber: data.dedLicenseNumber || null, // Dubai DED
    tradeLicenseNumber: data.tradeLicenseNumber || null,
    
    // Key Features
    keyFeatures: data.keyFeatures || [],
    specializations: data.specializations || [], // residential, commercial, mixed-use
    
    // Statistics (auto-updated)
    totalProjects: 0,
    completedProjects: 0,
    ongoingProjects: 0,
    totalUnitsDelivered: data.totalUnitsDelivered || 0,
    
    // Media
    images: data.images || [],
    videos: data.videos || [],
    
    // SEO & Marketing
    metaTitle: data.metaTitle || null,
    metaDescription: data.metaDescription || null,
    
    // Flags
    featured: data.featured || false,
    verified: data.verified || false,
    displayOrder: data.displayOrder || 999,
    
    // Status
    status: data.status || 'active', // active, inactive, archived
    visibility: data.visibility || 'public', // public, private, draft
    
    // Timestamps
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy || 'system',
    
    // GSI Keys
    GSI1PK: `TENANT#${tenantId}#SEARCH`,
    GSI1SK: `DEVELOPER#${data.name.toLowerCase()}#${slug}`,
    GSI2PK: `TENANT#${tenantId}#DEVELOPER_SLUG`,
    GSI2SK: slug,
  };

  await docClient.send(new PutCommand({
    TableName: DEVELOPERS_TABLE_NAME,
    Item: developer,
    ConditionExpression: 'attribute_not_exists(PK)',
  }));

  return developer;
}

export async function getDevelopers(tenantId, filters = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  let filterExpressions = ['tenantId = :tenantId', 'EntityType = :type'];
  const expressionAttributeValues = {
    ':tenantId': tenantId,
    ':type': 'DEVELOPER',
  };
  const expressionAttributeNames = {};

  if (filters.status) {
    filterExpressions.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = filters.status;
  }

  if (filters.featured !== undefined) {
    filterExpressions.push('featured = :featured');
    expressionAttributeValues[':featured'] = filters.featured;
  }

  if (filters.verified !== undefined) {
    filterExpressions.push('verified = :verified');
    expressionAttributeValues[':verified'] = filters.verified;
  }

  if (filters.visibility) {
    filterExpressions.push('visibility = :visibility');
    expressionAttributeValues[':visibility'] = filters.visibility;
  }

  const params = {
    TableName: DEVELOPERS_TABLE_NAME,
    FilterExpression: filterExpressions.join(' AND '),
    ExpressionAttributeValues: expressionAttributeValues,
  };

  if (Object.keys(expressionAttributeNames).length > 0) {
    params.ExpressionAttributeNames = expressionAttributeNames;
  }

  const result = await docClient.send(new ScanCommand(params));
  let developers = result.Items || [];

  // Sort by displayOrder, then by name
  developers.sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }
    return a.name.localeCompare(b.name);
  });

  // Apply pagination if needed
  if (filters.limit) {
    const offset = filters.offset || 0;
    developers = developers.slice(offset, offset + filters.limit);
  }

  return developers;
}

export async function getDeveloper(tenantId, developerId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const result = await docClient.send(new GetCommand({
    TableName: DEVELOPERS_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#DEVELOPER#${developerId}`,
      SK: 'PROFILE',
    },
  }));

  return result.Item || null;
}

export async function getDeveloperBySlug(tenantId, slug) {
  if (!tenantId || !slug) {
    return null;
  }

  const result = await docClient.send(new QueryCommand({
    TableName: DEVELOPERS_TABLE_NAME,
    IndexName: 'slug-index',
    KeyConditionExpression: 'GSI2PK = :pk AND GSI2SK = :sk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#DEVELOPER_SLUG`,
      ':sk': slug,
    },
  }));

  return result.Items?.[0] || null;
}

export async function updateDeveloper(tenantId, developerId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // Get current developer to check if it exists
  const currentDeveloper = await getDeveloper(tenantId, developerId);
  if (!currentDeveloper) {
    throw new Error('Developer not found');
  }

  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  // Add updatedAt
  data.updatedAt = new Date().toISOString();

  // Handle slug change
  if (data.slug && data.slug !== currentDeveloper.slug) {
    // Check if new slug exists
    const existingDeveloper = await getDeveloperBySlug(tenantId, data.slug);
    if (existingDeveloper && existingDeveloper.developerId !== developerId) {
      throw new Error(`Developer with slug "${data.slug}" already exists`);
    }
    data.GSI2SK = data.slug;
  }

  // Handle name change (update search index)
  if (data.name && data.name !== currentDeveloper.name) {
    const slug = data.slug || currentDeveloper.slug;
    data.GSI1SK = `DEVELOPER#${data.name.toLowerCase()}#${slug}`;
  }

  // Build update expression
  let index = 0;
  for (const [key, value] of Object.entries(data)) {
    // Skip PK, SK, and EntityType
    if (['PK', 'SK', 'EntityType', 'tenantId', 'developerId'].includes(key)) {
      continue;
    }
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateExpressions.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = value;
    index++;
  }

  if (updateExpressions.length === 0) {
    return currentDeveloper;
  }

  await docClient.send(new UpdateCommand({
    TableName: DEVELOPERS_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#DEVELOPER#${developerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));

  return await getDeveloper(tenantId, developerId);
}

export async function deleteDeveloper(tenantId, developerId, hardDelete = false) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  if (hardDelete) {
    await docClient.send(new DeleteCommand({
      TableName: DEVELOPERS_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#DEVELOPER#${developerId}`,
        SK: 'PROFILE',
      },
    }));
  } else {
    // Soft delete - set status to archived
    await updateDeveloper(tenantId, developerId, {
      status: 'archived',
      visibility: 'private',
    });
  }

  return true;
}

// ============== Developer Statistics ==============

export async function incrementDeveloperProjectCount(tenantId, developerId, countType = 'total') {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const fieldMap = {
    total: 'totalProjects',
    completed: 'completedProjects',
    ongoing: 'ongoingProjects',
  };

  const field = fieldMap[countType] || 'totalProjects';

  await docClient.send(new UpdateCommand({
    TableName: DEVELOPERS_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#DEVELOPER#${developerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET #field = if_not_exists(#field, :zero) + :inc, updatedAt = :now`,
    ExpressionAttributeNames: {
      '#field': field,
    },
    ExpressionAttributeValues: {
      ':zero': 0,
      ':inc': 1,
      ':now': new Date().toISOString(),
    },
  }));
}

export async function decrementDeveloperProjectCount(tenantId, developerId, countType = 'total') {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const fieldMap = {
    total: 'totalProjects',
    completed: 'completedProjects',
    ongoing: 'ongoingProjects',
  };

  const field = fieldMap[countType] || 'totalProjects';

  await docClient.send(new UpdateCommand({
    TableName: DEVELOPERS_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#DEVELOPER#${developerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET #field = if_not_exists(#field, :one) - :dec, updatedAt = :now`,
    ExpressionAttributeNames: {
      '#field': field,
    },
    ExpressionAttributeValues: {
      ':one': 1,
      ':dec': 1,
      ':now': new Date().toISOString(),
    },
  }));
}

export async function updateDeveloperProjectStats(tenantId, developerId, stats) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const updateExpressions = ['updatedAt = :now'];
  const attributeValues = { ':now': new Date().toISOString() };
  const attributeNames = {};

  if (stats.totalProjects !== undefined) {
    updateExpressions.push('#total = :total');
    attributeNames['#total'] = 'totalProjects';
    attributeValues[':total'] = stats.totalProjects;
  }

  if (stats.completedProjects !== undefined) {
    updateExpressions.push('#completed = :completed');
    attributeNames['#completed'] = 'completedProjects';
    attributeValues[':completed'] = stats.completedProjects;
  }

  if (stats.ongoingProjects !== undefined) {
    updateExpressions.push('#ongoing = :ongoing');
    attributeNames['#ongoing'] = 'ongoingProjects';
    attributeValues[':ongoing'] = stats.ongoingProjects;
  }

  await docClient.send(new UpdateCommand({
    TableName: DEVELOPERS_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#DEVELOPER#${developerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));
}

// ============== Search ==============

export async function searchDevelopers(tenantId, searchTerm) {
  if (!tenantId || !searchTerm) {
    return [];
  }

  const normalizedSearch = searchTerm.toLowerCase();

  // Use search index with begins_with
  const result = await docClient.send(new QueryCommand({
    TableName: DEVELOPERS_TABLE_NAME,
    IndexName: 'search-index',
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :search)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#SEARCH`,
      ':search': `DEVELOPER#${normalizedSearch}`,
    },
  }));

  return result.Items || [];
}

// ============== Metrics ==============

export async function getDeveloperMetrics(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const developers = await getDevelopers(tenantId);

  const metrics = {
    totalDevelopers: developers.length,
    activeDevelopers: developers.filter(d => d.status === 'active').length,
    verifiedDevelopers: developers.filter(d => d.verified).length,
    featuredDevelopers: developers.filter(d => d.featured).length,
    totalProjects: developers.reduce((sum, d) => sum + (d.totalProjects || 0), 0),
    completedProjects: developers.reduce((sum, d) => sum + (d.completedProjects || 0), 0),
    ongoingProjects: developers.reduce((sum, d) => sum + (d.ongoingProjects || 0), 0),
    bySpecialization: {},
    byCompanyType: {},
  };

  // Count by specialization
  developers.forEach(d => {
    (d.specializations || []).forEach(spec => {
      metrics.bySpecialization[spec] = (metrics.bySpecialization[spec] || 0) + 1;
    });
    const companyType = d.companyType || 'Private';
    metrics.byCompanyType[companyType] = (metrics.byCompanyType[companyType] || 0) + 1;
  });

  return metrics;
}
