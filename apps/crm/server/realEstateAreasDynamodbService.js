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
import { SERVICE_ACCOUNT_USER } from './utils/serviceAccount.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const REGION = process.env.AWS_REGION || 'ap-south-1';
const AREAS_TABLE_NAME = process.env.REAL_ESTATE_AREAS_TABLE_NAME;

if (!AREAS_TABLE_NAME) {
  console.warn('REAL_ESTATE_AREAS_TABLE_NAME is not set. Real Estate Areas module will not work.');
}

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: AREAS_TABLE_NAME });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Generate URL-friendly slug from text
 */
function generateSlug(text, city = '') {
  const baseSlug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  if (city) {
    const citySlug = city.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
    return `${baseSlug}-${citySlug}`;
  }
  return baseSlug;
}

/**
 * Real Estate Areas DynamoDB Schema:
 * 
 * PK: TENANT#{tenantId}#AREA#{areaId}
 * SK: PROFILE
 * 
 * GSI1 (search-index): GSI1PK = TENANT#{tenantId}#SEARCH, GSI1SK = AREA#{name.toLowerCase()}#{slug}
 * GSI2 (slug-index): GSI2PK = TENANT#{tenantId}#AREA_SLUG, GSI2SK = {slug}
 * GSI3 (location-index): GSI3PK = TENANT#{tenantId}#AREA_LOCATION#{country}#{city}, GSI3SK = AREA#{areaId}
 */

// ============== Area CRUD Operations ==============

export async function createArea(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!data.name) {
    throw new Error('Area name is required');
  }
  if (!data.city) {
    throw new Error('City is required');
  }

  const areaId = uuidv4();
  const slug = data.slug || generateSlug(data.name, data.city);
  const now = new Date().toISOString();
  const country = data.country || (data.city === 'Dubai' || data.emirate ? 'UAE' : 'India');

  // Check if slug already exists
  const existingArea = await getAreaBySlug(tenantId, slug);
  if (existingArea) {
    throw new Error(`Area with slug "${slug}" already exists`);
  }

  const area = {
    PK: `TENANT#${tenantId}#AREA#${areaId}`,
    SK: 'PROFILE',
    EntityType: 'REAL_ESTATE_AREA',
    tenantId,
    areaId,
    
    // Core Identity
    name: data.name,
    slug,
    
    // Location
    city: data.city,
    country,
    emirate: data.emirate || null, // Dubai specific
    district: data.district || null,
    state: data.state || null, // India specific
    pincode: data.pincode || null, // India specific
    
    // Area Overview
    description: data.description || '',
    overviewText: data.overviewText || '',
    tagline: data.tagline || null,
    
    // Size & Scale
    totalAreaSqFt: data.totalAreaSqFt || null,
    totalAreaAcres: data.totalAreaAcres || null,
    
    // Community Features
    communityFeatures: data.communityFeatures || {},
    
    // Amenities & Infrastructure
    amenities: data.amenities || [],
    
    // Nearby Landmarks
    nearbyLandmarks: data.nearbyLandmarks || [],
    
    // Connectivity & Transport
    accessibility: data.accessibility || {
      nearestMetro: null,
      metroDistanceKm: null,
      nearestMall: null,
      mallDistanceKm: null,
      airportDistanceKm: null,
      beachDistanceKm: null,
      downtownDistanceKm: null,
    },
    
    // Property Types Available
    propertyTypes: data.propertyTypes || [], // apartment, villa, townhouse, penthouse
    
    // Project Statistics (auto-updated)
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    
    // Price Range (auto-calculated from projects)
    priceRangeMin: data.priceRangeMin || null,
    priceRangeMax: data.priceRangeMax || null,
    currency: data.currency || (country === 'UAE' ? 'AED' : 'INR'),
    
    // Developer Association
    primaryDeveloper: data.primaryDeveloper || null,
    primaryDeveloperId: data.primaryDeveloperId || null,
    
    // Media
    images: data.images || [],
    videos: data.videos || [],
    virtualTour360Url: data.virtualTour360Url || null,
    
    // Geolocation
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    mapEmbedUrl: data.mapEmbedUrl || null,
    
    // Investment Highlights
    investmentHighlights: data.investmentHighlights || [],
    
    // Education & Healthcare
    nearbySchools: data.nearbySchools || [],
    nearbyHospitals: data.nearbyHospitals || [],
    
    // SEO & Marketing
    metaTitle: data.metaTitle || null,
    metaDescription: data.metaDescription || null,
    
    // Flags
    featured: data.featured || false,
    verified: data.verified || false,
    popularity: data.popularity || 0, // 0-100 score
    displayOrder: data.displayOrder || 999,
    
    // Status
    status: data.status || 'active', // active, inactive, planned, under-construction, archived
    visibility: data.visibility || 'public', // public, private, draft
    
    // Timestamps
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy || SERVICE_ACCOUNT_USER,
    
    // GSI Keys
    GSI1PK: `TENANT#${tenantId}#SEARCH`,
    GSI1SK: `AREA#${data.name.toLowerCase()}#${slug}`,
    GSI2PK: `TENANT#${tenantId}#AREA_SLUG`,
    GSI2SK: slug,
    GSI3PK: `TENANT#${tenantId}#AREA_LOCATION#${country}#${data.city}`,
    GSI3SK: `AREA#${areaId}`,
  };

  await docClient.send(new PutCommand({
    TableName: AREAS_TABLE_NAME,
    Item: area,
    ConditionExpression: 'attribute_not_exists(PK)',
  }));

  return area;
}

export async function getAreas(tenantId, filters = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  let filterExpressions = ['tenantId = :tenantId', 'EntityType = :type'];
  const expressionAttributeValues = {
    ':tenantId': tenantId,
    ':type': 'REAL_ESTATE_AREA',
  };
  const expressionAttributeNames = {};

  if (filters.status) {
    filterExpressions.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = filters.status;
  }

  if (filters.city) {
    filterExpressions.push('city = :city');
    expressionAttributeValues[':city'] = filters.city;
  }

  if (filters.country) {
    filterExpressions.push('country = :country');
    expressionAttributeValues[':country'] = filters.country;
  }

  if (filters.emirate) {
    filterExpressions.push('emirate = :emirate');
    expressionAttributeValues[':emirate'] = filters.emirate;
  }

  if (filters.featured !== undefined) {
    filterExpressions.push('featured = :featured');
    expressionAttributeValues[':featured'] = filters.featured;
  }

  if (filters.visibility) {
    filterExpressions.push('visibility = :visibility');
    expressionAttributeValues[':visibility'] = filters.visibility;
  }

  if (filters.propertyTypes && filters.propertyTypes.length > 0) {
    // Filter areas that contain at least one of the requested property types
    // This is a simplified approach - in production, consider using contains() for each type
  }

  const params = {
    TableName: AREAS_TABLE_NAME,
    FilterExpression: filterExpressions.join(' AND '),
    ExpressionAttributeValues: expressionAttributeValues,
  };

  if (Object.keys(expressionAttributeNames).length > 0) {
    params.ExpressionAttributeNames = expressionAttributeNames;
  }

  const result = await docClient.send(new ScanCommand(params));
  let areas = result.Items || [];

  // Sort by displayOrder, then by popularity (desc), then by name
  areas.sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }
    if ((b.popularity || 0) !== (a.popularity || 0)) {
      return (b.popularity || 0) - (a.popularity || 0);
    }
    return a.name.localeCompare(b.name);
  });

  // Apply pagination if needed
  if (filters.limit) {
    const offset = filters.offset || 0;
    areas = areas.slice(offset, offset + filters.limit);
  }

  return areas;
}

export async function getArea(tenantId, areaId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const result = await docClient.send(new GetCommand({
    TableName: AREAS_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#AREA#${areaId}`,
      SK: 'PROFILE',
    },
  }));

  return result.Item || null;
}

export async function getAreaBySlug(tenantId, slug) {
  if (!tenantId || !slug) {
    return null;
  }

  const result = await docClient.send(new QueryCommand({
    TableName: AREAS_TABLE_NAME,
    IndexName: 'slug-index',
    KeyConditionExpression: 'GSI2PK = :pk AND GSI2SK = :sk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#AREA_SLUG`,
      ':sk': slug,
    },
  }));

  return result.Items?.[0] || null;
}

export async function getAreasByCity(tenantId, city, country = null) {
  if (!tenantId || !city) {
    return [];
  }

  // Determine country if not provided
  const resolvedCountry = country || (city === 'Dubai' || city === 'Abu Dhabi' || city === 'Sharjah' ? 'UAE' : 'India');

  const result = await docClient.send(new QueryCommand({
    TableName: AREAS_TABLE_NAME,
    IndexName: 'location-index',
    KeyConditionExpression: 'GSI3PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#AREA_LOCATION#${resolvedCountry}#${city}`,
    },
  }));

  return result.Items || [];
}

export async function updateArea(tenantId, areaId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // Get current area to check if it exists
  const currentArea = await getArea(tenantId, areaId);
  if (!currentArea) {
    throw new Error('Area not found');
  }

  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  // Add updatedAt
  data.updatedAt = new Date().toISOString();

  // Handle slug change
  if (data.slug && data.slug !== currentArea.slug) {
    // Check if new slug exists
    const existingArea = await getAreaBySlug(tenantId, data.slug);
    if (existingArea && existingArea.areaId !== areaId) {
      throw new Error(`Area with slug "${data.slug}" already exists`);
    }
    data.GSI2SK = data.slug;
  }

  // Handle name change (update search index)
  if (data.name && data.name !== currentArea.name) {
    const slug = data.slug || currentArea.slug;
    data.GSI1SK = `AREA#${data.name.toLowerCase()}#${slug}`;
  }

  // Handle location change (update location index)
  if (data.city !== undefined || data.country !== undefined) {
    const city = data.city || currentArea.city;
    const country = data.country || currentArea.country;
    data.GSI3PK = `TENANT#${tenantId}#AREA_LOCATION#${country}#${city}`;
  }

  // Build update expression
  let index = 0;
  for (const [key, value] of Object.entries(data)) {
    // Skip PK, SK, and EntityType
    if (['PK', 'SK', 'EntityType', 'tenantId', 'areaId'].includes(key)) {
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
    return currentArea;
  }

  await docClient.send(new UpdateCommand({
    TableName: AREAS_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#AREA#${areaId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));

  return await getArea(tenantId, areaId);
}

export async function deleteArea(tenantId, areaId, hardDelete = false) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  if (hardDelete) {
    await docClient.send(new DeleteCommand({
      TableName: AREAS_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#AREA#${areaId}`,
        SK: 'PROFILE',
      },
    }));
  } else {
    // Soft delete - set status to archived
    await updateArea(tenantId, areaId, {
      status: 'archived',
      visibility: 'private',
    });
  }

  return true;
}

// ============== Area Statistics ==============

export async function incrementAreaProjectCount(tenantId, areaId, countType = 'total') {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const fieldMap = {
    total: 'totalProjects',
    active: 'activeProjects',
    completed: 'completedProjects',
  };

  const field = fieldMap[countType] || 'totalProjects';

  await docClient.send(new UpdateCommand({
    TableName: AREAS_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#AREA#${areaId}`,
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

export async function decrementAreaProjectCount(tenantId, areaId, countType = 'total') {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const fieldMap = {
    total: 'totalProjects',
    active: 'activeProjects',
    completed: 'completedProjects',
  };

  const field = fieldMap[countType] || 'totalProjects';

  await docClient.send(new UpdateCommand({
    TableName: AREAS_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#AREA#${areaId}`,
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

export async function updateAreaPriceRange(tenantId, areaId, priceMin, priceMax) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const area = await getArea(tenantId, areaId);
  if (!area) {
    return;
  }

  const updates = { updatedAt: new Date().toISOString() };

  // Update min if lower or not set
  if (priceMin && (!area.priceRangeMin || priceMin < area.priceRangeMin)) {
    updates.priceRangeMin = priceMin;
  }

  // Update max if higher or not set
  if (priceMax && (!area.priceRangeMax || priceMax > area.priceRangeMax)) {
    updates.priceRangeMax = priceMax;
  }

  if (Object.keys(updates).length > 1) {
    await updateArea(tenantId, areaId, updates);
  }
}

// ============== Search ==============

export async function searchAreas(tenantId, searchTerm) {
  if (!tenantId || !searchTerm) {
    return [];
  }

  const normalizedSearch = searchTerm.toLowerCase();

  // Use search index with begins_with
  const result = await docClient.send(new QueryCommand({
    TableName: AREAS_TABLE_NAME,
    IndexName: 'search-index',
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :search)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#SEARCH`,
      ':search': `AREA#${normalizedSearch}`,
    },
  }));

  return result.Items || [];
}

// ============== Metrics ==============

export async function getAreaMetrics(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const areas = await getAreas(tenantId);

  const metrics = {
    totalAreas: areas.length,
    activeAreas: areas.filter(a => a.status === 'active').length,
    featuredAreas: areas.filter(a => a.featured).length,
    totalProjects: areas.reduce((sum, a) => sum + (a.totalProjects || 0), 0),
    activeProjects: areas.reduce((sum, a) => sum + (a.activeProjects || 0), 0),
    byCity: {},
    byCountry: {},
    byPropertyType: {},
  };

  // Count by city
  areas.forEach(a => {
    const city = a.city || 'Unknown';
    metrics.byCity[city] = (metrics.byCity[city] || 0) + 1;
    
    const country = a.country || 'Unknown';
    metrics.byCountry[country] = (metrics.byCountry[country] || 0) + 1;
    
    (a.propertyTypes || []).forEach(pt => {
      metrics.byPropertyType[pt] = (metrics.byPropertyType[pt] || 0) + 1;
    });
  });

  return metrics;
}
