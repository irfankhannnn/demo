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
import { incrementDeveloperProjectCount, decrementDeveloperProjectCount, getDeveloper } from './developersDynamodbService.js';
import { incrementAreaProjectCount, decrementAreaProjectCount, updateAreaPriceRange, getArea } from './realEstateAreasDynamodbService.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const REGION = process.env.AWS_REGION || 'ap-south-1';
const PROJECTS_TABLE_NAME = process.env.PROJECTS_TABLE_NAME;

if (!PROJECTS_TABLE_NAME) {
  console.warn('PROJECTS_TABLE_NAME is not set. Projects module will not work.');
}

const client = wrapAwsClient(new DynamoDBClient({ region: REGION }), 'DynamoDB', { tableName: PROJECTS_TABLE_NAME });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Generate URL-friendly slug from text
 */
function generateSlug(text, location = '') {
  const baseSlug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  if (location) {
    const locationSlug = location.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
    return `${baseSlug}-${locationSlug}`;
  }
  return baseSlug;
}

/**
 * Projects DynamoDB Schema:
 * 
 * PK: TENANT#{tenantId}#PROJECT#{projectId}
 * SK: PROFILE
 * 
 * GSI1 (developer-index): GSI1PK = TENANT#{tenantId}#DEVELOPER#{developerId}, GSI1SK = PROJECT#{projectId}
 * GSI2 (area-index): GSI2PK = TENANT#{tenantId}#AREA#{areaId}, GSI2SK = PROJECT#{projectId}
 * GSI3 (status-index): GSI3PK = TENANT#{tenantId}#PROJECT_STATUS#{status}, GSI3SK = PROJECT#{projectId}
 * GSI4 (search-index): GSI4PK = TENANT#{tenantId}#SEARCH, GSI4SK = PROJECT#{name.toLowerCase()}#{slug}
 * GSI5 (slug-index): GSI5PK = TENANT#{tenantId}#PROJECT_SLUG, GSI5SK = {slug}
 */

// ============== Project CRUD Operations ==============

export async function createProject(tenantId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }
  if (!data.name) {
    throw new Error('Project name is required');
  }
  if (!data.developerId) {
    throw new Error('Developer ID is required');
  }
  if (!data.areaId) {
    throw new Error('Area ID is required');
  }

  // Validate developer exists
  const developer = await getDeveloper(tenantId, data.developerId);
  if (!developer) {
    throw new Error('Developer not found');
  }

  // Validate area exists
  const area = await getArea(tenantId, data.areaId);
  if (!area) {
    throw new Error('Area not found');
  }

  const projectId = uuidv4();
  const slug = data.slug || generateSlug(data.name, area.city || area.name);
  const now = new Date().toISOString();
  const country = area.country || 'UAE';
  const currency = data.currency || (country === 'UAE' ? 'AED' : 'INR');

  // Check if slug already exists
  const existingProject = await getProjectBySlug(tenantId, slug);
  if (existingProject) {
    throw new Error(`Project with slug "${slug}" already exists`);
  }

  const project = {
    PK: `TENANT#${tenantId}#PROJECT#${projectId}`,
    SK: 'PROFILE',
    EntityType: 'PROJECT',
    tenantId,
    projectId,
    
    // Core Identity
    name: data.name,
    slug,
    
    // Associations (denormalized for quick access)
    developerId: data.developerId,
    developerName: developer.name,
    developerSlug: developer.slug,
    areaId: data.areaId,
    areaName: area.name,
    areaSlug: area.slug,
    
    // Project Overview
    tagline: data.tagline || null,
    description: data.description || '',
    fullDescription: data.fullDescription || '',
    
    // Project Type & Category
    projectType: data.projectType || 'residential', // residential, commercial, mixed-use
    propertyCategory: data.propertyCategory || 'off-plan', // off-plan, ready, secondary
    
    // Property Types Offered
    propertyTypes: data.propertyTypes || [],
    /*
    propertyTypes: [
      {
        type: "apartment", // apartment, penthouse, duplex, villa, townhouse, plot
        bedrooms: "2-BR",
        bedroomsMin: 2,
        bedroomsMax: 2,
        areaMin: 1200,
        areaMax: 1400,
        areaUnit: "sq ft",
        priceMin: 5000000,
        priceMax: 6000000,
        priceOnRequest: false,
        availability: "available" // available, limited, sold-out
      }
    ]
    */
    
    // Pricing
    startingPrice: data.startingPrice || null,
    startingPriceCurrency: currency,
    priceRangeMin: data.priceRangeMin || data.startingPrice || null,
    priceRangeMax: data.priceRangeMax || null,
    pricePerSqFt: data.pricePerSqFt || null,
    currency,
    
    // Project Scale
    totalUnits: data.totalUnits || null,
    totalFloors: data.totalFloors || null,
    totalBuildings: data.totalBuildings || 1,
    totalTowers: data.totalTowers || null,
    
    // Timeline
    launchDate: data.launchDate || null,
    handoverDate: data.handoverDate || null,
    handoverQuarter: data.handoverQuarter || null, // Q1, Q2, Q3, Q4
    handoverYear: data.handoverYear || null,
    constructionStatus: data.constructionStatus || 'planned', // planned, under-construction, nearing-completion, completed
    completionPercentage: data.completionPercentage || 0,
    
    // Payment Plan
    paymentPlan: data.paymentPlan || {
      planType: null, // 60/40, 70/30, 80/20, construction-linked, post-handover
      bookingPercentage: null,
      duringConstructionPercentage: null,
      onHandoverPercentage: null,
      postHandoverPercentage: null,
      postHandoverYears: null,
      installments: [],
      specialOffers: {},
      notes: null,
    },
    
    // Amenities & Features
    amenities: data.amenities || [],
    keyFeatures: data.keyFeatures || [],
    
    // Location Details
    address: data.address || null,
    city: area.city,
    country,
    latitude: data.latitude || area.latitude || null,
    longitude: data.longitude || area.longitude || null,
    
    // Nearby Landmarks
    nearbyLandmarks: data.nearbyLandmarks || [],
    
    // Investment Potential
    investmentHighlights: data.investmentHighlights || [],
    expectedROI: data.expectedROI || null,
    rentalYield: data.rentalYield || null,
    
    // Legal & Compliance (India)
    reraNumber: data.reraNumber || null, // RERA registration number
    reraState: data.reraState || null,
    reraApprovalDate: data.reraApprovalDate || null,
    reraExpiryDate: data.reraExpiryDate || null,
    
    // Legal & Compliance (Dubai/UAE)
    oqoodNumber: data.oqoodNumber || null, // Oqood registration
    escrowAccountNumber: data.escrowAccountNumber || null,
    escrowBankName: data.escrowBankName || null,
    
    // Documents
    documents: data.documents || {
      brochure: null,
      floorPlans: [],
      masterPlan: null,
      priceList: null,
      paymentPlanDoc: null,
      reraDocument: null,
      oqoodDocument: null,
    },
    
    // Media Assets
    images: data.images || [],
    videos: data.videos || [],
    virtualTour360Url: data.virtualTour360Url || null,
    
    // FAQs
    faqs: data.faqs || [],
    
    // SEO & Marketing
    metaTitle: data.metaTitle || null,
    metaDescription: data.metaDescription || null,
    keywords: data.keywords || [],
    
    // Tags & Flags
    tags: data.tags || [],
    featured: data.featured || false,
    verified: data.verified || false,
    trending: data.trending || false,
    newLaunch: data.newLaunch || false,
    soldOut: data.soldOut || false,
    
    // Engagement Metrics
    views: 0,
    enquiries: 0,
    popularity: data.popularity || 0, // 0-100 score
    
    // Inventory
    inventory: data.inventory || {
      totalUnits: data.totalUnits || 0,
      availableUnits: data.totalUnits || 0,
      reservedUnits: 0,
      soldUnits: 0,
      blockedUnits: 0,
      breakdown: [],
      lastUpdated: now,
    },
    
    // Availability
    unitsAvailable: data.totalUnits || 0,
    unitsSold: 0,
    availabilityStatus: 'available', // available, limited, sold-out
    
    // Status
    status: data.status || 'active', // active, inactive, archived
    visibility: data.visibility || 'public', // public, private, draft
    displayOrder: data.displayOrder || 999,
    
    // Lifecycle
    lifecycle: {
      currentStatus: data.constructionStatus || 'planned',
      statusHistory: [
        {
          status: data.constructionStatus || 'planned',
          date: now,
          updatedBy: data.createdBy || 'system',
        },
      ],
      constructionMilestones: data.constructionMilestones || [],
      overallCompletionPercentage: data.completionPercentage || 0,
    },
    
    // Timestamps
    createdAt: now,
    updatedAt: now,
    publishedAt: data.visibility === 'public' ? now : null,
    createdBy: data.createdBy || 'system',
    
    // GSI Keys
    GSI1PK: `TENANT#${tenantId}#DEVELOPER#${data.developerId}`,
    GSI1SK: `PROJECT#${projectId}`,
    GSI2PK: `TENANT#${tenantId}#AREA#${data.areaId}`,
    GSI2SK: `PROJECT#${projectId}`,
    GSI3PK: `TENANT#${tenantId}#PROJECT_STATUS#${data.status || 'active'}`,
    GSI3SK: `PROJECT#${projectId}`,
    GSI4PK: `TENANT#${tenantId}#SEARCH`,
    GSI4SK: `PROJECT#${data.name.toLowerCase()}#${slug}`,
    GSI5PK: `TENANT#${tenantId}#PROJECT_SLUG`,
    GSI5SK: slug,
  };

  await docClient.send(new PutCommand({
    TableName: PROJECTS_TABLE_NAME,
    Item: project,
    ConditionExpression: 'attribute_not_exists(PK)',
  }));

  // Update developer and area project counts
  try {
    await incrementDeveloperProjectCount(tenantId, data.developerId, 'total');
    await incrementDeveloperProjectCount(tenantId, data.developerId, 'ongoing');
  } catch (error) {
    console.error('Error updating developer project count:', error);
  }

  try {
    await incrementAreaProjectCount(tenantId, data.areaId, 'total');
    await incrementAreaProjectCount(tenantId, data.areaId, 'active');
    
    // Update area price range
    if (project.startingPrice) {
      await updateAreaPriceRange(tenantId, data.areaId, project.startingPrice, project.priceRangeMax);
    }
  } catch (error) {
    console.error('Error updating area project count:', error);
  }

  return project;
}

export async function getProjects(tenantId, filters = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  let filterExpressions = ['tenantId = :tenantId', 'EntityType = :type'];
  const expressionAttributeValues = {
    ':tenantId': tenantId,
    ':type': 'PROJECT',
  };
  const expressionAttributeNames = {};

  if (filters.status) {
    filterExpressions.push('#status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = filters.status;
  }

  if (filters.developerId) {
    filterExpressions.push('developerId = :developerId');
    expressionAttributeValues[':developerId'] = filters.developerId;
  }

  if (filters.areaId) {
    filterExpressions.push('areaId = :areaId');
    expressionAttributeValues[':areaId'] = filters.areaId;
  }

  if (filters.projectType) {
    filterExpressions.push('projectType = :projectType');
    expressionAttributeValues[':projectType'] = filters.projectType;
  }

  if (filters.propertyCategory) {
    filterExpressions.push('propertyCategory = :propertyCategory');
    expressionAttributeValues[':propertyCategory'] = filters.propertyCategory;
  }

  if (filters.constructionStatus) {
    filterExpressions.push('constructionStatus = :constructionStatus');
    expressionAttributeValues[':constructionStatus'] = filters.constructionStatus;
  }

  if (filters.handoverYear) {
    filterExpressions.push('handoverYear = :handoverYear');
    expressionAttributeValues[':handoverYear'] = filters.handoverYear;
  }

  if (filters.city) {
    filterExpressions.push('city = :city');
    expressionAttributeValues[':city'] = filters.city;
  }

  if (filters.country) {
    filterExpressions.push('country = :country');
    expressionAttributeValues[':country'] = filters.country;
  }

  if (filters.featured !== undefined) {
    filterExpressions.push('featured = :featured');
    expressionAttributeValues[':featured'] = filters.featured;
  }

  if (filters.trending !== undefined) {
    filterExpressions.push('trending = :trending');
    expressionAttributeValues[':trending'] = filters.trending;
  }

  if (filters.newLaunch !== undefined) {
    filterExpressions.push('newLaunch = :newLaunch');
    expressionAttributeValues[':newLaunch'] = filters.newLaunch;
  }

  if (filters.soldOut !== undefined) {
    filterExpressions.push('soldOut = :soldOut');
    expressionAttributeValues[':soldOut'] = filters.soldOut;
  }

  if (filters.visibility) {
    filterExpressions.push('visibility = :visibility');
    expressionAttributeValues[':visibility'] = filters.visibility;
  }

  if (filters.priceMin) {
    filterExpressions.push('startingPrice >= :priceMin');
    expressionAttributeValues[':priceMin'] = filters.priceMin;
  }

  if (filters.priceMax) {
    filterExpressions.push('(startingPrice <= :priceMax OR attribute_not_exists(startingPrice))');
    expressionAttributeValues[':priceMax'] = filters.priceMax;
  }

  const params = {
    TableName: PROJECTS_TABLE_NAME,
    FilterExpression: filterExpressions.join(' AND '),
    ExpressionAttributeValues: expressionAttributeValues,
  };

  if (Object.keys(expressionAttributeNames).length > 0) {
    params.ExpressionAttributeNames = expressionAttributeNames;
  }

  const result = await docClient.send(new ScanCommand(params));
  let projects = result.Items || [];

  // Sort based on sortBy parameter
  const sortBy = filters.sortBy || 'displayOrder';
  const sortOrder = filters.sortOrder || 'asc';

  projects.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'startingPrice':
        comparison = (a.startingPrice || 0) - (b.startingPrice || 0);
        break;
      case 'handoverDate':
        comparison = (a.handoverDate || '').localeCompare(b.handoverDate || '');
        break;
      case 'popularity':
        comparison = (b.popularity || 0) - (a.popularity || 0);
        break;
      case 'views':
        comparison = (b.views || 0) - (a.views || 0);
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'createdAt':
        comparison = (b.createdAt || '').localeCompare(a.createdAt || '');
        break;
      default:
        comparison = (a.displayOrder || 999) - (b.displayOrder || 999);
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  // Apply pagination if needed
  if (filters.limit) {
    const offset = filters.offset || 0;
    projects = projects.slice(offset, offset + filters.limit);
  }

  return projects;
}

export async function getProject(tenantId, projectId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const result = await docClient.send(new GetCommand({
    TableName: PROJECTS_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROJECT#${projectId}`,
      SK: 'PROFILE',
    },
  }));

  return result.Item || null;
}

export async function getProjectBySlug(tenantId, slug) {
  if (!tenantId || !slug) {
    return null;
  }

  const result = await docClient.send(new QueryCommand({
    TableName: PROJECTS_TABLE_NAME,
    IndexName: 'slug-index',
    KeyConditionExpression: 'GSI5PK = :pk AND GSI5SK = :sk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#PROJECT_SLUG`,
      ':sk': slug,
    },
  }));

  return result.Items?.[0] || null;
}

export async function getProjectsByDeveloper(tenantId, developerId) {
  if (!tenantId || !developerId) {
    return [];
  }

  const result = await docClient.send(new QueryCommand({
    TableName: PROJECTS_TABLE_NAME,
    IndexName: 'developer-index',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#DEVELOPER#${developerId}`,
    },
  }));

  return result.Items || [];
}

export async function getProjectsByArea(tenantId, areaId) {
  if (!tenantId || !areaId) {
    return [];
  }

  const result = await docClient.send(new QueryCommand({
    TableName: PROJECTS_TABLE_NAME,
    IndexName: 'area-index',
    KeyConditionExpression: 'GSI2PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#AREA#${areaId}`,
    },
  }));

  return result.Items || [];
}

export async function getProjectsByStatus(tenantId, status) {
  if (!tenantId || !status) {
    return [];
  }

  const result = await docClient.send(new QueryCommand({
    TableName: PROJECTS_TABLE_NAME,
    IndexName: 'status-index',
    KeyConditionExpression: 'GSI3PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#PROJECT_STATUS#${status}`,
    },
  }));

  return result.Items || [];
}

export async function updateProject(tenantId, projectId, data) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  // Get current project to check if it exists
  const currentProject = await getProject(tenantId, projectId);
  if (!currentProject) {
    throw new Error('Project not found');
  }

  const updateExpressions = [];
  const attributeNames = {};
  const attributeValues = {};

  // Add updatedAt
  data.updatedAt = new Date().toISOString();

  // Handle slug change
  if (data.slug && data.slug !== currentProject.slug) {
    const existingProject = await getProjectBySlug(tenantId, data.slug);
    if (existingProject && existingProject.projectId !== projectId) {
      throw new Error(`Project with slug "${data.slug}" already exists`);
    }
    data.GSI5SK = data.slug;
  }

  // Handle name change (update search index)
  if (data.name && data.name !== currentProject.name) {
    const slug = data.slug || currentProject.slug;
    data.GSI4SK = `PROJECT#${data.name.toLowerCase()}#${slug}`;
  }

  // Handle developer change
  if (data.developerId && data.developerId !== currentProject.developerId) {
    const newDeveloper = await getDeveloper(tenantId, data.developerId);
    if (!newDeveloper) {
      throw new Error('New developer not found');
    }
    data.developerName = newDeveloper.name;
    data.developerSlug = newDeveloper.slug;
    data.GSI1PK = `TENANT#${tenantId}#DEVELOPER#${data.developerId}`;

    // Update old developer's count
    try {
      await decrementDeveloperProjectCount(tenantId, currentProject.developerId, 'total');
      await decrementDeveloperProjectCount(tenantId, currentProject.developerId, 'ongoing');
    } catch (error) {
      console.error('Error decrementing old developer count:', error);
    }

    // Update new developer's count
    try {
      await incrementDeveloperProjectCount(tenantId, data.developerId, 'total');
      await incrementDeveloperProjectCount(tenantId, data.developerId, 'ongoing');
    } catch (error) {
      console.error('Error incrementing new developer count:', error);
    }
  }

  // Handle area change
  if (data.areaId && data.areaId !== currentProject.areaId) {
    const newArea = await getArea(tenantId, data.areaId);
    if (!newArea) {
      throw new Error('New area not found');
    }
    data.areaName = newArea.name;
    data.areaSlug = newArea.slug;
    data.city = newArea.city;
    data.country = newArea.country;
    data.GSI2PK = `TENANT#${tenantId}#AREA#${data.areaId}`;

    // Update old area's count
    try {
      await decrementAreaProjectCount(tenantId, currentProject.areaId, 'total');
      await decrementAreaProjectCount(tenantId, currentProject.areaId, 'active');
    } catch (error) {
      console.error('Error decrementing old area count:', error);
    }

    // Update new area's count
    try {
      await incrementAreaProjectCount(tenantId, data.areaId, 'total');
      await incrementAreaProjectCount(tenantId, data.areaId, 'active');
    } catch (error) {
      console.error('Error incrementing new area count:', error);
    }
  }

  // Handle status change
  if (data.status && data.status !== currentProject.status) {
    data.GSI3PK = `TENANT#${tenantId}#PROJECT_STATUS#${data.status}`;
  }

  // Build update expression
  let index = 0;
  for (const [key, value] of Object.entries(data)) {
    if (['PK', 'SK', 'EntityType', 'tenantId', 'projectId'].includes(key)) {
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
    return currentProject;
  }

  await docClient.send(new UpdateCommand({
    TableName: PROJECTS_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROJECT#${projectId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: attributeNames,
    ExpressionAttributeValues: attributeValues,
  }));

  return await getProject(tenantId, projectId);
}

export async function deleteProject(tenantId, projectId, hardDelete = false) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const project = await getProject(tenantId, projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  if (hardDelete) {
    await docClient.send(new DeleteCommand({
      TableName: PROJECTS_TABLE_NAME,
      Key: {
        PK: `TENANT#${tenantId}#PROJECT#${projectId}`,
        SK: 'PROFILE',
      },
    }));

    // Update developer count
    try {
      await decrementDeveloperProjectCount(tenantId, project.developerId, 'total');
      if (project.constructionStatus !== 'completed') {
        await decrementDeveloperProjectCount(tenantId, project.developerId, 'ongoing');
      }
    } catch (error) {
      console.error('Error updating developer count:', error);
    }

    // Update area count
    try {
      await decrementAreaProjectCount(tenantId, project.areaId, 'total');
      if (project.status === 'active') {
        await decrementAreaProjectCount(tenantId, project.areaId, 'active');
      }
    } catch (error) {
      console.error('Error updating area count:', error);
    }
  } else {
    // Soft delete
    await updateProject(tenantId, projectId, {
      status: 'archived',
      visibility: 'private',
    });
  }

  return true;
}

// ============== Project Lifecycle Management ==============

export async function updateProjectLifecycleStatus(tenantId, projectId, newStatus, metadata = {}) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const validStatuses = ['planned', 'launched', 'booking-open', 'under-construction', 'nearing-completion', 'ready-to-move', 'completed', 'sold-out'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const project = await getProject(tenantId, projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const now = new Date().toISOString();
  const lifecycle = project.lifecycle || { statusHistory: [], constructionMilestones: [] };

  // Add to status history
  lifecycle.statusHistory.push({
    status: newStatus,
    date: now,
    updatedBy: metadata.updatedBy || 'system',
    notes: metadata.notes || null,
  });
  lifecycle.currentStatus = newStatus;

  const updates = {
    constructionStatus: newStatus,
    lifecycle,
    updatedAt: now,
  };

  // Handle specific status transitions
  if (newStatus === 'completed') {
    updates.completionPercentage = 100;
    lifecycle.overallCompletionPercentage = 100;

    // Update developer completed count
    try {
      await incrementDeveloperProjectCount(tenantId, project.developerId, 'completed');
      await decrementDeveloperProjectCount(tenantId, project.developerId, 'ongoing');
    } catch (error) {
      console.error('Error updating developer counts:', error);
    }

    // Update area completed count
    try {
      await incrementAreaProjectCount(tenantId, project.areaId, 'completed');
      await decrementAreaProjectCount(tenantId, project.areaId, 'active');
    } catch (error) {
      console.error('Error updating area counts:', error);
    }
  }

  if (newStatus === 'sold-out') {
    updates.soldOut = true;
    updates.availabilityStatus = 'sold-out';
    updates.unitsAvailable = 0;
  }

  if (newStatus === 'ready-to-move') {
    updates.propertyCategory = 'ready';
  }

  if (metadata.completionPercentage !== undefined) {
    updates.completionPercentage = metadata.completionPercentage;
    lifecycle.overallCompletionPercentage = metadata.completionPercentage;
  }

  return await updateProject(tenantId, projectId, updates);
}

// ============== Project Inventory Management ==============

export async function updateProjectInventory(tenantId, projectId, inventoryUpdate) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const project = await getProject(tenantId, projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const now = new Date().toISOString();
  const inventory = project.inventory || {
    totalUnits: project.totalUnits || 0,
    availableUnits: project.totalUnits || 0,
    reservedUnits: 0,
    soldUnits: 0,
    blockedUnits: 0,
    breakdown: [],
    lastUpdated: now,
  };

  // Apply updates
  if (inventoryUpdate.totalUnits !== undefined) {
    inventory.totalUnits = inventoryUpdate.totalUnits;
  }
  if (inventoryUpdate.availableUnits !== undefined) {
    inventory.availableUnits = inventoryUpdate.availableUnits;
  }
  if (inventoryUpdate.reservedUnits !== undefined) {
    inventory.reservedUnits = inventoryUpdate.reservedUnits;
  }
  if (inventoryUpdate.soldUnits !== undefined) {
    inventory.soldUnits = inventoryUpdate.soldUnits;
  }
  if (inventoryUpdate.blockedUnits !== undefined) {
    inventory.blockedUnits = inventoryUpdate.blockedUnits;
  }
  if (inventoryUpdate.breakdown) {
    inventory.breakdown = inventoryUpdate.breakdown;
  }

  inventory.lastUpdated = now;

  // Determine availability status
  let availabilityStatus = 'available';
  if (inventory.availableUnits === 0) {
    availabilityStatus = 'sold-out';
  } else if (inventory.availableUnits < inventory.totalUnits * 0.1) {
    availabilityStatus = 'limited';
  }

  return await updateProject(tenantId, projectId, {
    inventory,
    unitsAvailable: inventory.availableUnits,
    unitsSold: inventory.soldUnits,
    availabilityStatus,
    soldOut: availabilityStatus === 'sold-out',
  });
}

export async function markUnitSold(tenantId, projectId, unitType = null, quantity = 1) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const project = await getProject(tenantId, projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const inventory = project.inventory || {};
  inventory.soldUnits = (inventory.soldUnits || 0) + quantity;
  inventory.availableUnits = Math.max(0, (inventory.availableUnits || 0) - quantity);

  // Update breakdown if unitType provided
  if (unitType && inventory.breakdown) {
    const typeIndex = inventory.breakdown.findIndex(b => b.type === unitType);
    if (typeIndex !== -1) {
      inventory.breakdown[typeIndex].sold = (inventory.breakdown[typeIndex].sold || 0) + quantity;
      inventory.breakdown[typeIndex].available = Math.max(0, inventory.breakdown[typeIndex].available - quantity);
    }
  }

  return await updateProjectInventory(tenantId, projectId, inventory);
}

// ============== Engagement Tracking ==============

export async function incrementProjectViews(tenantId, projectId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  await docClient.send(new UpdateCommand({
    TableName: PROJECTS_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROJECT#${projectId}`,
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

export async function incrementProjectEnquiries(tenantId, projectId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  await docClient.send(new UpdateCommand({
    TableName: PROJECTS_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROJECT#${projectId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET enquiries = if_not_exists(enquiries, :zero) + :inc, updatedAt = :now',
    ExpressionAttributeValues: {
      ':zero': 0,
      ':inc': 1,
      ':now': new Date().toISOString(),
    },
  }));
}

// ============== Search ==============

export async function searchProjects(tenantId, searchTerm) {
  if (!tenantId || !searchTerm) {
    return [];
  }

  const normalizedSearch = searchTerm.toLowerCase();

  const result = await docClient.send(new QueryCommand({
    TableName: PROJECTS_TABLE_NAME,
    IndexName: 'search-index',
    KeyConditionExpression: 'GSI4PK = :pk AND begins_with(GSI4SK, :search)',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#SEARCH`,
      ':search': `PROJECT#${normalizedSearch}`,
    },
  }));

  return result.Items || [];
}

// ============== Metrics ==============

export async function getProjectMetrics(tenantId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const projects = await getProjects(tenantId);

  const metrics = {
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === 'active').length,
    featuredProjects: projects.filter(p => p.featured).length,
    trendingProjects: projects.filter(p => p.trending).length,
    soldOutProjects: projects.filter(p => p.soldOut).length,
    totalViews: projects.reduce((sum, p) => sum + (p.views || 0), 0),
    totalEnquiries: projects.reduce((sum, p) => sum + (p.enquiries || 0), 0),
    totalUnits: projects.reduce((sum, p) => sum + (p.totalUnits || 0), 0),
    availableUnits: projects.reduce((sum, p) => sum + (p.unitsAvailable || 0), 0),
    soldUnits: projects.reduce((sum, p) => sum + (p.unitsSold || 0), 0),
    byConstructionStatus: {},
    byProjectType: {},
    byCity: {},
    byHandoverYear: {},
    priceRange: {
      min: null,
      max: null,
    },
  };

  projects.forEach(p => {
    // By construction status
    const cs = p.constructionStatus || 'unknown';
    metrics.byConstructionStatus[cs] = (metrics.byConstructionStatus[cs] || 0) + 1;

    // By project type
    const pt = p.projectType || 'residential';
    metrics.byProjectType[pt] = (metrics.byProjectType[pt] || 0) + 1;

    // By city
    const city = p.city || 'Unknown';
    metrics.byCity[city] = (metrics.byCity[city] || 0) + 1;

    // By handover year
    if (p.handoverYear) {
      metrics.byHandoverYear[p.handoverYear] = (metrics.byHandoverYear[p.handoverYear] || 0) + 1;
    }

    // Price range
    if (p.startingPrice) {
      if (!metrics.priceRange.min || p.startingPrice < metrics.priceRange.min) {
        metrics.priceRange.min = p.startingPrice;
      }
      if (!metrics.priceRange.max || p.startingPrice > metrics.priceRange.max) {
        metrics.priceRange.max = p.startingPrice;
      }
    }
  });

  return metrics;
}

export async function getProjectDetailedMetrics(tenantId, projectId) {
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  const project = await getProject(tenantId, projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  return {
    projectId,
    name: project.name,
    views: project.views || 0,
    enquiries: project.enquiries || 0,
    popularity: project.popularity || 0,
    inventory: project.inventory || {},
    unitsAvailable: project.unitsAvailable || 0,
    unitsSold: project.unitsSold || 0,
    availabilityStatus: project.availabilityStatus || 'available',
    completionPercentage: project.completionPercentage || 0,
    constructionStatus: project.constructionStatus || 'planned',
    conversionRate: project.enquiries > 0 ? ((project.unitsSold || 0) / project.enquiries * 100).toFixed(2) : 0,
  };
}
