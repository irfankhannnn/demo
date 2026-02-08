/**
 * Helper functions for managing post-transaction operations
 * Buyer purchases, Tenant rentals, Property listings
 */

import { docClient, CRM_TABLE_NAME } from './crmDynamodbService.js';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// ============== BUYER Purchase Management ==============

/**
 * Add a new purchase to an existing buyer
 */
export async function addPurchaseToBuyer(tenantId, buyerId, purchaseDetails) {
  if (!tenantId || !buyerId) throw new Error('Tenant ID and Buyer ID are required');
  if (!purchaseDetails.propertyId) throw new Error('Property ID is required');

  // Get existing buyer
  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
  }));

  const buyer = result.Item;
  if (!buyer) throw new Error('Buyer not found');

  const newPurchase = {
    propertyId: purchaseDetails.propertyId,
    purchaseDate: purchaseDetails.purchaseDate || new Date().toISOString(),
    saleAmount: purchaseDetails.saleAmount || 0,
    registrationDate: purchaseDetails.registrationDate || null,
    registrationNumber: purchaseDetails.registrationNumber || null,
    saleDeedS3Key: purchaseDetails.saleDeedS3Key || null,
    saleDeedUrl: purchaseDetails.saleDeedUrl || null,
    registrationDocS3Key: purchaseDetails.registrationDocS3Key || null,
    registrationDocUrl: purchaseDetails.registrationDocUrl || null,
    stampDutyPaid: purchaseDetails.stampDutyPaid || 0,
    registrationCharges: purchaseDetails.registrationCharges || 0,
    brokeragePaid: purchaseDetails.brokeragePaid || 0,
    loanDetails: purchaseDetails.loanDetails || null,
    notes: purchaseDetails.notes || '',
  };

  const updatedPurchases = [...(buyer.purchases || []), newPurchase];

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET purchases = :purchases, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':purchases': updatedPurchases,
      ':updatedAt': new Date().toISOString(),
    },
  }));

  return newPurchase;
}

/**
 * Update a specific purchase record
 */
export async function updateBuyerPurchase(tenantId, buyerId, propertyId, updates) {
  if (!tenantId || !buyerId || !propertyId) {
    throw new Error('Tenant ID, Buyer ID, and Property ID are required');
  }

  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
  }));

  const buyer = result.Item;
  if (!buyer) throw new Error('Buyer not found');

  const purchases = buyer.purchases || [];
  const purchaseIndex = purchases.findIndex(p => p.propertyId === propertyId);
  
  if (purchaseIndex === -1) throw new Error('Purchase not found');

  purchases[purchaseIndex] = { ...purchases[purchaseIndex], ...updates };

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#BUYER#${buyerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET purchases = :purchases, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':purchases': purchases,
      ':updatedAt': new Date().toISOString(),
    },
  }));

  return purchases[purchaseIndex];
}

// ============== TENANT Rental Management ==============

/**
 * Update tenant's current rental details
 */
export async function updateCurrentRental(tenantId, customerId, rentalDetails) {
  if (!tenantId || !customerId) throw new Error('Tenant ID and Customer ID are required');

  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE',
    },
  }));

  const customer = result.Item;
  if (!customer) throw new Error('Customer not found');

  const updatedRental = {
    ...(customer.currentRental || {}),
    ...rentalDetails,
  };

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET currentRental = :currentRental, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':currentRental': updatedRental,
      ':updatedAt': new Date().toISOString(),
    },
  }));

  return updatedRental;
}

/**
 * Move tenant's current rental to history (when lease ends)
 */
export async function moveTenantToHistory(tenantId, customerId) {
  if (!tenantId || !customerId) throw new Error('Tenant ID and Customer ID are required');

  const result = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE',
    },
  }));

  const customer = result.Item;
  if (!customer) throw new Error('Customer not found');
  if (!customer.currentRental) throw new Error('No current rental to archive');

  const rentalHistory = [...(customer.rentalHistory || []), customer.currentRental];

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#CUSTOMER#${customerId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET currentRental = :null, rentalHistory = :history, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':null': null,
      ':history': rentalHistory,
      ':updatedAt': new Date().toISOString(),
    },
  }));

  return { success: true, archivedRental: customer.currentRental };
}

// ============== PROPERTY Listing Management ==============

/**
 * List a property for sale
 */
export async function listPropertyForSale(tenantId, propertyId, listedPrice) {
  if (!tenantId || !propertyId) throw new Error('Tenant ID and Property ID are required');

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #status = :status, listingStatus = :listingStatus, saleInfo = :saleInfo, updatedAt = :updatedAt, GSI2PK = :gsi2pk',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'for-sale',
      ':listingStatus': 'active',
      ':saleInfo': {
        listedPrice: listedPrice || 0,
        soldPrice: null,
        soldDate: null,
        soldToBuyerId: null,
      },
      ':updatedAt': new Date().toISOString(),
      ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#for-sale`,
    },
  }));

  return { success: true };
}

/**
 * List a property for rent
 */
export async function listPropertyForRent(tenantId, propertyId, expectedRent, securityDeposit = 0) {
  if (!tenantId || !propertyId) throw new Error('Tenant ID and Property ID are required');

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #status = :status, listingStatus = :listingStatus, rentalInfo.expectedRent = :expectedRent, rentalInfo.securityDeposit = :securityDeposit, updatedAt = :updatedAt, GSI2PK = :gsi2pk',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'for-rent',
      ':listingStatus': 'active',
      ':expectedRent': expectedRent || 0,
      ':securityDeposit': securityDeposit,
      ':updatedAt': new Date().toISOString(),
      ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#for-rent`,
    },
  }));

  return { success: true };
}

/**
 * Mark a property as sold
 */
export async function markPropertySold(tenantId, propertyId, soldPrice, buyerId) {
  if (!tenantId || !propertyId) throw new Error('Tenant ID and Property ID are required');

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #status = :status, listingStatus = :listingStatus, saleInfo.soldPrice = :soldPrice, saleInfo.soldDate = :soldDate, saleInfo.soldToBuyerId = :buyerId, updatedAt = :updatedAt, GSI2PK = :gsi2pk',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'sold',
      ':listingStatus': 'inactive',
      ':soldPrice': soldPrice || 0,
      ':soldDate': new Date().toISOString(),
      ':buyerId': buyerId || null,
      ':updatedAt': new Date().toISOString(),
      ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#sold`,
    },
  }));

  return { success: true };
}

/**
 * Mark a property as rented
 */
export async function markPropertyRented(tenantId, propertyId, customerId, rentalDetails) {
  if (!tenantId || !propertyId || !customerId) {
    throw new Error('Tenant ID, Property ID, and Customer ID are required');
  }

  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #status = :status, listingStatus = :listingStatus, rentalInfo.currentRent = :currentRent, rentalInfo.currentTenantId = :tenantId, rentalInfo.leaseStartDate = :leaseStart, rentalInfo.leaseEndDate = :leaseEnd, updatedAt = :updatedAt, GSI2PK = :gsi2pk',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'rented',
      ':listingStatus': 'inactive',
      ':currentRent': rentalDetails.monthlyRent || 0,
      ':tenantId': customerId,
      ':leaseStart': rentalDetails.leaseStartDate || new Date().toISOString(),
      ':leaseEnd': rentalDetails.leaseEndDate || null,
      ':updatedAt': new Date().toISOString(),
      ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#rented`,
    },
  }));

  return { success: true };
}

/**
 * Vacate a property (move tenant to history, set property to vacant)
 */
export async function vacateProperty(tenantId, propertyId) {
  if (!tenantId || !propertyId) throw new Error('Tenant ID and Property ID are required');

  // Get property to find current tenant
  const propResult = await docClient.send(new GetCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
  }));

  const property = propResult.Item;
  if (!property) throw new Error('Property not found');

  const currentTenantId = property.rentalInfo?.currentTenantId;

  // Move tenant to history if exists
  if (currentTenantId) {
    try {
      await moveTenantToHistory(tenantId, currentTenantId);
    } catch (error) {
      console.error('Failed to archive tenant rental:', error);
      // Continue to vacate property even if tenant archival fails
    }
  }

  // Update property to vacant
  await docClient.send(new UpdateCommand({
    TableName: CRM_TABLE_NAME,
    Key: {
      PK: `TENANT#${tenantId}#PROPERTY#${propertyId}`,
      SK: 'PROFILE',
    },
    UpdateExpression: 'SET #status = :status, listingStatus = :listingStatus, rentalInfo.currentRent = :null, rentalInfo.currentTenantId = :null, rentalInfo.leaseStartDate = :null, rentalInfo.leaseEndDate = :null, updatedAt = :updatedAt, GSI2PK = :gsi2pk',
    ExpressionAttributeNames: {
      '#status': 'status',
    },
    ExpressionAttributeValues: {
      ':status': 'vacant',
      ':listingStatus': 'inactive',
      ':null': null,
      ':updatedAt': new Date().toISOString(),
      ':gsi2pk': `TENANT#${tenantId}#PROPERTY_STATUS#vacant`,
    },
  }));

  return { success: true, archivedTenantId: currentTenantId };
}

export default {
  addPurchaseToBuyer,
  updateBuyerPurchase,
  updateCurrentRental,
  moveTenantToHistory,
  listPropertyForSale,
  listPropertyForRent,
  markPropertySold,
  markPropertyRented,
  vacateProperty,
};
